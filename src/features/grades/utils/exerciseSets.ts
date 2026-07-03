import type { NewQuestionSet, QuestionSet } from '@/types/questionBank';
import type { SubjectGroupId } from '@/types/curriculum';

export interface GradeBookExerciseContext {
  academicYearId: string;
  semester: 1 | 2;
  classId: string;
  className: string;
  departmentId: string;
  gradeLevel: string;
  subjectId: string;
  subjectName: string;
  subjectGroup: SubjectGroupId;
  curriculumYear: string;
}

export function isExerciseSet(set: QuestionSet): boolean {
  return set.setKind === 'exercise';
}

export function filterExerciseSets(
  sets: QuestionSet[],
  ctx: GradeBookExerciseContext,
): QuestionSet[] {
  return sets
    .filter(
      (set) =>
        set.setKind === 'exercise'
        && set.classId === ctx.classId
        && set.subjectId === ctx.subjectId
        && set.academicYearId === ctx.academicYearId
        && set.semester === ctx.semester,
    )
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function buildExerciseSetPayload(
  data: Omit<NewQuestionSet, 'setKind' | 'createdBy' | 'createdByName'>,
  ctx: GradeBookExerciseContext,
): NewQuestionSet {
  return {
    ...data,
    setKind: 'exercise',
    subjectGroup: data.subjectGroup ?? ctx.subjectGroup,
    department: data.department ?? ctx.departmentId,
    gradeLevel: data.gradeLevel ?? ctx.gradeLevel,
    curriculumYear: data.curriculumYear || ctx.curriculumYear,
    academicYearId: ctx.academicYearId,
    semester: ctx.semester,
    departmentId: ctx.departmentId,
    classId: ctx.classId,
    className: ctx.className,
    subjectId: ctx.subjectId,
    subjectName: ctx.subjectName,
    createdBy: '',
    createdByName: '',
  };
}

export function mergeImportedExerciseSets(
  items: NewQuestionSet[],
  ctx: GradeBookExerciseContext,
): NewQuestionSet[] {
  return items.map((item) => buildExerciseSetPayload(item, ctx));
}
