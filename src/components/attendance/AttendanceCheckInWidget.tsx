import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapPin, Clock, UserCheck, LogOut, AlertCircle, Check, X, AlertTriangle, CalendarDays,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import {
  formatShiftEndLabel,
  isAtOrAfterShiftEnd,
  useStaffAttendance,
  type AttendanceStatus,
} from '@/hooks/useStaffAttendance';
import { useAttendanceConfig } from '@/hooks/useAttendanceConfig';
import { useAcademicCalendar } from '@/hooks/useAcademicCalendar';
import { useThaiHolidays } from '@/features/calendar/hooks/useThaiHolidays';
import { WIDGET_GLASS } from '@/features/home/widgetStyles';

// ── Status Configuration ──────────────────────────────────────────────────────
const STATUS_CONFIG: Record<AttendanceStatus, { label: string; bg: string; text: string; icon: LucideIcon }> = {
  present: { label: 'มาตรงเวลา', bg: 'bg-emerald-100', text: 'text-emerald-700', icon: Check },
  late: { label: 'มาสาย', bg: 'bg-amber-100', text: 'text-amber-700', icon: AlertTriangle },
  absent: { label: 'ขาดงาน', bg: 'bg-red-100', text: 'text-red-700', icon: X },
};

function StatusBadge({ status }: { status: AttendanceStatus }) {
  const c = STATUS_CONFIG[status];
  const Icon = c.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${c.bg} ${c.text}`}>
      <Icon size={11} />
      {c.label}
    </span>
  );
}

// ── Live Clock ────────────────────────────────────────────────────────────────
function LiveClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="font-mono text-3xl font-black text-slate-800 tabular-nums">
      {time.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
    </span>
  );
}

// ── Time Formatter ────────────────────────────────────────────────────────────
function fmt(ts: unknown): string {
  if (!ts) return '—';
  const d = typeof ts === 'object' && ts !== null && 'toDate' in ts
    ? (ts as { toDate: () => Date }).toDate()
    : new Date(ts as string | number | Date);
  return d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
}

// ── Main Widget ───────────────────────────────────────────────────────────────
interface AttendanceCheckInWidgetProps {
  compact?: boolean; // If true, shows minimal version
  showHistory?: boolean; // Show 7-day history
  onStatusChange?: (status: AttendanceStatus) => void;
}

export default function AttendanceCheckInWidget({
  compact = false,
  showHistory = false,
  onStatusChange,
}: AttendanceCheckInWidgetProps) {
  const { user, role } = useAuth();
  const uid = user?.uid ?? '';
  const name = user?.displayName || user?.email || 'บุคลากร';
  const { config } = useAttendanceConfig();
  const { todayRecord, history, loading, actionLoading, error, checkIn, checkOut } = useStaffAttendance(
    uid,
    name,
    config,
    undefined,
    undefined,
    false,
    { loadHistory: true },
  );
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const todayDate = `${y}-${m}-${d}`;
  const isWeekend = now.getDay() === 0 || now.getDay() === 6;
  const checkoutTimeReached = isAtOrAfterShiftEnd(now, config);
  const shiftEndLabel = formatShiftEndLabel(config);
  const { holidays: thaiHolidays } = useThaiHolidays(now.getFullYear());
  const { events: calendarEvents } = useAcademicCalendar(role ?? undefined, thaiHolidays);

  const holidayEventToday = calendarEvents.find((event) => (
    event.type === 'holiday'
    && todayDate >= event.startDate
    && todayDate <= event.endDate
  ));
  const isHoliday = !!holidayEventToday;
  const isNonWorkingDay = isWeekend || isHoliday;
  const todayLabel = now.toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const nonWorkingMessage = isWeekend
    ? 'วันนี้เป็นวันเสาร์-อาทิตย์ ไม่สามารถลงเวลาทำงานได้'
    : `วันนี้เป็นวันหยุด${holidayEventToday?.title ? ` (${holidayEventToday.title})` : ''} ไม่สามารถลงเวลาทำงานได้`;
  const holidayGreeting = isWeekend
    ? 'สุขสันต์วันหยุดสุดสัปดาห์'
    : `สุขสันต์วันหยุด${holidayEventToday?.title ? ` • ${holidayEventToday.title}` : ''}`;

  const checked = !!todayRecord?.checkInTime;
  const checkedOut = !!todayRecord?.checkOutTime;

  const handleCheckIn = () => {
    if (isNonWorkingDay || actionLoading) return;
    checkIn();
  };

  const handleCheckOut = () => {
    if (isNonWorkingDay || actionLoading || !checkoutTimeReached) return;
    checkOut();
  };

  useEffect(() => {
    if (todayRecord?.status) {
      onStatusChange?.(todayRecord.status);
    }
  }, [todayRecord?.status, onStatusChange]);

  // ── Compact Version ────────────────────────────────────────────────────────
  if (compact) {
    if (isNonWorkingDay) {
      return (
        <div
          style={WIDGET_GLASS}
          className="rounded-2xl p-4 flex flex-col gap-3"
        >
          <div className="flex items-center gap-2 text-amber-600">
            <CalendarDays size={15} />
            <p className="text-xs font-semibold">Holiday Mode</p>
          </div>
          <div className="rounded-xl bg-amber-50 border border-amber-100 p-4 text-center">
            <p className="text-[11px] font-semibold text-amber-700">{todayLabel}</p>
            <p className="mt-2 text-sm font-bold text-amber-700">{holidayGreeting}</p>
            <p className="mt-1 text-[11px] text-amber-600">{nonWorkingMessage}</p>
          </div>
        </div>
      );
    }

    return (
      <div
        style={WIDGET_GLASS}
        className="rounded-2xl p-4 flex flex-col gap-3"
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium">เช็คชื่อ</p>
            <p className="font-semibold text-slate-700 text-sm">{name}</p>
          </div>
          {todayRecord && <StatusBadge status={todayRecord.status} />}
        </div>

        {/* Time */}
        <div className="text-center py-1">
          <p className="font-mono text-2xl font-bold text-slate-800 tabular-nums">
            {new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>

        {/* Check times */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-blue-50 p-2 text-center">
            <p className="text-[10px] text-blue-400 mb-0.5">เข้า</p>
            <p className="font-bold text-xs text-blue-700">{fmt(todayRecord?.checkInTime)}</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-2 text-center">
            <p className="text-[10px] text-slate-400 mb-0.5">ออก</p>
            <p className="font-bold text-xs text-slate-700">{fmt(todayRecord?.checkOutTime)}</p>
          </div>
        </div>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-start gap-1.5 rounded-lg bg-red-50 border border-red-100 p-2 text-[11px] text-red-600"
            >
              <AlertCircle size={12} className="mt-0.5 shrink-0" />
              <span className="line-clamp-2">{error}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Button */}
        {loading ? (
          <div className="w-full py-2 flex justify-center">
            <div className="w-4 h-4 border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
          </div>
        ) : !checked ? (
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleCheckIn}
            disabled={actionLoading}
            className="w-full py-2 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-sm font-bold flex items-center justify-center gap-1.5 shadow-md shadow-blue-200 disabled:opacity-60 transition-all"
          >
            {actionLoading
              ? <div className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              : <><MapPin size={15} /> เช็คอิน</>}
          </motion.button>
        ) : !checkedOut ? (
          <motion.button
            whileTap={checkoutTimeReached ? { scale: 0.95 } : undefined}
            onClick={handleCheckOut}
            disabled={actionLoading || !checkoutTimeReached}
            title={checkoutTimeReached ? 'เช็คเอาต์' : `เช็คเอาต์ได้หลัง ${shiftEndLabel} น.`}
            className="w-full py-2 rounded-lg bg-gradient-to-r from-slate-500 to-slate-700 text-white text-sm font-bold flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            {actionLoading
              ? <div className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              : <><LogOut size={15} /> {checkoutTimeReached ? 'เช็คเอาต์' : `หลัง ${shiftEndLabel}`}</>}
          </motion.button>
        ) : (
          <div className="w-full py-2 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-600 text-sm font-bold flex items-center justify-center gap-1.5">
            <UserCheck size={15} /> บันทึกครบแล้ว
          </div>
        )}
      </div>
    );
  }

  // ── Full Version ───────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-5">
      {/* Hero card */}
      <div
        style={WIDGET_GLASS}
        className="rounded-3xl p-6 flex flex-col gap-5"
      >
        {isNonWorkingDay ? (
          <div className="rounded-2xl bg-amber-50 border border-amber-100 p-6 text-center flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-white/80 border border-amber-200 text-amber-600 flex items-center justify-center">
              <CalendarDays size={22} />
            </div>
            <p className="text-sm font-semibold text-amber-700">{todayLabel}</p>
            <p className="text-2xl font-black text-amber-700">{holidayGreeting}</p>
            <p className="text-xs text-amber-600">{nonWorkingMessage}</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400 font-medium">สวัสดี,</p>
                <p className="font-bold text-slate-700">{name}</p>
              </div>
              {todayRecord && <StatusBadge status={todayRecord.status} />}
            </div>

            {/* Clock */}
            <div className="text-center py-2">
              <LiveClock />
              <p className="text-xs text-slate-400 mt-1">{todayLabel}</p>
            </div>

            {/* Times */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-blue-50 p-3 text-center">
                <p className="text-xs text-blue-400 mb-0.5">เวลาเข้า</p>
                <p className="font-bold text-blue-700">{fmt(todayRecord?.checkInTime)}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-3 text-center">
                <p className="text-xs text-slate-400 mb-0.5">เวลาออก</p>
                <p className="font-bold text-slate-700">{fmt(todayRecord?.checkOutTime)}</p>
              </div>
            </div>

            {/* Error */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-start gap-2 rounded-xl bg-red-50 border border-red-100 p-3 text-xs text-red-600"
                >
                  <AlertCircle size={14} className="mt-0.5 shrink-0" />
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Button */}
            {loading ? (
              <div className="w-full py-4 flex justify-center">
                <div className="w-6 h-6 border-3 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
              </div>
            ) : !checked ? (
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={handleCheckIn}
                disabled={actionLoading}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-200 disabled:opacity-60 transition-all"
              >
                {actionLoading
                  ? <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  : <><MapPin size={18} /> เช็คอิน</>}
              </motion.button>
            ) : !checkedOut ? (
              <motion.button
                whileTap={checkoutTimeReached ? { scale: 0.95 } : undefined}
                onClick={handleCheckOut}
                disabled={actionLoading || !checkoutTimeReached}
                title={checkoutTimeReached ? 'เช็คเอาต์' : `เช็คเอาต์ได้หลัง ${shiftEndLabel} น.`}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-slate-500 to-slate-700 text-white font-bold flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                {actionLoading
                  ? <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  : <><LogOut size={18} /> {checkoutTimeReached ? 'เช็คเอาต์' : `เช็คเอาต์ได้หลัง ${shiftEndLabel} น.`}</>}
              </motion.button>
            ) : (
              <div className="w-full py-4 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-600 font-bold flex items-center justify-center gap-2">
                <UserCheck size={18} /> บันทึกครบแล้ววันนี้
              </div>
            )}
          </>
        )}
      </div>

      {/* History section */}
      {showHistory && (
        <div style={WIDGET_GLASS} className="rounded-3xl p-5 flex flex-col gap-3">
          <p className="font-bold text-sm text-slate-700">ประวัติ 7 วันล่าสุด</p>
          {history.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-4">ไม่มีข้อมูล</p>
          ) : (
            <div className="flex flex-col gap-2">
              {history.map(r => (
                <div key={r.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                  <div>
                    <p className="text-xs font-semibold text-slate-700">
                      {new Date(r.date).toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short' })}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      <Clock size={10} className="inline mr-0.5" />
                      {fmt(r.checkInTime)} — {fmt(r.checkOutTime)}
                    </p>
                  </div>
                  <StatusBadge status={r.status} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
