import type { Question } from '@/types/questionBank';
import { isMultipleChoice } from '@/types/questionBank';
import type { AnswerSheetPartGroup } from '@/features/exam/components/PdfExamViewer';
import { PDF_OPTION_LABELS } from '@/features/questionBank/utils/pdfExamQuestions';

export function mapQuestionToExamSheetItem(q: Question) {
  const isEssay = q.type === 'essay';
  const rawOptions = isMultipleChoice(q)
    ? q.payload.options.map((opt, index) => ({
        id: opt.id || String(index + 1),
        text: opt.text?.trim() || PDF_OPTION_LABELS[index] || String(index + 1),
      }))
    : [];

  return {
    id: q.id,
    text: q.questionText ?? '',
    questionType: isEssay ? 'essay' as const : 'multiple_choice' as const,
    options: rawOptions,
  };
}

export function mapQuestionsToExamSheet(questions: Question[]): AnswerSheetPartGroup['questions'] {
  return [...questions]
    .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
    .map(mapQuestionToExamSheetItem);
}
