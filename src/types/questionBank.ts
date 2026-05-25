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

export interface QuestionSet {
  id: string;
  title: string;
  description?: string;
  coverImage?: string;
  subjectGroup: SubjectGroupId;
  subSubjectGroup?: string;
  curriculumYear: string;
  department?: string;
  gradeLevel?: string;
  questionType?: QuestionType;  // ประเภทข้อสอบหลักของชุดนี้ (optional)
  questionCount: number;        // denormalized counter — อัปเดตทุกครั้ง add/remove
  isPublished: boolean;
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
  multiple_choice: { label: 'ปรนัย (เลือกตอบ)', shortLabel: 'ปรนัย', color: '#6366f1', bg: 'rgba(99,102,241,0.10)' },
  essay:           { label: 'อัตนัย (เขียนตอบ)', shortLabel: 'อัตนัย', color: '#8b5cf6', bg: 'rgba(139,92,246,0.10)' },
};

// Type guards
export const isMultipleChoice = (q: Question): q is Question & { payload: MultipleChoicePayload } =>
  q.type === 'multiple_choice';

export const isEssay = (q: Question): q is Question & { payload: EssayPayload } =>
  q.type === 'essay';
