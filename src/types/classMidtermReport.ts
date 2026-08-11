import type { AcademicExamType } from '@/types/academicStats';

/** Column = one midterm exam room for the class (label = สาระย่อย). */
export interface ClassMidtermReportColumn {
  key: string;
  label: string;
  subjectId: string;
  subjectName: string;
  subjectGroupId?: string;
  subjectGroup?: string;
  subSubjectGroup?: string;
}

export interface ClassMidtermReportStudent {
  studentId: string;
  studentCode: string;
  fullName: string;
  photoURL?: string;
  /** examRoomId → % 0–100; missing / null = ไม่มีคะแนน */
  scores: Record<string, number | null>;
}

/** Aggregated midterm score matrix — 1 class = 1 doc = 1 read. */
export interface ClassMidtermReportDoc {
  id: string;
  academicYearId: string;
  semester: 1 | 2;
  examType: AcademicExamType;
  classId: string;
  className: string;
  gradeLevel: string;
  updatedAt: number;
  columns: ClassMidtermReportColumn[];
  students: ClassMidtermReportStudent[];
}

export function classMidtermReportDocId(
  examType: AcademicExamType,
  semester: 1 | 2,
  academicYearId: string,
  classId: string,
): string {
  return `${examType}_${semester}_${academicYearId}_${classId}`;
}

export function emptyClassMidtermReport(
  id: string,
  examType: AcademicExamType,
  academicYearId: string,
  semester: 1 | 2,
  classId: string,
  className = '',
  gradeLevel = '—',
): ClassMidtermReportDoc {
  return {
    id,
    academicYearId,
    semester,
    examType,
    classId,
    className,
    gradeLevel,
    updatedAt: Date.now(),
    columns: [],
    students: [],
  };
}
