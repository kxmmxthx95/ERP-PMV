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
  | 'health_pe'
  | 'arts'
  | 'careers'
  | 'foreign_lang'
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
  thai: { name: 'ภาษาไทย', nameEn: 'Thai Language', color: '#ef4444', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.20)', order: 1 },
  math: { name: 'คณิตศาสตร์', nameEn: 'Mathematics', color: '#3b82f6', bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.20)', order: 2 },
  science: { name: 'วิทยาศาสตร์และเทคโนโลยี', nameEn: 'Science & Technology', color: '#10b981', bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.20)', order: 3 },
  social: { name: 'สังคมศึกษา ศาสนา และวัฒนธรรม', nameEn: 'Social Studies', color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.20)', order: 4 },
  health_pe: { name: 'สุขศึกษาและพลศึกษา', nameEn: 'Health & Physical Ed.', color: '#84cc16', bg: 'rgba(132,204,22,0.08)', border: 'rgba(132,204,22,0.20)', order: 5 },
  arts: { name: 'ศิลปะ', nameEn: 'Arts', color: '#ec4899', bg: 'rgba(236,72,153,0.08)', border: 'rgba(236,72,153,0.20)', order: 6 },
  careers: { name: 'การงานอาชีพ', nameEn: 'Careers & Technology', color: '#f97316', bg: 'rgba(249,115,22,0.08)', border: 'rgba(249,115,22,0.20)', order: 7 },
  foreign_lang: { name: 'ภาษาต่างประเทศ', nameEn: 'Foreign Languages', color: '#8b5cf6', bg: 'rgba(139,92,246,0.08)', border: 'rgba(139,92,246,0.20)', order: 8 },
  other: { name: 'อื่นๆ / กิจกรรม', nameEn: 'Other / Activities', color: '#6b7280', bg: 'rgba(107,114,128,0.08)', border: 'rgba(107,114,128,0.20)', order: 9 },
};

// ── Credit Summary ────────────────────────────────────────────────────────────

export interface CreditSummary {
  core: number;
  added: number;
  elective: number;
  activity: number;
  total: number;
}
