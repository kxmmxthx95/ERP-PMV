export const CLASSROOM_BEHAVIOR_CRITERIA = [
  { key: 'responsibility', label: 'ความรับผิดชอบต่องาน' },
  { key: 'participation', label: 'การมีส่วนร่วมในชั้น' },
  { key: 'effort', label: 'การแก้ไขและความพยายาม' },
] as const;

export type ClassroomBehaviorCriterionKey = (typeof CLASSROOM_BEHAVIOR_CRITERIA)[number]['key'];
export type ClassroomBehaviorScore = 1 | 2 | 3;
export type ClassroomBehaviorScores = Record<ClassroomBehaviorCriterionKey, ClassroomBehaviorScore>;

export const CLASSROOM_BEHAVIOR_LEVEL: Record<ClassroomBehaviorScore, string> = {
  3: 'ดีเยี่ยม',
  2: 'พอใช้',
  1: 'ปรับปรุง',
};

/** Firestore `classroom_behavior` — one doc per student + subject + semester. */
export interface ClassroomBehaviorRecord extends ClassroomBehaviorScores {
  id: string;
  studentId: string;
  studentName: string;
  studentCode: string;
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  teacherId: string;
  departmentId: string;
  academicYearId: string;
  semester: 1 | 2;
  updatedAt: string;
}

/** Numeric average of the 3 criteria (1–3). */
export function classroomBehaviorAvg(s: ClassroomBehaviorScores): number {
  return (s.responsibility + s.participation + s.effort) / 3;
}

export function classroomBehaviorLevelFromAvg(avg: number): ClassroomBehaviorScore {
  return avg >= 2.5 ? 3 : avg >= 1.5 ? 2 : 1;
}

/** Overall level is derived from the average, never stored. */
export function classroomBehaviorOverall(s: ClassroomBehaviorScores): ClassroomBehaviorScore {
  return classroomBehaviorLevelFromAvg(classroomBehaviorAvg(s));
}

export function classroomBehaviorDocId(p: {
  academicYearId: string;
  semester: number;
  classId: string;
  subjectId: string;
  studentId: string;
}): string {
  return [p.academicYearId, p.semester, p.classId, p.subjectId, p.studentId].join('_');
}
