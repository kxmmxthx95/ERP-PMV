import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  serverTimestamp,
  query,
  where,
  orderBy,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { useActiveAcademicYear } from '@/hooks/useActiveAcademicYear';
import type { StudentFuturePlan, FuturePlanFormData } from '@/types/futurePlan';

const COL = 'student_future_plans';

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
      return { id: snap.id, ...snap.data() } as StudentFuturePlan;
    },
    enabled: !!user?.uid,
  });
}

// ── Admin/Teacher: read all plans (optionally filtered by academicYearId) ─────
export function useAllFuturePlans(filters?: { gradeLevel?: string; departmentId?: string }) {
  const { year } = useActiveAcademicYear();

  return useQuery<StudentFuturePlan[]>({
    queryKey: ['futurePlan', 'all', year, filters?.gradeLevel, filters?.departmentId],
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
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as StudentFuturePlan);
    },
    enabled: !!year,
  });
}

// ── Mutation: save / update a plan ────────────────────────────────────────────
export function useSaveFuturePlan() {
  const { user, userData, role } = useAuth();
  const { year } = useActiveAcademicYear();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      form,
      studentSnapshot,
    }: {
      form: FuturePlanFormData;
      studentSnapshot?: Partial<Pick<StudentFuturePlan, 'studentCode' | 'classId' | 'className' | 'gradeLevel' | 'departmentId'>>;
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
      const studentSnap = await getDoc(doc(db, 'students', user.uid));
      const studentDocData = studentSnap.exists() ? (studentSnap.data() as Record<string, unknown>) : {};

      const studentName =
        userData?.firstName
          ? `${userData.prefix ?? ''}${userData.firstName} ${userData.lastName ?? ''}`.trim()
          : (user.displayName ?? user.email ?? 'ไม่ระบุ');

      const normalizedChoices =
        form.planType === 'continue'
          ? form.universityChoices
              .map((choice, idx) => ({
                ...choice,
                rank: idx + 1,
                universityName: choice.universityName?.trim() ?? '',
                faculty: choice.faculty?.trim() ?? '',
                program: choice.program?.trim() ?? '',
                entranceMethod: choice.entranceMethod?.trim() ?? '',
                country: choice.country?.trim() ?? '',
              }))
              .filter((c) => c.universityName || c.faculty || c.program)
          : [];

      const payload: Omit<StudentFuturePlan, 'id' | 'createdAt' | 'updatedAt'> & {
        createdAt?: unknown;
        updatedAt: unknown;
      } = {
        studentId: user.uid,
        studentName,
        studentCode: (studentSnapshot?.studentCode ?? userData?.studentCode ?? studentDocData.studentCode ?? '').toString(),
        classId: (studentSnapshot?.classId ?? studentDocData.classId ?? '').toString(),
        className: (studentSnapshot?.className ?? studentDocData.className ?? '').toString(),
        gradeLevel: (studentSnapshot?.gradeLevel ?? studentDocData.gradeLevel ?? '').toString(),
        departmentId: (studentSnapshot?.departmentId ?? studentDocData.departmentId ?? '').toString(),
        academicYearId: String(year),
        lifeGoal: form.lifeGoal,
        desiredCareer: form.desiredCareer,
        planType: form.planType,
        studyLocation: form.planType === 'continue' ? form.studyLocation : undefined,
        universityChoices: normalizedChoices,
        updatedAt: serverTimestamp(),
      };

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
