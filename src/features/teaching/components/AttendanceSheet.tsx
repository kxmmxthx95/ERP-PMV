import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useSearchParams } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  CheckCircle,
  CheckSquare,
  Clock,
  Coffee,
  FileCheck,
  History,
  MapPin,
  Search,
  Save,
  Trash2,
  UserCheck,
  UserX,
  Users,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import type { AttendanceRecord, AttendanceStatus, NewAttendanceRecord } from '@/types/teaching';
import type { LeaveRequest } from '@/types/leave';
import { GRADE_LEVEL_ORDER, type ClassRoom } from '@/types/class';
import type { Department, Subject } from '@/types/curriculum';
import type { TeacherProfile } from '@/types/teacher';
import { useSchedule } from '@/hooks/useSchedule';
import { useSoundEffects } from '@/hooks/useSoundEffects';
import {
  DAY_LABELS,
  SCHOOL_DAYS,
  type ScheduleEntry
} from '@/types/schedule';
import { useScheduleSettings } from '@/hooks/useScheduleSettings';
import { subjectColorByName, subjectGradient, withAlpha } from '../../schedule/constants/colors';
import StudentAvatar from '@/features/students/components/StudentAvatar';
import {
  ClassSelectionFlow,
  DEPARTMENT_GRADES,
  type DepartmentFilter,
} from '@/components/school/ClassSelectionFlow';
import GradeBookClassSidebar from '@/features/grades/components/GradeBookClassSidebar';
import SidebarCollapseButton from '@/features/grades/components/SidebarCollapseButton';
import {
  TeacherAttendanceMonthCalendar,
  TeacherDaySubjectsDrawer,
  toSchoolDay,
} from '@/features/teaching/components/TeacherAttendanceCalendar';
import { toDateStr } from '@/features/calendar/utils';
import { useActiveAcademicYear } from '@/hooks/useActiveAcademicYear';
import { useAcademicCalendar } from '@/hooks/useAcademicCalendar';
import { resolveSemesterDateRange } from '@/features/microSyllabus/utils/teachingPlanCalendar';
import { deptSemestersStore } from '@/lib/firestoreShared/deptSemestersStore';
import { departmentToSemesterKey } from '@/lib/teacherKpi/semesterDates';
import { getSchedulesByYearSemesterStore } from '@/lib/firestoreShared/schedulesStore';
import { getClassesByYearStore } from '@/lib/firestoreShared/studentSummaryStore';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { DRAWER_HEADER_ICON_BTN, DRAWER_HEADER_RIGHT_ACTIONS } from '@/lib/drawerHeaderBtn';
import { HiArrowLeft, HiBookOpen, HiPencilSquare } from 'react-icons/hi2';
import { SubjectIcon } from '@/features/curriculum/utils/subjectVisual';
import { useAuth } from '@/hooks/useAuth';
import {
  buildTeacherIdentityKeys,
  matchesTeacherIdentity,
  resolveTeacherFromAuth,
} from '@/lib/teachers/teacherIdentity';
import SummaryTab from '@/features/attendance/components/SummaryTab';

const ATTENDANCE_DRAWER_CONTENT_CLASS = cn(
  'flex h-dvh flex-col bg-transparent p-0 before:hidden',
  'data-[vaul-drawer-direction=right]:w-screen data-[vaul-drawer-direction=right]:max-w-none',
  'sm:h-full sm:data-[vaul-drawer-direction=right]:w-full sm:data-[vaul-drawer-direction=right]:max-w-md sm:p-2',
);

const ATTENDANCE_DRAWER_PANEL_CLASS = cn(
  'flex h-full min-h-0 flex-col overflow-hidden bg-white',
  'sm:rounded-4xl sm:border sm:border-slate-200/70 sm:shadow-xl',
);

function ClassPickerSkeleton() {
  return (
    <div className="flex w-full flex-col items-center gap-8 px-2" aria-busy="true" aria-label="กำลังโหลด">
      <div className="relative mx-auto h-[min(420px,58vh)] w-full max-w-5xl">
        <Skeleton className="absolute left-1/2 top-1/2 h-[min(368px,50vh)] w-[min(230px,62vw)] -translate-x-[calc(50%+260px)] -translate-y-1/2 scale-92 rounded-[2rem] bg-slate-200/50" />
        <Skeleton className="absolute left-1/2 top-1/2 h-[min(368px,50vh)] w-[min(230px,62vw)] -translate-x-[calc(50%-260px)] -translate-y-1/2 scale-92 rounded-[2rem] bg-slate-200/50" />
        <Skeleton className="absolute left-1/2 top-1/2 z-10 h-[min(400px,54vh)] w-[min(250px,68vw)] -translate-x-1/2 -translate-y-1/2 rounded-[2rem] bg-slate-200/80">
          <div className="absolute top-6 left-6 right-6 space-y-3">
            <Skeleton className="h-8 w-[70%] rounded-lg bg-slate-300/70" />
            <Skeleton className="h-4 w-[45%] rounded-lg bg-slate-300/50" />
          </div>
        </Skeleton>
      </div>
      <div className="flex items-center gap-2">
        <Skeleton className="h-2 w-8 rounded-full bg-slate-300" />
        <Skeleton className="h-2 w-2 rounded-full bg-slate-200" />
        <Skeleton className="h-2 w-2 rounded-full bg-slate-200" />
      </div>
    </div>
  );
}

function MonthCalendarSkeleton() {
  return (
    <div
      className="flex h-full min-h-0 w-full flex-col max-lg:overflow-y-auto"
      aria-busy="true"
      aria-label="กำลังโหลดตาราง"
    >
      <div className="flex shrink-0 items-center justify-between gap-2 px-1 pb-1.5 pt-0">
        <Skeleton className="h-8 w-8 rounded-xl bg-slate-100" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-28 rounded-lg bg-slate-100" />
          <Skeleton className="h-7 w-12 rounded-xl bg-slate-100" />
        </div>
        <Skeleton className="h-8 w-8 rounded-xl bg-slate-100" />
      </div>
      <div className="grid shrink-0 grid-cols-7 px-1 pb-1 pt-0">
        {Array.from({ length: 7 }, (_, index) => (
          <Skeleton key={index} className="mx-auto mb-2 h-3 w-4 rounded bg-slate-50" />
        ))}
      </div>
      <div className="grid shrink-0 grid-cols-7 gap-1 px-1 pb-2 max-lg:auto-rows-[minmax(52px,auto)] lg:min-h-0 lg:flex-1 lg:auto-rows-fr">
        {Array.from({ length: 35 }, (_, index) => (
          <Skeleton
            key={index}
            className="min-h-[52px] rounded-xl bg-slate-100 lg:h-full lg:min-h-[80px]"
          />
        ))}
      </div>
      <div className="space-y-2 px-1 pb-2 lg:hidden">
        <Skeleton className="h-3 w-28 rounded bg-slate-50" />
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="h-16 rounded-2xl bg-slate-100" />
        ))}
      </div>
    </div>
  );
}

function StudentRosterSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-2.5" aria-busy="true" aria-label="กำลังโหลดรายชื่อนักเรียน">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="rounded-2xl border border-slate-200 bg-white p-3">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-3.5 w-[55%] rounded-lg bg-slate-100" />
              <Skeleton className="h-3 w-[28%] rounded-lg bg-slate-50" />
            </div>
            <Skeleton className="h-6 w-12 rounded-lg bg-slate-100" />
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {Array.from({ length: 4 }, (_, btn) => (
              <Skeleton key={btn} className="h-9 rounded-xl bg-slate-100" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Same options as TodayScheduleWidget class-attendance drawer */
const WIDGET_ATTENDANCE_OPTIONS: {
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


interface StudentRosterItem {
  student: {
    id: string;
    userId?: string;
    uid?: string;
    authUid?: string;
    studentCode: string;
    prefix: string;
    firstName: string;
    lastName: string;
    photoURL?: string;
    gender?: 'male' | 'female';
  };
}

interface StudentRow {
  studentId: string;
  studentCode: string;
  studentName: string;
  /** All identity keys (doc id, authUid, userId, uid) — needed to match leave requests submitted via student login (Auth UID) against the roster doc id. */
  identityKeys: string[];
  imageUrl?: string;
  gender?: 'male' | 'female';
  status: AttendanceStatus | null;
  note: string;
  autoFilledLeave?: boolean;
}

interface AttendanceSheetProps {
  teacherId: string;
  academicYearId: string;
  semester: 1 | 2;
  mySubjects: Subject[];
  classes: ClassRoom[];
  teachers?: TeacherProfile[];
  getStudentsForClass: (classId: string) => StudentRosterItem[];
  getAttendanceForSession: (subjectId: string, classId: string, date: string, period: number) => AttendanceRecord[];
  onSave: (records: NewAttendanceRecord[]) => Promise<void>;
  attendance?: AttendanceRecord[];
  leaveRequests?: LeaveRequest[];
  /** false while enrollments/students still loading — shows roster skeleton */
  isRosterDataLoaded?: boolean;
}

type AttendanceSubview = 'today' | 'history' | 'summary';

interface ScheduleGridProps {
  classEntries: ScheduleEntry[];
  onSlotClick: (entry: ScheduleEntry) => void;
  selectedSlotId: string | null;
  classId: string | null;
  attendance: AttendanceRecord[];
  teachersById: Record<string, TeacherProfile>;
  getStudentsForClass: (classId: string) => StudentRosterItem[];
  /** teacher = own timetable (show class name, any day clickable) */
  variant?: 'class' | 'teacher';
  classNameById?: Record<string, string>;
}

const STATUS_CONFIG: Record<AttendanceStatus, {
  label: string;
  shortLabel: string;
  color: string;
  bg: string;
  gradient: string;
  border: string;
  icon: typeof UserCheck;
}> = {
  present: { label: 'มาเรียน', shortLabel: 'ม', color: '#059669', bg: '#d1fae5', gradient: 'bg-gradient-to-br from-emerald-500/10 to-emerald-600/25', border: 'border-emerald-500/60', icon: UserCheck },
  late: { label: 'สาย', shortLabel: 'ส', color: '#d97706', bg: '#fef3c7', gradient: 'bg-gradient-to-br from-amber-400/15 to-amber-600/25', border: 'border-amber-500/60', icon: Clock },
  absent: { label: 'ขาดเรียน', shortLabel: 'ข', color: '#e11d48', bg: '#ffe4e6', gradient: 'bg-gradient-to-br from-rose-500/10 to-rose-600/25', border: 'border-rose-500/60', icon: UserX },
  excused: { label: 'ลากิจ/ป่วย', shortLabel: 'ล', color: '#2563eb', bg: '#dbeafe', gradient: 'bg-gradient-to-br from-blue-500/10 to-blue-600/25', border: 'border-blue-500/60', icon: FileCheck },
  leave: { label: 'ลา (ทางการ)', shortLabel: 'ลว', color: '#7c3aed', bg: '#f3e8ff', gradient: 'bg-gradient-to-br from-violet-500/10 to-violet-600/25', border: 'border-violet-500/60', icon: CheckSquare },
};

const STATUS_BUTTONS: AttendanceStatus[] = ['present', 'late', 'absent', 'leave'];

function TeacherAttendanceDrawer({
  open,
  onOpenChange,
  onBackToSubjects,
  period,
  subjectName,
  className,
  rows,
  loading,
  saving,
  locked,
  readOnly,
  readOnlyReason,
  muteStatusColors,
  canSetLeave,
  onUnlock,
  onSave,
  onToggleAllPresent,
  allPresentActive,
  onSetStatus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBackToSubjects: () => void;
  period: number;
  subjectName: string;
  className: string;
  rows: StudentRow[];
  loading?: boolean;
  saving: boolean;
  locked: boolean;
  /** Past/future — ห้ามแก้ไข */
  readOnly?: boolean;
  readOnlyReason?: string;
  /** Future date — ปุ่มสถานะสีเทา */
  muteStatusColors?: boolean;
  canSetLeave: (studentId: string) => boolean;
  onUnlock: () => void;
  onSave: () => void;
  onToggleAllPresent: () => void;
  allPresentActive: boolean;
  onSetStatus: (studentId: string, status: AttendanceStatus) => void;
}) {
  const editingLocked = locked || !!readOnly;

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="right">
      <DrawerContent className={ATTENDANCE_DRAWER_CONTENT_CLASS}>
        <div className={ATTENDANCE_DRAWER_PANEL_CLASS}>
          <DrawerHeader className="shrink-0 px-4 pb-2 pt-4">
            <div className="relative flex min-h-10 items-center justify-center">
              {rows.length > 0 && !readOnly && !loading && (
                locked ? (
                  <button
                    type="button"
                    onClick={onUnlock}
                    className="absolute left-0 top-1/2 -translate-y-1/2 inline-flex items-center gap-1.5 text-[11px] font-black text-blue-600 hover:text-blue-700 transition-colors"
                  >
                    <HiPencilSquare className="h-4 w-4" />
                    แก้ไข
                  </button>
                ) : (
                  <label className="absolute left-0 top-1/2 -translate-y-1/2 inline-flex cursor-pointer select-none items-center gap-2">
                    <input
                      type="checkbox"
                      checked={allPresentActive}
                      onChange={onToggleAllPresent}
                      className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-[11px] font-black text-slate-700">เช็กทั้งหมด</span>
                  </label>
                )
              )}
              {readOnly && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400">
                  {readOnlyReason || 'ดูอย่างเดียว'}
                </span>
              )}

              <div className="min-w-0 px-12 text-center">
                <DrawerTitle className="text-base font-black text-slate-800">
                  เช็กชื่อคาบที่ {period}
                </DrawerTitle>
                <DrawerDescription className="text-xs text-slate-500">
                  {subjectName}
                  {className ? ` · ${className}` : ''}
                </DrawerDescription>
              </div>

              <div className={DRAWER_HEADER_RIGHT_ACTIONS}>
                <button
                  type="button"
                  onClick={onBackToSubjects}
                  className={DRAWER_HEADER_ICON_BTN}
                  aria-label="กลับไปหน้ารายวิชา"
                  title="กลับไปหน้ารายวิชา"
                >
                  <HiArrowLeft className="h-4 w-4" />
                </button>
              </div>
            </div>
          </DrawerHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
            {loading && rows.length === 0 ? (
              <StudentRosterSkeleton />
            ) : rows.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center text-xs font-semibold text-slate-500">
                ไม่พบรายชื่อนักเรียนในห้องนี้
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {rows.map((student) => {
                  const statusOption = student.status
                    ? WIDGET_ATTENDANCE_OPTIONS.find((opt) => opt.value === student.status)
                    : null;
                  const leaveAllowed = canSetLeave(student.studentId);
                  const showGrayStatus = !!muteStatusColors;

                  return (
                    <div
                      key={student.studentId}
                      className={cn(
                        'rounded-2xl border p-3 transition-colors duration-200',
                        showGrayStatus
                          ? 'border-slate-200 bg-white'
                          : (statusOption?.cardClassName ?? 'border-slate-200 bg-white'),
                      )}
                    >
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-black text-slate-800">
                            {student.studentName}
                          </p>
                          <p className="text-[11px] font-bold text-slate-400">{student.studentCode}</p>
                        </div>
                        <span
                          className={cn(
                            'rounded-lg px-2 py-1 text-[10px] font-black',
                            showGrayStatus
                              ? 'bg-slate-100 text-slate-400'
                              : (statusOption?.badgeClassName ?? 'bg-slate-100 text-slate-500'),
                          )}
                        >
                          {showGrayStatus ? 'ยังไม่ถึงวัน' : (statusOption?.label ?? 'ยังไม่เช็ก')}
                        </span>
                      </div>

                      <div className="grid grid-cols-4 gap-1.5">
                        {WIDGET_ATTENDANCE_OPTIONS.map((opt) => {
                          const isActive = !showGrayStatus && student.status === opt.value;
                          const leaveBlocked = opt.value === 'leave' && !leaveAllowed;
                          const disabled = editingLocked || leaveBlocked;
                          return (
                            <button
                              key={opt.value}
                              type="button"
                              disabled={disabled}
                              title={
                                showGrayStatus
                                  ? 'ยังไม่ถึงวันสอน'
                                  : leaveBlocked
                                    ? 'ลาได้เฉพาะเมื่อมีใบลาที่อนุมัติแล้ว'
                                    : undefined
                              }
                              onClick={() => onSetStatus(student.studentId, opt.value)}
                              className={cn(
                                'h-9 rounded-lg border text-[11px] font-black transition active:scale-[0.98]',
                                showGrayStatus
                                  ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
                                  : isActive
                                    ? opt.activeClassName
                                    : opt.className,
                                !showGrayStatus && disabled && 'cursor-not-allowed opacity-60',
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

          {rows.length > 0 && !readOnly && (
            <div className="shrink-0 border-t border-slate-100 bg-white px-4 pt-2 pb-4">
              <button
                type="button"
                onClick={() => {
                  if (locked) {
                    onUnlock();
                    return;
                  }
                  onSave();
                }}
                disabled={saving}
                className={cn(
                  'h-11 w-full rounded-xl text-sm font-black transition active:scale-[0.99] disabled:opacity-60',
                  locked
                    ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                    : 'bg-slate-900 text-white hover:bg-slate-800',
                )}
              >
                {saving
                  ? 'กำลังบันทึก...'
                  : locked
                    ? 'แก้ไข'
                    : `บันทึกเช็กชื่อ (${rows.length} คน)`}
              </button>
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

function formatSessionDate(date: string) {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function toLocalDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function resolveNearestClassDate(day: number) {
  const now = new Date();
  const currentDay = now.getDay() || 7; // 1=จันทร์ ... 7=อาทิตย์
  const diff = day - currentDay;
  const targetDate = new Date(now);
  targetDate.setDate(now.getDate() + diff);
  return toLocalDateString(targetDate);
}

function toIdentityList(student: StudentRosterItem['student']): string[] {
  const raw = [student.id, student.userId, student.uid, student.authUid];
  return [...new Set(raw.map(v => (typeof v === 'string' ? v.trim() : '')).filter(Boolean))];
}

function normalizeThaiName(value: string): string {
  return value.replace(/\s+/g, '').trim();
}

/** Single source of truth for "does this row have an approved leave on this date" — used both to auto-fill status and to gate the ลว button/save, so they never disagree. */
function findApprovedStudentLeave(
  leaveRequests: LeaveRequest[],
  row: { identityKeys: string[]; studentCode: string; studentName: string },
  date: string,
): LeaveRequest | undefined {
  return leaveRequests.find((r) =>
    r.requesterType === 'student' &&
    r.status === 'approved' &&
    date >= r.startDate && date <= r.endDate &&
    (
      row.identityKeys.includes(r.requesterId)
      || (typeof r.requesterStudentCode === 'string' && r.requesterStudentCode !== '' && r.requesterStudentCode === row.studentCode)
      || normalizeThaiName(r.requesterName) === normalizeThaiName(row.studentName)
    ),
  );
}

const REST_GRADIENT = [
  'radial-gradient(125% 120% at 100% 0%, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0) 56%)',
  'linear-gradient(160deg, rgba(16,185,129,0.95) 0%, rgba(45,212,191,0.9) 100%)',
].join(', ');

function ScheduleGrid({
  classEntries,
  onSlotClick,
  selectedSlotId,
  classId,
  attendance,
  teachersById,
  getStudentsForClass,
  variant = 'class',
  classNameById = {},
}: ScheduleGridProps) {
  const { periodCount, lunchPeriods, breakPeriods, periodTimes } = useScheduleSettings(classId || undefined);
  const periods = Array.from({ length: periodCount }, (_, i) => i + 1);
  const todayDay = new Date().getDay() || 7;
  const isTeacherView = variant === 'teacher';
  const [mobileDay, setMobileDay] = useState<number>(
    SCHOOL_DAYS.includes(todayDay as (typeof SCHOOL_DAYS)[number]) ? todayDay : SCHOOL_DAYS[0]
  );

  const mobileDayLabels: Record<number, string> = {
    1: 'Mon',
    2: 'Tue',
    3: 'Wed',
    4: 'Thu',
    5: 'Fri',
  };

  const currentPeriod = useMemo(() => {
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    let found = -1;

    Object.entries(periodTimes).forEach(([p, timeRange]) => {
      const [start, end] = timeRange.split(' - ');
      if (!start) return;

      const [hS, mS] = start.split(':').map(Number);
      const startTime = hS * 60 + mS;

      let endTime = startTime + 50;
      if (end) {
        const [hE, mE] = end.split(':').map(Number);
        endTime = hE * 60 + mE;
      }

      if (currentTime >= startTime && currentTime <= endTime + 10) {
        found = Number(p);
      }
    });

    return found;
  }, [periodTimes]);

  const renderEntryButton = (entry: ScheduleEntry, compact = false) => {
    const isSelected = selectedSlotId === entry.id;
    const color = subjectColorByName(entry.subjectName || entry.subjectCode);
    const isCurrent = entry.day === todayDay && entry.period === currentPeriod;

    const todayStr = resolveNearestClassDate(entry.day);
    const slotAttendance = attendance.filter(a =>
      a.subjectId === entry.subjectId &&
      a.classId === entry.classId &&
      a.date === todayStr &&
      a.period === entry.period
    );

    const totalStudents = getStudentsForClass(entry.classId).length;
    const checkedCount = slotAttendance.length;

    let statusColor = 'bg-rose-500';
    if (checkedCount > 0) {
      if (checkedCount < totalStudents) {
        statusColor = 'bg-amber-400';
      } else {
        statusColor = 'bg-emerald-500';
      }
    }

    const isToday = entry.day === todayDay;
    const canClick = isTeacherView || isToday;
    const classLabel = classNameById[entry.classId] || entry.classId;
    const teacherParts = entry.teacherName ? entry.teacherName.trim().split(/\s+/) : [];
    const teacherFirst = teacherParts.length >= 2 ? teacherParts.slice(0, -1).join(' ') : (entry.teacherName || '-');
    const teacherLast = teacherParts.length >= 2 ? teacherParts[teacherParts.length - 1] : '';
    const teacherPhotoURL = teachersById[entry.teacherId]?.photoURL;
    const teacherInitials = teacherParts
      .slice(0, 2)
      .map((part) => part[0] ?? '')
      .join('')
      .toUpperCase() || 'T';

    return (
      <motion.button
        key={entry.id}
        whileHover={canClick ? { opacity: 0.95 } : {}}
        whileTap={canClick ? { scale: 0.98 } : {}}
        onClick={() => canClick && onSlotClick(entry)}
        disabled={!canClick}
        className={`group relative w-full overflow-hidden rounded-xl cursor-pointer transition-all duration-150 flex flex-col justify-between text-left ${
          compact ? 'p-2' : 'p-2.5'
        } ${!canClick ? 'opacity-40 grayscale-[0.4] scale-[0.98] cursor-not-allowed' : ''}`}
        style={{
          background: subjectGradient(color, isCurrent),
          minHeight: compact ? 62 : 70,
          boxShadow: isSelected
            ? `0 0 0 2px ${withAlpha(color.accent, 0.26)}, inset 0 1px 0 rgba(255,255,255,0.42), 0 12px 20px -18px ${withAlpha(color.accent, 0.68)}`
            : `inset 0 1px 0 rgba(255,255,255,0.34), 0 12px 20px -18px ${withAlpha(color.accent, 0.52)}`,
        }}
      >
        <div
          className="pointer-events-none absolute -right-7 -top-7 h-16 w-16 rounded-full"
          style={{
            background: `radial-gradient(circle, ${withAlpha(color.accent, 0.24)} 0%, ${withAlpha(color.accent, 0.04)} 68%, transparent 100%)`,
          }}
        />
        <div
          className="pointer-events-none absolute -bottom-8 right-5 h-14 w-14 rounded-full"
          style={{
            background: `radial-gradient(circle, ${withAlpha(color.accent, 0.16)} 0%, ${withAlpha(color.accent, 0.03)} 62%, transparent 100%)`,
          }}
        />

        <div className="select-none flex items-start justify-between gap-1.5 w-full flex-1">
          <div className="min-w-0 flex-1">
            <p
              className="text-[9px] font-black leading-none mb-1 text-white"
              style={{ textShadow: '0 1px 2px rgba(0,0,0,0.4)' }}
            >
              {entry.subjectCode}
            </p>
            <p
              className={`${compact ? 'text-[10px]' : 'text-[10.5px]'} font-extrabold text-white leading-tight line-clamp-2`}
              style={{ textShadow: '0 1px 2.5px rgba(0,0,0,0.45)' }}
            >
              {entry.subjectName}
            </p>
            {isTeacherView && (
              <p
                className="mt-1 text-[9px] font-bold text-white/90 truncate"
                style={{ textShadow: '0 1px 2px rgba(0,0,0,0.4)' }}
              >
                {classLabel}
              </p>
            )}
          </div>

          {!isTeacherView && (
            <div className="shrink-0 text-right flex items-center gap-1.5 self-end mb-0.5 pl-1.5">
              <div className="flex flex-col items-end leading-tight">
                <span
                  className="text-[8.5px] font-bold text-white leading-tight whitespace-nowrap block"
                  style={{ textShadow: '0 1px 2px rgba(0,0,0,0.4)' }}
                >
                  {teacherFirst}
                </span>
                {teacherLast && (
                  <span
                    className="text-[8.5px] font-bold text-white/90 leading-tight whitespace-nowrap block"
                    style={{ textShadow: '0 1px 2px rgba(0,0,0,0.4)' }}
                  >
                    {teacherLast}
                  </span>
                )}
              </div>
              <Avatar
                className={`${compact ? 'w-6 h-6' : 'w-7 h-7'} rounded-full shrink-0 border border-white/40 shadow-sm`}
              >
                <AvatarImage src={teacherPhotoURL} alt={entry.teacherName} />
                <AvatarFallback className="bg-white/85 text-[9px] font-black text-slate-700">
                  {teacherInitials}
                </AvatarFallback>
              </Avatar>
            </div>
          )}
        </div>

        <div className="absolute right-2 top-2 flex items-center gap-1">
          <div className={`h-1.5 w-1.5 rounded-full ${statusColor}`} />
          {checkedCount === totalStudents && totalStudents > 0 && (
            <div className="inline-flex items-center justify-center rounded-full bg-emerald-500 p-0.5 text-white shadow-sm">
              <CheckSquare size={8} strokeWidth={4} />
            </div>
          )}
        </div>
      </motion.button>
    );
  };

  return (
    <div className="space-y-2">
      <div className="md:hidden mb-2" id="schedule-grid-export-mobile">
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: 'rgba(255,255,255,0.92)',
            backdropFilter: 'blur(18px) saturate(150%)',
            WebkitBackdropFilter: 'blur(18px) saturate(150%)',
            border: '1px solid rgba(0,0,0,0.08)',
            boxShadow: 'none',
          }}
        >
          <div className="px-2.5 pt-2.5 pb-2 border-b border-black/5">
            <div className="grid grid-cols-5 gap-1 rounded-xl bg-black/[0.04] p-1">
              {SCHOOL_DAYS.map(day => {
                const active = mobileDay === day;
                return (
                  <button
                    key={day}
                    onClick={() => setMobileDay(day)}
                    className={`h-8 rounded-lg text-[11px] font-black transition-all ${
                      active ? 'bg-blue-600 text-white shadow-sm' : 'text-black/55 hover:bg-white/70'
                    }`}
                  >
                    {mobileDayLabels[day]}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="divide-y divide-black/[0.05]">
            {periods.map(period => {
              const isLunch = lunchPeriods.includes(period);
              const isBreak = breakPeriods.includes(period);
              const isRest = isLunch || isBreak;
              const isCurrent = currentPeriod === period && !isRest;
              const timeStr = periodTimes[period] || '';
              const mobileSlots = classEntries.filter(entry => entry.day === mobileDay && entry.period === period);

              return (
                <div
                  key={`mobile-${mobileDay}-${period}`}
                  className="grid grid-cols-[70px_1fr] gap-2 px-2 py-2"
                  style={{ background: isCurrent ? 'rgba(251,191,36,0.08)' : undefined }}
                >
                  <div className="flex flex-col justify-center items-center text-center px-1">
                    <span className="text-[9px] font-black text-black/75">{isRest ? 'พัก' : `คาบ ${period}`}</span>
                    <span className="text-[9px] font-semibold text-black/60 leading-tight mt-0.5 whitespace-pre-line">
                      {timeStr.replace(' - ', '\n')}
                    </span>
                  </div>

                  {isLunch ? (
                    <div
                      className="min-h-[52px] rounded-xl flex items-center justify-center gap-1.5 text-[10px] font-black text-white uppercase tracking-wide"
                      style={{ background: REST_GRADIENT, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.35)' }}
                    >
                      <Coffee size={12} className="text-white" />
                      LUNCH BREAK
                    </div>
                  ) : isBreak ? (
                    <div
                      className="min-h-[52px] rounded-xl flex items-center justify-center gap-1.5 text-[10px] font-black text-white uppercase tracking-wide"
                      style={{ background: REST_GRADIENT, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.35)' }}
                    >
                      <Clock size={11} className="text-white" />
                      BREAK
                    </div>
                  ) : (
                    <div className="rounded-xl">
                      <div className="flex h-full min-h-[70px] flex-col gap-1">
                        {mobileSlots.length === 0 ? (
                          <div className="h-full w-full rounded-xl" />
                        ) : (
                          mobileSlots.map(entry => renderEntryButton(entry, true))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="hidden md:block overflow-x-auto pb-1" id="schedule-grid-export">
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: 'rgba(255,255,255,0.78)',
          backdropFilter: 'blur(28px) saturate(160%)',
          WebkitBackdropFilter: 'blur(28px) saturate(160%)',
          border: '1px solid rgba(0,0,0,0.08)',
          boxShadow: 'none',
          minWidth: 700,
        }}
      >
        <div className="grid grid-cols-[76px_repeat(5,1fr)] bg-black/[0.025] border-b border-black/[0.08]">
          <div className="p-3 flex items-center justify-center border-r border-black/[0.06]">
            <span className="text-[9px] font-black uppercase tracking-widest text-blue-600/60">คาบ</span>
          </div>
          {SCHOOL_DAYS.map(day => (
            <div key={day} className="py-3 px-2 text-center border-l border-black/[0.06]">
              <p className="text-[12px] font-black text-blue-700/90">{DAY_LABELS[day]}</p>
            </div>
          ))}
        </div>

        {periods.map(period => {
          const isLunch = lunchPeriods.includes(period);
          const isBreak = breakPeriods.includes(period);
          const isRest = isLunch || isBreak;
          const isCurrent = currentPeriod === period && !isRest;
          const timeStr = periodTimes[period] || '';

          return (
            <div
              key={period}
              className="grid grid-cols-[76px_repeat(5,1fr)] border-t border-black/[0.06]"
              style={{
                minHeight: isLunch ? 40 : 85,
                background: isCurrent ? 'rgba(251,191,36,0.06)' : undefined,
                outline: isCurrent ? '2px solid rgba(251,191,36,0.30)' : undefined,
                outlineOffset: '-1px',
              }}
            >
              <div className="flex flex-col items-center justify-center bg-black/[0.02] border-r border-black/[0.06] py-2 relative overflow-hidden">
                {isRest ? (
                  <div className={`flex flex-col items-center justify-center ${isLunch ? 'text-orange-600' : 'text-blue-600'}`}>
                    {isLunch ? <Coffee size={13} /> : <Clock size={11} />}
                    <span className="text-[8px] font-black uppercase mt-0.5">{isLunch ? 'L' : 'B'}</span>
                  </div>
                ) : (
                  <>
                    <span className="text-[11px] font-black text-blue-700/85">{period}</span>
                    <span className="mt-1 text-[9px] font-bold text-blue-600/60">{timeStr}</span>
                  </>
                )}
              </div>

              {isRest ? (
                <div
                  className="col-span-5 flex items-center justify-center gap-2 border-l border-black/[0.06]"
                  style={{
                    background: REST_GRADIENT,
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.34)',
                  }}
                >
                  {isLunch ? (
                    <>
                      <Coffee size={14} className="text-white" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-white">
                        พักกลางวัน — Lunch Break
                      </span>
                    </>
                  ) : (
                    <>
                      <Clock size={13} className="text-white" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-white">
                        พักเบรก — Short Break
                      </span>
                    </>
                  )}
                </div>
              ) : (
                SCHOOL_DAYS.map(day => {
                  const slots = classEntries.filter(entry => entry.day === day && entry.period === period);

                  return (
                    <div key={`${day}-${period}`} className="min-h-[85px] border-l border-black/[0.06] p-[3px]">
                      <div className="flex h-full flex-col gap-1">
                        {slots.length === 0 ? (
                          <div className="h-full w-full rounded-xl" />
                        ) : (
                          slots.map(entry => renderEntryButton(entry))
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          );
        })}
      </div>
      </div>
    </div>
  );
}

export default function AttendanceSheet({
  teacherId,
  academicYearId,
  semester,
  mySubjects,
  classes,
  teachers = [],
  getStudentsForClass,
  getAttendanceForSession,
  onSave,
  attendance = [],
  leaveRequests = [],
  isRosterDataLoaded = true,
}: AttendanceSheetProps) {
  const [searchParams] = useSearchParams();
  const { role } = useAuth();
  const isTeacherPicker = role === 'teacher';
  const isAdminOverview = role === 'admin' || role === 'sysadmin';
  const { activeYear } = useActiveAcademicYear();
  const { events: calendarEvents } = useAcademicCalendar(role ?? undefined);
  const { entries: scheduleEntries } = useSchedule();
  const deptSemesterSettings = useSyncExternalStore(
    deptSemestersStore.subscribe,
    deptSemestersStore.getSnapshot,
    deptSemestersStore.getSnapshot,
  );
  const scheduleStore = getSchedulesByYearSemesterStore(academicYearId || '2568', semester);
  const classesStore = getClassesByYearStore(academicYearId || '2568');
  const scheduleReady = useSyncExternalStore(
    scheduleStore.subscribe,
    scheduleStore.getReady,
    scheduleStore.getReady,
  );
  const classesReady = useSyncExternalStore(
    classesStore.subscribe,
    classesStore.getReady,
    classesStore.getReady,
  );
  const todayDate = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();

  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedDate, setSelectedDate] = useState(todayDate);
  const isPastSession = selectedDate < todayDate;
  const isFutureSession = selectedDate > todayDate;
  const isAttendanceReadOnly = isPastSession || isFutureSession;
  const [selectedPeriod, setSelectedPeriod] = useState(1);
  const [viewMode, setViewMode] = useState<'schedule' | 'attendance'>('schedule');
  const [rows, setRows] = useState<StudentRow[]>([]);
  // keep a ref in sync so the auto-sync effect can read current rows without
  // adding `rows` to its dependency array (which would cause an infinite loop)
  useEffect(() => { rowsRef.current = rows; }, [rows]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState<DepartmentFilter>('all');
  const [selectedLevel, setSelectedLevel] = useState<string | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [attendanceDrawerOpen, setAttendanceDrawerOpen] = useState(false);
  const [daySubjectsDrawerOpen, setDaySubjectsDrawerOpen] = useState(false);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<Date | null>(null);
  const [allPresentSnapshot, setAllPresentSnapshot] = useState<StudentRow[] | null>(null);

  const [subView, setSubView] = useState<AttendanceSubview>('today');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<ScheduleEntry | null>(null);
  const [adminSummary, setAdminSummary] = useState<{
    subjectId: string;
    classId: string;
  } | null>(null);
  const rowsRef = useRef<StudentRow[]>([]);
  const teachersById = useMemo(
    () => Object.fromEntries(teachers.map((teacher) => [teacher.id, teacher])),
    [teachers],
  );

  const buildRowsForSession = useCallback(
    (subjectId: string, classId: string, date: string, period: number) => {
      const students = getStudentsForClass(classId);
      const existing = getAttendanceForSession(subjectId, classId, date, period);
      const existingMap = new Map(existing.map(record => [record.studentId, record]));

      return students.map(({ student }) => {
        const existingRecord = existingMap.get(student.id);
        const identityKeys = toIdentityList(student);
        const studentName = `${student.prefix}${student.firstName} ${student.lastName}`;

        // Auto-detect leave — ทำงานทั้งกรณีที่มีและไม่มี existingRecord
        // ครูยังไม่กรอก (status null) → ให้ระบบเติม leave อัตโนมัติ
        // ครูกรอกไปแล้ว (status ไม่ใช่ null) → ไม่ override
        let autoStatus: AttendanceStatus | null = null;
        let autoNote = '';
        const teacherHasSet = existingRecord && existingRecord.status != null;

        if (!teacherHasSet) {
          const approvedLeave = findApprovedStudentLeave(
            leaveRequests,
            { identityKeys, studentCode: student.studentCode, studentName },
            date,
          );
          if (approvedLeave) {
            autoStatus = 'leave';
            const leaveTypeLabel = approvedLeave.leaveType === 'sick' ? 'ลาป่วย' : 'ลากิจ';
            autoNote = `${leaveTypeLabel}: ${approvedLeave.reason}`;
          }
        }

        return {
          studentId: student.id,
          studentCode: student.studentCode,
          studentName,
          identityKeys,
          imageUrl: student.photoURL,
          gender: student.gender,
          status: existingRecord?.status ?? autoStatus,
          note: (existingRecord?.status != null ? existingRecord.note : null) ?? autoNote,
          autoFilledLeave: autoStatus === 'leave' && existingRecord?.status == null,
        };
      }).sort((a, b) => a.studentCode.localeCompare(b.studentCode, undefined, { numeric: true }));
    },
    [getAttendanceForSession, getStudentsForClass, leaveRequests],
  );

  // Handle URL parameters for deep linking
  useEffect(() => {
    const pSubjectId = searchParams.get('subjectId');
    const pClassId = searchParams.get('classId');
    const pPeriod = searchParams.get('period');
    const pDate = searchParams.get('date');

    // Sync filter state if classId is present
    if (pClassId && classes.length > 0) {
      const targetClass = classes.find(c => c.id === pClassId);
      if (targetClass) {
        setSelectedDept(targetClass.departmentId as DepartmentFilter || 'secondary');
        setSelectedLevel(targetClass.gradeLevel);
        setSelectedRoom(targetClass.roomNumber);
        setSelectedClassId(targetClass.id);
      }
    }

    // Admin/sysadmin → summary table (no mark UI)
    if (isAdminOverview && pSubjectId && pClassId) {
      setAdminSummary({ subjectId: pSubjectId, classId: pClassId });
      return;
    }

    if (pSubjectId && pClassId && pPeriod) {
      const periodNum = parseInt(pPeriod);
      const finalDate = pDate || todayDate;

      // Find the entry to set it as selectedEntry (stops auto-select from overriding)
      const entry = scheduleEntries.find(e => 
        e.subjectId === pSubjectId && 
        e.classId === pClassId && 
        e.period === periodNum
      );

      if (entry) {
        setSelectedEntry(entry);
        setSelectedSubjectId(pSubjectId);
        setSelectedClassId(pClassId);
        setSelectedPeriod(periodNum);
        if (pDate) setSelectedDate(pDate);
        
        // Build and set rows for the linked session
        const nextRows = buildRowsForSession(pSubjectId, pClassId, finalDate, periodNum);
        setRows(nextRows);
        
        if (role === 'teacher') {
          setAttendanceDrawerOpen(true);
          setViewMode('schedule');
        } else {
          setViewMode('attendance');
        }
      }
    }
  }, [searchParams, buildRowsForSession, todayDate, scheduleEntries, classes, role, isAdminOverview, mySubjects]);

  const filteredClasses = useMemo(() => {
    let list = classes;
    if (selectedDept !== 'all') {
      list = list.filter(cls => cls.departmentId === selectedDept);
    }
    if (selectedLevel) {
      list = list.filter(cls => cls.gradeLevel === selectedLevel);
    }
    if (selectedRoom) {
      list = list.filter(cls => cls.roomNumber === selectedRoom);
    }
    return list;
  }, [classes, selectedDept, selectedLevel, selectedRoom]);
  
  const roomOptions = useMemo(() => {
    if (!selectedLevel || selectedDept === 'all') return [];
    return Array.from(new Set(
      classes
        .filter(c => c.departmentId === selectedDept && c.gradeLevel === selectedLevel)
        .map(c => c.roomNumber)
    )).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [classes, selectedDept, selectedLevel]);

  const gradeOptions = useMemo(() => {
    if (selectedDept === 'all') return [];
    const grades = new Set<string>();
    classes
      .filter((c) => c.departmentId === selectedDept)
      .forEach((c) => {
        if (c.gradeLevel) grades.add(c.gradeLevel);
      });
    const fromClasses = Array.from(grades).sort(
      (a, b) => (GRADE_LEVEL_ORDER[a] ?? 99) - (GRADE_LEVEL_ORDER[b] ?? 99),
    );
    if (fromClasses.length > 0) return fromClasses;
    return DEPARTMENT_GRADES[selectedDept] ?? [];
  }, [classes, selectedDept]);

  const adminClassOptions = useMemo(() => {
    if (selectedDept === 'all' || !selectedLevel) return [] as ClassRoom[];
    return classes
      .filter((c) => c.departmentId === selectedDept && c.gradeLevel === selectedLevel)
      .slice()
      .sort((a, b) =>
        (a.roomNumber || a.className).localeCompare(b.roomNumber || b.className, undefined, {
          numeric: true,
        }),
      );
  }, [classes, selectedDept, selectedLevel]);

  const teacherIdentityKeys = useMemo(() => {
    if (!isTeacherPicker) return new Set<string>();
    const profile = resolveTeacherFromAuth(teacherId, teachers);
    return buildTeacherIdentityKeys(teacherId, profile);
  }, [isTeacherPicker, teacherId, teachers]);

  const teacherScheduleEntries = useMemo(() => {
    if (!isTeacherPicker) return [];
    return scheduleEntries.filter(
      (entry) =>
        String(entry.year) === String(academicYearId)
        && Number(entry.semester) === Number(semester)
        && matchesTeacherIdentity(entry.teacherId, teacherIdentityKeys),
    );
  }, [academicYearId, isTeacherPicker, scheduleEntries, semester, teacherIdentityKeys]);

  const teachingWeekdays = useMemo(() => {
    const set = new Set<number>();
    for (const entry of teacherScheduleEntries) set.add(entry.day);
    return set;
  }, [teacherScheduleEntries]);

  const periodsByWeekday = useMemo(() => {
    const map = new Map<number, number[]>();
    for (const entry of teacherScheduleEntries) {
      const periods = map.get(entry.day) ?? [];
      if (!periods.includes(entry.period)) periods.push(entry.period);
      map.set(entry.day, periods);
    }
    for (const periods of map.values()) periods.sort((a, b) => a - b);
    return map;
  }, [teacherScheduleEntries]);

  const scheduleSlots = useMemo(
    () =>
      teacherScheduleEntries.map((entry) => ({
        day: entry.day,
        classId: entry.classId,
        subjectId: entry.subjectId,
        period: entry.period,
      })),
    [teacherScheduleEntries],
  );

  const checkedSessionKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const record of attendance) {
      if (String(record.academicYearId) !== String(academicYearId)) continue;
      if (Number(record.semester) !== Number(semester)) continue;
      if (
        !matchesTeacherIdentity(record.teacherId, teacherIdentityKeys)
        && record.teacherId !== teacherId
      ) {
        continue;
      }
      keys.add(`${record.date}|${record.classId}|${record.subjectId}|${Number(record.period)}`);
    }
    return keys;
  }, [academicYearId, attendance, semester, teacherId, teacherIdentityKeys]);

  const teacherDeptKey = useMemo(() => {
    const profile = teachers.find((t) => t.id === teacherId || t.userId === teacherId);
    return departmentToSemesterKey(profile?.department);
  }, [teacherId, teachers]);

  const academicYearRange = useMemo(
    () =>
      resolveSemesterDateRange(
        academicYearId || activeYear?.year || '',
        semester,
        activeYear,
        calendarEvents,
        deptSemesterSettings,
        isTeacherPicker ? teacherDeptKey : undefined,
      ),
    [
      academicYearId,
      activeYear,
      calendarEvents,
      deptSemesterSettings,
      isTeacherPicker,
      semester,
      teacherDeptKey,
    ],
  );

  const selectedDayEntries = useMemo(() => {
    if (!selectedCalendarDate) return [];
    const schoolDay = toSchoolDay(selectedCalendarDate);
    return teacherScheduleEntries
      .filter((entry) => entry.day === schoolDay)
      .sort((a, b) => a.period - b.period || a.classId.localeCompare(b.classId));
  }, [selectedCalendarDate, teacherScheduleEntries]);

  const classNameById = useMemo(
    () => Object.fromEntries(classes.map((c) => [c.id, c.className])),
    [classes],
  );

  const effectiveSelectedClassId = useMemo(() => {
    if (selectedEntry?.classId) return selectedEntry.classId;
    if (isAdminOverview && selectedClassId) return selectedClassId;
    if (selectedClassId && (isTeacherPicker || filteredClasses.some(cls => cls.id === selectedClassId))) {
      return selectedClassId;
    }
    if (!selectedRoom) return '';
    if (selectedClassId && filteredClasses.some(cls => cls.id === selectedClassId)) {
      return selectedClassId;
    }
    return filteredClasses[0]?.id ?? '';
  }, [filteredClasses, isAdminOverview, isTeacherPicker, selectedClassId, selectedEntry?.classId, selectedRoom]);

  const adminSubjectCards = useMemo(() => {
    if (!isAdminOverview) return [];

    const targetClassIds = new Set<string>();
    if (selectedClassId) {
      targetClassIds.add(selectedClassId);
    } else if (selectedLevel && selectedDept !== 'all') {
      adminClassOptions.forEach((cls) => targetClassIds.add(cls.id));
    }

    if (targetClassIds.size === 0) return [];

    const map = new Map<string, {
      subjectId: string;
      subjectCode: string;
      subjectName: string;
      subjectGroup?: string;
      classId: string;
      className: string;
      teacherId: string;
      teacherName: string;
      teacherFirstName: string;
      teacherLastName: string;
      teacherPhotoURL?: string;
    }>();

    for (const e of scheduleEntries) {
      if (String(e.year) !== String(academicYearId)) continue;
      if (Number(e.semester) !== Number(semester)) continue;
      if (!targetClassIds.has(e.classId)) continue;

      const key = `${e.subjectId}_${e.classId}`;
      if (map.has(key)) continue;

      const teacher = teachersById[e.teacherId];
      const parts = (e.teacherName || '').trim().split(/\s+/).filter(Boolean);
      const teacherFirstName = teacher?.firstName
        || (parts.length >= 2 ? parts.slice(0, -1).join(' ') : (e.teacherName || ''));
      const teacherLastName = teacher?.lastName
        || (parts.length >= 2 ? parts[parts.length - 1]! : '');

      map.set(key, {
        subjectId: e.subjectId,
        subjectCode: e.subjectCode,
        subjectName: targetClassIds.size > 1
          ? `${e.subjectName} (${classNameById[e.classId] ?? e.classId})`
          : e.subjectName,
        subjectGroup: e.subjectGroup,
        classId: e.classId,
        className: classNameById[e.classId] ?? e.classId,
        teacherId: e.teacherId,
        teacherName: e.teacherName,
        teacherFirstName,
        teacherLastName,
        teacherPhotoURL: teacher?.photoURL,
      });
    }

    return [...map.values()].sort((a, b) =>
      a.subjectCode.localeCompare(b.subjectCode, 'th') || a.className.localeCompare(b.className, 'th'),
    );
  }, [academicYearId, classNameById, isAdminOverview, scheduleEntries, semester, teachersById, selectedClassId, selectedLevel, selectedDept, adminClassOptions]);

  const { periodTimes } = useScheduleSettings(effectiveSelectedClassId);

  const effectiveSelectedSubjectId = selectedEntry?.subjectId
    ?? selectedSubjectId
    ?? mySubjects[0]?.id
    ?? '';

  const selectedClass = useMemo(
    () => classes.find(cls => cls.id === effectiveSelectedClassId) ?? null,
    [classes, effectiveSelectedClassId],
  );

  const selectedSubject = useMemo(
    () => mySubjects.find(subject => subject.id === effectiveSelectedSubjectId) ?? null,
    [effectiveSelectedSubjectId, mySubjects],
  );

  const classEntries = useMemo(
    () =>
      scheduleEntries.filter(
        entry =>
          entry.classId === effectiveSelectedClassId &&
          String(entry.year) === String(academicYearId) &&
          Number(entry.semester) === Number(semester),
      ),
    [academicYearId, effectiveSelectedClassId, scheduleEntries, semester],
  );

  const relevantAttendance = useMemo(
    () =>
      attendance.filter(
        record =>
          (matchesTeacherIdentity(record.teacherId, teacherIdentityKeys) || record.teacherId === teacherId) &&
          String(record.academicYearId) === String(academicYearId) &&
          Number(record.semester) === Number(semester),
      ),
    [academicYearId, attendance, semester, teacherId, teacherIdentityKeys],
  );

  const sessionStats = useMemo(() => {
    return rows.reduce<Record<AttendanceStatus, number>>((acc, row) => {
      if (row.status) {
        acc[row.status] += 1;
      }
      return acc;
    }, {
      present: 0,
      late: 0,
      absent: 0,
      excused: 0,
      leave: 0,
    });
  }, [rows]);

  const overallStats = useMemo(() => {
    return relevantAttendance.reduce<Record<AttendanceStatus, number>>((acc, row) => {
      if (row.status) {
        acc[row.status] += 1;
      }
      return acc;
    }, {
      present: 0,
      late: 0,
      absent: 0,
      excused: 0,
      leave: 0,
    });
  }, [relevantAttendance]);

  const recentAttendance = useMemo(
    () =>
      [...relevantAttendance]
        .sort((a, b) =>
          b.date.localeCompare(a.date)
          || b.period - a.period
          || a.studentName.localeCompare(b.studentName, 'th'),
        )
        .slice(0, 24),
    [relevantAttendance],
  );

  const { playPop, playSuccess } = useSoundEffects();


  // Auto-sync rows when students/attendance data becomes available
  // (เช่น Firestore โหลดเสร็จหลังเลือกคาบ — รวม drawer ของครูที่ viewMode ยังเป็น schedule)
  useEffect(() => {
    const drawerActive = isTeacherPicker && attendanceDrawerOpen;
    const pageActive = viewMode === 'attendance' && !!effectiveSelectedClassId;
    if (!drawerActive && !pageActive) return;

    const targetSubjectId = selectedEntry?.subjectId || selectedSubjectId;
    const targetClassId = selectedEntry?.classId || effectiveSelectedClassId;
    const targetPeriod = selectedEntry?.period || selectedPeriod;
    if (!targetSubjectId || !targetClassId || !targetPeriod) return;

    const freshRows = buildRowsForSession(
      targetSubjectId,
      targetClassId,
      selectedDate,
      targetPeriod,
    );
    if (freshRows.length === 0) return;

    const currentRows = rowsRef.current;
    const hasCountChanged = freshRows.length !== currentRows.length;
    const hasStatusFromServer = freshRows.some((fr) => fr.status != null);
    const currentAllUnchecked = currentRows.every((r) => r.status == null);

    // ตรวจสอบว่ามีการลาที่เพิ่งได้รับอนุมัติ แต่ยังไม่ถูก reflect ใน rows ปัจจุบัน
    const newlyApprovedLeaveStudents = freshRows.filter(fr => {
      if (fr.status !== 'leave' || !fr.autoFilledLeave) return false;
      const existing = currentRows.find(r => r.studentId === fr.studentId);
      return !existing || existing.status !== 'leave';
    });

    if (hasCountChanged || (hasStatusFromServer && currentAllUnchecked)) {
      setRows(freshRows);
      if (hasStatusFromServer && currentAllUnchecked) {
        setSaved(true);
        setAllPresentSnapshot(null);
      }
      return;
    }

    if (newlyApprovedLeaveStudents.length > 0) {
      setRows(prev =>
        prev.map(row => {
          const freshRow = newlyApprovedLeaveStudents.find(fr => fr.studentId === row.studentId);
          if (!freshRow) return row;
          if (row.status === null || row.status === 'leave') {
            return { ...row, status: 'leave', note: freshRow.note, autoFilledLeave: true };
          }
          return row;
        }),
      );
    }
  }, [
    attendance,
    attendanceDrawerOpen,
    buildRowsForSession,
    effectiveSelectedClassId,
    isTeacherPicker,
    selectedDate,
    selectedEntry?.classId,
    selectedEntry?.period,
    selectedEntry?.subjectId,
    selectedPeriod,
    selectedSubjectId,
    viewMode,
  ]);

  const setStatus = (studentId: string, status: AttendanceStatus) => {
    if (isAttendanceReadOnly) {
      toast.error(isPastSession ? 'ไม่สามารถเช็กชื่อย้อนหลังได้' : 'ยังไม่ถึงวันสอน ไม่สามารถเช็กชื่อได้');
      return;
    }

    const row = rowsRef.current.find((r) => r.studentId === studentId);
    if (!row) return;

    const nextStatus = row.status === status ? null : status;
    if (nextStatus === 'leave') {
      const approved = findApprovedStudentLeave(leaveRequests, row, selectedDate);
      if (!approved) {
        toast.error('เช็ก «ลา» ได้เฉพาะเมื่อมีใบลาที่อนุมัติแล้ว');
        return;
      }
    }

    playPop();
    setRows(prev =>
      prev.map(r => {
        if (r.studentId !== studentId) return r;
        return {
          ...r,
          status: nextStatus,
          autoFilledLeave: nextStatus === 'leave' ? true : false,
        };
      }),
    );
    setSaved(false);
    setAllPresentSnapshot(null);
  };


  const handleSlotClick = (entry: ScheduleEntry, dateOverride?: string) => {
    const nextDate = dateOverride ?? resolveNearestClassDate(entry.day);
    const nextRows = buildRowsForSession(entry.subjectId, entry.classId, nextDate, entry.period);
    const matchedClass = classes.find((c) => c.id === entry.classId);
    const past = nextDate < todayDate;
    const future = nextDate > todayDate;
    const hasSavedStatuses = nextRows.some((row) => row.status != null && !row.autoFilledLeave);

    setSelectedEntry(entry);
    setSelectedClassId(entry.classId);
    setSelectedSubjectId(entry.subjectId);
    setSelectedPeriod(entry.period);
    setSelectedDate(nextDate);
    if (matchedClass) {
      setSelectedLevel(matchedClass.gradeLevel);
      setSelectedRoom(matchedClass.roomNumber);
      if (matchedClass.departmentId) setSelectedDept(matchedClass.departmentId);
    }
    setRows(nextRows);
    setSearchQuery('');
    setSaved(past || future || hasSavedStatuses);
    setAllPresentSnapshot(null);
    setSubView('today');
    if (isTeacherPicker) {
      setAttendanceDrawerOpen(true);
      setViewMode('schedule');
    } else {
      setViewMode('attendance');
    }
  };

  const handleCalendarDaySelect = (day: Date) => {
    const dateStr = toDateStr(day);
    if (dateStr < academicYearRange.start || dateStr > academicYearRange.end) return;
    setSelectedCalendarDate(day);
    setDaySubjectsDrawerOpen(true);
  };

  const handleDaySubjectSelect = (entry: ScheduleEntry) => {
    if (!selectedCalendarDate) return;
    setDaySubjectsDrawerOpen(false);
    handleSlotClick(entry, toDateStr(selectedCalendarDate));
  };

  // ── Auto-select current session ──────────────────────────────────────────
  useEffect(() => {
    if (isTeacherPicker || isAdminOverview) return;
    if (selectedEntry || classEntries.length === 0 || Object.keys(periodTimes).length === 0) return;

    const now = new Date();
    const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay();
    if (dayOfWeek > 5) return;

    const currentTime = now.getHours() * 60 + now.getMinutes();

    let currentPeriod = -1;
    Object.entries(periodTimes).forEach(([p, timeRange]) => {
      const [start, end] = timeRange.split(' - ');
      if (!start) return;

      const [hS, mS] = start.split(':').map(Number);
      const startTime = hS * 60 + mS;

      let endTime = startTime + 50;
      if (end) {
        const [hE, mE] = end.split(':').map(Number);
        endTime = hE * 60 + mE;
      }

      if (currentTime >= startTime && currentTime <= endTime + 10) {
        currentPeriod = Number(p);
      }
    });

    if (currentPeriod === -1) return;

    const entry = classEntries.find(e => e.day === dayOfWeek && e.period === currentPeriod);
    if (!entry) return;

    const nextDate = resolveNearestClassDate(entry.day);
    const nextRows = buildRowsForSession(entry.subjectId, entry.classId, nextDate, entry.period);

    setSelectedEntry(entry);
    setSelectedClassId(entry.classId);
    setSelectedSubjectId(entry.subjectId);
    setSelectedPeriod(entry.period);
    setSelectedDate(nextDate);
    setRows(nextRows);
    setSearchQuery('');
    setSaved(false);
    setSubView('today');
    setViewMode('attendance');
  }, [
    buildRowsForSession,
    classEntries,
    isAdminOverview,
    isTeacherPicker,
    periodTimes,
    selectedEntry,
  ]);

  const handleSave = useCallback(async (silent = false) => {
    if (!selectedEntry || !selectedClass) return;
    if (selectedDate < todayDate) {
      if (!silent) toast.error('ไม่สามารถเช็กชื่อย้อนหลังได้');
      return;
    }
    if (selectedDate > todayDate) {
      if (!silent) toast.error('ยังไม่ถึงวันสอน ไม่สามารถเช็กชื่อได้');
      return;
    }

    const validRows = rows.filter((row) => {
      if (row.status === null) return false;
      if (row.status !== 'leave') return true;
      return !!findApprovedStudentLeave(leaveRequests, row, selectedDate);
    });

    if (!silent) setSaving(true);

    try {
      const subjectName = selectedEntry.subjectName || selectedSubject?.name || '';
      const records: NewAttendanceRecord[] = validRows.map(row => ({
        studentId: row.studentId,
        studentName: row.studentName,
        studentCode: row.studentCode,
        subjectId: selectedEntry.subjectId,
        subjectName,
        classId: selectedClass.id,
        className: selectedClass.className,
        teacherId,
        departmentId: selectedClass.departmentId,
        academicYearId,
        semester,
        date: selectedDate,
        period: selectedPeriod,
        status: row.status as AttendanceStatus,
        note: row.note.trim(),
      }));

      await onSave(records);
      if (!silent) playSuccess();
      setSaved(true);
      if (!silent) toast.success(`บันทึกเช็คชื่อ ${records.length} คนเรียบร้อยแล้ว`);
    } catch (error) {
      console.error(error);
      if (!silent) toast.error('บันทึกเช็คชื่อไม่สำเร็จ');
    } finally {
      if (!silent) setSaving(false);
    }
  }, [
    academicYearId,
    leaveRequests,
    onSave,
    playSuccess,
    selectedClass,
    selectedDate,
    selectedEntry,
    selectedPeriod,
    selectedSubject?.name,
    semester,
    teacherId,
    todayDate,
    rows,
  ]);

  // Auto-save logic removed per user request
  // Auto-persist for approved leave that was auto-filled by system.
  const handleSelectAll = () => {
    playPop();
    setRows(prev => prev.map(row => ({ ...row, status: 'present', autoFilledLeave: false })));
    setSaved(false);
  };

  const handleToggleAllPresent = () => {
    if (isAttendanceReadOnly) {
      toast.error(isPastSession ? 'ไม่สามารถเช็กชื่อย้อนหลังได้' : 'ยังไม่ถึงวันสอน ไม่สามารถเช็กชื่อได้');
      return;
    }
    playPop();
    if (allPresentSnapshot) {
      setRows(allPresentSnapshot);
      setAllPresentSnapshot(null);
      setSaved(false);
      return;
    }
    setAllPresentSnapshot(rows);
    setRows((prev) =>
      prev.map((row) =>
        row.status === 'leave' ? row : { ...row, status: 'present', autoFilledLeave: false },
      ),
    );
    setSaved(false);
  };

  const handleCancelAll = () => {
    playPop();
    setRows(prev => prev.map(row => ({ ...row, status: null, autoFilledLeave: false })));
    setSaved(false);
    setAllPresentSnapshot(null);
  };

  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) return rows;
    const query = searchQuery.toLowerCase();
    return rows.filter(
      row =>
        row.studentName.toLowerCase().includes(query)
        || row.studentCode.toLowerCase().includes(query),
    );
  }, [rows, searchQuery]);

  const handleDeptSelect = (val: DepartmentFilter) => {
    setSelectedDept(val);
    setSelectedLevel(null);
    setSelectedRoom(null);
    setSelectedClassId('');
    setAttendanceDrawerOpen(false);
    setAdminSummary(null);
    if (viewMode === 'attendance') {
      setViewMode('schedule');
      setSelectedEntry(null);
    }
  };

  const handleLevelSelect = (val: string) => {
    setSelectedLevel(val);
    setSelectedRoom(null);
    setSelectedClassId('');
    setAdminSummary(null);
  };

  const handleRoomSelect = (val: string) => {
    setSelectedRoom(val);
    setAdminSummary(null);
    const matched = classes.find(c =>
      c.departmentId === selectedDept &&
      c.gradeLevel === selectedLevel &&
      c.roomNumber === val
    );
    if (matched) {
      setSelectedClassId(matched.id);
      if (viewMode === 'attendance') {
        setViewMode('schedule');
        setSelectedEntry(null);
      }
    }
  };

  const handleAdminSelectClass = (classId: string) => {
    const matched = classes.find((c) => c.id === classId);
    setSelectedClassId(classId);
    setSelectedRoom(matched?.roomNumber ?? null);
    if (matched?.gradeLevel) setSelectedLevel(matched.gradeLevel);
    if (matched?.departmentId) {
      setSelectedDept(matched.departmentId as DepartmentFilter);
    }
    setAdminSummary(null);
  };

  const handlePickerBack = () => {
    if (isAdminOverview && adminSummary) {
      setAdminSummary(null);
      return;
    }
    if (attendanceDrawerOpen) {
      setAttendanceDrawerOpen(false);
      setSaved(false);
      setAllPresentSnapshot(null);
      setDaySubjectsDrawerOpen(true);
      return;
    }
    if (daySubjectsDrawerOpen) {
      setDaySubjectsDrawerOpen(false);
      return;
    }
    if (viewMode === 'attendance') {
      setViewMode('schedule');
      setSelectedEntry(null);
      return;
    }
    if (isTeacherPicker) return;
    if (selectedRoom || (isAdminOverview && selectedClassId)) {
      setSelectedRoom(null);
      setSelectedClassId('');
      setAdminSummary(null);
      // Admin sidebar: stay on grade. Other roles: also clear level (legacy coverflow).
      if (!isAdminOverview) {
        setSelectedLevel(null);
        setSelectedEntry(null);
        setViewMode('schedule');
      }
      return;
    }
    if (selectedLevel) {
      setSelectedLevel(null);
      setSelectedRoom(null);
      return;
    }
    if (selectedDept !== 'all') {
      setSelectedDept('all');
      setSelectedLevel(null);
      setSelectedRoom(null);
    }
  };

  // Header back (desktop กลับไปเมนู / mobile กลับเมนู) → step back in class picker
  useEffect(() => {
    const inPickerFlow = isTeacherPicker
      ? attendanceDrawerOpen || daySubjectsDrawerOpen
      : isAdminOverview
        ? selectedDept !== 'all' || !!selectedLevel || !!selectedRoom || !!selectedClassId || !!adminSummary
        : selectedDept !== 'all'
          || !!selectedLevel
          || !!selectedRoom
          || viewMode === 'attendance';
    if (!inPickerFlow) return;

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
      handlePickerBack();
    };

    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [adminSummary, attendanceDrawerOpen, daySubjectsDrawerOpen, selectedDept, selectedLevel, selectedRoom, selectedClassId, viewMode, isTeacherPicker, isAdminOverview]);

  return (
    <>
      {isTeacherPicker && (
        <>
          <TeacherDaySubjectsDrawer
            open={daySubjectsDrawerOpen}
            onOpenChange={setDaySubjectsDrawerOpen}
            date={selectedCalendarDate}
            entries={selectedDayEntries}
            classNameById={classNameById}
            onSelectEntry={handleDaySubjectSelect}
          />
          <TeacherAttendanceDrawer
            open={attendanceDrawerOpen}
            onOpenChange={(open) => {
              setAttendanceDrawerOpen(open);
              if (!open) {
                setSaved(false);
                setAllPresentSnapshot(null);
              }
            }}
            onBackToSubjects={() => {
              setAttendanceDrawerOpen(false);
              setSaved(false);
              setAllPresentSnapshot(null);
              setDaySubjectsDrawerOpen(true);
            }}
            period={selectedPeriod}
            subjectName={selectedEntry?.subjectName || selectedSubject?.name || ''}
            className={selectedClass?.className || selectedEntry?.classId || ''}
            rows={rows}
            loading={!isRosterDataLoaded && rows.length === 0}
            saving={saving}
            locked={saved || isAttendanceReadOnly}
            readOnly={isAttendanceReadOnly}
            readOnlyReason={
              isPastSession ? 'ดูอย่างเดียว' : isFutureSession ? 'ยังไม่ถึงวันสอน' : undefined
            }
            muteStatusColors={isFutureSession}
            canSetLeave={(studentId) => {
              const row = rows.find((r) => r.studentId === studentId);
              if (!row) return false;
              return !!findApprovedStudentLeave(leaveRequests, row, selectedDate);
            }}
            onUnlock={() => {
              if (isAttendanceReadOnly) {
                toast.error(isPastSession ? 'ไม่สามารถเช็กชื่อย้อนหลังได้' : 'ยังไม่ถึงวันสอน ไม่สามารถเช็กชื่อได้');
                return;
              }
              setSaved(false);
            }}
            onSave={() => handleSave()}
            onToggleAllPresent={handleToggleAllPresent}
            allPresentActive={allPresentSnapshot !== null}
            onSetStatus={setStatus}
          />
        </>
      )}

      <div className="flex min-h-0 flex-1 basis-0 flex-col overflow-hidden font-sukhumvit">
      <div className="relative flex min-h-0 flex-1 basis-0 flex-col overflow-hidden">
        <AnimatePresence mode="wait" initial={false}>
          {subView === 'today' ? (
            <motion.div
              key={isAdminOverview ? 'admin-picker' : viewMode}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col overflow-hidden"
            >
              {isTeacherPicker ? (
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                  {!scheduleReady ? (
                    <MonthCalendarSkeleton />
                  ) : teacherScheduleEntries.length === 0 ? (
                    <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-3 text-center">
                      <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-sm font-bold text-slate-400">
                        ยังไม่มีตารางสอนในปี/ภาคเรียนนี้
                      </p>
                    </div>
                  ) : (
                    <TeacherAttendanceMonthCalendar
                      className="min-h-0 flex-1"
                      teachingWeekdays={teachingWeekdays}
                      periodsByWeekday={periodsByWeekday}
                      scheduleSlots={scheduleSlots}
                      checkedSessionKeys={checkedSessionKeys}
                      rangeStart={academicYearRange.start}
                      rangeEnd={academicYearRange.end}
                      todayDate={todayDate}
                      onSelectDay={handleCalendarDaySelect}
                    />
                  )}
                </div>
              ) : isAdminOverview ? (
                <div className="flex min-h-0 flex-1 basis-0 flex-col gap-4 overflow-hidden lg:flex-row lg:items-stretch">
                  <div
                    className={cn(
                      'flex h-full min-h-0 w-full shrink-0 flex-col self-stretch overflow-hidden',
                      sidebarCollapsed ? 'lg:w-20 xl:w-20' : 'lg:w-[280px] xl:w-[300px]',
                      adminSummary ? 'hidden lg:flex' : 'flex min-h-0 flex-1 lg:flex-none',
                    )}
                  >
                    {!classesReady ? (
                      <div className="flex h-full min-h-0 flex-col gap-2 overflow-y-auto overscroll-y-contain scrollbar-hide rounded-2xl border border-border bg-card p-4">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Skeleton key={i} className="h-14 w-full shrink-0 rounded-2xl" />
                        ))}
                      </div>
                    ) : (
                      <GradeBookClassSidebar
                        selectedDept={selectedDept === 'all' ? '' : selectedDept}
                        selectedGrade={selectedLevel ?? ''}
                        selectedClassId={selectedClassId}
                        gradeOptions={gradeOptions}
                        classOptions={adminClassOptions}
                        onSelectDept={(dept: Department) => handleDeptSelect(dept)}
                        onSelectGrade={handleLevelSelect}
                        onSelectClass={handleAdminSelectClass}
                        collapsed={sidebarCollapsed}
                        headerAction={(
                          <SidebarCollapseButton
                            collapsed={sidebarCollapsed}
                            onToggle={() => setSidebarCollapsed((v) => !v)}
                          />
                        )}
                      >
                        {/* Subject list — shown when a room is selected */}
                        <AnimatePresence initial={false}>
                          {selectedClassId && scheduleReady && adminSubjectCards.length > 0 && (
                            <motion.section
                              key={`subjects-${selectedClassId}`}
                              initial={{ opacity: 0, y: 8 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -6 }}
                              className="pb-1"
                            >
                              <p className="mb-2 pl-1 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                                รายวิชา
                              </p>
                              <div className="flex flex-col gap-2">
                                {adminSubjectCards.map((card) => {
                                  const uniqKey = `${card.subjectId}_${card.classId}`;
                                  const active =
                                    adminSummary?.subjectId === card.subjectId &&
                                    adminSummary?.classId === card.classId;
                                  const color = subjectColorByName(card.subjectName, card.subjectGroup);

                                  return (
                                    <button
                                      key={uniqKey}
                                      type="button"
                                      onClick={() =>
                                        setAdminSummary({ subjectId: card.subjectId, classId: card.classId })
                                      }
                                      className={cn(
                                        'flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all shadow-sm',
                                      )}
                                      style={{
                                        backgroundColor: active ? color.text : color.bg,
                                        borderColor: active ? color.text : color.border,
                                      }}
                                    >
                                      <span
                                        className={cn(
                                          'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg shadow-sm',
                                          active ? 'bg-white/20' : 'bg-white'
                                        )}
                                        style={{ color: active ? '#ffffff' : color.text }}
                                      >
                                        <SubjectIcon
                                          subjectGroup={card.subjectGroup}
                                          size={16}
                                          className="text-current drop-shadow-sm"
                                        />
                                      </span>
                                      <span className="min-w-0 flex-1">
                                        <span
                                          className="block truncate text-[13px] font-black font-sukhumvit"
                                          style={{ color: active ? '#ffffff' : color.text }}
                                        >
                                          {card.subjectName}
                                        </span>
                                        <span
                                          className="block text-[10px] font-bold"
                                          style={{ color: active ? 'rgba(255,255,255,0.75)' : color.text, opacity: active ? 1 : 0.75 }}
                                        >
                                          {card.subjectCode}
                                        </span>
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            </motion.section>
                          )}
                        </AnimatePresence>
                      </GradeBookClassSidebar>
                    )}
                  </div>

                  <div
                    className={cn(
                      'relative flex min-h-0 flex-1 basis-0 flex-col self-stretch overflow-hidden rounded-2xl border border-border bg-card px-2 pb-2 sm:px-2.5 sm:pb-2.5',
                      !adminSummary && 'hidden lg:flex',
                    )}
                  >
                    {adminSummary ? (
                      <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-3 pb-6 pt-2 md:px-6">
                        <SummaryTab
                          mySubjects={mySubjects}
                          classes={classes}
                          attendance={attendance}
                          getStudentsForClass={getStudentsForClass}
                          lockedSubjectId={adminSummary.subjectId}
                          lockedClassId={adminSummary.classId}
                          calendarEvents={calendarEvents}
                          scheduleEntries={scheduleEntries}
                          rangeStart={academicYearRange.start}
                          rangeEnd={academicYearRange.end}
                        />
                      </div>
                    ) : (
                      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-6 py-10 text-center">
                        <HiBookOpen className="h-8 w-8 text-muted-foreground/40" />
                        <p className="font-sukhumvit text-[13px] font-black text-muted-foreground">
                          {selectedDept === 'all'
                            ? 'เลือกแผนกจากแถบด้านซ้าย'
                            : !selectedLevel
                              ? 'เลือกระดับชั้นเพื่อดูห้องเรียน'
                              : !selectedClassId
                                ? 'เลือกห้องเรียนเพื่อดูรายวิชา'
                                : 'เลือกรายวิชาจากแถบด้านซ้าย'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ) : viewMode === 'schedule' ? (
                !selectedRoom ? (
                  !classesReady ? (
                    <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-3 py-2 md:px-6">
                      <ClassPickerSkeleton />
                    </div>
                  ) : (
                    <ClassSelectionFlow
                      selectedDept={selectedDept}
                      selectedLevel={selectedLevel}
                      gradeOptions={gradeOptions}
                      roomOptions={roomOptions}
                      onSelectDept={(dept) => handleDeptSelect(dept)}
                      onSelectLevel={handleLevelSelect}
                      onSelectRoom={handleRoomSelect}
                    />
                  )
                ) : (
                  <div className="min-w-0 flex-1 overflow-auto px-3 md:px-6 pb-6 pt-2 scrollbar-hide">
                    <ScheduleGrid
                      classEntries={classEntries}
                      onSlotClick={handleSlotClick}
                      selectedSlotId={selectedEntry?.id ?? null}
                      classId={effectiveSelectedClassId}
                      attendance={relevantAttendance}
                      teachersById={teachersById}
                      getStudentsForClass={getStudentsForClass}
                    />
                  </div>
                )
              ) : (
                <div className="flex min-h-0 flex-1 flex-col px-3 md:px-6 pt-0">
                  <div className="mb-6 rounded-2xl border border-white bg-white/60 p-4 backdrop-blur-xl">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                      <div className="flex items-center gap-4">
                        <button
                          onClick={() => setViewMode('schedule')}
                          className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-100 bg-white text-slate-400 transition-all hover:border-blue-100 hover:text-blue-600"
                        >
                          <ArrowLeft size={18} strokeWidth={2.5} />
                        </button>
                        <div className="flex flex-col justify-center">
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            <h2 className="text-[16px] font-black leading-tight text-slate-800">
                              {selectedEntry?.subjectCode} {selectedEntry?.subjectName}
                            </h2>
                            <span className="hidden text-slate-200 xl:inline">|</span>
                            <div className="flex flex-wrap items-center gap-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
                              <span className="flex items-center gap-1.5">
                                <MapPin size={10} className="text-blue-500" />
                                ห้อง {selectedClass?.className || selectedEntry?.classId}
                              </span>
                              <span className="text-slate-200">|</span>
                              <span className="flex items-center gap-1.5">
                                <Clock size={10} className="text-amber-500" />
                                คาบที่ {selectedPeriod} {periodTimes[selectedPeriod] ? `(${periodTimes[selectedPeriod]})` : ''}
                              </span>
                              <span className="text-slate-200">|</span>
                              <span className="flex items-center gap-1.5">
                                <CheckSquare size={10} className="text-emerald-500" />
                                {formatSessionDate(selectedDate)}
                              </span>
                              {saved && (
                                <>
                                  <span className="text-slate-200">|</span>
                                  <span className="flex items-center justify-center text-emerald-600">
                                    <UserCheck size={10} />
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                    </div>


                    {/* Attendance Summary Single Stacked Bar */}
                    <div className="mt-4 w-full bg-white/50 backdrop-blur-md rounded-2xl p-5 border border-slate-200/60">
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-5 px-1">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-6">
                          <div className="flex flex-col justify-center">
                            <div className="flex items-baseline gap-2">
                              <span className="text-3xl font-black text-slate-800 tabular-nums">
                                {sessionStats.present + sessionStats.late + sessionStats.absent + sessionStats.leave}
                              </span>
                              <span className="text-sm font-bold text-slate-400">/ {rows.length}</span>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-x-5 gap-y-2 py-1 lg:border-l lg:border-slate-200 lg:pl-6">
                            {[
                              { label: 'มาเรียน', count: sessionStats.present, color: 'text-emerald-600', dot: 'bg-emerald-500' },
                              { label: 'สาย', count: sessionStats.late, color: 'text-amber-600', dot: 'bg-amber-500' },
                              { label: 'ขาดเรียน', count: sessionStats.absent, color: 'text-rose-600', dot: 'bg-rose-500' },
                              { label: 'ลา', count: sessionStats.leave, color: 'text-indigo-600', dot: 'bg-indigo-500' },
                            ].map((item) => (
                              <div key={item.label} className="flex items-center gap-2">
                                <div className={`w-1.5 h-1.5 rounded-full ${item.dot}`} />
                                <div className="flex flex-col leading-none">
                                  <span className={`text-xs font-black ${item.color} tabular-nums`}>{item.count}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row items-center gap-3">
                          {/* Search Input Integrated */}
                          <div className="relative w-full sm:w-[220px]">
                            <Search
                              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                              size={12}
                            />
                            <input
                              type="text"
                              placeholder="ค้นหาชื่อนักเรียน..."
                              value={searchQuery}
                              onChange={event => setSearchQuery(event.target.value)}
                              className="w-full rounded-xl border border-slate-200/60 bg-slate-50/50 py-2 pl-10 pr-3 text-[11px] font-bold outline-none transition-all focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100/50"
                            />
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleSave()}
                              disabled={saving}
                              title={saved ? 'บันทึกแล้ว' : 'บันทึกเช็คชื่อ'}
                              className={`flex h-9 w-9 items-center justify-center rounded-xl transition-all ${
                                saved
                                  ? 'bg-emerald-500 text-white'
                                  : 'bg-blue-600 text-white hover:scale-105 active:scale-95'
                              } disabled:opacity-50`}
                            >
                              {saving ? (
                                <div className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                              ) : saved ? (
                                <CheckCircle size={14} />
                              ) : (
                                <Save size={14} />
                              )}
                            </button>

                            <div className="h-6 w-px bg-slate-200 mx-1" />

                            <button
                              onClick={handleSelectAll}
                              title="มาทุกคน"
                              className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 transition-all hover:bg-emerald-500 hover:text-white"
                            >
                              <CheckSquare size={16} />
                            </button>
                            <button
                              onClick={handleCancelAll}
                              title="ล้างทั้งหมด"
                              className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-50 text-slate-400 border border-slate-100 transition-all hover:bg-rose-50 hover:text-rose-500 hover:border-rose-100"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="h-3 w-full bg-slate-100/50 rounded-full overflow-hidden flex gap-0.5 p-0.5 border border-slate-200/50 shadow-inner">
                        {rows.length > 0 ? (
                          <>
                            <motion.div 
                              initial={{ width: 0 }} 
                              animate={{ width: `${(sessionStats.present / rows.length) * 100}%` }} 
                              className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-l-full shadow-[0_0_10px_rgba(16,185,129,0.2)]" 
                            />
                            <motion.div 
                              initial={{ width: 0 }} 
                              animate={{ width: `${(sessionStats.late / rows.length) * 100}%` }} 
                              className="h-full bg-gradient-to-r from-amber-400 to-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.2)]" 
                            />
                            <motion.div 
                              initial={{ width: 0 }} 
                              animate={{ width: `${(sessionStats.absent / rows.length) * 100}%` }} 
                              className="h-full bg-gradient-to-r from-rose-400 to-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.2)]" 
                            />
                            <motion.div 
                              initial={{ width: 0 }} 
                              animate={{ width: `${(sessionStats.leave / rows.length) * 100}%` }} 
                              className="h-full bg-gradient-to-r from-indigo-400 to-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.2)]" 
                            />
                            <motion.div 
                              initial={{ width: 0 }} 
                              animate={{ 
                                width: `${((rows.length - (sessionStats.present + sessionStats.late + sessionStats.absent + sessionStats.leave)) / rows.length) * 100}%` 
                              }} 
                              className="h-full bg-slate-200/50 rounded-r-full" 
                            />
                          </>
                        ) : (
                          <div className="w-full h-full bg-slate-100 rounded-full" />
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto pb-8 pr-2 scrollbar-hide">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                      {!isRosterDataLoaded && filteredRows.length === 0 ? (
                        <div className="col-span-full">
                          <StudentRosterSkeleton count={8} />
                        </div>
                      ) : filteredRows.length === 0 ? (
                        <div className="col-span-full flex flex-col items-center justify-center py-20 text-slate-400">
                          <Users size={48} className="mb-4 opacity-20" />
                          <p className="text-sm font-black">ไม่พบรายชื่อนักเรียนในห้องนี้</p>
                          <p className="mt-1 text-xs font-bold opacity-60">
                            กรุณาตรวจสอบการลงทะเบียนเรียนในปีการศึกษา {academicYearId} ภาคเรียนที่ {semester}
                          </p>
                        </div>
                      ) : (
                        filteredRows.map(student => {
                          const statusConfig = student.status ? STATUS_CONFIG[student.status] : null;

                          return (
                            <motion.div
                              key={student.studentId}
                              layout
                              className={cn(
                                "rounded-2xl border p-4 backdrop-blur-sm transition-all",
                                statusConfig 
                                  ? `${statusConfig.gradient} ${statusConfig.border}` 
                                  : "border-slate-200 bg-white/60 hover:border-blue-300"
                              )}
                            >
                            <div className="mb-5 flex items-center gap-3">
                                <StudentAvatar 
                                  photoURL={student.imageUrl}
                                  studentId={student.studentId}
                                  name={student.studentName}
                                  gender={student.gender}
                                  className="h-12 w-12 rounded-xl"
                                />
                              <div className="min-w-0 flex-1">
                                <h4 className="truncate text-[14px] font-black leading-tight text-slate-800">
                                  {student.studentName}
                                </h4>
                                <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                  {student.studentCode}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center justify-between px-2 pt-1 pb-2">
                              {STATUS_BUTTONS.map(status => {
                                const config = STATUS_CONFIG[status];
                                const active = student.status === status;

                                return (
                                  <div key={status} className="flex flex-col items-center gap-1.5">
                                    {/* Indicator Dot */}
                                    <div 
                                      className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                                        active ? 'scale-110' : 'bg-slate-200 opacity-50'
                                      }`}
                                      style={{ 
                                        backgroundColor: active ? config.color : undefined
                                      }}
                                    />
                                    
                                    {/* Main Knob Button */}
                                    <button
                                      onClick={() => setStatus(student.studentId, status)}
                                      disabled={
                                        isAttendanceReadOnly
                                        || (status === 'leave'
                                          && !findApprovedStudentLeave(leaveRequests, student, selectedDate))
                                      }
                                      title={
                                        isPastSession
                                          ? 'ไม่สามารถเช็กชื่อย้อนหลังได้'
                                          : isFutureSession
                                            ? 'ยังไม่ถึงวันสอน'
                                          : status === 'leave'
                                            ? 'ลาได้เฉพาะเมื่อมีใบลาที่อนุมัติแล้ว'
                                            : undefined
                                      }
                                      className={`w-11 h-11 rounded-full transition-all duration-300 flex items-center justify-center border-2 ${
                                        isFutureSession
                                          ? 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed'
                                          : active 
                                          ? 'scale-105' 
                                          : 'bg-slate-50 border-slate-100 hover:border-slate-200 hover:bg-white'
                                      }`}
                                      style={
                                        isFutureSession
                                          ? undefined
                                          : {
                                              borderColor: active ? config.color : undefined,
                                              background: active ? `linear-gradient(145deg, #ffffff, ${config.color}08)` : undefined,
                                            }
                                      }
                                    >
                                      <span 
                                        className={`text-[13px] font-black transition-colors duration-300 ${
                                          isFutureSession || !active ? 'text-slate-400' : ''
                                        }`}
                                        style={isFutureSession || !active ? undefined : { color: config.color }}
                                      >
                                        {config.shortLabel}
                                      </span>
                                    </button>

                                    {/* Bottom Status Text */}
                                    <span 
                                      className={`text-[9px] font-black tracking-tighter uppercase transition-all duration-300 ${
                                        active ? 'opacity-100 translate-y-0' : 'text-slate-300 opacity-50'
                                      }`}
                                      style={{ color: active ? config.color : undefined }}
                                    >
                                      {active ? 'ON' : 'OFF'}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </motion.div>
                        );
                      })
                      )}
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          ) : subView === 'history' ? (
            <motion.div
              key="history-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col overflow-hidden px-6 pb-6"
            >
              <div className="mb-4 flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                <h3 className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
                  ประวัติการเช็คชื่อล่าสุด
                </h3>
              </div>
              <div className="overflow-hidden rounded-2xl border border-black/[0.06] bg-white/70 backdrop-blur-md">
                <div className="grid grid-cols-[120px_1fr_120px_90px] border-b border-black/[0.06] bg-black/[0.02] px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
                  <span>วันที่</span>
                  <span>วิชา / นักเรียน</span>
                  <span>ห้อง / คาบ</span>
                  <span>สถานะ</span>
                </div>
                <div className="max-h-full overflow-y-auto scrollbar-hide">
                  {recentAttendance.length === 0 ? (
                    <div className="flex min-h-[220px] flex-col items-center justify-center gap-3 text-slate-400">
                      <History size={28} className="opacity-40" />
                      <p className="text-[12px] font-bold">ยังไม่มีประวัติการเช็คชื่อ</p>
                    </div>
                  ) : (
                    recentAttendance.map(record => {
                      const config = STATUS_CONFIG[record.status];
                      return (
                        <div
                          key={record.id}
                          className="grid grid-cols-[120px_1fr_120px_90px] items-center border-b border-black/[0.04] px-4 py-3 text-[12px] last:border-b-0"
                        >
                          <div className="font-bold text-slate-500">{formatSessionDate(record.date)}</div>
                          <div className="min-w-0">
                            <p className="truncate font-black text-slate-800">{record.subjectName}</p>
                            <p className="truncate text-[11px] font-medium text-slate-400">
                              {record.studentName}
                            </p>
                          </div>
                          <div className="text-[11px] font-bold text-slate-500">
                            <p>ห้อง {record.className}</p>
                            <p>คาบ {record.period}</p>
                          </div>
                          <div>
                            <span
                              className="inline-flex rounded-full px-2.5 py-1 text-[10px] font-black"
                              style={{ background: config.bg, color: config.color }}
                            >
                              {config.label}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="summary-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col overflow-hidden px-6 pb-6"
            >
              <div className="mb-5 flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                <h3 className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
                  สรุปผลการเช็คชื่อภาคเรียนนี้
                </h3>
              </div>

              <div className="w-full max-w-3xl bg-white/40 backdrop-blur-md rounded-2xl p-5 border border-white/60 shadow-sm">
                <div className="flex justify-between items-end mb-4 px-1">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">ภาพรวมทั้งภาคเรียน</span>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-black text-slate-800 tabular-nums">
                        {overallStats.present + overallStats.late + overallStats.absent + overallStats.leave}
                      </span>
                      <span className="text-sm font-bold text-slate-400 uppercase">ครั้ง (Total Records)</span>
                    </div>
                  </div>

                  <div className="flex gap-6 mb-1">
                    {[
                      { label: 'มาเรียน', count: overallStats.present, color: 'text-emerald-600', dot: 'bg-emerald-500' },
                      { label: 'สาย', count: overallStats.late, color: 'text-amber-600', dot: 'bg-amber-500' },
                      { label: 'ขาดเรียน', count: overallStats.absent, color: 'text-rose-600', dot: 'bg-rose-500' },
                      { label: 'ลา', count: overallStats.leave, color: 'text-indigo-600', dot: 'bg-indigo-500' },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center gap-2.5">
                        <div className={`w-2 h-2 rounded-full ${item.dot} shadow-sm`} />
                        <div className="flex flex-col leading-none">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{item.label}</span>
                          <span className={`text-sm font-black ${item.color} tabular-nums`}>{item.count.toLocaleString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="h-4 w-full bg-slate-100/50 rounded-full overflow-hidden flex gap-0.5 p-0.5 border border-slate-200/50 shadow-inner">
                  {(() => {
                    const total = overallStats.present + overallStats.late + overallStats.absent + overallStats.leave;
                    if (total === 0) return <div className="w-full h-full bg-slate-100 rounded-full" />;
                    return (
                      <>
                        <motion.div 
                          initial={{ width: 0 }} 
                          animate={{ width: `${(overallStats.present / total) * 100}%` }} 
                          className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-l-full shadow-[0_0_15px_rgba(16,185,129,0.2)]" 
                        />
                        <motion.div 
                          initial={{ width: 0 }} 
                          animate={{ width: `${(overallStats.late / total) * 100}%` }} 
                          className="h-full bg-gradient-to-r from-amber-400 to-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.2)]" 
                        />
                        <motion.div 
                          initial={{ width: 0 }} 
                          animate={{ width: `${(overallStats.absent / total) * 100}%` }} 
                          className="h-full bg-gradient-to-r from-rose-400 to-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.2)]" 
                        />
                        <motion.div 
                          initial={{ width: 0 }} 
                          animate={{ width: `${(overallStats.leave / total) * 100}%` }} 
                          className="h-full bg-gradient-to-r from-indigo-400 to-indigo-500 rounded-r-full shadow-[0_0_15px_rgba(99,102,241,0.2)]" 
                        />
                      </>
                    );
                  })()}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      </div>
    </>
  );
}
