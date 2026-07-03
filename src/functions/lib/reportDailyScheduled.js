"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reportDailyScheduled = void 0;
const scheduler_1 = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");
const getAdminFirestore_1 = require("./getAdminFirestore");
const REGION = "asia-southeast1";
const db = (0, getAdminFirestore_1.getAdminFirestore)();
const RECIPIENT_ROLES = new Set(["admin", "sysadmin", "teacher", "staff"]);
function bangkokDateParts(now = new Date()) {
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
    const get = (type) => parts.find((p) => p.type === type)?.value ?? "";
    const date = `${get("year")}-${get("month")}-${get("day")}`;
    const hour = get("hour");
    const minute = get("minute");
    const time = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    const hourNum = Number(hour);
    return { date, time, hour: Number.isFinite(hourNum) ? hourNum : 0 };
}
function normalizeTime(value) {
    if (typeof value !== "string")
        return null;
    const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);
    if (!match)
        return null;
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59)
        return null;
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}
function resolveSendTimes(schedule) {
    const fromArray = Array.isArray(schedule.sendTimes)
        ? schedule.sendTimes
            .map(normalizeTime)
            .filter((t) => t !== null)
        : [];
    if (fromArray.length > 0) {
        return [...new Set(fromArray)].sort();
    }
    const single = normalizeTime(schedule.sendTime);
    return single ? [single] : [];
}
/** โหมดรอบเดียว (sendTime) — หลายรอบใช้ lastSentSlotsDate/lastSentTimes เท่านั้น */
function isLegacySingleSlotSchedule(schedule) {
    return resolveSendTimes(schedule).length <= 1;
}
function getSentTimesForDate(schedule, date) {
    const sent = new Set();
    if (schedule.lastSentSlotsDate === date && Array.isArray(schedule.lastSentTimes)) {
        for (const raw of schedule.lastSentTimes) {
            const t = normalizeTime(raw);
            if (t)
                sent.add(t);
        }
        return sent;
    }
    // Legacy single-slot: lastSentDate หมายถึงส่งที่ sendTime แล้ว — ห้ามใช้กับหลายรอบ
    // (sendTime ถูกเก็บเป็นรอบแรกหลัง sort ไม่ใช่รอบที่ส่งจริง)
    if (isLegacySingleSlotSchedule(schedule) && schedule.lastSentDate === date) {
        const legacy = normalizeTime(schedule.sendTime);
        if (legacy)
            sent.add(legacy);
    }
    return sent;
}
async function migrateLegacySentSlots(scheduleRef, schedule, date) {
    if (schedule.lastSentSlotsDate === date)
        return;
    if (schedule.lastSentDate !== date)
        return;
    if (!isLegacySingleSlotSchedule(schedule))
        return;
    const legacy = normalizeTime(schedule.sendTime);
    if (!legacy)
        return;
    await scheduleRef.set({
        lastSentSlotsDate: date,
        lastSentTimes: [legacy],
    }, { merge: true });
}
async function loadStaffSummary(date, now = new Date()) {
    const { date: todayBangkok, hour: bangkokHour } = bangkokDateParts(now);
    const isPastDate = date < todayBangkok;
    const isFutureDate = date > todayBangkok;
    const isTodayAfterNoon = date === todayBangkok && bangkokHour >= 12;
    const shouldMarkAbsent = isPastDate || isTodayAfterNoon;
    const staffSnap = await db
        .collection("users")
        .where("role", "in", ["teacher", "staff"])
        .get();
    const staffIds = new Set();
    const staffNameById = new Map();
    staffSnap.forEach((docSnap) => {
        staffIds.add(docSnap.id);
        const data = docSnap.data();
        const name = (typeof data.name === "string" && data.name.trim()) ||
            (typeof data.displayName === "string" && data.displayName.trim()) ||
            (typeof data.email === "string" && data.email.trim()) ||
            docSnap.id;
        staffNameById.set(docSnap.id, name);
    });
    const leaveSnap = await db
        .collection("leave_requests")
        .where("status", "==", "approved")
        .get();
    const onLeaveIds = new Set();
    leaveSnap.forEach((docSnap) => {
        const row = docSnap.data();
        const requesterId = typeof row.requesterId === "string" ? row.requesterId : "";
        const startDate = typeof row.startDate === "string" ? row.startDate : "";
        const endDate = typeof row.endDate === "string" ? row.endDate : "";
        const requesterType = typeof row.requesterType === "string" ? row.requesterType : "";
        if (!requesterId || !staffIds.has(requesterId))
            return;
        if (requesterType === "student")
            return;
        if (startDate <= date && endDate >= date) {
            onLeaveIds.add(requesterId);
        }
    });
    const entriesSnap = await db
        .collection("staff_attendance_by_date")
        .doc(date)
        .collection("entries")
        .get();
    const entryByUser = new Map();
    entriesSnap.forEach((docSnap) => {
        const row = docSnap.data();
        const userId = typeof row.userId === "string" ? row.userId : docSnap.id;
        if (!staffIds.has(userId))
            return;
        const status = typeof row.status === "string" ? row.status : "";
        const hasCheckIn = row.checkInTime != null;
        entryByUser.set(userId, { status, hasCheckIn });
    });
    let present = 0;
    let late = 0;
    let absent = 0;
    let leave = 0;
    let pending = 0;
    const lateNames = [];
    const pendingNames = [];
    staffIds.forEach((userId) => {
        const displayName = staffNameById.get(userId) ?? userId;
        if (onLeaveIds.has(userId) && !isFutureDate) {
            leave += 1;
            return;
        }
        const entry = entryByUser.get(userId);
        if (entry) {
            if (entry.status === "present" && entry.hasCheckIn)
                present += 1;
            else if (entry.status === "late" && entry.hasCheckIn) {
                late += 1;
                lateNames.push(displayName);
            }
            else if (entry.status === "absent")
                absent += 1;
            else if (shouldMarkAbsent)
                absent += 1;
            else {
                pending += 1;
                pendingNames.push(displayName);
            }
            return;
        }
        if (shouldMarkAbsent)
            absent += 1;
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
async function loadStudentSummary(date) {
    const snap = await db
        .collection("morning_rollcall")
        .where("date", "==", date)
        .get();
    let present = 0;
    let late = 0;
    let absent = 0;
    let leave = 0;
    const absentStudents = [];
    const leaveStudents = [];
    snap.forEach((docSnap) => {
        const data = docSnap.data();
        const summary = (data.summary ?? {});
        const className = typeof data.className === "string" && data.className.trim()
            ? data.className.trim()
            : "ไม่ระบุชั้น";
        present += Number(summary.present ?? 0);
        late += Number(summary.late ?? 0);
        absent += Number(summary.absent ?? 0);
        leave += Number(summary.leave ?? 0);
        const attendance = Array.isArray(data.attendance) ? data.attendance : [];
        for (const row of attendance) {
            if (!row || typeof row !== "object")
                continue;
            const item = row;
            const name = typeof item.studentName === "string" ? item.studentName.trim() : "";
            const status = typeof item.status === "string" ? item.status : "";
            if (!name)
                continue;
            if (status === "absent")
                absentStudents.push({ name, className });
            if (status === "leave")
                leaveStudents.push({ name, className });
        }
    });
    const sortStudents = (a, b) => a.className.localeCompare(b.className, "th") || a.name.localeCompare(b.name, "th");
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
function resolveLineId(userData, snapshotLineId) {
    const fromUserToken = typeof userData?.lineToken === "string" ? userData.lineToken.trim() : "";
    const fromUserUid = typeof userData?.lineUid === "string" ? userData.lineUid.trim() : "";
    const fromSnapshot = typeof snapshotLineId === "string" ? snapshotLineId.trim() : "";
    return fromUserToken || fromUserUid || fromSnapshot || undefined;
}
function inferRecipientRole(data) {
    const role = typeof data.role === "string" ? data.role.trim() : "";
    if (role)
        return role;
    const email = typeof data.email === "string" ? data.email.trim().toLowerCase() : "";
    if (email === "sysadmin@pmv.com")
        return "sysadmin";
    return "";
}
async function resolveRecipients(uids, snapshots = []) {
    const recipients = [];
    const snapshotByUid = new Map();
    for (const row of snapshots) {
        const uid = typeof row.uid === "string" ? row.uid.trim() : "";
        const lineToken = typeof row.lineToken === "string" ? row.lineToken.trim() : "";
        if (uid && lineToken)
            snapshotByUid.set(uid, lineToken);
    }
    for (const uid of uids) {
        const snapshotLineId = snapshotByUid.get(uid);
        const userSnap = await db.collection("users").doc(uid).get();
        const data = userSnap.exists ? (userSnap.data() ?? {}) : undefined;
        const lineId = resolveLineId(data, snapshotLineId);
        if (!lineId) {
            console.warn(`[reportDailyScheduled] uid=${uid} no LINE link on user doc or snapshot`);
            continue;
        }
        // ผู้รับที่บันทึกพร้อม LINE snapshot จาก UI — ส่งได้เลย (UI กรอง role แล้ว)
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
exports.reportDailyScheduled = (0, scheduler_1.onSchedule)({
    schedule: "every 1 minutes",
    timeZone: "Asia/Bangkok",
    region: REGION,
    timeoutSeconds: 120,
    memory: "256MiB",
}, async () => {
    const scheduleRef = db.collection("settings").doc("report_daily_schedule");
    const scheduleSnap = await scheduleRef.get();
    if (!scheduleSnap.exists) {
        return;
    }
    const schedule = scheduleSnap.data();
    if (!schedule.enabled) {
        return;
    }
    const sendTimes = resolveSendTimes(schedule);
    if (sendTimes.length === 0) {
        console.warn("[reportDailyScheduled] invalid sendTimes / sendTime");
        return;
    }
    const { date, time } = bangkokDateParts();
    if (!sendTimes.includes(time)) {
        return;
    }
    // แปลง lastSentDate แบบเก่า → lastSentTimes (บล็อกเฉพาะรอบที่ส่งแล้ว ไม่บล็อกทั้งวัน)
    await migrateLegacySentSlots(scheduleRef, schedule, date);
    const scheduleSnapFresh = await scheduleRef.get();
    const scheduleFresh = (scheduleSnapFresh.data() ?? schedule);
    const sentTimes = getSentTimesForDate(scheduleFresh, date);
    if (sentTimes.has(time)) {
        return;
    }
    const recipientUids = Array.isArray(schedule.recipientUids)
        ? schedule.recipientUids.filter((uid) => typeof uid === "string" && uid.trim().length > 0)
        : [];
    if (recipientUids.length === 0) {
        console.warn("[reportDailyScheduled] enabled but no recipientUids configured");
        await scheduleRef.set({
            lastScheduleError: "no recipientUids configured",
            lastScheduleAttemptAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        return;
    }
    const recipientSnapshots = Array.isArray(schedule.recipients)
        ? schedule.recipients
        : [];
    const recipients = await resolveRecipients(recipientUids, recipientSnapshots);
    if (recipients.length === 0) {
        console.warn(`[reportDailyScheduled] no recipients with LINE linked (uids=${recipientUids.join(",")})`);
        await scheduleRef.set({
            lastScheduleError: "no recipients with LINE linked",
            lastScheduleAttemptAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
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
        scheduleTime: time,
    });
    const nextSentTimes = [...sentTimes, time].sort();
    await scheduleRef.set({
        lastSentSlotsDate: date,
        lastSentTimes: nextSentTimes,
        lastSentDate: date,
        lastSentAt: admin.firestore.FieldValue.serverTimestamp(),
        lastSendId: sendRef.id,
        lastScheduleError: admin.firestore.FieldValue.delete(),
        lastScheduleAttemptAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    console.log(`[reportDailyScheduled] queued daily report ${sendRef.id} for ${date} at ${time} (db=${(0, getAdminFirestore_1.getFirestoreDatabaseId)()}) to ${recipients.length} recipients`);
});
//# sourceMappingURL=reportDailyScheduled.js.map