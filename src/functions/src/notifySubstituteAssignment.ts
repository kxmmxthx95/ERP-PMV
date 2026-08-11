import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { getAdminFirestore, getFirestoreDatabaseId } from "./getAdminFirestore";
import { getLineChannelToken, pushLineMessage } from "./linePush";
import { resolveTeacherLineUid, formatSubstituteThaiDate } from "./substituteLineHelpers";

const REGION = "asia-southeast1";
const db = getAdminFirestore();

interface SubstitutionDoc {
  date?: string;
  scope?: "period" | "rollcall";
  period?: number;
  classLabel?: string;
  subjectName?: string;
  originalTeacherName?: string;
  substituteTeacherId?: string;
  reason?: string;
}

function buildAssignmentMessage(data: SubstitutionDoc): string {
  const dateLabel = data.date ? formatSubstituteThaiDate(data.date) : "-";
  const classLabel = data.classLabel || "";
  const taskLabel =
    data.scope === "rollcall"
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
export const notifySubstituteAssignment = onDocumentCreated(
  {
    document: "daily_schedules/{recordId}",
    region: REGION,
    database: getFirestoreDatabaseId(),
    timeoutSeconds: 60,
    memory: "256MiB",
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const data = snap.data() as SubstitutionDoc;
    const substituteTeacherId = String(data.substituteTeacherId || "").trim();
    if (!substituteTeacherId) return;

    const token = getLineChannelToken();
    if (!token) {
      console.error("[notifySubstituteAssignment] LINE_CHANNEL_TOKEN not configured");
      return;
    }

    const lineUid = await resolveTeacherLineUid(db, substituteTeacherId);
    if (!lineUid) {
      console.warn(`[notifySubstituteAssignment] substitute ${substituteTeacherId} has no LINE linked`);
      return;
    }

    const result = await pushLineMessage(lineUid, buildAssignmentMessage(data), token);
    if (!result.ok) {
      console.error(`[notifySubstituteAssignment] push failed for ${substituteTeacherId}:`, result.error);
    }
  },
);
