import { useMemo, useSyncExternalStore } from 'react';
import {
  getClassesByYearStore,
  getEnrollmentsByYearStore,
} from '@/lib/firestoreShared/studentSummaryStore';
import { resolveStudentClassDisplayName, resolveEnrollmentClassId } from '@/lib/students/classRoster';
import { resolveHomeroomTeachers } from '@/features/classes/utils/homeroomTeachers';
import { inferDepartmentFromGradeLevel } from '@/lib/school/gradeLevelBadge';
import { teachersCollectionStore } from '@/lib/firestoreShared/teachersStore';
import type { ClassRoom } from '@/types/class';
import type { Department } from '@/types/curriculum';
import type { Enrollment } from '@/types/student';
import type { TeacherProfile } from '@/types/teacher';

export type LeaveRequesterProfile = {
  gradeLevel: string;
  className: string;
  departmentId: Department | null;
  approverNames: string[];
};

const noopSubscribe = () => () => {};
const readySnapshot = () => true;
const getEmptyRowsSnapshot = <T,>(): T => [] as T;

function useSharedStoreRows<T>(
  store: {
    subscribe: (listener: () => void) => () => void;
    getSnapshot: () => T;
    getReady: () => boolean;
  } | null,
) {
  const subscribe = store?.subscribe ?? noopSubscribe;
  const getSnapshot = store ? store.getSnapshot : getEmptyRowsSnapshot<T>;
  const getReady = store ? store.getReady : readySnapshot;
  const rows = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const ready = useSyncExternalStore(subscribe, getReady, getReady);
  return { rows, ready };
}

function normalizeText(value: unknown): string {
  return String(value ?? '').trim();
}

/** Map student requesterId → grade/class for leave cards (enrollment snapshot). */
export function useLeaveRequesterClassMap(
  academicYearId: string | undefined,
  requesterIds: string[],
): Map<string, LeaveRequesterProfile> {
  const enrollmentStore = academicYearId ? getEnrollmentsByYearStore(academicYearId) : null;
  const classStore = academicYearId ? getClassesByYearStore(academicYearId) : null;

  const { rows: enrollments } = useSharedStoreRows(enrollmentStore);
  const { rows: classes } = useSharedStoreRows(classStore);
  const { rows: teachers } = useSharedStoreRows(teachersCollectionStore);

  const requesterIdKey = useMemo(
    () => [...new Set(requesterIds.filter(Boolean))].sort().join(','),
    [requesterIds],
  );

  return useMemo(() => {
    const map = new Map<string, LeaveRequesterProfile>();
    if (!academicYearId || !requesterIdKey) return map;

    const idsSet = new Set(requesterIdKey.split(','));
    const classRows = classes as unknown as ClassRoom[];
    const teacherRows = teachers as TeacherProfile[];

    (enrollments as Enrollment[]).forEach((enrollment) => {
      const studentId = normalizeText(enrollment.studentId);
      if (!studentId || !idsSet.has(studentId)) return;
      if (String(enrollment.academicYearId ?? '') !== String(academicYearId)) return;
      if ((enrollment.status ?? 'studying') !== 'studying') return;

      const className =
        resolveStudentClassDisplayName({}, enrollment, classRows, academicYearId)
        || normalizeText(enrollment.className);

      const gradeLevel =
        normalizeText(enrollment.gradeLevel)
        || (className.includes('/') ? className.split('/')[0] : '');

      const resolvedClassId = resolveEnrollmentClassId(enrollment, classRows, academicYearId);
      const classRoom = resolvedClassId
        ? classRows.find((c) => String(c.id) === resolvedClassId)
        : undefined;

      const matchedClass = enrollment.classId
        ? classRows.find((c) => String(c.id) === String(enrollment.classId))
        : undefined;

      const homeroomClass = classRoom ?? matchedClass;
      const approverNames = homeroomClass
        ? resolveHomeroomTeachers(homeroomClass, teacherRows)
          .map((teacher) => normalizeText(teacher.name))
          .filter(Boolean)
        : [];

      const departmentId: Department | null =
        (normalizeText(enrollment.departmentId) as Department | '')
        || homeroomClass?.departmentId
        || homeroomClass?.department
        || (gradeLevel ? inferDepartmentFromGradeLevel(gradeLevel) : null)
        || null;

      map.set(studentId, {
        gradeLevel,
        className: className || gradeLevel,
        departmentId,
        approverNames,
      });
    });

    return map;
  }, [academicYearId, requesterIdKey, enrollments, classes, teachers]);
}
