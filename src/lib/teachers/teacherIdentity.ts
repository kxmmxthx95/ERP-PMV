import type { TeacherProfile } from '@/types/teacher';

/** Resolve teacher doc from Firebase Auth uid or teachers/{id}. */
export function resolveTeacherFromAuth(
  authUserId: string,
  teachers: TeacherProfile[],
): TeacherProfile | null {
  const key = authUserId.trim();
  if (!key) return null;
  return teachers.find(t => t.id === key || t.userId === key) ?? null;
}

/** All ids that may appear in enrolledCourses.teacherId or schedules.teacherId. */
export function buildTeacherIdentityKeys(
  authUserId: string,
  teacher: TeacherProfile | null,
): Set<string> {
  const keys = new Set<string>();
  const add = (id?: string | null) => {
    const v = String(id ?? '').trim();
    if (v) keys.add(v);
  };
  add(authUserId);
  if (teacher) {
    add(teacher.id);
    add(teacher.userId);
  }
  return keys;
}

export function matchesTeacherIdentity(
  enrolledTeacherId: string | undefined | null,
  identityKeys: Set<string>,
): boolean {
  return identityKeys.has(String(enrolledTeacherId ?? '').trim());
}

/** Map schedules/enrollment teacherId (doc id or userId) to teachers/{id}. */
export function resolveCanonicalTeacherId(
  rawTeacherId: string | undefined,
  teachers: TeacherProfile[],
  fallbackName?: string,
): string {
  const target = String(rawTeacherId || '').trim();
  const fallback = String(fallbackName || '').trim().toLowerCase();
  if (!target && !fallback) return '';

  const byDocId = teachers.find((t) => t.id === target);
  if (byDocId) return byDocId.id;

  const byUserId = teachers.find((t) => t.userId && String(t.userId).trim() === target);
  if (byUserId) return byUserId.id;

  if (fallback) {
    const byName = teachers.find(
      (t) => String(t.name || '').trim().toLowerCase() === fallback,
    );
    if (byName) return byName.id;
  }

  return target;
}

export function teacherDisplayName(
  canonicalTeacherId: string,
  teachers: TeacherProfile[],
  fallbackName?: string,
): string {
  return (
    teachers.find((t) => t.id === canonicalTeacherId)?.name
    || String(fallbackName || '').trim()
    || '-'
  );
}
