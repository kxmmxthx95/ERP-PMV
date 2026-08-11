import { DEPARTMENT_CONFIG, type Department } from '@/types/curriculum';

export const BEHAVIOR_MIN_SEARCH_LENGTH = 6;

export const BEHAVIOR_DEPARTMENT_OPTIONS: Array<{ value: '' | Department; label: string }> = [
  { value: '', label: 'ทุกแผนก' },
  { value: 'early', label: DEPARTMENT_CONFIG.early.label },
  { value: 'primary', label: DEPARTMENT_CONFIG.primary.label },
  { value: 'secondary', label: DEPARTMENT_CONFIG.secondary.label },
];

export const BEHAVIOR_GRADES_BY_DEPARTMENT: Record<Department, string[]> = {
  early: DEPARTMENT_CONFIG.early.grades,
  primary: DEPARTMENT_CONFIG.primary.grades,
  secondary: DEPARTMENT_CONFIG.secondary.grades,
};

export type BehaviorStudentBrowseFilter = {
  department: string;
  gradeLevel: string;
  classId: string;
  searchText: string;
};

/** มีการเลือก/พิมพ์ตัวกรองอย่างน้อย 1 อย่าง — ใช้ปุ่มล้างตัวกรอง */
export function isBehaviorBrowseFilterTouched(filter: BehaviorStudentBrowseFilter): boolean {
  return Boolean(
    filter.department || filter.gradeLevel || filter.classId || filter.searchText,
  );
}

/** ครบเงื่อนไขก่อนแสดงรายชื่อ: ค้นหา หรือ เลือกแผนก+ชั้น+ห้องครบ */
export function isBehaviorBrowseFilterReady(filter: BehaviorStudentBrowseFilter): boolean {
  if (filter.searchText) return true;
  return Boolean(filter.department && filter.gradeLevel && filter.classId);
}
