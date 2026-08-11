import type { ExamAttempt, ExamRoom } from '@/types/exam';
import { normalizeExamRound } from '@/lib/students/studentIdentity';

/**
 * Whether a student may see their score for a given round.
 * Respects room.settings.showResultImmediately (default true).
 * When off: only after room closed, or upcoming after that round finished.
 */
export function isStudentRoundScoreRevealed(
  room: ExamRoom,
  round: number,
  attempt: ExamAttempt | null | undefined,
): boolean {
  if (!attempt) return false;
  if (attempt.status === 'in_progress') return false;

  const immediate = room.settings?.showResultImmediately !== false;
  if (immediate) return true;

  if (room.status === 'closed') return true;
  if (room.status === 'upcoming' && (room.completedRounds ?? 0) >= round) return true;
  return false;
}

/** Best attempt per round for the current student (latest by submit/start time). */
export function indexStudentAttemptsByRound(attempts: ExamAttempt[]): Map<number, ExamAttempt> {
  const map = new Map<number, ExamAttempt>();
  for (const att of attempts) {
    const round = normalizeExamRound(att.round);
    if (round <= 0) continue;
    const prev = map.get(round);
    if (!prev) {
      map.set(round, att);
      continue;
    }
    const prevT = Number(prev.submittedAt ?? prev.lastSavedAt ?? prev.startedAt ?? 0);
    const nextT = Number(att.submittedAt ?? att.lastSavedAt ?? att.startedAt ?? 0);
    if (nextT >= prevT) map.set(round, att);
  }
  return map;
}
