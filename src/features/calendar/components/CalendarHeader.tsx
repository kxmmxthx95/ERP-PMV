import { motion, AnimatePresence } from 'framer-motion';
import { CalendarPlus, RefreshCw, CloudOff, Cloud } from 'lucide-react';
import { toThaiFullDate } from '../utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { EVENT_TYPE_CONFIG, type CalendarEventType } from '@/types/calendar';

export interface HolidayStatus {
  isLoading: boolean;
  error: string | null;
  count: number;
}

interface CalendarHeaderProps {
  onAddEvent: () => void;
  holidayStatus: HolidayStatus;
  // Filter Props
  filterType: string;
  onTypeChange: (val: string) => void;
  allTypes: CalendarEventType[];
  filterDept: string;
  onDeptChange: (val: string) => void;
  departments: any[];
  deptIdMap: Record<string, string>;
}

export default function CalendarHeader({
  onAddEvent,
  holidayStatus,
  filterType,
  onTypeChange,
  allTypes,
  filterDept,
  onDeptChange,
  departments,
  deptIdMap,
}: CalendarHeaderProps) {
  const today = new Date();

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col md:flex-row md:items-center justify-between gap-4"
    >
      {/* ── Left: Title + date ── */}
      <div>
        <div className="flex items-center gap-2.5">
          <h1 className="text-xl font-bold text-black/85 tracking-tight">ปฏิทินการศึกษา</h1>
          <HolidayStatusBadge status={holidayStatus} />
        </div>
        <p className="text-xs text-black/35 mt-0.5">{toThaiFullDate(today)}</p>
      </div>

      {/* ── Right: Compact Filter Bar & Add Button ── */}
      <div className="flex flex-col sm:flex-row items-center gap-0.5 w-full md:w-auto rounded-xl shadow-sm"
        style={{
          background: 'rgba(255, 255, 255, 0.4)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid rgba(255, 255, 255, 0.6)',
          padding: '0.15rem',
        }}
      >
        {/* Type Filter */}
        <div className="w-full sm:w-32 flex-shrink-0">
          <Select value={filterType} onValueChange={onTypeChange}>
            <SelectTrigger className="w-full px-2.5 py-0.5 bg-transparent hover:bg-black/5 border-none outline-none text-[11px] text-black/70 shadow-none focus:ring-0 h-auto rounded-md transition-colors">
              <SelectValue placeholder="ดูทั้งหมด" />
            </SelectTrigger>
            <SelectContent className="bg-white/90 backdrop-blur-xl border-white/50 rounded-xl">
              <SelectItem value="all" className="text-[11px] rounded-lg">กิจกรรมทั้งหมด</SelectItem>
              {allTypes.map((t) => (
                <SelectItem key={t} value={t} className="text-[11px] rounded-lg">
                  {EVENT_TYPE_CONFIG[t]?.label ?? t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Dept Filter */}
        <div className="w-full sm:w-36 flex-shrink-0">
          <Select value={filterDept} onValueChange={onDeptChange}>
            <SelectTrigger className="w-full px-2.5 py-0.5 bg-transparent hover:bg-black/5 border-none outline-none text-[11px] text-black/70 shadow-none focus:ring-0 h-auto rounded-md transition-colors">
              <SelectValue placeholder="แผนกทั้งหมด" />
            </SelectTrigger>
            <SelectContent className="bg-white/90 backdrop-blur-xl border-white/50 rounded-xl">
              <SelectItem value="all" className="text-[11px] rounded-lg">แผนกทั้งหมด</SelectItem>
              {departments.map((d) => {
                const val = deptIdMap[d.id] ?? d.id;
                return (
                  <SelectItem key={d.id} value={val} className="text-[11px] rounded-lg">
                    {d.label}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        {/* Add Button */}
        <button
          onClick={onAddEvent}
          className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold text-white transition-all duration-150 hover:scale-[1.02] active:scale-[0.98] h-auto border-0 bg-[#1e1e1e] hover:bg-[#2a2a2a] flex-shrink-0 ml-0.5"
          style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
        >
          <CalendarPlus size={14} />
          เพิ่มกิจกรรม
        </button>
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
