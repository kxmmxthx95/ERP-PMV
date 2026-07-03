import { Calendar } from 'lucide-react';
import { WIDGET_CARD, WIDGET_GLASS } from '../widgetStyles';
import { useAcademicCalendar } from '@/hooks/useAcademicCalendar';
import { useAuth } from '@/hooks/useAuth';
import { EVENT_TYPE_CONFIG } from '@/types/calendar';

export default function UpcomingEventsWidget() {
  const { role } = useAuth();
  const { upcomingEvents } = useAcademicCalendar(role ?? undefined);
  const nextEvent = upcomingEvents[0];

  return (
    <div style={WIDGET_GLASS} className={WIDGET_CARD}>
      <div className="shrink-0">
        <span className="font-bold text-sm text-slate-700 truncate block">กิจกรรมที่กำลังมาถึง</span>
      </div>

      <div className="flex-1 min-h-0 flex items-center overflow-hidden">
        {nextEvent ? (
          <div className="flex items-center gap-2 min-w-0 w-full">
            {(() => {
              const cfg = EVENT_TYPE_CONFIG[nextEvent.type] || EVENT_TYPE_CONFIG.activity;
              const dateObj = new Date(nextEvent.startDate);
              return (
                <>
                  <div
                    className="flex flex-col items-center justify-center w-9 h-9 rounded-lg shrink-0"
                    style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}
                  >
                    <span className="text-xs font-black leading-none" style={{ color: cfg.color }}>
                      {nextEvent.startDate.split('-')[2]}
                    </span>
                    <span className="text-[7px] font-black uppercase" style={{ color: cfg.color }}>
                      {dateObj.toLocaleDateString('th-TH', { month: 'short' })}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-bold text-slate-700 truncate leading-tight">{nextEvent.title}</p>
                    <p className="text-[9px] font-bold text-slate-400 mt-0.5">{cfg.label}</p>
                  </div>
                </>
              );
            })()}
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 w-full text-slate-300">
            <Calendar size={16} strokeWidth={1.5} className="opacity-30 shrink-0" />
            <span className="text-[10px] font-bold text-slate-400">ไม่มีกิจกรรมเร็วๆ นี้</span>
          </div>
        )}
      </div>
    </div>
  );
}
