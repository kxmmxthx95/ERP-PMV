import { useState } from 'react';
import FormModal, { modalInputCls, modalLabelCls } from '@/components/ui/FormModal';
import { cn } from '@/lib/utils';
import {
  TUITION_TERM_COUNT_OPTIONS,
  type TuitionTermCount,
} from '@/types/tuition';

const inputCls = cn(modalInputCls, 'h-10 rounded-xl border-none px-3.5 text-xs font-bold');
const labelCls = cn(modalLabelCls, 'mb-1.5 px-0 tracking-wider');

export interface TuitionYearSetupInput {
  academicYearId: string;
  termCount: TuitionTermCount;
}

interface CampaignSetupModalProps {
  open: boolean;
  onClose: () => void;
  defaultAcademicYearId: string;
  /** ปีที่มีรอบเก็บค่าเทอมอยู่แล้ว — กันไม่ให้สร้างซ้ำ */
  existingYearIds?: string[];
  onCreate: (input: TuitionYearSetupInput) => Promise<void>;
  isSaving?: boolean;
}

export default function CampaignSetupModal({
  open,
  onClose,
  defaultAcademicYearId,
  existingYearIds = [],
  onCreate,
  isSaving,
}: CampaignSetupModalProps) {
  const [yearInput, setYearInput] = useState(defaultAcademicYearId);
  const [termCount, setTermCount] = useState<TuitionTermCount>(2);
  const yearTrimmed = yearInput.trim();
  const yearExists = yearTrimmed.length > 0 && existingYearIds.includes(yearTrimmed);

  async function handleSubmit() {
    await onCreate({ academicYearId: yearTrimmed, termCount });
  }

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title="ตั้งค่าการเก็บค่าเทอม"
      subtitle={yearTrimmed ? `ปีการศึกษา ${yearTrimmed} · ${termCount} ภาคเรียน` : 'กำหนดปีการศึกษาและจำนวนภาคเรียน'}
      onSubmit={handleSubmit}
      submitLabel="สร้างรอบเก็บค่าเทอม"
      submitDisabled={isSaving || !yearTrimmed || yearExists}
      showCancel={false}
      maxWidth="md"
    >
      <div className="space-y-4 px-1 py-1">
        <div>
          <label className={labelCls}>ปีการศึกษา</label>
          <input
            value={yearInput}
            onChange={(e) => setYearInput(e.target.value)}
            placeholder="เช่น 2569"
            className={cn(inputCls, 'w-full')}
          />
          {yearExists && (
            <p className="mt-1.5 text-[11px] font-semibold text-rose-500">ปีการศึกษานี้มีในระบบแล้ว</p>
          )}
        </div>

        <div>
          <label className={labelCls}>จำนวนภาคเรียน</label>
          <select
            value={termCount}
            onChange={(e) => setTermCount(Number(e.target.value) as TuitionTermCount)}
            className={cn(inputCls, 'w-full appearance-none')}
          >
            {TUITION_TERM_COUNT_OPTIONS.map((opt) => (
              <option key={opt.count} value={opt.count}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </FormModal>
  );
}
