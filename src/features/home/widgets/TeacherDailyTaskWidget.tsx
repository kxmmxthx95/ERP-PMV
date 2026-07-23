import { useMemo, useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  HiAcademicCap,
  HiCheck,
  HiCheckCircle,
  HiClipboardDocumentCheck,
  HiOutlineEye,
  HiSun,
  HiUsers,
  HiXMark,
} from 'react-icons/hi2';
import { useAuth } from '@/hooks/useAuth';
import { useActiveAcademicYear } from '@/hooks/useActiveAcademicYear';
import { useIsSchoolDayToday } from '@/hooks/useIsSchoolDayToday';
import {
  useTeacherDailyTasks,
  type TeacherTeachingReflectionTask,
} from '@/hooks/useTeacherDailyTasks';
import { formatThaiDateLabelFromIso, getLocalDateString } from '@/lib/dateUtils';
import { cn } from '@/lib/utils';
import { DRAWER_HEADER_ICON_BTN, DRAWER_HEADER_RIGHT_ACTIONS } from '@/lib/drawerHeaderBtn';
import type {
  TeachingOverview,
  TeachingPlanStatus,
  TeachingReflectionStudent,
  WeeklyTopic,
} from '@/types/microSyllabus';
import { normalizeTeachingOverview } from '@/types/microSyllabus';
import { ProblemStudentPicker } from '@/features/microSyllabus/components/ProblemStudentPicker';
import { TeachingStarRating } from '@/features/microSyllabus/components/TeachingStarRating';
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
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';

const DRAWER_CONTENT_CLASS = cn(
  'flex h-dvh flex-col bg-transparent p-0 before:hidden',
  'data-[vaul-drawer-direction=right]:w-screen data-[vaul-drawer-direction=right]:max-w-none',
  'sm:h-full sm:data-[vaul-drawer-direction=right]:w-full sm:data-[vaul-drawer-direction=right]:max-w-md sm:p-2',
);

const DRAWER_PANEL_CLASS = cn(
  'flex h-full min-h-0 flex-col overflow-hidden bg-white',
  'sm:rounded-4xl sm:border sm:border-slate-200/70 sm:shadow-xl',
);

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
            <HiClipboardDocumentCheck className="w-4 h-4 text-blue-600 shrink-0" />
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
  onSelectTask?: (task: TeacherTeachingReflectionTask) => void;
}) {
  return (
    <section>
      {showSectionHeader && (
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <HiAcademicCap className="w-4 h-4 text-blue-600 shrink-0" />
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
  const queryClient = useQueryClient();
  const { user, userData } = useAuth();
  const { activeYear, activeSemester } = useActiveAcademicYear();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedReflection, setSelectedReflection] = useState<TeacherTeachingReflectionTask | null>(null);
  const [planStatus, setPlanStatus] = useState<TeachingPlanStatus>('on_plan');
  const [overview, setOverview] = useState<TeachingOverview>(3);
  const [notes, setNotes] = useState('');
  const [problemStudents, setProblemStudents] = useState<TeachingReflectionStudent[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        queryClient.invalidateQueries({ queryKey: ['microSyllabus'] });
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [queryClient]);

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
    syllabi,
    createSyllabus,
    updateTopics,
  } = useTeacherDailyTasks();

  const openReflectionForm = (task: TeacherTeachingReflectionTask) => {
    const syllabus = syllabi.find(
      (s) =>
        s.classId === task.classId
        && (s.subjectId === task.subjectId || s.subjectName === task.subjectName),
    );
    const existing = syllabus?.topics.find((t) => t.date === today)?.teachingReflection;
    setPlanStatus(existing?.planStatus ?? 'on_plan');
    setOverview(normalizeTeachingOverview(existing?.overview));
    setNotes(existing?.additionalRequest ?? '');
    setProblemStudents(existing?.problemStudents ?? []);
    setSelectedReflection(task);
  };

  const closeReflectionForm = () => {
    if (saving) return;
    setSelectedReflection(null);
  };

  const handleSaveReflection = async () => {
    if (!selectedReflection || !user?.uid || !activeYear || !activeSemester) return;
    setSaving(true);
    try {
      let syllabus = syllabi.find(
        (s) =>
          s.classId === selectedReflection.classId
          && (s.subjectId === selectedReflection.subjectId
            || s.subjectName === selectedReflection.subjectName),
      );

      if (!syllabus) {
        const departmentId =
          (userData as { departmentId?: string } | null)?.departmentId ?? 'secondary';
        const displayName =
          (userData as { displayName?: string; firstName?: string } | null)?.displayName
          || (userData as { firstName?: string } | null)?.firstName
          || user.displayName
          || 'ครู';
        const gradeLevel = selectedReflection.className.split('/')[0]?.trim() || '';
        const newId = await createSyllabus({
          academicYearId: activeYear.year,
          semester: activeSemester as 1 | 2,
          departmentId,
          teacherId: user.uid,
          teacherName: displayName,
          subjectId: selectedReflection.subjectId,
          subjectName: selectedReflection.subjectName,
          classId: selectedReflection.classId,
          className: selectedReflection.className,
          gradeLevel,
          totalWeeks: 20,
          topics: [],
        });
        syllabus = {
          id: newId,
          academicYearId: activeYear.year,
          semester: activeSemester as 1 | 2,
          departmentId,
          teacherId: user.uid,
          teacherName: displayName,
          subjectId: selectedReflection.subjectId,
          subjectName: selectedReflection.subjectName,
          classId: selectedReflection.classId,
          className: selectedReflection.className,
          gradeLevel,
          totalWeeks: 20,
          topics: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      }

      const dateIso = getLocalDateString();
      const topicIndex = syllabus.topics.findIndex((t) => t.date === dateIso);
      const reflection = {
        planStatus,
        overview,
        problemStudents: problemStudents.length > 0 ? problemStudents : undefined,
        additionalRequest: notes.trim() || undefined,
        recordedAt: new Date().toISOString(),
      };
      const updatedTopics = [...syllabus.topics];

      if (topicIndex >= 0) {
        updatedTopics[topicIndex] = {
          ...updatedTopics[topicIndex],
          teachingReflection: reflection,
          completedAt: new Date().toISOString(),
        };
      } else {
        updatedTopics.push({
          weekNumber: Math.max(1, updatedTopics.length + 1),
          date: dateIso,
          title: 'บันทึกหลังการสอน',
          teachingReflection: reflection,
          completedAt: new Date().toISOString(),
        } as WeeklyTopic);
      }

      await updateTopics(syllabus.id, updatedTopics);
      toast.success('บันทึกหลังการสอนเรียบร้อย');
      setSelectedReflection(null);
    } catch {
      toast.error('บันทึกหลังการสอนไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
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
          <div className={DRAWER_PANEL_CLASS}>
          <DrawerHeader className="shrink-0 px-4 pt-4 pb-3 border-b border-slate-100">
            <div className="relative flex items-center justify-center min-h-10">
              <div className="min-w-0 flex-1 text-left pr-12">
                <DrawerTitle className="text-base font-black text-slate-800 truncate">
                  งานประจำวันครู
                </DrawerTitle>
                <DrawerDescription className="text-[11px] font-bold text-slate-400 truncate">
                  {todayLabel}
                </DrawerDescription>
              </div>
              <div className={DRAWER_HEADER_RIGHT_ACTIONS}>
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  className={DRAWER_HEADER_ICON_BTN}
                  aria-label="ปิด"
                >
                  <HiXMark className="w-4 h-4" />
                </button>
              </div>
            </div>
          </DrawerHeader>

          <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-5">
            <section>
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <HiUsers className="w-4 h-4 text-blue-600 shrink-0" />
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
              onSelectTask={openReflectionForm}
            />

            {!isBlocked && allDone && (hasHomeroom || hasClassesToday || hasReflectionTasksToday) && (
              <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50/90 px-3 py-3">
                <HiCheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
                <p className="text-[11px] font-black text-emerald-700">งานประจำวันครบแล้ว</p>
              </div>
            )}
          </div>
          </div>
        </DrawerContent>
      </Drawer>

      <Drawer open={!!selectedReflection} onOpenChange={(open) => !open && closeReflectionForm()} direction="right">
        <DrawerContent className={cn(DRAWER_CONTENT_CLASS, 'font-sukhumvit')}>
          <div className={DRAWER_PANEL_CLASS}>
          <DrawerHeader className="shrink-0 px-4 pt-4 pb-3 border-b border-slate-100 text-left">
            <div className="relative flex items-center justify-center min-h-10">
              <div className="min-w-0 flex-1 text-left pr-12">
                <DrawerTitle className="text-base font-black text-slate-800 truncate">
                  บันทึกหลังการสอน
                </DrawerTitle>
                <DrawerDescription className="text-[11px] font-bold text-slate-400 truncate">
                  {selectedReflection
                    ? `${selectedReflection.subjectName} · ${selectedReflection.className}`
                    : todayLabel}
                </DrawerDescription>
              </div>
              <div className={DRAWER_HEADER_RIGHT_ACTIONS}>
                <button
                  type="button"
                  onClick={closeReflectionForm}
                  className={DRAWER_HEADER_ICON_BTN}
                  aria-label="ปิด"
                >
                  <HiXMark className="w-4 h-4" />
                </button>
              </div>
            </div>
          </DrawerHeader>

          <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-4">
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-black text-slate-600 mb-1">แผนการสอน</label>
                <select
                  value={planStatus}
                  onChange={(e) => setPlanStatus(e.target.value as TeachingPlanStatus)}
                  className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-[12px] font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/30"
                >
                  <option value="on_plan">ตามแผน</option>
                  <option value="off_plan">เบี่ยงเบน</option>
                </select>
              </div>
              <TeachingStarRating value={overview} onChange={setOverview} />
            </div>

            <div>
              <label className="block text-[11px] font-black text-slate-600 mb-1">หมายเหตุเพิ่มเติม</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="ป้อนหมายเหตุ หากนักเรียนมีปัญหา ข้อเสนอแนะ ฯลฯ"
                className="w-full h-28 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[12px] font-sarabun text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/30 resize-none"
              />
            </div>

            <ProblemStudentPicker
              classId={selectedReflection?.classId}
              enabled={!!selectedReflection}
              value={problemStudents}
              onChange={setProblemStudents}
            />
          </div>

          <DrawerFooter className="shrink-0 flex-row gap-2 border-t border-slate-100">
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleSaveReflection()}
              className="h-11 flex-1 rounded-xl bg-blue-600 text-[13px] font-black text-white shadow-md transition-colors hover:bg-blue-700 disabled:opacity-60 flex items-center justify-center gap-2"
            >
              <HiCheck className="h-4 w-4" />
              {saving ? 'กำลังบันทึก...' : 'บันทึก'}
            </button>
          </DrawerFooter>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
