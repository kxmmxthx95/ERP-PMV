/** Executive gradebook overview: classroom × subject GPA matrix */

import type { SubjectGroupId } from '@/types/curriculum';

export interface GradeAssessmentCell {
  avgGpa: number;
  n: number;
}

export interface GradeAssessmentSubjectCol {
  subjectId: string;
  /** ชื่อรายวิชา — ใช้เป็นหัวคอลัมน์ */
  subjectName: string;
  subjectCode: string;
  /** กลุ่มสาระ — ใช้เรียงหัวตาราง */
  subjectGroupId?: SubjectGroupId;
}

export interface GradeAssessmentRow {
  /** ระดับชั้น เช่น ม.3 (สรุปรอง) */
  gradeLevel: string;
  /** subjectId → cell */
  bySubject: Record<string, GradeAssessmentCell>;
  rowAvgGpa: number | null;
  rowN: number;
}

export interface GradeAssessmentClassRow {
  classId: string;
  className: string;
  gradeLevel: string;
  bySubject: Record<string, GradeAssessmentCell>;
  rowAvgGpa: number | null;
  rowN: number;
}

/** เกรดรายวิชาของนักเรียน 1 คน */
export interface GradeAssessmentStudentCell {
  grade: string;
  gpa: number;
}

/** แถวนักเรียนในห้อง (drill-down จากเมทริกซ์) */
export interface GradeAssessmentStudentRow {
  studentId: string;
  studentCode: string;
  fullName: string;
  photoURL?: string;
  /** subjectId → เกรด */
  bySubject: Record<string, GradeAssessmentStudentCell>;
  rowAvgGpa: number | null;
  rowN: number;
}

export interface GradeAssessmentClassOption {
  classId: string;
  className: string;
  gradeLevel: string;
}

export interface GradeAssessmentMatrix {
  academicYearId: string;
  semester: 1 | 2;
  updatedAt: string;
  /** คอลัมน์ = รายวิชาจากสมุดคะแนน */
  subjects: GradeAssessmentSubjectCol[];
  /** สรุปต่อระดับชั้น (รอง) */
  rows: GradeAssessmentRow[];
  /** แถวหลัก = ห้องเรียน */
  classRows: GradeAssessmentClassRow[];
  /** classId → รายชื่อ + เกรดต่อวิชา */
  studentsByClass: Record<string, GradeAssessmentStudentRow[]>;
  gradeLevels: string[];
  classes: GradeAssessmentClassOption[];
  overallAvgGpa: number | null;
  overallN: number;
}
