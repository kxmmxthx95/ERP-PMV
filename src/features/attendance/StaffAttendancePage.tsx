import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  HiCalendarDays,
  HiChevronDown,
  HiChevronLeft,
  HiChevronRight,
  HiCog6Tooth,
  HiChartBarSquare,
  HiXMark,
} from 'react-icons/hi2';
import type { IconType } from 'react-icons';
import {
  AlertCircle, Check, X, AlertTriangle, Users, Search, List, LayoutGrid as Grid, SlidersHorizontal,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { loadStaffCheckInHistory, summarizeCheckInHistory, type CheckInHistoryRow, type CheckInHistoryStatus } from '@/lib/staffAttendance/checkInHistory';

import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { DRAWER_HEADER_ICON_BTN, DRAWER_HEADER_RIGHT_ACTIONS } from '@/lib/drawerHeaderBtn';
import GradeBookClassSidebar from '@/features/grades/components/GradeBookClassSidebar';
import SidebarCollapseButton from '@/features/grades/components/SidebarCollapseButton';
import { useAuth } from '@/hooks/useAuth';
import {
  useAdminStaffAttendance,
  resolveStaffAttendanceDisplay,
  type StaffAttendanceRecord,
  type AttendanceStatus,
} from '@/hooks/useStaffAttendance';
import { useTeachersCollection } from '@/hooks/useTeachersCollection';
import {
  buildTeacherPositionByUserId,
  isSpecialTeacherUser,
} from '@/lib/staffAttendance/specialTeacher';
import { useLeaveRequestsSince } from '@/hooks/useLeaveRequests';
import { useStaffUsers } from '@/hooks/useStaffUsers';
import type { LeaveRequest, LeaveStatus, LeaveType } from '@/types/leave';
import { useAcademicCalendar } from '@/hooks/useAcademicCalendar';
import { useThaiHolidays } from '@/features/calendar/hooks/useThaiHolidays';
import AttendanceSettingsPanel from './AttendanceSettingsPanel';
import AttendanceReportPanel from './AttendanceReportPanel';
import { DEPARTMENT_CONFIG, type Department } from '@/types/curriculum';


const STATUS_CONFIG: Record<AttendanceStatus, { label: string; bg: string; text: string; icon: LucideIcon }> = {
  present: { label: 'มาตรงเวลา', bg: 'bg-emerald-100', text: 'text-emerald-700', icon: Check },
  late: { label: 'มาสาย', bg: 'bg-amber-100', text: 'text-amber-700', icon: AlertTriangle },
  absent: { label: 'ขาดงาน', bg: 'bg-red-100', text: 'text-red-700', icon: X },
};


const DRAWER_CONTENT_CLASS = cn(
  'flex h-dvh max-h-dvh flex-col overflow-hidden bg-transparent p-0 before:hidden z-50',
  'data-[vaul-drawer-direction=right]:w-screen data-[vaul-drawer-direction=right]:max-w-none',
  'sm:h-full sm:max-h-full sm:p-2',
  'sm:data-[vaul-drawer-direction=right]:w-full sm:data-[vaul-drawer-direction=right]:max-w-md',
);

const DRAWER_PANEL_CLASS = cn(
  'flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-white',
  'sm:rounded-4xl sm:border sm:border-border sm:shadow-xl',
);


type StaffAttendanceTableRow = StaffAttendanceRecord & {
  isLeave?: boolean;
  isAutoAbsent?: boolean;
  isPending?: boolean;
  isHolidayDay?: boolean;
  leaveType?: LeaveType;
  leaveStatus?: LeaveStatus;
  leaveStartDate?: string;
  leaveEndDate?: string;
};

interface StaffDirectoryItem {
  userId: string;
  displayName: string;
  photoURL?: string;
  department?: string;
}

interface PersonalStatsPanelProps {
  row: StaffAttendanceTableRow;
  leaveRequests: LeaveRequest[];
  isSpecialTeacher?: boolean;
}

const THAI_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
];
// จุดสถานะเดิมย้ายมาเป็นสีพื้นช่องตารางแทน (มองเห็นง่ายกว่าจุดเล็กๆ)
const STATUS_CELL_BG: Record<string, string> = {
  present: 'bg-emerald-50 border-emerald-200',
  late: 'bg-amber-50 border-amber-200',
  absent: 'bg-[#F22C07]/10 border-[#F22C07]/30',
  leave: 'bg-blue-50 border-blue-200',
};
const WEEKDAY_LABELS = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

function getMonthGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const startDow = first.getDay(); // Sun = 0
  const cells: Date[] = [];

  // Days of previous month
  const prevMonthLast = new Date(year, month, 0);
  const prevDaysCount = prevMonthLast.getDate();
  for (let i = startDow - 1; i >= 0; i--) {
    cells.push(new Date(year, month - 1, prevDaysCount - i));
  }

  // Days of current month
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(new Date(year, month, d));
  }

  // Days of next month
  let nextDay = 1;
  while (cells.length % 7 !== 0) {
    cells.push(new Date(year, month + 1, nextDay++));
  }

  return cells;
}

function toYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function PersonalStatsPanel({ row, leaveRequests, isSpecialTeacher = false }: PersonalStatsPanelProps) {
  const { role } = useAuth();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [rows, setRows] = useState<CheckInHistoryRow[]>([]);

  const now = new Date();
  const [viewY, setViewY] = useState(now.getFullYear());
  const [viewM, setViewM] = useState(now.getMonth());

  const { holidays: thaiHolidays } = useThaiHolidays(viewY);
  const { events: calendarEvents } = useAcademicCalendar(role ?? undefined, thaiHolidays);

  const leaveDates = useMemo(() => {
    const dates = new Set<string>();
    leaveRequests
      .filter((req) => req.requesterId === row.userId && req.status !== 'rejected')
      .forEach((req) => {
        const cursor = new Date(`${req.startDate}T12:00:00`);
        const end = new Date(`${req.endDate}T12:00:00`);
        while (cursor <= end) {
          dates.add(toYMD(cursor));
          cursor.setDate(cursor.getDate() + 1);
        }
      });
    return dates;
  }, [leaveRequests, row.userId]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setLoadError('');
      try {
        const monthStart = `${viewY}-${String(viewM + 1).padStart(2, '0')}-01`;
        const monthEnd = toYMD(new Date(viewY, viewM + 1, 0));
        const history = await loadStaffCheckInHistory(row.userId, monthStart, monthEnd, leaveDates, isSpecialTeacher);
        if (cancelled) return;

        // Days with no check-in record and no leave, on a working day up to today, count as absent.
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
          filled.push({ date: dateStr, status: 'absent', checkInLabel: '—', checkOutLabel: '—', note: 'ไม่มีการเช็กอินเข้างาน' });
        }
        setRows(filled);
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'โหลดข้อมูลไม่สำเร็จ');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [row.userId, leaveDates, isSpecialTeacher, viewY, viewM, calendarEvents]);

  const statusByDate = useMemo(() => {
    const m = new Map<string, CheckInHistoryStatus>();
    rows.forEach((r) => m.set(r.date, r.status));
    return m;
  }, [rows]);

  const stats = useMemo(() => summarizeCheckInHistory(rows), [rows]);
  const pct = stats.total > 0 ? Math.round(((stats.present + stats.late) / stats.total) * 100) : null;

  const cells = useMemo(() => getMonthGrid(viewY, viewM), [viewY, viewM]);
  const todayStr = toYMD(now);

  return (
    <motion.div
      key={row.id}
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -10 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="lg:rounded-2xl lg:bg-card lg:border lg:border-border p-5 flex-1 flex flex-col min-h-0 h-full"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-14 h-14 rounded-full overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
            {row.photoURL ? (
              <img src={row.photoURL} alt={row.displayName} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-500 font-black">
                {row.displayName.charAt(0)}
              </div>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-base font-black text-slate-800 truncate">{row.displayName}</p>
            <p className="text-[11px] text-slate-500">
              {DEPARTMENT_CONFIG[row.department as Department]?.label || row.department || '-'}
            </p>
          </div>
        </div>

        {pct !== null && (
          <div className="shrink-0 text-right">
            <p className="text-[18px] font-black leading-none text-emerald-600 tabular-nums">{pct}%</p>
            <p className="mt-0.5 text-[9px] font-bold text-slate-400">ตรงเวลา</p>
          </div>
        )}
      </div>

      {/* Stats summary */}
      <div className="mt-4 grid grid-cols-5 gap-2">
        <div className="rounded-xl bg-slate-50 border border-slate-100 px-1 py-2 text-center">
          <p className="text-[9px] font-bold text-slate-500 truncate">วันทำงาน</p>
          <p className="text-[16px] font-black text-slate-800 tabular-nums">{loading ? '—' : stats.total}</p>
        </div>
        <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-1 py-2 text-center">
          <p className="text-[9px] font-bold text-emerald-600/80 truncate">ตรง</p>
          <p className="text-[16px] font-black text-emerald-700 tabular-nums">{loading ? '—' : stats.present}</p>
        </div>
        <div className="rounded-xl bg-amber-50 border border-amber-100 px-1 py-2 text-center">
          <p className="text-[9px] font-bold text-amber-600/80 truncate">สาย</p>
          <p className="text-[16px] font-black text-amber-700 tabular-nums">{loading ? '—' : stats.late}</p>
        </div>
        <div className="rounded-xl bg-[#F22C07]/10 border border-[#F22C07]/20 px-1 py-2 text-center">
          <p className="text-[9px] font-bold text-[#F22C07]/80 truncate">ขาด</p>
          <p className="text-[16px] font-black text-[#F22C07] tabular-nums">{loading ? '—' : stats.absent}</p>
        </div>
        <div className="rounded-xl bg-blue-50 border border-blue-100 px-1 py-2 text-center">
          <p className="text-[9px] font-bold text-blue-600/80 truncate">ลา</p>
          <p className="text-[16px] font-black text-blue-700 tabular-nums">{loading ? '—' : stats.leave}</p>
        </div>
      </div>

      {/* Month nav */}
      <div className="mt-4 mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => {
            if (viewM === 0) { setViewY((y) => y - 1); setViewM(11); }
            else setViewM((m) => m - 1);
          }}
          className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
        >
          <HiChevronLeft className="h-4 w-4" />
        </button>
        <div className="flex flex-col items-center justify-center gap-1 text-center lg:flex-row lg:gap-2">
          <p className="text-[14px] font-black text-slate-800 font-sukhumvit">{THAI_MONTHS[viewM]} {viewY + 543}</p>
          <button
            type="button"
            onClick={() => {
              setViewY(now.getFullYear());
              setViewM(now.getMonth());
            }}
            className="px-2.5 py-0.5 rounded-full bg-blue-600 text-white text-[10px] font-black hover:bg-blue-700 transition-colors shadow-sm shadow-blue-500/10"
          >
            วันนี้
          </button>
        </div>
        <button
          type="button"
          onClick={() => {
            if (viewM === 11) { setViewY((y) => y + 1); setViewM(0); }
            else setViewM((m) => m + 1);
          }}
          className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
        >
          <HiChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Weekday headers */}
      <div className="mb-1 grid grid-cols-7 gap-1">
        {WEEKDAY_LABELS.map((d, idx) => (
          <div
            key={d}
            className={cn(
              "text-center text-[10px] font-black",
              idx === 0 ? "text-rose-500" : idx === 6 ? "text-blue-500" : "text-slate-700"
            )}
          >
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={`${viewY}-${viewM}`}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18 }}
          className="flex-1 grid grid-cols-7 auto-rows-fr gap-1.5 min-h-0"
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
                  'relative flex flex-col items-start justify-between overflow-hidden rounded-xl border p-2 h-full min-h-[4.5rem] transition-all',
                  isToday && 'ring-1 ring-blue-300',
                  !isCurrentMonth
                    ? 'bg-slate-50/40 border-slate-200 opacity-60'
                    : isHoliday
                      ? 'bg-slate-100 border-slate-200 opacity-60 cursor-not-allowed'
                      : hasStatusColor
                        ? (STATUS_CELL_BG[status as string] ?? 'bg-slate-50 border-slate-200')
                        : 'bg-white border-slate-200',
                )}
                title={isHoliday ? 'วันหยุด' : hasStatusColor ? STATUS_CONFIG[status as AttendanceStatus]?.label : undefined}
              >
                <span
                  className={cn(
                    'inline-flex h-6 min-w-6 items-center justify-center rounded-full text-[11px] font-black tabular-nums leading-none',
                    isToday
                      ? 'bg-blue-600 text-white font-sukhumvit'
                      : !isCurrentMonth
                        ? (isSunday ? 'text-rose-300' : isSaturday ? 'text-blue-300' : 'text-slate-300')
                        : (isSunday ? 'text-rose-500' : isSaturday ? 'text-blue-500' : 'text-slate-700')
                  )}
                >
                  {date.getDate()}
                </span>
              </div>
            );
          })}
        </motion.div>
      </AnimatePresence>

      {loadError ? (
        <p className="mt-3 text-[11px] font-semibold text-rose-600">{loadError}</p>
      ) : null}
    </motion.div>
  );
}

// ── Admin Override Modal ──────────────────────────────────────────────────────
interface OverrideModalProps {
  record: StaffAttendanceRecord | null;
  onClose: () => void;
  onSave: (status: AttendanceStatus, note: string) => void;
}
function OverrideModal({ record, onClose, onSave }: OverrideModalProps) {
  const [status, setStatus] = useState<AttendanceStatus>(record?.status ?? 'present');
  const [note, setNote] = useState(record?.note ?? '');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="relative w-full max-w-sm rounded-3xl bg-white p-6 flex flex-col gap-4 shadow-2xl"
      >
        <p className="font-bold text-slate-800">Override: {record?.displayName ?? 'บุคลากร'}</p>

        <div className="flex flex-col gap-2">
          <label className="text-xs text-slate-500">สถานะ</label>
          <div className="grid grid-cols-3 gap-2">
            {(['present', 'late', 'absent'] as AttendanceStatus[]).map(s => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={`py-2 rounded-xl text-xs font-semibold border transition-all ${status === s ? `${STATUS_CONFIG[s].bg} ${STATUS_CONFIG[s].text} border-transparent` : 'border-slate-200 text-slate-500'}`}
              >
                {STATUS_CONFIG[s].label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs text-slate-500">หมายเหตุ</label>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            rows={2}
            className="w-full rounded-xl border border-slate-200 p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-300"
            placeholder="เหตุผล..."
          />
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-slate-200 text-sm text-slate-600 font-semibold">ยกเลิก</button>
          <button onClick={() => onSave(status, note)} className="flex-1 py-3 rounded-xl bg-blue-500 text-white text-sm font-semibold">บันทึก</button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Admin Panel ───────────────────────────────────────────────────────────────
function AdminPanel({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { user, role } = useAuth();
  const [selectedDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [filter] = useState<'all' | 'late' | 'absent' | 'leave'>('all');
  const [selectedDept, setSelectedDept] = useState('');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isMdOrBelow, setIsMdOrBelow] = useState(() => window.innerWidth < 1024);
  const [overrideTarget, setOverrideTarget] = useState<StaffAttendanceRecord | null | undefined>(undefined);
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);

  // Header back (มือถือ กลับเมนู) → กลับรายชื่อ เมื่อกำลังดูรายบุคคลอยู่ — ใช้ปุ่มกลับร่วมกับ
  // ปุ่มบนสุดของหน้า แทนที่จะมีปุ่ม "กลับรายชื่อ" แยกซ้ำซ้อนในพาเนล
  useEffect(() => {
    if (!isMdOrBelow || selectedRowId === null) return;

    const isPortalBackButton = (target: EventTarget | null) => {
      if (!(target instanceof Element)) return false;
      const btn = target.closest('button');
      if (!btn) return false;
      if (btn.id === 'portal-default-mobile-back') return true;
      const title = btn.getAttribute('title') ?? '';
      const label = btn.getAttribute('aria-label') ?? '';
      return title === 'กลับไปเมนู' || title === 'กลับเมนู' || label === 'กลับไปเมนู';
    };

    const onClick = (e: MouseEvent) => {
      if (!isPortalBackButton(e.target)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      setSelectedRowId(null);
    };

    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [isMdOrBelow, selectedRowId]);

  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [sortBy, setSortBy] = useState<'status' | 'name'>('status');
  const { records, loading, override } = useAdminStaffAttendance(selectedDate);
  const { requests: leaveRequests } = useLeaveRequestsSince(selectedDate);
  // Calendar panel browses arbitrary past months — needs a much wider leave-request
  // window than the daily roster's `selectedDate` (today) anchor.
  const [calendarLeaveSince] = useState(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const { requests: calendarLeaveRequests } = useLeaveRequestsSince(calendarLeaveSince);
  const { users: staffUserRows } = useStaffUsers();
  const { teachers } = useTeachersCollection();
  const teacherPositionByUserId = useMemo(
    () => buildTeacherPositionByUserId(teachers),
    [teachers],
  );
  const selectedYear = Number(selectedDate.slice(0, 4));
  const { holidays: thaiHolidays } = useThaiHolidays(selectedYear);
  const { events: calendarEvents } = useAcademicCalendar(role ?? undefined, thaiHolidays);

  const staffDirectory = useMemo<StaffDirectoryItem[]>(
    () =>
      staffUserRows
        .filter((u) => u.role === 'teacher')
        .map((u) => ({
          userId: u.userId,
          displayName: u.displayName,
          photoURL: u.photoURL,
          department: u.department,
        })),
    [staffUserRows],
  );
  const staffUserIds = useMemo(() => new Set(staffDirectory.map(s => s.userId)), [staffDirectory]);

  const selected = new Date(`${selectedDate}T12:00:00`);
  const day = selected.getDay();
  const isWeekend = day === 0 || day === 6;
  const holidayEvent = calendarEvents.find((event) => (
    event.type === 'holiday'
    && selectedDate >= event.startDate
    && selectedDate <= event.endDate
  ));
  const isHoliday = !!holidayEvent;
  const isWorkingDay = !isWeekend && !isHoliday;

  const allRows = useMemo<StaffAttendanceTableRow[]>(() => {
    const recordMap = new Map(records.map(r => [r.userId, r]));
    const attendanceUserIds = new Set(records.map(r => r.userId));

    const activeLeaves = leaveRequests.filter((req: LeaveRequest) =>
      staffUserIds.has(req.requesterId) &&
      req.status !== 'rejected' &&
      req.startDate <= selectedDate &&
      req.endDate >= selectedDate &&
      !attendanceUserIds.has(req.requesterId)
    );
    const leaveMap = new Map(activeLeaves.map(req => [req.requesterId, req]));

    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const isPastDate = selectedDate < todayStr;
    const isFutureDate = selectedDate > todayStr;
    const isToday = selectedDate === todayStr;
    const shouldMarkAbsent = isWorkingDay && (isPastDate || isToday);

    return staffDirectory.map(staff => {
      const record = recordMap.get(staff.userId);
      if (record) {
        const resolved = resolveStaffAttendanceDisplay(record, {
          selectedDate,
          isWorkingDay,
          now,
          isSpecialTeacher: isSpecialTeacherUser(staff.userId, teacherPositionByUserId),
        });
        return {
          ...record,
          status: resolved.status,
          note: resolved.note,
          isLeave: false,
          isAutoAbsent: resolved.isAutoAbsent,
          isPending: resolved.isPending,
        };
      }

      const leave = leaveMap.get(staff.userId);
      if (leave && !isFutureDate) {
        return {
          id: `leave-${leave.id}`,
          userId: staff.userId,
          displayName: staff.displayName,
          photoURL: staff.photoURL,
          department: staff.department,
          date: selectedDate,
          checkInTime: null,
          checkOutTime: null,
          status: 'absent',
          note: leave.reason,
          isLeave: true,
          isAutoAbsent: false,
          leaveType: leave.leaveType,
          leaveStatus: leave.status,
          leaveStartDate: leave.startDate,
          leaveEndDate: leave.endDate,
        };
      }

      return {
        id: `not-entered-${staff.userId}-${selectedDate}`,
        userId: staff.userId,
        displayName: staff.displayName,
        date: selectedDate,
        checkInTime: null,
        checkOutTime: null,
        status: shouldMarkAbsent ? 'absent' : 'present',
        note: shouldMarkAbsent ? 'ไม่มีการเช็กอินเข้างาน' : '',
        photoURL: staff.photoURL,
        department: staff.department,
        isLeave: false,
        isAutoAbsent: shouldMarkAbsent,
        isPending: !shouldMarkAbsent,
        isHolidayDay: !isWorkingDay,
      };
    });
  }, [staffDirectory, records, leaveRequests, staffUserIds, selectedDate, isWorkingDay, teacherPositionByUserId]);

  const filtered = allRows.filter(r => {
    if (selectedDept && (r.department ?? '') !== selectedDept) return false;
    if (searchQuery.trim() && !r.displayName.toLowerCase().includes(searchQuery.trim().toLowerCase())) return false;
    if (r.isPending) return filter === 'all';
    if (filter === 'all') return true;
    if (filter === 'leave') return !!r.isLeave;
    if (r.isLeave) return false;
    return r.status === filter;
  });

  const sortedRows = useMemo(() => {
    return [...allRows].sort((a, b) => {
      if (sortBy === 'name') {
        return a.displayName.localeCompare(b.displayName, 'th');
      } else {
        const priority: Record<string, number> = {
          present: 1,
          late: 2,
          pending: 3,
          absent: 4,
          leave: 5,
        };
        const keyA = a.isLeave ? 'leave' : (a.isPending ? 'pending' : a.status);
        const keyB = b.isLeave ? 'leave' : (b.isPending ? 'pending' : b.status);
        return (priority[keyA] ?? 99) - (priority[keyB] ?? 99);
      }
    });
  }, [allRows, sortBy]);

  useEffect(() => {
    const handleResize = () => setIsMdOrBelow(window.innerWidth < 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (selectedRowId !== null) {
      const isCurrentInFilter = filtered.some(r => r.id === selectedRowId);
      if (!isCurrentInFilter) {
        setSelectedRowId(null);
      }
    }
  }, [filtered, selectedRowId]);

  const selectedRow = filtered.find(r => r.id === selectedRowId) ?? null;

  const STATUS_STYLES: Record<string, { border: string; accent: string; text: string }> = {
    present: { border: 'border-slate-200', accent: 'bg-emerald-500', text: 'text-emerald-700' },
    late: { border: 'border-[#F2C607]', accent: '#F2C607', text: 'text-[#F2C607]' },
    absent: { border: 'border-[#F22C07]', accent: '#F22C07', text: 'text-[#F22C07]' },
    leave: { border: 'border-blue-200', accent: 'bg-blue-500', text: 'text-blue-700' },
    pending: { border: 'border-slate-300', accent: 'bg-slate-400', text: 'text-slate-500' },
    holiday: { border: 'border-slate-200', accent: 'bg-slate-300', text: 'text-red-500' },
  };

  return (
    <div className="flex flex-col gap-5 flex-1 min-h-0">

      {/* Sidebar + Detail */}
      {loading ? (
        <div className="flex justify-center py-10">
          <div className="w-6 h-6 border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="flex min-h-0 gap-4 flex-1 h-full">
          {/* ── LEFT SIDEBAR — Department → Staff List ── */}
          {(!isMdOrBelow || selectedRowId === null) && (
            <div className={cn(
              'flex h-full min-h-0 w-full shrink-0 flex-col self-stretch overflow-hidden',
              sidebarCollapsed ? 'lg:w-20 xl:w-20' : 'lg:w-[280px] xl:w-[300px]',
              selectedRowId ? 'hidden lg:flex' : 'flex min-h-0 flex-1 lg:flex-none',
            )}>
              <GradeBookClassSidebar
                selectedDept={selectedDept}
                selectedGrade=""
                selectedClassId=""
                gradeOptions={[]}
                classOptions={[]}
                onSelectDept={(dept) => {
                  setSelectedDept((prev) => {
                    const next = prev === dept ? '' : dept;
                    if (next === '') setSelectedRowId(null);
                    return next;
                  });
                }}
                onSelectGrade={() => { }}
                onSelectClass={() => { }}
                showGradeRoomNav={false}
                collapsed={sidebarCollapsed}
                headerActionMobile
                hideFrameOnMobile
                collapsedExtra={(
                  <div className="flex flex-col items-center justify-center gap-2 mt-2 overflow-y-auto scrollbar-hide py-1 w-full min-h-0">
                    {filtered.map((r) => {
                      const isActive = selectedRowId === r.id;
                      const key = r.isLeave ? 'leave' : r.isHolidayDay ? 'holiday' : (r.isPending ? 'pending' : r.status);
                      const style = STATUS_STYLES[key] ?? STATUS_STYLES.present;
                      const isBgClass = typeof style.accent === 'string' && style.accent.startsWith('bg-');
                      return (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => setSelectedRowId(r.id)}
                          className={cn(
                            'w-9 h-9 rounded-xl overflow-hidden border transition-all cursor-pointer shrink-0 relative group flex items-center justify-center mx-auto text-white',
                            isActive ? 'border-primary ring-2 ring-primary/20 scale-105' : 'border-border hover:scale-105',
                          )}
                          title={r.displayName}
                        >
                          {r.photoURL ? (
                            <img
                              src={r.photoURL}
                              alt={r.displayName}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div
                              className={cn(
                                "w-full h-full flex items-center justify-center text-[12px] font-black",
                                !isActive && isBgClass && style.accent
                              )}
                              style={!isActive && !isBgClass ? { background: style.accent } : undefined}
                            >
                              {r.displayName.charAt(0)}
                            </div>
                          )}
                          {key !== 'present' && (
                            <span
                              className={cn(
                                'absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full border border-white',
                                key === 'late' ? 'bg-[#F2C607]' :
                                  key === 'absent' ? 'bg-[#F22C07]' :
                                    key === 'leave' ? 'bg-blue-500' : 'bg-slate-400'
                              )}
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
                headerAction={(
                  <div className={cn('flex items-center gap-1.5 w-full', sidebarCollapsed ? 'flex-col justify-center gap-2' : 'justify-between')}>
                    {!sidebarCollapsed && (
                      <div className="relative flex-1 min-w-0">
                        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                        <Input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="ค้นหาชื่อ..."
                          className="h-8 w-full rounded-xl pl-8 pr-2.5 text-xs bg-muted/50 border-0 placeholder:text-muted-foreground/70 font-sukhumvit focus-visible:ring-1 focus-visible:ring-primary"
                        />
                      </div>
                    )}
                    <div className={cn('flex items-center gap-1.5', sidebarCollapsed ? 'flex-col' : 'flex-row shrink-0')}>
                      {!sidebarCollapsed && (
                        <button
                          type="button"
                          onClick={onOpenSettings}
                          className="flex h-9 w-9 items-center justify-center text-slate-600 transition-colors hover:text-slate-800"
                          title="ตั้งค่าลงเวลาทำงาน"
                        >
                          <HiCog6Tooth size={16} />
                        </button>
                      )}
                      {isMdOrBelow ? (
                        <button
                          type="button"
                          onClick={() => { setSelectedDept(''); setSearchQuery(''); }}
                          className="flex h-9 w-9 items-center justify-center text-slate-600 transition-colors hover:text-slate-800"
                          title="ล้างการกรอง"
                        >
                          <X size={16} />
                        </button>
                      ) : (
                        <SidebarCollapseButton
                          collapsed={sidebarCollapsed}
                          onToggle={() => setSidebarCollapsed((v) => !v)}
                        />
                      )}
                    </div>
                  </div>
                )}
              >
                {!sidebarCollapsed && (
                  <div className="flex flex-col gap-2.5 mt-2 flex-1 min-h-0 overflow-hidden w-full">
                    <div className="flex-1 overflow-y-auto scrollbar-hide py-1 flex flex-col gap-1.5 min-h-0">
                      <AnimatePresence initial={false}>
                        {selectedDept === '' && !searchQuery.trim() ? (
                          <div className="h-32 flex flex-col items-center justify-center text-muted-foreground opacity-60 rounded-xl text-center px-4">
                            <span className="text-xs font-bold font-sukhumvit">เลือกแผนกเพื่อดูรายชื่อบุคลากร</span>
                          </div>
                        ) : filtered.length === 0 ? (
                          <div className="h-32 flex flex-col items-center justify-center text-muted-foreground opacity-60 rounded-xl">
                            <Users size={22} className="mb-2 opacity-50" />
                            <span className="text-xs font-bold font-sukhumvit">ไม่พบรายชื่อ</span>
                          </div>
                        ) : (
                          filtered.map((r) => {
                            const isActive = selectedRowId === r.id;
                            const key = r.isLeave ? 'leave' : r.isHolidayDay ? 'holiday' : (r.isPending ? 'pending' : r.status);
                            const style = STATUS_STYLES[key] ?? STATUS_STYLES.present;
                            return (
                              <motion.button
                                key={r.id}
                                layout
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                type="button"
                                onClick={() => setSelectedRowId(r.id)}
                                className={cn(
                                  'flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition-all border cursor-pointer',
                                  isActive
                                    ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                                    : 'bg-card text-foreground border-border hover:bg-muted/50',
                                )}
                              >
                                <div
                                  className="h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-white/20 shadow-sm flex items-center justify-center text-sm font-black text-white"
                                  style={isActive ? undefined : { background: style.accent }}
                                >
                                  {r.photoURL ? (
                                    <img src={r.photoURL} alt={r.displayName} className="h-full w-full object-cover" />
                                  ) : (
                                    r.displayName.charAt(0)
                                  )}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <span className={cn(
                                    'block truncate text-[13px] font-black font-sukhumvit',
                                    isActive ? 'text-primary-foreground' : 'text-foreground',
                                  )}>
                                    {r.displayName}
                                  </span>
                                  <span className={cn(
                                    'block truncate text-[10px] font-bold font-sarabun',
                                    isActive ? 'text-primary-foreground/75' : 'text-muted-foreground',
                                  )}>
                                    {r.department ? (DEPARTMENT_CONFIG[r.department as Department]?.label || r.department) : '-'}
                                  </span>
                                </div>
                              </motion.button>
                            );
                          })
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                )}
              </GradeBookClassSidebar>
            </div>
          )}

          {/* ── RIGHT DETAIL PANEL ── */}
          {(!isMdOrBelow || selectedRowId !== null) && (
            <div className="flex-1 min-w-0 flex flex-col gap-4 overflow-y-auto scrollbar-hide">
              <AnimatePresence mode="wait">
                {!selectedRow ? (
                  <div className="flex-1 flex flex-col min-h-0 rounded-2xl bg-card border border-border p-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between shrink-0 pb-3 border-b border-slate-100 mb-3">
                      <p className="text-sm font-black text-slate-800 font-sukhumvit">รายชื่อการเข้างานประจำวัน</p>
                      
                      <div className="flex items-center gap-2">
                        {/* Sort By Toggle */}
                        <button
                          type="button"
                          onClick={() => setSortBy(prev => prev === 'status' ? 'name' : 'status')}
                          className="flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-bold text-slate-600 hover:bg-slate-50 transition-all shadow-xs"
                        >
                          <span>Sort by: {sortBy === 'status' ? 'สถานะ' : 'ชื่อ'}</span>
                          <SlidersHorizontal size={12} className="text-slate-400" />
                        </button>

                        {/* List / Grid Capsule Toggle */}
                        <div className="flex h-8 items-center rounded-lg bg-slate-100/80 p-0.5 border border-slate-200/20">
                          <button
                            type="button"
                            onClick={() => setViewMode('list')}
                            className={cn(
                              "flex h-7 items-center gap-1 rounded-md px-2.5 text-[11px] font-bold transition-all",
                              viewMode === 'list'
                                ? "bg-white text-slate-800 shadow-xs"
                                : "text-slate-500 hover:text-slate-800"
                            )}
                          >
                            <List size={12} />
                            <span>List</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setViewMode('grid')}
                            className={cn(
                              "flex h-7 items-center gap-1 rounded-md px-2.5 text-[11px] font-bold transition-all",
                              viewMode === 'grid'
                                ? "bg-white text-slate-800 shadow-xs"
                                : "text-slate-500 hover:text-slate-800"
                            )}
                          >
                            <Grid size={12} />
                            <span>Grid</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className={cn(
                      "mt-1 flex-1 min-h-0 overflow-y-auto scrollbar-hide gap-1.5",
                      viewMode === 'grid'
                        ? "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 align-start"
                        : "flex flex-col"
                    )}>
                      {sortedRows.map((r) => {
                        const key = r.isLeave ? 'leave' : r.isHolidayDay ? 'holiday' : (r.isPending ? 'pending' : r.status);
                        const style = STATUS_STYLES[key] ?? STATUS_STYLES.present;
                        const statusLabel = r.isLeave ? 'ลา' : r.isHolidayDay ? 'วันหยุด' : r.isPending ? 'รอเช็กอิน' : STATUS_CONFIG[r.status]?.label ?? r.status;
                        return (
                          <button
                            key={r.id}
                            type="button"
                            onClick={() => setSelectedRowId(r.id)}
                            className="flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition-all border border-slate-100 bg-white/80 hover:border-slate-200"
                          >
                            <div
                              className="h-9 w-9 shrink-0 overflow-hidden rounded-xl flex items-center justify-center text-xs font-black text-white"
                              style={{ background: style.accent }}
                            >
                              {r.photoURL ? (
                                <img src={r.photoURL} alt={r.displayName} className="h-full w-full object-cover" />
                              ) : (
                                r.displayName.charAt(0)
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <span className="block truncate text-[13px] font-black font-sukhumvit text-foreground">
                                {r.displayName}
                              </span>
                              <span className="block truncate text-[10px] font-bold font-sarabun text-muted-foreground">
                                {r.department ? (DEPARTMENT_CONFIG[r.department as Department]?.label || r.department) : '-'}
                              </span>
                            </div>
                            <span className={cn('shrink-0 text-[11px] font-bold font-sukhumvit', style.text)}>{statusLabel}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <PersonalStatsPanel
                    row={selectedRow}
                    leaveRequests={calendarLeaveRequests}
                    isSpecialTeacher={isSpecialTeacherUser(selectedRow.userId, teacherPositionByUserId)}
                  />
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      )}

      {/* Override modal */}
      <AnimatePresence>
        {overrideTarget !== undefined && (
          <OverrideModal
            record={overrideTarget}
            onClose={() => setOverrideTarget(undefined)}
            onSave={async (status, note) => {
              if (!user) return;
              const isVirtualRecordId =
                !!overrideTarget?.id &&
                (overrideTarget.id.startsWith('auto-absent-') || overrideTarget.id.startsWith('leave-'));
              await override(
                isVirtualRecordId ? null : (overrideTarget?.id ?? null),
                overrideTarget?.userId ?? '',
                overrideTarget?.displayName ?? '',
                status,
                note,
                user.uid,
              );
              setOverrideTarget(undefined);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
// ── Page ──────────────────────────────────────────────────────────────────────
type StaffAttendanceTab = 'team' | 'report';

const STAFF_ATTENDANCE_TAB_CONFIG: Record<StaffAttendanceTab, { label: string; icon: IconType }> = {
  team: { label: 'รายบุคคล', icon: HiCalendarDays },
  report: { label: 'รายงาน', icon: HiChartBarSquare },
};

export default function StaffAttendancePage() {
  const { role } = useAuth();
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const [mobilePortalTarget, setMobilePortalTarget] = useState<HTMLElement | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    setPortalTarget(document.getElementById('header-portal-center'));
    setMobilePortalTarget(document.getElementById('header-portal-center-mobile'));
  }, []);

  const isAdmin = role === 'admin' || role === 'sysadmin';

  // ── Access Control ──
  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-slate-400 gap-4">
        <AlertCircle size={48} strokeWidth={1.5} />
        <div className="text-center">
          <p className="text-lg font-black text-slate-600">Access Denied</p>
          <p className="text-sm font-bold mt-1">คุณไม่มีสิทธิ์เข้าถึงหน้านี้</p>
        </div>
      </div>
    );
  }

  const [tab, setTab] = useState<StaffAttendanceTab>('team');
  const [mobileTabMenuOpen, setMobileTabMenuOpen] = useState(false);

  useEffect(() => {
    setMobileTabMenuOpen(false);
  }, [tab]);

  useEffect(() => {
    if (!mobileTabMenuOpen) return;
    const close = () => setMobileTabMenuOpen(false);
    window.addEventListener('scroll', close, true);
    return () => window.removeEventListener('scroll', close, true);
  }, [mobileTabMenuOpen]);

  const tabs = (Object.entries(STAFF_ATTENDANCE_TAB_CONFIG) as [StaffAttendanceTab, typeof STAFF_ATTENDANCE_TAB_CONFIG[StaffAttendanceTab]][]);
  const activeTabConfig = STAFF_ATTENDANCE_TAB_CONFIG[tab];
  const ActiveTabIcon = activeTabConfig.icon;

  return (
    <div className="flex flex-col min-h-0 relative h-[calc(100dvh-4.25rem)] max-h-[calc(100dvh-4.25rem)]">
      <div className="mx-auto flex w-full max-w-none flex-col gap-5 flex-1 min-h-0 pt-4">
        {/* Header Portal for Tabs */}
        {tabs.length > 1 && (
          <>
            {portalTarget && createPortal(
              <div className="flex items-center bg-white/60 backdrop-blur-xl border border-slate-200 p-1 rounded-full shadow-[0_8px_32px_rgba(0,0,0,0.04)] pointer-events-auto">
                {tabs.map(([key, cfg]) => {
                  const isActive = tab === key;
                  return (
                    <button
                      key={key}
                      onClick={() => setTab(key)}
                      className={`h-8 px-4 rounded-full text-[11px] font-bold transition-all whitespace-nowrap flex items-center ${isActive
                        ? 'bg-slate-900 text-white border border-slate-950'
                        : 'text-black/45 hover:bg-black/5'
                        }`}
                    >
                      <span>{cfg.label}</span>
                    </button>
                  );
                })}
              </div>,
              portalTarget
            )}
            {mobilePortalTarget && createPortal(
              <div className="lg:hidden pointer-events-auto relative flex items-center justify-center min-w-0 max-w-[calc(100vw-112px)]">
                <button
                  type="button"
                  onClick={() => setMobileTabMenuOpen((open) => !open)}
                  className="flex min-w-0 items-center gap-1.5 text-slate-800 transition-colors hover:text-slate-600"
                  aria-label="เปิดเมนูแท็บ"
                  aria-expanded={mobileTabMenuOpen}
                >
                  <ActiveTabIcon className="h-3.5 w-3.5 shrink-0 text-slate-600" />
                  <span className="truncate text-[12px] font-black font-sukhumvit">
                    {activeTabConfig.label}
                  </span>
                  <HiChevronDown
                    className={`h-3.5 w-3.5 shrink-0 text-slate-500 transition-transform ${mobileTabMenuOpen ? 'rotate-180' : ''}`}
                  />
                </button>

                {mobileTabMenuOpen && (
                  <>
                    <button
                      type="button"
                      className="fixed inset-0 z-[90] bg-black/20"
                      aria-label="ปิดเมนูแท็บ"
                      onClick={() => setMobileTabMenuOpen(false)}
                    />
                    <div className="fixed left-1/2 top-14 z-[100] w-[min(280px,calc(100vw-2rem))] -translate-x-1/2 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl">
                      <p className="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 font-sukhumvit">
                        การเข้างาน
                      </p>
                      {tabs.map(([key, cfg]) => {
                        const Icon = cfg.icon;
                        const isActive = tab === key;
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => setTab(key)}
                            className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[13px] font-bold font-sukhumvit transition-colors ${isActive
                              ? 'bg-slate-900 text-white'
                              : 'text-slate-600 hover:bg-slate-50'
                              }`}
                          >
                            <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                            <span>{cfg.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>,
              mobilePortalTarget
            )}
          </>
        )}

        <AnimatePresence mode="wait">
          {tab === 'team' && (
            <motion.div key="team" className="flex-1 min-h-0 flex flex-col" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
              <AdminPanel onOpenSettings={() => setIsSettingsOpen(true)} />
            </motion.div>
          )}
          {tab === 'report' && (
            <motion.div key="report" className="flex-1 min-h-0 flex flex-col" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <AttendanceReportPanel />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Attendance Settings Right-Side Drawer (Drawer direction="right") */}
        <Drawer open={isSettingsOpen} onOpenChange={setIsSettingsOpen} direction="right">
          <DrawerContent className={DRAWER_CONTENT_CLASS}>
            <div className={DRAWER_PANEL_CLASS}>
              <DrawerHeader className="shrink-0 py-4 border-b border-border bg-slate-50/50 backdrop-blur-xs px-6 sm:px-8">
                <div className="relative flex min-h-10 items-center justify-between">
                  <DrawerTitle className="text-base font-black font-sukhumvit text-slate-800">ตั้งค่าการลงเวลาทำงาน</DrawerTitle>
                  <div className={DRAWER_HEADER_RIGHT_ACTIONS}>
                    <button
                      type="button"
                      onClick={() => setIsSettingsOpen(false)}
                      className={DRAWER_HEADER_ICON_BTN}
                      aria-label="ปิด"
                    >
                      <HiXMark className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </DrawerHeader>
              <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5">
                <AttendanceSettingsPanel />
              </div>
            </div>
          </DrawerContent>
        </Drawer>
      </div>
    </div>
  );
}
