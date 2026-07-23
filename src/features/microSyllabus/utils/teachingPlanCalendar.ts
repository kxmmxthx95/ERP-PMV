import {
  addDays,
  endOfMonth,
  endOfWeek,
  format,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import type { ScheduleEntry, SchoolDay } from '@/types/schedule';
import type { MicroSyllabus, WeeklyTopic } from '@/types/microSyllabus';
import type { CalendarEvent } from '@/types/calendar';
import {
  resolveSemesterDateRange as resolveSemesterFromCalendar,
  departmentToSemesterKey,
} from '@/lib/teacherKpi/semesterDates';
import type {
  DeptSemesterKey,
  DeptSemesterSettings,
} from '@/lib/firestoreShared/deptSemestersStore';
import type { ClassSettingsMap } from '@/lib/firestoreShared/classSettingsStore';
import { DEFAULT_SETTINGS } from '@/hooks/useScheduleSettings';
import type { ClassRoom } from '@/types/class';

export { departmentToSemesterKey };
export type { DeptSemesterKey, DeptSemesterSettings };

export function toIsoDate(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

/** Hardcoded Thai school term when academic year / calendar missing. */
function fallbackSemesterByYearBE(yearBE: string, semester: 1 | 2): { start: string; end: string } {
  const adYear = Number(yearBE) - 543;
  if (!Number.isFinite(adYear) || adYear < 1900) {
    const now = new Date();
    const y = now.getMonth() >= 4 ? now.getFullYear() : now.getFullYear() - 1;
    return semester === 1
      ? { start: `${y}-05-15`, end: `${y}-10-11` }
      : { start: `${y}-11-01`, end: `${y + 1}-03-07` };
  }
  if (semester === 1) {
    return { start: `${adYear}-05-15`, end: `${adYear}-10-11` };
  }
  return { start: `${adYear}-11-01`, end: `${adYear + 1}-03-07` };
}

/**
 * ช่วงวันที่เทอมสำหรับแผนการสอน — ใช้ตั้งค่าแผนกก่อน
 * แล้วค่อย semester-start/end จากปฏิทิน + วันเริ่ม/สิ้นปี ก่อน fallback สูตรไทย
 */
export function resolveSemesterDateRange(
  yearBE: string,
  semester: 1 | 2,
  academicYear?: { startDate?: string; endDate?: string } | null,
  calendarEvents: CalendarEvent[] = [],
  deptSettings?: DeptSemesterSettings | null,
  deptKey?: DeptSemesterKey,
): { start: string; end: string } {
  const startDate = academicYear?.startDate?.trim() || '';
  const endDate = academicYear?.endDate?.trim() || '';

  const range = resolveSemesterFromCalendar(
    { startDate: startDate || '1970-01-01', endDate: endDate || '2099-12-31' },
    semester,
    calendarEvents,
    deptSettings,
    deptKey,
  );
  if (range.startDate && range.endDate) {
    return { start: range.startDate, end: range.endDate };
  }

  return fallbackSemesterByYearBE(yearBE, semester);
}

export function buildMonthGrid(currentMonth: Date): Date[] {
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const days: Date[] = [];
  let cursor = gridStart;
  while (cursor <= gridEnd) {
    days.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return days;
}

function alignToMonday(date: Date): Date {
  const cursor = new Date(date);
  const dayOfWeek = cursor.getDay();
  if (dayOfWeek !== 1) {
    cursor.setDate(cursor.getDate() + (dayOfWeek === 0 ? 1 : 8 - dayOfWeek));
  }
  return cursor;
}

export function weekNumberFromDate(dateIso: string, semesterStart: string): number {
  const start = alignToMonday(parseISO(semesterStart));
  const target = parseISO(dateIso);
  const diffMs = target.getTime() - start.getTime();
  if (diffMs < 0) return 1;
  return Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000)) + 1;
}

export function dateFromWeekNumber(weekNumber: number, semesterStart: string): string {
  const start = alignToMonday(parseISO(semesterStart));
  const cursor = addDays(start, (weekNumber - 1) * 7);
  return toIsoDate(cursor);
}

export function hasTopicContent(topic?: WeeklyTopic | null): boolean {
  if (!topic) return false;
  return Boolean(topic.lesson?.trim() || topic.title?.trim() || topic.details?.trim());
}

export function hasSavedTopicState(topic?: WeeklyTopic | null): boolean {
  if (!topic) return false;
  return hasTopicContent(topic) || Boolean(topic.isQuizDay) || Boolean(topic.isTeachingClosed);
}

/** Normalize legacy week-only topics into date-keyed entries. */
export function normalizeTopicsForCalendar(
  topics: WeeklyTopic[],
  semesterStart: string,
): WeeklyTopic[] {
  const byDate = new Map<string, WeeklyTopic>();

  topics.forEach((topic, index) => {
    const date = topic.date?.trim()
      || (topic.weekNumber > 0 ? dateFromWeekNumber(topic.weekNumber, semesterStart) : '');
    if (!date) return;

    const existing = byDate.get(date);
    if (existing) {
      byDate.set(date, {
        ...existing,
        lesson: existing.lesson || topic.lesson,
        title: existing.title || topic.title,
        details: existing.details || topic.details,
        isQuizDay: existing.isQuizDay || topic.isQuizDay,
        isTeachingClosed: existing.isTeachingClosed || topic.isTeachingClosed,
        teachingReflection: existing.teachingReflection ?? topic.teachingReflection ?? null,
        completedAt: existing.completedAt ?? topic.completedAt,
        weekNumber: existing.weekNumber || topic.weekNumber || weekNumberFromDate(date, semesterStart),
      });
      return;
    }

    byDate.set(date, {
      ...topic,
      date,
      weekNumber: topic.weekNumber || weekNumberFromDate(date, semesterStart) || index + 1,
    });
  });

  return [...byDate.values()].sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

export function topicsByDate(topics: WeeklyTopic[]): Map<string, WeeklyTopic> {
  const map = new Map<string, WeeklyTopic>();
  topics.forEach((topic) => {
    if (topic.date) map.set(topic.date, topic);
  });
  return map;
}

export function isWithinSemester(dateIso: string, semesterStart: string, semesterEnd: string): boolean {
  return dateIso >= semesterStart && dateIso <= semesterEnd;
}

export function countTeachingPlanStats(topics: WeeklyTopic[]) {
  const withContent = topics.filter((t) => hasTopicContent(t) && !t.isNoTeaching).length;
  const noTeachingDays = topics.filter((t) => t.isNoTeaching).length;
  const total = withContent + noTeachingDays;
  return { planned: total, completed: withContent };
}

/** คาบพัก/พักกลางวันต่อห้อง — เดียวกับ logic ใน useScheduleSettings onSnapshot (legacy breakPeriods fallback) */
export function nonTeachingPeriodsFor(classId: string, classSettingsMap: ClassSettingsMap): Set<number> {
  // ห้องที่ไม่มี doc class_settings ของตัวเอง → bundle store คืน {} (ไม่ใช่ undefined) ต้องเช็คว่ามีข้อมูลจริง
  // ก่อนถือว่า "มี" ไม่งั้น {} ?? school_wide จะไม่ fallback (เพราะ {} ไม่ nullish) แล้วหลุดไปใช้ DEFAULT_SETTINGS ผิดห้อง
  const own = classSettingsMap[classId];
  const hasOwnData = Boolean(own && (Array.isArray(own.lunchPeriods) || Array.isArray(own.breakPeriods)));
  const source = hasOwnData ? own! : (classSettingsMap.school_wide ?? {});
  const hasLunch = Array.isArray(source.lunchPeriods);
  const lunch = hasLunch ? source.lunchPeriods! : (source.breakPeriods ?? DEFAULT_SETTINGS.lunchPeriods);
  const brk = hasLunch ? (source.breakPeriods ?? []) : [];
  return new Set([...lunch, ...brk]);
}

export interface SyllabusProgressInput {
  departmentId: string;
  classId: string;
  subjectId: string;
  subjectName: string;
  syllabus: MicroSyllabus | null;
  yearBE: string;
  semester: 1 | 2;
  academicYear?: { startDate?: string; endDate?: string } | null;
  scheduleEntries: ScheduleEntry[];
  calendarEvents: CalendarEvent[];
  deptSettings?: DeptSemesterSettings | null;
  nonTeachingPeriods?: Set<number>;
}

/** ความคืบหน้าแผนการสอนตามวันสอนจริงใน schedule ตลอดเทอม — ใช้ทั้งฝั่งครูและแอดมิน (ห้ามคำนวณจาก topics array เปล่าๆ) */
export function computeSyllabusProgress(input: SyllabusProgressInput): {
  totalScheduledDays: number;
  completedDays: number;
  semesterStart: string;
  semesterEnd: string;
} {
  const range = resolveSemesterDateRange(
    input.yearBE,
    input.semester,
    input.academicYear,
    input.calendarEvents,
    input.deptSettings,
    departmentToSemesterKey(input.departmentId),
  );

  const classSubjectSchedule = filterScheduleForClassSubject(
    input.scheduleEntries,
    input.classId,
    input.subjectId,
    input.yearBE,
    input.semester,
    input.subjectName,
    input.nonTeachingPeriods,
  );
  const teachingSlots = buildTeachingSlotsBySchoolDay(classSubjectSchedule);
  const totalScheduledDays = countScheduledTeachingDays(
    range.start,
    range.end,
    teachingSlots,
    input.calendarEvents,
  );
  const completedDays = input.syllabus?.topics.filter((t) =>
    (hasTopicContent(t) || t.isNoTeaching || t.isTeachingClosed)
    && (!t.date || (t.date >= range.start && t.date <= range.end)),
  ).length ?? 0;

  return { totalScheduledDays, completedDays, semesterStart: range.start, semesterEnd: range.end };
}

export interface SyllabusProgressContext {
  classesById: Map<string, ClassRoom>;
  scheduleEntries: ScheduleEntry[];
  calendarEvents: CalendarEvent[];
  classSettingsMap: ClassSettingsMap;
  deptSemesterSettings?: DeptSemesterSettings | null;
  yearBE: string;
  semester: 1 | 2;
  academicYear?: { startDate?: string; endDate?: string } | null;
}

/**
 * % ความคืบหน้าของ syllabus เดี่ยวๆ (ใช้ในหน้าแอดมิน) — schedule-based เหมือนฝั่งครู
 * fallback เป็น topics-array ratio เฉพาะกรณีหา class/subjectId ผูกไม่ได้ (ข้อมูลเก่า/ไม่ครบ)
 */
export function computeSyllabusPct(
  syllabus: MicroSyllabus,
  ctx: SyllabusProgressContext,
): { pct: number; total: number; completed: number } {
  const cls = syllabus.classId ? ctx.classesById.get(syllabus.classId) : undefined;
  if (!cls || !syllabus.subjectId) {
    const { planned, completed } = countTeachingPlanStats(syllabus.topics);
    const total = planned > 0 ? planned : syllabus.totalWeeks;
    return { pct: total > 0 ? Math.round((completed / total) * 100) : 0, total, completed };
  }

  const nonTeachingPeriods = nonTeachingPeriodsFor(cls.id, ctx.classSettingsMap);
  const { totalScheduledDays, completedDays } = computeSyllabusProgress({
    departmentId: cls.departmentId,
    classId: cls.id,
    subjectId: syllabus.subjectId,
    subjectName: syllabus.subjectName,
    syllabus,
    yearBE: ctx.yearBE,
    semester: ctx.semester,
    academicYear: ctx.academicYear,
    scheduleEntries: ctx.scheduleEntries,
    calendarEvents: ctx.calendarEvents,
    deptSettings: ctx.deptSemesterSettings,
    nonTeachingPeriods,
  });

  return {
    pct: totalScheduledDays > 0 ? Math.round((completedDays / totalScheduledDays) * 100) : 0,
    total: totalScheduledDays,
    completed: completedDays,
  };
}

/** จำนวนวันสอนจริงตาม schedule ตลอดเทอม (ตัดวันหยุด/สอบออก) — ใช้เป็นตัวหารความคืบหน้าแผนการสอน */
export function countScheduledTeachingDays(
  semesterStart: string,
  semesterEnd: string,
  teachingSlotsBySchoolDay: Map<SchoolDay, TeachingSlotSummary>,
  calendarEvents: CalendarEvent[],
): number {
  if (teachingSlotsBySchoolDay.size === 0) return 0;
  const holidayRanges = calendarEvents.filter((e) => e.type === 'holiday');

  let count = 0;
  let cursor = parseISO(semesterStart);
  const end = parseISO(semesterEnd);
  while (cursor <= end) {
    const dateIso = toIsoDate(cursor);
    const schoolDay = dateToSchoolDay(cursor);
    const scheduledPeriods = schoolDay ? teachingSlotsBySchoolDay.get(schoolDay)?.periods ?? [] : [];
    const isHoliday = holidayRanges.some((e) => e.startDate <= dateIso && e.endDate >= dateIso);
    if (scheduledPeriods.length > 0 && !isHoliday) count += 1;
    cursor = addDays(cursor, 1);
  }
  return count;
}

export function dateToSchoolDay(date: Date): SchoolDay | null {
  const day = date.getDay();
  if (day === 0 || day === 6) return null;
  return day as SchoolDay;
}

export interface TeachingSlotSummary {
  periods: number[];
}

export function filterScheduleForClassSubject(
  entries: ScheduleEntry[],
  classId: string,
  subjectId: string,
  year: string,
  semester: 1 | 2,
  // ตารางสอนกับหลักสูตร/แผนการสอน resolve subjectId มาคนละทาง (subjects master vs
  // versioned curriculum course) บาง record เลยได้ id คนละตัวสำหรับวิชาเดียวกัน —
  // เทียบชื่อวิชาเป็น fallback กันเคสนี้ (ยังคง match ด้วย id ก่อนเสมอถ้าตรง)
  subjectName?: string,
  // คาบพัก/คาบพักกลางวันตั้งค่าได้ต่อห้อง (class_settings) — ไม่มี default ตายตัว
  // (เดิมใช้ LUNCH_PERIOD=6 ทั่วบอร์ด ทำให้ห้องที่ตั้งคาบพักไว้คาบอื่นถูกกรองผิดคาบ)
  nonTeachingPeriods?: Set<number>,
): ScheduleEntry[] {
  const normalizedName = subjectName?.trim();
  return entries.filter(
    (entry) =>
      entry.classId === classId
      && (entry.subjectId === subjectId || (!!normalizedName && entry.subjectName === normalizedName))
      && entry.year === year
      && entry.semester === semester
      && !(nonTeachingPeriods?.has(entry.period)),
  );
}

export function buildTeachingSlotsBySchoolDay(
  entries: ScheduleEntry[],
): Map<SchoolDay, TeachingSlotSummary> {
  const map = new Map<SchoolDay, TeachingSlotSummary>();
  for (const entry of entries) {
    const existing = map.get(entry.day) ?? { periods: [] };
    if (!existing.periods.includes(entry.period)) {
      existing.periods.push(entry.period);
    }
    map.set(entry.day, existing);
  }
  for (const summary of map.values()) {
    summary.periods.sort((a, b) => a - b);
  }
  return map;
}

export function formatTeachingPeriods(periods: number[]): string {
  if (periods.length === 0) return '';
  if (periods.length <= 3) {
    return periods.map((period) => `คาบ ${period}`).join(' · ');
  }
  return `คาบ ${periods[0]}-${periods[periods.length - 1]} (${periods.length})`;
}
