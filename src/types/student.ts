import type { Department } from '@/types/curriculum';

// ── Student Status ─────────────────────────────────────────────────────────────

export type StudentStatus = 'active' | 'inactive' | 'graduated' | 'transferred';

export type EnrollmentStatus = 'studying' | 'transferred' | 'graduated';

export type Gender = 'male' | 'female';

export type BloodType = 'A' | 'B' | 'AB' | 'O';

// ── Student (Master Data — ไม่ขึ้นกับปีการศึกษา) ────────────────────────────────

export interface Student {
  id: string;                   // Firebase Auth UID หรือ Firestore auto ID
  studentCode: string;          // เลขประจำตัวนักเรียน เช่น "67001"
  prefix: string;               // "เด็กชาย" | "เด็กหญิง" | "นาย" | "นางสาว"
  firstName: string;
  lastName: string;
  firstNameEn?: string;
  lastNameEn?: string;
  birthDate?: string;           // "YYYY-MM-DD"
  gender: Gender;
  nationality?: string;
  religion?: string;
  bloodType?: BloodType;
  allergies?: string;
  photoURL?: string;
  address?: string;
  // ข้อมูลผู้ปกครอง
  guardianName?: string;
  guardianPhone?: string;
  guardianRelation?: string;    // "บิดา" | "มารดา" | "ผู้ปกครอง"
  // System
  status: StudentStatus;
  createdAt: string;            // ISO date string
}

export type NewStudent = Omit<Student, 'id' | 'createdAt'>;

// ── Enrollment (Transaction Data — ขึ้นกับปีการศึกษา) ────────────────────────────
// สอดคล้องกับ CLAUDE.md Firestore Schema Level 3

export interface Enrollment {
  id: string;
  studentId: string;            // ref → students
  classId: string;              // ref → classes
  // Snapshot fields — ลด Firestore reads
  className: string;            // e.g. "ม.3/1"
  gradeLevel: string;           // e.g. "ม.3"
  departmentId: Department;     // ← partition by department
  academicYearId: string;       // ← partition by year
  semester: 1 | 2;
  status: EnrollmentStatus;
  enrolledAt: string;           // ISO date string
}

export type NewEnrollment = Omit<Enrollment, 'id' | 'enrolledAt'>;

// ── Derived View — StudentCard ────────────────────────────────────────────────
// ใช้ใน UI (join student + enrollment)

export interface StudentCard {
  student: Student;
  enrollment: Enrollment | null;   // null ถ้ายังไม่ได้ลงทะเบียนปีนั้น
  currentClass: string | null;     // "ม.3/1"
  currentGrade: string | null;     // "ม.3"
}
