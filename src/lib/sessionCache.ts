/**
 * sessionCache — local cache บนเครื่องผู้ใช้
 *
 * ข้อมูลที่ไม่ค่อยเปลี่ยน (schedules, subjects, syllabi) จะถูก cache ไว้
 * TTL default 1 ชั่วโมง — ถ้าข้อมูลยังไม่หมดอายุ จะไม่เปิด Firestore listener ใหม่
 * ใช้ localStorage เป็นหลัก (คงอยู่ข้ามการปิด/เปิดแท็บ) และ fallback เป็น sessionStorage
 *
 * invalidate() — เรียกหลัง write (add/update/delete) เพื่อล้าง cache ทันที
 */

const DEFAULT_TTL_MS = 60 * 60 * 1000; // 1 hour

interface CacheEntry<T> {
  data: T;
  expireAt: number;
}

function getStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    // Safari private mode / blocked storage
    try {
      return window.sessionStorage;
    } catch {
      return null;
    }
  }
}

export const sessionCache = {
  get<T>(key: string): T | null {
    try {
      const storage = getStorage();
      if (!storage) return null;
      const raw = storage.getItem(key);
      if (!raw) return null;
      const entry: CacheEntry<T> = JSON.parse(raw);
      if (Date.now() > entry.expireAt) {
        storage.removeItem(key);
        return null;
      }
      return entry.data;
    } catch {
      return null;
    }
  },

  set<T>(key: string, data: T, ttlMs: number = DEFAULT_TTL_MS): void {
    try {
      const storage = getStorage();
      if (!storage) return;
      const entry: CacheEntry<T> = { data, expireAt: Date.now() + ttlMs };
      storage.setItem(key, JSON.stringify(entry));
    } catch {
      // storage เต็ม หรือ private mode — ไม่ crash
    }
  },

  invalidate(...keys: string[]): void {
    const storage = getStorage();
    if (!storage) return;
    keys.forEach(k => storage.removeItem(k));
  },

  invalidatePrefix(prefix: string): void {
    const storage = getStorage();
    if (!storage) return;
    const toRemove: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i);
      if (k?.startsWith(prefix)) toRemove.push(k);
    }
    toRemove.forEach(k => storage.removeItem(k));
  },
};
