import type { Timestamp } from 'firebase/firestore';

export type CourseStatus = 'draft' | 'published' | 'archived';
export type AttachmentType = 'pdf' | 'doc' | 'ppt' | 'video' | 'other';

// ── Phase 1: Firestore Collection Schemas ──────────────────────────────────

/**
 * Collection: courses
 * Level 2 — includes academicYearId, departmentId for partitioning.
 */
export interface Course {
  id: string;
  title: string;
  description: string;
  thumbnailURL?: string;
  departmentId: string;
  academicYearId: string;
  classIds: string[];
  teacherId: string;
  teacherName: string;
  subjectCode?: string;
  subjectName?: string;
  status: CourseStatus;
  lessonCount: number;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface LessonAttachment {
  id: string;
  name: string;
  url: string;
  type: AttachmentType;
  sizeBytes?: number;
}

/**
 * Subcollection: courses/{courseId}/lessons
 * Ordered by `order` field. Grouped in UI by `week` or `topic`.
 */
export interface Lesson {
  id: string;
  courseId: string;
  title: string;
  description?: string;
  week?: number;
  topic?: string;
  order: number;
  videoURL?: string;
  videoDurationSec?: number;
  thumbnailURL?: string;
  isPublished: boolean;
  attachments: LessonAttachment[];
  hasAssignment: boolean;
  assignmentDescription?: string;
  assignmentDueDateStr?: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

/**
 * Collection: lesson_comments
 * Requires composite index: courseId ASC, lessonId ASC, createdAt ASC
 */
export interface LessonComment {
  id: string;
  lessonId: string;
  courseId: string;
  authorId: string;
  authorName: string;
  authorRole: string;
  content: string;
  parentId?: string | null;
  createdAt: Timestamp | null;
}

/**
 * Collection: lesson_submissions
 * One record per student per lesson. Later submissions overwrite via upsert.
 */
export interface LessonSubmission {
  id: string;
  lessonId: string;
  courseId: string;
  studentId: string;
  studentName: string;
  studentCode?: string;
  classId: string;
  fileURL: string;
  fileName: string;
  fileSizeBytes: number;
  submittedAt: Timestamp | null;
  grade?: number | null;
  feedback?: string | null;
  gradedBy?: string | null;
  gradedAt?: Timestamp | null;
}
