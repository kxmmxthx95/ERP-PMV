// src/features/grades/components/GradeConfigPanel.tsx
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Settings2, Plus, Trash2, AlertCircle } from 'lucide-react';
import type { GradeWeightConfig, GradeThreshold, GradeLetter } from '@/types/grades';
import { GLASS } from '@/components/layouts/PortalLayout';

interface Props {
  config: GradeWeightConfig;
  onSave: (updated: GradeWeightConfig) => Promise<void>;
  onRecalculate: (updated: GradeWeightConfig) => void;
}

const GRADE_OPTIONS: GradeLetter[] = ['A', 'B+', 'B', 'C+', 'C', 'D+', 'D', 'F'];

const GRADE_COLORS: Record<GradeLetter, string> = {
  'A':   '#059669',
  'B+':  '#0891b2',
  'B':   '#2563eb',
  'C+':  '#7c3aed',
  'C':   '#db2777',
  'D+':  '#d97706',
  'D':   '#ea580c',
  'F':   '#dc2626',
  '0':   '#94a3b8',
  'ร':   '#94a3b8',
  'มส':  '#94a3b8',
};

export default function GradeConfigPanel({ config, onSave, onRecalculate }: Props) {
  const [local, setLocal] = useState<GradeWeightConfig>({ ...config });
  const [saving, setSaving] = useState(false);

  const totalWeight = local.weights.classwork + local.weights.midterm + local.weights.final;
  const weightOk = totalWeight === 100;

  const updateWeight = (field: keyof typeof local.weights, val: number) => {
    const updated = { ...local, weights: { ...local.weights, [field]: val } };
    setLocal(updated);
    onRecalculate(updated);
  };

  const updateMaxScore = (field: keyof typeof local.maxScores, val: number) => {
    const updated = { ...local, maxScores: { ...local.maxScores, [field]: val } };
    setLocal(updated);
    onRecalculate(updated);
  };

  const updateThreshold = (idx: number, field: keyof GradeThreshold, val: number | string) => {
    const thresholds = [...local.thresholds];
    thresholds[idx] = { ...thresholds[idx], [field]: field === 'minScore' ? Number(val) : val as GradeLetter };
    const updated = { ...local, thresholds };
    setLocal(updated);
    onRecalculate(updated);
  };

  const addThreshold = () => {
    const updated = {
      ...local,
      thresholds: [...local.thresholds, { minScore: 0, grade: 'F' as GradeLetter }],
    };
    setLocal(updated);
  };

  const removeThreshold = (idx: number) => {
    const thresholds = local.thresholds.filter((_, i) => i !== idx);
    const updated = { ...local, thresholds };
    setLocal(updated);
    onRecalculate(updated);
  };

  const handleSave = async () => {
    if (!weightOk) return;
    setSaving(true);
    await onSave(local);
    setSaving(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-[2rem] p-5 flex flex-col gap-5"
      style={GLASS}
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-xl bg-violet-100 flex items-center justify-center">
          <Settings2 size={15} className="text-violet-600" />
        </div>
        <div>
          <p className="text-[13px] font-black text-slate-800 font-sukhumvit">ตั้งค่าการตัดเกรด</p>
          <p className="text-[11px] text-slate-400 font-sarabun">กำหนดสัดส่วนคะแนนและเกณฑ์</p>
        </div>
      </div>

      {/* สัดส่วนคะแนน */}
      <div className="flex flex-col gap-3">
        <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest font-sukhumvit">สัดส่วนคะแนน</p>

        {!weightOk && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-rose-50 border border-rose-200">
            <AlertCircle size={12} className="text-rose-500 shrink-0" />
            <p className="text-[11px] text-rose-600 font-sarabun">ผลรวมต้องเท่ากับ 100% (ปัจจุบัน: {totalWeight}%)</p>
          </div>
        )}

        <div className="grid grid-cols-3 gap-3">
          {(
            [
              { key: 'classwork' as const, label: 'คะแนนเก็บ', color: '#7c3aed' },
              { key: 'midterm' as const, label: 'กลางภาค', color: '#0891b2' },
              { key: 'final' as const, label: 'ปลายภาค', color: '#059669' },
            ]
          ).map(({ key, label, color }) => (
            <div key={key} className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold font-sukhumvit" style={{ color }}>
                {label}
              </label>
              <div className="relative">
                <input
                  type="number" min={0} max={100}
                  value={local.weights[key]}
                  onChange={e => updateWeight(key, Number(e.target.value))}
                  className="w-full h-9 rounded-2xl px-3 pr-7 text-xs font-bold text-center outline-none border font-sukhumvit"
                  style={{ background: 'rgba(255,255,255,0.7)', borderColor: color + '55' }}
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-sarabun">%</span>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[9px] text-slate-400 font-sarabun">คะแนนเต็ม</label>
                <input
                  type="number" min={1}
                  value={local.maxScores[key]}
                  onChange={e => updateMaxScore(key, Number(e.target.value))}
                  className="w-full h-8 rounded-2xl px-3 text-xs font-medium text-center outline-none border font-sarabun"
                  style={{ background: 'rgba(255,255,255,0.6)', borderColor: 'rgba(200,180,255,0.3)' }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Weight visual bar */}
        <div className="flex h-2 rounded-full overflow-hidden gap-0.5">
          <div className="rounded-l-full transition-all" style={{ width: `${local.weights.classwork}%`, background: '#7c3aed' }} />
          <div className="transition-all" style={{ width: `${local.weights.midterm}%`, background: '#0891b2' }} />
          <div className="rounded-r-full transition-all" style={{ width: `${local.weights.final}%`, background: '#059669' }} />
        </div>
        <div className="flex gap-3 justify-center">
          {[{ label: 'คะแนนเก็บ', color: '#7c3aed', pct: local.weights.classwork },
            { label: 'กลางภาค', color: '#0891b2', pct: local.weights.midterm },
            { label: 'ปลายภาค', color: '#059669', pct: local.weights.final }].map(item => (
            <div key={item.label} className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full" style={{ background: item.color }} />
              <span className="text-[9px] text-slate-500 font-sarabun">{item.label} {item.pct}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* เกณฑ์ตัดเกรด */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest font-sukhumvit">เกณฑ์ตัดเกรด</p>
          <button onClick={addThreshold}
            className="flex items-center gap-1 text-[10px] font-bold text-violet-600 font-sukhumvit">
            <Plus size={11} /> เพิ่มเกณฑ์
          </button>
        </div>

        <div className="flex flex-col gap-2">
          {[...local.thresholds]
            .sort((a, b) => b.minScore - a.minScore)
            .map((t, idx) => {
              const realIdx = local.thresholds.indexOf(t);
              return (
                <div key={idx} className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg flex items-center justify-center text-[9px] font-black"
                    style={{ background: (GRADE_COLORS[t.grade] ?? '#94a3b8') + '22', color: GRADE_COLORS[t.grade] ?? '#94a3b8' }}>
                    {t.grade}
                  </div>
                  <span className="text-[10px] text-slate-400 font-sarabun">คะแนน ≥</span>
                  <input
                    type="number" min={0} max={100}
                    value={t.minScore}
                    onChange={e => updateThreshold(realIdx, 'minScore', e.target.value)}
                    className="w-16 h-7 rounded-xl text-center text-xs font-bold outline-none border font-sukhumvit"
                    style={{ background: 'rgba(255,255,255,0.7)', borderColor: 'rgba(200,180,255,0.4)' }}
                  />
                  <span className="text-[10px] text-slate-400 font-sarabun">%</span>
                  <select
                    value={t.grade}
                    onChange={e => updateThreshold(realIdx, 'grade', e.target.value)}
                    className="flex-1 h-7 rounded-xl px-2 text-xs font-bold outline-none border font-sukhumvit appearance-none"
                    style={{ background: 'rgba(255,255,255,0.7)', borderColor: 'rgba(200,180,255,0.4)', color: GRADE_COLORS[t.grade] ?? '#94a3b8' }}
                  >
                    {GRADE_OPTIONS.map(g => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                  {local.thresholds.length > 1 && (
                    <button onClick={() => removeThreshold(realIdx)}
                      className="w-6 h-6 rounded-lg bg-rose-50 flex items-center justify-center text-rose-400 hover:text-rose-600">
                      <Trash2 size={10} />
                    </button>
                  )}
                </div>
              );
            })}
        </div>
      </div>

      {/* Save */}
      <motion.button
        whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
        onClick={handleSave}
        disabled={!weightOk || saving}
        className="w-full h-10 rounded-2xl text-sm font-bold text-white font-sukhumvit flex items-center justify-center gap-2 disabled:opacity-50"
        style={{ background: 'linear-gradient(135deg,#7c3aed,#6d28d9)', boxShadow: '0 4px 12px rgba(124,58,237,0.3)' }}
      >
        {saving
          ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
          : 'บันทึกการตั้งค่า'
        }
      </motion.button>
    </motion.div>
  );
}
