import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  HiCalendarDays,
  HiChevronDown,
  HiCog6Tooth,
  HiPresentationChartLine,
} from 'react-icons/hi2';
import type { IconType } from 'react-icons';
import {
  AlertCircle, Check, X, AlertTriangle, RotateCcw, Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/hooks/useAuth';
import {
  useAdminStaffAttendance,
  resolveStaffAttendanceDisplay,
  timestampToLocalDate,
  type StaffAttendanceRecord,
  type AttendanceStatus,
} from '@/hooks/useStaffAttendance';
import { loadPersonalAttendanceStats } from '@/lib/staffAttendance/personalStats';
import { useTeachersCollection } from '@/hooks/useTeachersCollection';
import {
  buildTeacherPositionByUserId,
  isSpecialTeacherUser,
} from '@/lib/staffAttendance/specialTeacher';
import { useLeaveRequestsSince } from '@/hooks/useLeaveRequests';
import { useStaffUsers } from '@/hooks/useStaffUsers';
import type { LeaveRequest, LeaveStatus, LeaveType } from '@/types/leave';
import { useAcademicCalendar } from '@/hooks/useAcademicCalendar';
import { useThaiHolidays } from '@/features/calendar/hooks/useThaiHolidays';
import AttendanceSettingsPanel from './AttendanceSettingsPanel';
import AttendanceReportPanel from './AttendanceReportPanel';
import { DEPARTMENT_CONFIG, type Department } from '@/types/curriculum';

// ── Helpers ───────────────────────────────────────────────────────────────────
type MaybeTimestamp = { toDate: () => Date } | Date | string | number | null | undefined;
function fmt(ts: MaybeTimestamp, withDate = false): string {
  if (!ts) return '—';
  const d = timestampToLocalDate(ts);
  if (!d) return '—';
  if (withDate) return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
  return d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
}

const STATUS_CONFIG: Record<AttendanceStatus, { label: string; bg: string; text: string; icon: LucideIcon }> = {
  present: { label: 'มาตรงเวลา', bg: 'bg-emerald-100', text: 'text-emerald-700', icon: Check },
  late: { label: 'มาสาย', bg: 'bg-amber-100', text: 'text-amber-700', icon: AlertTriangle },
  absent: { label: 'ขาดงาน', bg: 'bg-red-100', text: 'text-red-700', icon: X },
};


const LEAVE_TYPE_LABEL: Record<LeaveType, string> = {
  sick: 'ลาป่วย',
  personal: 'ลากิจ',
};

type StaffAttendanceTableRow = StaffAttendanceRecord & {
  isLeave?: boolean;
  isAutoAbsent?: boolean;
  isPending?: boolean;
  leaveType?: LeaveType;
  leaveStatus?: LeaveStatus;
  leaveStartDate?: string;
  leaveEndDate?: string;
};

interface StaffDirectoryItem {
  userId: string;
  displayName: string;
  photoURL?: string;
  department?: string;
}

interface PersonalStatsModalProps {
  row: StaffAttendanceTableRow;
  leaveRequests: LeaveRequest[];
  isSpecialTeacher?: boolean;
  onClose: () => void;
}

function PersonalStatsModal({ row, leaveRequests, isSpecialTeacher = false, onClose }: PersonalStatsModalProps) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [stats, setStats] = useState({ present: 0, late: 0, absent: 0, leave: 0, total: 0 });

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setLoadError('');
      try {
        const nextStats = await loadPersonalAttendanceStats(row.userId, leaveRequests, isSpecialTeacher);
        if (cancelled) return;
        setStats(nextStats);
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'โหลดสถิติไม่สำเร็จ');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [row.userId, leaveRequests, isSpecialTeacher]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 8 }}
        className="relative w-full max-w-sm rounded-3xl bg-white border border-slate-200 p-5 shadow-2xl"
      >
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full overflow-hidden bg-slate-100 border border-slate-200">
            {row.photoURL ? (
              <img src={row.photoURL} alt={row.displayName} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-500 font-black">
                {row.displayName.charAt(0)}
              </div>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-black text-slate-800 truncate">{row.displayName}</p>
            <p className="text-[11px] text-slate-500">
              {DEPARTMENT_CONFIG[row.department as Department]?.label || row.department || '-'}
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
            <p className="text-[10px] font-bold text-emerald-600">มา</p>
            <p className="text-lg font-black text-emerald-700">{loading ? '-' : stats.present}</p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
            <p className="text-[10px] font-bold text-amber-600">สาย</p>
            <p className="text-lg font-black text-amber-700">{loading ? '-' : stats.late}</p>
          </div>
          <div className="rounded-xl border border-[#F22C07] bg-[#F22C07]/10 px-3 py-2">
            <p className="text-[10px] font-bold text-[#F22C07]">ขาด</p>
            <p className="text-lg font-black text-[#F22C07]">{loading ? '-' : stats.absent}</p>
          </div>
          <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2">
            <p className="text-[10px] font-bold text-blue-600">ลา</p>
            <p className="text-lg font-black text-blue-700">{loading ? '-' : stats.leave}</p>
          </div>
        </div>

        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
          <p className="text-[11px] text-slate-500">สรุปรวม</p>
          <p className="text-xl font-black text-slate-800">
            {loading ? 'กำลังโหลด...' : loadError ? '—' : `${stats.total} รายการ`}
          </p>
          {loadError ? (
            <p className="mt-1 text-[11px] font-semibold text-rose-600">{loadError}</p>
          ) : null}
        </div>

        <button
          onClick={onClose}
          className="mt-4 w-full h-10 rounded-xl bg-slate-900 text-white text-sm font-black"
        >
          ปิด
        </button>
      </motion.div>
    </div>
  );
}

// ── Admin Override Modal ──────────────────────────────────────────────────────
interface OverrideModalProps {
  record: StaffAttendanceRecord | null;
  onClose: () => void;
  onSave: (status: AttendanceStatus, note: string) => void;
}
function OverrideModal({ record, onClose, onSave }: OverrideModalProps) {
  const [status, setStatus] = useState<AttendanceStatus>(record?.status ?? 'present');
  const [note, setNote] = useState(record?.note ?? '');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="relative w-full max-w-sm rounded-3xl bg-white p-6 flex flex-col gap-4 shadow-2xl"
      >
        <p className="font-bold text-slate-800">Override: {record?.displayName ?? 'บุคลากร'}</p>

        <div className="flex flex-col gap-2">
          <label className="text-xs text-slate-500">สถานะ</label>
          <div className="grid grid-cols-3 gap-2">
            {(['present', 'late', 'absent'] as AttendanceStatus[]).map(s => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={`py-2 rounded-xl text-xs font-semibold border transition-all ${status === s ? `${STATUS_CONFIG[s].bg} ${STATUS_CONFIG[s].text} border-transparent` : 'border-slate-200 text-slate-500'}`}
              >
                {STATUS_CONFIG[s].label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs text-slate-500">หมายเหตุ</label>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            rows={2}
            className="w-full rounded-xl border border-slate-200 p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-300"
            placeholder="เหตุผล..."
          />
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-slate-200 text-sm text-slate-600 font-semibold">ยกเลิก</button>
          <button onClick={() => onSave(status, note)} className="flex-1 py-3 rounded-xl bg-blue-500 text-white text-sm font-semibold">บันทึก</button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Admin Panel ───────────────────────────────────────────────────────────────
function AdminPanel() {
  const { user, role } = useAuth();
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [filter, setFilter] = useState<'all' | 'late' | 'absent' | 'leave'>('all');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [overrideTarget, setOverrideTarget] = useState<StaffAttendanceRecord | null | undefined>(undefined);
  const [summaryTarget, setSummaryTarget] = useState<StaffAttendanceTableRow | null>(null);
  const { records, loading, refresh, override } = useAdminStaffAttendance(selectedDate);
  const { requests: leaveRequests } = useLeaveRequestsSince(selectedDate);
  const { users: staffUserRows } = useStaffUsers();
  const { teachers } = useTeachersCollection();
  const teacherPositionByUserId = useMemo(
    () => buildTeacherPositionByUserId(teachers),
    [teachers],
  );
  const selectedYear = Number(selectedDate.slice(0, 4));
  const { holidays: thaiHolidays } = useThaiHolidays(selectedYear);
  const { events: calendarEvents } = useAcademicCalendar(role ?? undefined, thaiHolidays);

  const staffDirectory = useMemo<StaffDirectoryItem[]>(
    () =>
      staffUserRows
        .filter((u) => u.role === 'teacher')
        .map((u) => ({
          userId: u.userId,
          displayName: u.displayName,
          photoURL: u.photoURL,
          department: u.department,
        })),
    [staffUserRows],
  );
  const staffUserIds = useMemo(() => new Set(staffDirectory.map(s => s.userId)), [staffDirectory]);

  const selected = new Date(`${selectedDate}T12:00:00`);
  const day = selected.getDay();
  const isWeekend = day === 0 || day === 6;
  const holidayEvent = calendarEvents.find((event) => (
    event.type === 'holiday'
    && selectedDate >= event.startDate
    && selectedDate <= event.endDate
  ));
  const isHoliday = !!holidayEvent;
  const isWorkingDay = !isWeekend && !isHoliday;
  const holidayName = holidayEvent ? holidayEvent.title : (isWeekend ? 'วันหยุดสุดสัปดาห์' : '');

  const allRows = useMemo<StaffAttendanceTableRow[]>(() => {
    const recordMap = new Map(records.map(r => [r.userId, r]));
    const attendanceUserIds = new Set(records.map(r => r.userId));

    const activeLeaves = leaveRequests.filter((req: LeaveRequest) =>
      staffUserIds.has(req.requesterId) &&
      req.status !== 'rejected' &&
      req.startDate <= selectedDate &&
      req.endDate >= selectedDate &&
      !attendanceUserIds.has(req.requesterId)
    );
    const leaveMap = new Map(activeLeaves.map(req => [req.requesterId, req]));

    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const isPastDate = selectedDate < todayStr;
    const isFutureDate = selectedDate > todayStr;
    const isTodayAfterNoon = selectedDate === todayStr && now.getHours() >= 12;
    const shouldMarkAbsent = isWorkingDay && (isPastDate || isTodayAfterNoon);

    return staffDirectory.map(staff => {
      const record = recordMap.get(staff.userId);
      if (record) {
        const resolved = resolveStaffAttendanceDisplay(record, {
          selectedDate,
          isWorkingDay,
          now,
          isSpecialTeacher: isSpecialTeacherUser(staff.userId, teacherPositionByUserId),
        });
        return {
          ...record,
          status: resolved.status,
          note: resolved.note,
          isLeave: false,
          isAutoAbsent: resolved.isAutoAbsent,
          isPending: resolved.isPending,
        };
      }

      const leave = leaveMap.get(staff.userId);
      if (leave && !isFutureDate) {
        return {
          id: `leave-${leave.id}`,
          userId: staff.userId,
          displayName: staff.displayName,
          photoURL: staff.photoURL,
          department: staff.department,
          date: selectedDate,
          checkInTime: null,
          checkOutTime: null,
          status: 'absent',
          note: leave.reason,
          isLeave: true,
          isAutoAbsent: false,
          leaveType: leave.leaveType,
          leaveStatus: leave.status,
          leaveStartDate: leave.startDate,
          leaveEndDate: leave.endDate,
        };
      }

      return {
        id: `not-entered-${staff.userId}-${selectedDate}`,
        userId: staff.userId,
        displayName: staff.displayName,
        date: selectedDate,
        checkInTime: null,
        checkOutTime: null,
        status: shouldMarkAbsent ? 'absent' : 'present',
        note: shouldMarkAbsent ? 'ไม่มีการเช็กอินหลัง 12:00 และไม่มีการลา' : '',
        photoURL: staff.photoURL,
        department: staff.department,
        isLeave: false,
        isAutoAbsent: shouldMarkAbsent,
        isPending: !shouldMarkAbsent,
      };
    });
  }, [staffDirectory, records, leaveRequests, staffUserIds, selectedDate, isWorkingDay, teacherPositionByUserId]);

  const filtered = allRows.filter(r => {
    if (departmentFilter !== 'all' && (r.department ?? '') !== departmentFilter) return false;
    if (r.isPending) return filter === 'all';
    if (filter === 'all') return true;
    if (filter === 'leave') return !!r.isLeave;
    if (r.isLeave) return false;
    return r.status === filter;
  });

  const isFilterActive = filter !== 'all' || departmentFilter !== 'all';

  const departmentOptions = useMemo(() => {
    const uniqueDepartments = Array.from(
      new Set(staffDirectory.map(staff => staff.department).filter((dept): dept is string => !!dept))
    );

    return uniqueDepartments
      .sort((a, b) => {
        const labelA = DEPARTMENT_CONFIG[a as Department]?.label || a;
        const labelB = DEPARTMENT_CONFIG[b as Department]?.label || b;
        return labelA.localeCompare(labelB, 'th');
      })
      .map((value) => ({
        value,
        label: DEPARTMENT_CONFIG[value as Department]?.label || value,
      }));
  }, [staffDirectory]);

  const summary = {
    present: allRows.filter(r => !r.isLeave && !r.isPending && r.status === 'present').length,
    late: allRows.filter(r => !r.isLeave && !r.isPending && r.status === 'late').length,
    absent: allRows.filter(r => !r.isLeave && !r.isPending && r.status === 'absent').length,
    leave: allRows.filter(r => r.isLeave && !r.isPending).length,
  };

  const total = allRows.filter(r => !r.isPending).length || 1;
  const STATUS_STYLES: Record<string, { border: string; accent: string; text: string }> = {
    present: { border: 'border-slate-200', accent: 'bg-emerald-500', text: 'text-emerald-700' },
    late: { border: 'border-[#F2C607]', accent: '#F2C607', text: 'text-[#F2C607]' },
    absent: { border: 'border-[#F22C07]', accent: '#F22C07', text: 'text-[#F22C07]' },
    leave: { border: 'border-blue-200', accent: 'bg-blue-500', text: 'text-blue-700' },
    pending: { border: 'border-slate-300', accent: 'bg-slate-400', text: 'text-slate-500' },
  };

  return (
      <div className="flex flex-col gap-5">
      {/* ── Unified Stats + Controls card ── */}
      {isWorkingDay && (
        <div className="rounded-3xl p-4 flex flex-col gap-3 bg-white border border-black/[0.08]">
          {/* Single row: date + filter tabs + refresh + export */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className="rounded-xl border border-slate-100 bg-white/60 px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-200 text-slate-700 font-bold"
              />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={filter}
                onChange={e => setFilter(e.target.value as typeof filter)}
                className="flex-1 min-w-0 rounded-xl border border-slate-100 bg-white/60 px-3 py-2 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-200 appearance-none cursor-pointer"
              >
                <option value="all">ทั้งหมด</option>
                <option value="late">มาสาย</option>
                <option value="absent">ยังไม่เข้า</option>
                <option value="leave">ลา</option>
              </select>

              <select
                value={departmentFilter}
                onChange={e => setDepartmentFilter(e.target.value)}
                className="w-40 rounded-xl border border-slate-100 bg-white/60 px-3 py-2 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-200 appearance-none cursor-pointer"
              >
                <option value="all">ทุกแผนก</option>
                {departmentOptions.map((dept) => (
                  <option key={dept.value} value={dept.value}>{dept.label}</option>
                ))}
              </select>

              <button
                onClick={refresh}
                className="p-2 rounded-xl border border-slate-100 text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-all shrink-0"
                title="รีเฟรช"
              >
                <RotateCcw size={15} />
              </button>
            </div>
          </div>

          {/* Stats row: present pill + progress bars */}
          <div className="flex items-center gap-3">
            {/* มาตรงเวลา pill */}
            <div className="flex items-center gap-2 bg-emerald-50 rounded-2xl px-3 py-2 shrink-0">
              <span className="text-2xl font-black text-emerald-600 leading-none">{summary.present}</span>
              <span className="text-[10px] font-bold text-emerald-500 leading-tight">มาตรงเวลา<br />/ {total} คน</span>
            </div>

            {/* Progress bars */}
            <div className="flex-1 flex flex-col gap-2">
              {[
                { label: 'มาสาย', value: summary.late, total, bar: 'bg-amber-400', bg: 'bg-amber-100', text: 'text-amber-600' },
                { label: 'ขาดงาน', value: summary.absent, total, bar: 'bg-red-400', bg: 'bg-red-100', text: 'text-red-600' },
                { label: 'ลา', value: summary.leave, total, bar: 'bg-blue-400', bg: 'bg-blue-100', text: 'text-blue-600' },
              ].map(s => (
                <div key={s.label} className="flex items-center gap-2">
                  <span className={`text-[10px] font-black w-10 shrink-0 ${s.text}`}>{s.label}</span>
                  <div className={`flex-1 h-2 rounded-full ${s.bg} overflow-hidden`}>
                    <motion.div
                      className={`h-full rounded-full ${s.bar}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${(s.value / s.total) * 100}%` }}
                      transition={{ duration: 0.6, ease: 'easeOut' }}
                    />
                  </div>
                  <span className={`text-[11px] font-black w-4 text-right shrink-0 ${s.text}`}>{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Controls for non-working days */}
      {!isWorkingDay && (
        <div className="rounded-3xl p-4 flex items-center gap-2 flex-wrap bg-white/30 border border-white/30 backdrop-blur-md">
          <input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="rounded-xl border border-slate-100 bg-white/60 px-3 py-2 text-sm flex-1 min-w-0 focus:outline-none focus:ring-2 focus:ring-blue-200 text-slate-700 font-bold"
          />
          <button onClick={refresh} className="p-2 rounded-xl border border-slate-100 text-slate-400 hover:bg-slate-50 transition-all">
            <RotateCcw size={15} />
          </button>
        </div>
      )}

      {/* Card Grid */}
      {!isWorkingDay ? (
        <div className="flex flex-col items-center justify-center text-center py-10 mt-4">
          <div className="w-16 h-16 rounded-full bg-amber-50 text-amber-500 flex items-center justify-center mb-4">
            <AlertCircle size={32} />
          </div>
          <p className="font-bold text-slate-700 text-lg">วันนี้เป็นวันหยุด</p>
          <p className="text-sm text-slate-500 mt-1">{holidayName}</p>
        </div>
      ) : (
        <>
          {loading ? (
            <div className="flex justify-center py-10">
              <div className="w-6 h-6 border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
            </div>
          ) : !isFilterActive ? (
            <div className="flex flex-col items-center justify-center gap-4 py-16 text-slate-400 opacity-60">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-slate-100">
                <Users size={40} className="text-slate-300" />
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-slate-500">กรุณาเลือกตัวกรองเพื่อแสดงรายชื่อ</p>
                <p className="mt-1 text-[11px] text-slate-400">เลือกสถานะหรือแผนกเพื่อเริ่มต้น</p>
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-sm text-slate-400 py-10">ไม่มีข้อมูล</p>
          ) : (
            <ScrollArea className="h-[600px] pr-4 px-0">
              <div className="flex flex-col gap-2">
                {filtered.map(r => {
                  const key = r.isLeave ? 'leave' : (r.isPending ? 'pending' : r.status);
                  const style = STATUS_STYLES[key] ?? STATUS_STYLES.present;
                  return (
                    <motion.div
                      key={r.id}
                      layout
                      initial={{ opacity: 0, scale: 0.96 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className={`relative w-full rounded-2xl border ${style.border} flex flex-col overflow-hidden bg-white`}
                      onClick={() => setSummaryTarget(r)}
                    >
                      <div className="flex items-center px-4 py-3 gap-3">
                        <div
                          className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-black text-white shadow-inner"
                          style={{ background: style.accent }}
                        >
                          {r.photoURL ? (
                            <img src={r.photoURL} alt={r.displayName} className="w-full h-full object-cover rounded-full" />
                          ) : (
                            r.displayName.charAt(0)
                          )}
                        </div>
                        <div className="flex flex-col gap-0.5 min-w-0">
                          <p className={`text-base font-black truncate ${style.text}`}>{r.displayName}</p>
                          {r.department ? (
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 uppercase font-black border border-slate-200">
                              {DEPARTMENT_CONFIG[r.department as Department]?.label || r.department}
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-400">-</span>
                          )}
                        </div>
                        {r.isPending && <span className="ml-auto text-[10px] text-slate-400">ยังไม่ถึงเวลาตัดขาด</span>}
                        {r.isAutoAbsent && r.checkInTime && (
                          <span className="ml-auto text-[10px] font-bold text-[#F22C07]">ขาด (เช็คอินหลัง 12:00)</span>
                        )}
                      </div>
                      <div className="px-4 pb-4 flex items-center gap-2 flex-wrap text-[11px] font-black text-slate-500">
                        {r.isPending ? (
                          <span className="px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-500">
                            รอเช็กอิน
                          </span>
                        ) : r.isLeave ? (
                          <span className="px-3 py-1 rounded-full bg-blue-50 border border-blue-100 text-blue-600">
                            {LEAVE_TYPE_LABEL[r.leaveType as LeaveType] ?? 'ลา'}
                          </span>
                        ) : (
                          <>
                            <span className="px-3 py-1 rounded-full bg-white border border-slate-200 text-slate-500">
                              เข้า {fmt(r.checkInTime)}
                            </span>
                            <span className="px-3 py-1 rounded-full bg-white border border-slate-200 text-slate-500">
                              ออก {fmt(r.checkOutTime)}
                            </span>
                          </>
                        )}
                      </div>
                      {!r.isPending && !r.isLeave && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setOverrideTarget(r);
                          }}
                          className="absolute top-3 right-3 p-1 rounded-full text-slate-300 hover:text-slate-500 hover:bg-slate-100 transition-all"
                          title="Override"
                        >
                          <RotateCcw size={11} />
                        </button>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </>
      )}

      {/* Override modal */}
      <AnimatePresence>
        {overrideTarget !== undefined && (
          <OverrideModal
            record={overrideTarget}
            onClose={() => setOverrideTarget(undefined)}
            onSave={async (status, note) => {
              if (!user) return;
              const isVirtualRecordId =
                !!overrideTarget?.id &&
                (overrideTarget.id.startsWith('auto-absent-') || overrideTarget.id.startsWith('leave-'));
              await override(
                isVirtualRecordId ? null : (overrideTarget?.id ?? null),
                overrideTarget?.userId ?? '',
                overrideTarget?.displayName ?? '',
                status,
                note,
                user.uid,
              );
              setOverrideTarget(undefined);
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {summaryTarget && (
          <PersonalStatsModal
            row={summaryTarget}
            leaveRequests={leaveRequests}
            isSpecialTeacher={isSpecialTeacherUser(summaryTarget.userId, teacherPositionByUserId)}
            onClose={() => setSummaryTarget(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
type StaffAttendanceTab = 'team' | 'report' | 'settings';

const STAFF_ATTENDANCE_TAB_CONFIG: Record<StaffAttendanceTab, { label: string; icon: IconType }> = {
  team: { label: 'ประจำวัน', icon: HiCalendarDays },
  report: { label: 'รายงาน', icon: HiPresentationChartLine },
  settings: { label: 'ตั้งค่า', icon: HiCog6Tooth },
};

export default function StaffAttendancePage() {
  const { role } = useAuth();
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const [mobilePortalTarget, setMobilePortalTarget] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setPortalTarget(document.getElementById('header-portal-center'));
    setMobilePortalTarget(document.getElementById('header-portal-center-mobile'));
  }, []);

  const isAdmin = role === 'admin' || role === 'sysadmin';

  // ── Access Control ──
  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-slate-400 gap-4">
        <AlertCircle size={48} strokeWidth={1.5} />
        <div className="text-center">
          <p className="text-lg font-black text-slate-600">Access Denied</p>
          <p className="text-sm font-bold mt-1">คุณไม่มีสิทธิ์เข้าถึงหน้านี้</p>
        </div>
      </div>
    );
  }

  const [tab, setTab] = useState<StaffAttendanceTab>('team');
  const [mobileTabMenuOpen, setMobileTabMenuOpen] = useState(false);

  useEffect(() => {
    setMobileTabMenuOpen(false);
  }, [tab]);

  useEffect(() => {
    if (!mobileTabMenuOpen) return;
    const close = () => setMobileTabMenuOpen(false);
    window.addEventListener('scroll', close, true);
    return () => window.removeEventListener('scroll', close, true);
  }, [mobileTabMenuOpen]);

  const tabs = (Object.entries(STAFF_ATTENDANCE_TAB_CONFIG) as [StaffAttendanceTab, typeof STAFF_ATTENDANCE_TAB_CONFIG[StaffAttendanceTab]][]);
  const activeTabConfig = STAFF_ATTENDANCE_TAB_CONFIG[tab];
  const ActiveTabIcon = activeTabConfig.icon;

  return (
    <div className="flex flex-col min-h-screen">
      <div className="mx-auto flex w-full max-w-none flex-col gap-5 pb-28 pt-4">
        {/* Header Portal for Tabs */}
        {tabs.length > 1 && (
          <>
            {portalTarget && createPortal(
              <div className="flex items-center bg-white/60 backdrop-blur-xl border border-white p-1 rounded-full shadow-[0_8px_32px_rgba(0,0,0,0.04)] pointer-events-auto">
                {tabs.map(([key, cfg]) => {
                  const isActive = tab === key;
                  return (
                    <button
                      key={key}
                      onClick={() => setTab(key)}
                      className={`h-8 px-4 rounded-full text-[11px] font-bold transition-all whitespace-nowrap flex items-center ${
                        isActive
                          ? 'bg-blue-600 text-white border border-blue-700'
                          : 'text-black/45 hover:bg-black/5'
                      }`}
                    >
                      <span>{cfg.label}</span>
                    </button>
                  );
                })}
              </div>,
              portalTarget
            )}
            {mobilePortalTarget && createPortal(
              <div className="lg:hidden pointer-events-auto relative flex items-center justify-center min-w-0 max-w-[calc(100vw-112px)]">
                <button
                  type="button"
                  onClick={() => setMobileTabMenuOpen((open) => !open)}
                  className="flex min-w-0 items-center gap-1.5 text-slate-800 transition-colors hover:text-slate-600"
                  aria-label="เปิดเมนูแท็บ"
                  aria-expanded={mobileTabMenuOpen}
                >
                  <ActiveTabIcon className="h-3.5 w-3.5 shrink-0 text-slate-600" />
                  <span className="truncate text-[12px] font-black font-sukhumvit">
                    {activeTabConfig.label}
                  </span>
                  <HiChevronDown
                    className={`h-3.5 w-3.5 shrink-0 text-slate-500 transition-transform ${mobileTabMenuOpen ? 'rotate-180' : ''}`}
                  />
                </button>

                {mobileTabMenuOpen && (
                  <>
                    <button
                      type="button"
                      className="fixed inset-0 z-[90] bg-black/20"
                      aria-label="ปิดเมนูแท็บ"
                      onClick={() => setMobileTabMenuOpen(false)}
                    />
                    <div className="fixed left-1/2 top-14 z-[100] w-[min(280px,calc(100vw-2rem))] -translate-x-1/2 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl">
                      <p className="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 font-sukhumvit">
                        การเข้างาน
                      </p>
                      {tabs.map(([key, cfg]) => {
                        const Icon = cfg.icon;
                        const isActive = tab === key;
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => setTab(key)}
                            className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[13px] font-bold font-sukhumvit transition-colors ${
                              isActive
                                ? 'bg-blue-600 text-white'
                                : 'text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                            <span>{cfg.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>,
              mobilePortalTarget
            )}
          </>
        )}

        <AnimatePresence mode="wait">
          {tab === 'team' && (
            <motion.div key="team" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
              <AdminPanel />
            </motion.div>
          )}
          {tab === 'report' && (
            <motion.div key="report" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <AttendanceReportPanel />
            </motion.div>
          )}
          {tab === 'settings' && (
            <motion.div key="settings" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <AttendanceSettingsPanel />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
