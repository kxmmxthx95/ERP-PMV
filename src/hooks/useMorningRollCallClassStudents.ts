import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { fetchStudentsByIds } from '@/lib/firestoreShared/fetchStudentsByIds';
import {
  getClassesByYearStore,
  getEnrollmentsByYearStore,
} from '@/lib/firestoreShared/studentSummaryStore';
import { collectStudentIdsForClass, countClassEnrollmentStudents } from '@/lib/students/classRoster';
import type { Student } from '@/types/student';
import type { ClassRoom } from '@/types/class';

type HomeroomClassRef = Pick<ClassRoom, 'id' | 'academicYearId' | 'semester' | 'className'>;

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

/** Roster for one homeroom class — shared enrollment/class listeners + bulk fetch by ID. */
export function useMorningRollCallClassStudents(
  academicYearId: string | undefined,
  selectedClassId: string | null,
  activeSemester?: 1 | 2,
) {
  const enrollmentStore = academicYearId ? getEnrollmentsByYearStore(academicYearId) : null;
  const classStore = academicYearId ? getClassesByYearStore(academicYearId) : null;

  const { rows: enrollments, ready: enrollmentsReady } = useSharedStoreRows(enrollmentStore);
  const { rows: classes, ready: classesReady } = useSharedStoreRows(classStore);

  const studentIds = useMemo(() => {
    if (!academicYearId || !selectedClassId) return [] as string[];
    return [...collectStudentIdsForClass(
      selectedClassId,
      enrollments as Parameters<typeof collectStudentIdsForClass>[1],
      classes as unknown as Parameters<typeof collectStudentIdsForClass>[2],
      academicYearId,
      activeSemester,
    )];
  }, [academicYearId, selectedClassId, enrollments, classes, activeSemester]);

  const studentIdsKey = useMemo(
    () => (studentIds.length > 0 ? [...studentIds].sort().join(',') : ''),
    [studentIds],
  );

  const [students, setStudents] = useState<Student[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);

  useEffect(() => {
    if (!studentIdsKey) {
      setStudents([]);
      setLoadingStudents(false);
      return;
    }

    let cancelled = false;
    setLoadingStudents(true);
    const ids = studentIdsKey.split(',');

    void fetchStudentsByIds<Student>(ids)
      .then((rows) => {
        if (!cancelled) setStudents(rows);
      })
      .catch((err) => {
        console.error('[useMorningRollCallClassStudents] fetch failed:', err);
        if (!cancelled) setStudents([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingStudents(false);
      });

    return () => {
      cancelled = true;
    };
  }, [studentIdsKey]);

  const loadingRoster =
    Boolean(academicYearId && selectedClassId) &&
    (!enrollmentsReady || !classesReady || loadingStudents);

  const rosterIdsReady =
    !academicYearId || !selectedClassId || (enrollmentsReady && classesReady);

  return { students, studentIds, loadingRoster, rosterIdsReady };
}

/** Enrollment-based student counts per homeroom class (no student doc fetch). */
export function useHomeroomStudentCounts(
  academicYearId: string | undefined,
  homeroomClasses: HomeroomClassRef[],
  activeSemester?: 1 | 2,
) {
  const enrollmentStore = academicYearId ? getEnrollmentsByYearStore(academicYearId) : null;

  const { rows: enrollments, ready: enrollmentsReady } = useSharedStoreRows(enrollmentStore);

  const homeroomClassesKey = useMemo(
    () => homeroomClasses.map((cls) => `${cls.id}:${cls.semester ?? ''}`).join(','),
    [homeroomClasses],
  );

  const countsByClassId = useMemo(() => {
    const map: Record<string, number> = {};
    if (!academicYearId || homeroomClasses.length === 0) return map;

    const rosterEnrollments = enrollments as Parameters<typeof countClassEnrollmentStudents>[1];

    for (const cls of homeroomClasses) {
      map[cls.id] = countClassEnrollmentStudents(cls, rosterEnrollments, activeSemester);
    }
    return map;
  }, [academicYearId, homeroomClassesKey, enrollments, homeroomClasses, activeSemester]);

  const total = useMemo(
    () => homeroomClasses.reduce((sum, cls) => sum + (countsByClassId[cls.id] ?? 0), 0),
    [homeroomClasses, countsByClassId],
  );

  const ready = !academicYearId || homeroomClasses.length === 0 || enrollmentsReady;

  return { countsByClassId, total, ready };
}
