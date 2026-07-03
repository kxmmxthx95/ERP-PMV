import type { ClassRoom } from '@/types/class';
import type { Enrollment } from '@/types/student';

type EnrollmentLike = Pick<
  Enrollment,
  'studentId' | 'classId' | 'academicYearId' | 'status' | 'semester'
> & {
  classroomId?: string;
  roomId?: string;
  className?: string;
  gradeLevel?: string;
  roomNumber?: string;
  roomNo?: string;
  academicYear?: string;
};

function normalizeText(value: unknown): string {
  return String(value ?? '').trim();
}

function getClassNameFromParts(grade: unknown, room: unknown): string {
  const g = normalizeText(grade);
  const r = normalizeText(room);
  return g && r ? `${g}/${r}` : '';
}

function enrollmentMatchesYear(e: EnrollmentLike, yearId: string): boolean {
  return (
    String(e.academicYearId ?? e.academicYear ?? '') === String(yearId)
  );
}

/** Resolve enrollment document → canonical classes/{id}. */
export function resolveEnrollmentClassId(
  data: EnrollmentLike,
  classes: ClassRoom[],
  yearId: string,
): string | null {
  if (!enrollmentMatchesYear(data, yearId)) return null;
  if ((data.status ?? 'studying') !== 'studying') return null;

  const classById = new Map(classes.map((c) => [String(c.id), c] as const));
  const enrollmentClassId = normalizeText(data.classId ?? data.classroomId ?? data.roomId);

  if (enrollmentClassId && classById.has(enrollmentClassId)) {
    return enrollmentClassId;
  }

  const enrollmentClassName = normalizeText(data.className);
  const enrollmentComposedName = getClassNameFromParts(
    data.gradeLevel,
    data.roomNumber ?? data.roomNo,
  );

  const matched = classes.find((cls) => {
    const clsClassName = normalizeText(cls.className);
    if (enrollmentClassName && clsClassName && enrollmentClassName === clsClassName) return true;
    if (enrollmentComposedName && clsClassName && enrollmentComposedName === clsClassName) return true;

    const enrollmentGrade = normalizeText(data.gradeLevel);
    const clsGrade = normalizeText(cls.gradeLevel);
    const enrollmentRoom = normalizeText(data.roomNumber ?? data.roomNo);
    const clsRoom = normalizeText(cls.roomNumber);
    return !!(
      enrollmentGrade &&
      clsGrade &&
      enrollmentRoom &&
      clsRoom &&
      enrollmentGrade === clsGrade &&
      enrollmentRoom === clsRoom
    );
  });

  return matched?.id ? String(matched.id) : null;
}

type ClassDisplaySource = Pick<ClassRoom, 'id'> & {
  className?: string;
  gradeLevel?: string;
  roomNumber?: string;
};

/** Display name for UI — enrollment snapshot, class doc, or grade/room parts. */
export function resolveStudentClassDisplayName(
  student: {
    className?: string;
    classroomId?: string;
    classId?: string;
    gradeLevel?: string;
    roomNumber?: string;
  },
  enrollment: EnrollmentLike | null | undefined,
  classes: ClassDisplaySource[],
  yearId?: string,
): string | null {
  const directName =
    normalizeText(enrollment?.className) || normalizeText(student.className);
  if (directName) return directName;

  let classId =
    normalizeText(enrollment?.classId ?? enrollment?.classroomId ?? enrollment?.roomId)
    || normalizeText(student.classroomId ?? student.classId);

  if (!classId && enrollment && yearId) {
    const resolved = resolveEnrollmentClassId(
      enrollment,
      classes as ClassRoom[],
      yearId,
    );
    if (resolved) classId = resolved;
  }

  if (classId) {
    const cls = classes.find((c) => String(c.id) === classId);
    if (cls) {
      const name = normalizeText(cls.className);
      if (name) return name;
      const composed = getClassNameFromParts(cls.gradeLevel, cls.roomNumber);
      if (composed) return composed;
    }
  }

  const grade = normalizeText(enrollment?.gradeLevel ?? student.gradeLevel);
  const room = normalizeText(
    enrollment?.roomNumber ?? enrollment?.roomNo ?? student.roomNumber,
  );
  const composed = getClassNameFromParts(grade, room);
  return composed || null;
}

function resolveClassSemester(
  classRoom: Pick<ClassRoom, 'semester'> | undefined,
  activeSemester?: 1 | 2,
): 1 | 2 | undefined {
  if (classRoom?.semester != null) return classRoom.semester;
  return activeSemester;
}

/** Strict enrollment count — matches ClassStudentTab (exact classId + year + semester). */
export function countClassEnrollmentStudents(
  classRoom: Pick<ClassRoom, 'id' | 'academicYearId' | 'semester'>,
  enrollments: EnrollmentLike[],
  activeSemester?: 1 | 2,
): number {
  const semesterFilter = resolveClassSemester(classRoom, activeSemester);
  const ids = new Set<string>();

  enrollments.forEach((e) => {
    if (String(e.classId ?? '') !== String(classRoom.id)) return;
    if (String(e.academicYearId ?? e.academicYear ?? '') !== String(classRoom.academicYearId)) return;
    if (semesterFilter != null && Number(e.semester) !== Number(semesterFilter)) return;
    if ((e.status ?? 'studying') !== 'studying') return;
    const sid = normalizeText(e.studentId);
    if (sid) ids.add(sid);
  });

  return ids.size;
}

/** Student IDs enrolled in a class (enrollments + class.studentIds fallback). */
export function collectStudentIdsForClass(
  classId: string,
  enrollments: EnrollmentLike[],
  classes: ClassRoom[],
  yearId: string,
  activeSemester?: 1 | 2,
): Set<string> {
  const ids = new Set<string>();
  const targetClass = classes.find((c) => String(c.id) === String(classId));
  const classSemester = resolveClassSemester(targetClass, activeSemester);

  enrollments.forEach((e) => {
    if (!enrollmentMatchesYear(e, yearId)) return;
    if ((e.status ?? 'studying') !== 'studying') return;
    if (
      classSemester != null &&
      e.semester != null &&
      Number(e.semester) !== Number(classSemester)
    ) {
      return;
    }

    const enrollmentClassId = normalizeText(e.classId ?? e.classroomId ?? e.roomId);
    if (enrollmentClassId === String(classId)) {
      const sid = normalizeText(e.studentId);
      if (sid) ids.add(sid);
      return;
    }

    const resolved = resolveEnrollmentClassId(e, classes, yearId);
    if (resolved !== classId) return;
    const sid = normalizeText(e.studentId);
    if (sid) ids.add(sid);
  });

  if (ids.size > 0) return ids;

  const classStudentIds = (targetClass as { studentIds?: unknown[] } | undefined)?.studentIds;
  if (Array.isArray(classStudentIds)) {
    classStudentIds.forEach((id) => {
      const sid = normalizeText(id);
      if (sid) ids.add(sid);
    });
  }

  return ids;
}
