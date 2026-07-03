import type { TeacherProfile } from '@/types/teacher';

/** ครูพิเศษ — ไม่บังคับเวลาเช็คอิน (ไม่นับสาย / ไม่ขาดจากเวลา) */
export function isSpecialTeacherPosition(position?: string | null): boolean {
  const pos = (position ?? '').trim();
  return pos === 'ครูพิเศษ' || pos.includes('พิเศษ');
}

export function buildTeacherPositionByUserId(teachers: TeacherProfile[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const teacher of teachers) {
    const position = teacher.position ?? '';
    map.set(teacher.id, position);
    const userId = teacher.userId?.trim();
    if (userId) map.set(userId, position);
  }
  return map;
}

export function isSpecialTeacherUser(
  userId: string,
  positionByUserId: Map<string, string>,
): boolean {
  return isSpecialTeacherPosition(positionByUserId.get(userId));
}
