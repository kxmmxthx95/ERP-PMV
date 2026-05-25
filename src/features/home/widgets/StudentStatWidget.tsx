import { motion } from 'framer-motion';
import { Baby, BookOpen, GraduationCap } from 'lucide-react';
import { WIDGET_GLASS } from '../widgetStyles';
import { useStudentSummary } from '@/hooks/useStudentSummary';
import { useActiveAcademicYear } from '@/hooks/useActiveAcademicYear';

const DEPT_CONFIG = [
  { id: 'early',     label: 'ปฐมวัย',    icon: Baby,          color: '#ec4899', bg: 'rgba(236,72,153,0.12)' },
  { id: 'primary',   label: 'ประถมศึกษา', icon: BookOpen,      color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
  { id: 'secondary', label: 'มัธยมศึกษา', icon: GraduationCap, color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)' },
] as const;

function Skeleton() {
  return (
    <div style={WIDGET_GLASS} className="rounded-3xl p-5 flex flex-col gap-4 w-full overflow-hidden">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-slate-100 animate-pulse" />
        <div className="flex flex-col gap-1.5">
          <div className="w-28 h-3 rounded-full bg-slate-100 animate-pulse" />
          <div className="w-20 h-2.5 rounded-full bg-slate-100 animate-pulse" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[0, 1, 2].map(i => (
          <div key={i} className="h-20 rounded-2xl bg-slate-100 animate-pulse" />
        ))}
      </div>
    </div>
  );
}

export default function StudentStatWidget() {
  const { year, activeSemester } = useActiveAcademicYear();
  const currentSemester = activeSemester === 1 || activeSemester === 2 ? activeSemester : undefined;
  const { total, early, primary, secondary, loading } = useStudentSummary(year ?? undefined, currentSemester);

  if (loading) return <Skeleton />;

  const counts: Record<string, number> = { early, primary, secondary };

  return (
    <div style={WIDGET_GLASS} className="rounded-3xl p-5 flex flex-col gap-4 w-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div>
          <p className="font-bold text-sm text-slate-700">สรุปจำนวนนักเรียน</p>
          <p className="text-[10px] text-slate-400">
            ทั้งหมด <span className="font-black text-slate-600">{total.toLocaleString()}</span> คน
            {year && <span className="ml-1">· ปีการศึกษา {year}</span>}
          </p>
        </div>
      </div>

      {/* Dept cards */}
      <div className="grid grid-cols-3 gap-2">
        {DEPT_CONFIG.map((dept, i) => {
          const Icon = dept.icon;
          const count = counts[dept.id] ?? 0;
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;

          return (
            <motion.div
              key={dept.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className="flex flex-col items-center gap-1.5 py-3 px-1 rounded-2xl"
              style={{ background: dept.bg }}
            >
              <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(255,255,255,0.6)' }}>
                <Icon size={15} style={{ color: dept.color }} strokeWidth={2.5} />
              </div>
              <span className="text-xl font-black leading-none" style={{ color: dept.color }}>
                {count.toLocaleString()}
              </span>
              <span className="text-[10px] font-bold text-slate-500 text-center leading-tight">
                {dept.label}
              </span>
              <span className="text-[9px] text-slate-400 font-semibold">{pct}%</span>
            </motion.div>
          );
        })}
      </div>

      {/* Progress bar */}
      {total > 0 && (
        <div className="flex rounded-full overflow-hidden h-1.5 gap-px">
          {DEPT_CONFIG.map(dept => {
            const pct = Math.round(((counts[dept.id] ?? 0) / total) * 100);
            return pct > 0 ? (
              <motion.div
                key={dept.id}
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
                style={{ width: `${pct}%`, background: dept.color, transformOrigin: 'left' }}
              />
            ) : null;
          })}
        </div>
      )}
    </div>
  );
}
