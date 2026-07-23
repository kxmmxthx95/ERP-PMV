// src/hooks/useTeacherKpi.ts
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { collection, getDocs, query, where, type QueryDocumentSnapshot, type DocumentData } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useActiveAcademicYear } from '@/hooks/useActiveAcademicYear';
import { useTeachersCollection } from '@/hooks/useTeachersCollection';
import { useCurriculum } from '@/hooks/useCurriculum';
import { useAcademicCalendar } from '@/hooks/useAcademicCalendar';
import { loadThaiHolidaysForYear } from '@/features/calendar/hooks/useThaiHolidays';
import { getSchedulesByYearSemesterStore } from '@/lib/firestoreShared/schedulesStore';
import { getLocalDateString } from '@/lib/calendar/schoolDay';
import { resolveSemesterDateRange, enumerateWorkingDays } from '@/lib/teacherKpi/semesterDates';
import { deptSemestersStore } from '@/lib/firestoreShared/deptSemestersStore';
import { isTimestampAtOrAfterNoon } from '@/hooks/useStaffAttendance';
import { sessionCache } from '@/lib/sessionCache';
import { useTeacherKpiSettings } from '@/hooks/useTeacherKpiSettings';
import type { ScheduleEntry } from '@/types/schedule';
import type { TeacherKpiRow, TeacherKpiSummary, TeacherSubjectKpi } from '@/types/teacherKpi';

const DAY_CHUNK_SIZE = 15;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

interface StaffEntryDoc {
  userId: string;
  checkInTime: unknown;
}

async function fetchStaffEntriesForDays(workingDays: string[]): Promise<Map<string, Set<string>>> {
  // date -> set of userId ที่เข้างานจริง (เช็คอินก่อนเที่ยง) ในวันนั้น
  const attendedByDate = new Map<string, Set<string>>();

  for (const dayBatch of chunk(workingDays, DAY_CHUNK_SIZE)) {
    const results = await Promise.all(
      dayBatch.map((date) =>
        getDocs(collection(db, 'staff_attendance_by_date', date, 'entries'))
          .then((snap) => ({ date, docs: snap.docs }))
          .catch((): { date: string; docs: QueryDocumentSnapshot<DocumentData>[] } => ({ date, docs: [] })),
      ),
    );
    for (const { date, docs } of results) {
      const attended = new Set<string>();
      for (const d of docs) {
        const data = d.data() as StaffEntryDoc;
        if (data.checkInTime && !isTimestampAtOrAfterNoon(data.checkInTime)) {
          attended.add(data.userId);
        }
      }
      attendedByDate.set(date, attended);
    }
  }

  return attendedByDate;
}

function countExpectedSessions(teacherSchedules: ScheduleEntry[], workingDays: string[]): number {
  const weekdayCounts = new Map<number, number>();
  for (const dateStr of workingDays) {
    const dow = new Date(`${dateStr}T00:00:00`).getDay();
    weekdayCounts.set(dow, (weekdayCounts.get(dow) ?? 0) + 1);
  }
  let total = 0;
  for (const entry of teacherSchedules) {
    total += weekdayCounts.get(entry.day) ?? 0;
  }
  return total;
}

function cacheKey(
  academicYearId: string,
  semester: 1 | 2,
  effectiveStart: string,
  throughDate: string,
  excludedByTeacher: Record<string, string[]>,
): string {
  return `cache:teacherKpi:${academicYearId}:${semester}:${effectiveStart}:${throughDate}:${JSON.stringify(excludedByTeacher)}`;
}

export function useTeacherKpi() {
  const { activeYear, activeSemester, isLoaded: yearLoaded } = useActiveAcademicYear();
  const { teachers, loading: teachersLoading } = useTeachersCollection();
  const { subjects: curriculumSubjects } = useCurriculum();
  const { events: calendarEvents } = useAcademicCalendar();

  const [summary, setSummary] = useState<TeacherKpiSummary | null>(null);
  const [isComputing, setIsComputing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const academicYearId = activeYear?.year ?? '';
  const semester = (activeSemester === 2 ? 2 : 1) as 1 | 2;
  const { settings, saveStartDate, saveExcludedSubjects } = useTeacherKpiSettings(academicYearId, semester);

  const schedulesStoreObj = getSchedulesByYearSemesterStore(academicYearId, semester);
  const schedules = useSyncExternalStore(
    schedulesStoreObj.subscribe,
    schedulesStoreObj.getSnapshot,
    schedulesStoreObj.getSnapshot,
  );
  const deptSemesterSettings = useSyncExternalStore(
    deptSemestersStore.subscribe,
    deptSemestersStore.getSnapshot,
    deptSemestersStore.getSnapshot,
  );

  const semesterRange = useMemo(() => {
    if (!activeYear) return { startDate: '', endDate: '' };
    return resolveSemesterDateRange(activeYear, semester, calendarEvents, deptSemesterSettings);
  }, [activeYear, semester, calendarEvents, deptSemesterSettings]);

  useEffect(() => {
    if (!yearLoaded || teachersLoading) return;
    if (!academicYearId || !semesterRange.startDate || !semesterRange.endDate) return;

    const today = getLocalDateString();
    const computedThrough = today < semesterRange.endDate ? today : semesterRange.endDate;
    // ใช้วันที่ตั้งค่าไว้เป็นจุดเริ่ม ถ้าอยู่ในช่วงเทอม — นอกเหนือจากนั้นใช้วันเริ่มเทอมจริง
    // (ตั้งเป็นวันอนาคตได้ปกติ — enumerateWorkingDays คืนค่าว่างเองถ้ายังไม่ถึงวันนั้น)
    const configuredStart = settings.startDate;
    const effectiveStart = (
      configuredStart
      && configuredStart >= semesterRange.startDate
      && configuredStart <= semesterRange.endDate
    ) ? configuredStart : semesterRange.startDate;
    const excludedByTeacher = settings.excludedSubjectsByTeacher ?? {};
    const key = cacheKey(academicYearId, semester, effectiveStart, computedThrough, excludedByTeacher);

    const cached = sessionCache.get<TeacherKpiSummary>(key);
    if (cached) {
      setSummary(cached);
      return;
    }

    let cancelled = false;
    setIsComputing(true);
    setError(null);

    void (async () => {
      try {
        const startYear = new Date(`${effectiveStart}T00:00:00`).getFullYear();
        const endYear = new Date(`${computedThrough}T00:00:00`).getFullYear();
        const yearsNeeded = Array.from(new Set([startYear, endYear]));
        const thaiHolidaySets = await Promise.all(yearsNeeded.map((y) => loadThaiHolidaysForYear(y).catch(() => [])));
        const thaiHolidays = thaiHolidaySets.flat();

        const workingDays = enumerateWorkingDays(
          effectiveStart,
          computedThrough,
          calendarEvents,
          thaiHolidays,
        );

        const excludedByTeacher = settings.excludedSubjectsByTeacher ?? {};

        const classSessionsSnap = await getDocs(
          query(
            collection(db, 'class_sessions'),
            where('academicYearId', '==', academicYearId),
            where('semester', '==', semester),
          ),
        );
        // teacherId -> subjectId -> จำนวนคาบที่เช็คชื่อจริง (ยังไม่ตัดวิชาที่ยกเว้น — ใช้แสดงราย
        // วิชาใน Drawer ด้วย)
        const sessionCountByTeacherSubject = new Map<string, Map<string, number>>();
        classSessionsSnap.docs.forEach((d) => {
          const data = d.data() as { teacherId?: string; date?: string; subjectId?: string };
          if (!data.teacherId || !data.date || !data.subjectId) return;
          if (data.date > computedThrough || data.date < effectiveStart) return;
          const bySubject = sessionCountByTeacherSubject.get(data.teacherId) ?? new Map<string, number>();
          bySubject.set(data.subjectId, (bySubject.get(data.subjectId) ?? 0) + 1);
          sessionCountByTeacherSubject.set(data.teacherId, bySubject);
        });

        const attendedByDate = await fetchStaffEntriesForDays(workingDays);
        if (cancelled) return;

        const rows: TeacherKpiRow[] = teachers.map((teacher) => {
          let attendedDays = 0;
          if (teacher.userId) {
            for (const date of workingDays) {
              if (attendedByDate.get(date)?.has(teacher.userId)) attendedDays += 1;
            }
          }
          const workingDaysCount = workingDays.length;
          const attendanceRate = teacher.userId && workingDaysCount > 0
            ? Math.round((attendedDays / workingDaysCount) * 1000) / 10
            : null;

          const excludedSubjectIds = excludedByTeacher[teacher.id] ?? [];
          const schedulesBySubject = new Map<string, ScheduleEntry[]>();
          schedules
            .filter((s) => s.teacherId === teacher.id)
            .forEach((s) => {
              const arr = schedulesBySubject.get(s.subjectId) ?? [];
              arr.push(s);
              schedulesBySubject.set(s.subjectId, arr);
            });
          const teacherSessionCounts = sessionCountByTeacherSubject.get(teacher.id) ?? new Map<string, number>();

          // นับจากรายวิชาที่ได้รับมอบหมาย (teachingSubjectIds) รวมกับวิชาที่มีคาบในตารางสอนจริง —
          // วิชาที่ได้รับมอบหมายแต่ยังไม่ถูกจัดตาราง จะโชว์ expectedSessions:0 + inSchedule:false
          const allSubjectIds = new Set<string>([
            ...(teacher.teachingSubjectIds ?? []),
            ...schedulesBySubject.keys(),
          ]);

          const subjectBreakdown: TeacherSubjectKpi[] = Array.from(allSubjectIds)
            .map((subjectId) => {
              const entries = schedulesBySubject.get(subjectId);
              const subjectExpected = entries ? countExpectedSessions(entries, workingDays) : 0;
              const subjectCompleted = teacherSessionCounts.get(subjectId) ?? 0;
              const subjectRate = subjectExpected > 0
                ? Math.min(100, Math.round((subjectCompleted / subjectExpected) * 1000) / 10)
                : null;
              const curriculumSubject = curriculumSubjects.find((s) => s.id === subjectId || s.code === subjectId);
              return {
                subjectId,
                subjectName: entries?.[0].subjectName ?? curriculumSubject?.name ?? subjectId,
                subjectCode: entries?.[0].subjectCode ?? curriculumSubject?.code,
                rate: subjectRate,
                completedSessions: subjectCompleted,
                expectedSessions: subjectExpected,
                excluded: excludedSubjectIds.includes(subjectId),
                inSchedule: !!entries,
              };
            })
            .sort((a, b) => a.subjectName.localeCompare(b.subjectName, 'th'));

          const includedSubjects = subjectBreakdown.filter((s) => !s.excluded);
          const expectedSessions = includedSubjects.reduce((sum, s) => sum + s.expectedSessions, 0);
          const completedSessions = includedSubjects.reduce((sum, s) => sum + s.completedSessions, 0);
          const rollCallRate = expectedSessions > 0
            ? Math.min(100, Math.round((completedSessions / expectedSessions) * 1000) / 10)
            : null;

          return {
            teacherId: teacher.id,
            userId: teacher.userId ?? null,
            name: teacher.name,
            photoURL: teacher.photoURL,
            department: teacher.department,
            position: teacher.position,
            attendanceRate,
            attendedDays,
            workingDays: workingDaysCount,
            rollCallRate,
            completedSessions,
            expectedSessions,
            subjectBreakdown,
          };
        });

        const result: TeacherKpiSummary = {
          academicYearId,
          semester,
          semesterStartDate: semesterRange.startDate,
          semesterEndDate: semesterRange.endDate,
          effectiveStartDate: effectiveStart,
          computedThroughDate: computedThrough,
          rows,
        };

        if (cancelled) return;
        sessionCache.set(key, result, 60 * 60 * 1000);
        setSummary(result);
      } catch (err) {
        console.error('[useTeacherKpi] compute failed:', err);
        if (!cancelled) setError('ไม่สามารถคำนวณข้อมูล KPI ได้');
      } finally {
        if (!cancelled) setIsComputing(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    yearLoaded, teachersLoading, academicYearId, semester,
    semesterRange.startDate, semesterRange.endDate, settings.startDate,
    settings.excludedSubjectsByTeacher, teachers, calendarEvents, schedules,
    curriculumSubjects,
  ]);

  return {
    summary,
    isLoading: isComputing && !summary,
    isRefreshing: isComputing,
    error,
    schedules,
    kpiSettings: settings,
    saveKpiStartDate: saveStartDate,
    saveExcludedSubjects,
  };
}
