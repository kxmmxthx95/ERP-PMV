import { motion, AnimatePresence } from 'framer-motion';
import { Filter, CalendarPlus, RefreshCw, CloudOff, Cloud } from 'lucide-react';
import { EVENT_TYPE_CONFIG, type CalendarEventType } from '@/types/calendar';
import { ALL_TYPES } from '../constants';
import { toThaiFullDate } from '../utils';

export interface HolidayStatus {
  isLoading: boolean;
  error: string | null;
  count: number;  // จำนวนวันหยุดที่โหลดมาได้
}

interface CalendarHeaderProps {
  activeFilters: Set<CalendarEventType>;
  onToggleFilter: (type: CalendarEventType) => void;
  onAddEvent: () => void;
  holidayStatus: HolidayStatus;
}

export default function CalendarHeader({
  activeFilters,
  onToggleFilter,
  onAddEvent,
  holidayStatus,
}: CalendarHeaderProps) {
  const today = new Date();

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"
    >
      {/* ── Left: Title + date + holiday status ── */}
      <div>
        <div className="flex items-center gap-2.5">
          <h1 className="text-2xl font-bold text-black/85 tracking-tight">ปฏิทินการศึกษา</h1>
          <HolidayStatusBadge status={holidayStatus} />
        </div>
        <p className="text-sm text-black/35 mt-0.5">{toThaiFullDate(today)}</p>
      </div>

      {/* ── Right: Add button + filters ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={onAddEvent}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-2xl text-xs font-semibold text-white transition-all duration-150 hover:scale-[1.02] active:scale-[0.98]"
          style={{
            background: 'linear-gradient(135deg,#7c3aed,#4f46e5)',
            boxShadow: '0 0 16px #7c3aed50, 0 4px 10px rgba(0,0,0,0.12)',
          }}
        >
          <CalendarPlus size={13} />
          เพิ่มกิจกรรม
        </button>

        <div className="w-px h-4 bg-black/10 flex-shrink-0" />
        <Filter size={13} className="text-black/30 flex-shrink-0" />

        {ALL_TYPES.map(type => {
          const cfg = EVENT_TYPE_CONFIG[type];
          const active = activeFilters.has(type);
          return (
            <button
              key={type}
              onClick={() => onToggleFilter(type)}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold transition-all duration-150"
              style={{
                background: active ? cfg.bg : 'rgba(0,0,0,0.04)',
                border: `1px solid ${active ? cfg.border : 'transparent'}`,
                color: active ? cfg.color : 'rgba(0,0,0,0.35)',
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: active ? cfg.color : 'rgba(0,0,0,0.2)' }}
              />
              {cfg.label}
            </button>
          );
        })}
      </div>
    </motion.div>
  );
}

// ── Holiday Status Badge ──────────────────────────────────────────────────────
function HolidayStatusBadge({ status }: { status: HolidayStatus }) {
  const { isLoading, error, count } = status;
  const noKey = error?.includes('VITE_GOOGLE_CALENDAR_API_KEY');

  return (
    <AnimatePresence mode="wait">
      {isLoading && (
        <motion.span
          key="loading"
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.85 }}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold"
          style={{
            background: 'rgba(59,130,246,0.10)',
            border: '1px solid rgba(59,130,246,0.20)',
            color: '#3b82f6',
          }}
        >
          <RefreshCw size={10} className="animate-spin" />
          กำลังโหลดวันหยุด...
        </motion.span>
      )}

      {!isLoading && error && !noKey && (
        <motion.span
          key="error"
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.85 }}
          title={error}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold cursor-help"
          style={{
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.20)',
            color: '#ef4444',
          }}
        >
          <CloudOff size={10} />
          โหลดวันหยุดไม่ได้
        </motion.span>
      )}

      {!isLoading && !error && count > 0 && (
        <motion.span
          key="ok"
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.85 }}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold"
          style={{
            background: 'rgba(16,185,129,0.08)',
            border: '1px solid rgba(16,185,129,0.20)',
            color: '#059669',
          }}
        >
          <Cloud size={10} />
          วันหยุดไทย {count} วัน
        </motion.span>
      )}
    </AnimatePresence>
  );
}
