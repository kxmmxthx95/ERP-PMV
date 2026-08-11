import { DEPARTMENT_CONFIG, type Department } from '@/types/curriculum';
import type { TeacherProfile } from '@/types/teacher';

export function parseDepartment(raw: string | undefined | null): Department | null {
  const value = String(raw ?? '').trim();
  if (value === 'early' || value === 'primary' || value === 'secondary') return value;
  const byLabel = (Object.entries(DEPARTMENT_CONFIG) as [Department, (typeof DEPARTMENT_CONFIG)[Department]][])
    .find(([, cfg]) => cfg.label === value);
  if (byLabel) return byLabel[0];
  return null;
}

export function resolveHomeDepartment(
  role: string | null | undefined,
  options: {
    teacher?: TeacherProfile | null;
    userData?: Record<string, unknown> | null;
  },
): Department | null {
  if (role !== 'teacher' && role !== 'student') return null;
  const fromTeacher = parseDepartment(options.teacher?.department);
  if (fromTeacher) return fromTeacher;
  const ud = options.userData;
  return (
    parseDepartment(String(ud?.departmentId ?? ''))
    ?? parseDepartment(String(ud?.department ?? ''))
  );
}

/** Teacher/student: single home dept only. Admin/staff: undefined → all depts. */
export function getBrowseVisibleDepartments(
  role: string | null | undefined,
  homeDepartment: Department | null,
): Department[] | undefined {
  if (role !== 'teacher' && role !== 'student') return undefined;
  return homeDepartment ? [homeDepartment] : [];
}

export function shouldCountDepartment(
  dept: Department,
  homeDepartment: Department | null,
  scoped: boolean,
): boolean {
  if (!scoped) return true;
  if (!homeDepartment) return false;
  return dept === homeDepartment;
}
