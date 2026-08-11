import { motion } from 'framer-motion';
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays,
  addMonths, subMonths,
} from 'date-fns';
import type { CalendarEvent, CalendarEventType } from '@/types/calendar';
import { glassCard, cardAnim } from '../constants';
import CalendarMonthNav from './CalendarMonthNav';
import CalendarDayGrid from './CalendarDayGrid';

interface CalendarPanelProps {
  currentMonth: Date;
  selectedDate: Date | null;
  activeFilters: Set<CalendarEventType>;
  getEventsForDate: (dateStr: string) => CalendarEvent[];
  onChangeMonth: (month: Date) => void;
  onSelectDate: (day: Date) => void;
  onAddEventForDate?: (day: Date) => void;
  onMoveEvent?: (eventId: string, newDate: Date) => void;
  onGoToToday?: () => void;
}

function buildMonthGrid(currentMonth: Date): Date[] {
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const days: Date[] = [];
  let cursor = gridStart;
  while (cursor <= gridEnd) {
    days.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return days;
}

export default function CalendarPanel({
  currentMonth,
  selectedDate,
  activeFilters,
  getEventsForDate,
  onChangeMonth,
  onSelectDate,
  onAddEventForDate,
  onMoveEvent,
  onGoToToday,
}: CalendarPanelProps) {
  const days = buildMonthGrid(currentMonth);

  return (
    <motion.div
      variants={cardAnim}
      className="rounded-2xl overflow-hidden flex flex-col h-full"
      style={glassCard}
    >
      <CalendarMonthNav
        currentMonth={currentMonth}
        onPrev={() => onChangeMonth(subMonths(currentMonth, 1))}
        onNext={() => onChangeMonth(addMonths(currentMonth, 1))}
        onGoToToday={onGoToToday}
      />

      <div className="flex-1 flex flex-col overflow-auto min-h-0">
        <CalendarDayGrid
          days={days}
          currentMonth={currentMonth}
          selectedDate={selectedDate}
          activeFilters={activeFilters}
          getEventsForDate={getEventsForDate}
          onSelectDate={onSelectDate}
          onAddEventForDate={onAddEventForDate}
          onMoveEvent={onMoveEvent}
        />
      </div>
    </motion.div>
  );
}
