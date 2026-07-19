import { useEffect, useState } from 'react';
import { HiOutlineBanknotes, HiOutlineExclamationTriangle, HiOutlineTrash, HiXMark } from 'react-icons/hi2';
import { modalInputCls, modalLabelCls } from '@/components/ui/FormModal';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { cn } from '@/lib/utils';
import { computeNetPayable, computeTotalDiscount, formatTHB, sumFeeItems } from '../tuitionCalc';
import type { Installment, Scholarship, StudentFee, TuitionFeeItem } from '@/types/tuition';

const DRAWER_CONTENT_CLASS = cn(
  'h-dvh flex flex-col p-0 rounded-none bg-white/95 backdrop-blur-xl',
  'data-[vaul-drawer-direction=right]:w-screen data-[vaul-drawer-direction=right]:max-w-none',
  'data-[vaul-drawer-direction=right]:before:inset-0 data-[vaul-drawer-direction=right]:before:rounded-none',
  'sm:h-full sm:rounded-l-3xl',
  'sm:data-[vaul-drawer-direction=right]:w-full sm:data-[vaul-drawer-direction=right]:max-w-lg',
  'sm:data-[vaul-drawer-direction=right]:before:inset-2 sm:data-[vaul-drawer-direction=right]:before:rounded-4xl',
);

const inputCls = cn(modalInputCls, 'h-10 rounded-xl border-none px-3.5 text-xs font-bold');
const sectionLabelCls = cn(modalLabelCls, 'mb-2 px-0 tracking-wider');

function makeId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

interface AssignFeeDrawerProps {
  open: boolean;
  onClose: () => void;
  studentFee: StudentFee | null;
  onSave: (input: { feeItems: TuitionFeeItem[]; scholarships: Scholarship[]; installments: Installment[] }) => Promise<void>;
  isSaving?: boolean;
}

export default function AssignFeeDrawer({ open, onClose, studentFee, onSave, isSaving }: AssignFeeDrawerProps) {
  const [feeItems, setFeeItems] = useState<TuitionFeeItem[]>([]);
  const [scholarships, setScholarships] = useState<Scholarship[]>([]);
  const [installments, setInstallments] = useState<Installment[]>([]);

  useEffect(() => {
    if (!open || !studentFee) return;
    setFeeItems(studentFee.feeItems.map((item) => ({ ...item })));
    setScholarships((studentFee.scholarships ?? []).map((item) => ({ ...item })));
    setInstallments((studentFee.installments ?? []).map((item) => ({ ...item })));
  }, [open, studentFee]);

  if (!studentFee) return null;

  const totalFee = sumFeeItems(feeItems);
  const totalDiscount = computeTotalDiscount(totalFee, scholarships);
  const netPayable = computeNetPayable(totalFee, scholarships);
  const installmentSum = installments.reduce((sum, i) => sum + i.amount, 0);
  const installmentMismatch = installments.length > 0 && installmentSum !== netPayable;
  const canSave = feeItems.length > 0 && !installmentMismatch;

  function splitEvenly(count: number) {
    const base = Math.floor((netPayable / count) / 10) * 10;
    const remainder = netPayable - base * count;
    const next: Installment[] = Array.from({ length: count }, (_, idx) => ({
      id: makeId(),
      label: `งวดที่ ${idx + 1}`,
      amount: idx === count - 1 ? base + remainder : base,
      dueDate: '',
      status: 'unpaid',
      paidAmount: 0,
    }));
    setInstallments(next);
  }

  async function handleSubmit() {
    await onSave({ feeItems, scholarships, installments });
  }

  const studentLabel = [studentFee.studentName?.trim(), studentFee.className].filter(Boolean).join(' · ') || studentFee.className;

  return (
    <Drawer open={open} onOpenChange={(next) => !next && onClose()} direction="right">
      <DrawerContent className={DRAWER_CONTENT_CLASS}>
        <div className="flex h-full min-h-0 flex-col">
          <DrawerHeader className="border-b border-slate-100 px-5 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-600">
                  <HiOutlineBanknotes size={18} />
                </div>
                <div className="min-w-0 text-left">
                  <DrawerTitle className="text-base font-black text-slate-900">
                    กำหนดค่าเทอม / ทุนการศึกษา
                  </DrawerTitle>
                  <DrawerDescription className="text-xs font-semibold text-slate-500">
                    {studentLabel}
                  </DrawerDescription>
                </div>
              </div>
              <DrawerClose asChild>
                <button
                  type="button"
                  className="flex size-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50"
                  aria-label="ปิด"
                >
                  <HiXMark className="h-4 w-4" />
                </button>
              </DrawerClose>
            </div>
          </DrawerHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            <div className="space-y-4">
              <div>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <label className={sectionLabelCls}>รายการค่าใช้จ่าย</label>
                  <button
                    type="button"
                    onClick={() => setFeeItems((prev) => [...prev, { id: makeId(), label: '', amount: 0 }])}
                    className="text-[11px] font-bold text-blue-600 hover:text-blue-700"
                  >
                    + เพิ่มรายการ
                  </button>
                </div>
                <div className="space-y-2">
                  {feeItems.map((item, idx) => (
                    <div key={item.id} className="flex items-center gap-2">
                      <input
                        value={item.label}
                        onChange={(e) => setFeeItems((prev) => prev.map((f, i) => (i === idx ? { ...f, label: e.target.value } : f)))}
                        placeholder="ชื่อรายการ เช่น ค่าธรรมเนียมการศึกษา"
                        className={cn(inputCls, 'flex-1')}
                      />
                      <input
                        type="number"
                        value={item.amount}
                        onChange={(e) => setFeeItems((prev) => prev.map((f, i) => (i === idx ? { ...f, amount: Number(e.target.value) } : f)))}
                        className={cn(inputCls, 'w-28 text-right tabular-nums')}
                      />
                      <button
                        type="button"
                        onClick={() => setFeeItems((prev) => prev.filter((_, i) => i !== idx))}
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-300 hover:bg-rose-50 hover:text-rose-500"
                      >
                        <HiOutlineTrash size={15} />
                      </button>
                    </div>
                  ))}
                </div>
                <p className="mt-1.5 text-right text-[11px] font-semibold text-slate-500">รวม {formatTHB(totalFee)}</p>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <label className={sectionLabelCls}>ทุนการศึกษา / ส่วนลด</label>
                  <button
                    type="button"
                    onClick={() => setScholarships((prev) => [...prev, { id: makeId(), label: '', type: 'percentage', value: 0 }])}
                    className="text-[11px] font-bold text-blue-600 hover:text-blue-700"
                  >
                    + เพิ่มทุน
                  </button>
                </div>
                {scholarships.length === 0 && (
                  <p className="mb-2 text-[11px] font-semibold text-slate-400">ไม่มีทุนการศึกษา</p>
                )}
                <div className="space-y-2">
                  {scholarships.map((s, idx) => (
                    <div key={s.id} className="flex items-center gap-2">
                      <input
                        value={s.label}
                        onChange={(e) => setScholarships((prev) => prev.map((row, i) => (i === idx ? { ...row, label: e.target.value } : row)))}
                        placeholder="ชื่อทุน เช่น ทุนเรียนดี"
                        className={cn(inputCls, 'flex-1')}
                      />
                      <select
                        value={s.type}
                        onChange={(e) => setScholarships((prev) => prev.map((row, i) => (i === idx ? { ...row, type: e.target.value as Scholarship['type'] } : row)))}
                        className={cn(inputCls, 'w-28 appearance-none')}
                      >
                        <option value="percentage">เปอร์เซ็นต์</option>
                        <option value="fixed">จำนวนเงิน</option>
                      </select>
                      <input
                        type="number"
                        value={s.value}
                        onChange={(e) => setScholarships((prev) => prev.map((row, i) => (i === idx ? { ...row, value: Number(e.target.value) } : row)))}
                        className={cn(inputCls, 'w-24 text-right tabular-nums')}
                      />
                      <button
                        type="button"
                        onClick={() => setScholarships((prev) => prev.filter((_, i) => i !== idx))}
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-300 hover:bg-rose-50 hover:text-rose-500"
                      >
                        <HiOutlineTrash size={15} />
                      </button>
                    </div>
                  ))}
                </div>
                <p className="mt-1.5 text-right text-[11px] font-semibold text-emerald-600">
                  ส่วนลดรวม −{formatTHB(totalDiscount)}
                </p>
              </div>

              <div>
                <label className={sectionLabelCls}>แผนผ่อนชำระ</label>
                <div className="mb-2 flex flex-wrap items-center gap-1.5">
                  {[2, 3, 4].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => splitEvenly(n)}
                      className={cn(inputCls, 'h-9 w-auto px-3 text-[11px] font-bold text-slate-500 hover:text-slate-700')}
                    >
                      แบ่ง {n} งวด
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() =>
                      setInstallments((prev) => [
                        ...prev,
                        {
                          id: makeId(),
                          label: `งวดที่ ${prev.length + 1}`,
                          amount: 0,
                          dueDate: '',
                          status: 'unpaid',
                          paidAmount: 0,
                        },
                      ])
                    }
                    className="text-[11px] font-bold text-blue-600 hover:text-blue-700"
                  >
                    + เพิ่มงวด
                  </button>
                </div>
                {installments.length === 0 && (
                  <p className="mb-2 text-[11px] font-semibold text-slate-400">
                    ชำระเต็มจำนวนครั้งเดียว (ไม่มีการแบ่งงวด)
                  </p>
                )}
                <div className="space-y-2">
                  {installments.map((inst, idx) => (
                    <div key={inst.id} className="flex items-center gap-2">
                      <input
                        value={inst.label}
                        onChange={(e) => setInstallments((prev) => prev.map((row, i) => (i === idx ? { ...row, label: e.target.value } : row)))}
                        className={cn(inputCls, 'w-28')}
                      />
                      <input
                        type="number"
                        value={inst.amount}
                        onChange={(e) => setInstallments((prev) => prev.map((row, i) => (i === idx ? { ...row, amount: Number(e.target.value) } : row)))}
                        className={cn(inputCls, 'w-24 text-right tabular-nums')}
                      />
                      <input
                        type="date"
                        value={inst.dueDate}
                        onChange={(e) => setInstallments((prev) => prev.map((row, i) => (i === idx ? { ...row, dueDate: e.target.value } : row)))}
                        className={cn(inputCls, 'flex-1')}
                      />
                      <button
                        type="button"
                        onClick={() => setInstallments((prev) => prev.filter((_, i) => i !== idx))}
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-300 hover:bg-rose-50 hover:text-rose-500"
                      >
                        <HiOutlineTrash size={15} />
                      </button>
                    </div>
                  ))}
                </div>
                {installmentMismatch && (
                  <p className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold text-amber-600">
                    <HiOutlineExclamationTriangle size={13} />
                    ยอดรวมงวด ({formatTHB(installmentSum)}) ไม่เท่ากับยอดสุทธิ ({formatTHB(netPayable)})
                  </p>
                )}
              </div>

              <div className="rounded-xl bg-slate-50 px-3.5 py-3 text-right">
                <p className={cn(sectionLabelCls, 'mb-1')}>ยอดสุทธิที่ต้องชำระ</p>
                <p className="text-base font-black text-slate-800">{formatTHB(netPayable)}</p>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-100 px-5 py-4">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="h-10 flex-1 rounded-xl text-sm font-bold text-slate-500 transition-colors hover:bg-slate-50"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={isSaving || !canSave}
                className="h-10 flex-[2] rounded-xl bg-blue-600 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition-all hover:bg-blue-700 active:scale-[0.98] disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
              >
                บันทึก
              </button>
            </div>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
