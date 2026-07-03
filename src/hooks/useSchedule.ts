import { useMemo, useSyncExternalStore } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getSchedulesByYearSemesterStore } from '@/lib/firestoreShared/schedulesStore';
import { getClassesByYearStore } from '@/lib/firestoreShared/studentSummaryStore';
import { useActiveAcademicYear } from '@/hooks/useActiveAcademicYear';
import { getSubjectCategory } from '@/features/schedule/constants/colors';
import type {
  ScheduleEntry, SchoolDay, ConflictResult, SchoolClass,
} from '@/types/schedule';

// ── Conflict Detection ────────────────────────────────────────────────────────

export function detectConflicts(
  candidate: Omit<ScheduleEntry, 'id'>,
  allEntries: ScheduleEntry[],
  classes: SchoolClass[] = [],
  excludeId?: string,
): ConflictResult {
  const others = allEntries.filter(e => e.id !== excludeId);
  const conflicts: ConflictResult['conflicts'] = [];

  const getClassLabel = (id: string) => classes.find(c => c.id === id)?.label || id;

  for (const entry of others) {
    if (entry.day !== candidate.day || entry.period !== candidate.period) continue;
    if (entry.year !== candidate.year || entry.semester !== candidate.semester) continue;

    const entryCategory = getSubjectCategory(entry.subjectName, entry.subjectGroup);
    const candidateCategory = getSubjectCategory(candidate.subjectName, candidate.subjectGroup);

    const isJointClassSession =
      entry.teacherId === candidate.teacherId &&
      entry.classId !== candidate.classId &&
      (
        entry.subjectId === candidate.subjectId ||
        entry.subjectCode === candidate.subjectCode ||
        (entryCategory === candidateCategory && entryCategory !== 'other')
      );

    if (
      entry.teacherId === candidate.teacherId &&
      entry.classId !== candidate.classId &&
      !isJointClassSession
    ) {
      conflicts.push({
        type: 'teacher',
        message: `${candidate.teacherName} กำลังสอน${entry.subjectName} ที่ห้อง ${getClassLabel(entry.classId)} ในคาบเดียวกัน`,
        conflictingEntry: entry,
      });
    }

    if (entry.classId === candidate.classId) {
      conflicts.push({
        type: 'duplicate',
        message: `ห้อง ${getClassLabel(candidate.classId)} มีรายวิชาในคาบนี้แล้ว (กำหนดได้เพียง 1 วิชาต่อคาบ)`,
        conflictingEntry: entry,
      });
      continue;
    }

    if (
      candidate.room &&
      entry.room &&
      entry.room === candidate.room &&
      entry.classId !== candidate.classId &&
      !isJointClassSession
    ) {
      conflicts.push({
        type: 'room',
        message: `ห้อง ${candidate.room} ถูกใช้งานโดยห้อง ${getClassLabel(entry.classId)} ในคาบเดียวกัน`,
        conflictingEntry: entry,
      });
    }
  }

  return { hasConflict: conflicts.length > 0, conflicts };
}

function mapClassDoc(raw: { id: string; [key: string]: unknown }): SchoolClass {
  const id = raw.id;
  return {
    id,
    label: (raw.className as string) || (raw.label as string) || id,
    className: (raw.className as string) || (raw.label as string) || id,
    gradeLevel: raw.gradeLevel as string | undefined,
    roomNumber: raw.roomNumber as string | undefined,
    department: (raw.department as string) || (raw.departmentId as string),
    departmentId: (raw.departmentId as string) || (raw.department as string),
    academicYear: (raw.academicYearId as string) || (raw.academicYear as string),
    academicYearId: (raw.academicYearId as string) || (raw.academicYear as string),
    semester: raw.semester as number | undefined,
    curriculumPackageId: raw.curriculumPackageId as string | undefined,
    curriculumId: raw.curriculumId as string | undefined,
    enrolledCourses: (raw.enrolledCourses as SchoolClass['enrolledCourses']) || [],
    studentIds: (raw.studentIds as string[]) || [],
  } as SchoolClass;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export type NewScheduleEntry = Omit<ScheduleEntry, 'id'>;

export function useSchedule() {
  const { year: activeYearStr, activeSemester } = useActiveAcademicYear();
  const yearId = activeYearStr ?? '2568';
  const semester = (activeSemester ?? 1) as 1 | 2;

  const scheduleStore = getSchedulesByYearSemesterStore(yearId, semester);
  const classesStore = getClassesByYearStore(yearId);

  const entries = useSyncExternalStore(
    scheduleStore.subscribe,
    scheduleStore.getSnapshot,
    scheduleStore.getSnapshot,
  );
  const rawClasses = useSyncExternalStore(
    classesStore.subscribe,
    classesStore.getSnapshot,
    classesStore.getSnapshot,
  );
  const classes = useMemo(() => rawClasses.map(mapClassDoc), [rawClasses]);

  const addEntry = async (data: NewScheduleEntry): Promise<ConflictResult> => {
    const result = detectConflicts(data, entries, classes);
    const criticalConflicts = result.conflicts.filter(c =>
      c.type === 'teacher' || c.type === 'room' || c.type === 'duplicate',
    );

    if (criticalConflicts.length === 0) {
      await addDoc(collection(db, 'schedules'), data);
      return { hasConflict: false, conflicts: [] };
    }

    return { hasConflict: true, conflicts: criticalConflicts };
  };

  const updateEntry = async (id: string, data: NewScheduleEntry): Promise<ConflictResult> => {
    const result = detectConflicts(data, entries, classes, id);
    const criticalConflicts = result.conflicts.filter(c =>
      c.type === 'teacher' || c.type === 'room' || c.type === 'duplicate',
    );

    if (criticalConflicts.length === 0) {
      await updateDoc(doc(db, 'schedules', id), data as Partial<ScheduleEntry>);
      return { hasConflict: false, conflicts: [] };
    }
    return { hasConflict: true, conflicts: criticalConflicts };
  };

  const deleteEntry = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'schedules', id));
    } catch (err) {
      console.error('Error deleting entry:', err);
    }
  };

  const deleteEntriesInSlot = async (day: SchoolDay, period: number, year: string, sem: 1 | 2, criteria: { teacherId?: string, classId?: string }) => {
    const matches = entries.filter(e =>
      e.day === day &&
      e.period === period &&
      e.year === year &&
      e.semester === sem &&
      (!criteria.teacherId || e.teacherId === criteria.teacherId) &&
      (!criteria.classId || e.classId === criteria.classId),
    );

    await Promise.all(matches.map(e => deleteDoc(doc(db, 'schedules', e.id))));
  };

  const batchUpdateTeacherFields = async (
    updates: Array<{ id: string; teacherId: string; teacherName: string }>,
  ) => {
    if (updates.length === 0) return;
    const results = await Promise.allSettled(
      updates.map((update) =>
        updateDoc(doc(db, 'schedules', update.id), {
          teacherId: update.teacherId,
          teacherName: update.teacherName,
        }),
      ),
    );
    const failed = results.filter((result) => result.status === 'rejected');
    if (failed.length > 0) {
      console.error('Failed to sync schedule teachers:', failed);
      throw new Error(`อัปเดตไม่สำเร็จ ${failed.length}/${updates.length} คาบ`);
    }
  };

  const moveEntry = async (id: string, toDay: SchoolDay, toPeriod: number): Promise<ConflictResult> => {
    const entry = entries.find(e => e.id === id);
    if (!entry) return { hasConflict: false, conflicts: [] };
    const candidate = { ...entry, day: toDay, period: toPeriod };
    const result = detectConflicts(candidate, entries, classes, id);
    const criticalConflicts = result.conflicts.filter(c => c.type === 'teacher' || c.type === 'room');

    if (criticalConflicts.length === 0) {
      await updateDoc(doc(db, 'schedules', id), { day: toDay, period: toPeriod });
      return { hasConflict: false, conflicts: [] };
    }
    return { hasConflict: true, conflicts: criticalConflicts };
  };

  const getEntriesForClass = (classId: string, year: string, sem: 1 | 2) =>
    entries.filter(e => e.classId === classId && e.year === year && e.semester === sem);

  const getEntriesForTeacher = (teacherId: string, year: string, sem: 1 | 2) =>
    entries.filter(e => e.teacherId === teacherId && e.year === year && e.semester === sem);

  const getEntryAtSlot = (classId: string, day: SchoolDay, period: number, year: string, sem: 1 | 2) =>
    entries.find(e =>
      e.classId === classId && e.day === day && e.period === period &&
      e.year === year && e.semester === sem,
    ) ?? null;

  const teacherLoadSummary = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of entries) {
      map[e.teacherId] = (map[e.teacherId] ?? 0) + 1;
    }
    return map;
  }, [entries]);

  return {
    entries,
    teachers: [],
    classes,
    addEntry,
    updateEntry,
    batchUpdateTeacherFields,
    deleteEntry,
    deleteEntriesInSlot,
    moveEntry,
    getEntriesForClass,
    getEntriesForTeacher,
    getEntryAtSlot,
    teacherLoadSummary,
    detectConflicts: (candidate: NewScheduleEntry, excludeId?: string) =>
      detectConflicts(candidate, entries, classes, excludeId),
  };
}
