import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import {
  getClassesByYearStore,
  getEnrollmentsByYearStore,
  getStudentsByYearStore,
  studentsMasterStore,
  type ClassLike,
  type EnrollmentLike,
  type StudentLike,
} from '@/lib/firestoreShared/studentSummaryStore';
import {
  buildResolveStudentsCacheKey,
  isStudentVisibleForYear,
  resolveStudentsForYear,
} from '@/lib/students/resolveStudentsForYear';
import { isStudyingStudent } from '@/lib/students/studentStatus';

export interface StudentSummary {
  total: number;
  early: number;
  primary: number;
  secondary: number;
  byGrade: Record<string, number>;
  loading: boolean;
}

export type { EnrollmentLike, StudentLike, ClassLike };

const GRADE_ORDER: Record<'early' | 'primary' | 'secondary', string[]> = {
  early: ['อ.1', 'อ.2', 'อ.3'],
  primary: ['ป.1', 'ป.2', 'ป.3', 'ป.4', 'ป.5', 'ป.6'],
  secondary: ['ม.1', 'ม.2', 'ม.3', 'ม.4', 'ม.5', 'ม.6'],
};

const noopSubscribe = () => () => {};
const readySnapshot = () => true;
const EMPTY_ROWS: never[] = [];
const getEmptyRowsSnapshot = <T,>(): T => EMPTY_ROWS as T;

function enrollmentMatchesYear(e: EnrollmentLike, yearId: string): boolean {
  return (
    String(e.academicYearId ?? '') === String(yearId) ||
    String(e.academicYear ?? '') === String(yearId)
  );
}

function inferDepartment(
  departmentId?: string,
  gradeLevel?: string,
): 'early' | 'primary' | 'secondary' | null {
  if (departmentId === 'early' || departmentId === 'primary' || departmentId === 'secondary') {
    return departmentId;
  }

  const grade = String(gradeLevel ?? '').trim();
  if (!grade) return null;

  if (GRADE_ORDER.early.includes(grade) || grade.startsWith('อ')) return 'early';
  if (GRADE_ORDER.primary.includes(grade) || grade.startsWith('ป')) return 'primary';
  if (GRADE_ORDER.secondary.includes(grade) || grade.startsWith('ม')) return 'secondary';

  return null;
}

function pickLatestEnrollment(
  current: EnrollmentLike | undefined,
  candidate: EnrollmentLike,
): EnrollmentLike {
  if (!current) return candidate;
  const prevDate = current.enrolledAt ?? '';
  const currDate = candidate.enrolledAt ?? '';
  return currDate >= prevDate ? candidate : current;
}

function buildSummaryFromMaps(
  enrollmentByStudent: Map<string, EnrollmentLike>,
  fallbackStudents: StudentLike[],
): Omit<StudentSummary, 'loading'> {
  const counts = { early: 0, primary: 0, secondary: 0 };
  const byGrade: Record<string, number> = {};

  const addStudent = (departmentId: string | undefined, gradeLevel: string | undefined) => {
    const dept = inferDepartment(departmentId, gradeLevel);
    if (dept) counts[dept]++;
    const grade = String(gradeLevel ?? '').trim();
    if (grade) byGrade[grade] = (byGrade[grade] ?? 0) + 1;
  };

  enrollmentByStudent.forEach((data) => {
    addStudent(data.departmentId, data.gradeLevel);
  });

  fallbackStudents.forEach((student) => {
    addStudent(undefined, student.gradeLevel);
  });

  return {
    ...counts,
    total: enrollmentByStudent.size + fallbackStudents.length,
    byGrade,
  };
}

function computeStudentSummary(
  academicYearId: string,
  enrollments: EnrollmentLike[],
  students: StudentLike[],
  classes: ClassLike[],
): Omit<StudentSummary, 'loading'> {
  const yearEnrollments = enrollments.filter((e) => enrollmentMatchesYear(e, academicYearId));

  const enrolledStudentIds = new Set<string>();
  yearEnrollments.forEach((e) => {
    const id = String(e.studentId ?? '').trim();
    if (id) enrolledStudentIds.add(id);
  });

  const classById = new Map(classes.map((c) => [String(c.id), c] as const));

  const visibleStudents = students.filter(
    (student) =>
      isStudyingStudent(student) &&
      isStudentVisibleForYear(student, academicYearId, enrolledStudentIds, classById),
  );

  const uniqueById = new Map<string, StudentLike>();
  visibleStudents.forEach((s) => uniqueById.set(s.id, s));

  const enrollmentByStudent = new Map<string, EnrollmentLike>();
  yearEnrollments.forEach((data) => {
    const key = String(data.studentId ?? '').trim();
    if (!key || !uniqueById.has(key)) return;
    enrollmentByStudent.set(key, pickLatestEnrollment(enrollmentByStudent.get(key), data));
  });

  const fallbackStudents = [...uniqueById.values()].filter((s) => !enrollmentByStudent.has(s.id));

  return buildSummaryFromMaps(enrollmentByStudent, fallbackStudents);
}

function useSharedStoreRows<T>(
  store: { subscribe: (l: () => void) => () => void; getSnapshot: () => T; getReady: () => boolean } | null,
) {
  const subscribe = store?.subscribe ?? noopSubscribe;
  const getSnapshot = store ? store.getSnapshot : getEmptyRowsSnapshot<T>;
  const getReady = store ? store.getReady : readySnapshot;
  const rows = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const ready = useSyncExternalStore(subscribe, getReady, getReady);
  return { rows, ready };
}

export function useStudentSummary(
  academicYearId?: string,
  options?: { includeMasterStudents?: boolean },
) {
  const includeMasterStudents = options?.includeMasterStudents === true;
  const enrollmentStore = academicYearId ? getEnrollmentsByYearStore(academicYearId) : null;
  const classStore = academicYearId ? getClassesByYearStore(academicYearId) : null;
  const studentsStore = academicYearId
    ? (includeMasterStudents ? studentsMasterStore : getStudentsByYearStore(academicYearId))
    : null;

  const { rows: enrollments, ready: enrollmentsReady } = useSharedStoreRows(enrollmentStore);
  const { rows: classes, ready: classesReady } = useSharedStoreRows(classStore);
  const { rows: yearStudents, ready: studentsReady } = useSharedStoreRows(studentsStore);

  const resolveCacheKey = useMemo(() => {
    if (!academicYearId || includeMasterStudents) return '';
    return buildResolveStudentsCacheKey(academicYearId, enrollments, classes, yearStudents);
  }, [academicYearId, includeMasterStudents, enrollments, classes, yearStudents]);

  const [resolvedStudents, setResolvedStudents] = useState<StudentLike[]>([]);
  const [resolvingStudents, setResolvingStudents] = useState(false);

  useEffect(() => {
    if (!academicYearId) {
      setResolvedStudents([]);
      setResolvingStudents(false);
      return;
    }

    if (includeMasterStudents) {
      setResolvedStudents(yearStudents);
      setResolvingStudents(false);
      return;
    }

    if (!enrollmentsReady || !classesReady || !studentsReady) {
      setResolvingStudents(true);
      return;
    }

    let cancelled = false;
    setResolvingStudents(true);

    void resolveStudentsForYear(academicYearId, enrollments, classes, yearStudents).then((merged) => {
      if (!cancelled) {
        setResolvedStudents(merged);
        setResolvingStudents(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [
    academicYearId,
    includeMasterStudents,
    resolveCacheKey,
    enrollments,
    classes,
    yearStudents,
    enrollmentsReady,
    classesReady,
    studentsReady,
  ]);

  const students = useMemo(() => {
    if (includeMasterStudents) return yearStudents;
    const merged = new Map(resolvedStudents.map((s) => [s.id, s]));
    yearStudents.forEach((s) => merged.set(s.id, s));
    return [...merged.values()];
  }, [includeMasterStudents, yearStudents, resolvedStudents]);

  return useMemo(() => {
    if (!academicYearId) {
      return {
        total: 0,
        early: 0,
        primary: 0,
        secondary: 0,
        byGrade: {},
        loading: false,
      } satisfies StudentSummary;
    }

    const loading =
      !enrollmentsReady || !classesReady || !studentsReady || resolvingStudents;

    if (loading) {
      return {
        total: 0,
        early: 0,
        primary: 0,
        secondary: 0,
        byGrade: {},
        loading: true,
      } satisfies StudentSummary;
    }

    return {
      ...computeStudentSummary(academicYearId, enrollments, students, classes),
      loading: false,
    } satisfies StudentSummary;
  }, [
    academicYearId,
    enrollments,
    classes,
    students,
    enrollmentsReady,
    classesReady,
    studentsReady,
    resolvingStudents,
  ]);
}
