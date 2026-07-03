import type { ClassRoom } from '@/types/class';
import type { TeacherProfile } from '@/types/teacher';

export const MAX_HOMEROOM_TEACHERS = 2;

export function teacherMatchesRef(teacher: TeacherProfile, refId: string): boolean {
  return teacher.id === refId || (!!teacher.userId && teacher.userId === refId);
}

export function findTeacherByRef(
  teachers: TeacherProfile[],
  refId: string,
): TeacherProfile | undefined {
  return teachers.find((t) => teacherMatchesRef(t, refId));
}

export function getRawHomeroomRefs(
  classRoom: Pick<ClassRoom, 'homeroomTeacherId' | 'homeroomTeacherIds'>,
): string[] {
  const ids: string[] = [];
  for (const refId of classRoom.homeroomTeacherIds ?? []) {
    if (refId && !ids.includes(refId)) ids.push(refId);
  }
  if (classRoom.homeroomTeacherId && !ids.includes(classRoom.homeroomTeacherId)) {
    ids.push(classRoom.homeroomTeacherId);
  }
  return ids;
}

/** Merge homeroomTeacherIds + legacy homeroomTeacherId, dedupe by teacher profile. */
export function resolveHomeroomTeacherIds(
  classRoom: Pick<ClassRoom, 'homeroomTeacherId' | 'homeroomTeacherIds'>,
  teachers: TeacherProfile[] = [],
): string[] {
  const rawIds = getRawHomeroomRefs(classRoom);
  const hasTeacherCatalog = teachers.length > 0;
  const resolvedDocIds: string[] = [];
  const seenTeacherIds = new Set<string>();

  for (const refId of rawIds) {
    const teacher = findTeacherByRef(teachers, refId);
    if (teacher) {
      if (!seenTeacherIds.has(teacher.id)) {
        seenTeacherIds.add(teacher.id);
        resolvedDocIds.push(teacher.id);
      }
      continue;
    }

    // When teacher catalog is loaded, drop orphan/stale refs that no longer match anyone.
    if (!hasTeacherCatalog && refId && !resolvedDocIds.includes(refId)) {
      resolvedDocIds.push(refId);
    }

    if (resolvedDocIds.length >= MAX_HOMEROOM_TEACHERS) break;
  }

  return resolvedDocIds.slice(0, MAX_HOMEROOM_TEACHERS);
}

export function resolveHomeroomTeachers(
  classRoom: Pick<ClassRoom, 'homeroomTeacherId' | 'homeroomTeacherIds'>,
  teachers: TeacherProfile[],
): TeacherProfile[] {
  const ids = resolveHomeroomTeacherIds(classRoom, teachers);
  return ids
    .map((id) => teachers.find((t) => t.id === id))
    .filter((t): t is TeacherProfile => !!t);
}

export function isHomeroomTeacherSelected(
  teacher: TeacherProfile,
  classRoom: Pick<ClassRoom, 'homeroomTeacherId' | 'homeroomTeacherIds'>,
  teachers: TeacherProfile[],
): boolean {
  return resolveHomeroomTeacherIds(classRoom, teachers).includes(teacher.id)
    || getRawHomeroomRefs(classRoom).some((refId) => teacherMatchesRef(teacher, refId));
}

export function countHomeroomTeachers(
  classRoom: Pick<ClassRoom, 'homeroomTeacherId' | 'homeroomTeacherIds'>,
  teachers: TeacherProfile[],
): number {
  return resolveHomeroomTeacherIds(classRoom, teachers).length;
}

export function toggleHomeroomTeacherIds(
  teacher: TeacherProfile,
  classRoom: Pick<ClassRoom, 'homeroomTeacherId' | 'homeroomTeacherIds'>,
  teachers: TeacherProfile[],
): { nextIds: string[]; changed: boolean; atLimit: boolean } {
  const currentIds = resolveHomeroomTeacherIds(classRoom, teachers);
  const isSelected = currentIds.includes(teacher.id)
    || getRawHomeroomRefs(classRoom).some((refId) => teacherMatchesRef(teacher, refId));

  if (isSelected) {
    const nextIds = currentIds.filter((id) => id !== teacher.id);
    return { nextIds, changed: true, atLimit: false };
  }

  if (currentIds.length >= MAX_HOMEROOM_TEACHERS) {
    return { nextIds: currentIds, changed: false, atLimit: true };
  }

  return { nextIds: [...currentIds, teacher.id], changed: true, atLimit: false };
}

export function homeroomTeacherIdsEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((id, index) => id === sortedB[index]);
}

export function needsHomeroomTeacherRepair(
  classRoom: Pick<ClassRoom, 'homeroomTeacherId' | 'homeroomTeacherIds'>,
  teachers: TeacherProfile[],
): boolean {
  if (teachers.length === 0) return false;
  const normalized = resolveHomeroomTeacherIds(classRoom, teachers);
  const stored = classRoom.homeroomTeacherIds ?? [];
  const primary = classRoom.homeroomTeacherId ?? '';
  if (!homeroomTeacherIdsEqual(normalized, stored)) return true;
  if (normalized[0] !== primary && (normalized.length > 0 || primary !== '')) return true;
  return getRawHomeroomRefs(classRoom).length > normalized.length;
}

export function buildHomeroomTeacherUpdate(nextIds: string[]) {
  return {
    homeroomTeacherIds: nextIds,
    homeroomTeacherId: nextIds[0] ?? '',
  };
}
