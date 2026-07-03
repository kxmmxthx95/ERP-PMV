import { useMemo } from 'react';
import { useAcademicCalendar } from '@/hooks/useAcademicCalendar';
import { useThaiHolidays } from '@/features/calendar/hooks/useThaiHolidays';
import { getLocalDateString, resolveTodayHoliday } from '@/lib/calendar/schoolDay';

export function useIsSchoolDayToday(userRole?: string, dateStr?: string) {
  const today = dateStr ?? getLocalDateString();
  const gregorianYear = new Date(`${today}T00:00:00`).getFullYear();
  const { events: calendarEvents } = useAcademicCalendar(userRole);
  const { holidays: thaiHolidays } = useThaiHolidays(gregorianYear);

  return useMemo(() => {
    const resolved = resolveTodayHoliday(today, thaiHolidays, calendarEvents);
    return {
      today,
      ...resolved,
      isSchoolDay: !resolved.isHoliday,
    };
  }, [today, thaiHolidays, calendarEvents]);
}
