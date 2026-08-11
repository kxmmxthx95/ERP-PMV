// src/types/grades.ts
import type { Department } from '@/types/curriculum';

// ── Grade Letter ───────────────────────────────────────────────────────────────

export type GradeLetter = 'A' | 'B+' | 'B' | 'C+' | 'C' | 'D+' | 'D' | 'F' | '0' | 'ร' | 'มส';

/** ผลวิชาแบบผ่าน/ไม่ผ่าน (หมวดกิจกรรม) — ไม่เข้า GPA */
export type PassFailResult = 'pass' | 'fail';

/** หมวดกิจกรรมบังคับใช้ผ่าน/ไม่ผ่าน · พื้นฐาน/เพิ่มเติมใช้เกรดเท่านั้น */
export function isPassFailSubjectCategory(
  category: string | undefined | null,
): boolean {
  return category === 'activity';
}

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

/** Thai 0–4 GPA mapping (used for display and grade calculation). */
export const GRADE_LETTER_TO_GPA: Record<GradeLetter, number> = {
  'A': 4,
  'B+': 3.5,
  'B': 3,
  'C+': 2.5,
  'C': 2,
  'D+': 1.5,
  'D': 1,
  'F': 0,
  '0': 0,
  'ร': 0,
  'มส': 0,
};

export const GPA_GRADE_OPTIONS: { letter: GradeLetter; gpa: number }[] = [
  { letter: 'A', gpa: 4 },
  { letter: 'B+', gpa: 3.5 },
  { letter: 'B', gpa: 3 },
  { letter: 'C+', gpa: 2.5 },
  { letter: 'C', gpa: 2 },
  { letter: 'D+', gpa: 1.5 },
  { letter: 'D', gpa: 1 },
  { letter: 'F', gpa: 0 },
];

export function gradeLetterToGpa(grade: GradeLetter): number {
  return GRADE_LETTER_TO_GPA[grade] ?? 0;
}

export function formatGpa(gpa: number): string {
  return Number.isInteger(gpa) ? `${gpa}` : gpa.toFixed(1);
}

export function gpaStyle(gpa: number): { text: string; bg: string } {
  if (gpa >= 3.5) return { text: '#059669', bg: '#d1fae5' };
  if (gpa >= 3) return { text: '#0891b2', bg: '#cffafe' };
  if (gpa >= 2.5) return { text: '#2563eb', bg: '#dbeafe' };
  if (gpa >= 2) return { text: '#7c3aed', bg: '#ede9fe' };
  if (gpa >= 1.5) return { text: '#d97706', bg: '#fef3c7' };
  if (gpa >= 1) return { text: '#ea580c', bg: '#ffedd5' };
  return { text: '#dc2626', bg: '#fee2e2' };
}

/** Map a 0–100 category/total % to the same color scale as GPA pills. */
export function percentScoreStyle(percent: number): { text: string; bg: string } {
  return gpaStyle((categoryScoreToPercent(percent) / 100) * 4);
}

export function isPassingGpa(gpa: number): boolean {
  return gpa >= 1;
}

/** Category scores are stored and edited on a 0–100 scale (percent). */
export function categoryScoreToPercent(score: number): number {
  return Math.min(100, Math.max(0, score));
}

/** Convert raw exam/assignment points to 0–100% using that item's max score. */
export function rawPointsToPercent(raw: number, maxPoints: number): number {
  const max = maxPoints > 0 ? maxPoints : 100;
  return categoryScoreToPercent((raw / max) * 100);
}

/** Average multiple exam % scores into one 0–100 category score (e.g. several quizzes → เก็บคะแนน). */
export function averagePercentScores(scores: number[]): number | null {
  if (scores.length === 0) return null;
  const sum = scores.reduce((acc, score) => acc + score, 0);
  return Math.round((sum / scores.length) * 10) / 10;
}

/** Convert a 0–100 category % into weighted points (e.g. 92% × 15% weight → 13.8). */
export function percentToWeightedPoints(percent: number, weight: number): number {
  return Math.round((categoryScoreToPercent(percent) * weight / 100) * 10) / 10;
}

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
  /** เฉพาะวิชาผ่าน/ไม่ผ่าน (activity) — grade จะเป็น null */
  result?: PassFailResult | null;

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
  /** เฉพาะวิชาผ่าน/ไม่ผ่าน (activity) */
  result?: PassFailResult | null;

  absent: boolean;
  note?: string;
  publishedAt?: string;    // legacy · ไม่ใช้แล้ว
  updatedAt: string;
}

export type NewGradeRecord = Omit<GradeRecord, 'id'>;
