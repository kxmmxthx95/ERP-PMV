export type FeedbackMode = 'identified' | 'anonymous';
export type FeedbackCategory = 'academic' | 'facilities' | 'cafeteria' | 'general';
export type FeedbackStatus = 'new' | 'in_progress' | 'resolved';

export interface StudentFeedback {
  id: string;
  mode: FeedbackMode;
  category: FeedbackCategory;
  message: string;
  status: FeedbackStatus;
  gradeLevel: string;
  department?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
  studentId?: string | null;
  studentName?: string | null;
  adminNote?: string | null;
}

export interface CreateFeedbackInput {
  mode: FeedbackMode;
  category: FeedbackCategory;
  message: string;
  gradeLevel: string;
  department?: string;
  studentName?: string | null;
}
