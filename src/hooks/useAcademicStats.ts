import { useCallback, useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useActiveAcademicYear } from '@/hooks/useActiveAcademicYear';
import { rebuildAcademicStatsClient } from '@/lib/academicStats/rebuildAcademicStats';
import {
  academicStatsDocId,
  type AcademicExamType,
  type AcademicStatsDoc,
} from '@/types/academicStats';

export function useAcademicStats(examType: AcademicExamType = 'midterm') {
  const { year, activeSemester, isLoaded } = useActiveAcademicYear();
  const semester = (activeSemester === 2 ? 2 : 1) as 1 | 2;
  const academicYearId = year || '';
  const docId =
    academicYearId && isLoaded
      ? academicStatsDocId(examType, semester, academicYearId)
      : '';

  const [stats, setStats] = useState<AcademicStatsDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [rebuilding, setRebuilding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!docId) {
      setStats(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsub = onSnapshot(
      doc(db, 'academic_stats', docId),
      (snap) => {
        if (snap.exists()) {
          setStats({ id: snap.id, ...snap.data() } as AcademicStatsDoc);
        } else {
          setStats(null);
        }
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('[useAcademicStats]', err);
        setError('โหลดสรุปงานวิชาการไม่สำเร็จ');
        setLoading(false);
      },
    );
    return () => unsub();
  }, [docId]);

  const rebuild = useCallback(async () => {
    if (!academicYearId) return null;
    setRebuilding(true);
    setError(null);
    try {
      const next = await rebuildAcademicStatsClient({
        academicYearId,
        semester,
        examType,
      });
      setStats(next);
      return next;
    } catch (err) {
      console.error('[useAcademicStats] rebuild', err);
      setError('คำนวณสรุปคะแนนไม่สำเร็จ');
      return null;
    } finally {
      setRebuilding(false);
    }
  }, [academicYearId, semester, examType]);

  return {
    stats,
    loading: !isLoaded || loading,
    rebuilding,
    error,
    rebuild,
    docId,
    academicYearId,
    semester,
    examType,
  };
}
