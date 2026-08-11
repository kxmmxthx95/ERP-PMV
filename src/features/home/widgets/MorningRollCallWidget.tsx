import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  HiArrowLeft,
  HiCalendarDays,
  HiCheckCircle,
  HiExclamationTriangle,
  HiPencilSquare,
  HiSun,
  HiUsers,
  HiXMark,
} from 'react-icons/hi2';
import { useAuth } from '@/hooks/useAuth';
import { useActiveAcademicYear } from '@/hooks/useActiveAcademicYear';
import { useIsSchoolDayToday } from '@/hooks/useIsSchoolDayToday';
import { getLocalDateString } from '@/lib/calendar/schoolDay';
import { useHomeroomClassesForUser } from '@/hooks/useYearClassesHomeroom';
import { useSchedule } from '@/hooks/useSchedule';
import { useTeachersCollection } from '@/hooks/useTeachersCollection';
import { buildTeacherIdentityKeys, matchesTeacherIdentity, resolveTeacherFromAuth } from '@/lib/teachers/teacherIdentity';
import { useSubstitutionsForDate } from '@/lib/attendance/substituteAssignments';
import {
  useTodayMorningRollCall,
  useSaveMorningRollCall,
  useTodayRollCallSessions,
} from '@/hooks/useMorningRollCall';
import {
  useHomeroomStudentCounts,
  useMorningRollCallClassStudents,
} from '@/hooks/useMorningRollCallClassStudents';
import { useStudentLeaveRequests } from '@/hooks/useLeaveRequests';
import { applyApprovedLeaveToMorningRollCallRows } from '@/lib/attendance/leaveRequestStudentMatch';
import type { MorningRollCallSession, RollCallStatus, StudentRollCall } from '@/types/morningRollCall';
import { WIDGET_CARD, WIDGET_GLASS, DAY_CANDY_SURFACE_CLASS, getDayCandyBoxShadow, getDayCandyStyle } from '../widgetStyles';
import { WidgetSkeleton } from '../components/WidgetSkeleton';
import type { ClassRoom } from '@/types/class';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from '@/components/ui/drawer';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { DRAWER_HEADER_ICON_BTN, DRAWER_HEADER_RIGHT_ACTIONS } from '@/lib/drawerHeaderBtn';
import { ROLL_CALL_OPTIONS } from '@/features/attendance/rollCallUi';

const DRAWER_CONTENT_CLASS = cn(
  'flex h-dvh flex-col bg-transparent p-0 before:hidden',
  'data-[vaul-drawer-direction=right]:w-screen data-[vaul-drawer-direction=right]:max-w-none',
  'sm:h-full sm:data-[vaul-drawer-direction=right]:w-full sm:data-[vaul-drawer-direction=right]:max-w-md sm:p-2',
);

const DRAWER_PANEL_CLASS = cn(
  'flex h-full min-h-0 flex-col overflow-hidden bg-white',
  'sm:rounded-4xl sm:border sm:border-slate-200/70 sm:shadow-xl',
);

type MarkableStatus = Exclude<RollCallStatus, 'unmarked'>;

type StudentRow = StudentRollCall & { enrollmentIndex: number };

const ROLL_CALL_SPLIT_SHELL =
  'rounded-2xl flex w-full h-[142px] min-h-[142px] overflow-hidden gap-2 self-stretch cursor-pointer active:scale-[0.99] transition-transform';

const DONUT_STATUS = [
  { key: 'present' as const, label: 'มา', color: '#10b981', track: '#d1fae5' },
  { key: 'late' as const, label: 'สาย', color: '#f59e0b', track: '#fef3c7' },
  { key: 'absent' as const, label: 'ขาด', color: '#f43f5e', track: '#ffe4e6' },
  { key: 'leave' as const, label: 'ลา', color: '#3b82f6', track: '#dbeafe' },
];

function StatusDonut({
  label,
  value,
  total,
  color,
  trackColor,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
  trackColor: string;
}) {
  const size = 46;
  const stroke = 3.5;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const pct = total > 0 ? Math.min(value / total, 1) : 0;
  const dash = pct * circumference;

  return (
    <div className="flex flex-col items-center min-w-0 flex-1">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke={trackColor} strokeWidth={stroke} />
          {value > 0 && (
            <circle
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={color}
              strokeWidth={stroke}
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeLinecap="round"
            />
          )}
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-sm font-black text-slate-800 tabular-nums leading-none">
          {value}
        </span>
      </div>
      <span
        className="text-[9px] font-bold leading-none mt-1 truncate max-w-full"
        style={{ color }}
        aria-label={`${label} ${value} คน`}
      >
        {label}
      </span>
    </div>
  );
}


export default function MorningRollCallWidget() {
  const { user, userData } = useAuth();
  const { year, activeSemester, isLoaded } = useActiveAcademicYear();
  const [today] = useState(() => getLocalDateString());
  const {
    isHoliday: isRollCallBlocked,
    isWeekend,
    holidayTitle,
  } = useIsSchoolDayToday('teacher', today);
  const { requests: leaveRequests } = useStudentLeaveRequests(today);
  const { homeRoomClasses, loading: loadingHomeroomClasses } = useHomeroomClassesForUser(year ?? undefined, user?.uid);
  const sortedHomeroomClasses = useMemo(
    () =>
      [...homeRoomClasses].sort((a, b) =>
        String((a as ClassRoom).className ?? '').localeCompare(
          String((b as ClassRoom).className ?? ''),
          undefined,
          { numeric: true },
        ),
      ) as ClassRoom[],
    [homeRoomClasses],
  );
  const primaryClass = sortedHomeroomClasses[0];
  // 1.2 Defer — card only needs a count; fetch student docs when drawer opens a class
  const { countsByClassId, ready: studentCountsReady } = useHomeroomStudentCounts(
    year ?? undefined,
    sortedHomeroomClasses,
    activeSemester as 1 | 2,
  );
  const displayStudentCount = primaryClass ? (countsByClassId[primaryClass.id] ?? 0) : 0;

  // ── มอบหมายเช็คชื่อเข้าแถวแทนของวันนี้ ──────────────────────────────────────
  const { classes: allClasses } = useSchedule({ includeClasses: true });
  const { teachers } = useTeachersCollection();
  const teacherProfile = useMemo(
    () => (user?.uid ? resolveTeacherFromAuth(user.uid, teachers) : null),
    [teachers, user?.uid],
  );
  const identityKeys = useMemo(
    () => buildTeacherIdentityKeys(user?.uid ?? '', teacherProfile),
    [user?.uid, teacherProfile],
  );
  const todaySubstitutions = useSubstitutionsForDate(
    year ?? undefined,
    (activeSemester ?? undefined) as 1 | 2 | undefined,
    today,
  );
  const rollCallSubByClassId = useMemo(() => {
    const map = new Map<string, (typeof todaySubstitutions)[number]>();
    todaySubstitutions
      .filter((s) => s.scope === 'rollcall' && (s.status ?? 'approved') === 'approved')
      .forEach((s) => map.set(s.classId, s));
    return map;
  }, [todaySubstitutions]);
  // ห้องที่ฉันรับมอบหมายให้เช็คชื่อแทน (ไม่ใช่ห้องประจำชั้นของฉันเอง)
  const substituteRollCallClasses = useMemo(() => {
    const myClassIds = new Set(homeRoomClasses.map((c) => c.id));
    return [...rollCallSubByClassId.values()]
      .filter((s) => matchesTeacherIdentity(s.substituteTeacherId, identityKeys) && !myClassIds.has(s.classId))
      .map((s) => ({
        id: s.classId,
        className: allClasses.find((c) => c.id === s.classId)?.label ?? s.classId,
        originalTeacherName: s.originalTeacherName,
      }));
  }, [rollCallSubByClassId, identityKeys, homeRoomClasses, allClasses]);
  const queryClient = useQueryClient();
  const { mutate: saveRollCall, isPending: isSaving } = useSaveMorningRollCall();
  const { sessions: todaySessions, loading: loadingSessions } = useTodayRollCallSessions(year ?? undefined);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const { students: classStudents, loadingRoster: loadingClassStudents } = useMorningRollCallClassStudents(
    year ?? undefined,
    selectedClassId,
    activeSemester as 1 | 2,
  );
  const [studentRows, setStudentRows] = useState<StudentRow[]>([]);
  const [allPresentSnapshot, setAllPresentSnapshot] = useState<StudentRow[] | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [saveSuccessPopupOpen, setSaveSuccessPopupOpen] = useState(false);
  const [incompletePopupOpen, setIncompletePopupOpen] = useState(false);
  const [blockedPopupOpen, setBlockedPopupOpen] = useState(false);
  const [blockedMessage, setBlockedMessage] = useState('');

  const { data: fetchedSession, isLoading: loadingSession } = useTodayMorningRollCall(selectedClassId);
  const sessionsByClassId = useMemo(() => {
    const byClassId = new Map(todaySessions.map((session) => [session.classId, session]));
    const map: Record<string, MorningRollCallSession | null> = {};
    for (const cls of homeRoomClasses) {
      map[cls.id] = byClassId.get(cls.id) ?? null;
    }
    for (const cls of substituteRollCallClasses) {
      map[cls.id] = byClassId.get(cls.id) ?? null;
    }
    return map;
  }, [homeRoomClasses, substituteRollCallClasses, todaySessions]);

  const existingSession = useMemo(() => {
    if (!selectedClassId) return null;
    return fetchedSession ?? sessionsByClassId[selectedClassId] ?? null;
  }, [fetchedSession, selectedClassId, sessionsByClassId]);

  const selectedClass = useMemo(
    () =>
      homeRoomClasses.find((c: { id: string }) => c.id === selectedClassId)
      ?? substituteRollCallClasses.find((c) => c.id === selectedClassId)
      ?? null,
    [homeRoomClasses, substituteRollCallClasses, selectedClassId],
  );

  const todayDayOfWeek = useMemo(() => new Date(`${today}T00:00:00`).getDay(), [today]);
  const isSaturday = todayDayOfWeek === 6;

  const isReadOnly = !!existingSession && !editMode;
  const isAllChecked = allPresentSnapshot !== null;

  const dayLabels: Record<number, string> = {
    0: 'อาทิตย์', 1: 'จันทร์', 2: 'อังคาร', 3: 'พุธ', 4: 'พฤหัสบดี', 5: 'ศุกร์', 6: 'เสาร์',
  };
  const dayThemeMap: Record<number, { badge: string; icon: string; accent: string; iconBox: string; innerCard: string }> = {
    0: {
      badge: 'bg-red-50 text-red-600 border-red-100',
      icon: 'text-red-500',
      accent: 'text-red-600',
      iconBox: 'bg-red-50 border-red-200 text-red-600',
      innerCard: 'border-red-200/70 bg-red-50/40',
    },
    1: {
      badge: 'bg-amber-50 text-amber-700 border-amber-100',
      icon: 'text-amber-600',
      accent: 'text-amber-700',
      iconBox: 'bg-amber-50 border-amber-200 text-amber-700',
      innerCard: 'border-amber-200/70 bg-amber-50/40',
    },
    2: {
      badge: 'bg-pink-50 text-pink-600 border-pink-100',
      icon: 'text-pink-500',
      accent: 'text-pink-600',
      iconBox: 'bg-pink-50 border-pink-200 text-pink-600',
      innerCard: 'border-pink-200/70 bg-pink-50/40',
    },
    3: {
      badge: 'bg-emerald-50 text-emerald-600 border-emerald-100',
      icon: 'text-emerald-500',
      accent: 'text-emerald-600',
      iconBox: 'bg-emerald-50 border-emerald-200 text-emerald-600',
      innerCard: 'border-emerald-200/70 bg-emerald-50/40',
    },
    4: {
      badge: 'bg-orange-50 text-orange-600 border-orange-100',
      icon: 'text-orange-500',
      accent: 'text-orange-600',
      iconBox: 'bg-orange-50 border-orange-200 text-orange-600',
      innerCard: 'border-orange-200/70 bg-orange-50/40',
    },
    5: {
      badge: 'bg-blue-50 text-blue-600 border-blue-100',
      icon: 'text-blue-500',
      accent: 'text-blue-600',
      iconBox: 'bg-blue-50 border-blue-200 text-blue-600',
      innerCard: 'border-blue-200/70 bg-blue-50/40',
    },
    6: {
      badge: 'bg-violet-50 text-violet-600 border-violet-100',
      icon: 'text-violet-500',
      accent: 'text-violet-600',
      iconBox: 'bg-violet-50 border-violet-200 text-violet-600',
      innerCard: 'border-violet-200/70 bg-violet-50/40',
    },
  };
  const todayNum = todayDayOfWeek;
  const dayTheme = dayThemeMap[todayNum] || dayThemeMap[5];
  const holidayBlockedStyle = isSaturday
    ? {
        background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 55%, #6d28d9 100%)',
        border: '1.5px solid rgba(255,255,255,0.28)',
      }
    : {
        background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 55%, #b91c1c 100%)',
        border: '1.5px solid rgba(255,255,255,0.28)',
      };
  const holidayBannerClass = isSaturday
    ? 'border-2 border-violet-400 bg-gradient-to-br from-violet-500 to-violet-600'
    : 'border-2 border-red-400 bg-gradient-to-br from-red-500 to-red-600';
  const holidayBannerSubtextClass = isSaturday ? 'text-violet-100' : 'text-red-100';
  const todayDateLabel = useMemo(() => {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const yearBe = now.getFullYear() + 543;
    return `${day}/${month}/${yearBe}`;
  }, []);

  const baseStudents = useMemo<StudentRow[]>(() => {
    if (!selectedClass || !year) return [];

    return classStudents
      .reduce<StudentRow[]>((acc, student, idx) => {
        const studentName = `${student.prefix || ''}${student.firstName || ''} ${student.lastName || ''}`.trim();
        const studentCode = student.studentCode || '';
        if (!studentName && !studentCode) return acc;
        acc.push({
          studentId: student.id,
          studentName,
          studentCode,
          status: 'unmarked',
          note: '',
          enrollmentIndex: idx,
          photoURL: student.photoURL,
          gender: student.gender as 'male' | 'female' | undefined,
        });
        return acc;
      }, [])
      .sort((a, b) => a.studentCode.localeCompare(b.studentCode, undefined, { numeric: true }));
  }, [selectedClass, year, classStudents]);

  const studentsWithLeave = useMemo(
    () => applyApprovedLeaveToMorningRollCallRows(baseStudents, classStudents, leaveRequests, today),
    [baseStudents, classStudents, leaveRequests, today],
  );

  useEffect(() => {
    if (!drawerOpen) {
      setSelectedClassId(null);
      setStudentRows([]);
      setAllPresentSnapshot(null);
      setEditMode(false);
      setSaveSuccessPopupOpen(false);
      setIncompletePopupOpen(false);
      setBlockedPopupOpen(false);
    }
  }, [drawerOpen]);

  useEffect(() => {
    if (!selectedClassId || loadingSession || loadingClassStudents) return;

    if (existingSession && !editMode) {
      setStudentRows(
        existingSession.attendance.map((a, idx) => ({
          ...a,
          enrollmentIndex: idx,
        })),
      );
      return;
    }

    if (existingSession && editMode) {
      setStudentRows(
        existingSession.attendance.map((a, idx) => {
          const info = baseStudents.find((s) => s.studentId === a.studentId);
          return {
            ...a,
            enrollmentIndex: idx,
            photoURL: a.photoURL || info?.photoURL,
            gender: a.gender || info?.gender,
          };
        }),
      );
      return;
    }

    setStudentRows((prev) => (prev.length === 0 ? studentsWithLeave : prev));
  }, [selectedClassId, existingSession, editMode, loadingSession, loadingClassStudents, baseStudents, studentsWithLeave]);

  useEffect(() => {
    if (!selectedClassId || existingSession || editMode) return;
    setStudentRows((prev) => {
      if (prev.length === 0) return studentsWithLeave;
      return applyApprovedLeaveToMorningRollCallRows(prev, classStudents, leaveRequests, today);
    });
  }, [leaveRequests, today, classStudents, selectedClassId, existingSession, editMode, studentsWithLeave]);

  const rowsToUse = useMemo(() => {
    let rows: StudentRow[];

    if (existingSession && !editMode) {
      rows = existingSession.attendance.map((a, idx) => ({
        ...a,
        enrollmentIndex: idx,
      }));
    } else if (studentRows.length === 0 && studentsWithLeave.length > 0) {
      rows = studentsWithLeave;
    } else {
      rows = studentRows;
    }

    return applyApprovedLeaveToMorningRollCallRows(rows, classStudents, leaveRequests, today);
  }, [studentRows, studentsWithLeave, classStudents, leaveRequests, today, existingSession, editMode]);

  // ห้องที่ฉันต้องรับผิดชอบเช็คชื่อเข้าแถววันนี้ = ห้องประจำชั้นของฉัน (ที่ไม่มีคนแทน) + ห้องที่ฉันรับมอบหมายให้แทน
  const responsibleClasses = useMemo(() => {
    const myOwn = homeRoomClasses.filter((c: { id: string }) => {
      const covering = rollCallSubByClassId.get(c.id);
      return !(covering && matchesTeacherIdentity(covering.originalTeacherId, identityKeys));
    });
    return [...myOwn, ...substituteRollCallClasses];
  }, [homeRoomClasses, substituteRollCallClasses, rollCallSubByClassId, identityKeys]);

  const checkedClassCount = responsibleClasses.filter((c: { id: string }) => sessionsByClassId[c.id]).length;

  const dayPanelStyle = getDayCandyStyle(todayNum);
  const showUncheckedSplit = !isRollCallBlocked && checkedClassCount === 0 && homeRoomClasses.length > 0;
  const allChecked = responsibleClasses.length > 0 && checkedClassCount === responsibleClasses.length;

  const aggregatedSummary = useMemo(() => {
    const totals = { present: 0, late: 0, absent: 0, leave: 0 };
    for (const cls of responsibleClasses) {
      const session = sessionsByClassId[cls.id];
      if (!session) continue;
      totals.present += session.summary.present;
      totals.late += session.summary.late;
      totals.absent += session.summary.absent;
      totals.leave += session.summary.leave;
    }
    return totals;
  }, [responsibleClasses, sessionsByClassId]);

  const checkedStudentTotal =
    aggregatedSummary.present +
    aggregatedSummary.late +
    aggregatedSummary.absent +
    aggregatedSummary.leave;

  const openClassEditor = (classId: string) => {
    if (isRollCallBlocked) {
      setBlockedMessage(
        isWeekend
          ? 'วันนี้เป็นวันหยุดสุดสัปดาห์ ไม่สามารถเช็กชื่อเข้าแถวได้'
          : `วันนี้เป็นวันหยุด${holidayTitle ? ` (${holidayTitle})` : ''} ไม่สามารถเช็กชื่อเข้าแถวได้`,
      );
      setBlockedPopupOpen(true);
      return;
    }
    setSelectedClassId(classId);
    setStudentRows([]);
    setAllPresentSnapshot(null);
    setEditMode(false);
  };

  const resetEditor = () => {
    setSelectedClassId(null);
    setStudentRows([]);
    setAllPresentSnapshot(null);
    setEditMode(false);
  };

  const setStudentStatus = (studentId: string, status: MarkableStatus) => {
    if (isReadOnly || isRollCallBlocked) return;
    setStudentRows((prev) =>
      prev.map((row) =>
        row.studentId === studentId
          ? { ...row, status: row.status === status ? 'unmarked' : status }
          : row,
      ),
    );
    setAllPresentSnapshot(null);
  };

  const handleToggleAllChecked = () => {
    if (isReadOnly || isRollCallBlocked) return;
    if (allPresentSnapshot) {
      setStudentRows(allPresentSnapshot);
      setAllPresentSnapshot(null);
      return;
    }
    setAllPresentSnapshot(rowsToUse);
    setStudentRows((prev) =>
      prev.map((row) =>
        row.status === 'leave' ? row : { ...row, status: 'present' as RollCallStatus },
      ),
    );
  };

  const handleSave = () => {
    if (!selectedClass || !year || activeSemester == null || isRollCallBlocked) return;

    if (existingSession && !editMode) {
      setEditMode(true);
      return;
    }

    const unmarkedCount = rowsToUse.filter((r) => r.status === 'unmarked').length;
    if (unmarkedCount > 0) {
      setIncompletePopupOpen(true);
      return;
    }

    saveRollCall(
      {
        date: today,
        classId: selectedClass.id,
        className: (selectedClass as { className?: string }).className || selectedClass.id,
        departmentId: String((selectedClass as { departmentId?: string }).departmentId ?? ''),
        academicYearId: year,
        semester: activeSemester as 1 | 2,
        recordedBy: user?.uid || '',
        recordedByName: userData?.displayName || '',
        attendance: rowsToUse,
      },
      {
        onSuccess: (savedSession) => {
          queryClient.setQueryData(['morningRollCall', selectedClass.id, today], savedSession);
          setEditMode(false);
          setAllPresentSnapshot(null);
          setSaveSuccessPopupOpen(true);
        },
      },
    );
  };

  const primaryClassName = primaryClass?.className || primaryClass?.id || '';
  // เมื่อไม่มีห้องประจำชั้นของตัวเอง (มีแต่ห้องที่รับมอบหมายให้เช็คชื่อแทน) ใช้ห้องแรกที่รับผิดชอบแทน
  const headerPrimaryClassName = primaryClassName || responsibleClasses[0]?.className || responsibleClasses[0]?.id || '';

  const statusBadgeLabel = isRollCallBlocked
    ? 'วันหยุด'
    : checkedClassCount === 0
      ? 'ยังไม่เช็ค'
      : allChecked
        ? 'เช็คแล้ว'
        : `${checkedClassCount}/${responsibleClasses.length}`;

  const headerSubtitle =
    checkedClassCount > 0
      ? responsibleClasses.length > 1
        ? `${checkedClassCount} ห้อง · ${checkedStudentTotal} น.`
        : `${headerPrimaryClassName} · ${checkedStudentTotal} น.`
      : `วัน${dayLabels[todayNum]} · ${todayDateLabel}`;

  if (!isLoaded || loadingSessions || loadingHomeroomClasses || (primaryClass && !studentCountsReady)) {
    return <WidgetSkeleton variant="wide" />;
  }

  if (responsibleClasses.length === 0) return null;

  const widgetCardProps = {
    onClick: () => setDrawerOpen(true),
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') setDrawerOpen(true);
    },
    role: 'button' as const,
    tabIndex: 0,
  };

  return (
    <>
      {showUncheckedSplit ? (
        <div className={ROLL_CALL_SPLIT_SHELL} {...widgetCardProps}>
          <div
            style={{
              ...dayPanelStyle,
              boxShadow: getDayCandyBoxShadow(dayPanelStyle.glow),
            }}
            className={cn(
              DAY_CANDY_SURFACE_CLASS,
              'flex h-full w-[38%] shrink-0 flex-col items-center justify-center rounded-xl px-1 text-slate-900',
            )}
          >
            <span className="text-[44px] font-black leading-none tabular-nums tracking-tight text-slate-900 drop-shadow-[0_1px_0_rgba(255,255,255,0.45)]">
              {displayStudentCount}
            </span>
            <span className="text-[11px] font-bold mt-1.5 text-slate-800/85">นักเรียน</span>
          </div>

          <div
            style={WIDGET_GLASS}
            className="flex-1 min-w-0 h-full rounded-xl p-3 flex flex-col justify-between"
          >
            <div className="min-w-0">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-black text-slate-800 leading-tight truncate">
                  เช็คชื่อเข้าแถว
                </p>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full shrink-0 bg-slate-100 text-slate-500">
                  ยังไม่เช็ค
                </span>
              </div>
              <p className="text-[10px] font-semibold text-slate-500 truncate mt-0.5">
                {headerSubtitle}
              </p>
              {homeRoomClasses.length === 1 && primaryClassName ? (
                <p className="text-[11px] font-bold text-slate-700 truncate mt-1">{primaryClassName}</p>
              ) : (
                <p className="text-[11px] font-bold text-slate-700 truncate mt-1">
                  {homeRoomClasses.length} ห้องเรียน
                </p>
              )}
            </div>

            <div className="w-full rounded-xl bg-slate-900 text-white text-center py-2.5 text-[12px] font-black shadow-sm">
              แตะเพื่อเช็คชื่อ
            </div>
          </div>
        </div>
      ) : (
        <div
          style={isRollCallBlocked ? holidayBlockedStyle : WIDGET_GLASS}
          className={`${WIDGET_CARD} cursor-pointer active:scale-[0.99] transition-transform`}
          {...widgetCardProps}
        >
          <div className="flex items-center justify-between shrink-0 gap-2">
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-black truncate leading-tight ${isRollCallBlocked ? 'text-white' : 'text-slate-800'}`}>
                เช็คชื่อเข้าแถว
              </p>
              <p className={`text-[10px] font-semibold truncate mt-0.5 ${isRollCallBlocked ? 'text-white/75' : 'text-slate-500'}`}>
                {headerSubtitle}
              </p>
            </div>
            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full shrink-0 ${
              isRollCallBlocked
                ? 'bg-white/20 text-white border border-white/30'
                : allChecked
                  ? 'bg-emerald-100 text-emerald-700'
                  : checkedClassCount > 0
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-slate-100 text-slate-500'
            }`}>
              {statusBadgeLabel}
            </span>
          </div>

          <div className="flex-1 min-h-0 flex items-center justify-center">
            {isRollCallBlocked ? (
              <p className="text-[11px] font-bold text-white/90 text-center leading-snug px-1">
                {isWeekend
                  ? 'วันหยุดสุดสัปดาห์ — ไม่ต้องเช็คชื่อ'
                  : `วันหยุด${holidayTitle ? ` · ${holidayTitle}` : ''}`}
              </p>
            ) : (
              <div className="grid grid-cols-4 gap-0.5 w-full px-0.5">
                {DONUT_STATUS.map((item) => (
                  <StatusDonut
                    key={item.key}
                    label={item.label}
                    value={aggregatedSummary[item.key]}
                    total={checkedStudentTotal}
                    color={item.color}
                    trackColor={item.track}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen} direction="right">
        <DrawerContent className={DRAWER_CONTENT_CLASS}>
          <div className={DRAWER_PANEL_CLASS}>
          <DrawerHeader className="px-4 pb-2">
            <div className="relative flex items-center justify-center min-h-10">
              {selectedClassId && !isReadOnly && !isRollCallBlocked && (
                <label className="absolute left-0 top-1/2 -translate-y-1/2 inline-flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isAllChecked}
                    onChange={handleToggleAllChecked}
                    className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-[11px] font-black text-slate-700">เช็กทั้งหมด</span>
                </label>
              )}
              {selectedClassId && isReadOnly && !isRollCallBlocked && (
                <button
                  type="button"
                  onClick={() => setEditMode(true)}
                  className="absolute left-0 top-1/2 -translate-y-1/2 inline-flex items-center gap-1.5 text-[11px] font-black text-blue-600 hover:text-blue-700 transition-colors"
                >
                  <HiPencilSquare className="w-4 h-4" />
                  แก้ไข
                </button>
              )}
              <div className="min-w-0 text-center px-12">
                {selectedClassId ? (
                  <>
                    <DrawerTitle className="text-base font-black text-slate-800">
                      เช็คชื่อเข้าแถว
                    </DrawerTitle>
                    <DrawerDescription className="text-xs text-slate-500 truncate">
                      {(selectedClass as { className?: string })?.className || selectedClassId}
                    </DrawerDescription>
                  </>
                ) : (
                  <DrawerTitle className="text-base font-black text-slate-800">เช็คชื่อเข้าแถววันนี้</DrawerTitle>
                )}
              </div>
              <div className={DRAWER_HEADER_RIGHT_ACTIONS}>
                {selectedClassId && (
                  <button
                    type="button"
                    onClick={resetEditor}
                    className={DRAWER_HEADER_ICON_BTN}
                    aria-label="กลับไปรายการห้อง"
                  >
                    <HiArrowLeft className="w-4 h-4" />
                  </button>
                )}
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

          <div className="px-4 pb-4 overflow-y-auto flex-1 min-h-0">
            {selectedClassId ? (
              isRollCallBlocked ? (
                <div className="h-full flex flex-col items-center justify-center py-10 px-6 text-center gap-3">
                  <div className={`w-14 h-14 rounded-2xl ${holidayBannerClass} flex items-center justify-center shadow-sm`}>
                    {isWeekend ? (
                      <HiSun className="w-7 h-7 text-white" aria-hidden />
                    ) : (
                      <HiCalendarDays className="w-7 h-7 text-white" aria-hidden />
                    )}
                  </div>
                  <p className="text-base font-black text-slate-800">
                    {isWeekend ? 'วันหยุดสุดสัปดาห์' : 'วันหยุด'}
                  </p>
                  <p className="text-sm font-semibold text-slate-500 leading-relaxed">
                    {isWeekend
                      ? 'ไม่ต้องเช็คชื่อเข้าแถว'
                      : `ไม่ต้องเช็คชื่อเข้าแถว${holidayTitle ? ` (${holidayTitle})` : ''}`}
                  </p>
                </div>
              ) : (loadingSession || loadingClassStudents) && studentRows.length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm font-semibold text-slate-500">
                  กำลังโหลดรายชื่อนักเรียน...
                </div>
              ) : rowsToUse.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center text-xs font-semibold text-slate-500">
                  ไม่พบรายชื่อนักเรียนในห้องนี้
                </div>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {rowsToUse.map((student) => {
                    const statusOption = student.status !== 'unmarked'
                      ? ROLL_CALL_OPTIONS.find((opt) => opt.value === student.status)
                      : null;

                    return (
                      <div
                        key={student.studentId}
                        className={[
                          'rounded-2xl border p-3 transition-colors duration-200',
                          statusOption?.cardClassName ?? 'bg-white border-slate-200',
                        ].join(' ')}
                      >
                        <div className="flex items-center justify-between gap-3 mb-2">
                          <div className="min-w-0">
                            <p className="text-[13px] font-black text-slate-800 truncate">{student.studentName}</p>
                            <p className="text-[11px] font-bold text-slate-400">{student.studentCode}</p>
                          </div>
                          <span
                            className={[
                              'text-[10px] font-black px-2 py-1 rounded-lg',
                              statusOption?.badgeClassName ?? 'bg-slate-100 text-slate-500',
                            ].join(' ')}
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
                                className={[
                                  'h-9 rounded-lg border text-[11px] font-black transition active:scale-[0.98]',
                                  isActive ? opt.activeClassName : opt.className,
                                  isReadOnly ? 'opacity-60 cursor-not-allowed' : '',
                                ].join(' ')}
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
              )
            ) : (
              isRollCallBlocked ? (
                <div className="flex flex-col gap-2.5">
                  <div className={`w-full rounded-2xl ${holidayBannerClass} p-4 text-center shadow-sm`}>
                    <div className="mx-auto w-14 h-14 rounded-2xl bg-white/20 border border-white/30 flex items-center justify-center mb-3">
                      {isWeekend ? (
                        <HiSun className="w-7 h-7 text-white" aria-hidden />
                      ) : (
                        <HiCalendarDays className="w-7 h-7 text-white" aria-hidden />
                      )}
                    </div>
                    <p className="text-base font-black text-white">
                      {isWeekend
                        ? 'วันหยุดสุดสัปดาห์'
                        : `วันหยุด${holidayTitle ? ` · ${holidayTitle}` : ''}`}
                    </p>
                    <p className={`text-sm font-semibold ${holidayBannerSubtextClass} mt-1`}>ไม่ต้องเช็คชื่อเข้าแถว</p>
                  </div>
                </div>
              ) : (
              <div className="flex flex-col gap-2.5">
                {homeRoomClasses.map((cls: { id: string; className?: string }) => {
                  const session = sessionsByClassId[cls.id];
                  const isChecked = !!session;
                  const covering = rollCallSubByClassId.get(cls.id);
                  const coveredByOther = covering && matchesTeacherIdentity(covering.originalTeacherId, identityKeys);
                  return (
                    <button
                      key={cls.id}
                      type="button"
                      onClick={() => openClassEditor(cls.id)}
                      className={[
                        'w-full text-left rounded-2xl border p-3.5 transition-all',
                        'hover:bg-slate-50 active:scale-[0.99]',
                        coveredByOther
                          ? 'border-indigo-200 bg-indigo-50/70'
                          : isChecked ? 'border-emerald-200 bg-emerald-50/70' : `${dayTheme.innerCard} hover:brightness-[0.98]`,
                      ].join(' ')}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-2xl shrink-0 border flex items-center justify-center ${
                          isChecked ? 'bg-emerald-600 border-emerald-500 text-white' : dayTheme.iconBox
                        }`}>
                          <HiUsers className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-black text-slate-800 truncate">{cls.className || cls.id}</p>
                          {coveredByOther ? (
                            <p className="text-[11px] font-semibold text-indigo-500 mt-0.5 truncate">
                              ครู{covering.substituteTeacherName}เช็คชื่อแทนแล้ว
                            </p>
                          ) : isChecked && session ? (
                            <p className="text-[11px] font-semibold text-slate-500 mt-0.5">
                              มา {session.summary.present} · ขาด {session.summary.absent} · สาย {session.summary.late} · ลา {session.summary.leave}
                            </p>
                          ) : (
                            <p className={`text-[11px] font-semibold mt-0.5 ${dayTheme.accent}`}>แตะเพื่อเช็คชื่อ</p>
                          )}
                        </div>
                        <span className={`text-[10px] font-black px-2 py-1 rounded-lg shrink-0 ${
                          coveredByOther
                            ? 'bg-indigo-100 text-indigo-700'
                            : isChecked ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                        }`}>
                          {coveredByOther ? 'มีครูแทนแล้ว' : isChecked ? 'เช็คแล้ว' : 'รอเช็ค'}
                        </span>
                      </div>
                    </button>
                  );
                })}

                {substituteRollCallClasses.map((cls) => {
                  const session = sessionsByClassId[cls.id];
                  const isChecked = !!session;
                  return (
                    <button
                      key={cls.id}
                      type="button"
                      onClick={() => openClassEditor(cls.id)}
                      className={[
                        'w-full text-left rounded-2xl border p-3.5 transition-all',
                        'hover:bg-slate-50 active:scale-[0.99]',
                        isChecked ? 'border-emerald-200 bg-emerald-50/70' : 'border-indigo-200 bg-indigo-50/40 hover:brightness-[0.98]',
                      ].join(' ')}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-2xl shrink-0 border flex items-center justify-center ${
                          isChecked ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-indigo-50 border-indigo-200 text-indigo-600'
                        }`}>
                          <HiUsers className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-black text-slate-800 truncate">{cls.className}</p>
                          {isChecked && session ? (
                            <p className="text-[11px] font-semibold text-slate-500 mt-0.5">
                              มา {session.summary.present} · ขาด {session.summary.absent} · สาย {session.summary.late} · ลา {session.summary.leave}
                            </p>
                          ) : (
                            <p className="text-[11px] font-semibold text-indigo-500 mt-0.5 truncate">
                              เช็คชื่อแทนให้ครู{cls.originalTeacherName}
                            </p>
                          )}
                        </div>
                        <span className={`text-[10px] font-black px-2 py-1 rounded-lg shrink-0 ${
                          isChecked ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700'
                        }`}>
                          {isChecked ? 'เช็คแล้ว' : 'รอเช็ค'}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
              )
            )}
          </div>

          {selectedClassId && !isRollCallBlocked && rowsToUse.length > 0 && (
            <div className="px-4 pb-4 pt-2 border-t border-slate-100 bg-white shrink-0">
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className={`w-full h-11 rounded-xl text-sm font-black transition active:scale-[0.99] disabled:opacity-60 ${
                  existingSession && !editMode
                    ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                    : 'bg-slate-900 text-white hover:bg-slate-800'
                }`}
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

      <Dialog open={saveSuccessPopupOpen} onOpenChange={setSaveSuccessPopupOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader className="items-center text-center">
            <div className="w-14 h-14 rounded-full flex items-center justify-center bg-emerald-100 text-emerald-600">
              <HiCheckCircle className="w-7 h-7" />
            </div>
            <DialogTitle className="text-lg font-black text-emerald-600">
              บันทึกเช็คชื่อเข้าแถวสำเร็จ
            </DialogTitle>
          </DialogHeader>
        </DialogContent>
      </Dialog>

      <Dialog open={incompletePopupOpen} onOpenChange={setIncompletePopupOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader className="items-center text-center">
            <div className="w-14 h-14 rounded-full flex items-center justify-center bg-amber-100 text-amber-600">
              <HiExclamationTriangle className="w-7 h-7" />
            </div>
            <DialogTitle className="text-lg font-black text-amber-600">เช็กชื่อยังไม่ครบ</DialogTitle>
            <DialogDescription className="text-sm text-slate-600">
              กรุณาเช็กชื่อให้ครบทุกคนก่อนบันทึก
              {rowsToUse.filter((r) => r.status === 'unmarked').length > 0 && (
                <> (ยังเหลือ {rowsToUse.filter((r) => r.status === 'unmarked').length} คน)</>
              )}
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>

      <Dialog open={blockedPopupOpen} onOpenChange={setBlockedPopupOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader className="items-center text-center">
            <div className="w-14 h-14 rounded-full flex items-center justify-center bg-amber-100 text-amber-600">
              <HiExclamationTriangle className="w-7 h-7" />
            </div>
            <DialogTitle className="text-lg font-black text-amber-600">ไม่สามารถเช็กชื่อได้</DialogTitle>
            <DialogDescription className="text-sm text-slate-600">{blockedMessage}</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </>
  );
}
