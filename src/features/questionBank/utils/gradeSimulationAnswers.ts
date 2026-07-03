import type { Question } from '@/types/questionBank';
import { isEssay, isMultipleChoice } from '@/types/questionBank';
import { parsePdfLabelFromQuestionText, PDF_OPTION_LABELS } from '@/features/questionBank/utils/pdfExamQuestions';
import {
  isSelectedOptionCorrect,
  legacyOptionKey,
  resolveStudentAnswer,
} from '@/lib/exam/autoGradeAttempt';
import { formatExamAnswerDisplayHtml, getExamAnswerText } from '@/lib/exam/examAnswerFormat';

export type AnswerGradeStatus = 'correct' | 'wrong' | 'unanswered';

export interface GradedQuestionResult {
  questionId: string;
  label: string;
  status: AnswerGradeStatus;
  yourAnswerLabel: string;
  correctAnswerLabel: string;
}

export interface SimulationGradeSummary {
  total: number;
  correct: number;
  wrong: number;
  unanswered: number;
  scorePercent: number;
  byQuestionId: Record<string, AnswerGradeStatus>;
  correctAnswerByQuestionId: Record<string, string>;
  correctOptionIdByQuestionId: Record<string, string>;
  wrongResults: GradedQuestionResult[];
  results: GradedQuestionResult[];
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function getMcOptionLabel(
  options: { id: string; text: string }[],
  optionId: string,
): string {
  const normalized = legacyOptionKey(optionId);
  const index = options.findIndex(
    (opt) => legacyOptionKey(opt.id) === normalized || opt.id === optionId,
  );
  if (index < 0) return optionId;
  const opt = options[index];
  return opt.text?.trim() || PDF_OPTION_LABELS[index] || optionId;
}

export function gradeSimulationAnswers(
  questions: Question[],
  answers: Record<string, string>,
): SimulationGradeSummary {
  const sorted = [...questions].sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));
  const effectiveIds = sorted.map((q) => q.id);
  const results: GradedQuestionResult[] = [];

  for (let index = 0; index < sorted.length; index++) {
    const q = sorted[index];
    const label = parsePdfLabelFromQuestionText(q.questionText ?? '', index + 1);
    const raw = resolveStudentAnswer(q.id, index, effectiveIds, answers).trim();

    let status: AnswerGradeStatus;
    let yourAnswerLabel = '-';
    let correctAnswerLabel = '-';

    if (isMultipleChoice(q)) {
      const options = q.payload.options.map((opt, optIndex) => ({
        id: opt.id || String(optIndex + 1),
        text: opt.text?.trim() || PDF_OPTION_LABELS[optIndex] || String(optIndex + 1),
        isCorrect: opt.isCorrect,
      }));
      const correctOpt = options.find((opt) => opt.isCorrect);

      if (!raw) {
        status = 'unanswered';
        yourAnswerLabel = '-';
      } else {
        yourAnswerLabel = getMcOptionLabel(options, raw);
        if (!correctOpt) {
          status = 'wrong';
        } else {
          correctAnswerLabel = getMcOptionLabel(options, correctOpt.id);
          status = isSelectedOptionCorrect(raw, correctOpt.id, options)
            ? 'correct'
            : 'wrong';
        }
      }

      if (correctOpt && !correctAnswerLabel) {
        correctAnswerLabel = getMcOptionLabel(options, correctOpt.id);
      }
    } else if (isEssay(q)) {
      const expected = (q.payload.expectedAnswer ?? '').trim();
      correctAnswerLabel = expected || '-';

      if (!raw) {
        status = 'unanswered';
        yourAnswerLabel = '-';
      } else {
        yourAnswerLabel = formatExamAnswerDisplayHtml(raw) || '-';
        if (!expected) {
          status = 'unanswered';
        } else {
          status = normalizeText(getExamAnswerText(raw)) === normalizeText(expected) ? 'correct' : 'wrong';
        }
      }
    } else {
      status = 'unanswered';
    }

    results.push({
      questionId: q.id,
      label,
      status,
      yourAnswerLabel,
      correctAnswerLabel,
    });
  }

  const correct = results.filter((r) => r.status === 'correct').length;
  const wrong = results.filter((r) => r.status === 'wrong').length;
  const unanswered = results.filter((r) => r.status === 'unanswered').length;
  const total = results.length;
  const scorePercent = total > 0 ? Math.round((correct / total) * 100) : 0;

  const byQuestionId = Object.fromEntries(results.map((r) => [r.questionId, r.status]));
  const correctAnswerByQuestionId = Object.fromEntries(
    results.map((r) => [r.questionId, r.correctAnswerLabel]),
  );
  const correctOptionIdByQuestionId: Record<string, string> = {};
  for (const q of sorted) {
    if (isMultipleChoice(q)) {
      const correctOpt = q.payload.options.find((opt) => opt.isCorrect);
      if (correctOpt) {
        const index = q.payload.options.indexOf(correctOpt);
        correctOptionIdByQuestionId[q.id] = correctOpt.id || String(index + 1);
      }
    }
  }

  return {
    total,
    correct,
    wrong,
    unanswered,
    scorePercent,
    byQuestionId,
    correctAnswerByQuestionId,
    correctOptionIdByQuestionId,
    wrongResults: results.filter((r) => r.status === 'wrong'),
    results,
  };
}
