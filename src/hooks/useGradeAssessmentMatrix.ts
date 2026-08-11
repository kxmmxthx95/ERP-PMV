import { useCallback, useEffect, useState } from 'react';
import { useActiveAcademicYear } from '@/hooks/useActiveAcademicYear';
import { fetchGradeAssessmentMatrix } from '@/lib/academicStats/fetchGradeAssessmentMatrix';
import type { GradeAssessmentMatrix } from '@/types/academicGradeAssessment';

/** enabled=false → ไม่ยิง query (โหลดเมื่อเปิดแท็บประเมินผลเกรด) */
export function useGradeAssessmentMatrix(enabled = true) {
  const { year, activeSemester, isLoaded } = useActiveAcademicYear();
  const semester = (activeSemester === 2 ? 2 : 1) as 1 | 2;
  const academicYearId = year || '';

  const [matrix, setMatrix] = useState<GradeAssessmentMatrix | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!academicYearId) {
      setMatrix(null);
      return null;
    }
    setLoading(true);
    setError(null);
    try {
      const next = await fetchGradeAssessmentMatrix({ academicYearId, semester });
      setMatrix(next);
      return next;
    } catch (err) {
      console.error('[useGradeAssessmentMatrix]', err);
      setError('โหลดสรุปเกรดไม่สำเร็จ');
      return null;
    } finally {
      setLoading(false);
    }
  }, [academicYearId, semester]);

  useEffect(() => {
    if (!enabled || !isLoaded || !academicYearId) {
      if (!enabled) return;
      setMatrix(null);
      return;
    }
    void reload();
  }, [enabled, isLoaded, academicYearId, semester, reload]);

  return {
    matrix,
    loading: enabled && (!isLoaded || loading),
    error,
    reload,
    academicYearId,
    semester,
  };
}
