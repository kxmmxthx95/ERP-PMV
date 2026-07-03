import { collection, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { createSharedStore } from './createSharedStore';
import { listenQueryWithGetDocs } from './listenWithGetDocs';
import type { ClassSession } from '@/types/teaching';

type DocRow = { id: string; [key: string]: unknown };

const sessionStores = new Map<string, ReturnType<typeof createSharedStore<ClassSession[]>>>();

function storeKey(academicYearId: string, date: string) {
  return `${academicYearId}:${date}`;
}

function mapSessionRows(rows: DocRow[]): ClassSession[] {
  return rows.map((row) => ({ ...row, id: row.id } as ClassSession));
}

/** One listener per academic year + date — shared across widgets on the home page. */
export function getTodayClassSessionsStore(academicYearId: string, date: string) {
  const key = storeKey(academicYearId, date);
  let store = sessionStores.get(key);
  if (!store) {
    let cached: ClassSession[] = [];
    store = createSharedStore<ClassSession[]>(
      (emit) => {
        const q = query(
          collection(db, 'class_sessions'),
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
          `classSessions:${key}`,
        );
      },
      cached,
    );
    sessionStores.set(key, store);
  }
  return store;
}
