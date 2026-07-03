import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useBehaviorRecords } from '@/hooks/useBehaviorScore';
import { formatThaiDateLabelFromIso } from '@/lib/dateUtils';
import { cn } from '@/lib/utils';
import { getDateRange, type BehaviorDashboardPeriod } from '../utils/behaviorDashboardStats';
import BehaviorPeriodFilter from './BehaviorPeriodFilter';

interface BehaviorReportPanelProps {
  academicYearId: string;
}

export default function BehaviorReportPanel({ academicYearId }: BehaviorReportPanelProps) {
  const [period, setPeriod] = useState<BehaviorDashboardPeriod>('day');
  const range = useMemo(() => getDateRange(period), [period]);
  const { records, loading } = useBehaviorRecords(academicYearId, range.from, range.to);

  const summary = useMemo(() => {
    const positive = records.filter((r) => r.type === 'positive');
    const negative = records.filter((r) => r.type === 'negative');
    const pointsDelta = records.reduce((sum, r) => sum + r.points, 0);
    return {
      total: records.length,
      positive: positive.length,
      negative: negative.length,
      pointsDelta,
    };
  }, [records]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-5"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-base font-black text-slate-800">รายงานพฤติกรรม</h2>
          <p className="text-sm font-black text-slate-600">{range.label}</p>
        </div>
        <BehaviorPeriodFilter period={period} onPeriodChange={setPeriod} />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'บันทึกทั้งหมด', value: summary.total, tone: 'text-slate-800' },
          { label: 'ความดี', value: summary.positive, tone: 'text-emerald-600' },
          { label: 'ผิดระเบียบ', value: summary.negative, tone: 'text-rose-600' },
          { label: 'ผลรวมคะแนน', value: `${summary.pointsDelta > 0 ? '+' : ''}${summary.pointsDelta}`, tone: summary.pointsDelta >= 0 ? 'text-emerald-600' : 'text-rose-600' },
        ].map((item) => (
          <div key={item.label} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <p className="text-[11px] font-bold text-slate-400">{item.label}</p>
            <p className={cn('mt-1 text-2xl font-black', item.tone)}>{item.value}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-slate-200 border-t-slate-500" />
        </div>
      ) : records.length === 0 ? (
        <p className="py-16 text-center text-sm font-bold text-slate-400">ไม่มีบันทึกในช่วงเวลานี้</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80">
                  {['วันที่', 'นักเรียน', 'ห้อง', 'รายการ', 'คะแนน', 'ผู้บันทึก'].map((col) => (
                    <th key={col} className="px-4 py-3 text-[11px] font-black uppercase tracking-wide text-slate-400">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr key={record.id} className="border-b border-slate-50 last:border-0">
                    <td className="px-4 py-3 text-xs font-bold text-slate-500 whitespace-nowrap">
                      {formatThaiDateLabelFromIso(record.date)}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-black text-slate-800">{record.studentName}</p>
                      <p className="text-[10px] font-bold text-slate-400">{record.studentCode}</p>
                    </td>
                    <td className="px-4 py-3 text-xs font-bold text-slate-600">{record.className}</td>
                    <td className="px-4 py-3 text-sm font-bold text-slate-700">{record.templateLabel}</td>
                    <td className={cn(
                      'px-4 py-3 text-sm font-black',
                      record.type === 'positive' ? 'text-emerald-600' : 'text-rose-600',
                    )}>
                      {record.points > 0 ? `+${record.points}` : record.points}
                    </td>
                    <td className="px-4 py-3 text-xs font-bold text-slate-500">{record.recordedByName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </motion.div>
  );
}
