"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.lineStaffAttendance = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const axios_1 = require("axios");
const getAdminFirestore_1 = require("./getAdminFirestore");
const lineUserLookup_1 = require("./lineUserLookup");
const REGION = "asia-southeast1";
const db = (0, getAdminFirestore_1.getAdminFirestore)();
const STAFF_ROLES = new Set(["teacher", "staff", "admin", "sysadmin"]);
const DEFAULT_CONFIG = {
    lat: 13.7563,
    lng: 100.5018,
    radiusMeters: 200,
    shiftStartHour: 8,
    shiftStartMinute: 0,
};
function haversineDistance(lat1, lng1, lat2, lng2) {
    const R = 6371000;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) *
            Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function getBangkokDateIso(now = new Date()) {
    return new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Bangkok",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(now);
}
function getBangkokHourMinute(now = new Date()) {
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
function isBangkokWeekend(now = new Date()) {
    const weekday = new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Bangkok",
        weekday: "short",
    }).format(now);
    return weekday === "Sat" || weekday === "Sun";
}
function formatBangkokTime(value) {
    if (!value)
        return null;
    return value.toDate().toLocaleTimeString("th-TH", {
        timeZone: "Asia/Bangkok",
        hour: "2-digit",
        minute: "2-digit",
    });
}
async function verifyLineAccessToken(accessToken) {
    try {
        const res = await axios_1.default.get("https://api.line.me/v2/profile", {
            headers: { Authorization: `Bearer ${accessToken}` },
            timeout: 10000,
        });
        const userId = typeof res.data?.userId === "string" ? res.data.userId.trim() : "";
        if (!userId) {
            throw new https_1.HttpsError("unauthenticated", "Invalid LINE profile");
        }
        const displayName = typeof res.data?.displayName === "string" && res.data.displayName.trim()
            ? res.data.displayName.trim()
            : "LINE User";
        return { userId, displayName };
    }
    catch (err) {
        if (axios_1.default.isAxiosError(err) && (err.response?.status === 401 || err.response?.status === 403)) {
            throw new https_1.HttpsError("unauthenticated", "LINE session expired — กรุณาเปิดใหม่จาก LINE");
        }
        console.error("[lineStaffAttendance] LINE profile error", err);
        throw new https_1.HttpsError("unavailable", "Cannot verify LINE account");
    }
}
async function loadAttendanceConfig() {
    const snap = await db.collection("system_config").doc("staff_attendance").get();
    if (!snap.exists)
        return DEFAULT_CONFIG;
    const data = snap.data() ?? {};
    return {
        lat: typeof data.lat === "number" ? data.lat : DEFAULT_CONFIG.lat,
        lng: typeof data.lng === "number" ? data.lng : DEFAULT_CONFIG.lng,
        radiusMeters: typeof data.radiusMeters === "number" ? data.radiusMeters : DEFAULT_CONFIG.radiusMeters,
        shiftStartHour: typeof data.shiftStartHour === "number" ? data.shiftStartHour : DEFAULT_CONFIG.shiftStartHour,
        shiftStartMinute: typeof data.shiftStartMinute === "number"
            ? data.shiftStartMinute
            : DEFAULT_CONFIG.shiftStartMinute,
    };
}
async function resolveHoliday(todayStr) {
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
            const title = typeof data.title === "string" && data.title.trim() ? data.title.trim() : "วันหยุด";
            return { isHoliday: true, holidayTitle: title };
        }
    }
    return { isHoliday: false, holidayTitle: null };
}
function isSpecialTeacherPosition(position) {
    const pos = (position ?? "").trim();
    return pos === "ครูพิเศษ" || pos.includes("พิเศษ");
}
async function buildTeacherPositionMap() {
    const snap = await db.collection("teachers").get();
    const map = new Map();
    snap.forEach((docSnap) => {
        const data = docSnap.data();
        const position = typeof data.position === "string" ? data.position.trim() : "";
        if (typeof data.userId === "string" && data.userId.trim()) {
            map.set(data.userId.trim(), position);
        }
        map.set(docSnap.id, position);
    });
    return map;
}
function computeCheckInStatus(now, config, isSpecialTeacher = false) {
    if (isSpecialTeacher)
        return "present";
    const { hour, minute } = getBangkokHourMinute(now);
    if (hour >= 12)
        return "absent";
    const afterShift = hour > config.shiftStartHour ||
        (hour === config.shiftStartHour && minute > config.shiftStartMinute);
    return afterShift ? "late" : "present";
}
function hasEffectiveCheckIn(entry) {
    if (!entry)
        return false;
    if (entry.checkInTime)
        return true;
    return (!!entry.overrideBy &&
        (entry.status === "present" || entry.status === "late"));
}
function parseEntry(data) {
    if (!data)
        return null;
    const status = data.status;
    if (status !== "present" && status !== "late" && status !== "absent")
        return null;
    return {
        status,
        checkInTime: data.checkInTime instanceof admin.firestore.Timestamp ? data.checkInTime : null,
        checkOutTime: data.checkOutTime instanceof admin.firestore.Timestamp ? data.checkOutTime : null,
        overrideBy: typeof data.overrideBy === "string" ? data.overrideBy : undefined,
    };
}
function buildStatusPayload(todayStr, holiday, entry, displayName) {
    const checkedIn = hasEffectiveCheckIn(entry);
    const checkedOut = !!entry?.checkOutTime;
    return {
        date: todayStr,
        displayName,
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
    };
}
exports.lineStaffAttendance = (0, https_1.onCall)({
    region: REGION,
    cors: [
        "https://pmv1-90180.web.app",
        "https://pmv1-90180.firebaseapp.com",
        "http://localhost:3000",
    ],
    invoker: "public",
}, async (request) => {
    const accessToken = typeof request.data?.accessToken === "string" ? request.data.accessToken.trim() : "";
    const actionRaw = typeof request.data?.action === "string" ? request.data.action.trim() : "status";
    const action = actionRaw;
    if (!accessToken) {
        throw new https_1.HttpsError("invalid-argument", "Missing LINE access token");
    }
    if (action !== "status" && action !== "checkIn" && action !== "checkOut") {
        throw new https_1.HttpsError("invalid-argument", "Invalid action");
    }
    const lineProfile = await verifyLineAccessToken(accessToken);
    const user = await (0, lineUserLookup_1.findUserByLineId)(db, lineProfile.userId);
    if (!user) {
        return {
            linked: false,
            lineDisplayName: lineProfile.displayName,
            message: "ยังไม่ได้เชื่อมบัญชี PMV — พิมพ์ PMV ใน LINE แล้วเปิดลิงก์จากระบบ",
        };
    }
    if (!STAFF_ROLES.has(user.role)) {
        throw new https_1.HttpsError("permission-denied", "ฟีเจอร์นี้สำหรับครูและบุคลากรเท่านั้น");
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
    if (action === "status") {
        return {
            linked: true,
            ...buildStatusPayload(todayStr, holiday, entry, user.displayName),
        };
    }
    if (holiday.isHoliday) {
        throw new https_1.HttpsError("failed-precondition", `วันนี้เป็นวันหยุด (${holiday.holidayTitle ?? "วันหยุด"}) ไม่สามารถลงเวลาทำงานได้`);
    }
    if (action === "checkIn") {
        if (hasEffectiveCheckIn(entry)) {
            return {
                linked: true,
                success: true,
                alreadyDone: true,
                ...buildStatusPayload(todayStr, holiday, entry, user.displayName),
            };
        }
        const lat = typeof request.data?.latitude === "number" ? request.data.latitude : NaN;
        const lng = typeof request.data?.longitude === "number" ? request.data.longitude : NaN;
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            throw new https_1.HttpsError("invalid-argument", "ต้องเปิด GPS เพื่อเช็คอิน");
        }
        const config = await loadAttendanceConfig();
        const distance = haversineDistance(lat, lng, config.lat, config.lng);
        if (distance > config.radiusMeters) {
            throw new https_1.HttpsError("failed-precondition", `คุณอยู่นอกพื้นที่โรงเรียน (ห่าง ${Math.round(distance)} เมตร / รัศมี ${config.radiusMeters} เมตร)`);
        }
        const teacherPositions = await buildTeacherPositionMap();
        const position = teacherPositions.get(user.uid) ?? "";
        const now = new Date();
        const status = computeCheckInStatus(now, config, isSpecialTeacherPosition(position));
        const dayRef = db.collection("staff_attendance_by_date").doc(todayStr);
        await db.runTransaction(async (tx) => {
            const fresh = await tx.get(entryRef);
            const existing = parseEntry(fresh.exists ? fresh.data() : undefined);
            if (hasEffectiveCheckIn(existing))
                return;
            tx.set(dayRef, {
                date: todayStr,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
            tx.set(entryRef, {
                userId: user.uid,
                displayName: user.displayName,
                date: todayStr,
                checkInTime: admin.firestore.FieldValue.serverTimestamp(),
                checkOutTime: null,
                status,
                lat,
                lng,
                source: "line_liff",
            }, { merge: true });
        });
        const updated = await entryRef.get();
        const updatedEntry = parseEntry(updated.data());
        return {
            linked: true,
            success: true,
            ...buildStatusPayload(todayStr, holiday, updatedEntry, user.displayName),
        };
    }
    // checkOut
    if (!hasEffectiveCheckIn(entry)) {
        throw new https_1.HttpsError("failed-precondition", "ไม่พบเวลาเข้าในระบบ กรุณาเช็คอินก่อนเช็กเอาต์");
    }
    if (entry?.checkOutTime) {
        return {
            linked: true,
            success: true,
            alreadyDone: true,
            ...buildStatusPayload(todayStr, holiday, entry, user.displayName),
        };
    }
    const dayRef = db.collection("staff_attendance_by_date").doc(todayStr);
    await db.runTransaction(async (tx) => {
        const fresh = await tx.get(entryRef);
        const existing = parseEntry(fresh.exists ? fresh.data() : undefined);
        if (existing?.checkOutTime)
            return;
        tx.set(dayRef, {
            date: todayStr,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        tx.set(entryRef, {
            checkOutTime: admin.firestore.FieldValue.serverTimestamp(),
            source: "line_liff",
        }, { merge: true });
    });
    const updated = await entryRef.get();
    const updatedEntry = parseEntry(updated.data());
    return {
        linked: true,
        success: true,
        ...buildStatusPayload(todayStr, holiday, updatedEntry, user.displayName),
    };
});
//# sourceMappingURL=lineStaffAttendance.js.map