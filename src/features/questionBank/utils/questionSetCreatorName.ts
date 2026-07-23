import { resolveTeacherFromAuth } from '@/lib/teachers/teacherIdentity';
import type { TeacherProfile } from '@/types/teacher';
import type { QuestionSet } from '@/types/questionBank';

function looksLikeEmail(value: string): boolean {
  return value.includes('@');
}

/** Prefer real teacher name over Auth email stored in createdByName. */
export function resolveQuestionSetCreatorName(
  set: Pick<QuestionSet, 'createdBy' | 'createdByName'>,
  teachers: TeacherProfile[],
): string {
  const stored = String(set.createdByName ?? '').trim();
  if (stored && !looksLikeEmail(stored)) return stored;

  const uid = String(set.createdBy ?? '').trim();
  if (uid) {
    const teacher = resolveTeacherFromAuth(uid, teachers);
    const name = teacher?.name?.trim();
    if (name) return name;
  }

  if (stored && looksLikeEmail(stored)) {
    const email = stored.toLowerCase();
    const byEmail = teachers.find(
      (t) => String(t.email ?? '').trim().toLowerCase() === email,
    );
    const name = byEmail?.name?.trim();
    if (name) return name;
  }

  return stored && !looksLikeEmail(stored) ? stored : '';
}
