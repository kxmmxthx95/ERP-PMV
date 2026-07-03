import { motion } from 'framer-motion';
import { WIDGET_CARD, WIDGET_GLASS, WIDGET_STAT_CELL, WIDGET_STAT_LABEL, WIDGET_STAT_VALUE } from '../widgetStyles';
import { WidgetSkeleton } from '../components/WidgetSkeleton';
import { useStudentSummary } from '@/hooks/useStudentSummary';
import { useActiveAcademicYear } from '@/hooks/useActiveAcademicYear';

const DEPT_CONFIG = [
  { id: 'early',     label: 'ปฐมวัย',     color: 'text-pink-500',   valueColor: 'text-pink-500',   bg: 'rgba(236,72,153,0.12)' },
  { id: 'primary',   label: 'ประถม',      color: 'text-blue-500',   valueColor: 'text-blue-500',   bg: 'rgba(59,130,246,0.12)' },
  { id: 'secondary', label: 'มัธยม',      color: 'text-violet-500', valueColor: 'text-violet-500', bg: 'rgba(139,92,246,0.12)' },
] as const;

export default function StudentStatWidget() {
  const { year } = useActiveAcademicYear();
  const { total, early, primary, secondary, loading } = useStudentSummary(year ?? undefined, {
    includeMasterStudents: false,
  });

  if (loading) return <WidgetSkeleton />;

  const counts: Record<string, number> = { early, primary, secondary };

  return (
    <div style={WIDGET_GLASS} className={WIDGET_CARD}>
      <div className="shrink-0 min-w-0">
        <p className="font-bold text-sm text-slate-700 truncate">สรุปจำนวนนักเรียน</p>
        <p className="text-[10px] text-slate-400 truncate">
          ทั้งหมด <span className="font-black text-slate-600">{total.toLocaleString()}</span> คน
          {year ? ` · ปี ${year}` : ''}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2 flex-1 min-h-0">
        {DEPT_CONFIG.map((dept, i) => {
          const count = counts[dept.id] ?? 0;
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;

          return (
            <motion.div
              key={dept.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className={WIDGET_STAT_CELL}
              style={{ background: dept.bg }}
            >
              <span className={`${WIDGET_STAT_VALUE} ${dept.valueColor}`}>
                {count.toLocaleString()}
              </span>
              <span className={`${WIDGET_STAT_LABEL} font-semibold ${dept.color}`}>{dept.label}</span>
              <span className="text-[9px] text-slate-400">{pct}%</span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
