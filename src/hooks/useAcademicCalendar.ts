import { useState, useMemo } from 'react';
import type { CalendarEvent } from '@/types/calendar';

// Mock seed data — replace with Firestore query when backend is ready
const SEED_EVENTS: CalendarEvent[] = [
  {
    id: '1',
    title: 'วันหยุดสงกรานต์',
    startDate: '2025-04-13',
    endDate: '2025-04-15',
    type: 'holiday',
    targetRoles: ['student', 'parent', 'teacher', 'staff', 'admin', 'sysadmin'],
    description: 'วันหยุดเทศกาลสงกรานต์ ปิดทำการ 3 วัน',
  },
  {
    id: '2',
    title: 'สอบกลางภาค เทอม 1/2568',
    startDate: '2025-07-14',
    endDate: '2025-07-18',
    type: 'exam',
    targetRoles: ['student', 'parent', 'teacher'],
    description: 'การสอบกลางภาคเรียนที่ 1 ปีการศึกษา 2568',
  },
  {
    id: '3',
    title: 'กิจกรรมวันไหว้ครู',
    startDate: '2025-06-12',
    endDate: '2025-06-12',
    type: 'activity',
    targetRoles: ['student', 'teacher', 'staff', 'admin'],
    description: 'พิธีไหว้ครูประจำปีการศึกษา 2568',
  },
  {
    id: '4',
    title: 'กำหนดส่งผลการเรียน เทอม 2',
    startDate: '2025-03-28',
    endDate: '2025-03-28',
    type: 'deadline',
    targetRoles: ['teacher', 'admin'],
    description: 'ครูส่งผลการเรียนภาคเรียนที่ 2 ในระบบ',
  },
  {
    id: '5',
    title: 'วันหยุดแรงงานแห่งชาติ',
    startDate: '2025-05-01',
    endDate: '2025-05-01',
    type: 'holiday',
    targetRoles: ['student', 'parent', 'teacher', 'staff', 'admin', 'sysadmin'],
  },
  {
    id: '6',
    title: 'สอบปลายภาค เทอม 1/2568',
    startDate: '2025-09-22',
    endDate: '2025-09-26',
    type: 'exam',
    targetRoles: ['student', 'parent', 'teacher'],
    description: 'การสอบปลายภาคเรียนที่ 1 ปีการศึกษา 2568',
  },
  {
    id: '7',
    title: 'กีฬาสี ประจำปี 2568',
    startDate: '2025-08-07',
    endDate: '2025-08-08',
    type: 'activity',
    targetRoles: ['student', 'parent', 'teacher', 'staff', 'admin'],
    description: 'งานกีฬาสีประจำปีของโรงเรียน',
  },
  {
    id: '8',
    title: 'กำหนดส่งแผนการสอน เทอม 1',
    startDate: '2025-05-19',
    endDate: '2025-05-19',
    type: 'deadline',
    targetRoles: ['teacher', 'admin'],
    description: 'ครูทุกท่านส่งแผนการจัดการเรียนรู้',
  },
  {
    id: '9',
    title: 'เปิดภาคเรียน 1/2568',
    startDate: '2025-05-12',
    endDate: '2025-05-12',
    type: 'activity',
    targetRoles: ['student', 'parent', 'teacher', 'staff', 'admin', 'sysadmin'],
    description: 'วันเปิดภาคเรียนที่ 1 ปีการศึกษา 2568',
  },
  {
    id: '10',
    title: 'วันหยุดวิสาขบูชา',
    startDate: '2025-05-11',
    endDate: '2025-05-11',
    type: 'holiday',
    targetRoles: ['student', 'parent', 'teacher', 'staff', 'admin', 'sysadmin'],
  },
];

export type NewCalendarEvent = Omit<CalendarEvent, 'id'>;

export function useAcademicCalendar(userRole?: string, extraEvents: CalendarEvent[] = []) {
  const [localEvents, setLocalEvents] = useState<CalendarEvent[]>(SEED_EVENTS);

  // Merge local (seed + user-added) with external (e.g. API holidays), dedup by id
  const allEvents = [...localEvents, ...extraEvents.filter(
    ext => !localEvents.some(loc => loc.id === ext.id),
  )];

  const events = useMemo(() => {
    if (!userRole) return allEvents;
    return allEvents.filter(e => e.targetRoles.includes(userRole));
  }, [allEvents, userRole]);

  const addEvent = (data: NewCalendarEvent) => {
    const newEvent: CalendarEvent = {
      ...data,
      id: `local-${Date.now()}`,
    };
    setLocalEvents(prev => [...prev, newEvent]);
  };

  const updateEvent = (id: string, data: NewCalendarEvent) => {
    setLocalEvents(prev =>
      prev.map(e => (e.id === id ? { ...data, id } : e)),
    );
  };

  const deleteEvent = (id: string) => {
    setLocalEvents(prev => prev.filter(e => e.id !== id));
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
