// src/lib/teacherKpi/semesterDates.ts
import { resolveTodayHoliday } from '@/lib/calendar/schoolDay';
import type { CalendarEvent } from '@/types/calendar';

function toDateStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + days);
  return toDateStr(d);
}

/**
 * แบ่งปีการศึกษาครึ่งหนึ่ง — fallback เมื่อไม่มี calendar_events ชนิด semester-start/semester-end
 * เทอม 1 = ครึ่งแรก, เทอม 2 = ครึ่งหลัง
 */
function splitYearInHalf(startDate: string, endDate: string): [string, string, string, string] {
  const start = new Date(`${startDate}T00:00:00`).getTime();
  const end = new Date(`${endDate}T00:00:00`).getTime();
  const midDate = toDateStr(new Date(start + (end - start) / 2));
  return [startDate, midDate, addDays(midDate, 1), endDate];
}

export interface SemesterDateRange {
  startDate: string;
  endDate: string;
}

/**
 * หาช่วงวันที่ของเทอมที่เลือก จาก calendar_events (semester-start/semester-end) ก่อน
 * ถ้าไม่มีข้อมูลเพียงพอ fallback เป็นการแบ่งปีการศึกษาครึ่งหนึ่ง
 */
export function resolveSemesterDateRange(
  academicYear: { startDate: string; endDate: string },
  semester: 1 | 2,
  calendarEvents: CalendarEvent[],
): SemesterDateRange {
  if (!academicYear.startDate || !academicYear.endDate) {
    return { startDate: '', endDate: '' };
  }

  const starts = calendarEvents
    .filter((e) => e.type === 'semester-start')
    .map((e) => e.startDate)
    .sort();
  const ends = calendarEvents
    .filter((e) => e.type === 'semester-end')
    .map((e) => e.endDate)
    .sort();

  if (starts.length >= 2) {
    const [sem1Start, sem2Start] = starts;
    const sem1End = ends.find((d) => d >= sem1Start && d < sem2Start) ?? addDays(sem2Start, -1);
    const sem2End = ends.find((d) => d >= sem2Start) ?? academicYear.endDate;
    return semester === 1
      ? { startDate: sem1Start, endDate: sem1End }
      : { startDate: sem2Start, endDate: sem2End };
  }

  const [h1Start, h1End, h2Start, h2End] = splitYearInHalf(academicYear.startDate, academicYear.endDate);
  return semester === 1 ? { startDate: h1Start, endDate: h1End } : { startDate: h2Start, endDate: h2End };
}

/** รายชื่อวันที่เป็นวันทำงาน (ไม่ใช่เสาร์-อาทิตย์/วันหยุด) ในช่วงที่กำหนด รวมทั้งสองด้าน */
export function enumerateWorkingDays(
  startDate: string,
  endDate: string,
  calendarEvents: CalendarEvent[],
  thaiHolidays: CalendarEvent[],
): string[] {
  if (!startDate || !endDate || startDate > endDate) return [];

  const result: string[] = [];
  let cursor = new Date(`${startDate}T00:00:00`);
  const last = new Date(`${endDate}T00:00:00`);

  while (cursor.getTime() <= last.getTime()) {
    const dateStr = toDateStr(cursor);
    const resolved = resolveTodayHoliday(dateStr, thaiHolidays, calendarEvents);
    if (!resolved.isHoliday) result.push(dateStr);
    cursor = new Date(cursor.getTime() + 86400000);
  }

  return result;
}

export { toDateStr };
