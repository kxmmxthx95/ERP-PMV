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
