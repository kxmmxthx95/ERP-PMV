import { onDocumentCreated } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import { getAdminFirestore, getFirestoreDatabaseId } from "./getAdminFirestore";
import { buildDailyMessage } from "./reportMessage";
import type { StaffSummary, StudentSummary } from "./reportMessage";

const REGION = "asia-southeast1";
const db = getAdminFirestore();

function getLineChannelToken(): string {
  return (process.env.LINE_CHANNEL_TOKEN || "").trim();
}

async function pushMessage(
  lineUid: string,
  text: string,
  token: string,
): Promise<{ ok: boolean; error?: string }> {
  const https = await import("https");
  const body = JSON.stringify({
    to: lineUid,
    messages: [{ type: "text", text }],
  });

  console.log(`[pushMessage] sending to lineUid: ${lineUid.slice(0, 8)}...`);
  console.log(`[pushMessage] message text length: ${text.length}`);

  return new Promise((resolve) => {
    const req = https.request(
      {
        hostname: "api.line.me",
        path: "/v2/bot/message/push",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          if (res.statusCode === 200) {
            console.log("[pushMessage] success");
            resolve({ ok: true });
            return;
          }
          console.error(`[pushMessage] failed: HTTP ${res.statusCode}`, data);
          resolve({ ok: false, error: `HTTP ${res.statusCode}: ${data}` });
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
  staffSummary?: StaffSummary | null;
  studentSummary?: StudentSummary | null;
  leaveSummary?: LeaveSummary | null;
  alertMessage?: string | null;
  recipients?: ReportRecipient[];
  triggeredBy?: string;
  processed?: boolean;
}

function resolveLineUid(
  userData: FirebaseFirestore.DocumentData | undefined,
  payloadToken?: string,
): string | undefined {
  const fromUserToken =
    typeof userData?.lineToken === "string" ? userData.lineToken.trim() : "";
  const fromUserUid =
    typeof userData?.lineUid === "string" ? userData.lineUid.trim() : "";
  const fromPayload =
    typeof payloadToken === "string" ? payloadToken.trim() : "";

  return fromUserToken || fromUserUid || fromPayload || undefined;
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

function buildWeeklyMessage(
  date: string,
  staff: StaffSummary,
  student: StudentSummary,
): string {
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

function buildAlertMessage(date: string, alertMessage?: string | null): string {
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
export const sendLineReport = onDocumentCreated(
  {
    document: "report_sends/{sendId}",
    region: REGION,
    database: getFirestoreDatabaseId(),
    timeoutSeconds: 120,
    memory: "256MiB",
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const data = snap.data() as ReportSendDoc;
    const sendId = event.params.sendId;

    console.log(`[sendLineReport] triggered for ${sendId} (db=${getFirestoreDatabaseId()})`);

    if (data.processed) {
      console.log(`[sendLineReport] ${sendId} already processed, skipping`);
      return;
    }

    const token = getLineChannelToken();
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
    const staff: StaffSummary = data.staffSummary ?? {
      total: 0,
      present: 0,
      late: 0,
      absent: 0,
      leave: 0,
      pending: 0,
    };
    const student: StudentSummary = data.studentSummary ?? {
      sessions: 0,
      classes: 0,
      present: 0,
      late: 0,
      absent: 0,
      leave: 0,
    };
    const alertMessage =
      typeof data.alertMessage === "string" ? data.alertMessage.trim() : "";
    const recipients: ReportRecipient[] = data.recipients || [];

    let messageText: string;
    if (reportType === "weekly") {
      messageText = buildWeeklyMessage(date, staff, student);
    } else if (reportType === "alert") {
      messageText = buildAlertMessage(date, alertMessage);
    } else {
      messageText = buildDailyMessage(date, staff, student);
    }

    const results: Array<{ uid: string; ok: boolean; error?: string }> = [];

    for (const r of recipients) {
      let lineUid: string | undefined;
      try {
        const userSnap = await db.collection("users").doc(r.uid).get();
        lineUid = resolveLineUid(userSnap.data(), r.lineToken);
      } catch (err) {
        lineUid = resolveLineUid(undefined, r.lineToken);
        console.warn(`[sendLineReport] user lookup failed uid=${r.uid}`, err);
      }

      if (!lineUid) {
        results.push({ uid: r.uid, ok: false, error: "no lineUid/lineToken" });
        continue;
      }

      const result = await pushMessage(lineUid, messageText, token);
      results.push({ uid: r.uid, ...result });

      if (!result.ok) {
        console.error(
          `[sendLineReport] push failed for uid=${r.uid}:`,
          result.error,
        );
      }
    }

    const successCount = results.filter((r) => r.ok).length;
    const failCount = results.filter((r) => !r.ok).length;

    console.log(
      `[sendLineReport] ${sendId} done: ${successCount} sent, ${failCount} failed`,
    );

    await snap.ref.update({
      processed: true,
      processedAt: admin.firestore.FieldValue.serverTimestamp(),
      sendResults: results,
      successCount,
      failCount,
    });
  },
);
