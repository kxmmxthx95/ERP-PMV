import { getLocalDateString } from '@/lib/dateUtils';

export const LEAVE_SAME_DAY_CUTOFF_HOUR = 8;

export const LEAVE_SAME_DAY_CUTOFF_MESSAGE =
  'ไม่สามารถยื่นคำขอลาวันนี้ได้หลัง 08:00 น. กรุณาเลือกวันที่เริ่มตั้งแต่พรุ่งนี้';

/** หลัง 08:00 น. (รวม 08:00) ไม่อนุญาตให้ยื่นลาที่ครอบคลุมวันปัจจุบัน */
export function isSameDayLeaveCutoffPassed(now = new Date()): boolean {
  return now.getHours() >= LEAVE_SAME_DAY_CUTOFF_HOUR;
}

export function leaveRangeIncludesDate(
  startDate: string,
  endDate: string,
  date: string,
): boolean {
  return startDate <= date && endDate >= date;
}

/** วันที่เริ่มลาที่อนุญาตให้เลือกได้ (วันนี้ก่อน 08:00 น. / พรุ่งนี้หลัง 08:00 น.) */
export function getEarliestLeaveStartDate(now = new Date()): string {
  const today = getLocalDateString(now);
  if (!isSameDayLeaveCutoffPassed(now)) return today;

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return getLocalDateString(tomorrow);
}

export function validateLeaveSubmissionDates(
  startDate: string,
  endDate: string,
  now = new Date(),
): string | null {
  if (!startDate || !endDate) return 'กรุณาระบุวันที่เริ่มและวันที่สิ้นสุด';
  if (endDate < startDate) return 'วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่ม';

  const today = getLocalDateString(now);
  if (
    isSameDayLeaveCutoffPassed(now)
    && leaveRangeIncludesDate(startDate, endDate, today)
  ) {
    return LEAVE_SAME_DAY_CUTOFF_MESSAGE;
  }

  return null;
}
