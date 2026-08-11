import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useActiveAcademicYear } from '@/hooks/useActiveAcademicYear';
import {
  classMidtermReportDocId,
  type ClassMidtermReportDoc,
} from '@/types/classMidtermReport';
import type { AcademicExamType } from '@/types/academicStats';

export function useClassMidtermReport(
  classId: string | null,
  examType: AcademicExamType = 'midterm',
) {
  const { year, activeSemester, isLoaded } = useActiveAcademicYear();
  const semester = (activeSemester === 2 ? 2 : 1) as 1 | 2;
  const academicYearId = year || '';
  const docId =
    academicYearId && isLoaded && classId
      ? classMidtermReportDocId(examType, semester, academicYearId, classId)
      : '';

  const [report, setReport] = useState<ClassMidtermReportDoc | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!docId) {
      setReport(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    const unsub = onSnapshot(
      doc(db, 'class_midterm_reports', docId),
      (snap) => {
        if (snap.exists()) {
          setReport({ id: snap.id, ...snap.data() } as ClassMidtermReportDoc);
        } else {
          setReport(null);
        }
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('[useClassMidtermReport]', err);
        setError('โหลดรายงานคะแนนห้องไม่สำเร็จ');
        setLoading(false);
      },
    );
    return () => unsub();
  }, [docId]);

  return {
    report,
    loading: Boolean(classId) && (!isLoaded || loading),
    error,
    docId,
    academicYearId,
    semester,
    examType,
  };
}
