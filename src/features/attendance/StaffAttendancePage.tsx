import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapPin, Clock, UserCheck, LogOut, AlertCircle,
  Download, Users, Check, X, AlertTriangle, RotateCcw, Settings,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/hooks/useAuth';
import {
  useStaffAttendance,
  useAdminStaffAttendance,
  type StaffAttendanceRecord,
  type AttendanceStatus,
} from '@/hooks/useStaffAttendance';
import { useAllLeaveRequests } from '@/hooks/useLeaveRequests';
import type { LeaveRequest, LeaveStatus, LeaveType } from '@/types/leave';
import { useAttendanceConfig } from '@/hooks/useAttendanceConfig';
import { useAcademicCalendar } from '@/hooks/useAcademicCalendar';
import { useThaiHolidays } from '@/features/calendar/hooks/useThaiHolidays';
import { WIDGET_GLASS } from '@/features/home/widgetStyles';
import AttendanceSettingsPanel from './AttendanceSettingsPanel';
import AttendanceReportPanel from './AttendanceReportPanel';
import { DEPARTMENT_CONFIG, type Department } from '@/types/curriculum';

// ── Helpers ───────────────────────────────────────────────────────────────────
type MaybeTimestamp = { toDate: () => Date } | Date | string | number | null | undefined;
function fmt(ts: MaybeTimestamp, withDate = false): string {
  if (!ts) return '—';
  const d = typeof ts === 'object' && 'toDate' in ts ? ts.toDate() : new Date(ts);
  if (withDate) return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
  return d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
}

const STATUS_CONFIG: Record<AttendanceStatus, { label: string; bg: string; text: string; icon: LucideIcon }> = {
  present: { label: 'มาตรงเวลา', bg: 'bg-emerald-100', text: 'text-emerald-700', icon: Check },
  late: { label: 'มาสาย', bg: 'bg-amber-100', text: 'text-amber-700', icon: AlertTriangle },
  absent: { label: 'ขาดงาน', bg: 'bg-red-100', text: 'text-red-700', icon: X },
};

function StatusBadge({ status }: { status: AttendanceStatus }) {
  const c = STATUS_CONFIG[status];
  const Icon = c.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${c.bg} ${c.text}`}>
      <Icon size={11} />
      {c.label}
    </span>
  );
}

const LEAVE_STATUS_CONFIG: Record<LeaveStatus, { label: string; bg: string; text: string }> = {
  pending: { label: 'รอพิจารณา', bg: 'bg-amber-100', text: 'text-amber-700' },
  approved: { label: 'ลา', bg: 'bg-violet-100', text: 'text-violet-700' },
  rejected: { label: 'ไม่อนุมัติ', bg: 'bg-rose-100', text: 'text-rose-700' },
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

type StaffUserDoc = {
  id: string;
  role?: string;
  name?: string;
  displayName?: string;
  email?: string;
  photoURL?: string;
  department?: string;
  departmentId?: string;
};

// ── Live Clock ────────────────────────────────────────────────────────────────
function LiveClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="font-mono text-4xl font-black text-slate-800 tabular-nums">
      {time.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
    </span>
  );
}

// ── Staff Check-In Panel ──────────────────────────────────────────────────────
function StaffPanel() {
  const { user, userData } = useAuth();
  const uid = user?.uid ?? '';
  const name = userData?.name || user?.displayName || user?.email || 'บุคลากร';
  const { config } = useAttendanceConfig();
  const { todayRecord, history, loading, actionLoading, error, checkIn, checkOut } = useStaffAttendance(uid, name, config);

  const checked = !!todayRecord?.checkInTime || !!todayRecord?.overrideBy;
  const checkedOut = !!todayRecord?.checkOutTime;

  return (
    <div className="flex flex-col gap-5">
      {/* Hero check-in card */}
      <div
        style={WIDGET_GLASS}
        className="rounded-3xl p-6 flex flex-col gap-5"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium">สวัสดี,</p>
            <p className="font-bold text-slate-700">{name}</p>
          </div>
          {todayRecord && <StatusBadge status={todayRecord.status} />}
        </div>

        {/* Clock */}
        <div className="text-center py-2">
          <LiveClock />
          <p className="text-xs text-slate-400 mt-1">
            {new Date().toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>

        {/* Times */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-blue-50 p-3 text-center">
            <p className="text-xs text-blue-400 mb-0.5">เวลาเข้า</p>
            <p className="font-bold text-blue-700">{fmt(todayRecord?.checkInTime)}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-3 text-center">
            <p className="text-xs text-slate-400 mb-0.5">เวลาออก</p>
            <p className="font-bold text-slate-700">{fmt(todayRecord?.checkOutTime)}</p>
          </div>
        </div>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-start gap-2 rounded-xl bg-red-50 border border-red-100 p-3 text-xs text-red-600"
            >
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Button */}
        {loading ? (
          <div className="w-full py-4 flex justify-center">
            <div className="w-6 h-6 border-3 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
          </div>
        ) : !checked ? (
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={checkIn}
            disabled={actionLoading}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-200 disabled:opacity-60"
          >
            {actionLoading
              ? <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              : <><MapPin size={18} /> เช็คอิน</>}
          </motion.button>
        ) : !checkedOut ? (
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={checkOut}
            disabled={actionLoading}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-slate-500 to-slate-700 text-white font-bold flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {actionLoading
              ? <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              : <><LogOut size={18} /> เช็คเอาต์</>}
          </motion.button>
        ) : (
          <div className="w-full py-4 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-600 font-bold flex items-center justify-center gap-2">
            <UserCheck size={18} /> บันทึกครบแล้ววันนี้
          </div>
        )}
      </div>

      {/* 7-day history */}
      <div style={WIDGET_GLASS} className="rounded-3xl p-5 flex flex-col gap-3">
        <p className="font-bold text-sm text-slate-700">ประวัติ 7 วันล่าสุด</p>
        {history.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-4">ไม่มีข้อมูล</p>
        ) : (
          <div className="flex flex-col gap-2">
            {history.map(r => (
              <div key={r.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                <div>
                  <p className="text-xs font-semibold text-slate-700">
                    {new Date(r.date).toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short' })}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    <Clock size={10} className="inline mr-0.5" />
                    {fmt(r.checkInTime)} — {fmt(r.checkOutTime)}
                  </p>
                </div>
                <StatusBadge status={r.status} />
              </div>
            ))}
          </div>
        )}
      </div>
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
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [filter, setFilter] = useState<'all' | 'late' | 'absent' | 'leave'>('all');
  const [overrideTarget, setOverrideTarget] = useState<StaffAttendanceRecord | null | undefined>(undefined);
  const { records, loading, refresh, override } = useAdminStaffAttendance(selectedDate);
  const { requests: leaveRequests } = useAllLeaveRequests();
  const selectedYear = Number(selectedDate.slice(0, 4));
  const { holidays: thaiHolidays } = useThaiHolidays(selectedYear);
  const { events: calendarEvents } = useAcademicCalendar(role ?? undefined, thaiHolidays);
  const [staffDirectory, setStaffDirectory] = useState<StaffDirectoryItem[]>([]);
  const staffUserIds = useMemo(() => new Set(staffDirectory.map(s => s.userId)), [staffDirectory]);

  useEffect(() => {
    let cancelled = false;
    const fetchStaffDirectory = async () => {
      const snap = await getDocs(collection(db, 'users'));
      if (cancelled) return;
      const staffUsers = snap.docs
        .map((d): StaffUserDoc => {
          const payload = d.data() as Partial<Omit<StaffUserDoc, 'id'>>;
          return { id: d.id, ...payload };
        })
        .filter(u => {
          const role = typeof u.role === 'string' ? u.role : '';
          return role === 'teacher';
        })
        .map(u => ({
          userId: String(u.id),
          displayName: String(u.name ?? u.displayName ?? u.email ?? 'บุคลากร'),
          photoURL: typeof u.photoURL === 'string' ? u.photoURL : undefined,
          department: typeof u.department === 'string'
            ? u.department
            : (typeof u.departmentId === 'string' ? u.departmentId : undefined),
        }));
      setStaffDirectory(staffUsers);
    };
    fetchStaffDirectory().catch(() => setStaffDirectory([]));
    return () => { cancelled = true; };
  }, []);

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
    const todayStr = now.toISOString().slice(0, 10);
    const isPastDate = selectedDate < todayStr;
    const isFutureDate = selectedDate > todayStr;
    const isTodayAfterNoon = selectedDate === todayStr && now.getHours() >= 12;
    const shouldMarkAbsent = isWorkingDay && (isPastDate || isTodayAfterNoon);

    return staffDirectory.map(staff => {
      const record = recordMap.get(staff.userId);
      if (record) return { ...record, isLeave: false, isAutoAbsent: false };

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
        status: isFutureDate ? 'present' : 'absent',
        note: shouldMarkAbsent ? 'ไม่มีการเช็กอินหลัง 12:00 และไม่มีการลา' : '',
        photoURL: staff.photoURL,
        department: staff.department,
        isLeave: false,
        isAutoAbsent: shouldMarkAbsent,
        isPending: isFutureDate,
      };
    });
  }, [staffDirectory, records, leaveRequests, staffUserIds, selectedDate, isWorkingDay]);

  const filtered = allRows.filter(r => {
    if (r.isPending) return filter === 'all';
    if (filter === 'all') return true;
    if (filter === 'leave') return !!r.isLeave;
    if (r.isLeave) return false;
    return r.status === filter;
  });

  const summary = {
    present: allRows.filter(r => !r.isLeave && !r.isPending && r.status === 'present').length,
    late: allRows.filter(r => !r.isLeave && !r.isPending && r.status === 'late').length,
    absent: allRows.filter(r => !r.isLeave && !r.isPending && r.status === 'absent').length,
    leave: allRows.filter(r => r.isLeave && !r.isPending).length,
  };

  const exportCSV = () => {
    const header = ['ชื่อ', 'วันที่', 'เวลาเข้า', 'เวลาออก', 'สถานะ', 'หมายเหตุ'];
    const rows = allRows.map(r => [
      r.displayName,
      r.date,
      fmt(r.checkInTime),
      fmt(r.checkOutTime),
      r.isLeave ? 'ลา' : (STATUS_CONFIG[r.status]?.label ?? r.status),
      r.isLeave
        ? `${LEAVE_TYPE_LABEL[r.leaveType as LeaveType] ?? 'ลา'}: ${r.note ?? ''}`.trim()
        : (r.note ?? ''),
    ]);
    const csv = [header, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `staff-attendance-${selectedDate}.csv`;
    a.click();
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Summary cards */}
      {isWorkingDay && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            { label: 'มาตรงเวลา', value: summary.present, bg: 'bg-emerald-50', text: 'text-emerald-700' },
            { label: 'มาสาย', value: summary.late, bg: 'bg-amber-50', text: 'text-amber-700' },
            { label: 'ขาดงาน', value: summary.absent, bg: 'bg-red-50', text: 'text-red-700' },
            { label: 'ลา', value: summary.leave, bg: 'bg-violet-50', text: 'text-violet-700' },
          ].map(c => (
            <div key={c.label} style={WIDGET_GLASS} className={`rounded-2xl p-3 text-center ${c.bg}`}>
              <p className={`text-2xl font-black ${c.text}`}>{c.value}</p>
              <p className={`text-xs font-medium ${c.text}`}>{c.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Controls */}
      <div style={WIDGET_GLASS} className="rounded-3xl p-4 flex flex-col gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm flex-1 min-w-0 focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
          <button
            onClick={refresh}
            className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50"
          >
            <RotateCcw size={16} />
          </button>
          <button
            onClick={exportCSV}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-50 text-blue-600 text-sm font-semibold hover:bg-blue-100"
          >
            <Download size={15} />
            ส่งออก CSV
          </button>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2">
            {[
              { key: 'all' as const, label: 'ทั้งหมด' },
              { key: 'late' as const, label: 'มาสาย' },
              { key: 'absent' as const, label: 'ยังไม่เข้า' },
              { key: 'leave' as const, label: 'ลา' },
            ].map(t => (
              <button
                key={t.key}
              onClick={() => setFilter(t.key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${filter === t.key ? 'bg-blue-500 text-white shadow-sm' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {!isWorkingDay ? (
        <div style={WIDGET_GLASS} className="rounded-3xl p-10 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 rounded-full bg-amber-50 text-amber-500 flex items-center justify-center mb-4">
            <AlertCircle size={32} />
          </div>
          <p className="font-bold text-slate-700 text-lg">วันนี้เป็นวันหยุด</p>
          <p className="text-sm text-slate-500 mt-1">{holidayName}</p>
        </div>
      ) : (
        <div style={WIDGET_GLASS} className="rounded-3xl overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
            <Users size={15} className="text-slate-400" />
            <span className="font-bold text-sm text-slate-700">รายการบุคลากร</span>
            <span className="ml-auto text-xs text-slate-400">{filtered.length} คน</span>
          </div>

          {loading ? (
            <div className="flex justify-center py-10">
              <div className="w-6 h-6 border-3 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-sm text-slate-400 py-10">ไม่มีข้อมูล</p>
          ) : (
            <ScrollArea className="max-h-[60vh] w-full">
              <div className="divide-y divide-slate-100">
                {filtered.map(r => (
                  <div key={r.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white text-xs font-bold shrink-0 overflow-hidden shadow-sm">
                      {r.photoURL ? (
                        <img src={r.photoURL} alt={r.displayName} className="w-full h-full object-cover" />
                      ) : (
                        r.displayName.charAt(0)
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold text-sm text-slate-700 truncate">{r.displayName}</p>
                        {r.department && (
                          <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-400 uppercase">
                            {(DEPARTMENT_CONFIG[r.department as Department]?.label || r.department)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        {r.isLeave ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-black uppercase tracking-tighter text-violet-500">ลา</span>
                            <span className="rounded-md bg-violet-50/70 px-1.5 py-0.5 text-[11px] font-bold text-violet-700">
                              {LEAVE_TYPE_LABEL[r.leaveType as LeaveType]}
                            </span>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-black text-blue-400 uppercase tracking-tighter">เข้า</span>
                              <span className="text-[11px] font-bold text-slate-600 bg-blue-50/50 px-1.5 py-0.5 rounded-md">
                                {fmt(r.checkInTime)}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">ออก</span>
                              <span className="text-[11px] font-bold text-slate-500 bg-slate-50/50 px-1.5 py-0.5 rounded-md">
                                {fmt(r.checkOutTime)}
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {r.isPending ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-400">
                          ยังไม่ถึงวัน
                        </span>
                      ) : r.isLeave ? (
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${LEAVE_STATUS_CONFIG[r.leaveStatus as LeaveStatus].bg} ${LEAVE_STATUS_CONFIG[r.leaveStatus as LeaveStatus].text}`}>
                          {LEAVE_STATUS_CONFIG[r.leaveStatus as LeaveStatus].label}
                        </span>
                      ) : (
                        <>
                          <StatusBadge status={r.status} />
                          {r.isAutoAbsent && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-600">
                              Auto 12:00
                            </span>
                          )}
                          <button
                            onClick={() => setOverrideTarget(r)}
                            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"
                            title="Override"
                          >
                            <RotateCcw size={13} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
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
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function StaffAttendancePage() {
  const { role } = useAuth();

  // ── Access Control ──
  if (role === 'student' || role === 'parent') {
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

  const isAdmin = role === 'admin' || role === 'sysadmin';
  const [tab, setTab] = useState<'checkin' | 'team' | 'report' | 'settings'>(isAdmin ? 'team' : 'checkin');

  const tabs = isAdmin
    ? [
      { key: 'team' as const, label: 'ภาพรวมทีม' },
      { key: 'report' as const, label: 'รายงาน' },
      { key: 'settings' as const, label: <Settings size={13} /> },
    ]
    : [];

  return (
    <div className="flex flex-col min-h-screen">
      <div className="max-w-[1600px] mx-auto w-full flex flex-col gap-5 pb-28 pt-4 px-6">
        {/* Header Portal for Tabs */}
        {tabs.length > 1 && typeof document !== 'undefined' && document.getElementById('header-portal-center') && createPortal(
          <div className="flex items-center bg-white/60 backdrop-blur-xl border border-white p-1 rounded-full shadow-[0_8px_32px_rgba(0,0,0,0.04)] pointer-events-auto">
            {tabs.map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-6 py-1.5 rounded-full text-[11px] font-black transition-all whitespace-nowrap ${tab === t.key
                  ? 'bg-slate-900 text-white shadow-md'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-black/5'
                  }`}
              >
                {t.label}
              </button>
            ))}
          </div>,
          document.getElementById('header-portal-center')!
        )}

        <AnimatePresence mode="wait">
          {tab === 'checkin' && (
            <motion.div key="checkin" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}>
              <StaffPanel />
            </motion.div>
          )}
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
