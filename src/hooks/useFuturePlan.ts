import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  serverTimestamp,
  deleteField,
  query,
  where,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { resolveStudentByAuthUser } from '@/lib/resolveStudentProfile';
import {
  enrichPlansWithEnrollments,
  fetchCurrentEnrollmentForStudent,
} from '@/features/futurePlan/utils/futurePlanEnrollment';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { useActiveAcademicYear } from '@/hooks/useActiveAcademicYear';
import type { StudentFuturePlan, FuturePlanFormData, UniversityChoice } from '@/types/futurePlan';

const COL = 'student_future_plans';

async function resolveStudentProfileSnapshot(studentId: string): Promise<{
  photoURL?: string;
  gender?: StudentFuturePlan['gender'];
}> {
  const studentSnap = await getDoc(doc(db, 'students', studentId));
  if (studentSnap.exists()) {
    const data = studentSnap.data() as { photoURL?: string; gender?: StudentFuturePlan['gender'] };
    return { photoURL: data.photoURL, gender: data.gender };
  }

  const userSnap = await getDoc(doc(db, 'users', studentId));
  if (userSnap.exists()) {
    const data = userSnap.data() as { photoURL?: string; gender?: StudentFuturePlan['gender'] };
    return { photoURL: data.photoURL, gender: data.gender };
  }

  return {};
}

async function enrichPlansWithProfiles(plans: StudentFuturePlan[]): Promise<StudentFuturePlan[]> {
  const idsToLookup = [
    ...new Set(plans.filter((p) => !p.photoURL).map((p) => p.studentId)),
  ];
  if (idsToLookup.length === 0) return plans;

  const profileById = new Map<string, { photoURL?: string; gender?: StudentFuturePlan['gender'] }>();
  await Promise.all(
    idsToLookup.map(async (studentId) => {
      const profile = await resolveStudentProfileSnapshot(studentId);
      profileById.set(studentId, profile);
    }),
  );

  return plans.map((plan) => {
    const profile = profileById.get(plan.studentId);
    if (!profile) return plan;
    return {
      ...plan,
      photoURL: plan.photoURL ?? profile.photoURL,
      gender: plan.gender ?? profile.gender,
    };
  });
}

function timestampToIsoString(ts: unknown): string {
  if (ts == null) return '';
  if (ts instanceof Timestamp) return ts.toDate().toISOString();
  if (typeof ts === 'object') {
    const obj = ts as { toDate?: () => Date; seconds?: number; nanoseconds?: number };
    if (typeof obj.toDate === 'function') return obj.toDate().toISOString();
    if (typeof obj.seconds === 'number') {
      return new Date(obj.seconds * 1000 + (obj.nanoseconds ?? 0) / 1_000_000).toISOString();
    }
  }
  if (typeof ts === 'number' || typeof ts === 'string') {
    const d = new Date(ts);
    return Number.isNaN(d.getTime()) ? '' : d.toISOString();
  }
  return '';
}

function mapFuturePlanDoc(id: string, data: Record<string, unknown>): StudentFuturePlan {
  const createdAt = timestampToIsoString(data.createdAt);
  const updatedAt = timestampToIsoString(data.updatedAt);
  return {
    ...(data as Omit<StudentFuturePlan, 'id' | 'createdAt' | 'updatedAt'>),
    id,
    createdAt,
    updatedAt,
  };
}

function normalizeUniversityChoice(choice: UniversityChoice): UniversityChoice {
  const normalized: UniversityChoice = {
    rank: choice.rank,
    universityName: choice.universityName?.trim() ?? '',
    faculty: choice.faculty?.trim() ?? '',
    program: choice.program?.trim() ?? '',
    entranceMethod: choice.entranceMethod?.trim() ?? '',
    country: choice.country?.trim() ?? '',
  };
  const domain = choice.universityDomain?.trim();
  if (domain) normalized.universityDomain = domain;
  return normalized;
}

// ── Student: read own plan ────────────────────────────────────────────────────
export function useMyFuturePlan() {
  const { user } = useAuth();
  const { year } = useActiveAcademicYear();

  return useQuery<StudentFuturePlan | null>({
    queryKey: ['futurePlan', 'my', user?.uid, year],
    queryFn: async () => {
      if (!user?.uid) return null;
      // doc ID = studentId (one plan per student, master data)
      const snap = await getDoc(doc(db, COL, user.uid));
      if (!snap.exists()) return null;
      return mapFuturePlanDoc(snap.id, snap.data() as Record<string, unknown>);
    },
    enabled: !!user?.uid,
  });
}

// ── Admin/Teacher: read all plans (optionally filtered by academicYearId) ─────
export function useAllFuturePlans(filters?: { gradeLevel?: string; departmentId?: string }) {
  const { year, activeSemester } = useActiveAcademicYear();

  return useQuery<StudentFuturePlan[]>({
    queryKey: ['futurePlan', 'all', year, activeSemester, filters?.gradeLevel, filters?.departmentId],
    queryFn: async () => {
      let q = query(collection(db, COL), where('academicYearId', '==', year));

      if (filters?.gradeLevel) {
        q = query(q, where('gradeLevel', '==', filters.gradeLevel));
      }
      if (filters?.departmentId) {
        q = query(q, where('departmentId', '==', filters.departmentId));
      }

      // order by student name for consistent listing
      q = query(q, orderBy('studentName'));

      const snap = await getDocs(q);
      const plans = snap.docs.map((d) => mapFuturePlanDoc(d.id, d.data() as Record<string, unknown>));
      const withProfiles = await enrichPlansWithProfiles(plans);
      return enrichPlansWithEnrollments(withProfiles, String(year), activeSemester);
    },
    enabled: !!year,
  });
}

// ── Mutation: save / update a plan ────────────────────────────────────────────
export function useSaveFuturePlan() {
  const { user, userData, role } = useAuth();
  const { year, activeSemester } = useActiveAcademicYear();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      form,
      studentSnapshot,
    }: {
      form: FuturePlanFormData;
      studentSnapshot?: Partial<
        Pick<StudentFuturePlan, 'studentCode' | 'classId' | 'className' | 'gradeLevel' | 'departmentId' | 'photoURL' | 'gender'>
      >;
    }) => {
      if (!user?.uid) throw new Error('ไม่พบข้อมูลผู้ใช้');
      const effectiveRole = (role ?? userData?.role ?? '').toString();
      if (effectiveRole !== 'student') {
        throw new Error('ฟีเจอร์นี้อนุญาตให้บันทึกเฉพาะบัญชีนักเรียนเท่านั้น');
      }
      if (!year) {
        throw new Error('ไม่พบปีการศึกษาที่กำลังใช้งาน');
      }

      const docRef = doc(db, COL, user.uid);
      const existing = await getDoc(docRef);
      const resolvedStudent = await resolveStudentByAuthUser(user.uid, {
        studentCode: typeof userData?.studentCode === 'string' ? userData.studentCode : undefined,
        email: user.email ?? undefined,
      });
      const studentDocData = resolvedStudent
        ? (resolvedStudent as unknown as Record<string, unknown>)
        : {};
      const studentGender =
        (studentSnapshot?.gender ??
          studentDocData.gender ??
          userData?.gender) as StudentFuturePlan['gender'] | undefined;
      const studentPhotoURL =
        (studentSnapshot?.photoURL ??
          studentDocData.photoURL ??
          userData?.photoURL) as string | undefined;

      const studentName =
        userData?.firstName
          ? `${userData.prefix ?? ''}${userData.firstName} ${userData.lastName ?? ''}`.trim()
          : (user.displayName ?? user.email ?? 'ไม่ระบุ');

      const enrollmentStudentId = resolvedStudent?.id ?? user.uid;
      const enrollment = await fetchCurrentEnrollmentForStudent(
        enrollmentStudentId,
        String(year),
        activeSemester,
      );

      const normalizedChoices =
        form.planType === 'continue'
          ? form.universityChoices
              .map(normalizeUniversityChoice)
              .filter((c) => c.universityName || c.faculty || c.program)
              .sort((a, b) => a.rank - b.rank)
          : [];

      const payload: Record<string, unknown> = {
        studentId: user.uid,
        studentName,
        studentCode: (studentSnapshot?.studentCode ?? userData?.studentCode ?? studentDocData.studentCode ?? '').toString(),
        classId: (studentSnapshot?.classId ?? enrollment?.classId ?? studentDocData.classId ?? '').toString(),
        className: (studentSnapshot?.className ?? enrollment?.className ?? studentDocData.className ?? '').toString(),
        gradeLevel: (studentSnapshot?.gradeLevel ?? enrollment?.gradeLevel ?? studentDocData.gradeLevel ?? '').toString(),
        departmentId: (studentSnapshot?.departmentId ?? enrollment?.departmentId ?? studentDocData.departmentId ?? '').toString(),
        academicYearId: String(year),
        lifeGoal: form.lifeGoal.trim(),
        desiredCareer: form.desiredCareer.trim(),
        planType: form.planType,
        updatedAt: serverTimestamp(),
      };

      if (studentPhotoURL) payload.photoURL = studentPhotoURL;
      if (studentGender) payload.gender = studentGender;

      if (form.planType === 'continue') {
        payload.studyLocation = form.studyLocation;
        payload.universityChoices = normalizedChoices;
        payload.notContinueReason = deleteField();
      } else {
        payload.notContinueReason = form.notContinueReason.trim();
        payload.universityChoices = [];
        payload.studyLocation = deleteField();
      }

      if (!existing.exists()) {
        payload.createdAt = serverTimestamp();
      }

      await setDoc(docRef, payload, { merge: true });
    },
    onSuccess: (_, { }) => {
      qc.invalidateQueries({ queryKey: ['futurePlan'] });
    },
  });
}
