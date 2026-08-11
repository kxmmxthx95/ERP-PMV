"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notifySubstituteAssignment = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const getAdminFirestore_1 = require("./getAdminFirestore");
const linePush_1 = require("./linePush");
const substituteLineHelpers_1 = require("./substituteLineHelpers");
const REGION = "asia-southeast1";
const db = (0, getAdminFirestore_1.getAdminFirestore)();
function buildAssignmentMessage(data) {
    const dateLabel = data.date ? (0, substituteLineHelpers_1.formatSubstituteThaiDate)(data.date) : "-";
    const classLabel = data.classLabel || "";
    const taskLabel = data.scope === "rollcall"
        ? `เช็คชื่อเข้าแถวเช้า${classLabel ? ` (${classLabel})` : ""}`
        : `${data.subjectName || "-"}${classLabel ? ` · ${classLabel}` : ""} · คาบ ${data.period ?? "-"}`;
    return [
        "📋 คำขอสอนแทน",
        `จาก: ${data.originalTeacherName || "-"}`,
        `รายการ: ${taskLabel}`,
        `วันที่: ${dateLabel}`,
        ...(data.reason ? [`เหตุผล: ${data.reason}`] : []),
        "",
        "กรุณาเข้าระบบเพื่อตรวจสอบและยืนยัน/ปฏิเสธคำขอ",
        "",
        "🔗 ระบบบริหารโรงเรียน PMV-ONE",
    ].join("\n");
}
/**
 * เมื่อมีการมอบหมายครูสอนแทน (daily_schedules สร้างใหม่ สถานะ pending)
 * แจ้งเตือน LINE ไปยังครูที่ได้รับมอบหมายให้เข้าระบบตรวจสอบ
 */
exports.notifySubstituteAssignment = (0, firestore_1.onDocumentCreated)({
    document: "daily_schedules/{recordId}",
    region: REGION,
    database: (0, getAdminFirestore_1.getFirestoreDatabaseId)(),
    timeoutSeconds: 60,
    memory: "256MiB",
}, async (event) => {
    const snap = event.data;
    if (!snap)
        return;
    const data = snap.data();
    const substituteTeacherId = String(data.substituteTeacherId || "").trim();
    if (!substituteTeacherId)
        return;
    const token = (0, linePush_1.getLineChannelToken)();
    if (!token) {
        console.error("[notifySubstituteAssignment] LINE_CHANNEL_TOKEN not configured");
        return;
    }
    const lineUid = await (0, substituteLineHelpers_1.resolveTeacherLineUid)(db, substituteTeacherId);
    if (!lineUid) {
        console.warn(`[notifySubstituteAssignment] substitute ${substituteTeacherId} has no LINE linked`);
        return;
    }
    const result = await (0, linePush_1.pushLineMessage)(lineUid, buildAssignmentMessage(data), token);
    if (!result.ok) {
        console.error(`[notifySubstituteAssignment] push failed for ${substituteTeacherId}:`, result.error);
    }
});
//# sourceMappingURL=notifySubstituteAssignment.js.map