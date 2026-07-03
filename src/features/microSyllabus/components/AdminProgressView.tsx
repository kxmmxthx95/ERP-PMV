import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { MicroSyllabus } from '@/types/microSyllabus';
import { countTeachingPlanStats } from '../utils/teachingPlanCalendar';

interface Props {
  syllabi: MicroSyllabus[];
  onSelect?: (syllabus: MicroSyllabus) => void;
}

function progressColor(pct: number) {
  if (pct >= 80) return { bar: '#10b981', badge: 'text-emerald-600', badgeBg: 'bg-emerald-50' };
  if (pct >= 50) return { bar: '#f59e0b', badge: 'text-amber-600', badgeBg: 'bg-amber-50' };
  return { bar: '#6366f1', badge: 'text-indigo-600', badgeBg: 'bg-indigo-50' };
}

export default function AdminProgressView({ syllabi, onSelect }: Props) {
  const byGrade = useMemo(() => {
    const groups: Record<string, MicroSyllabus[]> = {};
    for (const s of syllabi) {
      const grade = s.gradeLevel || 'อื่นๆ';
      if (!groups[grade]) groups[grade] = [];
      groups[grade].push(s);
    }
    return Object.entries(groups).sort(([a], [b]) =>
      a.localeCompare(b, 'th'),
    );
  }, [syllabi]);

  if (syllabi.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
        <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center text-3xl">
          📊
        </div>
        <p className="font-black text-slate-700 font-sukhumvit">ยังไม่มีข้อมูลแผนการสอน</p>
        <p className="text-sm text-slate-400 font-sarabun">ครูผู้สอนกรอกข้อมูลจะแสดงที่นี่</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {byGrade.map(([grade, items], gi) => (
        <motion.section
          key={grade}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: gi * 0.06 }}
        >
          <div className="flex items-center gap-3 mb-4">
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest">
              {grade}
            </h3>
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-[10px] font-bold text-slate-400">{items.length} วิชา</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {[...items]
              .sort((a, b) => {
                const aStats = countTeachingPlanStats(a.topics);
                const bStats = countTeachingPlanStats(b.topics);
                const aPct = aStats.planned > 0 ? aStats.completed / aStats.planned : 0;
                const bPct = bStats.planned > 0 ? bStats.completed / bStats.planned : 0;
                return aPct - bPct;
              })
              .map((s, si) => {
                const { planned, completed } = countTeachingPlanStats(s.topics);
                const total = planned > 0 ? planned : s.totalWeeks;
                const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
                const { bar, badge, badgeBg } = progressColor(pct);

                return (
                  <motion.div
                    key={s.id}
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: gi * 0.06 + si * 0.03 }}
                    role={onSelect ? 'button' : undefined}
                    tabIndex={onSelect ? 0 : undefined}
                    onClick={onSelect ? () => onSelect(s) : undefined}
                    onKeyDown={onSelect ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSelect(s);
                      }
                    } : undefined}
                    className={cn(
                      'rounded-2xl p-4 bg-white border border-slate-200 shadow-sm',
                      onSelect && 'cursor-pointer hover:border-indigo-200 hover:shadow-md transition-all',
                    )}
                  >
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-black text-slate-800 leading-tight font-sukhumvit truncate">
                          {s.subjectName}
                        </p>
                        <p className="text-[11px] text-slate-400 font-sarabun mt-0.5 truncate">
                          {s.className} · {s.teacherName}
                        </p>
                      </div>
                      <div
                        className={cn(
                          'shrink-0 px-2.5 py-1 rounded-xl text-[12px] font-black',
                          badge,
                          badgeBg,
                        )}
                      >
                        {pct}%
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{
                            duration: 0.7,
                            ease: 'easeOut',
                            delay: gi * 0.06 + si * 0.03 + 0.15,
                          }}
                          className="h-full rounded-full"
                          style={{ background: bar }}
                        />
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 shrink-0 tabular-nums">
                        {completed}/{total}
                      </span>
                    </div>
                  </motion.div>
                );
              })}
          </div>
        </motion.section>
      ))}
    </div>
  );
}
