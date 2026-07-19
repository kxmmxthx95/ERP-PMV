import { useState } from 'react';
import { HiOutlineDocumentMagnifyingGlass, HiCheck, HiXMark } from 'react-icons/hi2';
import FormModal from '@/components/ui/FormModal';
import { formatTHB } from '../tuitionCalc';
import type { PaymentTransaction, StudentFee } from '@/types/tuition';

interface SlipReviewModalProps {
  open: boolean;
  onClose: () => void;
  studentFee: StudentFee | null;
  transaction: PaymentTransaction | null;
  onVerify: (approve: boolean, rejectionReason?: string) => Promise<void>;
  isVerifying?: boolean;
}

export default function SlipReviewModal({ open, onClose, studentFee, transaction, onVerify, isVerifying }: SlipReviewModalProps) {
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);

  if (!studentFee || !transaction) return null;

  const installment = transaction.installmentId
    ? studentFee.installments.find((i) => i.id === transaction.installmentId)
    : null;

  return (
    <FormModal
      open={open}
      onClose={() => { setShowRejectForm(false); setRejectionReason(''); onClose(); }}
      title="ตรวจสอบสลิปการชำระเงิน"
      subtitle={`${studentFee.studentName} · ${installment ? installment.label : 'ชำระเต็มจำนวน'}`}
      icon={<HiOutlineDocumentMagnifyingGlass size={18} />}
      onSubmit={() => onVerify(true)}
      submitLabel="อนุมัติ"
      submitClassName="bg-emerald-600 hover:bg-emerald-700"
      submitDisabled={isVerifying || showRejectForm}
      maxWidth="md"
      footerNote={
        !showRejectForm && (
          <button
            type="button"
            onClick={() => setShowRejectForm(true)}
            className="text-[11px] font-bold text-rose-500 hover:text-rose-600"
          >
            ปฏิเสธสลิปนี้
          </button>
        )
      }
    >
      <div className="space-y-4 px-5 sm:px-6 py-4">
        <div className="overflow-hidden rounded-2xl border border-black/[0.08] bg-slate-50">
          <img src={transaction.slipUrl} alt="สลิปการชำระเงิน" className="max-h-96 w-full object-contain" />
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="rounded-xl bg-white/70 px-3 py-2 border border-black/[0.05]">
            <p className="text-[10px] font-semibold uppercase text-black/40">ยอดที่แจ้ง</p>
            <p className="text-sm font-bold text-slate-700">{formatTHB(transaction.amount)}</p>
          </div>
          <div className="rounded-xl bg-white/70 px-3 py-2 border border-black/[0.05]">
            <p className="text-[10px] font-semibold uppercase text-black/40">วันที่อัปโหลด</p>
            <p className="text-sm font-bold text-slate-700">
              {new Date(transaction.submittedAt).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })}
            </p>
          </div>
        </div>

        {showRejectForm && (
          <div className="space-y-2 rounded-2xl border border-rose-100 bg-rose-50/60 p-3">
            <label className="block text-[11px] font-semibold text-rose-600">เหตุผลที่ปฏิเสธ</label>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={2}
              placeholder="เช่น ยอดเงินไม่ตรง / สลิปไม่ชัดเจน"
              className="w-full rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-rose-100"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowRejectForm(false)}
                className="rounded-full px-3 py-1.5 text-[11px] font-semibold text-slate-500 hover:bg-slate-100"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={isVerifying}
                onClick={() => onVerify(false, rejectionReason)}
                className="flex items-center gap-1 rounded-full bg-rose-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-rose-700 disabled:opacity-50"
              >
                <HiXMark size={13} /> ยืนยันปฏิเสธ
              </button>
            </div>
          </div>
        )}

        {!showRejectForm && (
          <p className="flex items-center gap-1.5 text-[11px] text-black/40">
            <HiCheck size={13} className="text-emerald-500" />
            กด "อนุมัติ" เพื่อยืนยันว่าตรวจสอบสลิปแล้วและยอดเงินถูกต้อง
          </p>
        )}
      </div>
    </FormModal>
  );
}
