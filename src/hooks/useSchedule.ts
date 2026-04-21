import { useState, useMemo, useEffect } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type {
  ScheduleEntry, SchoolDay, ConflictResult, SchoolClass,
} from '@/types/schedule';

// ── Conflict Detection ────────────────────────────────────────────────────────

export function detectConflicts(
  candidate: Omit<ScheduleEntry, 'id'>,
  allEntries: ScheduleEntry[],
  excludeId?: string,
): ConflictResult {
  const others = allEntries.filter(e => e.id !== excludeId);
  const conflicts: ConflictResult['conflicts'] = [];

  for (const entry of others) {
    if (entry.day !== candidate.day || entry.period !== candidate.period) continue;
    if (entry.year !== candidate.year || entry.semester !== candidate.semester) continue;

    // Teacher conflict — ครูคนเดิม สอนอยู่ที่อื่นในคาบเดียวกัน
    if (
      entry.teacherId === candidate.teacherId &&
      entry.classId !== candidate.classId
    ) {
      conflicts.push({
        type: 'teacher',
        message: `${candidate.teacherName} กำลังสอน${entry.subjectName} ที่ห้อง ${entry.classId} ในคาบเดียวกัน`,
        conflictingEntry: entry,
      });
    }

    // Class conflict — ห้องเดิม มีวิชาอื่นอยู่แล้วในคาบเดียวกัน
    if (
      entry.classId === candidate.classId &&
      entry.subjectId !== candidate.subjectId
    ) {
      conflicts.push({
        type: 'class',
        message: `ห้อง ${candidate.classId} มีวิชา ${entry.subjectName} อยู่แล้วในคาบนี้`,
        conflictingEntry: entry,
      });
    }

    // Room conflict — ห้องเรียน (room) เดียวกัน มีคาบซ้อน
    if (
      candidate.room &&
      entry.room &&
      entry.room === candidate.room &&
      entry.classId !== candidate.classId
    ) {
      conflicts.push({
        type: 'room',
        message: `ห้อง ${candidate.room} ถูกใช้งานโดย${entry.classId} ในคาบเดียวกัน`,
        conflictingEntry: entry,
      });
    }
  }

  return { hasConflict: conflicts.length > 0, conflicts };
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export type NewScheduleEntry = Omit<ScheduleEntry, 'id'>;

export function useSchedule() {
  const [entries, setEntries] = useState<ScheduleEntry[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);

  // ── ดึงข้อมูล Real-time จาก Firebase ──────────────────────────────────────────
  useEffect(() => {
    const unsubSchedules = onSnapshot(collection(db, 'schedules'), (snap) => {
      setEntries(snap.docs.map(d => ({ id: d.id, ...d.data() } as ScheduleEntry)));
    });
    
    const unsubClasses = onSnapshot(collection(db, 'classes'), (snap) => {
      setClasses(snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          label: data.className || data.id,
          gradeLevel: data.gradeLevel,
          department: data.departmentId,
        } as SchoolClass;
      }));
    });

    return () => {
      unsubSchedules();
      unsubClasses();
    };
  }, []);

  // ── CRUD ─────────────────────────────────────────────────────────────────────

  const addEntry = async (data: NewScheduleEntry): Promise<ConflictResult> => {
    const result = detectConflicts(data, entries);
    if (!result.hasConflict) {
      await addDoc(collection(db, 'schedules'), data);
    }
    return result;
  };

  const updateEntry = async (id: string, data: NewScheduleEntry): Promise<ConflictResult> => {
    const result = detectConflicts(data, entries, id);
    if (!result.hasConflict) {
      await updateDoc(doc(db, 'schedules', id), data as any);
    }
    return result;
  };

  const deleteEntry = async (id: string) => {
    await deleteDoc(doc(db, 'schedules', id));
  };

  const moveEntry = async (id: string, toDay: SchoolDay, toPeriod: number): Promise<ConflictResult> => {
    const entry = entries.find(e => e.id === id);
    if (!entry) return { hasConflict: false, conflicts: [] };
    const candidate = { ...entry, day: toDay, period: toPeriod };
    const result = detectConflicts(candidate, entries, id);
    if (!result.hasConflict) {
      await updateDoc(doc(db, 'schedules', id), { day: toDay, period: toPeriod });
    }
    return result;
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
    moveEntry,
    getEntriesForClass,
    getEntriesForTeacher,
    getEntryAtSlot,
    teacherLoadSummary,
    detectConflicts: (candidate: NewScheduleEntry, excludeId?: string) =>
      detectConflicts(candidate, entries, excludeId),
  };
}
