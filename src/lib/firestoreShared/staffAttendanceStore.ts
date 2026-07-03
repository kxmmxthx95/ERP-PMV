import { doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { createSharedStore } from './createSharedStore';
import { listenDocWithGetDoc } from './listenDocWithGetDoc';
import type { StaffAttendanceRecord } from '@/hooks/useStaffAttendance';

export function getStaffAttendanceEntryRef(date: string, userId: string) {
  return doc(db, 'staff_attendance_by_date', date, 'entries', userId);
}

type TodayEntrySnapshot = StaffAttendanceRecord | null;

const todayStores = new Map<string, ReturnType<typeof createSharedStore<TodayEntrySnapshot>>>();

function mapTodayEntry(
  raw: Record<string, unknown> | undefined,
  id: string,
  userId: string,
  date: string,
): TodayEntrySnapshot {
  if (!raw) return null;
  const data = raw as Omit<StaffAttendanceRecord, 'id'>;
  return {
    ...data,
    id,
    userId: data.userId || userId,
    date: data.date || date,
  };
}

export function getStaffTodayEntryStore(userId: string, date: string) {
  const key = `${userId}:${date}`;
  let store = todayStores.get(key);
  if (!store) {
    let cached: TodayEntrySnapshot = null;
    store = createSharedStore<TodayEntrySnapshot>(
      (emit) => listenDocWithGetDoc(
        getStaffAttendanceEntryRef(date, userId),
        (raw, id) => mapTodayEntry(raw as Record<string, unknown> | undefined, id, userId, date),
        (value) => {
          cached = value;
          emit(value);
        },
        cached,
        `staffAttendance:today:${key}`,
      ),
      null,
    );
    todayStores.set(key, store);
  }
  return store;
}

const weekHistoryCache = new Map<string, { records: StaffAttendanceRecord[]; at: number }>();
const WEEK_HISTORY_TTL_MS = 5 * 60 * 1000;
const weekHistoryInflight = new Map<string, Promise<StaffAttendanceRecord[]>>();

function last7DateStrings(): string[] {
  const dates: string[] = [];
  for (let i = 0; i < 7; i += 1) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
    );
  }
  return dates;
}

async function loadWeekHistory(userId: string): Promise<StaffAttendanceRecord[]> {
  const { getDoc } = await import('firebase/firestore');
  const dates = last7DateStrings();
  const rows = await Promise.all(
    dates.map(async (date) => {
      const snap = await getDoc(getStaffAttendanceEntryRef(date, userId));
      if (!snap.exists()) return null;
      const data = snap.data() as Omit<StaffAttendanceRecord, 'id'>;
      return {
        ...data,
        id: snap.id,
        userId: data.userId || userId,
        date: data.date || date,
      } satisfies StaffAttendanceRecord;
    }),
  );
  return rows
    .filter((row): row is StaffAttendanceRecord => row != null)
    .sort((a, b) => b.date.localeCompare(a.date));
}

export async function getStaffWeekHistory(userId: string, force = false): Promise<StaffAttendanceRecord[]> {
  if (!userId) return [];
  const hit = weekHistoryCache.get(userId);
  if (!force && hit && Date.now() - hit.at < WEEK_HISTORY_TTL_MS) {
    return hit.records;
  }

  let inflight = weekHistoryInflight.get(userId);
  if (!inflight) {
    inflight = loadWeekHistory(userId).finally(() => {
      weekHistoryInflight.delete(userId);
    });
    weekHistoryInflight.set(userId, inflight);
  }

  const records = await inflight;
  weekHistoryCache.set(userId, { records, at: Date.now() });
  return records;
}

export function invalidateStaffWeekHistory(userId: string) {
  weekHistoryCache.delete(userId);
}
