// src/features/leave/LeaveManagementPage.tsx
import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ClipboardList, Plus, Check, X, Clock, FileText,
  ChevronLeft, ChevronRight, Save, AlertCircle, SlidersHorizontal,
  CheckCircle2, XCircle,
} from 'lucide-react';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { useAuth } from '@/hooks/useAuth';
import {
  useMyLeaveRequests,
  useLeaveRequestsSince,
  useStudentLeaveRequests,
  countDays,
  formatDate,
  getEarliestLeaveStartDate,
  isSameDayLeaveCutoffPassed,
  LEAVE_SAME_DAY_CUTOFF_MESSAGE,
  validateLeaveSubmissionDates,
} from '@/hooks/useLeaveRequests';
import { useActiveAcademicYear } from '@/hooks/useActiveAcademicYear';
import type { LeaveRequest, LeaveType, LeaveStatus } from '@/types/leave';
import { cn } from '@/lib/utils';
import FormModal, { modalInputCls, modalLabelCls } from '@/components/ui/FormModal';
import { db } from '@/lib/firebase';
import LeavePageTabMenu, { type LeavePageTab } from '@/features/leave/components/LeavePageTabMenu';
import { useLeaveRequesterClassMap, type LeaveRequesterProfile } from '@/features/leave/hooks/useLeaveRequesterClassMap';
import { getInitials } from '@/features/profile/profileLayoutShared';
import { getGradeLevelBadgeStyle } from '@/lib/school/gradeLevelBadge';
import { DEPARTMENT_CONFIG, type Department } from '@/types/curriculum';

type StatusFilter = 'all' | LeaveStatus;

function defaultAcademicYearStart() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}

// ── Constants ────────────────────────────────────────────────────────────────
const LEAVE_TYPE_LABEL: Record<LeaveType, string> = {
  sick: 'ลาป่วย',
  personal: 'ลากิจ',
};

const STATUS_CONFIG: Record<LeaveStatus, { label: string; bg: string; border: string; text: string; icon: typeof Check }> = {
  pending: { label: 'รอพิจารณา', bg: 'bg-amber-50', border: 'border-amber-100', text: 'text-amber-700', icon: Clock },
  approved: { label: 'อนุมัติแล้ว', bg: 'bg-emerald-50', border: 'border-emerald-100', text: 'text-emerald-700', icon: Check },
  rejected: { label: 'ไม่อนุมัติ', bg: 'bg-rose-50', border: 'border-rose-100', text: 'text-rose-700', icon: X },
};

const LEAVE_REQUESTS_PER_PAGE = 8;

const LEAVE_CARD_OUTER = 'px-0.5 py-0.5';
const LEAVE_CARD_SHELL =
  'rounded-2xl bg-white/90 p-3 shadow-sm cursor-pointer transition-all hover:bg-white';

function formatLeaveDateCompact(startDate: string, endDate: string): string {
  if (startDate === endDate) return formatDate(startDate);
  const start = new Date(startDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
  return `${start} – ${formatDate(endDate)}`;
}

function parseLeaveTimestamp(ts: LeaveRequest['createdAt'] | undefined): Date | null {
  if (!ts) return null;
  if (typeof ts === 'object' && 'toDate' in ts && typeof ts.toDate === 'function') {
    return ts.toDate();
  }
  if (typeof ts === 'object' && 'toMillis' in ts && typeof ts.toMillis === 'function') {
    return new Date(ts.toMillis());
  }
  if (typeof ts === 'object' && 'seconds' in ts) {
    return new Date((ts as { seconds: number }).seconds * 1000);
  }
  return null;
}

function formatLeaveSubmittedAt(ts: LeaveRequest['createdAt'] | undefined): string {
  const date = parseLeaveTimestamp(ts);
  if (!date || Number.isNaN(date.getTime())) return '—';
  return `${date.toLocaleString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })} น.`;
}

function resolveLeaveApproverLabels(
  req: LeaveRequest,
  profile?: LeaveRequesterProfile | null,
): string[] {
  if (req.status !== 'pending' && req.approverName?.trim()) {
    return [req.approverName.trim()];
  }
  if (profile?.approverNames?.length) {
    return profile.approverNames;
  }
  if (req.approverName?.trim()) {
    return [req.approverName.trim()];
  }
  return [];
}

// ── Status Badge ─────────────────────────────────────────────────────────────
function LeaveListPagination({
  page,
  totalPages,
  totalItems,
  rangeStart,
  rangeEnd,
  itemLabel,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  totalItems: number;
  rangeStart: number;
  rangeEnd: number;
  itemLabel: string;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  return (
    <div className="mt-4 flex flex-col items-center gap-2 sm:flex-row sm:justify-between">
      <p className="text-[11px] font-semibold text-slate-400">
        แสดง {rangeStart}–{rangeEnd} จาก {totalItems} {itemLabel}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={page === 1}
          onClick={() => onPageChange(Math.max(page - 1, 1))}
          className="flex items-center gap-1 rounded-full border border-black/[0.08] bg-white px-4 py-1.5 text-[11px] font-bold text-slate-600 transition-all hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-30"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          ก่อนหน้า
        </button>
        <span className="px-2 text-[11px] font-medium text-slate-400">
          {page} / {totalPages}
        </span>
        <button
          type="button"
          disabled={page === totalPages}
          onClick={() => onPageChange(Math.min(page + 1, totalPages))}
          className="flex items-center gap-1 rounded-full border border-black/[0.08] bg-white px-4 py-1.5 text-[11px] font-bold text-slate-600 transition-all hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-30"
        >
          ถัดไป
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: LeaveStatus }) {
  const c = STATUS_CONFIG[status];
  return (
    <span className={cn(
      'inline-flex min-w-8 items-center justify-center rounded-lg px-2 py-0.5 text-[11px] font-black',
      c.bg,
      c.text,
    )}>
      {c.label}
    </span>
  );
}

function DepartmentBadge({ departmentId }: { departmentId: Department }) {
  const cfg = DEPARTMENT_CONFIG[departmentId];
  return (
    <span
      className="inline-flex shrink-0 items-center rounded-md px-1.5 py-0.5 text-[10px] font-black"
      style={{
        color: cfg.color,
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
      }}
    >
      {cfg.label}
    </span>
  );
}

function GradeLevelBadge({ gradeLevel }: { gradeLevel: string }) {
  const style = getGradeLevelBadgeStyle(gradeLevel);
  return (
    <span
      className="inline-flex shrink-0 items-center rounded-md px-1.5 py-0.5 text-[10px] font-black"
      style={{
        color: style.color,
        backgroundColor: style.bg,
        border: `1px solid ${style.border}`,
      }}
    >
      {gradeLevel}
    </span>
  );
}

function LeaveCard({
  req,
  showApprover = false,
  showRequester = false,
  requesterProfile,
  onApprove,
  onReject,
}: {
  req: LeaveRequest;
  showApprover?: boolean;
  showRequester?: boolean;
  requesterProfile?: LeaveRequesterProfile | null;
  onApprove?: (id: string) => Promise<void>;
  onReject?: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const days = countDays(req.startDate, req.endDate);
  const displayName = req.requesterName?.trim() || '—';
  const dateLabel = formatLeaveDateCompact(req.startDate, req.endDate);
  const submittedAtLabel = formatLeaveSubmittedAt(req.createdAt);
  const showAvatar = showRequester || Boolean(req.requesterPhotoUrl || req.requesterName);
  const approverLabels = resolveLeaveApproverLabels(req, requesterProfile);
  const showApproverList = showRequester || showApprover;

  return (
    <motion.div layout className={LEAVE_CARD_OUTER}>
      <div
        className={cn(LEAVE_CARD_SHELL, expanded && 'ring-2 ring-blue-100')}
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-start gap-2.5">
            {showAvatar && (
              req.requesterPhotoUrl ? (
                <img
                  src={req.requesterPhotoUrl}
                  alt=""
                  className="h-10 w-10 shrink-0 rounded-xl object-cover"
                />
              ) : (
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 text-[11px] font-black text-slate-600">
                  {getInitials(displayName)}
                </div>
              )
            )}

            <div className="min-w-0 flex-1">
              <p
                className="truncate text-[13px] font-bold text-slate-800"
                title={showRequester ? displayName : LEAVE_TYPE_LABEL[req.leaveType]}
              >
                {showRequester ? displayName : LEAVE_TYPE_LABEL[req.leaveType]}
              </p>

              {showRequester && req.requesterStudentCode && (
                <p className="mt-0.5 text-[11px] font-medium text-blue-600 tabular-nums">
                  รหัส {req.requesterStudentCode}
                </p>
              )}

              {showRequester && requesterProfile && (requesterProfile.departmentId || requesterProfile.gradeLevel) && (
                <div className="mt-1 flex flex-wrap items-center gap-1">
                  {requesterProfile.departmentId && (
                    <DepartmentBadge departmentId={requesterProfile.departmentId} />
                  )}
                  {requesterProfile.gradeLevel && (
                    <GradeLevelBadge gradeLevel={requesterProfile.gradeLevel} />
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="shrink-0 text-center">
            <p className="mb-0.5 text-[9px] font-black uppercase tracking-wide text-slate-400">
              สถานะ
            </p>
            <StatusPill status={req.status} />
          </div>
        </div>

        <div className="mt-2.5 grid grid-cols-3 gap-2 border-t border-slate-100 pt-2.5">
          <div>
            <p className="text-[9px] font-black uppercase tracking-wide text-slate-400">
              ประเภท
            </p>
            <p className="mt-0.5 text-[11px] font-bold text-slate-700">
              {LEAVE_TYPE_LABEL[req.leaveType]}
            </p>
          </div>

          <div className="text-center">
            <p className="text-[9px] font-black uppercase tracking-wide text-slate-400">
              ยื่นคำขอ
            </p>
            <p
              className="mt-0.5 text-[10px] font-bold leading-tight text-slate-600 tabular-nums"
              title={submittedAtLabel}
            >
              {submittedAtLabel}
            </p>
          </div>

          <div className="text-right">
            <p className="mb-0.5 text-[9px] font-black uppercase tracking-wide text-slate-400">
              วันที่ลา
            </p>
            <span
              className="inline-flex max-w-[11rem] items-center justify-center rounded-lg bg-blue-50 px-2 py-0.5 text-[11px] font-black text-blue-700 sm:max-w-none"
              title={dateLabel}
            >
              <span className="truncate">{dateLabel}</span>
              <span className="ml-1 shrink-0 text-blue-500">({days} วัน)</span>
            </span>
          </div>
        </div>

        {showApproverList && approverLabels.length > 0 && (
          <div className="mt-2.5 border-t border-slate-100 pt-2.5">
            <p className="text-[9px] font-black uppercase tracking-wide text-slate-400">
              ผู้อนุมัติ
            </p>
            <div className="mt-1 flex flex-wrap gap-1">
              {approverLabels.map((name) => (
                <span
                  key={name}
                  className="inline-flex items-center rounded-md bg-violet-50 px-1.5 py-0.5 text-[10px] font-bold text-violet-700"
                >
                  {name}
                </span>
              ))}
            </div>
          </div>
        )}

        {req.status === 'pending' && onApprove && onReject && (
          <div
            className="mt-2.5 flex items-center justify-end gap-1.5 border-t border-slate-100 pt-2.5"
            onClick={e => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={async () => { await onApprove(req.id); }}
              className="inline-flex h-7 items-center justify-center rounded-lg bg-emerald-50 px-3 text-[11px] font-black text-emerald-700 transition-all hover:bg-emerald-100"
            >
              อนุมัติ
            </button>
            <button
              type="button"
              onClick={() => onReject(req.id)}
              className="inline-flex h-7 items-center justify-center rounded-lg bg-rose-50 px-3 text-[11px] font-black text-rose-700 transition-all hover:bg-rose-100"
            >
              ปฏิเสธ
            </button>
          </div>
        )}

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
            className="overflow-hidden"
          >
            <div className="mt-2.5 space-y-4 border-t border-slate-100 pt-2.5">
              <div className="space-y-2.5">
                <label className={modalLabelCls}>เหตุผลการลา</label>
                <p className="text-sm font-bold text-slate-600 leading-relaxed bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                  {req.reason || '—'}
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-6">
                <div className="flex items-center gap-8">
                  {showApprover && req.approverName && (
                    <div className="space-y-1">
                      <label className={modalLabelCls}>ผู้อนุมัติ</label>
                      <div className="text-sm font-black text-slate-700 flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-blue-500" />
                        {req.approverName}
                      </div>
                    </div>
                  )}
                  {req.approverNote && (
                    <div className="space-y-1">
                      <label className={modalLabelCls}>หมายเหตุการพิจารณา</label>
                      <div className="text-sm font-black text-rose-600">
                        {req.approverNote}
                      </div>
                    </div>
                  )}
                </div>

                {req.attachmentUrl && (
                  <a
                    href={req.attachmentUrl}
                    target="_blank"
                    rel="noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="flex items-center gap-2.5 h-11 px-5 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 hover:bg-blue-600 hover:text-white transition-all text-xs font-black shadow-sm"
                  >
                    <FileText size={16} /> ดูเอกสารแนบ
                  </a>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ── Submit Modal ─────────────────────────────────────────────────────────────
function SubmitModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (data: { leaveType: LeaveType; startDate: string; endDate: string; reason: string }) => Promise<void>;
}) {
  const earliestStartDate = getEarliestLeaveStartDate();
  const [leaveType, setLeaveType] = useState<LeaveType>('sick');
  const [startDate, setStartDate] = useState(earliestStartDate);
  const [endDate, setEndDate] = useState(earliestStartDate);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!reason.trim()) return;
    const validationError = validateLeaveSubmissionDates(startDate, endDate);
    if (validationError) {
      setSubmitError(validationError);
      return;
    }
    setSubmitError(null);
    setSaving(true);
    try {
      await onSubmit({ leaveType, startDate, endDate, reason: reason.trim() });
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'ไม่สามารถส่งคำขอได้ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormModal
      open={true}
      onClose={onClose}
      title="ยื่นคำขอลาใหม่"
      onSubmit={handleSubmit}
      submitLabel={saving ? 'กำลังส่ง...' : 'ยืนยันยื่นคำขอ'}
      submitDisabled={saving || !reason.trim() || !!validateLeaveSubmissionDates(startDate, endDate)}
      maxWidth="md"
    >
      <div className="space-y-6 py-2">
        {isSameDayLeaveCutoffPassed() && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-700">
            {LEAVE_SAME_DAY_CUTOFF_MESSAGE}
          </div>
        )}

        {submitError && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-600">
            {submitError}
          </div>
        )}

        {/* Leave type */}
        <div className="space-y-3">
          <label className={modalLabelCls}>ประเภทการลา <span className="text-rose-500">*</span></label>
          <div className="flex gap-2 p-1.5 bg-slate-50/80 rounded-[1.25rem] border border-slate-100/50">
            {(['sick', 'personal'] as LeaveType[]).map(t => (
              <button
                key={t}
                onClick={() => setLeaveType(t)}
                className={cn(
                  "flex-1 py-2.5 rounded-xl text-xs font-black transition-all",
                  leaveType === t
                    ? "bg-white text-blue-600 shadow-sm ring-1 ring-slate-200/60"
                    : "text-slate-400 hover:text-slate-600"
                )}
              >
                {LEAVE_TYPE_LABEL[t]}
              </button>
            ))}
          </div>
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className={modalLabelCls}>วันที่เริ่ม <span className="text-rose-500">*</span></label>
            <input
              type="date"
              value={startDate}
              min={earliestStartDate}
              onChange={e => {
                setSubmitError(null);
                setStartDate(e.target.value);
                if (e.target.value > endDate) setEndDate(e.target.value);
              }}
              className={modalInputCls}
            />
          </div>
          <div className="space-y-1.5">
            <label className={modalLabelCls}>วันที่สิ้นสุด <span className="text-rose-500">*</span></label>
            <input
              type="date"
              value={endDate}
              min={startDate}
              onChange={e => {
                setSubmitError(null);
                setEndDate(e.target.value);
              }}
              className={modalInputCls}
            />
          </div>
        </div>

        {/* Reason */}
        <div className="space-y-1.5">
          <label className={modalLabelCls}>เหตุผลการลา <span className="text-rose-500">*</span></label>
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            rows={4}
            placeholder="ระบุเหตุผลในการลาของคุณ..."
            className={cn(modalInputCls, "h-auto py-4 min-h-[120px] resize-none")}
          />
        </div>
      </div>
    </FormModal>
  );
}

// ── Reject Modal ─────────────────────────────────────────────────────────────
function RejectModal({
  requestId,
  onClose,
  onConfirm,
}: {
  requestId: string;
  onClose: () => void;
  onConfirm: (id: string, note: string) => Promise<void>;
}) {
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const handleConfirm = async () => {
    setSaving(true);
    try {
      await onConfirm(requestId, note);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormModal
      open={true}
      onClose={onClose}
      title="ปฏิเสธคำขอลา"
      subtitle="กรุณาระบุหมายเหตุหรือเหตุผลในการไม่อนุมัติคำขอชี้แจงผู้ยื่นคำขอ"
      onSubmit={handleConfirm}
      submitLabel={saving ? 'กำลังบันทึก...' : 'ยืนยันปฏิเสธ'}
      submitDisabled={saving}
      icon={<AlertCircle size={18} />}
      maxWidth="sm"
    >
      <div className="space-y-4 py-2">
        <div className="flex flex-col gap-1.5">
          <label className={modalLabelCls}>หมายเหตุการปฏิเสธ</label>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            rows={3}
            placeholder="ระบุเหตุผลในการปฏิเสธ (ไม่บังคับ)..."
            className={cn(modalInputCls, "h-auto py-4 min-h-[100px] resize-none")}
          />
        </div>
      </div>
    </FormModal>
  );
}

// ── Type Definitions ─────────────────────────────────────────────────────────
type LeaveQuotaSettings = {
  staffSickDays: number;
  staffPersonalDays: number;
  studentSickDays: number;
  studentPersonalDays: number;
};

type LeaveQuotaByAcademicYear = LeaveQuotaSettings & {
  academicYearStartDate?: string;
  academicYearEndDate?: string;
  updatedAt?: unknown;
  updatedBy?: string | null;
};

type LeaveQuotaDoc = Partial<LeaveQuotaSettings> & {
  quotasByAcademicYear?: Record<string, Partial<LeaveQuotaByAcademicYear>>;
};

const DEFAULT_LEAVE_QUOTA: LeaveQuotaSettings = {
  staffSickDays: 30,
  staffPersonalDays: 10,
  studentSickDays: 20,
  studentPersonalDays: 7,
};

const toSafeQuotaValue = (value: unknown, fallback: number): number => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : fallback;
};

const normalizeLeaveQuota = (raw?: Partial<LeaveQuotaSettings>): LeaveQuotaSettings => ({
  staffSickDays: toSafeQuotaValue(raw?.staffSickDays, DEFAULT_LEAVE_QUOTA.staffSickDays),
  staffPersonalDays: toSafeQuotaValue(raw?.staffPersonalDays, DEFAULT_LEAVE_QUOTA.staffPersonalDays),
  studentSickDays: toSafeQuotaValue(raw?.studentSickDays, DEFAULT_LEAVE_QUOTA.studentSickDays),
  studentPersonalDays: toSafeQuotaValue(raw?.studentPersonalDays, DEFAULT_LEAVE_QUOTA.studentPersonalDays),
});

const formatAcademicDate = (date: string): string => {
  const dt = new Date(date);
  if (Number.isNaN(dt.getTime())) return date;
  return dt.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
};

function getLeaveRequestSortTime(req: LeaveRequest): number {
  return parseLeaveTimestamp(req.createdAt)?.getTime() ?? new Date(req.startDate).getTime();
}

function sortLeaveRequestsByNewest(requests: LeaveRequest[]): LeaveRequest[] {
  return [...requests].sort((a, b) => getLeaveRequestSortTime(b) - getLeaveRequestSortTime(a));
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function LeaveManagementPage() {
  const { user, userData, role } = useAuth();
  const { activeYear, year: activeAcademicYear } = useActiveAcademicYear();
  const uid = user?.uid ?? '';
  const displayName = userData?.name || userData?.displayName || userData?.fullName || userData?.email || 'ผู้ใช้';
  const photoUrl = userData?.photoURL || userData?.profileImage || userData?.imageUrl || null;

  const isTeacher = role === 'teacher';
  const isAdmin = role === 'admin' || role === 'sysadmin';
  const requesterType = (role === 'student') ? 'student' : 'staff';

  const action = new URLSearchParams(window.location.search).get('action');
  const [pageTab, setPageTab] = useState<LeavePageTab>(isAdmin || isTeacher ? 'team' : 'my');
  const [showSubmit, setShowSubmit] = useState(false);

  useEffect(() => {
    if (action === 'new') setShowSubmit(true);
  }, [action]);

  const tabs: { key: LeavePageTab; label: string }[] = isAdmin
    ? [
        { key: 'my', label: 'คำขอของฉัน' },
        { key: 'team', label: 'ภาพรวมทีม' },
        { key: 'report', label: 'รายงาน' },
        { key: 'settings', label: 'ตั้งค่า' },
      ]
    : [
        { key: 'my', label: 'คำขอของฉัน' },
        { key: 'team', label: isTeacher ? 'การลานักเรียน' : 'ทีมงาน' },
      ];

  return (
    <div className="flex flex-1 flex-col min-h-0 gap-5 pb-28">
      <LeavePageTabMenu tabs={tabs} pageTab={pageTab} onTabChange={setPageTab} />

      <AnimatePresence mode="wait">
        {pageTab === 'my' && (
          <motion.div key="my" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}>
            <MyLeavePanel displayName={displayName} photoUrl={photoUrl} uid={uid} requesterType={requesterType} userData={userData} showSubmit={showSubmit} setShowSubmit={setShowSubmit} />
          </motion.div>
        )}
        {pageTab === 'team' && (
          <motion.div key="team" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
            <TeamLeavePanel isTeacher={isTeacher} />
          </motion.div>
        )}
        {pageTab === 'report' && isAdmin && (
          <motion.div key="report" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <ReportPanel />
          </motion.div>
        )}
        {pageTab === 'settings' && isAdmin && (
          <motion.div key="settings" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <SettingsPanel activeAcademicYear={activeAcademicYear} activeYear={activeYear} uid={uid} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── My Leave Panel ───────────────────────────────────────────────────────────
function MyLeavePanel({ displayName, photoUrl, uid, requesterType, userData, showSubmit, setShowSubmit }: {
  displayName: string;
  photoUrl: string | null;
  uid: string;
  requesterType: 'student' | 'staff';
  userData: any;
  showSubmit: boolean;
  setShowSubmit: (v: boolean) => void;
}) {
  const { year } = useActiveAcademicYear();
  const myHook = useMyLeaveRequests(uid, requesterType);
  const requesterClassMap = useLeaveRequesterClassMap(
    year,
    requesterType === 'student' ? [uid] : [],
  );
  const activeRequests = useMemo(
    () => sortLeaveRequestsByNewest(myHook.requests),
    [myHook.requests],
  );
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(activeRequests.length / LEAVE_REQUESTS_PER_PAGE));

  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [page, totalPages]);

  const paginatedRequests = useMemo(() => {
    const start = (page - 1) * LEAVE_REQUESTS_PER_PAGE;
    return activeRequests.slice(start, start + LEAVE_REQUESTS_PER_PAGE);
  }, [activeRequests, page]);

  const rangeStart = activeRequests.length === 0 ? 0 : (page - 1) * LEAVE_REQUESTS_PER_PAGE + 1;
  const rangeEnd = Math.min(page * LEAVE_REQUESTS_PER_PAGE, activeRequests.length);

  const [headerActionsPortalEl, setHeaderActionsPortalEl] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setHeaderActionsPortalEl(document.getElementById('header-portal-right-actions'));
  }, []);

  const handleSubmit = async (data: {
    leaveType: LeaveType;
    startDate: string;
    endDate: string;
    reason: string;
  }) => {
    const requesterStudentCode = typeof userData?.studentCode === 'string' ? userData.studentCode : null;
    await myHook.submit(data, displayName, photoUrl, requesterStudentCode, '', '');
  };

  return (
    <div className="flex flex-col gap-5">
      {headerActionsPortalEl && createPortal(
        <motion.button
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          onClick={() => setShowSubmit(true)}
          className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 transition-all active:scale-95"
          title="ยื่นคำขอลาใหม่"
        >
          <Plus size={18} />
        </motion.button>,
        headerActionsPortalEl
      )}

      <div className="flex-1 w-full space-y-4 bg-white/90 backdrop-blur-xl rounded-[2.5rem] p-6 border-2 border-slate-100 min-h-0 overflow-y-auto">
        <p className="text-sm font-black text-slate-800 uppercase tracking-tight mb-4">
          {myHook.requests.length > 0 ? `คำขอของฉัน (${activeRequests.length})` : 'ไม่พบคำขอ'}
        </p>
        {myHook.loading ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white/40 rounded-[2rem] border border-dashed border-white/60">
            <div className="w-8 h-8 border-4 border-slate-200 border-t-blue-500 rounded-full animate-spin mb-4" />
            <p className="text-sm font-bold text-slate-400">กำลังดึงข้อมูลรายการลา...</p>
          </div>
        ) : activeRequests.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white/40 rounded-[2rem] border border-dashed border-white/60">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
              <ClipboardList size={32} className="text-slate-300" />
            </div>
            <p className="text-sm font-black text-slate-800">ไม่พบรายการคำขอลา</p>
            <p className="text-xs font-bold text-slate-400 mt-1">
              เมื่อมีการยื่นคำขอใหม่ รายการจะปรากฏขึ้นที่นี่
            </p>
          </div>
        ) : (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-2.5">
              {paginatedRequests.map(req => (
                <LeaveCard
                  key={req.id}
                  req={req}
                  showApprover={true}
                  requesterProfile={requesterType === 'student' ? (requesterClassMap.get(uid) ?? null) : null}
                />
              ))}
            </motion.div>
            <LeaveListPagination
              page={page}
              totalPages={totalPages}
              totalItems={activeRequests.length}
              rangeStart={rangeStart}
              rangeEnd={rangeEnd}
              itemLabel="คำขอ"
              onPageChange={setPage}
            />
          </>
        )}
      </div>

      <AnimatePresence>
        {showSubmit && (
          <SubmitModal
            onClose={() => setShowSubmit(false)}
            onSubmit={handleSubmit}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Team Leave Panel ─────────────────────────────────────────────────────────
function TeamLeavePanelContent({
  isTeacher,
  requests,
  loading,
  updateStatus,
}: {
  isTeacher: boolean;
  requests: LeaveRequest[];
  loading: boolean;
  updateStatus: (id: string, status: LeaveStatus, note?: string) => Promise<void>;
}) {
  const { year } = useActiveAcademicYear();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(isTeacher ? 'pending' : 'all');
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const activeRequests = useMemo(() => {
    const filtered = requests.filter((r) => {
      if (statusFilter === 'all') return true;
      return r.status === statusFilter;
    });
    return sortLeaveRequestsByNewest(filtered);
  }, [requests, statusFilter]);

  const requesterIds = useMemo(
    () => activeRequests.map((r) => r.requesterId).filter(Boolean),
    [activeRequests],
  );
  const requesterClassMap = useLeaveRequesterClassMap(year, requesterIds);

  const totalPages = Math.max(1, Math.ceil(activeRequests.length / LEAVE_REQUESTS_PER_PAGE));

  useEffect(() => {
    setPage(1);
  }, [statusFilter]);

  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [page, totalPages]);

  const paginatedRequests = useMemo(() => {
    const start = (page - 1) * LEAVE_REQUESTS_PER_PAGE;
    return activeRequests.slice(start, start + LEAVE_REQUESTS_PER_PAGE);
  }, [activeRequests, page]);

  const rangeStart = activeRequests.length === 0 ? 0 : (page - 1) * LEAVE_REQUESTS_PER_PAGE + 1;
  const rangeEnd = Math.min(page * LEAVE_REQUESTS_PER_PAGE, activeRequests.length);

  const totalCount = requests.length;
  const approvedCount = requests.filter(r => r.status === 'approved').length;
  const pendingCount = requests.filter(r => r.status === 'pending').length;
  const rejectedCount = requests.filter(r => r.status === 'rejected').length;

  const handleApprove = async (id: string) => {
    await updateStatus(id, 'approved');
  };

  const handleRejectConfirm = async (id: string, note: string) => {
    await updateStatus(id, 'rejected', note);
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Stat Cards */}
      <div className="grid grid-cols-4 gap-2 md:gap-3">
        {[
          { label: 'คำขอทั้งหมด', value: totalCount, icon: ClipboardList, color: 'text-slate-600', status: 'all' as StatusFilter },
          { label: 'อนุมัติ', value: approvedCount, icon: CheckCircle2, color: 'text-emerald-600', status: 'approved' as StatusFilter },
          { label: 'รอพิจารณา', value: pendingCount, icon: Clock, color: 'text-amber-600', status: 'pending' as StatusFilter },
          { label: 'ไม่อนุมัติ', value: rejectedCount, icon: XCircle, color: 'text-rose-600', status: 'rejected' as StatusFilter },
        ].map((item) => {
          const isActive = statusFilter === item.status;
          return (
            <button
              key={item.label}
              onClick={() => setStatusFilter(item.status)}
              className={cn(
                'group relative flex min-w-0 flex-col items-center rounded-xl border-2 p-2.5 text-center transition-all sm:rounded-2xl sm:p-5',
                isActive
                  ? 'border-blue-200 bg-white shadow-lg shadow-blue-500/5 ring-2 ring-blue-50/50 sm:ring-4'
                  : 'border-slate-50 bg-white/50 hover:border-slate-200 hover:bg-white',
              )}
            >
              <div
                className={cn(
                  'mb-1.5 inline-flex h-8 w-8 items-center justify-center rounded-xl bg-white shadow-sm ring-1 transition-transform group-hover:scale-110 sm:mb-3 sm:h-10 sm:w-10 sm:rounded-2xl',
                  isActive ? 'ring-blue-100' : 'ring-slate-100',
                  item.color,
                )}
              >
                <item.icon className="h-4 w-4 sm:h-[18px] sm:w-[18px]" strokeWidth={2.5} />
              </div>
              <p className="truncate text-[8px] font-black uppercase tracking-wide text-slate-400 sm:text-[10px] sm:tracking-widest">
                {item.label}
              </p>
              <p className={cn('mt-0.5 text-lg font-black tabular-nums sm:mt-1 sm:text-2xl', item.color)}>
                {item.value}
              </p>
            </button>
          );
        })}
      </div>

      <div className="flex w-full flex-col gap-3 min-h-0">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white/40 rounded-[2rem] border border-dashed border-white/60">
            <div className="w-8 h-8 border-4 border-slate-200 border-t-blue-500 rounded-full animate-spin mb-4" />
            <p className="text-sm font-bold text-slate-400">กำลังดึงข้อมูลรายการลา...</p>
          </div>
        ) : activeRequests.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white/40 rounded-[2rem] border border-dashed border-white/60">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
              <ClipboardList size={32} className="text-slate-300" />
            </div>
            <p className="text-sm font-black text-slate-800">ไม่พบรายการคำขอลา</p>
            <p className="text-xs font-bold text-slate-400 mt-1">
              {isTeacher ? 'ยังไม่มีนักเรียนคนใดยื่นคำขอลา' : 'ยังไม่มีคำขอลาใด ๆ'}
            </p>
          </div>
        ) : (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-2.5">
              {paginatedRequests.map(req => (
                <LeaveCard
                  key={req.id}
                  req={req}
                  showRequester={true}
                  requesterProfile={requesterClassMap.get(req.requesterId) ?? null}
                  onApprove={handleApprove}
                  onReject={id => setRejectTarget(id)}
                />
              ))}
            </motion.div>
            <LeaveListPagination
              page={page}
              totalPages={totalPages}
              totalItems={activeRequests.length}
              rangeStart={rangeStart}
              rangeEnd={rangeEnd}
              itemLabel="คำขอ"
              onPageChange={setPage}
            />
          </>
        )}
      </div>

      <AnimatePresence>
        {rejectTarget && (
          <RejectModal
            requestId={rejectTarget}
            onClose={() => setRejectTarget(null)}
            onConfirm={handleRejectConfirm}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function TeacherTeamLeavePanel() {
  const { activeYear } = useActiveAcademicYear();
  const sinceDate = activeYear?.startDate || defaultAcademicYearStart();
  const { requests, loading, updateStatus } = useStudentLeaveRequests(sinceDate);
  return (
    <TeamLeavePanelContent
      isTeacher
      requests={requests}
      loading={loading}
      updateStatus={updateStatus}
    />
  );
}

function AdminTeamLeavePanel() {
  const { activeYear } = useActiveAcademicYear();
  const sinceDate = activeYear?.startDate || defaultAcademicYearStart();
  const { requests, loading, updateStatus } = useLeaveRequestsSince(sinceDate);
  return (
    <TeamLeavePanelContent
      isTeacher={false}
      requests={requests}
      loading={loading}
      updateStatus={updateStatus}
    />
  );
}

function TeamLeavePanel({ isTeacher }: { isTeacher: boolean }) {
  return isTeacher ? <TeacherTeamLeavePanel /> : <AdminTeamLeavePanel />;
}

// ── Report Panel ─────────────────────────────────────────────────────────────
function ReportPanel() {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex-1 w-full space-y-4 bg-white/90 backdrop-blur-xl rounded-[2.5rem] p-6 border-2 border-slate-100">
        <p className="text-sm font-black text-slate-800 uppercase tracking-tight">รายงาน</p>
        <p className="text-slate-500">ฟีเจอร์รายงานเร็ว ๆ นี้</p>
      </div>
    </div>
  );
}

// ── Settings Panel ───────────────────────────────────────────────────────────
function SettingsPanel({ activeAcademicYear, activeYear, uid }: {
  activeAcademicYear: string | number;
  activeYear?: any;
  uid: string;
}) {
  const [quota, setQuota] = useState<LeaveQuotaSettings>(DEFAULT_LEAVE_QUOTA);
  const [quotaLoading, setQuotaLoading] = useState(true);
  const [quotaSaving, setQuotaSaving] = useState(false);
  const [quotaError, setQuotaError] = useState<string | null>(null);

  const academicYearStartDate = activeYear?.startDate || '';
  const academicYearEndDate = activeYear?.endDate || '';
  const hasAcademicPeriod = Boolean(academicYearStartDate && academicYearEndDate);
  const academicPeriodLabel = hasAcademicPeriod
    ? `${formatAcademicDate(academicYearStartDate)} – ${formatAcademicDate(academicYearEndDate)}`
    : 'ยังไม่กำหนดช่วงวันเริ่มต้น/สิ้นสุดปีการศึกษา';

  useEffect(() => {
    let mounted = true;
    const loadQuota = async () => {
      setQuotaLoading(true);
      setQuotaError(null);
      try {
        const snap = await getDoc(doc(db, 'settings', 'leave_quota'));
        if (!mounted) return;
        if (snap.exists()) {
          const raw = snap.data() as LeaveQuotaDoc;
          const yearlyQuota = raw.quotasByAcademicYear?.[activeAcademicYear];
          const source = yearlyQuota ?? raw;
          setQuota(normalizeLeaveQuota(source));
        } else {
          setQuota(DEFAULT_LEAVE_QUOTA);
        }
      } catch {
        if (mounted) setQuotaError('โหลดค่าจำนวนวันลาไม่สำเร็จ');
      } finally {
        if (mounted) setQuotaLoading(false);
      }
    };
    void loadQuota();
    return () => { mounted = false; };
  }, [activeAcademicYear]);

  const handleQuotaChange = (key: keyof LeaveQuotaSettings, value: string) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return;
    setQuota(prev => ({ ...prev, [key]: Math.max(0, Math.floor(parsed)) }));
  };

  const handleSaveQuota = async () => {
    if (!hasAcademicPeriod) {
      setQuotaError('กรุณาตั้งค่าวันเริ่มต้นและวันสิ้นสุดปีการศึกษาในระบบก่อนบันทึกโควต้า');
      return;
    }

    setQuotaSaving(true);
    setQuotaError(null);
    try {
      await setDoc(doc(db, 'settings', 'leave_quota'), {
        quotasByAcademicYear: {
          [activeAcademicYear]: {
            ...quota,
            academicYearStartDate,
            academicYearEndDate,
            updatedAt: serverTimestamp(),
            updatedBy: uid || null,
          },
        },
        updatedAt: serverTimestamp(),
        updatedBy: uid || null,
      }, { merge: true });
    } catch {
      setQuotaError('บันทึกค่าจำนวนวันลาไม่สำเร็จ');
    } finally {
      setQuotaSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-3xl border border-slate-100 bg-white p-5">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center">
            <SlidersHorizontal size={18} />
          </div>
          <div>
            <p className="text-sm font-black text-slate-800">กำหนดวันลาสูงสุดต่อปีการศึกษา</p>
            <p className="text-xs font-semibold text-slate-400">
              ปีการศึกษา {activeAcademicYear} • {academicPeriodLabel}
            </p>
          </div>
        </div>

        {quotaLoading ? (
          <div className="flex items-center justify-center py-10">
            <div className="w-7 h-7 border-4 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className={modalLabelCls}>ครู/บุคลากร • ลาป่วย (วัน/ปี)</label>
                <input
                  type="number"
                  min={0}
                  value={quota.staffSickDays}
                  onChange={(e) => handleQuotaChange('staffSickDays', e.target.value)}
                  className={modalInputCls}
                />
              </div>
              <div className="space-y-1.5">
                <label className={modalLabelCls}>ครู/บุคลากร • ลากิจ (วัน/ปี)</label>
                <input
                  type="number"
                  min={0}
                  value={quota.staffPersonalDays}
                  onChange={(e) => handleQuotaChange('staffPersonalDays', e.target.value)}
                  className={modalInputCls}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className={modalLabelCls}>นักเรียน • ลาป่วย (วัน/ปี)</label>
                <input
                  type="number"
                  min={0}
                  value={quota.studentSickDays}
                  onChange={(e) => handleQuotaChange('studentSickDays', e.target.value)}
                  className={modalInputCls}
                />
              </div>
              <div className="space-y-1.5">
                <label className={modalLabelCls}>นักเรียน • ลากิจ (วัน/ปี)</label>
                <input
                  type="number"
                  min={0}
                  value={quota.studentPersonalDays}
                  onChange={(e) => handleQuotaChange('studentPersonalDays', e.target.value)}
                  className={modalInputCls}
                />
              </div>
            </div>

            {quotaError && (
              <div className="flex items-start gap-2 rounded-xl bg-rose-50 border border-rose-100 p-3 text-xs text-rose-600 font-bold">
                <AlertCircle size={14} className="mt-0.5 shrink-0" />
                {quotaError}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                onClick={handleSaveQuota}
                disabled={quotaSaving || !hasAcademicPeriod}
                className={cn(
                  "h-11 px-6 rounded-2xl text-sm font-black transition-all shadow-sm border flex items-center gap-2",
                  quotaSaving || !hasAcademicPeriod
                    ? "bg-slate-100 text-slate-400 border-slate-200"
                    : "bg-blue-600 text-white border-blue-600 hover:bg-blue-700"
                )}
              >
                <Save size={15} />
                {quotaSaving ? 'กำลังบันทึก...' : 'บันทึกจำนวนวันลา'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
