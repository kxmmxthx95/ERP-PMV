import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { fetchStudentsByIds } from '@/lib/firestoreShared/fetchStudentsByIds';
import {
  getClassesByYearStore,
  getClassDocStore,
  getClassEnrollmentsScopedStore,
  getEnrollmentsByYearStore,
  type EnrollmentLike,
} from '@/lib/firestoreShared/studentSummaryStore';
import { collectStudentIdsForClass, countClassEnrollmentStudents } from '@/lib/students/classRoster';
import type { Student } from '@/types/student';
import type { ClassRoom } from '@/types/class';

type HomeroomClassRef = Pick<ClassRoom, 'id' | 'academicYearId' | 'semester' | 'className'>;

const noopSubscribe = () => () => {};
const readySnapshot = () => true;
// ต้อง cache ค่า empty ไว้ตัวเดียว (ไม่สร้าง [] ใหม่ทุกครั้งที่เรียก) ไม่งั้น useSyncExternalStore
// เห็น reference เปลี่ยนทุก call เข้าใจผิดว่า store เปลี่ยนตลอด วน re-render ไม่จบ (Maximum update depth)
const EMPTY_ARRAY: readonly never[] = [];

function useSharedStoreRows<T>(
  store: {
    subscribe: (listener: () => void) => () => void;
    getSnapshot: () => T;
    getReady: () => boolean;
  } | null,
  emptyValue: T = EMPTY_ARRAY as unknown as T,
) {
  const subscribe = store?.subscribe ?? noopSubscribe;
  const getSnapshot = store ? store.getSnapshot : () => emptyValue;
  const getReady = store ? store.getReady : readySnapshot;
  const rows = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const ready = useSyncExternalStore(subscribe, getReady, getReady);
  return { rows, ready };
}

/**
 * Roster for one homeroom class.
 *
 * ตอนเช้า 8-9 โมงครูหลายสิบคนเปิดหน้านี้พร้อมกัน — ถ้าใช้ enrollmentStore/classStore
 * แบบเดิม (onSnapshot ทั้ง collection ทั้งโรงเรียนต่อครูหนึ่งคน) จะกินโควต้ามหาศาล
 * เลย query แบบ scoped (เฉพาะ classId นี้) ก่อนเป็นหลัก แล้ว fallback ไปทั้งโรงเรียน
 * เฉพาะกรณีข้อมูล enrollment เก่าไม่มี classId ตรง (หา match ด้วยชื่อ/ห้องแทน)
 */
export function useMorningRollCallClassStudents(
  academicYearId: string | undefined,
  selectedClassId: string | null,
  activeSemester?: 1 | 2,
) {
  const scopedEnrollmentStore = academicYearId && selectedClassId
    ? getClassEnrollmentsScopedStore(academicYearId, selectedClassId)
    : null;
  const classDocStore = selectedClassId ? getClassDocStore(selectedClassId) : null;

  const { rows: scopedEnrollments, ready: scopedReady } = useSharedStoreRows(scopedEnrollmentStore);
  const { rows: classDoc, ready: classDocReady } = useSharedStoreRows(classDocStore, null);

  const classSemester = (classDoc as { semester?: 1 | 2 } | null)?.semester ?? activeSemester;

  const directIds = useMemo(() => {
    const ids = new Set<string>();
    (scopedEnrollments as EnrollmentLike[]).forEach((e) => {
      if ((e.status ?? 'studying') !== 'studying') return;
      if (classSemester != null && e.semester != null && Number(e.semester) !== Number(classSemester)) return;
      const sid = String(e.studentId ?? '').trim();
      if (sid) ids.add(sid);
    });
    return ids;
  }, [scopedEnrollments, classSemester]);

  const classStudentIdsFallback = useMemo(() => {
    if (directIds.size > 0) return new Set<string>();
    const arr = (classDoc as { studentIds?: unknown[] } | null)?.studentIds;
    const ids = new Set<string>();
    if (Array.isArray(arr)) {
      arr.forEach((id) => {
        const sid = String(id ?? '').trim();
        if (sid) ids.add(sid);
      });
    }
    return ids;
  }, [classDoc, directIds]);

  // scoped query หา 0 คน ทั้งที่ class doc ก็ไม่มี studentIds สำรอง — อาจเป็น enrollment
  // เก่าที่ field classId ไม่ตรง ต้อง fallback ไปสแกนทั้งโรงเรียนหา match ด้วยชื่อ/ห้อง (เคสหายาก)
  const needsLegacyFallback =
    Boolean(academicYearId && selectedClassId) &&
    scopedReady && classDocReady &&
    directIds.size === 0 && classStudentIdsFallback.size === 0;

  const legacyEnrollmentStore = needsLegacyFallback && academicYearId ? getEnrollmentsByYearStore(academicYearId) : null;
  const legacyClassStore = needsLegacyFallback && academicYearId ? getClassesByYearStore(academicYearId) : null;
  const { rows: legacyEnrollments, ready: legacyEnrollmentsReady } = useSharedStoreRows(legacyEnrollmentStore);
  const { rows: legacyClasses, ready: legacyClassesReady } = useSharedStoreRows(legacyClassStore);

  const legacyIds = useMemo(() => {
    if (!needsLegacyFallback || !academicYearId || !selectedClassId) return new Set<string>();
    return collectStudentIdsForClass(
      selectedClassId,
      legacyEnrollments as Parameters<typeof collectStudentIdsForClass>[1],
      legacyClasses as unknown as Parameters<typeof collectStudentIdsForClass>[2],
      academicYearId,
      activeSemester,
    );
  }, [needsLegacyFallback, academicYearId, selectedClassId, legacyEnrollments, legacyClasses, activeSemester]);

  const studentIds = useMemo(() => {
    if (!academicYearId || !selectedClassId) return [] as string[];
    if (directIds.size > 0) return [...directIds];
    if (classStudentIdsFallback.size > 0) return [...classStudentIdsFallback];
    return [...legacyIds];
  }, [academicYearId, selectedClassId, directIds, classStudentIdsFallback, legacyIds]);

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

  const legacyPending = needsLegacyFallback && (!legacyEnrollmentsReady || !legacyClassesReady);

  const loadingRoster =
    Boolean(academicYearId && selectedClassId) &&
    (!scopedReady || !classDocReady || legacyPending || loadingStudents);

  const rosterIdsReady =
    !academicYearId || !selectedClassId || (scopedReady && classDocReady && !legacyPending);

  return { students, studentIds, loadingRoster, rosterIdsReady };
}

/**
 * Enrollment-based student counts per homeroom class (no student doc fetch).
 * เคสทั่วไปคือครูมี homeroom เดียว — ใช้ scoped store (query เฉพาะห้องนั้น) แทนการเปิด
 * listener ทั้งโรงเรียน; ครูที่มีหลาย homeroom (หายาก) ใช้ path เดิมไปก่อน
 */
export function useHomeroomStudentCounts(
  academicYearId: string | undefined,
  homeroomClasses: HomeroomClassRef[],
  activeSemester?: 1 | 2,
) {
  const singleClassId = homeroomClasses.length === 1 ? homeroomClasses[0].id : null;
  const useScoped = Boolean(academicYearId && singleClassId);

  const scopedStore = useScoped ? getClassEnrollmentsScopedStore(academicYearId!, singleClassId!) : null;
  const { rows: scopedEnrollments, ready: scopedReady } = useSharedStoreRows(scopedStore);

  const wholeSchoolStore = !useScoped && academicYearId ? getEnrollmentsByYearStore(academicYearId) : null;
  const { rows: wholeSchoolEnrollments, ready: wholeSchoolReady } = useSharedStoreRows(wholeSchoolStore);

  const enrollments = useScoped ? scopedEnrollments : wholeSchoolEnrollments;
  const enrollmentsReady = useScoped ? scopedReady : wholeSchoolReady;

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
