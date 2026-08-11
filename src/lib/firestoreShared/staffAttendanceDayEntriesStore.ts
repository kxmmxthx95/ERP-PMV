import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getLocalDateString } from '@/lib/dateUtils';
import { createSharedStore } from './createSharedStore';
import { listenQueryWithGetDocs } from './listenWithGetDocs';
import { whenFirestoreGatewayOpen } from './bootstrap';

export type StaffDayEntry = {
  userId: string;
  status: string;
  photoURL?: string;
  displayName?: string;
  checkInTime?: unknown;
};

export type StaffDayEntriesMap = Record<string, StaffDayEntry[]>;

type DocRow = { id: string; [key: string]: unknown };

function mapDayEntries(rows: DocRow[]): StaffDayEntry[] {
  return rows.map((row) => ({
    userId: String(row.userId ?? row.id),
    status: String(row.status ?? ''),
    photoURL: typeof row.photoURL === 'string' ? row.photoURL : undefined,
    displayName: typeof row.displayName === 'string' ? row.displayName : undefined,
    checkInTime: row.checkInTime ?? undefined,
  }));
}

function uniqueSortedDates(dates: string[]): string[] {
  return [...new Set(dates.filter(Boolean))].sort();
}

function bundleKey(dates: string[], refreshNonce = 0): string {
  return `${uniqueSortedDates(dates).join('|')}|r${refreshNonce}`;
}

const pastDayCache = new Map<string, { entries: StaffDayEntry[]; at: number }>();
const pastDayDocsCache = new Map<string, { docs: DocRow[]; at: number }>();
const PAST_DAY_TTL_MS = 5 * 60 * 1000;
const dayDocsInflight = new Map<string, Promise<DocRow[]>>();

async function fetchDayDocs(date: string, force = false): Promise<DocRow[]> {
  if (!force) {
    const docsHit = pastDayDocsCache.get(date);
    if (docsHit && Date.now() - docsHit.at < PAST_DAY_TTL_MS) return docsHit.docs;

    const entriesHit = pastDayCache.get(date);
    if (entriesHit && Date.now() - entriesHit.at < PAST_DAY_TTL_MS) {
      return entriesHit.entries.map((entry) => ({
        id: entry.userId,
        userId: entry.userId,
        status: entry.status,
        photoURL: entry.photoURL,
        displayName: entry.displayName,
        checkInTime: entry.checkInTime,
      }));
    }
  } else {
    pastDayCache.delete(date);
    pastDayDocsCache.delete(date);
  }

  const inflightKey = `${date}:${force}`;
  let inflight = dayDocsInflight.get(inflightKey);
  if (!inflight) {
    inflight = (async () => {
      const snap = await getDocs(collection(db, 'staff_attendance_by_date', date, 'entries'));
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const at = Date.now();
      pastDayDocsCache.set(date, { docs, at });
      pastDayCache.set(date, { entries: mapDayEntries(docs), at });
      return docs;
    })().finally(() => {
      dayDocsInflight.delete(inflightKey);
    });
    dayDocsInflight.set(inflightKey, inflight);
  }
  return inflight;
}

/** One-shot batch load — shares TTL cache with Home daily summary widget. */
export async function loadStaffAttendanceDayEntries(date: string, force = false): Promise<StaffDayEntry[]> {
  return mapDayEntries(await fetchDayDocs(date, force));
}

export async function loadStaffAttendanceDaysEntries(
  dates: string[],
  force = false,
): Promise<StaffDayEntriesMap> {
  const unique = uniqueSortedDates(dates);
  const pairs = await Promise.all(
    unique.map(async (date) => [date, await loadStaffAttendanceDayEntries(date, force)] as const),
  );
  return Object.fromEntries(pairs);
}

/** Full Firestore docs for admin daily views (includes checkInTime, etc.). */
export async function loadStaffAttendanceDayDocs(date: string, force = false): Promise<DocRow[]> {
  return fetchDayDocs(date, force);
}

function listenPastDayEntries(
  date: string,
  emit: (value: StaffDayEntry[]) => void,
  fallback: StaffDayEntry[],
): () => void {
  let cancelled = false;

  void whenFirestoreGatewayOpen().then(async () => {
    if (cancelled) return;

    try {
      const entries = await loadStaffAttendanceDayEntries(date);
      if (!cancelled) emit(entries);
    } catch (err) {
      console.error(`[staffAttendanceDay:past:${date}] load failed:`, err);
      if (!cancelled) emit(fallback);
    }
  });

  return () => {
    cancelled = true;
  };
}

function listenDayEntries(date: string, emit: (value: StaffDayEntry[]) => void, fallback: StaffDayEntry[]) {
  const today = getLocalDateString();
  if (date < today) {
    return listenPastDayEntries(date, emit, fallback);
  }

  const q = collection(db, 'staff_attendance_by_date', date, 'entries');
  return listenQueryWithGetDocs(
    q,
    mapDayEntries,
    emit,
    fallback,
    `staffAttendanceDay:live:${date}`,
  );
}

const bundleStores = new Map<string, ReturnType<typeof createSharedStore<StaffDayEntriesMap>>>();

/** Shared day-level entries — live listener for today, cached getDocs for past dates. */
export function getStaffAttendanceDaysStore(dates: string[], refreshNonce = 0) {
  const key = bundleKey(dates, refreshNonce);
  let store = bundleStores.get(key);
  if (!store) {
    let snapshot: StaffDayEntriesMap = {};
    const docDates = uniqueSortedDates(dates);

    store = createSharedStore<StaffDayEntriesMap>(
      (emit) => {
        if (docDates.length === 0) {
          emit({});
          return () => {};
        }

        const unsubs = docDates.map((date) =>
          listenDayEntries(date, (entries) => {
            snapshot = { ...snapshot, [date]: entries };
            emit(snapshot);
          }, snapshot[date] ?? []),
        );

        return () => unsubs.forEach((u) => u());
      },
      snapshot,
    );
    bundleStores.set(key, store);
  }
  return store;
}

export function invalidateStaffAttendanceDayCache(date?: string) {
  if (date) {
    pastDayCache.delete(date);
    pastDayDocsCache.delete(date);
    return;
  }
  pastDayCache.clear();
  pastDayDocsCache.clear();
}

/** Drop cached store instance so the next subscribe re-fetches (refresh button). */
export function refreshStaffAttendanceDaysStore(dates: string[], refreshNonce: number) {
  invalidateStaffAttendanceDayCache();
  bundleStores.delete(bundleKey(dates, refreshNonce));
}

export { bundleKey as staffAttendanceDaysBundleKey };
