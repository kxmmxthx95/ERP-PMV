import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  HiAcademicCap,
  HiCheckCircle,
  HiClipboardDocumentCheck,
  HiOutlineEye,
  HiSun,
  HiUsers,
  HiXMark,
} from 'react-icons/hi2';
import { useIsSchoolDayToday } from '@/hooks/useIsSchoolDayToday';
import { useTeacherDailyTasks } from '@/hooks/useTeacherDailyTasks';
import { formatThaiDateLabelFromIso } from '@/lib/dateUtils';
import { cn } from '@/lib/utils';
import {
  WIDGET_CARD,
  WIDGET_GLASS,
  WIDGET_STAT_CELL,
  WIDGET_STAT_LABEL,
  WIDGET_STAT_VALUE,
} from '../widgetStyles';
import { WidgetSkeleton } from '../components/WidgetSkeleton';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';

const DRAWER_CONTENT_CLASS = [
  'h-dvh flex flex-col p-0 rounded-none',
  'data-[vaul-drawer-direction=right]:w-screen data-[vaul-drawer-direction=right]:max-w-none',
  'data-[vaul-drawer-direction=right]:before:inset-0 data-[vaul-drawer-direction=right]:before:rounded-none',
  'sm:h-full sm:rounded-l-3xl',
  'sm:data-[vaul-drawer-direction=right]:w-full sm:data-[vaul-drawer-direction=right]:max-w-md',
  'sm:data-[vaul-drawer-direction=right]:before:inset-2 sm:data-[vaul-drawer-direction=right]:before:rounded-4xl',
].join(' ');

function taskStatIconColor(applicable: boolean, pending: number): string {
  if (!applicable) return 'text-slate-400';
  return pending > 0 ? 'text-rose-600' : 'text-emerald-600';
}

function TaskBadge({ status }: { status: 'done' | 'pending' | 'not_applicable' }) {
  if (status === 'not_applicable') {
    return (
      <span className="text-[10px] font-black px-2 py-0.5 rounded-lg bg-slate-100 text-slate-400 shrink-0">
        ไม่ต้องทำ
      </span>
    );
  }
  return status === 'done' ? (
    <span className="text-[10px] font-black px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-700 shrink-0">
      เสร็จแล้ว
    </span>
  ) : (
    <span className="text-[10px] font-black px-2 py-0.5 rounded-lg bg-amber-100 text-amber-700 shrink-0">
      รอทำ
    </span>
  );
}

function ClassAttendanceTaskList({
  hasClassesToday,
  classStats,
  classAttendanceTasks,
  showSectionHeader = true,
}: {
  hasClassesToday: boolean;
  classStats: { done: number; total: number };
  classAttendanceTasks: ReturnType<typeof useTeacherDailyTasks>['classAttendanceTasks'];
  showSectionHeader?: boolean;
}) {
  return (
    <section>
      {showSectionHeader && (
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <HiClipboardDocumentCheck className="w-4 h-4 text-violet-500 shrink-0" />
            <h3 className="text-sm font-black text-slate-800 truncate">เช็คชื่อเข้าเรียน</h3>
          </div>
          {hasClassesToday && (
            <span className="text-[10px] font-black text-slate-400 shrink-0">
              {classStats.done}/{classStats.total}
            </span>
          )}
        </div>
      )}

      {!hasClassesToday ? (
        <p className="text-[11px] font-bold text-slate-400 rounded-xl border border-dashed border-slate-200 px-3 py-3">
          วันนี้ไม่มีคาบสอนตามตาราง
        </p>
      ) : (
        <div className="space-y-2">
          {classAttendanceTasks.map((task) => (
            <div
              key={task.entryId}
              className={`rounded-2xl border p-3 ${
                task.status === 'done'
                  ? 'bg-emerald-50/90 border-emerald-200'
                  : task.status === 'not_applicable'
                    ? 'bg-slate-50 border-slate-200'
                    : 'bg-white border-slate-200'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[13px] font-black text-slate-800 truncate">
                    คาบ {task.period} · {task.subjectName}
                  </p>
                  <p className="text-[10px] font-bold text-slate-500 truncate mt-0.5">
                    {task.className}
                  </p>
                </div>
                <TaskBadge status={task.status} />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function TeachingReflectionTaskList({
  hasReflectionTasksToday,
  reflectionStats,
  teachingReflectionTasks,
  showSectionHeader = true,
  onSelectTask,
}: {
  hasReflectionTasksToday: boolean;
  reflectionStats: { done: number; total: number };
  teachingReflectionTasks: ReturnType<typeof useTeacherDailyTasks>['teachingReflectionTasks'];
  showSectionHeader?: boolean;
  onSelectTask?: (task: ReturnType<typeof useTeacherDailyTasks>['teachingReflectionTasks'][number]) => void;
}) {
  return (
    <section>
      {showSectionHeader && (
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <HiAcademicCap className="w-4 h-4 text-sky-500 shrink-0" />
            <h3 className="text-sm font-black text-slate-800 truncate">บันทึกหลังการสอน</h3>
          </div>
          {hasReflectionTasksToday && (
            <span className="text-[10px] font-black text-slate-400 shrink-0">
              {reflectionStats.done}/{reflectionStats.total}
            </span>
          )}
        </div>
      )}

      {!hasReflectionTasksToday ? (
        <p className="text-[11px] font-bold text-slate-400 rounded-xl border border-dashed border-slate-200 px-3 py-3">
          วันนี้ไม่มีคาบสอนตามตาราง
        </p>
      ) : (
        <div className="space-y-2">
          {teachingReflectionTasks.map((task) => {
            const clickable = task.status !== 'not_applicable' && !!onSelectTask;
            const Wrapper = clickable ? 'button' : 'div';
            return (
              <Wrapper
                key={task.taskId}
                type={clickable ? 'button' : undefined}
                onClick={clickable ? () => onSelectTask!(task) : undefined}
                className={`w-full text-left rounded-2xl border p-3 transition-colors ${
                  task.status === 'done'
                    ? 'bg-emerald-50/90 border-emerald-200'
                    : task.status === 'not_applicable'
                      ? 'bg-slate-50 border-slate-200'
                      : 'bg-white border-slate-200'
                } ${clickable ? 'active:scale-[0.99] hover:border-sky-300' : ''}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[13px] font-black text-slate-800 truncate">
                      {task.subjectName}
                    </p>
                    <p className="text-[10px] font-bold text-slate-500 truncate mt-0.5">
                      {task.className}
                      {task.periods.length > 0 ? ` · คาบ ${task.periods.join(', ')}` : ''}
                    </p>
                  </div>
                  <TaskBadge status={task.status} />
                </div>
              </Wrapper>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default function TeacherDailyTaskWidget() {
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const {
    today,
    loading,
    rollCallTasks,
    classAttendanceTasks,
    teachingReflectionTasks,
    rollCallStats,
    classStats,
    reflectionStats,
    allDone,
    hasHomeroom,
    hasClassesToday,
    hasReflectionTasksToday,
  } = useTeacherDailyTasks();

  const goToReflectionTask = (task: { classId: string; subjectId: string }) => {
    setDrawerOpen(false);
    navigate(`/portal/micro-syllabus?classId=${encodeURIComponent(task.classId)}&subjectId=${encodeURIComponent(task.subjectId)}`);
  };

  const {
    isHoliday: isBlocked,
    isWeekend,
    holidayTitle,
  } = useIsSchoolDayToday('teacher', today);

  const todayLabel = useMemo(() => formatThaiDateLabelFromIso(today), [today]);

  const pendingTotal = rollCallStats.pending + classStats.pending + reflectionStats.pending;
  const hasPending = !isBlocked && pendingTotal > 0;

  const holidayStyle = isWeekend
    ? {
        background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 55%, #6d28d9 100%)',
        border: '1.5px solid rgba(255,255,255,0.28)',
      }
    : {
        background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 55%, #b91c1c 100%)',
        border: '1.5px solid rgba(255,255,255,0.28)',
      };

  if (loading) {
    return <WidgetSkeleton variant="wide" />;
  }

  return (
    <>
      <div
        style={isBlocked ? holidayStyle : WIDGET_GLASS}
        className={WIDGET_CARD}
      >
        <div className="flex items-center justify-between shrink-0 gap-2">
          <div className="min-w-0 flex-1">
            <p className={`text-sm font-black truncate leading-none ${isBlocked ? 'text-white' : 'text-slate-800'}`}>
              งานประจำวันครู
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {isBlocked ? (
              <span className="text-[10px] font-black px-2 py-0.5 rounded-lg border bg-white/20 text-white border-white/30">
                วันหยุด
              </span>
            ) : pendingTotal > 0 ? (
              <span className="text-[10px] font-black px-2 py-0.5 rounded-lg border bg-rose-50 text-rose-600 border-rose-100">
                {pendingTotal} ค้าง
              </span>
            ) : null}
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className={cn(
                'p-1.5 rounded-lg transition active:scale-95',
                isBlocked
                  ? 'hover:bg-white/15 text-white'
                  : hasPending
                    ? 'text-rose-600 hover:bg-rose-50'
                    : 'hover:bg-slate-200/50 text-slate-600',
              )}
              aria-label="ดูรายละเอียด"
            >
              <HiOutlineEye
                size={16}
                className={cn(hasPending && 'animate-pulse')}
                aria-hidden
              />
            </button>
          </div>
        </div>

        {isBlocked ? (
          <div className="flex-1 min-h-0 flex items-center rounded-xl border border-white/25 bg-white/10 px-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-white/20 border border-white/30 flex items-center justify-center shrink-0">
                {isWeekend ? (
                  <HiSun className="w-5 h-5 text-white" aria-hidden />
                ) : (
                  <HiClipboardDocumentCheck className="w-5 h-5 text-white" aria-hidden />
                )}
              </div>
              <p className="text-[11px] font-black text-white leading-tight truncate">
                {isWeekend
                  ? 'วันหยุดสุดสัปดาห์'
                  : `วันหยุด${holidayTitle ? ` · ${holidayTitle}` : ''}`}
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-1.5 flex-1 min-h-0">
            <div className={WIDGET_STAT_CELL}>
              <HiUsers
                className={cn('w-4 h-4 mb-0.5', taskStatIconColor(hasHomeroom, rollCallStats.pending))}
                aria-hidden
              />
              <span className={cn(WIDGET_STAT_VALUE, taskStatIconColor(hasHomeroom, rollCallStats.pending))}>
                {hasHomeroom ? `${rollCallStats.done}/${rollCallStats.total}` : '—'}
              </span>
              <span className={cn(WIDGET_STAT_LABEL, 'text-[9px]', taskStatIconColor(hasHomeroom, rollCallStats.pending))}>
                เช็คชื่อเข้าแถว
              </span>
            </div>
            <div className={WIDGET_STAT_CELL}>
              <HiClipboardDocumentCheck
                className={cn('w-4 h-4 mb-0.5', taskStatIconColor(hasClassesToday, classStats.pending))}
                aria-hidden
              />
              <span className={cn(WIDGET_STAT_VALUE, taskStatIconColor(hasClassesToday, classStats.pending))}>
                {hasClassesToday ? `${classStats.done}/${classStats.total}` : '—'}
              </span>
              <span className={cn(WIDGET_STAT_LABEL, 'text-[9px]', taskStatIconColor(hasClassesToday, classStats.pending))}>
                เช็คชื่อเข้าเรียน
              </span>
            </div>
            <div className={WIDGET_STAT_CELL}>
              <HiAcademicCap
                className={cn('w-4 h-4 mb-0.5', taskStatIconColor(hasReflectionTasksToday, reflectionStats.pending))}
                aria-hidden
              />
              <span className={cn(WIDGET_STAT_VALUE, taskStatIconColor(hasReflectionTasksToday, reflectionStats.pending))}>
                {hasReflectionTasksToday ? `${reflectionStats.done}/${reflectionStats.total}` : '—'}
              </span>
              <span className={cn(WIDGET_STAT_LABEL, 'text-[9px] leading-tight', taskStatIconColor(hasReflectionTasksToday, reflectionStats.pending))}>
                บันทึกหลังสอน
              </span>
            </div>
          </div>
        )}
      </div>

      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen} direction="right">
        <DrawerContent className={DRAWER_CONTENT_CLASS}>
          <DrawerHeader className="shrink-0 px-4 pt-4 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center shrink-0"
                aria-label="ปิด"
              >
                <HiXMark className="w-5 h-5 text-slate-600" />
              </button>
              <div className="min-w-0 flex-1">
                <DrawerTitle className="text-base font-black text-slate-800 truncate">
                  งานประจำวันครู
                </DrawerTitle>
                <DrawerDescription className="text-[11px] font-bold text-slate-400 truncate">
                  {todayLabel}
                </DrawerDescription>
              </div>
            </div>
          </DrawerHeader>

          <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-5">
            <section>
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <HiUsers className="w-4 h-4 text-amber-500 shrink-0" />
                  <h3 className="text-sm font-black text-slate-800 truncate">เช็คชื่อเข้าแถว</h3>
                </div>
                {hasHomeroom && (
                  <span className="text-[10px] font-black text-slate-400 shrink-0">
                    {rollCallStats.done}/{rollCallStats.total}
                  </span>
                )}
              </div>

              {!hasHomeroom ? (
                <p className="text-[11px] font-bold text-slate-400 rounded-xl border border-dashed border-slate-200 px-3 py-3">
                  ไม่ได้รับผิดชอบห้องประจำชั้น
                </p>
              ) : (
                <div className="space-y-2">
                  {rollCallTasks.map((task) => (
                    <div
                      key={task.classId}
                      className={`rounded-2xl border p-3 ${
                        task.status === 'done'
                          ? 'bg-emerald-50/90 border-emerald-200'
                          : 'bg-white border-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[13px] font-black text-slate-800 truncate">{task.className}</p>
                        <TaskBadge status={task.status} />
                      </div>
                      {task.session && (
                        <p className="text-[10px] font-bold text-slate-500 mt-1">
                          มา {task.session.summary.present} · ขาด {task.session.summary.absent} · สาย{' '}
                          {task.session.summary.late} · ลา {task.session.summary.leave}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            <ClassAttendanceTaskList
              hasClassesToday={hasClassesToday}
              classStats={classStats}
              classAttendanceTasks={classAttendanceTasks}
            />

            <TeachingReflectionTaskList
              hasReflectionTasksToday={hasReflectionTasksToday}
              reflectionStats={reflectionStats}
              teachingReflectionTasks={teachingReflectionTasks}
              onSelectTask={goToReflectionTask}
            />

            {!isBlocked && allDone && (hasHomeroom || hasClassesToday || hasReflectionTasksToday) && (
              <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50/90 px-3 py-3">
                <HiCheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
                <p className="text-[11px] font-black text-emerald-700">งานประจำวันครบแล้ว</p>
              </div>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
