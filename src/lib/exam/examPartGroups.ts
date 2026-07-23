import type { ExamRoom } from '@/types/exam';
import type { Question } from '@/types/questionBank';
import { deriveSetOrder, getRoundQuestionConfigForRound } from '@/lib/exam/roundQuestions';

export type ExamPartGroupMeta = {
  setId: string;
  partIndex: number;
  partLabel: string;
  title: string;
  questionIds: string[];
};

function parseSetTitle(data: Record<string, unknown> | undefined, index: number): string {
  if (typeof data?.title === 'string' && data.title.trim()) return data.title.trim();
  return `ชุดข้อสอบ ${index + 1}`;
}

/** Group ordered question ids by exam part (question set), preserving cart order. */
export function buildExamPartGroups(
  room: ExamRoom,
  round: number,
  questions: Question[],
  metaById: Map<string, Record<string, unknown>>,
): ExamPartGroupMeta[] {
  const { roundConfig } = getRoundQuestionConfigForRound(room, round);
  const fallbackSetId = roundConfig?.questionSetId || room.questionSetId || '';
  const selectedIds = roundConfig?.questionIds || room.selectedQuestionIds || [];
  const setByQuestionId = roundConfig?.questionSetByQuestionId || {};

  const orderedSetIds = deriveSetOrder(selectedIds, setByQuestionId, fallbackSetId);

  if (questions.length === 0) return [];

  // selectedIds ที่บันทึกไว้ตอนตั้งห้องสอบอาจ stale (ชุดข้อสอบถูกแก้ไข/สร้างใหม่หลังสอบ) —
  // ถ้า filter แล้วไม่เหลือเลย ต้อง fallback ไปใช้ id จาก questions ตรงๆ (เหมือน fetchRoomRoundExamData)
  // ไม่งั้นกระดาษคำตอบจะว่างเปล่าทั้งที่คะแนนสรุปคำนวณได้ปกติ
  const matchedSelectedIds = selectedIds.filter((qid) => questions.some((q) => q.id === qid));
  const questionIdsInOrder = matchedSelectedIds.length > 0
    ? matchedSelectedIds
    : questions.map((q) => q.id);

  if (orderedSetIds.length <= 1) {
    return [{
      setId: orderedSetIds[0] ?? fallbackSetId,
      partIndex: 0,
      partLabel: 'Part 1',
      title: parseSetTitle(metaById.get(orderedSetIds[0] ?? ''), 0),
      questionIds: questionIdsInOrder,
    }];
  }

  return orderedSetIds
    .map((setId, index) => ({
      setId,
      partIndex: index,
      partLabel: `Part ${index + 1}`,
      title: parseSetTitle(metaById.get(setId), index),
      questionIds: questionIdsInOrder.filter(
        (qid) => (setByQuestionId[qid] ?? fallbackSetId) === setId,
      ),
    }))
    .filter((group) => group.questionIds.length > 0);
}

export function shouldShowExamPartHeaders(groups: ExamPartGroupMeta[]): boolean {
  return groups.length > 1;
}
