import { useEffect, useMemo, useState } from 'react';
import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  addMonths,
  subMonths,
  parseISO,
  isBefore,
  isAfter,
  format,
} from 'date-fns';
import { th } from 'date-fns/locale';
import { HiChevronLeft, HiChevronRight, HiXMark } from 'react-icons/hi2';
import { cn } from '@/lib/utils';
import { SubjectIcon } from '@/features/curriculum/utils/subjectVisual';
import { toDateStr, toThaiFullDate, formatEventDateRange } from '@/features/calendar/utils';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { DRAWER_HEADER_ICON_BTN, DRAWER_HEADER_RIGHT_ACTIONS } from '@/lib/drawerHeaderBtn';
import { formatTeachingPeriods } from '@/features/microSyllabus/utils/teachingPlanCalendar';
import { useAuth } from '@/hooks/useAuth';
import { useAcademicCalendar } from '@/hooks/useAcademicCalendar';
import { useThaiHolidays } from '@/features/calendar/hooks/useThaiHolidays';
import { EVENT_TYPE_CONFIG } from '@/types/calendar';
import type { CalendarEvent } from '@/types/calendar';
import type { ScheduleEntry } from '@/types/schedule';
import { Button } from '@/components/ui/button';

const DRAWER_CONTENT_CLASS = cn(
  'flex h-dvh flex-col bg-transparent p-0 before:hidden',
  'data-[vaul-drawer-direction=right]:w-screen data-[vaul-drawer-direction=right]:max-w-none',
  'sm:h-full sm:data-[vaul-drawer-direction=right]:w-full sm:data-[vaul-drawer-direction=right]:max-w-md sm:p-2',
);

const DRAWER_PANEL_CLASS = cn(
  'flex h-full min-h-0 flex-col overflow-hidden bg-white',
  'sm:rounded-4xl sm:border sm:border-slate-200/70 sm:shadow-xl',
);

const DAY_NAMES = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'] as const;

export type DayAttendanceDot = 'upcoming' | 'pending' | 'partial' | 'done';

const NO_ATTENDANCE_LABEL_CLASS: Record<'holiday' | 'exam' | 'activity', string> = {
  holiday: 'text-rose-500',
  exam: 'text-amber-600',
  activity: 'text-blue-600',
};

const NO_ATTENDANCE_CARD_CLASS: Record<'holiday' | 'exam' | 'activity', string> = {
  holiday: 'border-rose-200 bg-rose-50',
  exam: 'border-amber-200 bg-amber-50',
  activity: 'border-blue-200 bg-blue-50',
};

const NO_ATTENDANCE_TYPES = new Set(['holiday', 'exam', 'activity']);

/** Mobile: fill cell instead of status dots (dots + white cell at lg+) */
const MOBILE_STATUS_CELL_CLASS: Record<DayAttendanceDot, string> = {
  upcoming: 'border-slate-200 bg-slate-100 lg:border-slate-300 lg:bg-white',
  pending: 'border-rose-200 bg-rose-100 lg:border-slate-300 lg:bg-white',
  partial: 'border-amber-200 bg-amber-100 lg:border-slate-300 lg:bg-white',
  done: 'border-emerald-200 bg-emerald-100 lg:border-slate-300 lg:bg-white',
};

/** JS getDay() → schedule SchoolDay (1=Mon … 7=Sun) */
export function toSchoolDay(date: Date): number {
  const dow = date.getDay();
  return dow === 0 ? 7 : dow;
}

/** Fallback Thai academic year when settings start/end empty (BE year → AD May–Mar). */
export function fallbackAcademicYearRange(yearBE: string): { start: string; end: string } {
  const ad = Number(yearBE) - 543;
  if (!Number.isFinite(ad) || ad < 1900) {
    const now = new Date();
    const y = now.getMonth() >= 4 ? now.getFullYear() : now.getFullYear() - 1;
    return { start: `${y}-05-15`, end: `${y + 1}-03-07` };
  }
  return { start: `${ad}-05-15`, end: `${ad + 1}-03-07` };
}

function getMonthGridDays(month: Date): Date[] {
  const start = startOfWeek(startOfMonth(month), { weekStartsOn: 0 });
  const end = endOfWeek(endOfMonth(month), { weekStartsOn: 0 });
  return eachDayOfInterval({ start, end });
}

function clampMonth(month: Date, minMonth: Date, maxMonth: Date): Date {
  if (isBefore(month, minMonth)) return minMonth;
  if (isAfter(month, maxMonth)) return maxMonth;
  return month;
}

function parseDay(iso: string): Date | null {
  if (!iso) return null;
  const d = parseISO(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function sessionKey(date: string, classId: string, subjectId: string, period: number): string {
  return `${date}|${classId}|${subjectId}|${Number(period)}`;
}

export function TeacherAttendanceMonthCalendar({
  className,
  teachingWeekdays,
  periodsByWeekday,
  scheduleSlots,
  checkedSessionKeys,
  onSelectDay,
  rangeStart,
  rangeEnd,
  todayDate,
}: {
  className?: string;
  /** SchoolDay (1–7) that have at least one teaching period */
  teachingWeekdays: Set<number>;
  /** SchoolDay → period numbers for label */
  periodsByWeekday?: Map<number, number[]>;
  /** Slots to match against saved class_sessions */
  scheduleSlots: Array<{ day: number; classId: string; subjectId: string; period: number }>;
  /** Keys: `${date}|${classId}|${subjectId}|${period}` */
  checkedSessionKeys: Set<string>;
  onSelectDay: (day: Date) => void;
  /** Academic year range YYYY-MM-DD (inclusive) */
  rangeStart: string;
  rangeEnd: string;
  /** YYYY-MM-DD — future days get gray status dots */
  todayDate: string;
}) {
  const { role } = useAuth();
  const minMonth = useMemo(
    () => startOfMonth(parseDay(rangeStart) ?? new Date()),
    [rangeStart],
  );
  const maxMonth = useMemo(
    () => startOfMonth(parseDay(rangeEnd) ?? new Date()),
    [rangeEnd],
  );

  const [month, setMonth] = useState(() =>
    clampMonth(startOfMonth(new Date()), minMonth, maxMonth),
  );

  useEffect(() => {
    setMonth((m) => clampMonth(startOfMonth(m), minMonth, maxMonth));
  }, [minMonth, maxMonth]);

  const { holidays } = useThaiHolidays(month.getFullYear());
  const { getEventsForDate, events: calendarEvents } = useAcademicCalendar(role ?? undefined, holidays);

  const days = useMemo(() => getMonthGridDays(month), [month]);
  const todayMonth = useMemo(
    () => startOfMonth(parseDay(todayDate) ?? new Date()),
    [todayDate],
  );
  const canGoPrev = isAfter(month, minMonth);
  const canGoNext = isBefore(month, maxMonth);
  const isViewingTodayMonth = isSameMonth(month, todayMonth);

  const monthNoAttendanceEvents = useMemo(() => {
    const monthStart = toDateStr(startOfMonth(month));
    const monthEnd = toDateStr(endOfMonth(month));
    const from = monthStart < rangeStart ? rangeStart : monthStart;
    const to = monthEnd > rangeEnd ? rangeEnd : monthEnd;
    if (from > to) return [] as CalendarEvent[];

    return calendarEvents
      .filter(
        (e) =>
          NO_ATTENDANCE_TYPES.has(e.type) &&
          e.startDate <= to &&
          e.endDate >= from,
      )
      .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.title.localeCompare(b.title));
  }, [calendarEvents, month, rangeStart, rangeEnd]);

  const noAttendanceEventFor = (dateStr: string) => {
    const events = getEventsForDate(dateStr);
    const event =
      events.find((e) => e.type === 'holiday')
      ?? events.find((e) => e.type === 'exam')
      ?? events.find((e) => e.type === 'activity');
    if (!event) return null;
    const type = event.type as 'holiday' | 'exam' | 'activity';
    return {
      type,
      title: event.title?.trim() || EVENT_TYPE_CONFIG[type].label,
    };
  };

  const dayDotStatus = (dateStr: string, schoolDay: number): DayAttendanceDot | null => {
    const slots = scheduleSlots.filter((s) => s.day === schoolDay);
    if (slots.length === 0) return null;
    if (dateStr > todayDate) return 'upcoming';
    let done = 0;
    for (const slot of slots) {
      if (checkedSessionKeys.has(sessionKey(dateStr, slot.classId, slot.subjectId, slot.period))) {
        done += 1;
      }
    }
    if (done === 0) return 'pending';
    if (done >= slots.length) return 'done';
    return 'partial';
  };

  return (
    <div className={cn('flex h-full min-h-0 w-full flex-col max-lg:overflow-y-auto', className)}>
      <div className="flex shrink-0 items-center justify-between gap-2 px-1 pb-1.5 pt-0">
        <button
          type="button"
          disabled={!canGoPrev}
          onClick={() => setMonth((m) => clampMonth(subMonths(m, 1), minMonth, maxMonth))}
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-white hover:text-slate-800',
            !canGoPrev && 'pointer-events-none opacity-30',
          )}
          aria-label="เดือนก่อนหน้า"
        >
          <HiChevronLeft size={18} />
        </button>

        <div className="flex min-w-0 items-center justify-center gap-2">
          <p className="text-sm font-black text-slate-800 font-sukhumvit">
            {format(month, 'MMMM', { locale: th })} {month.getFullYear() + 543}
          </p>
          <Button
            type="button"
            variant="default"
            size="xs"
            disabled={isViewingTodayMonth}
            className="rounded-xl bg-blue-600 font-bold text-white hover:bg-blue-600/90"
            onClick={() => setMonth(clampMonth(todayMonth, minMonth, maxMonth))}
            aria-label="กลับวันปัจจุบัน"
          >
            วันนี้
          </Button>
        </div>

        <button
          type="button"
          disabled={!canGoNext}
          onClick={() => setMonth((m) => clampMonth(addMonths(m, 1), minMonth, maxMonth))}
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-white hover:text-slate-800',
            !canGoNext && 'pointer-events-none opacity-30',
          )}
          aria-label="เดือนถัดไป"
        >
          <HiChevronRight size={18} />
        </button>
      </div>

      <div className="grid shrink-0 grid-cols-7 px-1 pb-1 pt-0">
        {DAY_NAMES.map((label, index) => (
          <div
            key={label}
            className={cn(
              'pb-2 text-center text-[10px] font-black uppercase tracking-wide font-sukhumvit',
              index === 0 ? 'text-rose-400' : index === 6 ? 'text-blue-400' : 'text-slate-400',
            )}
          >
            {label}
          </div>
        ))}
      </div>

      <div
        className="grid shrink-0 grid-cols-7 gap-1 px-1 pb-2 max-lg:auto-rows-[minmax(52px,auto)] lg:min-h-0 lg:flex-1 lg:auto-rows-fr"
      >
        {days.map((day) => {
          const inMonth = isSameMonth(day, month);
          const dateStr = toDateStr(day);
          const inAcademicYear = dateStr >= rangeStart && dateStr <= rangeEnd;
          const today = isToday(day);
          const schoolDay = toSchoolDay(day);
          const periods = periodsByWeekday?.get(schoolDay) ?? [];
          const blockEvent = inMonth && inAcademicYear ? noAttendanceEventFor(dateStr) : null;
          const isBlocked = Boolean(blockEvent);
          const isHoliday = blockEvent?.type === 'holiday';
          const hasTeaching = inMonth && inAcademicYear && teachingWeekdays.has(schoolDay);
          const periodLabel = formatTeachingPeriods(periods);
          const dow = day.getDay();
          const canSelect = hasTeaching && !isBlocked;
          const statusDot = hasTeaching && !isBlocked ? dayDotStatus(dateStr, schoolDay) : null;

          return (
            <button
              key={dateStr}
              type="button"
              disabled={!canSelect}
              onClick={() => canSelect && onSelectDay(day)}
              title={
                isBlocked
                  ? `${blockEvent!.title} — ไม่มีการเช็กชื่อเข้าเรียน`
                  : hasTeaching
                    ? statusDot === 'done'
                      ? `เช็กชื่อครบแล้ว · ${periodLabel}`
                      : statusDot === 'partial'
                        ? `เช็กชื่อบางคาบ · ${periodLabel}`
                        : statusDot === 'upcoming'
                          ? `ยังไม่ถึงวันสอน · ${periodLabel}`
                          : `ยังไม่เช็กชื่อเลย · ${periodLabel}`
                    : inAcademicYear
                      ? 'ไม่มีคาบสอนตามตาราง'
                      : 'นอกปีการศึกษา'
              }
              className={cn(
                'relative flex h-full min-h-[52px] flex-col overflow-hidden rounded-xl border border-slate-300 p-1.5 text-left transition-all lg:min-h-[80px]',
                !statusDot && 'bg-white',
                !inMonth && 'opacity-35',
                inMonth && !inAcademicYear && 'cursor-not-allowed opacity-35',
                inMonth && inAcademicYear && !hasTeaching && !isBlocked && 'cursor-not-allowed opacity-55',
                isBlocked && 'cursor-not-allowed border-slate-200 bg-slate-100 opacity-50',
                statusDot && MOBILE_STATUS_CELL_CLASS[statusDot],
                canSelect && 'cursor-pointer lg:hover:bg-slate-50',
              )}
            >
              <div className="flex items-start justify-between gap-1">
                <span
                  className={cn(
                    'inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-[11px] font-black tabular-nums',
                    today && inAcademicYear && !isBlocked && 'bg-blue-600 text-white shadow-sm',
                    isHoliday && 'text-rose-500',
                    blockEvent?.type === 'exam' && 'text-amber-600',
                    blockEvent?.type === 'activity' && 'text-blue-600',
                    !today && !isBlocked && dow === 0 && 'text-rose-500',
                    !today && !isBlocked && dow === 6 && 'text-blue-500',
                    !today && !isBlocked && dow > 0 && dow < 6 && 'text-slate-700',
                  )}
                >
                  {day.getDate()}
                </span>
                {statusDot === 'upcoming' && (
                  <span className="mt-1 hidden h-2 w-2 shrink-0 rounded-full bg-slate-300 lg:inline-block" aria-label="ยังไม่ถึงวันสอน" />
                )}
                {statusDot === 'pending' && (
                  <span className="mt-1 hidden h-2 w-2 shrink-0 rounded-full bg-rose-500 lg:inline-block" aria-label="ยังไม่เช็กชื่อเลย" />
                )}
                {statusDot === 'partial' && (
                  <span className="mt-1 hidden h-2 w-2 shrink-0 rounded-full bg-amber-500 lg:inline-block" aria-label="เช็กชื่อบางคาบ" />
                )}
                {statusDot === 'done' && (
                  <span className="mt-1 hidden h-2 w-2 shrink-0 rounded-full bg-emerald-500 lg:inline-block" aria-label="เช็กชื่อครบแล้ว" />
                )}
              </div>
              {blockEvent && (
                <p
                  className={cn(
                    'mt-auto hidden text-[8px] font-bold leading-tight font-sarabun lg:line-clamp-2 lg:block lg:text-[9px]',
                    NO_ATTENDANCE_LABEL_CLASS[blockEvent.type],
                  )}
                >
                  {blockEvent.title}
                </p>
              )}
            </button>
          );
        })}
      </div>

      {monthNoAttendanceEvents.length > 0 && (
        <div className="mt-2 shrink-0 space-y-2 px-1 pb-3 lg:hidden">
          <p className="px-0.5 text-[10px] font-black uppercase tracking-wider text-slate-500 font-sukhumvit">
            วันหยุด / สอบ / กิจกรรม
          </p>
          {monthNoAttendanceEvents.map((event) => {
            const type = event.type as 'holiday' | 'exam' | 'activity';
            return (
              <div
                key={event.id}
                className={cn(
                  'rounded-xl border px-3 py-2.5',
                  NO_ATTENDANCE_CARD_CLASS[type],
                )}
              >
                <div className="flex items-start gap-2">
                  <span
                    className={cn(
                      'mt-0.5 shrink-0 text-[10px] font-black uppercase tracking-wide',
                      NO_ATTENDANCE_LABEL_CLASS[type],
                    )}
                  >
                    {EVENT_TYPE_CONFIG[type].label}
                  </span>
                  <p className="min-h-10 min-w-0 line-clamp-2 text-xs font-bold leading-5 text-slate-800 font-sarabun">
                    {event.title?.trim() || EVENT_TYPE_CONFIG[type].label}
                  </p>
                </div>
                <p className="mt-0.5 text-[10px] font-medium text-slate-500 font-sarabun">
                  {formatEventDateRange(event.startDate, event.endDate)}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function TeacherDaySubjectsDrawer({
  open,
  onOpenChange,
  date,
  entries,
  classNameById,
  onSelectEntry,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: Date | null;
  entries: ScheduleEntry[];
  classNameById: Record<string, string>;
  onSelectEntry: (entry: ScheduleEntry) => void;
}) {
  const title = date ? toThaiFullDate(date) : 'รายวิชาที่สอน';

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="right">
      <DrawerContent className={DRAWER_CONTENT_CLASS}>
        <div className={DRAWER_PANEL_CLASS}>
          <DrawerHeader className="shrink-0 px-4 pt-4 pb-2">
            <div className="relative flex min-h-10 items-center justify-center">
              <div className="min-w-0 px-12 text-center">
                <DrawerTitle className="text-base font-black text-slate-800">
                  รายวิชาที่สอนวันนี้
                </DrawerTitle>
                <DrawerDescription className="text-xs text-slate-500">{title}</DrawerDescription>
              </div>
              <div className={DRAWER_HEADER_RIGHT_ACTIONS}>
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  className={DRAWER_HEADER_ICON_BTN}
                  aria-label="ปิด"
                >
                  <HiXMark className="h-4 w-4" />
                </button>
              </div>
            </div>
          </DrawerHeader>

          <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-4 pb-4">
            {entries.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center text-xs font-semibold text-slate-500">
                วันนี้ไม่มีคาบสอนตามตาราง
              </div>
            ) : (
              entries.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => onSelectEntry(entry)}
                  className="w-full rounded-2xl border border-slate-200 bg-white p-3.5 text-left transition hover:border-sky-300 hover:bg-slate-50 active:scale-[0.99]"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-orange-100 shadow-sm">
                      <SubjectIcon
                        subjectGroup={entry.subjectGroup || entry.subjectName}
                        size={22}
                        className="text-orange-700"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-black text-orange-600">คาบ {entry.period}</span>
                        {entry.subjectCode && (
                          <span className="text-[10px] font-bold text-slate-400">{entry.subjectCode}</span>
                        )}
                      </div>
                      <p className="mt-0.5 truncate text-[13px] font-black text-slate-800">
                        {entry.subjectName}
                      </p>
                      <p className="mt-1 truncate text-[11px] font-bold text-slate-500">
                        {classNameById[entry.classId] || entry.classId}
                        {entry.room ? ` · ${entry.room}` : ''}
                      </p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
