/** ล้าง in-memory snapshot ของ shared stores ตอน login ใหม่ — ป้องกัน fallback ว่างค้าง */

import { sessionCache } from '@/lib/sessionCache';

const CACHE_KEYS = [
  'cache:classes',
  'cache:teachers',
  'cache:schedules',
  'cache:announcements',
  'cache:calendar_events',
  'cache:attendance_config',
  'cache:classroom-manager:classes',
] as const;

export function resetSharedFirestoreStores(): void {
  sessionCache.invalidate(...CACHE_KEYS);
  sessionCache.invalidatePrefix('cache:role_permissions:');
}
