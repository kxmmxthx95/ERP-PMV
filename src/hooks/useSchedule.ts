import { useState, useMemo } from 'react';
import type {
  ScheduleEntry, SchoolDay, ConflictResult, Teacher, SchoolClass,
} from '@/types/schedule';
import { LUNCH_PERIOD } from '@/types/schedule';

// ── Mock Teachers ─────────────────────────────────────────────────────────────

export const SEED_TEACHERS: Teacher[] = [
  { id: 't01', name: 'ครูสมใจ ใจดี',       department: 'primary' },
  { id: 't02', name: 'ครูวิไล รักเรียน',    department: 'primary' },
  { id: 't03', name: 'ครูประเสริฐ มั่นคง',  department: 'secondary' },
  { id: 't04', name: 'ครูนภา สดใส',         department: 'secondary' },
  { id: 't05', name: 'ครูอรุณ แจ่มใส',      department: 'early' },
  { id: 't06', name: 'ครูปิยะ ศรีสุข',      department: 'secondary' },
  { id: 't07', name: 'ครูเมธี ฉลาดเฉลียว', department: 'primary' },
];

// ── Mock Classes ──────────────────────────────────────────────────────────────

export const SEED_CLASSES: SchoolClass[] = [
  // ประถม
  { id: 'ป.4/1', label: 'ป.4/1', gradeLevel: 'ป.4', department: 'primary' },
  { id: 'ป.4/2', label: 'ป.4/2', gradeLevel: 'ป.4', department: 'primary' },
  { id: 'ป.5/1', label: 'ป.5/1', gradeLevel: 'ป.5', department: 'primary' },
  { id: 'ป.6/1', label: 'ป.6/1', gradeLevel: 'ป.6', department: 'primary' },
  // มัธยมต้น
  { id: 'ม.1/1', label: 'ม.1/1', gradeLevel: 'ม.1', department: 'secondary' },
  { id: 'ม.2/1', label: 'ม.2/1', gradeLevel: 'ม.2', department: 'secondary' },
  { id: 'ม.3/1', label: 'ม.3/1', gradeLevel: 'ม.3', department: 'secondary' },
  { id: 'ม.3/2', label: 'ม.3/2', gradeLevel: 'ม.3', department: 'secondary' },
  // มัธยมปลาย
  { id: 'ม.4/1', label: 'ม.4/1', gradeLevel: 'ม.4', department: 'secondary' },
  { id: 'ม.5/1', label: 'ม.5/1', gradeLevel: 'ม.5', department: 'secondary' },
  { id: 'ม.6/1', label: 'ม.6/1', gradeLevel: 'ม.6', department: 'secondary' },
];

// ── Seed Schedule (ม.3/1 เทอม 1 ปี 2568) ─────────────────────────────────────

const SEED_ENTRIES: ScheduleEntry[] = [
  { id: 'sc001', classId: 'ม.3/1', subjectId: 's30', subjectCode: 'M1001', subjectName: 'ภาษาไทย',    teacherId: 't01', teacherName: 'ครูสมใจ ใจดี',      day: 1, period: 1, year: '2568', semester: 1 },
  { id: 'sc002', classId: 'ม.3/1', subjectId: 's31', subjectCode: 'M1002', subjectName: 'คณิตศาสตร์', teacherId: 't03', teacherName: 'ครูประเสริฐ มั่นคง', day: 1, period: 2, year: '2568', semester: 1 },
  { id: 'sc003', classId: 'ม.3/1', subjectId: 's32', subjectCode: 'M1003', subjectName: 'วิทยาศาสตร์', teacherId: 't04', teacherName: 'ครูนภา สดใส',        day: 1, period: 3, year: '2568', semester: 1 },
  { id: 'sc004', classId: 'ม.3/1', subjectId: 's38', subjectCode: 'M1009', subjectName: 'ภาษาอังกฤษ', teacherId: 't06', teacherName: 'ครูปิยะ ศรีสุข',     day: 1, period: 4, year: '2568', semester: 1 },
  { id: 'sc005', classId: 'ม.3/1', subjectId: 's36', subjectCode: 'M1007', subjectName: 'สังคมศึกษา', teacherId: 't02', teacherName: 'ครูวิไล รักเรียน',    day: 2, period: 1, year: '2568', semester: 1 },
  { id: 'sc006', classId: 'ม.3/1', subjectId: 's31', subjectCode: 'M1002', subjectName: 'คณิตศาสตร์', teacherId: 't03', teacherName: 'ครูประเสริฐ มั่นคง', day: 2, period: 2, year: '2568', semester: 1 },
  { id: 'sc007', classId: 'ม.3/1', subjectId: 's38', subjectCode: 'M1009', subjectName: 'ภาษาอังกฤษ', teacherId: 't06', teacherName: 'ครูปิยะ ศรีสุข',     day: 3, period: 1, year: '2568', semester: 1 },
  { id: 'sc008', classId: 'ม.3/1', subjectId: 's30', subjectCode: 'M1001', subjectName: 'ภาษาไทย',    teacherId: 't01', teacherName: 'ครูสมใจ ใจดี',      day: 3, period: 2, year: '2568', semester: 1 },
  { id: 'sc009', classId: 'ม.3/1', subjectId: 's40', subjectCode: 'M1011', subjectName: 'ศิลปะ',      teacherId: 't02', teacherName: 'ครูวิไล รักเรียน',    day: 4, period: 1, year: '2568', semester: 1 },
  { id: 'sc010', classId: 'ม.3/1', subjectId: 's41', subjectCode: 'M1012', subjectName: 'การงานอาชีพ', teacherId: 't07', teacherName: 'ครูเมธี ฉลาดเฉลียว', day: 5, period: 1, year: '2568', semester: 1 },
  { id: 'sc011', classId: 'ม.3/1', subjectId: 's48', subjectCode: 'M4001', subjectName: 'กิจกรรมแนะแนว', teacherId: 't04', teacherName: 'ครูนภา สดใส',    day: 5, period: 2, year: '2568', semester: 1 },
  // ม.3/2 (เพื่อทดสอบ conflict)
  { id: 'sc020', classId: 'ม.3/2', subjectId: 's31', subjectCode: 'M1002', subjectName: 'คณิตศาสตร์', teacherId: 't03', teacherName: 'ครูประเสริฐ มั่นคง', day: 1, period: 5, year: '2568', semester: 1 },
];

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
  const [entries, setEntries] = useState<ScheduleEntry[]>(SEED_ENTRIES);

  // ── CRUD ─────────────────────────────────────────────────────────────────────

  const addEntry = (data: NewScheduleEntry): ConflictResult => {
    if (data.period === LUNCH_PERIOD) {
      return {
        hasConflict: true,
        conflicts: [{
          type: 'class',
          message: 'คาบที่ 6 เป็นคาบพักกลางวัน ไม่สามารถวางวิชาได้',
          conflictingEntry: {} as ScheduleEntry,
        }],
      };
    }

    const result = detectConflicts(data, entries);
    if (!result.hasConflict) {
      setEntries(prev => [...prev, { ...data, id: `sc-${Date.now()}` }]);
    }
    return result;
  };

  const updateEntry = (id: string, data: NewScheduleEntry): ConflictResult => {
    const result = detectConflicts(data, entries, id);
    if (!result.hasConflict) {
      setEntries(prev => prev.map(e => e.id === id ? { ...data, id } : e));
    }
    return result;
  };

  const deleteEntry = (id: string) => {
    setEntries(prev => prev.filter(e => e.id !== id));
  };

  const moveEntry = (id: string, toDay: SchoolDay, toPeriod: number): ConflictResult => {
    const entry = entries.find(e => e.id === id);
    if (!entry) return { hasConflict: false, conflicts: [] };
    const candidate = { ...entry, day: toDay, period: toPeriod };
    const result = detectConflicts(candidate, entries, id);
    if (!result.hasConflict) {
      setEntries(prev => prev.map(e => e.id === id ? candidate : e));
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
    teachers: SEED_TEACHERS,
    classes: SEED_CLASSES,
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
