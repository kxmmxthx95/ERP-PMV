import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { RefreshCw } from 'lucide-react';
import { useAttendanceMonthly, type StaffMonthlySummary } from '@/hooks/useAttendanceMonthly';
import { useLeaveRequestsSince } from '@/hooks/useLeaveRequests';
import { useTeachersCollection } from '@/hooks/useTeachersCollection';
import {
  buildTeacherPositionByUserId,
  isSpecialTeacherUser,
} from '@/lib/staffAttendance/specialTeacher';
import type { LeaveRequest } from '@/types/leave';
import { DEPARTMENT_CONFIG, type Department } from '@/types/curriculum';
import { StaffCheckInHistoryModal } from './components/StaffCheckInHistoryModal';

// ── Helpers ───────────────────────────────────────────────────────────────────
const GLASS: React.CSSProperties = {
  background: 'rgba(255,255,255,0.72)',
  backdropFilter: 'blur(24px) saturate(150%)',
  WebkitBackdropFilter: 'blur(24px) saturate(150%)',
  border: '1px solid rgba(255,255,255,0.90)',
  boxShadow: '0 8px 32px rgba(0,0,0,0.06)',
};

function getMonthRange(offset = 0): { from: string; to: string; label: string } {
  const d = new Date();
  d.setMonth(d.getMonth() + offset);
  const y = d.getFullYear();
  const m = d.getMonth();
  const from = `${y}-${String(m + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(y, m + 1, 0).getDate();
  const to = `${y}-${String(m + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  const label = d.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });
  return { from, to, label };
}

function deptLabel(department?: string) {
  if (!department) return '-';
  return DEPARTMENT_CONFIG[department as Department]?.label || department;
}

function rateTone(rate: number) {
  if (rate >= 100) return 'text-emerald-700 bg-emerald-50 border-emerald-100';
  if (rate < 75) return 'text-rose-700 bg-rose-50 border-rose-100';
  return 'text-slate-700 bg-slate-50 border-slate-100';
}

function StaffSummaryCard({
  staff,
  onSelect,
}: {
  staff: StaffMonthlySummary;
  onSelect: (staff: StaffMonthlySummary) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(staff)}
      className="w-full rounded-2xl border border-slate-100 bg-white/80 px-3 py-2.5 text-left transition-colors hover:border-blue-200 hover:bg-blue-50/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100 text-sm font-black text-slate-500">
          {staff.photoURL ? (
            <img src={staff.photoURL} alt={staff.displayName} className="h-full w-full object-cover" />
          ) : (
            staff.displayName.charAt(0)
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-black text-slate-800">{staff.displayName}</p>
          <p className="mt-0.5 truncate text-[10px] font-bold text-slate-400">{deptLabel(staff.department)}</p>
        </div>
        <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-black ${rateTone(staff.attendanceRate)}`}>
          {staff.attendanceRate}%
        </span>
      </div>
    </button>
  );
}

const EMPTY_DATE_SET = new Set<string>();

// ── Main Component ─────────────────────────────────────────────────────────────
export default function AttendanceReportPanel() {
  const [monthOffset, setMonthOffset] = useState(0);
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [useCustom, setUseCustom] = useState(false);
  const [deptFilter, setDeptFilter] = useState('all');
  const [historyStaff, setHistoryStaff] = useState<StaffMonthlySummary | null>(null);

  const { staffSummaries, loading, fetch } = useAttendanceMonthly();
  const { teachers } = useTeachersCollection();
  const teacherPositionByUserId = useMemo(
    () => buildTeacherPositionByUserId(teachers),
    [teachers],
  );

  const monthRange = useMemo(() => getMonthRange(monthOffset), [monthOffset]);

  const { from, to } = useCustom && customFrom && customTo
    ? { from: customFrom, to: customTo }
    : monthRange;

  const { requests: leaveRequests } = useLeaveRequestsSince(from);

  // Build leaveMap: userId → Set<date>
  const leaveMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    (leaveRequests as LeaveRequest[])
      .filter(r => r.status === 'approved')
      .forEach(r => {
        const cur = new Date(`${r.startDate}T12:00:00`);
        const end = new Date(`${r.endDate}T12:00:00`);
        while (cur <= end) {
          const d = cur.toISOString().slice(0, 10);
          if (!map.has(r.requesterId)) map.set(r.requesterId, new Set());
          map.get(r.requesterId)!.add(d);
          cur.setDate(cur.getDate() + 1);
        }
      });
    return map;
  }, [leaveRequests]);

  useEffect(() => {
    void fetch(from, to, leaveMap);
  }, [from, to, leaveMap, fetch]);

  // Filter + sort summaries
  const filtered = useMemo(() => {
    let list = staffSummaries;
    if (deptFilter !== 'all') list = list.filter(s => s.department === deptFilter);
    return [...list].sort((a, b) => b.attendanceRate - a.attendanceRate);
  }, [staffSummaries, deptFilter]);

  const departmentOptions = useMemo(() => {
    const uniqueDepartments = Array.from(
      new Set(staffSummaries.map((r) => r.department).filter((dept): dept is string => !!dept)),
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
  }, [staffSummaries]);

  const departmentChips = useMemo(
    () => [{ value: 'all', label: 'ทั้งหมด' }, ...departmentOptions],
    [departmentOptions],
  );

  const historyLeaveDates = useMemo(
    () => (historyStaff ? leaveMap.get(historyStaff.userId) ?? EMPTY_DATE_SET : EMPTY_DATE_SET),
    [historyStaff, leaveMap],
  );

  return (
    <div className="-mx-1.5 flex h-full w-[calc(100%+0.75rem)] flex-col overflow-hidden bg-transparent pb-4 font-sukhumvit sm:-mx-2 sm:w-[calc(100%+1rem)]">
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex h-full min-h-0 flex-col gap-3">
      {/* ── Unified Controls + Summary (match team tab style) ── */}
      <motion.div
        initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        style={GLASS} className="flex w-full flex-col gap-2 rounded-2xl p-3"
      >
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <div className="flex items-center gap-1">
              <button
                onClick={() => { setMonthOffset(p => p - 1); setUseCustom(false); }}
                className="w-8 h-8 rounded-lg border border-slate-100 flex items-center justify-center text-black/50 hover:bg-black/5"
              >‹</button>
              <div
                className="px-3 h-8 flex items-center text-xs font-bold text-black/70 border border-slate-100 rounded-lg cursor-pointer hover:bg-black/5 min-w-[132px] justify-center bg-white/70"
                onClick={() => { setMonthOffset(0); setUseCustom(false); }}
              >
                {useCustom ? `${customFrom} – ${customTo}` : monthRange.label}
              </div>
              <button
                onClick={() => { setMonthOffset(p => p + 1); setUseCustom(false); }}
                disabled={monthOffset >= 0}
                className="w-8 h-8 rounded-lg border border-slate-100 flex items-center justify-center text-black/50 hover:bg-black/5 disabled:opacity-30"
              >›</button>
            </div>

            <div className="flex items-center gap-1.5">
              <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                className="h-8 rounded-lg border border-slate-100 px-2 text-xs bg-white/70 focus:outline-none focus:ring-2 focus:ring-blue-200" />
              <span className="text-black/30 text-xs">—</span>
              <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                className="h-8 rounded-lg border border-slate-100 px-2 text-xs bg-white/70 focus:outline-none focus:ring-2 focus:ring-blue-200" />
              <button
                disabled={!customFrom || !customTo}
                onClick={() => setUseCustom(true)}
                className="h-8 px-3 rounded-lg bg-blue-500 text-white text-xs font-bold disabled:opacity-30 hover:bg-blue-600"
              >ค้นหา</button>
            </div>
          </div>

          <button
            onClick={() => fetch(from, to, leaveMap, true)}
            className="flex h-8 w-8 shrink-0 items-center justify-center self-end rounded-lg border border-slate-100 text-black/40 hover:bg-black/5 sm:self-auto"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </motion.div>

      {loading ? (
        <div className="flex items-center justify-center py-20 flex-1 min-h-0">
          <div className="w-8 h-8 border-3 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            style={GLASS}
            className="w-full rounded-2xl p-4"
          >
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-bold text-black/70">รายชื่อบุคลากร</p>
              <div className="flex flex-wrap items-center gap-1.5">
                {departmentChips.map((dept) => {
                  const active = deptFilter === dept.value;
                  const config = dept.value !== 'all' ? DEPARTMENT_CONFIG[dept.value as Department] : null;
                  return (
                    <button
                      key={dept.value}
                      type="button"
                      onClick={() => setDeptFilter(dept.value)}
                      className={`rounded-full border px-3 py-1 text-[11px] font-bold transition-colors ${
                        active
                          ? 'border-blue-500 bg-blue-500 text-white'
                          : 'border-slate-200 bg-white/80 text-slate-600 hover:bg-slate-50'
                      }`}
                      style={!active && config ? { borderColor: config.border, color: config.color } : undefined}
                    >
                      {dept.label}
                    </button>
                  );
                })}
              </div>
            </div>
            {filtered.length === 0 ? (
              <div className="flex min-h-[160px] items-center justify-center text-sm text-slate-400">
                ไม่พบข้อมูลในช่วงวันที่ที่เลือก
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
                {filtered.map((staff) => (
                  <StaffSummaryCard
                    key={staff.userId}
                    staff={staff}
                    onSelect={setHistoryStaff}
                  />
                ))}
              </div>
            )}
          </motion.div>
        </div>
      )}
        </div>
      </div>

      <StaffCheckInHistoryModal
        staff={historyStaff}
        from={from}
        to={to}
        leaveDates={historyLeaveDates}
        isSpecialTeacher={
          historyStaff
            ? isSpecialTeacherUser(historyStaff.userId, teacherPositionByUserId)
            : false
        }
        onClose={() => setHistoryStaff(null)}
      />
    </div>
  );
}
