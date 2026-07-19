import { HiOutlineClock, HiOutlinePhoto, HiXMark } from 'react-icons/hi2';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { cn } from '@/lib/utils';
import { usePaymentTransactions } from '../hooks/usePaymentTransactions';
import { formatTHB } from '../tuitionCalc';
import type { PaymentTransaction, PaymentTransactionStatus, StudentFee } from '@/types/tuition';

const DRAWER_CONTENT_CLASS = cn(
  'h-dvh flex flex-col p-0 rounded-none bg-white/95 backdrop-blur-xl',
  'data-[vaul-drawer-direction=right]:w-screen data-[vaul-drawer-direction=right]:max-w-none',
  'data-[vaul-drawer-direction=right]:before:inset-0 data-[vaul-drawer-direction=right]:before:rounded-none',
  'sm:h-full sm:rounded-l-3xl',
  'sm:data-[vaul-drawer-direction=right]:w-full sm:data-[vaul-drawer-direction=right]:max-w-md',
  'sm:data-[vaul-drawer-direction=right]:before:inset-2 sm:data-[vaul-drawer-direction=right]:before:rounded-4xl',
);

const TX_STATUS_CONFIG: Record<PaymentTransactionStatus, { label: string; bg: string; text: string }> = {
  approved: { label: 'อนุมัติแล้ว', bg: 'bg-emerald-50', text: 'text-emerald-600' },
  pending_verification: { label: 'รอตรวจสอบ', bg: 'bg-sky-50', text: 'text-sky-600' },
  rejected: { label: 'ปฏิเสธ', bg: 'bg-rose-50', text: 'text-rose-600' },
};

function formatPaymentDate(tx: PaymentTransaction): string {
  const iso = tx.status === 'approved' && tx.verifiedAt ? tx.verifiedAt : tx.submittedAt;
  return new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
}

interface PaymentHistoryDrawerProps {
  open: boolean;
  onClose: () => void;
  studentFee: StudentFee | null;
  onPreviewSlip?: (url: string) => void;
}

export default function PaymentHistoryDrawer({
  open,
  onClose,
  studentFee,
  onPreviewSlip,
}: PaymentHistoryDrawerProps) {
  const { transactions, isLoading } = usePaymentTransactions(open && studentFee ? studentFee.id : null);

  if (!studentFee) return null;

  const approvedTotal = transactions
    .filter((tx) => tx.status === 'approved')
    .reduce((sum, tx) => sum + tx.amount, 0);

  return (
    <Drawer open={open} onOpenChange={(next) => !next && onClose()} direction="right">
      <DrawerContent className={DRAWER_CONTENT_CLASS}>
        <div className="flex h-full min-h-0 flex-col">
          <DrawerHeader className="border-b border-slate-100 px-5 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-slate-500/10 text-slate-600">
                  <HiOutlineClock size={18} />
                </div>
                <div className="min-w-0 text-left">
                  <DrawerTitle className="text-base font-black text-slate-900">
                    ประวัติการชำระเงิน
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

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            <div className="mb-4 grid grid-cols-2 gap-2">
              <div className="rounded-2xl border border-slate-100 bg-slate-50/80 px-3 py-2.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">ชำระแล้วรวม</p>
                <p className="mt-0.5 text-sm font-black text-emerald-600">{formatTHB(studentFee.totalPaid)}</p>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50/80 px-3 py-2.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">จำนวนครั้ง</p>
                <p className="mt-0.5 text-sm font-black text-slate-800">{transactions.length}</p>
              </div>
            </div>

            {isLoading && (
              <p className="py-10 text-center text-xs font-semibold text-slate-400">กำลังโหลดประวัติ...</p>
            )}

            {!isLoading && transactions.length === 0 && (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-10 text-center">
                <p className="text-sm font-bold text-slate-500">ยังไม่มีประวัติการชำระเงิน</p>
                <p className="mt-1 text-[11px] font-semibold text-slate-400">รายการจะแสดงเมื่อมีการบันทึกหรืออัปโหลดสลิป</p>
              </div>
            )}

            {!isLoading && transactions.length > 0 && (
              <div className="space-y-2">
                {transactions.map((tx) => {
                  const statusCfg = TX_STATUS_CONFIG[tx.status];
                  const installment = tx.installmentId
                    ? studentFee.installments.find((i) => i.id === tx.installmentId)
                    : null;

                  return (
                    <div
                      key={tx.id}
                      className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-white px-3 py-3 shadow-sm"
                    >
                      {tx.slipUrl ? (
                        <button
                          type="button"
                          onClick={() => onPreviewSlip?.(tx.slipUrl)}
                          className="group relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-slate-100 bg-slate-50"
                          title="ดูสลิปหลักฐาน"
                        >
                          <img src={tx.slipUrl} alt="สลิป" className="h-full w-full object-cover" />
                          <span className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/20">
                            <HiOutlinePhoto size={14} className="text-white opacity-0 transition-opacity group-hover:opacity-100" />
                          </span>
                        </button>
                      ) : (
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
                          <HiOutlinePhoto size={18} />
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-black tabular-nums text-slate-800">{formatTHB(tx.amount)}</p>
                          <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold', statusCfg.bg, statusCfg.text)}>
                            {statusCfg.label}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[11px] font-semibold text-slate-500">
                          {formatPaymentDate(tx)}
                          {installment ? ` · ${installment.label}` : ''}
                        </p>
                        {tx.verifiedByName && tx.status === 'approved' && (
                          <p className="mt-0.5 text-[10px] text-slate-400">บันทึกโดย {tx.verifiedByName}</p>
                        )}
                        {tx.status === 'rejected' && tx.rejectionReason && (
                          <p className="mt-1 text-[10px] font-semibold text-rose-500">{tx.rejectionReason}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {!isLoading && approvedTotal > 0 && approvedTotal !== studentFee.totalPaid && (
              <p className="mt-3 text-[10px] font-semibold text-amber-600">
                ยอดอนุมัติรวม ({formatTHB(approvedTotal)}) อาจไม่ตรงกับยอดชำระในระเบียน ({formatTHB(studentFee.totalPaid)})
              </p>
            )}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
