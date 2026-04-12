import { isSameMonth, isSameDay, isToday } from 'date-fns';
import { EVENT_TYPE_CONFIG, type CalendarEventType } from '@/types/calendar';
import type { CalendarEvent } from '@/types/calendar';
import { toDateStr } from '../utils';

interface CalendarDayCellProps {
  day: Date;
  currentMonth: Date;
  selectedDate: Date | null;
  events: CalendarEvent[];
  activeFilters: Set<CalendarEventType>;
  onSelect: (day: Date) => void;
}

export default function CalendarDayCell({
  day,
  currentMonth,
  selectedDate,
  events,
  activeFilters,
  onSelect,
}: CalendarDayCellProps) {
  const dateStr = toDateStr(day);
  const dayEvents = events.filter(e => activeFilters.has(e.type));
  const inMonth = isSameMonth(day, currentMonth);
  const isSelected = selectedDate ? isSameDay(day, selectedDate) : false;
  const isTodayDay = isToday(day);
  const dow = day.getDay();

  return (
    <button
      key={dateStr}
      onClick={() => onSelect(day)}
      className="relative flex flex-col items-center py-1.5 rounded-2xl transition-all duration-150 min-h-[60px]"
      style={{ background: isSelected ? 'rgba(0,0,0,0.07)' : 'transparent' }}
      onMouseEnter={e => {
        if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.04)';
      }}
      onMouseLeave={e => {
        if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent';
      }}
    >
      {/* Day number */}
      <span
        className="w-7 h-7 flex items-center justify-center rounded-full text-xs font-semibold transition-all"
        style={{
          background: isTodayDay ? 'linear-gradient(135deg,#7c3aed,#4f46e5)' : 'transparent',
          boxShadow: isTodayDay ? '0 0 12px #7c3aed60' : 'none',
          color: isTodayDay
            ? '#fff'
            : !inMonth
            ? 'rgba(0,0,0,0.18)'
            : dow === 0
            ? '#ef4444'
            : dow === 6
            ? '#3b82f6'
            : 'rgba(0,0,0,0.70)',
        }}
      >
        {day.getDate()}
      </span>

      {/* Event dots */}
      {dayEvents.length > 0 && (
        <div className="flex gap-0.5 mt-1 flex-wrap justify-center max-w-[40px]">
          {dayEvents.slice(0, 3).map(ev => (
            <span
              key={ev.id}
              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ background: EVENT_TYPE_CONFIG[ev.type].color }}
            />
          ))}
          {dayEvents.length > 3 && (
            <span className="text-[9px] text-black/30 font-bold">+{dayEvents.length - 3}</span>
          )}
        </div>
      )}
    </button>
  );
}
