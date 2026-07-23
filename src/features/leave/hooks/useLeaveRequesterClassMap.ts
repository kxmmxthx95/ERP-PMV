import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { collection, documentId, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { chunkIds } from '@/lib/firestoreShared/fetchStudentsByIds';
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
// ค่าอ้างอิงเดียวคงที่ ห้ามสร้าง [] ใหม่ทุกครั้ง ไม่งั้น useSyncExternalStore วน re-render ไม่จบ
const EMPTY_ROWS: readonly never[] = [];

function useSharedStoreRows<T>(
  store: {
    subscribe: (listener: () => void) => () => void;
    getSnapshot: () => T;
    getReady: () => boolean;
  } | null,
) {
  const subscribe = store?.subscribe ?? noopSubscribe;
  const getSnapshot = store ? store.getSnapshot : () => EMPTY_ROWS as unknown as T;
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
  const { rows: teachers } = useSharedStoreRows(teachersCollectionStore);

  const requesterIdKey = useMemo(
    () => [...new Set(requesterIds.filter(Boolean))].sort().join(','),
    [requesterIds],
  );

  // requesterIds เป็น list เล็กๆ ที่รู้อยู่แล้ว (คำขอลาที่แสดงในหน้านี้) — ดึงเฉพาะ enrollment
  // ของนักเรียนกลุ่มนี้ + class เฉพาะที่ enrollment อ้างถึง แทนสแกน enrollments/classes
  // ทั้งโรงเรียนทุกครั้งที่หน้านี้เปิด (getEnrollmentsByYearStore/getClassesByYearStore เดิม)
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [classes, setClasses] = useState<ClassRoom[]>([]);

  useEffect(() => {
    if (!academicYearId || !requesterIdKey) {
      setEnrollments([]);
      setClasses([]);
      return;
    }

    let cancelled = false;
    const studentIds = requesterIdKey.split(',');

    void (async () => {
      const enrollSnaps = await Promise.all(
        chunkIds(studentIds).map((chunk) =>
          getDocs(query(
            collection(db, 'enrollments'),
            where('studentId', 'in', chunk),
            where('academicYearId', '==', academicYearId),
          )),
        ),
      );
      if (cancelled) return;
      const enrollRows = enrollSnaps.flatMap((snap) =>
        snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Enrollment),
      );
      setEnrollments(enrollRows);

      const classIds = [...new Set(
        enrollRows.map((e) => String(e.classId ?? '').trim()).filter(Boolean),
      )];
      if (classIds.length === 0) {
        setClasses([]);
        return;
      }
      const classSnaps = await Promise.all(
        chunkIds(classIds).map((chunk) =>
          getDocs(query(collection(db, 'classes'), where(documentId(), 'in', chunk))),
        ),
      );
      if (cancelled) return;
      setClasses(classSnaps.flatMap((snap) =>
        snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ClassRoom),
      ));
    })().catch((err) => {
      console.warn('[useLeaveRequesterClassMap] fetch failed:', err);
    });

    return () => {
      cancelled = true;
    };
  }, [academicYearId, requesterIdKey]);

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
