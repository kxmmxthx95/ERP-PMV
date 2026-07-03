// src/types/questionBank.ts
import type { SubjectGroupId } from './curriculum';

export type QuestionType = 'multiple_choice' | 'essay';
export type QuestionDifficulty = 'easy' | 'medium' | 'hard';

export interface MultipleChoiceOption {
  id: string;
  text: string;
  isCorrect: boolean;
  imageUrl?: string;
}

export interface MultipleChoicePayload {
  options: MultipleChoiceOption[];
}

export interface EssayPayload {
  rubric: string;
  maxScore: number;
  /** เฉลยข้อสั้น (PDF exam) — ใช้ตรวจคำตอบอัตโนมัติ */
  expectedAnswer?: string;
}

export type QuestionPayload = MultipleChoicePayload | EssayPayload;

// ── Question (stored in question_sets/{setId}/questions/{qId}) ────────────────

export interface Question {
  id: string;
  setId: string;               // parent set — ใช้ navigate subcollection
  orderIndex: number;          // ลำดับข้อในชุด
  subjectGroup?: SubjectGroupId;
  subSubjectGroup?: string;
  subjectName?: string;
  curriculumYear: string;
  indicator?: string;
  difficulty: QuestionDifficulty;
  type: QuestionType;
  department?: string;
  gradeLevel?: string;
  questionText: string;        // HTML content
  images: string[];
  payload: QuestionPayload;
  createdBy: string;
  createdByName?: string;
  createdAt: number;
  updatedAt: number;
}

export type NewQuestion = Omit<
  Question,
  'id' | 'setId' | 'orderIndex' | 'createdAt' | 'updatedAt'
> & {
  orderIndex?: number;
};

// ── QuestionSet (stored in question_sets/{setId}) ─────────────────────────────
// ไม่เก็บ questionIds array — ใช้ subcollection แทน เพื่อรองรับชุดขนาดใหญ่
// questionCount update โดย CRUD operations ใน useSetQuestions

export type QuestionSetKind = 'exam' | 'exercise';

export interface QuestionSet {
  id: string;
  setCode?: string;           // รหัสชุดข้อสอบ auto-gen เช่น 69P04MAMB001
  /** exam = คลังข้อสอบ (default) · exercise = แบบฝึกหัดใน Grade Book */
  setKind?: QuestionSetKind;
  title: string;
  description?: string;
  coverImage?: string;
  subjectGroup: SubjectGroupId;
  subSubjectGroup?: string;
  curriculumYear: string;
  department?: string;
  gradeLevel?: string;
  /** บริบท Grade Book — ใช้เมื่อ setKind === 'exercise' */
  academicYearId?: string;
  semester?: 1 | 2;
  departmentId?: string;
  classId?: string;
  className?: string;
  subjectId?: string;
  subjectName?: string;
  questionType?: QuestionType;  // ประเภทข้อสอบหลักของชุดนี้ (optional)
  questionCount: number;        // denormalized counter — อัปเดตทุกครั้ง add/remove
  isPublished: boolean;
  /** ชุดข้อสอบจากไฟล์ PDF — นักเรียนดู PDF แล้วกรอกคำตอบ */
  examPdfUrl?: string;
  examPdfFileName?: string;
  pdfOptionCount?: 4 | 5 | 6;
  /** หมายเลขหน้า PDF (1-based) ที่ซ่อนในห้องสอบออนไลน์ — ครูยังดู preview ได้ครบ */
  examPdfHiddenPages?: number[];
  createdBy: string;
  createdByName?: string;
  createdAt: number;
  updatedAt: number;
}

export type NewQuestionSet = Omit<
  QuestionSet,
  'id' | 'createdAt' | 'updatedAt' | 'questionCount' | 'isPublished'
> & {
  questionCount?: number;
  isPublished?: boolean;
};

// ── Display config ────────────────────────────────────────────────────────────

export const DIFFICULTY_CONFIG: Record<QuestionDifficulty, {
  label: string;
  color: string;
  bg: string;
  border: string;
}> = {
  easy:   { label: 'ง่าย',     color: '#10b981', bg: 'rgba(16,185,129,0.10)', border: 'rgba(16,185,129,0.25)' },
  medium: { label: 'ปานกลาง',  color: '#f59e0b', bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.25)' },
  hard:   { label: 'ยาก',      color: '#ef4444', bg: 'rgba(239,68,68,0.10)',  border: 'rgba(239,68,68,0.25)' },
};

export const TYPE_CONFIG: Record<QuestionType, {
  label: string;
  shortLabel: string;
  color: string;
  bg: string;
}> = {
  multiple_choice: { label: 'ปรนัย (เลือกตอบ)', shortLabel: 'ปรนัย', color: '#2563eb', bg: 'rgba(37,99,235,0.10)' },
  essay:           { label: 'อัตนัย (เขียนตอบ)', shortLabel: 'อัตนัย', color: '#2563eb', bg: 'rgba(37,99,235,0.10)' },
};

// Type guards
export const isMultipleChoice = (q: Question): q is Question & { payload: MultipleChoicePayload } =>
  q.type === 'multiple_choice';

export const isEssay = (q: Question): q is Question & { payload: EssayPayload } =>
  q.type === 'essay';
