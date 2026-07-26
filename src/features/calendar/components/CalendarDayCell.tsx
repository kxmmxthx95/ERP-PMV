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
  onDoubleClick?: () => void;
  onDropEvent?: (eventId: string, targetDate: Date) => void;
}

export default function CalendarDayCell({
  day,
  currentMonth,
  selectedDate,
  events,
  activeFilters,
  onSelect,
  onDoubleClick,
  onDropEvent,
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
      onDoubleClick={onDoubleClick}
      className="relative flex flex-col items-start py-2 px-2 rounded-[1.25rem] transition-all duration-200 min-h-[100px] group border border-slate-200/40"
      style={{
        background: isSelected
          ? 'rgba(15,23,42,0.06)'
          : 'transparent',
        outline: isSelected ? '1.5px solid rgba(15,23,42,0.10)' : 'none',
      }}
      onMouseEnter={e => {
        if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.03)';
      }}
      onMouseLeave={e => {
        if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent';
      }}
      onDragOver={(e) => { e.preventDefault(); }}
      onDrop={(e) => {
        e.preventDefault();
        const eventId = e.dataTransfer.getData('text/plain');
        if (eventId && onDropEvent) onDropEvent(eventId, day);
      }}
    >
      {/* Header: Date left, status right */}
      <div className="w-full flex items-start justify-between mb-1">
        <span
          className="w-6 h-6 flex items-center justify-center rounded-full text-[10px] font-black font-sukhumvit flex-shrink-0"
          style={{
            background: isTodayDay
              ? 'linear-gradient(135deg, #7c3aed, #4f46e5)'
              : isSelected
                ? 'rgba(15,23,42,0.09)'
                : 'transparent',
            boxShadow: isTodayDay ? '0 2px 8px rgba(124,58,237,0.3)' : 'none',
            color: isTodayDay
              ? '#fff'
              : !inMonth
                ? 'rgba(0,0,0,0.15)'
                : dow === 0
                  ? '#ef4444'
                  : dow === 6
                    ? '#3b82f6'
                    : 'rgba(15,23,42,0.78)',
          }}
        >
          {day.getDate()}
        </span>

        {/* Event type dot (first event) */}
        {dayEvents.length > 0 && (
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{
              background: EVENT_TYPE_CONFIG[dayEvents[0].type].color,
            }}
          />
        )}
      </div>

      {/* Event list */}
      <div className="w-full space-y-0.5 mt-auto text-left text-[9px] min-w-0">
        {dayEvents.slice(0, 2).map(ev => (
          <div
            key={ev.id}
            title={ev.title}
            className="line-clamp-2 font-medium text-slate-700"
            style={{ color: EVENT_TYPE_CONFIG[ev.type].color }}
          >
            {ev.title}
          </div>
        ))}
        {dayEvents.length > 2 && (
          <div className="text-[7px] text-slate-400 font-bold">
            +{dayEvents.length - 2} อื่น
          </div>
        )}
      </div>
    </button>
  );
}
