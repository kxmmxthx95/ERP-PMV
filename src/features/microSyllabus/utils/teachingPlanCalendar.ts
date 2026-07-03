import {
  addDays,
  endOfMonth,
  endOfWeek,
  format,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { LUNCH_PERIOD, type ScheduleEntry, type SchoolDay } from '@/types/schedule';
import type { WeeklyTopic } from '@/types/microSyllabus';

export function toIsoDate(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

export function resolveSemesterDateRange(
  yearBE: string,
  semester: 1 | 2,
): { start: string; end: string } {
  const adYear = Number(yearBE) - 543;
  if (semester === 1) {
    return { start: `${adYear}-05-15`, end: `${adYear}-10-11` };
  }
  return { start: `${adYear}-11-01`, end: `${adYear + 1}-03-07` };
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
  const planned = topics.filter((t) => hasTopicContent(t)).length;
  const completed = topics.filter((t) => t.completedAt).length;
  return { planned, completed };
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
): ScheduleEntry[] {
  return entries.filter(
    (entry) =>
      entry.classId === classId
      && entry.subjectId === subjectId
      && entry.year === year
      && entry.semester === semester
      && entry.period !== LUNCH_PERIOD,
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
