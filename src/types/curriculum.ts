// ── Department & Grade Level ──────────────────────────────────────────────────

export type Department = 'early' | 'primary' | 'secondary';

export const DEPARTMENT_CONFIG: Record<Department, {
  label: string;
  color: string;
  bg: string;
  border: string;
  grades: string[];
}> = {
  early: {
    label: 'ปฐมวัย',
    color: '#ec4899',
    bg: 'rgba(236,72,153,0.08)',
    border: 'rgba(236,72,153,0.20)',
    grades: ['อ.1', 'อ.2', 'อ.3'],
  },
  primary: {
    label: 'ประถมศึกษา',
    color: '#3b82f6',
    bg: 'rgba(59,130,246,0.08)',
    border: 'rgba(59,130,246,0.20)',
    grades: ['ป.1', 'ป.2', 'ป.3', 'ป.4', 'ป.5', 'ป.6'],
  },
  secondary: {
    label: 'มัธยมศึกษา',
    color: '#8b5cf6',
    bg: 'rgba(139,92,246,0.08)',
    border: 'rgba(139,92,246,0.20)',
    grades: ['ม.1', 'ม.2', 'ม.3', 'ม.4', 'ม.5', 'ม.6'],
  },
};

// ── Subject Category ──────────────────────────────────────────────────────────

export type SubjectCategory = 'core' | 'added' | 'elective' | 'activity';

export const CATEGORY_CONFIG: Record<SubjectCategory, { label: string; color: string; bg: string; border: string }> = {
  core: { label: 'วิชาพื้นฐาน', color: '#0ea5e9', bg: 'rgba(14,165,233,0.10)', border: 'rgba(14,165,233,0.20)' },
  added: { label: 'วิชาเพิ่มเติม', color: '#f97316', bg: 'rgba(249,115,22,0.10)', border: 'rgba(249,115,22,0.20)' },
  elective: { label: 'วิชาเลือก', color: '#8b5cf6', bg: 'rgba(139,92,246,0.10)', border: 'rgba(139,92,246,0.20)' },
  activity: { label: 'กิจกรรม', color: '#10b981', bg: 'rgba(16,185,129,0.10)', border: 'rgba(16,185,129,0.20)' },
};

// ── Subject ───────────────────────────────────────────────────────────────────

export interface Subject {
  id: string;
  code: string;           // รหัสวิชา e.g. 'ท11101'
  codeEn?: string;        // รหัสภาษาอังกฤษ
  name: string;           // ชื่อวิชา e.g. 'ภาษาไทย'
  nameEn?: string;        // ชื่อภาษาอังกฤษ
  credits: number;        // หน่วยกิต
  hoursPerWeek: number;   // ชั่วโมงต่อสัปดาห์
  totalHours: number;     // ชั่วโมงเต็ม
  department: Department;
  gradeLevel?: string;    // ระดับชั้นที่ระบุ (ไม่บังคับ)
  subjectGroup?: string;  // กลุ่มสาระ
  category: SubjectCategory;
  description?: string;
}

// ── Curriculum Map ────────────────────────────────────────────────────────────

export interface CurriculumMap {
  id: string;
  name: string;
  academicYear: string;
  description?: string;
  sections: {
    [deptId: string]: {
      [grade: string]: {
        semester1: string[]; // รายชื่อ ID วิชาเทอม 1
        semester2: string[]; // รายชื่อ ID วิชาเทอม 2
      }
    }
  };
}

// ── Subject Group (กลุ่มสาระการเรียนรู้) ──────────────────────────────────────

export type SubjectGroupId =
  | 'thai'
  | 'math'
  | 'science'
  | 'social'
  | 'pe'
  | 'arts'
  | 'careers'
  | 'foreign'
  | 'examM4'
  | 'onet'
  | 'alevel'
  | 'other';

export interface SubjectGroup {
  id: string;
  groupKey: SubjectGroupId;
  name: string;           // ชื่อกลุ่มสาระ e.g. 'ภาษาไทย'
  nameEn: string;
  color: string;
  bg: string;
  border: string;
  subjectIds: string[];   // ref → subjects
  order: number;          // ลำดับการแสดงผล
}

export const SUBJECT_GROUP_CONFIG: Record<SubjectGroupId, {
  name: string;
  nameEn: string;
  color: string;
  bg: string;
  border: string;
  order: number;
}> = {
  thai: { name: 'ภาษาไทย', nameEn: 'Thai Language', color: '#f43f5e', bg: 'rgba(244,63,94,0.08)', border: 'rgba(244,63,94,0.20)', order: 1 },
  math: { name: 'คณิตศาสตร์', nameEn: 'Mathematics', color: '#3b82f6', bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.20)', order: 2 },
  science: { name: 'วิทยาศาสตร์และเทคโนโลยี', nameEn: 'Science & Technology', color: '#10b981', bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.20)', order: 3 },
  social: { name: 'สังคมศึกษา ศาสนา และวัฒนธรรม', nameEn: 'Social Studies', color: '#f97316', bg: 'rgba(249,115,22,0.08)', border: 'rgba(249,115,22,0.20)', order: 4 },
  pe: { name: 'สุขศึกษาและพลศึกษา', nameEn: 'Health & Physical Ed.', color: '#ef4444', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.20)', order: 5 },
  arts: { name: 'ศิลปะ', nameEn: 'Arts', color: '#a855f7', bg: 'rgba(168,85,247,0.08)', border: 'rgba(168,85,247,0.20)', order: 6 },
  careers: { name: 'การงานอาชีพ', nameEn: 'Careers & Technology', color: '#78716c', bg: 'rgba(120,113,108,0.08)', border: 'rgba(120,113,108,0.20)', order: 7 },
  foreign: { name: 'ภาษาต่างประเทศ', nameEn: 'Foreign Languages', color: '#0ea5e9', bg: 'rgba(14,165,233,0.08)', border: 'rgba(14,165,233,0.20)', order: 8 },
  examM4: { name: 'สอบเข้า ม.4', nameEn: 'Grade 10 Admission', color: '#6366f1', bg: 'rgba(99,102,241,0.08)', border: 'rgba(99,102,241,0.20)', order: 9 },
  onet: { name: 'O-NET', nameEn: 'O-NET', color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.20)', order: 10 },
  alevel: { name: 'A-LEVEL', nameEn: 'A-LEVEL', color: '#10b981', bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.20)', order: 11 },
  other: { name: 'อื่นๆ / กิจกรรม', nameEn: 'Other / Activities', color: '#6b7280', bg: 'rgba(107,114,128,0.08)', border: 'rgba(107,114,128,0.20)', order: 12 },
};

export const SUBJECT_SUBGROUP_CONFIG: Partial<Record<SubjectGroupId, string[]>> = {
  science: ['วิทยาศาสตร์ทั่วไป', 'ฟิสิกส์', 'เคมี', 'ชีววิทยา', 'โลก ดาราศาสตร์ และอวกาศ'],
  math: ['คณิตศาสตร์พื้นฐาน', 'คณิตศาสตร์เพิ่มเติม'],
  foreign: ['ภาษาอังกฤษ', 'ภาษาจีน', 'ภาษาญี่ปุ่น', 'ภาษาฝรั่งเศส'],
  social: ['ศาสนา ศีลธรรม จริยธรรม', 'หน้าที่พลเมือง', 'เศรษฐศาสตร์', 'ประวัติศาสตร์', 'ภูมิศาสตร์'],
};

// ── Credit Summary ────────────────────────────────────────────────────────────

export interface CreditSummary {
  core: number;
  added: number;
  elective: number;
  activity: number;
  total: number;
}

// ── Versioned Curriculum (New Architecture) ───────────────────────────────────

export type CourseCategory = 'basic' | 'additional' | 'activity';

export type CurriculumTrack =
  | 'sci-math'
  | 'arts-math'
  | 'arts-lang'
  | 'general'
  | 'vocational'
  | 'other';

export const CURRICULUM_TRACK_CONFIG: Record<CurriculumTrack, { label: string; color: string; bg: string; border: string }> = {
  'sci-math':   { label: 'วิทย์-คณิต',   color: '#10b981', bg: 'rgba(16,185,129,0.10)',  border: 'rgba(16,185,129,0.20)' },
  'arts-math':  { label: 'ศิลป์-คณิต',   color: '#3b82f6', bg: 'rgba(59,130,246,0.10)',  border: 'rgba(59,130,246,0.20)' },
  'arts-lang':  { label: 'ศิลป์-ภาษา',   color: '#a855f7', bg: 'rgba(168,85,247,0.10)',  border: 'rgba(168,85,247,0.20)' },
  'general':    { label: 'ทั่วไป',         color: '#6b7280', bg: 'rgba(107,114,128,0.10)', border: 'rgba(107,114,128,0.20)' },
  'vocational': { label: 'อาชีวศึกษา',    color: '#f97316', bg: 'rgba(249,115,22,0.10)',  border: 'rgba(249,115,22,0.20)' },
  'other':      { label: 'อื่นๆ',          color: '#94a3b8', bg: 'rgba(148,163,184,0.10)', border: 'rgba(148,163,184,0.20)' },
};

export const COURSE_CATEGORY_CONFIG: Record<CourseCategory, {
  label: string;
  color: string;
  bg: string;
  border: string;
}> = {
  basic:      { label: 'วิชาพื้นฐาน',  color: '#0ea5e9', bg: 'rgba(14,165,233,0.10)',  border: 'rgba(14,165,233,0.20)'  },
  additional: { label: 'วิชาเพิ่มเติม', color: '#f97316', bg: 'rgba(249,115,22,0.10)',  border: 'rgba(249,115,22,0.20)'  },
  activity:   { label: 'กิจกรรม',       color: '#10b981', bg: 'rgba(16,185,129,0.10)',  border: 'rgba(16,185,129,0.20)'  },
};

export interface CurriculumCourse {
  id: string;
  courseCode: string;
  courseName: string;
  credit: number;
  periodsPerWeek?: number; // จำนวน/สัปดาห์
  totalHours?: number;     // ชั่วโมงเต็ม
  category: CourseCategory;
  department: string;
  subjectGroup?: string;
  gradeLevel?: string;
  semester?: number;       // ภาคเรียนที่ 1 หรือ 2
  academicYear?: number;   // ปีการศึกษา e.g. 2568
  isRetired?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CurriculumVersion {
  id: string;
  year?: number;
  name: string;
  allowEdit: boolean;
  assignedGrades: string[];   // ชั้นเรียนที่ใช้หลักสูตรนี้ e.g. ['ม.1','ม.2']
  track?: CurriculumTrack;    // สายการเรียน e.g. 'sci-math'
  level?: string;             // ระดับชั้น e.g. 'ม.4', 'ป.1-6', 'มัธยมศึกษา'
  department?: string;        // 'early' | 'primary' | 'secondary'
  createdAt?: string;
  description?: string;
  isDeleted?: boolean;        // soft delete flag
  deletedAt?: string;         // timestamp when soft deleted
}

export type NewCurriculumCourse = Omit<CurriculumCourse, 'id'>;
