import {
  collection,
  getDoc,
  getDocs,
  doc,
  type Firestore,
} from 'firebase/firestore';
import type { ExamRoom } from '@/types/exam';
import type { Question, QuestionPayload, QuestionType } from '@/types/questionBank';
import { isMultipleChoice } from '@/types/questionBank';
import { resolveQuestionPoints } from '@/lib/exam/questionPoints';
import { getExamAnswerText } from '@/lib/exam/examAnswerFormat';
import { getRoundQuestionConfigForRound } from '@/lib/exam/roundQuestions';

export type GradingQuestionDoc = {
  id: string;
  type: QuestionType;
  orderIndex?: number;
  points?: number;
  correctOptionId?: string;
  payload: QuestionPayload;
};

export type RoundGradingConfig = {
  selectedQuestionIds: string[];
  questionSetByQuestionId: Record<string, string>;
  questionPoints: Record<string, number>;
  fallbackQuestionSetId?: string;
  candidateSetIds: string[];
};

function normalizeTextAnswer(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function getExpectedTextAnswer(question: GradingQuestionDoc): string | null {
  if (question.type !== 'essay') return null;
  const expected = question.payload && 'expectedAnswer' in question.payload
    ? question.payload.expectedAnswer
    : undefined;
  if (typeof expected === 'string' && expected.trim()) return expected.trim();
  return null;
}

export function getCorrectOptionId(question: GradingQuestionDoc): string | null {
  if (typeof question.correctOptionId === 'string' && question.correctOptionId.trim()) {
    return question.correctOptionId.trim();
  }
  if (!isMultipleChoice(question as Question)) return null;
  const options = (question.payload as { options?: Array<{ id?: string; isCorrect?: boolean }> }).options;
  if (!Array.isArray(options)) return null;
  const correctIndex = options.findIndex((opt) => opt?.isCorrect === true);
  if (correctIndex < 0) return null;
  const correct = options[correctIndex];
  if (typeof correct?.id === 'string' && correct.id.trim()) return correct.id.trim();
  return String(correctIndex + 1);
}

/** Normalize legacy client ids (`opt-2`) to match bank ids (`2`). */
export function legacyOptionKey(id: string): string {
  const trimmed = id.trim();
  const legacy = /^opt-(\d+)$/.exec(trimmed);
  return legacy ? legacy[1] : trimmed;
}

export function isSelectedOptionCorrect(
  selectedOptionId: string,
  correctOptionId: string,
  options: Array<{ id?: string; isCorrect?: boolean }>,
): boolean {
  if (!selectedOptionId.trim()) return false;
  const sel = legacyOptionKey(selectedOptionId);
  const cor = legacyOptionKey(correctOptionId);
  if (sel === cor) return true;

  const correctIndex = options.findIndex((opt) => opt?.isCorrect === true);
  if (correctIndex < 0) return false;

  const selectedIndex = options.findIndex((opt, index) => {
    const oid = typeof opt.id === 'string' && opt.id.trim()
      ? opt.id.trim()
      : String(index + 1);
    return legacyOptionKey(oid) === sel || oid === selectedOptionId.trim();
  });

  return selectedIndex >= 0 && selectedIndex === correctIndex;
}

export function resolveStudentAnswer(
  questionId: string,
  questionIndex: number,
  effectiveIds: string[],
  answers: Record<string, string>,
): string {
  const direct = answers[questionId];
  if (typeof direct === 'string' && direct.trim()) return direct;

  // Legacy: answers keyed by 1-based question number instead of Firestore doc id
  const ordinalKey = String(questionIndex + 1);
  const ordinalAnswer = answers[ordinalKey];
  if (typeof ordinalAnswer === 'string' && ordinalAnswer.trim()) return ordinalAnswer;

  // If answer keys share no overlap with question ids, map by sorted key order
  const answerKeys = Object.keys(answers).filter((k) => (answers[k] ?? '').trim());
  const overlap = answerKeys.some((k) => effectiveIds.includes(k));
  if (!overlap && answerKeys.length === effectiveIds.length) {
    const sortedKeys = [...answerKeys].sort((a, b) => {
      const na = Number(a);
      const nb = Number(b);
      if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
      return a.localeCompare(b);
    });
    const mapped = answers[sortedKeys[questionIndex]];
    if (typeof mapped === 'string') return mapped;
  }

  return '';
}

export function resolveRoundGradingConfig(roomData: ExamRoom, round: number): RoundGradingConfig {
  const { roundConfig } = getRoundQuestionConfigForRound(roomData, round);
  const fallbackQuestionSetId = roundConfig?.questionSetId;
  const selectedQuestionIds = roundConfig?.questionIds || [];
  const questionSetByQuestionId = roundConfig?.questionSetByQuestionId || {};
  const questionPoints = roundConfig?.questionPoints || {};

  const candidateSetIds = new Set<string>();
  selectedQuestionIds.forEach((qid) => {
    const mapped = questionSetByQuestionId[qid];
    if (typeof mapped === 'string' && mapped.trim()) candidateSetIds.add(mapped.trim());
  });
  if (typeof fallbackQuestionSetId === 'string' && fallbackQuestionSetId.trim()) {
    candidateSetIds.add(fallbackQuestionSetId.trim());
  }

  return {
    selectedQuestionIds,
    questionSetByQuestionId,
    questionPoints,
    fallbackQuestionSetId,
    candidateSetIds: Array.from(candidateSetIds),
  };
}

export function orderQuestionIdsFromMap(questionMap: Map<string, GradingQuestionDoc>): string[] {
  return Array.from(questionMap.values())
    .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
    .map((q) => q.id);
}

export function resolveEffectiveQuestionIds(
  selectedQuestionIds: string[],
  questionMap: Map<string, GradingQuestionDoc>,
): string[] {
  if (selectedQuestionIds.length > 0) {
    const resolved = selectedQuestionIds.filter((qid) => questionMap.has(qid));
    if (resolved.length > 0) return resolved;
    // Saved ids no longer exist in the bank (re-import) — grade against full set order
    if (questionMap.size > 0) return orderQuestionIdsFromMap(questionMap);
    return [];
  }
  return orderQuestionIdsFromMap(questionMap);
}

export type GradeAttemptResult =
  | { kind: 'graded'; score: number; autoGradableMaxPoints: number; manualEssayCount: number }
  | { kind: 'partial_graded'; score: number; autoGradableMaxPoints: number; manualEssayCount: number }
  | { kind: 'skipped_no_questions' }
  | { kind: 'skipped_no_set_ids' };

export function gradeAttemptAnswers(
  selectedQuestionIds: string[],
  questionMap: Map<string, GradingQuestionDoc>,
  answers: Record<string, string>,
  questionPoints: Record<string, number>,
): GradeAttemptResult {
  const effectiveIds = resolveEffectiveQuestionIds(selectedQuestionIds, questionMap);
  if (effectiveIds.length === 0) {
    return { kind: 'skipped_no_questions' };
  }

  let totalScore = 0;
  let autoGradableMaxPoints = 0;
  let manualEssayCount = 0;

  for (let i = 0; i < effectiveIds.length; i += 1) {
    const questionId = effectiveIds[i];
    const q = questionMap.get(questionId);
    if (!q) continue;

    const questionPointsValue = resolveQuestionPoints(
      questionId,
      questionPoints,
      q,
      q.points,
    );

    if (q.type === 'essay') {
      const expected = getExpectedTextAnswer(q);
      if (expected) {
        autoGradableMaxPoints += questionPointsValue;
        const studentAnswer = getExamAnswerText(
          resolveStudentAnswer(questionId, i, effectiveIds, answers),
        );
        if (normalizeTextAnswer(studentAnswer) === normalizeTextAnswer(expected)) {
          totalScore += questionPointsValue;
        }
        continue;
      }
      manualEssayCount += 1;
      continue;
    }

    autoGradableMaxPoints += questionPointsValue;

    const correctOptionId = getCorrectOptionId(q);
    if (!correctOptionId) continue;

    const selectedOptionId = resolveStudentAnswer(questionId, i, effectiveIds, answers);
    const mcOptions = (q.payload as { options?: Array<{ id?: string; isCorrect?: boolean }> }).options ?? [];
    if (isSelectedOptionCorrect(selectedOptionId, correctOptionId, mcOptions)) {
      totalScore += questionPointsValue;
    }
  }

  if (manualEssayCount > 0) {
    return {
      kind: 'partial_graded',
      score: totalScore,
      autoGradableMaxPoints,
      manualEssayCount,
    };
  }

  return {
    kind: 'graded',
    score: totalScore,
    autoGradableMaxPoints,
    manualEssayCount: 0,
  };
}

export async function loadQuestionMapForSets(
  firestore: Firestore,
  setIds: string[],
): Promise<Map<string, GradingQuestionDoc>> {
  const questionMap = new Map<string, GradingQuestionDoc>();
  await Promise.all(
    setIds.map(async (setId) => {
      const snap = await getDocs(collection(firestore, 'question_sets', setId, 'questions'));
      snap.docs.forEach((d) => {
        const data = d.data() as Record<string, unknown>;
        const type = data.type === 'essay' ? 'essay' : 'multiple_choice';
        questionMap.set(d.id, {
          id: d.id,
          type,
          orderIndex: typeof data.orderIndex === 'number' ? data.orderIndex : undefined,
          points: typeof data.points === 'number' ? data.points : undefined,
          correctOptionId: typeof data.correctOptionId === 'string' ? data.correctOptionId : undefined,
          payload: (data.payload ?? { options: [] }) as QuestionPayload,
        });
      });
    }),
  );
  return questionMap;
}

export async function loadRoomForGrading(
  firestore: Firestore,
  roomId: string,
): Promise<ExamRoom | null> {
  const snap = await getDoc(doc(firestore, 'exam_rooms', roomId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as ExamRoom;
}
