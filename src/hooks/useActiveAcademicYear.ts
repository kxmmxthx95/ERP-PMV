import { useState, useMemo, useEffect } from 'react';
import type { AcademicYear } from '@/types/settings';

export const ACTIVE_ACADEMIC_YEAR_EVENT = 'activeAcademicYearUpdated';

export function notifyActiveAcademicYearChanged() {
  window.dispatchEvent(new Event(ACTIVE_ACADEMIC_YEAR_EVENT));
}

function readActiveYearFromStorage(): AcademicYear | null {
  try {
    const stored = localStorage.getItem('activeAcademicYear');
    if (stored) return JSON.parse(stored) as AcademicYear;

    const now = new Date();
    const currentYearBE = now.getFullYear() + 543;
    return {
      id: currentYearBE.toString(),
      year: currentYearBE.toString(),
      activeSemester: 1,
      startDate: '',
      endDate: '',
      status: 'active',
    };
  } catch {
    return null;
  }
}

/**
 * Hook to access the currently active academic year and semester.
 *
 * Sync จาก Firestore (`settings/academic_year`) หลัง login แล้วจะ dispatch
 * ACTIVE_ACADEMIC_YEAR_EVENT — hook นี้จะ re-read localStorage อัตโนมัติ
 */
export function useActiveAcademicYear() {
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const bump = () => setRevision((v) => v + 1);
    window.addEventListener(ACTIVE_ACADEMIC_YEAR_EVENT, bump);
    window.addEventListener('storage', bump);
    return () => {
      window.removeEventListener(ACTIVE_ACADEMIC_YEAR_EVENT, bump);
      window.removeEventListener('storage', bump);
    };
  }, []);

  const activeYear = useMemo(() => readActiveYearFromStorage(), [revision]);

  return {
    activeYear,
    activeSemester: activeYear?.activeSemester ?? 1,
    year: activeYear?.year ?? (new Date().getFullYear() + 543).toString(),
    isLoaded: activeYear !== null,
  };
}

/**
 * Helper function to set the active academic year in localStorage.
 * Called by SysAdminSettings or Global Year Selector.
 */
export function setActiveAcademicYear(year: AcademicYear | string | null) {
  if (typeof year === 'string') {
    const academicYear: AcademicYear = {
      id: year,
      year: year,
      activeSemester: 1,
      startDate: '',
      endDate: '',
      status: 'active',
    };
    localStorage.setItem('activeAcademicYear', JSON.stringify(academicYear));
  } else if (year) {
    localStorage.setItem('activeAcademicYear', JSON.stringify(year));
  } else {
    localStorage.removeItem('activeAcademicYear');
  }
  notifyActiveAcademicYearChanged();
  window.location.reload();
}
