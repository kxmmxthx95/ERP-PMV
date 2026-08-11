import { useEffect, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { sessionCache } from '@/lib/sessionCache';
import type { SubstitutionRecord } from '@/hooks/useDailySchedules';

/** ตัด createdAt (Firestore Timestamp) ออกก่อน cache — Timestamp ไม่ serialize ผ่าน JSON ได้ */
export type CachedSubstitution = Omit<SubstitutionRecord, 'createdAt'>;

const EMPTY_SUBSTITUTIONS: CachedSubstitution[] = [];

function cacheKey(academicYearId: string, semester: 1 | 2, date: string): string {
  return `substitutions:${academicYearId}:${semester}:${date}`;
}

/**
 * ดึงรายการมอบหมายสอนแทน/เช็คชื่อแทนของวันที่ระบุ — one-shot getDocs + cache (ไม่เปิด listener)
 * ใช้ใน useTeacherDailyTasks / AttendanceSheet ที่รันทุกครั้งที่ครูเข้าหน้า ไม่ใช่แค่หน้ามอบหมายเอง
 */
export async function getSubstitutionsForDate(
  academicYearId: string,
  semester: 1 | 2,
  date: string,
): Promise<CachedSubstitution[]> {
  const key = cacheKey(academicYearId, semester, date);
  const cached = sessionCache.get<CachedSubstitution[]>(key);
  if (cached) return cached;

  const snap = await getDocs(query(
    collection(db, 'daily_schedules'),
    where('academicYearId', '==', academicYearId),
    where('semester', '==', semester),
    where('date', '==', date),
  ));
  const records = snap.docs.map(d => {
    const { createdAt, ...rest } = d.data() as Omit<SubstitutionRecord, 'id'>;
    void createdAt; // Firestore Timestamp ไม่ serialize ผ่าน JSON ได้ — ตัดทิ้งก่อน cache
    return { id: d.id, ...rest } as CachedSubstitution;
  });

  sessionCache.set(key, records);
  return records;
}

export function invalidateSubstitutionsCache(
  academicYearId: string,
  semester: 1 | 2,
  date: string,
): void {
  sessionCache.invalidate(cacheKey(academicYearId, semester, date));
}

/** React hook wrapper รอบ getSubstitutionsForDate — ใช้ร่วมกันระหว่าง useTeacherDailyTasks / AttendanceSheet */
export function useSubstitutionsForDate(
  academicYearId: string | undefined,
  semester: 1 | 2 | undefined,
  date: string | undefined,
): CachedSubstitution[] {
  const [substitutions, setSubstitutions] = useState<CachedSubstitution[]>(EMPTY_SUBSTITUTIONS);

  useEffect(() => {
    if (!academicYearId || !semester || !date) return;
    let cancelled = false;
    getSubstitutionsForDate(academicYearId, semester, date).then((records) => {
      if (!cancelled) setSubstitutions(records);
    });
    return () => { cancelled = true; };
  }, [academicYearId, semester, date]);

  return substitutions;
}
