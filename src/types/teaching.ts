import type { Timestamp } from 'firebase/firestore';
import type { Department } from '@/types/curriculum';

// ── Attendance ─────────────────────────────────────────────────────────────────

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused' | 'leave';

export interface AttendanceRecord {
  id: string;
  studentId: string;
  studentName: string;        // snapshot
  studentCode: string;        // snapshot
  subjectId: string;
  subjectName: string;        // snapshot
  classId: string;
  className: string;          // snapshot
  teacherId: string;
  departmentId: Department;
  academicYearId: string;
  semester: 1 | 2;
  date: string;               // "YYYY-MM-DD"
  period: number;
  status: AttendanceStatus;
  note?: string;
  recordedAt: string;         // ISO timestamp
}

export type NewAttendanceRecord = Omit<AttendanceRecord, 'id' | 'recordedAt'>;

export interface AttendanceSession {
  date: string;               // "YYYY-MM-DD"
  period: number;
  subjectId: string;
  classId: string;
  records: AttendanceRecord[];
}

// Per-student entry inside a ClassSession
export interface StudentAttendance {
  studentId: string;
  status: AttendanceStatus;
  note?: string;
}

export interface AttendanceSummary {
  present: number;
  late: number;
  absent: number;
  leave: number;
}

// ClassSession — one teaching session (one period) with embedded attendance
export interface ClassSession {
  id?: string;
  scheduleId: string;
  subjectId: string;           // ref → subjects
  subjectName: string;         // snapshot
  subjectCode: string;         // snapshot
  classId: string;             // ref → classes
  className: string;           // snapshot
  roomId?: string;
  teacherId: string;           // ref → users
  teacherName: string;         // snapshot
  departmentId: Department;    // ← partition
  academicYearId: string;      // ← partition
  semester: 1 | 2;
  date: string;                // "YYYY-MM-DD"
  period: number;
  topic: string;
  summary: AttendanceSummary;
  attendance: StudentAttendance[];
  presentStudentIds?: string[];
  absentStudentIds?: string[];
  lateStudentIds?: string[];
  excusedStudentIds?: string[];
  leaveStudentIds?: string[];
  totalStudents?: number;
  /** true = สร้างจาก sync ใบลาอนุมัติเท่านั้น (มีแค่ 1 นักเรียน) ยังไม่ใช่ครูเช็คชื่อจริง — ดู syncStudentLeaveAttendance.ts */
  leaveSyncOnly?: boolean;
  createdAt: Timestamp | string;
  updatedAt: Timestamp | string;
}

export type NewClassSession = Omit<ClassSession, 'id' | 'createdAt' | 'updatedAt'>;

// ── Assignment ─────────────────────────────────────────────────────────────────

export type AssignmentType = 'homework' | 'project' | 'quiz' | 'classwork';

export type AssignmentStatus = 'active' | 'closed';

export interface Assignment {
  id: string;
  title: string;
  description?: string;
  type: AssignmentType;
  subjectId: string;
  subjectName: string;        // snapshot
  classId: string;
  className: string;          // snapshot
  teacherId: string;
  departmentId: Department;
  academicYearId: string;
  semester: 1 | 2;
  maxScore: number;           // คะแนนเต็ม
  dueDate: string;            // "YYYY-MM-DD"
  status: AssignmentStatus;
  createdAt: string;
}

export type NewAssignment = Omit<Assignment, 'id' | 'createdAt'>;

export interface AssignmentSubmission {
  id: string;
  assignmentId: string;
  studentId: string;
  studentName: string;        // snapshot
  studentCode: string;        // snapshot
  photoURL?: string;          // snapshot
  gender?: 'male' | 'female'; // snapshot
  score?: number;             // undefined = ยังไม่ได้ให้คะแนน
  submittedAt?: string;
  gradedAt?: string;
  note?: string;
}

export type NewAssignmentSubmission = Omit<AssignmentSubmission, 'id' | 'gradedAt'>;

// ── Exam ───────────────────────────────────────────────────────────────────────

export type ExamType = 'midterm' | 'final' | 'quiz' | 'makeup';

export type ExamStatus = 'scheduled' | 'completed' | 'cancelled';

export interface Exam {
  id: string;
  title: string;
  type: ExamType;
  subjectId: string;
  subjectName: string;        // snapshot
  classId: string;
  className: string;          // snapshot
  teacherId: string;
  departmentId: Department;
  academicYearId: string;
  semester: 1 | 2;
  examDate: string;           // "YYYY-MM-DD"
  startTime: string;          // "HH:mm"
  endTime: string;            // "HH:mm"
  room?: string;
  maxScore: number;
  status: ExamStatus;
  createdAt: string;
}

export type NewExam = Omit<Exam, 'id' | 'createdAt'>;

export interface ExamScore {
  id: string;
  examId: string;
  studentId: string;
  studentName: string;        // snapshot
  studentCode: string;        // snapshot
  photoURL?: string;          // snapshot
  gender?: 'male' | 'female'; // snapshot
  score?: number;
  absent: boolean;
  note?: string;
  gradedAt?: string;
}

export type NewExamScore = Omit<ExamScore, 'id' | 'gradedAt'>;
