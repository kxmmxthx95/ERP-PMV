// src/lib/teacherKpi/semesterDates.ts
import { resolveTodayHoliday } from '@/lib/calendar/schoolDay';
import type { CalendarEvent } from '@/types/calendar';
import type { Department } from '@/types/curriculum';
import type {
  DeptSemesterKey,
  DeptSemesterSettings,
} from '@/lib/firestoreShared/deptSemestersStore';

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

export function departmentToSemesterKey(
  dept?: Department | DeptSemesterKey | string | null,
): DeptSemesterKey {
  if (dept === 'early' || dept === 'kindergarten') return 'kindergarten';
  if (dept === 'primary') return 'primary';
  return 'secondary';
}

/** ช่วงเทอมจาก settings/dept_semesters (ตั้งค่าแผนก) — แหล่งความจริงหลัก */
export function resolveSemesterFromDeptSettings(
  settings: DeptSemesterSettings | null | undefined,
  semester: 1 | 2,
  deptKey?: DeptSemesterKey,
): SemesterDateRange | null {
  if (!settings) return null;
  const semField = semester === 1 ? 'semester1' : 'semester2';
  const keys: DeptSemesterKey[] = deptKey
    ? [deptKey]
    : ['kindergarten', 'primary', 'secondary'];

  const ranges = keys
    .map((key) => settings[key]?.[semField])
    .filter((r): r is { startDate: string; endDate: string } =>
      Boolean(r?.startDate?.trim() && r?.endDate?.trim()),
    )
    .map((r) => ({ startDate: r.startDate.trim(), endDate: r.endDate.trim() }))
    .filter((r) => r.startDate <= r.endDate);

  if (ranges.length === 0) return null;
  if (ranges.length === 1) return ranges[0];

  // หลายแผนก: ใช้ช่วงที่ครอบคลุมทั้งหมด (เริ่มเร็วสุด–จบล่าสุด)
  const starts = ranges.map((r) => r.startDate).sort();
  const ends = ranges.map((r) => r.endDate).sort();
  return { startDate: starts[0], endDate: ends[ends.length - 1] };
}

/** ช่วงปิดระหว่างเทอม 1 → 2 (วันถัดจากปิดเทอม 1 ถึงวันก่อนเปิดเทอม 2) */
export function resolveInterSemesterBreak(
  settings: DeptSemesterSettings | null | undefined,
  deptKey?: DeptSemesterKey,
): SemesterDateRange | null {
  const sem1 = resolveSemesterFromDeptSettings(settings, 1, deptKey);
  const sem2 = resolveSemesterFromDeptSettings(settings, 2, deptKey);
  if (!sem1 || !sem2) return null;
  const startDate = addDays(sem1.endDate, 1);
  const endDate = addDays(sem2.startDate, -1);
  if (startDate > endDate) return null;
  return { startDate, endDate };
}

export function isDateInSemesterRange(
  dateStr: string,
  range: SemesterDateRange | null | undefined,
): boolean {
  if (!range?.startDate || !range?.endDate) return false;
  return dateStr >= range.startDate && dateStr <= range.endDate;
}

/**
 * หาช่วงวันที่ของเทอมที่เลือก
 * 1) settings/dept_semesters (ตั้งค่าแผนก)
 * 2) calendar_events ชนิด semester-start/semester-end
 * 3) แบ่งปีการศึกษาครึ่งหนึ่ง
 */
export function resolveSemesterDateRange(
  academicYear: { startDate: string; endDate: string },
  semester: 1 | 2,
  calendarEvents: CalendarEvent[],
  deptSettings?: DeptSemesterSettings | null,
  deptKey?: DeptSemesterKey,
): SemesterDateRange {
  const fromSettings = resolveSemesterFromDeptSettings(deptSettings, semester, deptKey);
  if (fromSettings) return fromSettings;

  if (!academicYear.startDate || !academicYear.endDate) {
    return { startDate: '', endDate: '' };
  }

  const starts = [...new Set(
    calendarEvents
      .filter((e) => e.type === 'semester-start')
      .map((e) => e.startDate),
  )].sort();
  const ends = [...new Set(
    calendarEvents
      .filter((e) => e.type === 'semester-end')
      .map((e) => e.endDate),
  )].sort();

  if (starts.length >= 2) {
    const [sem1Start, sem2Start] = starts;
    const sem1End = ends.find((d) => d >= sem1Start && d < sem2Start) ?? addDays(sem2Start, -1);
    const sem2End = ends.find((d) => d >= sem2Start) ?? academicYear.endDate;
    return semester === 1
      ? { startDate: sem1Start, endDate: sem1End }
      : { startDate: sem2Start, endDate: sem2End };
  }

  if (starts.length === 1 && ends.length >= 1) {
    const onlyStart = starts[0];
    const onlyEnd = ends.find((d) => d >= onlyStart) ?? academicYear.endDate;
    if (semester === 1) return { startDate: onlyStart, endDate: onlyEnd };
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
