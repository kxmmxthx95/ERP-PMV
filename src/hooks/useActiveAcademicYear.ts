import { useCallback } from 'react';
import type { AcademicYear } from '@/portals/sysadmin/settings/types';

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
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }, []);

  const activeYear = getActiveYear();

  return {
    activeYear,
    activeSemester: activeYear?.activeSemester ?? null,
    year: activeYear?.year ?? null,
    isLoaded: activeYear !== null,
  };
}

/**
 * Helper function to set the active academic year in localStorage.
 * Called by SysAdminSettings when user selects an active year.
 */
export function setActiveAcademicYear(year: AcademicYear | null) {
  if (year) {
    localStorage.setItem('activeAcademicYear', JSON.stringify(year));
  } else {
    localStorage.removeItem('activeAcademicYear');
  }
}
