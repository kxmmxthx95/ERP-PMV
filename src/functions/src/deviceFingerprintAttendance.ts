import type { Response } from "express";
import { onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import * as crypto from "crypto";
import { getAdminFirestore } from "./getAdminFirestore";
import { resolveUserRole } from "./lineUserLookup";

const REGION = "asia-southeast1";
const db = getAdminFirestore();

const STAFF_ROLES = new Set(["teacher", "staff", "admin", "sysadmin"]);

type AttendanceConfig = {
  lat: number;
  lng: number;
  radiusMeters: number;
  shiftStartHour: number;
  shiftStartMinute: number;
};

const DEFAULT_CONFIG: AttendanceConfig = {
  lat: 13.7563,
  lng: 100.5018,
  radiusMeters: 200,
  shiftStartHour: 8,
  shiftStartMinute: 0,
};

type AttendanceStatus = "present" | "late" | "absent";
type DeviceAction = "toggle" | "checkIn" | "checkOut" | "status" | "listUsers";

type UserListCategory = "student" | "teacher" | "special_teacher" | "staff";

function resolveUserListCategory(role: string, position?: string): UserListCategory {
  if (role === "student") return "student";
  if (role === "teacher") {
    const pos = (position ?? "").trim();
    if (pos === "ครูพิเศษ" || pos.includes("พิเศษ")) return "special_teacher";
    return "teacher";
  }
  return "staff";
}

function isSpecialTeacherPosition(position?: string): boolean {
  const pos = (position ?? "").trim();
  return pos === "ครูพิเศษ" || pos.includes("พิเศษ");
}

async function buildTeacherPositionMap(): Promise<Map<string, string>> {
  const snap = await db.collection("teachers").get();
  const map = new Map<string, string>();
  snap.forEach((docSnap) => {
    const data = docSnap.data() as Record<string, unknown>;
    const position = typeof data.position === "string" ? data.position.trim() : "";
    if (typeof data.userId === "string" && data.userId.trim()) {
      map.set(data.userId.trim(), position);
    }
    map.set(docSnap.id, position);
  });
  return map;
}

type EntrySnapshot = {
  status: AttendanceStatus;
  checkInTime: admin.firestore.Timestamp | null;
  checkOutTime: admin.firestore.Timestamp | null;
  overrideBy?: string;
};

type ResolvedStaffUser = {
  uid: string;
  displayName: string;
  role: string;
};

function hashApiKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

function getBangkokDateIso(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function getBangkokHourMinute(now = new Date()): { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Bangkok",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(now);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return { hour, minute };
}

function isBangkokWeekend(now = new Date()): boolean {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Bangkok",
    weekday: "short",
  }).format(now);
  return weekday === "Sat" || weekday === "Sun";
}

function formatBangkokTime(value: admin.firestore.Timestamp | null): string | null {
  if (!value) return null;
  return value.toDate().toLocaleTimeString("th-TH", {
    timeZone: "Asia/Bangkok",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function loadAttendanceConfig(): Promise<AttendanceConfig> {
  const snap = await db.collection("system_config").doc("staff_attendance").get();
  if (!snap.exists) return DEFAULT_CONFIG;
  const data = snap.data() ?? {};
  return {
    lat: typeof data.lat === "number" ? data.lat : DEFAULT_CONFIG.lat,
    lng: typeof data.lng === "number" ? data.lng : DEFAULT_CONFIG.lng,
    radiusMeters:
      typeof data.radiusMeters === "number" ? data.radiusMeters : DEFAULT_CONFIG.radiusMeters,
    shiftStartHour:
      typeof data.shiftStartHour === "number" ? data.shiftStartHour : DEFAULT_CONFIG.shiftStartHour,
    shiftStartMinute:
      typeof data.shiftStartMinute === "number"
        ? data.shiftStartMinute
        : DEFAULT_CONFIG.shiftStartMinute,
  };
}

async function resolveHoliday(todayStr: string): Promise<{ isHoliday: boolean; holidayTitle: string | null }> {
  if (isBangkokWeekend()) {
    const weekday = new Intl.DateTimeFormat("th-TH", {
      timeZone: "Asia/Bangkok",
      weekday: "long",
    }).format(new Date());
    return { isHoliday: true, holidayTitle: weekday };
  }

  const snap = await db.collection("calendar_events").where("type", "==", "holiday").get();
  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    const startDate = typeof data.startDate === "string" ? data.startDate : "";
    const endDate = typeof data.endDate === "string" ? data.endDate : startDate;
    if (startDate && todayStr >= startDate && todayStr <= endDate) {
      const title =
        typeof data.title === "string" && data.title.trim() ? data.title.trim() : "วันหยุด";
      return { isHoliday: true, holidayTitle: title };
    }
  }

  return { isHoliday: false, holidayTitle: null };
}

function computeCheckInStatus(
  now: Date,
  config: AttendanceConfig,
  isSpecialTeacher = false,
): AttendanceStatus {
  if (isSpecialTeacher) return "present";
  const { hour, minute } = getBangkokHourMinute(now);
  if (hour >= 12) return "absent";
  const afterShift =
    hour > config.shiftStartHour ||
    (hour === config.shiftStartHour && minute > config.shiftStartMinute);
  return afterShift ? "late" : "present";
}

function hasEffectiveCheckIn(entry: EntrySnapshot | null): boolean {
  if (!entry) return false;
  if (entry.checkInTime) return true;
  return !!entry.overrideBy && (entry.status === "present" || entry.status === "late");
}

function parseEntry(data: FirebaseFirestore.DocumentData | undefined): EntrySnapshot | null {
  if (!data) return null;
  const status = data.status;
  if (status !== "present" && status !== "late" && status !== "absent") return null;
  return {
    status,
    checkInTime:
      data.checkInTime instanceof admin.firestore.Timestamp ? data.checkInTime : null,
    checkOutTime:
      data.checkOutTime instanceof admin.firestore.Timestamp ? data.checkOutTime : null,
    overrideBy: typeof data.overrideBy === "string" ? data.overrideBy : undefined,
  };
}

function resolveDisplayName(data: Record<string, unknown>): string {
  if (typeof data.displayName === "string" && data.displayName.trim()) return data.displayName.trim();
  if (typeof data.name === "string" && data.name.trim()) return data.name.trim();
  if (typeof data.firstName === "string" && data.firstName.trim()) {
    const last = typeof data.lastName === "string" ? data.lastName.trim() : "";
    return `${data.firstName.trim()} ${last}`.trim();
  }
  return "Staff";
}

async function findUserByFingerprintTemplateId(
  templateId: number,
): Promise<ResolvedStaffUser | null> {
  const snap = await db
    .collection("users")
    .where("fingerprintTemplateId", "==", templateId)
    .limit(5)
    .get();

  for (const docSnap of snap.docs) {
    const data = docSnap.data() as Record<string, unknown>;
    const status = typeof data.status === "string" ? data.status : "active";
    if (status !== "active") continue;
    const role = resolveUserRole(data);
    if (!STAFF_ROLES.has(role)) continue;
    return {
      uid: docSnap.id,
      displayName: resolveDisplayName(data),
      role,
    };
  }
  return null;
}

async function verifyDevice(deviceId: string, apiKey: string): Promise<{ name: string } | null> {
  const trimmedId = deviceId.trim();
  const trimmedKey = apiKey.trim();
  if (!trimmedId || !trimmedKey) return null;

  const masterKey = process.env.DEVICE_FINGERPRINT_MASTER_KEY?.trim();
  if (masterKey && trimmedKey === masterKey) {
    return { name: trimmedId };
  }

  const snap = await db.collection("attendance_devices").doc(trimmedId).get();
  if (!snap.exists) return null;
  const data = snap.data() ?? {};
  if (data.active === false) return null;

  const storedHash = typeof data.apiKeyHash === "string" ? data.apiKeyHash : "";
  const incomingHash = hashApiKey(trimmedKey);
  if (!storedHash || storedHash !== incomingHash) return null;

  const name = typeof data.name === "string" && data.name.trim() ? data.name.trim() : trimmedId;
  return { name };
}

function jsonError(res: Response, status: number, message: string) {
  res.status(status).json({ success: false, message });
}

/**
 * HTTP endpoint สำหรับ ESP32 + AS608
 *
 * POST /api/device-fingerprint
 * Authorization: Bearer <DEVICE_API_KEY>
 * Body: { deviceId, fingerprintTemplateId, action?: "toggle"|"checkIn"|"checkOut"|"status" }
 */
export const deviceFingerprintAttendance = onRequest(
  {
    region: REGION,
    cors: true,
    invoker: "public",
  },
  async (req, res) => {
    if (req.method === "GET") {
      res.status(200).json({ status: "healthy", service: "deviceFingerprintAttendance" });
      return;
    }

    if (req.method !== "POST") {
      res.status(405).json({ success: false, message: "Method Not Allowed" });
      return;
    }

    try {
      const authHeader = typeof req.headers.authorization === "string" ? req.headers.authorization : "";
      const apiKey = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

      const body = (req.body ?? {}) as Record<string, unknown>;
      const deviceId = typeof body.deviceId === "string" ? body.deviceId.trim() : "";
      const actionRaw = typeof body.action === "string" ? body.action.trim() : "toggle";
      const action = actionRaw as DeviceAction;

      if (!deviceId) {
        jsonError(res, 400, "Missing deviceId");
        return;
      }
      if (!["toggle", "checkIn", "checkOut", "status", "listUsers"].includes(action)) {
        jsonError(res, 400, "Invalid action");
        return;
      }

      const device = await verifyDevice(deviceId, apiKey);
      if (!device) {
        jsonError(res, 401, "Unauthorized device");
        return;
      }

      if (action === "listUsers") {
        const [snap, teacherPositions] = await Promise.all([
          db.collection("users").where("fingerprintTemplateId", ">", 0).limit(120).get(),
          buildTeacherPositionMap(),
        ]);

        const users = snap.docs
          .map((docSnap) => {
            const data = docSnap.data() as Record<string, unknown>;
            const status = typeof data.status === "string" ? data.status : "active";
            if (status !== "active") return null;
            const templateId = data.fingerprintTemplateId;
            if (typeof templateId !== "number" || templateId < 1 || templateId > 127) return null;
            const role = resolveUserRole(data);
            if (!role) return null;
            const position =
              teacherPositions.get(docSnap.id) ??
              (typeof data.teacherId === "string" ? teacherPositions.get(data.teacherId) : undefined) ??
              "";
            const code =
              typeof data.studentCode === "string" && data.studentCode.trim()
                ? data.studentCode.trim()
                : undefined;
            return {
              templateId,
              name: resolveDisplayName(data),
              role,
              category: resolveUserListCategory(role, position),
              code,
            };
          })
          .filter((row): row is NonNullable<typeof row> => row !== null)
          .sort((a, b) => a.templateId - b.templateId);

        res.status(200).json({
          success: true,
          action: "listUsers",
          count: users.length,
          users,
        });
        return;
      }

      const templateRaw = body.fingerprintTemplateId;
      const fingerprintTemplateId =
        typeof templateRaw === "number"
          ? templateRaw
          : typeof templateRaw === "string"
            ? Number(templateRaw)
            : NaN;

      if (!Number.isInteger(fingerprintTemplateId) || fingerprintTemplateId < 1 || fingerprintTemplateId > 127) {
        jsonError(res, 400, "Invalid fingerprintTemplateId (1-127)");
        return;
      }

      const user = await findUserByFingerprintTemplateId(fingerprintTemplateId);
      if (!user) {
        res.status(404).json({
          success: false,
          message: "ไม่พบผู้ใช้ที่ผูกลายนิ้วมือนี้",
          fingerprintTemplateId,
        });
        return;
      }

      const todayStr = getBangkokDateIso();
      const holiday = await resolveHoliday(todayStr);
      const entryRef = db
        .collection("staff_attendance_by_date")
        .doc(todayStr)
        .collection("entries")
        .doc(user.uid);
      const entrySnap = await entryRef.get();
      const entry = parseEntry(entrySnap.exists ? entrySnap.data() : undefined);

      const checkedIn = hasEffectiveCheckIn(entry);
      const checkedOut = !!entry?.checkOutTime;

      let resolvedAction: "checkIn" | "checkOut" | "status" = "status";
      if (action === "toggle") {
        if (!checkedIn) resolvedAction = "checkIn";
        else if (!checkedOut) resolvedAction = "checkOut";
        else resolvedAction = "status";
      } else if (action === "checkIn" || action === "checkOut") {
        resolvedAction = action;
      }

      if (resolvedAction === "status" || action === "status") {
        res.status(200).json({
          success: true,
          action: "status",
          deviceName: device.name,
          date: todayStr,
          displayName: user.displayName,
          isHoliday: holiday.isHoliday,
          holidayTitle: holiday.holidayTitle,
          record: entry
            ? {
                status: entry.status,
                checkInTime: formatBangkokTime(entry.checkInTime),
                checkOutTime: formatBangkokTime(entry.checkOutTime),
              }
            : null,
          canCheckIn: !holiday.isHoliday && !checkedIn,
          canCheckOut: !holiday.isHoliday && checkedIn && !checkedOut,
        });
        return;
      }

      if (holiday.isHoliday) {
        res.status(409).json({
          success: false,
          message: `วันนี้เป็นวันหยุด (${holiday.holidayTitle ?? "วันหยุด"})`,
        });
        return;
      }

      const dayRef = db.collection("staff_attendance_by_date").doc(todayStr);

      if (resolvedAction === "checkIn") {
        if (checkedIn) {
          res.status(200).json({
            success: true,
            alreadyDone: true,
            action: "checkIn",
            displayName: user.displayName,
            message: "เช็คอินแล้ววันนี้",
            record: {
              status: entry!.status,
              checkInTime: formatBangkokTime(entry!.checkInTime),
              checkOutTime: formatBangkokTime(entry!.checkOutTime),
            },
          });
          return;
        }

        const config = await loadAttendanceConfig();
        const now = new Date();
        const teacherPositions = await buildTeacherPositionMap();
        const position = teacherPositions.get(user.uid) ?? "";
        const status = computeCheckInStatus(now, config, isSpecialTeacherPosition(position));

        await db.runTransaction(async (tx) => {
          const fresh = await tx.get(entryRef);
          const existing = parseEntry(fresh.exists ? fresh.data() : undefined);
          if (hasEffectiveCheckIn(existing)) return;

          tx.set(
            dayRef,
            {
              date: todayStr,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true },
          );
          tx.set(
            entryRef,
            {
              userId: user.uid,
              displayName: user.displayName,
              date: todayStr,
              checkInTime: admin.firestore.FieldValue.serverTimestamp(),
              checkOutTime: null,
              status,
              source: "fingerprint_device",
              deviceId,
              fingerprintTemplateId,
              lat: config.lat,
              lng: config.lng,
            },
            { merge: true },
          );
        });

        const updated = await entryRef.get();
        const updatedEntry = parseEntry(updated.data());
        res.status(200).json({
          success: true,
          action: "checkIn",
          displayName: user.displayName,
          message: status === "late" ? "เช็คอิน (มาสาย)" : "เช็คอินสำเร็จ",
          record: updatedEntry
            ? {
                status: updatedEntry.status,
                checkInTime: formatBangkokTime(updatedEntry.checkInTime),
                checkOutTime: formatBangkokTime(updatedEntry.checkOutTime),
              }
            : null,
        });
        return;
      }

      // checkOut
      if (!checkedIn) {
        jsonError(res, 409, "ยังไม่ได้เช็คอินวันนี้");
        return;
      }
      if (checkedOut) {
        res.status(200).json({
          success: true,
          alreadyDone: true,
          action: "checkOut",
          displayName: user.displayName,
          message: "เช็คเอาต์แล้ววันนี้",
          record: {
            status: entry!.status,
            checkInTime: formatBangkokTime(entry!.checkInTime),
            checkOutTime: formatBangkokTime(entry!.checkOutTime),
          },
        });
        return;
      }

      await db.runTransaction(async (tx) => {
        const fresh = await tx.get(entryRef);
        const existing = parseEntry(fresh.exists ? fresh.data() : undefined);
        if (existing?.checkOutTime) return;

        tx.set(
          dayRef,
          {
            date: todayStr,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
        tx.set(
          entryRef,
          {
            checkOutTime: admin.firestore.FieldValue.serverTimestamp(),
            source: "fingerprint_device",
            deviceId,
            fingerprintTemplateId,
          },
          { merge: true },
        );
      });

      const updated = await entryRef.get();
      const updatedEntry = parseEntry(updated.data());
      res.status(200).json({
        success: true,
        action: "checkOut",
        displayName: user.displayName,
        message: "เช็คเอาต์สำเร็จ",
        record: updatedEntry
          ? {
              status: updatedEntry.status,
              checkInTime: formatBangkokTime(updatedEntry.checkInTime),
              checkOutTime: formatBangkokTime(updatedEntry.checkOutTime),
            }
          : null,
      });
    } catch (err) {
      console.error("[deviceFingerprintAttendance]", err);
      jsonError(res, 500, "Internal server error");
    }
  },
);

/** Helper สำหรับสร้าง apiKeyHash ตอนลงทะเบียนอุปกรณ์ */
export function hashDeviceApiKey(apiKey: string): string {
  return hashApiKey(apiKey);
}
