import { isSameDay } from 'date-fns';
import type { CalendarEvent, CalendarEventType } from '@/types/calendar';
import { DAY_NAMES } from '../constants';
import { toDateStr } from '../utils';
import CalendarDayCell from './CalendarDayCell';

interface CalendarDayGridProps {
  days: Date[];
  currentMonth: Date;
  selectedDate: Date | null;
  activeFilters: Set<CalendarEventType>;
  getEventsForDate: (dateStr: string) => CalendarEvent[];
  onSelectDate: (day: Date) => void;
  onAddEventForDate?: (day: Date) => void;
  onMoveEvent?: (eventId: string, newDate: Date) => void;
}

export default function CalendarDayGrid({
  days,
  currentMonth,
  selectedDate,
  activeFilters,
  getEventsForDate,
  onSelectDate,
  onAddEventForDate,
  onMoveEvent,
}: CalendarDayGridProps) {
  const handleSelect = (day: Date) => {
    const isAlreadySelected = selectedDate ? isSameDay(day, selectedDate) : false;
    onSelectDate(isAlreadySelected ? new Date(NaN) : day); // NaN date signals deselect
  };

  return (
    <>
      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 px-4 pt-3 pb-1">
        {DAY_NAMES.map((d, i) => (
          <div
            key={d}
            className="text-center text-[11px] font-bold pb-2"
            style={{
              color: i === 0 ? '#ef4444' : i === 6 ? '#3b82f6' : 'rgba(0,0,0,0.35)',
            }}
          >
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-px px-4 pb-4">
        {days.map(day => {
          const dateStr = toDateStr(day);
          const dayEvents = getEventsForDate(dateStr);
          return (
            <CalendarDayCell
              key={dateStr}
              day={day}
              currentMonth={currentMonth}
              selectedDate={selectedDate}
              events={dayEvents}
              activeFilters={activeFilters}
              onSelect={handleSelect}
              onDoubleClick={() => onAddEventForDate?.(day)}
              onDropEvent={onMoveEvent}
            />
          );
        })}
      </div>
    </>
  );
}
