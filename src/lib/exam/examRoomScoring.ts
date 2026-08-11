import type { ExamAttempt, ExamRoom } from '@/types/exam';
import { rawPointsToPercent } from '@/types/grades';
import {
  buildStudentIdentityLookup,
  enrichStudentIdentityLookupFromAttempts,
  normalizeExamRound,
  normalizeExamScore,
  resolveCanonicalStudentId,
  type StudentIdentityFields,
} from '@/lib/students/studentIdentity';
import { getExamRoomRoundTotalPoints } from '@/lib/exam/roundQuestions';
import { resolveAttemptTotalScore } from '@/lib/exam/manualEssayGrading';

export type AttemptScoreDisplay = {
  score: number | null;
  maxPoints: number;
  percent: number | null;
};

function toDisplayPercent(score: number, maxPoints: number): number | null {
  if (maxPoints <= 0) return null;
  return Math.round(rawPointsToPercent(score, maxPoints));
}

/** Display raw points as whole number — hides float noise (e.g. 11.399999999999997 → "11"). */
export function formatScorePoints(score: number | null | undefined): string {
  if (score == null || Number.isNaN(Number(score))) return '-';
  return String(Math.round(Number(score)));
}

export function resolveAttemptScoreDisplay(
  room: ExamRoom,
  attempt: ExamAttempt,
): AttemptScoreDisplay {
  const maxPoints = getExamRoomRoundTotalPoints(room, normalizeExamRound(attempt.round));
  const score = resolveAttemptTotalScore(attempt);
  if (score === null) {
    return { score: null, maxPoints, percent: null };
  }
  return {
    score,
    maxPoints,
    percent: toDisplayPercent(score, maxPoints),
  };
}

/** คะแนนปรนัยระหว่างรอตรวจข้ออัตนัย — ใช้ objectiveMaxPoints เป็นตัวหาร */
export function resolveAttemptObjectiveScoreDisplay(
  attempt: ExamAttempt,
  objectiveMaxPoints?: number | null,
): AttemptScoreDisplay {
  const score = normalizeExamScore(attempt.score);
  const maxPoints = objectiveMaxPoints ?? attempt.objectiveMaxPoints ?? 0;
  if (score === null) {
    return { score: null, maxPoints, percent: null };
  }
  return {
    score,
    maxPoints,
    percent: toDisplayPercent(score, maxPoints),
  };
}

export function attemptScorePercent(room: ExamRoom, attempt: ExamAttempt): number | null {
  const display = resolveAttemptScoreDisplay(room, attempt);
  return display.percent;
}

/** Best score % per student across all rounds (canonical student doc id). */
export function getBestPercentByStudent(
  room: ExamRoom,
  attempts: ExamAttempt[],
  classStudents: Array<{ student: StudentIdentityFields }>,
): Map<string, number> {
  const lookup = enrichStudentIdentityLookupFromAttempts(
    buildStudentIdentityLookup(classStudents),
    classStudents as Parameters<typeof enrichStudentIdentityLookupFromAttempts>[1],
    attempts,
  );
  const bestByCanonical = new Map<string, number>();

  attempts.forEach((att) => {
    const pct = attemptScorePercent(room, att);
    if (pct === null) return;
    const canonicalId = resolveCanonicalStudentId(att.studentId, lookup);
    const prev = bestByCanonical.get(canonicalId);
    if (prev === undefined || pct > prev) {
      bestByCanonical.set(canonicalId, pct);
    }
  });

  return bestByCanonical;
}
