import type { ExamAttempt } from '@/types/exam';
import type { Question } from '@/types/questionBank';
import type { ExamPartGroupMeta } from '@/lib/exam/examPartGroups';
import { getQuestionMaxPoints, isManualEssayQuestion } from '@/lib/exam/manualEssayGrading';
import type { GradedQuestionResult } from '@/features/questionBank/utils/gradeSimulationAnswers';

export type PartScoreSummary = ExamPartGroupMeta & {
  results: GradedQuestionResult[];
  maxPoints: number;
  earnedPoints: number | null;
  correct: number;
  wrong: number;
  unanswered: number;
  pendingManualCount: number;
};

export function computePartScoreSummaries(
  parts: Array<ExamPartGroupMeta & { results: GradedQuestionResult[] }>,
  questions: Question[],
  questionPoints: Record<string, number>,
  attempt: ExamAttempt | null,
  draftScores: Record<string, number>,
): PartScoreSummary[] {
  const questionById = new Map(questions.map((q) => [q.id, q]));

  return parts.map((part) => {
    let maxPoints = 0;
    let earnedPoints = 0;
    let hasPending = false;
    let correct = 0;
    let wrong = 0;
    let unanswered = 0;
    let pendingManualCount = 0;

    for (const result of part.results) {
      const question = questionById.get(result.questionId);
      const max = question ? getQuestionMaxPoints(question, questionPoints) : 1;
      maxPoints += max;

      if (question && isManualEssayQuestion(question)) {
        const draft = draftScores[result.questionId];
        const saved = attempt?.manualScores?.[result.questionId];
        const points = typeof draft === 'number'
          ? draft
          : typeof saved === 'number'
            ? saved
            : null;

        if (points === null) {
          hasPending = true;
          pendingManualCount += 1;
          if (result.status === 'unanswered') unanswered += 1;
          else if (result.status === 'wrong') wrong += 1;
          else correct += 1;
        } else {
          earnedPoints += points;
          if (points >= max) correct += 1;
          else if (points > 0) wrong += 1;
          else unanswered += 1;
        }
        continue;
      }

      if (result.status === 'correct') {
        correct += 1;
        earnedPoints += max;
      } else if (result.status === 'wrong') {
        wrong += 1;
      } else {
        unanswered += 1;
      }
    }

    return {
      ...part,
      maxPoints,
      earnedPoints: hasPending ? null : earnedPoints,
      correct,
      wrong,
      unanswered,
      pendingManualCount,
    };
  });
}
