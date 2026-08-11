import { collection, documentId, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { buildExamPartGroups, type ExamPartGroupMeta } from '@/lib/exam/examPartGroups';
import { deriveSetOrder, getRoundQuestionConfigForRound, isUsableRoundConfig } from '@/lib/exam/roundQuestions';
import { chunkIds } from '@/lib/firestoreShared/fetchStudentsByIds';
import type { ExamRoom } from '@/types/exam';
import type { Question } from '@/types/questionBank';

export type RoomRoundExamData = {
  questions: Question[];
  partGroups: ExamPartGroupMeta[];
};

/** Load full question docs (with answer keys) and part grouping for a specific exam round. */
export async function fetchRoomRoundExamData(room: ExamRoom, round: number): Promise<RoomRoundExamData> {
  const { roundConfig } = getRoundQuestionConfigForRound(room, round);
  if (!roundConfig || !isUsableRoundConfig(roundConfig)) {
    return { questions: [], partGroups: [] };
  }

  const fallbackSetId = roundConfig.questionSetId;
  const selectedIds = roundConfig.questionIds ?? [];
  const setByQuestionId = roundConfig.questionSetByQuestionId || {};

  if (selectedIds.length === 0 && !fallbackSetId) {
    return { questions: [], partGroups: [] };
  }

  const candidateSetIds = new Set<string>();
  selectedIds.forEach((qid) => {
    const mappedSetId = setByQuestionId[qid];
    if (mappedSetId) candidateSetIds.add(mappedSetId);
  });
  if (fallbackSetId) candidateSetIds.add(fallbackSetId);
  if (candidateSetIds.size === 0) {
    return { questions: [], partGroups: [] };
  }

  const setIds = Array.from(candidateSetIds);
  const orderedSetIds = deriveSetOrder(selectedIds, setByQuestionId, fallbackSetId ?? '');
  const metaIdsToLoad = orderedSetIds.length > 0 ? orderedSetIds : setIds;
  // ดึง metadata ของทุก set ด้วย documentId 'in' แบบ batch แทนการ getDoc ทีละ set (N+1)
  const metaById = new Map<string, Record<string, unknown>>();
  try {
    const metaSnaps = await Promise.all(
      chunkIds(metaIdsToLoad).map((group) =>
        getDocs(query(collection(db, 'question_sets'), where(documentId(), 'in', group))),
      ),
    );
    metaSnaps.forEach((snap) => {
      snap.docs.forEach((d) => metaById.set(d.id, d.data()));
    });
  } catch {
    /* ignore missing set meta */
  }

  const setSnapshots = await Promise.all(
    setIds.map((setId) => getDocs(collection(db, 'question_sets', setId, 'questions'))),
  );

  const questionMap = new Map<string, Question>();
  setSnapshots.forEach((snap) => {
    snap.docs.forEach((d) => {
      questionMap.set(d.id, { id: d.id, ...d.data() } as Question);
    });
  });

  if (questionMap.size === 0) {
    return { questions: [], partGroups: [] };
  }

  // Prefer saved question order; fall back to full set when IDs are stale/missing
  let resolvedIds = selectedIds.filter((qid) => questionMap.has(qid));
  if (resolvedIds.length === 0) {
    const primarySetId = metaIdsToLoad[0] ?? setIds[0] ?? fallbackSetId;
    resolvedIds = Array.from(questionMap.values())
      .filter((q) => {
        const setId = setByQuestionId[q.id] ?? fallbackSetId;
        return !primarySetId || setId === primarySetId;
      })
      .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
      .map((q) => q.id);
  }

  const questions = resolvedIds
    .map((qid, index) => {
      const q = questionMap.get(qid);
      if (!q) return null;
      return { ...q, orderIndex: q.orderIndex ?? index + 1 };
    })
    .filter((q): q is Question => q !== null);

  const partGroups = buildExamPartGroups(room, round, questions, metaById);
  return { questions, partGroups };
}

/** Load full question docs (with answer keys) for a specific exam round. */
export async function fetchRoomRoundQuestions(room: ExamRoom, round: number): Promise<Question[]> {
  const { questions } = await fetchRoomRoundExamData(room, round);
  return questions;
}
