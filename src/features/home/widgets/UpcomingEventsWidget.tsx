import { Calendar } from 'lucide-react';
import { WIDGET_GLASS } from '../widgetStyles';
import { useAcademicCalendar } from '@/hooks/useAcademicCalendar';
import { useAuth } from '@/hooks/useAuth';
import { EVENT_TYPE_CONFIG } from '@/types/calendar';
import { motion, AnimatePresence } from 'framer-motion';

export default function UpcomingEventsWidget() {
  const { role } = useAuth();
  // Fetch events using the established hook
  const { upcomingEvents } = useAcademicCalendar(role ?? undefined);

  // Helper to format Thai date for range display if needed
  const formatThaiDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });
    } catch {
      return dateStr;
    }
  };

  return (
    <div style={WIDGET_GLASS} className="rounded-3xl p-5 flex flex-col gap-4 w-full overflow-hidden">
      {/* Widget Header */}
      <div className="flex items-center gap-2">
        <span className="font-bold text-sm text-slate-700">กิจกรรมที่กำลังมาถึง</span>
      </div>

      {/* Events List */}
      <div className="flex flex-col gap-3">
        <AnimatePresence mode="popLayout">
          {upcomingEvents.length > 0 ? (
            upcomingEvents.map((e, idx) => {
              const cfg = EVENT_TYPE_CONFIG[e.type] || EVENT_TYPE_CONFIG.activity;
              const dateObj = new Date(e.startDate);
              
              return (
                <motion.div
                  key={e.id}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05, duration: 0.3 }}
                  className="flex items-start gap-3 group"
                >
                  {/* Date Badge */}
                  <div 
                    className="flex flex-col items-center justify-center w-10 h-10 rounded-xl shrink-0 transition-transform group-hover:scale-105" 
                    style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, boxShadow: `0 4px 12px ${cfg.glow}` }}
                  >
                    <span className="text-[14px] font-black leading-none" style={{ color: cfg.color }}>
                      {e.startDate.split('-')[2]}
                    </span>
                    <span className="text-[8px] font-black uppercase tracking-tighter" style={{ color: cfg.color }}>
                      {dateObj.toLocaleDateString('th-TH', { month: 'short' })}
                    </span>
                  </div>

                  {/* Event Info */}
                  <div className="flex flex-col flex-1 min-w-0 pt-0.5">
                    <span className="text-[12px] font-bold text-slate-700 truncate group-hover:text-indigo-600 transition-colors leading-tight">
                      {e.title}
                    </span>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md" 
                        style={{ background: cfg.bg, color: cfg.color }}>
                        {cfg.label}
                      </span>
                      {e.startDate !== e.endDate && (
                        <span className="text-[9px] font-bold text-slate-400">
                          ถึง {formatThaiDate(e.endDate)}
                        </span>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })
          ) : (
            <div className="py-8 flex flex-col items-center justify-center text-slate-300 gap-2">
              <Calendar size={24} strokeWidth={1.5} className="opacity-20" />
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400/60">ไม่มีกิจกรรมเร็วๆ นี้</span>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
