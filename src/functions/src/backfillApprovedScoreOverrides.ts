import * as admin from "firebase-admin";
import { getFirestore, WriteBatch } from "firebase-admin/firestore";

// One-time backfill: exam_score_overrides approved before approveScoreOverride()
// started writing into grade_records also get synced now. Mirrors the sync logic
// in src/lib/exam/scoreOverride.ts (syncApprovedScoreToGradeBook / isLinkedToGradeBook).

const DATABASE_ID = (process.env.FIRESTORE_DATABASE_ID ?? "").trim();
const BATCH_LIMIT = 450;
const DRY_RUN = process.argv.includes("--dry-run");

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = DATABASE_ID && DATABASE_ID !== "(default)"
  ? getFirestore(DATABASE_ID)
  : getFirestore();

type GradeBookSubjectLink = { subjectId?: string; subjectName?: string; subjectCode?: string };
type ExamRoomSettings = {
  gradeBookSubjectId?: string;
  gradeBookSubjectName?: string;
  gradeBookSubjectCode?: string;
  gradeBookSubjects?: GradeBookSubjectLink[];
  gradeBookScoreType?: "midterm" | "final" | "classwork";
  scoreCollectionEnabled?: boolean;
  scoreCollectionLinked?: boolean;
  scoreCollectionType?: "classwork" | "quiz" | "midterm" | "final";
};
type ExamRoom = {
  subjectId?: string;
  subjectName?: string;
  classId?: string;
  className?: string;
  teacherId: string;
  departmentId: string;
  academicYearId: string;
  semester: 1 | 2;
  settings: ExamRoomSettings;
};
type ScoreOverrideRequest = {
  id: string;
  roomId: string;
  studentId: string;
  studentName: string;
  requestedScore: number;
  maxPoints: number;
  status: string;
};

function isLinkedToGradeBook(settings: ExamRoomSettings): boolean {
  if (settings.scoreCollectionLinked === false) return false;
  if (settings.scoreCollectionEnabled === true) return true;
  if (settings.scoreCollectionEnabled === false) return false;
  return (settings.gradeBookSubjects?.length ?? 0) > 0 || !!settings.gradeBookSubjectId;
}

function scoreCollectionTypeToGradeField(type?: string): "classworkScore" | "midtermScore" | "finalScore" {
  if (type === "midterm") return "midtermScore";
  if (type === "final") return "finalScore";
  return "classworkScore";
}

function rawPointsToPercent(raw: number, maxPoints: number): number {
  const max = maxPoints > 0 ? maxPoints : 100;
  return Math.max(0, Math.min(100, (raw / max) * 100));
}

function flushBatch(batch: WriteBatch, opCount: number): Promise<void> {
  if (opCount === 0 || DRY_RUN) return Promise.resolve();
  return batch.commit().then(() => undefined);
}

async function backfillApprovedScoreOverrides() {
  console.log(`[start] backfill approved exam_score_overrides -> grade_records (dryRun=${DRY_RUN})`);

  const overridesSnap = await db.collection("exam_score_overrides").where("status", "==", "approved").get();
  console.log(`Found ${overridesSnap.size} approved override(s)`);

  const roomCache = new Map<string, ExamRoom | null>();
  let batch = db.batch();
  let opCount = 0;
  let synced = 0;
  let skippedUnlinked = 0;
  let skippedMissingRoom = 0;

  for (const overrideDoc of overridesSnap.docs) {
    const request = { id: overrideDoc.id, ...overrideDoc.data() } as ScoreOverrideRequest;

    let room = roomCache.get(request.roomId);
    if (room === undefined) {
      const roomSnap = await db.collection("exam_rooms").doc(request.roomId).get();
      room = roomSnap.exists ? (roomSnap.data() as ExamRoom) : null;
      roomCache.set(request.roomId, room);
    }
    if (!room) {
      skippedMissingRoom += 1;
      continue;
    }

    const settings = room.settings ?? {};
    if (!isLinkedToGradeBook(settings)) {
      skippedUnlinked += 1;
      continue;
    }

    const link = settings.gradeBookSubjects?.[0];
    const subjectId = settings.gradeBookSubjectId ?? link?.subjectId ?? room.subjectId;
    const subjectName = settings.gradeBookSubjectName ?? link?.subjectName ?? room.subjectName;
    const subjectCode = settings.gradeBookSubjectCode ?? link?.subjectCode;
    const { classId, className } = room;
    if (!subjectId || !subjectName || !subjectCode || !classId || !className) {
      skippedUnlinked += 1;
      continue;
    }

    const field = scoreCollectionTypeToGradeField(settings.scoreCollectionType ?? settings.gradeBookScoreType);
    const percent = rawPointsToPercent(request.requestedScore, request.maxPoints);

    const docId = `${subjectId}_${classId}_${request.studentId}_${room.academicYearId}_${room.semester}`;
    const ref = db.collection("grade_records").doc(docId);
    const existingSnap = await ref.get();
    const existing = existingSnap.exists ? existingSnap.data() : undefined;

    const record = {
      studentId: request.studentId,
      studentName: existing?.studentName ?? request.studentName,
      studentCode: existing?.studentCode ?? "",
      subjectId,
      subjectName,
      subjectCode,
      classId,
      className,
      teacherId: existing?.teacherId ?? room.teacherId,
      departmentId: existing?.departmentId ?? room.departmentId,
      academicYearId: room.academicYearId,
      semester: room.semester,
      classworkScore: existing?.classworkScore ?? null,
      midtermScore: existing?.midtermScore ?? null,
      finalScore: existing?.finalScore ?? null,
      totalScore: existing?.totalScore ?? null,
      grade: existing?.grade ?? null,
      result: existing?.result ?? null,
      absent: existing?.absent ?? false,
      note: existing?.note ?? null,
      updatedAt: new Date().toISOString(),
      [field]: percent,
    };

    if (DRY_RUN) {
      console.log(`[dry-run] override ${request.id} -> grade_records/${docId}: ${field}=${percent.toFixed(2)}`);
    } else {
      batch.set(ref, record, { merge: true });
    }
    opCount += 1;
    synced += 1;

    if (opCount >= BATCH_LIMIT) {
      await flushBatch(batch, opCount);
      batch = db.batch();
      opCount = 0;
      console.log(`Progress: synced ${synced}/${overridesSnap.size}`);
    }
  }

  await flushBatch(batch, opCount);
  console.log(
    `Backfill completed. Synced: ${synced}, Skipped (room not linked): ${skippedUnlinked}, Skipped (room missing): ${skippedMissingRoom}`,
  );
  if (DRY_RUN) console.log("[dry-run] no write operations were committed");
}

backfillApprovedScoreOverrides()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Backfill failed:", error);
    process.exit(1);
  });
