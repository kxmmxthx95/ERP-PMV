import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  BarChart3,
  Users,
  UserCheck,
  Clock3,
  XCircle,
  FileText,
  GraduationCap,
  CalendarDays,
  RefreshCw,
} from 'lucide-react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAdminStaffAttendance, resolveStaffAttendanceDisplay, type StaffAttendanceRecord } from '@/hooks/useStaffAttendance';
import { useLeaveRequestsSince } from '@/hooks/useLeaveRequests';
import { useStaffUsers } from '@/hooks/useStaffUsers';
import { useTeachersCollection } from '@/hooks/useTeachersCollection';
import {
  buildTeacherPositionByUserId,
  isSpecialTeacherUser,
} from '@/lib/staffAttendance/specialTeacher';
import type { LeaveRequest, LeaveStatus, LeaveType } from '@/types/leave';
import { cn } from '@/lib/utils';

type StaffDirectoryItem = {
  userId: string;
  displayName: string;
};

type StaffReportRow = {
  id: string;
  userId: string;
  displayName: string;
  status: 'present' | 'late' | 'absent' | 'leave';
  isAutoAbsent?: boolean;
  leaveType?: LeaveType;
  leaveStatus?: LeaveStatus;
};

type StudentSummary = {
  sessions: number;
  classes: number;
  subjects: number;
  present: number;
  late: number;
  absent: number;
  leave: number;
};

const LEAVE_STATUS_LABEL: Record<LeaveStatus, string> = {
  pending: 'รอพิจารณา',
  approved: 'อนุมัติ',
  rejected: 'ไม่อนุมัติ',
};

const LEAVE_TYPE_LABEL: Record<LeaveType, string> = {
  sick: 'ลาป่วย',
  personal: 'ลากิจ',
};

function statusPillClass(status: StaffReportRow['status']) {
  if (status === 'present') return 'bg-emerald-100 text-emerald-700';
  if (status === 'late') return 'bg-amber-100 text-amber-700';
  if (status === 'leave') return 'bg-violet-100 text-violet-700';
  return 'bg-rose-100 text-rose-700';
}

export default function ExecutiveReportPage() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const { users: staffUsers } = useStaffUsers();
  const { teachers } = useTeachersCollection();
  const teacherPositionByUserId = useMemo(
    () => buildTeacherPositionByUserId(teachers),
    [teachers],
  );
  const staffDirectory = useMemo<StaffDirectoryItem[]>(
    () => staffUsers.map((u) => ({ userId: u.userId, displayName: u.displayName })),
    [staffUsers],
  );
  const [studentSummary, setStudentSummary] = useState<StudentSummary>({
    sessions: 0,
    classes: 0,
    subjects: 0,
    present: 0,
    late: 0,
    absent: 0,
    leave: 0,
  });
  const [studentLoading, setStudentLoading] = useState(true);

  const { records, loading: staffLoading, refresh: refreshStaff } = useAdminStaffAttendance(selectedDate);
  const { requests: leaveRequests } = useLeaveRequestsSince(selectedDate);

  const staffNameById = useMemo(() => {
    const map = new Map<string, string>();
    staffDirectory.forEach(s => map.set(s.userId, s.displayName));
    return map;
  }, [staffDirectory]);

  const staffUserIds = useMemo(() => new Set(staffDirectory.map(s => s.userId)), [staffDirectory]);

  useEffect(() => {
    let cancelled = false;
    const loadStudentSummary = async () => {
      setStudentLoading(true);
      try {
        const q = query(collection(db, 'class_sessions'), where('date', '==', selectedDate));
        const snap = await getDocs(q);
        if (cancelled) return;

        const classes = new Set<string>();
        const subjects = new Set<string>();
        let present = 0;
        let late = 0;
        let absent = 0;
        let leave = 0;

        snap.forEach((docSnap) => {
          const data = docSnap.data() as Record<string, unknown>;
          const classId = typeof data.classId === 'string' ? data.classId : '';
          const subjectId = typeof data.subjectId === 'string' ? data.subjectId : '';
          const summary = (data.summary ?? {}) as Record<string, unknown>;

          if (classId) classes.add(classId);
          if (subjectId) subjects.add(subjectId);
          present += Number(summary.present ?? 0);
          late += Number(summary.late ?? 0);
          absent += Number(summary.absent ?? 0);
          leave += Number(summary.leave ?? 0);
        });

        setStudentSummary({
          sessions: snap.size,
          classes: classes.size,
          subjects: subjects.size,
          present,
          late,
          absent,
          leave,
        });
      } finally {
        if (!cancelled) setStudentLoading(false);
      }
    };
    loadStudentSummary().catch(() => setStudentLoading(false));
    return () => {
      cancelled = true;
    };
  }, [selectedDate]);

  const leaveRows = useMemo(() => {
    const attendedUserIds = new Set(records.map(r => r.userId));
    return leaveRequests
      .filter((req: LeaveRequest) =>
        (req.requesterType !== 'student' || staffUserIds.has(req.requesterId)) &&
        req.status !== 'rejected' &&
        req.startDate <= selectedDate &&
        req.endDate >= selectedDate &&
        !attendedUserIds.has(req.requesterId)
      )
      .map((req: LeaveRequest): StaffReportRow => ({
        id: `leave-${req.id}`,
        userId: req.requesterId,
        displayName: staffNameById.get(req.requesterId) || req.requesterName || 'บุคลากร',
        status: 'leave',
        leaveType: req.leaveType,
        leaveStatus: req.status,
      }));
  }, [leaveRequests, records, selectedDate, staffUserIds, staffNameById]);

  const autoAbsentRows = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const isPastDate = selectedDate < todayStr;
    const isTodayAfterNoon = selectedDate === todayStr && now.getHours() >= 12;
    if (!isPastDate && !isTodayAfterNoon) return [] as StaffReportRow[];

    const attendedUserIds = new Set(records.map(r => r.userId));
    const onLeaveUserIds = new Set(leaveRows.map(r => r.userId));

    return staffDirectory
      .filter(s => !attendedUserIds.has(s.userId) && !onLeaveUserIds.has(s.userId))
      .map((s): StaffReportRow => ({
        id: `auto-absent-${s.userId}-${selectedDate}`,
        userId: s.userId,
        displayName: s.displayName,
        status: 'absent',
        isAutoAbsent: true,
      }));
  }, [leaveRows, records, selectedDate, staffDirectory]);

  const staffRows = useMemo(() => {
    const day = new Date(`${selectedDate}T12:00:00`).getDay();
    const isWorkingDay = day !== 0 && day !== 6;
    const attendanceRows: StaffReportRow[] = records.map((r: StaffAttendanceRecord) => {
      const resolved = resolveStaffAttendanceDisplay(r, {
        selectedDate,
        isWorkingDay,
        isSpecialTeacher: isSpecialTeacherUser(r.userId, teacherPositionByUserId),
      });
      return {
        id: r.id,
        userId: r.userId,
        displayName: r.displayName,
        status: resolved.status,
        isAutoAbsent: resolved.isAutoAbsent,
      };
    });
    return [...attendanceRows, ...leaveRows, ...autoAbsentRows].sort((a, b) =>
      a.displayName.localeCompare(b.displayName, 'th')
    );
  }, [records, leaveRows, autoAbsentRows, selectedDate, teacherPositionByUserId]);

  const staffSummary = useMemo(() => ({
    present: staffRows.filter(r => r.status === 'present').length,
    late: staffRows.filter(r => r.status === 'late').length,
    absent: staffRows.filter(r => r.status === 'absent').length,
    leave: staffRows.filter(r => r.status === 'leave').length,
    total: staffRows.length,
  }), [staffRows]);

  const leaveSummary = useMemo(() => ({
    pendingStaff: leaveRequests.filter(r => (r.requesterType !== 'student' || staffUserIds.has(r.requesterId)) && r.status === 'pending').length,
    pendingStudents: leaveRequests.filter(r => r.requesterType === 'student' && r.status === 'pending').length,
    activeStaff: leaveRequests.filter(
      r => (r.requesterType !== 'student' || staffUserIds.has(r.requesterId)) && r.status === 'approved' && r.startDate <= selectedDate && r.endDate >= selectedDate
    ).length,
  }), [leaveRequests, selectedDate, staffUserIds]);

  const isLoading = staffLoading || studentLoading;

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-4">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4 rounded-[2rem] border border-white/30 bg-white/45 p-6 backdrop-blur-md md:flex-row md:items-center md:justify-between"
      >
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-white ring-8 ring-slate-100/70">
            <BarChart3 size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-800">รายงานผู้บริหาร</h1>
            <p className="mt-1 text-sm font-bold text-slate-400">Executive Daily Digest (บุคลากร + นักเรียน + การลา)</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/70 px-3 py-2">
            <CalendarDays size={15} className="text-slate-400" />
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="bg-transparent text-sm font-bold text-slate-700 outline-none"
            />
          </div>
          <button
            onClick={refreshStaff}
            className="inline-flex h-10 items-center gap-1.5 rounded-2xl border border-slate-200 bg-white/80 px-3 text-sm font-semibold text-slate-600 hover:bg-white"
          >
            <RefreshCw size={14} />
            รีเฟรช
          </button>
          <Link
            to="/portal/staff-attendance"
            className="inline-flex h-10 items-center rounded-2xl bg-slate-900 px-4 text-sm font-bold text-white hover:bg-slate-800"
          >
            เปิดหน้าลงเวลา
          </Link>
        </div>
      </motion.div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
        {[
          { label: 'บุคลากรทั้งหมด', value: staffSummary.total, icon: Users, color: 'text-slate-700', bg: 'bg-slate-50' },
          { label: 'มาตรงเวลา', value: staffSummary.present, icon: UserCheck, color: 'text-emerald-700', bg: 'bg-emerald-50' },
          { label: 'มาสาย', value: staffSummary.late, icon: Clock3, color: 'text-amber-700', bg: 'bg-amber-50' },
          { label: 'ขาดงาน', value: staffSummary.absent, icon: XCircle, color: 'text-rose-700', bg: 'bg-rose-50' },
          { label: 'ลา', value: staffSummary.leave, icon: FileText, color: 'text-violet-700', bg: 'bg-violet-50' },
          { label: 'เซสชันสอน', value: studentSummary.sessions, icon: GraduationCap, color: 'text-blue-700', bg: 'bg-blue-50' },
          { label: 'ห้องเรียนที่สอน', value: studentSummary.classes, icon: GraduationCap, color: 'text-cyan-700', bg: 'bg-cyan-50' },
          { label: 'คำขอลารออนุมัติ', value: leaveSummary.pendingStaff + leaveSummary.pendingStudents, icon: Clock3, color: 'text-orange-700', bg: 'bg-orange-50' },
        ].map(card => (
          <div key={card.label} className={cn('rounded-2xl border border-white/40 p-4 backdrop-blur-md', card.bg)}>
            <div className="mb-2 flex items-center justify-between">
              <card.icon size={15} className={card.color} />
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{card.label}</span>
            </div>
            <p className={cn('text-2xl font-black tabular-nums', card.color)}>{isLoading ? '...' : card.value}</p>
          </div>
        ))}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 xl:grid-cols-5">
        <div className="xl:col-span-3 min-h-0 rounded-[2rem] border border-white/40 bg-white/55 p-5 backdrop-blur-md">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-black uppercase tracking-wider text-slate-700">สถานะบุคลากร</h2>
            <span className="text-xs font-semibold text-slate-400">{staffRows.length} รายชื่อ</span>
          </div>

          <div className="max-h-[460px] overflow-y-auto pr-1">
            {staffRows.length === 0 ? (
              <p className="py-8 text-center text-sm font-semibold text-slate-400">ยังไม่มีข้อมูลในวันที่เลือก</p>
            ) : (
              <div className="space-y-2">
                {staffRows.map(row => (
                  <div key={row.id} className="flex items-center justify-between rounded-xl border border-slate-100 bg-white/70 px-3 py-2">
                    <p className="text-sm font-bold text-slate-700">{row.displayName}</p>
                    <div className="flex items-center gap-2">
                      {row.isAutoAbsent && (
                        <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-600">
                          Auto 12:00
                        </span>
                      )}
                      {row.status === 'leave' && row.leaveType && (
                        <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-700">
                          {LEAVE_TYPE_LABEL[row.leaveType]}
                        </span>
                      )}
                      {row.status === 'leave' && row.leaveStatus && (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                          {LEAVE_STATUS_LABEL[row.leaveStatus]}
                        </span>
                      )}
                      <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', statusPillClass(row.status))}>
                        {row.status === 'present' ? 'มาตรงเวลา' : row.status === 'late' ? 'มาสาย' : row.status === 'leave' ? 'ลา' : 'ขาดงาน'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="xl:col-span-2 min-h-0 space-y-4">
          <div className="rounded-[2rem] border border-white/40 bg-white/55 p-5 backdrop-blur-md">
            <h2 className="mb-3 text-sm font-black uppercase tracking-wider text-slate-700">สรุปการเข้าเรียนนักเรียน</h2>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'มาเรียน', value: studentSummary.present, cls: 'text-emerald-600 bg-emerald-50' },
                { label: 'มาสาย', value: studentSummary.late, cls: 'text-amber-600 bg-amber-50' },
                { label: 'ขาด', value: studentSummary.absent, cls: 'text-rose-600 bg-rose-50' },
                { label: 'ลา', value: studentSummary.leave, cls: 'text-violet-600 bg-violet-50' },
              ].map(item => (
                <div key={item.label} className={cn('rounded-xl p-3 text-center', item.cls)}>
                  <p className="text-lg font-black tabular-nums">{studentLoading ? '...' : item.value}</p>
                  <p className="text-[11px] font-semibold">{item.label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/40 bg-white/55 p-5 backdrop-blur-md">
            <h2 className="mb-3 text-sm font-black uppercase tracking-wider text-slate-700">สรุปคำขอลา</h2>
            <div className="space-y-2">
              <div className="flex items-center justify-between rounded-xl bg-white/70 px-3 py-2">
                <span className="text-sm font-semibold text-slate-600">รออนุมัติ (บุคลากร)</span>
                <span className="text-sm font-black text-amber-600">{leaveSummary.pendingStaff}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-white/70 px-3 py-2">
                <span className="text-sm font-semibold text-slate-600">รออนุมัติ (นักเรียน)</span>
                <span className="text-sm font-black text-amber-600">{leaveSummary.pendingStudents}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-white/70 px-3 py-2">
                <span className="text-sm font-semibold text-slate-600">ลาอนุมัติที่ยัง active</span>
                <span className="text-sm font-black text-violet-700">{leaveSummary.activeStaff}</span>
              </div>
            </div>
            <Link
              to="/portal/leave"
              className="mt-4 inline-flex h-9 items-center rounded-xl bg-orange-500 px-3 text-xs font-black text-white hover:bg-orange-600"
            >
              จัดการคำขอลา
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
