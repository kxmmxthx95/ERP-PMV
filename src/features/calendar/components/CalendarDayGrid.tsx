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
    onSelectDate(isAlreadySelected ? new Date(NaN) : day);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 px-5 pt-4 pb-2">
        {DAY_NAMES.map((d, i) => (
          <div
            key={d}
            className="text-center text-[10px] font-black pb-2 font-sukhumvit uppercase tracking-widest"
            style={{
              color: i === 0 ? 'rgba(239,68,68,0.65)' : i === 6 ? 'rgba(59,130,246,0.65)' : 'rgba(15,23,42,0.22)',
            }}
          >
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-1 px-5 pb-5 flex-1 auto-rows-fr">
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
    </div>
  );
}
