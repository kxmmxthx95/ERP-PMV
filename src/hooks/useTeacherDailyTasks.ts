import { useMemo, useSyncExternalStore } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useActiveAcademicYear } from '@/hooks/useActiveAcademicYear';
import { useSchedule } from '@/hooks/useSchedule';
import { useTeachersCollection } from '@/hooks/useTeachersCollection';
import { useHomeroomClassesForUser } from '@/hooks/useYearClassesHomeroom';
import { useTodayRollCallSessions } from '@/hooks/useMorningRollCall';
import { useAcademicCalendar } from '@/hooks/useAcademicCalendar';
import { getLocalDateString } from '@/lib/dateUtils';
import { classSessionEntryKey } from '@/lib/classSessionDocId';
import { getTodayClassSessionsStore } from '@/lib/firestoreShared/classSessionsStore';
import { filterTeacherEntriesForSchoolDay } from '@/features/schedule/utils/syncScheduleTeachers';
import { resolveTeacherFromAuth } from '@/lib/teachers/teacherIdentity';
import { useMicroSyllabus } from '@/hooks/useMicroSyllabus';
import type { MorningRollCallSession } from '@/types/morningRollCall';
import type { MicroSyllabus } from '@/types/microSyllabus';
import type { ScheduleEntry, SchoolDay } from '@/types/schedule';

const noopSubscribe = () => () => {};
const emptySessions = (): never[] => [];

export type TeacherDailyTaskStatus = 'done' | 'pending' | 'not_applicable';

export interface TeacherRollCallTask {
  classId: string;
  className: string;
  status: TeacherDailyTaskStatus;
  session: MorningRollCallSession | null;
}

export interface TeacherClassAttendanceTask {
  entryId: string;
  classId: string;
  className: string;
  subjectName: string;
  period: number;
  status: TeacherDailyTaskStatus;
}

export interface TeacherTeachingReflectionTask {
  taskId: string;
  classId: string;
  subjectId: string;
  className: string;
  subjectName: string;
  periods: number[];
  status: TeacherDailyTaskStatus;
  syllabusId?: string;
}

function findSyllabusForClassSubject(
  syllabi: MicroSyllabus[],
  classId: string,
  subjectId: string,
  subjectName: string,
): MicroSyllabus | undefined {
  return syllabi.find((syllabus) => {
    if (syllabus.classId !== classId) return false;
    return syllabus.subjectId === subjectId || syllabus.subjectName === subjectName;
  });
}

function hasTeachingReflectionForDate(syllabus: MicroSyllabus | undefined, dateIso: string): boolean {
  const topic = syllabus?.topics.find((item) => item.date === dateIso);
  return Boolean(topic?.completedAt && topic?.teachingReflection);
}

function useTodayClassSessions(academicYearId: string | undefined) {
  const today = getLocalDateString();
  const store = academicYearId ? getTodayClassSessionsStore(academicYearId, today) : null;
  const sessions = useSyncExternalStore(
    store?.subscribe ?? noopSubscribe,
    store ? store.getSnapshot : emptySessions,
    store ? store.getSnapshot : emptySessions,
  );
  const loading = academicYearId ? !store?.getReady() : false;
  return { sessions, loading, today };
}

export function useTeacherDailyTasks() {
  const { user } = useAuth();
  const { year, activeSemester, isLoaded } = useActiveAcademicYear();
  const { entries, classes } = useSchedule();
  const { teachers, loading: loadingTeachers } = useTeachersCollection();
  const { homeRoomClasses, loading: loadingHomeroom } = useHomeroomClassesForUser(
    year ?? undefined,
    user?.uid,
  );
  const { sessions: rollCallSessions, loading: loadingRollCall, today } = useTodayRollCallSessions(
    year ?? undefined,
  );
  const { sessions: classSessions, loading: loadingClassSessions } = useTodayClassSessions(
    year ?? undefined,
  );
  const { syllabi, loading: loadingMicroSyllabi } = useMicroSyllabus(user?.uid ?? null);
  const { events: calendarEvents } = useAcademicCalendar();

  const teacherProfile = useMemo(
    () => (user?.uid ? resolveTeacherFromAuth(user.uid, teachers) : null),
    [teachers, user?.uid],
  );
  const teacherLookupId = user?.uid ?? teacherProfile?.id ?? '';

  const schoolDay = useMemo((): SchoolDay | null => {
    const day = new Date(`${today}T12:00:00`).getDay();
    return day >= 1 && day <= 5 ? (day as SchoolDay) : null;
  }, [today]);

  // วันสอบ/กิจกรรม — ไม่ต้องเช็คชื่อเข้าเรียนและไม่ต้องบันทึกหลังสอน (not_applicable)
  const isExamOrActivityDay = useMemo(() => {
    return calendarEvents.some(
      (e) => (e.type === 'exam' || e.type === 'activity') && e.startDate <= today && e.endDate >= today,
    );
  }, [calendarEvents, today]);

  const completedClassSessionKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const session of classSessions) {
      if (!session.classId || session.subjectId == null || session.period == null) continue;
      keys.add(classSessionEntryKey(session.classId, session.subjectId, session.period));
    }
    return keys;
  }, [classSessions]);

  const rollCallByClassId = useMemo(() => {
    const map = new Map<string, MorningRollCallSession>();
    rollCallSessions.forEach((session) => {
      map.set(session.classId, session);
    });
    return map;
  }, [rollCallSessions]);

  const rollCallTasks = useMemo((): TeacherRollCallTask[] => {
    return homeRoomClasses.map((cls) => {
      const className =
        (cls as { className?: string }).className ||
        (cls as { label?: string }).label ||
        cls.id;
      const session = rollCallByClassId.get(cls.id) ?? null;
      return {
        classId: cls.id,
        className,
        status: session ? 'done' : 'pending',
        session,
      };
    });
  }, [homeRoomClasses, rollCallByClassId]);

  const todaysScheduleEntries = useMemo((): ScheduleEntry[] => {
    if (!schoolDay || !year || activeSemester == null || !teacherLookupId) return [];
    return filterTeacherEntriesForSchoolDay(
      entries,
      teacherLookupId,
      year,
      activeSemester as 1 | 2,
      schoolDay,
      teachers,
      teachers,
    );
  }, [entries, schoolDay, year, activeSemester, teacherLookupId, teachers]);

  const classAttendanceTasks = useMemo((): TeacherClassAttendanceTask[] => {
    return todaysScheduleEntries.map((entry) => {
      const key = classSessionEntryKey(entry.classId, entry.subjectId, entry.period);
      const done = completedClassSessionKeys.has(key);
      return {
        entryId: entry.id,
        classId: entry.classId,
        className: classes.find((c) => c.id === entry.classId)?.label ?? entry.classId,
        subjectName: entry.subjectName || entry.subjectCode || entry.subjectId,
        period: entry.period,
        status: isExamOrActivityDay ? 'not_applicable' : done ? 'done' : 'pending',
      };
    });
  }, [todaysScheduleEntries, completedClassSessionKeys, classes, isExamOrActivityDay]);

  const teachingReflectionTasks = useMemo((): TeacherTeachingReflectionTask[] => {
    const groups = new Map<string, TeacherTeachingReflectionTask>();

    todaysScheduleEntries.forEach((entry) => {
      const taskId = `${entry.classId}|${entry.subjectId}`;
      const className = classes.find((c) => c.id === entry.classId)?.label ?? entry.classId;
      const subjectName = entry.subjectName || entry.subjectCode || entry.subjectId;
      const existing = groups.get(taskId);

      if (existing) {
        if (!existing.periods.includes(entry.period)) {
          existing.periods.push(entry.period);
          existing.periods.sort((a, b) => a - b);
        }
        return;
      }

      const syllabus = findSyllabusForClassSubject(
        syllabi,
        entry.classId,
        entry.subjectId,
        subjectName,
      );
      const done = hasTeachingReflectionForDate(syllabus, today);

      groups.set(taskId, {
        taskId,
        classId: entry.classId,
        subjectId: entry.subjectId,
        className,
        subjectName,
        periods: [entry.period],
        status: isExamOrActivityDay ? 'not_applicable' : done ? 'done' : 'pending',
        syllabusId: syllabus?.id,
      });
    });

    return [...groups.values()].sort((a, b) => {
      const periodDiff = (a.periods[0] ?? 0) - (b.periods[0] ?? 0);
      if (periodDiff !== 0) return periodDiff;
      return a.className.localeCompare(b.className, 'th');
    });
  }, [todaysScheduleEntries, classes, syllabi, today, isExamOrActivityDay]);

  const rollCallStats = useMemo(() => {
    const total = rollCallTasks.length;
    const done = rollCallTasks.filter((t) => t.status === 'done').length;
    return { done, total, pending: total - done };
  }, [rollCallTasks]);

  const classStats = useMemo(() => {
    // ตัดงานที่ not_applicable (วันสอบ/กิจกรรม) ออกจากทั้งตัวเศษและตัวหาร
    const applicable = classAttendanceTasks.filter((t) => t.status !== 'not_applicable');
    const total = applicable.length;
    const done = applicable.filter((t) => t.status === 'done').length;
    return { done, total, pending: total - done };
  }, [classAttendanceTasks]);

  const reflectionStats = useMemo(() => {
    const applicable = teachingReflectionTasks.filter((task) => task.status !== 'not_applicable');
    const total = applicable.length;
    const done = applicable.filter((task) => task.status === 'done').length;
    return { done, total, pending: total - done };
  }, [teachingReflectionTasks]);

  const allDone =
    (rollCallStats.total === 0 || rollCallStats.pending === 0) &&
    (classStats.total === 0 || classStats.pending === 0) &&
    (reflectionStats.total === 0 || reflectionStats.pending === 0);

  const loading =
    !isLoaded ||
    loadingTeachers ||
    loadingHomeroom ||
    loadingRollCall ||
    loadingClassSessions ||
    loadingMicroSyllabi;

  return {
    today,
    schoolDay,
    loading,
    rollCallTasks,
    classAttendanceTasks,
    teachingReflectionTasks,
    rollCallStats,
    classStats,
    reflectionStats,
    allDone,
    hasHomeroom: homeRoomClasses.length > 0,
    hasClassesToday: classAttendanceTasks.length > 0,
    hasReflectionTasksToday: teachingReflectionTasks.length > 0,
  };
}
