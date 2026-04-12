import { parseISO, format } from 'date-fns';
import { th } from 'date-fns/locale';
import { EVENT_TYPE_CONFIG } from '@/types/calendar';
import type { CalendarEvent } from '@/types/calendar';
import { formatEventDateRange } from '../utils';

interface UpcomingEventItemProps {
  event: CalendarEvent;
}

export default function UpcomingEventItem({ event }: UpcomingEventItemProps) {
  const cfg = EVENT_TYPE_CONFIG[event.type];
  const start = parseISO(event.startDate);

  return (
    <div className="flex items-start gap-3 px-5 py-3.5 hover:bg-black/[0.02] transition-colors cursor-default">
      {/* Date badge */}
      <div
        className="flex flex-col items-center justify-center w-10 h-10 rounded-2xl flex-shrink-0"
        style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}
      >
        <span className="text-[11px] font-black leading-none" style={{ color: cfg.color }}>
          {start.getDate()}
        </span>
        <span className="text-[9px] font-semibold" style={{ color: cfg.color }}>
          {format(start, 'MMM', { locale: th })}
        </span>
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-black/70 truncate">{event.title}</p>
        <p className="text-[11px] text-black/35 mt-0.5">
          {formatEventDateRange(event.startDate, event.endDate)}
        </p>
      </div>

      <span
        className="flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full self-start mt-0.5"
        style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}
      >
        {cfg.label}
      </span>
    </div>
  );
}
