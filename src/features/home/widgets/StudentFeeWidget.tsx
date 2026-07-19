import { useMemo, useState } from 'react';
import {
  HiOutlineBanknotes,
  HiOutlineArrowUpTray,
  HiOutlineCheckCircle,
  HiXMark,
} from 'react-icons/hi2';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { cn } from '@/lib/utils';
import { useMyStudentFee } from '@/features/tuition/hooks/useStudentFees';
import { usePaymentTransactions } from '@/features/tuition/hooks/usePaymentTransactions';
import { formatTHB } from '@/features/tuition/tuitionCalc';
import { WidgetSkeleton } from '../components/WidgetSkeleton';
import { WIDGET_GLASS, WIDGET_CARD } from '../widgetStyles';
import type { Installment, PaymentStatus } from '@/types/tuition';

const DRAWER_CONTENT_CLASS = [
  'h-dvh flex flex-col p-0 rounded-none',
  'data-[vaul-drawer-direction=right]:w-screen data-[vaul-drawer-direction=right]:max-w-none',
  'data-[vaul-drawer-direction=right]:before:inset-0 data-[vaul-drawer-direction=right]:before:rounded-none',
  'sm:h-full sm:rounded-l-3xl',
  'sm:data-[vaul-drawer-direction=right]:w-full sm:data-[vaul-drawer-direction=right]:max-w-md',
  'sm:data-[vaul-drawer-direction=right]:before:inset-2 sm:data-[vaul-drawer-direction=right]:before:rounded-4xl',
].join(' ');

const STATUS_LABEL: Record<PaymentStatus, string> = {
  unpaid: 'ยังไม่ชำระ',
  partial: 'ชำระบางส่วน',
  pending_verification: 'รอตรวจสอบ',
  paid: 'ชำระครบแล้ว',
};

const STATUS_TONE: Record<PaymentStatus, string> = {
  unpaid: 'text-rose-600 bg-rose-50',
  partial: 'text-amber-600 bg-amber-50',
  pending_verification: 'text-sky-600 bg-sky-50',
  paid: 'text-emerald-600 bg-emerald-50',
};

function nextPayableInstallment(installments: Installment[]): Installment | null {
  return installments.find((i) => i.status === 'unpaid' || i.status === 'partial') ?? null;
}

function UploadSlipForm({
  amount,
  onSubmit,
  isUploading,
}: {
  amount: number;
  onSubmit: (file: File, amount: number) => Promise<void>;
  isUploading: boolean;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [customAmount, setCustomAmount] = useState(amount);
  const [submitted, setSubmitted] = useState(false);

  if (submitted) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl bg-emerald-50 px-4 py-6 text-center">
        <HiOutlineCheckCircle size={28} className="text-emerald-500" />
        <p className="text-sm font-bold text-emerald-700">ส่งสลิปแล้ว รอเจ้าหน้าที่ตรวจสอบ</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-2xl border border-black/[0.06] bg-white/70 p-4">
      <div>
        <label className="mb-1 block text-[11px] font-semibold uppercase text-black/40">จำนวนเงินที่โอน</label>
        <input
          type="number"
          value={customAmount}
          onChange={(e) => setCustomAmount(Number(e.target.value))}
          className="h-9 w-full rounded-lg border border-black/[0.08] bg-white px-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-100"
        />
      </div>

      <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-black/10 px-4 py-6 text-center hover:border-indigo-300 hover:bg-indigo-50/30">
        <HiOutlineArrowUpTray size={22} className="text-black/30" />
        <span className="text-xs font-semibold text-black/50">
          {file ? file.name : 'แตะเพื่อเลือกรูปสลิปการโอนเงิน'}
        </span>
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </label>

      <button
        type="button"
        disabled={!file || customAmount <= 0 || isUploading}
        onClick={async () => {
          if (!file) return;
          await onSubmit(file, customAmount);
          setSubmitted(true);
        }}
        className="h-9 w-full rounded-full bg-indigo-600 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-40"
      >
        {isUploading ? 'กำลังอัปโหลด...' : 'ส่งหลักฐานการชำระเงิน'}
      </button>
    </div>
  );
}

export default function StudentFeeWidget() {
  const { studentFee, isLoading } = useMyStudentFee();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { uploadSlip, isUploading } = usePaymentTransactions(drawerOpen ? studentFee?.id ?? null : null);

  const nextInstallment = useMemo(
    () => (studentFee ? nextPayableInstallment(studentFee.installments) : null),
    [studentFee],
  );
  const remaining = studentFee ? studentFee.netPayable - studentFee.totalPaid : 0;
  const suggestedAmount = nextInstallment ? nextInstallment.amount - nextInstallment.paidAmount : remaining;
  const hasDue = !!studentFee && studentFee.status !== 'paid' && remaining > 0;

  if (isLoading) return <WidgetSkeleton variant="list" />;

  return (
    <>
      <button
        type="button"
        onClick={() => setDrawerOpen(true)}
        className={cn(WIDGET_CARD, 'text-left transition-transform active:scale-[0.98]')}
        style={WIDGET_GLASS}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
              <HiOutlineBanknotes size={16} />
            </div>
            <div>
              <p className="text-xs font-black text-slate-800">ค่าเทอม</p>
              <p className="text-[10px] text-slate-400">
                {studentFee?.className ?? 'ค่าใช้จ่ายการศึกษา'}
              </p>
            </div>
          </div>
          {studentFee ? (
            <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold', STATUS_TONE[studentFee.status])}>
              {STATUS_LABEL[studentFee.status]}
            </span>
          ) : null}
        </div>

        <div className="flex flex-1 flex-col items-center justify-center">
          {studentFee ? (
            <>
              <p className="text-lg font-black tabular-nums text-slate-800">
                {hasDue ? formatTHB(remaining) : formatTHB(0)}
              </p>
              <p className="text-[10px] text-slate-400">{hasDue ? 'ยอดคงเหลือที่ต้องชำระ' : 'ไม่มียอดค้างชำระ'}</p>
            </>
          ) : (
            <>
              <p className="text-sm font-black text-slate-500">ยังไม่มีข้อมูล</p>
              <p className="text-[10px] text-slate-400">แตะเพื่อดูรายละเอียด</p>
            </>
          )}
        </div>
      </button>

      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen} direction="right">
        <DrawerContent className={DRAWER_CONTENT_CLASS}>
          <DrawerHeader className="px-4 pb-2">
            <div className="flex items-center justify-between">
              <div>
                <DrawerTitle className="text-base font-black text-slate-800">ค่าเทอมของฉัน</DrawerTitle>
                <DrawerDescription className="text-xs text-slate-500">
                  {studentFee?.className ?? 'รายละเอียดค่าใช้จ่ายการศึกษา'}
                </DrawerDescription>
              </div>
              <button onClick={() => setDrawerOpen(false)} className="rounded-full p-1.5 hover:bg-slate-100">
                <HiXMark size={18} className="text-slate-400" />
              </button>
            </div>
          </DrawerHeader>

          <div className="flex-1 space-y-4 overflow-y-auto px-4 pb-6">
            {!studentFee ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
                <p className="text-sm font-bold text-slate-600">ยังไม่มีข้อมูลค่าเทอมในภาคเรียนนี้</p>
                <p className="mt-1 text-xs text-slate-400">
                  หากมีค่าใช้จ่ายแล้ว กรุณาติดต่อเจ้าหน้าที่การเงิน
                </p>
              </div>
            ) : (
            <>
            <div className="rounded-2xl bg-indigo-50/60 px-4 py-3 text-center">
              <p className="text-[11px] font-semibold text-black/40">ยอดคงเหลือที่ต้องชำระ</p>
              <p className="text-2xl font-black text-indigo-700">{formatTHB(Math.max(remaining, 0))}</p>
              <span className={cn('mt-1 inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold', STATUS_TONE[studentFee.status])}>
                {STATUS_LABEL[studentFee.status]}
              </span>
            </div>

            <section>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-black/50">รายการค่าใช้จ่าย</h3>
              <div className="space-y-1.5">
                {studentFee.feeItems.map((item) => (
                  <div key={item.id} className="flex justify-between text-xs text-slate-600">
                    <span>{item.label}</span>
                    <span className="tabular-nums">{formatTHB(item.amount)}</span>
                  </div>
                ))}
                <div className="flex justify-between border-t border-black/[0.06] pt-1.5 text-xs font-semibold text-slate-700">
                  <span>รวม</span>
                  <span className="tabular-nums">{formatTHB(studentFee.totalFee)}</span>
                </div>
                {studentFee.scholarships.map((s) => (
                  <div key={s.id} className="flex justify-between text-xs text-emerald-600">
                    <span>{s.label}</span>
                    <span className="tabular-nums">
                      −{formatTHB(s.type === 'percentage' ? (studentFee.totalFee * s.value) / 100 : s.value)}
                    </span>
                  </div>
                ))}
                <div className="flex justify-between border-t border-black/[0.06] pt-1.5 text-sm font-black text-slate-800">
                  <span>ยอดสุทธิ</span>
                  <span className="tabular-nums">{formatTHB(studentFee.netPayable)}</span>
                </div>
              </div>
            </section>

            {studentFee.installments.length > 0 && (
              <section>
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-black/50">แผนผ่อนชำระ</h3>
                <div className="space-y-1.5">
                  {studentFee.installments.map((inst) => (
                    <div key={inst.id} className="flex items-center justify-between rounded-xl bg-white/60 px-3 py-2 text-xs">
                      <div>
                        <p className="font-semibold text-slate-700">{inst.label}</p>
                        {inst.dueDate && <p className="text-[10px] text-slate-400">กำหนดชำระ {inst.dueDate}</p>}
                      </div>
                      <div className="text-right">
                        <p className="tabular-nums font-semibold text-slate-700">{formatTHB(inst.amount)}</p>
                        <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold', STATUS_TONE[inst.status])}>
                          {STATUS_LABEL[inst.status]}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {hasDue && (
              <section>
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-black/50">แจ้งชำระเงิน</h3>
                <UploadSlipForm
                  amount={Math.max(suggestedAmount, 0)}
                  isUploading={isUploading}
                  onSubmit={async (file, amount) => {
                    await uploadSlip({
                      studentFee,
                      installmentId: nextInstallment?.id ?? null,
                      amount,
                      file,
                      studentId: studentFee.studentId,
                    });
                  }}
                />
              </section>
            )}
            </>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
