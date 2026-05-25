import { useState, useMemo, useEffect } from 'react';
import { collection, onSnapshot, query, where, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useActiveAcademicYear } from '@/hooks/useActiveAcademicYear';
import type { CalendarEvent } from '@/types/calendar';

export type NewCalendarEvent = Omit<CalendarEvent, 'id'>;

export function useAcademicCalendar(userRole?: string, extraEvents: CalendarEvent[] = []) {
  const { activeYear } = useActiveAcademicYear();
  const [dbEvents, setDbEvents] = useState<CalendarEvent[]>([]);

  useEffect(() => {
    if (!activeYear?.year) {
      setDbEvents([]);
      return;
    }
    const q = query(
      collection(db, 'calendar_events'),
      where('academicYearId', '==', activeYear.year)
    );
    const unsubscribe = onSnapshot(q, 
      (snap) => {
        setDbEvents(snap.docs.map(d => ({ id: d.id, ...d.data() } as CalendarEvent)));
      },
      (err) => {
        if (userRole === 'admin' || userRole === 'sysadmin') {
          console.error('useAcademicCalendar listener error:', err);
        }
      }
    );
    return () => unsubscribe();
  }, [activeYear?.year]);

  // Merge local (seed + user-added) with external (e.g. API holidays), dedup by id
  const allEvents = [...dbEvents, ...extraEvents.filter(
    ext => !dbEvents.some(loc => loc.id === ext.id),
  )];

  const events = useMemo(() => {
    if (!userRole) return allEvents;
    return allEvents.filter(e => {
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
    events.filter(e => dateStr >= e.startDate && dateStr <= e.endDate);

  const getEventsForMonth = (year: number, month: number) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    const prefix = `${year}-${pad(month)}`;
    return events.filter(e => e.startDate.startsWith(prefix) || e.endDate.startsWith(prefix));
  };

  const upcomingEvents = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return [...events]
      .filter(e => e.endDate >= today)
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
