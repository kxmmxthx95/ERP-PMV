import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { isSameDay } from 'date-fns';
import { collection, onSnapshot, query, where, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useActiveAcademicYear } from '@/hooks/useActiveAcademicYear';
import { useAuth } from '@/hooks/useAuth';
import { type CalendarEvent, type CalendarEventType } from '@/types/calendar';
import { ALL_TYPES, containerAnim } from './constants';
import { useThaiHolidays } from './hooks/useThaiHolidays';
import CalendarHeader from './components/CalendarHeader';
import CalendarPanel from './components/CalendarPanel';
import UpcomingPanel from './components/UpcomingPanel';
import AddEventModal, { type EventFormData } from './components/AddEventModal';
import { useSchoolStructure } from '@/hooks/useSchoolStructure';

export default function AcademicCalendar() {
  const { role } = useAuth();
  const { departments } = useSchoolStructure();
  const { activeYear } = useActiveAcademicYear();

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [activeFilters, setActiveFilters] = useState<Set<CalendarEventType>>(new Set(ALL_TYPES));
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | undefined>(undefined);
  const [filterDepartment, setFilterDepartment] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [dbEvents, setDbEvents] = useState<CalendarEvent[]>([]);

  // Fetch Thai public holidays from Calendarific for the current displayed year
  const { holidays, isLoading: holidaysLoading, error: holidaysError } = useThaiHolidays(
    currentMonth.getFullYear(),
  );

  // ── ดึงข้อมูลจาก Firebase ──
  useEffect(() => {
    if (!activeYear?.year) {
      setDbEvents([]);
      return;
    }
    const q = query(
      collection(db, 'calendar_events'),
      where('academicYearId', '==', activeYear.year)
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      const evts = snap.docs.map(d => ({ id: d.id, ...d.data() } as CalendarEvent));
      setDbEvents(evts);
    });
    return () => unsubscribe();
  }, [activeYear?.year]);

  // ── รวมข้อมูล Firebase กับ API Holidays และกรองตาม Role ──
  const allEvents = useMemo(() => {
    const apiHolidays: CalendarEvent[] = holidays.map(h => ({
      ...h,
      id: `api-${h.startDate}`,
      academicYearId: activeYear?.year || '',
      createdBy: 'system'
    }));

    const combined = [...dbEvents, ...apiHolidays];

    // กรองตาม Role (ผู้บริหารและ Sysadmin เห็นทุกกิจกรรม)
    return combined.filter(e => {
      if (role === 'sysadmin' || role === 'admin') return true;
      if (!e.targetRoles || e.targetRoles.length === 0) return true;
      return role ? e.targetRoles.includes(role) : true;
    });
  }, [dbEvents, holidays, activeYear?.year, role]);

  // ── Helper Functions สำหรับส่งไปยัง Calendar Panel ──
  const upcomingEvents = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return allEvents
      .filter(e => e.startDate >= today)
      .sort((a, b) => a.startDate.localeCompare(b.startDate));
  }, [allEvents]);

  const getEventsForDate = (dateStr: string) => {
    return allEvents.filter(e => dateStr >= e.startDate && dateStr <= e.endDate);
  };

  // ── CRUD Operations (เพิ่ม/แก้ไข/ลบ ลง Firebase) ──
  const addEvent = async (eventData: EventFormData) => {
    if (!activeYear?.year) {
      alert('กรุณาตั้งค่าปีการศึกษาปัจจุบันก่อนเพิ่มกิจกรรม');
      return;
    }
    await addDoc(collection(db, 'calendar_events'), {
      ...eventData,
      academicYearId: activeYear.year,
      createdBy: role || 'unknown',
    });
  };

  const updateEvent = async (id: string, eventData: Partial<CalendarEvent>) => {
    if (id.startsWith('api-')) return; // ป้องกันการแก้ไขวันหยุดราชการจาก API
    await updateDoc(doc(db, 'calendar_events', id), eventData);
  };

  const deleteEvent = async (id: string) => {
    if (id.startsWith('api-')) return; // ป้องกันการลบวันหยุดราชการจาก API
    await deleteDoc(doc(db, 'calendar_events', id));
  };

  const handleMoveEvent = async (id: string, newDate: Date) => {
    if (id.startsWith('api-')) return;
    const event = allEvents.find(e => e.id === id);
    if (!event) return;

    // ปรับ timezone ให้อยู่ในโซน Local ก่อนตัด String เป็น YYYY-MM-DD
    const targetDateStr = new Date(newDate.getTime() - newDate.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

    // รักษาระยะเวลาของกิจกรรมให้เท่าเดิม
    const oldStart = new Date(event.startDate);
    const oldEnd = new Date(event.endDate);
    const durationDays = Math.round((oldEnd.getTime() - oldStart.getTime()) / (1000 * 60 * 60 * 24));

    const newEnd = new Date(newDate);
    newEnd.setDate(newEnd.getDate() + durationDays);
    const newEndDateStr = new Date(newEnd.getTime() - newEnd.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

    await updateDoc(doc(db, 'calendar_events', id), {
      startDate: targetDateStr,
      endDate: newEndDateStr
    });
  };

  const handleSelectDate = (day: Date) => {
    if (isNaN(day.getTime())) {
      setSelectedDate(null);
      return;
    }
    setSelectedDate(prev => (prev && isSameDay(prev, day) ? null : day));
  };

  const handleTypeChange = (val: string) => {
    setFilterType(val);
    if (val === 'all') {
      setActiveFilters(new Set(ALL_TYPES));
    } else {
      setActiveFilters(new Set([val as CalendarEventType]));
    }
  };

  const selectedDateStr = selectedDate && !isNaN(selectedDate.getTime())
    ? new Date(selectedDate.getTime() - selectedDate.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
    : undefined;

  // ── กรองกิจกรรมตามแผนก ──
  const checkDeptMatch = (ev: CalendarEvent, targetDept: string) => {
    if (targetDept === 'all') return true;
    if (!ev.targetRoles || ev.targetRoles.length === 0) return true;

    // ถ้าไม่ได้ระบุแผนกเลย (ไม่มี string ที่ขึ้นต้นด้วย dept:) ถือว่าเป็นกิจกรรมของทุกแผนก
    const hasAnyDept = ev.targetRoles.some(r => r.startsWith('dept:'));
    if (!hasAnyDept) return true;

    return ev.targetRoles.includes(targetDept);
  };

  const filteredUpcomingEvents = upcomingEvents.filter(ev => checkDeptMatch(ev, filterDepartment));

  const handleGetEventsForDate = (dateStr: string) => {
    const evs = getEventsForDate(dateStr);
    return evs.filter(ev => checkDeptMatch(ev, filterDepartment));
  };

  const deptIdMap: Record<string, string> = {
    'early-childhood': 'dept:early',
    'primary': 'dept:primary',
    'secondary': 'dept:secondary',
  };

  return (
    <div className="space-y-5 text-black">
      <CalendarHeader
        onAddEvent={() => setModalOpen(true)}
        holidayStatus={{
          isLoading: holidaysLoading,
          error: holidaysError,
          count: holidays.length,
        }}
        filterType={filterType}
        onTypeChange={handleTypeChange}
        allTypes={ALL_TYPES}
        filterDept={filterDepartment}
        onDeptChange={setFilterDepartment}
        departments={departments}
        deptIdMap={deptIdMap}
      />

      <motion.div
        variants={containerAnim}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 xl:grid-cols-3 gap-4"
      >
        <CalendarPanel
          currentMonth={currentMonth}
          selectedDate={selectedDate}
          activeFilters={activeFilters}
          getEventsForDate={handleGetEventsForDate}
          onChangeMonth={setCurrentMonth}
          onSelectDate={handleSelectDate}
          onEditEvent={ev => { setEditingEvent(ev); setModalOpen(true); }}
          onAddEventForDate={day => {
            if (!selectedDate || !isSameDay(selectedDate, day)) {
              setSelectedDate(day);
            }
            setEditingEvent(undefined);
            setModalOpen(true);
          }}
          onMoveEvent={handleMoveEvent}
        />

        <UpcomingPanel
          upcomingEvents={filteredUpcomingEvents}
          activeFilters={activeFilters}
        />
      </motion.div>

      <AddEventModal
        open={modalOpen}
        defaultDate={selectedDateStr}
        eventToEdit={editingEvent}
        onClose={() => { setModalOpen(false); setEditingEvent(undefined); }}
        onSubmit={addEvent}
        onUpdate={updateEvent}
        onDelete={deleteEvent}
      />
    </div>
  );
}
