// src/types/grades.ts
import type { Department } from '@/types/curriculum';

// ── Grade Letter ───────────────────────────────────────────────────────────────

export type GradeLetter = 'A' | 'B+' | 'B' | 'C+' | 'C' | 'D+' | 'D' | 'F' | '0' | 'ร' | 'มส';

// ── Grade Config — สัดส่วนคะแนนต่อวิชา ───────────────────────────────────────

export interface GradeWeightConfig {
  id: string;               // subjectId + classId + academicYearId + semester
  subjectId: string;
  classId: string;
  academicYearId: string;
  semester: 1 | 2;
  departmentId: Department;
  weights: {
    classwork: number;      // % คะแนนเก็บ
    midterm: number;        // % กลางภาค
    final: number;          // % ปลายภาค
  };
  maxScores: {
    classwork: number;      // คะแนนเต็มรวมทั้งภาค
    midterm: number;
    final: number;
  };
  thresholds: GradeThreshold[];
  updatedAt: string;
}

export interface GradeThreshold {
  minScore: number;         // เปอร์เซ็นต์ ≥ นี้
  grade: GradeLetter;
}

export const DEFAULT_THRESHOLDS: GradeThreshold[] = [
  { minScore: 80, grade: 'A' },
  { minScore: 75, grade: 'B+' },
  { minScore: 70, grade: 'B' },
  { minScore: 65, grade: 'C+' },
  { minScore: 60, grade: 'C' },
  { minScore: 55, grade: 'D+' },
  { minScore: 50, grade: 'D' },
  { minScore: 0,  grade: 'F' },
];

export const DEFAULT_WEIGHTS = { classwork: 30, midterm: 30, final: 40 };
export const DEFAULT_MAX_SCORES = { classwork: 100, midterm: 100, final: 100 };

// ── Per-student score summary ──────────────────────────────────────────────────

export interface StudentScoreSummary {
  studentId: string;
  studentName: string;
  studentCode: string;
  photoURL?: string;
  gender?: 'male' | 'female';

  // Raw scores per category (null = ยังไม่มีข้อมูล)
  classworkScore: number | null;    // คะแนนรวมงาน/quiz ทั้งหมด
  midtermScore: number | null;
  finalScore: number | null;

  // Weighted total (0–100)
  totalScore: number | null;
  grade: GradeLetter | null;

  // เพิ่มเติม
  absent: boolean;                  // ขาดสอบ
  note?: string;
}

// ── Grade Book ─────────────────────────────────────────────────────────────────

export interface GradeBookEntry {
  id: string;
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  classId: string;
  className: string;
  teacherId: string;
  departmentId: Department;
  academicYearId: string;
  semester: 1 | 2;
  students: StudentScoreSummary[];
  config: GradeWeightConfig;
  updatedAt: string;
}

// ── Saved Grade Record (Firestore: grade_records collection) ──────────────────

export interface GradeRecord {
  id: string;
  studentId: string;
  studentName: string;     // snapshot
  studentCode: string;     // snapshot
  subjectId: string;
  subjectName: string;     // snapshot
  subjectCode: string;     // snapshot
  classId: string;
  className: string;       // snapshot
  teacherId: string;
  departmentId: Department;
  academicYearId: string;
  semester: 1 | 2;

  classworkScore: number | null;
  midtermScore: number | null;
  finalScore: number | null;
  totalScore: number | null;
  grade: GradeLetter | null;

  absent: boolean;
  note?: string;
  publishedAt?: string;    // วันที่ประกาศเกรด
  updatedAt: string;
}

export type NewGradeRecord = Omit<GradeRecord, 'id'>;
