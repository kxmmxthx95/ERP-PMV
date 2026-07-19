import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Save, Edit2, ArrowLeft, AlertTriangle, CheckCircle, RotateCcw, ChevronDown, ChevronUp, FileText } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useActiveAcademicYear } from '@/hooks/useActiveAcademicYear';
import { useIsSchoolDayToday } from '@/hooks/useIsSchoolDayToday';
import { useClassroomManager } from '@/features/classes/hooks/useClassroomManager';
import {
  useTodayMorningRollCall,
  useSaveMorningRollCall,
  getClassRollCallsByAcademicYear,
} from '@/hooks/useMorningRollCall';
import { useMorningRollCallClassStudents } from '@/hooks/useMorningRollCallClassStudents';
import { useStudentLeaveRequests } from '@/hooks/useLeaveRequests';
import { applyApprovedLeaveToMorningRollCallRows } from '@/lib/attendance/leaveRequestStudentMatch';
import type { RollCallStatus, StudentRollCall, MorningRollCallSession } from '@/types/morningRollCall';
import StudentAvatar from '@/features/students/components/StudentAvatar';
import type { Department } from '@/types/curriculum';
import { DEPARTMENT_CONFIG } from '@/types/curriculum';
import { colors } from '@/lib/designTokens';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';

interface StudentRowData extends StudentRollCall {
  enrollmentIndex: number;
}

const SOLID_CLASS_CARD_COLOR = colors.palette.royalBlue;

function stripThaiPrefix(name: string) {
  return name.replace(/^(นาย|นางสาว|นาง|ดร\.?|ผศ\.?)/i, '').trim();
}

export default function MorningRollCallPage() {
  const navigate = useNavigate();
  const { user, userData, role } = useAuth();
  const isAdmin = role === 'admin' || role === 'sysadmin';
  const { year, activeSemester, isLoaded } = useActiveAcademicYear();
  const classMgr = useClassroomManager();
  const { mutate: saveRollCall, isPending: isSaving } = useSaveMorningRollCall();

  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
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
  const [filterDept, setFilterDept] = useState<Department | 'all'>('all');
  const [now, setNow] = useState(new Date());
  const [optimisticSession, setOptimisticSession] = useState<MorningRollCallSession | null>(null);
  const [isMobileSummaryCollapsed, setIsMobileSummaryCollapsed] = useState(false);

  const [headerRightPortalEl, setHeaderRightPortalEl] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setHeaderRightPortalEl(document.getElementById('header-portal-right-actions'));
  }, []);

  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const { isHoliday: isRollCallBlocked, isWeekend, holidayTitle } = useIsSchoolDayToday(role ?? undefined, today);
  const { requests: leaveRequests } = useStudentLeaveRequests(today);
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

  const studentsWithLeave = useMemo(
    () => applyApprovedLeaveToMorningRollCallRows(students, classStudents, leaveRequests, today),
    [students, classStudents, leaveRequests, today],
  );

  useEffect(() => {
    if (!selectedClassId) return;
    // existingSession is undefined while the query is loading — don't reset yet
    if (existingSession === undefined) return;
    if (!existingSession && loadingClassStudents) return;
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
      setStudentRows(prev => prev.length === 0 ? studentsWithLeave : prev);
    }
  }, [selectedClassId, studentsWithLeave, existingSession, editMode, loadingClassStudents]);

  useEffect(() => {
    if (!selectedClassId || existingSession || editMode) return;
    setStudentRows((prev) => {
      if (prev.length === 0) return studentsWithLeave;
      return applyApprovedLeaveToMorningRollCallRows(prev, classStudents, leaveRequests, today);
    });
  }, [leaveRequests, today, classStudents, selectedClassId, existingSession, editMode, studentsWithLeave]);

  // Initialize rows when students change or existing session is loaded
  const rowsToUse = useMemo<StudentRowData[]>(() => {
    let rows: StudentRowData[];

    if (existingSession && !editMode) {
      rows = existingSession.attendance.map((a, idx) => {
        const studentInfo = students.find(s => s.studentId === a.studentId);
        return {
          ...a,
          enrollmentIndex: idx,
          photoURL: a.photoURL || studentInfo?.photoURL,
          gender: a.gender || studentInfo?.gender,
        };
      }).filter(row => Boolean((row.studentName || '').trim() || (row.studentCode || '').trim()));
    } else if (studentRows.length === 0 && studentsWithLeave.length > 0) {
      rows = studentsWithLeave;
    } else {
      rows = studentRows.filter(row => Boolean((row.studentName || '').trim() || (row.studentCode || '').trim()));
    }

    return applyApprovedLeaveToMorningRollCallRows(rows, classStudents, leaveRequests, today);
  }, [studentRows, students, studentsWithLeave, classStudents, leaveRequests, today, existingSession, editMode]);

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

  const isReadyToSubmit = useMemo(() => {
    return rowsToUse.length > 0 && rowsToUse.every(r => r.status !== 'unmarked');
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

  const reportStudentSummaries = useMemo(() => {
    const map = new Map<string, {
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
    }>();

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
  const isRollCallLocked = Boolean(isReadOnly || isRollCallBlocked);

  return (
    <div className="h-full flex flex-col overflow-hidden bg-transparent relative">
      <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute -top-24 -left-16 w-72 h-72 rounded-full bg-sky-200/45 blur-3xl" />
        <div className="absolute top-24 -right-20 w-80 h-80 rounded-full bg-cyan-200/40 blur-3xl" />
      </div>
      {headerRightPortalEl && !selectedClassId &&
        createPortal(
          <NativeSelect
            value={filterDept}
            onChange={(e) => setFilterDept(e.target.value as Department | 'all')}
            aria-label="เลือกระดับชั้น"
            className="pointer-events-auto min-w-[140px] w-auto [&_select]:h-9 [&_select]:rounded-xl [&_select]:border [&_select]:border-white [&_select]:bg-white/70 [&_select]:px-3 [&_select]:text-xs [&_select]:font-black [&_select]:text-slate-700"
          >
            <NativeSelectOption value="all">ทั้งหมด</NativeSelectOption>
            {(['early', 'primary', 'secondary'] as Department[]).map((dept) => (
              <NativeSelectOption key={dept} value={dept}>
                {DEPARTMENT_CONFIG[dept].label}
              </NativeSelectOption>
            ))}
          </NativeSelect>,
          headerRightPortalEl,
        )}
      <div className="flex-1 overflow-y-auto flex flex-col">
        {/* Class Selection Dropdown */}
        {!selectedClassId && (
          <div className="flex-1 pb-4 min-h-0">
            <NativeSelect
              value={filterDept}
              onChange={(e) => setFilterDept(e.target.value as Department | 'all')}
              aria-label="เลือกระดับชั้น"
              className="lg:hidden mb-3 w-full [&_select]:h-9 [&_select]:rounded-xl [&_select]:border [&_select]:border-white [&_select]:bg-white/70 [&_select]:px-3 [&_select]:text-xs [&_select]:font-black [&_select]:text-slate-700"
            >
              <NativeSelectOption value="all">ทั้งหมด</NativeSelectOption>
              {(['early', 'primary', 'secondary'] as Department[]).map((dept) => (
                <NativeSelectOption key={dept} value={dept}>
                  {DEPARTMENT_CONFIG[dept].label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {filteredHomeRoomClasses.map((cls: any) => {
                const cardTeacher = classMgr.classCards?.find((card: any) => card.classRoom?.id === cls.id)?.homeroomTeacher;
                const teacherRawName = cardTeacher?.name || 'ไม่ระบุครู';
                const teacherName = stripThaiPrefix(teacherRawName);
                const teacherInitial = teacherName.trim().charAt(0) || '?';
                const formattedClassCode = cls.className
                  .replace(/^ม\./, 'M')
                  .replace('/', '-')
                  .replace(/\s/g, '');

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
                    className="group relative w-full h-[110px] sm:h-[120px] lg:aspect-square overflow-hidden text-left"
                    style={{
                      borderRadius: 16,
                      backgroundColor: SOLID_CLASS_CARD_COLOR,
                    }}
                  >
                    <div className="absolute top-4 left-4 right-4">
                      <span className="block w-full text-left text-[26px] sm:text-[30px] font-black tracking-tight leading-none text-white">
                        {formattedClassCode}
                      </span>
                    </div>
                    <div className="absolute bottom-2 right-2 flex items-center gap-2 pointer-events-none">
                      <span className="text-[11px] font-semibold text-white text-right leading-tight whitespace-normal">
                        {teacherName}
                      </span>
                      <div className="w-9 h-9 rounded-full overflow-hidden border border-white/70 bg-white/20 flex items-center justify-center">
                        {cardTeacher?.photoURL ? (
                          <img src={cardTeacher.photoURL} alt={teacherName} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[11px] font-bold text-white">
                            {teacherInitial}
                          </div>
                        )}
                      </div>
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

                {/* View Report Button */}
                <button
                  onClick={() => setActiveTab('report')}
                  className="h-9 pl-2.5 pr-3 rounded-full bg-white shadow-sm flex items-center gap-1.5 border border-slate-100 hover:bg-slate-50 active:scale-95 transition-all text-slate-600 cursor-pointer shrink-0"
                  title="ดูรายงานการเช็กชื่อ"
                >
                  <FileText size={15} />
                  <span className="text-xs font-bold">ดูรายงาน</span>
                </button>
              </div>

              {/* Right Group: Summary Chips */}
              {!isRollCallLocked && (
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
                {existingSession && !editMode && !isRollCallBlocked && (
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
            <div className="md:hidden flex-shrink-0 rounded-[24px] border border-slate-100 bg-white p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setSelectedClassId(null);
                      setEditMode(false);
                    }}
                    className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center border border-slate-200 hover:bg-slate-50 text-slate-600 cursor-pointer transition-all active:scale-95 shrink-0"
                    title="เปลี่ยนห้องเรียน"
                  >
                    <ArrowLeft size={15} />
                  </button>

                  {existingSession && !editMode && !isRollCallBlocked ? (
                    <button
                      onClick={() => setEditMode(true)}
                      className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center border border-slate-200 hover:bg-slate-50 text-slate-600 cursor-pointer transition-all active:scale-95 shrink-0"
                      title="แก้ไข"
                    >
                      <Edit2 size={13} />
                    </button>
                  ) : (
                    !isRollCallLocked && (
                      <label
                        className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center border border-slate-200 hover:bg-slate-50 active:scale-95 transition-all cursor-pointer select-none shrink-0"
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
                  <button
                    type="button"
                    onClick={() => setIsMobileSummaryCollapsed(prev => !prev)}
                    className="w-8 h-8 rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm flex items-center justify-center active:scale-95 transition shrink-0"
                    title={isMobileSummaryCollapsed ? 'แสดงสรุป' : 'หุบสรุป'}
                    aria-label={isMobileSummaryCollapsed ? 'แสดงสรุปการมาเรียน' : 'หุบสรุปการมาเรียน'}
                  >
                    {isMobileSummaryCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('report')}
                    className="w-8 h-8 rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm flex items-center justify-center active:scale-95 transition shrink-0"
                    title="ดูรายงานการเช็กชื่อ"
                    aria-label="ดูรายงานการเช็กชื่อ"
                  >
                    <FileText size={14} />
                  </button>
                </div>

                <div className="text-right">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                    Morning Roll Call
                  </p>
                  <p className="text-[12px] font-semibold text-slate-700">
                    {selectedClass?.className ?? 'เช็กชื่อเข้าแถว'}
                  </p>
                </div>
              </div>

              {!isMobileSummaryCollapsed && (
                <>
                <div className="mt-4 text-center">
                  <div className="flex items-start justify-center gap-1">
                    <span className="text-[38px] leading-none font-black text-slate-950">{summary.total}</span>
                    <span className="mt-1 text-[11px] font-semibold text-slate-400">คน</span>
                  </div>
                  <p className="mt-0.5 text-sm font-semibold text-blue-600">สรุปการมาเรียน</p>
                </div>

              {(() => {
                const total = Math.max(summary.total, 1);
                const segments = [
                  { key: 'present', label: 'มา', count: summary.present, color: 'bg-emerald-400', dot: 'bg-emerald-400', text: 'text-emerald-600' },
                  { key: 'absent', label: 'ขาด', count: summary.absent, color: 'bg-rose-400', dot: 'bg-rose-400', text: 'text-rose-600' },
                  { key: 'late', label: 'สาย', count: summary.late, color: 'bg-amber-400', dot: 'bg-amber-400', text: 'text-amber-600' },
                  { key: 'leave', label: 'ลา', count: summary.leave, color: 'bg-violet-500', dot: 'bg-violet-500', text: 'text-violet-600' },
                ];

                return (
                  <div className="mt-5 rounded-[24px] bg-slate-50 p-3 shadow-inner">
                    <div className="flex h-10 gap-1 overflow-hidden rounded-xl">
                      {segments.map((segment) => (
                        <div
                          key={segment.key}
                          className={`${segment.color} min-w-[18px] rounded-2xl transition-all`}
                          style={{ width: `${Math.max((segment.count / total) * 100, segment.count > 0 ? 12 : 8)}%` }}
                        />
                      ))}
                    </div>

                    <div className="mt-3 grid grid-cols-4 gap-2">
                      {segments.map((segment) => (
                        <div key={segment.key} className="min-w-0">
                          <div className="flex items-center gap-1">
                            <span className={`w-2 h-2 rounded-full ${segment.dot}`} />
                            <span className={`text-[11px] font-black ${segment.text}`}>{segment.label}</span>
                          </div>
                          <p className="mt-1 text-[15px] leading-none font-black text-slate-900">
                            {segment.count}
                            <span className="ml-0.5 text-[10px] font-bold text-slate-400">คน</span>
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
                </>
              )}
            </div>

            {/* Student List */}
            <div className="flex-1 overflow-y-auto no-scrollbar min-h-0">
              {loadingClassStudents && rowsToUse.length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm font-semibold text-slate-500">
                  กำลังโหลดรายชื่อนักเรียน...
                </div>
              ) : (
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

                  const rowStatusStyle = row.status === 'present'
                    ? 'bg-emerald-100/60 border-emerald-200'
                    : row.status === 'absent'
                      ? 'bg-rose-100/60 border-rose-200'
                      : row.status === 'late'
                        ? 'bg-amber-100/60 border-amber-200'
                        : row.status === 'leave'
                          ? 'bg-violet-100/60 border-violet-200'
                          : i % 2 === 0
                            ? 'bg-white border-slate-100 hover:bg-slate-50'
                            : 'bg-slate-50/60 border-slate-100 hover:bg-slate-100/60';

                  return (
                    <motion.div
                      key={`${row.studentId}-${i}`}
                      layout
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ delay: i * 0.01 }}
                      className={`flex items-center justify-between py-3 px-4 rounded-xl border transition-all mb-1 ${rowStatusStyle}`}
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
              )}
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
                    if (existingSession && !editMode && !isRollCallBlocked) {
                      setEditMode(true);
                      return;
                    }
                    if (isRollCallBlocked) {
                      setSaveError(
                        isWeekend
                          ? 'วันนี้เป็นวันหยุดสุดสัปดาห์ ไม่สามารถเช็กชื่อเข้าแถวได้'
                          : `วันนี้เป็นวันหยุด${holidayTitle ? ` (${holidayTitle})` : ''} ไม่สามารถเช็กชื่อเข้าแถวได้`,
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
                  className={`w-full px-4 py-3 rounded-2xl font-black flex items-center justify-center gap-2 transition disabled:opacity-50 disabled:cursor-not-allowed ${
                    existingSession && !editMode
                      ? 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-[0_8px_18px_rgba(16,185,129,0.12)]'
                      : isReadyToSubmit
                        ? 'bg-blue-600 text-white hover:bg-blue-500 shadow-[0_8px_18px_rgba(59,130,246,0.25)]'
                        : 'bg-slate-900 text-white hover:bg-slate-700 shadow-[0_8px_18px_rgba(15,23,42,0.12)]'
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
                <div className="bg-white/90 border border-slate-200 rounded-[26px] p-3 backdrop-blur-md flex flex-col gap-3 ring-1 ring-white/60">
                  <div className="flex items-center gap-2 overflow-x-auto no-scrollbar w-full pb-1">
                    <button
                      onClick={() => setActiveTab('rollcall')}
                      className="shrink-0 w-8 h-8 flex items-center justify-center rounded-xl bg-white/40 text-slate-500 hover:bg-white/70 transition-colors"
                      title="กลับไปหน้าเช็กชื่อ"
                      aria-label="กลับไปหน้าเช็กชื่อ"
                    >
                      <ArrowLeft size={14} />
                    </button>
                    <input
                      type="date"
                      value={reportFrom}
                      onChange={(e) => setReportFrom(e.target.value)}
                      className="flex-1 w-full min-w-[100px] h-8 rounded-xl border-none bg-slate-100 px-3 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                    <span className="text-slate-400 text-xs px-1">ถึง</span>
                    <input
                      type="date"
                      value={reportTo}
                      onChange={(e) => setReportTo(e.target.value)}
                      className="flex-1 w-full min-w-[100px] h-8 rounded-xl border-none bg-slate-100 px-3 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                    <button
                      onClick={() => {
                        const to = new Date();
                        const from = new Date();
                        from.setDate(from.getDate() - 30);
                        setReportTo(to.toISOString().slice(0, 10));
                        setReportFrom(from.toISOString().slice(0, 10));
                      }}
                      className="shrink-0 w-8 h-8 ml-1 flex items-center justify-center rounded-xl bg-white/40 text-slate-500 hover:bg-white/70 transition-colors"
                      title="ล้างตัวกรองวันที่"
                    >
                      <RotateCcw size={14} />
                    </button>
                  </div>
                </div>

                <div className="flex-1 min-h-0">
                  <div className="rounded-xl bg-white/35 border border-white/40 p-3 backdrop-blur-md overflow-y-auto min-h-[280px]">
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
                              className="w-8 h-8 rounded-lg shrink-0"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-[12px] font-semibold text-slate-800 truncate">{student.studentName}</p>
                              <p className="text-[10px] text-slate-500 truncate">{student.studentCode}</p>
                            </div>
                          </div>

                          <div className="mt-2 grid grid-cols-4 gap-1.5">
                            <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-2 py-1">
                              <p className="text-[10px] font-bold text-emerald-700">มา</p>
                              <p className="text-sm leading-none font-black text-emerald-700 mt-1">{student.present}</p>
                            </div>
                            <div className="rounded-lg border border-rose-100 bg-rose-50 px-2 py-1">
                              <p className="text-[10px] font-bold text-rose-700">ขาด</p>
                              <p className="text-sm leading-none font-black text-rose-700 mt-1">{student.absent}</p>
                            </div>
                            <div className="rounded-lg border border-amber-100 bg-amber-50 px-2 py-1">
                              <p className="text-[10px] font-bold text-amber-700">สาย</p>
                              <p className="text-sm leading-none font-black text-amber-700 mt-1">{student.late}</p>
                            </div>
                            <div className="rounded-lg border border-violet-100 bg-violet-50 px-2 py-1">
                              <p className="text-[10px] font-bold text-violet-700">ลา</p>
                              <p className="text-sm leading-none font-black text-violet-700 mt-1">{student.leave}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                      {!isLoadingReport && reportStudentSummaries.length === 0 && (
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
