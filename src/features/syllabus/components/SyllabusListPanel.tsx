import { useState } from 'react';
import { Plus, Search, FileText, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import type { SyllabusListItem } from '@/hooks/useSyllabusManager';
import { SYLLABUS_STATUS_CONFIG } from '@/types/syllabus';
import { DEPARTMENT_CONFIG } from '@/types/curriculum';
import type { Department } from '@/types/curriculum';

interface SyllabusListPanelProps {
  items:        SyllabusListItem[];
  selectedId:   string | null;
  stats:        { total: number; draft: number; submitted: number; approved: number };
  filterDept:   string;
  filterStatus: string;
  onSelectId:   (id: string) => void;
  onFilterDept:   (dept: string) => void;
  onFilterStatus: (status: string) => void;
  onNewSyllabus:  () => void;
}

const glassCard: React.CSSProperties = {
  background: 'rgba(255,255,255,0.72)',
  backdropFilter: 'blur(24px) saturate(150%)',
  WebkitBackdropFilter: 'blur(24px) saturate(150%)',
  border: '1px solid rgba(255,255,255,0.90)',
  boxShadow: '0 8px 32px rgba(0,0,0,0.06)',
};

const STATUS_ICON = {
  draft:     <FileText size={11} />,
  submitted: <Clock size={11} />,
  approved:  <CheckCircle2 size={11} />,
};

export default function SyllabusListPanel({
  items,
  selectedId,
  stats,
  filterDept,
  filterStatus,
  onSelectId,
  onFilterDept,
  onFilterStatus,
  onNewSyllabus,
}: SyllabusListPanelProps) {
  const [search, setSearch] = useState('');

  const visibleItems = items.filter(item => {
    const q = search.toLowerCase();
    if (!q) return true;
    return (
      item.subject?.name.toLowerCase().includes(q) ||
      item.subject?.code.toLowerCase().includes(q) ||
      item.teacher?.name.toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex flex-col h-full rounded-2xl overflow-hidden" style={glassCard}>
      {/* ── Header ── */}
      <div className="px-4 pt-4 pb-3 border-b border-black/05 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-black/80">แผนการสอน</p>
            <p className="text-[11px] text-black/35 mt-0.5">
              {stats.approved} อนุมัติ · {stats.submitted} รอตรวจ · {stats.draft} ร่าง
            </p>
          </div>
          <button
            onClick={onNewSyllabus}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white"
            style={{ background: '#1e1e1e' }}
          >
            <Plus size={13} />
            สร้างใหม่
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-black/30" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="ค้นหาวิชา / ครูผู้สอน..."
            className="h-8 pl-8 text-xs rounded-xl bg-black/[0.03] border-transparent focus-visible:ring-1 focus-visible:ring-slate-300 placeholder:text-black/25"
          />
        </div>

        {/* Status filter */}
        <div className="flex gap-1.5 flex-wrap">
          {(['all', 'draft', 'submitted', 'approved'] as const).map(s => {
            const isActive = filterStatus === s;
            const cfg = s !== 'all' ? SYLLABUS_STATUS_CONFIG[s] : null;
            return (
              <button
                key={s}
                onClick={() => onFilterStatus(s)}
                className="px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all border"
                style={{
                  background: isActive ? (cfg ? cfg.bg : 'rgba(0,0,0,0.08)') : 'transparent',
                  color: isActive ? (cfg ? cfg.color : 'rgba(0,0,0,0.70)') : 'rgba(0,0,0,0.40)',
                  borderColor: isActive ? (cfg ? cfg.color + '40' : 'rgba(0,0,0,0.15)') : 'rgba(0,0,0,0.06)',
                }}
              >
                {s === 'all' ? 'ทั้งหมด' : cfg!.label}
                {s === 'all' ? ` (${stats.total})` : ''}
              </button>
            );
          })}
        </div>

        {/* Dept filter */}
        <div className="flex gap-1.5 flex-wrap">
          {(['all', 'early', 'primary', 'secondary'] as const).map(d => {
            const isActive = filterDept === d;
            const cfg = d !== 'all' ? DEPARTMENT_CONFIG[d as Department] : null;
            return (
              <button
                key={d}
                onClick={() => onFilterDept(d)}
                className="px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all border"
                style={{
                  background: isActive ? (cfg ? cfg.bg : 'rgba(0,0,0,0.06)') : 'transparent',
                  color: isActive ? (cfg ? cfg.color : 'rgba(0,0,0,0.70)') : 'rgba(0,0,0,0.35)',
                  borderColor: isActive ? (cfg ? cfg.border : 'rgba(0,0,0,0.15)') : 'rgba(0,0,0,0.05)',
                }}
              >
                {d === 'all' ? 'ทุกระดับ' : cfg!.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── List ── */}
      <div className="flex-1 overflow-y-auto">
        {visibleItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-28 gap-2 text-black/25">
            <AlertCircle size={20} />
            <p className="text-xs">ไม่พบรายการ</p>
          </div>
        ) : (
          <ul className="divide-y divide-black/[0.04]">
            {visibleItems.map(item => {
              if (!item.syllabus || !item.subject) return null;
              const syl    = item.syllabus;
              const status = SYLLABUS_STATUS_CONFIG[syl.status];
              const dept   = DEPARTMENT_CONFIG[item.subject.department as Department];
              const isSelected = selectedId === syl.id;

              const filledWeeks = syl.weeklyPlan.filter(w => w.topic.trim()).length;
              const totalWeeks  = syl.weeklyPlan.length;
              const fillPct     = totalWeeks > 0 ? Math.round(filledWeeks / totalWeeks * 100) : 0;

              return (
                <li key={syl.id}>
                  <button
                    onClick={() => onSelectId(syl.id)}
                    className="w-full text-left px-4 py-3 hover:bg-black/[0.025] transition-colors"
                    style={isSelected ? { background: 'rgba(0,0,0,0.04)' } : undefined}
                  >
                    <div className="flex items-start gap-3">
                      {/* Dept dot */}
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5"
                        style={{ background: dept.bg, color: dept.color }}
                      >
                        {syl.subjectCode.slice(0, 1)}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold text-black/80 truncate">{syl.subjectName}</span>
                          <span
                            className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md flex items-center gap-1 shrink-0"
                            style={{ background: status.bg, color: status.color }}
                          >
                            {STATUS_ICON[syl.status]}
                            {status.label}
                          </span>
                        </div>
                        <p className="text-[10px] text-black/40 mt-0.5">
                          <span className="font-mono">{syl.subjectCode}</span>
                          {item.teacher && <span className="ml-1.5">· {item.teacher.name}</span>}
                        </p>
                        {/* Progress bar */}
                        <div className="flex items-center gap-2 mt-1.5">
                          <div className="flex-1 h-1 rounded-full bg-black/[0.07] max-w-[70px] overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${fillPct}%`, background: dept.color }}
                            />
                          </div>
                          <span className="text-[9px] text-black/30 font-mono">
                            {filledWeeks}/{totalWeeks} สัปดาห์
                          </span>
                        </div>
                      </div>

                      <Badge variant="outline" className="text-[9px] rounded-md border-black/10 text-black/35 font-mono shrink-0">
                        {syl.credits} นก.
                      </Badge>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
