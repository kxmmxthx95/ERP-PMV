// src/features/grades/components/GradeTable.tsx
import { motion } from 'framer-motion';
import StudentAvatar from '@/features/students/components/StudentAvatar';
import type { StudentScoreSummary, GradeWeightConfig, GradeLetter } from '@/types/grades';

interface Props {
  summaries: StudentScoreSummary[];
  config: GradeWeightConfig;
  editable?: boolean;
  showAsPercentage?: boolean;
  onUpdateScore?: (
    studentId: string,
    field: 'classworkScore' | 'midtermScore' | 'finalScore' | 'note' | 'absent',
    value: number | string | boolean | null,
  ) => void;
}

const GRADE_COLOR: Record<GradeLetter, { text: string; bg: string }> = {
  'A':  { text: '#059669', bg: '#d1fae5' },
  'B+': { text: '#0891b2', bg: '#cffafe' },
  'B':  { text: '#2563eb', bg: '#dbeafe' },
  'C+': { text: '#7c3aed', bg: '#ede9fe' },
  'C':  { text: '#db2777', bg: '#fce7f3' },
  'D+': { text: '#d97706', bg: '#fef3c7' },
  'D':  { text: '#ea580c', bg: '#ffedd5' },
  'F':  { text: '#dc2626', bg: '#fee2e2' },
  '0':  { text: '#94a3b8', bg: '#f1f5f9' },
  'ร':  { text: '#94a3b8', bg: '#f1f5f9' },
  'มส': { text: '#94a3b8', bg: '#f1f5f9' },
};

function ScoreCell({
  value, max, editable, onChange, showAsPercentage,
}: {
  value: number | null;
  max: number;
  editable?: boolean;
  onChange?: (v: number | null) => void;
  showAsPercentage?: boolean;
}) {
  const percentage = value !== null && max > 0 ? (value / max) * 100 : null;
  const displayValue = showAsPercentage && percentage !== null
    ? `${percentage.toFixed(0)}%`
    : value !== null ? `${value}` : null;

  if (!editable) {
    return (
      <span className="text-[12px] font-bold text-slate-700 font-sukhumvit">
        {displayValue !== null ? displayValue : <span className="text-slate-300">—</span>}
        {!showAsPercentage && value !== null && (
          <span className="text-[9px] text-slate-400 font-sarabun ml-0.5">/{max}</span>
        )}
      </span>
    );
  }

  return (
    <div className="flex flex-col items-center">
      <div className="flex items-center gap-0.5">
        <input
          type="number" min={0} max={max}
          value={value ?? ''}
          onChange={e => onChange?.(e.target.value === '' ? null : Number(e.target.value))}
          placeholder="—"
          className="w-14 h-7 rounded-xl text-center text-xs font-bold outline-none border font-sukhumvit transition-all focus:ring-2 focus:ring-indigo-400"
          style={{ background: 'rgba(255,255,255,0.8)', borderColor: 'rgba(200,180,255,0.4)' }}
        />
        {!showAsPercentage && (
          <span className="text-[9px] text-slate-400 font-sarabun">/{max}</span>
        )}
      </div>
      {showAsPercentage && percentage !== null && (
        <span className="text-[8px] font-bold text-indigo-500 font-sarabun mt-0.5">
          {percentage.toFixed(0)}%
        </span>
      )}
    </div>
  );
}

export default function GradeTable({ summaries, config, editable = false, onUpdateScore, showAsPercentage = false }: Props) {
  const showClasswork = config.weights.classwork > 0;

  // Stats summary
  const graded = summaries.filter(s => s.grade !== null).length;
  const passed = summaries.filter(s => s.grade !== null && s.grade !== 'F').length;
  const gpaSum = summaries.reduce((acc, s) => {
    if (!s.totalScore) return acc;
    const gpaMap: Record<GradeLetter, number> = {
      'A': 4, 'B+': 3.5, 'B': 3, 'C+': 2.5, 'C': 2, 'D+': 1.5, 'D': 1, 'F': 0, '0': 0, 'ร': 0, 'มส': 0,
    };
    return acc + (gpaMap[s.grade ?? 'F'] ?? 0);
  }, 0);
  const avgGpa = graded > 0 ? Math.round((gpaSum / graded) * 100) / 100 : null;
  const avgScore = graded > 0
    ? Math.round(summaries.reduce((a, s) => a + (s.totalScore ?? 0), 0) / graded * 10) / 10
    : null;

  return (
    <div className="flex flex-col gap-3">
      {/* Summary bar */}
      <div className="flex gap-3 flex-wrap">
        {[
          { label: 'นักเรียนทั้งหมด', value: summaries.length, color: '#0f172a' },
          { label: 'ให้คะแนนแล้ว', value: graded, color: '#2563eb' },
          { label: 'ผ่าน', value: passed, color: '#059669' },
          { label: 'ไม่ผ่าน', value: graded - passed, color: '#dc2626' },
          ...(avgScore !== null ? [{ label: 'เฉลี่ย', value: `${avgScore}%`, color: '#7c3aed' }] : []),
          ...(avgGpa !== null ? [{ label: 'เกรดเฉลี่ย', value: avgGpa, color: '#0891b2' }] : []),
        ].map(item => (
          <div key={item.label} className="flex flex-col items-center px-3 py-2 rounded-2xl"
            style={{ background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.9)' }}>
            <span className="text-[15px] font-black font-sukhumvit" style={{ color: item.color }}>{item.value}</span>
            <span className="text-[9px] text-slate-400 font-sarabun">{item.label}</span>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-[1.5rem] overflow-hidden"
        style={{ background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.9)' }}>
        {/* Header */}
        <div className="grid gap-2 px-4 py-2.5"
          style={{
            gridTemplateColumns: showClasswork
              ? '2rem 1fr 8rem 8rem 8rem 5rem 3.5rem'
              : '2rem 1fr 8rem 8rem 5rem 3.5rem',
            background: 'rgba(248,250,252,0.8)',
          }}>
          <span className="text-[9px] font-black text-slate-400 uppercase font-sukhumvit">#</span>
          <span className="text-[9px] font-black text-slate-400 uppercase font-sukhumvit">นักเรียน</span>
          {showClasswork && (
            <span className="text-[9px] font-black uppercase font-sukhumvit text-right" style={{ color: '#7c3aed' }}>
              เก็บ ({config.weights.classwork}%)
            </span>
          )}
          <span className="text-[9px] font-black uppercase font-sukhumvit text-right" style={{ color: '#0891b2' }}>
            กลางภาค ({config.weights.midterm}%)
          </span>
          <span className="text-[9px] font-black uppercase font-sukhumvit text-right" style={{ color: '#059669' }}>
            ปลายภาค ({config.weights.final}%)
          </span>
          <span className="text-[9px] font-black text-slate-500 uppercase font-sukhumvit text-right">รวม</span>
          <span className="text-[9px] font-black text-slate-500 uppercase font-sukhumvit text-center">เกรด</span>
        </div>

        {/* Rows */}
        <div className="flex flex-col divide-y divide-slate-100/50">
          {summaries.map((s, i) => {
            const gc = s.grade ? GRADE_COLOR[s.grade] : null;
            return (
              <motion.div
                key={s.studentId}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                transition={{ delay: i * 0.015 }}
                className="grid gap-2 px-4 py-2.5 items-center hover:bg-slate-50/40 transition-colors"
                style={{
                  gridTemplateColumns: showClasswork
                    ? '2rem 1fr 8rem 8rem 8rem 5rem 3.5rem'
                    : '2rem 1fr 8rem 8rem 5rem 3.5rem',
                  background: s.absent ? 'rgba(255,228,230,0.3)' : undefined,
                }}
              >
                <span className="text-[10px] font-bold text-slate-400 font-sukhumvit">{i + 1}</span>

                {/* Student */}
                <div className="flex items-center gap-2 min-w-0">
                  <StudentAvatar
                    photoURL={s.photoURL}
                    studentId={s.studentId}
                    name={s.studentName}
                    gender={s.gender}
                    className="w-7 h-7 rounded-xl shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold text-slate-800 font-sukhumvit truncate">{s.studentName}</p>
                    <div className="flex items-center gap-2">
                      <p className="text-[9px] text-slate-400 font-sarabun">{s.studentCode}</p>
                      {s.absent && (
                        <span className="text-[8px] font-bold text-rose-500 bg-rose-50 px-1.5 py-0.5 rounded-full font-sukhumvit">ขาดสอบ</span>
                      )}
                    </div>
                  </div>
                  {editable && onUpdateScore && (
                    <button
                      onClick={() => onUpdateScore(s.studentId, 'absent', !s.absent)}
                      className="ml-auto shrink-0 text-[8px] font-bold px-1.5 py-0.5 rounded-lg font-sukhumvit transition-all"
                      style={{
                        background: s.absent ? '#e11d48' : 'rgba(241,245,249,0.8)',
                        color: s.absent ? '#fff' : '#94a3b8',
                      }}
                    >ขาด</button>
                  )}
                </div>

                {/* Classwork */}
                {showClasswork && (
                  <div className="flex justify-end">
                    <ScoreCell
                      value={s.classworkScore}
                      max={config.maxScores.classwork}
                      editable={editable && !s.absent}
                      showAsPercentage={showAsPercentage}
                      onChange={v => onUpdateScore?.(s.studentId, 'classworkScore', v)}
                    />
                  </div>
                )}

                {/* Midterm */}
                <div className="flex justify-end">
                  <ScoreCell
                    value={s.midtermScore}
                    max={config.maxScores.midterm}
                    editable={editable && !s.absent}
                    showAsPercentage={showAsPercentage}
                    onChange={v => onUpdateScore?.(s.studentId, 'midtermScore', v)}
                  />
                </div>

                {/* Final */}
                <div className="flex justify-end">
                  <ScoreCell
                    value={s.finalScore}
                    max={config.maxScores.final}
                    editable={editable && !s.absent}
                    showAsPercentage={showAsPercentage}
                    onChange={v => onUpdateScore?.(s.studentId, 'finalScore', v)}
                  />
                </div>

                {/* Total */}
                <div className="text-right">
                  {s.totalScore !== null ? (
                    <span className="text-[13px] font-black font-sukhumvit" style={{ color: gc?.text ?? '#0f172a' }}>
                      {showAsPercentage ? `${s.totalScore}%` : s.totalScore}
                    </span>
                  ) : (
                    <span className="text-[12px] text-slate-300 font-sarabun">—</span>
                  )}
                </div>

                {/* Grade badge */}
                <div className="flex justify-center">
                  {s.grade !== null && gc ? (
                    <span className="text-[11px] font-black px-2.5 py-1 rounded-xl font-sukhumvit"
                      style={{ color: gc.text, background: gc.bg }}>
                      {s.grade}
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-300 font-sarabun">—</span>
                  )}
                </div>
              </motion.div>
            );
          })}

          {summaries.length === 0 && (
            <div className="py-12 text-center text-slate-400">
              <p className="text-[13px] font-sarabun">ยังไม่มีข้อมูลนักเรียน</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
