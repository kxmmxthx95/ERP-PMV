import type { Question } from '@/types/questionBank';
import { isEssay } from '@/types/questionBank';

/** Default points for a question when not overridden in the exam room. */
export function getDefaultQuestionPoints(q: Pick<Question, 'type' | 'payload'>): number {
  if (isEssay(q as Question)) {
    return Math.max(0, (q.payload as { maxScore?: number }).maxScore ?? 1);
  }
  return 1;
}

export function resolveQuestionPoints(
  questionId: string,
  overrides: Record<string, number> | undefined,
  q?: Pick<Question, 'type' | 'payload'>,
  docPoints?: number,
): number {
  if (overrides && overrides[questionId] !== undefined) {
    return Math.max(0, overrides[questionId]);
  }
  if (typeof docPoints === 'number' && docPoints > 0) return docPoints;
  if (q) return getDefaultQuestionPoints(q);
  return 1;
}

export function sumSelectedQuestionPoints(
  questionIds: Iterable<string>,
  overrides: Record<string, number> | undefined,
  questionById: Map<string, Pick<Question, 'type' | 'payload'>>,
): number {
  let total = 0;
  for (const qid of questionIds) {
    const q = questionById.get(qid);
    const docPts = (q as Question & { points?: number } | undefined)?.points;
    total += resolveQuestionPoints(qid, overrides, q, docPts);
  }
  return total;
}
