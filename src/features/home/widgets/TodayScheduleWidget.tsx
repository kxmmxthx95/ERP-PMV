import { useMemo, useState, useEffect, useCallback } from 'react';
import { Clock, MapPin as PinIcon } from 'lucide-react';
import { HiArrowLeft, HiCheckCircle, HiExclamationTriangle, HiPencilSquare, HiXMark } from 'react-icons/hi2';
import { DAY_CANDY_SURFACE_CLASS, WIDGET_GLASS, getDayCandyBoxShadow, getDayCandyStyle } from '../widgetStyles';
import { SubjectIcon } from '@/features/curriculum/utils/subjectVisual';
import { useSchedule } from '@/hooks/useSchedule';
import { useAuth } from '@/hooks/useAuth';
import { filterTeacherEntriesForSchoolDay } from '@/features/schedule/utils/syncScheduleTeachers';
import { useIsSchoolDayToday } from '@/hooks/useIsSchoolDayToday';
import { useTeachersCollection } from '@/hooks/useTeachersCollection';
import { useActiveAcademicYear } from '@/hooks/useActiveAcademicYear';
import { useStudentLeaveRequests } from '@/hooks/useLeaveRequests';
import { applyApprovedLeaveToClassAttendanceRows, findApprovedLeaveForStudentOnDate } from '@/lib/attendance/leaveRequestStudentMatch';
import { getLocalDateString } from '@/lib/calendar/schoolDay';
import { DEFAULT_SETTINGS } from '@/hooks/useScheduleSettings';
import type { SchoolDay, ScheduleEntry } from '@/types/schedule';
import { db } from '@/lib/firebase';
import { collection, doc, getDoc, getDocs, query, setDoc, where } from 'firebase/firestore';
import { fetchStudentsByIds } from '@/lib/firestoreShared/fetchStudentsByIds';
import { sessionCache } from '@/lib/sessionCache';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from '@/components/ui/drawer';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DRAWER_HEADER_ICON_BTN, DRAWER_HEADER_RIGHT_ACTIONS } from '@/lib/drawerHeaderBtn';
import { cn } from '@/lib/utils';

const ATTENDANCE_DRAWER_CONTENT_CLASS = cn(
  'flex h-dvh flex-col bg-transparent p-0 before:hidden',
  'data-[vaul-drawer-direction=right]:w-screen data-[vaul-drawer-direction=right]:max-w-none',
  'sm:h-full sm:data-[vaul-drawer-direction=right]:w-full sm:data-[vaul-drawer-direction=right]:max-w-md sm:p-2',
);

const ATTENDANCE_DRAWER_PANEL_CLASS = cn(
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

const SCHEDULE_WIDGET_SHELL =
  'rounded-2xl flex w-full h-[142px] min-h-[142px] overflow-hidden gap-2 self-stretch';

function resolveSubjectGroup(entry: Pick<ScheduleEntry, 'subjectGroup' | 'subjectName'>): string {
  return entry.subjectGroup || entry.subjectName;
}

const toDocId = (input: string) => input.replace(/[^\w.-]/g, '_');

export default function TodayScheduleWidget() {
  const { user, role } = useAuth();
  const { entries, classes } = useSchedule();
  const { teachers } = useTeachersCollection();
  const { year: activeYear, activeSemester } = useActiveAcademicYear();
  const {
    isHoliday: isNonSchoolDay,
    isWeekend,
    holidayTitle,
  } = useIsSchoolDayToday(role ?? 'teacher');

  const [today] = useState(() => getLocalDateString());
  const { requests: leaveRequests } = useStudentLeaveRequests(today);

  const [dayDrawerOpen, setDayDrawerOpen] = useState(false);
  const [selectedAttendanceEntry, setSelectedAttendanceEntry] = useState<ScheduleEntry | null>(null);
  const [attendanceRows, setAttendanceRows] = useState<AttendanceStudentRow[]>([]);
  const [loadingAttendanceRows, setLoadingAttendanceRows] = useState(false);
  const [savingAttendanceRows, setSavingAttendanceRows] = useState(false);
  const [allPresentSnapshot, setAllPresentSnapshot] = useState<AttendanceStudentRow[] | null>(null);
  const [isAttendanceLocked, setIsAttendanceLocked] = useState(false);
  const [saveSuccessPopupOpen, setSaveSuccessPopupOpen] = useState(false);
  const [incompletePopupOpen, setIncompletePopupOpen] = useState(false);

  // 1. Resolve teacher identity for current login (support both teacher.id and teacher.userId mapping)
  const teacherProfiles = useMemo(() => {
    if (!user?.uid) return [];
    const loginEmail = (user.email || '').trim().toLowerCase();
    return teachers.filter((t) => {
      const teacherEmail = (t.email || '').trim().toLowerCase();
      return (
        t.userId === user.uid ||
        t.id === user.uid ||
        (loginEmail !== '' && teacherEmail !== '' && teacherEmail === loginEmail)
      );
    });
  }, [teachers, user?.uid, user?.email]);

  const teacherProfile = teacherProfiles[0] ?? null;

  // 2. Identify today's school day (1=Mon...5=Fri)
  const todayNum = new Date().getDay();
  const schoolDay = (todayNum >= 1 && todayNum <= 5) ? todayNum as SchoolDay : null;
  const isWeekendHoliday = isNonSchoolDay;
  const dayAbbrEn: Record<number, string> = {
    0: 'SUN', 1: 'MON', 2: 'TUE', 3: 'WED', 4: 'THU', 5: 'FRI', 6: 'SAT',
  };
  const dayPanelStyle = getDayCandyStyle(todayNum);
  const dayThemeMap: Record<number, { badge: string; icon: string; periodBox: string; periodLabel: string; periodNumber: string }> = {
    0: { // Sunday
      badge: 'bg-red-50 text-red-600 border-red-100',
      icon: 'text-red-500',
      periodBox: 'bg-red-50 border-red-200/40',
      periodLabel: 'text-red-500',
      periodNumber: 'text-red-700',
    },
    1: { // Monday
      badge: 'bg-amber-50 text-amber-700 border-amber-100',
      icon: 'text-amber-600',
      periodBox: 'bg-amber-50 border-amber-200/40',
      periodLabel: 'text-amber-600',
      periodNumber: 'text-amber-700',
    },
    2: { // Tuesday
      badge: 'bg-pink-50 text-pink-600 border-pink-100',
      icon: 'text-pink-500',
      periodBox: 'bg-pink-50 border-pink-200/40',
      periodLabel: 'text-pink-500',
      periodNumber: 'text-pink-700',
    },
    3: { // Wednesday
      badge: 'bg-emerald-50 text-emerald-600 border-emerald-100',
      icon: 'text-emerald-500',
      periodBox: 'bg-emerald-50 border-emerald-200/40',
      periodLabel: 'text-emerald-500',
      periodNumber: 'text-emerald-700',
    },
    4: { // Thursday
      badge: 'bg-orange-50 text-orange-600 border-orange-100',
      icon: 'text-orange-500',
      periodBox: 'bg-orange-50 border-orange-200/40',
      periodLabel: 'text-orange-500',
      periodNumber: 'text-orange-700',
    },
    5: { // Friday
      badge: 'bg-blue-50 text-blue-600 border-blue-100',
      icon: 'text-blue-500',
      periodBox: 'bg-blue-50 border-blue-200/40',
      periodLabel: 'text-blue-500',
      periodNumber: 'text-blue-700',
    },
    6: { // Saturday
      badge: 'bg-violet-50 text-violet-600 border-violet-100',
      icon: 'text-violet-500',
      periodBox: 'bg-violet-50 border-violet-200/40',
      periodLabel: 'text-violet-500',
      periodNumber: 'text-violet-700',
    },
  };
  const dayTheme = dayThemeMap[todayNum] || dayThemeMap[5];
  const todayDateLabel = useMemo(() => {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear() + 543;
    return `${day}/${month}/${year}`;
  }, []);

  // 3. Filter entries for this teacher today (same logic as ตารางสอน)
  const todaysEntries = useMemo(() => {
    if (!schoolDay || !user?.uid || !activeYear) return [];
    return filterTeacherEntriesForSchoolDay(
      entries,
      user.uid,
      activeYear,
      (activeSemester ?? 1) as 1 | 2,
      schoolDay,
      teachers,
      teachers,
    );
  }, [entries, user?.uid, schoolDay, activeYear, activeSemester, teachers]);

  // Helper to get class label
  const getClassLabel = (id: string) => classes.find(c => c.id === id)?.label || id;

  const resetAttendanceEditor = () => {
    setSelectedAttendanceEntry(null);
    setAttendanceRows([]);
    setLoadingAttendanceRows(false);
    setSavingAttendanceRows(false);
    setAllPresentSnapshot(null);
    setIsAttendanceLocked(false);
    setSaveSuccessPopupOpen(false);
    setIncompletePopupOpen(false);
  };

  const handleBackToSubjectList = useCallback(() => {
    setSelectedAttendanceEntry(null);
    setIsAttendanceLocked(false);
    setAllPresentSnapshot(null);
  }, []);

  // Header back (desktop กลับไปเมนู / mobile กลับเมนู) → subject list when checking attendance
  useEffect(() => {
    if (!dayDrawerOpen || !selectedAttendanceEntry) return;

    const isPortalBackButton = (target: EventTarget | null) => {
      if (!(target instanceof Element)) return false;
      const btn = target.closest('button');
      if (!btn) return false;
      if (btn.id === 'portal-default-mobile-back') return true;
      const title = btn.getAttribute('title') ?? '';
      const label = btn.getAttribute('aria-label') ?? '';
      if (title === 'กลับไปเมนู' || title === 'กลับเมนู' || label === 'กลับไปเมนู') return true;
      // Home widget: desktop «เมนู» header while drawer is in attendance entry
      return title === 'เมนู' && label === 'เมนู';
    };

    const onClick = (e: MouseEvent) => {
      if (!isPortalBackButton(e.target)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      handleBackToSubjectList();
    };

    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [dayDrawerOpen, selectedAttendanceEntry, handleBackToSubjectList]);

  // 4. Fetch settings (once + cache) for involved classes to reduce Firestore reads.
  const [classSettings, setClassSettings] = useState<Record<string, any>>({});
  
  useEffect(() => {
    if (todaysEntries.length === 0) {
      setClassSettings({});
      return;
    }

    let cancelled = false;
    const involvedClassIds = [...new Set(todaysEntries.map(e => e.classId))];

    async function loadClassSettings() {
      const loaded: Record<string, any> = {};

      for (const cid of involvedClassIds) {
        const cacheKey = `class_settings:${cid}`;
        const cached = sessionCache.get<any>(cacheKey);
        if (cached) {
          loaded[cid] = cached;
          continue;
        }

        try {
          const snap = await getDoc(doc(db, 'class_settings', cid));
          if (snap.exists()) {
            const data = snap.data();
            loaded[cid] = data;
            // class settings change rarely, cache for 1 hour
            sessionCache.set(cacheKey, data);
          }
        } catch {
          // Keep silent; widget can still fallback to DEFAULT_SETTINGS.
        }
      }

      if (!cancelled) {
        setClassSettings(loaded);
      }
    }

    loadClassSettings();

    return () => {
      cancelled = true;
    };
  }, [todaysEntries]);

  // 5. Resolve time for a specific entry and check if it's active
  const getSessionStatus = (entry: any) => {
    const settings = classSettings[entry.classId] || DEFAULT_SETTINGS;
    const times = settings.periodTimes || {};
    const pStr = String(entry.period);
    let timeRange = times[pStr];
    
    // Fallback calculation for extended periods
    if (!timeRange && entry.period > (settings.periodCount || 8)) {
      const pCount = settings.periodCount || 8;
      let lastEndMin = 480; 
      for (let i = 1; i <= pCount; i++) {
        const t = times[String(i)];
        if (t && t.includes(' - ')) {
          const parts = t.split(' - ')[1].split(':');
          lastEndMin = parseInt(parts[0]) * 60 + parseInt(parts[1]);
        }
      }
      const startMin = lastEndMin + (entry.period - pCount - 1) * 50;
      const endMin = startMin + 50;
      timeRange = `${String(Math.floor(startMin / 60)).padStart(2, '0')}:${String(startMin % 60).padStart(2, '0')} - ${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`;
    }

    if (!timeRange) return { startTime: '--:--', endTime: '--:--', isActive: false, isUpcoming: false };

    const [startStr, endStr] = timeRange.split(' - ');
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    
    const [sH, sM] = startStr.split(':').map(Number);
    const [eH, eM] = endStr.split(':').map(Number);
    const startMin = sH * 60 + sM;
    const endMin = eH * 60 + eM;

    return {
      startTime: startStr,
      endTime: endStr,
      isActive: nowMin >= startMin && nowMin < endMin,
      isUpcoming: nowMin < startMin,
    };
  };

  const selectedSessionStatus = selectedAttendanceEntry
    ? getSessionStatus(selectedAttendanceEntry)
    : null;
  const isSelectedPeriodUpcoming = selectedSessionStatus?.isUpcoming === true;

  // 6. Identify the most relevant session (Active > Next Upcoming > Last today)
  const relevantEntry = useMemo(() => {
    if (todaysEntries.length === 0) return null;

    const active = todaysEntries.find((e) => getSessionStatus(e).isActive);
    if (active) return active;

    const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
    const upcoming = todaysEntries.find((e) => {
      const { startTime } = getSessionStatus(e);
      if (startTime === '--:--') return false;
      const [h, m] = startTime.split(':').map(Number);
      return h * 60 + m > nowMin;
    });
    if (upcoming) return upcoming;

    return todaysEntries[todaysEntries.length - 1];
  }, [todaysEntries, classSettings]);

  const allSessionsEnded = useMemo(() => {
    if (todaysEntries.length === 0) return false;
    const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
    return todaysEntries.every((e) => {
      const { endTime } = getSessionStatus(e);
      if (endTime === '--:--') return false;
      const [h, m] = endTime.split(':').map(Number);
      return nowMin >= h * 60 + m;
    });
  }, [todaysEntries, classSettings]);

  useEffect(() => {
    if (!dayDrawerOpen) {
      resetAttendanceEditor();
    }
  }, [dayDrawerOpen]);

  useEffect(() => {
    if (!selectedAttendanceEntry || isAttendanceLocked) return;
    setAttendanceRows((prev) => {
      if (prev.length === 0) return prev;
      const studentDetails = new Map(
        prev.map((row) => [row.id, { id: row.id, studentCode: row.code }]),
      );
      return applyApprovedLeaveToClassAttendanceRows(prev, studentDetails, leaveRequests, today);
    });
  }, [leaveRequests, today, selectedAttendanceEntry, isAttendanceLocked]);

  const openAttendanceEditor = async (entry: ScheduleEntry) => {
    setSelectedAttendanceEntry(entry);

    const sessionStatus = getSessionStatus(entry);
    if (sessionStatus.isUpcoming) {
      setAttendanceRows([]);
      setAllPresentSnapshot(null);
      setIsAttendanceLocked(false);
      setLoadingAttendanceRows(false);
      return;
    }

    setLoadingAttendanceRows(true);

    try {
      const classDoc = classes.find((c) => c.id === entry.classId) as (typeof classes[number] & { studentIds?: string[] }) | undefined;
      const classStudentIds = (classDoc?.studentIds || []).filter((id): id is string => typeof id === 'string' && id.trim() !== '');
      const studentMap = new Map<string, { studentCode?: string; prefix?: string; firstName?: string; lastName?: string }>();

      if (classStudentIds.length > 0) {
        const students = await fetchStudentsByIds<{ studentCode?: string; prefix?: string; firstName?: string; lastName?: string; id: string }>(classStudentIds);
        students.forEach((row) => {
          studentMap.set(row.id, row);
        });
      } else {
        const enrollSnap = await getDocs(
          query(collection(db, 'enrollments'), where('classId', '==', entry.classId)),
        );
        const enrollmentStudentIds = enrollSnap.docs
          .map((snap) => snap.data().studentId as string | undefined)
          .filter((id): id is string => typeof id === 'string' && id.trim() !== '');

        if (enrollmentStudentIds.length > 0) {
          const students = await fetchStudentsByIds<{ studentCode?: string; prefix?: string; firstName?: string; lastName?: string; id: string }>(enrollmentStudentIds);
          students.forEach((row) => {
            studentMap.set(row.id, row);
          });
        } else {
          const [byClassId, byClassroomId] = await Promise.all([
            getDocs(query(collection(db, 'students'), where('classId', '==', entry.classId))),
            getDocs(query(collection(db, 'students'), where('classroomId', '==', entry.classId))),
          ]);

          byClassId.forEach((snap) => studentMap.set(snap.id, snap.data() as { studentCode?: string; prefix?: string; firstName?: string; lastName?: string }));
          byClassroomId.forEach((snap) => studentMap.set(snap.id, snap.data() as { studentCode?: string; prefix?: string; firstName?: string; lastName?: string }));
        }
      }

      const todayDate = today;
      const sessionId = `${todayDate}_${toDocId(entry.classId)}_${toDocId(entry.subjectId)}_${entry.period}`;
      const sessionSnap = await getDoc(doc(db, 'class_sessions', sessionId));
      const statusMap = new Map<string, AttendanceStatus>();

      let hasSavedSession = false;
      if (sessionSnap.exists()) {
        hasSavedSession = true;
        const attendance = (sessionSnap.data().attendance || []) as Array<{ studentId: string; status: AttendanceStatus }>;
        attendance.forEach((row) => {
          if (row?.studentId && row?.status) statusMap.set(row.studentId, row.status);
        });
      }

      const rows: AttendanceStudentRow[] = [...studentMap.entries()]
        .map(([id, data]) => ({
          id,
          code: data.studentCode || '-',
          name: `${data.prefix || ''}${data.firstName || ''} ${data.lastName || ''}`.trim() || id,
          status: statusMap.get(id) ?? null,
        }))
        .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));

      const studentDetails = new Map(
        [...studentMap.entries()].map(([id, data]) => [
          id,
          {
            id,
            studentCode: data.studentCode,
            prefix: data.prefix,
            firstName: data.firstName,
            lastName: data.lastName,
          },
        ]),
      );
      const rowsWithLeave = applyApprovedLeaveToClassAttendanceRows(
        rows,
        studentDetails,
        leaveRequests,
        todayDate,
      );

      setAttendanceRows(rowsWithLeave);
      setAllPresentSnapshot(null);
      setIsAttendanceLocked(hasSavedSession);
    } catch {
      setSelectedAttendanceEntry(null);
      setAttendanceRows([]);
      setIsAttendanceLocked(false);
    } finally {
      setLoadingAttendanceRows(false);
    }
  };

  const setStudentStatus = (studentId: string, status: AttendanceStatus) => {
    if (isAttendanceLocked) return;
    const row = attendanceRows.find((r) => r.id === studentId);
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
    setAttendanceRows((prev) =>
      prev.map((r) =>
        r.id === studentId
          ? { ...r, status: nextStatus }
          : r,
      ),
    );
    setAllPresentSnapshot(null);
  };
  const isAllChecked = allPresentSnapshot !== null;
  const handleToggleAllChecked = () => {
    if (isAttendanceLocked) return;
    if (allPresentSnapshot) {
      setAttendanceRows(allPresentSnapshot);
      setAllPresentSnapshot(null);
      return;
    }
    setAllPresentSnapshot(attendanceRows);
    setAttendanceRows((prev) =>
      prev.map((row) => (row.status === 'leave' ? row : { ...row, status: 'present' })),
    );
  };

  const handleSaveAttendance = async () => {
    if (!selectedAttendanceEntry || attendanceRows.length === 0) return;

    const uncheckedCount = attendanceRows.filter((r) => r.status === null).length;
    if (uncheckedCount > 0) {
      setIncompletePopupOpen(true);
      return;
    }

    setSavingAttendanceRows(true);

    try {
      const currentClass = classes.find((c) => c.id === selectedAttendanceEntry.classId) as
        | (typeof classes[number] & { departmentId?: string; department?: string })
        | undefined;
      const departmentId = (currentClass?.departmentId || currentClass?.department || 'secondary') as string;
      const todayDate = today;
      const recordedAt = new Date().toISOString();
      const sessionDocId = `${todayDate}_${toDocId(selectedAttendanceEntry.classId)}_${toDocId(selectedAttendanceEntry.subjectId)}_${selectedAttendanceEntry.period}`;

      const presentStudentIds = attendanceRows.filter((r) => r.status === 'present').map((r) => r.id);
      const lateStudentIds = attendanceRows.filter((r) => r.status === 'late').map((r) => r.id);
      const absentStudentIds = attendanceRows.filter((r) => r.status === 'absent').map((r) => r.id);
      const leaveStudentIds = attendanceRows.filter((r) => r.status === 'leave').map((r) => r.id);
      const checkedRows = attendanceRows.filter(
        (r): r is AttendanceStudentRow & { status: AttendanceStatus } => r.status !== null,
      );

      await setDoc(
        doc(db, 'class_sessions', sessionDocId),
        {
          scheduleId: sessionDocId,
          subjectId: selectedAttendanceEntry.subjectId,
          subjectName: selectedAttendanceEntry.subjectName,
          subjectCode: selectedAttendanceEntry.subjectCode || selectedAttendanceEntry.subjectId,
          classId: selectedAttendanceEntry.classId,
          className: getClassLabel(selectedAttendanceEntry.classId),
          teacherId: selectedAttendanceEntry.teacherId,
          teacherName: selectedAttendanceEntry.teacherName || teacherProfile?.name || '',
          departmentId,
          academicYearId: String(activeYear || '2568'),
          semester: (activeSemester || 1) as 1 | 2,
          date: todayDate,
          period: selectedAttendanceEntry.period,
          topic: '',
          summary: {
            present: presentStudentIds.length,
            late: lateStudentIds.length,
            absent: absentStudentIds.length,
            leave: leaveStudentIds.length,
          },
          attendance: checkedRows.map((r) => ({
            studentId: r.id,
            status: r.status,
            note: '',
          })),
          presentStudentIds,
          absentStudentIds,
          lateStudentIds,
          leaveStudentIds,
          totalStudents: attendanceRows.length,
          // เคลียร์ flag จาก sync ใบลา — ไม่เช่นนั้นงานประจำวันครูค้าง «รอทำ»
          leaveSyncOnly: false,
          updatedAt: recordedAt,
          createdAt: recordedAt,
        },
        { merge: true },
      );

      setIsAttendanceLocked(true);
      setAllPresentSnapshot(null);
      setSaveSuccessPopupOpen(true);
    } catch {
    } finally {
      setSavingAttendanceRows(false);
    }
  };

  return (
    <>
    <div className={SCHEDULE_WIDGET_SHELL}>
        <div
          style={{
            ...dayPanelStyle,
            boxShadow: getDayCandyBoxShadow(dayPanelStyle.glow),
          }}
          className={cn(
            DAY_CANDY_SURFACE_CLASS,
            'flex h-full min-w-0 flex-1 flex-col items-center justify-center rounded-xl px-1 text-slate-900',
          )}
        >
          <span className="text-[34px] font-black leading-none tracking-tight text-slate-900 drop-shadow-[0_1px_0_rgba(255,255,255,0.45)]">
            {dayAbbrEn[todayNum]}
          </span>
          <span className="text-[12px] font-bold mt-1.5 tabular-nums text-slate-800">
            {todayDateLabel}
          </span>
          {isWeekendHoliday ? (
            <span className="text-[11px] font-black mt-2 px-2 py-0.5 rounded-md bg-white/70 text-slate-900 shadow-sm">
              วันหยุด
            </span>
          ) : todaysEntries.length > 0 ? (
            <span className="text-[11px] font-black mt-2 px-2 py-0.5 rounded-md bg-white/70 text-slate-900 shadow-sm">
              {todaysEntries.length} คาบ
            </span>
          ) : null}
        </div>

        <div
          style={!isWeekendHoliday ? WIDGET_GLASS : undefined}
          className={`flex-1 min-w-0 h-full rounded-xl flex items-stretch px-1.5 py-1 ${
            isWeekendHoliday ? 'bg-white/90 shadow-[0_1px_4px_rgba(15,23,42,0.06)]' : ''
          }`}
        >
          {!user ? (
            <p className={`text-[10px] font-bold w-full text-center leading-snug ${
              isWeekendHoliday ? 'text-white/75' : 'text-slate-400'
            }`}>
              กรุณาเข้าสู่ระบบ
            </p>
          ) : !teacherProfile && todaysEntries.length === 0 ? (
            <p className={`text-[10px] font-bold w-full text-center leading-snug ${
              isWeekendHoliday ? 'text-white/80' : 'text-slate-400'
            }`}>
              ไม่พบโปรไฟล์ครู
            </p>
          ) : isNonSchoolDay ? (
            <div className="flex h-full flex-col items-center justify-center gap-1 w-full min-w-0 text-center px-1">
              <p className="text-[10px] font-black text-slate-800 leading-tight line-clamp-2">
                {isWeekend ? 'วันหยุดสุดสัปดาห์' : `วันหยุด${holidayTitle ? ` · ${holidayTitle}` : ''}`}
              </p>
              <p className="text-[9px] font-bold text-slate-500">ไม่ต้องเช็กชื่อ</p>
            </div>
          ) : todaysEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-1 w-full text-center">
              <Clock size={14} className="text-slate-300 shrink-0" />
              <p className="text-[10px] font-bold text-slate-400 leading-snug">ไม่มีตารางสอน</p>
            </div>
          ) : relevantEntry ? (
            (() => {
              const { startTime, isActive } = getSessionStatus(relevantEntry);
              return (
                <button
                  type="button"
                  onClick={() => setDayDrawerOpen(true)}
                  className={`w-full h-full rounded-lg px-1 py-1 transition-all active:scale-[0.99] min-h-0 flex flex-col items-center justify-between ${
                    isActive
                      ? 'bg-gradient-to-r from-blue-200/80 via-sky-100/90 to-white ring-1 ring-blue-300/60 shadow-sm'
                      : ''
                  }`}
                >
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 shadow-sm"
                    style={{ background: dayPanelStyle.background }}
                  >
                    <SubjectIcon
                      subjectGroup={resolveSubjectGroup(relevantEntry)}
                      size={17}
                      className="text-slate-800 drop-shadow-[0_1px_0_rgba(255,255,255,0.45)]"
                    />
                  </div>

                  <div className="flex-1 min-h-0 flex flex-col items-center justify-center text-center w-full min-w-0 px-0.5">
                    <span className={`text-[10px] font-black ${isActive ? 'text-blue-600' : dayTheme.periodLabel}`}>
                      คาบ {relevantEntry.period}
                    </span>
                    <p className="text-[10px] font-black text-slate-800 line-clamp-2 leading-tight mt-0.5 w-full">
                      {relevantEntry.subjectName}
                    </p>
                    <p className="text-[9px] font-bold text-slate-400 truncate mt-0.5 w-full max-w-full">
                      {getClassLabel(relevantEntry.classId)}
                      {allSessionsEnded ? ' · จบแล้ว' : ''}
                    </p>
                  </div>

                  <span className="text-[10px] font-bold text-slate-400 tabular-nums shrink-0">
                    {startTime}
                  </span>
                </button>
              );
            })()
          ) : null}
        </div>
    </div>

      <Drawer open={dayDrawerOpen} onOpenChange={setDayDrawerOpen} direction="right">
        <DrawerContent className={ATTENDANCE_DRAWER_CONTENT_CLASS}>
          <div className={ATTENDANCE_DRAWER_PANEL_CLASS}>
          <DrawerHeader className="shrink-0 px-4 pb-2 pt-4">
            <div className="relative flex min-h-10 items-center justify-center">
              {selectedAttendanceEntry && !isSelectedPeriodUpcoming && (
                isAttendanceLocked ? (
                  <button
                    type="button"
                    onClick={() => setIsAttendanceLocked(false)}
                    className="absolute left-0 top-1/2 -translate-y-1/2 inline-flex items-center gap-1.5 text-[11px] font-black text-blue-600 hover:text-blue-700 transition-colors"
                  >
                    <HiPencilSquare className="w-4 h-4" />
                    แก้ไข
                  </button>
                ) : (
                  <label className="absolute left-0 top-1/2 -translate-y-1/2 inline-flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isAllChecked}
                      onChange={handleToggleAllChecked}
                      className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-[11px] font-black text-slate-700">เช็กทั้งหมด</span>
                  </label>
                )
              )}
              <div className="min-w-0 px-12 text-center">
                {selectedAttendanceEntry ? (
                  <>
                    <DrawerTitle className="text-base font-black text-slate-800">
                      เช็กชื่อคาบที่ {selectedAttendanceEntry.period}
                    </DrawerTitle>
                    <DrawerDescription className="text-xs text-slate-500">
                      {selectedAttendanceEntry.subjectName} · {getClassLabel(selectedAttendanceEntry.classId)}
                    </DrawerDescription>
                  </>
                ) : (
                  <>
                    <DrawerTitle className="text-base font-black text-slate-800">รายวิชาที่สอนวันนี้</DrawerTitle>
                  </>
                )}
              </div>
              <div className={DRAWER_HEADER_RIGHT_ACTIONS}>
                {selectedAttendanceEntry && (
                  <button
                    type="button"
                    onClick={handleBackToSubjectList}
                    className={DRAWER_HEADER_ICON_BTN}
                    aria-label="กลับไปรายการคาบ"
                    title="กลับไปรายการคาบ"
                  >
                    <HiArrowLeft className="h-4 w-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setDayDrawerOpen(false)}
                  className={DRAWER_HEADER_ICON_BTN}
                  aria-label="ปิด"
                >
                  <HiXMark className="h-4 w-4" />
                </button>
              </div>
            </div>
          </DrawerHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
            {selectedAttendanceEntry ? (
              isSelectedPeriodUpcoming ? (
                <div className="h-full flex flex-col items-center justify-center py-10 px-6 text-center gap-3">
                  <div className="w-14 h-14 rounded-full bg-amber-50 border border-amber-100 flex items-center justify-center">
                    <Clock size={24} className="text-amber-500" />
                  </div>
                  <p className="text-base font-black text-slate-800">ยังไม่ถึงเวลาคาบเรียน</p>
                  <p className="text-sm font-semibold text-slate-500 leading-relaxed">
                    กรุณาเช็กชื่อเมื่อถึงเวลา{' '}
                    <span className="font-black text-amber-600">{selectedSessionStatus?.startTime ?? '--:--'} น.</span>
                  </p>
                </div>
              ) : loadingAttendanceRows ? (
                <div className="h-full flex items-center justify-center text-sm font-semibold text-slate-500">
                  กำลังโหลดรายชื่อนักเรียน...
                </div>
              ) : attendanceRows.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center text-xs font-semibold text-slate-500">
                  ไม่พบรายชื่อนักเรียนในห้องนี้
                </div>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {attendanceRows.map((student) => {
                    const statusOption = student.status
                      ? ATTENDANCE_OPTIONS.find((opt) => opt.value === student.status)
                      : null;

                    return (
                    <div
                      key={student.id}
                      className={[
                        'rounded-2xl border p-3 transition-colors duration-200',
                        statusOption?.cardClassName ?? 'bg-white border-slate-200',
                      ].join(' ')}
                    >
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <div className="min-w-0">
                          <p className="text-[13px] font-black text-slate-800 truncate">{student.name}</p>
                          <p className="text-[11px] font-bold text-slate-400">{student.code}</p>
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
                        {ATTENDANCE_OPTIONS.map((opt) => {
                          const isActive = student.status === opt.value;
                          const leaveBlocked =
                            opt.value === 'leave'
                            && !findApprovedLeaveForStudentOnDate(
                              leaveRequests,
                              { id: student.id, studentCode: student.code },
                              today,
                              student.name,
                            );
                          const disabled = isAttendanceLocked || leaveBlocked;
                          return (
                            <button
                              key={opt.value}
                              type="button"
                              disabled={disabled}
                              title={leaveBlocked ? 'ลาได้เฉพาะเมื่อมีใบลาที่อนุมัติแล้ว' : undefined}
                              onClick={() => setStudentStatus(student.id, opt.value)}
                              className={[
                                'h-9 rounded-lg border text-[11px] font-black transition active:scale-[0.98]',
                                isActive ? opt.activeClassName : opt.className,
                                disabled ? 'opacity-60 cursor-not-allowed' : '',
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
            ) : todaysEntries.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center text-xs font-semibold text-slate-500">
                วันนี้ไม่มีคาบสอน
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {todaysEntries.map((entry) => {
                  const status = getSessionStatus(entry);
                  const isActive = status.isActive;
                  const isUpcoming = status.isUpcoming;
                  const isFinished = !isActive && !isUpcoming && status.startTime !== '--:--';
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => void openAttendanceEditor(entry)}
                      className={[
                        'w-full text-left rounded-2xl border p-3.5 transition-all',
                        'hover:bg-slate-50 active:scale-[0.99]',
                        isActive ? 'border-blue-200 bg-blue-50/70' : 'border-slate-200 bg-white',
                      ].join(' ')}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className="w-14 h-14 rounded-2xl shrink-0 flex items-center justify-center shadow-sm"
                          style={{ background: dayPanelStyle.background }}
                        >
                          <SubjectIcon
                            subjectGroup={resolveSubjectGroup(entry)}
                            size={22}
                            className="text-slate-800 drop-shadow-[0_1px_0_rgba(255,255,255,0.45)]"
                          />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-[10px] font-black ${isActive ? 'text-blue-600' : dayTheme.periodLabel}`}>
                              คาบ {entry.period}
                            </span>
                            <span className="text-[10px] font-bold text-slate-400 tabular-nums">{status.startTime}</span>
                            {isActive && (
                              <span className="text-[8px] font-black text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full uppercase">กำลังสอน</span>
                            )}
                            {isUpcoming && (
                              <span className="text-[8px] font-black text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full uppercase">ใกล้ถึงเวลา</span>
                            )}
                            {isFinished && (
                              <span className="text-[8px] font-black text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full uppercase">เสร็จสิ้น</span>
                            )}
                          </div>
                          <p className="text-[13px] font-black text-slate-800 truncate mt-0.5">{entry.subjectName}</p>
                          <div className="mt-1 flex items-center gap-3 text-slate-500">
                            <span className="text-[11px] font-bold truncate">{getClassLabel(entry.classId)}</span>
                            {entry.room && (
                              <div className="flex items-center gap-1 min-w-0">
                                <PinIcon size={10} className="shrink-0" />
                                <span className="text-[11px] font-bold truncate">{entry.room}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {selectedAttendanceEntry
            && !isSelectedPeriodUpcoming
            && !loadingAttendanceRows
            && attendanceRows.length > 0
            && !isAttendanceLocked && (
            <div className="shrink-0 border-t border-slate-100 bg-white px-4 pt-2 pb-4">
              <button
                type="button"
                onClick={() => void handleSaveAttendance()}
                disabled={savingAttendanceRows}
                className="h-11 w-full rounded-xl bg-slate-900 text-sm font-black text-white transition hover:bg-slate-800 active:scale-[0.99] disabled:opacity-60"
              >
                {savingAttendanceRows
                  ? 'กำลังบันทึก...'
                  : `บันทึกเช็กชื่อ (${attendanceRows.length} คน)`}
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
              บันทึกการเช็กชื่อสำเร็จ
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
            <DialogTitle className="text-lg font-black text-amber-600">
              เช็กชื่อยังไม่ครบ
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-600">
              กรุณาเช็กชื่อให้ครบทุกคนก่อนบันทึก
              {attendanceRows.filter((r) => r.status === null).length > 0 && (
                <> (ยังเหลือ {attendanceRows.filter((r) => r.status === null).length} คน)</>
              )}
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </>
  );
}
