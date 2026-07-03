import type { ExamAttempt } from '@/types/exam';
import type { Question } from '@/types/questionBank';
import { isEssay } from '@/types/questionBank';
import { resolveQuestionPoints } from '@/lib/exam/questionPoints';
import { normalizeExamScore } from '@/lib/students/studentIdentity';

export function isManualEssayQuestion(question: Question): boolean {
  if (!isEssay(question)) return false;
  const expected = question.payload.expectedAnswer;
  return !(typeof expected === 'string' && expected.trim());
}

export function getManualEssayQuestions(questions: Question[]): Question[] {
  return questions.filter(isManualEssayQuestion);
}

export function getQuestionMaxPoints(
  question: Question,
  questionPoints?: Record<string, number>,
): number {
  const docPoints = (question as Question & { points?: number }).points;
  return resolveQuestionPoints(question.id, questionPoints, question, docPoints);
}

export function getObjectiveAttemptScore(
  attempt: ExamAttempt,
  essayQuestions: Question[] = [],
): number {
  if (typeof attempt.objectiveScore === 'number') {
    return attempt.objectiveScore;
  }
  if (attempt.pendingManualGrading === true || attempt.status === 'submitted') {
    return typeof attempt.score === 'number' ? attempt.score : 0;
  }
  const manualTotal = sumManualEssayScores(attempt.manualScores, essayQuestions);
  const total = typeof attempt.score === 'number' ? attempt.score : 0;
  return Math.max(0, total - manualTotal);
}

export function sumManualEssayScores(
  manualScores: Record<string, number> | undefined,
  essayQuestions: Question[],
): number {
  if (!manualScores) return 0;
  return essayQuestions.reduce((sum, q) => {
    const value = manualScores[q.id];
    return sum + (typeof value === 'number' && Number.isFinite(value) ? value : 0);
  }, 0);
}

export function isManualEssayGradingComplete(
  manualScores: Record<string, number> | undefined,
  essayQuestions: Question[],
): boolean {
  if (essayQuestions.length === 0) return true;
  return essayQuestions.every((q) => {
    const value = manualScores?.[q.id];
    return typeof value === 'number' && Number.isFinite(value);
  });
}

/**
 * คะแนนรวมที่ควรแสดง — รวม objective + manualScores เมื่อมีการตรวจข้อเขียนแล้ว
 * (ป้องกันกรณี auto-recalculate เขียนทับ score ให้เหลือแค่คะแนนปรนัย)
 */
export function resolveAttemptTotalScore(attempt: ExamAttempt | null | undefined): number | null {
  if (!attempt) return null;
  const raw = normalizeExamScore(attempt.score);
  const manualScores = attempt.manualScores;
  if (!manualScores || Object.keys(manualScores).length === 0) {
    return raw;
  }

  const manualTotal = Object.values(manualScores).reduce(
    (sum, value) => sum + (typeof value === 'number' && Number.isFinite(value) ? value : 0),
    0,
  );
  if (manualTotal <= 0) return raw;

  const objective = typeof attempt.objectiveScore === 'number'
    ? attempt.objectiveScore
    : (raw ?? 0);
  const combined = objective + manualTotal;

  if (!attempt.pendingManualGrading) return combined;
  if (raw === null || combined > raw) return combined;
  return raw;
}

export function buildAttemptScoreUpdate(
  attempt: ExamAttempt,
  manualScores: Record<string, number>,
  essayQuestions: Question[],
): Pick<
  ExamAttempt,
  'score' | 'status' | 'pendingManualGrading' | 'manualScores' | 'objectiveScore'
> {
  const objectiveScore = getObjectiveAttemptScore(attempt, essayQuestions);
  const manualTotal = sumManualEssayScores(manualScores, essayQuestions);
  const allGraded = isManualEssayGradingComplete(manualScores, essayQuestions);

  return {
    objectiveScore,
    manualScores,
    score: objectiveScore + manualTotal,
    pendingManualGrading: !allGraded,
    status: allGraded ? 'graded' : 'submitted',
  };
}

export function countPendingManualAttempts(
  attempts: ExamAttempt[],
  round: number,
  essayQuestions: Question[],
): number {
  if (essayQuestions.length === 0) return 0;

  return attempts.filter((attempt) => {
    if (normalizeExamRound(attempt.round) !== round) return false;
    if (attempt.status !== 'submitted' && attempt.status !== 'graded') return false;
    return !isManualEssayGradingComplete(attempt.manualScores, essayQuestions);
  }).length;
}

function normalizeExamRound(round: unknown): number {
  const n = Number(round);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 1;
}
