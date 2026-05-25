// src/features/leave/LeaveManagementPage.tsx
import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import LeaveHeaderTabs from './components/LeaveHeaderTabs';
import {
  ClipboardList, Plus, Check, X, Clock, FileText,
  ChevronDown, User, Calendar, Save, AlertCircle, SlidersHorizontal,
  CheckCircle2, XCircle
} from 'lucide-react';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { useAuth } from '@/hooks/useAuth';
import {
  useMyLeaveRequests,
  useApproverLeaveRequests,
  useAllLeaveRequests,
  useStudentLeaveRequests,
  countDays,
  formatDate,
} from '@/hooks/useLeaveRequests';
import { useActiveAcademicYear } from '@/hooks/useActiveAcademicYear';
import type { LeaveRequest, LeaveType, LeaveStatus } from '@/types/leave';
import { cn } from '@/lib/utils';
import FormModal, { modalInputCls, modalLabelCls } from '@/components/ui/FormModal';
import { db } from '@/lib/firebase';

type Tab = 'students' | 'my' | 'approve' | 'settings' | 'staff';
type StatusFilter = 'all' | LeaveStatus;

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

// ── Status Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: LeaveStatus }) {
  const c = STATUS_CONFIG[status];
  const Icon = c.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${c.bg} ${c.text} border ${c.border}`}>
      <Icon size={10} />
      {c.label}
    </span>
  );
}

function LeaveCard({
  req,
  showApprover = false,
  showRequester = false,
  onApprove,
  onReject,
}: {
  req: LeaveRequest;
  showApprover?: boolean;
  showRequester?: boolean;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const days = countDays(req.startDate, req.endDate);
  const statusCfg = STATUS_CONFIG[req.status];

  return (
    <motion.div
      layout
      className={cn(
        "group relative rounded-[2.5rem] p-7 cursor-pointer transition-all border-2 bg-white/90 backdrop-blur-md hover:bg-white hover:border-slate-200",
        expanded ? "border-blue-300 ring-4 ring-blue-50/50 bg-white" : "border-slate-100"
      )}
      onClick={() => setExpanded(v => !v)}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <div className={cn(
            "w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 border-2 transition-transform duration-300 group-hover:scale-105 overflow-hidden",
            statusCfg.bg, statusCfg.border, statusCfg.text
          )}>
            {req.requesterPhotoUrl ? (
              <img src={req.requesterPhotoUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <IconForType type={req.leaveType} />
            )}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-3 mb-1.5">
              <h3 className="font-black text-slate-800 text-base tracking-tight">
                {LEAVE_TYPE_LABEL[req.leaveType]}
              </h3>
              <StatusBadge status={req.status} />
            </div>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
              {showRequester && (
                <p className="text-xs font-bold text-slate-500 flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center">
                    <User size={10} className="text-slate-400" />
                  </div>
                  {req.requesterName}
                </p>
              )}
              <p className="text-xs font-bold text-slate-500 flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center">
                  <Calendar size={10} className="text-slate-400" />
                </div>
                {formatDate(req.startDate)}
                {req.startDate !== req.endDate && ` – ${formatDate(req.endDate)}`}
                <span className="text-blue-600 font-black ml-1">({days} วัน)</span>
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-0 pt-4 sm:pt-0">
          <div className="flex items-center gap-2">
            {req.status === 'pending' && onApprove && onReject && (
              <>
                <button
                  onClick={e => { e.stopPropagation(); onApprove(req.id); }}
                  className="h-10 px-5 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100 hover:bg-emerald-600 hover:text-white transition-all text-xs font-black shadow-sm"
                >
                  อนุมัติ
                </button>
                <button
                  onClick={e => { e.stopPropagation(); onReject(req.id); }}
                  className="h-10 px-5 rounded-2xl bg-rose-50 text-rose-600 border border-rose-100 hover:bg-rose-600 hover:text-white transition-all text-xs font-black shadow-sm"
                >
                  ปฏิเสธ
                </button>
              </>
            )}
          </div>
          <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center transition-all group-hover:bg-slate-100 ring-1 ring-slate-100">
            <ChevronDown
              size={16}
              className={cn("text-slate-400 transition-transform duration-500 ease-out", expanded && "rotate-180 text-blue-500")}
            />
          </div>
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
            className="overflow-hidden"
          >
            <div className="mt-6 pt-6 border-t border-slate-100 space-y-6">
              <div className="space-y-2.5">
                <label className={modalLabelCls}>เหตุผลการลา</label>
                <p className="text-sm font-bold text-slate-600 leading-relaxed bg-slate-50/50 p-5 rounded-[1.5rem] border border-slate-100">
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
                    className="flex items-center gap-2.5 h-11 px-5 rounded-2xl bg-blue-50 text-blue-600 border border-blue-100 hover:bg-blue-600 hover:text-white transition-all text-xs font-black shadow-sm"
                  >
                    <FileText size={16} /> ดูเอกสารแนบ
                  </a>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function IconForType({ type }: { type: LeaveType }) {
  if (type === 'sick') return <Clock size={20} />;
  return <User size={20} />;
}

// ── Submit Modal ─────────────────────────────────────────────────────────────
function SubmitModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (data: { leaveType: LeaveType; startDate: string; endDate: string; reason: string }) => Promise<void>;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [leaveType, setLeaveType] = useState<LeaveType>('sick');
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!reason.trim()) return;
    setSaving(true);
    try {
      await onSubmit({ leaveType, startDate, endDate, reason: reason.trim() });
      onClose();
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
      submitDisabled={saving || !reason.trim()}
      maxWidth="md"
    >
      <div className="space-y-6 py-2">
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
              min={today}
              onChange={e => {
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
              onChange={e => setEndDate(e.target.value)}
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

// ── Tabs ─────────────────────────────────────────────────────────────────────

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

  const [searchParams, setSearchParams] = useSearchParams();
  const currentView = searchParams.get('view');
  const action = searchParams.get('action');

  const [tab, setTab] = useState<Tab>(
    isAdmin ? 'staff' : (isTeacher ? 'students' : 'my')
  );
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');

  useEffect(() => {
    if (currentView === 'settings' && isAdmin) {
      setTab('settings');
    } else if (tab === 'settings' && currentView !== 'settings') {
      setTab(isTeacher ? 'students' : (isAdmin ? 'approve' : 'my'));
    }
  }, [currentView, isAdmin, isTeacher, tab]);

  const [showSubmit, setShowSubmit] = useState(false);

  useEffect(() => {
    if (action === 'new') {
      setShowSubmit(true);
      // Clear the param so it doesn't reopen on refresh or tab switch if not intended
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('action');
      setSearchParams(newParams, { replace: true });
    }
  }, [action, searchParams, setSearchParams]);
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
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

  const myHook = useMyLeaveRequests(uid, requesterType);
  const approverHook = useApproverLeaveRequests(uid);
  const adminHook = useAllLeaveRequests();
  const studentHook = useStudentLeaveRequests();

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

  const handleSubmit = async (data: {
    leaveType: LeaveType;
    startDate: string;
    endDate: string;
    reason: string;
  }) => {
    const requesterStudentCode =
      typeof userData?.studentCode === 'string'
        ? userData.studentCode
        : null;
    await myHook.submit(data, displayName, photoUrl, requesterStudentCode, '', '');
  };

  const handleApprove = async (id: string) => {
    if (tab === 'students') await studentHook.updateStatus(id, 'approved');
    else if (tab === 'approve') await approverHook.updateStatus(id, 'approved');
    else await adminHook.updateStatus(id, 'approved');
  };

  const handleRejectConfirm = async (id: string, note: string) => {
    if (tab === 'students') await studentHook.updateStatus(id, 'rejected', note);
    else if (tab === 'approve') await approverHook.updateStatus(id, 'rejected', note);
    else await adminHook.updateStatus(id, 'rejected', note);
  };

  // Stats
  const myPending = myHook.requests.filter(r => r.status === 'pending').length;
  const appPending = approverHook.requests.filter(r => r.status === 'pending').length;
  const studentPending = studentHook.requests.filter(r => r.status === 'pending').length;

  const tabs: { key: Tab; label: string; badge?: number; show: boolean }[] = [
    { key: 'students', label: 'การลานักเรียน', badge: studentPending > 0 ? studentPending : undefined, show: isTeacher || isAdmin },
    { key: 'staff', label: 'การลาพนักงาน', show: isAdmin },
    { key: 'my', label: 'คำขอของฉัน', badge: myPending > 0 ? myPending : undefined, show: true },
    { key: 'approve', label: 'รออนุมัติ', badge: appPending > 0 ? appPending : undefined, show: isAdmin && appPending > 0 },
  ];
  const visibleTabs = tabs.filter(t => t.show);

  const allActiveRequests = useMemo(() => {
    if (tab === 'students') return studentHook.requests;
    if (tab === 'my') return myHook.requests;
    if (tab === 'staff') return adminHook.requests.filter(r => r.requesterType !== 'student');
    if (tab === 'approve') return approverHook.requests;
    return adminHook.requests;
  }, [tab, studentHook.requests, myHook.requests, adminHook.requests, approverHook.requests]);

  const summary = useMemo(() => ({
    total: allActiveRequests.length,
    approved: allActiveRequests.filter(r => r.status === 'approved').length,
    pending: allActiveRequests.filter(r => r.status === 'pending').length,
    rejected: allActiveRequests.filter(r => r.status === 'rejected').length,
  }), [allActiveRequests]);

  const activeRequests = allActiveRequests.filter(r => {
    if (statusFilter === 'all') return true;
    return r.status === statusFilter;
  });

  const activeLoading =
    tab === 'students' ? studentHook.loading :
      tab === 'my' ? myHook.loading :
        tab === 'approve' ? approverHook.loading :
          adminHook.loading;

  const canApprove = tab !== 'my';
  const isSettingsTab = tab === 'settings';

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

  const headerActionsPortal = useMemo(() => {
    const el = document.getElementById('header-portal-right-actions');
    if (!el) return null;
    
    if (isSettingsTab) {
      return createPortal(<div className="w-9 h-9" />, el);
    }

    return createPortal(
      <div className="flex items-center gap-2">
        {!isTeacher && (
          <motion.button
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            onClick={() => setShowSubmit(true)}
            className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 transition-all active:scale-95"
            title="ยื่นคำขอลาใหม่"
          >
            <Plus size={18} />
          </motion.button>
        )}
      </div>,
      el
    );
  }, [isTeacher, isSettingsTab]);

  const headerCenterPortal = useMemo(() => {
    const el = document.getElementById('header-portal-center');
    if (!el) return null;
    return createPortal(<LeaveHeaderTabs />, el);
  }, []);

  return (
    <div className="flex h-full min-h-0 w-full max-w-[1200px] mx-auto flex-col gap-4 pb-6">
      {/* Header action portal */}
      {headerCenterPortal}
      {headerActionsPortal}

      <div className="flex-1 flex min-h-0 flex-col items-stretch gap-6">

        {!isSettingsTab && (
          <>
            {/* Stat Cards */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {[
                { label: 'คำขอทั้งหมด', value: summary.total, icon: ClipboardList, color: 'text-slate-600', status: 'all' as StatusFilter },
                { label: 'อนุมัติ', value: summary.approved, icon: CheckCircle2, color: 'text-emerald-600', status: 'approved' as StatusFilter },
                { label: 'รอพิจารณา', value: summary.pending, icon: Clock, color: 'text-amber-600', status: 'pending' as StatusFilter },
                { label: 'ไม่อนุมัติ', value: summary.rejected, icon: XCircle, color: 'text-rose-600', status: 'rejected' as StatusFilter },
              ].map((item) => {
                const isActive = statusFilter === item.status;
                return (
                  <button
                    key={item.label}
                    onClick={() => setStatusFilter(item.status)}
                    className={cn(
                      "group relative rounded-[2rem] border-2 p-5 flex flex-col items-center text-center transition-all",
                      isActive 
                        ? "bg-white border-blue-200 shadow-lg shadow-blue-500/5 ring-4 ring-blue-50/50" 
                        : "bg-white/50 border-slate-50 hover:border-slate-200 hover:bg-white"
                    )}
                  >
                    <div className={cn(
                      "mb-3 inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 transition-transform group-hover:scale-110",
                      isActive ? "ring-blue-100" : "ring-slate-100",
                      item.color
                    )}>
                      <item.icon size={18} strokeWidth={2.5} />
                    </div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{item.label}</p>
                    <p className={cn("mt-1 text-2xl font-black tabular-nums", item.color)}>{item.value}</p>
                    
                    {isActive && (
                      <motion.div
                        layoutId="activeStatCapsule"
                        className="absolute inset-0 rounded-[2rem] border-2 border-blue-500/20 pointer-events-none"
                      />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Sub Tabs (My/Approve/All) */}
            <div className="flex items-center">
              <div className="flex items-center h-10 border border-black/[0.05] p-1 rounded-full bg-slate-50/50">
                {visibleTabs.map(t => {
                  const isActive = tab === t.key;
                  return (
                    <button
                      key={t.key}
                      onClick={() => setTab(t.key)}
                      className={cn(
                        "relative flex items-center justify-center h-full px-6 rounded-full text-[11px] font-black transition-colors z-10",
                        isActive ? "text-white" : "text-slate-400 hover:text-slate-600"
                      )}
                    >
                      {isActive && (
                        <motion.div
                          layoutId="activeSubTabCapsule"
                          className="absolute inset-0 bg-blue-600 rounded-full shadow-sm"
                          transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                        />
                      )}
                      <span className="relative z-20 flex items-center">
                        {t.label}
                        {t.badge && (
                          <span className={cn(
                            "ml-2 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[9px] font-black transition-colors",
                            isActive ? "bg-white/20 text-white" : "bg-rose-500 text-white"
                          )}>
                            {t.badge}
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}

        <div className="flex-1 w-full min-w-0 space-y-4 bg-white/90 backdrop-blur-xl rounded-[2.5rem] p-6 border-2 border-slate-100 min-h-0 overflow-y-auto">



          <div className="flex items-center justify-between px-2 mb-2">
            <h2 className="text-sm font-black text-slate-800 uppercase tracking-tight">
              {isSettingsTab
                ? 'ตั้งค่าจำนวนการลา'
                : `${tabs.find(t => t.key === tab)?.label} (${activeRequests.length})`}
            </h2>
          </div>

          {isSettingsTab ? (
            <div className="space-y-5">
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
          ) : (
            <div className="space-y-3">
              {activeLoading ? (
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
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="grid grid-cols-1 gap-3"
                >
                  {activeRequests.map(req => (
                    <LeaveCard
                      key={req.id}
                      req={req}
                      showRequester={tab !== 'my'}
                      showApprover={tab === 'my'}
                      onApprove={canApprove ? handleApprove : undefined}
                      onReject={canApprove ? id => setRejectTarget(id) : undefined}
                    />
                  ))}
                </motion.div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showSubmit && (
          <SubmitModal
            onClose={() => setShowSubmit(false)}
            onSubmit={handleSubmit}
          />
        )}
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
