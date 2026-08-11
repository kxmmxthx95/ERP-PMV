/** Minimum time (seconds) a student must spend in the exam before manual submit. */
export const EXAM_MIN_SUBMIT_SECONDS = 0;

export function canSubmitExamManually(
  startedAt: number | null | undefined,
  now = Date.now(),
): boolean {
  if (typeof startedAt !== 'number' || !Number.isFinite(startedAt) || startedAt <= 0) {
    return false;
  }
  return now - startedAt >= EXAM_MIN_SUBMIT_SECONDS * 1000;
}

export function getExamSubmitWaitSeconds(
  startedAt: number | null | undefined,
  now = Date.now(),
): number {
  if (typeof startedAt !== 'number' || !Number.isFinite(startedAt) || startedAt <= 0) {
    return EXAM_MIN_SUBMIT_SECONDS;
  }
  const elapsedSec = Math.floor((now - startedAt) / 1000);
  return Math.max(0, EXAM_MIN_SUBMIT_SECONDS - elapsedSec);
}

export function formatExamSubmitWait(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins > 0 && secs > 0) return `${mins} นาที ${secs} วินาที`;
  if (mins > 0) return `${mins} นาที`;
  return `${secs} วินาที`;
}
