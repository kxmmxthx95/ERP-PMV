import { collection, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { createSharedStore } from './createSharedStore';
import { listenQueryWithGetDocs } from './listenWithGetDocs';
import type { MorningRollCallSession } from '@/types/morningRollCall';

type DocRow = { id: string; [key: string]: unknown };

const sessionStores = new Map<string, ReturnType<typeof createSharedStore<MorningRollCallSession[]>>>();

function storeKey(academicYearId: string, date: string) {
  return `${academicYearId}:${date}`;
}

function mapSessionRows(rows: DocRow[]): MorningRollCallSession[] {
  return rows as unknown as MorningRollCallSession[];
}

export function getTodayRollCallSessionsStore(academicYearId: string, date: string) {
  const key = storeKey(academicYearId, date);
  let store = sessionStores.get(key);
  if (!store) {
    let cached: MorningRollCallSession[] = [];
    store = createSharedStore<MorningRollCallSession[]>(
      (emit) => {
        const q = query(
          collection(db, 'morning_rollcall'),
          where('date', '==', date),
          where('academicYearId', '==', academicYearId),
        );
        return listenQueryWithGetDocs(
          q,
          mapSessionRows,
          (items) => {
            cached = items;
            emit(items);
          },
          cached,
          `morningRollCall:${key}`,
        );
      },
      cached,
    );
    sessionStores.set(key, store);
  }
  return store;
}
