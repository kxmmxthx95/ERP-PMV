// src/types/exam.ts

export type ExamRoomStatus = 'upcoming' | 'active' | 'closed';
export type AttemptStatus = 'in_progress' | 'submitted' | 'graded';

export interface ExamQuestion {
  id: string;
  order: number;
  text: string;
  options: { id: string; text: string }[];
  correctOptionId: string; // NEVER sent to client — server-side only
  points: number;
}

export interface ExamPaper {
  id: string;
  title: string;
  description?: string;
  questions: ExamQuestion[];
  totalPoints: number;
  createdBy: string; // ref → users
  createdAt: number;
}

export type GradeScoreType = 'midterm' | 'final' | 'classwork';
export type ScoreCollectionType = 'classwork' | 'quiz' | 'midterm' | 'final';
export interface GradeBookSubjectLink {
  subjectId: string;
  subjectName: string;
  subjectCode?: string;
}

export interface ExamRoomSettings {
  shuffleQuestions: boolean;
  showResultImmediately: boolean;
  allowReview: boolean;
  maxAttempts: number; // 1 = สอบได้ 1 ครั้ง, 0 = ไม่จำกัด
  // การผูกคะแนนกับสมุดบันทึกคะแนน
  gradeBookSubjectId?: string;   // subjectId ที่จะส่งคะแนนไป
  gradeBookSubjectName?: string; // snapshot
  gradeBookSubjectCode?: string; // snapshot
  gradeBookSubjects?: GradeBookSubjectLink[]; // รองรับหลายวิชา (แนะนำสูงสุด 3 วิชา)
  gradeBookScoreType?: GradeScoreType; // ส่งเป็นคะแนนประเภทไหน
  // การตั้งค่าการเก็บคะแนน
  scoreCollectionEnabled?: boolean;      // เปิด/ปิด การนำคะแนนไปใช้ใน grade book
  scoreCollectionType?: ScoreCollectionType; // ประเภทการเก็บคะแนน
  scoreCollectionMaxScore?: number;      // คะแนนเต็ม
}

export interface ExamRoom {
  id: string;
  title: string;
  examPaperId: string;
  subjectId?: string;
  subjectName?: string;
  classId?: string;
  className?: string;
  teacherId: string;
  teacherName: string;
  academicYearId: string;
  departmentId: string;
  gradeLevel?: string;
  subjectGroupId?: string;
  semester: 1 | 2;
  startTime: number; // timestamp ms
  endTime: number;
  durationMinutes: number;
  password: string;
  status: ExamRoomStatus;
  settings: ExamRoomSettings;
  currentRound: number;    // รอบปัจจุบัน (1-based), 0 = ยังไม่เคยเปิด
  completedRounds: number; // รอบที่ปิดไปแล้ว
  // Snapshot
  questionCount: number;
  totalPoints: number;
  createdAt: number;
  // Question bank linkage (single round / legacy)
  questionSetId?: string;         // ref → question_sets
  selectedQuestionIds?: string[]; // selected question IDs from the set
  // Per-round question configuration (key = "1" | "2" | ... | "∞")
  // Each round can draw from a different set and different question IDs.
  roundQuestions?: Record<string, {
    questionSetId: string;
    questionIds: string[];
    // Cart-mode support: map each selected question to its source set
    // so we can restore question content across multiple sets after reload.
    questionSetByQuestionId?: Record<string, string>;
    totalPoints: number;
  }>;
}

export interface ExamAttempt {
  id: string;
  studentId: string;
  studentName: string;
  roomId: string;
  round: number; // รอบที่ 1, 2, 3, ...
  status: AttemptStatus;
  answers: Record<string, string>; // questionId → selectedOptionId
  suspiciousActivities: number; // tab switch count
  score: number | null; // null until graded
  startedAt: number;
  submittedAt: number | null;
  lastSavedAt: number;
}

// Client-safe question (no correctOptionId)
export type ExamQuestionPublic = Omit<ExamQuestion, 'correctOptionId'>;
