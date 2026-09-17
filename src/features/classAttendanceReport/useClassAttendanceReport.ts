// src/features/classAttendanceReport/useClassAttendanceReport.ts
import { useSyncExternalStore } from 'react';
import { useActiveAcademicYear } from '@/hooks/useActiveAcademicYear';
import { getSchedulesByYearSemesterStore } from '@/lib/firestoreShared/schedulesStore';
import { getTodayClassSessionsStore } from '@/lib/firestoreShared/classSessionsStore';
import { timestampToLocalDate } from '@/hooks/useStaffAttendance';
import { PERIOD_TIMES, type SchoolDay } from '@/types/schedule';

export interface ClassAttendanceReportRow {
  scheduleId: string;
  teacherId: string;
  teacherName: string;
  subjectName: string;
  subjectCode: string;
  classId: string;
  room?: string;
  period: number;
  periodTime?: string;
  checkedAt: Date | null;
  status: 'checked' | 'not_checked';
}

export function useClassAttendanceReport(date: string) {
  const { activeYear, activeSemester, isLoaded } = useActiveAcademicYear();
  const academicYearId = activeYear?.year ?? '';
  const semester = (activeSemester === 2 ? 2 : 1) as 1 | 2;

  const schedulesStoreObj = getSchedulesByYearSemesterStore(academicYearId, semester);
  const schedules = useSyncExternalStore(
    schedulesStoreObj.subscribe,
    schedulesStoreObj.getSnapshot,
    schedulesStoreObj.getSnapshot,
  );

  const sessionsStoreObj = getTodayClassSessionsStore(academicYearId, date);
  const sessions = useSyncExternalStore(
    sessionsStoreObj.subscribe,
    sessionsStoreObj.getSnapshot,
    sessionsStoreObj.getSnapshot,
  );

  const dayOfWeek = new Date(`${date}T00:00:00`).getDay() as SchoolDay;

  const sessionsByScheduleId = new Map(
    sessions.filter((s) => s.scheduleId).map((s) => [s.scheduleId, s]),
  );

  const rows: ClassAttendanceReportRow[] = schedules
    .filter((s) => s.day === dayOfWeek)
    .map((s) => {
      const session = sessionsByScheduleId.get(s.id);
      const checkedAt = session ? timestampToLocalDate(session.createdAt) : null;
      return {
        scheduleId: s.id,
        teacherId: s.teacherId,
        teacherName: s.teacherName,
        subjectName: s.subjectName,
        subjectCode: s.subjectCode,
        classId: s.classId,
        room: s.room ?? session?.roomId,
        period: s.period,
        periodTime: PERIOD_TIMES[s.period],
        checkedAt,
        status: (checkedAt ? 'checked' : 'not_checked') as 'checked' | 'not_checked',
      };
    })
    .sort((a, b) => a.period - b.period || a.teacherName.localeCompare(b.teacherName, 'th'));

  return {
    rows,
    isLoading: !isLoaded,
  };
}
