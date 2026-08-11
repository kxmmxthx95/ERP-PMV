// src/features/leave/LeaveManagementPage.tsx
import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ClipboardList, Plus, Check, X, Clock, FileText,
  ChevronLeft, ChevronRight, Save, AlertCircle, SlidersHorizontal,
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
import { getPortalMenuTitle } from '@/lib/portalMenu';
import { HEADER_ICON_BTN, HEADER_ICON_BTN_GROUP } from '@/lib/headerIconBtn';
import { Button } from '@/components/ui/button';

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

const STATUS_CONFIG: Record<LeaveStatus, { label: string; pill: string; icon: typeof Check }> = {
  pending: {
    label: 'รอพิจารณา',
    pill: 'bg-secondary text-secondary-foreground',
    icon: Clock,
  },
  approved: {
    label: 'อนุมัติแล้ว',
    pill: 'bg-primary/10 text-primary',
    icon: Check,
  },
  rejected: {
    label: 'ไม่อนุมัติ',
    pill: 'bg-destructive/10 text-destructive',
    icon: X,
  },
};

const LEAVE_REQUESTS_PER_PAGE = 8;

/** Desktop grid: ผู้ยื่น | แผนก | ห้อง | ประเภท | วันที่ลา | สถานะ | ผู้อนุมัติ | ดำเนินการ */
const LEAVE_REVIEW_TABLE_GRID =
  'minmax(0, 1.15fr) minmax(4.25rem, 0.5fr) minmax(4.75rem, 0.58fr) minmax(5.5rem, 0.62fr) minmax(7.5rem, 0.72fr) minmax(6.5rem, 0.68fr) minmax(0, 0.85fr) minmax(6.25rem, 0.72fr)';

const LEAVE_PANEL_SHELL = cn(
  'flex min-h-0 flex-1 w-full flex-col overflow-hidden',
  'rounded-none border-0 bg-transparent px-0 pb-2 pt-0',
  'md:rounded-2xl md:border md:border-border md:bg-card md:px-2 md:pb-2 md:pt-0 lg:px-2.5 lg:pb-2.5',
);

const LEAVE_EMPTY_SHELL = cn(
  'w-full rounded-2xl border border-dashed border-border bg-muted/40',
  'flex flex-col items-center justify-center px-6 py-10 text-center',
);

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

function formatLeaveSubmittedParts(
  ts: LeaveRequest['createdAt'] | undefined,
): { date: string; time: string } | null {
  const date = parseLeaveTimestamp(ts);
  if (!date || Number.isNaN(date.getTime())) return null;
  return {
    date: date.toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }),
    time: `${date.toLocaleTimeString('th-TH', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })} น.`,
  };
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
function StatusPill({ status }: { status: LeaveStatus }) {
  const c = STATUS_CONFIG[status];
  const Icon = c.icon;
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold font-sukhumvit',
        c.pill,
      )}
    >
      <Icon size={12} strokeWidth={2.5} aria-hidden />
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

function resolveLeaveActionByLabel(req: LeaveRequest): string {
  if (req.status === 'pending') return '';
  return req.approverName?.trim() || '';
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

function ClassroomBadge({ className, gradeLevel }: { className: string; gradeLevel?: string }) {
  const style = getGradeLevelBadgeStyle(gradeLevel || className.split('/')[0] || className);
  return (
    <span
      className="inline-flex shrink-0 items-center rounded-md px-1.5 py-0.5 text-[10px] font-black"
      style={{
        color: style.color,
        backgroundColor: style.bg,
        border: `1px solid ${style.border}`,
      }}
    >
      {className}
    </span>
  );
}

function LeaveReviewTableDeptRoomCells({
  profile,
}: {
  profile?: LeaveRequesterProfile | null;
}) {
  if (!profile?.departmentId && !profile?.className) {
    return (
      <>
        <span className="text-[13px] font-bold text-muted-foreground/40 font-sukhumvit">—</span>
        <span className="text-[13px] font-bold text-muted-foreground/40 font-sukhumvit">—</span>
      </>
    );
  }

  return (
    <>
      <div>
        {profile?.departmentId ? (
          <DepartmentBadge departmentId={profile.departmentId} />
        ) : (
          <span className="text-[13px] font-bold text-muted-foreground/40 font-sukhumvit">—</span>
        )}
      </div>
      <div>
        {profile?.className ? (
          <ClassroomBadge className={profile.className} gradeLevel={profile.gradeLevel} />
        ) : profile?.gradeLevel ? (
          <GradeLevelBadge gradeLevel={profile.gradeLevel} />
        ) : (
          <span className="text-[13px] font-bold text-muted-foreground/40 font-sukhumvit">—</span>
        )}
      </div>
    </>
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
  const [approving, setApproving] = useState(false);
  const days = countDays(req.startDate, req.endDate);
  const displayName = req.requesterName?.trim() || '—';
  const dateLabel = formatLeaveDateCompact(req.startDate, req.endDate);
  const submittedAt = formatLeaveSubmittedParts(req.createdAt);
  const showAvatar = showRequester || Boolean(req.requesterPhotoUrl || req.requesterName);
  const approverLabels = resolveLeaveApproverLabels(req, requesterProfile);
  const showApproverList = showRequester || showApprover;
  const title = showRequester ? displayName : LEAVE_TYPE_LABEL[req.leaveType];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'overflow-hidden rounded-2xl border border-border bg-card transition-colors',
        expanded && 'border-foreground/20',
      )}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full p-3 text-left transition-colors hover:bg-muted/40 active:scale-[0.99]"
        aria-expanded={expanded}
      >
        <div className="flex items-start gap-3">
          {showAvatar ? (
            req.requesterPhotoUrl ? (
              <img
                src={req.requesterPhotoUrl}
                alt=""
                className="h-10 w-10 shrink-0 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-black text-muted-foreground font-sukhumvit">
                {getInitials(displayName)}
              </div>
            )
          ) : (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <ClipboardList size={18} aria-hidden />
            </div>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-[13px] font-bold text-foreground font-sukhumvit" title={title}>
                  {title}
                </p>
                {showRequester && req.requesterStudentCode ? (
                  <p className="mt-0.5 text-[13px] font-black text-foreground font-sukhumvit tabular-nums">
                    {req.requesterStudentCode}
                  </p>
                ) : null}
              </div>
              <StatusPill status={req.status} />
            </div>

            {showRequester && requesterProfile && (requesterProfile.departmentId || requesterProfile.className || requesterProfile.gradeLevel) ? (
              <div className="mt-1.5 flex flex-wrap items-center gap-1">
                {requesterProfile.departmentId ? (
                  <DepartmentBadge departmentId={requesterProfile.departmentId} />
                ) : null}
                {requesterProfile.className ? (
                  <ClassroomBadge className={requesterProfile.className} gradeLevel={requesterProfile.gradeLevel} />
                ) : requesterProfile.gradeLevel ? (
                  <GradeLevelBadge gradeLevel={requesterProfile.gradeLevel} />
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-2.5 grid grid-cols-3 gap-2 border-t border-border pt-2.5">
          <div>
            <p className="text-[10px] font-bold text-muted-foreground font-sukhumvit">ประเภท</p>
            <span className="mt-1 inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary font-sukhumvit">
              {LEAVE_TYPE_LABEL[req.leaveType]}
            </span>
          </div>
          <div>
            <p className="text-[10px] font-bold text-muted-foreground font-sukhumvit">ยื่นคำขอ</p>
            {submittedAt ? (
              <>
                <p className="mt-1 text-[11px] font-bold leading-snug text-foreground font-sukhumvit tabular-nums">
                  {submittedAt.date}
                </p>
                <p className="text-[11px] font-bold leading-snug text-foreground font-sukhumvit tabular-nums">
                  {submittedAt.time}
                </p>
              </>
            ) : (
              <p className="mt-1 text-[11px] font-bold text-muted-foreground/40">—</p>
            )}
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold text-muted-foreground font-sukhumvit">วันที่ลา</p>
            <p className="mt-1 text-[11px] font-black leading-snug text-foreground font-sukhumvit tabular-nums">
              {dateLabel}
              <span className="ml-1 font-bold text-muted-foreground">({days} วัน)</span>
            </p>
          </div>
        </div>

        {showApproverList && (approverLabels.length > 0 || resolveLeaveActionByLabel(req)) ? (
          <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-border pt-2">
            <span className="shrink-0 text-[11px] font-bold text-muted-foreground font-sukhumvit">
              {req.status === 'pending' ? 'ผู้อนุมัติ (คาด)' : 'ผู้อนุมัติ'}
            </span>
            <span className="truncate text-right text-[12px] font-bold text-foreground font-sukhumvit">
              {resolveLeaveActionByLabel(req) || approverLabels.join(', ') || '—'}
            </span>
          </div>
        ) : null}
      </button>

      {req.status === 'pending' && onApprove && onReject ? (
        <div
          className="flex gap-2 border-t border-border px-3 pb-3 pt-2"
          onClick={(e) => e.stopPropagation()}
        >
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 flex-1 rounded-xl text-xs font-bold"
            disabled={approving}
            onClick={() => onReject(req.id)}
          >
            ปฏิเสธ
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-9 flex-1 rounded-xl text-xs font-bold"
            disabled={approving}
            onClick={async () => {
              setApproving(true);
              try {
                await onApprove(req.id);
              } finally {
                setApproving(false);
              }
            }}
          >
            {approving ? 'กำลังอนุมัติ...' : 'อนุมัติ'}
          </Button>
        </div>
      ) : null}

      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
            className="overflow-hidden"
          >
            <div className="space-y-3 border-t border-border px-3 pb-3 pt-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground font-sukhumvit">
                  เหตุผลการลา
                </p>
                <p className="mt-1.5 rounded-xl bg-muted/50 px-3 py-2.5 text-[13px] font-bold leading-relaxed text-foreground font-sukhumvit">
                  {req.reason || '—'}
                </p>
              </div>

              {req.approverNote ? (
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground font-sukhumvit">
                    หมายเหตุการพิจารณา
                  </p>
                  <p className="mt-1.5 text-[13px] font-bold text-destructive font-sukhumvit">
                    {req.approverNote}
                  </p>
                </div>
              ) : null}

              {showApprover && req.approverName ? (
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground font-sukhumvit">
                    ผู้อนุมัติ
                  </p>
                  <p className="mt-1 text-[13px] font-bold text-foreground font-sukhumvit">
                    {req.approverName}
                  </p>
                </div>
              ) : null}

              {req.attachmentUrl ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="h-9 w-full rounded-xl text-xs font-bold"
                  asChild
                >
                  <a
                    href={req.attachmentUrl}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <FileText size={14} />
                    ดูเอกสารแนบ
                  </a>
                </Button>
              ) : null}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
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
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-3 text-xs font-bold text-amber-700">
            {LEAVE_SAME_DAY_CUTOFF_MESSAGE}
          </div>
        )}

        {submitError && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-3 text-xs font-bold text-rose-600">
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

  const [headerCenterMobileEl, setHeaderCenterMobileEl] = useState<HTMLElement | null>(null);
  const pageTitle = getPortalMenuTitle('/portal/leave') ?? 'จัดการการลา';

  useEffect(() => {
    setHeaderCenterMobileEl(document.getElementById('header-portal-center-mobile'));
  }, []);

  useEffect(() => {
    document.getElementById('portal-scroll-container')?.scrollTo({ top: 0 });
  }, [pageTab]);

  const tabs: { key: LeavePageTab; label: string }[] = isAdmin
    ? [
        { key: 'my', label: 'คำขอของฉัน' },
        { key: 'team', label: 'ภาพรวมทีม' },
        { key: 'report', label: 'รายงาน' },
        { key: 'settings', label: 'ตั้งค่า' },
      ]
    : isTeacher
      ? [
          { key: 'my', label: 'คำขอของฉัน' },
          { key: 'team', label: 'การลานักเรียน' },
        ]
      : [
          { key: 'my', label: 'คำขอของฉัน' },
          { key: 'team', label: 'ทีมงาน' },
        ];

  return (
    <>
      {headerCenterMobileEl && createPortal(
        <div className="pointer-events-none flex items-center gap-1.5 lg:hidden min-w-0">
          <ClipboardList size={16} className="shrink-0 text-black/80" aria-hidden />
          <span className="truncate font-sukhumvit text-[13px] font-black leading-none tracking-tight text-black/80">
            {pageTitle}
          </span>
        </div>,
        headerCenterMobileEl,
      )}

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
      <LeavePageTabMenu tabs={tabs} pageTab={pageTab} onTabChange={setPageTab} />

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {pageTab === 'my' && (
        <MyLeavePanel displayName={displayName} photoUrl={photoUrl} uid={uid} requesterType={requesterType} userData={userData} showSubmit={showSubmit} setShowSubmit={setShowSubmit} />
      )}
      {pageTab === 'team' && (
        isTeacher ? <StudentLeaveReviewPanel /> : <TeamLeavePanel isTeacher={isTeacher} />
      )}
      {pageTab === 'report' && isAdmin && (
        <ReportPanel />
      )}
      {pageTab === 'settings' && isAdmin && (
        <SettingsPanel activeAcademicYear={activeAcademicYear} activeYear={activeYear} uid={uid} />
      )}
      </div>
      </div>
    </>
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
  const requesterStudentCodes = useMemo(
    () => (requesterType === 'student' && userData?.studentCode
      ? { [uid]: String(userData.studentCode) }
      : {}),
    [requesterType, uid, userData?.studentCode],
  );
  const requesterClassMap = useLeaveRequesterClassMap(
    year,
    requesterType === 'student' ? [uid] : [],
    requesterStudentCodes,
  );
  const activeRequests = useMemo(
    () => sortLeaveRequestsByNewest(myHook.requests),
    [myHook.requests],
  );
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
    <>
      {headerActionsPortalEl && createPortal(
        <div className={cn('pointer-events-auto flex', HEADER_ICON_BTN_GROUP)}>
          <button
            type="button"
            onClick={() => setShowSubmit(true)}
            className={HEADER_ICON_BTN}
            title="ยื่นคำขอลาใหม่"
            aria-label="ยื่นคำขอลาใหม่"
          >
            <Plus size={16} />
          </button>
        </div>,
        headerActionsPortalEl,
      )}

      <div className={LEAVE_PANEL_SHELL}>
        {activeRequests.length > 0 ? (
          <div className="mb-2 flex h-[3.25rem] w-full shrink-0 items-center gap-3 border-b border-border pb-2 pt-2 sm:pt-2.5">
            <p className="text-sm font-black text-foreground uppercase tracking-tight font-sukhumvit">
              คำขอของฉัน ({activeRequests.length})
            </p>
          </div>
        ) : null}

        <div
          className={cn(
            'min-h-0 flex-1',
            myHook.loading || activeRequests.length === 0
              ? 'flex items-center justify-center overflow-hidden'
              : 'overflow-hidden',
          )}
        >
          {myHook.loading ? (
            <div className={LEAVE_EMPTY_SHELL}>
              <div className="mb-3 h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-primary" />
              <p className="text-sm font-bold text-muted-foreground">กำลังดึงข้อมูลรายการลา...</p>
            </div>
          ) : activeRequests.length === 0 ? (
            <div className={LEAVE_EMPTY_SHELL}>
              <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                <ClipboardList size={28} className="text-muted-foreground/50" />
              </div>
              <p className="text-sm font-black text-foreground">ไม่พบรายการคำขอลา</p>
              <p className="mt-1 text-xs font-bold text-muted-foreground">
                เมื่อมีการยื่นคำขอใหม่ รายการจะปรากฏขึ้นที่นี่
              </p>
            </div>
          ) : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex h-full flex-col gap-2.5 overflow-y-auto">
              {activeRequests.map(req => (
                <LeaveCard
                  key={req.id}
                  req={req}
                  showApprover={true}
                  requesterProfile={requesterType === 'student' ? (requesterClassMap.get(uid) ?? null) : null}
                />
              ))}
            </motion.div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showSubmit && (
          <SubmitModal
            onClose={() => setShowSubmit(false)}
            onSubmit={handleSubmit}
          />
        )}
      </AnimatePresence>
    </>
  );
}

// ── Student Leave Review Panel (teacher) ────────────────────────────────────
// Built as a single scroll region on purpose — no nested flex-1/overflow chains,
// no internal "sticky header + pinned footer" — that layered layout kept drifting
// out of sync with the page's fixed h-[calc(100dvh-4.25rem)] shell.
function StudentLeaveReviewPanel() {
  const { activeYear, year } = useActiveAcademicYear();
  const sinceDate = activeYear?.startDate || defaultAcademicYearStart();
  const { requests, loading, updateStatus } = useStudentLeaveRequests(sinceDate);
  const { user, userData } = useAuth();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const requesterIds = useMemo(
    () => requests.map((r) => r.requesterId).filter(Boolean),
    [requests],
  );
  const requesterStudentCodes = useMemo(
    () => Object.fromEntries(
      requests
        .map((r) => [r.requesterId, String(r.requesterStudentCode ?? '').trim()] as const)
        .filter((entry): entry is [string, string] => Boolean(entry[1])),
    ),
    [requests],
  );
  const requesterClassMap = useLeaveRequesterClassMap(year, requesterIds, requesterStudentCodes);

  const activeRequests = useMemo(() => {
    const filtered = requests.filter((r) => statusFilter === 'all' || r.status === statusFilter);
    return sortLeaveRequestsByNewest(filtered);
  }, [requests, statusFilter]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter]);

  const totalPages = Math.max(1, Math.ceil(activeRequests.length / LEAVE_REQUESTS_PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const rangeStart = activeRequests.length === 0 ? 0 : (currentPage - 1) * LEAVE_REQUESTS_PER_PAGE + 1;
  const rangeEnd = Math.min(currentPage * LEAVE_REQUESTS_PER_PAGE, activeRequests.length);
  const paginatedRequests = useMemo(
    () => activeRequests.slice((currentPage - 1) * LEAVE_REQUESTS_PER_PAGE, currentPage * LEAVE_REQUESTS_PER_PAGE),
    [activeRequests, currentPage],
  );

  const currentApproverName = userData?.name || userData?.displayName || userData?.fullName || userData?.email || user?.displayName || 'ผู้ใช้';
  const currentApproverId = user?.uid || '';

  const handleApprove = async (id: string) => {
    await updateStatus(id, 'approved', undefined, currentApproverId, currentApproverName);
  };

  const handleRejectConfirm = async (id: string, note: string) => {
    await updateStatus(id, 'rejected', note, currentApproverId, currentApproverName);
  };

  return (
    <div className={LEAVE_PANEL_SHELL}>
      {/* TOP BAR — identical recipe to MyLeavePanel's top bar */}
      <div className="mb-2 flex h-[3.25rem] w-full shrink-0 items-center gap-3 border-b border-border pb-2 pt-2 sm:pt-2.5">
        <div className="flex w-full items-center gap-1 rounded-xl bg-muted p-1 md:w-fit">
          {([
            { value: 'all' as StatusFilter, label: 'ทั้งหมด' },
            { value: 'pending' as StatusFilter, label: 'รอพิจารณา' },
            { value: 'approved' as StatusFilter, label: 'อนุมัติแล้ว' },
            { value: 'rejected' as StatusFilter, label: 'ไม่อนุมัติ' },
          ]).map((opt) => {
            const isActive = statusFilter === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setStatusFilter(opt.value)}
                className={cn(
                  'flex-1 whitespace-nowrap rounded-lg px-1 py-1 text-center text-[10px] font-black font-sukhumvit md:flex-none md:px-3.5 md:text-[11px]',
                  isActive ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Single scroll region — everything scrolls together, no nested overflow */}
      <div
        className={cn(
          'min-h-0 flex-1',
          loading || activeRequests.length === 0
            ? 'flex items-center justify-center overflow-hidden'
            : 'overflow-y-auto',
        )}
      >
        {loading ? (
          <div className={LEAVE_EMPTY_SHELL}>
            <div className="mb-3 h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-primary" />
            <p className="text-sm font-bold text-muted-foreground">กำลังดึงข้อมูลรายการลา...</p>
          </div>
        ) : activeRequests.length === 0 ? (
          <div className={LEAVE_EMPTY_SHELL}>
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <ClipboardList size={28} className="text-muted-foreground/50" />
            </div>
            <p className="text-sm font-black text-foreground">ไม่พบรายการคำขอลา</p>
            <p className="mt-1 text-xs font-bold text-muted-foreground">ยังไม่มีนักเรียนคนใดยื่นคำขอลา</p>
          </div>
        ) : (
          <>
            {/* Mobile: cards */}
            <div className="flex flex-col gap-2.5 md:hidden">
              {paginatedRequests.map((req) => (
                <LeaveCard
                  key={req.id}
                  req={req}
                  showRequester={true}
                  requesterProfile={requesterClassMap.get(req.requesterId) ?? null}
                  onApprove={handleApprove}
                  onReject={(id) => setRejectTarget(id)}
                />
              ))}
            </div>

            {/* Desktop: table — no internal scroll, scrolls together with parent */}
            <div className="hidden md:block rounded-xl border border-border overflow-hidden">
              <div
                style={{ display: 'grid', gridTemplateColumns: LEAVE_REVIEW_TABLE_GRID }}
                className="gap-3 border-b border-border bg-muted px-3 py-3"
              >
                <p className="text-[13px] font-black text-foreground font-sukhumvit whitespace-nowrap">ผู้ยื่นคำขอ</p>
                <p className="text-[13px] font-black text-foreground font-sukhumvit whitespace-nowrap">แผนก</p>
                <p className="text-[13px] font-black text-foreground font-sukhumvit whitespace-nowrap">ห้อง</p>
                <p className="text-[13px] font-black text-foreground font-sukhumvit whitespace-nowrap">ประเภท</p>
                <p className="text-[13px] font-black text-foreground font-sukhumvit whitespace-nowrap">วันที่ลา</p>
                <p className="text-[13px] font-black text-foreground font-sukhumvit whitespace-nowrap">สถานะ</p>
                <p className="text-[13px] font-black text-foreground font-sukhumvit whitespace-nowrap">ผู้อนุมัติ</p>
                <p className="text-[13px] font-black text-foreground font-sukhumvit whitespace-nowrap">การดำเนินการ</p>
              </div>
              {paginatedRequests.map((req) => {
                const days = countDays(req.startDate, req.endDate);
                const requesterProfile = requesterClassMap.get(req.requesterId) ?? null;
                const actionBy = resolveLeaveActionByLabel(req);
                return (
                  <div
                    key={req.id}
                    style={{ display: 'grid', gridTemplateColumns: LEAVE_REVIEW_TABLE_GRID }}
                    className="gap-3 border-b border-border px-3 py-3 items-center hover:bg-muted/40 last:border-b-0"
                  >
                    <div className="min-w-0">
                      <p className="text-[13px] font-bold text-foreground font-sukhumvit truncate">{req.requesterName || '—'}</p>
                      {req.requesterStudentCode && (
                        <p className="text-[11px] font-medium text-primary tabular-nums mt-0.5">รหัส {req.requesterStudentCode}</p>
                      )}
                    </div>
                    <LeaveReviewTableDeptRoomCells profile={requesterProfile} />
                    <p className="text-[13px] font-bold text-foreground font-sukhumvit">{LEAVE_TYPE_LABEL[req.leaveType]}</p>
                    <div>
                      <p className="text-[13px] font-bold text-foreground font-sukhumvit">{formatLeaveDateCompact(req.startDate, req.endDate)}</p>
                      <p className="text-[11px] font-semibold text-muted-foreground mt-0.5">{days} วัน</p>
                    </div>
                    <div>
                      <StatusPill status={req.status} />
                    </div>
                    <p className={cn(
                      'text-[13px] font-bold font-sukhumvit truncate',
                      actionBy ? 'text-foreground' : 'text-muted-foreground/40',
                    )}>
                      {actionBy || '—'}
                    </p>
                    <div className="flex items-center gap-1.5">
                      {req.status === 'pending' ? (
                        <>
                          <button
                            type="button"
                            onClick={async () => { await handleApprove(req.id); }}
                            className="inline-flex h-7 items-center justify-center rounded-lg bg-emerald-50 px-2 text-[10px] font-black text-emerald-700 hover:bg-emerald-100"
                            title="อนุมัติ"
                          >
                            อนุมัติ
                          </button>
                          <button
                            type="button"
                            onClick={() => setRejectTarget(req.id)}
                            className="inline-flex h-7 items-center justify-center rounded-lg bg-rose-50 px-2 text-[10px] font-black text-rose-700 hover:bg-rose-100"
                            title="ปฏิเสธ"
                          >
                            ปฏิเสธ
                          </button>
                        </>
                      ) : (
                        <span className="text-slate-300 font-bold text-[13px] pl-4">—</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {totalPages > 1 && (
              <div className="mt-3 flex flex-col items-center gap-2 sm:flex-row sm:justify-between">
                <p className="text-[11px] font-semibold text-slate-400">
                  แสดง {rangeStart}–{rangeEnd} จาก {activeRequests.length} คำขอ
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={currentPage === 1}
                    onClick={() => setPage(Math.max(currentPage - 1, 1))}
                    className="flex items-center gap-1 rounded-full border border-black/[0.08] bg-white px-4 py-1.5 text-[11px] font-bold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    ก่อนหน้า
                  </button>
                  <span className="px-2 text-[11px] font-medium text-slate-400">{currentPage} / {totalPages}</span>
                  <button
                    type="button"
                    disabled={currentPage === totalPages}
                    onClick={() => setPage(Math.min(currentPage + 1, totalPages))}
                    className="flex items-center gap-1 rounded-full border border-black/[0.08] bg-white px-4 py-1.5 text-[11px] font-bold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    ถัดไป
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}
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
  updateStatus: (id: string, status: LeaveStatus, note?: string, approverId?: string, approverName?: string) => Promise<void>;
}) {
  const { year } = useActiveAcademicYear();
  const { user, userData } = useAuth();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(isTeacher ? 'pending' : 'all');
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const requesterIds = useMemo(
    () => requests.map((r) => r.requesterId).filter(Boolean),
    [requests],
  );
  const requesterStudentCodes = useMemo(
    () => Object.fromEntries(
      requests
        .map((r) => [r.requesterId, String(r.requesterStudentCode ?? '').trim()] as const)
        .filter((entry): entry is [string, string] => Boolean(entry[1])),
    ),
    [requests],
  );
  const requesterClassMap = useLeaveRequesterClassMap(year, requesterIds, requesterStudentCodes);

  const activeRequests = useMemo(() => {
    const filtered = requests.filter((r) => {
      if (statusFilter === 'all') return true;
      return r.status === statusFilter;
    });
    return sortLeaveRequestsByNewest(filtered);
  }, [requests, statusFilter]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter]);

  const totalPages = Math.max(1, Math.ceil(activeRequests.length / LEAVE_REQUESTS_PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const rangeStart = activeRequests.length === 0 ? 0 : (currentPage - 1) * LEAVE_REQUESTS_PER_PAGE + 1;
  const rangeEnd = Math.min(currentPage * LEAVE_REQUESTS_PER_PAGE, activeRequests.length);
  const paginatedRequests = useMemo(
    () => activeRequests.slice((currentPage - 1) * LEAVE_REQUESTS_PER_PAGE, currentPage * LEAVE_REQUESTS_PER_PAGE),
    [activeRequests, currentPage],
  );

  const currentApproverName = userData?.name || userData?.displayName || userData?.fullName || userData?.email || user?.displayName || 'ผู้ใช้';
  const currentApproverId = user?.uid || '';

  const handleApprove = async (id: string) => {
    await updateStatus(id, 'approved', undefined, currentApproverId, currentApproverName);
  };

  const handleRejectConfirm = async (id: string, note: string) => {
    await updateStatus(id, 'rejected', note, currentApproverId, currentApproverName);
  };

  return (
    <div className={LEAVE_PANEL_SHELL}>
      {/* TOP BAR — Status Filter Tabs */}
      <div className="mb-2 flex h-[3.25rem] w-full shrink-0 items-center gap-3 border-b border-border pb-2 pt-2 sm:pt-2.5">
        <div className="flex w-full items-center gap-1 rounded-xl bg-muted p-1 md:w-fit">
          {[
            { value: 'all' as StatusFilter, label: 'ทั้งหมด' },
            { value: 'pending' as StatusFilter, label: 'รอพิจารณา' },
            { value: 'approved' as StatusFilter, label: 'อนุมัติแล้ว' },
            { value: 'rejected' as StatusFilter, label: 'ไม่อนุมัติ' },
          ].map((opt) => {
            const isActive = statusFilter === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setStatusFilter(opt.value)}
                className={cn(
                  'flex-1 whitespace-nowrap rounded-lg px-1 py-1 text-center text-[10px] font-black font-sukhumvit md:flex-none md:px-3.5 md:text-[11px]',
                  isActive
                    ? 'bg-card text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* BODY */}
      <div
        className={cn(
          'min-h-0 flex-1',
          loading || activeRequests.length === 0
            ? 'flex items-center justify-center overflow-hidden'
            : 'overflow-hidden',
        )}
      >
        {loading ? (
          <div className={LEAVE_EMPTY_SHELL}>
            <div className="mb-3 h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-primary" />
            <p className="text-sm font-bold text-muted-foreground">กำลังดึงข้อมูลรายการลา...</p>
          </div>
        ) : activeRequests.length === 0 ? (
          <div className={LEAVE_EMPTY_SHELL}>
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <ClipboardList size={28} className="text-muted-foreground/50" />
            </div>
            <p className="text-sm font-black text-foreground">ไม่พบรายการคำขอลา</p>
            <p className="mt-1 text-xs font-bold text-muted-foreground">
              {isTeacher ? 'ยังไม่มีนักเรียนคนใดยื่นคำขอลา' : 'ยังไม่มีคำขอลาใด ๆ'}
            </p>
          </div>
        ) : (
          <>
            {/* Mobile: cards */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex h-full flex-col gap-2.5 overflow-y-auto md:hidden">
              {paginatedRequests.map((req, i) => (
                <motion.div
                  key={req.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.02 }}
                >
                  <LeaveCard
                    req={req}
                    showRequester={true}
                    requesterProfile={requesterClassMap.get(req.requesterId) ?? null}
                    onApprove={handleApprove}
                    onReject={id => setRejectTarget(id)}
                  />
                </motion.div>
              ))}
            </motion.div>

            {/* Desktop: table */}
            <div className="hidden h-full flex-col overflow-hidden rounded-2xl border border-border bg-card md:flex">
              <div style={{ display: 'grid', gridTemplateColumns: LEAVE_REVIEW_TABLE_GRID }} className="gap-3 border-b border-border bg-muted px-3 py-3 shrink-0">
                <p className="text-[13px] font-black text-foreground font-sukhumvit whitespace-nowrap">ผู้ยื่นคำขอ</p>
                <p className="text-[13px] font-black text-foreground font-sukhumvit whitespace-nowrap">แผนก</p>
                <p className="text-[13px] font-black text-foreground font-sukhumvit whitespace-nowrap">ห้อง</p>
                <p className="text-[13px] font-black text-foreground font-sukhumvit whitespace-nowrap">ประเภท</p>
                <p className="text-[13px] font-black text-foreground font-sukhumvit whitespace-nowrap">วันที่ลา</p>
                <p className="text-[13px] font-black text-foreground font-sukhumvit whitespace-nowrap">สถานะ</p>
                <p className="text-[13px] font-black text-foreground font-sukhumvit whitespace-nowrap">ผู้อนุมัติ</p>
                <p className="text-[13px] font-black text-foreground font-sukhumvit whitespace-nowrap">การดำเนินการ</p>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto">
                {paginatedRequests.map((req, i) => {
                  const days = countDays(req.startDate, req.endDate);
                  const requesterProfile = requesterClassMap.get(req.requesterId) ?? null;
                  const actionBy = resolveLeaveActionByLabel(req);
                  return (
                    <motion.div
                      key={req.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.015 }}
                      style={{ display: 'grid', gridTemplateColumns: LEAVE_REVIEW_TABLE_GRID }}
                      className="gap-3 border-b border-border px-3 py-3 items-center hover:bg-muted/40 transition-colors last:border-b-0"
                    >
                      <div className="min-w-0">
                        <p className="text-[13px] font-bold text-foreground font-sukhumvit truncate">
                          {req.requesterName || '—'}
                        </p>
                        {req.requesterStudentCode && (
                          <p className="text-[11px] font-medium text-primary tabular-nums mt-0.5">
                            รหัส {req.requesterStudentCode}
                          </p>
                        )}
                      </div>
                      <LeaveReviewTableDeptRoomCells profile={requesterProfile} />
                      <p className="text-[13px] font-bold text-foreground font-sukhumvit">
                        {LEAVE_TYPE_LABEL[req.leaveType]}
                      </p>
                      <div>
                        <p className="text-[13px] font-bold text-foreground font-sukhumvit">
                          {formatLeaveDateCompact(req.startDate, req.endDate)}
                        </p>
                        <p className="text-[11px] font-semibold text-muted-foreground mt-0.5">
                          {days} วัน
                        </p>
                      </div>
                      <div>
                        <StatusPill status={req.status} />
                      </div>
                      <p className={cn(
                        'text-[13px] font-bold font-sukhumvit truncate',
                        actionBy ? 'text-foreground' : 'text-muted-foreground/40',
                      )}>
                        {actionBy || '—'}
                      </p>
                      <div className="flex items-center gap-1.5">
                        {req.status === 'pending' ? (
                          <>
                            <button
                              type="button"
                              onClick={async () => { await handleApprove(req.id); }}
                              className="inline-flex h-7 items-center justify-center rounded-lg bg-emerald-50 px-2 text-[10px] font-black text-emerald-700 transition-all hover:bg-emerald-100"
                              title="อนุมัติ"
                            >
                              อนุมัติ
                            </button>
                            <button
                              type="button"
                              onClick={() => setRejectTarget(req.id)}
                              className="inline-flex h-7 items-center justify-center rounded-lg bg-rose-50 px-2 text-[10px] font-black text-rose-700 transition-all hover:bg-rose-100"
                              title="ปฏิเสธ"
                            >
                              ปฏิเสธ
                            </button>
                          </>
                        ) : (
                          <span className="text-slate-300 font-bold text-[13px] pl-4">—</span>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
              {totalPages > 1 && (
                <div className="border-t border-border bg-muted px-3 py-3 flex flex-col items-center gap-2 sm:flex-row sm:justify-between shrink-0">
                  <p className="text-[11px] font-semibold text-slate-400">
                    แสดง {rangeStart}–{rangeEnd} จาก {activeRequests.length} คำขอ
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={currentPage === 1}
                      onClick={() => setPage(Math.max(currentPage - 1, 1))}
                      className="flex items-center gap-1 rounded-full border border-black/[0.08] bg-white px-4 py-1.5 text-[11px] font-bold text-slate-600 transition-all hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                      ก่อนหน้า
                    </button>
                    <span className="px-2 text-[11px] font-medium text-slate-400">
                      {currentPage} / {totalPages}
                    </span>
                    <button
                      type="button"
                      disabled={currentPage === totalPages}
                      onClick={() => setPage(Math.min(currentPage + 1, totalPages))}
                      className="flex items-center gap-1 rounded-full border border-black/[0.08] bg-white px-4 py-1.5 text-[11px] font-bold text-slate-600 transition-all hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      ถัดไป
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
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

function TeamLeavePanel({ isTeacher }: { isTeacher: boolean }) {
  const { activeYear } = useActiveAcademicYear();
  const sinceDate = activeYear?.startDate || defaultAcademicYearStart();
  const { requests, loading, updateStatus } = isTeacher
    ? useStudentLeaveRequests(sinceDate)
    : useLeaveRequestsSince(sinceDate);

  return (
    <TeamLeavePanelContent
      isTeacher={isTeacher}
      requests={requests}
      loading={loading}
      updateStatus={updateStatus}
    />
  );
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
