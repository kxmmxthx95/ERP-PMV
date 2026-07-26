import { useState, useEffect, useMemo } from 'react';
import type { DateRange } from 'react-day-picker';
import { motion } from 'framer-motion';
import { RefreshCw, SlidersHorizontal, List, LayoutGrid as Grid } from 'lucide-react';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useAttendanceMonthly, type StaffMonthlySummary } from '@/hooks/useAttendanceMonthly';
import { useLeaveRequestsSince } from '@/hooks/useLeaveRequests';
import { useTeachersCollection } from '@/hooks/useTeachersCollection';
import {
  buildTeacherPositionByUserId,
  isSpecialTeacherUser,
} from '@/lib/staffAttendance/specialTeacher';
import type { LeaveRequest } from '@/types/leave';
import { DEPARTMENT_CONFIG, type Department } from '@/types/curriculum';
import { percentScoreStyle } from '@/types/grades';
import { StaffCheckInHistoryModal } from './components/StaffCheckInHistoryModal';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';



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

function StaffSummaryCard({
  staff,
  onSelect,
}: {
  staff: StaffMonthlySummary;
  onSelect: (staff: StaffMonthlySummary) => void;
}) {
  const gc = percentScoreStyle(staff.attendanceRate);
  return (
    <button
      type="button"
      onClick={() => onSelect(staff)}
      className="w-full rounded-xl border border-slate-100 bg-white/80 px-3 py-2.5 text-left transition-colors hover:border-blue-200 hover:bg-blue-50/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100 text-sm font-black text-slate-500">
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
        <span
          className="shrink-0 text-[13px] font-black tabular-nums"
          style={{ color: gc.text }}
        >
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
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [useCustom, setUseCustom] = useState(false);
  const [deptFilter, setDeptFilter] = useState('all');
  const [historyStaff, setHistoryStaff] = useState<StaffMonthlySummary | null>(null);
  const [sortBy, setSortBy] = useState<'rate' | 'name'>('rate');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const { staffSummaries, loading, fetch } = useAttendanceMonthly();
  const { teachers } = useTeachersCollection();
  const teacherPositionByUserId = useMemo(
    () => buildTeacherPositionByUserId(teachers),
    [teachers],
  );

  const monthRange = useMemo(() => getMonthRange(monthOffset), [monthOffset]);

  const { from, to } = useCustom && dateRange?.from && dateRange?.to
    ? {
      from: format(dateRange.from, 'yyyy-MM-dd'),
      to: format(dateRange.to, 'yyyy-MM-dd'),
    }
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
    return [...list].sort((a, b) => {
      if (sortBy === 'rate') {
        return b.attendanceRate - a.attendanceRate;
      } else {
        return a.displayName.localeCompare(b.displayName, 'th');
      }
    });
  }, [staffSummaries, deptFilter, sortBy]);

  const departmentOptions = useMemo(() => {
    const depts: Department[] = ['early', 'primary', 'secondary'];
    return depts.map((value) => ({
      value,
      label: DEPARTMENT_CONFIG[value]?.label || value,
    }));
  }, []);

  const departmentChips = useMemo(
    () => [{ value: 'all', label: 'ทั้งหมด' }, ...departmentOptions],
    [departmentOptions],
  );

  const historyLeaveDates = useMemo(
    () => (historyStaff ? leaveMap.get(historyStaff.userId) ?? EMPTY_DATE_SET : EMPTY_DATE_SET),
    [historyStaff, leaveMap],
  );

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-transparent pb-4 font-sukhumvit">
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex h-full min-h-0 flex-col overflow-hidden lg:rounded-2xl lg:border lg:border-border lg:bg-card"
        >
          {/* ── Unified Controls + Summary (match team tab style) ── */}
          <div className="flex w-full flex-col gap-2 p-3.5 border-b border-slate-200/60 shrink-0">
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => { setMonthOffset(p => p - 1); setUseCustom(false); }}
                    className="w-8 h-8 rounded-lg border border-slate-100 flex items-center justify-center text-black/50 hover:bg-black/5"
                  >‹</button>
                  <div
                    className="px-3 h-8 flex items-center text-xs font-bold text-black/70 border border-slate-100 rounded-lg cursor-pointer hover:bg-black/5 min-w-[132px] justify-center bg-white/70"
                    onClick={() => { setMonthOffset(0); setUseCustom(false); setDateRange(undefined); }}
                  >
                    {useCustom && dateRange?.from && dateRange?.to 
                      ? `${format(dateRange.from, 'd MMM yyyy', { locale: th })} – ${format(dateRange.to, 'd MMM yyyy', { locale: th })}`
                      : monthRange.label}
                  </div>
                  <button
                    onClick={() => { setMonthOffset(p => p + 1); setUseCustom(false); }}
                    disabled={monthOffset >= 0}
                    className="w-8 h-8 rounded-lg border border-slate-100 flex items-center justify-center text-black/50 hover:bg-black/5 disabled:opacity-30"
                  >›</button>
                </div>

                <div className="flex items-center gap-1.5">
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="flex h-8 items-center gap-2 rounded-lg border border-slate-100 bg-white/70 px-3 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all focus:outline-none focus:ring-2 focus:ring-blue-200"
                      >
                        <SlidersHorizontal size={12} className="text-slate-400" />
                        <span>
                          {dateRange?.from ? (
                            dateRange.to ? (
                              <>
                                {format(dateRange.from, 'd MMM yyyy', { locale: th })} – {format(dateRange.to, 'd MMM yyyy', { locale: th })}
                              </>
                            ) : (
                              format(dateRange.from, 'd MMM yyyy', { locale: th })
                            )
                          ) : (
                            'กำหนดช่วงวันที่'
                          )}
                        </span>
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        initialFocus
                        mode="range"
                        selected={dateRange}
                        onSelect={(range) => {
                          setDateRange(range);
                          if (range?.from && range?.to) {
                            setUseCustom(true);
                          }
                        }}
                        numberOfMonths={1}
                      />
                    </PopoverContent>
                  </Popover>

                  {useCustom && (
                    <button
                      onClick={() => {
                        setUseCustom(false);
                        setDateRange(undefined);
                      }}
                      className="h-8 px-2 rounded-lg border border-slate-100 hover:bg-slate-50 text-slate-500 text-xs font-bold transition-all"
                    >
                      ล้าง
                    </button>
                  )}
                </div>
              </div>

              <button
                onClick={() => fetch(from, to, leaveMap, true)}
                className="hidden h-8 w-8 shrink-0 items-center justify-center self-end rounded-lg border border-slate-100 text-black/40 hover:bg-black/5 sm:self-auto lg:flex"
              >
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20 flex-1 min-h-0">
              <div className="w-8 h-8 border-3 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
            </div>
          ) : (
            <div className="flex-1 min-h-0 overflow-y-auto p-4">
              <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between border-b border-slate-100 pb-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <div className="flex h-8 w-full items-center rounded-lg bg-slate-100/80 p-0.5 border border-slate-200/20 gap-0.5">
                    {departmentChips.map((dept) => {
                      const active = deptFilter === dept.value;
                      return (
                        <button
                          key={dept.value}
                          type="button"
                          onClick={() => setDeptFilter(dept.value)}
                          className={cn(
                            "flex flex-1 h-7 items-center justify-center rounded-md text-[11px] font-bold transition-all",
                            active
                              ? "bg-white text-slate-800 shadow-xs"
                              : "text-slate-500 hover:text-slate-800"
                          )}
                        >
                          {dept.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Right controls: Sort by & View Mode */}
                <div className="hidden items-center gap-2 shrink-0 self-end lg:flex lg:self-auto">
                  {/* Sort By Toggle */}
                  <button
                    type="button"
                    onClick={() => setSortBy(prev => prev === 'rate' ? 'name' : 'rate')}
                    className="flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-bold text-slate-600 hover:bg-slate-50 transition-all shadow-xs"
                  >
                    <span>Sort by: {sortBy === 'rate' ? 'อัตราเข้างาน' : 'ชื่อ'}</span>
                    <SlidersHorizontal size={12} className="text-slate-400" />
                  </button>

                  {/* List / Grid Capsule Toggle */}
                  <div className="flex h-8 items-center rounded-lg bg-slate-100/80 p-0.5 border border-slate-200/20">
                    <button
                      type="button"
                      onClick={() => setViewMode('list')}
                      className={cn(
                        "flex h-7 items-center gap-1 rounded-md px-2.5 text-[11px] font-bold transition-all",
                        viewMode === 'list'
                          ? "bg-white text-slate-800 shadow-xs"
                          : "text-slate-500 hover:text-slate-800"
                      )}
                    >
                      <List size={12} />
                      <span>List</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('grid')}
                      className={cn(
                        "flex h-7 items-center gap-1 rounded-md px-2.5 text-[11px] font-bold transition-all",
                        viewMode === 'grid'
                          ? "bg-white text-slate-800 shadow-xs"
                          : "text-slate-500 hover:text-slate-800"
                      )}
                    >
                      <Grid size={12} />
                      <span>Grid</span>
                    </button>
                  </div>
                </div>
              </div>
              {filtered.length === 0 ? (
                <div className="flex min-h-[160px] items-center justify-center text-sm text-slate-400">
                  ไม่พบข้อมูลในช่วงวันที่ที่เลือก
                </div>
              ) : (
                <div className={cn(
                  "grid gap-2",
                  viewMode === 'grid'
                    ? "grid-cols-1 md:grid-cols-2 xl:grid-cols-3"
                    : "grid-cols-1"
                )}>
                  {filtered.map((staff) => (
                    <StaffSummaryCard
                      key={staff.userId}
                      staff={staff}
                      onSelect={setHistoryStaff}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </motion.div>
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
