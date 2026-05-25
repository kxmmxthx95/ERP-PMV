import { useEffect, useMemo, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  CalendarDays,
  Loader2,
  Clock3,
  ChevronDown,
  History,
} from 'lucide-react';
import { collection, getDocs, query, where, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAdminStaffAttendance, type StaffAttendanceRecord } from '@/hooks/useStaffAttendance';
import { useAllLeaveRequests } from '@/hooks/useLeaveRequests';
import type { LeaveRequest } from '@/types/leave';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';

// ── Types ────────────────────────────────────────────────────────────────────

type ReportType = 'daily' | 'weekly' | 'alert';

type SendMode = 'auto' | 'manual';

type SendStatus = 'idle' | 'sending' | 'success' | 'error';

interface Recipient {
  uid: string;
  displayName: string;
  role: string;
  lineToken?: string;
  enabled: boolean;
}

interface StaffDirectoryItem {
  userId: string;
  displayName: string;
}

interface StaffUserDoc {
  id: string;
  role?: string;
  name?: string;
  displayName?: string;
  email?: string;
}

interface StaffSummary {
  total: number;
  present: number;
  late: number;
  absent: number;
  leave: number;
}

interface StudentSummary {
  sessions: number;
  classes: number;
  present: number;
  late: number;
  absent: number;
  leave: number;
}

interface LeaveSummary {
  pendingStaff: number;
  pendingStudents: number;
  activeStaff: number;
}

const GOD_MODE_EMAIL = 'sysadmin@pmv.com';

// ── Helpers ──────────────────────────────────────────────────────────────────

const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  daily: 'สรุปยอดประจำวัน (Daily)',
  weekly: 'สรุปรายสัปดาห์ (Weekly)',
  alert: 'รายงานด่วน (Alert)',
};

function formatThaiDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('th-TH', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
}

function roleLabel(role: string): string {
  if (role === 'sysadmin') return 'sysadmin';
  if (role === 'admin') return 'admin';
  return role || 'unknown';
}

function roleBadgeClass(role: string): string {
  if (role === 'sysadmin') return 'bg-amber-100 text-amber-700';
  if (role === 'admin') return 'bg-blue-100 text-blue-700';
  return 'bg-slate-100 text-slate-600';
}

function normalizeEmail(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function isRecipientUser(u: Record<string, unknown>): boolean {
  const role = typeof u.role === 'string' ? u.role : '';
  const email = normalizeEmail(u.email);
  return role === 'admin' || role === 'sysadmin' || email === GOD_MODE_EMAIL;
}

function mapUserToRecipient(u: Record<string, unknown> & { id: string }): Recipient {
  const email = typeof u.email === 'string' ? u.email : '';
  const role = typeof u.role === 'string' && u.role.trim() ? u.role : (normalizeEmail(email) === GOD_MODE_EMAIL ? 'sysadmin' : '');
  return {
    uid: String(u.id),
    displayName: String(u.name ?? u.displayName ?? email ?? 'ผู้บริหาร'),
    role,
    lineToken: typeof u.lineToken === 'string' && u.lineToken.trim() ? u.lineToken : undefined,
    enabled: true,
  };
}

function ensureGodModeRecipient(
  recipients: Recipient[],
  currentUid?: string,
  currentEmail?: string,
  currentLineToken?: string,
): Recipient[] {
  const normalizedCurrentEmail = normalizeEmail(currentEmail);
  if (normalizedCurrentEmail !== GOD_MODE_EMAIL) return recipients;

  const exists = recipients.some((r) =>
    r.uid === currentUid || normalizeEmail(r.displayName) === GOD_MODE_EMAIL,
  );
  if (exists) return recipients;

  return [
    ...recipients,
    {
      uid: currentUid || GOD_MODE_EMAIL,
      displayName: currentEmail || GOD_MODE_EMAIL,
      role: 'sysadmin',
      lineToken: currentLineToken?.trim() || undefined,
      enabled: true,
    },
  ];
}

// ── LINE Flex Message Preview ─────────────────────────────────────────────────

interface FlexPreviewProps {
  reportType: ReportType;
  selectedDate: string;
  staffSummary: StaffSummary;
  studentSummary: StudentSummary;
  leaveSummary: LeaveSummary;
  alertMessage?: string;
  isLoading: boolean;
}

function LineFlexPreview({
  reportType,
  selectedDate,
  staffSummary,
  studentSummary,
  leaveSummary,
  alertMessage,
  isLoading,
}: FlexPreviewProps) {
  const now = new Date();
  const headerColor =
    reportType === 'daily'
      ? 'from-blue-600 to-indigo-700'
      : reportType === 'weekly'
      ? 'from-violet-600 to-purple-700'
      : 'from-rose-600 to-red-700';
  const headerTitle =
    reportType === 'daily'
      ? 'รายงานสรุปประจำวัน'
      : reportType === 'weekly'
      ? 'รายงานสรุปรายสัปดาห์'
      : 'รายงานด่วน';

  return (
    <div className="flex flex-col items-center">
      {/* Phone frame */}
      <div
        className="relative mx-auto w-[300px] overflow-hidden rounded-[2.5rem] border-4 border-slate-800 shadow-2xl"
        style={{ minHeight: 560 }}
      >
        {/* Status bar */}
        <div className="flex items-center justify-between bg-slate-900 px-5 py-2 text-[10px] text-white">
          <span className="font-bold">9:41</span>
          <div className="flex gap-1">
            <span>●●●</span>
            <span>WiFi</span>
            <span>100%</span>
          </div>
        </div>

        {/* LINE header */}
        <div className="flex items-center gap-2 border-b border-slate-200 bg-[#06c755] px-4 py-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-sm font-black text-[#06c755]">
            P
          </div>
          <div>
            <p className="text-xs font-bold text-white">PMV-ONE School</p>
            <p className="text-[10px] text-green-100">Official Account</p>
          </div>
        </div>

        {/* Chat area */}
        <div className="min-h-[420px] bg-[#b9d9e8] p-3">
          {/* Timestamp */}
          <p className="mb-2 text-center text-[10px] text-slate-600">
            {formatThaiDate(selectedDate)} · {formatTime(now)}
          </p>

          {/* Flex message bubble */}
          <div className="rounded-2xl overflow-hidden shadow-lg border border-white/40">
            {/* Card header */}
            <div className={cn('bg-gradient-to-r px-4 py-3 text-white', headerColor)}>
              <p className="text-base font-black leading-tight">
                {headerTitle}
              </p>
              <p className="mt-0.5 text-[11px] text-white/80">{formatThaiDate(selectedDate)}</p>
            </div>

            {/* Card body */}
            <div className="space-y-0 bg-white">
              {reportType !== 'alert' ? (
                <>
                  {/* Staff section */}
                  <div className="border-b border-slate-100 px-4 py-2.5">
                    <p className="mb-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400">
                      บุคลากร
                    </p>
                    <div className="grid grid-cols-2 gap-1.5">
                      <StatRow label="มาตรงเวลา" value={staffSummary.present} color="text-emerald-600" loading={isLoading} />
                      <StatRow label="มาสาย" value={staffSummary.late} color="text-amber-600" loading={isLoading} />
                      <StatRow label="ขาดงาน" value={staffSummary.absent} color="text-rose-600" loading={isLoading} />
                      <StatRow label="ลา" value={staffSummary.leave} color="text-violet-600" loading={isLoading} />
                    </div>
                    <div className="mt-1.5 flex items-center justify-between rounded-lg bg-slate-50 px-2 py-1">
                      <span className="text-[10px] font-semibold text-slate-500">บุคลากรทั้งหมด</span>
                      <span className="text-xs font-black text-slate-700">{isLoading ? '...' : staffSummary.total} คน</span>
                    </div>
                  </div>

                  {/* Student section */}
                  <div className="border-b border-slate-100 px-4 py-2.5">
                    <p className="mb-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400">
                      นักเรียน
                    </p>
                    <div className="grid grid-cols-2 gap-1.5">
                      <StatRow label="มาเรียน" value={studentSummary.present} color="text-emerald-600" loading={isLoading} />
                      <StatRow label="มาสาย" value={studentSummary.late} color="text-amber-600" loading={isLoading} />
                      <StatRow label="ขาด" value={studentSummary.absent} color="text-rose-600" loading={isLoading} />
                      <StatRow label="ลา" value={studentSummary.leave} color="text-violet-600" loading={isLoading} />
                    </div>
                    <div className="mt-1.5 flex items-center justify-between rounded-lg bg-blue-50 px-2 py-1">
                      <span className="text-[10px] font-semibold text-slate-500">เซสชันสอน</span>
                      <span className="text-xs font-black text-blue-700">{isLoading ? '...' : studentSummary.sessions} ครั้ง</span>
                    </div>
                  </div>

                  {/* Leave section */}
                  <div className="px-4 py-2.5">
                    <p className="mb-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400">
                      คำขอลา
                    </p>
                    <div className="grid grid-cols-2 gap-1.5">
                      <StatRow label="รออนุมัติ" value={leaveSummary.pendingStaff + leaveSummary.pendingStudents} color="text-amber-600" loading={isLoading} />
                      <StatRow label="ลา active" value={leaveSummary.activeStaff} color="text-violet-600" loading={isLoading} />
                    </div>
                  </div>
                </>
              ) : (
                <div className="border-b border-slate-100 px-4 py-3.5 bg-rose-50/20 text-center">
                  <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest">
                    ⚠️ โหมดรายงานด่วน
                  </p>
                  <p className="mt-0.5 text-[9px] font-medium text-slate-400">
                    ส่งเฉพาะข้อความด้านล่างนี้ โดยไม่มีรายงานสถิติแนบไป
                  </p>
                </div>
              )}

              {reportType === 'alert' && (
                <div className="px-4 py-4 bg-rose-50/50">
                  <p className="mb-1.5 text-[10px] font-black uppercase tracking-widest text-rose-500">
                    ข้อความแจ้งเตือนด่วน
                  </p>
                  <p className="text-xs font-bold leading-relaxed text-rose-700 break-words whitespace-pre-wrap">
                    {alertMessage?.trim() || '— ยังไม่ได้พิมพ์ข้อความแจ้งเตือน —'}
                  </p>
                </div>
              )}

              {/* Footer */}
              <div className="border-t border-slate-100 bg-slate-50 px-4 py-2 text-center">
                <p className="text-[9px] font-semibold text-slate-400">
                  ส่งโดย PMV-ONE · {formatTime(now)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <p className="mt-3 text-center text-xs font-semibold text-slate-400">ตัวอย่างข้อความที่จะส่งผ่าน LINE OA</p>
    </div>
  );
}

function StatRow({
  label,
  value,
  color,
  loading,
}: {
  label: string;
  value: number;
  color: string;
  loading: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-slate-50 px-2 py-1">
      <span className="text-[10px] font-semibold text-slate-500">{label}</span>
      <span className={cn('text-xs font-black tabular-nums', color)}>{loading ? '...' : value}</span>
    </div>
  );
}

// ── Send History Item ──────────────────────────────────────────────────────────

interface SendHistoryItem {
  id: string;
  sentAt: Date;
  reportType: ReportType;
  recipientCount: number;
  status: 'success' | 'error';
  note?: string;
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function ReportControlCenter() {
  const { role, user, userData } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [reportType, setReportType] = useState<ReportType>('daily');
  const [alertMessage, setAlertMessage] = useState('');
  const [sendMode, setSendMode] = useState<SendMode>('manual');
  const [autoTime, setAutoTime] = useState('17:00');
  const [sendStatus, setSendStatus] = useState<SendStatus>('idle');
  const [sendError, setSendError] = useState('');

  // ── Access Control ──
  if (role === 'student' || role === 'parent') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-slate-400 gap-4">
        <AlertCircle size={48} strokeWidth={1.5} />
        <div className="text-center">
          <p className="text-lg font-black text-slate-600">Access Denied</p>
          <p className="text-sm font-bold mt-1">คุณไม่มีสิทธิ์เข้าถึงหน้านี้</p>
        </div>
      </div>
    );
  }
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [loadingRecipients, setLoadingRecipients] = useState(true);
  const [staffDirectory, setStaffDirectory] = useState<StaffDirectoryItem[]>([]);
  const [loadingStaffDirectory, setLoadingStaffDirectory] = useState(true);
  const [studentSummary, setStudentSummary] = useState<StudentSummary>({
    sessions: 0,
    classes: 0,
    present: 0,
    late: 0,
    absent: 0,
    leave: 0,
  });
  const [studentLoading, setStudentLoading] = useState(true);
  const [sendHistory, setSendHistory] = useState<SendHistoryItem[]>([]);
  const [activeTab, setActiveTab] = useState<'preview' | 'history'>('preview');

  const { records, loading: staffLoading, refresh: refreshStaff } = useAdminStaffAttendance(selectedDate);
  const { requests: leaveRequests } = useAllLeaveRequests();

  // ── Load recipients (admin/sysadmin users) ──────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoadingRecipients(true);
      try {
        const snap = await getDocs(collection(db, 'users'));
        if (cancelled) return;
        const rows = snap.docs
          .map(d => ({ id: d.id, ...d.data() } as Record<string, unknown> & { id: string }))
          .filter(isRecipientUser)
          .map(mapUserToRecipient);
        setRecipients(ensureGodModeRecipient(rows, user?.uid, user?.email ?? undefined, userData?.lineToken ?? userData?.lineUid));
      } finally {
        if (!cancelled) setLoadingRecipients(false);
      }
    };
    load().catch(() => setLoadingRecipients(false));
    return () => { cancelled = true; };
  }, [user?.uid, user?.email, userData?.lineToken, userData?.lineUid]);

  // ── Load staff directory (same role scope as staff attendance feature) ─────
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoadingStaffDirectory(true);
      try {
        const snap = await getDocs(collection(db, 'users'));
        if (cancelled) return;
        const rows = snap.docs
          .map((d): StaffUserDoc => ({ id: d.id, ...(d.data() as Partial<Omit<StaffUserDoc, 'id'>>) }))
          .filter((u) => {
            const role = typeof u.role === 'string' ? u.role : '';
            return !['student', 'parent', 'admin', 'sysadmin'].includes(role);
          })
          .map((u): StaffDirectoryItem => ({
            userId: String(u.id),
            displayName: String(u.name ?? u.displayName ?? u.email ?? 'บุคลากร'),
          }));
        setStaffDirectory(rows);
      } finally {
        if (!cancelled) setLoadingStaffDirectory(false);
      }
    };
    load().catch(() => setLoadingStaffDirectory(false));
    return () => { cancelled = true; };
  }, []);

  // ── Load student summary ────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setStudentLoading(true);
      try {
        const q = query(collection(db, 'class_sessions'), where('date', '==', selectedDate));
        const snap = await getDocs(q);
        if (cancelled) return;
        const classes = new Set<string>();
        let present = 0, late = 0, absent = 0, leave = 0;
        snap.forEach(docSnap => {
          const data = docSnap.data() as Record<string, unknown>;
          const classId = typeof data.classId === 'string' ? data.classId : '';
          const summary = (data.summary ?? {}) as Record<string, unknown>;
          if (classId) classes.add(classId);
          present += Number(summary.present ?? 0);
          late += Number(summary.late ?? 0);
          absent += Number(summary.absent ?? 0);
          leave += Number(summary.leave ?? 0);
        });
        setStudentSummary({ sessions: snap.size, classes: classes.size, present, late, absent, leave });
      } finally {
        if (!cancelled) setStudentLoading(false);
      }
    };
    load().catch(() => setStudentLoading(false));
    return () => { cancelled = true; };
  }, [selectedDate]);

  // ── Derived staff rows ──────────────────────────────────────────────────────
  const staffUserIds = useMemo(() => new Set(staffDirectory.map(s => s.userId)), [staffDirectory]);
  const staffRecords = useMemo(
    () => records.filter((r) => staffUserIds.has(r.userId)),
    [records, staffUserIds],
  );

  const leaveRows = useMemo(() => {
    const attendedUserIds = new Set(staffRecords.map(r => r.userId));
    return leaveRequests.filter((req: LeaveRequest) =>
      (req.requesterType !== 'student' || staffUserIds.has(req.requesterId)) &&
      req.status !== 'rejected' &&
      req.startDate <= selectedDate &&
      req.endDate >= selectedDate &&
      !attendedUserIds.has(req.requesterId)
    );
  }, [leaveRequests, selectedDate, staffRecords, staffUserIds]);

  const autoAbsentUserIds = useMemo(() => {
    const attendedIds = new Set(staffRecords.map(r => r.userId));
    const leaveIds = new Set(leaveRows.map(r => r.requesterId));
    const allStaff = staffDirectory.filter(s => !attendedIds.has(s.userId) && !leaveIds.has(s.userId));
    return new Set(allStaff.map(s => s.userId));
  }, [leaveRows, staffDirectory, staffRecords]);

  const staffSummary: StaffSummary = useMemo(() => {
    const present = staffRecords.filter((r: StaffAttendanceRecord) => r.status === 'present').length;
    const late = staffRecords.filter((r: StaffAttendanceRecord) => r.status === 'late').length;
    const leave = leaveRows.length;
    const absent = autoAbsentUserIds.size;
    const total = staffDirectory.length;
    return { total, present, late, absent, leave };
  }, [staffRecords, leaveRows, autoAbsentUserIds, staffDirectory]);

  const leaveSummary: LeaveSummary = useMemo(() => ({
    pendingStaff: leaveRequests.filter(r =>
      (r.requesterType !== 'student' || staffUserIds.has(r.requesterId)) &&
      r.status === 'pending'
    ).length,
    pendingStudents: leaveRequests.filter(r =>
      r.requesterType === 'student' && r.status === 'pending'
    ).length,
    activeStaff: leaveRequests.filter(r =>
      (r.requesterType !== 'student' || staffUserIds.has(r.requesterId)) &&
      r.status === 'approved' &&
      r.startDate <= selectedDate &&
      r.endDate >= selectedDate
    ).length,
  }), [leaveRequests, selectedDate, staffUserIds]);

  const isLoading = staffLoading || studentLoading || loadingStaffDirectory;

  const enabledRecipients = recipients.filter(r => r.enabled);
  const trimmedAlertMessage = alertMessage.trim();

  // ── Toggle recipient ────────────────────────────────────────────────────────
  const toggleRecipient = useCallback((uid: string) => {
    setRecipients(prev => prev.map(r => r.uid === uid ? { ...r, enabled: !r.enabled } : r));
  }, []);

  // ── Send report ─────────────────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    if (enabledRecipients.length === 0) {
      setSendStatus('error');
      setSendError('กรุณาเลือกผู้รับอย่างน้อย 1 คน');
      return;
    }
    if (reportType === 'alert' && !trimmedAlertMessage) {
      setSendStatus('error');
      setSendError('กรุณากรอกข้อความแจ้งเตือนสำหรับรายงานด่วน');
      return;
    }
    setSendStatus('sending');
    setSendError('');

    try {
      const payload = {
        reportType,
        date: selectedDate,
        staffSummary: reportType === 'alert' ? null : staffSummary,
        studentSummary: reportType === 'alert' ? null : studentSummary,
        leaveSummary: reportType === 'alert' ? null : leaveSummary,
        alertMessage: reportType === 'alert' ? trimmedAlertMessage : null,
        recipients: enabledRecipients.map(r => ({ uid: r.uid, lineToken: r.lineToken })),
        sentAt: serverTimestamp(),
        triggeredBy: 'manual',
        autoTime: sendMode === 'auto' ? autoTime : null,
      };

      // Log the send event to Firestore (actual LINE sending handled by Cloud Function)
      await addDoc(collection(db, 'report_sends'), payload);

      setSendStatus('success');
      setActiveTab('history');
      setSendHistory(prev => [
        {
          id: Date.now().toString(),
          sentAt: new Date(),
          reportType,
          recipientCount: enabledRecipients.length,
          status: 'success',
          note: reportType === 'alert' ? trimmedAlertMessage : undefined,
        },
        ...prev.slice(0, 4),
      ]);

      setTimeout(() => setSendStatus('idle'), 4000);
    } catch (err) {
      setSendStatus('error');
      setSendError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
    }
  }, [enabledRecipients, reportType, selectedDate, staffSummary, studentSummary, leaveSummary, sendMode, autoTime, trimmedAlertMessage]);

  const refresh = useCallback(() => {
    refreshStaff();
    setStudentSummary({ sessions: 0, classes: 0, present: 0, late: 0, absent: 0, leave: 0 });
    setStudentLoading(true);
  }, [refreshStaff]);

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-4">
      {/* Split-screen body */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 xl:grid-cols-5">
        {/* ── LEFT: Control Panel ── */}
        <div className="flex flex-col gap-4 xl:col-span-2">

          {/* Block 1: Report Type & Date Selector */}
          <motion.div
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.05 }}
            className="rounded-[1.5rem] border border-white/40 bg-white/55 p-5 backdrop-blur-md flex flex-col gap-4"
          >
            {/* Date Picker & Refresh Row */}
            <div className="flex gap-2">
              <div className="flex flex-1 items-center gap-2 rounded-xl border border-slate-200/60 bg-white/70 px-3 py-2">
                <CalendarDays size={14} className="text-slate-400" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={e => setSelectedDate(e.target.value)}
                  className="w-full bg-transparent text-xs font-bold text-slate-700 outline-none"
                />
              </div>
              <button
                onClick={refresh}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200/60 bg-white/80 px-3 text-xs font-semibold text-slate-600 hover:bg-white"
              >
                <RefreshCw size={12} />
                รีเฟรช
              </button>
            </div>

            <div>
              <h2 className="mb-2 text-xs font-black uppercase tracking-widest text-slate-500">
                ประเภทรายงาน
              </h2>
              <div className="relative">
                <select
                  value={reportType}
                  onChange={e => {
                    setReportType(e.target.value as ReportType);
                    setSendError('');
                    if (sendStatus === 'error') setSendStatus('idle');
                  }}
                  className="w-full appearance-none rounded-xl border border-slate-200/60 bg-white/70 px-4 py-2.5 pr-10 text-sm font-semibold text-slate-700 outline-none transition-all focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
                >
                  {(Object.keys(REPORT_TYPE_LABELS) as ReportType[]).map(type => (
                    <option key={type} value={type} className="font-semibold text-slate-700 bg-white">
                      {REPORT_TYPE_LABELS[type]}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400">
                  <ChevronDown size={16} />
                </div>
              </div>
            </div>

            <AnimatePresence>
              {reportType === 'alert' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <label className="mb-1.5 block text-xs font-bold text-slate-500">
                    ข้อความแจ้งเตือน (รายงานด่วน)
                  </label>
                  <textarea
                    value={alertMessage}
                    onChange={e => setAlertMessage(e.target.value)}
                    rows={4}
                    placeholder="พิมพ์ข้อความแจ้งเตือนที่ต้องการส่งถึงผู้บริหาร..."
                    className="w-full resize-none rounded-xl border border-slate-200/60 bg-white/80 px-3 py-2 text-sm font-semibold text-slate-700 outline-none transition-all placeholder:text-slate-400 focus:border-rose-400 focus:bg-white focus:ring-2 focus:ring-rose-100"
                  />
                  <div className="mt-1 flex items-center justify-between">
                    <p className="text-[11px] text-slate-400">
                      ข้อความนี้จะถูกแนบในการส่งรายงานด่วน
                    </p>
                    <p className="text-[11px] font-semibold text-slate-400">
                      {alertMessage.length} ตัวอักษร
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Block 2: Recipients */}
          <motion.div
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-[1.5rem] border border-white/40 bg-white/55 p-5 backdrop-blur-md"
          >
            <h2 className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500">
              ผู้รับรายงาน
              <span className="ml-auto rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black text-emerald-700">
                {enabledRecipients.length}/{recipients.length} เปิด
              </span>
            </h2>

            {loadingRecipients ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 size={20} className="animate-spin text-slate-400" />
              </div>
            ) : recipients.length === 0 ? (
              <p className="py-4 text-center text-sm text-slate-400">ไม่พบผู้บริหารในระบบ</p>
            ) : (
              <div className="space-y-2">
                {recipients.map(r => (
                  <div key={r.uid} className="flex items-center justify-between rounded-xl border border-slate-100 bg-white/80 px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        'flex h-8 w-8 items-center justify-center rounded-full text-xs font-black text-white',
                        r.lineToken ? 'bg-[#06c755]' : 'bg-slate-300'
                      )}>
                        {r.displayName.slice(0, 1)}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-700">{r.displayName}</p>
                        <span className={cn(
                          'mt-0.5 inline-flex rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide',
                          roleBadgeClass(r.role),
                        )}>
                          {roleLabel(r.role)}
                        </span>
                        <p className={cn('text-[10px] font-semibold', r.lineToken ? 'text-[#06c755]' : 'text-slate-400')}>
                          {r.lineToken ? '✓ เชื่อม LINE แล้ว' : '— ยังไม่เชื่อม LINE'}
                        </p>
                      </div>
                    </div>
                    <div
                      onClick={() => toggleRecipient(r.uid)}
                      className={cn(
                        'relative h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors duration-200',
                        r.enabled ? 'bg-[#06c755]' : 'bg-slate-300'
                      )}
                    >
                      <div
                        className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-all duration-200"
                        style={{ left: r.enabled ? '18px' : '2px' }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>

          {/* Block 3: Send Mode */}
          <motion.div
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15 }}
            className="rounded-[1.5rem] border border-white/40 bg-white/55 p-5 backdrop-blur-md"
          >
            <h2 className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500">
              โหมดการส่ง
            </h2>
            <div className="flex gap-2">
              {(['manual', 'auto'] as SendMode[]).map(mode => (
                <button
                  key={mode}
                  onClick={() => setSendMode(mode)}
                  className={cn(
                    'flex-1 rounded-xl py-2.5 text-sm font-bold transition-all',
                    sendMode === mode
                      ? 'bg-slate-900 text-white'
                      : 'bg-white/70 text-slate-500 hover:bg-white'
                  )}
                >
                  {mode === 'manual' ? 'ส่งทันที' : 'อัตโนมัติ'}
                </button>
              ))}
            </div>

            <AnimatePresence>
              {sendMode === 'auto' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-3 overflow-hidden"
                >
                  <label className="mb-1.5 block text-xs font-bold text-slate-500">
                    เวลาส่งอัตโนมัติ
                  </label>
                  <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white/80 px-3 py-2">
                    <Clock3 size={14} className="text-slate-400" />
                    <input
                      type="time"
                      value={autoTime}
                      onChange={e => setAutoTime(e.target.value)}
                      className="bg-transparent text-sm font-bold text-slate-700 outline-none"
                    />
                  </div>
                  <p className="mt-1.5 text-[11px] text-slate-400">
                    ระบบจะส่งรายงานอัตโนมัติทุกวันเวลา {autoTime} น. (ต้องตั้งค่า Cloud Scheduler)
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Block 4: Action Button */}
          <motion.div
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="px-5"
          >
            <button
              onClick={handleSend}
              disabled={sendStatus === 'sending' || isLoading || enabledRecipients.length === 0}
              className={cn(
                'relative w-full overflow-hidden rounded-xl py-2.5 text-sm font-bold text-white transition-all',
                sendStatus === 'success'
                  ? 'bg-emerald-500'
                  : sendStatus === 'error'
                  ? 'bg-rose-500'
                  : sendStatus === 'sending'
                  ? 'cursor-not-allowed bg-blue-400'
                  : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700'
              )}
            >
              <span className="flex items-center justify-center gap-2">
                {sendStatus === 'sending' && <Loader2 size={15} className="animate-spin" />}
                {sendStatus === 'success' && <CheckCircle2 size={15} />}
                {sendStatus === 'error' && <AlertCircle size={15} />}
                {sendStatus === 'idle' && <Send size={15} />}

                {sendStatus === 'sending' && 'กำลังส่ง...'}
                {sendStatus === 'success' && 'ส่งสำเร็จแล้ว!'}
                {sendStatus === 'error' && 'เกิดข้อผิดพลาด'}
                {sendStatus === 'idle' && (
                  sendMode === 'manual'
                    ? `สร้างและส่งรายงานทันที (${enabledRecipients.length} คน)`
                    : `บันทึกตั้งเวลาส่ง ${autoTime} น.`
                )}
              </span>
            </button>

            <AnimatePresence>
              {sendStatus === 'error' && sendError && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mt-2 text-center text-xs font-semibold text-rose-600"
                >
                  {sendError}
                </motion.p>
              )}
            </AnimatePresence>
          </motion.div>
        </div>

        {/* ── RIGHT: Tabbed panel ── */}
        <motion.div
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="flex flex-col rounded-[1.5rem] border border-white/40 bg-white/55 p-5 backdrop-blur-md xl:col-span-3 min-h-[500px]"
        >
          {/* Tab selector */}
          <div className="mb-5 flex items-center justify-between border-b border-slate-200/60 pb-3">
            <div className="flex gap-1.5 rounded-xl bg-slate-100/80 p-1">
              <button
                onClick={() => setActiveTab('preview')}
                className={cn(
                  'rounded-lg px-3.5 py-1.5 text-xs font-black transition-all duration-200',
                  activeTab === 'preview'
                    ? 'bg-white text-slate-800 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                )}
              >
                ตัวอย่างข้อความ
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={cn(
                  'rounded-lg px-3.5 py-1.5 text-xs font-black transition-all duration-200 flex items-center gap-1.5',
                  activeTab === 'history'
                    ? 'bg-white text-slate-800 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                )}
              >
                <span>ประวัติการส่ง</span>
                {sendHistory.length > 0 && (
                  <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[9px] font-black text-blue-700">
                    {sendHistory.length}
                  </span>
                )}
              </button>
            </div>

            {activeTab === 'preview' ? (
              <div className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1">
                <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
                <span className="text-[10px] font-black text-emerald-700">Real-time</span>
              </div>
            ) : (
              <div className="flex items-center gap-1 text-[10px] font-black text-slate-400">
                ล่าสุด 5 รายการ
              </div>
            )}
          </div>

          <div className="flex flex-1 flex-col w-full overflow-auto py-2">
            {activeTab === 'preview' ? (
              <div className="flex items-start justify-center">
                <LineFlexPreview
                  reportType={reportType}
                  selectedDate={selectedDate}
                  staffSummary={staffSummary}
                  studentSummary={studentSummary}
                  leaveSummary={leaveSummary}
                  alertMessage={alertMessage}
                  isLoading={isLoading}
                />
              </div>
            ) : (
              <div className="flex flex-col gap-3 w-full max-w-md mx-auto">
                {sendHistory.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="rounded-full bg-slate-100/80 p-4 text-slate-400 mb-3 shadow-inner">
                      <History size={28} className="text-slate-500" />
                    </div>
                    <p className="text-sm font-bold text-slate-700">ยังไม่มีประวัติการส่งในเซสชันนี้</p>
                    <p className="text-xs text-slate-400 mt-1">ประวัติการทำงานของคุณจะแสดงขึ้นหลังจากที่เริ่มสร้างและส่งรายงาน</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {sendHistory.map(h => (
                      <motion.div
                        key={h.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="rounded-2xl border border-slate-100 bg-white/90 p-4 shadow-sm backdrop-blur-sm"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <span className={cn(
                              'inline-block rounded-lg px-2 py-0.5 text-[10px] font-black uppercase tracking-wider mb-1.5',
                              h.reportType === 'daily'
                                ? 'bg-blue-50 text-blue-700 border border-blue-100'
                                : h.reportType === 'weekly'
                                ? 'bg-violet-50 text-violet-700 border border-violet-100'
                                : 'bg-rose-50 text-rose-700 border border-rose-100'
                            )}>
                              {REPORT_TYPE_LABELS[h.reportType]}
                            </span>
                            <p className="text-xs font-bold text-slate-400">
                              ส่งเมื่อ {h.sentAt.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} น.
                            </p>
                          </div>
                          <span className={cn(
                            'rounded-full px-2.5 py-0.5 text-[10px] font-black flex items-center gap-1',
                            h.status === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-100'
                          )}>
                            {h.status === 'success' ? '✓ สำเร็จ' : '✗ ล้มเหลว'}
                          </span>
                        </div>

                        <div className="mt-3 flex items-center justify-between text-xs font-semibold text-slate-600 border-t border-slate-50 pt-2.5">
                          <span>ผู้รับทั้งหมด:</span>
                          <span className="font-bold text-slate-800">{h.recipientCount} คน</span>
                        </div>

                        {h.note && (
                          <div className="mt-2 rounded-xl bg-slate-50 p-2.5 border border-slate-100">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">ข้อความแจ้งเตือนด่วน</p>
                            <p className="text-xs font-bold text-slate-700 break-words whitespace-pre-wrap leading-relaxed">{h.note}</p>
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
