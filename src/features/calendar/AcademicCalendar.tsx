import { useState } from 'react';
import { motion } from 'framer-motion';
import { isSameDay } from 'date-fns';
import { useAcademicCalendar } from '@/hooks/useAcademicCalendar';
import { useAuth } from '@/hooks/useAuth';
import { EVENT_TYPE_CONFIG, type CalendarEvent, type CalendarEventType } from '@/types/calendar';
import { ALL_TYPES, containerAnim } from './constants';
import { useThaiHolidays } from './hooks/useThaiHolidays';
import CalendarHeader from './components/CalendarHeader';
import CalendarPanel from './components/CalendarPanel';
import UpcomingPanel from './components/UpcomingPanel';
import AddEventModal from './components/AddEventModal';
import { useSchoolStructure } from '@/hooks/useSchoolStructure';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function AcademicCalendar() {
  const { role } = useAuth();
  const { departments } = useSchoolStructure();

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [activeFilters, setActiveFilters] = useState<Set<CalendarEventType>>(new Set(ALL_TYPES));
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | undefined>(undefined);
  const [filterDepartment, setFilterDepartment] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');

  // Fetch Thai public holidays from Calendarific for the current displayed year
  const { holidays, isLoading: holidaysLoading, error: holidaysError } = useThaiHolidays(
    currentMonth.getFullYear(),
  );

  // Merge API holidays into the academic calendar
  const { getEventsForDate, upcomingEvents, addEvent, updateEvent, deleteEvent } = useAcademicCalendar(
    role ?? undefined,
    holidays,
  );

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

  const handleToggleFilter = (type: CalendarEventType) => {
    setActiveFilters(prev => {
      const newSet = new Set(prev);
      if (newSet.has(type)) {
        newSet.delete(type);
      } else {
        newSet.add(type);
      }
      // Ensure at least one filter is always active
      if (newSet.size === 0) {
        return new Set([type]);
      }
      return newSet;
    });
  };

  const selectedDateStr = selectedDate && !isNaN(selectedDate.getTime())
    ? selectedDate.toISOString().slice(0, 10)
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
        activeFilters={activeFilters}
        onToggleFilter={handleToggleFilter}
        onAddEvent={() => setModalOpen(true)}
        holidayStatus={{
          isLoading: holidaysLoading,
          error: holidaysError,
          count: holidays.length,
        }}
      />

      {/* ── Filters ── */}
      <div className="flex flex-col sm:flex-row justify-end gap-2 px-1 -mt-2 relative z-10">
        <Select value={filterType} onValueChange={handleTypeChange}>
          <SelectTrigger className="w-full sm:w-36 px-3 py-1.5 bg-white/40 hover:bg-white/60 border border-white/60 outline-none text-xs text-black/70 shadow-sm focus:ring-1 focus:ring-slate-300 h-8 rounded-xl transition-colors backdrop-blur-md">
            <SelectValue placeholder="ทุกกิจกรรม" />
          </SelectTrigger>
          <SelectContent className="bg-white/95 backdrop-blur-xl border-white/50 rounded-xl max-h-60">
            <SelectItem value="all" className="text-xs rounded-lg">ทุกกิจกรรม</SelectItem>
            {ALL_TYPES.map((t) => (
              <SelectItem key={t} value={t} className="text-xs rounded-lg">
                {EVENT_TYPE_CONFIG[t]?.label ?? t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterDepartment} onValueChange={setFilterDepartment}>
          <SelectTrigger className="w-full sm:w-40 px-3 py-1.5 bg-white/40 hover:bg-white/60 border border-white/60 outline-none text-xs text-black/70 shadow-sm focus:ring-1 focus:ring-slate-300 h-8 rounded-xl transition-colors backdrop-blur-md">
            <SelectValue placeholder="เลือกแผนก" />
          </SelectTrigger>
          <SelectContent className="bg-white/95 backdrop-blur-xl border-white/50 rounded-xl max-h-60">
            <SelectItem value="all" className="text-xs rounded-lg">เลือกแผนก</SelectItem>
            {departments.map((d) => {
              const val = deptIdMap[d.id] ?? d.id;
              return (
                <SelectItem key={d.id} value={val} className="text-xs rounded-lg">
                  {d.label}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

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
