import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { HiChevronLeft, HiChevronRight } from 'react-icons/hi2';
import { useAuth } from '@/hooks/useAuth';
import { useAcademicCalendar } from '@/hooks/useAcademicCalendar';
import { useThaiHolidays } from '@/features/calendar/hooks/useThaiHolidays';
import {
  loadStaffCheckInHistory,
  summarizeCheckInHistory,
  type CheckInHistoryRow,
  type CheckInHistoryStatus,
} from '@/lib/staffAttendance/checkInHistory';
import type { LeaveRequest } from '@/types/leave';
import { cn } from '@/lib/utils';

const THAI_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
];

const WEEKDAY_LABELS = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

const STATUS_CELL_BG: Record<string, string> = {
  present: 'bg-emerald-50 border-emerald-200',
  late: 'bg-amber-50 border-amber-200',
  absent: 'bg-destructive/10 border-destructive/30',
  leave: 'bg-primary/10 border-primary/25',
};

function toYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getMonthGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const startDow = first.getDay();
  const cells: Date[] = [];
  const prevMonthLast = new Date(year, month, 0);
  const prevDaysCount = prevMonthLast.getDate();
  for (let i = startDow - 1; i >= 0; i--) {
    cells.push(new Date(year, month - 1, prevDaysCount - i));
  }
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(new Date(year, month, d));
  }
  let nextDay = 1;
  while (cells.length % 7 !== 0) {
    cells.push(new Date(year, month + 1, nextDay++));
  }
  return cells;
}

type Props = {
  userId: string;
  leaveRequests: LeaveRequest[];
  isSpecialTeacher?: boolean;
};

export default function PersonalAttendanceCalendarPanel({
  userId,
  leaveRequests,
  isSpecialTeacher = false,
}: Props) {
  const { role } = useAuth();
  const now = useMemo(() => new Date(), []);
  const [viewY, setViewY] = useState(now.getFullYear());
  const [viewM, setViewM] = useState(now.getMonth());
  const [monthDir, setMonthDir] = useState(0);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<CheckInHistoryRow[]>([]);

  const { holidays: thaiHolidays } = useThaiHolidays(viewY);
  const { events: calendarEvents } = useAcademicCalendar(role ?? undefined, thaiHolidays);

  const leaveDates = useMemo(() => {
    const dates = new Set<string>();
    leaveRequests
      .filter((req) => req.requesterId === userId && req.status !== 'rejected')
      .forEach((req) => {
        const cursor = new Date(`${req.startDate}T12:00:00`);
        const end = new Date(`${req.endDate}T12:00:00`);
        while (cursor <= end) {
          dates.add(toYMD(cursor));
          cursor.setDate(cursor.getDate() + 1);
        }
      });
    return dates;
  }, [leaveRequests, userId]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      try {
        const monthStart = `${viewY}-${String(viewM + 1).padStart(2, '0')}-01`;
        const monthEnd = toYMD(new Date(viewY, viewM + 1, 0));
        const history = await loadStaffCheckInHistory(
          userId,
          monthStart,
          monthEnd,
          leaveDates,
          isSpecialTeacher,
        );
        if (cancelled) return;

        const seenDates = new Set(history.map((r) => r.date));
        const todayYMD = toYMD(new Date());
        const filled = [...history];
        const daysInMonth = new Date(viewY, viewM + 1, 0).getDate();
        for (let d = 1; d <= daysInMonth; d++) {
          const dateStr = `${viewY}-${String(viewM + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          if (seenDates.has(dateStr) || dateStr > todayYMD) continue;
          const dow = new Date(viewY, viewM, d).getDay();
          if (dow === 0 || dow === 6) continue;
          const isHoliday = calendarEvents.some(
            (event) => event.type === 'holiday' && dateStr >= event.startDate && dateStr <= event.endDate,
          );
          if (isHoliday) continue;
          filled.push({
            date: dateStr,
            status: 'absent',
            checkInLabel: '—',
            checkOutLabel: '—',
            note: 'ไม่มีการเช็กอินเข้างาน',
          });
        }
        setRows(filled);
      } catch {
        if (!cancelled) setRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [userId, leaveDates, isSpecialTeacher, viewY, viewM, calendarEvents]);

  const statusByDate = useMemo(() => {
    const m = new Map<string, CheckInHistoryStatus>();
    rows.forEach((r) => m.set(r.date, r.status));
    return m;
  }, [rows]);

  const stats = useMemo(() => summarizeCheckInHistory(rows), [rows]);
  const cells = useMemo(() => getMonthGrid(viewY, viewM), [viewY, viewM]);
  const todayStr = toYMD(now);

  const goPrevMonth = () => {
    setMonthDir(-1);
    if (viewM === 0) {
      setViewY((y) => y - 1);
      setViewM(11);
    } else {
      setViewM((m) => m - 1);
    }
  };

  const goNextMonth = () => {
    setMonthDir(1);
    if (viewM === 11) {
      setViewY((y) => y + 1);
      setViewM(0);
    } else {
      setViewM((m) => m + 1);
    }
  };

  const goToday = () => {
    setMonthDir(0);
    setViewY(now.getFullYear());
    setViewM(now.getMonth());
  };

  return (
    <div className="flex shrink-0 flex-col gap-2 border-t border-border/60 px-3 pb-3 pt-2">
      <div className="grid grid-cols-5 gap-1.5">
        <div className="rounded-xl border border-border bg-muted/40 px-1 py-1.5 text-center">
          <p className="truncate text-[9px] font-bold text-muted-foreground">วันทำงาน</p>
          <p className="text-[15px] font-black tabular-nums text-foreground">
            {loading ? '—' : stats.total}
          </p>
        </div>
        <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-1 py-1.5 text-center">
          <p className="truncate text-[9px] font-bold text-emerald-600/80">ตรง</p>
          <p className="text-[15px] font-black tabular-nums text-emerald-700">
            {loading ? '—' : stats.present}
          </p>
        </div>
        <div className="rounded-xl border border-amber-100 bg-amber-50 px-1 py-1.5 text-center">
          <p className="truncate text-[9px] font-bold text-amber-600/80">สาย</p>
          <p className="text-[15px] font-black tabular-nums text-amber-700">
            {loading ? '—' : stats.late}
          </p>
        </div>
        <div className="rounded-xl border border-destructive/20 bg-destructive/10 px-1 py-1.5 text-center">
          <p className="truncate text-[9px] font-bold text-destructive/80">ขาด</p>
          <p className="text-[15px] font-black tabular-nums text-destructive">
            {loading ? '—' : stats.absent}
          </p>
        </div>
        <div className="rounded-xl border border-primary/20 bg-primary/10 px-1 py-1.5 text-center">
          <p className="truncate text-[9px] font-bold text-primary/80">ลา</p>
          <p className="text-[15px] font-black tabular-nums text-primary">
            {loading ? '—' : stats.leave}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={goPrevMonth}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card text-foreground"
          aria-label="เดือนก่อน"
        >
          <HiChevronLeft className="h-4 w-4" />
        </button>
        <div className="flex flex-col items-center gap-1">
          <p className="text-[13px] font-black text-foreground font-sukhumvit">
            {THAI_MONTHS[viewM]} {viewY + 543}
          </p>
          <button
            type="button"
            onClick={goToday}
            className="rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-black text-primary-foreground"
          >
            วันนี้
          </button>
        </div>
        <button
          type="button"
          onClick={goNextMonth}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card text-foreground"
          aria-label="เดือนถัดไป"
        >
          <HiChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid shrink-0 grid-cols-7 gap-1.5">
        {WEEKDAY_LABELS.map((d, idx) => (
          <div
            key={d}
            className={cn(
              'text-center text-[10px] font-black',
              idx === 0 ? 'text-rose-500' : idx === 6 ? 'text-blue-500' : 'text-foreground',
            )}
          >
            {d}
          </div>
        ))}
      </div>

      {/* auto-rows คงที่ + h-full ในช่อง — กันแถวถูก flex บีบแล้วพื้นหลังช่องซ้อนทับแถวถัดไป */}
      <div className="relative shrink-0">
        <AnimatePresence mode="wait" initial={false} custom={monthDir}>
          <motion.div
            key={`${viewY}-${viewM}`}
            initial={{ opacity: 0, x: monthDir >= 0 ? 28 : -28 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: monthDir >= 0 ? -28 : 28 }}
            transition={{ duration: 0.2 }}
            className="grid grid-cols-7 gap-1.5 auto-rows-[2.75rem]"
          >
            {cells.map((date) => {
              const dateStr = toYMD(date);
              const status = statusByDate.get(dateStr);
              const isToday = dateStr === todayStr;
              const isFuture = dateStr > todayStr;
              const isCurrentMonth = date.getMonth() === viewM;
              const dayOfWeek = date.getDay();
              const isSunday = dayOfWeek === 0;
              const isSaturday = dayOfWeek === 6;
              const isHoliday = calendarEvents.some(
                (event) => event.type === 'holiday' && dateStr >= event.startDate && dateStr <= event.endDate,
              );
              const hasStatusColor = !isFuture && isCurrentMonth && !isHoliday && !!status;

              return (
                <div
                  key={dateStr}
                  className={cn(
                    'relative flex h-full min-h-0 flex-col items-start justify-start overflow-hidden rounded-xl border p-1.5',
                    isToday && 'ring-1 ring-primary/40',
                    !isCurrentMonth
                      ? 'border-border/60 bg-muted/30 opacity-50'
                      : isHoliday
                        ? 'cursor-not-allowed border-border bg-muted/50 opacity-60'
                        : hasStatusColor
                          ? (STATUS_CELL_BG[status as string] ?? 'border-border bg-card')
                          : 'border-border bg-card',
                  )}
                >
                  <span
                    className={cn(
                      'inline-flex h-5 min-w-5 items-center justify-center rounded-full text-[10px] font-black tabular-nums leading-none font-sukhumvit',
                      isToday
                        ? 'bg-primary text-primary-foreground'
                        : !isCurrentMonth
                          ? (isSunday ? 'text-rose-300' : isSaturday ? 'text-blue-300' : 'text-muted-foreground/50')
                          : (isSunday ? 'text-rose-500' : isSaturday ? 'text-blue-500' : 'text-foreground'),
                    )}
                  >
                    {date.getDate()}
                  </span>
                </div>
              );
            })}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
