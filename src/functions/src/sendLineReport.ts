import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
void functions; // imported for its side-effects on region/runWith

const REGION = "asia-southeast1";
const DATABASE_ID = (process.env.FIRESTORE_DATABASE_ID ?? "").trim();
const db = DATABASE_ID && DATABASE_ID !== "(default)"
  ? getFirestore(DATABASE_ID)
  : getFirestore();

function getLineToken(): string {
  return process.env.LINE_CHANNEL_TOKEN || "";
}

async function pushMessage(lineUid: string, text: string, token: string): Promise<{ ok: boolean; error?: string }> {
  const https = await import("https");
  const body = JSON.stringify({
    to: lineUid,
    messages: [{ type: "text", text }],
  });

  console.log(`[pushMessage] sending to lineUid: ${lineUid}`);
  console.log(`[pushMessage] message text length: ${text.length}`);
  console.log(`[pushMessage] token length: ${token.length}`);

  return new Promise((resolve) => {
    const req = https.request(
      {
        hostname: "api.line.me",
        path: "/v2/bot/message/push",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res) => {
        console.log(`[pushMessage] response status: ${res.statusCode}`);
        let data = "";
        res.on("data", (chunk) => { data += chunk; });
        res.on("end", () => {
          if (res.statusCode === 200) {
            console.log(`[pushMessage] success!`);
            resolve({ ok: true });
          } else {
            console.error(`[pushMessage] failed: HTTP ${res.statusCode}`, data);
            resolve({ ok: false, error: `HTTP ${res.statusCode}: ${data}` });
          }
        });
      },
    );
    req.on("error", (err) => {
      console.error(`[pushMessage] request error: ${err.message}`);
      resolve({ ok: false, error: err.message });
    });
    req.write(body);
    req.end();
  });
}

function formatThaiDate(dateStr: string): string {
  try {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("th-TH", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

interface StaffSummary {
  total: number;
  present: number;
  late: number;
  absent: number;
  leave: number;
}

interface StudentSummary {
  sessions: number;
  classes: number;
  present: number;
  late: number;
  absent: number;
  leave: number;
}

interface LeaveSummary {
  pendingStaff: number;
  pendingStudents: number;
  activeStaff: number;
}

interface ReportRecipient {
  uid: string;
  lineToken?: string;
}

interface ReportSendDoc {
  reportType?: "daily" | "weekly" | "alert";
  date?: string;
  staffSummary?: StaffSummary;
  studentSummary?: StudentSummary;
  leaveSummary?: LeaveSummary;
  alertMessage?: string;
  recipients?: ReportRecipient[];
  triggeredBy?: string;
  processed?: boolean;
}

function buildDailyMessage(date: string, staff: StaffSummary, student: StudentSummary, leave: LeaveSummary): string {
  const thaiDate = formatThaiDate(date);
  const absentPercent = staff.total > 0 ? Math.round((staff.absent / staff.total) * 100) : 0;

  return [
    `📊 รายงานประจำวัน`,
    `${thaiDate}`,
    ``,
    `👨‍🏫 บุคลากร (${staff.total} คน)`,
    `  ✅ มาปกติ: ${staff.present} คน`,
    `  ⏰ มาสาย: ${staff.late} คน`,
    `  ❌ ขาด: ${staff.absent} คน (${absentPercent}%)`,
    `  📝 ลา: ${staff.leave} คน`,
    ``,
    `🎓 นักเรียน`,
    `  📚 คาบเรียน: ${student.sessions} คาบ (${student.classes} ห้อง)`,
    `  ✅ เข้าเรียน: ${student.present}`,
    `  ⏰ มาสาย: ${student.late}`,
    `  ❌ ขาด: ${student.absent}`,
    `  📝 ลา: ${student.leave}`,
    ``,
    `📋 ใบลารอดำเนินการ`,
    `  บุคลากร: ${leave.pendingStaff} ใบ`,
    `  นักเรียน: ${leave.pendingStudents} ใบ`,
    `  กำลังลา (วันนี้): ${leave.activeStaff} คน`,
    ``,
    `🔗 ระบบบริหารโรงเรียน PMV-ONE`,
  ].join("\n");
}

function buildWeeklyMessage(date: string, staff: StaffSummary, student: StudentSummary, leave: LeaveSummary): string {
  return [
    `📅 รายงานประจำสัปดาห์`,
    `สัปดาห์ที่ครอบคลุม ${formatThaiDate(date)}`,
    ``,
    `👨‍🏫 สรุปบุคลากร`,
    `  มา ${staff.present} / ${staff.total} คน | สาย ${staff.late} | ขาด ${staff.absent} | ลา ${staff.leave}`,
    ``,
    `🎓 สรุปนักเรียน`,
    `  เข้าเรียน ${student.present} | สาย ${student.late} | ขาด ${student.absent} | ลา ${student.leave}`,
    ``,
    `📋 ใบลาค้าง: บุคลากร ${leave.pendingStaff} | นักเรียน ${leave.pendingStudents}`,
    ``,
    `🔗 ระบบบริหารโรงเรียน PMV-ONE`,
  ].join("\n");
}

function buildAlertMessage(date: string, alertMessage?: string): string {
  const customAlert = typeof alertMessage === "string" ? alertMessage.trim() : "";

  return [
    `🚨 แจ้งเตือนด่วน`,
    `${formatThaiDate(date)}`,
    ``,
    customAlert ? `${customAlert}` : `กรุณาตรวจสอบในระบบ`,
    ``,
    `🔗 ระบบบริหารโรงเรียน PMV-ONE`,
  ].join("\n");
}

const handleReportSend = async (snap: any, context: any) => {
  const data = snap.data() as ReportSendDoc;
  const sendId = context.params.sendId;

  console.log(`[sendLineReport] triggered for ${sendId}`);
  console.log(`[sendLineReport] data:`, JSON.stringify(data, null, 2));

  if (data.processed) {
    console.log(`[sendLineReport] ${sendId} already processed, skipping`);
    return null;
  }

  const token = getLineToken();
  console.log(`[sendLineReport] token loaded: ${token ? "yes (length: " + token.length + ")" : "NO"}`);

  if (!token) {
    console.error("[sendLineReport] LINE_CHANNEL_TOKEN not configured");
    await snap.ref.update({
      processed: true,
      processedAt: admin.firestore.FieldValue.serverTimestamp(),
      processError: "LINE_CHANNEL_TOKEN not configured",
    });
    return null;
  }

  const reportType = data.reportType || "daily";
  const date = data.date || new Date().toISOString().slice(0, 10);
  const staff: StaffSummary = data.staffSummary || { total: 0, present: 0, late: 0, absent: 0, leave: 0 };
  const student: StudentSummary = data.studentSummary || { sessions: 0, classes: 0, present: 0, late: 0, absent: 0, leave: 0 };
  const leave: LeaveSummary = data.leaveSummary || { pendingStaff: 0, pendingStudents: 0, activeStaff: 0 };
  const alertMessage = typeof data.alertMessage === "string" ? data.alertMessage.trim() : "";
  const recipients: ReportRecipient[] = data.recipients || [];

  let messageText: string;
  if (reportType === "weekly") {
    messageText = buildWeeklyMessage(date, staff, student, leave);
  } else if (reportType === "alert") {
    messageText = buildAlertMessage(date, alertMessage);
  } else {
    messageText = buildDailyMessage(date, staff, student, leave);
  }

  const results: Array<{ uid: string; ok: boolean; error?: string }> = [];

  for (const r of recipients) {
    if (!r.lineToken) {
      results.push({ uid: r.uid, ok: false, error: "no lineToken" });
      continue;
    }

    let lineToken = r.lineToken;
    try {
      const userSnap = await db.collection("users").doc(r.uid).get();
      const freshToken = userSnap.data()?.lineToken as string | undefined;
      if (freshToken && freshToken.trim()) {
        lineToken = freshToken.trim();
      }
    } catch {
      // ใช้ lineToken จาก payload แทน
    }

    const result = await pushMessage(lineToken, messageText, token);
    results.push({ uid: r.uid, ...result });

    if (!result.ok) {
      console.error(`[sendLineReport] push failed for uid=${r.uid}:`, result.error);
    }
  }

  const successCount = results.filter(r => r.ok).length;
  const failCount = results.filter(r => !r.ok).length;

  console.log(`[sendLineReport] ${sendId} done: ${successCount} sent, ${failCount} failed`);

  await snap.ref.update({
    processed: true,
    processedAt: admin.firestore.FieldValue.serverTimestamp(),
    sendResults: results,
    successCount,
    failCount,
  });

  return null;
};

export const sendLineReport = functions
  .region(REGION)
  .runWith({ timeoutSeconds: 120, memory: "256MB" })
  .firestore.document("report_sends/{sendId}")
  .onCreate(handleReportSend);
