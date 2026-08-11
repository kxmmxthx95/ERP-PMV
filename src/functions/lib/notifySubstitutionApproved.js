"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notifySubstitutionApproved = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const getAdminFirestore_1 = require("./getAdminFirestore");
const linePush_1 = require("./linePush");
const substituteLineHelpers_1 = require("./substituteLineHelpers");
const REGION = "asia-southeast1";
const db = (0, getAdminFirestore_1.getAdminFirestore)();
function buildApprovedMessage(data) {
    const dateLabel = data.date ? (0, substituteLineHelpers_1.formatSubstituteThaiDate)(data.date) : "-";
    const classLabel = data.classLabel || "";
    const taskLabel = data.scope === "rollcall"
        ? `เช็คชื่อเข้าแถวเช้า${classLabel ? ` (${classLabel})` : ""}`
        : `${data.subjectName || "-"}${classLabel ? ` · ${classLabel}` : ""} · คาบ ${data.period ?? "-"}`;
    return [
        "✅ ยืนยันการสอนแทนแล้ว",
        `ครูเดิม: ${data.originalTeacherName || "-"}`,
        `ครูสอนแทน: ${data.substituteTeacherName || "-"}`,
        `รายการ: ${taskLabel}`,
        `วันที่: ${dateLabel}`,
        "",
        "🔗 ระบบบริหารโรงเรียน PMV-ONE",
    ].join("\n");
}
/**
 * เมื่อครูสอนแทนกดอนุมัติคำขอ (daily_schedules.status → approved)
 * แจ้งเตือน LINE ไปยังผู้ใช้ role sysadmin/admin ว่ามีการสอนแทนเกิดขึ้น
 */
exports.notifySubstitutionApproved = (0, firestore_1.onDocumentUpdated)({
    document: "daily_schedules/{recordId}",
    region: REGION,
    database: (0, getAdminFirestore_1.getFirestoreDatabaseId)(),
    timeoutSeconds: 60,
    memory: "256MiB",
}, async (event) => {
    const change = event.data;
    if (!change)
        return;
    const before = change.before.data();
    const after = change.after.data();
    if (before.status === "approved" || after.status !== "approved")
        return;
    const token = (0, linePush_1.getLineChannelToken)();
    if (!token) {
        console.error("[notifySubstitutionApproved] LINE_CHANNEL_TOKEN not configured");
        return;
    }
    const adminsSnap = await db.collection("users").where("role", "in", ["admin", "sysadmin"]).get();
    if (adminsSnap.empty)
        return;
    const messageText = buildApprovedMessage(after);
    for (const userDoc of adminsSnap.docs) {
        const userData = userDoc.data();
        const lineUid = String(userData?.lineUid || userData?.lineToken || "").trim();
        if (!lineUid)
            continue;
        const result = await (0, linePush_1.pushLineMessage)(lineUid, messageText, token);
        if (!result.ok) {
            console.error(`[notifySubstitutionApproved] push failed for admin ${userDoc.id}:`, result.error);
        }
    }
});
//# sourceMappingURL=notifySubstitutionApproved.js.map