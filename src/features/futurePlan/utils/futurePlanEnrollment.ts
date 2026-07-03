import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { resolveStudentByAuthUser } from '@/lib/resolveStudentProfile';
import type { StudentFuturePlan } from '@/types/futurePlan';
import type { Enrollment } from '@/types/student';

export function pickCurrentEnrollment(
  enrollments: Enrollment[],
  academicYearId: string,
  semester: number,
): Enrollment | null {
  return (
    enrollments
      .filter((item) => item.classId)
      .sort((a, b) => {
        const yearA = Number(a.academicYearId ?? 0);
        const yearB = Number(b.academicYearId ?? 0);
        if (yearA !== yearB) return yearB - yearA;

        const semA = Number(a.semester ?? 0);
        const semB = Number(b.semester ?? 0);
        if (semA !== semB) return semB - semA;

        return (b.enrolledAt ?? '').localeCompare(a.enrolledAt ?? '');
      })
      .find(
        (item) =>
          String(item.academicYearId) === String(academicYearId)
          && Number(item.semester ?? 0) === Number(semester),
      ) ?? null
  );
}

function enrollmentKeyForPlan(
  plan: StudentFuturePlan,
  byStudentId: Map<string, Enrollment>,
  authUidToStudentId: Map<string, string>,
): Enrollment | undefined {
  const direct = byStudentId.get(plan.studentId);
  if (direct) return direct;

  const aliasedId = authUidToStudentId.get(plan.studentId);
  if (aliasedId) return byStudentId.get(aliasedId);

  return undefined;
}

function applyEnrollmentSnapshot(
  plan: StudentFuturePlan,
  enrollment: Enrollment,
): StudentFuturePlan {
  return {
    ...plan,
    gradeLevel: plan.gradeLevel?.trim() || enrollment.gradeLevel || plan.gradeLevel,
    className: plan.className?.trim() || enrollment.className || plan.className,
    classId: plan.classId?.trim() || enrollment.classId || plan.classId,
    departmentId: plan.departmentId?.trim() || enrollment.departmentId || plan.departmentId,
  };
}

export async function fetchCurrentEnrollmentForStudent(
  studentId: string,
  academicYearId: string,
  semester: number,
): Promise<Enrollment | null> {
  const snap = await getDocs(
    query(collection(db, 'enrollments'), where('studentId', '==', studentId)),
  );
  const enrollments = snap.docs.map(
    (docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as Enrollment,
  );
  return pickCurrentEnrollment(enrollments, academicYearId, semester);
}

export async function enrichPlansWithEnrollments(
  plans: StudentFuturePlan[],
  academicYearId: string,
  semester: number,
): Promise<StudentFuturePlan[]> {
  if (plans.length === 0) return plans;

  const yearEnrollments = (
    await getDocs(
      query(collection(db, 'enrollments'), where('academicYearId', '==', String(academicYearId))),
    )
  ).docs
    .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as Enrollment)
    .filter((item) => Number(item.semester ?? 0) === Number(semester));

  const byStudentId = new Map<string, Enrollment>();
  for (const enrollment of yearEnrollments) {
    if (enrollment.studentId) byStudentId.set(enrollment.studentId, enrollment);
  }

  const needsAlias = plans.filter(
    (plan) =>
      !plan.gradeLevel?.trim()
      || !plan.className?.trim()
      || !plan.departmentId?.trim(),
  );

  const planByStudentId = new Map(needsAlias.map((plan) => [plan.studentId, plan]));
  const authUidToStudentId = new Map<string, string>();
  await Promise.all(
    [...new Set(needsAlias.map((plan) => plan.studentId))].map(async (studentId) => {
      if (byStudentId.has(studentId)) return;
      const plan = planByStudentId.get(studentId);
      const resolved = await resolveStudentByAuthUser(studentId, {
        studentCode: plan?.studentCode,
      });
      if (resolved?.id && byStudentId.has(resolved.id)) {
        authUidToStudentId.set(studentId, resolved.id);
      }
    }),
  );

  return plans.map((plan) => {
    const hasSnapshot =
      Boolean(plan.gradeLevel?.trim())
      && Boolean(plan.className?.trim())
      && Boolean(plan.departmentId?.trim());
    if (hasSnapshot) return plan;

    const enrollment = enrollmentKeyForPlan(plan, byStudentId, authUidToStudentId);
    if (!enrollment) return plan;
    return applyEnrollmentSnapshot(plan, enrollment);
  });
}
