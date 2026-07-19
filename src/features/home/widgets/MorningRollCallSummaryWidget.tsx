// src/features/home/widgets/MorningRollCallSummaryWidget.tsx
import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { HiArrowLeft, HiOutlineEye, HiUsers, HiXMark } from 'react-icons/hi2';
import { formatThaiDateLabel } from '@/lib/dateUtils';
import { useIsSchoolDayToday } from '@/hooks/useIsSchoolDayToday';
import { useActiveAcademicYear } from '@/hooks/useActiveAcademicYear';
import { useStudentSummary } from '@/hooks/useStudentSummary';
import { useTodayRollCallSessions } from '@/hooks/useMorningRollCall';
import { useYearClassesHomeroom } from '@/hooks/useYearClassesHomeroom';
import {
  WIDGET_CARD,
  WIDGET_GLASS,
  WIDGET_STAT_CELL,
  WIDGET_STAT_LABEL,
  WIDGET_STAT_VALUE,
} from '../widgetStyles';
import { WidgetSkeleton } from '../components/WidgetSkeleton';
import {
  getWidgetHolidayCardStyle,
  WidgetHolidayBadge,
  WidgetHolidayBody,
  widgetHolidayDateClass,
  widgetHolidayHeaderClass,
  widgetHolidayIconButtonClass,
} from '../components/WidgetHolidayContent';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import type { ClassRoom } from '@/types/class';
import type { MorningRollCallSession, RollCallStatus, StudentRollCall } from '@/types/morningRollCall';
import StudentAvatar from '@/features/students/components/StudentAvatar';

const STATUS_META: Record<
  RollCallStatus,
  { label: string; badgeClassName: string; cardClassName: string }
> = {
  present: {
    label: 'มา',
    badgeClassName: 'bg-emerald-100 text-emerald-700',
    cardClassName: 'bg-emerald-50/90 border-emerald-200',
  },
  late: {
    label: 'สาย',
    badgeClassName: 'bg-amber-100 text-amber-700',
    cardClassName: 'bg-amber-50/90 border-amber-200',
  },
  absent: {
    label: 'ขาด',
    badgeClassName: 'bg-rose-100 text-rose-700',
    cardClassName: 'bg-rose-50/90 border-rose-200',
  },
  leave: {
    label: 'ลา',
    badgeClassName: 'bg-blue-100 text-blue-700',
    cardClassName: 'bg-blue-50/90 border-blue-200',
  },
  unmarked: {
    label: 'ยังไม่เช็ก',
    badgeClassName: 'bg-slate-100 text-slate-500',
    cardClassName: 'bg-white border-slate-200',
  },
};

const SUMMARY_STAT_COLORS = {
  present: 'text-emerald-600',
  absent: 'text-rose-600',
  late: 'text-amber-600',
  leave: 'text-blue-600',
} as const;

const DRAWER_CONTENT_CLASS = [
  'h-dvh flex flex-col p-0 rounded-none',
  'data-[vaul-drawer-direction=right]:w-screen data-[vaul-drawer-direction=right]:max-w-none',
  'data-[vaul-drawer-direction=right]:before:inset-0 data-[vaul-drawer-direction=right]:before:rounded-none',
  'sm:h-full sm:rounded-l-3xl',
  'sm:data-[vaul-drawer-direction=right]:w-full sm:data-[vaul-drawer-direction=right]:max-w-md',
  'sm:data-[vaul-drawer-direction=right]:before:inset-2 sm:data-[vaul-drawer-direction=right]:before:rounded-4xl',
].join(' ');

function getAttendedPct(session: MorningRollCallSession): number {
  const attended = session.summary.present + session.summary.late;
  const total =
    session.totalStudents > 0
      ? session.totalStudents
      : attended + session.summary.absent + session.summary.leave;
  return total > 0 ? Math.round((attended / total) * 100) : 0;
}

function RollCallSummaryLine({
  summary,
  className = 'text-[11px] font-bold mt-1',
}: {
  summary: MorningRollCallSession['summary'];
  className?: string;
}) {
  const items = [
    { key: 'present' as const, label: 'มา', value: summary.present },
    { key: 'absent' as const, label: 'ขาด', value: summary.absent },
    { key: 'late' as const, label: 'สาย', value: summary.late },
    { key: 'leave' as const, label: 'ลา', value: summary.leave },
  ];

  return (
    <p className={className}>
      {items.map((item, index) => (
        <span key={item.key}>
          {index > 0 && <span className="text-slate-300 mx-1">·</span>}
          <span className={SUMMARY_STAT_COLORS[item.key]}>
            {item.label} {item.value}
          </span>
        </span>
      ))}
    </p>
  );
}

function StudentRow({ student }: { student: StudentRollCall }) {
  const meta = STATUS_META[student.status] ?? STATUS_META.unmarked;

  return (
    <div className={`rounded-2xl border p-3 ${meta.cardClassName}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <StudentAvatar
            photoURL={student.photoURL}
            studentId={student.studentId}
            name={student.studentName}
            gender={student.gender}
            className="w-10 h-10 rounded-xl shrink-0"
          />
          <div className="min-w-0">
            <p className="text-[13px] font-black text-slate-800 truncate">{student.studentName}</p>
            <p className="text-[11px] font-bold text-slate-400">{student.studentCode}</p>
          </div>
        </div>
        <span className={`text-[10px] font-black px-2 py-1 rounded-lg shrink-0 ${meta.badgeClassName}`}>
          {meta.label}
        </span>
      </div>
    </div>
  );
}

export default function MorningRollCallSummaryWidget() {
  const { year } = useActiveAcademicYear();
  const { total: schoolTotal, loading: studentsLoading } = useStudentSummary(year ?? undefined, {
    includeMasterStudents: false,
  });
  const { sessions, loading: sessionsLoading } = useTodayRollCallSessions(year ?? undefined);
  const {
    classes: yearClasses,
    getHomeroomForClassId,
    getHomeroomTeacherName,
    classesLoading,
  } = useYearClassesHomeroom(year ?? undefined);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState<MorningRollCallSession | null>(null);

  const sortedSessions = useMemo(
    () => [...sessions].sort((a, b) => a.className.localeCompare(b.className, 'th')),
    [sessions],
  );

  const checkedClassIds = useMemo(() => new Set(sessions.map(s => s.classId)), [sessions]);

  const uncheckedClasses = useMemo(
    () =>
      yearClasses
        .filter(cls => !checkedClassIds.has(cls.id))
        .sort((a, b) => a.className.localeCompare(b.className, 'th')),
    [yearClasses, checkedClassIds],
  );

  const checkedRooms = sessions.length;
  const totalRooms = yearClasses.length;
  const presentTotal = sessions.reduce((sum, s) => sum + s.summary.present, 0);
  const lateTotal = sessions.reduce((sum, s) => sum + s.summary.late, 0);
  const attendedTotal = presentTotal + lateTotal;
  const checkedStudents = sessions.reduce((sum, s) => sum + s.totalStudents, 0);
  const denominator = schoolTotal > 0 ? schoolTotal : checkedStudents;
  const presentPct = denominator > 0 ? Math.round((attendedTotal / denominator) * 100) : 0;

  const todayLabel = useMemo(() => formatThaiDateLabel(), []);
  const { isHoliday, isWeekend, holidayTitle } = useIsSchoolDayToday();

  const isLoading = sessionsLoading || studentsLoading || classesLoading;

  const openDrawer = () => {
    setSelectedSession(null);
    setDrawerOpen(true);
  };

  const handleDrawerChange = (open: boolean) => {
    setDrawerOpen(open);
    if (!open) setSelectedSession(null);
  };

  if (isLoading) {
    return <WidgetSkeleton />;
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        style={isHoliday ? getWidgetHolidayCardStyle(isWeekend) : WIDGET_GLASS}
        className={WIDGET_CARD}
      >
        <div className="flex items-center justify-between shrink-0">
          <div className="min-w-0">
            <p className={widgetHolidayHeaderClass(isHoliday)}>สรุปเช็คชื่อเข้าแถว</p>
            <p className={widgetHolidayDateClass(isHoliday)}>{todayLabel}</p>
          </div>
          <div className="flex items-center shrink-0 gap-1">
            {isHoliday ? <WidgetHolidayBadge /> : null}
            <motion.button
              type="button"
              whileTap={{ scale: 0.92 }}
              onClick={openDrawer}
              className={widgetHolidayIconButtonClass(isHoliday)}
              aria-label="ดูรายละเอียดห้องเรียน"
            >
              <HiOutlineEye size={16} />
            </motion.button>
          </div>
        </div>

        {isHoliday ? (
          <WidgetHolidayBody isWeekend={isWeekend} holidayTitle={holidayTitle} />
        ) : (
          <div className="grid grid-cols-3 gap-2 flex-1 min-h-0">
            <div className={WIDGET_STAT_CELL}>
              <span className={`${WIDGET_STAT_VALUE} text-indigo-600 text-sm`}>
                {totalRooms > 0 ? `${checkedRooms}/${totalRooms}` : checkedRooms > 0 ? checkedRooms : '—'}
              </span>
              <span className={WIDGET_STAT_LABEL}>ห้อง</span>
            </div>
            <div className={WIDGET_STAT_CELL}>
              <span className={`${WIDGET_STAT_VALUE} text-green-600`}>{presentPct}%</span>
              <span className={WIDGET_STAT_LABEL}>มาเรียน</span>
            </div>
            <div className={WIDGET_STAT_CELL}>
              <span className={`${WIDGET_STAT_VALUE} text-slate-700 text-sm`}>
                {denominator > 0 ? `${attendedTotal}/${denominator}` : '—'}
              </span>
              <span className={WIDGET_STAT_LABEL}>คน/ทั้งหมด</span>
            </div>
          </div>
        )}
      </motion.div>

      <Drawer open={drawerOpen} onOpenChange={handleDrawerChange} direction="right">
        <DrawerContent className={DRAWER_CONTENT_CLASS}>
          <DrawerHeader className="px-4 pb-2">
            <div className="relative flex items-center justify-center min-h-10">
              {selectedSession && (
                <button
                  type="button"
                  onClick={() => setSelectedSession(null)}
                  className="absolute left-0 top-1/2 -translate-y-1/2 inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 active:scale-[0.98] transition"
                  aria-label="กลับไปรายการห้อง"
                >
                  <HiArrowLeft className="w-4 h-4" />
                </button>
              )}
              <div className="min-w-0 text-center px-12">
                {selectedSession ? (
                  <>
                    <DrawerTitle className="text-base font-black text-slate-800 truncate">
                      {selectedSession.className}
                    </DrawerTitle>
                    <DrawerDescription asChild>
                      <RollCallSummaryLine
                        summary={selectedSession.summary}
                        className="text-xs font-bold flex flex-wrap justify-center gap-x-1"
                      />
                    </DrawerDescription>
                  </>
                ) : (
                  <>
                    <DrawerTitle className="text-base font-black text-slate-800">
                      สรุปเช็คชื่อเข้าแถว
                    </DrawerTitle>
                    <DrawerDescription className="text-xs text-slate-500">{todayLabel}</DrawerDescription>
                  </>
                )}
              </div>
              <button
                type="button"
                onClick={() => handleDrawerChange(false)}
                className="absolute right-0 top-1/2 -translate-y-1/2 inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 active:scale-[0.98] transition"
                aria-label="ปิด"
              >
                <HiXMark className="w-4 h-4" />
              </button>
            </div>
          </DrawerHeader>

          <div className="px-4 pb-4 overflow-y-auto flex-1 min-h-0">
            {selectedSession ? (
              selectedSession.attendance.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center text-xs font-semibold text-slate-500">
                  ไม่พบรายชื่อนักเรียนในห้องนี้
                </div>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {selectedSession.attendance.map(student => (
                    <StudentRow key={student.studentId} student={student} />
                  ))}
                </div>
              )
            ) : yearClasses.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
                <p className="text-sm font-bold text-slate-600">ยังไม่มีห้องเรียนในปีการศึกษานี้</p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {sortedSessions.length > 0 && (
                  <section className="flex flex-col gap-2.5">
                    <p className="text-[11px] font-black text-emerald-700 uppercase tracking-wide px-0.5">
                      เช็คแล้ว ({sortedSessions.length})
                    </p>
                    {sortedSessions.map(session => (
                      <button
                        key={session.id}
                        type="button"
                        onClick={() => setSelectedSession(session)}
                        className="w-full text-left rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3.5 transition-all hover:bg-emerald-50 active:scale-[0.99]"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-2xl shrink-0 border border-emerald-500 bg-emerald-600 text-white flex items-center justify-center">
                            <HiUsers className="w-5 h-5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-[14px] font-black text-slate-800 truncate">{session.className}</p>
                              <span className="text-[12px] font-black text-emerald-700 shrink-0">
                                {getAttendedPct(session)}%
                              </span>
                            </div>
                            <p className="text-[11px] font-semibold text-slate-500 mt-0.5 truncate">
                              โดย {getHomeroomTeacherName(session)}
                            </p>
                            <RollCallSummaryLine summary={session.summary} />
                          </div>
                        </div>
                      </button>
                    ))}
                  </section>
                )}

                {uncheckedClasses.length > 0 && (
                  <section className="flex flex-col gap-2.5">
                    <p className="text-[11px] font-black text-slate-500 uppercase tracking-wide px-0.5">
                      ยังไม่เช็ค ({uncheckedClasses.length})
                    </p>
                    {uncheckedClasses.map((cls: ClassRoom) => (
                      <div
                        key={cls.id}
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50/80 p-3.5"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-2xl shrink-0 border border-slate-200 bg-white text-slate-400 flex items-center justify-center">
                            <HiUsers className="w-5 h-5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-[14px] font-black text-slate-800 truncate">{cls.className}</p>
                              <span className="text-[10px] font-black px-2 py-1 rounded-lg bg-slate-100 text-slate-500 shrink-0">
                                ยังไม่เช็ค
                              </span>
                            </div>
                            <p className="text-[11px] font-semibold text-slate-500 mt-0.5 truncate">
                              โดย {getHomeroomForClassId(cls.id)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </section>
                )}
              </div>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
