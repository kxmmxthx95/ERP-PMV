import { CheckCircle2, Clock, FileText, Plus, AlertCircle } from 'lucide-react';
import type { TeacherSubjectCard } from '@/hooks/useTeacherSyllabus';
import type { Department } from '@/types/curriculum';
import { DEPARTMENT_CONFIG, CATEGORY_CONFIG } from '@/types/curriculum';
import { SYLLABUS_STATUS_CONFIG } from '@/types/syllabus';

interface MySubjectPanelProps {
  cards:            TeacherSubjectCard[];
  selectedSubjectId: string | null;
  onSelect:         (subjectId: string) => void;
}

const glassCard: React.CSSProperties = {
  background: 'rgba(255,255,255,0.72)',
  backdropFilter: 'blur(24px) saturate(150%)',
  WebkitBackdropFilter: 'blur(24px) saturate(150%)',
  border: '1px solid rgba(255,255,255,0.90)',
  boxShadow: '0 8px 32px rgba(0,0,0,0.06)',
};

const STATUS_ICON = {
  draft:     <FileText size={10} />,
  submitted: <Clock size={10} />,
  approved:  <CheckCircle2 size={10} />,
};

export default function MySubjectPanel({
  cards,
  selectedSubjectId,
  onSelect,
}: MySubjectPanelProps) {
  const withSyllabus    = cards.filter(c => c.syllabus !== null);
  const withoutSyllabus = cards.filter(c => c.syllabus === null);

  return (
    <div className="flex flex-col h-full rounded-2xl overflow-hidden" style={glassCard}>
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-black/05">
        <p className="text-sm font-bold text-black/80">วิชาที่รับผิดชอบ</p>
        <p className="text-[11px] text-black/40 mt-0.5">
          {cards.length} วิชา · {withSyllabus.length} มีแผนแล้ว · {withoutSyllabus.length} ยังไม่มีแผน
        </p>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {/* ── วิชาที่มีแผนแล้ว ── */}
        {withSyllabus.length > 0 && (
          <div>
            <div className="px-4 py-2 sticky top-0 bg-white/60 backdrop-blur-sm z-10">
              <span className="text-[10px] font-bold text-black/35 uppercase tracking-wider">
                มีแผนการสอนแล้ว ({withSyllabus.length})
              </span>
            </div>
            <ul className="divide-y divide-black/[0.04]">
              {withSyllabus.map(card => (
                <SubjectRow
                  key={card.subject.id}
                  card={card}
                  isSelected={selectedSubjectId === card.subject.id}
                  onSelect={() => onSelect(card.subject.id)}
                />
              ))}
            </ul>
          </div>
        )}

        {/* ── วิชาที่ยังไม่มีแผน ── */}
        {withoutSyllabus.length > 0 && (
          <div>
            <div className="px-4 py-2 sticky top-0 bg-white/60 backdrop-blur-sm z-10">
              <span className="text-[10px] font-bold text-black/35 uppercase tracking-wider">
                ยังไม่มีแผนการสอน ({withoutSyllabus.length})
              </span>
            </div>
            <ul className="divide-y divide-black/[0.04]">
              {withoutSyllabus.map(card => (
                <SubjectRow
                  key={card.subject.id}
                  card={card}
                  isSelected={selectedSubjectId === card.subject.id}
                  onSelect={() => onSelect(card.subject.id)}
                />
              ))}
            </ul>
          </div>
        )}

        {cards.length === 0 && (
          <div className="flex flex-col items-center justify-center h-32 gap-2 text-black/25">
            <AlertCircle size={20} />
            <p className="text-xs">ยังไม่ได้รับมอบหมายวิชา</p>
            <p className="text-[10px]">ติดต่อผู้ดูแลระบบเพื่อกำหนดวิชา</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Subject Row ────────────────────────────────────────────────────────────────

function SubjectRow({
  card,
  isSelected,
  onSelect,
}: {
  card:       TeacherSubjectCard;
  isSelected: boolean;
  onSelect:   () => void;
}) {
  const { subject, syllabus, filledWeeks, totalWeeks, fillPct } = card;
  const dept    = DEPARTMENT_CONFIG[subject.department as Department];
  const catCfg  = CATEGORY_CONFIG[subject.category];
  const status  = syllabus ? SYLLABUS_STATUS_CONFIG[syllabus.status] : null;

  return (
    <li>
      <button
        onClick={onSelect}
        className="w-full text-left px-4 py-3 hover:bg-black/[0.025] transition-colors"
        style={isSelected ? { background: 'rgba(0,0,0,0.04)' } : undefined}
      >
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center text-[11px] font-bold shrink-0 mt-0.5"
            style={{ background: dept.bg, color: dept.color }}
          >
            {subject.code.slice(0, 1)}
          </div>

          <div className="flex-1 min-w-0">
            {/* Subject name + status */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-semibold text-black/80 truncate">{subject.name}</span>
              {status ? (
                <span
                  className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md flex items-center gap-1 shrink-0"
                  style={{ background: status.bg, color: status.color }}
                >
                  {STATUS_ICON[syllabus!.status]}
                  {status.label}
                </span>
              ) : (
                <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-black/05 text-black/35 flex items-center gap-1 shrink-0">
                  <Plus size={9} />
                  สร้างแผน
                </span>
              )}
            </div>

            {/* Code + category */}
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="font-mono text-[10px] text-black/35">{subject.code}</span>
              <span className="text-[9px] px-1 py-0.5 rounded" style={{ background: catCfg.bg, color: catCfg.color }}>
                {catCfg.label}
              </span>
              <span className="text-[10px] text-black/30">{subject.credits} นก. · {subject.hoursPerWeek} คาบ/สัปดาห์</span>
            </div>

            {/* Progress bar (เฉพาะวิชาที่มี syllabus) */}
            {syllabus && (
              <div className="flex items-center gap-2 mt-1.5">
                <div className="flex-1 h-1 rounded-full bg-black/[0.07] max-w-[80px] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${fillPct}%`, background: dept.color }}
                  />
                </div>
                <span className="text-[9px] text-black/30 font-mono">
                  {filledWeeks}/{totalWeeks} สัปดาห์
                </span>
              </div>
            )}
          </div>

          {/* Right: credits badge */}
          <span className="text-[10px] font-mono text-black/30 shrink-0 mt-1">{subject.credits} นก.</span>
        </div>
      </button>
    </li>
  );
}
