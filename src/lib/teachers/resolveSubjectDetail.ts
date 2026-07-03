import type { Subject } from '@/types/curriculum';
import type { CurriculumCourse } from '@/types/curriculum';

export type ResolvedSubjectDetail = Pick<Subject, 'id' | 'name'> & {
  code?: string;
};

/** Resolve subject id or code from repository + versioned curriculum courses. */
export function resolveSubjectDetail(
  subjectId: string,
  allSubjects: Pick<Subject, 'id' | 'code' | 'name'>[],
  allVersionedCourses: Pick<CurriculumCourse, 'id' | 'courseCode' | 'courseName'>[],
): ResolvedSubjectDetail | null {
  const key = String(subjectId ?? '').trim();
  if (!key) return null;

  const repo = allSubjects.find((s) => s.id === key || s.code === key);
  if (repo) return { id: repo.id, name: repo.name, code: repo.code };

  const vc = allVersionedCourses.find((c) => c.id === key || c.courseCode === key);
  if (!vc) return null;

  return { id: vc.id, name: vc.courseName, code: vc.courseCode };
}
