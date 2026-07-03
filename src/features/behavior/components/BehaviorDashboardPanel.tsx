import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  HiOutlineUsers,
  HiOutlineChartBar,
  HiOutlineExclamationTriangle,
  HiOutlineHandThumbUp,
  HiOutlineHandThumbDown,
} from 'react-icons/hi2';
import { useBehaviorRecords, useBehaviorTotals } from '@/hooks/useBehaviorScore';
import { glassStyles } from '@/lib/designTokens';
import { cn } from '@/lib/utils';
import {
  computeBehaviorDashboardSummary,
  computeDepartmentStats,
  computeTopViolations,
  getDateRange,
  getPeriodScopeLabel,
  type BehaviorDashboardPeriod,
} from '../utils/behaviorDashboardStats';
import BehaviorPeriodFilter from './BehaviorPeriodFilter';

interface BehaviorDashboardPanelProps {
  academicYearId: string;
}

function StatCard({
  label,
  value,
  icon: Icon,
  tone = 'blue',
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  tone?: 'blue' | 'emerald' | 'rose' | 'amber' | 'violet';
}) {
  const tones = {
    blue: 'bg-blue-50 text-blue-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    rose: 'bg-rose-50 text-rose-600',
    amber: 'bg-amber-50 text-amber-600',
    violet: 'bg-violet-50 text-violet-600',
  };

  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm" style={glassStyles.card}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold text-slate-400">{label}</p>
          <p className="mt-1 text-2xl font-black text-slate-800">{value}</p>
        </div>
        <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl', tones[tone])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

export default function BehaviorDashboardPanel({ academicYearId }: BehaviorDashboardPanelProps) {
  const [period, setPeriod] = useState<BehaviorDashboardPeriod>('month');
  const range = useMemo(() => getDateRange(period), [period]);
  const scopeLabel = getPeriodScopeLabel(period);
  const { totals, loading: loadingTotals } = useBehaviorTotals(academicYearId);
  const { records, loading: loadingRecords } = useBehaviorRecords(
    academicYearId,
    range.from,
    range.to,
  );

  const summary = useMemo(
    () => computeBehaviorDashboardSummary(totals, records),
    [totals, records],
  );
  const deptStats = useMemo(() => computeDepartmentStats(totals), [totals]);
  const topViolations = useMemo(() => computeTopViolations(records), [records]);

  const loading = loadingTotals || loadingRecords;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-slate-200 border-t-slate-500" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-5"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-base font-black text-slate-800">สรุปพฤติกรรมภายในโรงเรียน</h2>
          <p className="text-sm font-black text-slate-600">{range.label}</p>
        </div>
        <BehaviorPeriodFilter period={period} onPeriodChange={setPeriod} />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="นักเรียนที่มีข้อมูล" value={summary.trackedStudents} icon={HiOutlineUsers} tone="blue" />
        <StatCard label="คะแนนเฉลี่ย" value={summary.avgScore} icon={HiOutlineChartBar} tone="violet" />
        <StatCard label="ต่ำกว่าเกณฑ์ (100)" value={summary.belowBaseline} icon={HiOutlineExclamationTriangle} tone="amber" />
        <StatCard label={`บันทึก${scopeLabel}`} value={summary.totalRecords} icon={HiOutlineChartBar} tone="blue" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <StatCard label={`ความดี (${scopeLabel})`} value={summary.totalPositive} icon={HiOutlineHandThumbUp} tone="emerald" />
        <StatCard label={`ผิดระเบียบ (${scopeLabel})`} value={summary.totalNegative} icon={HiOutlineHandThumbDown} tone="rose" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm sm:p-5" style={glassStyles.card}>
          <h3 className="text-sm font-black text-slate-800">แยกตามแผนก</h3>
          <p className="mb-4 mt-0.5 text-[11px] font-medium text-slate-400">คะแนนเฉลี่ยและจำนวนที่ต่ำกว่าเกณฑ์</p>
          {deptStats.length === 0 ? (
            <p className="py-8 text-center text-sm font-bold text-slate-400">ยังไม่มีข้อมูล</p>
          ) : (
            <div className="space-y-3">
              {deptStats.map((dept) => (
                <div key={dept.departmentId} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                  <div>
                    <p className="text-sm font-black text-slate-800">{dept.label}</p>
                    <p className="text-[11px] font-bold text-slate-400">{dept.studentCount} คน</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-slate-800">{dept.avgScore}</p>
                    <p className="text-[11px] font-bold text-rose-500">ต่ำกว่าเกณฑ์ {dept.belowBaseline}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm sm:p-5" style={glassStyles.card}>
          <h3 className="text-sm font-black text-slate-800">พฤติกรรมที่พบบ่อย</h3>
          <p className="mb-4 mt-0.5 text-[11px] font-medium text-slate-400">รายการผิดระเบียบยอดนิยม{scopeLabel}</p>
          {topViolations.length === 0 ? (
            <p className="py-8 text-center text-sm font-bold text-slate-400">ยังไม่มีรายการ</p>
          ) : (
            <div className="space-y-2">
              {topViolations.map((item, index) => (
                <div key={item.label} className="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-xs font-black text-rose-600">
                      {index + 1}
                    </span>
                    <p className="truncate text-sm font-bold text-slate-700">{item.label}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-black text-slate-800">{item.count} ครั้ง</p>
                    <p className="text-[11px] font-bold text-rose-500">{item.points} คะแนน</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </motion.div>
  );
}
