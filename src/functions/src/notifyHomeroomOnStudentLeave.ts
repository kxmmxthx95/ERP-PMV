import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { getAdminFirestore, getFirestoreDatabaseId } from "./getAdminFirestore";
import { getLineChannelToken, pushLineMessage } from "./linePush";

const REGION = "asia-southeast1";
const db = getAdminFirestore();

interface LeaveRequestDoc {
  requesterId?: string;
  requesterName?: string;
  requesterType?: "student" | "staff";
  leaveType?: "sick" | "personal";
  startDate?: string;
  endDate?: string;
  reason?: string;
}

const LEAVE_TYPE_LABEL: Record<string, string> = {
  sick: "ลาป่วย",
  personal: "ลากิจ",
};

function formatThaiDate(dateStr: string): string {
  try {
    const d = new Date(`${dateStr}T00:00:00`);
    return d.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return dateStr;
  }
}

function buildLeaveNotifyMessage(data: LeaveRequestDoc, className: string): string {
  const startDate = data.startDate || "";
  const endDate = data.endDate || "";
  const dateLabel =
    startDate === endDate ? formatThaiDate(startDate) : `${formatThaiDate(startDate)} – ${formatThaiDate(endDate)}`;

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
export const notifyHomeroomOnStudentLeave = onDocumentCreated(
  {
    document: "leave_requests/{requestId}",
    region: REGION,
    database: getFirestoreDatabaseId(),
    timeoutSeconds: 60,
    memory: "256MiB",
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const data = snap.data() as LeaveRequestDoc;
    if (data.requesterType !== "student") return;

    const requesterId = data.requesterId;
    if (!requesterId) return;

    const studentSnap = await db.collection("students").doc(requesterId).get();
    const classId = studentSnap.data()?.classId as string | undefined;
    if (!classId) {
      console.warn(`[notifyHomeroomOnStudentLeave] student ${requesterId} has no classId`);
      return;
    }

    const classSnap = await db.collection("classes").doc(classId).get();
    if (!classSnap.exists) return;

    const classData = classSnap.data() as {
      className?: string;
      homeroomTeacherId?: string;
      homeroomTeacherIds?: string[];
    };
    const teacherIds = classData.homeroomTeacherIds?.length
      ? classData.homeroomTeacherIds
      : classData.homeroomTeacherId
        ? [classData.homeroomTeacherId]
        : [];

    if (teacherIds.length === 0) {
      console.warn(`[notifyHomeroomOnStudentLeave] class ${classId} has no homeroom teacher set`);
      return;
    }

    const token = getLineChannelToken();
    if (!token) {
      console.error("[notifyHomeroomOnStudentLeave] LINE_CHANNEL_TOKEN not configured");
      return;
    }

    const messageText = buildLeaveNotifyMessage(data, classData.className || "-");

    for (const teacherId of teacherIds) {
      const teacherSnap = await db.collection("teachers").doc(teacherId).get();
      const userId = teacherSnap.data()?.userId as string | undefined;
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

      const result = await pushLineMessage(lineUid, messageText, token);
      if (!result.ok) {
        console.error(`[notifyHomeroomOnStudentLeave] push failed for teacher ${teacherId}:`, result.error);
      }
    }
  },
);
