import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";
import { getAdminFirestore, getFirestoreDatabaseId } from "./getAdminFirestore";
import type { StaffSummary, StudentSummary, StudentRollCallEntry } from "./reportMessage";

const REGION = "asia-southeast1";
const db = getAdminFirestore();

const RECIPIENT_ROLES = new Set(["admin", "sysadmin", "teacher", "staff"]);

interface ScheduleRecipientSnapshot {
  uid?: string;
  lineToken?: string;
}

interface DailyReportSchedule {
  enabled?: boolean;
  /** @deprecated ใช้ sendTimes แทน — เก็บรอบแรกเพื่อ backward compat */
  sendTime?: string;
  sendTimes?: string[];
  recipientUids?: string[];
  /** Snapshot จาก UI ตอนบันทึก — ใช้ lineToken สำรองเมื่อ users/{uid} ยังไม่ sync */
  recipients?: ScheduleRecipientSnapshot[];
  /** วันที่ส่งรอบล่าสุด (แสดงใน UI) */
  lastSentDate?: string;
  /** วันที่ของ lastSentSlotsDate */
  lastSentSlotsDate?: string;
  /** รอบที่ส่งแล้วในวัน lastSentSlotsDate เช่น ["08:00","17:00"] */
  lastSentTimes?: string[];
}

interface StaffSummaryInternal extends StaffSummary {}
interface StudentSummaryInternal extends StudentSummary {}

// Module-level cache — persists across warm invocations on the same instance.
// Skips the Firestore read on every tick when no send is due.
let _settingsCache: { data: DailyReportSchedule; ts: number } | null = null;
const SETTINGS_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function bangkokDateParts(now = new Date()): { date: string; time: string; hour: number } {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";

  const date = `${get("year")}-${get("month")}-${get("day")}`;
  const hour = get("hour");
  const minute = get("minute");
  const time = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  const hourNum = Number(hour);
  return { date, time, hour: Number.isFinite(hourNum) ? hourNum : 0 };
}

function normalizeTime(value: string | undefined): string | null {
  if (typeof value !== "string") return null;
  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function parseTimeToMinutes(t: string): number {
  const parts = t.split(":");
  return Number(parts[0]) * 60 + Number(parts[1] ?? 0);
}

/**
 * Returns the configured sendTime slot (e.g. "08:00") whose 5-minute window
 * contains currentTime, or null if no slot is active right now.
 *
 * Window: [slotMin, slotMin + 5) in minutes-of-day.
 * This makes the function tolerant of the ±0–4 minute jitter introduced by
 * "every 5 minutes" scheduling, while still deduplicating by the slot value.
 */
function matchSendSlot(sendTimes: string[], currentTime: string): string | null {
  const nowMin = parseTimeToMinutes(currentTime);
  for (const slot of sendTimes) {
    const slotMin = parseTimeToMinutes(slot);
    if (nowMin >= slotMin && nowMin < slotMin + 5) return slot;
  }
  return null;
}

function resolveSendTimes(schedule: DailyReportSchedule): string[] {
  const fromArray = Array.isArray(schedule.sendTimes)
    ? schedule.sendTimes
        .map(normalizeTime)
        .filter((t): t is string => t !== null)
    : [];
  if (fromArray.length > 0) {
    return [...new Set(fromArray)].sort();
  }
  const single = normalizeTime(schedule.sendTime);
  return single ? [single] : [];
}

/** โมดรอบเดียว (sendTime) — หลายรอบใช้ lastSentSlotsDate/lastSentTimes เท่านั้น */
function isLegacySingleSlotSchedule(schedule: DailyReportSchedule): boolean {
  return resolveSendTimes(schedule).length <= 1;
}

function getSentTimesForDate(schedule: DailyReportSchedule, date: string): Set<string> {
  const sent = new Set<string>();
  if (schedule.lastSentSlotsDate === date && Array.isArray(schedule.lastSentTimes)) {
    for (const raw of schedule.lastSentTimes) {
      const t = normalizeTime(raw);
      if (t) sent.add(t);
    }
    return sent;
  }
  // Legacy single-slot: lastSentDate หมายถึงส่งที่ sendTime แล้ว
  if (isLegacySingleSlotSchedule(schedule) && schedule.lastSentDate === date) {
    const legacy = normalizeTime(schedule.sendTime);
    if (legacy) sent.add(legacy);
  }
  return sent;
}

async function migrateLegacySentSlots(
  scheduleRef: FirebaseFirestore.DocumentReference,
  schedule: DailyReportSchedule,
  date: string,
): Promise<void> {
  if (schedule.lastSentSlotsDate === date) return;
  if (schedule.lastSentDate !== date) return;
  if (!isLegacySingleSlotSchedule(schedule)) return;
  const legacy = normalizeTime(schedule.sendTime);
  if (!legacy) return;
  await scheduleRef.set(
    {
      lastSentSlotsDate: date,
      lastSentTimes: [legacy],
    },
    { merge: true },
  );
}

async function loadStaffSummary(date: string, now = new Date()): Promise<StaffSummaryInternal> {
  const { date: todayBangkok, hour: bangkokHour } = bangkokDateParts(now);
  const isPastDate = date < todayBangkok;
  const isFutureDate = date > todayBangkok;
  const isTodayAfterNoon = date === todayBangkok && bangkokHour >= 12;
  const shouldMarkAbsent = isPastDate || isTodayAfterNoon;

  const staffSnap = await db
    .collection("users")
    .where("role", "in", ["teacher", "staff"])
    .get();

  const staffIds = new Set<string>();
  const staffNameById = new Map<string, string>();
  staffSnap.forEach((docSnap) => {
    staffIds.add(docSnap.id);
    const data = docSnap.data();
    const name =
      (typeof data.name === "string" && data.name.trim()) ||
      (typeof data.displayName === "string" && data.displayName.trim()) ||
      (typeof data.email === "string" && data.email.trim()) ||
      docSnap.id;
    staffNameById.set(docSnap.id, name);
  });

  const leaveSnap = await db
    .collection("leave_requests")
    .where("status", "==", "approved")
    .get();

  const onLeaveIds = new Set<string>();
  leaveSnap.forEach((docSnap) => {
    const row = docSnap.data();
    const requesterId = typeof row.requesterId === "string" ? row.requesterId : "";
    const startDate = typeof row.startDate === "string" ? row.startDate : "";
    const endDate = typeof row.endDate === "string" ? row.endDate : "";
    const requesterType = typeof row.requesterType === "string" ? row.requesterType : "";
    if (!requesterId || !staffIds.has(requesterId)) return;
    if (requesterType === "student") return;
    if (startDate <= date && endDate >= date) {
      onLeaveIds.add(requesterId);
    }
  });

  const entriesSnap = await db
    .collection("staff_attendance_by_date")
    .doc(date)
    .collection("entries")
    .get();

  const entryByUser = new Map<string, { status: string; hasCheckIn: boolean }>();

  entriesSnap.forEach((docSnap) => {
    const row = docSnap.data();
    const userId = typeof row.userId === "string" ? row.userId : docSnap.id;
    if (!staffIds.has(userId)) return;
    const status = typeof row.status === "string" ? row.status : "";
    const hasCheckIn = row.checkInTime != null;
    entryByUser.set(userId, { status, hasCheckIn });
  });

  let present = 0;
  let late = 0;
  let absent = 0;
  let leave = 0;
  let pending = 0;
  const lateNames: string[] = [];
  const pendingNames: string[] = [];

  staffIds.forEach((userId) => {
    const displayName = staffNameById.get(userId) ?? userId;
    if (onLeaveIds.has(userId) && !isFutureDate) {
      leave += 1;
      return;
    }

    const entry = entryByUser.get(userId);
    if (entry) {
      if (entry.status === "present" && entry.hasCheckIn) present += 1;
      else if (entry.status === "late" && entry.hasCheckIn) {
        late += 1;
        lateNames.push(displayName);
      } else if (entry.status === "absent") absent += 1;
      else if (shouldMarkAbsent) absent += 1;
      else {
        pending += 1;
        pendingNames.push(displayName);
      }
      return;
    }

    if (shouldMarkAbsent) absent += 1;
    else {
      pending += 1;
      pendingNames.push(displayName);
    }
  });

  lateNames.sort((a, b) => a.localeCompare(b, "th"));
  pendingNames.sort((a, b) => a.localeCompare(b, "th"));

  return {
    total: staffIds.size,
    present,
    late,
    absent,
    leave,
    pending,
    lateNames,
    pendingNames,
  };
}

async function loadStudentSummary(date: string): Promise<StudentSummaryInternal> {
  const snap = await db
    .collection("morning_rollcall")
    .where("date", "==", date)
    .get();

  let present = 0;
  let late = 0;
  let absent = 0;
  let leave = 0;
  const absentStudents: StudentRollCallEntry[] = [];
  const leaveStudents: StudentRollCallEntry[] = [];

  snap.forEach((docSnap) => {
    const data = docSnap.data() as Record<string, unknown>;
    const summary = (data.summary ?? {}) as Record<string, unknown>;
    const className =
      typeof data.className === "string" && data.className.trim()
        ? data.className.trim()
        : "ไม่ระบุชั้น";
    present += Number(summary.present ?? 0);
    late += Number(summary.late ?? 0);
    absent += Number(summary.absent ?? 0);
    leave += Number(summary.leave ?? 0);

    const attendance = Array.isArray(data.attendance) ? data.attendance : [];
    for (const row of attendance) {
      if (!row || typeof row !== "object") continue;
      const item = row as Record<string, unknown>;
      const name =
        typeof item.studentName === "string" ? item.studentName.trim() : "";
      const status = typeof item.status === "string" ? item.status : "";
      if (!name) continue;
      if (status === "absent") absentStudents.push({ name, className });
      if (status === "leave") leaveStudents.push({ name, className });
    }
  });

  const sortStudents = (a: StudentRollCallEntry, b: StudentRollCallEntry) =>
    a.className.localeCompare(b.className, "th") || a.name.localeCompare(b.name, "th");
  absentStudents.sort(sortStudents);
  leaveStudents.sort(sortStudents);

  return {
    sessions: snap.size,
    classes: snap.size,
    present,
    late,
    absent,
    leave,
    absentStudents,
    leaveStudents,
  };
}

function resolveLineId(
  userData: FirebaseFirestore.DocumentData | undefined,
  snapshotLineId?: string,
): string | undefined {
  const fromUserToken =
    typeof userData?.lineToken === "string" ? userData.lineToken.trim() : "";
  const fromUserUid =
    typeof userData?.lineUid === "string" ? userData.lineUid.trim() : "";
  const fromSnapshot =
    typeof snapshotLineId === "string" ? snapshotLineId.trim() : "";

  return fromUserToken || fromUserUid || fromSnapshot || undefined;
}

function inferRecipientRole(data: FirebaseFirestore.DocumentData): string {
  const role = typeof data.role === "string" ? data.role.trim() : "";
  if (role) return role;

  const email =
    typeof data.email === "string" ? data.email.trim().toLowerCase() : "";
  if (email === "sysadmin@pmv.com") return "sysadmin";

  return "";
}

async function resolveRecipients(
  uids: string[],
  snapshots: ScheduleRecipientSnapshot[] = [],
) {
  const recipients: Array<{ uid: string; lineToken?: string }> = [];
  const snapshotByUid = new Map<string, string>();

  for (const row of snapshots) {
    const uid = typeof row.uid === "string" ? row.uid.trim() : "";
    const lineToken = typeof row.lineToken === "string" ? row.lineToken.trim() : "";
    if (uid && lineToken) snapshotByUid.set(uid, lineToken);
  }

  for (const uid of uids) {
    const snapshotLineId = snapshotByUid.get(uid);
    const userSnap = await db.collection("users").doc(uid).get();
    const data = userSnap.exists ? (userSnap.data() ?? {}) : undefined;
    const lineId = resolveLineId(data, snapshotLineId);

    if (!lineId) {
      console.warn(
        `[reportDailyScheduled] uid=${uid} no LINE link on user doc or snapshot`,
      );
      continue;
    }

    if (snapshotLineId) {
      recipients.push({ uid, lineToken: lineId });
      continue;
    }

    if (!userSnap.exists) {
      console.warn(`[reportDailyScheduled] uid=${uid} user doc not found`);
      continue;
    }

    const role = inferRecipientRole(data ?? {});
    if (!RECIPIENT_ROLES.has(role)) {
      console.warn(`[reportDailyScheduled] uid=${uid} skipped role=${role || "unknown"}`);
      continue;
    }

    recipients.push({ uid, lineToken: lineId });
  }

  return recipients;
}

export const reportDailyScheduled = onSchedule(
  {
    // Runs every 5 minutes instead of every 1 minute.
    // matchSendSlot() accepts any configured sendTime within the current 5-minute window,
    // so reports arrive within 0–4 minutes of the configured time.
    // Combined with the module-level settings cache, Firestore reads drop from
    // ~1,440/day to ~12/day (one refresh per 10-minute cache window per instance).
    schedule: "every 5 minutes",
    timeZone: "Asia/Bangkok",
    region: REGION,
    timeoutSeconds: 120,
    memory: "256MiB",
  },
  async () => {
    const { date, time } = bangkokDateParts();
    const scheduleRef = db.collection("settings").doc("report_daily_schedule");

    // Fast path: serve from cache. Only read Firestore when cache is stale.
    const nowMs = Date.now();
    if (!_settingsCache || nowMs - _settingsCache.ts >= SETTINGS_CACHE_TTL_MS) {
      const snap = await scheduleRef.get();
      if (!snap.exists) return;
      _settingsCache = { data: snap.data() as DailyReportSchedule, ts: nowMs };
    }

    const cached = _settingsCache.data;
    if (!cached.enabled) return;

    const cachedSendTimes = resolveSendTimes(cached);
    if (cachedSendTimes.length === 0) return;

    // Quick check against cached settings — no Firestore read on misses
    const maybeSlot = matchSendSlot(cachedSendTimes, time);
    if (!maybeSlot) return;

    // We're in a send window. Re-fetch fresh settings for deduplication accuracy.
    const scheduleSnap = await scheduleRef.get();
    if (!scheduleSnap.exists) return;
    const schedule = scheduleSnap.data() as DailyReportSchedule;
    _settingsCache = { data: schedule, ts: Date.now() };

    if (!schedule.enabled) return;

    const sendTimes = resolveSendTimes(schedule);
    const matchedSlot = matchSendSlot(sendTimes, time);
    if (!matchedSlot) return;

    // Migrate legacy lastSentDate → lastSentTimes before deduplication check
    await migrateLegacySentSlots(scheduleRef, schedule, date);

    const scheduleSnapFresh = await scheduleRef.get();
    const scheduleFresh = (scheduleSnapFresh.data() ?? schedule) as DailyReportSchedule;
    _settingsCache = { data: scheduleFresh, ts: Date.now() };

    const sentTimes = getSentTimesForDate(scheduleFresh, date);
    if (sentTimes.has(matchedSlot)) {
      // Already sent this slot today (deduplication key = configured sendTime, not execution time)
      return;
    }

    const recipientUids = Array.isArray(schedule.recipientUids)
      ? schedule.recipientUids.filter((uid): uid is string => typeof uid === "string" && uid.trim().length > 0)
      : [];

    if (recipientUids.length === 0) {
      console.warn("[reportDailyScheduled] enabled but no recipientUids configured");
      await scheduleRef.set(
        {
          lastScheduleError: "no recipientUids configured",
          lastScheduleAttemptAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      return;
    }

    const recipientSnapshots = Array.isArray(schedule.recipients)
      ? schedule.recipients
      : [];

    const recipients = await resolveRecipients(recipientUids, recipientSnapshots);
    if (recipients.length === 0) {
      console.warn(
        `[reportDailyScheduled] no recipients with LINE linked (uids=${recipientUids.join(",")})`,
      );
      await scheduleRef.set(
        {
          lastScheduleError: "no recipients with LINE linked",
          lastScheduleAttemptAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      return;
    }

    const [staffSummary, studentSummary] = await Promise.all([
      loadStaffSummary(date),
      loadStudentSummary(date),
    ]);

    const sendRef = await db.collection("report_sends").add({
      reportType: "daily",
      date,
      staffSummary,
      studentSummary,
      leaveSummary: null,
      alertMessage: null,
      recipients,
      sentAt: admin.firestore.FieldValue.serverTimestamp(),
      triggeredBy: "scheduled",
      scheduleTime: matchedSlot, // configured slot (e.g. "08:00"), not actual execution minute
    });

    // Record matchedSlot (not actual time) so deduplication works correctly
    // even when the function runs at 08:03 for the "08:00" slot.
    const nextSentTimes = [...sentTimes, matchedSlot].sort();

    await scheduleRef.set(
      {
        lastSentSlotsDate: date,
        lastSentTimes: nextSentTimes,
        lastSentDate: date,
        lastSentAt: admin.firestore.FieldValue.serverTimestamp(),
        lastSendId: sendRef.id,
        lastScheduleError: admin.firestore.FieldValue.delete(),
        lastScheduleAttemptAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    console.log(
      `[reportDailyScheduled] queued daily report ${sendRef.id} for ${date} slot=${matchedSlot} (db=${getFirestoreDatabaseId()}) to ${recipients.length} recipients`,
    );
  },
);
