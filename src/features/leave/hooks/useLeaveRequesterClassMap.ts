import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { collection, documentId, getDocs, limit, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { chunkIds } from '@/lib/firestoreShared/fetchStudentsByIds';
import { resolveStudentClassDisplayName, resolveEnrollmentClassId } from '@/lib/students/classRoster';
import { resolveHomeroomTeachers } from '@/features/classes/utils/homeroomTeachers';
import { inferDepartmentFromGradeLevel } from '@/lib/school/gradeLevelBadge';
import { resolveStudentByAuthUser } from '@/lib/resolveStudentProfile';
import { teachersCollectionStore } from '@/lib/firestoreShared/teachersStore';
import type { ClassRoom } from '@/types/class';
import type { Department } from '@/types/curriculum';
import type { Enrollment, Student } from '@/types/student';
import type { TeacherProfile } from '@/types/teacher';

export type LeaveRequesterProfile = {
  gradeLevel: string;
  className: string;
  classId: string;
  departmentId: Department | null;
  approverNames: string[];
};

type ResolvedRequester = {
  requesterId: string;
  student: Student & { classroomId?: string; classId?: string; gradeLevel?: string };
};

const noopSubscribe = () => () => {};
const readySnapshot = () => true;
const EMPTY_REQUESTER_MAP = new Map<string, string>();
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

function enrollmentMatchesYear(enrollment: Enrollment, yearId: string): boolean {
  const legacyYear = normalizeText((enrollment as Enrollment & { academicYear?: string }).academicYear);
  return normalizeText(enrollment.academicYearId) === String(yearId) || legacyYear === String(yearId);
}

function pickYearEnrollment(enrollments: Enrollment[], yearId: string): Enrollment | null {
  const yearRows = enrollments.filter((row) => enrollmentMatchesYear(row, yearId));
  const studying = yearRows.filter((row) => (row.status ?? 'studying') === 'studying');
  const pool = studying.length > 0 ? studying : yearRows;
  if (pool.length === 0) return null;
  return [...pool].sort((a, b) => (b.enrolledAt ?? '').localeCompare(a.enrolledAt ?? ''))[0];
}

async function resolveRequesterStudents(
  requesterIds: string[],
  studentCodesByRequester: Record<string, string | undefined>,
): Promise<ResolvedRequester[]> {
  const rows = await Promise.all(
    requesterIds.map(async (requesterId) => {
      const code = normalizeText(studentCodesByRequester[requesterId]);
      let student = await resolveStudentByAuthUser(requesterId, {
        studentCode: code || undefined,
      });

      if (!student && code && /^\d+$/.test(code)) {
        const byStringCode = await getDocs(
          query(collection(db, 'students'), where('studentCode', '==', code), limit(1)),
        );
        if (!byStringCode.empty) {
          const row = byStringCode.docs[0];
          student = { id: row.id, ...row.data() } as Student;
        } else {
          const byNumericCode = await getDocs(
            query(collection(db, 'students'), where('studentCode', '==', Number(code)), limit(1)),
          );
          if (!byNumericCode.empty) {
            const row = byNumericCode.docs[0];
            student = { id: row.id, ...row.data() } as Student;
          }
        }
      }

      if (!student) return null;
      return { requesterId, student };
    }),
  );

  return rows.filter((row): row is ResolvedRequester => row !== null);
}

function buildLeaveRequesterProfile(
  enrollment: Enrollment,
  academicYearId: string,
  classRows: ClassRoom[],
  teacherRows: TeacherProfile[],
): LeaveRequesterProfile {
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

  return {
    gradeLevel,
    className: className || gradeLevel,
    classId: resolvedClassId ?? '',
    departmentId,
    approverNames,
  };
}

function buildLeaveRequesterProfileFromClass(
  classRoom: ClassRoom,
  teacherRows: TeacherProfile[],
): LeaveRequesterProfile {
  const className = normalizeText(classRoom.className);
  const gradeLevel =
    normalizeText(classRoom.gradeLevel)
    || (className.includes('/') ? className.split('/')[0] : '');

  const approverNames = resolveHomeroomTeachers(classRoom, teacherRows)
    .map((teacher) => normalizeText(teacher.name))
    .filter(Boolean);

  const departmentId: Department | null =
    classRoom.departmentId
    || classRoom.department
    || (gradeLevel ? inferDepartmentFromGradeLevel(gradeLevel) : null)
    || null;

  return {
    gradeLevel,
    className: className || gradeLevel,
    classId: classRoom.id,
    departmentId,
    approverNames,
  };
}

/** Map student requesterId → grade/class for leave cards (enrollment snapshot). */
export function useLeaveRequesterClassMap(
  academicYearId: string | undefined,
  requesterIds: string[],
  requesterStudentCodes: Record<string, string | undefined> = {},
): Map<string, LeaveRequesterProfile> {
  const { rows: teachers } = useSharedStoreRows(teachersCollectionStore);

  const requesterIdKey = useMemo(
    () => [...new Set(requesterIds.filter(Boolean))].sort().join(','),
    [requesterIds],
  );

  const studentCodeKey = useMemo(
    () => Object.entries(requesterStudentCodes)
      .filter(([, code]) => normalizeText(code))
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([id, code]) => `${id}:${code}`)
      .join('|'),
    [requesterStudentCodes],
  );

  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [requesterToStudentId, setRequesterToStudentId] = useState(EMPTY_REQUESTER_MAP);
  const [studentFallbackClassIds, setStudentFallbackClassIds] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!academicYearId || !requesterIdKey) {
      setEnrollments([]);
      setClasses([]);
      setRequesterToStudentId(EMPTY_REQUESTER_MAP);
      setStudentFallbackClassIds({});
      return;
    }

    let cancelled = false;
    const requesterKeys = requesterIdKey.split(',');

    void (async () => {
      const resolvedRows = await resolveRequesterStudents(requesterKeys, requesterStudentCodes);
      if (cancelled) return;

      const resolvedMap = new Map(
        resolvedRows.map(({ requesterId, student }) => [requesterId, student.id] as const),
      );
      setRequesterToStudentId(resolvedMap);

      const fallbackClassIds: Record<string, string> = {};
      resolvedRows.forEach(({ requesterId, student }) => {
        const classId = normalizeText(student.classroomId || student.classId);
        if (classId) fallbackClassIds[requesterId] = classId;
      });
      setStudentFallbackClassIds(fallbackClassIds);

      const canonicalStudentIds = [...new Set(resolvedMap.values())];
      if (canonicalStudentIds.length === 0) {
        setEnrollments([]);
        setClasses([]);
        return;
      }

      const enrollSnaps = await Promise.all(
        chunkIds(canonicalStudentIds).map((chunk) =>
          getDocs(query(
            collection(db, 'enrollments'),
            where('studentId', 'in', chunk),
          )),
        ),
      );
      if (cancelled) return;
      const enrollRows = enrollSnaps.flatMap((snap) =>
        snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Enrollment),
      );
      setEnrollments(enrollRows);

      const classIds = new Set<string>();
      enrollRows.forEach((row) => {
        const classId = normalizeText(row.classId);
        if (classId) classIds.add(classId);
      });
      Object.values(fallbackClassIds).forEach((classId) => {
        if (classId) classIds.add(classId);
      });

      if (classIds.size === 0) {
        setClasses([]);
        return;
      }

      const classSnaps = await Promise.all(
        chunkIds([...classIds]).map((chunk) =>
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
  }, [academicYearId, requesterIdKey, studentCodeKey]);

  return useMemo(() => {
    const map = new Map<string, LeaveRequesterProfile>();
    if (!academicYearId || !requesterIdKey) return map;

    const classRows = classes as unknown as ClassRoom[];
    const teacherRows = teachers as TeacherProfile[];
    const enrollmentsByStudent = new Map<string, Enrollment[]>();

    (enrollments as Enrollment[]).forEach((enrollment) => {
      const studentId = normalizeText(enrollment.studentId);
      if (!studentId) return;
      const rows = enrollmentsByStudent.get(studentId) ?? [];
      rows.push(enrollment);
      enrollmentsByStudent.set(studentId, rows);
    });

    requesterToStudentId.forEach((studentId, requesterId) => {
      const yearEnrollment = pickYearEnrollment(enrollmentsByStudent.get(studentId) ?? [], academicYearId);
      if (yearEnrollment) {
        map.set(
          requesterId,
          buildLeaveRequesterProfile(yearEnrollment, academicYearId, classRows, teacherRows),
        );
        return;
      }

      const fallbackClassId = normalizeText(studentFallbackClassIds[requesterId]);
      if (!fallbackClassId) return;

      const classRoom = classRows.find((row) => String(row.id) === fallbackClassId);
      if (!classRoom) return;

      map.set(requesterId, buildLeaveRequesterProfileFromClass(classRoom, teacherRows));
    });

    return map;
  }, [
    academicYearId,
    requesterIdKey,
    enrollments,
    classes,
    teachers,
    requesterToStudentId,
    studentFallbackClassIds,
  ]);
}
