import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  HiAdjustmentsHorizontal,
  HiArrowLeft,
  HiChevronLeft,
  HiChevronRight,
  HiOutlineMagnifyingGlass,
  HiOutlineArrowUpTray,
  HiOutlineBanknotes,
  HiOutlineClock,
  HiOutlineCog6Tooth,
  HiOutlineDocumentMagnifyingGlass,
  HiOutlinePencilSquare,
  HiOutlinePhoto,
  HiXMark,
} from 'react-icons/hi2';
import { PermissionVisible } from '@/components/PermissionGate';
import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { DEPARTMENT_CONFIG, type Department } from '@/types/curriculum';
import { DEPARTMENT_GRADES, GRADE_LEVEL_ORDER } from '@/types/class';
import { cn } from '@/lib/utils';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import { useTuitionCampaigns } from './hooks/useTuitionCampaigns';
import { useStudentFeesByCampaign } from './hooks/useStudentFees';
import { usePaymentTransactions, useRecordPayment, useVerifyPaymentTransaction, useTransactionsForCampaign } from './hooks/usePaymentTransactions';
import { formatTHB } from './tuitionCalc';
import AssignFeeDrawer from './components/AssignFeeDrawer';
import CampaignFeeDrawer from './components/CampaignFeeDrawer';
import RecordPaymentDrawer from './components/RecordPaymentDrawer';
import PaymentHistoryDrawer from './components/PaymentHistoryDrawer';
import TuitionDataImportDrawer from './components/TuitionDataImportDrawer';
import SlipReviewModal from './components/SlipReviewModal';
import { mergeScholarships, type TuitionDataImportRow } from './utils/tuitionDataImport';
import { recomputeStudentFeeTotals } from './hooks/useStudentFees';
import { tuitionTermLabel, type PaymentStatus, type PaymentTransaction, type Scholarship, type StudentFee, type StudentFeeRow } from '@/types/tuition';
import { toast } from 'sonner';
import type { StudentStudyStatus } from '@/lib/students/studentStatus';

const GLASS_CARD: React.CSSProperties = {
  background: 'rgba(255,255,255,0.80)',
  backdropFilter: 'blur(20px)',
  border: '1px solid rgba(0,0,0,0.06)',
  boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
};

const STAT_CARD_STYLE: React.CSSProperties = {
  ...GLASS_CARD,
  boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
};

const STATUS_CONFIG: Record<PaymentStatus, { label: string; bg: string; text: string }> = {
  unpaid: { label: 'ยังไม่ชำระ', bg: 'bg-rose-50', text: 'text-rose-600' },
  partial: { label: 'ชำระบางส่วน', bg: 'bg-amber-50', text: 'text-amber-600' },
  pending_verification: { label: 'รอตรวจสอบ', bg: 'bg-sky-50', text: 'text-sky-600' },
  paid: { label: 'ชำระครบแล้ว', bg: 'bg-emerald-50', text: 'text-emerald-600' },
};

const STUDY_STATUS_CONFIG: Record<StudentStudyStatus, { label: string; bg: string; text: string }> = {
  studying: { label: 'กำลังศึกษา', bg: 'bg-emerald-50', text: 'text-emerald-700' },
  transferred: { label: 'ย้ายออก', bg: 'bg-amber-50', text: 'text-amber-700' },
  graduated: { label: 'จบการศึกษา', bg: 'bg-slate-100', text: 'text-slate-600' },
};

function StudyStatusBadge({ status }: { status?: StudentStudyStatus }) {
  const cfg = STUDY_STATUS_CONFIG[status ?? 'studying'];
  return (
    <span className={cn('inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-bold', cfg.bg, cfg.text)}>
      {cfg.label}
    </span>
  );
}

function hasActiveScholarships(fee: Pick<StudentFeeRow, 'scholarships' | 'totalDiscount'>): boolean {
  if ((fee.totalDiscount ?? 0) > 0) return true;
  return (fee.scholarships ?? []).some((s) => s.label.trim() || s.value > 0);
}

function ScholarshipBadge({ scholarships }: { scholarships: Scholarship[] }) {
  const active = scholarships.filter((s) => s.label.trim() || s.value > 0);
  if (active.length === 0) return null;

  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {active.map((s) => {
        const label = s.label.trim() || 'ทุนการศึกษา';
        return (
          <span
            key={s.id}
            title={label}
            className="inline-flex max-w-[140px] truncate whitespace-nowrap rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700"
          >
            {label}
          </span>
        );
      })}
    </span>
  );
}

function getPageSizeForViewport(width: number, height: number): number {
  const reserved = width < 640 ? 520 : width < 1024 ? 460 : 400;
  const fromHeight = Math.floor((height - reserved) / 54);
  const max = width < 640 ? 10 : width < 1024 ? 15 : 20;
  return Math.min(max, Math.max(8, fromHeight));
}

const MIN_PAGE_SIZE = 5;
const MAX_PAGE_SIZE = 100;

function clampPageSize(value: number): number {
  return Math.min(MAX_PAGE_SIZE, Math.max(MIN_PAGE_SIZE, Math.round(value)));
}

function parseGradeLevel(className: string): string {
  const [grade] = className.split(/[/／]/);
  return grade?.trim() || '';
}

function resolveFeeGradeLevel(fee: Pick<StudentFeeRow, 'gradeLevel' | 'className'>): string {
  return fee.gradeLevel?.trim() || parseGradeLevel(fee.className);
}

function compareStudentFeesByGradeAndCode(a: StudentFeeRow, b: StudentFeeRow): number {
  const gradeA = resolveFeeGradeLevel(a);
  const gradeB = resolveFeeGradeLevel(b);
  const orderA = GRADE_LEVEL_ORDER[gradeA] ?? 999;
  const orderB = GRADE_LEVEL_ORDER[gradeB] ?? 999;
  if (orderA !== orderB) return orderA - orderB;
  return (a.studentCode || '').localeCompare(b.studentCode || '', undefined, { numeric: true });
}

function formatPaymentDate(iso: string): string {
  return new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
}

function getOutstandingBalance(fee: Pick<StudentFeeRow, 'netPayable' | 'totalPaid'>): number {
  return Math.max(fee.netPayable - fee.totalPaid, 0);
}

function getPaymentDisplayDate(tx: PaymentTransaction): string {
  const iso = tx.status === 'approved' && tx.verifiedAt ? tx.verifiedAt : tx.submittedAt;
  return formatPaymentDate(iso);
}

function buildLatestTransactionMap(transactions: PaymentTransaction[]): Map<string, PaymentTransaction> {
  const map = new Map<string, PaymentTransaction>();
  for (const tx of transactions) {
    const existing = map.get(tx.studentFeeId);
    if (!existing || tx.submittedAt > existing.submittedAt) {
      map.set(tx.studentFeeId, tx);
    }
  }
  return map;
}

function StatusBadge({ status }: { status: PaymentStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className={cn('rounded-full px-2.5 py-1 text-[11px] font-bold', cfg.bg, cfg.text)}>
      {cfg.label}
    </span>
  );
}

function StatusSelect({
  fee,
  disabled,
  onPartialSelect,
  onChange,
}: {
  fee: StudentFee;
  disabled?: boolean;
  onPartialSelect: (fee: StudentFee) => void;
  onChange: (status: PaymentStatus) => void;
}) {
  const cfg = STATUS_CONFIG[fee.status];
  return (
    <select
      value={fee.status}
      onChange={(e) => {
        const status = e.target.value as PaymentStatus;
        if (status === 'partial') {
          onPartialSelect(fee);
          return;
        }
        onChange(status);
      }}
      disabled={disabled}
      className={cn(
        'h-8 min-w-[108px] cursor-pointer appearance-none rounded-full border-0 px-2.5 text-[11px] font-bold outline-none',
        cfg.bg,
        cfg.text,
        disabled && 'opacity-50',
      )}
    >
      {Object.entries(STATUS_CONFIG).map(([key, item]) => (
        <option key={key} value={key}>
          {item.label}
        </option>
      ))}
    </select>
  );
}

/** ปุ่ม/โมดัลตรวจสอบสลิปของนักเรียนรายคน — โหลดประวัติธุรกรรมเฉพาะตอนเปิดเท่านั้น */
function SlipReviewLauncher({ studentFee }: { studentFee: StudentFee }) {
  const [open, setOpen] = useState(false);
  const { transactions } = usePaymentTransactions(open ? studentFee.id : null);
  const { verifyTransaction, isVerifying } = useVerifyPaymentTransaction();
  const pending = transactions.find((t) => t.status === 'pending_verification') ?? null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-1 text-[11px] font-bold text-sky-600 hover:bg-sky-100"
      >
        <HiOutlineDocumentMagnifyingGlass size={13} /> ตรวจสลิป
      </button>
      <SlipReviewModal
        open={open && !!pending}
        onClose={() => setOpen(false)}
        studentFee={studentFee}
        transaction={pending}
        isVerifying={isVerifying}
        onVerify={async (approve, rejectionReason) => {
          if (!pending) return;
          await verifyTransaction({ transaction: pending, studentFee, approve, rejectionReason });
          setOpen(false);
        }}
      />
    </>
  );
}

function StudentFeeMobileCard({
  fee,
  latestTx,
  outstanding,
  isLoadingTransactions,
  canEditTuition,
  isSaving,
  isRecording,
  updatingStatusId,
  onPreviewSlip,
  onHistory,
  onPayment,
  onAssign,
  onPartialSelect,
  onStatusChange,
}: {
  fee: StudentFeeRow;
  latestTx: PaymentTransaction | null;
  outstanding: number;
  isLoadingTransactions: boolean;
  canEditTuition: boolean;
  isSaving: boolean;
  isRecording: boolean;
  updatingStatusId: string | null;
  onPreviewSlip: (url: string) => void;
  onHistory: (fee: StudentFee) => void;
  onPayment: (fee: StudentFee) => void;
  onAssign: (fee: StudentFee) => void;
  onPartialSelect: (fee: StudentFee) => void;
  onStatusChange: (fee: StudentFee, status: PaymentStatus) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-2xl border border-black/[0.06] bg-white/80 p-3.5 shadow-sm',
        fee.isPendingRecord && 'border-amber-200/80 bg-amber-50/40',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-black text-slate-800">
            {fee.studentName?.trim() || 'ไม่ทราบชื่อ'}
          </p>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
            <p className="text-[10px] font-semibold text-black/35">{fee.studentCode?.trim() || '—'}</p>
            {hasActiveScholarships(fee) && <ScholarshipBadge scholarships={fee.scholarships ?? []} />}
          </div>
        </div>
        <StudyStatusBadge status={fee.studyStatus} />
      </div>

      <p className="mt-2 text-[11px] font-bold text-slate-500">{fee.className}</p>

      <div className="mt-2.5 grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-slate-50 px-2 py-1.5 text-center">
          <p className="text-[9px] font-bold text-slate-400">ยอดสุทธิ</p>
          <p className="mt-0.5 text-[11px] font-black tabular-nums text-slate-700">
            {fee.netPayable > 0 ? formatTHB(fee.netPayable) : '—'}
          </p>
        </div>
        <div className="rounded-xl bg-slate-50 px-2 py-1.5 text-center">
          <p className="text-[9px] font-bold text-slate-400">ชำระแล้ว</p>
          <p className="mt-0.5 text-[11px] font-black tabular-nums text-slate-600">
            {fee.isPendingRecord ? '—' : formatTHB(fee.totalPaid)}
          </p>
        </div>
        <div className="rounded-xl bg-slate-50 px-2 py-1.5 text-center">
          <p className="text-[9px] font-bold text-slate-400">ค้างชำระ</p>
          <p className={cn(
            'mt-0.5 text-[11px] font-black tabular-nums',
            fee.netPayable > 0 ? (outstanding > 0 ? 'text-rose-600' : 'text-emerald-600') : 'text-slate-400',
          )}
          >
            {fee.netPayable > 0 ? formatTHB(outstanding) : '—'}
          </p>
        </div>
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-2">
        <div className="min-w-0 text-[10px] text-slate-500">
          {isLoadingTransactions ? (
            <span className="text-black/25">กำลังโหลด...</span>
          ) : latestTx ? (
            <>
              <p className="font-semibold tabular-nums">{getPaymentDisplayDate(latestTx)}</p>
              {latestTx.status === 'pending_verification' && (
                <p className="text-sky-500">รอตรวจสอบ</p>
              )}
              {latestTx.status === 'rejected' && (
                <p className="text-rose-500">ถูกปฏิเสธ</p>
              )}
            </>
          ) : (
            <span className="text-black/25">ยังไม่มีการชำระ</span>
          )}
        </div>
        {!isLoadingTransactions && latestTx?.slipUrl && (
          <button
            type="button"
            onClick={() => onPreviewSlip(latestTx.slipUrl!)}
            className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-black/[0.08] bg-slate-50"
            title="ดูสลิปหลักฐาน"
          >
            <img src={latestTx.slipUrl} alt="สลิปการชำระเงิน" className="h-full w-full object-cover" />
          </button>
        )}
      </div>

      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-black/[0.05] pt-2.5">
        {fee.isPendingRecord ? (
          <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-600">
            ยังไม่มีระเบียน
          </span>
        ) : canEditTuition ? (
          <StatusSelect
            fee={fee}
            disabled={updatingStatusId === fee.id || isSaving || isRecording}
            onPartialSelect={onPartialSelect}
            onChange={(status) => onStatusChange(fee, status)}
          />
        ) : (
          <StatusBadge status={fee.status} />
        )}

        <div className="flex items-center gap-1.5">
          {!fee.isPendingRecord && fee.status === 'pending_verification' && <SlipReviewLauncher studentFee={fee} />}
          {!fee.isPendingRecord && (
            <button
              type="button"
              onClick={() => onHistory(fee)}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50"
              title="ดูประวัติการชำระเงิน"
              aria-label="ดูประวัติการชำระเงิน"
            >
              <HiOutlineClock size={14} />
            </button>
          )}
          {!fee.isPendingRecord && canEditTuition && outstanding > 0 && (
            <button
              type="button"
              onClick={() => onPayment(fee)}
              disabled={isRecording}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
              title="บันทึกการชำระเงิน"
              aria-label="บันทึกการชำระเงิน"
            >
              <HiOutlineBanknotes size={14} />
            </button>
          )}
          {!fee.isPendingRecord && canEditTuition && (
            <PermissionVisible featureKey="tuition" require="edit">
              <button
                type="button"
                onClick={() => onAssign(fee)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white transition-colors hover:bg-blue-700"
                title="แก้ไขค่าเทอม"
                aria-label="แก้ไขค่าเทอม"
              >
                <HiOutlinePencilSquare size={14} />
              </button>
            </PermissionVisible>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export default function AdminTuitionView() {
  const navigate = useNavigate();
  const { campaignId } = useParams<{ campaignId: string }>();
  const { canEdit } = useMyPermissions();
  const { campaigns, updateCampaign, isSaving: isSavingCampaign, isLoading: isLoadingCampaigns } = useTuitionCampaigns();
  const campaign = campaigns.find((c) => c.id === campaignId) ?? null;
  const { studentFees, pendingFees, isLoading, applyCampaignFeesToStudents, updateStudentFee, updateStudentFeeStatus, isSaving } = useStudentFeesByCampaign(campaignId ?? null, campaign, { includePending: true });
  const { data: transactions = [], isLoading: isLoadingTransactions } = useTransactionsForCampaign(campaignId ?? null);
  const { recordPayment, isRecording } = useRecordPayment();

  const [searchText, setSearchText] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState<Department | 'all'>('all');
  const [gradeLevelFilter, setGradeLevelFilter] = useState<string>('all');
  const [classFilter, setClassFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<PaymentStatus | 'all'>('all');
  const [assignTarget, setAssignTarget] = useState<StudentFee | null>(null);
  const [paymentTarget, setPaymentTarget] = useState<StudentFee | null>(null);
  const [historyTarget, setHistoryTarget] = useState<StudentFee | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [previewSlipUrl, setPreviewSlipUrl] = useState<string | null>(null);
  const [feeModalOpen, setFeeModalOpen] = useState(false);
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const initialPageSize =
    typeof window !== 'undefined' ? getPageSizeForViewport(window.innerWidth, window.innerHeight) : 15;
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [pageSizeInput, setPageSizeInput] = useState(String(initialPageSize));
  const pageSizeCustomizedRef = useRef(false);
  const [headerRightActionsEl, setHeaderRightActionsEl] = useState<HTMLElement | null>(null);
  const [headerMobileActionsEl, setHeaderMobileActionsEl] = useState<HTMLElement | null>(null);
  const [headerMobileBackEl, setHeaderMobileBackEl] = useState<HTMLElement | null>(null);
  const [isLgUp, setIsLgUp] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : true,
  );

  useEffect(() => {
    setHeaderRightActionsEl(document.getElementById('header-portal-right-actions'));
    setHeaderMobileActionsEl(document.getElementById('header-portal-mobile-actions'));
    setHeaderMobileBackEl(document.getElementById('header-portal-mobile-back'));
  }, []);

  useEffect(() => {
    const defaultBack = document.getElementById('portal-default-mobile-back');
    if (!defaultBack) return;
    defaultBack.style.display = !isLgUp ? 'none' : '';
    return () => {
      defaultBack.style.display = '';
    };
  }, [isLgUp]);

  useEffect(() => {
    const handleResize = () => setIsLgUp(window.innerWidth >= 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const updatePageSize = () => {
      if (pageSizeCustomizedRef.current) return;
      const next = getPageSizeForViewport(window.innerWidth, window.innerHeight);
      setPageSize(next);
      setPageSizeInput(String(next));
    };
    updatePageSize();
    window.addEventListener('resize', updatePageSize);
    return () => window.removeEventListener('resize', updatePageSize);
  }, []);

  function commitPageSizeInput() {
    const parsed = Number(pageSizeInput);
    if (!Number.isFinite(parsed)) {
      setPageSizeInput(String(pageSize));
      return;
    }
    const next = clampPageSize(parsed);
    pageSizeCustomizedRef.current = true;
    setPageSize(next);
    setPageSizeInput(String(next));
  }

  useEffect(() => {
    setCurrentPage(1);
  }, [searchText, departmentFilter, gradeLevelFilter, classFilter, statusFilter, pageSize]);

  const latestTxByFeeId = useMemo(
    () => buildLatestTransactionMap(transactions),
    [transactions],
  );

  const allFees = useMemo((): StudentFeeRow[] => (
    [...studentFees, ...pendingFees]
  ), [studentFees, pendingFees]);

  const feesForDepartment = useMemo(
    () => (departmentFilter === 'all'
      ? allFees
      : allFees.filter((f) => f.departmentId === departmentFilter)),
    [allFees, departmentFilter],
  );

  const gradeOptions = useMemo(() => {
    if (departmentFilter !== 'all') {
      return [...DEPARTMENT_GRADES[departmentFilter]];
    }
    const grades = new Set<string>();
    for (const dept of Object.keys(DEPARTMENT_GRADES) as Department[]) {
      for (const grade of DEPARTMENT_GRADES[dept]) grades.add(grade);
    }
    return [...grades].sort((a, b) => (GRADE_LEVEL_ORDER[a] ?? 99) - (GRADE_LEVEL_ORDER[b] ?? 99));
  }, [departmentFilter]);

  const classOptions = useMemo(() => {
    const base = gradeLevelFilter === 'all'
      ? feesForDepartment
      : feesForDepartment.filter((f) => resolveFeeGradeLevel(f) === gradeLevelFilter);
    const map = new Map<string, string>();
    for (const fee of base) {
      if (fee.classId) map.set(fee.classId, fee.className);
    }
    return [...map.entries()]
      .sort(([, nameA], [, nameB]) => {
        const orderA = GRADE_LEVEL_ORDER[resolveFeeGradeLevel({ className: nameA })] ?? 99;
        const orderB = GRADE_LEVEL_ORDER[resolveFeeGradeLevel({ className: nameB })] ?? 99;
        if (orderA !== orderB) return orderA - orderB;
        return nameA.localeCompare(nameB, undefined, { numeric: true });
      })
      .map(([id, name]) => ({ id, name }));
  }, [feesForDepartment, gradeLevelFilter]);

  const filteredFees = useMemo((): StudentFeeRow[] => {
    const search = searchText.trim().toLowerCase();
    return allFees
      .filter((f) => departmentFilter === 'all' || f.departmentId === departmentFilter)
      .filter((f) => gradeLevelFilter === 'all' || resolveFeeGradeLevel(f) === gradeLevelFilter)
      .filter((f) => classFilter === 'all' || f.classId === classFilter)
      .filter((f) => {
        if (f.isPendingRecord) return statusFilter === 'all';
        return statusFilter === 'all' || f.status === statusFilter;
      })
      .filter((f) => !search || f.studentName.toLowerCase().includes(search) || f.studentCode.includes(search))
      .sort(compareStudentFeesByGradeAndCode);
  }, [allFees, departmentFilter, gradeLevelFilter, classFilter, statusFilter, searchText]);

  const hasActiveFilters = useMemo(
    () =>
      departmentFilter !== 'all' ||
      gradeLevelFilter !== 'all' ||
      classFilter !== 'all' ||
      statusFilter !== 'all' ||
      searchText.trim() !== '',
    [departmentFilter, gradeLevelFilter, classFilter, statusFilter, searchText],
  );

  function clearFilters() {
    setSearchText('');
    setDepartmentFilter('all');
    setGradeLevelFilter('all');
    setClassFilter('all');
    setStatusFilter('all');
  }

  const visibleFees = useMemo(
    () => (hasActiveFilters ? filteredFees : []),
    [hasActiveFilters, filteredFees],
  );

  const totalPages = Math.max(1, Math.ceil(visibleFees.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const paginatedFees = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return visibleFees.slice(start, start + pageSize);
  }, [visibleFees, safePage, pageSize]);

  const rangeStart = visibleFees.length === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const rangeEnd = Math.min(safePage * pageSize, visibleFees.length);

  const stats = useMemo(() => {
    const source = hasActiveFilters ? filteredFees : studentFees;
    const countable = hasActiveFilters
      ? filteredFees.filter((f) => !f.isPendingRecord)
      : studentFees;
    const withFee = countable.filter((f) => f.netPayable > 0);

    const paidStudents = countable.filter((f) => f.status === 'paid');
    const partialStudents = countable.filter((f) => f.status === 'partial');
    const pendingStudents = countable.filter((f) => f.status === 'pending_verification');

    const sumOutstanding = (fees: typeof countable) =>
      fees.reduce((sum, f) => sum + Math.max(f.netPayable - f.totalPaid, 0), 0);

    const totalNet = source.reduce((sum, f) => sum + f.netPayable, 0);
    const outstandingStudents = withFee.filter((f) => f.netPayable - f.totalPaid > 0);

    return {
      totalNet,
      totalNetCount: withFee.length,
      paidCount: paidStudents.length,
      paidAmount: paidStudents.reduce((sum, f) => sum + f.netPayable, 0),
      outstandingCount: outstandingStudents.length,
      outstandingAmount: sumOutstanding(withFee),
      partialCount: partialStudents.length,
      partialPaidAmount: partialStudents.reduce((sum, f) => sum + f.totalPaid, 0),
      pendingCount: pendingStudents.length,
      pendingAmount: sumOutstanding(pendingStudents),
    };
  }, [hasActiveFilters, filteredFees, studentFees]);

  const importButton = canEdit('tuition') && campaign ? (
    <button
      type="button"
      onClick={() => setImportOpen(true)}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-blue-200 bg-blue-50 text-blue-600 shadow-sm transition-colors hover:bg-blue-100"
      title="นำเข้าข้อมูลจาก CSV / Google Sheet"
      aria-label="นำเข้าข้อมูลจาก CSV / Google Sheet"
    >
      <HiOutlineArrowUpTray size={16} />
    </button>
  ) : null;

  const feeConfigButton = canEdit('tuition') && campaign ? (
    <button
      type="button"
      onClick={() => setFeeModalOpen(true)}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition-colors hover:bg-slate-50"
      title="กำหนดค่าเทอม / ทุนการศึกษา"
      aria-label="กำหนดค่าเทอม / ทุนการศึกษา"
    >
      <HiOutlineCog6Tooth size={16} />
    </button>
  ) : null;

  const headerDesktopActions = feeConfigButton || importButton ? (
    <div className="pointer-events-auto flex items-center gap-1.5">
      {importButton}
      {feeConfigButton}
    </div>
  ) : null;

  const headerMobileActions = (
    <div className="pointer-events-auto flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => setFilterDrawerOpen(true)}
        className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition-colors hover:bg-slate-50 lg:hidden"
        title="ตัวกรองและค้นหา"
        aria-label="ตัวกรองและค้นหา"
      >
        <HiAdjustmentsHorizontal size={16} />
        {hasActiveFilters && (
          <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-rose-500" aria-hidden />
        )}
      </button>
      {importButton}
      {feeConfigButton}
    </div>
  );

  const headerMobileBack = (
    <button
      type="button"
      onClick={() => navigate('/portal/tuition/campaigns')}
      className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition-colors hover:bg-slate-50 lg:hidden"
      title="กลับไปหน้าปีการศึกษา"
      aria-label="กลับไปหน้าปีการศึกษา"
    >
      <HiArrowLeft size={18} />
    </button>
  );

  if (!isLoadingCampaigns && !campaign) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-3xl border border-dashed border-black/10 py-16 text-center">
        <p className="text-sm font-bold text-black/40">ไม่พบรอบเก็บค่าเทอมนี้</p>
        <button
          type="button"
          onClick={() => navigate('/portal/tuition/campaigns')}
          className="mt-1 rounded-full bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700"
        >
          กลับไปหน้าปีการศึกษา
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-1">
      {isLgUp && headerRightActionsEl && headerDesktopActions && createPortal(headerDesktopActions, headerRightActionsEl)}
      {!isLgUp && headerMobileBackEl && createPortal(headerMobileBack, headerMobileBackEl)}
      {!isLgUp && headerMobileActionsEl && createPortal(headerMobileActions, headerMobileActionsEl)}

      {/* ── Header ── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/portal/tuition/campaigns')}
            className="hidden h-8 w-8 items-center justify-center rounded-full border border-black/[0.08] bg-white text-slate-500 hover:bg-slate-50 lg:flex"
            aria-label="กลับไปหน้าปีการศึกษา"
          >
            <HiArrowLeft size={14} />
          </button>
          <div>
            <h1 className="text-lg font-black text-slate-800">รายชื่อนักเรียน — ค่าเทอม</h1>
            <p className="text-xs text-black/40">
              {campaign ? `ปีการศึกษา ${campaign.academicYearId} · ${tuitionTermLabel(campaign.term)} · ${campaign.name}` : 'กำลังโหลด...'}
            </p>
          </div>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {[
          {
            label: 'ยอดสุทธิรวม',
            value: formatTHB(stats.totalNet),
            count: stats.totalNetCount,
            color: '#4f46e5',
          },
          {
            label: 'ชำระแล้วรวม',
            value: formatTHB(stats.paidAmount),
            count: stats.paidCount,
            color: '#10b981',
          },
          {
            label: 'ชำระบางส่วน',
            value: formatTHB(stats.partialPaidAmount),
            count: stats.partialCount,
            color: '#f59e0b',
          },
          {
            label: 'ยอดค้างชำระ',
            value: formatTHB(stats.outstandingAmount),
            count: stats.outstandingCount,
            color: '#f43f5e',
          },
          {
            label: 'รอตรวจสอบ',
            value: formatTHB(stats.pendingAmount),
            count: stats.pendingCount,
            color: '#0ea5e9',
          },
        ].map((s) => (
          <div key={s.label} className="flex flex-col items-center rounded-2xl py-3" style={STAT_CARD_STYLE}>
            <span className="text-base font-black tabular-nums" style={{ color: s.color }}>{s.value}</span>
            {'count' in s && (
              <span className="mt-0.5 text-[10px] font-bold tabular-nums text-slate-500">
                {s.count} คน
              </span>
            )}
            <span className="mt-0.5 text-[10px] text-black/40">{s.label}</span>
          </div>
        ))}
      </div>

      {/* ── Filters (desktop) ── */}
      <div className="hidden flex-wrap items-center gap-2 lg:flex">
        <div className="flex h-9 flex-1 min-w-[180px] items-center gap-2 rounded-xl border border-black/[0.06] bg-white px-3 shadow-sm">
          <HiOutlineMagnifyingGlass size={14} className="text-black/30" />
          <input
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="ค้นหาชื่อหรือรหัสนักเรียน..."
            className="flex-1 bg-transparent text-xs text-black/70 outline-none placeholder-black/25"
          />
        </div>
        <select
          value={departmentFilter}
          onChange={(e) => {
            setDepartmentFilter(e.target.value as Department | 'all');
            setGradeLevelFilter('all');
            setClassFilter('all');
          }}
          className="h-9 rounded-xl border border-black/[0.06] bg-white px-3 text-xs font-semibold text-slate-600 shadow-sm"
        >
          <option value="all">ทุกแผนก</option>
          {Object.entries(DEPARTMENT_CONFIG).map(([key, cfg]) => (
            <option key={key} value={key}>{cfg.label}</option>
          ))}
        </select>
        <select
          value={gradeLevelFilter}
          onChange={(e) => {
            setGradeLevelFilter(e.target.value);
            setClassFilter('all');
          }}
          className="h-9 rounded-xl border border-black/[0.06] bg-white px-3 text-xs font-semibold text-slate-600 shadow-sm"
        >
          <option value="all">ทุกระดับชั้น</option>
          {gradeOptions.map((grade) => (
            <option key={grade} value={grade}>{grade}</option>
          ))}
        </select>
        <select
          value={classFilter}
          onChange={(e) => setClassFilter(e.target.value)}
          disabled={classOptions.length === 0}
          className="h-9 rounded-xl border border-black/[0.06] bg-white px-3 text-xs font-semibold text-slate-600 shadow-sm disabled:opacity-40"
        >
          <option value="all">ทุกห้อง</option>
          {classOptions.map((cls) => (
            <option key={cls.id} value={cls.id}>{cls.name}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as PaymentStatus | 'all')}
          className="h-9 rounded-xl border border-black/[0.06] bg-white px-3 text-xs font-semibold text-slate-600 shadow-sm"
        >
          <option value="all">ทุกสถานะ</option>
          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
            <option key={key} value={key}>{cfg.label}</option>
          ))}
        </select>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="flex h-9 items-center gap-1.5 rounded-xl border border-rose-100 bg-rose-50 px-3 text-xs font-bold text-rose-600 transition-colors hover:bg-rose-100"
            title="ล้างฟิลเตอร์"
            aria-label="ล้างฟิลเตอร์"
          >
            <HiXMark size={14} />
            ล้างฟิลเตอร์
          </button>
        )}
      </div>

      <Drawer open={filterDrawerOpen} onOpenChange={setFilterDrawerOpen} direction="bottom">
        <DrawerContent className="pb-[max(1rem,env(safe-area-inset-bottom))]">
          <DrawerHeader className="text-left">
            <DrawerTitle className="text-base font-black text-slate-900">ค้นหาและตัวกรอง</DrawerTitle>
            <DrawerDescription className="text-xs text-slate-500">
              ค้นหาชื่อหรือรหัสนักเรียน และเลือกแผนก ชั้น ห้อง สถานะ
            </DrawerDescription>
          </DrawerHeader>

          <div className="space-y-3 px-4">
            <div>
              <label className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-slate-400">
                ค้นหา
              </label>
              <div className="relative">
                <HiOutlineMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <input
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder="ค้นหาชื่อหรือรหัสนักเรียน..."
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-9 text-[13px] font-semibold text-slate-800 outline-none focus:border-blue-200 focus:ring-4 focus:ring-blue-50/50"
                />
                {searchText && (
                  <button
                    type="button"
                    onClick={() => setSearchText('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                    aria-label="ล้างคำค้นหา"
                  >
                    <HiXMark size={14} />
                  </button>
                )}
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-slate-400">แผนก</label>
              <select
                value={departmentFilter}
                onChange={(e) => {
                  setDepartmentFilter(e.target.value as Department | 'all');
                  setGradeLevelFilter('all');
                  setClassFilter('all');
                }}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-[13px] font-semibold text-slate-700"
              >
                <option value="all">ทุกแผนก</option>
                {Object.entries(DEPARTMENT_CONFIG).map(([key, cfg]) => (
                  <option key={key} value={key}>{cfg.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-slate-400">ระดับชั้น</label>
              <select
                value={gradeLevelFilter}
                onChange={(e) => {
                  setGradeLevelFilter(e.target.value);
                  setClassFilter('all');
                }}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-[13px] font-semibold text-slate-700"
              >
                <option value="all">ทุกระดับชั้น</option>
                {gradeOptions.map((grade) => (
                  <option key={grade} value={grade}>{grade}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-slate-400">ห้องเรียน</label>
              <select
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value)}
                disabled={classOptions.length === 0}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-[13px] font-semibold text-slate-700 disabled:opacity-40"
              >
                <option value="all">ทุกห้อง</option>
                {classOptions.map((cls) => (
                  <option key={cls.id} value={cls.id}>{cls.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-slate-400">สถานะชำระ</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as PaymentStatus | 'all')}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-[13px] font-semibold text-slate-700"
              >
                <option value="all">ทุกสถานะ</option>
                {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                  <option key={key} value={key}>{cfg.label}</option>
                ))}
              </select>
            </div>
          </div>

          <DrawerFooter className="flex-row gap-2">
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="h-11 flex-1 rounded-xl border border-rose-200 bg-rose-50 text-[13px] font-black text-rose-600 transition-colors hover:bg-rose-100"
              >
                ล้างตัวกรอง
              </button>
            )}
            <button
              type="button"
              onClick={() => setFilterDrawerOpen(false)}
              className="h-11 flex-1 rounded-xl bg-slate-900 text-[13px] font-black text-white shadow-md transition-colors hover:bg-slate-800"
            >
              แสดงผล
            </button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* ── Table (desktop) / Cards (mobile) ── */}
      <div className="overflow-hidden rounded-3xl" style={GLASS_CARD}>
        <div className="space-y-2 p-3 lg:hidden">
          {isLoading && (
            <div className="py-10 text-center text-sm font-bold text-black/30">กำลังโหลดข้อมูล...</div>
          )}
          {!isLoading && !hasActiveFilters && (
            <div className="py-10 text-center text-sm font-bold text-black/30">
              กรุณาเลือกตัวกรองเพื่อแสดงรายชื่อนักเรียน
            </div>
          )}
          {!isLoading && hasActiveFilters && visibleFees.length === 0 && (
            <div className="py-10 text-center text-sm font-bold text-black/30">
              ไม่พบข้อมูลค่าเทอมที่ตรงกับเงื่อนไข
            </div>
          )}
          {paginatedFees.map((fee) => {
            const latestTx = fee.isPendingRecord ? null : latestTxByFeeId.get(fee.id) ?? null;
            const outstanding = getOutstandingBalance(fee);
            return (
              <StudentFeeMobileCard
                key={fee.id}
                fee={fee}
                latestTx={latestTx}
                outstanding={outstanding}
                isLoadingTransactions={isLoadingTransactions}
                canEditTuition={canEdit('tuition')}
                isSaving={isSaving}
                isRecording={isRecording}
                updatingStatusId={updatingStatusId}
                onPreviewSlip={setPreviewSlipUrl}
                onHistory={setHistoryTarget}
                onPayment={setPaymentTarget}
                onAssign={setAssignTarget}
                onPartialSelect={setPaymentTarget}
                onStatusChange={async (targetFee, status) => {
                  if (status === targetFee.status) return;
                  setUpdatingStatusId(targetFee.id);
                  try {
                    await updateStudentFeeStatus({ fee: targetFee, status });
                  } finally {
                    setUpdatingStatusId(null);
                  }
                }}
              />
            );
          })}
        </div>

        <div className="hidden overflow-x-auto lg:block">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-black/[0.06] text-[10px] font-bold uppercase tracking-wider text-black/40">
                <th className="px-4 py-3">นักเรียน</th>
                <th className="px-4 py-3">สถานะการเรียน</th>
                <th className="px-4 py-3">ชั้นเรียน</th>
                <th className="px-4 py-3 text-right">ยอดสุทธิ</th>
                <th className="px-4 py-3 text-right">ชำระแล้ว</th>
                <th className="px-4 py-3 text-right">ค้างชำระ</th>
                <th className="px-4 py-3">วันที่ชำระ</th>
                <th className="px-4 py-3">หลักฐาน</th>
                <th className="px-4 py-3">สถานะ</th>
                <th className="px-4 py-3 text-right">การจัดการ</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={10} className="px-4 py-10 text-center text-black/30">กำลังโหลดข้อมูล...</td></tr>
              )}
              {!isLoading && !hasActiveFilters && (
                <tr><td colSpan={10} className="px-4 py-10 text-center text-black/30">กรุณาเลือกตัวกรองเพื่อแสดงรายชื่อนักเรียน</td></tr>
              )}
              {!isLoading && hasActiveFilters && visibleFees.length === 0 && (
                <tr><td colSpan={10} className="px-4 py-10 text-center text-black/30">ไม่พบข้อมูลค่าเทอมที่ตรงกับเงื่อนไข</td></tr>
              )}
              {paginatedFees.map((fee, idx) => {
                const latestTx = fee.isPendingRecord ? null : latestTxByFeeId.get(fee.id) ?? null;
                const outstanding = getOutstandingBalance(fee);
                return (
                <motion.tr
                  key={fee.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: Math.min(idx * 0.02, 0.3) }}
                  className={cn(
                    'border-b border-black/[0.04] last:border-0 transition-colors hover:bg-slate-100/60',
                    idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/75',
                    fee.isPendingRecord && (idx % 2 === 0 ? 'bg-amber-50/45' : 'bg-amber-50/70'),
                  )}
                >
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-700">
                      {fee.studentName?.trim() || 'ไม่ทราบชื่อ'}
                    </p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                      <p className="text-[10px] text-black/35">{fee.studentCode?.trim() || '—'}</p>
                      {hasActiveScholarships(fee) && <ScholarshipBadge scholarships={fee.scholarships ?? []} />}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <StudyStatusBadge status={fee.studyStatus} />
                  </td>
                  <td className="px-4 py-3 text-slate-600">{fee.className}</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-700">
                    {fee.netPayable > 0 ? (
                      <span className={fee.isPendingRecord ? 'text-amber-700' : undefined}>
                        {formatTHB(fee.netPayable)}
                      </span>
                    ) : (
                      <span className="text-black/25">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-500">
                    {fee.isPendingRecord ? (
                      <span className="text-black/25">—</span>
                    ) : (
                      formatTHB(fee.totalPaid)
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">
                    {fee.netPayable > 0 ? (
                      <span className={outstanding > 0 ? 'text-rose-600' : 'text-emerald-600'}>
                        {formatTHB(outstanding)}
                      </span>
                    ) : (
                      <span className="text-black/25">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {isLoadingTransactions ? (
                      <span className="text-black/25">...</span>
                    ) : latestTx ? (
                      <div>
                        <p className="tabular-nums">{getPaymentDisplayDate(latestTx)}</p>
                        {latestTx.status === 'pending_verification' && (
                          <p className="text-[10px] text-sky-500">รอตรวจสอบ</p>
                        )}
                        {latestTx.status === 'rejected' && (
                          <p className="text-[10px] text-rose-500">ถูกปฏิเสธ</p>
                        )}
                      </div>
                    ) : (
                      <span className="text-black/25">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {isLoadingTransactions ? (
                      <span className="text-black/25">...</span>
                    ) : latestTx?.slipUrl ? (
                      <button
                        type="button"
                        onClick={() => setPreviewSlipUrl(latestTx.slipUrl)}
                        className="group relative h-10 w-10 overflow-hidden rounded-lg border border-black/[0.08] bg-slate-50 transition-transform hover:scale-105"
                        title="ดูสลิปหลักฐาน"
                      >
                        <img
                          src={latestTx.slipUrl}
                          alt="สลิปการชำระเงิน"
                          className="h-full w-full object-cover"
                        />
                        <span className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/20">
                          <HiOutlinePhoto size={14} className="text-white opacity-0 transition-opacity group-hover:opacity-100" />
                        </span>
                      </button>
                    ) : (
                      <span className="text-black/25">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {fee.isPendingRecord ? (
                      <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-600">
                        ยังไม่มีระเบียน
                      </span>
                    ) : canEdit('tuition') ? (
                      <StatusSelect
                        fee={fee}
                        disabled={updatingStatusId === fee.id || isSaving || isRecording}
                        onPartialSelect={setPaymentTarget}
                        onChange={async (status) => {
                          if (status === fee.status) return;
                          setUpdatingStatusId(fee.id);
                          try {
                            await updateStudentFeeStatus({ fee, status });
                          } finally {
                            setUpdatingStatusId(null);
                          }
                        }}
                      />
                    ) : (
                      <StatusBadge status={fee.status} />
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      {!fee.isPendingRecord && fee.status === 'pending_verification' && <SlipReviewLauncher studentFee={fee} />}
                      {!fee.isPendingRecord && (
                        <button
                          type="button"
                          onClick={() => setHistoryTarget(fee)}
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50"
                          title="ดูประวัติการชำระเงิน"
                          aria-label="ดูประวัติการชำระเงิน"
                        >
                          <HiOutlineClock size={14} />
                        </button>
                      )}
                      {!fee.isPendingRecord && canEdit('tuition') && outstanding > 0 && (
                        <button
                          type="button"
                          onClick={() => setPaymentTarget(fee)}
                          disabled={isRecording}
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
                          title="บันทึกการชำระเงิน"
                          aria-label="บันทึกการชำระเงิน"
                        >
                          <HiOutlineBanknotes size={14} />
                        </button>
                      )}
                      {!fee.isPendingRecord && (
                        <PermissionVisible featureKey="tuition" require="edit">
                          <button
                            type="button"
                            onClick={() => setAssignTarget(fee)}
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white transition-colors hover:bg-blue-700"
                            title="แก้ไขค่าเทอม"
                            aria-label="แก้ไขค่าเทอม"
                          >
                            <HiOutlinePencilSquare size={14} />
                          </button>
                        </PermissionVisible>
                      )}
                    </div>
                  </td>
                </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {!isLoading && hasActiveFilters && visibleFees.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-black/[0.06] px-4 py-3">
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-[11px] font-bold text-slate-500">
                แสดง {rangeStart}–{rangeEnd} จาก {visibleFees.length} รายการ
              </p>
              <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
                แสดง
                <input
                  type="number"
                  min={MIN_PAGE_SIZE}
                  max={MAX_PAGE_SIZE}
                  value={pageSizeInput}
                  onChange={(e) => setPageSizeInput(e.target.value)}
                  onBlur={commitPageSizeInput}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.currentTarget.blur();
                    }
                  }}
                  className="h-8 w-16 rounded-lg border border-black/[0.08] bg-white px-2 text-center text-[11px] font-bold text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                  aria-label="จำนวนรายการต่อหน้า"
                />
                ต่อหน้า
              </label>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={safePage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                  aria-label="หน้าก่อนหน้า"
                >
                  <HiChevronLeft size={16} />
                </Button>

                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((page) => {
                    if (totalPages > 5) {
                      if (page !== 1 && page !== totalPages && Math.abs(page - safePage) > 1) {
                        if (page === 2 || page === totalPages - 1) {
                          return (
                            <span key={`ellipsis-${page}`} className="px-0.5 text-[10px] text-slate-300">
                              …
                            </span>
                          );
                        }
                        return null;
                      }
                    }

                    const isActive = safePage === page;
                    return (
                      <button
                        key={page}
                        type="button"
                        onClick={() => setCurrentPage(page)}
                        className={cn(
                          'h-8 min-w-[32px] rounded-lg px-2 text-[11px] font-black transition-all',
                          isActive
                            ? 'bg-slate-900 text-white shadow-sm'
                            : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800',
                        )}
                      >
                        {page}
                      </button>
                    );
                  })}
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={safePage === totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                  aria-label="หน้าถัดไป"
                >
                  <HiChevronRight size={16} />
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {previewSlipUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setPreviewSlipUrl(null)}
          onKeyDown={(e) => { if (e.key === 'Escape') setPreviewSlipUrl(null); }}
          role="dialog"
          aria-modal="true"
        >
          <div className="relative max-h-[90vh] max-w-2xl" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setPreviewSlipUrl(null)}
              className="absolute -right-2 -top-2 z-10 rounded-full bg-white p-1.5 shadow-lg hover:bg-slate-50"
            >
              <HiXMark size={18} className="text-slate-500" />
            </button>
            <img
              src={previewSlipUrl}
              alt="สลิปการชำระเงิน"
              className="max-h-[85vh] w-full rounded-2xl object-contain shadow-2xl"
            />
          </div>
        </div>
      )}

      <AssignFeeDrawer
        key={assignTarget?.id ?? 'assign-fee-drawer'}
        open={!!assignTarget}
        onClose={() => setAssignTarget(null)}
        studentFee={assignTarget}
        isSaving={isSaving}
        onSave={async (input) => {
          if (!assignTarget) return;
          await updateStudentFee({ id: assignTarget.id, ...input });
          setAssignTarget(null);
        }}
      />

      <RecordPaymentDrawer
        key={paymentTarget?.id ?? 'record-payment-drawer'}
        open={!!paymentTarget}
        onClose={() => setPaymentTarget(null)}
        studentFee={paymentTarget}
        isSaving={isRecording}
        onSave={async ({ paymentAmount, paymentDate, slipFile }) => {
          if (!paymentTarget) return;
          await recordPayment({ studentFee: paymentTarget, paymentAmount, paymentDate, slipFile });
          toast.success('บันทึกการชำระเงินแล้ว');
          setPaymentTarget(null);
        }}
      />

      <PaymentHistoryDrawer
        key={historyTarget?.id ?? 'payment-history-drawer'}
        open={!!historyTarget}
        onClose={() => setHistoryTarget(null)}
        studentFee={historyTarget}
        onPreviewSlip={setPreviewSlipUrl}
      />

      <TuitionDataImportDrawer
        open={importOpen}
        onClose={() => setImportOpen(false)}
        campaign={campaign}
        studentFees={studentFees}
        isImporting={isSaving || isRecording}
        onImport={async (rows: TuitionDataImportRow[]) => {
          const feeCache = new Map<string, StudentFee>(
            studentFees.map((fee) => [fee.id, fee]),
          );
          let succeeded = 0;
          let failed = 0;

          for (const row of rows) {
            if (!row.studentFee) continue;
            try {
              let currentFee = feeCache.get(row.studentFee.id) ?? row.studentFee;

              if (row.scholarship) {
                const scholarships = mergeScholarships(currentFee.scholarships ?? [], row.scholarship);
                await updateStudentFee({
                  id: currentFee.id,
                  feeItems: currentFee.feeItems,
                  scholarships,
                  installments: currentFee.installments,
                });
                const totals = recomputeStudentFeeTotals({
                  feeItems: currentFee.feeItems,
                  scholarships,
                  installments: currentFee.installments,
                });
                currentFee = { ...currentFee, scholarships, ...totals };
                feeCache.set(currentFee.id, currentFee);
              }

              if (row.paymentAmount > 0) {
                await recordPayment({
                  studentFee: currentFee,
                  paymentAmount: row.paymentAmount,
                  paymentDate: row.paymentDate,
                });
                const newTotalPaid = currentFee.totalPaid + row.paymentAmount;
                const status =
                  newTotalPaid <= 0
                    ? 'unpaid'
                    : newTotalPaid >= currentFee.netPayable
                      ? 'paid'
                      : 'partial';
                currentFee = { ...currentFee, totalPaid: newTotalPaid, status };
                feeCache.set(currentFee.id, currentFee);
              }

              succeeded++;
            } catch {
              failed++;
            }
          }

          if (succeeded > 0) {
            toast.success(`นำเข้าข้อมูลสำเร็จ ${succeeded} รายการ`);
          }
          if (failed > 0) {
            toast.error(`นำเข้าไม่สำเร็จ ${failed} รายการ`);
          }

          return { succeeded, failed };
        }}
      />

      {campaign && (
        <CampaignFeeDrawer
          key={campaign.id}
          open={feeModalOpen}
          onClose={() => setFeeModalOpen(false)}
          campaign={campaign}
          isSaving={isSavingCampaign}
          onSave={async (patch) => {
            await updateCampaign({ id: campaign.id, patch });
            const updatedCampaign = {
              ...campaign,
              ...patch,
              updatedAt: new Date().toISOString(),
            };
            const result = await applyCampaignFeesToStudents(updatedCampaign);
            if (result.created + result.updated > 0) {
              toast.success(`บันทึกค่าเทอมแล้ว — อัปเดต ${result.created + result.updated} รายการ`);
            } else {
              toast.success('บันทึกโครงสร้างค่าเทอมแล้ว — นักเรียนที่ชำระเงินแล้วจะไม่ถูกเปลี่ยนอัตโนมัติ');
            }
            setFeeModalOpen(false);
          }}
        />
      )}
    </div>
  );
}
