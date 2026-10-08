// src/hooks/useTeacherDashboardKpi.ts
// KPI ของครูคนปัจจุบันแบบ realtime — listener ทุกตัว scope เฉพาะข้อมูลของครูคนนี้
// (ต่างจาก useTeacherKpi ที่คำนวณทั้งโรงเรียนแบบ one-shot)
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { collection, collectionGroup, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { useActiveAcademicYear } from '@/hooks/useActiveAcademicYear';
import { useTeachersCollection } from '@/hooks/useTeachersCollection';
import { useCurriculum } from '@/hooks/useCurriculum';
import { useAcademicCalendar } from '@/hooks/useAcademicCalendar';
import { useTeacherKpiSettings } from '@/hooks/useTeacherKpiSettings';
import { countExpectedSessions } from '@/hooks/useTeacherKpi';
import { isTimestampAtOrAfterNoon, type StaffAttendanceRecord } from '@/hooks/useStaffAttendance';
import { loadThaiHolidaysForYear } from '@/features/calendar/hooks/useThaiHolidays';
import { getSchedulesByYearSemesterStore } from '@/lib/firestoreShared/schedulesStore';
import { deptSemestersStore } from '@/lib/firestoreShared/deptSemestersStore';
import { getLocalDateString } from '@/lib/calendar/schoolDay';
import { resolveSemesterDateRange, enumerateWorkingDays } from '@/lib/teacherKpi/semesterDates';
import { buildCheckInHistoryRows, summarizeCheckInHistory } from '@/lib/staffAttendance/checkInHistory';
import { resolveCanonicalTeacherId } from '@/lib/teachers/teacherIdentity';
import type { TeacherKpiRow, TeacherSubjectKpi } from '@/types/teacherKpi';

interface SessionLite {
  date: string;
  subjectId: string;
}

export function useTeacherDashboardKpi() {
  const { user } = useAuth();
  const uid = user?.uid ?? '';
  const { activeYear, activeSemester, isLoaded } = useActiveAcademicYear();
  const { teachers, loading: teachersLoading } = useTeachersCollection();
  const { subjects: curriculumSubjects } = useCurriculum();
  const { events: calendarEvents } = useAcademicCalendar();

  const academicYearId = activeYear?.year ?? '';
  const semester = (activeSemester === 2 ? 2 : 1) as 1 | 2;
  const { settings } = useTeacherKpiSettings(academicYearId, semester);

  const teacher = useMemo(
    () => teachers.find((t) => t.userId === uid || t.id === uid) ?? null,
    [teachers, uid],
  );

  const schedulesStore = getSchedulesByYearSemesterStore(academicYearId, semester);
  const schedules = useSyncExternalStore(schedulesStore.subscribe, schedulesStore.getSnapshot, schedulesStore.getSnapshot);
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
  const throughDate = semesterRange.endDate && today > semesterRange.endDate ? semesterRange.endDate : today;
  const configuredStart = settings.startDate;
  const effectiveStart = (
    configuredStart && configuredStart >= semesterRange.startDate && configuredStart <= semesterRange.endDate
  ) ? configuredStart : semesterRange.startDate;

  // วันทำงาน (ต้องโหลดวันหยุดนักขัตฤกษ์ one-shot ต่อปี)
  const [workingDays, setWorkingDays] = useState<string[]>([]);
  useEffect(() => {
    if (!effectiveStart || !throughDate) return;
    let cancelled = false;
    const years = Array.from(new Set([effectiveStart.slice(0, 4), throughDate.slice(0, 4)])).map(Number);
    void Promise.all(years.map((y) => loadThaiHolidaysForYear(y).catch(() => [])))
      .then((sets) => {
        if (!cancelled) setWorkingDays(enumerateWorkingDays(effectiveStart, throughDate, calendarEvents, sets.flat()));
      });
    return () => { cancelled = true; };
  }, [effectiveStart, throughDate, calendarEvents]);

  // คาบที่เช็คชื่อแล้ว — realtime เฉพาะของครูคนนี้ (teacherId อาจเป็น id เอกสารครูหรือ auth uid)
  const [sessions, setSessions] = useState<SessionLite[]>([]);
  const [sessionsReady, setSessionsReady] = useState(false);
  const teacherDocId = teacher?.id ?? '';
  useEffect(() => {
    if (!academicYearId || !uid || teachersLoading) return;
    const ids = Array.from(new Set([uid, teacherDocId].filter(Boolean)));
    return onSnapshot(
      query(
        collection(db, 'class_sessions'),
        where('academicYearId', '==', academicYearId),
        where('semester', '==', semester),
        where('teacherId', 'in', ids),
      ),
      (snap) => {
        setSessions(snap.docs.map((d) => d.data() as SessionLite));
        setSessionsReady(true);
      },
      (err) => console.error('[useTeacherDashboardKpi] class_sessions', err),
    );
  }, [academicYearId, semester, uid, teacherDocId, teachersLoading]);

  // ลงเวลาปฏิบัติงานของตัวเอง — realtime
  const [attendanceRecords, setAttendanceRecords] = useState<StaffAttendanceRecord[]>([]);
  useEffect(() => {
    if (!uid) return;
    return onSnapshot(
      query(collectionGroup(db, 'entries'), where('userId', '==', uid)),
      (snap) => {
        setAttendanceRecords(snap.docs
          .filter((d) => d.ref.parent.parent?.parent?.id === 'staff_attendance_by_date')
          .map((d) => {
            const data = d.data() as Omit<StaffAttendanceRecord, 'id'>;
            return { ...data, id: d.id, userId: data.userId || uid, date: data.date || (d.ref.parent.parent?.id ?? '') };
          }));
      },
      (err) => console.error('[useTeacherDashboardKpi] staff entries', err),
    );
  }, [uid]);

  const row = useMemo<TeacherKpiRow | null>(() => {
    if (!teacher || !effectiveStart) return null;

    const attended = new Set(
      attendanceRecords
        .filter((r) => r.date >= effectiveStart && r.date <= throughDate && r.checkInTime && !isTimestampAtOrAfterNoon(r.checkInTime))
        .map((r) => r.date),
    );
    const attendedDays = workingDays.filter((d) => attended.has(d)).length;
    const attendanceRate = workingDays.length > 0
      ? Math.round((attendedDays / workingDays.length) * 1000) / 10
      : null;

    const excluded = settings.excludedSubjectsByTeacher?.[teacher.id] ?? [];
    const bySubject = new Map<string, typeof schedules>();
    schedules
      .filter((s) => resolveCanonicalTeacherId(s.teacherId, teachers) === teacher.id)
      .forEach((s) => bySubject.set(s.subjectId, [...(bySubject.get(s.subjectId) ?? []), s]));

    const doneBySubject = new Map<string, number>();
    sessions.forEach((s) => {
      if (s.date < effectiveStart || s.date > throughDate) return;
      doneBySubject.set(s.subjectId, (doneBySubject.get(s.subjectId) ?? 0) + 1);
    });

    const subjectBreakdown: TeacherSubjectKpi[] = Array.from(
      new Set([...(teacher.teachingSubjectIds ?? []), ...bySubject.keys()]),
    ).map((subjectId) => {
      const entries = bySubject.get(subjectId);
      const expected = entries ? countExpectedSessions(entries, workingDays) : 0;
      const completed = doneBySubject.get(subjectId) ?? 0;
      const cs = curriculumSubjects.find((s) => s.id === subjectId || s.code === subjectId);
      return {
        subjectId,
        subjectName: entries?.[0].subjectName ?? cs?.name ?? subjectId,
        subjectCode: entries?.[0].subjectCode ?? cs?.code,
        rate: expected > 0 ? Math.min(100, Math.round((completed / expected) * 1000) / 10) : null,
        completedSessions: completed,
        expectedSessions: expected,
        excluded: excluded.includes(subjectId),
        inSchedule: !!entries,
      };
    }).sort((a, b) => a.subjectName.localeCompare(b.subjectName, 'th'));

    const included = subjectBreakdown.filter((s) => !s.excluded);
    const expectedSessions = included.reduce((n, s) => n + s.expectedSessions, 0);
    const completedSessions = included.reduce((n, s) => n + s.completedSessions, 0);

    return {
      teacherId: teacher.id,
      userId: teacher.userId ?? null,
      name: teacher.name,
      photoURL: teacher.photoURL,
      department: teacher.department,
      position: teacher.position,
      attendanceRate,
      attendedDays,
      workingDays: workingDays.length,
      rollCallRate: expectedSessions > 0
        ? Math.min(100, Math.round((completedSessions / expectedSessions) * 1000) / 10)
        : null,
      completedSessions,
      expectedSessions,
      subjectBreakdown,
    };
  }, [teacher, teachers, effectiveStart, throughDate, workingDays, attendanceRecords, schedules, sessions, settings, curriculumSubjects]);

  const attendanceSummary = useMemo(
    () => summarizeCheckInHistory(buildCheckInHistoryRows(attendanceRecords, effectiveStart, throughDate, new Set())),
    [attendanceRecords, effectiveStart, throughDate],
  );

  return {
    row,
    teacherId: teacher?.id,
    attendanceSummary,
    isLoading: !isLoaded || teachersLoading || !sessionsReady,
  };
}
