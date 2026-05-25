// ── Material ───────────────────────────────────────────────────────────────────

export type MaterialType = 'pdf' | 'link' | 'image' | 'video' | 'other';

export interface LessonMaterial {
  type: MaterialType;
  name: string;
  url: string;
}

// ── Lesson Plan Status ─────────────────────────────────────────────────────────

export type LessonPlanStatus = 'draft' | 'submitted' | 'approved';

export const LESSON_PLAN_STATUS_CONFIG: Record<LessonPlanStatus, {
  label: string;
  color: string;
  bg: string;
}> = {
  draft:     { label: 'ร่าง',        color: '#6b7280', bg: 'rgba(107,114,128,0.10)' },
  submitted: { label: 'รอตรวจสอบ',  color: '#f59e0b', bg: 'rgba(245,158,11,0.10)' },
  approved:  { label: 'อนุมัติแล้ว', color: '#10b981', bg: 'rgba(16,185,129,0.10)' },
};

// ── Lesson Plan ────────────────────────────────────────────────────────────────
// แผนการจัดการเรียนรู้รายสัปดาห์ — แยกออกจาก CourseSyllabus (รายวิชา)
// เพื่อให้สามารถนำแผนเดิมไปใช้ซ้ำกับห้องอื่นหรือปีการศึกษาอื่นได้

export interface LessonPlan {
  id: string;

  // ── Partition fields ─────────────────────────────────────────────────────────
  academicYearId: string;     // "2569"
  semester:       1 | 2;
  departmentId:   string;     // "secondary"

  // ── References ──────────────────────────────────────────────────────────────
  courseId:       string;     // ref → subjects (subject code e.g. "ว31201")
  teacherId:      string;     // ref → users

  // ── Snapshots ───────────────────────────────────────────────────────────────
  courseName:     string;     // e.g. "ฟิสิกส์"
  teacherName:    string;
  gradeLevel:     string;     // e.g. "ม.4"

  // ── Content ─────────────────────────────────────────────────────────────────
  title:            string;   // หัวข้อแผนการสอน
  weekNumber:       number;   // สัปดาห์ที่ในภาคเรียน
  objectives:       string[]; // จุดประสงค์การเรียนรู้
  activities:       string;   // กิจกรรมการสอน (freeform text)
  evaluationMethod: string;   // วิธีวัดผลประเมินผล
  materials:        LessonMaterial[];

  // ── Links to schedule sessions ───────────────────────────────────────────────
  linkedSessionIds: string[]; // ref → schedules (คาบที่ใช้แผนนี้)

  // ── Status & Meta ────────────────────────────────────────────────────────────
  status:    LessonPlanStatus;
  createdAt: string;          // ISO timestamp
  updatedAt: string;
}

export type NewLessonPlan = Omit<LessonPlan, 'id' | 'createdAt' | 'updatedAt'>;
