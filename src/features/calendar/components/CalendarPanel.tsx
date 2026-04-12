import { motion } from 'framer-motion';
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays,
  addMonths, subMonths,
} from 'date-fns';
import type { CalendarEvent, CalendarEventType } from '@/types/calendar';
import { glassCard, cardAnim } from '../constants';
import { toDateStr } from '../utils';
import CalendarMonthNav from './CalendarMonthNav';
import CalendarDayGrid from './CalendarDayGrid';
import EventStrip from './EventStrip';

interface CalendarPanelProps {
  currentMonth: Date;
  selectedDate: Date | null;
  activeFilters: Set<CalendarEventType>;
  getEventsForDate: (dateStr: string) => CalendarEvent[];
  onChangeMonth: (month: Date) => void;
  onSelectDate: (day: Date) => void;
  onEditEvent?: (event: CalendarEvent) => void;
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
  onEditEvent,
}: CalendarPanelProps) {
  const days = buildMonthGrid(currentMonth);

  const selectedEvents = selectedDate && !isNaN(selectedDate.getTime())
    ? getEventsForDate(toDateStr(selectedDate))
    : [];

  return (
    <motion.div
      variants={cardAnim}
      className="xl:col-span-2 rounded-3xl overflow-hidden"
      style={glassCard}
    >
      <CalendarMonthNav
        currentMonth={currentMonth}
        onPrev={() => onChangeMonth(subMonths(currentMonth, 1))}
        onNext={() => onChangeMonth(addMonths(currentMonth, 1))}
      />

      <CalendarDayGrid
        days={days}
        currentMonth={currentMonth}
        selectedDate={selectedDate}
        activeFilters={activeFilters}
        getEventsForDate={getEventsForDate}
        onSelectDate={onSelectDate}
      />

      <EventStrip
        selectedDate={selectedDate}
        events={selectedEvents}
        activeFilters={activeFilters}
        onEditEvent={onEditEvent}
      />
    </motion.div>
  );
}
