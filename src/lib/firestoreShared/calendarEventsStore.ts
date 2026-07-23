import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { createSharedStore } from './createSharedStore';
import type { CalendarEvent } from '@/types/calendar';

const stores = new Map<string, ReturnType<typeof createSharedStore<CalendarEvent[]>>>();

export function getCalendarEventsStore(academicYearId: string) {
  let store = stores.get(academicYearId);
  if (!store) {
    let cached: CalendarEvent[] = [];
    store = createSharedStore<CalendarEvent[]>(
      (emit) => {
        let cancelled = false;
        const q = query(
          collection(db, 'calendar_events'),
          where('academicYearId', '==', academicYearId),
        );
        void getDocs(q)
          .then((snap) => {
            if (cancelled) return;
            const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as CalendarEvent);
            cached = items;
            emit(items);
          })
          .catch((err) => {
            console.warn(`[calendarEventsStore:${academicYearId}] getDocs failed:`, err);
            if (!cancelled) emit(cached);
          });
        return () => {
          cancelled = true;
        };
      },
      [],
    );
    stores.set(academicYearId, store);
  }
  return store;
}
