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
import { HiChevronLeft, HiChevronRight } from 'react-icons/hi2';
import { cn } from '@/lib/utils';
import { toDateStr, formatEventDateRange } from '@/features/calendar/utils';
import { useAuth } from '@/hooks/useAuth';
import { useAcademicCalendar } from '@/hooks/useAcademicCalendar';
import { useThaiHolidays } from '@/features/calendar/hooks/useThaiHolidays';
import { EVENT_TYPE_CONFIG } from '@/types/calendar';
import type { CalendarEvent } from '@/types/calendar';
import { Button } from '@/components/ui/button';

const DAY_NAMES = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'] as const;

type DayRollCallDot = 'upcoming' | 'pending' | 'done';

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
const MOBILE_STATUS_CELL_CLASS: Record<DayRollCallDot, string> = {
  upcoming: 'border-slate-200 bg-slate-100 lg:border-slate-300 lg:bg-white',
  pending: 'border-rose-200 bg-rose-100 lg:border-slate-300 lg:bg-white',
  done: 'border-emerald-200 bg-emerald-100 lg:border-slate-300 lg:bg-white',
};

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

/** Mon–Fri only (JS getDay 1–5) */
function isSchoolWeekday(date: Date): boolean {
  const dow = date.getDay();
  return dow >= 1 && dow <= 5;
}

export function MorningRollCallMonthCalendar({
  className,
  sessionDates,
  onSelectDay,
  rangeStart,
  rangeEnd,
  todayDate,
  interSemesterBreak = null,
}: {
  className?: string;
  /** Dates (YYYY-MM-DD) that already have a saved roll-call session */
  sessionDates: Set<string>;
  onSelectDay: (day: Date) => void;
  rangeStart: string;
  rangeEnd: string;
  todayDate: string;
  /** ช่วงปิดระหว่างเทอม — การ์ดวันในนี้ disabled */
  interSemesterBreak?: { startDate: string; endDate: string } | null;
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

    const events = calendarEvents
      .filter(
        (e) =>
          NO_ATTENDANCE_TYPES.has(e.type) &&
          e.startDate <= to &&
          e.endDate >= from,
      )
      .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.title.localeCompare(b.title));

    if (
      interSemesterBreak &&
      interSemesterBreak.startDate <= to &&
      interSemesterBreak.endDate >= from
    ) {
      const breakEvent: CalendarEvent = {
        id: 'inter-semester-break',
        title: 'ปิดระหว่างเทอม',
        startDate: interSemesterBreak.startDate,
        endDate: interSemesterBreak.endDate,
        type: 'holiday',
        targetRoles: [],
      };
      return [breakEvent, ...events];
    }
    return events;
  }, [calendarEvents, month, rangeStart, rangeEnd, interSemesterBreak]);

  const dayInfoEventFor = (dateStr: string) => {
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

  const dayDotStatus = (dateStr: string): DayRollCallDot => {
    if (dateStr > todayDate) return 'upcoming';
    if (sessionDates.has(dateStr)) return 'done';
    return 'pending';
  };

  return (
    <div className={cn('flex h-full min-h-0 w-full flex-col max-lg:overflow-y-auto', className)}>
      <div className="flex shrink-0 items-center justify-between gap-2 px-1 pb-1.5 pt-4">
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

      <div className="min-h-0 flex-1 overflow-hidden lg:overflow-visible">
      <div className="grid h-full grid-cols-7 gap-1 px-1 pb-2 max-lg:auto-rows-[minmax(52px,auto)] lg:auto-rows-fr">
        {days.map((day) => {
          const inMonth = isSameMonth(day, month);
          const dateStr = toDateStr(day);
          const inAcademicYear = dateStr >= rangeStart && dateStr <= rangeEnd;
          const today = isToday(day);
          const infoEvent = inMonth && inAcademicYear ? dayInfoEventFor(dateStr) : null;
          const isInterBreak =
            Boolean(interSemesterBreak) &&
            dateStr >= interSemesterBreak!.startDate &&
            dateStr <= interSemesterBreak!.endDate;
          // เข้าแถว: บล็อกวันหยุด + ช่วงปิดระหว่างเทอม — วันสอบ/กิจกรรมเช็กได้
          const isBlocked = infoEvent?.type === 'holiday' || isInterBreak;
          const isHoliday = infoEvent?.type === 'holiday';
          const weekdayOk = isSchoolWeekday(day);
          const hasRollCallDay = inMonth && inAcademicYear && weekdayOk;
          const dow = day.getDay();
          const canSelect = hasRollCallDay && !isBlocked;
          const statusDot = hasRollCallDay && !isBlocked ? dayDotStatus(dateStr) : null;

          return (
            <button
              key={dateStr}
              type="button"
              disabled={!canSelect}
              onClick={() => canSelect && onSelectDay(day)}
              title={
                isInterBreak
                  ? 'ปิดระหว่างเทอม — ไม่มีการเช็กชื่อเข้าแถว'
                  : isBlocked
                    ? `${infoEvent!.title} — ไม่มีการเช็กชื่อเข้าแถว`
                    : hasRollCallDay
                      ? statusDot === 'done'
                        ? 'เช็กชื่อเข้าแถวแล้ว'
                        : statusDot === 'upcoming'
                          ? 'ยังไม่ถึงวัน'
                          : 'ยังไม่เช็กชื่อเข้าแถว'
                      : inAcademicYear
                        ? 'วันหยุดสุดสัปดาห์'
                        : 'นอกปีการศึกษา'
              }
              className={cn(
                'relative flex h-full min-h-[52px] flex-col overflow-hidden rounded-xl border border-slate-300 p-1.5 text-left transition-all lg:min-h-[80px]',
                !statusDot && 'bg-white',
                !inMonth && 'opacity-35',
                inMonth && !inAcademicYear && 'cursor-not-allowed opacity-35',
                inMonth && inAcademicYear && !weekdayOk && !isBlocked && 'cursor-not-allowed opacity-55',
                isBlocked && 'cursor-not-allowed border-slate-200 bg-slate-100 opacity-50',
                isInterBreak && 'border-rose-200 bg-rose-50/80',
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
                    isInterBreak && 'text-rose-500',
                    infoEvent?.type === 'exam' && 'text-amber-600',
                    infoEvent?.type === 'activity' && 'text-blue-600',
                    !today && !isBlocked && dow === 0 && 'text-rose-500',
                    !today && !isBlocked && dow === 6 && 'text-blue-500',
                    !today && !isBlocked && dow > 0 && dow < 6 && 'text-slate-700',
                  )}
                >
                  {day.getDate()}
                </span>
                {statusDot === 'upcoming' && (
                  <span className="mt-1 hidden h-2 w-2 shrink-0 rounded-full bg-slate-300 lg:inline-block" aria-label="ยังไม่ถึงวัน" />
                )}
                {statusDot === 'pending' && (
                  <span className="mt-1 hidden h-2 w-2 shrink-0 rounded-full bg-rose-500 lg:inline-block" aria-label="ยังไม่เช็กชื่อ" />
                )}
                {statusDot === 'done' && (
                  <span className="mt-1 hidden h-2 w-2 shrink-0 rounded-full bg-emerald-500 lg:inline-block" aria-label="เช็กชื่อแล้ว" />
                )}
              </div>
              {isInterBreak ? (
                <p className="mt-auto hidden text-[8px] font-bold leading-tight text-rose-500 font-sarabun lg:line-clamp-2 lg:block lg:text-[9px]">
                  ปิดระหว่างเทอม
                </p>
              ) : infoEvent ? (
                <p
                  className={cn(
                    'mt-auto hidden text-[8px] font-bold leading-tight font-sukhumvit lg:line-clamp-2 lg:block lg:text-[9px]',
                    NO_ATTENDANCE_LABEL_CLASS[infoEvent.type],
                  )}
                >
                  {infoEvent.title}
                </p>
              ) : null}
            </button>
          );
        })}
      </div>
      </div>

      {monthNoAttendanceEvents.length > 0 && (
        <div className="mt-2 shrink-0 space-y-2 px-1 pb-3 lg:hidden">
          <p className="px-0.5 text-[10px] font-black uppercase tracking-wider text-slate-500 font-sukhumvit">
            วันหยุด / สอบ / กิจกรรม
          </p>
          {monthNoAttendanceEvents.map((event) => {
            const isBreak = event.id === 'inter-semester-break';
            const type = event.type as 'holiday' | 'exam' | 'activity';
            return (
              <div
                key={event.id}
                className={cn(
                  'rounded-xl border px-3 py-2.5',
                  isBreak ? 'border-rose-200 bg-rose-50' : NO_ATTENDANCE_CARD_CLASS[type],
                )}
              >
                <div className="flex items-start gap-2">
                  <span
                    className={cn(
                      'mt-0.5 shrink-0 text-[10px] font-black uppercase tracking-wide',
                      isBreak ? 'text-rose-500' : NO_ATTENDANCE_LABEL_CLASS[type],
                    )}
                  >
                    {isBreak ? 'ปิดเทอม' : EVENT_TYPE_CONFIG[type].label}
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
