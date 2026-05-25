import { useState, useMemo, useEffect } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { sessionCache } from '@/lib/sessionCache';

const CACHE_SCHEDULES = 'cache:schedules';
const CACHE_CLASSES   = 'cache:classes';
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

    // Teacher conflict — ครูคนเดิม สอนอยู่ที่อื่นในคาบเดียวกัน
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

    // Duplicate check — มีวิชานี้อยู่แล้วในห้องเดียวกัน คาบเดียวกัน
    if (
      entry.classId === candidate.classId &&
      (entry.subjectId === candidate.subjectId || entry.subjectCode === candidate.subjectCode)
    ) {
      conflicts.push({
        type: 'duplicate',
        message: `วิชานี้ (${candidate.subjectCode}) ถูกจัดลงในคาบนี้แล้วสำหรับห้อง ${getClassLabel(candidate.classId)}`,
        conflictingEntry: entry,
      });
    }

    // Room conflict — ห้องเรียน (room) เดียวกัน มีคาบซ้อน
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

// ── Hook ──────────────────────────────────────────────────────────────────────

export type NewScheduleEntry = Omit<ScheduleEntry, 'id'>;

export function useSchedule() {
  const [entries, setEntries] = useState<ScheduleEntry[]>(
    () => sessionCache.get<ScheduleEntry[]>(CACHE_SCHEDULES) ?? []
  );
  const [classes, setClasses] = useState<SchoolClass[]>(
    () => sessionCache.get<SchoolClass[]>(CACHE_CLASSES) ?? []
  );

  // ── ดึงข้อมูล Real-time จาก Firebase (ข้ามถ้า cache ยังใช้ได้) ──────────────────
  useEffect(() => {
    const cachedEntries = sessionCache.get<ScheduleEntry[]>(CACHE_SCHEDULES);
    const cachedClasses = sessionCache.get<SchoolClass[]>(CACHE_CLASSES);
    if (cachedEntries && cachedClasses) return;

    let cancelled = false;
    const unsubSchedules = onSnapshot(collection(db, 'schedules'), {
      next: (snap) => {
        if (cancelled) return;
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as ScheduleEntry));
        setEntries(data);
        sessionCache.set(CACHE_SCHEDULES, data);
      },
      error: () => {
        // Silent fail for permissions
      }
    });

    const unsubClasses = onSnapshot(collection(db, 'classes'), {
      next: (snap) => {
        if (cancelled) return;
        const data = snap.docs.map(d => {
          const raw = d.data();
          return {
            id: d.id,
            label: raw.className || raw.label || raw.id,
            className: raw.className || raw.label || raw.id,
            gradeLevel: raw.gradeLevel,
            roomNumber: raw.roomNumber,
            department: raw.department || raw.departmentId,
            departmentId: raw.departmentId || raw.department,
            academicYear: raw.academicYearId || raw.academicYear,
            academicYearId: raw.academicYearId || raw.academicYear,
            semester: raw.semester,
            curriculumPackageId: raw.curriculumPackageId,
            curriculumId: raw.curriculumId,
            enrolledCourses: raw.enrolledCourses || [],
            studentIds: raw.studentIds || [],
          } as SchoolClass;
        });
        setClasses(data);
        sessionCache.set(CACHE_CLASSES, data);
      },
      error: () => {
        // Silent fail for permissions
      }
    });

    return () => {
      cancelled = true;
      unsubSchedules();
      unsubClasses();
    };
  }, []);

  // ── CRUD ─────────────────────────────────────────────────────────────────────

  const addEntry = async (data: NewScheduleEntry): Promise<ConflictResult> => {
    const result = detectConflicts(data, entries, classes);
    // ตรวจสอบว่ามี conflict รุนแรง (Teacher/Room/Duplicate) หรือไม่
    const criticalConflicts = result.conflicts.filter(c => 
      c.type === 'teacher' || c.type === 'room' || c.type === 'duplicate'
    );
    
    if (criticalConflicts.length === 0) {
      await addDoc(collection(db, 'schedules'), data);
      sessionCache.invalidate(CACHE_SCHEDULES);
      return { hasConflict: false, conflicts: [] };
    }
    
    return { hasConflict: true, conflicts: criticalConflicts };
  };

  const updateEntry = async (id: string, data: NewScheduleEntry): Promise<ConflictResult> => {
    const result = detectConflicts(data, entries, classes, id);
    const criticalConflicts = result.conflicts.filter(c => 
      c.type === 'teacher' || c.type === 'room' || c.type === 'duplicate'
    );
    
    if (criticalConflicts.length === 0) {
      await updateDoc(doc(db, 'schedules', id), data as Partial<ScheduleEntry>);
      sessionCache.invalidate(CACHE_SCHEDULES);
      return { hasConflict: false, conflicts: [] };
    }
    return { hasConflict: true, conflicts: criticalConflicts };
  };

  const deleteEntry = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'schedules', id));
      sessionCache.invalidate(CACHE_SCHEDULES);
    } catch (err) {
      console.error('Error deleting entry:', err);
    }
  };

  const deleteEntriesInSlot = async (day: SchoolDay, period: number, year: string, semester: 1 | 2, criteria: { teacherId?: string, classId?: string }) => {
    const matches = entries.filter(e => 
      e.day === day && 
      e.period === period && 
      e.year === year && 
      e.semester === semester &&
      (!criteria.teacherId || e.teacherId === criteria.teacherId) &&
      (!criteria.classId || e.classId === criteria.classId)
    );

    await Promise.all(matches.map(e => deleteDoc(doc(db, 'schedules', e.id))));
    sessionCache.invalidate(CACHE_SCHEDULES);
  };

  const moveEntry = async (id: string, toDay: SchoolDay, toPeriod: number): Promise<ConflictResult> => {
    const entry = entries.find(e => e.id === id);
    if (!entry) return { hasConflict: false, conflicts: [] };
    const candidate = { ...entry, day: toDay, period: toPeriod };
    const result = detectConflicts(candidate, entries, classes, id);
    const criticalConflicts = result.conflicts.filter(c => c.type === 'teacher' || c.type === 'room');
    
    if (criticalConflicts.length === 0) {
      await updateDoc(doc(db, 'schedules', id), { day: toDay, period: toPeriod });
      sessionCache.invalidate(CACHE_SCHEDULES);
      return { hasConflict: false, conflicts: [] };
    }
    return { hasConflict: true, conflicts: criticalConflicts };
  };

  // ── Queries ───────────────────────────────────────────────────────────────────

  const getEntriesForClass = (classId: string, year: string, semester: 1 | 2) =>
    entries.filter(e => e.classId === classId && e.year === year && e.semester === semester);

  const getEntriesForTeacher = (teacherId: string, year: string, semester: 1 | 2) =>
    entries.filter(e => e.teacherId === teacherId && e.year === year && e.semester === semester);

  const getEntryAtSlot = (classId: string, day: SchoolDay, period: number, year: string, semester: 1 | 2) =>
    entries.find(e =>
      e.classId === classId && e.day === day && e.period === period &&
      e.year === year && e.semester === semester,
    ) ?? null;

  // สรุปจำนวนชั่วโมงรายครู
  const teacherLoadSummary = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of entries) {
      map[e.teacherId] = (map[e.teacherId] ?? 0) + 1;
    }
    return map;
  }, [entries]);

  return {
    entries,
    teachers: [], // ไม่ได้ใช้แล้ว (ดึงข้อมูลจาก useTeacherManager แทนในฝั่ง ScheduleEditor)
    classes,
    addEntry,
    updateEntry,
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
