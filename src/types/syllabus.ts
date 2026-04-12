// ── Assessment Schema ─────────────────────────────────────────────────────────
// สัดส่วนคะแนนที่ต้องรวมกันได้ 100

export interface AssessmentSchema {
  classwork: number;   // คะแนนเก็บระหว่างเรียน (0–100)
  midterm:   number;   // สอบกลางภาค
  final:     number;   // สอบปลายภาค
}

export const DEFAULT_ASSESSMENT: AssessmentSchema = {
  classwork: 30,
  midterm:   30,
  final:     40,
};

// ── Weekly Plan ───────────────────────────────────────────────────────────────

export interface WeeklyPlan {
  week:             number;
  topic:            string;         // หัวข้อการเรียนรู้
  learningOutcomes: string[];       // ผลการเรียนรู้ที่คาดหวัง (bullet list)
  activities:       string[];       // กิจกรรมการเรียนรู้
  materials?:       string[];       // สื่อ/แหล่งเรียนรู้
  assessment?:      string;         // วิธีวัดผลสัปดาห์นั้น
  note?:            string;         // หมายเหตุ (เช่น "สัปดาห์สอบกลางภาค")
  isHoliday?:       boolean;        // สัปดาห์นี้มีวันหยุด (auto-detected)
  isExamWeek?:      boolean;        // สัปดาห์สอบ (auto-detected จาก calendar)
}

// ── Teaching Week Info ────────────────────────────────────────────────────────
// คำนวณจาก Academic Calendar — ตัดวันหยุดออก

export interface TeachingWeekInfo {
  totalCalendarWeeks:  number;  // สัปดาห์ทั้งหมดในภาคเรียน
  holidayWeeks:        number;  // สัปดาห์ที่มีวันหยุดนักขัตฤกษ์
  examWeeks:           number;  // สัปดาห์สอบ
  effectiveTeachingWeeks: number; // สัปดาห์สอนจริง
  totalHours:          number;  // คาบสอนทั้งหมดในภาคเรียน
  semesterStart?:      string;  // YYYY-MM-DD
  semesterEnd?:        string;
}

// ── Syllabus Status ───────────────────────────────────────────────────────────

export type SyllabusStatus = 'draft' | 'submitted' | 'approved';

export const SYLLABUS_STATUS_CONFIG: Record<SyllabusStatus, {
  label: string;
  color: string;
  bg: string;
}> = {
  draft:     { label: 'ร่าง',        color: '#6b7280', bg: 'rgba(107,114,128,0.10)' },
  submitted: { label: 'รอตรวจสอบ',  color: '#f59e0b', bg: 'rgba(245,158,11,0.10)' },
  approved:  { label: 'อนุมัติแล้ว', color: '#10b981', bg: 'rgba(16,185,129,0.10)' },
};

// ── Course Syllabus ───────────────────────────────────────────────────────────

export interface CourseSyllabus {
  id:           string;
  subjectId:    string;      // → Subject.id จาก curriculum
  teacherId:    string;      // → TeacherProfile.id
  academicYear: string;      // e.g. '2568'
  semester:     1 | 2;
  gradeLevel:   string;      // e.g. 'ม.3'

  // ── Snapshot (เก็บ ณ เวลา assign เพื่อ stability) ──────────────────────────
  subjectCode:  string;
  subjectName:  string;
  credits:      number;
  hoursPerWeek: number;
  teacherName:  string;
  department:   string;

  // ── Content ────────────────────────────────────────────────────────────────
  description:   string;     // คำอธิบายรายวิชา
  objectives:    string[];   // จุดประสงค์การเรียนรู้

  // ── Weekly Plan ────────────────────────────────────────────────────────────
  weeklyPlan:    WeeklyPlan[];

  // ── Assessment ─────────────────────────────────────────────────────────────
  assessment:    AssessmentSchema;

  // ── Meta ───────────────────────────────────────────────────────────────────
  status:        SyllabusStatus;
  createdAt:     string;
  updatedAt:     string;
}

export type NewSyllabus = Omit<CourseSyllabus, 'id' | 'createdAt' | 'updatedAt'>;
