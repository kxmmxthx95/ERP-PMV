import * as admin from "firebase-admin";
import { getFirestore, WriteBatch } from "firebase-admin/firestore";

const DATABASE_ID = (process.env.FIRESTORE_DATABASE_ID ?? "").trim();
const BATCH_LIMIT = 450;

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = DATABASE_ID && DATABASE_ID !== "(default)"
  ? getFirestore(DATABASE_ID)
  : getFirestore();

type LegacyAttendance = {
  academicYearId?: string;
  classId?: string;
  className?: string;
  date?: string;
  departmentId?: string;
  note?: string;
  period?: number;
  recordedAt?: string;
  semester?: 1 | 2;
  status?: "present" | "absent" | "late" | "excused" | "leave";
  studentCode?: string;
  studentId?: string;
  studentName?: string;
  subjectId?: string;
  subjectName?: string;
  teacherId?: string;
};

type SessionKey = {
  academicYearId: string;
  classId: string;
  className: string;
  date: string;
  departmentId: string;
  period: number;
  semester: 1 | 2;
  subjectId: string;
  subjectName: string;
  teacherId: string;
};

function toDocId(input: string): string {
  return input.replace(/[^\w.-]/g, "_");
}

function makeSessionId(key: SessionKey): string {
  return `${key.date}_${toDocId(key.classId)}_${toDocId(key.subjectId)}_${key.period}`;
}

function flushBatch(batch: WriteBatch, opCount: number): Promise<void> {
  if (opCount === 0) return Promise.resolve();
  return batch.commit().then(() => undefined);
}

async function backfillClassSessions() {
  const legacySnap = await db.collection("attendance").get();
  console.log(`Found ${legacySnap.size} legacy attendance docs`);

  const sessions = new Map<string, {
    key: SessionKey;
    recordedAt: string;
    rows: Array<{ studentId: string; status: string; note: string }>;
  }>();

  let skipped = 0;
  legacySnap.forEach((legacyDoc) => {
    const data = legacyDoc.data() as LegacyAttendance;
    if (
      !data.date ||
      !data.classId ||
      !data.subjectId ||
      typeof data.period !== "number" ||
      !data.studentId
    ) {
      skipped += 1;
      return;
    }

    const key: SessionKey = {
      academicYearId: data.academicYearId ?? "",
      classId: data.classId,
      className: data.className ?? "",
      date: data.date,
      departmentId: data.departmentId ?? "secondary",
      period: data.period,
      semester: data.semester ?? 1,
      subjectId: data.subjectId,
      subjectName: data.subjectName ?? "",
      teacherId: data.teacherId ?? "",
    };

    const sessionId = makeSessionId(key);
    const existing = sessions.get(sessionId) ?? {
      key,
      recordedAt: data.recordedAt ?? new Date().toISOString(),
      rows: [],
    };
    existing.rows.push({
      studentId: data.studentId,
      status: data.status ?? "present",
      note: data.note ?? "",
    });
    sessions.set(sessionId, existing);
  });

  let batch = db.batch();
  let opCount = 0;
  let migrated = 0;

  for (const [sessionId, session] of sessions.entries()) {
    const presentStudentIds = session.rows.filter((row) => row.status === "present").map((row) => row.studentId);
    const absentStudentIds = session.rows.filter((row) => row.status === "absent").map((row) => row.studentId);
    const lateStudentIds = session.rows.filter((row) => row.status === "late").map((row) => row.studentId);
    const excusedStudentIds = session.rows.filter((row) => row.status === "excused").map((row) => row.studentId);
    const leaveStudentIds = session.rows.filter((row) => row.status === "leave").map((row) => row.studentId);

    const summary = {
      present: presentStudentIds.length,
      late: lateStudentIds.length,
      absent: absentStudentIds.length,
      leave: leaveStudentIds.length + excusedStudentIds.length,
    };

    const docRef = db.collection("class_sessions").doc(sessionId);
    batch.set(
      docRef,
      {
        scheduleId: sessionId,
        subjectId: session.key.subjectId,
        subjectName: session.key.subjectName,
        subjectCode: "",
        classId: session.key.classId,
        className: session.key.className,
        teacherId: session.key.teacherId,
        teacherName: "",
        departmentId: session.key.departmentId,
        academicYearId: session.key.academicYearId,
        semester: session.key.semester,
        date: session.key.date,
        period: session.key.period,
        topic: "",
        summary,
        attendance: session.rows,
        presentStudentIds,
        absentStudentIds,
        lateStudentIds,
        excusedStudentIds,
        leaveStudentIds,
        totalStudents: session.rows.length,
        createdAt: session.recordedAt,
        updatedAt: session.recordedAt,
      },
      { merge: true },
    );

    opCount += 1;
    migrated += 1;

    if (opCount >= BATCH_LIMIT) {
      await flushBatch(batch, opCount);
      batch = db.batch();
      opCount = 0;
      console.log(`Progress: migrated sessions ${migrated}/${sessions.size}`);
    }
  }

  await flushBatch(batch, opCount);
  console.log(`Backfill completed. Migrated sessions: ${migrated}, Skipped legacy rows: ${skipped}`);
}

backfillClassSessions()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Backfill failed:", error);
    process.exit(1);
  });
