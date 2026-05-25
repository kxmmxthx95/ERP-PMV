import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Save, Edit2, ArrowLeft, AlertTriangle, CheckCircle, RotateCcw } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip } from 'recharts';
import { useAuth } from '@/hooks/useAuth';
import { useActiveAcademicYear } from '@/hooks/useActiveAcademicYear';
import { useAcademicCalendar } from '@/hooks/useAcademicCalendar';
import { useClassroomManager } from '@/features/classes/hooks/useClassroomManager';
import {
  useTodayMorningRollCall,
  useSaveMorningRollCall,
  getClassRollCallsByAcademicYear,
} from '@/hooks/useMorningRollCall';
import { useStudentManager } from '@/hooks/useStudentManager';
import type { RollCallStatus, StudentRollCall, MorningRollCallSession } from '@/types/morningRollCall';
import StudentAvatar from '@/features/students/components/StudentAvatar';
import type { Department } from '@/types/curriculum';
import { DEPARTMENT_CONFIG } from '@/types/curriculum';

interface StudentRowData extends StudentRollCall {
  enrollmentIndex: number;
}

const CLASS_DEPT_THEMES: Record<Department, { from: string; to: string }> = {
  early: { from: '#fb7185', to: '#ec4899' },
  primary: { from: '#38bdf8', to: '#3b82f6' },
  secondary: { from: '#8b5cf6', to: '#4f46e5' },
};

export default function MorningRollCallPage() {
  const navigate = useNavigate();
  const { user, userData, role } = useAuth();
  const isAdmin = role === 'admin' || role === 'sysadmin';
  const { year, activeSemester, isLoaded } = useActiveAcademicYear();
  const { events: calendarEvents } = useAcademicCalendar(role ?? undefined);
  const classMgr = useClassroomManager();
  const studentMgr = useStudentManager(year ?? '2568');
  const { mutate: saveRollCall, isPending: isSaving } = useSaveMorningRollCall();

  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
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
  const [filterDept, setFilterDept] = useState<Department | 'all'>('all');
  const [now, setNow] = useState(new Date());
  const [optimisticSession, setOptimisticSession] = useState<MorningRollCallSession | null>(null);

  const [headerCenterPortalEl, setHeaderCenterPortalEl] = useState<HTMLElement | null>(null);
  const [headerMobileCenterPortalEl, setHeaderMobileCenterPortalEl] = useState<HTMLElement | null>(null);
  const [headerFiltersPortalEl, setHeaderFiltersPortalEl] = useState<HTMLElement | null>(null);
  const [headerMobileActionsPortalEl, setHeaderMobileActionsPortalEl] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setHeaderCenterPortalEl(document.getElementById('header-portal-center'));
    setHeaderMobileCenterPortalEl(document.getElementById('header-portal-center-mobile'));
    setHeaderFiltersPortalEl(document.getElementById('header-portal-filters'));
    setHeaderMobileActionsPortalEl(document.getElementById('header-portal-mobile-actions'));
  }, []);

  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const { data: fetchedSession } = useTodayMorningRollCall(selectedClassId);
  const existingSession = optimisticSession ?? fetchedSession;

  useEffect(() => {
    setOptimisticSession(null);
  }, [selectedClassId]);

  useEffect(() => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 30);
    setReportTo(to.toISOString().slice(0, 10));
    setReportFrom(from.toISOString().slice(0, 10));
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);


  const homeRoomClasses = useMemo(() => {
    if (!classMgr.classes || !year) return [];
    if (isAdmin) {
      // admin/sysadmin เห็นทุกห้องเรียนในปีการศึกษานั้น
      return classMgr.classes.filter(
        (c: any) => String(c.academicYearId ?? c.academicYear ?? '') === String(year),
      );
    }
    // homeroomTeacherId เก็บ TeacherProfile.id (Firestore doc ID) ไม่ใช่ Firebase Auth UID
    // ต้องหา TeacherProfile ของ user ปัจจุบันก่อน แล้วเอา id มาเปรียบเทียบ
    const myProfile = classMgr.availableTeachers?.find(
      (t: any) => t.userId === user?.uid || t.id === user?.uid,
    );
    const myTeacherDocId = myProfile?.id;

    return classMgr.classes.filter(
      (c: any) => {
        const sameYear = String(c.academicYearId ?? c.academicYear ?? '') === String(year);
        const teacherIds: string[] = Array.isArray(c.homeroomTeacherIds) ? c.homeroomTeacherIds : [];
        const isOwner =
          // เปรียบเทียบด้วย TeacherProfile.id (ค่าที่บันทึกจริงใน Firestore)
          (myTeacherDocId != null && (
            c.homeroomTeacherId === myTeacherDocId || teacherIds.includes(myTeacherDocId)
          )) ||
          // fallback: กรณีที่ document ID ตรงกับ user.uid
          c.homeroomTeacherId === user?.uid ||
          teacherIds.includes(String(user?.uid ?? ''));
        return sameYear && isOwner;
      },
    );
  }, [classMgr.classes, classMgr.availableTeachers, user?.uid, year, isAdmin]);

  const filteredHomeRoomClasses = useMemo(() => {
    if (filterDept === 'all') return homeRoomClasses;
    return homeRoomClasses.filter((c: any) => (c.departmentId as Department) === filterDept);
  }, [homeRoomClasses, filterDept]);

  const selectedClass = useMemo(
    () => classMgr.classes?.find((c: any) => c.id === selectedClassId),
    [classMgr.classes, selectedClassId],
  );
  const selectedClassCard = useMemo(
    () => classMgr.classCards?.find((card: any) => card.classRoom?.id === selectedClassId),
    [classMgr.classCards, selectedClassId],
  );

  const normalizeText = (value: unknown) => String(value ?? '').trim();
  const getClassNameFromParts = (grade: unknown, room: unknown) => {
    const g = normalizeText(grade);
    const r = normalizeText(room);
    return g && r ? `${g}/${r}` : '';
  };

  const doesEnrollmentMatchClass = (enrollment: any, cls: any) => {
    const enrollmentClassId = normalizeText(enrollment.classId ?? enrollment.classroomId ?? enrollment.roomId);
    const classId = normalizeText(cls.id);
    if (enrollmentClassId && classId && enrollmentClassId === classId) return true;

    const enrollmentClassName = normalizeText(enrollment.className);
    const clsClassName = normalizeText(cls.className);
    if (enrollmentClassName && clsClassName && enrollmentClassName === clsClassName) return true;

    const enrollmentGrade = normalizeText(enrollment.gradeLevel);
    const clsGrade = normalizeText(cls.gradeLevel);
    const enrollmentRoom = normalizeText(enrollment.roomNumber ?? enrollment.roomNo);
    const clsRoom = normalizeText(cls.roomNumber);
    if (enrollmentGrade && clsGrade && enrollmentRoom && clsRoom) {
      return enrollmentGrade === clsGrade && enrollmentRoom === clsRoom;
    }

    const enrollmentComposed = getClassNameFromParts(enrollment.gradeLevel, enrollment.roomNumber ?? enrollment.roomNo);
    if (enrollmentComposed && clsClassName && enrollmentComposed === clsClassName) return true;

    return false;
  };

  const getStudentIdsForClass = (cls: any) => {
    const yearMatchedEnrollments = (studentMgr.enrollments || []).filter(
      e =>
        String((e as any).academicYearId ?? (e as any).academicYear ?? '') === String(year)
        && doesEnrollmentMatchClass(e, cls),
    );
    const enrollmentStudentIds = yearMatchedEnrollments.map(e => e.studentId).filter(Boolean);
    const classStudentIds = Array.isArray(cls?.studentIds) ? cls.studentIds.filter(Boolean) : [];
    return Array.from(new Set([...enrollmentStudentIds, ...classStudentIds]));
  };

  const students = useMemo(() => {
    if (!selectedClass || !year) return [];
    const enrollments = (studentMgr.enrollments || []).filter(
      e =>
        String((e as any).academicYearId ?? (e as any).academicYear ?? '') === String(year)
        && doesEnrollmentMatchClass(e, selectedClass),
    );
    const enrollmentByStudentId = new Map(enrollments.map(e => [e.studentId, e] as const));
    const studentIds = getStudentIdsForClass(selectedClass);

    return studentIds
      .map((studentId, idx) => {
        const enrollment = enrollmentByStudentId.get(studentId);
        const student = studentMgr.students?.find(s => s.id === studentId);
        return {
          studentId,
          studentName: `${student?.firstName || ''} ${student?.lastName || ''}`.trim(),
          studentCode: student?.studentCode || '',
          status: 'unmarked' as RollCallStatus,
          note: '',
          enrollmentIndex: idx,
          photoURL: student?.photoURL,
          gender: student?.gender as 'male' | 'female' | undefined,
          className: (enrollment as any)?.className || selectedClass.className,
        };
      })
      .sort((a, b) => {
        const codeA = parseInt(a.studentCode, 10) || 0;
        const codeB = parseInt(b.studentCode, 10) || 0;
        return codeA - codeB;
      });
  }, [selectedClass, year, studentMgr.enrollments, studentMgr.students]);

  useEffect(() => {
    if (!selectedClassId) return;
    // existingSession is undefined while the query is loading — don't reset yet
    if (existingSession === undefined) return;
    if (existingSession) {
      if (!editMode) return;
      // Initialize with existing session data when entering editMode
      const initialRows = existingSession.attendance.map((a, idx) => {
        const studentInfo = students.find(s => s.studentId === a.studentId);
        return {
          ...a,
          enrollmentIndex: idx,
          photoURL: a.photoURL || studentInfo?.photoURL,
          gender: a.gender || studentInfo?.gender,
        };
      });
      setStudentRows(initialRows);
    } else {
      // Only initialize if user hasn't started marking yet, to prevent resetting marks
      // when the query resolves after the user has already begun interacting.
      setStudentRows(prev => prev.length === 0 ? students : prev);
    }
  }, [selectedClassId, students, existingSession, editMode]);

  // Initialize rows when students change or existing session is loaded
  const rowsToUse = useMemo(() => {
    if (existingSession && !editMode) {
      return existingSession.attendance.map((a, idx) => {
        const studentInfo = students.find(s => s.studentId === a.studentId);
        return {
          ...a,
          enrollmentIndex: idx,
          photoURL: a.photoURL || studentInfo?.photoURL,
          gender: a.gender || studentInfo?.gender,
        };
      });
    }
    if (studentRows.length === 0 && students.length > 0) {
      return students;
    }
    return studentRows;
  }, [studentRows, students, existingSession, editMode]);

  const summary = useMemo(() => {
    const rows = rowsToUse;
    return {
      present: rows.filter(r => r.status === 'present').length,
      absent: rows.filter(r => r.status === 'absent').length,
      late: rows.filter(r => r.status === 'late').length,
      leave: rows.filter(r => r.status === 'leave').length,
      total: rows.length,
    };
  }, [rowsToUse]);

  const homeroomTeacherName = useMemo(() => {
    if (!selectedClass) return 'ไม่ระบุครูประจำชั้น';
    const cls = selectedClass as any;
    const fromCard = selectedClassCard?.homeroomTeacher?.name;
    return (
      fromCard
      || cls.homeroomTeacherName
      || cls.homeroomTeacherDisplayName
      || cls.teacherName
      || cls.homeroomTeacher
      || cls.advisorName
      || 'ไม่ระบุครูประจำชั้น'
    );
  }, [selectedClass, selectedClassCard]);
  const isAllPresent = useMemo(() => {
    return rowsToUse.length > 0 && rowsToUse.every(r => r.status === 'present');
  }, [rowsToUse]);

  const handleToggleAllPresent = () => {
    if (isRollCallLocked) return;
    const targetStatus: RollCallStatus = isAllPresent ? 'unmarked' : 'present';
    const updated = rowsToUse.map(r => ({ ...r, status: targetStatus }));
    setStudentRows(updated);
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
    return () => { cancelled = true; };
  }, [selectedClassId, year, showSuccessModal]);

  const filteredReportSessions = useMemo(() => {
    const from = reportFrom || '0000-01-01';
    const to = reportTo || '9999-12-31';
    return reportSessions.filter((s) => s.date >= from && s.date <= to);
  }, [reportSessions, reportFrom, reportTo]);

  const reportSummary = useMemo(() => {
    if (filteredReportSessions.length === 0) {
      return { sessions: 0, present: 0, absent: 0, late: 0, leave: 0, avgPresentRate: 0 };
    }
    const totals = filteredReportSessions.reduce(
      (acc, s) => {
        acc.present += s.summary.present || 0;
        acc.absent += s.summary.absent || 0;
        acc.late += s.summary.late || 0;
        acc.leave += s.summary.leave || 0;
        acc.total += s.totalStudents || 0;
        return acc;
      },
      { present: 0, absent: 0, late: 0, leave: 0, total: 0 },
    );
    const avgPresentRate = totals.total > 0 ? Math.round((totals.present / totals.total) * 100) : 0;
    return { sessions: filteredReportSessions.length, ...totals, avgPresentRate };
  }, [filteredReportSessions]);

  const reportChartData = useMemo(
    () => filteredReportSessions.map((s) => ({
      date: s.date.slice(5),
      มา: s.summary.present || 0,
      ขาด: s.summary.absent || 0,
      สาย: s.summary.late || 0,
      ลา: s.summary.leave || 0,
    })),
    [filteredReportSessions],
  );

  const holidayEvent = useMemo(
    () => calendarEvents.find((event) => (
      event.type === 'holiday'
      && today >= event.startDate
      && today <= event.endDate
    )),
    [calendarEvents, today],
  );
  const isAcademicHoliday = !!holidayEvent;
  const isWeekend = useMemo(() => {
    const day = new Date(`${today}T00:00:00`).getDay();
    return day === 0 || day === 6;
  }, [today]);




  if (!isLoaded) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-slate-400 text-sm">กำลังโหลดข้อมูล...</div>
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

  const isReadOnly = existingSession && !editMode;
  const isRollCallLocked = Boolean(isReadOnly || isAcademicHoliday || isWeekend);

  return (
    <div className="h-full flex flex-col overflow-hidden bg-transparent relative">
      <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute -top-24 -left-16 w-72 h-72 rounded-full bg-sky-200/45 blur-3xl" />
        <div className="absolute top-24 -right-20 w-80 h-80 rounded-full bg-cyan-200/40 blur-3xl" />
      </div>
      {selectedClassId && (
        <>
          {headerCenterPortalEl && createPortal(
            <div className="flex items-center bg-white/60 backdrop-blur-xl border border-white p-1 rounded-full shadow-[0_8px_32px_rgba(0,0,0,0.04)] pointer-events-auto">
              <button
                onClick={() => setActiveTab('rollcall')}
                className={`px-6 py-1.5 rounded-full text-[11px] font-black transition-all whitespace-nowrap ${
                  activeTab === 'rollcall' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:text-slate-800 hover:bg-black/5'
                }`}
              >
                เช็กชื่อ
              </button>
              <button
                onClick={() => setActiveTab('report')}
                className={`px-6 py-1.5 rounded-full text-[11px] font-black transition-all whitespace-nowrap ${
                  activeTab === 'report' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:text-slate-800 hover:bg-black/5'
                }`}
              >
                รายงาน
              </button>
            </div>,
            headerCenterPortalEl,
          )}
          {headerMobileCenterPortalEl && createPortal(
            <div className="flex items-center gap-1 h-8 p-1 rounded-full bg-white/70 backdrop-blur-xl border border-white shadow-sm pointer-events-auto">
              <button
                onClick={() => setActiveTab('rollcall')}
                className={`h-6 px-4 rounded-full text-[10px] font-black transition-all whitespace-nowrap ${
                  activeTab === 'rollcall' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800 hover:bg-black/5'
                }`}
              >
                เช็กชื่อ
              </button>
              <button
                onClick={() => setActiveTab('report')}
                className={`h-6 px-4 rounded-full text-[10px] font-black transition-all whitespace-nowrap ${
                  activeTab === 'report' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800 hover:bg-black/5'
                }`}
              >
                รายงาน
              </button>
            </div>,
            headerMobileCenterPortalEl,
          )}
        </>
      )}
      {headerFiltersPortalEl && !selectedClassId &&
        createPortal(
          <div className="flex items-center gap-1.5 h-10 p-1 rounded-full bg-white/60 backdrop-blur-xl border border-white shadow-[0_8px_32px_rgba(0,0,0,0.04)] pointer-events-auto">
            <button
              onClick={() => setFilterDept('all')}
              className={`h-8 px-6 rounded-full text-[11px] font-black transition-all whitespace-nowrap ${
                filterDept === 'all'
                  ? 'bg-slate-900 text-white shadow-md'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-black/5'
              }`}
            >
              ทั้งหมด
            </button>
            <div className="w-px h-5 bg-black/10 mx-1 shrink-0" />
            {(['early', 'primary', 'secondary'] as Department[]).map((dept) => (
              <button
                key={dept}
                onClick={() => setFilterDept(dept)}
                className={`h-8 px-6 rounded-full text-[11px] font-black transition-all whitespace-nowrap ${
                  filterDept === dept
                    ? 'bg-slate-900 text-white shadow-md'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-black/5'
                }`}
              >
                {DEPARTMENT_CONFIG[dept].label}
              </button>
            ))}
          </div>,
          headerFiltersPortalEl,
        )}
      {headerMobileActionsPortalEl && selectedClassId && selectedClass && null}
      {headerMobileCenterPortalEl && !selectedClassId &&
        createPortal(
          <div className="md:hidden mx-auto flex items-center justify-center gap-1 h-8 p-1 rounded-full bg-white/70 backdrop-blur-xl border border-white shadow-sm min-w-0 max-w-[calc(100vw-112px)] overflow-x-auto no-scrollbar pointer-events-auto">
            <button
              onClick={() => setFilterDept('all')}
              className={`h-6 px-3 rounded-full text-[10px] font-black transition-all whitespace-nowrap ${
                filterDept === 'all'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-black/5'
              }`}
            >
              all
            </button>
            {([
              { key: 'early', label: 'ปฐมวัย' },
              { key: 'primary', label: 'ประถม' },
              { key: 'secondary', label: 'มัธยม' },
            ] as const).map((item) => (
              <button
                key={item.key}
                onClick={() => setFilterDept(item.key)}
                className={`h-6 px-3 rounded-full text-[10px] font-black transition-all whitespace-nowrap ${
                  filterDept === item.key
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-black/5'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>,
          headerMobileCenterPortalEl,
        )}

      <div className="flex-1 overflow-y-auto flex flex-col">
        {/* Class Selection Dropdown */}
        {!selectedClassId && (
          <div className="flex-1 pb-4 min-h-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {filteredHomeRoomClasses.map((cls: any) => {
                const classStudentCount = getStudentIdsForClass(cls).length;
                const dept = (cls.departmentId as Department) || 'secondary';
                const theme = CLASS_DEPT_THEMES[dept] ?? CLASS_DEPT_THEMES.secondary;
                const cardTeacher = classMgr.classCards?.find((card: any) => card.classRoom?.id === cls.id)?.homeroomTeacher;
                const teacherName = cardTeacher?.name || 'ไม่ระบุครู';
                const teacherInitial = teacherName.trim().charAt(0) || '?';

                return (
                  <motion.button
                    key={cls.id}
                    whileHover={{ opacity: 0.95 }}
                    whileTap={{ scale: 0.96 }}
                    transition={{ type: 'spring', stiffness: 380, damping: 26 }}
                    onClick={() => {
                      setSelectedClassId(cls.id);
                      setActiveTab('rollcall');
                      setEditMode(false);
                      setStudentRows([]);
                    }}
                    className="group relative w-full h-[128px] sm:h-[150px] lg:aspect-square overflow-hidden text-left"
                    style={{
                      borderRadius: 16,
                      background: `linear-gradient(160deg, ${theme.from} 0%, ${theme.to} 100%)`,
                    }}
                  >
                    <div
                      className="pointer-events-none absolute inset-0"
                      style={{
                        background:
                          'radial-gradient(ellipse at 75% 12%, rgba(255,255,255,0.32) 0%, transparent 58%)',
                      }}
                    />
                    <div className="absolute top-2 right-2 flex items-center gap-2.5 max-w-[70%] pointer-events-none">
                      <span className="text-[10px] text-white/90 font-semibold truncate text-right">
                        {teacherName}
                      </span>
                      <div className="w-10 h-10 rounded-full overflow-hidden border border-white/70 bg-white/20 shrink-0">
                        {cardTeacher?.photoURL ? (
                          <img src={cardTeacher.photoURL} alt={teacherName} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[11px] font-bold text-white">
                            {teacherInitial}
                          </div>
                        )}
                      </div>
                    </div>
                    <div
                      className="pointer-events-none absolute inset-0"
                      style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.42) 0%, transparent 55%)' }}
                    />
                    <div className="absolute bottom-0 left-0 right-0 p-2 pointer-events-none">
                      <h4
                        className="text-white font-semibold leading-tight line-clamp-2"
                        style={{ fontSize: 'clamp(18px, 3.8vw, 22px)', textShadow: '0 1px 3px rgba(0,0,0,0.3)' }}
                      >
                        {cls.className}
                      </h4>
                      <span className="text-[14px] text-white/90 font-medium mt-1 block">
                        นักเรียน {classStudentCount} คน
                      </span>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </div>
        )}

        {/* Roll Call Section */}
        {selectedClassId && selectedClass && (
          <div className="flex-1 flex flex-col pb-4 gap-4 min-h-0">
            {activeTab === 'rollcall' ? (
              <>
            {/* Desktop Class Info & Summary */}
            <div className="hidden md:flex bg-white/35 rounded-2xl p-3.5 border border-white/40 backdrop-blur-md flex-shrink-0 items-center justify-between gap-4">
              {/* Left Group */}
              <div className="flex items-center gap-3">
                {/* Back Button */}
                <button
                  onClick={() => {
                    setSelectedClassId(null);
                    setEditMode(false);
                  }}
                  className="w-9 h-9 rounded-full bg-white shadow-sm flex items-center justify-center border border-slate-100 hover:bg-slate-50 active:scale-95 transition-all text-slate-600 cursor-pointer"
                  title="เปลี่ยนห้องเรียน"
                >
                  <ArrowLeft size={16} />
                </button>

                <div className="flex flex-col">
                  <p className="text-[28px] leading-none font-semibold text-slate-800">
                    {selectedClass.className}
                  </p>
                  <p className="text-[11px] text-slate-500 leading-tight mt-1.5">
                    ครูประจำชั้น: {homeroomTeacherName}
                  </p>
                </div>

                {/* Checkbox มาทั้งหมด */}
                {!isRollCallLocked && (
                  <label
                    className="w-9 h-9 rounded-full bg-white shadow-sm flex items-center justify-center border border-slate-100 hover:bg-slate-50 active:scale-95 transition-all cursor-pointer select-none shrink-0"
                    title="เช็กมาเรียนทุกคน"
                  >
                    <input
                      type="checkbox"
                      checked={isAllPresent}
                      onChange={handleToggleAllPresent}
                      className="w-3.5 h-3.5 rounded text-emerald-600 border-slate-300 focus:ring-emerald-500 cursor-pointer accent-emerald-500"
                    />
                  </label>
                )}
              </div>

              {/* Right Group: Summary Chips */}
              {isRollCallLocked ? (
                <div className="flex-1 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800 text-sm font-semibold">
                  {isWeekend
                    ? 'วันนี้เป็นวันหยุดสุดสัปดาห์ จึงไม่สามารถเช็กชื่อเข้าแถวได้'
                    : `วันนี้เป็นวันหยุดจากปฏิทินการศึกษา${holidayEvent?.title ? ` (${holidayEvent.title})` : ''} จึงไม่สามารถเช็กชื่อเข้าแถวได้`}
                </div>
              ) : (
              <div className="flex items-center gap-4">
                <div className="h-[78px] px-1 py-1 flex flex-col justify-center min-w-[132px]">
                  <p className="text-[28px] leading-none font-semibold text-slate-800">
                    {now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                  <p className="text-[12px] text-slate-500 mt-1">
                    {now.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>
                <div className="w-px h-12 bg-slate-300/60" />

                {(() => {
                  const total = Math.max(summary.total, 1);
                  const presentDeg = (summary.present / total) * 360;
                  const lateDeg = (summary.late / total) * 360;
                  const leaveDeg = (summary.leave / total) * 360;
                  const absentDeg = (summary.absent / total) * 360;

                  const ringBg = (deg: number, color: string) =>
                    `conic-gradient(${color} 0deg ${deg}deg, rgba(148,163,184,0.18) ${deg}deg 360deg)`;

                  return (
                <div className="h-[78px] px-1 py-1 flex items-stretch gap-3">
                  <div className="grid grid-cols-5 divide-x divide-slate-200/80">
                    {[
                      { key: 'total', label: 'รวม', count: summary.total, color: 'text-slate-500', numberColor: 'text-slate-700' },
                      { key: 'present', label: 'มา', count: summary.present, color: 'text-emerald-600', numberColor: 'text-emerald-700' },
                      { key: 'absent', label: 'ขาด', count: summary.absent, color: 'text-rose-600', numberColor: 'text-rose-700' },
                      { key: 'late', label: 'สาย', count: summary.late, color: 'text-amber-600', numberColor: 'text-amber-700' },
                      { key: 'leave', label: 'ลา', count: summary.leave, color: 'text-violet-600', numberColor: 'text-violet-700' },
                    ].map((item) => (
                      <div key={item.key} className="px-3 min-w-[78px] flex flex-col justify-center">
                        <p className={`text-[12px] font-bold leading-none ${item.color}`}>{item.label}</p>
                        <div className="mt-1 flex items-end gap-1">
                          <span className={`text-[32px] leading-none font-semibold ${item.numberColor}`}>{item.count}</span>
                          <span className="text-[10px] leading-none text-slate-400 mb-1">คน</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="w-16 h-16 self-center relative shrink-0">
                    <div className="absolute inset-0 rounded-full" style={{ background: ringBg(presentDeg, '#10b981') }} />
                    <div className="absolute inset-[5px] rounded-full bg-white" />

                    <div className="absolute inset-[5px] rounded-full" style={{ background: ringBg(lateDeg, '#f59e0b') }} />
                    <div className="absolute inset-[10px] rounded-full bg-white" />

                    <div className="absolute inset-[10px] rounded-full" style={{ background: ringBg(leaveDeg, '#8b5cf6') }} />
                    <div className="absolute inset-[15px] rounded-full bg-white" />

                    <div className="absolute inset-[15px] rounded-full" style={{ background: ringBg(absentDeg, '#f43f5e') }} />
                    <div className="absolute inset-[20px] rounded-full bg-white/70" />
                  </div>
                </div>
                  );
                })()}

                {/* Edit Button if read-only */}
                {existingSession && !editMode && !isAcademicHoliday && !isWeekend && (
                  <button
                    onClick={() => setEditMode(true)}
                    className="ml-2 w-9 h-9 rounded-full bg-white shadow-sm flex items-center justify-center border border-slate-100 hover:bg-slate-50 active:scale-95 transition-all text-slate-600 cursor-pointer shrink-0"
                    title="แก้ไข"
                  >
                    <Edit2 size={14} />
                  </button>
                )}
              </div>
              )}
            </div>

            {/* Mobile Class Info & Summary */}
            <div className="flex md:hidden flex-shrink-0 justify-between items-center gap-2 overflow-x-auto no-scrollbar py-1">
              {/* Left Column: ปุ่มกลับ, icon ชั้นเรียน, ห้อง, check box */}
              <div className="flex items-center gap-1.5 bg-white/30 rounded-xl p-1 border border-white/30 backdrop-blur-md shrink-0">
                {/* Back Button */}
                <button
                  onClick={() => {
                    setSelectedClassId(null);
                    setEditMode(false);
                  }}
                  className="w-9 h-9 rounded-full bg-white shadow-sm flex items-center justify-center border border-slate-100 hover:bg-slate-50 text-slate-600 cursor-pointer transition-all active:scale-95 shrink-0"
                  title="เปลี่ยนห้องเรียน"
                >
                  <ArrowLeft size={16} />
                </button>

                {existingSession && !editMode && !isAcademicHoliday && !isWeekend ? (
                  <button
                    onClick={() => setEditMode(true)}
                    className="w-9 h-9 rounded-full bg-white shadow-sm flex items-center justify-center border border-slate-100 hover:bg-slate-50 text-slate-600 cursor-pointer transition-all active:scale-95 shrink-0"
                    title="แก้ไข"
                  >
                    <Edit2 size={14} />
                  </button>
                ) : (
                  !isRollCallLocked && (
                    <label 
                      className="w-9 h-9 rounded-full bg-white shadow-sm flex items-center justify-center border border-slate-100 hover:bg-slate-50 active:scale-95 transition-all cursor-pointer select-none shrink-0" 
                      title="เช็กมาเรียนทุกคน"
                    >
                      <input
                        type="checkbox"
                        checked={isAllPresent}
                        onChange={handleToggleAllPresent}
                        className="w-3.5 h-3.5 rounded text-emerald-600 border-slate-300 focus:ring-emerald-500 cursor-pointer accent-emerald-500"
                      />
                    </label>
                  )
                )}
              </div>

              {/* Right Column: สรุป ยอด รวม ขาด ลา มา สาย (5 Colored Summary Cards) */}
              <div className="flex items-center gap-1 shrink-0">
                {/* รวม (Total Card) */}
                <div className="p-0.5 w-9 h-9 rounded-xl bg-slate-100 text-slate-600 text-[8px] font-black flex flex-col items-center justify-center border border-slate-200/50 shadow-sm shrink-0">
                  <span className="opacity-75 leading-none">รวม</span>
                  <span className="text-[11px] font-semibold mt-0.5 leading-none">{summary.total}</span>
                </div>

                {/* มา (Green Card) */}
                <div className="p-0.5 w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 text-[8px] font-black flex flex-col items-center justify-center border border-emerald-100/50 shadow-sm shrink-0">
                  <span className="opacity-75 leading-none">มา</span>
                  <span className="text-[11px] font-semibold mt-0.5 leading-none">{summary.present}</span>
                </div>

                {/* ขาด (Rose Card) */}
                <div className="p-0.5 w-9 h-9 rounded-xl bg-rose-50 text-rose-600 text-[8px] font-black flex flex-col items-center justify-center border border-rose-100/50 shadow-sm shrink-0">
                  <span className="opacity-75 leading-none">ขาด</span>
                  <span className="text-[11px] font-semibold mt-0.5 leading-none">{summary.absent}</span>
                </div>

                {/* สาย (Amber Card) */}
                <div className="p-0.5 w-9 h-9 rounded-xl bg-amber-50 text-amber-600 text-[8px] font-black flex flex-col items-center justify-center border border-amber-100/50 shadow-sm shrink-0">
                  <span className="opacity-75 leading-none">สาย</span>
                  <span className="text-[11px] font-semibold mt-0.5 leading-none">{summary.late}</span>
                </div>

                {/* ลา (Violet Card) */}
                <div className="p-0.5 w-9 h-9 rounded-xl bg-violet-50 text-violet-600 text-[8px] font-black flex flex-col items-center justify-center border border-violet-100/50 shadow-sm shrink-0">
                  <span className="opacity-75 leading-none">ลา</span>
                  <span className="text-[11px] font-semibold mt-0.5 leading-none">{summary.leave}</span>
                </div>
              </div>
            </div>

            {/* Student List */}
            <div className="flex-1 overflow-y-auto no-scrollbar min-h-0">
              <AnimatePresence mode="popLayout">
                {rowsToUse.map((row, i) => {
                  const statusConfig = {
                    present: {
                      label: 'มา',
                      activeClass: 'bg-emerald-500 text-white shadow-[0_2px_8px_rgba(16,185,129,0.3)]',
                      inactiveClass: 'bg-emerald-50/50 text-emerald-600/80 hover:bg-emerald-100 border border-emerald-100/50',
                      readOnlyInactiveClass: 'bg-slate-50/20 text-slate-300 border border-slate-100/30 opacity-40',
                    },
                    absent: {
                      label: 'ขาด',
                      activeClass: 'bg-rose-500 text-white shadow-[0_2px_8px_rgba(244,63,94,0.3)]',
                      inactiveClass: 'bg-rose-50/50 text-rose-600/80 hover:bg-rose-100 border border-rose-100/50',
                      readOnlyInactiveClass: 'bg-slate-50/20 text-slate-300 border border-slate-100/30 opacity-40',
                    },
                    late: {
                      label: 'สาย',
                      activeClass: 'bg-amber-500 text-white shadow-[0_2px_8px_rgba(245,158,11,0.3)]',
                      inactiveClass: 'bg-amber-50/50 text-amber-600/80 hover:bg-amber-100 border border-amber-100/50',
                      readOnlyInactiveClass: 'bg-slate-50/20 text-slate-300 border border-slate-100/30 opacity-40',
                    },
                    leave: {
                      label: 'ลา',
                      activeClass: 'bg-violet-500 text-white shadow-[0_2px_8px_rgba(139,92,246,0.3)]',
                      inactiveClass: 'bg-violet-50/50 text-violet-600/80 hover:bg-violet-100 border border-violet-100/50',
                      readOnlyInactiveClass: 'bg-slate-50/20 text-slate-300 border border-slate-100/30 opacity-40',
                    },
                  };

                  return (
                    <motion.div
                      key={`${row.studentId}-${i}`}
                      layout
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ delay: i * 0.01 }}
                      className={`flex items-center justify-between py-3 px-4 rounded-xl border border-transparent transition-all mb-1 ${
                        i % 2 === 0
                          ? 'bg-white hover:bg-slate-50 hover:border-slate-100'
                          : 'bg-slate-50/60 hover:bg-slate-100/60 hover:border-slate-100'
                      }`}
                    >
                      <div className="flex-1 min-w-0 mr-3 flex items-center gap-3">
                        <div className="hidden sm:block">
                          <StudentAvatar
                            photoURL={row.photoURL}
                            studentId={row.studentId}
                            name={row.studentName}
                            gender={row.gender}
                            className="w-10 h-10 rounded-xl shrink-0"
                          />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-800 text-sm truncate">{row.studentName}</p>
                          <p className="text-xs text-slate-400">{row.studentCode}</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        {(['present', 'absent', 'late', 'leave'] as Exclude<RollCallStatus, 'unmarked'>[]).map((statusOption) => {
                          const config = statusConfig[statusOption];
                          const isActive = row.status === statusOption;
                          
                          let btnClass = '';
                          if (isActive) {
                            btnClass = config.activeClass;
                          } else {
                            btnClass = isReadOnly ? config.readOnlyInactiveClass : config.inactiveClass;
                          }

                          return (
                            <button
                              key={statusOption}
                              disabled={isRollCallLocked}
                              onClick={() => {
                                const newStatus: RollCallStatus = row.status === statusOption ? 'unmarked' : statusOption;
                                const updated = rowsToUse.map(r =>
                                  r.studentId === row.studentId ? { ...r, status: newStatus } : r,
                                );
                                setStudentRows(updated);
                              }}
                              className={`w-10 h-7 rounded-full text-xs font-black transition-all flex items-center justify-center cursor-pointer ${btnClass} ${
                                isRollCallLocked ? 'cursor-not-allowed pointer-events-none' : 'active:scale-90'
                              }`}
                            >
                              {config.label}
                            </button>
                          );
                        })}
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>

            {/* Save Button */}
            {!isRollCallLocked && (
              <div className="flex-shrink-0 flex flex-col gap-2">
                {saveError && (
                  <div className="px-4 py-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-xs font-semibold flex items-center gap-2">
                    <AlertTriangle size={14} className="shrink-0" />
                    {saveError}
                  </div>
                )}
                <button
                  disabled={isSaving}
                  onClick={() => {
                    if (existingSession && !editMode && !isAcademicHoliday && !isWeekend) {
                      setEditMode(true);
                      return;
                    }
                    if (isWeekend || isAcademicHoliday) {
                      setSaveError(
                        isWeekend
                          ? 'วันนี้เป็นวันหยุดสุดสัปดาห์ ไม่สามารถเช็กชื่อเข้าแถวได้'
                          : `วันนี้เป็นวันหยุด${holidayEvent?.title ? ` (${holidayEvent.title})` : ''} ไม่สามารถเช็กชื่อเข้าแถวได้`,
                      );
                      return;
                    }
                    const unmarkedStudents = rowsToUse.filter(r => r.status === 'unmarked');
                    if (unmarkedStudents.length > 0) {
                      setShowWarningModal(true);
                      return;
                    }
                    if (!selectedClass || !year || activeSemester == null) return;
                    setSaveError(null);
                    saveRollCall(
                      {
                        date: today,
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
                  }}
                  className={`w-full px-4 py-3 rounded-2xl font-black flex items-center justify-center gap-2 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg ${
                    existingSession && !editMode
                      ? 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-emerald-600/25'
                      : 'bg-slate-900 text-white hover:bg-slate-700 shadow-slate-900/20'
                  }`}
                >
                  {existingSession && !editMode ? <Edit2 size={18} /> : <Save size={18} />}
                  {existingSession && !editMode ? 'แก้ไขการเช็กชื่อ' : 'บันทึกการเช็คชื่อ'}
                </button>
              </div>
            )}
              </>
            ) : (
              <div className="flex-1 min-h-0 flex flex-col gap-3">
                <div className="bg-white/30 border border-white/40 rounded-xl p-3 backdrop-blur-md flex flex-col gap-3">
                  <div className="flex items-center gap-2 overflow-x-auto no-scrollbar w-full pb-1">
                    <input
                      type="date"
                      value={reportFrom}
                      onChange={(e) => setReportFrom(e.target.value)}
                      className="flex-1 w-full min-w-[100px] h-8 rounded-xl border-none bg-slate-100 px-3 text-xs font-semibold text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                    <span className="text-slate-400 text-xs px-1">ถึง</span>
                    <input
                      type="date"
                      value={reportTo}
                      onChange={(e) => setReportTo(e.target.value)}
                      className="flex-1 w-full min-w-[100px] h-8 rounded-xl border-none bg-slate-100 px-3 text-xs font-semibold text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                    <button
                      onClick={() => {
                        const to = new Date();
                        const from = new Date();
                        from.setDate(from.getDate() - 30);
                        setReportTo(to.toISOString().slice(0, 10));
                        setReportFrom(from.toISOString().slice(0, 10));
                      }}
                      className="shrink-0 w-8 h-8 ml-1 flex items-center justify-center rounded-xl bg-white/40 text-slate-500 hover:bg-white/70 transition-colors shadow-sm"
                      title="ล้างตัวกรองวันที่"
                    >
                      <RotateCcw size={14} />
                    </button>
                  </div>
                  <div className="flex items-center justify-between w-full overflow-x-auto no-scrollbar gap-2 pb-1">
                    {[
                      { label: 'เฉลี่ย', value: `${reportSummary.avgPresentRate}%`, color: 'text-sky-700' },
                      { label: 'มา', value: reportSummary.present, color: 'text-emerald-700' },
                      { label: 'ขาด', value: reportSummary.absent, color: 'text-rose-700' },
                      { label: 'สาย', value: reportSummary.late, color: 'text-amber-700' },
                      { label: 'ลา', value: reportSummary.leave, color: 'text-violet-700' },
                    ].map((item) => (
                      <div key={item.label} className="py-1 px-2 shrink-0 flex flex-col justify-center min-w-[50px]">
                        <p className="text-[11px] font-bold leading-none text-slate-500">{item.label}</p>
                        <p className={`mt-1 text-[22px] md:text-[26px] leading-none font-semibold ${item.color}`}>{item.value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-2 gap-3">
                  <div className="rounded-xl bg-white/35 border border-white/40 p-3 backdrop-blur-md min-h-[280px]">
                    {isLoadingReport ? (
                      <div className="h-full flex items-center justify-center text-sm text-slate-400">กำลังโหลดรายงาน...</div>
                    ) : reportChartData.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-sm text-slate-400">ไม่มีข้อมูลย้อนหลัง</div>
                    ) : (
                      <ResponsiveContainer width="100%" height={260}>
                        <AreaChart data={reportChartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} />
                          <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                          <Tooltip />
                          <Area type="monotone" dataKey="มา" stroke="#10b981" fill="#10b98133" strokeWidth={2} />
                          <Area type="monotone" dataKey="ขาด" stroke="#f43f5e" fill="#f43f5e26" strokeWidth={2} />
                          <Area type="monotone" dataKey="สาย" stroke="#f59e0b" fill="#f59e0b26" strokeWidth={2} />
                          <Area type="monotone" dataKey="ลา" stroke="#8b5cf6" fill="#8b5cf626" strokeWidth={2} />
                        </AreaChart>
                      </ResponsiveContainer>
                    )}
                  </div>

                  <div className="rounded-xl bg-white/35 border border-white/40 p-3 backdrop-blur-md overflow-y-auto min-h-[280px]">
                    <p className="text-xs font-black text-slate-600 mb-2">รายการย้อนหลัง</p>
                    <div className="space-y-2">
                      {filteredReportSessions.slice().reverse().map((s) => (
                        <div key={s.id} className="rounded-lg bg-white/70 border border-slate-100 px-3 py-2">
                          <p className="text-xs font-black text-slate-700">{s.date}</p>
                          <p className="text-[11px] text-slate-500 mt-1">
                            มา {s.summary.present} | ขาด {s.summary.absent} | สาย {s.summary.late} | ลา {s.summary.leave}
                          </p>
                        </div>
                      ))}
                      {!isLoadingReport && filteredReportSessions.length === 0 && (
                        <p className="text-xs text-slate-400">ไม่พบข้อมูลในช่วงวันที่ที่เลือก</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Warning Modal */}
      <AnimatePresence>
        {showWarningModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowWarningModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            
            {/* Modal Box */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="relative w-full max-w-sm bg-white/95 rounded-3xl p-6 shadow-2xl border border-white/20 backdrop-blur-md flex flex-col items-center text-center z-10"
            >
              {/* Alert Icon */}
              <div className="w-14 h-14 rounded-full bg-rose-50 flex items-center justify-center border border-rose-100 mb-4 text-rose-500 animate-bounce">
                <AlertTriangle size={24} />
              </div>
              
              {/* Heading */}
              <h3 className="text-base font-black text-slate-800 mb-2">เช็กชื่อนักเรียนไม่ครบ</h3>
              
              {/* Description */}
              <p className="text-xs text-slate-500 leading-relaxed mb-6">
                พบนักเรียนจำนวน <span className="font-bold text-rose-500">{rowsToUse.filter(r => r.status === 'unmarked').length} คน</span> ที่ยังไม่ถูกเช็กสถานะ<br />
                กรุณาตรวจสอบสถานะของนักเรียนทุกคนให้ครบถ้วนก่อนบันทึกข้อมูล
              </p>
              
              {/* Action Buttons */}
              <div className="w-full flex gap-3">
                <button
                  onClick={() => setShowWarningModal(false)}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-slate-950 hover:bg-slate-800 text-white text-xs font-black transition cursor-pointer shadow-md shadow-slate-900/10"
                >
                  กลับไปตรวจสอบใหม่
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Success Modal */}
      <AnimatePresence>
        {showSuccessModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSuccessModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            
            {/* Modal Box */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="relative w-full max-w-sm bg-white/95 rounded-3xl p-6 shadow-2xl border border-white/20 backdrop-blur-md flex flex-col items-center text-center z-10"
            >
              {/* Success Icon */}
              <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center border border-emerald-100 mb-4 text-emerald-500 animate-pulse">
                <CheckCircle size={28} />
              </div>
              
              {/* Heading */}
              <h3 className="text-base font-black text-slate-800 mb-2">บันทึกข้อมูลสำเร็จ</h3>
              
              {/* Description */}
              <p className="text-xs text-slate-500 leading-relaxed mb-6">
                ระบบได้ทำการบันทึกข้อมูลการเช็กชื่อของห้อง <span className="font-bold text-slate-700">{selectedClass?.className}</span> ประจำวันนี้เรียบร้อยแล้ว
              </p>
              
              {/* Action Buttons */}
              <div className="w-full flex gap-3">
                <button
                  onClick={() => setShowSuccessModal(false)}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black transition cursor-pointer shadow-md shadow-emerald-500/10"
                >
                  ตกลง
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
