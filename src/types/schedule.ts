// ── Day / Period ──────────────────────────────────────────────────────────────

export type SchoolDay = 1 | 2 | 3 | 4 | 5; // จันทร์–ศุกร์

export const DAY_LABELS: Record<SchoolDay, string> = {
  1: 'จันทร์',
  2: 'อังคาร',
  3: 'พุธ',
  4: 'พฤหัสบดี',
  5: 'ศุกร์',
};

export const DAY_SHORT: Record<SchoolDay, string> = {
  1: 'จ.',
  2: 'อ.',
  3: 'พ.',
  4: 'พฤ.',
  5: 'ศ.',
};

export const SCHOOL_DAYS: SchoolDay[] = [1, 2, 3, 4, 5];

export const PERIOD_COUNT = 9;

export const PERIOD_TIMES: Record<number, string> = {
  1: '08:00–08:50',
  2: '08:50–09:40',
  3: '09:40–10:30',
  4: '10:30–11:20',
  5: '11:20–12:10',
  6: '12:10–13:00', // พัก
  7: '13:00–13:50',
  8: '13:50–14:40',
  9: '14:40–15:30',
};

export const LUNCH_PERIOD = 6; // คาบพัก (ไม่สามารถวางวิชาได้)

// ── Teacher ───────────────────────────────────────────────────────────────────

export interface Teacher {
  id: string;
  name: string;
  nameEn?: string;
  department: string; // 'early' | 'primary' | 'secondary'
  photoURL?: string;
  /** รายวิชาที่ครูได้รับมอบหมาย (อ้างอิง Subject.id จาก curriculum) */
  teachingSubjectIds?: string[];
}

// ── Schedule Entry ────────────────────────────────────────────────────────────

export interface ScheduleEntry {
  id: string;
  classId: string;     // e.g. 'ม.3/1'
  subjectId: string;   // อ้างอิงจาก curriculum
  subjectName: string;
  subjectCode: string;
  subjectGroup?: string;
  teacherId: string;
  teacherName: string;
  day: SchoolDay;
  period: number;      // 1–9
  room?: string;
  year: string;
  semester: 1 | 2;
}

// ── Conflict Detection ────────────────────────────────────────────────────────

export type ConflictType = 'teacher' | 'room' | 'class' | 'duplicate';

export interface Conflict {
  type: ConflictType;
  message: string;
  conflictingEntry: ScheduleEntry;
}

export interface ConflictResult {
  hasConflict: boolean;
  conflicts: Conflict[];
}

// ── Class (ห้องเรียน) ─────────────────────────────────────────────────────────

export interface SchoolClass {
  id: string;   // e.g. 'ม.3/1'
  label: string;
  className: string;
  roomNumber?: string;
  gradeLevel: string;
  department: 'early' | 'primary' | 'secondary';
  departmentId?: 'early' | 'primary' | 'secondary';
  academicYear: string;
  academicYearId?: string;
  semester?: 1 | 2;
  curriculumPackageId?: string;
  curriculumId?: string;
  enrolledCourses?: Array<{ subjectId: string; teacherId: string; semester?: 1 | 2 }>;
  studentIds?: string[];
}
