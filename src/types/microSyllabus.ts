export interface WeeklyTopic {
  weekNumber: number;
  /** วันที่สอนตามปฏิทิน (YYYY-MM-DD) */
  date?: string;
  /** บทเรียน */
  lesson?: string;
  /** หัวข้อการสอน */
  title: string;
  /** รายละเอียดเพิ่มเติม */
  details?: string;
  /** วันสอบย่อยเก็บคะแนน */
  isQuizDay?: boolean;
  /** ปิดการสอน — ไม่มีการสอนในวันที่ทับกับปฏิทินการศึกษา */
  isTeachingClosed?: boolean;
  /** ไม่มีการสอนในวันนี้ — ไม่นับการเช็คชื่อและ KPI ของครู */
  isNoTeaching?: boolean;
  /** ผลสะท้อนหลังการสอน */
  teachingReflection?: TeachingReflection | null;
  completedAt: string | null;
}

export type TeachingPlanStatus = 'on_plan' | 'off_plan';

/** คะแนนประเมินการสอนตัวเอง 1–5 ดาว (legacy: good/medium/review) */
export type TeachingOverview = 1 | 2 | 3 | 4 | 5;
export type TeachingOverviewLegacy = 'good' | 'medium' | 'review';

export function normalizeTeachingOverview(value: unknown): TeachingOverview {
  if (typeof value === 'number' && value >= 1 && value <= 5) return Math.round(value) as TeachingOverview;
  if (value === 'good') return 5;
  if (value === 'medium') return 3;
  if (value === 'review') return 1;
  return 3;
}

export interface TeachingReflectionStudent {
  id: string;
  name: string;
  code?: string;
}

export interface TeachingReflection {
  planStatus: TeachingPlanStatus;
  overview: TeachingOverview;
  problemStudents?: TeachingReflectionStudent[];
  additionalRequest?: string;
  recordedAt?: string;
}

export interface MicroSyllabus {
  id: string;
  academicYearId: string;
  semester: 1 | 2;
  departmentId: string;
  teacherId: string;
  teacherName: string;
  subjectId?: string;
  subjectName: string;
  classId?: string;
  className: string;
  gradeLevel: string;
  totalWeeks: number;
  /** รายการบทเรียนสำหรับเลือกในแผนการสอน */
  lessonOptions?: string[];
  topics: WeeklyTopic[];
  createdAt: string;
  updatedAt: string;
}

export type NewMicroSyllabus = Omit<MicroSyllabus, 'id' | 'createdAt' | 'updatedAt'>;
