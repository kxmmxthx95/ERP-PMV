import { useState } from 'react';
import {
  HiAcademicCap,
  HiClipboardDocumentCheck,
  HiOutlineEye,
  HiSun,
  HiUsers,
} from 'react-icons/hi2';
import { useIsSchoolDayToday } from '@/hooks/useIsSchoolDayToday';
import { useTeacherDailyTasks } from '@/hooks/useTeacherDailyTasks';
import { cn } from '@/lib/utils';
import {
  WIDGET_CARD,
  WIDGET_GLASS,
  WIDGET_STAT_CELL,
  WIDGET_STAT_LABEL,
  WIDGET_STAT_VALUE,
} from '../widgetStyles';
import { WidgetSkeleton } from '../components/WidgetSkeleton';
import { TeacherDailyTasksPanel } from './TeacherDailyTasksPanel';

export {
  RollCallTaskList,
  ClassAttendanceTaskList,
  TeachingReflectionTaskList,
} from './TeacherDailyTasksPanel';

function taskStatIconColor(applicable: boolean, pending: number): string {
  if (!applicable) return 'text-slate-400';
  return pending > 0 ? 'text-rose-600' : 'text-emerald-600';
}

export default function TeacherDailyTaskWidget() {
  const [drawerOpen, setDrawerOpen] = useState(false);

  const {
    today,
    loading,
    rollCallStats,
    classStats,
    reflectionStats,
    hasHomeroom,
    hasClassesToday,
    hasReflectionTasksToday,
  } = useTeacherDailyTasks();

  const {
    isHoliday: isBlocked,
    isWeekend,
    holidayTitle,
  } = useIsSchoolDayToday('teacher', today);

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

      <TeacherDailyTasksPanel open={drawerOpen} onOpenChange={setDrawerOpen} />
    </>
  );
}
