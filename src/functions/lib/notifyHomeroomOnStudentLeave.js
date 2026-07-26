"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notifyHomeroomOnStudentLeave = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const getAdminFirestore_1 = require("./getAdminFirestore");
const linePush_1 = require("./linePush");
const REGION = "asia-southeast1";
const db = (0, getAdminFirestore_1.getAdminFirestore)();
const LEAVE_TYPE_LABEL = {
    sick: "ลาป่วย",
    personal: "ลากิจ",
};
function formatThaiDate(dateStr) {
    try {
        const d = new Date(`${dateStr}T00:00:00`);
        return d.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
    }
    catch {
        return dateStr;
    }
}
function buildLeaveNotifyMessage(data, className) {
    const startDate = data.startDate || "";
    const endDate = data.endDate || "";
    const dateLabel = startDate === endDate ? formatThaiDate(startDate) : `${formatThaiDate(startDate)} – ${formatThaiDate(endDate)}`;
    return [
        "📋 แจ้งเตือนคำขอลานักเรียน",
        `นักเรียน: ${data.requesterName || "-"} (${className})`,
        `ประเภท: ${LEAVE_TYPE_LABEL[data.leaveType || ""] || data.leaveType || "-"}`,
        `วันที่ลา: ${dateLabel}`,
        `เหตุผล: ${data.reason || "-"}`,
        "",
        "กรุณาตรวจสอบและอนุมัติในระบบ",
        "",
        "🔗 ระบบบริหารโรงเรียน PMV-ONE",
    ].join("\n");
}
/**
 * เมื่อนักเรียนยื่นคำขอลา แจ้งเตือนไปยัง LINE ของครูประจำชั้น
 * (homeroomTeacherIds ตั้งค่าไว้ที่ระบบจัดการห้องเรียน — classes/{classId})
 */
exports.notifyHomeroomOnStudentLeave = (0, firestore_1.onDocumentCreated)({
    document: "leave_requests/{requestId}",
    region: REGION,
    database: (0, getAdminFirestore_1.getFirestoreDatabaseId)(),
    timeoutSeconds: 60,
    memory: "256MiB",
}, async (event) => {
    const snap = event.data;
    if (!snap)
        return;
    const data = snap.data();
    if (data.requesterType !== "student")
        return;
    const requesterId = data.requesterId;
    if (!requesterId)
        return;
    const studentSnap = await db.collection("students").doc(requesterId).get();
    const classId = studentSnap.data()?.classId;
    if (!classId) {
        console.warn(`[notifyHomeroomOnStudentLeave] student ${requesterId} has no classId`);
        return;
    }
    const classSnap = await db.collection("classes").doc(classId).get();
    if (!classSnap.exists)
        return;
    const classData = classSnap.data();
    const teacherIds = classData.homeroomTeacherIds?.length
        ? classData.homeroomTeacherIds
        : classData.homeroomTeacherId
            ? [classData.homeroomTeacherId]
            : [];
    if (teacherIds.length === 0) {
        console.warn(`[notifyHomeroomOnStudentLeave] class ${classId} has no homeroom teacher set`);
        return;
    }
    const token = (0, linePush_1.getLineChannelToken)();
    if (!token) {
        console.error("[notifyHomeroomOnStudentLeave] LINE_CHANNEL_TOKEN not configured");
        return;
    }
    const messageText = buildLeaveNotifyMessage(data, classData.className || "-");
    for (const teacherId of teacherIds) {
        const teacherSnap = await db.collection("teachers").doc(teacherId).get();
        const userId = teacherSnap.data()?.userId;
        if (!userId) {
            console.warn(`[notifyHomeroomOnStudentLeave] teacher ${teacherId} has no linked userId`);
            continue;
        }
        const userSnap = await db.collection("users").doc(userId).get();
        const userData = userSnap.data();
        const lineUid = String(userData?.lineUid || userData?.lineToken || "").trim();
        if (!lineUid) {
            console.warn(`[notifyHomeroomOnStudentLeave] teacher ${teacherId} has no LINE linked`);
            continue;
        }
        const result = await (0, linePush_1.pushLineMessage)(lineUid, messageText, token);
        if (!result.ok) {
            console.error(`[notifyHomeroomOnStudentLeave] push failed for teacher ${teacherId}:`, result.error);
        }
    }
});
//# sourceMappingURL=notifyHomeroomOnStudentLeave.js.map