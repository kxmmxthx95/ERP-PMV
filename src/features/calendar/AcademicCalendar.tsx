import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { isSameDay, startOfMonth, endOfMonth } from 'date-fns';
import { collection, getDocs, query, where, addDoc, updateDoc, deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore';
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
import CalendarFilterCapsule from './components/CalendarFilterCapsule';

export default function AcademicCalendar() {
  const { role } = useAuth();
  const { departments } = useSchoolStructure();
  const { activeYear } = useActiveAcademicYear();

  const [headerHomeActionsEl, setHeaderHomeActionsEl] = useState<HTMLElement | null>(null);
  const [headerMobileCenterPortalEl, setHeaderMobileCenterPortalEl] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setHeaderHomeActionsEl(document.getElementById('header-portal-home-actions'));
    setHeaderMobileCenterPortalEl(document.getElementById('header-portal-center-mobile'));
  }, []);

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [activeFilters, setActiveFilters] = useState<Set<CalendarEventType>>(new Set(ALL_TYPES));
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | undefined>(undefined);
  const [filterDepartment, setFilterDepartment] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dbEvents, setDbEvents] = useState<CalendarEvent[]>([]);
  const [semesterSettings, setSemesterSettings] = useState<any>(null);

  const { holidays } = useThaiHolidays(
    currentMonth.getFullYear(),
  );

  useEffect(() => {
    const fetchSemesters = async () => {
      const snap = await getDoc(doc(db, 'settings', 'dept_semesters'));
      if (snap.exists()) setSemesterSettings(snap.data());
    };
    fetchSemesters();
  }, []);

  useEffect(() => {
    if (!activeYear?.year) {
      setDbEvents([]);
      return;
    }
    let cancelled = false;
    const q = query(
      collection(db, 'calendar_events'),
      where('academicYearId', '==', activeYear.year)
    );
    void getDocs(q)
      .then((snap) => {
        if (cancelled) return;
        const evts = snap.docs.map(d => ({ id: d.id, ...d.data() } as CalendarEvent));
        setDbEvents(evts);
      })
      .catch((err) => {
        if (!cancelled && (role === 'admin' || role === 'sysadmin')) {
          console.error('calendar_events fetch error:', err);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [activeYear?.year, role]);

  const allEvents = useMemo(() => {
    const apiHolidays: CalendarEvent[] = holidays.map(h => ({
      ...h,
      id: `api-${h.startDate}`,
      academicYearId: activeYear?.year || '',
      createdBy: 'system'
    }));

    // Inject semester dates as events
    const semesterEvents: CalendarEvent[] = [];
    if (semesterSettings) {
      const depts = ['kindergarten', 'primary', 'secondary'] as const;
      const deptLabels: Record<string, string> = { kindergarten: 'อนุบาล', primary: 'ประถม', secondary: 'มัธยม' };
      const deptIds: Record<string, string> = { kindergarten: 'dept:early', primary: 'dept:primary', secondary: 'dept:secondary' };

      depts.forEach(dept => {
        const config = semesterSettings[dept];
        if (!config) return;

        ['semester1', 'semester2', 'summerSemester'].forEach((semKey) => {
          const sem = config[semKey];
          if (!sem?.startDate || !sem?.endDate) return;
          if (semKey === 'summerSemester' && !config.summerEnabled) return;

          const semLabel = semKey === 'semester1' ? 'เทอม 1' : semKey === 'semester2' ? 'เทอม 2' : 'Summer';
          
          semesterEvents.push({
            id: `system-${dept}-${semKey}-start`,
            title: `เปิดเรียน ${semLabel} (${deptLabels[dept]})`,
            startDate: sem.startDate,
            endDate: sem.startDate,
            type: 'semester-start',
            targetRoles: [deptIds[dept], 'student', 'teacher', 'parent', 'staff'],
            description: `วันเปิดภาคเรียน ${semLabel} ระดับชั้น${deptLabels[dept]}`
          });

          semesterEvents.push({
            id: `system-${dept}-${semKey}-end`,
            title: `ปิดเรียน ${semLabel} (${deptLabels[dept]})`,
            startDate: sem.endDate,
            endDate: sem.endDate,
            type: 'semester-end',
            targetRoles: [deptIds[dept], 'student', 'teacher', 'parent', 'staff'],
            description: `วันปิดภาคเรียน ${semLabel} ระดับชั้น${deptLabels[dept]}`
          });
        });
      });
    }

    const dbIds = new Set(dbEvents.map(e => e.id));
    const filteredSemesterEvents = semesterEvents.filter(e => !dbIds.has(e.id));
    const combined = [...dbEvents, ...apiHolidays, ...filteredSemesterEvents];

    return combined.filter(e => {
      if (role === 'sysadmin' || role === 'admin') return true;
      if (!e.targetRoles || e.targetRoles.length === 0) return true;

      // 1. ถ้ามี Role ของผู้ใช้ระบุอยู่ตรงๆ ให้เห็นได้เลย
      if (role && e.targetRoles.includes(role)) return true;

      // 2. กรณีพิเศษ: ถ้ามีการระบุแผนก (dept:) แต่ไม่ได้ระบุ Role เฉพาะเจาะจง (เช่น student, teacher)
      // เราจะอนุญาตให้ Role พื้นฐานเห็นได้ เพื่อไม่ให้กิจกรรมหายไปจากหน้าจอ
      const hasDeptTag = e.targetRoles.some(r => r.startsWith('dept:'));
      const hasRoleTag = e.targetRoles.some(r => !r.startsWith('dept:'));

      if (hasDeptTag && !hasRoleTag) return true;

      return false;
    });
  }, [dbEvents, holidays, activeYear?.year, role, semesterSettings]);

  const monthStart = startOfMonth(currentMonth).toISOString().slice(0, 10);
  const monthEnd = endOfMonth(currentMonth).toISOString().slice(0, 10);

  const monthEvents = useMemo(() => {
    return allEvents
      .filter(e => e.startDate <= monthEnd && e.endDate >= monthStart)
      .sort((a, b) => a.startDate.localeCompare(b.startDate));
  }, [allEvents, monthStart, monthEnd]);


  const getEventsForDate = (dateStr: string) => {
    return allEvents.filter(e => dateStr >= e.startDate && dateStr <= e.endDate);
  };

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
    if (id.startsWith('api-')) return;
    // ใช้ setDoc + merge เพื่อให้สามารถบันทึกทับ ID ที่มาจากระบบ (system-) ได้
    await setDoc(doc(db, 'calendar_events', id), {
      ...eventData,
      academicYearId: activeYear?.year || '',
      updatedAt: new Date().toISOString()
    }, { merge: true });
  };

  const deleteEvent = async (id: string) => {
    if (id.startsWith('api-')) return;
    await deleteDoc(doc(db, 'calendar_events', id));
  };

  const handleMoveEvent = async (id: string, newDate: Date) => {
    if (id.startsWith('api-') || id.startsWith('system-')) return;
    const event = allEvents.find(e => e.id === id);
    if (!event) return;

    const targetDateStr = new Date(newDate.getTime() - newDate.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

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

  const handleGoToToday = () => {
    const today = new Date();
    setCurrentMonth(today);
    setSelectedDate(today);
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

  const checkMatch = (ev: CalendarEvent, targetDept: string, query: string) => {
    let deptMatch = true;
    if (targetDept !== 'all') {
      if (ev.targetRoles && ev.targetRoles.length > 0) {
        const hasAnyDept = ev.targetRoles.some(r => r.startsWith('dept:'));
        if (hasAnyDept) {
          deptMatch = ev.targetRoles.includes(targetDept);
        }
      }
    }

    let searchMatch = true;
    if (query.trim()) {
      const q = query.toLowerCase();
      searchMatch =
        ev.title.toLowerCase().includes(q) ||
        (ev.description?.toLowerCase().includes(q) ?? false);
    }

    return deptMatch && searchMatch;
  };

  const handleGetEventsForDate = (dateStr: string) => {
    const evs = getEventsForDate(dateStr);
    return evs.filter(ev => checkMatch(ev, filterDepartment, searchQuery));
  };

  const deptIdMap: Record<string, string> = {
    'early-childhood': 'dept:early',
    'primary': 'dept:primary',
    'secondary': 'dept:secondary',
  };

  const handleEditEvent = (event: CalendarEvent) => {
    setEditingEvent(event);
    setModalOpen(true);
  };

  return (
    <div
      className={cn(
        'relative flex min-h-0 w-full flex-1 basis-0 flex-col overflow-hidden bg-transparent font-sukhumvit',
        'h-[calc(100dvh-4.25rem)] max-h-[calc(100dvh-4.25rem)]',
      )}
    >
      <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute -top-24 -left-16 w-72 h-72 rounded-full bg-sky-200/45 blur-3xl" />
        <div className="absolute top-24 -right-20 w-80 h-80 rounded-full bg-cyan-200/40 blur-3xl" />
      </div>

      <CalendarHeader />

      <motion.div
        variants={containerAnim}
        initial="hidden"
        animate="show"
        className="flex flex-1 min-h-0 gap-4 px-4"
      >
        <div className="hidden lg:flex w-[320px] min-w-[320px] min-h-0 flex-col shrink-0">
          <UpcomingPanel
            upcomingEvents={monthEvents}
            activeFilters={activeFilters}
            selectedDate={selectedDate}
            selectedEvents={selectedDate ? handleGetEventsForDate(new Date(selectedDate.getTime() - selectedDate.getTimezoneOffset() * 60000).toISOString().slice(0, 10)) : []}
            onClearSelection={() => setSelectedDate(null)}
            filterType={filterType}
            onTypeChange={handleTypeChange}
            allTypes={ALL_TYPES}
            onEditEvent={handleEditEvent}
            onDeleteEvent={deleteEvent}
          />
        </div>

        <div className="flex-1 min-h-0">
          <CalendarPanel
            currentMonth={currentMonth}
            selectedDate={selectedDate}
            activeFilters={activeFilters}
            getEventsForDate={handleGetEventsForDate}
            onChangeMonth={setCurrentMonth}
            onSelectDate={handleSelectDate}
            onMoveEvent={handleMoveEvent}
            onGoToToday={handleGoToToday}
          />
        </div>
      </motion.div>

      {(() => {
        const capsule = (
          <CalendarFilterCapsule
            filterDept={filterDepartment}
            onDeptChange={setFilterDepartment}
            departments={departments}
            deptIdMap={deptIdMap}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onAddEvent={() => setModalOpen(true)}
            isPortal={true}
          />
        );
        return (
          <>
            {headerHomeActionsEl && createPortal(capsule, headerHomeActionsEl)}
            {headerMobileCenterPortalEl && createPortal(capsule, headerMobileCenterPortalEl)}
            {!headerHomeActionsEl && !headerMobileCenterPortalEl && capsule}
          </>
        );
      })()}

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
