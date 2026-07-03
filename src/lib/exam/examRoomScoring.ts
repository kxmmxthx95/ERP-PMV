import type { ExamAttempt, ExamRoom } from '@/types/exam';
import { rawPointsToPercent } from '@/types/grades';
import {
  buildStudentIdentityLookup,
  enrichStudentIdentityLookupFromAttempts,
  normalizeExamRound,
  resolveCanonicalStudentId,
  type StudentIdentityFields,
} from '@/lib/students/studentIdentity';
import { getExamRoomRoundTotalPoints } from '@/lib/exam/roundQuestions';
import { resolveAttemptTotalScore } from '@/lib/exam/manualEssayGrading';

export function attemptScorePercent(room: ExamRoom, attempt: ExamAttempt): number | null {
  const score = resolveAttemptTotalScore(attempt);
  if (score === null) return null;
  const total = getExamRoomRoundTotalPoints(room, normalizeExamRound(attempt.round));
  if (total <= 0) return null;
  return Math.round(rawPointsToPercent(score, total) * 10) / 10;
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
