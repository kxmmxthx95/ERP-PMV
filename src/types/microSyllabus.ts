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
  /** ผลสะท้อนหลังการสอน */
  teachingReflection?: TeachingReflection | null;
  completedAt: string | null;
}

export type TeachingPlanStatus = 'on_plan' | 'off_plan';

export type TeachingOverview = 'good' | 'medium' | 'review';

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
