"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendLineReport = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");
const getAdminFirestore_1 = require("./getAdminFirestore");
const reportMessage_1 = require("./reportMessage");
const linePush_1 = require("./linePush");
const REGION = "asia-southeast1";
const db = (0, getAdminFirestore_1.getAdminFirestore)();
function resolveLineUid(userData, payloadToken) {
    const fromUserToken = typeof userData?.lineToken === "string" ? userData.lineToken.trim() : "";
    const fromUserUid = typeof userData?.lineUid === "string" ? userData.lineUid.trim() : "";
    const fromPayload = typeof payloadToken === "string" ? payloadToken.trim() : "";
    return fromUserToken || fromUserUid || fromPayload || undefined;
}
function formatThaiDate(dateStr) {
    try {
        const d = new Date(dateStr + "T00:00:00");
        return d.toLocaleDateString("th-TH", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
        });
    }
    catch {
        return dateStr;
    }
}
function buildWeeklyMessage(date, staff, student) {
    return [
        "📅 รายงานประจำสัปดาห์",
        `สัปดาห์ที่ครอบคลุม ${formatThaiDate(date)}`,
        "",
        "👨‍🏫 สรุปบุคลากร",
        `  มา ${staff.present} / ${staff.total} คน | สาย ${staff.late} | ขาด ${staff.absent} | ลา ${staff.leave}`,
        "",
        "🎓 สรุปนักเรียน",
        `  เข้าเรียน ${student.present} | สาย ${student.late} | ขาด ${student.absent} | ลา ${student.leave}`,
        "",
        "🔗 ระบบบริหารโรงเรียน PMV-ONE",
    ].join("\n");
}
function buildAlertMessage(date, alertMessage) {
    const customAlert = typeof alertMessage === "string" ? alertMessage.trim() : "";
    return [
        "🚨 แจ้งเตือนด่วน",
        `${formatThaiDate(date)}`,
        "",
        customAlert ? `${customAlert}` : "กรุณาตรวจสอบในระบบ",
        "",
        "🔗 ระบบบริหารโรงเรียน PMV-ONE",
    ].join("\n");
}
/**
 * Gen2 trigger — ต้องระบุ database pmv1 (Gen1 trigger ฟังแค่ default DB)
 */
exports.sendLineReport = (0, firestore_1.onDocumentCreated)({
    document: "report_sends/{sendId}",
    region: REGION,
    database: (0, getAdminFirestore_1.getFirestoreDatabaseId)(),
    timeoutSeconds: 120,
    memory: "256MiB",
}, async (event) => {
    const snap = event.data;
    if (!snap)
        return;
    const data = snap.data();
    const sendId = event.params.sendId;
    console.log(`[sendLineReport] triggered for ${sendId} (db=${(0, getAdminFirestore_1.getFirestoreDatabaseId)()})`);
    if (data.processed) {
        console.log(`[sendLineReport] ${sendId} already processed, skipping`);
        return;
    }
    const token = (0, linePush_1.getLineChannelToken)();
    if (!token) {
        console.error("[sendLineReport] LINE_CHANNEL_TOKEN not configured");
        await snap.ref.update({
            processed: true,
            processedAt: admin.firestore.FieldValue.serverTimestamp(),
            processError: "LINE_CHANNEL_TOKEN not configured",
            successCount: 0,
            failCount: data.recipients?.length ?? 0,
        });
        return;
    }
    const reportType = data.reportType || "daily";
    const date = data.date || new Date().toISOString().slice(0, 10);
    const staff = data.staffSummary ?? {
        total: 0,
        present: 0,
        late: 0,
        absent: 0,
        leave: 0,
        pending: 0,
    };
    const student = data.studentSummary ?? {
        sessions: 0,
        classes: 0,
        present: 0,
        late: 0,
        absent: 0,
        leave: 0,
    };
    const alertMessage = typeof data.alertMessage === "string" ? data.alertMessage.trim() : "";
    const recipients = data.recipients || [];
    let messageText;
    if (reportType === "weekly") {
        messageText = buildWeeklyMessage(date, staff, student);
    }
    else if (reportType === "alert") {
        messageText = buildAlertMessage(date, alertMessage);
    }
    else {
        messageText = (0, reportMessage_1.buildDailyMessage)(date, staff, student);
    }
    const results = [];
    for (const r of recipients) {
        let lineUid;
        try {
            const userSnap = await db.collection("users").doc(r.uid).get();
            lineUid = resolveLineUid(userSnap.data(), r.lineToken);
        }
        catch (err) {
            lineUid = resolveLineUid(undefined, r.lineToken);
            console.warn(`[sendLineReport] user lookup failed uid=${r.uid}`, err);
        }
        if (!lineUid) {
            results.push({ uid: r.uid, ok: false, error: "no lineUid/lineToken" });
            continue;
        }
        const result = await (0, linePush_1.pushLineMessage)(lineUid, messageText, token);
        results.push({ uid: r.uid, ...result });
        if (!result.ok) {
            console.error(`[sendLineReport] push failed for uid=${r.uid}:`, result.error);
        }
    }
    const successCount = results.filter((r) => r.ok).length;
    const failCount = results.filter((r) => !r.ok).length;
    console.log(`[sendLineReport] ${sendId} done: ${successCount} sent, ${failCount} failed`);
    await snap.ref.update({
        processed: true,
        processedAt: admin.firestore.FieldValue.serverTimestamp(),
        sendResults: results,
        successCount,
        failCount,
    });
});
//# sourceMappingURL=sendLineReport.js.map