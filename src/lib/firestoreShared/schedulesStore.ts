import { collection, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { sessionCache } from '@/lib/sessionCache';
import { createSharedStore } from './createSharedStore';
import { listenQueryWithGetDocs } from './listenWithGetDocs';
import type { ScheduleEntry } from '@/types/schedule';

const CACHE_PREFIX = 'cache:schedules:';

function cacheKey(year: string, semester: 1 | 2) {
  return `${CACHE_PREFIX}${year}:${semester}`;
}

const scheduleStores = new Map<string, ReturnType<typeof createSharedStore<ScheduleEntry[]>>>();

function mapScheduleRows(rows: { id: string; [key: string]: unknown }[]): ScheduleEntry[] {
  return rows as unknown as ScheduleEntry[];
}

export function getSchedulesByYearSemesterStore(year: string, semester: 1 | 2) {
  const key = `${year}:${semester}`;
  let store = scheduleStores.get(key);
  if (!store) {
    const cached = sessionCache.get<ScheduleEntry[]>(cacheKey(year, semester)) ?? [];
    store = createSharedStore<ScheduleEntry[]>(
      (emit) => {
        const q = query(
          collection(db, 'schedules'),
          where('year', '==', year),
          where('semester', '==', semester),
        );
        return listenQueryWithGetDocs(
          q,
          mapScheduleRows,
          (items) => {
            sessionCache.set(cacheKey(year, semester), items);
            emit(items);
          },
          cached,
          `schedulesStore:${key}`,
        );
      },
      cached,
      { startReady: cached.length > 0 },
    );
    scheduleStores.set(key, store);
  }
  return store;
}

export function invalidateSchedulesCache(year: string, semester: 1 | 2) {
  sessionCache.invalidate(cacheKey(year, semester));
  scheduleStores.get(`${year}:${semester}`)?.bump();
}
