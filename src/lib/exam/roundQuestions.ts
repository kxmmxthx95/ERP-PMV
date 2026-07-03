import type { ExamRoom } from '@/types/exam';

export type RoundQuestionEntry = NonNullable<ExamRoom['roundQuestions']>[string];

export function buildRoundKeys(maxAttempts: number): string[] {
  if (maxAttempts === 0) return ['∞'];
  return Array.from({ length: maxAttempts }, (_, i) => String(i + 1));
}

/** Preserve part order as questions appear in the round (matches Exam Manager cart). */
export function deriveSetOrder(
  questionIds: Iterable<string>,
  questionSetByQuestionId: Record<string, string>,
  fallbackSetId: string,
): string[] {
  const order: string[] = [];
  const seen = new Set<string>();
  for (const qid of questionIds) {
    const setId = questionSetByQuestionId[qid] ?? fallbackSetId;
    if (setId && !seen.has(setId)) {
      seen.add(setId);
      order.push(setId);
    }
  }
  if (order.length === 0 && fallbackSetId) return [fallbackSetId];
  return order;
}

export function isUsableRoundConfig(config: RoundQuestionEntry | undefined): boolean {
  if (!config) return false;
  if ((config.questionIds?.length ?? 0) > 0) return true;
  return !!config.questionSetId?.trim();
}

export function getRoundQuestionConfigForRound(roomData: ExamRoom, roundNumber: number) {
  const rawRound = Number(roundNumber);
  const currentRound = Number.isFinite(rawRound) && rawRound > 0 ? rawRound : 1;
  const roundKey = String(currentRound);
  const rq = roomData.roundQuestions;

  const candidates: Array<RoundQuestionEntry | undefined> = [
    rq?.[roundKey],
    rq?.['∞'],
    rq?.['1'],
    ...(rq ? Object.values(rq) : []),
  ];

  let roundConfig = candidates.find(isUsableRoundConfig);

  if (
    !roundConfig
    && roomData.questionSetId?.trim()
    && (roomData.selectedQuestionIds?.length ?? 0) > 0
  ) {
    roundConfig = {
      questionSetId: roomData.questionSetId,
      questionIds: roomData.selectedQuestionIds!,
      totalPoints: roomData.totalPoints ?? 0,
    };
  }

  return { roundConfig, currentRound, roundKey };
}

export function getRoundQuestionConfig(roomData: ExamRoom) {
  const rawRound = Number(roomData.currentRound ?? 1);
  const currentRound = Number.isFinite(rawRound) && rawRound > 0 ? rawRound : 1;
  return getRoundQuestionConfigForRound(roomData, currentRound);
}

export function describeMissingQuestionsError(roomData: ExamRoom): string {
  const { roundConfig } = getRoundQuestionConfig(roomData);
  const selectedIds = roundConfig?.questionIds || roomData.selectedQuestionIds || [];
  const setId = roundConfig?.questionSetId || roomData.questionSetId;
  const hasAnyRoundMeta = !!roomData.roundQuestions
    && Object.values(roomData.roundQuestions).some(isUsableRoundConfig);

  if (!setId && selectedIds.length === 0 && !hasAnyRoundMeta) {
    return 'ครูยังไม่ได้บันทึกชุดข้อสอบในห้องนี้ กรุณาแจ้งครูให้เปิดแท็บ「ข้อสอบ」แล้วกด「บันทึก」';
  }
  if (setId || selectedIds.length > 0 || hasAnyRoundMeta) {
    return 'ไม่พบข้อมูลข้อสอบในคลัง (อาจถูกลบหรืออัปเดต) กรุณาแจ้งครูให้เลือกชุดข้อสอบและกดบันทึกใหม่';
  }
  return 'ไม่พบข้อสอบในห้องนี้ กรุณาแจ้งครูผู้สอน';
}

export function roomHasSavedQuestions(roomData: ExamRoom, currentRound: number): boolean {
  const { roundConfig } = getRoundQuestionConfig({ ...roomData, currentRound });
  return isUsableRoundConfig(roundConfig);
}

/** True when the next exam round has saved question-set configuration. */
export function isExamRoomQuestionsConfigured(room: ExamRoom): boolean {
  const maxAttempts = room.settings?.maxAttempts ?? 1;
  const nextRound = (room.completedRounds ?? 0) + 1;

  if (maxAttempts > 0 && nextRound > maxAttempts) {
    return true;
  }

  const nextKey = maxAttempts === 0 ? '∞' : String(nextRound);

  if (isUsableRoundConfig(room.roundQuestions?.[nextKey])) {
    return true;
  }

  if (
    nextRound <= 1
    && !!room.questionSetId?.trim()
    && (room.selectedQuestionIds?.length ?? 0) > 0
  ) {
    return true;
  }

  return false;
}

function roundConfigMatches(
  a: RoundQuestionEntry | undefined,
  b: RoundQuestionEntry | undefined,
): boolean {
  if (!a || !b) return false;
  if (a.questionSetId !== b.questionSetId) return false;
  const idsA = a.questionIds ?? [];
  const idsB = b.questionIds ?? [];
  if (idsA.length !== idsB.length) return false;
  return idsA.every((id, i) => id === idsB[i]);
}

export type PropagateRoundConfigOptions = {
  /** Previous config for the round being saved — used to refresh mirrored sibling rounds. */
  previousEntryForSavedRound?: RoundQuestionEntry;
};

/** Copy saved round config to empty rounds; refresh sibling rounds that still mirror the old config. */
export function propagateRoundConfigToEmptyRounds(
  roundQuestions: NonNullable<ExamRoom['roundQuestions']>,
  savedRoundKey: string,
  entry: RoundQuestionEntry,
  maxAttempts: number,
  options?: PropagateRoundConfigOptions,
): NonNullable<ExamRoom['roundQuestions']> {
  const next = { ...roundQuestions, [savedRoundKey]: entry };
  if (!isUsableRoundConfig(entry)) return next;

  const previous = options?.previousEntryForSavedRound;
  const shouldRefreshMirrored = savedRoundKey === '1' || savedRoundKey === '∞';

  buildRoundKeys(maxAttempts).forEach((rk) => {
    if (rk === savedRoundKey) return;
    if (!isUsableRoundConfig(next[rk])) {
      next[rk] = { ...entry };
      return;
    }
    if (shouldRefreshMirrored && previous && roundConfigMatches(next[rk], previous)) {
      next[rk] = { ...entry };
    }
  });
  return next;
}

/** คะแนนเต็มของรอบสอบ — ใช้ roundQuestions ก่อน fallback ไป room.totalPoints */
export function getExamRoomRoundTotalPoints(room: ExamRoom, round: number): number {
  const rawRound = Number(round);
  const normalizedRound = Number.isFinite(rawRound) && rawRound > 0 ? rawRound : 1;
  const roundKey = String(normalizedRound);
  const roundPoints =
    room.roundQuestions?.[roundKey]?.totalPoints
    ?? room.roundQuestions?.['∞']?.totalPoints
    ?? room.roundQuestions?.['1']?.totalPoints
    ?? room.totalPoints
    ?? 0;
  return Number(roundPoints) > 0 ? Number(roundPoints) : 0;
}
