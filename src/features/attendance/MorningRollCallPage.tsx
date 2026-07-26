import { useState, useMemo, useEffect, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, CheckCircle } from 'lucide-react';
import {
  HiOutlineDocumentText,
  HiPencilSquare,
  HiXMark,
  HiHomeModern,
  HiAcademicCap,
} from 'react-icons/hi2';
import { HEADER_ICON_BTN } from '@/lib/headerIconBtn';
import { ROLL_CALL_OPTIONS } from '@/features/attendance/rollCallUi';
import {
  ExamMobileFilterDrawer,
  ExamMobileFilterTriggerButton,
} from '@/features/exam/components/ExamMobileFilterMenuButton';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';
import { useActiveAcademicYear } from '@/hooks/useActiveAcademicYear';
import { useIsSchoolDayToday } from '@/hooks/useIsSchoolDayToday';
import { useClassroomManager } from '@/features/classes/hooks/useClassroomManager';
import {
  useMorningRollCall,
  useSaveMorningRollCall,
  getClassRollCallsByAcademicYear,
} from '@/hooks/useMorningRollCall';
import { useMorningRollCallClassStudents } from '@/hooks/useMorningRollCallClassStudents';
import { useStudentLeaveRequests } from '@/hooks/useLeaveRequests';
import { applyApprovedLeaveToMorningRollCallRows } from '@/lib/attendance/leaveRequestStudentMatch';
import type { RollCallStatus, StudentRollCall, MorningRollCallSession } from '@/types/morningRollCall';
import StudentAvatar from '@/features/students/components/StudentAvatar';
import type { Department } from '@/types/curriculum';
import { GRADE_LEVEL_ORDER, type ClassRoom } from '@/types/class';

function shortRoomLabel(room: ClassRoom): string {
  const n = String(room.roomNumber ?? '').trim();
  if (n) return n;
  const name = String(room.className ?? '').trim();
  return name.length > 4 ? name.slice(0, 4) : name || '—';
}
import { Button } from '@/components/ui/button';
import GradeBookClassSidebar from '@/features/grades/components/GradeBookClassSidebar';
import SidebarCollapseButton from '@/features/grades/components/SidebarCollapseButton';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { DRAWER_HEADER_ICON_BTN, DRAWER_HEADER_RIGHT_ACTIONS } from '@/lib/drawerHeaderBtn';
import { getLocalDateString } from '@/lib/dateUtils';
import { getClassesByYearStore } from '@/lib/firestoreShared/studentSummaryStore';
import { deptSemestersStore } from '@/lib/firestoreShared/deptSemestersStore';
import {
  departmentToSemesterKey,
  isDateInSemesterRange,
  resolveInterSemesterBreak,
} from '@/lib/teacherKpi/semesterDates';
import { toDateStr, toThaiFullDate } from '@/features/calendar/utils';
import { fallbackAcademicYearRange } from '@/features/teaching/components/TeacherAttendanceCalendar';
import { MorningRollCallMonthCalendar } from '@/features/attendance/components/MorningRollCallMonthCalendar';
import { cn } from '@/lib/utils';

interface StudentRowData extends StudentRollCall {
  enrollmentIndex: number;
}

const DRAWER_CONTENT_CLASS = cn(
  'flex h-dvh flex-col bg-transparent p-0 before:hidden',
  'data-[vaul-drawer-direction=right]:w-screen data-[vaul-drawer-direction=right]:max-w-none',
  'sm:h-full sm:data-[vaul-drawer-direction=right]:w-full sm:data-[vaul-drawer-direction=right]:max-w-md sm:p-2',
);

const DRAWER_PANEL_CLASS = cn(
  'flex h-full min-h-0 flex-col overflow-hidden bg-white',
  'sm:rounded-4xl sm:border sm:border-slate-200/70 sm:shadow-xl',
);

const noopSubscribe = () => () => {};
const notReadySnapshot = () => false;

function ClassPickerSkeleton() {
  return (
    <div className="flex w-full flex-col items-center gap-8 px-2" aria-busy="true" aria-label="กำลังโหลดห้องเรียน">
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

function ReportListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-2" aria-busy="true" aria-label="กำลังโหลดรายงาน">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="rounded-xl border border-slate-100 bg-white/70 px-3 py-2.5">
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-8 shrink-0 rounded-lg bg-slate-100" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-3 w-[50%] rounded-lg bg-slate-100" />
              <Skeleton className="h-2.5 w-[28%] rounded-lg bg-slate-50" />
            </div>
          </div>
          <div className="mt-2 grid grid-cols-4 gap-1.5">
            {Array.from({ length: 4 }, (_, cell) => (
              <Skeleton key={cell} className="h-10 rounded-lg bg-slate-50" />
            ))}
          </div>
        </div>
      ))}
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

export default function MorningRollCallPage() {
  const navigate = useNavigate();
  const { user, userData, role } = useAuth();
  const isAdmin = role === 'admin' || role === 'sysadmin';
  const { year, activeSemester, activeYear, isLoaded } = useActiveAcademicYear();
  const classMgr = useClassroomManager();
  const classesStore = year ? getClassesByYearStore(year) : null;
  const classesReady = useSyncExternalStore(
    classesStore?.subscribe ?? noopSubscribe,
    classesStore?.getReady ?? notReadySnapshot,
    classesStore?.getReady ?? notReadySnapshot,
  );
  const isPageLoading = !isLoaded || !year || !classesReady;
  const { mutate: saveRollCall, isPending: isSaving } = useSaveMorningRollCall();

  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null);
  const [dayDrawerOpen, setDayDrawerOpen] = useState(false);
  const { students: classStudents, loadingRoster: loadingClassStudents } = useMorningRollCallClassStudents(
    year ?? undefined,
    selectedClassId,
  );
  const [editMode, setEditMode] = useState(false);
  const [studentRows, setStudentRows] = useState<StudentRowData[]>([]);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'rollcall' | 'report'>('rollcall');
  const [reportSessions, setReportSessions] = useState<MorningRollCallSession[]>([]);
  const [isLoadingReport, setIsLoadingReport] = useState(false);
  const [reportFrom, setReportFrom] = useState('');
  const [reportTo, setReportTo] = useState('');
  const [reportFilterOpen, setReportFilterOpen] = useState(false);
  const [filterDept, setFilterDept] = useState<Department | 'all'>('all');
  const [filterGradeLevel, setFilterGradeLevel] = useState('');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [optimisticSession, setOptimisticSession] = useState<MorningRollCallSession | null>(null);

  const [headerRightPortalEl, setHeaderRightPortalEl] = useState<HTMLElement | null>(null);
  const [headerMobileActionsEl, setHeaderMobileActionsEl] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setHeaderRightPortalEl(document.getElementById('header-portal-right-actions'));
    setHeaderMobileActionsEl(document.getElementById('header-portal-mobile-actions'));
  }, []);

  const today = getLocalDateString();
  const rollCallDate = selectedDateStr;
  const deptSemesterSettings = useSyncExternalStore(
    deptSemestersStore.subscribe,
    deptSemestersStore.getSnapshot,
    deptSemestersStore.getSnapshot,
  );
  const { isHoliday: isRollCallBlocked, isWeekend, holidayTitle } = useIsSchoolDayToday(
    role ?? undefined,
    rollCallDate ?? today,
  );
  const { requests: leaveRequests } = useStudentLeaveRequests(rollCallDate ?? today);
  const { data: fetchedSession } = useMorningRollCall(selectedClassId, rollCallDate);
  const existingSession = optimisticSession ?? fetchedSession;

  const selectedClass = useMemo(
    () => classMgr.classes?.find((c: any) => c.id === selectedClassId),
    [classMgr.classes, selectedClassId],
  );

  const interSemesterBreak = useMemo(() => {
    const deptKey = departmentToSemesterKey(
      (selectedClass?.departmentId as Department | undefined) ?? null,
    );
    return resolveInterSemesterBreak(deptSemesterSettings, deptKey);
  }, [deptSemesterSettings, selectedClass?.departmentId]);

  const isInterSemesterBreakDay = Boolean(
    rollCallDate && isDateInSemesterRange(rollCallDate, interSemesterBreak),
  );

  const isDateEditable = Boolean(
    rollCallDate && rollCallDate === today && !isInterSemesterBreakDay,
  );
  const isDateEditableIgnoringHoliday = isDateEditable && !isRollCallBlocked;
  const isReadOnly = !isDateEditableIgnoringHoliday || Boolean(existingSession && !editMode);
  const isRollCallLocked = Boolean(isReadOnly || !isDateEditableIgnoringHoliday);

  const academicYearRange = useMemo(() => {
    const configuredStart = activeYear?.startDate?.trim() ?? '';
    const configuredEnd = activeYear?.endDate?.trim() ?? '';
    if (configuredStart && configuredEnd && configuredStart <= configuredEnd) {
      return { start: configuredStart, end: configuredEnd };
    }
    return fallbackAcademicYearRange(year || activeYear?.year || '');
  }, [activeYear?.endDate, activeYear?.startDate, activeYear?.year, year]);

  const sessionDates = useMemo(
    () => new Set(reportSessions.map((s) => s.date)),
    [reportSessions],
  );

  useEffect(() => {
    setOptimisticSession(null);
    setEditMode(false);
    setStudentRows([]);
    setSaveError(null);
  }, [selectedClassId, selectedDateStr]);

  useEffect(() => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 30);
    setReportTo(to.toISOString().slice(0, 10));
    setReportFrom(from.toISOString().slice(0, 10));
  }, []);

  const defaultReportRange = useMemo(() => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 30);
    return {
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
    };
  }, [today]);

  const hasActiveReportFilter =
    Boolean(reportFrom && reportTo) &&
    (reportFrom !== defaultReportRange.from || reportTo !== defaultReportRange.to);

  const resetReportDateFilter = () => {
    setReportFrom(defaultReportRange.from);
    setReportTo(defaultReportRange.to);
  };

  const homeRoomClasses = useMemo(() => {
    if (!classMgr.classes || !year) return [];
    if (isAdmin) {
      return classMgr.classes.filter(
        (c: any) => String(c.academicYearId ?? c.academicYear ?? '') === String(year),
      );
    }
    // For teachers/staff: allow all classes (not just homeroom classes) for flagpole roll-call
    return classMgr.classes.filter(
      (c: any) => String(c.academicYearId ?? c.academicYear ?? '') === String(year),
    );
  }, [classMgr.classes, year, isAdmin]);

  const sidebarGradeOptions = useMemo(() => {
    if (filterDept === 'all') return [] as string[];
    const grades = new Set<string>();
    homeRoomClasses.forEach((c: any) => {
      if (c.departmentId === filterDept && c.gradeLevel) grades.add(String(c.gradeLevel));
    });
    return Array.from(grades).sort(
      (a, b) => (GRADE_LEVEL_ORDER[a] ?? 99) - (GRADE_LEVEL_ORDER[b] ?? 99),
    );
  }, [homeRoomClasses, filterDept]);

  const sidebarClassOptions = useMemo(() => {
    if (filterDept === 'all' || !filterGradeLevel) return [] as ClassRoom[];
    return homeRoomClasses
      .filter(
        (c: any) => c.departmentId === filterDept && c.gradeLevel === filterGradeLevel,
      )
      .slice()
      .sort((a: any, b: any) =>
        String(a.roomNumber || a.className).localeCompare(
          String(b.roomNumber || b.className),
          undefined,
          { numeric: true },
        ),
      ) as ClassRoom[];
  }, [homeRoomClasses, filterDept, filterGradeLevel]);

  const selectClassForRollCall = (id: string) => {
    const cls = homeRoomClasses.find((c: any) => c.id === id) as ClassRoom | undefined;
    if (cls?.departmentId === 'early' || cls?.departmentId === 'primary' || cls?.departmentId === 'secondary') {
      setFilterDept(cls.departmentId);
    }
    if (cls?.gradeLevel) setFilterGradeLevel(String(cls.gradeLevel));
    setSelectedClassId(id);
    setIsLoadingReport(true);
    setActiveTab('rollcall');
    setEditMode(false);
    setStudentRows([]);
    setSelectedDateStr(null);
    setDayDrawerOpen(false);
  };

  const handleSidebarSelectDept = (dept: Department) => {
    setFilterDept(dept);
    setFilterGradeLevel('');
    setSelectedClassId(null);
    setSelectedDateStr(null);
    setDayDrawerOpen(false);
    setActiveTab('rollcall');
  };

  const handleSidebarSelectGrade = (grade: string) => {
    setFilterGradeLevel(grade);
    setSelectedClassId(null);
    setSelectedDateStr(null);
    setDayDrawerOpen(false);
    setActiveTab('rollcall');
  };

  const collapsedBrowseRail = filterDept !== 'all' ? (
    <div className="flex w-full flex-col items-center gap-2 border-t border-border px-1.5 py-2">
      {sidebarGradeOptions.map((grade) => {
        const active = filterGradeLevel === grade;
        return (
          <button
            key={grade}
            type="button"
            onClick={() => handleSidebarSelectGrade(grade)}
            title={grade}
            aria-label={grade}
            aria-pressed={active}
            className={cn(
              'flex size-11 shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl border transition-all',
              active
                ? 'border-2 border-foreground bg-foreground text-background'
                : 'border border-border bg-muted/40 text-foreground hover:bg-muted',
            )}
          >
            <HiAcademicCap className="h-3.5 w-3.5" />
            <span className="text-[9px] font-black font-sukhumvit leading-none">{grade}</span>
          </button>
        );
      })}

      {filterGradeLevel
        ? sidebarClassOptions.map((room) => {
            const active = selectedClassId === room.id;
            const label = shortRoomLabel(room);
            return (
              <button
                key={room.id}
                type="button"
                onClick={() => selectClassForRollCall(room.id)}
                title={room.className}
                aria-label={room.className}
                aria-pressed={active}
                className={cn(
                  'flex size-11 shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl border transition-all',
                  active
                    ? 'border-2 border-foreground bg-foreground text-background'
                    : 'border border-border bg-card text-foreground hover:bg-muted/50',
                )}
              >
                <HiHomeModern className="h-3.5 w-3.5" />
                <span className="max-w-full truncate px-0.5 text-[9px] font-black font-sukhumvit leading-none">
                  {label}
                </span>
              </button>
            );
          })
        : null}
    </div>
  ) : null;

  const students = useMemo<StudentRowData[]>(() => {
    if (!selectedClass || !year) return [];

    return classStudents
      .reduce<StudentRowData[]>((acc, student, idx) => {
        const studentName = `${student.firstName || ''} ${student.lastName || ''}`.trim();
        const studentCode = student.studentCode || '';
        if (!studentName && !studentCode) return acc;

        acc.push({
          studentId: student.id,
          studentName,
          studentCode,
          status: 'unmarked' as RollCallStatus,
          note: '',
          enrollmentIndex: idx,
          photoURL: student.photoURL,
          gender: student.gender as 'male' | 'female' | undefined,
        });
        return acc;
      }, [])
      .sort((a, b) => {
        const codeA = parseInt(a.studentCode, 10) || 0;
        const codeB = parseInt(b.studentCode, 10) || 0;
        return codeA - codeB;
      });
  }, [selectedClass, year, classStudents]);

  const leaveDate = rollCallDate ?? today;
  const studentsWithLeave = useMemo(
    () => applyApprovedLeaveToMorningRollCallRows(students, classStudents, leaveRequests, leaveDate),
    [students, classStudents, leaveRequests, leaveDate],
  );

  useEffect(() => {
    if (!selectedClassId || !rollCallDate) return;
    if (existingSession === undefined) return;
    if (!existingSession && loadingClassStudents) return;
    if (existingSession) {
      if (!editMode) return;
      const initialRows = existingSession.attendance.map((a, idx) => {
        const studentInfo = students.find((s) => s.studentId === a.studentId);
        return {
          ...a,
          enrollmentIndex: idx,
          photoURL: a.photoURL || studentInfo?.photoURL,
          gender: a.gender || studentInfo?.gender,
        };
      });
      setStudentRows(initialRows);
    } else {
      setStudentRows((prev) => (prev.length === 0 ? studentsWithLeave : prev));
    }
  }, [selectedClassId, rollCallDate, studentsWithLeave, existingSession, editMode, loadingClassStudents, students]);

  useEffect(() => {
    if (!selectedClassId || !rollCallDate || existingSession || editMode) return;
    setStudentRows((prev) => {
      if (prev.length === 0) return studentsWithLeave;
      return applyApprovedLeaveToMorningRollCallRows(prev, classStudents, leaveRequests, leaveDate);
    });
  }, [leaveRequests, leaveDate, classStudents, selectedClassId, rollCallDate, existingSession, editMode, studentsWithLeave]);

  const rowsToUse = useMemo<StudentRowData[]>(() => {
    let rows: StudentRowData[];

    if (existingSession && !editMode) {
      rows = existingSession.attendance
        .map((a, idx) => {
          const studentInfo = students.find((s) => s.studentId === a.studentId);
          return {
            ...a,
            enrollmentIndex: idx,
            photoURL: a.photoURL || studentInfo?.photoURL,
            gender: a.gender || studentInfo?.gender,
          };
        })
        .filter((row) => Boolean((row.studentName || '').trim() || (row.studentCode || '').trim()));
    } else if (studentRows.length === 0 && studentsWithLeave.length > 0) {
      rows = studentsWithLeave;
    } else {
      rows = studentRows.filter((row) =>
        Boolean((row.studentName || '').trim() || (row.studentCode || '').trim()),
      );
    }

    return applyApprovedLeaveToMorningRollCallRows(rows, classStudents, leaveRequests, leaveDate);
  }, [studentRows, students, studentsWithLeave, classStudents, leaveRequests, leaveDate, existingSession, editMode]);

  const isAllPresent = useMemo(
    () => rowsToUse.length > 0 && rowsToUse.every((r) => r.status === 'present'),
    [rowsToUse],
  );

  const handleToggleAllPresent = () => {
    if (isRollCallLocked) return;
    const targetStatus: RollCallStatus = isAllPresent ? 'unmarked' : 'present';
    setStudentRows(rowsToUse.map((r) => ({ ...r, status: targetStatus })));
  };

  const handleSelectDay = (day: Date) => {
    const dateStr = toDateStr(day);
    setSelectedDateStr(dateStr);
    setDayDrawerOpen(true);
  };

  const handleDayDrawerOpenChange = (open: boolean) => {
    setDayDrawerOpen(open);
    if (!open) {
      setEditMode(false);
      setSaveError(null);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const loadReportSessions = async () => {
      if (!selectedClassId || !year) {
        setReportSessions([]);
        return;
      }
      setIsLoadingReport(true);
      try {
        const sessions = await getClassRollCallsByAcademicYear(selectedClassId, String(year));
        if (cancelled) return;
        setReportSessions(sessions);
      } finally {
        if (!cancelled) setIsLoadingReport(false);
      }
    };
    void loadReportSessions();
    return () => {
      cancelled = true;
    };
  }, [selectedClassId, year, showSuccessModal]);

  // ปุ่มกลับ header → รายงานกลับปฏิทิน / ปฏิทินกลับเลือกรูม
  useEffect(() => {
    if (!selectedClassId) return;

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
      if (activeTab === 'report') {
        setActiveTab('rollcall');
        setReportFilterOpen(false);
        return;
      }
      setSelectedClassId(null);
      setEditMode(false);
      setDayDrawerOpen(false);
      setSelectedDateStr(null);
      setActiveTab('rollcall');
    };

    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [selectedClassId, activeTab]);

  const filteredReportSessions = useMemo(() => {
    const from = reportFrom || '0000-01-01';
    const to = reportTo || '9999-12-31';
    return reportSessions.filter((s) => s.date >= from && s.date <= to);
  }, [reportSessions, reportFrom, reportTo]);

  const reportStudentSummaries = useMemo(() => {
    const map = new Map<
      string,
      {
        studentId: string;
        studentName: string;
        studentCode: string;
        photoURL?: string;
        gender?: 'male' | 'female';
        present: number;
        absent: number;
        late: number;
        leave: number;
        total: number;
      }
    >();

    filteredReportSessions.forEach((session) => {
      session.attendance.forEach((student) => {
        const key = student.studentId || `${student.studentName}-${student.studentCode}`;
        const existing = map.get(key) ?? {
          studentId: student.studentId,
          studentName: student.studentName,
          studentCode: student.studentCode,
          photoURL: student.photoURL,
          gender: student.gender,
          present: 0,
          absent: 0,
          late: 0,
          leave: 0,
          total: 0,
        };

        if (student.status === 'present') existing.present += 1;
        if (student.status === 'absent') existing.absent += 1;
        if (student.status === 'late') existing.late += 1;
        if (student.status === 'leave') existing.leave += 1;
        if (student.status !== 'unmarked') existing.total += 1;

        map.set(key, existing);
      });
    });

    return Array.from(map.values()).sort((a, b) => a.studentName.localeCompare(b.studentName, 'th'));
  }, [filteredReportSessions]);

  const doSave = () => {
    if (!selectedClass || !year || activeSemester == null || !rollCallDate) return;
    if (!isDateEditableIgnoringHoliday) {
      setSaveError(
        rollCallDate > today
          ? 'ยังไม่ถึงวัน ไม่สามารถเช็กชื่อเข้าแถวได้'
          : rollCallDate < today
            ? 'วันที่ผ่านมาแล้ว สามารถดูได้อย่างเดียว'
            : isInterSemesterBreakDay
              ? 'ช่วงปิดระหว่างเทอม ไม่สามารถเช็กชื่อเข้าแถวได้'
              : isRollCallBlocked && isWeekend
                ? 'วันนี้เป็นวันหยุดสุดสัปดาห์ ไม่สามารถเช็กชื่อเข้าแถวได้'
                : isRollCallBlocked
                  ? `วันนี้เป็นวันหยุด${holidayTitle ? ` (${holidayTitle})` : ''} ไม่สามารถเช็กชื่อเข้าแถวได้`
                  : 'ไม่สามารถเช็กชื่อเข้าแถวได้',
      );
      return;
    }
    if (existingSession && !editMode) {
      setEditMode(true);
      return;
    }
    const unmarkedStudents = rowsToUse.filter((r) => r.status === 'unmarked');
    if (unmarkedStudents.length > 0) {
      setShowWarningModal(true);
      return;
    }
    setSaveError(null);
    saveRollCall(
      {
        date: rollCallDate,
        classId: selectedClass.id,
        className: selectedClass.className,
        departmentId: selectedClass.departmentId?.toString() || '',
        academicYearId: year,
        semester: activeSemester as 1 | 2,
        recordedBy: user?.uid || '',
        recordedByName: userData?.displayName || '',
        attendance: rowsToUse,
      },
      {
        onSuccess: (savedSession) => {
          setOptimisticSession(savedSession);
          setEditMode(false);
          setShowSuccessModal(true);
        },
        onError: (err) => {
          setSaveError(err instanceof Error ? err.message : 'บันทึกข้อมูลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
        },
      },
    );
  };

  if (isPageLoading) {
    return (
      <div
        className={cn(
          'relative flex min-h-0 w-full flex-1 basis-0 flex-col overflow-hidden bg-transparent font-sukhumvit',
          'h-[calc(100dvh-4.25rem)] max-h-[calc(100dvh-4.25rem)]',
        )}
      >
        <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
          <div className="absolute -top-24 -left-16 w-72 h-72 rounded-full bg-sky-200/45 blur-3xl" />
          <div className="absolute top-24 -right-20 w-80 h-80 rounded-full bg-cyan-200/40 blur-3xl" />
        </div>
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-3 py-2 md:px-6">
          <ClassPickerSkeleton />
        </div>
      </div>
    );
  }

  if (homeRoomClasses.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-4 gap-4">
        <div className="text-slate-500 text-center">
          {isAdmin ? (
            <>
              <p className="font-semibold">ยังไม่มีห้องเรียนในระบบ</p>
              <p className="text-sm text-slate-400 mt-2">กรุณาเพิ่มห้องเรียนก่อนเริ่มใช้งาน</p>
            </>
          ) : (
            <>
              <p className="font-semibold">ไม่มีชั้นเรียนที่ท่านเป็นครูอำเภอ</p>
              <p className="text-sm text-slate-400 mt-2">กรุณาติดต่อผู้บริหารเพื่อกำหนดชั้นเรียน</p>
            </>
          )}
        </div>
        <button
          onClick={() => navigate('/portal')}
          className="px-4 py-2 rounded-lg bg-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-300 transition"
        >
          กลับไปหน้าหลัก
        </button>
      </div>
    );
  }

  const selectedDateLabel = selectedDateStr
    ? toThaiFullDate(new Date(`${selectedDateStr}T12:00:00`))
    : '';

  return (
    <div
      className={cn(
        'relative flex min-h-0 w-full flex-1 basis-0 flex-col overflow-hidden bg-transparent font-sukhumvit',
        'h-[calc(100dvh-4.25rem)] max-h-[calc(100dvh-4.25rem)]',
      )}
    >
      <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute -top-24 -left-16 w-72 h-72 rounded-full bg-sky-200/45 blur-3xl" />
        <div className="absolute top-24 -right-20 w-80 h-80 rounded-full bg-cyan-200/40 blur-3xl" />
      </div>
      {selectedClassId && activeTab === 'rollcall' && (
        <>
          {headerRightPortalEl &&
            createPortal(
              <button
                type="button"
                onClick={() => setActiveTab('report')}
                className={HEADER_ICON_BTN}
                title="ดูรายงานการเช็กชื่อ"
                aria-label="ดูรายงานการเช็กชื่อ"
              >
                <HiOutlineDocumentText size={16} />
              </button>,
              headerRightPortalEl,
            )}
          {headerMobileActionsEl &&
            createPortal(
              <button
                type="button"
                onClick={() => setActiveTab('report')}
                className={HEADER_ICON_BTN}
                title="ดูรายงานการเช็กชื่อ"
                aria-label="ดูรายงานการเช็กชื่อ"
              >
                <HiOutlineDocumentText size={16} />
              </button>,
              headerMobileActionsEl,
            )}
        </>
      )}
      {selectedClassId && activeTab === 'report' && (
        <>
          {headerRightPortalEl &&
            createPortal(
              <ExamMobileFilterTriggerButton
                onClick={() => setReportFilterOpen(true)}
                hasActiveFilters={hasActiveReportFilter}
              />,
              headerRightPortalEl,
            )}
          {headerMobileActionsEl &&
            createPortal(
              <ExamMobileFilterTriggerButton
                onClick={() => setReportFilterOpen(true)}
                hasActiveFilters={hasActiveReportFilter}
              />,
              headerMobileActionsEl,
            )}
        </>
      )}
      <div className="flex min-h-0 flex-1 basis-0 flex-col gap-0 overflow-hidden lg:flex-row lg:items-stretch lg:gap-4">
        <div
          className={cn(
            'flex h-full min-h-0 shrink-0 flex-col self-stretch overflow-hidden',
            'w-full lg:w-[280px] xl:w-[300px]',
            sidebarCollapsed && 'lg:w-20 xl:w-20',
            selectedClassId ? 'hidden lg:flex' : 'flex min-h-0 flex-1 lg:flex-none',
          )}
        >
          <GradeBookClassSidebar
            selectedDept={filterDept === 'all' ? '' : filterDept}
            selectedGrade={filterGradeLevel}
            selectedClassId={selectedClassId ?? ''}
            gradeOptions={sidebarGradeOptions}
            classOptions={sidebarClassOptions}
            onSelectDept={handleSidebarSelectDept}
            onSelectGrade={handleSidebarSelectGrade}
            onSelectClass={selectClassForRollCall}
            collapsed={sidebarCollapsed}
            collapsedExtra={collapsedBrowseRail}
            headerAction={(
              <SidebarCollapseButton
                collapsed={sidebarCollapsed}
                onToggle={() => setSidebarCollapsed((v) => !v)}
              />
            )}
          />
        </div>

        <div
          className={cn(
            'relative flex min-h-0 flex-1 basis-0 flex-col self-stretch overflow-hidden px-2 pb-2 sm:px-2.5 sm:pb-2.5',
            !selectedClassId && 'hidden lg:flex',
          )}
        >
          {!selectedClassId ? (
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-6 pb-4 text-center">
              <HiHomeModern className="h-8 w-8 text-muted-foreground/40" />
              <p className="font-sukhumvit text-[13px] font-black text-muted-foreground">
                {filterDept === 'all'
                  ? 'เลือกแผนกจากแถบด้านซ้าย'
                  : !filterGradeLevel
                    ? 'เลือกระดับชั้นเพื่อดูห้องเรียน'
                    : 'เลือกห้องเรียนเพื่อเช็กชื่อเข้าแถว'}
              </p>
            </div>
          ) : null}

          {selectedClassId && selectedClass && (
            <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden pb-4">
              {activeTab === 'rollcall' ? (
                isLoadingReport ? (
                  <MonthCalendarSkeleton />
                ) : (
                  <MorningRollCallMonthCalendar
                    className="min-h-0 flex-1"
                    sessionDates={sessionDates}
                    rangeStart={academicYearRange.start}
                    rangeEnd={academicYearRange.end}
                    todayDate={today}
                    interSemesterBreak={interSemesterBreak}
                    onSelectDay={handleSelectDay}
                  />
                )
              ) : (
                <div className="min-h-0 flex-1 overflow-y-auto">
                  {isLoadingReport ? (
                    <ReportListSkeleton />
                  ) : (
                  <div className="space-y-2">
                    {reportStudentSummaries.map((student) => (
                      <div
                        key={student.studentId || `${student.studentName}-${student.studentCode}`}
                        className="rounded-xl border border-slate-100 bg-white/70 px-3 py-2.5"
                      >
                        <div className="flex items-center gap-2">
                          <StudentAvatar
                            photoURL={student.photoURL}
                            studentId={student.studentId}
                            name={student.studentName}
                            gender={student.gender}
                            className="h-8 w-8 shrink-0 rounded-lg"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[12px] font-semibold text-slate-800">
                              {student.studentName}
                            </p>
                            <p className="truncate text-[10px] text-slate-500">{student.studentCode}</p>
                          </div>
                        </div>

                        <div className="mt-2 grid grid-cols-4 gap-1.5">
                          <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-2 py-1">
                            <p className="text-[10px] font-bold text-emerald-700">มา</p>
                            <p className="mt-1 text-sm leading-none font-black text-emerald-700">
                              {student.present}
                            </p>
                          </div>
                          <div className="rounded-lg border border-rose-100 bg-rose-50 px-2 py-1">
                            <p className="text-[10px] font-bold text-rose-700">ขาด</p>
                            <p className="mt-1 text-sm leading-none font-black text-rose-700">
                              {student.absent}
                            </p>
                          </div>
                          <div className="rounded-lg border border-amber-100 bg-amber-50 px-2 py-1">
                            <p className="text-[10px] font-bold text-amber-700">สาย</p>
                            <p className="mt-1 text-sm leading-none font-black text-amber-700">
                              {student.late}
                            </p>
                          </div>
                          <div className="rounded-lg border border-blue-100 bg-blue-50 px-2 py-1">
                            <p className="text-[10px] font-bold text-blue-700">ลา</p>
                            <p className="mt-1 text-sm leading-none font-black text-blue-700">
                              {student.leave}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                    {!isLoadingReport && reportStudentSummaries.length === 0 && (
                      <p className="text-xs text-slate-400">ไม่พบข้อมูลในช่วงวันที่ที่เลือก</p>
                    )}
                  </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>


      <ExamMobileFilterDrawer
        open={reportFilterOpen}
        onOpenChange={setReportFilterOpen}
        title="ตัวกรองรายงาน"
        footer={
          <div className="flex w-full flex-col gap-2">
            <Button
              type="button"
              variant="secondary"
              className="h-10 w-full rounded-xl text-xs font-bold"
              onClick={resetReportDateFilter}
            >
              ล้างตัวกรอง
            </Button>
            <Button
              type="button"
              className="h-10 w-full rounded-xl font-bold"
              onClick={() => setReportFilterOpen(false)}
            >
              แสดงผล
            </Button>
          </div>
        }
      >
        <div className="space-y-4 px-1">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="pl-1 text-[10px] font-black uppercase tracking-wider text-slate-600">
                ตั้งแต่วันที่
              </label>
              <Input
                type="date"
                value={reportFrom}
                onChange={(e) => setReportFrom(e.target.value)}
                className="h-10 rounded-xl border-none bg-slate-50/70 px-4 text-xs font-bold focus-visible:bg-slate-50/90 focus-visible:ring-2 focus-visible:ring-slate-900/20"
              />
            </div>
            <div className="space-y-1">
              <label className="pl-1 text-[10px] font-black uppercase tracking-wider text-slate-600">
                ถึงวันที่
              </label>
              <Input
                type="date"
                value={reportTo}
                onChange={(e) => setReportTo(e.target.value)}
                className="h-10 rounded-xl border-none bg-slate-50/70 px-4 text-xs font-bold focus-visible:bg-slate-50/90 focus-visible:ring-2 focus-visible:ring-slate-900/20"
              />
            </div>
          </div>
        </div>
      </ExamMobileFilterDrawer>

      <Drawer open={dayDrawerOpen} onOpenChange={handleDayDrawerOpenChange} direction="right">
        <DrawerContent className={DRAWER_CONTENT_CLASS}>
          <div className={DRAWER_PANEL_CLASS}>
            <DrawerHeader className="shrink-0 px-4 pb-2 pt-4">
              <div className="relative flex min-h-10 items-center justify-center">
                {!isRollCallLocked && (
                  <label className="absolute left-0 top-1/2 inline-flex -translate-y-1/2 cursor-pointer items-center gap-2 select-none">
                    <input
                      type="checkbox"
                      checked={isAllPresent}
                      onChange={handleToggleAllPresent}
                      className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-[11px] font-black text-slate-700">เช็กทั้งหมด</span>
                  </label>
                )}
                {isDateEditable && existingSession && !editMode && (
                  <button
                    type="button"
                    onClick={() => setEditMode(true)}
                    className="absolute left-0 top-1/2 inline-flex -translate-y-1/2 items-center gap-1.5 text-[11px] font-black text-blue-600 transition-colors hover:text-blue-700"
                  >
                    <HiPencilSquare className="h-4 w-4" />
                    แก้ไข
                  </button>
                )}
                <div className="min-w-0 px-12 text-center">
                  <DrawerTitle className="text-base font-black text-slate-800">
                    เช็กชื่อเข้าแถว
                  </DrawerTitle>
                  <DrawerDescription className="truncate text-xs text-slate-500">
                    {selectedClass?.className}
                    {selectedDateLabel ? ` · ${selectedDateLabel}` : ''}
                    {!isDateEditable && rollCallDate && rollCallDate < today
                      ? ' · ดูอย่างเดียว'
                      : !isDateEditable && rollCallDate && rollCallDate > today
                        ? ' · ยังไม่ถึงวัน'
                        : ''}
                  </DrawerDescription>
                </div>
                <div className={DRAWER_HEADER_RIGHT_ACTIONS}>
                  <button
                    type="button"
                    onClick={() => handleDayDrawerOpenChange(false)}
                    className={DRAWER_HEADER_ICON_BTN}
                    aria-label="ปิด"
                  >
                    <HiXMark className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </DrawerHeader>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
              {loadingClassStudents && rowsToUse.length === 0 ? (
                <StudentRosterSkeleton />
              ) : rowsToUse.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center text-xs font-semibold text-slate-500">
                  ไม่พบรายชื่อนักเรียนในห้องนี้
                </div>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {rowsToUse.map((row) => {
                    const statusOption =
                      row.status !== 'unmarked'
                        ? ROLL_CALL_OPTIONS.find((opt) => opt.value === row.status)
                        : null;

                    return (
                      <div
                        key={row.studentId}
                        className={cn(
                          'rounded-2xl border p-3 transition-colors duration-200',
                          statusOption?.cardClassName ?? 'border-slate-200 bg-white',
                        )}
                      >
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-black text-slate-800">
                              {row.studentName}
                            </p>
                            <p className="text-[11px] font-bold text-slate-400">{row.studentCode}</p>
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
                            const isActive = row.status === opt.value;
                            return (
                              <button
                                key={opt.value}
                                type="button"
                                disabled={isRollCallLocked}
                                onClick={() => {
                                  const newStatus: RollCallStatus =
                                    row.status === opt.value ? 'unmarked' : opt.value;
                                  setStudentRows(
                                    rowsToUse.map((r) =>
                                      r.studentId === row.studentId ? { ...r, status: newStatus } : r,
                                    ),
                                  );
                                }}
                                className={cn(
                                  'h-9 rounded-lg border text-[11px] font-black transition active:scale-[0.98]',
                                  isActive ? opt.activeClassName : opt.className,
                                  isRollCallLocked && 'cursor-not-allowed opacity-60',
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

            {isDateEditable && rowsToUse.length > 0 && (
              <div className="shrink-0 space-y-2 border-t border-slate-100 bg-white px-4 pt-2 pb-4">
                {saveError && (
                  <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600">
                    <AlertTriangle size={14} className="shrink-0" />
                    {saveError}
                  </div>
                )}
                <button
                  type="button"
                  disabled={isSaving || !isDateEditableIgnoringHoliday}
                  onClick={doSave}
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
                      ? 'แก้ไข'
                      : `บันทึกเช็กชื่อ (${rowsToUse.length} คน)`}
                </button>
              </div>
            )}
          </div>
        </DrawerContent>
      </Drawer>

      <AnimatePresence>
        {showWarningModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowWarningModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="relative z-10 flex w-full max-w-sm flex-col items-center rounded-3xl border border-white/20 bg-white/95 p-6 text-center shadow-2xl backdrop-blur-md"
            >
              <div className="mb-4 flex h-14 w-14 animate-bounce items-center justify-center rounded-full border border-rose-100 bg-rose-50 text-rose-500">
                <AlertTriangle size={24} />
              </div>
              <h3 className="mb-2 text-base font-black text-slate-800">เช็กชื่อนักเรียนไม่ครบ</h3>
              <p className="mb-6 text-xs leading-relaxed text-slate-500">
                พบนักเรียนจำนวน{' '}
                <span className="font-bold text-rose-500">
                  {rowsToUse.filter((r) => r.status === 'unmarked').length} คน
                </span>{' '}
                ที่ยังไม่ถูกเช็กสถานะ
                <br />
                กรุณาตรวจสอบสถานะของนักเรียนทุกคนให้ครบถ้วนก่อนบันทึกข้อมูล
              </p>
              <Button
                type="button"
                onClick={() => setShowWarningModal(false)}
                className="h-10 w-full rounded-xl text-xs font-black"
              >
                กลับไปตรวจสอบใหม่
              </Button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSuccessModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSuccessModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="relative z-10 flex w-full max-w-sm flex-col items-center rounded-3xl border border-white/20 bg-white/95 p-6 text-center shadow-2xl backdrop-blur-md"
            >
              <div className="mb-4 flex h-14 w-14 animate-pulse items-center justify-center rounded-full border border-emerald-100 bg-emerald-50 text-emerald-500">
                <CheckCircle size={28} />
              </div>
              <h3 className="mb-2 text-base font-black text-slate-800">บันทึกข้อมูลสำเร็จ</h3>
              <p className="mb-6 text-xs leading-relaxed text-slate-500">
                ระบบได้ทำการบันทึกข้อมูลการเช็กชื่อของห้อง{' '}
                <span className="font-bold text-slate-700">{selectedClass?.className}</span>
                {selectedDateLabel ? ` (${selectedDateLabel})` : ''} เรียบร้อยแล้ว
              </p>
              <Button
                type="button"
                onClick={() => setShowSuccessModal(false)}
                className="h-10 w-full rounded-xl bg-emerald-600 text-xs font-black text-white hover:bg-emerald-700"
              >
                ตกลง
              </Button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
