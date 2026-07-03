import { collection, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { createSharedStore } from './createSharedStore';
import { listenQueryWithGetDocs } from './listenWithGetDocs';
import type { CalendarEvent } from '@/types/calendar';

const stores = new Map<string, ReturnType<typeof createSharedStore<CalendarEvent[]>>>();

export function getCalendarEventsStore(academicYearId: string) {
  let store = stores.get(academicYearId);
  if (!store) {
    let cached: CalendarEvent[] = [];
    store = createSharedStore<CalendarEvent[]>(
      (emit) => {
        const q = query(
          collection(db, 'calendar_events'),
          where('academicYearId', '==', academicYearId),
        );
        return listenQueryWithGetDocs(
          q,
          (rows) => rows as unknown as CalendarEvent[],
          (items) => {
            cached = items;
            emit(items);
          },
          cached,
          `calendarEventsStore:${academicYearId}`,
        );
      },
      [],
    );
    stores.set(academicYearId, store);
  }
  return store;
}
