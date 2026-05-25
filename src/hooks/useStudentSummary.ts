import { useState, useEffect, useCallback } from 'react';
import { collection, onSnapshot, query, where, type QueryConstraint } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface StudentSummary {
  total: number;
  early: number;
  primary: number;
  secondary: number;
  byGrade: Record<string, number>;
  loading: boolean;
}

type EnrollmentLike = {
  studentId?: string;
  departmentId?: 'early' | 'primary' | 'secondary' | string;
  gradeLevel?: string;
  semester?: number;
  enrolledAt?: string;
};

function isSemesterSupported(value?: number): value is 1 | 2 {
  return value === 1 || value === 2;
}

export function useStudentSummary(academicYearId?: string, semester?: number) {
  const [summary, setSummary] = useState<StudentSummary>({
    total: 0, early: 0, primary: 0, secondary: 0, byGrade: {}, loading: true,
  });

  const compute = useCallback(() => {
    const constraints: QueryConstraint[] = [where('status', '==', 'studying')];
    if (academicYearId) constraints.push(where('academicYearId', '==', String(academicYearId)));
    if (isSemesterSupported(semester)) constraints.push(where('semester', '==', semester));

    const q = query(collection(db, 'enrollments'), ...constraints);

    const unsub = onSnapshot(q, snap => {
      const counts = { early: 0, primary: 0, secondary: 0 };
      const byGrade: Record<string, number> = {};
      const uniqueByStudent = new Map<string, EnrollmentLike>();

      snap.docs.forEach(d => {
        const data = d.data() as EnrollmentLike;
        const key = (data.studentId && String(data.studentId).trim()) || d.id;
        const prev = uniqueByStudent.get(key);

        if (!prev) {
          uniqueByStudent.set(key, data);
          return;
        }

        // Keep the latest enrollment snapshot when duplicate rows exist.
        const prevDate = prev.enrolledAt ?? '';
        const currDate = data.enrolledAt ?? '';
        if (currDate >= prevDate) uniqueByStudent.set(key, data);
      });

      uniqueByStudent.forEach(data => {
        const dept = data.departmentId as keyof typeof counts;
        const grade = data.gradeLevel as string;
        if (dept in counts) counts[dept]++;
        if (grade) byGrade[grade] = (byGrade[grade] ?? 0) + 1;
      });

      setSummary({
        ...counts,
        total: uniqueByStudent.size,
        byGrade,
        loading: false,
      });
    }, () => {
      setSummary(prev => ({ ...prev, loading: false }));
    });

    return unsub;
  }, [academicYearId, semester]);

  useEffect(() => {
    const unsub = compute();
    return unsub;
  }, [compute]);

  return summary;
}
