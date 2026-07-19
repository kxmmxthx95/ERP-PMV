import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addDoc,
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  updateDoc,
  where,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { logActivity } from '@/lib/activityLogger';
import { recomputeStudentFeeTotals } from './useStudentFees';
import { applyTotalPaidToInstallments } from '../tuitionCalc';
import type { Installment, PaymentTransaction, StudentFee } from '@/types/tuition';

const COLLECTION = 'payment_transactions';
const STUDENT_FEES_COLLECTION = 'student_fees';

/** Admin: ธุรกรรมชำระเงินทั้งหมดของรอบเก็บค่าเทอม (campaign) หนึ่งรอบ — ใช้ในหน้ารายชื่อนักเรียน */
export function useTransactionsForCampaign(campaignId: string | null) {
  return useQuery({
    queryKey: ['campaignPaymentTransactions', campaignId],
    queryFn: async () => {
      const q = query(collection(db, COLLECTION), where('campaignId', '==', campaignId));
      const snap = await getDocs(q);
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as PaymentTransaction);
    },
    enabled: !!campaignId,
  });
}

/** ประวัติการอัปโหลดสลิปของค่าเทอมรายการหนึ่ง */
export function usePaymentTransactions(studentFeeId: string | null) {
  const queryClient = useQueryClient();
  const queryKey = ['paymentTransactions', studentFeeId];

  const transactionsQuery = useQuery({
    queryKey,
    queryFn: async () => {
      const q = query(
        collection(db, COLLECTION),
        where('studentFeeId', '==', studentFeeId),
        orderBy('submittedAt', 'desc'),
      );
      const snap = await getDocs(q);
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as PaymentTransaction);
    },
    enabled: !!studentFeeId,
  });

  /** อัปโหลดสลิปขึ้น Firebase Storage แล้วบันทึกอ้างอิงใน Firestore + ตั้งสถานะรอตรวจสอบ */
  const uploadSlip = useMutation({
    mutationFn: async ({
      studentFee,
      installmentId,
      amount,
      file,
      studentId,
    }: {
      studentFee: StudentFee;
      installmentId: string | null;
      amount: number;
      file: File;
      studentId: string;
    }) => {
      const storagePath = `tuition_slips/${studentFee.academicYearId}/${studentFee.id}/${Date.now()}_${file.name}`;
      const storageRef = ref(storage, storagePath);
      await uploadBytes(storageRef, file);
      const slipUrl = await getDownloadURL(storageRef);

      const txRef = await addDoc(collection(db, COLLECTION), {
        campaignId: studentFee.campaignId,
        studentFeeId: studentFee.id,
        installmentId,
        studentId,
        academicYearId: studentFee.academicYearId,
        term: studentFee.term,
        amount,
        slipUrl,
        slipStoragePath: storagePath,
        status: 'pending_verification',
        submittedAt: new Date().toISOString(),
      });

      // ตั้งงวด (ถ้ามี) หรือสถานะรวมเป็น "รอตรวจสอบ" ทันทีที่อัปโหลด
      const installments = installmentId
        ? studentFee.installments.map((i) => (i.id === installmentId ? { ...i, status: 'pending_verification' as const } : i))
        : studentFee.installments;
      const nextStatus = installmentId
        ? recomputeStudentFeeTotals({ feeItems: studentFee.feeItems, scholarships: studentFee.scholarships, installments }).status
        : 'pending_verification';

      await updateDoc(doc(db, STUDENT_FEES_COLLECTION, studentFee.id), {
        installments,
        status: nextStatus,
        updatedAt: new Date().toISOString(),
      });

      await logActivity({
        action: 'tuition_slip_upload',
        category: 'data',
        targetId: txRef.id,
        detail: `อัปโหลดสลิปชำระเงินค่าเทอม ${amount.toLocaleString('th-TH')} บาท`,
      });

      return txRef.id;
    },
    onSuccess: (_id, variables) => {
      queryClient.invalidateQueries({ queryKey: ['paymentTransactions', variables.studentFee.id] });
      queryClient.invalidateQueries({ queryKey: ['campaignPaymentTransactions'] });
      queryClient.invalidateQueries({ queryKey: ['studentFees'] });
      queryClient.invalidateQueries({ queryKey: ['myStudentFee'] });
    },
  });

  return {
    transactions: transactionsQuery.data ?? [],
    isLoading: transactionsQuery.isLoading,
    uploadSlip: uploadSlip.mutateAsync,
    isUploading: uploadSlip.isPending,
  };
}

/** Admin: อนุมัติ/ปฏิเสธสลิปที่อัปโหลดมา — อัปเดตทั้ง PaymentTransaction และ StudentFee ที่เกี่ยวข้อง */
export function useVerifyPaymentTransaction() {
  const { userData, user } = useAuth();
  const queryClient = useQueryClient();

  const verify = useMutation({
    mutationFn: async ({
      transaction,
      studentFee,
      approve,
      rejectionReason,
    }: {
      transaction: PaymentTransaction;
      studentFee: StudentFee;
      approve: boolean;
      rejectionReason?: string;
    }) => {
      const verifiedByName = userData?.name || userData?.displayName || user?.email || 'ผู้ดูแลระบบ';

      await updateDoc(doc(db, COLLECTION, transaction.id), {
        status: approve ? 'approved' : 'rejected',
        verifiedBy: user?.uid ?? '',
        verifiedByName,
        verifiedAt: new Date().toISOString(),
        ...(approve ? {} : { rejectionReason: rejectionReason ?? '' }),
      });

      let installments: Installment[] = studentFee.installments;
      if (transaction.installmentId) {
        installments = studentFee.installments.map((i) => {
          if (i.id !== transaction.installmentId) return i;
          if (approve) {
            const paidAmount = i.paidAmount + transaction.amount;
            return { ...i, paidAmount, status: paidAmount >= i.amount ? 'paid' as const : 'partial' as const };
          }
          return { ...i, status: 'unpaid' as const };
        });
      }

      const totals = recomputeStudentFeeTotals({
        feeItems: studentFee.feeItems,
        scholarships: studentFee.scholarships,
        installments,
      });

      // ไม่มีแผนผ่อนชำระ (ชำระเต็มจำนวนครั้งเดียว) — คำนวณสถานะจาก totalPaid ของธุรกรรมที่ approve แล้วทั้งหมด
      let patch: Partial<StudentFee> = { installments, ...totals, updatedAt: new Date().toISOString() };
      if (studentFee.installments.length === 0) {
        const totalPaid = approve ? studentFee.totalPaid + transaction.amount : studentFee.totalPaid;
        const status = totalPaid <= 0 ? 'unpaid' : totalPaid >= studentFee.netPayable ? 'paid' : 'partial';
        patch = { totalPaid, status, updatedAt: new Date().toISOString() };
      }

      await updateDoc(doc(db, STUDENT_FEES_COLLECTION, studentFee.id), patch);

      await logActivity({
        action: approve ? 'tuition_slip_approve' : 'tuition_slip_reject',
        category: 'academic',
        targetId: transaction.id,
        detail: approve ? 'อนุมัติสลิปชำระเงิน' : `ปฏิเสธสลิปชำระเงิน: ${rejectionReason ?? ''}`,
      });
    },
    onSuccess: (_r, variables) => {
      queryClient.invalidateQueries({ queryKey: ['paymentTransactions', variables.studentFee.id] });
      queryClient.invalidateQueries({ queryKey: ['campaignPaymentTransactions'] });
      queryClient.invalidateQueries({ queryKey: ['studentFees'] });
      queryClient.invalidateQueries({ queryKey: ['myStudentFee'] });
    },
  });

  return { verifyTransaction: verify.mutateAsync, isVerifying: verify.isPending };
}

/** Admin: บันทึกการชำระเงิน (ยอดครั้งนี้) พร้อมหลักฐานถ้ามี — สถานะคำนวณจากยอดชำระอัตโนมัติ */
export function useRecordPayment() {
  const { userData, user } = useAuth();
  const queryClient = useQueryClient();

  const record = useMutation({
    mutationFn: async ({
      studentFee,
      paymentAmount,
      paymentDate,
      slipFile,
    }: {
      studentFee: StudentFee;
      paymentAmount: number;
      paymentDate: string;
      slipFile?: File;
    }) => {
      if (paymentAmount <= 0) {
        throw new Error('กรุณาระบุยอดชำระที่มากกว่า 0');
      }

      const newTotalPaid = studentFee.totalPaid + paymentAmount;
      if (newTotalPaid > studentFee.netPayable) {
        throw new Error('ยอดชำระเกินยอดค้างชำระ');
      }

      const verifiedByName = userData?.name || userData?.displayName || user?.email || 'ผู้ดูแลระบบ';
      const [year, month, day] = paymentDate.split('-').map(Number);
      const paymentAtIso = new Date(year, month - 1, day, 12, 0, 0, 0).toISOString();
      const nowIso = new Date().toISOString();

      let slipUrl = '';
      let slipStoragePath = '';
      if (slipFile) {
        slipStoragePath = `tuition_slips/${studentFee.academicYearId}/${studentFee.id}/${Date.now()}_${slipFile.name}`;
        const storageRef = ref(storage, slipStoragePath);
        await uploadBytes(storageRef, slipFile);
        slipUrl = await getDownloadURL(storageRef);
      }

      await addDoc(collection(db, COLLECTION), {
        campaignId: studentFee.campaignId,
        studentFeeId: studentFee.id,
        installmentId: null,
        studentId: studentFee.studentId,
        academicYearId: studentFee.academicYearId,
        term: studentFee.term,
        amount: paymentAmount,
        ...(slipUrl ? { slipUrl, slipStoragePath } : {}),
        status: 'approved',
        submittedAt: paymentAtIso,
        verifiedBy: user?.uid ?? '',
        verifiedByName,
        verifiedAt: paymentAtIso,
        note: 'บันทึกโดยผู้ดูแลระบบ',
      });

      const installments =
        studentFee.installments.length > 0
          ? applyTotalPaidToInstallments(studentFee.installments, newTotalPaid)
          : studentFee.installments;

      const totals = recomputeStudentFeeTotals({
        feeItems: studentFee.feeItems,
        scholarships: studentFee.scholarships,
        installments,
      });

      const status =
        installments.length > 0
          ? totals.status
          : newTotalPaid <= 0
            ? 'unpaid'
            : newTotalPaid >= studentFee.netPayable
              ? 'paid'
              : 'partial';

      await updateDoc(doc(db, STUDENT_FEES_COLLECTION, studentFee.id), {
        installments,
        totalPaid: newTotalPaid,
        status,
        totalFee: totals.totalFee,
        totalDiscount: totals.totalDiscount,
        netPayable: totals.netPayable,
        updatedAt: nowIso,
      });

      await logActivity({
        action: 'tuition_payment_record',
        category: 'academic',
        targetId: studentFee.id,
        detail: `บันทึกชำระเงิน ${paymentAmount.toLocaleString('th-TH')} บาท (รวม ${newTotalPaid.toLocaleString('th-TH')} บาท)`,
      });
    },
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['paymentTransactions', variables.studentFee.id] });
      queryClient.invalidateQueries({ queryKey: ['campaignPaymentTransactions'] });
      queryClient.invalidateQueries({ queryKey: ['studentFees'] });
      queryClient.invalidateQueries({ queryKey: ['myStudentFee'] });
    },
  });

  return { recordPayment: record.mutateAsync, isRecording: record.isPending };
}
