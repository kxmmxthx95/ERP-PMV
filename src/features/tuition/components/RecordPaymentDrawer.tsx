import { useEffect, useMemo, useRef, useState } from 'react';
import { HiOutlineBanknotes, HiOutlineCalendarDays, HiOutlinePhoto, HiXMark } from 'react-icons/hi2';
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
import { formatTHB } from '../tuitionCalc';
import type { StudentFee } from '@/types/tuition';

const DRAWER_CONTENT_CLASS = cn(
  'h-dvh flex flex-col p-0 rounded-none bg-white/95 backdrop-blur-xl',
  'data-[vaul-drawer-direction=right]:w-screen data-[vaul-drawer-direction=right]:max-w-none',
  'data-[vaul-drawer-direction=right]:before:inset-0 data-[vaul-drawer-direction=right]:before:rounded-none',
  'sm:h-full sm:rounded-l-3xl',
  'sm:data-[vaul-drawer-direction=right]:w-full sm:data-[vaul-drawer-direction=right]:max-w-md',
  'sm:data-[vaul-drawer-direction=right]:before:inset-2 sm:data-[vaul-drawer-direction=right]:before:rounded-4xl',
);

const inputCls = cn(modalInputCls, 'h-10 rounded-xl border-none px-3.5 text-xs font-bold');
const labelCls = cn(modalLabelCls, 'mb-1.5 px-0 tracking-wider');

function todayDateString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatThaiDateLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return dateStr;
  return new Date(y, m - 1, d).toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

interface RecordPaymentDrawerProps {
  open: boolean;
  onClose: () => void;
  studentFee: StudentFee | null;
  onSave: (input: { paymentAmount: number; paymentDate: string; slipFile?: File }) => Promise<void>;
  isSaving?: boolean;
}

export default function RecordPaymentDrawer({
  open,
  onClose,
  studentFee,
  onSave,
  isSaving,
}: RecordPaymentDrawerProps) {
  const [paymentAmountInput, setPaymentAmountInput] = useState('');
  const [paymentDate, setPaymentDate] = useState(todayDateString);
  const [slipFile, setSlipFile] = useState<File | null>(null);
  const [slipPreview, setSlipPreview] = useState<string | null>(null);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);

  const outstanding = studentFee ? Math.max(studentFee.netPayable - studentFee.totalPaid, 0) : 0;
  const maxPaymentDate = todayDateString();

  useEffect(() => {
    if (!open || !studentFee) return;
    setPaymentAmountInput(String(outstanding > 0 ? outstanding : ''));
    setPaymentDate(todayDateString());
    setSlipFile(null);
    setSlipPreview(null);
    setError('');
  }, [open, studentFee, outstanding]);

  useEffect(() => {
    if (!slipFile) {
      setSlipPreview(null);
      return;
    }
    const url = URL.createObjectURL(slipFile);
    setSlipPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [slipFile]);

  const paymentAmount = useMemo(() => Number(paymentAmountInput.replace(/,/g, '')), [paymentAmountInput]);
  const remainingAfter = studentFee
    ? Math.max(studentFee.netPayable - studentFee.totalPaid - (Number.isFinite(paymentAmount) ? paymentAmount : 0), 0)
    : 0;

  if (!studentFee) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!studentFee) return;

    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
      setError('กรุณาระบุยอดชำระที่มากกว่า 0');
      return;
    }
    if (paymentAmount > outstanding) {
      setError('ยอดชำระเกินยอดค้างชำระ');
      return;
    }
    if (!paymentDate) {
      setError('กรุณาเลือกวันที่ชำระ');
      return;
    }

    try {
      await onSave({ paymentAmount, paymentDate, slipFile: slipFile ?? undefined });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ');
    }
  }

  return (
    <Drawer open={open} onOpenChange={(next) => !next && onClose()} direction="right">
      <DrawerContent className={DRAWER_CONTENT_CLASS}>
        <form onSubmit={handleSubmit} className="flex h-full min-h-0 flex-col">
          <DrawerHeader className="border-b border-slate-100 px-5 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600">
                  <HiOutlineBanknotes size={18} />
                </div>
                <div className="min-w-0 text-left">
                  <DrawerTitle className="text-base font-black text-slate-900">
                    บันทึกการชำระเงิน
                  </DrawerTitle>
                  <DrawerDescription className="text-xs font-semibold text-slate-500">
                    {studentFee.studentName} · {studentFee.className}
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

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-2xl border border-slate-100 bg-slate-50/80 px-3 py-2.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">ยอดสุทธิ</p>
                <p className="mt-0.5 text-sm font-black text-slate-800">{formatTHB(studentFee.netPayable)}</p>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50/80 px-3 py-2.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">ชำระแล้ว</p>
                <p className="mt-0.5 text-sm font-black text-slate-800">{formatTHB(studentFee.totalPaid)}</p>
              </div>
              <div className="rounded-2xl border border-rose-100 bg-rose-50/60 px-3 py-2.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-rose-400">ค้างชำระ</p>
                <p className="mt-0.5 text-sm font-black text-rose-600">{formatTHB(outstanding)}</p>
              </div>
            </div>

            <div>
              <label className={labelCls}>ยอดชำระครั้งนี้ (บาท)</label>
              <input
                type="number"
                min={1}
                max={outstanding}
                step={1}
                value={paymentAmountInput}
                onChange={(e) => setPaymentAmountInput(e.target.value)}
                className={inputCls}
                required
              />
              <p className="mt-1.5 text-[11px] font-semibold text-slate-400">
                หลังชำระจะคงเหลือ {formatTHB(remainingAfter)}
              </p>
            </div>

            <div>
              <label className={labelCls}>วันที่ชำระ</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={formatThaiDateLabel(paymentDate)}
                  className={cn(inputCls, 'flex-1 cursor-default bg-slate-50/80')}
                />
                <button
                  type="button"
                  onClick={() => {
                    dateInputRef.current?.showPicker?.();
                    dateInputRef.current?.click();
                  }}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 transition-colors hover:bg-slate-200"
                  title="เลือกวันที่ชำระ"
                  aria-label="เลือกวันที่ชำระ"
                >
                  <HiOutlineCalendarDays size={18} />
                </button>
                <input
                  ref={dateInputRef}
                  type="date"
                  value={paymentDate}
                  max={maxPaymentDate}
                  onChange={(e) => {
                    if (e.target.value) setPaymentDate(e.target.value);
                  }}
                  className="sr-only"
                  tabIndex={-1}
                  aria-hidden
                />
              </div>
            </div>

            <div>
              <label className={labelCls}>อัปโหลดหลักฐาน (ถ้ามี)</label>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-6 transition-colors hover:bg-slate-100/80"
              >
                {slipPreview ? (
                  <img
                    src={slipPreview}
                    alt="ตัวอย่างสลิป"
                    className="max-h-40 w-full rounded-xl object-contain"
                  />
                ) : (
                  <>
                    <HiOutlinePhoto size={24} className="text-slate-400" />
                    <span className="text-[11px] font-bold text-slate-500">คลิกเพื่อเลือกรูปสลิป</span>
                  </>
                )}
              </button>
              {slipFile && (
                <div className="mt-2 flex items-center justify-between gap-2">
                  <p className="truncate text-[11px] font-semibold text-slate-500">{slipFile.name}</p>
                  <button
                    type="button"
                    onClick={() => setSlipFile(null)}
                    className="shrink-0 text-[11px] font-bold text-rose-500 hover:text-rose-600"
                  >
                    ลบ
                  </button>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => setSlipFile(e.target.files?.[0] ?? null)}
              />
            </div>

            {error && (
              <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600">{error}</p>
            )}
          </div>

          <div className="shrink-0 border-t border-slate-100 px-5 py-4">
            <button
              type="submit"
              disabled={isSaving || outstanding <= 0}
              className="h-10 w-full rounded-xl bg-emerald-600 text-sm font-black text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
            >
              {isSaving ? 'กำลังบันทึก...' : 'บันทึกการชำระ'}
            </button>
          </div>
        </form>
      </DrawerContent>
    </Drawer>
  );
}
