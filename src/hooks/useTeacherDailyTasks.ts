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
import {
  buildTeacherIdentityKeys,
  matchesTeacherIdentity,
  resolveTeacherFromAuth,
} from '@/lib/teachers/teacherIdentity';
import { useMicroSyllabus } from '@/hooks/useMicroSyllabus';
import { useSubstitutionsForDate, type CachedSubstitution } from '@/lib/attendance/substituteAssignments';
import type { MorningRollCallSession } from '@/types/morningRollCall';
import type { MicroSyllabus } from '@/types/microSyllabus';
import type { ScheduleEntry, SchoolDay } from '@/types/schedule';

const noopSubscribe = () => () => {};
// ค่าอ้างอิงเดียวคงที่ ห้ามสร้าง [] ใหม่ทุกครั้ง ไม่งั้น useSyncExternalStore วน re-render ไม่จบ
const EMPTY_SESSIONS: never[] = [];
const emptySessions = () => EMPTY_SESSIONS;

export type TeacherDailyTaskStatus = 'done' | 'pending' | 'not_applicable' | 'covered';

export interface TeacherRollCallTask {
  classId: string;
  className: string;
  status: TeacherDailyTaskStatus;
  session: MorningRollCallSession | null;
  isSubstitute?: boolean;
  coveredByTeacherName?: string;
}

export interface TeacherClassAttendanceTask {
  entryId: string;
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  period: number;
  /** คาบทั้งหมดที่ครอบคลุม — >1 รายการ เมื่อวิชาเดียวกันสอนคาบติดกัน (เช็คชื่อครั้งเดียวนับทุกคาบ) */
  periods: number[];
  status: TeacherDailyTaskStatus;
  isSubstitute?: boolean;
  coveredByTeacherName?: string;
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

function isActiveSubstitution(s: CachedSubstitution): boolean {
  return (s.status ?? 'approved') === 'approved';
}

interface RawClassAttendanceEntry {
  entryId: string;
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  period: number;
  coveredByMe: boolean;
  isSubstitute?: boolean;
  coveredByTeacherName?: string;
}

/**
 * รวมคาบติดกัน (วิชา+ห้องเดียวกัน คาบเลขต่อกัน + สถานะสอนแทนตรงกัน) เป็น task เดียว
 * — เช็คชื่อครั้งเดียวนับทุกคาบที่รวมไว้ (ครูสอนคาบคู่ไม่ต้องเช็คซ้ำ)
 */
function mergeConsecutivePeriodTasks(
  raws: RawClassAttendanceEntry[],
  completedClassSessionKeys: Set<string>,
  isExamOrActivityDay: boolean,
): TeacherClassAttendanceTask[] {
  const sorted = [...raws].sort((a, b) => a.period - b.period);
  const groups: RawClassAttendanceEntry[][] = [];

  for (const item of sorted) {
    const group = groups[groups.length - 1];
    const prev = group?.[group.length - 1];
    const canMergeWithPrev =
      prev != null
      && prev.classId === item.classId
      && prev.subjectId === item.subjectId
      && prev.coveredByMe === item.coveredByMe
      && !!prev.isSubstitute === !!item.isSubstitute
      && prev.coveredByTeacherName === item.coveredByTeacherName
      && item.period === prev.period + 1;

    if (canMergeWithPrev) {
      group.push(item);
    } else {
      groups.push([item]);
    }
  }

  return groups.map((group): TeacherClassAttendanceTask => {
    const first = group[0];
    const periods = group.map((g) => g.period);
    const allDone = group.every((g) =>
      completedClassSessionKeys.has(classSessionEntryKey(g.classId, g.subjectId, g.period)),
    );
    return {
      entryId: group.map((g) => g.entryId).join('+'),
      classId: first.classId,
      className: first.className,
      subjectId: first.subjectId,
      subjectName: first.subjectName,
      period: first.period,
      periods,
      status: first.coveredByMe
        ? 'covered'
        : isExamOrActivityDay
          ? 'not_applicable'
          : allDone
            ? 'done'
            : 'pending',
      isSubstitute: first.isSubstitute,
      coveredByTeacherName: first.coveredByTeacherName,
    };
  });
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

function isNoTeachingDay(syllabus: MicroSyllabus | undefined, dateIso: string): boolean {
  const topic = syllabus?.topics.find((item) => item.date === dateIso);
  return Boolean(topic?.isNoTeaching);
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
  const todaySubstitutions = useSubstitutionsForDate(
    year ?? undefined,
    (activeSemester ?? undefined) as 1 | 2 | undefined,
    today,
  );
  const { syllabi, loading: loadingMicroSyllabi, createSyllabus, updateTopics } = useMicroSyllabus(user?.uid ?? null);
  const { events: calendarEvents } = useAcademicCalendar();

  const teacherProfile = useMemo(
    () => (user?.uid ? resolveTeacherFromAuth(user.uid, teachers) : null),
    [teachers, user?.uid],
  );
  const teacherLookupId = user?.uid ?? teacherProfile?.id ?? '';
  // สอนแทนอาจบันทึกด้วย teachers/{id} หรือ auth uid — เทียบด้วยชุด identity ทั้งหมด
  const identityKeys = useMemo(
    () => buildTeacherIdentityKeys(user?.uid ?? '', teacherProfile),
    [user?.uid, teacherProfile],
  );

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
      // ห้ามนับ session ที่มาจาก sync ใบลาล้วนๆ ว่า "เช็คชื่อแล้ว"
      // ถ้า leaveSyncOnly ค้างหลังครูบันทึก (บั๊ก merge เก่า) — มี present/late/absent หรือรายชื่อ >1 คน = เช็คจริงแล้ว
      if (session.leaveSyncOnly) {
        const present = session.summary?.present ?? 0;
        const late = session.summary?.late ?? 0;
        const absent = session.summary?.absent ?? 0;
        const attendanceCount = session.attendance?.length ?? 0;
        if (present + late + absent === 0 && attendanceCount <= 1) continue;
      }
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

  // มอบหมายเช็คชื่อเข้าแถวแทนของวันนี้ — key ด้วย classId (scope: 'rollcall' มีได้ห้องละ 1 รายการต่อวัน)
  const rollCallSubstitutionByClassId = useMemo(() => {
    const map = new Map<string, CachedSubstitution>();
    todaySubstitutions
      .filter((s) => s.scope === 'rollcall')
      .forEach((s) => map.set(s.classId, s));
    return map;
  }, [todaySubstitutions]);

  const rollCallTasks = useMemo((): TeacherRollCallTask[] => {
    const myClassIds = new Set(homeRoomClasses.map((cls) => cls.id));

    const own = homeRoomClasses.map((cls): TeacherRollCallTask => {
      const className =
        (cls as { className?: string }).className ||
        (cls as { label?: string }).label ||
        cls.id;
      const session = rollCallByClassId.get(cls.id) ?? null;
      const covering = rollCallSubstitutionByClassId.get(cls.id);
      const coveredByMe =
        !!covering
        && isActiveSubstitution(covering)
        && matchesTeacherIdentity(covering.originalTeacherId, identityKeys);
      return {
        classId: cls.id,
        className,
        status: coveredByMe ? 'covered' : session ? 'done' : 'pending',
        session,
        coveredByTeacherName: coveredByMe ? covering.substituteTeacherName : undefined,
      };
    });

    // ห้องที่ฉันรับมอบหมายให้เช็คชื่อแทน (ไม่ใช่ห้องประจำชั้นของฉันเอง)
    const substituteTasks: TeacherRollCallTask[] = [...rollCallSubstitutionByClassId.values()]
      .filter(
        (s) =>
          isActiveSubstitution(s)
          && matchesTeacherIdentity(s.substituteTeacherId, identityKeys)
          && !myClassIds.has(s.classId),
      )
      .map((s) => {
        const session = rollCallByClassId.get(s.classId) ?? null;
        return {
          classId: s.classId,
          className: classes.find((c) => c.id === s.classId)?.label ?? s.classId,
          status: session ? 'done' : 'pending',
          session,
          isSubstitute: true,
          coveredByTeacherName: s.originalTeacherName,
        };
      });

    return [...own, ...substituteTasks];
  }, [homeRoomClasses, rollCallByClassId, rollCallSubstitutionByClassId, identityKeys, classes]);

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

  // มอบหมายสอนแทนของวันนี้ — key ด้วย classId|period (scope: 'period')
  const periodSubstitutionByEntryKey = useMemo(() => {
    const map = new Map<string, CachedSubstitution>();
    todaySubstitutions
      .filter((s) => s.scope === 'period' && s.period != null)
      .forEach((s) => map.set(`${s.classId}|${s.period}`, s));
    return map;
  }, [todaySubstitutions]);

  const classAttendanceTasks = useMemo((): TeacherClassAttendanceTask[] => {
    const myEntryKeys = new Set(todaysScheduleEntries.map((entry) => `${entry.classId}|${entry.period}`));

    const ownRaws: RawClassAttendanceEntry[] = todaysScheduleEntries.map((entry) => {
      const covering = periodSubstitutionByEntryKey.get(`${entry.classId}|${entry.period}`);
      const coveredByMe =
        !!covering
        && isActiveSubstitution(covering)
        && matchesTeacherIdentity(covering.originalTeacherId, identityKeys);
      return {
        entryId: entry.id,
        classId: entry.classId,
        className: classes.find((c) => c.id === entry.classId)?.label ?? entry.classId,
        subjectId: entry.subjectId,
        subjectName: entry.subjectName || entry.subjectCode || entry.subjectId,
        period: entry.period,
        coveredByMe,
        coveredByTeacherName: coveredByMe ? covering!.substituteTeacherName : undefined,
      };
    });

    // คาบที่ฉันรับมอบหมายให้สอนแทน (ไม่ใช่คาบสอนของฉันเอง)
    const substituteRaws: RawClassAttendanceEntry[] = [...periodSubstitutionByEntryKey.values()]
      .filter(
        (s) =>
          isActiveSubstitution(s)
          && matchesTeacherIdentity(s.substituteTeacherId, identityKeys)
          && !myEntryKeys.has(`${s.classId}|${s.period}`),
      )
      .map((s) => ({
        entryId: `sub-${s.id}`,
        classId: s.classId,
        className: classes.find((c) => c.id === s.classId)?.label ?? s.classId,
        subjectId: s.subjectId ?? '',
        subjectName: s.subjectName ?? '',
        period: s.period ?? 0,
        coveredByMe: false,
        isSubstitute: true,
        coveredByTeacherName: s.originalTeacherName,
      }));

    return mergeConsecutivePeriodTasks(
      [...ownRaws, ...substituteRaws],
      completedClassSessionKeys,
      isExamOrActivityDay,
    );
  }, [todaysScheduleEntries, completedClassSessionKeys, classes, isExamOrActivityDay, periodSubstitutionByEntryKey, identityKeys]);

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
      const noTeachingDay = isNoTeachingDay(syllabus, today);

      groups.set(taskId, {
        taskId,
        classId: entry.classId,
        subjectId: entry.subjectId,
        className,
        subjectName,
        periods: [entry.period],
        status: isExamOrActivityDay || noTeachingDay ? 'not_applicable' : done ? 'done' : 'pending',
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
    // ตัดงานที่ covered (มีครูเช็คชื่อแทนแล้ว) ออกจากทั้งตัวเศษและตัวหาร เหมือน not_applicable
    const applicable = rollCallTasks.filter((t) => t.status !== 'covered');
    const total = applicable.length;
    const done = applicable.filter((t) => t.status === 'done').length;
    return { done, total, pending: total - done };
  }, [rollCallTasks]);

  const classStats = useMemo(() => {
    // ตัดงานที่ not_applicable (วันสอบ/กิจกรรม) และ covered (มีครูสอนแทนแล้ว) ออกจากทั้งตัวเศษและตัวหาร
    const applicable = classAttendanceTasks.filter((t) => t.status !== 'not_applicable' && t.status !== 'covered');
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
    syllabi,
    createSyllabus,
    updateTopics,
  };
}
