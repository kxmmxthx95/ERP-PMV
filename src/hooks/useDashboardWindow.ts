// src/hooks/useDashboardWindow.ts
// ช่วงเวลา/วันทำงานของหน้าสรุปผลงาน — ใช้ร่วมกันระหว่างหน้าครูและตารางแอดมิน
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { useActiveAcademicYear } from '@/hooks/useActiveAcademicYear';
import { useAcademicCalendar } from '@/hooks/useAcademicCalendar';
import { loadThaiHolidaysForYear } from '@/features/calendar/hooks/useThaiHolidays';
import { deptSemestersStore } from '@/lib/firestoreShared/deptSemestersStore';
import { getLocalDateString } from '@/lib/calendar/schoolDay';
import { resolveSemesterDateRange, enumerateWorkingDays } from '@/lib/teacherKpi/semesterDates';
import { baseTeachingDays, resolveDashboardRange } from '@/lib/teacherDashboard/computeTeacherDashboard';

export function useDashboardWindow() {
  const { activeYear, activeSemester, isLoaded } = useActiveAcademicYear();
  const { events: calendarEvents } = useAcademicCalendar();
  const academicYearId = activeYear?.year ?? '';
  const semester = (activeSemester === 2 ? 2 : 1) as 1 | 2;

  const deptSemesterSettings = useSyncExternalStore(
    deptSemestersStore.subscribe,
    deptSemestersStore.getSnapshot,
    deptSemestersStore.getSnapshot,
  );
  const semesterRange = useMemo(() => {
    if (!activeYear) return { startDate: '', endDate: '' };
    return resolveSemesterDateRange(activeYear, semester, calendarEvents, deptSemesterSettings);
  }, [activeYear, semester, calendarEvents, deptSemesterSettings]);

  const today = getLocalDateString();
  const range = useMemo(() => resolveDashboardRange(semesterRange, today), [semesterRange, today]);

  // วันทำงาน (ต้องโหลดวันหยุดนักขัตฤกษ์ one-shot ต่อปี)
  const [workingDays, setWorkingDays] = useState<string[]>([]);
  useEffect(() => {
    if (!range.from || !range.to) return;
    let cancelled = false;
    const years = Array.from(new Set([range.from.slice(0, 4), range.to.slice(0, 4)])).map(Number);
    void Promise.all(years.map((y) => loadThaiHolidaysForYear(y).catch(() => [])))
      .then((sets) => {
        if (!cancelled) setWorkingDays(enumerateWorkingDays(range.from, range.to, calendarEvents, sets.flat()));
      });
    return () => { cancelled = true; };
  }, [range.from, range.to, calendarEvents]);

  const baseDays = useMemo(
    () => baseTeachingDays(workingDays, calendarEvents, range.rollCallEnd),
    [workingDays, calendarEvents, range.rollCallEnd],
  );

  return { activeYear, isLoaded, academicYearId, semester, calendarEvents, today, range, workingDays, baseDays };
}
