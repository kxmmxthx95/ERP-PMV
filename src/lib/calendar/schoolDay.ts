import type { CalendarEvent } from '@/types/calendar';

export function getLocalDateString(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export interface ResolvedSchoolDay {
  isHoliday: boolean;
  isWeekend: boolean;
  isAcademicHoliday: boolean;
  holidayTitle: string | null;
  holidayEvent: CalendarEvent | null;
}

export function resolveTodayHoliday(
  todayStr: string,
  extraHolidays: CalendarEvent[],
  calendarEvents: CalendarEvent[],
): ResolvedSchoolDay {
  const day = new Date(`${todayStr}T00:00:00`).getDay();
  const isWeekend = day === 0 || day === 6;

  if (isWeekend) {
    return {
      isHoliday: true,
      isWeekend: true,
      isAcademicHoliday: false,
      holidayTitle: day === 0 ? 'วันอาทิตย์' : 'วันเสาร์',
      holidayEvent: null,
    };
  }

  const extraMatch = extraHolidays.find(
    (h) => h.type === 'holiday' && todayStr >= h.startDate && todayStr <= h.endDate,
  );
  if (extraMatch) {
    return {
      isHoliday: true,
      isWeekend: false,
      isAcademicHoliday: true,
      holidayTitle: extraMatch.title,
      holidayEvent: extraMatch,
    };
  }

  const fsMatch = calendarEvents.find(
    (event) =>
      event.type === 'holiday'
      && todayStr >= event.startDate
      && todayStr <= event.endDate,
  );
  if (fsMatch) {
    return {
      isHoliday: true,
      isWeekend: false,
      isAcademicHoliday: true,
      holidayTitle: fsMatch.title || 'วันหยุด',
      holidayEvent: fsMatch,
    };
  }

  return {
    isHoliday: false,
    isWeekend: false,
    isAcademicHoliday: false,
    holidayTitle: null,
    holidayEvent: null,
  };
}
