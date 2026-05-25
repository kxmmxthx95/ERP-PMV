import { useCallback } from 'react';
import type { AcademicYear } from '@/types/settings';

/**
 * Hook to access the currently active academic year and semester.
 *
 * This hook retrieves the active academic year from localStorage (set by SysAdminSettings).
 * The active year and semester are used as primary filters across the entire app:
 * - Grades queries (all grade entries are filtered by year + semester)
 * - Attendance records (filtered by year + semester)
 * - Schedules (filtered by year + semester)
 *
 * @returns {object} { activeYear, activeSemester, isLoaded }
 *   - activeYear: Current academic year object or null if not set
 *   - activeSemester: Current semester (1, 2, or 3) or null
 *   - isLoaded: Whether the data has been loaded from localStorage
 */
export function useActiveAcademicYear() {
  const getActiveYear = useCallback((): AcademicYear | null => {
    try {
      const stored = localStorage.getItem('activeAcademicYear');
      if (stored) return JSON.parse(stored);
      
      // Fallback to current year if nothing in localStorage
      const now = new Date();
      const currentYearBE = now.getFullYear() + 543;
      return {
        id: 'default',
        year: currentYearBE.toString(),
        activeSemester: 1,
        startDate: '',
        endDate: '',
        status: 'active'
      };
    } catch {
      return null;
    }
  }, []);

  const activeYear = getActiveYear();

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
      status: 'active'
    };
    localStorage.setItem('activeAcademicYear', JSON.stringify(academicYear));
  } else if (year) {
    localStorage.setItem('activeAcademicYear', JSON.stringify(year));
  } else {
    localStorage.removeItem('activeAcademicYear');
  }
  // Trigger a global reload to refresh all data
  window.location.reload();
}
