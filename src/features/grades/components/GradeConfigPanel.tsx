// src/features/grades/components/GradeConfigPanel.tsx
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { HiPlus, HiTrash } from 'react-icons/hi2';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { GradeWeightConfig, GradeThreshold, GradeLetter } from '@/types/grades';
import { GPA_GRADE_OPTIONS, formatGpa, gpaStyle } from '@/types/grades';
import { cn } from '@/lib/utils';

const FORM_LABEL = 'pl-1 text-[10px] font-black uppercase tracking-wider text-slate-600';
const FORM_INPUT =
  'h-10 rounded-xl border-none bg-slate-50/70 px-4 text-xs font-bold focus-visible:bg-slate-50/90 focus-visible:ring-2 focus-visible:ring-slate-900/20';

const WEIGHT_FIELDS = [
  { key: 'classwork' as const, label: 'คะแนนเก็บ', barClass: 'bg-primary' },
  { key: 'midterm' as const, label: 'กลางภาค', barClass: 'bg-chart-2' },
  { key: 'final' as const, label: 'ปลายภาค', barClass: 'bg-chart-4' },
];

const TABLE_SHELL = 'rounded-2xl border border-border bg-card overflow-hidden';

interface Props {
  config: GradeWeightConfig;
  onSave: (updated: GradeWeightConfig) => Promise<void>;
  onRecalculate: (updated: GradeWeightConfig) => void;
}

export default function GradeConfigPanel({ config, onSave, onRecalculate }: Props) {
  const [local, setLocal] = useState<GradeWeightConfig>({ ...config });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLocal({ ...config });
  }, [config.id, config.updatedAt]);

  const totalWeight = local.weights.classwork + local.weights.midterm + local.weights.final;
  const weightOk = totalWeight === 100;

  const updateWeight = (field: keyof typeof local.weights, val: number) => {
    const updated = { ...local, weights: { ...local.weights, [field]: val } };
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
    onRecalculate(updated);
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

  const sortedThresholds = [...local.thresholds].sort((a, b) => b.minScore - a.minScore);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col gap-6"
    >
      {/* สัดส่วนคะแนน */}
      <section className="space-y-4">
        {!weightOk && (
          <div className="flex items-center gap-2 rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2">
            <AlertCircle size={14} className="shrink-0 text-destructive" />
            <p className="text-[11px] font-sarabun text-destructive">
              ผลรวมต้องเท่ากับ 100% (ปัจจุบัน: {totalWeight}%)
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {WEIGHT_FIELDS.map(({ key, label }) => (
            <div key={key} className="space-y-1">
              <label className={FORM_LABEL}>
                {label} <span className="text-destructive">*</span>
              </label>
              <div className="relative">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={local.weights[key]}
                  onChange={(e) => updateWeight(key, Number(e.target.value))}
                  className={cn(FORM_INPUT, 'pr-8 text-center tabular-nums font-sukhumvit')}
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-muted-foreground font-sarabun">
                  %
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <div className="flex h-2 overflow-hidden rounded-full bg-muted">
            {WEIGHT_FIELDS.map(({ key, barClass }, index) => (
              <div
                key={key}
                className={cn(
                  'transition-all',
                  barClass,
                  index === 0 && 'rounded-l-full',
                  index === WEIGHT_FIELDS.length - 1 && 'rounded-r-full',
                )}
                style={{ width: `${local.weights[key]}%` }}
              />
            ))}
          </div>
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-1">
            {WEIGHT_FIELDS.map(({ key, label, barClass }) => (
              <div key={key} className="flex items-center gap-1.5">
                <span className={cn('h-2 w-2 rounded-full', barClass)} />
                <span className="text-[10px] font-bold text-muted-foreground font-sarabun">
                  {label} {local.weights[key]}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* เกณฑ์ตัดเกรด */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-black uppercase tracking-wider text-muted-foreground font-sukhumvit">
            เกณฑ์ตัดเกรด (GPA 0–4)
          </p>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-8 rounded-xl px-3 text-[11px] font-bold font-sukhumvit"
            onClick={addThreshold}
          >
            <HiPlus className="h-3.5 w-3.5" />
            เพิ่มเกณฑ์
          </Button>
        </div>

        <div className={TABLE_SHELL}>
          <div className="grid grid-cols-[4.5rem_1fr_1fr_2.5rem] gap-3 border-b border-border bg-muted/30 px-4 py-3 sm:grid-cols-[5rem_1fr_1fr_2.5rem]">
            <span className="text-[11px] font-black uppercase tracking-wide text-muted-foreground font-sukhumvit">
              GPA
            </span>
            <span className="text-[11px] font-black uppercase tracking-wide text-muted-foreground font-sukhumvit">
              คะแนนขั้นต่ำ
            </span>
            <span className="text-[11px] font-black uppercase tracking-wide text-muted-foreground font-sukhumvit">
              เกรด
            </span>
            <span className="sr-only">ลบ</span>
          </div>

          <div className="flex flex-col">
            {sortedThresholds.map((t) => {
              const realIdx = local.thresholds.indexOf(t);
              const gpa = GPA_GRADE_OPTIONS.find((o) => o.letter === t.grade)?.gpa ?? 0;
              const gStyle = gpaStyle(gpa);

              return (
                <div
                  key={`${t.grade}-${realIdx}`}
                  className="grid grid-cols-[4.5rem_1fr_1fr_2.5rem] items-center gap-3 border-b border-border px-4 py-3 last:border-b-0 sm:grid-cols-[5rem_1fr_1fr_2.5rem]"
                >
                  <span
                    className="inline-flex w-fit rounded-full px-2.5 py-0.5 text-xs font-bold tabular-nums font-sukhumvit"
                    style={{ color: gStyle.text, background: gStyle.bg }}
                  >
                    {formatGpa(gpa)}
                  </span>

                  <div className="relative">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={t.minScore}
                      onChange={(e) => updateThreshold(realIdx, 'minScore', e.target.value)}
                      className={cn(FORM_INPUT, 'h-9 pr-8 text-center tabular-nums font-sukhumvit')}
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-muted-foreground font-sarabun">
                      %
                    </span>
                  </div>

                  <Select
                    value={t.grade}
                    onValueChange={(value) => updateThreshold(realIdx, 'grade', value)}
                  >
                    <SelectTrigger className="h-9 w-full rounded-xl border-none bg-slate-50/70 text-xs font-bold font-sukhumvit shadow-none focus:ring-2 focus:ring-slate-900/20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {GPA_GRADE_OPTIONS.map(({ letter, gpa: gpaVal }) => (
                        <SelectItem key={letter} value={letter} className="text-xs font-bold font-sukhumvit">
                          {formatGpa(gpaVal)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {local.thresholds.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => removeThreshold(realIdx)}
                      className="flex h-8 w-8 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                      aria-label="ลบเกณฑ์"
                    >
                      <HiTrash className="h-4 w-4" />
                    </button>
                  ) : (
                    <span />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <div className="border-t border-border pt-4">
        <Button
          type="button"
          disabled={!weightOk || saving}
          onClick={handleSave}
          className="h-10 w-full rounded-xl font-bold font-sukhumvit"
        >
          {saving ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground" />
          ) : (
            'บันทึกการตั้งค่า'
          )}
        </Button>
      </div>
    </motion.div>
  );
}
