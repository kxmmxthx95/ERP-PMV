import type { Department } from '@/types/curriculum';
import type { StudentStudyStatus } from '@/lib/students/studentStatus';

// ── Collections ─────────────────────────────────────────────────────────────
// tuition_campaigns    → academicYearId + term ('1' | '2' | 'summer') — year/term setup + default fee items
// student_fees         → campaignId (+ academicYearId/term snapshot)  — per-student assigned fee + scholarship + installments
// payment_transactions → campaignId (+ studentFeeId)                 — uploaded slips / verification history
//
// หมายเหตุ: "term" ของค่าเทอมแยกอิสระจาก activeSemester (1|2) ของ useActiveAcademicYear
// เพื่อรองรับ "ภาคฤดูร้อน" ซึ่งไม่ใช่ภาคเรียนปกติของระบบ

export type TuitionCampaignStatus = 'active' | 'closed';

/** ภาคเรียนของรอบเก็บค่าเทอม — '1' | '2' | 'summer' (เก็บเป็น string เพื่อรองรับภาคฤดูร้อน) */
export type TuitionTerm = string;

export const TUITION_TERM_OPTIONS: { id: TuitionTerm; label: string }[] = [
  { id: '1', label: 'ภาคเรียนที่ 1' },
  { id: '2', label: 'ภาคเรียนที่ 2' },
  { id: 'summer', label: 'ภาคฤดูร้อน' },
];

export function tuitionTermLabel(term: TuitionTerm): string {
  return TUITION_TERM_OPTIONS.find((t) => t.id === term)?.label ?? term;
}

/** จำนวนภาคเรียนที่ตั้งค่าได้ต่อปี — 3 รวมภาคฤดูร้อน */
export type TuitionTermCount = 1 | 2 | 3;

export const TUITION_TERM_COUNT_OPTIONS: { count: TuitionTermCount; label: string }[] = [
  { count: 1, label: '1 ภาคเรียน' },
  { count: 2, label: '2 ภาคเรียน' },
  { count: 3, label: '3 ภาคเรียน (รวมภาคฤดูร้อน)' },
];

export function termsForCount(count: TuitionTermCount): TuitionTerm[] {
  return TUITION_TERM_OPTIONS.slice(0, count).map((t) => t.id);
}

export function defaultCampaignName(academicYearId: string, term: TuitionTerm): string {
  return `ค่าเทอม ${tuitionTermLabel(term)}/${academicYearId}`;
}

export interface TuitionFeeItem {
  id: string;
  label: string; // e.g. "ค่าธรรมเนียมการศึกษา", "ค่าอาหารกลางวัน"
  amount: number;
}

/** โครงสร้างค่าเทอมตามแผนก + หลักสูตร (curriculumPackageId = null คือค่าเทอมทั่วไปของแผนก) */
export interface TuitionFeeProfile {
  departmentId: Department;
  curriculumPackageId: string | null;
  feeItems: TuitionFeeItem[];
  scholarships?: Scholarship[];
  installments?: Installment[];
}

/** ปีการศึกษา/ภาคเรียนที่เปิดเก็บค่าเทอม พร้อมโครงสร้างค่าใช้จ่ายเริ่มต้น */
export interface TuitionCampaign {
  id: string;
  academicYearId: string;
  term: TuitionTerm;
  name: string; // e.g. "ค่าเทอม 1/2569"
  defaultFeeItems: TuitionFeeItem[];
  defaultScholarships?: Scholarship[];
  defaultInstallments?: Installment[];
  /** โปรไฟล์ค่าเทอมแยกตามแผนก/หลักสูตร — ถ้าไม่มีจะ fallback ไป defaultFeeItems */
  feeProfiles?: TuitionFeeProfile[];
  defaultDueDate: string; // "YYYY-MM-DD"
  status: TuitionCampaignStatus;
  createdAt: string; // ISO
  createdBy: string;
  updatedAt?: string;
}

export type CampaignFeeDefaults = Pick<TuitionCampaign, 'defaultFeeItems' | 'defaultScholarships' | 'defaultInstallments'>;

export function feeProfileKey(departmentId: Department, curriculumPackageId: string | null): string {
  return `${departmentId}:${curriculumPackageId ?? '_'}`;
}

/** เลือกโปรไฟล์ค่าเทอมที่ตรงแผนก+หลักสูตร → ทั่วไปของแผนก → ค่าเริ่มต้นเดิมของ campaign */
export function resolveCampaignFeeProfile(
  campaign: TuitionCampaign,
  departmentId: Department,
  curriculumPackageId?: string | null,
): CampaignFeeDefaults {
  const profiles = campaign.feeProfiles ?? [];
  const normalizedCurriculum = curriculumPackageId ?? null;

  const exact = profiles.find(
    (p) => p.departmentId === departmentId && p.curriculumPackageId === normalizedCurriculum,
  );
  if (exact) {
    return {
      defaultFeeItems: exact.feeItems,
      defaultScholarships: exact.scholarships,
      defaultInstallments: exact.installments,
    };
  }

  if (normalizedCurriculum) {
    const deptDefault = profiles.find(
      (p) => p.departmentId === departmentId && p.curriculumPackageId === null,
    );
    if (deptDefault) {
      return {
        defaultFeeItems: deptDefault.feeItems,
        defaultScholarships: deptDefault.scholarships,
        defaultInstallments: deptDefault.installments,
      };
    }
  }

  return {
    defaultFeeItems: campaign.defaultFeeItems,
    defaultScholarships: campaign.defaultScholarships,
    defaultInstallments: campaign.defaultInstallments,
  };
}

export type NewTuitionCampaign = Omit<TuitionCampaign, 'id' | 'createdAt'>;

export type ScholarshipType = 'percentage' | 'fixed';

export interface Scholarship {
  id: string;
  label: string; // e.g. "ทุนเรียนดี", "ทุนพี่น้อง"
  type: ScholarshipType;
  value: number; // percentage 0-100, or fixed THB amount
  note?: string;
}

/** สถานะการชำระ ใช้ร่วมกันทั้งระดับงวด (installment) และระดับรวม (StudentFee) */
export type PaymentStatus = 'unpaid' | 'partial' | 'pending_verification' | 'paid';

export interface Installment {
  id: string;
  label: string; // e.g. "งวดที่ 1"
  amount: number;
  dueDate: string; // "YYYY-MM-DD"
  status: PaymentStatus;
  paidAmount: number;
}

/** ค่าเทอมที่กำหนดให้นักเรียนรายคน (หลังหักทุน/ส่วนลด) */
export interface StudentFee {
  id: string;
  campaignId: string;
  academicYearId: string;
  term: TuitionTerm;
  departmentId: Department;
  studentId: string;
  studentName: string; // snapshot
  studentCode: string; // snapshot
  classId: string;
  className: string; // snapshot, e.g. "ม.3/1"
  gradeLevel?: string; // snapshot จาก enrollment — ใช้กรอง/เรียงลำดับ
  feeItems: TuitionFeeItem[];
  totalFee: number; // sum(feeItems.amount)
  scholarships: Scholarship[];
  totalDiscount: number; // computed from scholarships against totalFee
  netPayable: number; // totalFee - totalDiscount
  installments: Installment[]; // if empty, netPayable is due as a single lump sum
  totalPaid: number; // sum(installments.paidAmount), or lump-sum paid amount if no installments
  status: PaymentStatus; // derived overall status
  createdAt: string;
  updatedAt?: string;
}

export type NewStudentFee = Omit<StudentFee, 'id' | 'createdAt'>;

/** แถวในตารางค่าเทอม — อาจเป็นระเบียนจริง หรือนักเรียนที่ลงทะเบียนแล้วแต่ยังไม่มีระเบียน */
export type StudentFeeRow = StudentFee & {
  isPendingRecord?: boolean;
  /** สถานะการเรียนของนักเรียน (snapshot จากข้อมูลล่าสุด) */
  studyStatus?: StudentStudyStatus;
};

export type PaymentTransactionStatus = 'pending_verification' | 'approved' | 'rejected';

/** หลักฐานการชำระเงิน (สลิป) แต่ละครั้ง — ผูกกับ StudentFee และอาจผูกกับงวดใดงวดหนึ่ง */
export interface PaymentTransaction {
  id: string;
  campaignId: string;
  studentFeeId: string;
  installmentId: string | null; // null = ชำระเต็มจำนวน/ไม่มีการแบ่งงวด
  studentId: string;
  academicYearId: string;
  term: TuitionTerm;
  amount: number;
  slipUrl: string; // download URL จาก Firebase Storage
  slipStoragePath: string; // path ใน Storage เพื่อลบ/อ้างอิงภายหลัง
  status: PaymentTransactionStatus;
  submittedAt: string; // ISO
  verifiedBy?: string;
  verifiedByName?: string;
  verifiedAt?: string;
  rejectionReason?: string;
}

export type NewPaymentTransaction = Omit<
  PaymentTransaction,
  'id' | 'submittedAt' | 'status' | 'verifiedBy' | 'verifiedByName' | 'verifiedAt' | 'rejectionReason'
>;

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  unpaid: 'ยังไม่ชำระ',
  partial: 'ชำระบางส่วน',
  pending_verification: 'รอตรวจสอบ',
  paid: 'ชำระครบแล้ว',
};
