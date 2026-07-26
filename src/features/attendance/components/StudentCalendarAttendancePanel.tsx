import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HiChevronLeft, HiChevronRight, HiXMark } from 'react-icons/hi2';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { cn } from '@/lib/utils';
import StudentAvatar from '@/features/students/components/StudentAvatar';
import { DRAWER_HEADER_ICON_BTN, DRAWER_HEADER_RIGHT_ACTIONS } from '@/lib/drawerHeaderBtn';
import { buildStudentSubjectAttendanceHistory } from '@/features/grades/utils/studentSubjectAttendanceHistory';
import type { AttendanceStatus, AttendanceRecord } from '@/types/teaching';
import type { CalendarEvent } from '@/types/calendar';

// ── Types ────────────────────────────────────────────────────────────────────

export interface StudentInfo {
  id: string;
  studentCode: string;
  prefix: string;
  firstName: string;
  lastName: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  student: StudentInfo | null;
  attendance: AttendanceRecord[];
  subjectId: string;
  classId: string;
  calendarEvents?: CalendarEvent[];
  /** วันที่ (YYYY-MM-DD) ที่แผนการสอนระบุ isNoTeaching — ไม่นับการเช็คชื่อ */
  noTeachingDates?: Set<string>;
  /** ตารางสอนของห้อง/วิชานี้ — enumerate คาบที่ครูยังไม่เช็คชื่อ ให้นับเป็นขาดแทนที่จะหายไปเงียบๆ */
  scheduleSlots?: { day: number; period: number }[];
  rangeStart?: string;
  rangeEnd?: string;
}

// ── Constants ────────────────────────────────────────────────────────────────

// Square-cell style — mirrors WeeklyTopicGrid MOBILE_STATUS_CELL_CLASS
const STATUS_CELL: Record<
  AttendanceStatus,
  { bg: string; border: string; label: string; labelColor: string }
> = {
  present: {
    bg: 'bg-emerald-100',
    border: 'border-emerald-200',
    label: 'มา',
    labelColor: 'text-emerald-700',
  },
  absent: {
    bg: 'bg-rose-100',
    border: 'border-rose-200',
    label: 'ขาด',
    labelColor: 'text-rose-600',
  },
  late: {
    bg: 'bg-amber-100',
    border: 'border-amber-200',
    label: 'สาย',
    labelColor: 'text-amber-700',
  },
  excused: {
    bg: 'bg-sky-100',
    border: 'border-sky-200',
    label: 'ลากิจ',
    labelColor: 'text-sky-700',
  },
  leave: {
    bg: 'bg-violet-100',
    border: 'border-violet-200',
    label: 'ลา',
    labelColor: 'text-violet-700',
  },
};

const WEEKDAY_LABELS = ['จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส', 'อา'];

const THAI_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
];

const DRAWER_CONTENT_CLASS = cn(
  'flex h-dvh max-h-dvh flex-col overflow-hidden bg-transparent p-0 before:hidden',
  'data-[vaul-drawer-direction=right]:w-screen data-[vaul-drawer-direction=right]:max-w-none',
  'sm:h-full sm:max-h-full sm:p-2.5',
  'sm:data-[vaul-drawer-direction=right]:w-full sm:data-[vaul-drawer-direction=right]:max-w-md',
);

const DRAWER_PANEL_CLASS = cn(
  'flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-white',
  'sm:rounded-4xl sm:border sm:border-slate-200/80 sm:shadow-2xl',
);

const EMPTY_NO_TEACHING_DATES = new Set<string>();
const EMPTY_SCHEDULE_SLOTS: { day: number; period: number }[] = [];

// ── Helpers ──────────────────────────────────────────────────────────────────

function getMonthGrid(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1);
  const startDow = (first.getDay() + 6) % 7; // Mon = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function toYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ── Inner Calendar (rendered once student+data available) ─────────────────

function CalendarBody({
  student,
  attendance,
  subjectId,
  classId,
  calendarEvents,
  noTeachingDates,
  scheduleSlots,
  rangeStart,
  rangeEnd,
}: {
  student: StudentInfo;
  attendance: AttendanceRecord[];
  subjectId: string;
  classId: string;
  calendarEvents: CalendarEvent[];
  noTeachingDates: Set<string>;
  scheduleSlots: { day: number; period: number }[];
  rangeStart: string;
  rangeEnd: string;
}) {
  // Build date → worst-status map — enumerated from schedule so an unchecked
  // period counts as absent instead of silently disappearing from the total.
  const dateStatusMap = useMemo(() => {
    const sessions = attendance
      .filter(r => r.subjectId === subjectId && r.classId === classId && r.studentId === student.id)
      .map(r => ({
        id: r.id,
        date: r.date,
        period: r.period,
        attendance: [{ studentId: r.studentId, status: r.status, note: r.note }],
      }));

    const rows = buildStudentSubjectAttendanceHistory({
      studentId: student.id,
      sessions,
      scheduleSlots,
      rangeStart,
      rangeEnd,
      calendarEvents,
      noTeachingDates,
    });

    const priority: Record<AttendanceStatus, number> = {
      absent: 4, late: 3, excused: 2, leave: 2, present: 1,
    };
    const m = new Map<string, AttendanceStatus>();
    for (const row of [...rows].sort((a, b) => a.date.localeCompare(b.date) || a.period - b.period)) {
      const existing = m.get(row.date);
      if (!existing || priority[row.status] > priority[existing]) m.set(row.date, row.status);
    }
    return m;
  }, [attendance, student.id, subjectId, classId, calendarEvents, noTeachingDates, scheduleSlots, rangeStart, rangeEnd]);

  const teachingDates = useMemo(() => new Set<string>(dateStatusMap.keys()), [dateStatusMap]);

  // Month range
  const { minMonth, maxMonth } = useMemo(() => {
    let startY: number | null = null;
    let startM: number | null = null;
    let endY: number | null = null;
    let endM: number | null = null;

    if (rangeStart && /^\d{4}-\d{2}-\d{2}$/.test(rangeStart)) {
      const [y, m] = rangeStart.split('-').map(Number);
      startY = y;
      startM = m - 1;
    }
    if (rangeEnd && /^\d{4}-\d{2}-\d{2}$/.test(rangeEnd)) {
      const [y, m] = rangeEnd.split('-').map(Number);
      endY = y;
      endM = m - 1;
    }

    const dates = [...teachingDates].sort();
    if (startY === null || startM === null) {
      if (dates.length) {
        const first = dates[0].split('-').map(Number);
        startY = first[0];
        startM = first[1] - 1;
      } else {
        const now = new Date();
        startY = now.getFullYear();
        startM = now.getMonth();
      }
    }

    if (endY === null || endM === null) {
      if (dates.length) {
        const last = dates[dates.length - 1].split('-').map(Number);
        endY = last[0];
        endM = last[1] - 1;
      } else {
        const now = new Date();
        endY = now.getFullYear();
        endM = now.getMonth();
      }
    }

    return {
      minMonth: { y: startY, m: startM },
      maxMonth: { y: endY, m: endM },
    };
  }, [teachingDates, rangeStart, rangeEnd]);

  const initialMonth = useMemo(() => {
    const now = new Date();
    const monthKey = (y: number, m: number) => y * 12 + m;
    const nowKey = monthKey(now.getFullYear(), now.getMonth());
    const clampedKey = Math.min(
      Math.max(nowKey, monthKey(minMonth.y, minMonth.m)),
      monthKey(maxMonth.y, maxMonth.m),
    );
    return { y: Math.floor(clampedKey / 12), m: ((clampedKey % 12) + 12) % 12 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [viewY, setViewY] = useState(initialMonth.y);
  const [viewM, setViewM] = useState(initialMonth.m);

  const cells = useMemo(() => getMonthGrid(viewY, viewM), [viewY, viewM]);

  const canPrev = viewY > minMonth.y || (viewY === minMonth.y && viewM > minMonth.m);
  const canNext = viewY < maxMonth.y || (viewY === maxMonth.y && viewM < maxMonth.m);

  const todayStr = toYMD(new Date());

  // Stats
  const counts = useMemo(() => {
    const c: Record<AttendanceStatus, number> = { present: 0, absent: 0, late: 0, excused: 0, leave: 0 };
    dateStatusMap.forEach(st => { c[st] += 1; });
    return c;
  }, [dateStatusMap]);
  // ลา/ลากิจ มีเอกสารรับรอง — ไม่นับเป็นตัวหาร (ไม่กระทบ % เข้าเรียน)
  const total = [...dateStatusMap.values()].length - counts.leave - counts.excused;
  const attended = counts.present + counts.late;
  const pct = total > 0 ? Math.round((attended / total) * 100) : null;

  return (
    <>
      {/* Stats summary */}
      <div className="mb-4 grid grid-cols-3 gap-2 shrink-0">
        <div className="rounded-2xl bg-emerald-50 border border-emerald-100 px-3 py-2.5 text-center">
          <p className="text-[9px] font-bold text-emerald-600/80 font-sukhumvit">เข้าเรียน</p>
          <p className="text-[18px] font-black text-emerald-700 font-sukhumvit tabular-nums">
            {pct !== null ? `${pct}%` : '—'}
          </p>
        </div>
        <div className="rounded-2xl bg-slate-50 border border-slate-100 px-3 py-2.5 text-center">
          <p className="text-[9px] font-bold text-slate-500 font-sukhumvit">คาบทั้งหมด</p>
          <p className="text-[18px] font-black text-slate-800 font-sukhumvit tabular-nums">{total}</p>
        </div>
        <div className="rounded-2xl bg-rose-50 border border-rose-100 px-3 py-2.5 text-center">
          <p className="text-[9px] font-bold text-rose-500/80 font-sukhumvit">ขาด/สาย</p>
          <p className="text-[18px] font-black text-rose-600 font-sukhumvit tabular-nums">{counts.absent + counts.late}</p>
        </div>
      </div>

      {/* Month nav */}
      <div className="mb-3 flex items-center justify-between shrink-0">
        <button
          type="button"
          onClick={() => {
            if (viewM === 0) { setViewY(y => y - 1); setViewM(11); }
            else setViewM(m => m - 1);
          }}
          disabled={!canPrev}
          className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-20"
        >
          <HiChevronLeft className="h-4 w-4" />
        </button>
        <div className="text-center">
          <p className="text-[14px] font-black text-slate-800 font-sukhumvit">{THAI_MONTHS[viewM]}</p>
          <p className="text-[11px] font-bold text-slate-400 tabular-nums">{viewY + 543}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            if (viewM === 11) { setViewY(y => y + 1); setViewM(0); }
            else setViewM(m => m + 1);
          }}
          disabled={!canNext}
          className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-20"
        >
          <HiChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Weekday headers */}
      <div className="mb-1 grid grid-cols-7 gap-1 shrink-0">
        {WEEKDAY_LABELS.map(d => (
          <div key={d} className="text-center text-[10px] font-bold text-slate-400">{d}</div>
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
          className="grid grid-cols-7 gap-1"
        >
          {cells.map((date, idx) => {
            if (!date) return <div key={`empty-${idx}`} />;
            const dateStr = toYMD(date);
            const status = dateStatusMap.get(dateStr);
            const isTeaching = teachingDates.has(dateStr);
            const isToday = dateStr === todayStr;
            const isPast = dateStr <= todayStr;
            const cfg = status ? STATUS_CELL[status] : null;

            // Teaching day without a record (past = unchecked, future = upcoming)
            const isUnchecked = isTeaching && !status && isPast;
            const isUpcoming = isTeaching && !status && !isPast;

            const isNonTeaching = !isTeaching && !status;

            return (
              <div
                key={dateStr}
                className={cn(
                  'relative flex h-11 items-center justify-center overflow-hidden rounded-xl border border-slate-100 p-1.5',
                  // Colored bg for attendance status
                  cfg && `${cfg.bg} ${cfg.border}`,
                  // Unchecked teaching day — subtle border
                  isUnchecked && 'border-slate-100 bg-transparent',
                  // Upcoming teaching day — light default
                  isUpcoming && 'border-slate-100 bg-transparent',
                  // Non-teaching day — dimmed, disabled look
                  isNonTeaching && 'border-slate-100 bg-slate-50/60 opacity-40',
                  // Today ring
                  isToday && 'ring-1 ring-blue-300',
                )}
              >
                {/* Date number chip */}
                <span
                  className={cn(
                    'inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-[11px] font-black tabular-nums leading-none',
                    isNonTeaching ? 'text-slate-400' : 'text-slate-600',
                    isToday && !status && !isNonTeaching && 'bg-blue-600 text-white',
                    isToday && cfg && 'bg-blue-600 text-white',
                  )}
                >
                  {date.getDate()}
                </span>
              </div>
            );
          })}
        </motion.div>
      </AnimatePresence>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 pt-3 border-t border-slate-100">
        {([
          { label: 'มาเรียน', bg: 'bg-emerald-100', border: 'border-emerald-200' },
          { label: 'ขาดเรียน', bg: 'bg-rose-100', border: 'border-rose-200' },
          { label: 'สาย', bg: 'bg-amber-100', border: 'border-amber-200' },
          { label: 'ลา', bg: 'bg-sky-100', border: 'border-sky-200' },
        ] as const).map(({ label, bg, border }) => (
          <div key={label} className="flex items-center gap-1.5">
            <span className={cn('h-4 w-4 shrink-0 rounded-md border', bg, border)} />
            <span className="text-[10px] font-bold text-slate-400 font-sukhumvit">{label}</span>
          </div>
        ))}
      </div>
    </>
  );
}

// ── Main Export ───────────────────────────────────────────────────────────────

export default function StudentCalendarAttendanceDrawer({
  open,
  onClose,
  student,
  attendance,
  subjectId,
  classId,
  calendarEvents = [],
  noTeachingDates = EMPTY_NO_TEACHING_DATES,
  scheduleSlots = EMPTY_SCHEDULE_SLOTS,
  rangeStart = '',
  rangeEnd = '',
}: Props) {
  const fullName = student
    ? `${student.prefix}${student.firstName} ${student.lastName}`
    : '';

  return (
    <Drawer open={open} onOpenChange={(next) => { if (!next) onClose(); }} direction="right">
      <DrawerContent className={DRAWER_CONTENT_CLASS}>
        <div className={DRAWER_PANEL_CLASS}>
          {/* ── Header (กฎเหล็ก: close ขวา, back ซ้ายของ close) ── */}
          <DrawerHeader className="shrink-0 border-b border-slate-100 px-5 pb-3 pt-5">
            <div className="relative flex min-h-10 items-center justify-start">
              {/* Left: avatar + name */}
              <div className="flex items-center gap-2.5 min-w-0 pr-12">
                {student && (
                  <StudentAvatar
                    studentId={student.id}
                    name={fullName}
                    className="h-9 w-9 shrink-0 rounded-full"
                  />
                )}
                <div className="min-w-0 text-left">
                  <DrawerTitle className="truncate font-sukhumvit text-[15px] font-black text-slate-800 text-left">
                    {fullName || '—'}
                  </DrawerTitle>
                  <DrawerDescription className="font-sarabun text-[11px] text-slate-400 tabular-nums text-left">
                    {student?.studentCode ?? ''}
                  </DrawerDescription>
                </div>
              </div>

              {/* Right actions: close button */}
              <div className={DRAWER_HEADER_RIGHT_ACTIONS}>
                <button
                  type="button"
                  onClick={onClose}
                  className={DRAWER_HEADER_ICON_BTN}
                  aria-label="ปิด"
                >
                  <HiXMark size={16} />
                </button>
              </div>
            </div>
          </DrawerHeader>

          {/* ── Body ── */}
          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 scrollbar-hide">
            {student && (
              <CalendarBody
                student={student}
                attendance={attendance}
                subjectId={subjectId}
                classId={classId}
                calendarEvents={calendarEvents}
                noTeachingDates={noTeachingDates}
                scheduleSlots={scheduleSlots}
                rangeStart={rangeStart}
                rangeEnd={rangeEnd}
              />
            )}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
