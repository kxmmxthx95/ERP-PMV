import { useMemo, useSyncExternalStore } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useActiveAcademicYear } from '@/hooks/useActiveAcademicYear';
import { getCalendarEventsStore } from '@/lib/firestoreShared/calendarEventsStore';
import type { CalendarEvent } from '@/types/calendar';

export type NewCalendarEvent = Omit<CalendarEvent, 'id'>;

const emptySubscribe = () => () => {};
const EMPTY_EVENTS: CalendarEvent[] = [];

export function useAcademicCalendar(userRole?: string, extraEvents: CalendarEvent[] = EMPTY_EVENTS) {
  const { activeYear } = useActiveAcademicYear();
  const yearId = activeYear?.year ?? '';

  const store = yearId ? getCalendarEventsStore(yearId) : null;
  const dbEvents = useSyncExternalStore(
    store?.subscribe ?? emptySubscribe,
    () => store?.getSnapshot() ?? [],
    () => store?.getSnapshot() ?? [],
  );

  const allEvents = useMemo(
    () => [
      ...dbEvents,
      ...extraEvents.filter((ext) => !dbEvents.some((loc) => loc.id === ext.id)),
    ],
    [dbEvents, extraEvents],
  );

  const events = useMemo(() => {
    if (!userRole) return allEvents;
    return allEvents.filter((e) => {
      if (userRole === 'sysadmin' || userRole === 'admin') return true;
      if (!e.targetRoles || e.targetRoles.length === 0) return true;
      return e.targetRoles.includes(userRole);
    });
  }, [allEvents, userRole]);

  const addEvent = async (data: NewCalendarEvent) => {
    if (!activeYear?.year) return;
    await addDoc(collection(db, 'calendar_events'), {
      ...data,
      academicYearId: activeYear.year,
      createdBy: userRole || 'unknown',
    });
  };

  const updateEvent = async (id: string, data: Partial<CalendarEvent>) => {
    if (id.startsWith('api-')) return;
    await updateDoc(doc(db, 'calendar_events', id), data);
  };

  const deleteEvent = async (id: string) => {
    if (id.startsWith('api-')) return;
    await deleteDoc(doc(db, 'calendar_events', id));
  };

  const getEventsForDate = (dateStr: string) =>
    events.filter((e) => dateStr >= e.startDate && dateStr <= e.endDate);

  const getEventsForMonth = (year: number, month: number) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    const prefix = `${year}-${pad(month)}`;
    return events.filter((e) => e.startDate.startsWith(prefix) || e.endDate.startsWith(prefix));
  };

  const upcomingEvents = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return [...events]
      .filter((e) => e.endDate >= today)
      .sort((a, b) => a.startDate.localeCompare(b.startDate))
      .slice(0, 8);
  }, [events]);

  return {
    events,
    addEvent,
    updateEvent,
    deleteEvent,
    getEventsForDate,
    getEventsForMonth,
    upcomingEvents,
  };
}
