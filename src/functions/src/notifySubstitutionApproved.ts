import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { getAdminFirestore, getFirestoreDatabaseId } from "./getAdminFirestore";
import { getLineChannelToken, pushLineMessage } from "./linePush";
import { formatSubstituteThaiDate } from "./substituteLineHelpers";

const REGION = "asia-southeast1";
const db = getAdminFirestore();

interface SubstitutionDoc {
  status?: "pending" | "approved" | "rejected";
  date?: string;
  scope?: "period" | "rollcall";
  period?: number;
  classLabel?: string;
  subjectName?: string;
  originalTeacherName?: string;
  substituteTeacherName?: string;
}

function buildApprovedMessage(data: SubstitutionDoc): string {
  const dateLabel = data.date ? formatSubstituteThaiDate(data.date) : "-";
  const classLabel = data.classLabel || "";
  const taskLabel =
    data.scope === "rollcall"
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
export const notifySubstitutionApproved = onDocumentUpdated(
  {
    document: "daily_schedules/{recordId}",
    region: REGION,
    database: getFirestoreDatabaseId(),
    timeoutSeconds: 60,
    memory: "256MiB",
  },
  async (event) => {
    const change = event.data;
    if (!change) return;

    const before = change.before.data() as SubstitutionDoc;
    const after = change.after.data() as SubstitutionDoc;
    if (before.status === "approved" || after.status !== "approved") return;

    const token = getLineChannelToken();
    if (!token) {
      console.error("[notifySubstitutionApproved] LINE_CHANNEL_TOKEN not configured");
      return;
    }

    const adminsSnap = await db.collection("users").where("role", "in", ["admin", "sysadmin"]).get();
    if (adminsSnap.empty) return;

    const messageText = buildApprovedMessage(after);

    for (const userDoc of adminsSnap.docs) {
      const userData = userDoc.data();
      const lineUid = String(userData?.lineUid || userData?.lineToken || "").trim();
      if (!lineUid) continue;

      const result = await pushLineMessage(lineUid, messageText, token);
      if (!result.ok) {
        console.error(`[notifySubstitutionApproved] push failed for admin ${userDoc.id}:`, result.error);
      }
    }
  },
);
