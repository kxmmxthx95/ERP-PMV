import type { ExamRoom } from '@/types/exam';

export type RoundQuestionEntry = NonNullable<ExamRoom['roundQuestions']>[string];

/** Finite attempt count → 1..N. Unlimited → use buildUnlimitedRoundKeys(room) instead. */
export function buildRoundKeys(maxAttempts: number): string[] {
  if (maxAttempts === 0) return ['1'];
  return Array.from({ length: maxAttempts }, (_, i) => String(i + 1));
}

/**
 * Unlimited rooms: rounds 1..max(1, completedRounds+1, currentRound, numeric saved keys).
 * Decision B from grill — next openable round always has a slot.
 */
export function buildUnlimitedRoundKeys(room: ExamRoom): string[] {
  const completed = Math.max(0, room.completedRounds ?? 0);
  const current = Math.max(0, room.currentRound ?? 0);
  let maxSaved = 0;
  for (const key of Object.keys(room.roundQuestions ?? {})) {
    if (key === '∞') continue;
    const n = Number(key);
    if (Number.isFinite(n) && n > maxSaved) maxSaved = n;
  }
  const last = Math.max(1, completed + 1, current, maxSaved);
  return Array.from({ length: last }, (_, i) => String(i + 1));
}

/** Firestore key for a room's round question config — always numeric round string. */
export function resolveExamRoundQuestionKey(_room: ExamRoom, roundNumber: number): string {
  const raw = Number(roundNumber);
  const n = Number.isFinite(raw) && raw > 0 ? raw : 1;
  return String(n);
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

function roomHasAnyUsableRoundQuestions(roomData: ExamRoom): boolean {
  return Object.values(roomData.roundQuestions ?? {}).some(isUsableRoundConfig);
}

function roomHasOnlyLegacyOrInfinityQuestions(roomData: ExamRoom): boolean {
  const rq = roomData.roundQuestions ?? {};
  const keys = Object.keys(rq);
  if (keys.length === 0) return true;
  return keys.every((k) => k === '∞') && isUsableRoundConfig(rq['∞']);
}

/**
 * Config for a specific exam round.
 * Prefer roundQuestions[N]; unlimited rooms may fall back to legacy key `∞` when N is empty.
 * Top-level questionSetId only when room has no usable per-round map (old rooms).
 */
export function getRoundQuestionConfigForRound(roomData: ExamRoom, roundNumber: number) {
  const rawRound = Number(roundNumber);
  const currentRound = Number.isFinite(rawRound) && rawRound > 0 ? rawRound : 1;
  const roundKey = resolveExamRoundQuestionKey(roomData, currentRound);
  const rq = roomData.roundQuestions;
  const unlimited = (roomData.settings?.maxAttempts ?? 1) === 0;

  let roundConfig: RoundQuestionEntry | undefined;
  if (isUsableRoundConfig(rq?.[roundKey])) {
    roundConfig = rq![roundKey];
  } else if (unlimited && isUsableRoundConfig(rq?.['∞'])) {
    // Legacy unlimited: shared ∞ config until teacher saves per-round keys
    roundConfig = rq!['∞'];
  } else if (
    !roomHasAnyUsableRoundQuestions(roomData)
    && currentRound === 1
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
  const { roundConfig, currentRound } = getRoundQuestionConfig(roomData);

  if (!isUsableRoundConfig(roundConfig)) {
    return `ครูยังไม่ได้บันทึกชุดข้อสอบรอบ ${currentRound} กรุณาแจ้งครูให้เปิดแท็บ「ข้อสอบ」เลือกข้อสอบของรอบนี้แล้วกด「บันทึก」`;
  }

  return 'ไม่พบข้อมูลข้อสอบในคลัง (อาจถูกลบหรืออัปเดต) กรุณาแจ้งครูให้เลือกชุดข้อสอบและกดบันทึกใหม่';
}

export function roomHasSavedQuestions(roomData: ExamRoom, currentRound: number): boolean {
  const { roundConfig } = getRoundQuestionConfigForRound(roomData, currentRound);
  return isUsableRoundConfig(roundConfig);
}

/** True when the next exam round has saved question-set configuration. */
export function isExamRoomQuestionsConfigured(room: ExamRoom): boolean {
  const maxAttempts = room.settings?.maxAttempts ?? 1;
  const nextRound = (room.completedRounds ?? 0) + 1;

  if (maxAttempts > 0 && nextRound > maxAttempts) {
    return true;
  }

  if (roomHasSavedQuestions(room, nextRound)) {
    return true;
  }

  // Unlimited legacy: only ∞ (or top-level) exists — treat as configured for next round
  if (maxAttempts === 0 && roomHasOnlyLegacyOrInfinityQuestions(room)) {
    if (isUsableRoundConfig(room.roundQuestions?.['∞'])) return true;
    return (
      !!room.questionSetId?.trim()
      && (room.selectedQuestionIds?.length ?? 0) > 0
    );
  }

  if (
    nextRound <= 1
    && !roomHasAnyUsableRoundQuestions(room)
    && !!room.questionSetId?.trim()
    && (room.selectedQuestionIds?.length ?? 0) > 0
  ) {
    return true;
  }

  return false;
}

/**
 * คะแนนเต็มของรอบสอบ — แหล่งเดียวสำหรับครู + นักเรียน
 * ลำดับ: sum(questionPoints) → totalPoints ในรอบ → room.totalPoints (legacy)
 * รวม fallback ∞ ใน getRoundQuestionConfigForRound
 */
export function getExamRoomRoundTotalPoints(room: ExamRoom, round: number): number {
  const { roundConfig } = getRoundQuestionConfigForRound(room, round);
  if (roundConfig) {
    const fromMap = Object.values(roundConfig.questionPoints ?? {}).reduce(
      (sum, value) => sum + (typeof value === 'number' && Number.isFinite(value) ? value : 0),
      0,
    );
    if (fromMap > 0) return fromMap;

    const roundPoints = Number(roundConfig.totalPoints ?? 0);
    if (roundPoints > 0) return roundPoints;
  }

  const roomPoints = Number(room.totalPoints ?? 0);
  return roomPoints > 0 ? roomPoints : 0;
}
