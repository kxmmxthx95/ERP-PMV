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
      className="relative flex flex-col items-center py-1.5 rounded-2xl transition-all duration-150 min-h-[60px]"
      style={{ background: isSelected ? 'rgba(0,0,0,0.07)' : 'transparent' }}
      onMouseEnter={e => {
        if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.04)';
      }}
      onDragOver={(e) => {
        e.preventDefault(); // อนุญาตให้วางข้อมูลได้
      }}
      onDrop={(e) => {
        e.preventDefault();
        const eventId = e.dataTransfer.getData('text/plain');
        if (eventId && onDropEvent) onDropEvent(eventId, day);
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

      {/* Event Display (Strips for Multi-day, Dots for Single-day) */}
      <div className="w-full mt-1 space-y-1">
        {/* Multi-day Events (Strips) */}
        {dayEvents.filter(ev => ev.startDate !== ev.endDate).slice(0, 2).map(ev => {
          const isStart = dateStr === ev.startDate;
          const isEnd   = dateStr === ev.endDate;
          const config  = EVENT_TYPE_CONFIG[ev.type];
          
          return (
            <div
              key={ev.id}
              title={ev.title}
              className="h-1.5 w-full transition-opacity overflow-hidden"
              style={{ 
                background: config.bg.replace('0.10', '0.85'),
                borderLeft: isStart ? `2px solid ${config.color}` : 'none',
                borderRadius: `${isStart ? '4px' : '0'} ${isEnd ? '4px' : '0'} ${isEnd ? '4px' : '0'} ${isStart ? '4px' : '0'}`,
                padding: '0 2px',
              }}
            />
          );
        })}

        {/* Single-day Events (Dots) */}
        <div className="flex gap-1 px-1 flex-wrap justify-center">
          {dayEvents.filter(ev => ev.startDate === ev.endDate).slice(0, 4).map(ev => (
            <span
              key={ev.id}
              title={ev.title}
              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ background: EVENT_TYPE_CONFIG[ev.type].color }}
            />
          ))}
          {dayEvents.length > 4 && (
            <span className="text-[8px] text-black/30 font-bold leading-none">
              +{dayEvents.length - 4}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
