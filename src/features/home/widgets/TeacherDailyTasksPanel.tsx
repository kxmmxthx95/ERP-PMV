import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  HiAcademicCap,
  HiArrowLeft,
  HiCheck,
  HiClipboardDocumentCheck,
  HiClock,
  HiPencilSquare,
  HiUsers,
  HiXMark,
} from 'react-icons/hi2';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useAuth } from '@/hooks/useAuth';
import { useActiveAcademicYear } from '@/hooks/useActiveAcademicYear';
import { useIsSchoolDayToday } from '@/hooks/useIsSchoolDayToday';
import { useStudentLeaveRequests } from '@/hooks/useLeaveRequests';
import { buildClassSessionDocId } from '@/lib/classSessionDocId';
import {
  useTodayMorningRollCall,
  useSaveMorningRollCall,
} from '@/hooks/useMorningRollCall';
import { useMorningRollCallClassStudents } from '@/hooks/useMorningRollCallClassStudents';
import {
  useTeacherDailyTasks,
  type TeacherClassAttendanceTask,
  type TeacherDailyTaskStatus,
  type TeacherRollCallTask,
  type TeacherTeachingReflectionTask,
} from '@/hooks/useTeacherDailyTasks';
import { DEFAULT_SETTINGS, useScheduleSettings } from '@/hooks/useScheduleSettings';
import { ROLL_CALL_OPTIONS, type MarkableRollCallStatus } from '@/features/attendance/rollCallUi';
import { ProblemStudentPicker } from '@/features/microSyllabus/components/ProblemStudentPicker';
import { TeachingStarRating } from '@/features/microSyllabus/components/TeachingStarRating';
import {
  applyApprovedLeaveToClassAttendanceRows,
  applyApprovedLeaveToMorningRollCallRows,
  findApprovedLeaveForStudentOnDate,
} from '@/lib/attendance/leaveRequestStudentMatch';
import { DRAWER_HEADER_ICON_BTN, DRAWER_HEADER_RIGHT_ACTIONS } from '@/lib/drawerHeaderBtn';
import { db } from '@/lib/firebase';
import { cn } from '@/lib/utils';
import { formatThaiDateLabelFromIso, getLocalDateString } from '@/lib/dateUtils';
import type { RollCallStatus, StudentRollCall } from '@/types/morningRollCall';
import type {
  TeachingOverview,
  TeachingPlanStatus,
  TeachingReflectionStudent,
  WeeklyTopic,
} from '@/types/microSyllabus';
import { normalizeTeachingOverview } from '@/types/microSyllabus';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';

export const TEACHER_DAILY_DRAWER_CONTENT_CLASS = cn(
  'flex h-dvh flex-col bg-transparent p-0 before:hidden',
  'data-[vaul-drawer-direction=right]:w-screen data-[vaul-drawer-direction=right]:max-w-none',
  'sm:h-full sm:data-[vaul-drawer-direction=right]:w-full sm:data-[vaul-drawer-direction=right]:max-w-md sm:p-2',
);

export const TEACHER_DAILY_DRAWER_PANEL_CLASS = cn(
  'flex h-full min-h-0 flex-col overflow-hidden bg-white',
  'sm:rounded-4xl sm:border sm:border-slate-200/70 sm:shadow-xl',
);

type AttendanceStatus = 'present' | 'late' | 'absent' | 'leave';

type AttendanceStudentRow = {
  id: string;
  code: string;
  name: string;
  status: AttendanceStatus | null;
};

type RollCallRow = StudentRollCall & { enrollmentIndex: number };

const ATTENDANCE_OPTIONS: {
  value: AttendanceStatus;
  label: string;
  className: string;
  activeClassName: string;
  cardClassName: string;
  badgeClassName: string;
}[] = [
  {
    value: 'present',
    label: 'มา',
    className: 'border-emerald-200 text-emerald-600 bg-white',
    activeClassName: 'border-emerald-500 bg-emerald-500 text-white',
    cardClassName: 'bg-emerald-50/90 border-emerald-200',
    badgeClassName: 'bg-emerald-100 text-emerald-700',
  },
  {
    value: 'late',
    label: 'สาย',
    className: 'border-amber-200 text-amber-700 bg-white',
    activeClassName: 'border-amber-500 bg-amber-500 text-white',
    cardClassName: 'bg-amber-50/90 border-amber-200',
    badgeClassName: 'bg-amber-100 text-amber-700',
  },
  {
    value: 'absent',
    label: 'ขาด',
    className: 'border-rose-200 text-rose-700 bg-white',
    activeClassName: 'border-rose-500 bg-rose-500 text-white',
    cardClassName: 'bg-rose-50/90 border-rose-200',
    badgeClassName: 'bg-rose-100 text-rose-700',
  },
  {
    value: 'leave',
    label: 'ลา',
    className: 'border-blue-200 text-blue-700 bg-white',
    activeClassName: 'border-blue-500 bg-blue-500 text-white',
    cardClassName: 'bg-blue-50/90 border-blue-200',
    badgeClassName: 'bg-blue-100 text-blue-700',
  },
];

/** "1" หรือ "1-2" เมื่อเป็นคาบติดกันที่ถูกรวมเป็น task เดียว */
const formatPeriodLabel = (periods: number[]): string =>
  periods.length > 1 ? `${periods[0]}-${periods[periods.length - 1]}` : String(periods[0]);

/** Same upcoming gate as TodayScheduleWidget — block check-in before period starts. */
function getPeriodSessionStatus(
  period: number,
  periodTimes: Record<string | number, string> | undefined,
  periodCount = DEFAULT_SETTINGS.periodCount,
): { startTime: string; isUpcoming: boolean } {
  const times = periodTimes || DEFAULT_SETTINGS.periodTimes;
  let timeRange = times[String(period)] || (times as Record<number, string>)[period];

  if (!timeRange && period > periodCount) {
    let lastEndMin = 480;
    for (let i = 1; i <= periodCount; i++) {
      const t = times[String(i)];
      if (t && t.includes(' - ')) {
        const parts = t.split(' - ')[1].split(':');
        lastEndMin = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
      }
    }
    const startMin = lastEndMin + (period - periodCount - 1) * 50;
    const endMin = startMin + 50;
    timeRange = `${String(Math.floor(startMin / 60)).padStart(2, '0')}:${String(startMin % 60).padStart(2, '0')} - ${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`;
  }

  if (!timeRange || !timeRange.includes(' - ')) {
    return { startTime: '--:--', isUpcoming: false };
  }

  const [startStr] = timeRange.split(' - ');
  const [sH, sM] = startStr.split(':').map(Number);
  if (Number.isNaN(sH) || Number.isNaN(sM)) {
    return { startTime: '--:--', isUpcoming: false };
  }
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  return {
    startTime: startStr,
    isUpcoming: nowMin < sH * 60 + sM,
  };
}

function TaskBadge({ status }: { status: TeacherDailyTaskStatus }) {
  if (status === 'covered') {
    return (
      <span className="text-[10px] font-black px-2 py-0.5 rounded-lg bg-indigo-100 text-indigo-700 shrink-0">
        มีครูแทนแล้ว
      </span>
    );
  }
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

export function RollCallTaskList({
  hasHomeroom,
  rollCallStats,
  rollCallTasks,
  showSectionHeader = true,
  onSelectTask,
}: {
  hasHomeroom: boolean;
  rollCallStats: { done: number; total: number };
  rollCallTasks: ReturnType<typeof useTeacherDailyTasks>['rollCallTasks'];
  showSectionHeader?: boolean;
  onSelectTask?: (task: ReturnType<typeof useTeacherDailyTasks>['rollCallTasks'][number]) => void;
}) {
  return (
    <section>
      {showSectionHeader && (
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <HiUsers className="w-4 h-4 text-blue-600 shrink-0" />
            <h3 className="text-sm font-black text-slate-800 truncate">เช็คชื่อเข้าแถว</h3>
          </div>
          {rollCallTasks.length > 0 && (
            <span className="text-[10px] font-black text-slate-400 shrink-0">
              {rollCallStats.done}/{rollCallStats.total}
            </span>
          )}
        </div>
      )}

      {rollCallTasks.length === 0 ? (
        <p className="text-[11px] font-bold text-slate-400 rounded-xl border border-dashed border-slate-200 px-3 py-3">
          {hasHomeroom ? 'ไม่มีรายการเช็คชื่อเข้าแถววันนี้' : 'ไม่ได้รับผิดชอบห้องประจำชั้น'}
        </p>
      ) : (
        <div className="space-y-2">
          {rollCallTasks.map((task) => {
            const clickable = !!onSelectTask;
            const Wrapper = clickable ? 'button' : 'div';
            return (
              <Wrapper
                key={task.classId}
                type={clickable ? 'button' : undefined}
                onClick={clickable ? () => onSelectTask!(task) : undefined}
                className={`w-full text-left rounded-2xl border p-3 transition-colors ${
                  task.status === 'covered'
                    ? 'bg-indigo-50/90 border-indigo-200'
                    : task.status === 'done'
                      ? 'bg-emerald-50/90 border-emerald-200'
                      : 'bg-white border-slate-200'
                } ${clickable ? 'active:scale-[0.99] hover:border-sky-300' : ''}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[13px] font-black text-slate-800 truncate">{task.className}</p>
                  <TaskBadge status={task.status} />
                </div>
                {task.isSubstitute && (
                  <p className="text-[10px] font-bold text-indigo-500 mt-1">
                    เช็คชื่อเข้าแถวแทนให้ครู{task.coveredByTeacherName}
                  </p>
                )}
                {task.status === 'covered' && task.coveredByTeacherName && (
                  <p className="text-[10px] font-bold text-indigo-500 mt-1">
                    ครู{task.coveredByTeacherName}เช็คชื่อแทนแล้ว
                  </p>
                )}
                {task.session && (
                  <p className="text-[10px] font-bold text-slate-500 mt-1">
                    มา {task.session.summary.present} · ขาด {task.session.summary.absent} · สาย{' '}
                    {task.session.summary.late} · ลา {task.session.summary.leave}
                  </p>
                )}
              </Wrapper>
            );
          })}
        </div>
      )}
    </section>
  );
}

export function ClassAttendanceTaskList({
  hasClassesToday,
  classStats,
  classAttendanceTasks,
  showSectionHeader = true,
  onSelectTask,
}: {
  hasClassesToday: boolean;
  classStats: { done: number; total: number };
  classAttendanceTasks: ReturnType<typeof useTeacherDailyTasks>['classAttendanceTasks'];
  showSectionHeader?: boolean;
  onSelectTask?: (task: ReturnType<typeof useTeacherDailyTasks>['classAttendanceTasks'][number]) => void;
}) {
  return (
    <section>
      {showSectionHeader && (
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <HiClipboardDocumentCheck className="w-4 h-4 text-blue-600 shrink-0" />
            <h3 className="text-sm font-black text-slate-800 truncate">เช็คชื่อเข้าเรียน</h3>
          </div>
          {classAttendanceTasks.length > 0 && (
            <span className="text-[10px] font-black text-slate-400 shrink-0">
              {classStats.done}/{classStats.total}
            </span>
          )}
        </div>
      )}

      {classAttendanceTasks.length === 0 ? (
        <p className="text-[11px] font-bold text-slate-400 rounded-xl border border-dashed border-slate-200 px-3 py-3">
          {hasClassesToday ? 'ไม่มีรายการเช็คชื่อเข้าเรียนวันนี้' : 'วันนี้ไม่มีคาบสอนตามตาราง'}
        </p>
      ) : (
        <div className="space-y-2">
          {classAttendanceTasks.map((task) => {
            const clickable = task.status !== 'not_applicable' && !!onSelectTask;
            const Wrapper = clickable ? 'button' : 'div';
            return (
              <Wrapper
                key={task.entryId}
                type={clickable ? 'button' : undefined}
                onClick={clickable ? () => onSelectTask!(task) : undefined}
                className={`w-full text-left rounded-2xl border p-3 transition-colors ${
                  task.status === 'covered'
                    ? 'bg-indigo-50/90 border-indigo-200'
                    : task.status === 'done'
                      ? 'bg-emerald-50/90 border-emerald-200'
                      : task.status === 'not_applicable'
                        ? 'bg-slate-50 border-slate-200'
                        : 'bg-white border-slate-200'
                } ${clickable ? 'active:scale-[0.99] hover:border-sky-300' : ''}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[13px] font-black text-slate-800 truncate">
                      คาบ {formatPeriodLabel(task.periods)} · {task.subjectName}
                    </p>
                    <p className="text-[10px] font-bold text-slate-500 truncate mt-0.5">
                      {task.className}
                    </p>
                    {task.isSubstitute && (
                      <p className="text-[10px] font-bold text-indigo-500 truncate mt-0.5">
                        สอนแทนให้ครู{task.coveredByTeacherName}
                      </p>
                    )}
                    {task.status === 'covered' && task.coveredByTeacherName && (
                      <p className="text-[10px] font-bold text-indigo-500 truncate mt-0.5">
                        ครู{task.coveredByTeacherName}สอนแทนแล้ว
                      </p>
                    )}
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

export function TeachingReflectionTaskList({
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


function RollCallTaskDrawer({
  task,
  onClose,
}: {
  task: TeacherRollCallTask | null;
  onClose: () => void;
}) {
  const { user, userData } = useAuth();
  const { year, activeSemester } = useActiveAcademicYear();
  const queryClient = useQueryClient();
  const open = !!task;
  const classId = task?.classId ?? null;
  const today = useMemo(() => getLocalDateString(), []);
  const { requests: leaveRequests } = useStudentLeaveRequests(today);
  const { students: classStudents, loadingRoster } = useMorningRollCallClassStudents(
    year ?? undefined,
    classId,
    activeSemester as 1 | 2,
  );
  const { data: existingSession, isLoading: loadingSession } = useTodayMorningRollCall(classId);
  const { mutate: saveRollCall, isPending: isSaving } = useSaveMorningRollCall();
  const [rows, setRows] = useState<RollCallRow[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [allPresentSnapshot, setAllPresentSnapshot] = useState<RollCallRow[] | null>(null);

  const isReadOnly = !!existingSession && !editMode;

  useEffect(() => {
    if (!open) {
      setRows([]);
      setEditMode(false);
      setAllPresentSnapshot(null);
    }
  }, [open]);

  useEffect(() => {
    if (!classId || loadingSession || loadingRoster) return;

    if (existingSession && !editMode) {
      setRows(existingSession.attendance.map((a, idx) => ({ ...a, enrollmentIndex: idx })));
      return;
    }

    const base: RollCallRow[] = classStudents
      .map((student, idx) => {
        const studentName =
          `${student.prefix || ''}${student.firstName || ''} ${student.lastName || ''}`.trim() ||
          student.id;
        const fromSession = existingSession?.attendance.find((a) => a.studentId === student.id);
        return {
          studentId: student.id,
          studentName,
          studentCode: student.studentCode || '-',
          status: (fromSession?.status as RollCallStatus) || 'unmarked',
          note: fromSession?.note || '',
          enrollmentIndex: idx,
          photoURL: student.photoURL,
          gender: student.gender as 'male' | 'female' | undefined,
        };
      })
      .sort((a, b) => a.studentCode.localeCompare(b.studentCode, undefined, { numeric: true }));

    setRows(applyApprovedLeaveToMorningRollCallRows(base, classStudents, leaveRequests, today));
  }, [classId, existingSession, editMode, loadingSession, loadingRoster, classStudents, leaveRequests, today]);

  const rowsToUse = useMemo(
    () => applyApprovedLeaveToMorningRollCallRows(rows, classStudents, leaveRequests, today),
    [rows, classStudents, leaveRequests, today],
  );

  const setStudentStatus = (studentId: string, status: MarkableRollCallStatus) => {
    if (isReadOnly) return;
    setRows((prev) =>
      prev.map((row) =>
        row.studentId === studentId
          ? { ...row, status: row.status === status ? 'unmarked' : status }
          : row,
      ),
    );
    setAllPresentSnapshot(null);
  };

  const handleToggleAll = () => {
    if (isReadOnly) return;
    if (allPresentSnapshot) {
      setRows(allPresentSnapshot);
      setAllPresentSnapshot(null);
      return;
    }
    setAllPresentSnapshot(rowsToUse);
    setRows((prev) =>
      prev.map((row) => (row.status === 'leave' ? row : { ...row, status: 'present' as RollCallStatus })),
    );
  };

  const handleSave = () => {
    if (!task || !year || activeSemester == null) return;
    if (existingSession && !editMode) {
      setEditMode(true);
      return;
    }
    if (rowsToUse.some((r) => r.status === 'unmarked')) {
      toast.error('กรุณาเช็คชื่อให้ครบทุกคน');
      return;
    }
    saveRollCall(
      {
        date: today,
        classId: task.classId,
        className: task.className,
        departmentId: '',
        academicYearId: year,
        semester: activeSemester as 1 | 2,
        recordedBy: user?.uid || '',
        recordedByName: userData?.displayName || userData?.name || '',
        attendance: rowsToUse,
      },
      {
        onSuccess: (saved) => {
          queryClient.setQueryData(['morningRollCall', task.classId, today], saved);
          void queryClient.invalidateQueries({ queryKey: ['morningRollCallSessions'] });
          setEditMode(false);
          setAllPresentSnapshot(null);
          toast.success('บันทึกเช็คชื่อเข้าแถวแล้ว');
          onClose();
        },
        onError: () => toast.error('บันทึกไม่สำเร็จ'),
      },
    );
  };

  return (
    <Drawer open={open} onOpenChange={(next) => !next && onClose()} direction="right">
      <DrawerContent className={TEACHER_DAILY_DRAWER_CONTENT_CLASS}>
        <div className={TEACHER_DAILY_DRAWER_PANEL_CLASS}>
          <DrawerHeader className="shrink-0 px-4 pb-2 pt-4">
            <div className="relative flex min-h-10 items-center justify-center">
              {rowsToUse.length > 0 && !isReadOnly && (
                <label className="absolute left-0 top-1/2 -translate-y-1/2 inline-flex cursor-pointer select-none items-center gap-2">
                  <input
                    type="checkbox"
                    checked={allPresentSnapshot !== null}
                    onChange={handleToggleAll}
                    className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-[11px] font-black text-slate-700">เช็กทั้งหมด</span>
                </label>
              )}
              {isReadOnly && (
                <button
                  type="button"
                  onClick={() => setEditMode(true)}
                  className="absolute left-0 top-1/2 -translate-y-1/2 inline-flex items-center gap-1.5 text-[11px] font-black text-blue-600"
                >
                  <HiPencilSquare className="h-4 w-4" />
                  แก้ไข
                </button>
              )}
              <div className="min-w-0 px-12 text-center">
                <DrawerTitle className="text-base font-black text-slate-800">เช็คชื่อเข้าแถว</DrawerTitle>
                <DrawerDescription className="truncate text-xs text-slate-500">
                  {task?.className}
                </DrawerDescription>
              </div>
              <div className={DRAWER_HEADER_RIGHT_ACTIONS}>
                <button type="button" onClick={onClose} className={DRAWER_HEADER_ICON_BTN} aria-label="ปิด">
                  <HiXMark className="h-4 w-4" />
                </button>
              </div>
            </div>
          </DrawerHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
            {(loadingSession || loadingRoster) && rowsToUse.length === 0 ? (
              <p className="py-10 text-center text-sm font-semibold text-slate-500">กำลังโหลดรายชื่อ...</p>
            ) : rowsToUse.length === 0 ? (
              <p className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center text-xs font-semibold text-slate-500">
                ไม่พบรายชื่อนักเรียนในห้องนี้
              </p>
            ) : (
              <div className="flex flex-col gap-2.5">
                {rowsToUse.map((student) => {
                  const statusOption =
                    student.status !== 'unmarked'
                      ? ROLL_CALL_OPTIONS.find((opt) => opt.value === student.status)
                      : null;
                  return (
                    <div
                      key={student.studentId}
                      className={cn(
                        'rounded-2xl border p-3 transition-colors',
                        statusOption?.cardClassName ?? 'border-slate-200 bg-white',
                      )}
                    >
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-black text-slate-800">{student.studentName}</p>
                          <p className="text-[11px] font-bold text-slate-400">{student.studentCode}</p>
                        </div>
                        <span
                          className={cn(
                            'rounded-lg px-2 py-1 text-[10px] font-black',
                            statusOption?.badgeClassName ?? 'bg-slate-100 text-slate-500',
                          )}
                        >
                          {statusOption?.label ?? 'ยังไม่เช็ก'}
                        </span>
                      </div>
                      <div className="grid grid-cols-4 gap-1.5">
                        {ROLL_CALL_OPTIONS.map((opt) => {
                          const isActive = student.status === opt.value;
                          return (
                            <button
                              key={opt.value}
                              type="button"
                              disabled={isReadOnly}
                              onClick={() => setStudentStatus(student.studentId, opt.value)}
                              className={cn(
                                'h-9 rounded-lg border text-[11px] font-black transition active:scale-[0.98]',
                                isActive ? opt.activeClassName : opt.className,
                                isReadOnly && 'cursor-not-allowed opacity-60',
                              )}
                            >
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {rowsToUse.length > 0 && (
            <div className="shrink-0 border-t border-slate-100 bg-white px-4 pb-4 pt-2">
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className={cn(
                  'h-11 w-full rounded-xl text-sm font-black transition active:scale-[0.99] disabled:opacity-60',
                  existingSession && !editMode
                    ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                    : 'bg-slate-900 text-white hover:bg-slate-800',
                )}
              >
                {isSaving
                  ? 'กำลังบันทึก...'
                  : existingSession && !editMode
                    ? 'เช็คชื่อแล้ว · แตะเพื่อแก้ไข'
                    : 'บันทึกเช็คชื่อ'}
              </button>
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

function ClassAttendanceTaskDrawer({
  task,
  today,
  onClose,
}: {
  task: TeacherClassAttendanceTask | null;
  today: string;
  onClose: () => void;
}) {
  const { user, userData } = useAuth();
  const { year: activeYear, activeSemester } = useActiveAcademicYear();
  const queryClient = useQueryClient();
  const open = !!task;
  const { periodTimes, periodCount } = useScheduleSettings(task?.classId);
  const periodStatus = task
    ? getPeriodSessionStatus(task.period, periodTimes, periodCount)
    : { startTime: '--:--', isUpcoming: false };
  const isUpcoming = periodStatus.isUpcoming;
  const { requests: leaveRequests } = useStudentLeaveRequests(today);
  // roster เดียวกับ RollCallTaskDrawer — มี fallback (classDoc.studentIds → ทั้งโรงเรียน) แทน
  // query enrollments ตรงๆ ด้วย classId เท่านั้น (เดิมเจอเคสห้องเรียนที่สอนแทนหา enrollment
  // ไม่เจอเพราะ field ไม่ตรง ค้างที่ "ไม่พบรายชื่อนักเรียนในห้องนี้" — เกิดกับคาบของครูเจ้าของวิชาเองได้เหมือนกัน)
  const { students: classStudents, loadingRoster } = useMorningRollCallClassStudents(
    activeYear ?? undefined,
    task?.classId ?? null,
    activeSemester as 1 | 2,
  );
  const [rows, setRows] = useState<AttendanceStudentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [locked, setLocked] = useState(false);
  const [allPresentSnapshot, setAllPresentSnapshot] = useState<AttendanceStudentRow[] | null>(null);

  useEffect(() => {
    if (!task) {
      setRows([]);
      setLocked(false);
      setAllPresentSnapshot(null);
      return;
    }

    if (isUpcoming) {
      setRows([]);
      setLocked(false);
      setAllPresentSnapshot(null);
      setLoading(false);
      return;
    }

    if (loadingRoster) {
      setLoading(true);
      return;
    }

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        // คาบติดกันถูกรวมเป็น task เดียว — เช็คทุก session doc ของแต่ละคาบ (เผื่อเคยเช็คแยกคาบไว้ก่อนหน้า)
        const sessionSnaps = await Promise.all(
          task.periods.map((period) =>
            getDoc(doc(db, 'class_sessions', buildClassSessionDocId(today, task.classId, task.subjectId, period))),
          ),
        );
        const statusMap = new Map<string, AttendanceStatus>();
        let hasSaved = false;
        sessionSnaps.forEach((sessionSnap) => {
          if (!sessionSnap.exists()) return;
          hasSaved = true;
          const attendance = (sessionSnap.data().attendance || []) as Array<{
            studentId: string;
            status: AttendanceStatus;
          }>;
          attendance.forEach((row) => {
            if (row?.studentId && row?.status) statusMap.set(row.studentId, row.status);
          });
        });

        const built: AttendanceStudentRow[] = classStudents
          .map((data) => ({
            id: data.id,
            code: data.studentCode || '-',
            name: `${data.prefix || ''}${data.firstName || ''} ${data.lastName || ''}`.trim() || data.id,
            status: statusMap.get(data.id) ?? null,
          }))
          .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));

        const studentDetails = new Map(
          classStudents.map((data) => [
            data.id,
            {
              id: data.id,
              studentCode: data.studentCode,
              prefix: data.prefix,
              firstName: data.firstName,
              lastName: data.lastName,
            },
          ]),
        );
        const withLeave = applyApprovedLeaveToClassAttendanceRows(
          built,
          studentDetails,
          leaveRequests,
          today,
        );
        if (!cancelled) {
          setRows(withLeave);
          setLocked(hasSaved);
          setAllPresentSnapshot(null);
        }
      } catch {
        if (!cancelled) {
          setRows([]);
          setLocked(false);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [task, today, leaveRequests, isUpcoming, loadingRoster, classStudents]);

  const setStudentStatus = (studentId: string, status: AttendanceStatus) => {
    if (locked || isUpcoming) return;
    const row = rows.find((r) => r.id === studentId);
    if (!row) return;
    const nextStatus = row.status === status ? null : status;
    if (nextStatus === 'leave') {
      const approved = findApprovedLeaveForStudentOnDate(
        leaveRequests,
        { id: studentId, studentCode: row.code },
        today,
        row.name,
      );
      if (!approved) return;
    }
    setRows((prev) => prev.map((r) => (r.id === studentId ? { ...r, status: nextStatus } : r)));
    setAllPresentSnapshot(null);
  };

  const handleToggleAll = () => {
    if (locked || isUpcoming) return;
    if (allPresentSnapshot) {
      setRows(allPresentSnapshot);
      setAllPresentSnapshot(null);
      return;
    }
    setAllPresentSnapshot(rows);
    setRows((prev) => prev.map((row) => (row.status === 'leave' ? row : { ...row, status: 'present' })));
  };

  const handleSave = async () => {
    if (!task || rows.length === 0 || isUpcoming) return;
    if (rows.some((r) => r.status === null)) {
      toast.error('กรุณาเช็คชื่อให้ครบทุกคน');
      return;
    }
    setSaving(true);
    try {
      const checked = rows.filter(
        (r): r is AttendanceStudentRow & { status: AttendanceStatus } => r.status !== null,
      );
      const presentStudentIds = checked.filter((r) => r.status === 'present').map((r) => r.id);
      const lateStudentIds = checked.filter((r) => r.status === 'late').map((r) => r.id);
      const absentStudentIds = checked.filter((r) => r.status === 'absent').map((r) => r.id);
      const leaveStudentIds = checked.filter((r) => r.status === 'leave').map((r) => r.id);
      const recordedAt = new Date().toISOString();

      // คาบติดกันถูกรวมเป็น task เดียว — เช็คครั้งเดียวบันทึก session doc ให้ทุกคาบที่รวมไว้
      await Promise.all(
        task.periods.map((period) =>
          setDoc(
            doc(db, 'class_sessions', buildClassSessionDocId(today, task.classId, task.subjectId, period)),
            {
              scheduleId: task.entryId || `${today}_${task.classId}_${task.subjectId}_${period}`,
              subjectId: task.subjectId,
              subjectName: task.subjectName,
              subjectCode: task.subjectId,
              classId: task.classId,
              className: task.className,
              teacherId: user?.uid || '',
              teacherName: userData?.displayName || userData?.name || '',
              departmentId: 'secondary',
              academicYearId: String(activeYear || ''),
              semester: (activeSemester || 1) as 1 | 2,
              date: today,
              period,
              topic: '',
              summary: {
                present: presentStudentIds.length,
                late: lateStudentIds.length,
                absent: absentStudentIds.length,
                leave: leaveStudentIds.length,
              },
              attendance: checked.map((r) => ({ studentId: r.id, status: r.status, note: '' })),
              presentStudentIds,
              absentStudentIds,
              lateStudentIds,
              leaveStudentIds,
              totalStudents: rows.length,
              // เคลียร์ flag จาก sync ใบลา — ไม่เช่นนั้น badge ค้าง «รอทำ»
              leaveSyncOnly: false,
              updatedAt: recordedAt,
              createdAt: recordedAt,
            },
            { merge: true },
          ),
        ),
      );

      setLocked(true);
      setAllPresentSnapshot(null);
      void queryClient.invalidateQueries({ queryKey: ['todayClassSessions'] });
      toast.success('บันทึกเช็คชื่อเข้าเรียนแล้ว');
      onClose();
    } catch {
      toast.error('บันทึกไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={(next) => !next && onClose()} direction="right">
      <DrawerContent className={TEACHER_DAILY_DRAWER_CONTENT_CLASS}>
        <div className={TEACHER_DAILY_DRAWER_PANEL_CLASS}>
          <DrawerHeader className="shrink-0 px-4 pb-2 pt-4">
            <div className="relative flex min-h-10 items-center justify-center">
              {rows.length > 0 && !locked && !isUpcoming && (
                <label className="absolute left-0 top-1/2 -translate-y-1/2 inline-flex cursor-pointer select-none items-center gap-2">
                  <input
                    type="checkbox"
                    checked={allPresentSnapshot !== null}
                    onChange={handleToggleAll}
                    className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-[11px] font-black text-slate-700">เช็กทั้งหมด</span>
                </label>
              )}
              {locked && !isUpcoming && (
                <button
                  type="button"
                  onClick={() => setLocked(false)}
                  className="absolute left-0 top-1/2 -translate-y-1/2 inline-flex items-center gap-1.5 text-[11px] font-black text-blue-600"
                >
                  <HiPencilSquare className="h-4 w-4" />
                  แก้ไข
                </button>
              )}
              <div className="min-w-0 px-12 text-center">
                <DrawerTitle className="text-base font-black text-slate-800">
                  เช็คชื่อคาบที่ {task ? formatPeriodLabel(task.periods) : ''}
                </DrawerTitle>
                <DrawerDescription className="truncate text-xs text-slate-500">
                  {task ? `${task.subjectName} · ${task.className}` : ''}
                </DrawerDescription>
              </div>
              <div className={DRAWER_HEADER_RIGHT_ACTIONS}>
                <button type="button" onClick={onClose} className={DRAWER_HEADER_ICON_BTN} aria-label="ปิด">
                  <HiArrowLeft className="h-4 w-4" />
                </button>
              </div>
            </div>
          </DrawerHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
            {isUpcoming ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 px-6 py-10 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full border border-amber-100 bg-amber-50">
                  <HiClock className="h-6 w-6 text-amber-500" aria-hidden />
                </div>
                <p className="text-base font-black text-slate-800">ยังไม่ถึงเวลาคาบเรียน</p>
                <p className="text-sm font-semibold leading-relaxed text-slate-500">
                  กรุณาเช็กชื่อเมื่อถึงเวลา{' '}
                  <span className="font-black text-amber-600">{periodStatus.startTime} น.</span>
                </p>
              </div>
            ) : loading ? (
              <p className="py-10 text-center text-sm font-semibold text-slate-500">กำลังโหลดรายชื่อ...</p>
            ) : rows.length === 0 ? (
              <p className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center text-xs font-semibold text-slate-500">
                ไม่พบรายชื่อนักเรียนในห้องนี้
              </p>
            ) : (
              <div className="flex flex-col gap-2.5">
                {rows.map((student) => {
                  const statusOption = student.status
                    ? ATTENDANCE_OPTIONS.find((opt) => opt.value === student.status)
                    : null;
                  return (
                    <div
                      key={student.id}
                      className={cn(
                        'rounded-2xl border p-3 transition-colors',
                        statusOption?.cardClassName ?? 'border-slate-200 bg-white',
                      )}
                    >
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-black text-slate-800">{student.name}</p>
                          <p className="text-[11px] font-bold text-slate-400">{student.code}</p>
                        </div>
                        <span
                          className={cn(
                            'rounded-lg px-2 py-1 text-[10px] font-black',
                            statusOption?.badgeClassName ?? 'bg-slate-100 text-slate-500',
                          )}
                        >
                          {statusOption?.label ?? 'ยังไม่เช็ก'}
                        </span>
                      </div>
                      <div className="grid grid-cols-4 gap-1.5">
                        {ATTENDANCE_OPTIONS.map((opt) => {
                          const isActive = student.status === opt.value;
                          return (
                            <button
                              key={opt.value}
                              type="button"
                              disabled={locked}
                              onClick={() => setStudentStatus(student.id, opt.value)}
                              className={cn(
                                'h-9 rounded-lg border text-[11px] font-black transition active:scale-[0.98]',
                                isActive ? opt.activeClassName : opt.className,
                                locked && 'cursor-not-allowed opacity-60',
                              )}
                            >
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {rows.length > 0 && !locked && !isUpcoming && (
            <div className="shrink-0 border-t border-slate-100 bg-white px-4 pb-4 pt-2">
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving}
                className="h-11 w-full rounded-xl bg-slate-900 text-sm font-black text-white transition hover:bg-slate-800 disabled:opacity-60"
              >
                {saving ? 'กำลังบันทึก...' : `บันทึกเช็คชื่อ (${rows.length} คน)`}
              </button>
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

function TeachingReflectionTaskDrawer({
  task,
  today,
  onClose,
}: {
  task: TeacherTeachingReflectionTask | null;
  today: string;
  onClose: () => void;
}) {
  const { user, userData } = useAuth();
  const { activeYear, activeSemester } = useActiveAcademicYear();
  const { syllabi, createSyllabus, updateTopics } = useTeacherDailyTasks();
  const [planStatus, setPlanStatus] = useState<TeachingPlanStatus>('on_plan');
  const [overview, setOverview] = useState<TeachingOverview>(3);
  const [notes, setNotes] = useState('');
  const [problemStudents, setProblemStudents] = useState<TeachingReflectionStudent[]>([]);
  const [saving, setSaving] = useState(false);
  const open = !!task;
  const todayLabel = useMemo(() => formatThaiDateLabelFromIso(today), [today]);

  useEffect(() => {
    if (!task) return;
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
  }, [task, syllabi, today]);

  const handleSave = async () => {
    if (!task || !user?.uid || !activeYear || !activeSemester) return;
    setSaving(true);
    try {
      let syllabus = syllabi.find(
        (s) =>
          s.classId === task.classId
          && (s.subjectId === task.subjectId || s.subjectName === task.subjectName),
      );

      if (!syllabus) {
        const departmentId =
          (userData as { departmentId?: string } | null)?.departmentId ?? 'secondary';
        const displayName =
          userData?.displayName || userData?.firstName || user.displayName || 'ครู';
        const gradeLevel = task.className.split('/')[0]?.trim() || '';
        const newId = await createSyllabus({
          academicYearId: activeYear.year,
          semester: activeSemester as 1 | 2,
          departmentId,
          teacherId: user.uid,
          teacherName: displayName,
          subjectId: task.subjectId,
          subjectName: task.subjectName,
          classId: task.classId,
          className: task.className,
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
          subjectId: task.subjectId,
          subjectName: task.subjectName,
          classId: task.classId,
          className: task.className,
          gradeLevel,
          totalWeeks: 20,
          topics: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      }

      const topicIndex = syllabus.topics.findIndex((t) => t.date === today);
      const reflection = {
        planStatus,
        overview,
        ...(problemStudents.length > 0 ? { problemStudents } : {}),
        ...(notes.trim() ? { additionalRequest: notes.trim() } : {}),
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
          date: today,
          title: 'บันทึกหลังการสอน',
          teachingReflection: reflection,
          completedAt: new Date().toISOString(),
        } as WeeklyTopic);
      }

      await updateTopics(syllabus.id, updatedTopics);
      toast.success('บันทึกหลังการสอนเรียบร้อย');
      onClose();
    } catch {
      toast.error('บันทึกหลังการสอนไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer
      open={open}
      onOpenChange={(next) => {
        if (!next && !saving) onClose();
      }}
      direction="right"
    >
      <DrawerContent className={cn(TEACHER_DAILY_DRAWER_CONTENT_CLASS, 'font-sukhumvit')}>
        <div className={TEACHER_DAILY_DRAWER_PANEL_CLASS}>
          <DrawerHeader className="shrink-0 border-b border-slate-100 px-4 pb-3 pt-4 text-left">
            <div className="relative flex min-h-10 items-center justify-center">
              <div className="min-w-0 flex-1 pr-12 text-left">
                <DrawerTitle className="truncate text-base font-black text-slate-800">
                  บันทึกหลังการสอน
                </DrawerTitle>
                <DrawerDescription className="truncate text-[11px] font-bold text-slate-400">
                  {task ? `${task.subjectName} · ${task.className}` : todayLabel}
                </DrawerDescription>
              </div>
              <div className={DRAWER_HEADER_RIGHT_ACTIONS}>
                <button
                  type="button"
                  onClick={() => !saving && onClose()}
                  className={DRAWER_HEADER_ICON_BTN}
                  aria-label="ปิด"
                >
                  <HiXMark className="h-4 w-4" />
                </button>
              </div>
            </div>
          </DrawerHeader>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-[11px] font-black text-slate-600">แผนการสอน</label>
                <select
                  value={planStatus}
                  onChange={(e) => setPlanStatus(e.target.value as TeachingPlanStatus)}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-[12px] font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/30"
                >
                  <option value="on_plan">ตามแผน</option>
                  <option value="off_plan">เบี่ยงเบน</option>
                </select>
              </div>
              <TeachingStarRating value={overview} onChange={setOverview} />
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-black text-slate-600">หมายเหตุเพิ่มเติม</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="ป้อนหมายเหตุ หากนักเรียนมีปัญหา ข้อเสนอแนะ ฯลฯ"
                className="h-28 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-sarabun text-[12px] text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/30"
              />
            </div>

            <ProblemStudentPicker
              classId={task?.classId}
              enabled={!!task}
              value={problemStudents}
              onChange={setProblemStudents}
            />
          </div>

          <DrawerFooter className="shrink-0 flex-row gap-2 border-t border-slate-100">
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleSave()}
              className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 text-[13px] font-black text-white shadow-md transition-colors hover:bg-blue-700 disabled:opacity-60"
            >
              <HiCheck className="h-4 w-4" />
              {saving ? 'กำลังบันทึก...' : 'บันทึก'}
            </button>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

/** Task list + nested drawers for roll call / class attendance / reflection. */
export function TeacherDailyTasksPanel({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const {
    today,
    rollCallTasks,
    classAttendanceTasks,
    teachingReflectionTasks,
    rollCallStats,
    classStats,
    reflectionStats,
    hasHomeroom,
    hasClassesToday,
    hasReflectionTasksToday,
  } = useTeacherDailyTasks();
  const { isHoliday: isBlocked, isWeekend, holidayTitle } = useIsSchoolDayToday('teacher', today);

  const [selectedRollCall, setSelectedRollCall] = useState<TeacherRollCallTask | null>(null);
  const [selectedClassAtt, setSelectedClassAtt] = useState<TeacherClassAttendanceTask | null>(null);
  const [selectedReflection, setSelectedReflection] = useState<TeacherTeachingReflectionTask | null>(null);

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange} direction="right">
        <DrawerContent className={TEACHER_DAILY_DRAWER_CONTENT_CLASS}>
          <div className={TEACHER_DAILY_DRAWER_PANEL_CLASS}>
            <DrawerHeader className="shrink-0 border-b border-slate-100 px-4 pb-3 pt-4 text-left">
              <DrawerTitle className="text-base font-black text-slate-800">งานประจำวันครู</DrawerTitle>
              <DrawerDescription className="text-[11px] font-bold text-slate-400">
                {isBlocked
                  ? isWeekend
                    ? 'วันหยุดสุดสัปดาห์'
                    : `วันหยุด${holidayTitle ? ` · ${holidayTitle}` : ''}`
                  : 'รายการที่ต้องทำวันนี้'}
              </DrawerDescription>
            </DrawerHeader>

            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4">
              {isBlocked ? (
                <p className="py-10 text-center text-sm font-bold text-slate-400">
                  วันนี้ไม่ต้องเช็คชื่อและบันทึกหลังการสอน
                </p>
              ) : (
                <>
                  <RollCallTaskList
                    hasHomeroom={hasHomeroom}
                    rollCallStats={rollCallStats}
                    rollCallTasks={rollCallTasks}
                    onSelectTask={setSelectedRollCall}
                  />
                  <ClassAttendanceTaskList
                    hasClassesToday={hasClassesToday}
                    classStats={classStats}
                    classAttendanceTasks={classAttendanceTasks}
                    onSelectTask={setSelectedClassAtt}
                  />
                  <TeachingReflectionTaskList
                    hasReflectionTasksToday={hasReflectionTasksToday}
                    reflectionStats={reflectionStats}
                    teachingReflectionTasks={teachingReflectionTasks}
                    onSelectTask={setSelectedReflection}
                  />
                </>
              )}
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      <RollCallTaskDrawer task={selectedRollCall} onClose={() => setSelectedRollCall(null)} />
      <ClassAttendanceTaskDrawer
        task={selectedClassAtt}
        today={today}
        onClose={() => setSelectedClassAtt(null)}
      />
      <TeachingReflectionTaskDrawer
        task={selectedReflection}
        today={today}
        onClose={() => setSelectedReflection(null)}
      />
    </>
  );
}

export default TeacherDailyTasksPanel;
