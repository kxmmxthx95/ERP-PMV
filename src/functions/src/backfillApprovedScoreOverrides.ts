import * as admin from "firebase-admin";
import { getFirestore, WriteBatch } from "firebase-admin/firestore";

// One-time backfill: exam_score_overrides approved before approveScoreOverride()
// started writing into grade_records also get synced now. Mirrors the sync logic
// in src/lib/exam/scoreOverride.ts (syncApprovedScoreToGradeBook / isLinkedToGradeBook),
// including the "best score across all attempts in the room" rule the grade book
// itself uses (getBestPercentByStudent in src/lib/exam/examRoomScoring.ts) — ported
// here since this script runs standalone via the Admin SDK, not through the app bundle.

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
  maxAttempts?: number;
  gradeBookSubjectId?: string;
  gradeBookSubjectName?: string;
  gradeBookSubjectCode?: string;
  gradeBookSubjects?: GradeBookSubjectLink[];
  gradeBookScoreType?: "midterm" | "final" | "classwork";
  scoreCollectionEnabled?: boolean;
  scoreCollectionLinked?: boolean;
  scoreCollectionType?: "classwork" | "quiz" | "midterm" | "final";
};
type RoundQuestionEntry = {
  questionSetId?: string;
  questionIds?: string[];
  questionPoints?: Record<string, number>;
  totalPoints?: number;
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
  totalPoints?: number;
  questionSetId?: string;
  selectedQuestionIds?: string[];
  roundQuestions?: Record<string, RoundQuestionEntry>;
};
type ExamAttempt = {
  id: string;
  studentId: string;
  round: number;
  score: number | null;
  objectiveScore?: number | null;
  objectiveMaxPoints?: number | null;
  manualScores?: Record<string, number>;
  pendingManualGrading?: boolean;
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

// ── Ported from src/lib/students/studentIdentity.ts ─────────────────────────
function normalizeExamScore(score: unknown): number | null {
  if (typeof score === "number" && Number.isFinite(score)) return score;
  if (typeof score === "string") {
    const trimmed = score.trim();
    if (!trimmed) return null;
    const n = Number(trimmed);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

// ── Ported from src/lib/exam/manualEssayGrading.ts (resolveAttemptTotalScore) ──
function resolveAttemptTotalScore(attempt: ExamAttempt | null | undefined): number | null {
  if (!attempt) return null;
  const raw = normalizeExamScore(attempt.score);
  const manualScores = attempt.manualScores;
  if (!manualScores || Object.keys(manualScores).length === 0) {
    return raw;
  }
  const manualTotal = Object.values(manualScores).reduce(
    (sum, value) => sum + (typeof value === "number" && Number.isFinite(value) ? value : 0),
    0,
  );
  if (manualTotal <= 0) return raw;

  const objective = typeof attempt.objectiveScore === "number" ? attempt.objectiveScore : (raw ?? 0);
  const combined = objective + manualTotal;

  if (!attempt.pendingManualGrading) return combined;
  if (raw === null || combined > raw) return combined;
  return raw;
}

// ── Ported from src/lib/exam/roundQuestions.ts ──────────────────────────────
function isUsableRoundConfig(config: RoundQuestionEntry | undefined): boolean {
  if (!config) return false;
  if ((config.questionIds?.length ?? 0) > 0) return true;
  return !!config.questionSetId?.trim();
}

function roomHasAnyUsableRoundQuestions(room: ExamRoom): boolean {
  return Object.values(room.roundQuestions ?? {}).some(isUsableRoundConfig);
}

function resolveExamRoundQuestionKey(_room: ExamRoom, roundNumber: number): string {
  const raw = Number(roundNumber);
  const n = Number.isFinite(raw) && raw > 0 ? raw : 1;
  return String(n);
}

function getRoundQuestionConfigForRound(room: ExamRoom, roundNumber: number) {
  const rawRound = Number(roundNumber);
  const currentRound = Number.isFinite(rawRound) && rawRound > 0 ? rawRound : 1;
  const roundKey = resolveExamRoundQuestionKey(room, currentRound);
  const rq = room.roundQuestions;
  const unlimited = (room.settings?.maxAttempts ?? 1) === 0;

  let roundConfig: RoundQuestionEntry | undefined;
  if (isUsableRoundConfig(rq?.[roundKey])) {
    roundConfig = rq![roundKey];
  } else if (unlimited && isUsableRoundConfig(rq?.["∞"])) {
    roundConfig = rq!["∞"];
  } else if (
    !roomHasAnyUsableRoundQuestions(room)
    && currentRound === 1
    && room.questionSetId?.trim()
    && (room.selectedQuestionIds?.length ?? 0) > 0
  ) {
    roundConfig = {
      questionSetId: room.questionSetId,
      questionIds: room.selectedQuestionIds!,
      totalPoints: room.totalPoints ?? 0,
    };
  }
  return roundConfig;
}

function normalizeExamRound(round: unknown): number {
  const n = Number(round);
  if (Number.isFinite(n) && n > 0) return n;
  return 1;
}

// ── Ported from src/lib/exam/roundQuestions.ts (getExamRoomRoundTotalPoints) ──
function getExamRoomRoundTotalPoints(room: ExamRoom, round: number): number {
  const roundConfig = getRoundQuestionConfigForRound(room, round);
  if (roundConfig) {
    const fromMap = Object.values(roundConfig.questionPoints ?? {}).reduce(
      (sum, value) => sum + (typeof value === "number" && Number.isFinite(value) ? value : 0),
      0,
    );
    if (fromMap > 0) return fromMap;

    const roundPoints = Number(roundConfig.totalPoints ?? 0);
    if (roundPoints > 0) return roundPoints;
  }
  const roomPoints = Number(room.totalPoints ?? 0);
  return roomPoints > 0 ? roomPoints : 0;
}

// ── Ported from src/lib/exam/examRoomScoring.ts (resolveAttemptScoreDisplay) ──
// Room-level questionPoints/totalPoints freeze once a round has attempts, so if the
// question set changed size after that lock, this drifts stale. attempt.objectiveMaxPoints
// is computed against the actual graded question list at grading time — prefer it.
function attemptScorePercent(room: ExamRoom, attempt: ExamAttempt): number | null {
  const roomMaxPoints = getExamRoomRoundTotalPoints(room, normalizeExamRound(attempt.round));
  const maxPoints =
    typeof attempt.objectiveMaxPoints === "number" && attempt.objectiveMaxPoints > 0
      ? attempt.objectiveMaxPoints
      : roomMaxPoints;
  const score = resolveAttemptTotalScore(attempt);
  if (score === null || maxPoints <= 0) return null;
  return Math.round(rawPointsToPercent(score, maxPoints));
}

/** Best score % across all of the student's attempts in this room — matches getBestPercentByStudent. */
async function bestPercentForStudentInRoom(
  room: ExamRoom,
  roomId: string,
  studentId: string,
): Promise<number | null> {
  const attemptsSnap = await db.collection("exam_rooms").doc(roomId).collection("attempts")
    .where("studentId", "==", studentId).get();
  let best: number | null = null;
  attemptsSnap.docs.forEach((d) => {
    const attempt = { id: d.id, ...d.data() } as ExamAttempt;
    const pct = attemptScorePercent(room, attempt);
    if (pct === null) return;
    if (best === null || pct > best) best = pct;
  });
  return best;
}

function flushBatch(batch: WriteBatch, opCount: number): Promise<void> {
  if (opCount === 0 || DRY_RUN) return Promise.resolve();
  return batch.commit().then(() => undefined);
}

async function backfillApprovedScoreOverrides() {
  console.log(`[start] backfill approved exam_score_overrides -> grade_records (dryRun=${DRY_RUN})`);

  const overridesSnap = await db.collection("exam_score_overrides").where("status", "==", "approved").get();
  console.log(`Found ${overridesSnap.size} approved override(s)`);

  // De-dupe: multiple approved requests can target the same room+student
  // (re-approved corrections) — only need to sync each pair once.
  const seenRoomStudent = new Set<string>();
  const roomCache = new Map<string, ExamRoom | null>();
  let batch = db.batch();
  let opCount = 0;
  let synced = 0;
  let skippedUnlinked = 0;
  let skippedMissingRoom = 0;
  let skippedDuplicate = 0;
  let skippedNoScore = 0;

  for (const overrideDoc of overridesSnap.docs) {
    const request = { id: overrideDoc.id, ...overrideDoc.data() } as ScoreOverrideRequest;

    const roomStudentKey = `${request.roomId}::${request.studentId}`;
    if (seenRoomStudent.has(roomStudentKey)) {
      skippedDuplicate += 1;
      continue;
    }
    seenRoomStudent.add(roomStudentKey);

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
    const subjectId = settings.gradeBookSubjectId || link?.subjectId || room.subjectId;
    const subjectName = settings.gradeBookSubjectName || link?.subjectName || room.subjectName;
    const subjectCode = settings.gradeBookSubjectCode || link?.subjectCode || "";
    const { classId, className } = room;
    if (!subjectId || !subjectName || !classId || !className) {
      skippedUnlinked += 1;
      continue;
    }

    const field = scoreCollectionTypeToGradeField(settings.scoreCollectionType ?? settings.gradeBookScoreType);
    const bestPercent = await bestPercentForStudentInRoom(room, request.roomId, request.studentId);
    if (bestPercent === null) {
      skippedNoScore += 1;
      continue;
    }

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
      [field]: bestPercent,
    };

    if (DRY_RUN) {
      console.log(`[dry-run] room ${request.roomId} student ${request.studentId} -> grade_records/${docId}: ${field}=${bestPercent.toFixed(2)}`);
    } else {
      batch.set(ref, record, { merge: true });
    }
    opCount += 1;
    synced += 1;

    if (opCount >= BATCH_LIMIT) {
      await flushBatch(batch, opCount);
      batch = db.batch();
      opCount = 0;
      console.log(`Progress: synced ${synced}`);
    }
  }

  await flushBatch(batch, opCount);
  console.log(
    `Backfill completed. Synced: ${synced}, Skipped (duplicate room+student): ${skippedDuplicate}, `
    + `Skipped (room not linked): ${skippedUnlinked}, Skipped (room missing): ${skippedMissingRoom}, `
    + `Skipped (no scored attempt): ${skippedNoScore}`,
  );
  if (DRY_RUN) console.log("[dry-run] no write operations were committed");
}

backfillApprovedScoreOverrides()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Backfill failed:", error);
    process.exit(1);
  });
