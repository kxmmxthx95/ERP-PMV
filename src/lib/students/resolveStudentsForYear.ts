import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { chunkIds, fetchStudentsByIds } from '@/lib/firestoreShared/fetchStudentsByIds';
import type { ClassLike, EnrollmentLike, StudentLike } from '@/lib/firestoreShared/studentSummaryStore';

function enrollmentMatchesYear(e: EnrollmentLike, yearId: string): boolean {
  return (
    String(e.academicYearId ?? '') === String(yearId) ||
    String(e.academicYear ?? '') === String(yearId)
  );
}

function classMatchesYear(cls: ClassLike, yearId: string): boolean {
  return (
    String(cls.academicYearId ?? '') === String(yearId) ||
    String(cls.academicYear ?? '') === String(yearId)
  );
}

/** Stable key — re-fetch only when enrollment/class/student id sets change, not on every snapshot reference. */
export function buildResolveStudentsCacheKey(
  academicYearId: string,
  enrollments: EnrollmentLike[],
  classes: ClassLike[],
  yearPartitionedStudents: StudentLike[],
): string {
  const enrollmentIds = enrollments
    .filter((e) => e.studentId && enrollmentMatchesYear(e, academicYearId))
    .map((e) => String(e.studentId))
    .sort()
    .join(',');

  const classMeta = classes
    .filter((c) => classMatchesYear(c, academicYearId))
    .map((c) => `${c.id}:${[...(c.studentIds ?? [])].sort().join('+')}`)
    .sort()
    .join('|');

  const yearStudentIds = yearPartitionedStudents
    .map((s) => s.id)
    .sort()
    .join(',');

  return `${academicYearId}::${enrollmentIds}::${classMeta}::${yearStudentIds}`;
}

/** Load student docs for a year — same merge strategy as useStudentManager.loadStudentsForYear. */
export async function resolveStudentsForYear(
  academicYearId: string,
  enrollments: EnrollmentLike[],
  classes: ClassLike[],
  yearPartitionedStudents: StudentLike[],
): Promise<StudentLike[]> {
  const studentMap = new Map<string, StudentLike>();

  yearPartitionedStudents.forEach((s) => studentMap.set(s.id, s));

  const studentIds = new Set<string>();
  enrollments.forEach((e) => {
    if (e.studentId && enrollmentMatchesYear(e, academicYearId)) {
      studentIds.add(String(e.studentId));
    }
  });
  classes.forEach((cls) => {
    if (!classMatchesYear(cls, academicYearId)) return;
    cls.studentIds?.forEach((id) => {
      if (id) studentIds.add(String(id));
    });
  });

  const missingIds = [...studentIds].filter((id) => !studentMap.has(id));
  if (missingIds.length > 0) {
    const fetched = await fetchStudentsByIds<StudentLike>(missingIds);
    fetched.forEach((s) => studentMap.set(s.id, s));
  }

  const classIds = classes
    .filter((c) => classMatchesYear(c, academicYearId))
    .map((c) => c.id)
    .filter(Boolean);

  for (const group of chunkIds(classIds)) {
    const [byClassId, byClassroomId] = await Promise.all([
      getDocs(query(collection(db, 'students'), where('classId', 'in', group))),
      getDocs(query(collection(db, 'students'), where('classroomId', 'in', group))),
    ]);
    [...byClassId.docs, ...byClassroomId.docs].forEach((docSnap) => {
      studentMap.set(docSnap.id, { id: docSnap.id, ...docSnap.data() } as StudentLike);
    });
  }

  return [...studentMap.values()];
}

export function isStudentVisibleForYear(
  student: StudentLike,
  academicYearId: string,
  enrolledStudentIds: Set<string>,
  classById: Map<string, ClassLike>,
): boolean {
  if (enrolledStudentIds.has(student.id)) return true;

  const classroomId = student.classroomId ?? student.classId;
  if (classroomId) {
    const cls = classById.get(String(classroomId));
    if (cls && classMatchesYear(cls, academicYearId)) return true;
  }

  const currentYear = student.academicYearId ?? student.academicYear;
  return !!currentYear && String(currentYear) === String(academicYearId);
}
