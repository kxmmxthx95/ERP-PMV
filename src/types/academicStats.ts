/** Aggregated midterm (or final) academic KPIs for executive dashboard. */
export type AcademicExamType = 'midterm' | 'final';

export interface AcademicSubjectAvg {
  key: string;
  label: string;
  subjectName: string;
  gradeLevel: string;
  avgPct: number;
  n: number;
}

export interface AcademicGradeLevelAvg {
  gradeLevel: string;
  avgPct: number;
  n: number;
}

export interface AcademicScoreDistribution {
  /** T ≥ 60 */
  excellent: number;
  /** T 40–59 */
  average: number;
  /** T < 40 */
  needsImprovement: number;
}

export interface AcademicAtRiskClass {
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  gradeLevel: string;
  /** สาระหลัก (เช่น คณิตศาสตร์) */
  subjectGroup?: string;
  /** subject group id for badge color */
  subjectGroupId?: string;
  /** สาระย่อย */
  subSubjectGroup?: string;
  /** ครูผู้สอน */
  teacherName?: string;
  teacherPhotoURL?: string;
  /** ห้องสอบต้นทาง (สำหรับเปิดตารางคะแนน) */
  examRoomId?: string;
  /** สถานะห้องสอบ — active / upcoming / closed */
  roomStatus?: string;
  failRatePct: number;
  failCount: number;
  totalCount: number;
}

export interface AcademicStatsKpi {
  overallAveragePct: number;
  passRatePct: number;
  failRatePct: number;
  gradingProgressPct: number;
  roomsTotal: number;
  roomsGraded: number;
  studentScoreCount: number;
}

/** ห้องสอบกลางภาคที่ยังไม่เชื่อม/ยังไม่มีคะแนนส่ง */
export interface AcademicUnlinkedRoom {
  examRoomId: string;
  title: string;
  subjectName: string;
  className: string;
  gradeLevel: string;
  subjectGroup?: string;
  subjectGroupId?: string;
  subSubjectGroup?: string;
  teacherId?: string;
  teacherName?: string;
  teacherPhotoURL?: string;
}

/** ห้องสอบกลางภาคของครู + อัตราผ่าน */
export interface AcademicTeacherRoomPass {
  examRoomId: string;
  subjectName: string;
  className: string;
  gradeLevel: string;
  /** สาระหลัก */
  subjectGroup?: string;
  subjectGroupId?: string;
  /** สาระย่อย */
  subSubjectGroup?: string;
  passRatePct: number;
  passCount: number;
  totalCount: number;
  /** ยังมีข้ออัตนัย/คะแนนรอตรวจ — ยังไม่นำ % มาคิด */
  pendingGrading?: boolean;
}

/** อันดับ/รายชื่อครูที่เปิดข้อสอบกลางภาค + อัตราผ่าน (≥50%) */
export interface AcademicTeacherPassRank {
  rank: number;
  teacherId: string;
  teacherName: string;
  teacherPhotoURL: string;
  passRatePct: number;
  passCount: number;
  failCount: number;
  totalCount: number;
  avgPct: number;
  /** ห้องสอบของครู — ว่างถ้ายังไม่รีเฟรชสรุปหลังอัปเดต schema */
  rooms?: AcademicTeacherRoomPass[];
}

export interface AcademicStatsDoc {
  id: string;
  examType: AcademicExamType;
  academicYearId: string;
  semester: 1 | 2;
  updatedAt: number;
  kpi: AcademicStatsKpi;
  topSubjects: AcademicSubjectAvg[];
  bottomSubjects: AcademicSubjectAvg[];
  byGradeLevel: AcademicGradeLevelAvg[];
  distribution: AcademicScoreDistribution;
  atRiskClasses: AcademicAtRiskClass[];
  unlinkedRooms?: AcademicUnlinkedRoom[];
  teacherPassRanking?: AcademicTeacherPassRank[];
}

export function academicStatsDocId(
  examType: AcademicExamType,
  semester: 1 | 2,
  academicYearId: string,
): string {
  return `${examType}_${semester}_${academicYearId}`;
}

export function emptyAcademicStats(
  id: string,
  examType: AcademicExamType,
  academicYearId: string,
  semester: 1 | 2,
): AcademicStatsDoc {
  return {
    id,
    examType,
    academicYearId,
    semester,
    updatedAt: Date.now(),
    kpi: {
      overallAveragePct: 0,
      passRatePct: 0,
      failRatePct: 0,
      gradingProgressPct: 0,
      roomsTotal: 0,
      roomsGraded: 0,
      studentScoreCount: 0,
    },
    topSubjects: [],
    bottomSubjects: [],
    byGradeLevel: [],
    distribution: { excellent: 0, average: 0, needsImprovement: 0 },
    atRiskClasses: [],
    unlinkedRooms: [],
    teacherPassRanking: [],
  };
}
