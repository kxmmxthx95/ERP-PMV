import type { Department } from '@/types/curriculum';

// ── ClassRoom ─────────────────────────────────────────────────────────────────
// สอดคล้องกับ CLAUDE.md Database Schema Level 2 — Relationship Data

export interface EnrolledCourse {
  subjectId: string;          // ref → subjects
  teacherId: string;          // ref → users/teachers (ครูผู้สอนวิชานี้)
  semester?: 1 | 2;           // ภาคเรียนที่สอน (ถ้าไม่มีถือว่าเป็นทั้งสองเทอม — backward compat)
}

export interface ClassRoom {
  id: string;
  className: string;          // e.g. "ม.3/1"
  gradeLevel: string;         // e.g. "ม.3"
  roomNumber: string;         // e.g. "1", "2", "A"
  departmentId: Department;   // 'early' | 'primary' | 'secondary'
  department: Department;     // แผนก (เพื่อเก็บลง Firestore ให้ตรงความต้องการ)
  academicYearId: string;     // e.g. "2568"
  semester: 1 | 2;
  homeroomTeacherId: string;  // ref → TeacherProfile.id (ครูประจำชั้นหลัก)
  homeroomTeacherIds: string[]; // ref → TeacherProfile.id (ครูประจำชั้น 1-2 คน)
  enrolledCourses: EnrolledCourse[]; // รายวิชาและครูผู้สอน
  studentCount: number;       // จำนวนนักเรียนปัจจุบัน
  maxStudents: number;        // ความจุสูงสุด
  track?: string;             // แผนการเรียน เช่น "วิทย์-คณิต"
  trackColor?: string;        // สีของแผนการเรียน
  room?: string;              // ห้องเรียน เช่น "อาคาร 3 ห้อง 301"
  note?: string;
  curriculumPackageId?: string; // ref → curriculumPackages/id
  isActive: boolean;
  createdAt: string;          // ISO date
}

export type NewClassRoom = Omit<ClassRoom, 'id' | 'createdAt'>;

// ── Derived view ─────────────────────────────────────────────────────────────
// ใช้ใน UI (join กับ teacher + schedule)

export interface ClassRoomCard {
  classRoom:        ClassRoom;
  homeroomTeacher:  { id: string; name: string; position?: string } | null;
  scheduledPeriods: number;   // คาบที่จัดแล้วในตาราง
  totalPeriods:     number;   // คาบทั้งหมดต่อสัปดาห์ (PERIOD_COUNT * 5 - lunch * 5)
  fillPct:          number;   // ตารางถูกจัดไปกี่ %
  isFull:           boolean;  // studentCount >= maxStudents
}

// ── Config ────────────────────────────────────────────────────────────────────

export const GRADE_LEVEL_ORDER: Record<string, number> = {
  'อ.1': 1, 'อ.2': 2, 'อ.3': 3,
  'ป.1': 4, 'ป.2': 5, 'ป.3': 6, 'ป.4': 7, 'ป.5': 8, 'ป.6': 9,
  'ม.1': 10, 'ม.2': 11, 'ม.3': 12,
  'ม.4': 13, 'ม.5': 14, 'ม.6': 15,
};

export const DEPARTMENT_GRADES: Record<Department, string[]> = {
  early:     ['อ.1', 'อ.2', 'อ.3'],
  primary:   ['ป.1', 'ป.2', 'ป.3', 'ป.4', 'ป.5', 'ป.6'],
  secondary: ['ม.1', 'ม.2', 'ม.3', 'ม.4', 'ม.5', 'ม.6'],
};
