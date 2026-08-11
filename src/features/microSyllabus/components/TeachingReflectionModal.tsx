import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type {
  TeachingPlanStatus,
  TeachingOverview,
  TeachingReflection,
  TeachingReflectionStudent,
} from '@/types/microSyllabus';
import { ProblemStudentPicker } from './ProblemStudentPicker';
import { TeachingStarRating } from './TeachingStarRating';

const PLAN_STATUS_OPTIONS: { value: TeachingPlanStatus; label: string }[] = [
  { value: 'on_plan', label: 'ตามแผน' },
  { value: 'off_plan', label: 'หลุดแผน' },
];

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (reflection: TeachingReflection) => Promise<void>;
  classId?: string;
  dateLabel?: string;
}

function RadioCard<T extends string>({
  name,
  value,
  checked,
  label,
  onSelect,
}: {
  name: string;
  value: T;
  checked: boolean;
  label: string;
  onSelect: (value: T) => void;
}) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-center justify-center rounded-xl border px-3 py-2.5 text-sm font-black font-sukhumvit transition-colors',
        checked
          ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300',
      )}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={() => onSelect(value)}
        className="sr-only"
      />
      {label}
    </label>
  );
}

export default function TeachingReflectionModal({
  open,
  onClose,
  onSubmit,
  classId,
  dateLabel,
}: Props) {
  const [planStatus, setPlanStatus] = useState<TeachingPlanStatus>('on_plan');
  const [overview, setOverview] = useState<TeachingOverview>(3);
  const [problemStudents, setProblemStudents] = useState<TeachingReflectionStudent[]>([]);
  const [additionalRequest, setAdditionalRequest] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPlanStatus('on_plan');
    setOverview(3);
    setProblemStudents([]);
    setAdditionalRequest('');
  }, [open]);

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await onSubmit({
        planStatus,
        overview,
        ...(problemStudents.length > 0 ? { problemStudents } : {}),
        ...(additionalRequest.trim() ? { additionalRequest: additionalRequest.trim() } : {}),
        recordedAt: new Date().toISOString(),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-3xl border border-slate-200 p-0 sm:max-w-lg">
        <div className="border-b border-slate-100 px-5 py-4">
          <DialogTitle className="text-base font-black text-slate-800 font-sukhumvit">
            บันทึกผลหลังการสอน
          </DialogTitle>
          {dateLabel && (
            <DialogDescription className="mt-1 text-xs text-slate-500 font-sarabun">
              {dateLabel}
            </DialogDescription>
          )}
        </div>

        <div className="space-y-5 px-5 py-4">
          <div className="space-y-2">
            <p className="text-[11px] font-black uppercase tracking-wide text-slate-500 font-sukhumvit">
              สถานะ
            </p>
            <div className="grid grid-cols-2 gap-2">
              {PLAN_STATUS_OPTIONS.map((option) => (
                <RadioCard
                  key={option.value}
                  name="plan-status"
                  value={option.value}
                  checked={planStatus === option.value}
                  label={option.label}
                  onSelect={setPlanStatus}
                />
              ))}
            </div>
          </div>

          <TeachingStarRating value={overview} onChange={setOverview} />

          <ProblemStudentPicker
            classId={classId}
            enabled={open}
            value={problemStudents}
            onChange={setProblemStudents}
          />

          <div className="space-y-2">
            <label
              htmlFor="additional-request"
              className="text-[11px] font-black uppercase tracking-wide text-slate-500 font-sukhumvit"
            >
              คำร้องขอเพิ่มเติม
            </label>
            <textarea
              id="additional-request"
              value={additionalRequest}
              onChange={(event) => setAdditionalRequest(event.target.value)}
              rows={4}
              placeholder="ระบุสิ่งที่ต้องการให้โรงเรียนช่วยเหลือหรือติดตามเพิ่มเติม..."
              className="w-full resize-none rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-sarabun text-slate-800 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 border-t border-slate-100 px-5 py-4 sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-600 hover:bg-slate-50 disabled:opacity-60"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={saving}
            className="h-11 rounded-2xl bg-emerald-600 px-5 text-sm font-black text-white hover:bg-emerald-500 disabled:opacity-60"
          >
            {saving ? 'กำลังบันทึก...' : 'บันทึกผลการสอน'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
