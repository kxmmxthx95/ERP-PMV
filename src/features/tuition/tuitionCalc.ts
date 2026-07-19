import type { Installment, PaymentStatus, Scholarship, TuitionFeeItem } from '@/types/tuition';

export function sumFeeItems(items: TuitionFeeItem[]): number {
  return items.reduce((sum, item) => sum + item.amount, 0);
}

/** ส่วนลดรวมจากทุน/ส่วนลดทั้งหมด คิดจาก totalFee ก่อนหักลด (percentage ทบต่อจาก totalFee เดิมเสมอ ไม่ compound ต่อกัน) */
export function computeTotalDiscount(totalFee: number, scholarships: Scholarship[]): number {
  const raw = scholarships.reduce((sum, s) => {
    const amount = s.type === 'percentage' ? (totalFee * s.value) / 100 : s.value;
    return sum + amount;
  }, 0);
  return Math.min(raw, totalFee);
}

export function computeNetPayable(totalFee: number, scholarships: Scholarship[]): number {
  return Math.max(totalFee - computeTotalDiscount(totalFee, scholarships), 0);
}

export function sumInstallmentsPaid(installments: Installment[]): number {
  return installments.reduce((sum, i) => sum + i.paidAmount, 0);
}

/** กระจายยอดชำระรวมลงในแต่ละงวดตามลำดับ */
export function applyTotalPaidToInstallments(installments: Installment[], totalPaid: number): Installment[] {
  let remaining = Math.max(totalPaid, 0);
  return installments.map((inst) => {
    if (remaining <= 0) {
      return { ...inst, paidAmount: 0, status: 'unpaid' as const };
    }
    const paidAmount = Math.min(remaining, inst.amount);
    remaining -= paidAmount;
    const status: PaymentStatus =
      paidAmount >= inst.amount ? 'paid' : paidAmount > 0 ? 'partial' : 'unpaid';
    return { ...inst, paidAmount, status };
  });
}

/** สถานะรวมของ StudentFee ที่ derive จากงวดย่อยทั้งหมด (หรือยอดชำระรวมถ้าไม่มีงวด) */
export function computeOverallStatus(
  netPayable: number,
  totalPaid: number,
  installments: Installment[],
): PaymentStatus {
  if (installments.length > 0) {
    if (installments.some((i) => i.status === 'pending_verification')) return 'pending_verification';
    if (installments.every((i) => i.status === 'paid')) return 'paid';
    if (installments.some((i) => i.status === 'paid' || i.status === 'partial')) return 'partial';
    return 'unpaid';
  }
  if (totalPaid <= 0) return 'unpaid';
  if (totalPaid >= netPayable) return 'paid';
  return 'partial';
}

export function formatTHB(amount: number): string {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    maximumFractionDigits: 0,
  }).format(amount);
}
