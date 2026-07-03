import type { Gender } from '@/types/student';

const FEMALE_PREFIXES = ['เด็กหญิง', 'ด.ญ.', 'นางสาว', 'น.ส.', 'นาง', 'ว่าที่ร.ต.หญิง'] as const;
const MALE_PREFIXES = ['เด็กชาย', 'ด.ช.', 'นาย', 'ว่าที่ร.ต.'] as const;

export function resolveStudentGender(
  student: { gender?: Gender | string | null; prefix?: string | null },
): Gender | null {
  if (student.gender === 'male' || student.gender === 'female') {
    return student.gender;
  }

  const prefix = String(student.prefix ?? '').trim();
  if (!prefix) return null;

  if (FEMALE_PREFIXES.includes(prefix as (typeof FEMALE_PREFIXES)[number])) return 'female';
  if (MALE_PREFIXES.includes(prefix as (typeof MALE_PREFIXES)[number])) return 'male';

  return null;
}

export function isMaleStudent(
  student: { gender?: Gender | string | null; prefix?: string | null },
): boolean {
  return resolveStudentGender(student) === 'male';
}

export function isFemaleStudent(
  student: { gender?: Gender | string | null; prefix?: string | null },
): boolean {
  return resolveStudentGender(student) === 'female';
}
