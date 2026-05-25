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

  const multiDayEvents = dayEvents.filter(ev => ev.startDate !== ev.endDate).slice(0, 2);
  const singleDayEvents = dayEvents.filter(ev => ev.startDate === ev.endDate);

  return (
    <button
      key={dateStr}
      onClick={() => onSelect(day)}
      onDoubleClick={onDoubleClick}
      className="relative flex flex-col items-center py-2 rounded-[1.25rem] transition-all duration-200 min-h-[64px] group"
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
      {/* Day number */}
      <span
        className="w-8 h-8 flex items-center justify-center rounded-full text-[12px] font-black transition-all duration-200 font-sukhumvit flex-shrink-0"
        style={{
          background: isTodayDay
            ? 'linear-gradient(135deg, #7c3aed, #4f46e5)'
            : isSelected
              ? 'rgba(15,23,42,0.09)'
              : 'transparent',
          boxShadow: isTodayDay ? '0 2px 12px rgba(124,58,237,0.38), 0 0 0 3px rgba(124,58,237,0.10)' : 'none',
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

      {/* Event indicators */}
      <div className="w-full mt-1 px-1 space-y-0.5">
        {/* Multi-day event strips */}
        {multiDayEvents.map(ev => {
          const isStart = dateStr === ev.startDate;
          const isEnd = dateStr === ev.endDate;
          const config = EVENT_TYPE_CONFIG[ev.type];
          return (
            <div
              key={ev.id}
              title={ev.title}
              className="h-[3px] w-full overflow-hidden"
              style={{
                background: config.color,
                opacity: inMonth ? 0.75 : 0.25,
                borderRadius: `${isStart ? '4px' : '0'} ${isEnd ? '4px' : '0'} ${isEnd ? '4px' : '0'} ${isStart ? '4px' : '0'}`,
              }}
            />
          );
        })}

        {/* Single-day event dots */}
        <div className="flex gap-0.5 flex-wrap justify-center pt-0.5">
          {singleDayEvents.slice(0, 3).map(ev => (
            <span
              key={ev.id}
              title={ev.title}
              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{
                background: EVENT_TYPE_CONFIG[ev.type].color,
                opacity: inMonth ? 1 : 0.3,
                boxShadow: `0 0 4px ${EVENT_TYPE_CONFIG[ev.type].color}60`,
              }}
            />
          ))}
          {singleDayEvents.length > 3 && (
            <span className="text-[7px] text-slate-400 font-black leading-none mt-px">
              +{singleDayEvents.length - 3}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
