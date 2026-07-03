export type UserListCategory = 'student' | 'teacher' | 'special_teacher' | 'staff';

export const USER_LIST_CATEGORIES: {
  id: UserListCategory;
  label: string;
  shortLabel: string;
}[] = [
  { id: 'student', label: 'นักเรียน', shortLabel: 'นร.' },
  { id: 'teacher', label: 'ครูผู้สอน', shortLabel: 'ครู' },
  { id: 'special_teacher', label: 'ครูพิเศษ', shortLabel: 'พิเศษ' },
  { id: 'staff', label: 'เจ้าหน้าที่', shortLabel: 'จนท.' },
];

export function resolveUserListCategory(role: string, position?: string | null): UserListCategory {
  if (role === 'student') return 'student';
  if (role === 'teacher') {
    const pos = (position ?? '').trim();
    if (pos === 'ครูพิเศษ' || pos.includes('พิเศษ')) return 'special_teacher';
    return 'teacher';
  }
  return 'staff';
}

export function filterUsersByCategory<T extends { category?: UserListCategory }>(
  users: T[],
  category: UserListCategory | null,
): T[] {
  if (!category) return [];
  return users.filter((u) => u.category === category);
}
