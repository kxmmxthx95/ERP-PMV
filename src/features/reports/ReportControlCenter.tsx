import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
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
  Plus,
  Trash2,
} from 'lucide-react';
import {
  HiAcademicCap,
  HiBriefcase,
  HiBuildingOffice2,
  HiShieldCheck,
} from 'react-icons/hi2';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
  addDoc,
  serverTimestamp,
  deleteField,
  onSnapshot,
  type DocumentReference,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  useAdminStaffAttendance,
  resolveStaffAttendanceDisplay,
  type StaffAttendanceRecord,
} from '@/hooks/useStaffAttendance';
import { useLeaveRequestsSince } from '@/hooks/useLeaveRequests';
import { useStaffUsers, usePortalRecipientUsers } from '@/hooks/useStaffUsers';
import { useTeachersCollection } from '@/hooks/useTeachersCollection';
import {
  buildTeacherPositionByUserId,
  isSpecialTeacherUser,
} from '@/lib/staffAttendance/specialTeacher';
import type { LeaveRequest } from '@/types/leave';
import { cn } from '@/lib/utils';
import type { StaffSummary, StudentSummary, StudentRollCallEntry } from '@/lib/reportDailyMessage';
import { useAuth } from '@/hooks/useAuth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

// ── Types ────────────────────────────────────────────────────────────────────

type ReportType = 'daily' | 'weekly' | 'alert';

type SendStatus = 'idle' | 'sending' | 'success' | 'error';

type RightPanelTab = 'preview' | 'history' | 'schedule';

type ScheduleSaveStatus = 'idle' | 'saving' | 'success' | 'error';

interface DailyReportSchedule {
  enabled: boolean;
  /** รอบแรก — backward compat กับ scheduler เก่า */
  sendTime: string;
  sendTimes?: string[];
  recipientUids: string[];
  recipients?: Array<{ uid: string; lineToken?: string }>;
  lastSentDate?: string;
  lastSentSlotsDate?: string;
  lastSentTimes?: string[];
  lastSentAt?: unknown;
  lastSendId?: string;
  lastScheduleError?: string;
  lastScheduleAttemptAt?: unknown;
  updatedAt?: unknown;
  updatedBy?: string;
}

const MAX_SCHEDULE_TIMES = 6;

const DAILY_SCHEDULE_DOC = doc(db, 'settings', 'report_daily_schedule');

/** Scroll area sized for ~5 recipient cards before scrolling */
const RECIPIENT_LIST_SCROLL_CLASS =
  'max-h-[calc(5*5rem+0.5rem)] overflow-y-auto overscroll-contain scrollbar-hide pr-0.5';

interface Recipient {
  uid: string;
  displayName: string;
  role: string;
  lineToken?: string;
  photoURL?: string;
  enabled: boolean;
}

interface StaffDirectoryItem {
  userId: string;
  displayName: string;
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

function getBangkokHour(now = new Date()): number {
  return Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Bangkok',
      hour: 'numeric',
      hour12: false,
    }).format(now),
  );
}

/** วันที่ปฏิทินไทย YYYY-MM-DD — อย่าใช้ toISOString() เพราะเป็น UTC ช้ากว่าไทย 7 ชม. */
function getBangkokDateIso(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

function normalizeScheduleTime(value: string): string | null {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function normalizeScheduleTimes(times: string[]): string[] {
  const normalized = times
    .map(normalizeScheduleTime)
    .filter((t): t is string => t !== null);
  return [...new Set(normalized)].sort();
}

function resolveStoredScheduleTimes(data: DailyReportSchedule): string[] {
  if (Array.isArray(data.sendTimes) && data.sendTimes.length > 0) {
    const times = normalizeScheduleTimes(data.sendTimes);
    if (times.length > 0) return times;
  }
  const single = normalizeScheduleTime(data.sendTime ?? '');
  return single ? [single] : ['17:00'];
}

function isLegacySingleSlotSchedule(data: DailyReportSchedule): boolean {
  return resolveStoredScheduleTimes(data).length <= 1;
}

function resolveSentScheduleTimesForDate(
  data: DailyReportSchedule,
  todayIso: string,
): string[] {
  if (data.lastSentSlotsDate === todayIso && Array.isArray(data.lastSentTimes)) {
    return normalizeScheduleTimes(data.lastSentTimes);
  }
  if (isLegacySingleSlotSchedule(data) && data.lastSentDate === todayIso) {
    const legacy = normalizeScheduleTime(data.sendTime ?? '');
    return legacy ? [legacy] : [];
  }
  return [];
}

function formatScheduleTimesLabel(times: string[]): string {
  if (times.length === 0) return '—';
  return times.map(t => `${t} น.`).join(', ');
}

function buildStaffSummaryForDate(
  staffDirectory: StaffDirectoryItem[],
  staffRecords: StaffAttendanceRecord[],
  leaveRows: LeaveRequest[],
  selectedDate: string,
  todayIso: string,
  now = new Date(),
  teacherPositionByUserId: Map<string, string> = new Map(),
): StaffSummary {
  const isPastDate = selectedDate < todayIso;
  const isFutureDate = selectedDate > todayIso;
  const isTodayAfterNoon = selectedDate === todayIso && getBangkokHour(now) >= 12;
  const shouldMarkAbsent = isPastDate || isTodayAfterNoon;

  const recordMap = new Map(staffRecords.map((r) => [r.userId, r]));
  const leaveIds = new Set(leaveRows.map((r) => r.requesterId));

  let present = 0;
  let late = 0;
  let absent = 0;
  let leave = 0;
  let pending = 0;
  const lateNames: string[] = [];
  const pendingNames: string[] = [];

  staffDirectory.forEach((staff) => {
    const record = recordMap.get(staff.userId);
    if (record) {
      const resolved = resolveStaffAttendanceDisplay(record, {
        selectedDate,
        isWorkingDay: true,
        now,
        isSpecialTeacher: isSpecialTeacherUser(staff.userId, teacherPositionByUserId),
      });
      if (resolved.isPending) {
        pending += 1;
        pendingNames.push(staff.displayName);
      } else if (resolved.status === 'present') present += 1;
      else if (resolved.status === 'late') {
        late += 1;
        lateNames.push(staff.displayName);
      } else if (resolved.status === 'absent') absent += 1;
      return;
    }

    if (leaveIds.has(staff.userId) && !isFutureDate) {
      leave += 1;
      return;
    }

    if (shouldMarkAbsent) absent += 1;
    else {
      pending += 1;
      pendingNames.push(staff.displayName);
    }
  });

  lateNames.sort((a, b) => a.localeCompare(b, 'th'));
  pendingNames.sort((a, b) => a.localeCompare(b, 'th'));

  return {
    total: staffDirectory.length,
    present,
    late,
    absent,
    leave,
    pending,
    lateNames,
    pendingNames,
  };
}

type RecipientRoleFilter = 'teacher' | 'staff' | 'admin' | 'sysadmin';

const RECIPIENT_ROLE_FILTERS: {
  key: RecipientRoleFilter;
  label: string;
  icon: typeof HiAcademicCap;
  activeClass: string;
}[] = [
  { key: 'teacher', label: 'ครู', icon: HiAcademicCap, activeClass: 'border-violet-300 bg-violet-50 text-violet-700' },
  { key: 'staff', label: 'บุคลากร', icon: HiBriefcase, activeClass: 'border-emerald-300 bg-emerald-50 text-emerald-700' },
  { key: 'admin', label: 'ผู้บริหาร', icon: HiBuildingOffice2, activeClass: 'border-blue-300 bg-blue-50 text-blue-700' },
  { key: 'sysadmin', label: 'แอดมินสูงสุด', icon: HiShieldCheck, activeClass: 'border-amber-300 bg-amber-50 text-amber-700' },
];

function roleLabel(role: string): string {
  if (role === 'sysadmin') return 'แอดมินสูงสุด';
  if (role === 'admin') return 'ผู้บริหาร';
  if (role === 'teacher') return 'ครู';
  if (role === 'staff') return 'บุคลากร';
  return role || 'unknown';
}

function roleBadgeClass(role: string): string {
  if (role === 'sysadmin') return 'bg-amber-100 text-amber-700';
  if (role === 'admin') return 'bg-blue-100 text-blue-700';
  if (role === 'teacher') return 'bg-violet-100 text-violet-700';
  if (role === 'staff') return 'bg-emerald-100 text-emerald-700';
  return 'bg-slate-100 text-slate-600';
}

function normalizeEmail(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function isRecipientUser(u: Record<string, unknown>): boolean {
  const role = typeof u.role === 'string' ? u.role : '';
  const email = normalizeEmail(u.email);
  return role === 'admin' || role === 'sysadmin' || role === 'teacher' || role === 'staff' || email === GOD_MODE_EMAIL;
}

function resolveUserLineId(u: Record<string, unknown>): string | undefined {
  const lineToken = typeof u.lineToken === 'string' ? u.lineToken.trim() : '';
  const lineUid = typeof u.lineUid === 'string' ? u.lineUid.trim() : '';
  return lineToken || lineUid || undefined;
}

function mapUserToRecipient(
  u: Record<string, unknown> & { id: string },
  photoByUserId?: Map<string, string>,
): Recipient {
  const email = typeof u.email === 'string' ? u.email : '';
  const role = typeof u.role === 'string' && u.role.trim() ? u.role : (normalizeEmail(email) === GOD_MODE_EMAIL ? 'sysadmin' : '');
  const userPhoto = typeof u.photoURL === 'string' && u.photoURL.trim() ? u.photoURL.trim() : undefined;
  const teacherPhoto = photoByUserId?.get(String(u.id));
  return {
    uid: String(u.id),
    displayName: String(u.name ?? u.displayName ?? email ?? 'ผู้บริหาร'),
    role,
    lineToken: resolveUserLineId(u),
    photoURL: userPhoto ?? teacherPhoto,
    enabled: Boolean(resolveUserLineId(u)),
  };
}

function waitForLineSendResult(
  docRef: DocumentReference,
  timeoutMs = 90_000,
): Promise<{ successCount: number; failCount: number; processError?: string }> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      unsub();
      reject(new Error('หมดเวลารอส่ง LINE — ตรวจสอบประวัติการส่งอีกครั้ง'));
    }, timeoutMs);

    const unsub = onSnapshot(
      docRef,
      (snap) => {
        const data = snap.data();
        if (!data?.processed) return;

        window.clearTimeout(timeout);
        unsub();

        const processError =
          typeof data.processError === 'string' ? data.processError.trim() : '';
        if (processError) {
          reject(new Error(processError));
          return;
        }

        resolve({
          successCount: typeof data.successCount === 'number' ? data.successCount : 0,
          failCount: typeof data.failCount === 'number' ? data.failCount : 0,
        });
      },
      (err) => {
        window.clearTimeout(timeout);
        unsub();
        reject(err);
      },
    );
  });
}

function ensureGodModeRecipient(
  recipients: Recipient[],
  currentUid?: string,
  currentEmail?: string,
  currentLineToken?: string,
  currentPhotoURL?: string,
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
      photoURL: currentPhotoURL?.trim() || undefined,
      enabled: Boolean(currentLineToken?.trim()),
    },
  ];
}

function recipientsListEqual(a: Recipient[], b: Recipient[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    const left = a[i];
    const right = b[i];
    if (
      left.uid !== right.uid
      || left.displayName !== right.displayName
      || left.role !== right.role
      || left.lineToken !== right.lineToken
      || left.photoURL !== right.photoURL
      || left.enabled !== right.enabled
    ) {
      return false;
    }
  }
  return true;
}

// ── LINE Flex Message Preview ─────────────────────────────────────────────────

interface FlexPreviewProps {
  reportType: ReportType;
  selectedDate: string;
  staffSummary: StaffSummary;
  studentSummary: StudentSummary;
  alertMessage?: string;
  isLoading: boolean;
}

function LineFlexPreview({
  reportType,
  selectedDate,
  staffSummary,
  studentSummary,
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
                      {(staffSummary.pending ?? 0) > 0 && (
                        <StatRow label="รอเช็ก" value={staffSummary.pending ?? 0} color="text-slate-500" loading={isLoading} />
                      )}
                    </div>
                    {!isLoading && staffSummary.lateNames && staffSummary.lateNames.length > 0 && (
                      <NameListSection title="รายชื่อมาสาย" items={staffSummary.lateNames} />
                    )}
                    {!isLoading && (staffSummary.pending ?? 0) > 0 && staffSummary.pendingNames && staffSummary.pendingNames.length > 0 && (
                      <NameListSection title="รายชื่อรอเช็ก" items={staffSummary.pendingNames} />
                    )}
                    <div className="mt-1.5 flex items-center justify-between rounded-lg bg-slate-50 px-2 py-1">
                      <span className="text-[10px] font-semibold text-slate-500">บุคลากรทั้งหมด</span>
                      <span className="text-xs font-black text-slate-700">{isLoading ? '...' : staffSummary.total} คน</span>
                    </div>
                  </div>

                  {/* Student section */}
                  <div className="px-4 py-2.5">
                    <p className="mb-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400">
                      นักเรียน
                    </p>
                    <div className="grid grid-cols-2 gap-1.5">
                      <StatRow label="มาเรียน" value={studentSummary.present} color="text-emerald-600" loading={isLoading} />
                      <StatRow label="มาสาย" value={studentSummary.late} color="text-amber-600" loading={isLoading} />
                      <StatRow label="ขาด" value={studentSummary.absent} color="text-rose-600" loading={isLoading} />
                      <StatRow label="ลา" value={studentSummary.leave} color="text-violet-600" loading={isLoading} />
                    </div>
                    {!isLoading && studentSummary.absentStudents && studentSummary.absentStudents.length > 0 && (
                      <StudentNameListSection title="รายชื่อขาดเรียน" students={studentSummary.absentStudents} />
                    )}
                    {!isLoading && studentSummary.leaveStudents && studentSummary.leaveStudents.length > 0 && (
                      <StudentNameListSection title="รายชื่อลา" students={studentSummary.leaveStudents} />
                    )}
                    <div className="mt-1.5 flex items-center justify-between rounded-lg bg-blue-50 px-2 py-1">
                      <span className="text-[10px] font-semibold text-slate-500">ห้องเรียนที่เช็คแถวแล้ว</span>
                      <span className="text-xs font-black text-blue-700">{isLoading ? '...' : studentSummary.classes} ห้อง</span>
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

function NameListSection({ title, items }: { title: string; items: string[] }) {
  const shown = items.slice(0, 8);
  return (
    <div className="mt-2 rounded-lg bg-amber-50/60 px-2 py-1.5">
      <p className="text-[9px] font-black uppercase tracking-wide text-amber-700">{title}</p>
      <ul className="mt-0.5 max-h-20 space-y-0.5 overflow-y-auto">
        {shown.map((name) => (
          <li key={name} className="text-[10px] font-medium text-slate-700 before:mr-1 before:text-amber-500 before:content-['•']">
            {name}
          </li>
        ))}
        {items.length > 8 && (
          <li className="text-[9px] font-semibold text-slate-400">… และอีก {items.length - 8} คน</li>
        )}
      </ul>
    </div>
  );
}

function StudentNameListSection({
  title,
  students,
}: {
  title: string;
  students: StudentRollCallEntry[];
}) {
  const shown = students.slice(0, 10);
  return (
    <div className="mt-2 rounded-lg bg-rose-50/50 px-2 py-1.5">
      <p className="text-[9px] font-black uppercase tracking-wide text-rose-600">{title}</p>
      <ul className="mt-0.5 max-h-24 space-y-0.5 overflow-y-auto">
        {shown.map((s) => (
          <li
            key={`${s.className}-${s.name}`}
            className="text-[10px] font-medium text-slate-700 before:mr-1 before:text-rose-400 before:content-['•']"
          >
            {s.name}{' '}
            <span className="text-[9px] font-semibold text-slate-400">({s.className})</span>
          </li>
        ))}
        {students.length > 10 && (
          <li className="text-[9px] font-semibold text-slate-400">… และอีก {students.length - 10} คน</li>
        )}
      </ul>
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
  const accessDenied = role === 'student' || role === 'parent';
  const isSysAdmin =
    role === 'sysadmin' || normalizeEmail(user?.email) === GOD_MODE_EMAIL;
  const [selectedDate, setSelectedDate] = useState(() => getBangkokDateIso());
  const [reportType, setReportType] = useState<ReportType>('daily');
  const [alertMessage, setAlertMessage] = useState('');
  const [sendStatus, setSendStatus] = useState<SendStatus>('idle');
  const [sendError, setSendError] = useState('');
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [loadingRecipients, setLoadingRecipients] = useState(true);
  const { users: staffUsers, loading: loadingStaffDirectory } = useStaffUsers();
  const staffDirectory = useMemo<StaffDirectoryItem[]>(
    () => staffUsers.map((u) => ({ userId: u.userId, displayName: u.displayName })),
    [staffUsers],
  );
  const { users: portalUsers, loading: loadingPortalUsers } = usePortalRecipientUsers();
  const { teachers, loading: loadingTeachersForRecipients } = useTeachersCollection();
  const teacherPositionByUserId = useMemo(
    () => buildTeacherPositionByUserId(teachers),
    [teachers],
  );
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
  const [activeTab, setActiveTab] = useState<RightPanelTab>('preview');
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [selectedRoleFilters, setSelectedRoleFilters] = useState<RecipientRoleFilter[]>([]);
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleTimes, setScheduleTimes] = useState<string[]>(['17:00']);
  const [loadingSchedule, setLoadingSchedule] = useState(true);
  const [scheduleSaveStatus, setScheduleSaveStatus] = useState<ScheduleSaveStatus>('idle');
  const [scheduleSaveError, setScheduleSaveError] = useState('');
  const [scheduleResendStatus, setScheduleResendStatus] = useState<ScheduleSaveStatus>('idle');
  const [scheduleResendError, setScheduleResendError] = useState('');
  const [scheduleSlotResetStatus, setScheduleSlotResetStatus] = useState<ScheduleSaveStatus>('idle');
  const [scheduleUpdatedAt, setScheduleUpdatedAt] = useState<Date | null>(null);
  const [scheduleLastSentDate, setScheduleLastSentDate] = useState<string | null>(null);
  const [scheduleLastSentTimes, setScheduleLastSentTimes] = useState<string[]>([]);
  const [scheduleLastSentAt, setScheduleLastSentAt] = useState<Date | null>(null);
  const [scheduleLastError, setScheduleLastError] = useState<string | null>(null);
  const [scheduleRecipientUids, setScheduleRecipientUids] = useState<string[]>([]);
  const [scheduleRecipientsHydrated, setScheduleRecipientsHydrated] = useState(false);
  const [hasStoredScheduleRecipients, setHasStoredScheduleRecipients] = useState(false);
  const scheduleDefaultsSeededRef = useRef(false);

  // ── Load Send History by Date ───────────────────────────────────────────────
  useEffect(() => {
    if (accessDenied) return;
    let active = true;
    const fetchHistory = async () => {
      setLoadingHistory(true);
      try {
        const q = query(
          collection(db, 'report_sends'),
          where('date', '==', selectedDate)
        );
        const snapshot = await getDocs(q);
        if (!active) return;

        const historyData = snapshot.docs.map(doc => {
          const data = doc.data();
          let sentAtDate = new Date();
          if (data.sentAt && typeof data.sentAt.toDate === 'function') {
            sentAtDate = data.sentAt.toDate();
          } else if (data.sentAt) {
            sentAtDate = new Date(data.sentAt);
          }

          return {
            id: doc.id,
            sentAt: sentAtDate,
            reportType: data.reportType as ReportType,
            recipientCount: Array.isArray(data.recipients) ? data.recipients.length : 0,
            status:
              typeof data.processError === 'string' && data.processError
                ? ('error' as const)
                : data.processed === true && typeof data.successCount === 'number' && data.successCount === 0
                  ? ('error' as const)
                  : ('success' as const),
            note:
              typeof data.processError === 'string' && data.processError
                ? data.processError
                : typeof data.successCount === 'number' && typeof data.failCount === 'number'
                  ? `ส่งสำเร็จ ${data.successCount} / ล้มเหลว ${data.failCount}`
                  : data.alertMessage || undefined,
          };
        });

        // Sort descending by sentAt
        historyData.sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime());
        setSendHistory(historyData);
      } catch (err) {
        console.error('Error fetching send history:', err);
      } finally {
        if (active) setLoadingHistory(false);
      }
    };

    fetchHistory();
    return () => { active = false; };
  }, [selectedDate, accessDenied]);

  // ── Load daily report schedule ──────────────────────────────────────────────
  useEffect(() => {
    if (accessDenied) return;
    let active = true;
    const loadSchedule = async () => {
      setLoadingSchedule(true);
      try {
        const snap = await getDoc(DAILY_SCHEDULE_DOC);
        if (!active) return;
        if (snap.exists()) {
          const data = snap.data() as DailyReportSchedule;
          setScheduleEnabled(Boolean(data.enabled));
          setScheduleTimes(resolveStoredScheduleTimes(data));
          setScheduleLastSentDate(typeof data.lastSentDate === 'string' ? data.lastSentDate : null);
          const todayIso = getBangkokDateIso();
          setScheduleLastSentTimes(resolveSentScheduleTimesForDate(data, todayIso));
          if (Array.isArray(data.recipientUids)) {
            setScheduleRecipientUids(
              data.recipientUids.filter((uid): uid is string => typeof uid === 'string' && uid.trim().length > 0),
            );
            setHasStoredScheduleRecipients(true);
            scheduleDefaultsSeededRef.current = true;
          }
          if (data.lastSentAt && typeof (data.lastSentAt as { toDate?: () => Date }).toDate === 'function') {
            setScheduleLastSentAt((data.lastSentAt as { toDate: () => Date }).toDate());
          } else {
            setScheduleLastSentAt(null);
          }
          setScheduleLastError(
            typeof data.lastScheduleError === 'string' && data.lastScheduleError.trim()
              ? data.lastScheduleError.trim()
              : null,
          );
          if (data.updatedAt && typeof (data.updatedAt as { toDate?: () => Date }).toDate === 'function') {
            setScheduleUpdatedAt((data.updatedAt as { toDate: () => Date }).toDate());
          }
        }
        setScheduleRecipientsHydrated(true);
      } catch (err) {
        console.error('Error loading daily report schedule:', err);
      } finally {
        if (active) setLoadingSchedule(false);
      }
    };
    loadSchedule();
    return () => { active = false; };
  }, [accessDenied]);

  const { records, loading: staffLoading, refresh: refreshStaff } = useAdminStaffAttendance(selectedDate);
  const { requests: leaveRequests } = useLeaveRequestsSince(selectedDate);

  // ── Load recipients (admin / sysadmin / teacher / staff) ────────────────────
  useEffect(() => {
    if (accessDenied) return;
    if (loadingPortalUsers || loadingTeachersForRecipients) return;

    const photoByUserId = new Map<string, string>();
    teachers.forEach((t) => {
      const photoURL = typeof t.photoURL === 'string' ? t.photoURL.trim() : '';
      if (!photoURL) return;
      const userId = typeof t.userId === 'string' && t.userId.trim() ? t.userId.trim() : t.id;
      photoByUserId.set(userId, photoURL);
      photoByUserId.set(t.id, photoURL);
    });

    const rows = portalUsers
      .filter((u) => isRecipientUser({ role: u.role, email: u.email }))
      .map((u) =>
        mapUserToRecipient(
          {
            id: u.userId,
            role: u.role,
            email: u.email,
            name: u.displayName,
            displayName: u.displayName,
            photoURL: u.photoURL,
            lineToken: u.lineToken,
            lineUid: u.lineUid,
          },
          photoByUserId,
        ),
      );

    setRecipients((prev) => {
      const enabledMap = new Map(prev.map((r) => [r.uid, r.enabled]));
      const next = ensureGodModeRecipient(
        rows.map((r) => ({
          ...r,
          enabled: r.lineToken ? (enabledMap.get(r.uid) ?? true) : false,
        })),
        user?.uid,
        user?.email ?? undefined,
        userData?.lineToken ?? userData?.lineUid,
        typeof userData?.photoURL === 'string' ? userData.photoURL : undefined,
      );
      return recipientsListEqual(prev, next) ? prev : next;
    });
    setLoadingRecipients(false);
  }, [
    accessDenied,
    loadingPortalUsers,
    loadingTeachersForRecipients,
    portalUsers,
    teachers,
    user?.uid,
    user?.email,
    userData?.lineToken,
    userData?.lineUid,
    userData?.photoURL,
  ]);

  // ── Load student summary (morning roll call) ───────────────────────────────
  useEffect(() => {
    if (accessDenied) return;
    let cancelled = false;
    const load = async () => {
      setStudentLoading(true);
      try {
        const q = query(collection(db, 'morning_rollcall'), where('date', '==', selectedDate));
        const snap = await getDocs(q);
        if (cancelled) return;
        let present = 0, late = 0, absent = 0, leave = 0;
        const absentStudents: StudentRollCallEntry[] = [];
        const leaveStudents: StudentRollCallEntry[] = [];
        snap.forEach(docSnap => {
          const data = docSnap.data() as Record<string, unknown>;
          const summary = (data.summary ?? {}) as Record<string, unknown>;
          const className =
            typeof data.className === 'string' && data.className.trim()
              ? data.className.trim()
              : 'ไม่ระบุชั้น';
          present += Number(summary.present ?? 0);
          late += Number(summary.late ?? 0);
          absent += Number(summary.absent ?? 0);
          leave += Number(summary.leave ?? 0);

          const attendance = Array.isArray(data.attendance) ? data.attendance : [];
          for (const row of attendance) {
            if (!row || typeof row !== 'object') continue;
            const item = row as Record<string, unknown>;
            const name = typeof item.studentName === 'string' ? item.studentName.trim() : '';
            const status = typeof item.status === 'string' ? item.status : '';
            if (!name) continue;
            if (status === 'absent') absentStudents.push({ name, className });
            if (status === 'leave') leaveStudents.push({ name, className });
          }
        });
        const sortStudents = (a: StudentRollCallEntry, b: StudentRollCallEntry) =>
          a.className.localeCompare(b.className, 'th') || a.name.localeCompare(b.name, 'th');
        absentStudents.sort(sortStudents);
        leaveStudents.sort(sortStudents);
        setStudentSummary({
          sessions: snap.size,
          classes: snap.size,
          present,
          late,
          absent,
          leave,
          absentStudents,
          leaveStudents,
        });
      } finally {
        if (!cancelled) setStudentLoading(false);
      }
    };
    load().catch(() => setStudentLoading(false));
    return () => { cancelled = true; };
  }, [selectedDate, accessDenied]);

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

  const staffSummary: StaffSummary = useMemo(
    () =>
      buildStaffSummaryForDate(
        staffDirectory,
        staffRecords,
        leaveRows,
        selectedDate,
        getBangkokDateIso(),
        new Date(),
        teacherPositionByUserId,
      ),
    [staffDirectory, staffRecords, leaveRows, selectedDate, teacherPositionByUserId],
  );

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

  const scheduleRecipientUidSet = useMemo(
    () => new Set(scheduleRecipientUids),
    [scheduleRecipientUids],
  );

  const scheduleLineRecipients = useMemo(
    () => recipients.filter(r => r.lineToken),
    [recipients],
  );

  const scheduleEligibleRecipients = useMemo(
    () => scheduleLineRecipients.filter(r => scheduleRecipientUidSet.has(r.uid)),
    [scheduleLineRecipients, scheduleRecipientUidSet],
  );
  const trimmedAlertMessage = alertMessage.trim();

  const bangkokTodayLabel = useMemo(
    () =>
      new Date().toLocaleDateString('th-TH', {
        timeZone: 'Asia/Bangkok',
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
    [],
  );

  const filteredRecipients = useMemo(() => {
    if (selectedRoleFilters.length === 0) return recipients;
    const allowed = new Set(selectedRoleFilters);
    return recipients.filter(r => allowed.has(r.role as RecipientRoleFilter));
  }, [recipients, selectedRoleFilters]);

  const enabledFilteredRecipients = useMemo(
    () => filteredRecipients.filter(r => r.enabled),
    [filteredRecipients],
  );

  const toggleRoleFilter = useCallback((roleKey: RecipientRoleFilter) => {
    setSelectedRoleFilters(prev =>
      prev.includes(roleKey) ? prev.filter(r => r !== roleKey) : [...prev, roleKey],
    );
  }, []);

  // ── Toggle recipient ────────────────────────────────────────────────────────
  const toggleRecipient = useCallback((uid: string) => {
    setRecipients(prev =>
      prev.map(r => {
        if (r.uid !== uid || !r.lineToken) return r;
        return { ...r, enabled: !r.enabled };
      }),
    );
  }, []);

  useEffect(() => {
    if (!scheduleRecipientsHydrated || loadingRecipients || hasStoredScheduleRecipients) return;
    if (scheduleDefaultsSeededRef.current) return;
    const defaults = recipients.filter(r => r.lineToken).map(r => r.uid);
    if (defaults.length === 0) return;
    setScheduleRecipientUids(defaults);
    scheduleDefaultsSeededRef.current = true;
  }, [scheduleRecipientsHydrated, loadingRecipients, hasStoredScheduleRecipients, recipients]);

  useEffect(() => {
    if (!scheduleRecipientsHydrated || loadingRecipients) return;
    const validUidSet = new Set(recipients.filter(r => r.lineToken).map(r => r.uid));
    if (validUidSet.size === 0) return;
    setScheduleRecipientUids(prev => {
      const normalized = prev.filter(uid => validUidSet.has(uid));
      return normalized.length === prev.length ? prev : normalized;
    });
  }, [scheduleRecipientsHydrated, loadingRecipients, recipients]);

  const toggleScheduleRecipient = useCallback((uid: string) => {
    scheduleDefaultsSeededRef.current = true;
    setScheduleRecipientUids(prev =>
      prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid],
    );
  }, []);

  const handleSaveSchedule = useCallback(async () => {
    if (scheduleEligibleRecipients.length === 0) {
      setScheduleSaveStatus('error');
      setScheduleSaveError('กรุณาเลือกผู้รับที่เชื่อม LINE แล้วอย่างน้อย 1 คน');
      return;
    }

    setScheduleSaveStatus('saving');
    setScheduleSaveError('');

    try {
      const normalizedTimes = normalizeScheduleTimes(scheduleTimes);
      if (normalizedTimes.length === 0) {
        setScheduleSaveStatus('error');
        setScheduleSaveError('กรุณากำหนดเวลาส่งอย่างน้อย 1 รอบ');
        return;
      }

      const todayIso = getBangkokDateIso();
      const existingSnap = await getDoc(DAILY_SCHEDULE_DOC);
      const existing = existingSnap.exists()
        ? (existingSnap.data() as DailyReportSchedule)
        : null;

      const recipientRows = [...scheduleEligibleRecipients];
      if (isSysAdmin && user?.uid) {
        const selfLine =
          (typeof userData?.lineToken === 'string' && userData.lineToken.trim()) ||
          (typeof userData?.lineUid === 'string' && userData.lineUid.trim()) ||
          '';
        if (selfLine && !recipientRows.some(r => r.uid === user.uid)) {
          recipientRows.push({
            uid: user.uid,
            displayName: user.email ?? GOD_MODE_EMAIL,
            role: 'sysadmin',
            lineToken: selfLine,
            photoURL: typeof userData?.photoURL === 'string' ? userData.photoURL : undefined,
            enabled: true,
          });
        }
      }

      const slotPatch: Record<string, unknown> = {};
      if (existing) {
        const prevTimes = resolveStoredScheduleTimes(existing);
        const timesChanged =
          JSON.stringify(prevTimes) !== JSON.stringify(normalizedTimes);

        if (existing.lastSentSlotsDate === todayIso && Array.isArray(existing.lastSentTimes)) {
          if (timesChanged) {
            const pruned = normalizeScheduleTimes(existing.lastSentTimes).filter(t =>
              normalizedTimes.includes(t),
            );
            if (pruned.length > 0) {
              slotPatch.lastSentSlotsDate = todayIso;
              slotPatch.lastSentTimes = pruned;
            } else {
              slotPatch.lastSentSlotsDate = deleteField();
              slotPatch.lastSentTimes = deleteField();
            }
          }
        } else if (existing.lastSentDate === todayIso && !existing.lastSentSlotsDate) {
          const legacy = normalizeScheduleTime(existing.sendTime ?? '');
          if (legacy && normalizedTimes.includes(legacy)) {
            slotPatch.lastSentSlotsDate = todayIso;
            slotPatch.lastSentTimes = [legacy];
          } else if (normalizedTimes.length > 1) {
            // อัปเกรดจากโหมดรอบเดียว — อย่าบล็อกรอบแรกหลัง sort โดยไม่ได้ส่งจริง
            slotPatch.lastSentSlotsDate = deleteField();
            slotPatch.lastSentTimes = deleteField();
          } else if (legacy) {
            slotPatch.lastSentSlotsDate = todayIso;
            slotPatch.lastSentTimes = [legacy];
          }
        }
      }

      const payload: DailyReportSchedule = {
        enabled: scheduleEnabled,
        sendTime: normalizedTimes[0],
        sendTimes: normalizedTimes,
        recipientUids: recipientRows.map(r => r.uid),
        recipients: recipientRows.map(r => ({
          uid: r.uid,
          lineToken: r.lineToken,
        })),
        updatedBy: user?.uid,
      };
      await setDoc(
        DAILY_SCHEDULE_DOC,
        {
          ...payload,
          ...slotPatch,
          updatedAt: serverTimestamp(),
          lastScheduleError: deleteField(),
        },
        { merge: true },
      );
      setHasStoredScheduleRecipients(true);
      setScheduleUpdatedAt(new Date());
      setScheduleLastError(null);
      setScheduleTimes(normalizedTimes);
      if (typeof slotPatch.lastSentTimes === 'object' && Array.isArray(slotPatch.lastSentTimes)) {
        setScheduleLastSentTimes(slotPatch.lastSentTimes as string[]);
      }
      if (recipientRows.length !== scheduleEligibleRecipients.length) {
        setScheduleRecipientUids(recipientRows.map(r => r.uid));
      }
      setScheduleSaveStatus('success');
      setTimeout(() => setScheduleSaveStatus('idle'), 3000);
    } catch (err) {
      setScheduleSaveStatus('error');
      setScheduleSaveError(err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ');
    }
  }, [
    isSysAdmin,
    scheduleEligibleRecipients,
    scheduleEnabled,
    scheduleTimes,
    user?.email,
    user?.uid,
    userData?.lineToken,
    userData?.lineUid,
    userData?.photoURL,
  ]);

  const handleResetTodayScheduleSlots = useCallback(async () => {
    setScheduleSlotResetStatus('saving');
    setScheduleResendError('');
    try {
      await setDoc(
        DAILY_SCHEDULE_DOC,
        {
          lastSentDate: deleteField(),
          lastSentSlotsDate: deleteField(),
          lastSentTimes: deleteField(),
        },
        { merge: true },
      );
      setScheduleLastSentDate(null);
      setScheduleLastSentTimes([]);
      setScheduleLastSentAt(null);
      setScheduleSlotResetStatus('success');
      setTimeout(() => setScheduleSlotResetStatus('idle'), 3000);
    } catch (err) {
      setScheduleSlotResetStatus('error');
      setScheduleResendError(err instanceof Error ? err.message : 'ล้างสถานะไม่สำเร็จ');
    }
  }, []);

  const updateScheduleTimeAt = useCallback((index: number, value: string) => {
    setScheduleTimes(prev => prev.map((t, i) => (i === index ? value : t)));
  }, []);

  const addScheduleTimeSlot = useCallback(() => {
    setScheduleTimes(prev => {
      if (prev.length >= MAX_SCHEDULE_TIMES) return prev;
      const last = prev[prev.length - 1] ?? '17:00';
      const [h, m] = last.split(':').map(Number);
      const nextHour = Number.isFinite(h) ? Math.min(h + 1, 23) : 17;
      const next = `${String(nextHour).padStart(2, '0')}:${String(Number.isFinite(m) ? m : 0).padStart(2, '0')}`;
      return [...prev, next];
    });
  }, []);

  const removeScheduleTimeSlot = useCallback((index: number) => {
    setScheduleTimes(prev => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  }, []);

  const normalizedScheduleTimes = useMemo(
    () => normalizeScheduleTimes(scheduleTimes),
    [scheduleTimes],
  );

  const todayIso = getBangkokDateIso();
  const schedulePendingTimesToday = useMemo(() => {
    const sent = new Set(scheduleLastSentTimes);
    return normalizedScheduleTimes.filter(t => !sent.has(t));
  }, [normalizedScheduleTimes, scheduleLastSentTimes]);

  const submitReportSend = useCallback(async (options: {
    reportType: ReportType;
    date: string;
    recipients: Recipient[];
    triggeredBy: string;
    alertMessage?: string | null;
    staff: StaffSummary | null;
    student: StudentSummary | null;
    leave: LeaveSummary | null;
    onSuccess?: (result: {
      docId: string;
      successCount: number;
      failCount: number;
      recipientCount: number;
    }) => void;
  }) => {
    const {
      reportType: type,
      date,
      recipients: sendRecipients,
      triggeredBy,
      alertMessage: alertText,
      staff,
      student,
      leave,
      onSuccess,
    } = options;

    if (sendRecipients.length === 0) {
      throw new Error('กรุณาเลือกผู้รับที่เชื่อม LINE แล้วอย่างน้อย 1 คน');
    }
    if (type === 'alert' && !alertText?.trim()) {
      throw new Error('กรุณากรอกข้อความแจ้งเตือนสำหรับรายงานด่วน');
    }

    const payload = {
      reportType: type,
      date,
      staffSummary: type === 'alert' ? null : staff,
      studentSummary: type === 'alert' ? null : student,
      leaveSummary: type === 'alert' ? null : leave,
      alertMessage: type === 'alert' ? alertText?.trim() ?? null : null,
      recipients: sendRecipients.map(r => ({ uid: r.uid, lineToken: r.lineToken })),
      sentAt: serverTimestamp(),
      triggeredBy,
    };

    const docRef = await addDoc(collection(db, 'report_sends'), payload);
    const result = await waitForLineSendResult(docRef);

    if (result.successCount === 0) {
      throw new Error(
        result.failCount > 0
          ? `ส่ง LINE ไม่สำเร็จ (${result.failCount} คน) — ตรวจสอบว่าเชื่อม LINE OA แล้ว`
          : 'ไม่มีผู้รับที่ส่งได้',
      );
    }

    onSuccess?.({
      docId: docRef.id,
      successCount: result.successCount,
      failCount: result.failCount,
      recipientCount: sendRecipients.length,
    });

    return result;
  }, []);

  const handleSendScheduledNow = useCallback(async () => {
    const todayIso = getBangkokDateIso();
    if (selectedDate !== todayIso) {
      setSelectedDate(todayIso);
      setScheduleResendStatus('error');
      setScheduleResendError('กำลังโหลดข้อมูลวันนี้ กรุณากดส่งอีกครั้ง');
      return;
    }
    if (isLoading) {
      setScheduleResendStatus('error');
      setScheduleResendError('กำลังโหลดข้อมูลรายงาน กรุณารอสักครู่แล้วลองใหม่');
      return;
    }

    setScheduleResendStatus('saving');
    setScheduleResendError('');

    try {
      const result = await submitReportSend({
        reportType: 'daily',
        date: todayIso,
        recipients: scheduleEligibleRecipients,
        triggeredBy: 'scheduled-manual',
        staff: staffSummary,
        student: studentSummary,
        leave: leaveSummary,
        onSuccess: ({ docId, recipientCount, failCount, successCount }) => {
          setScheduleLastSentAt(new Date());
          setActiveTab('history');
          setSendHistory(prev => [
            {
              id: docId,
              sentAt: new Date(),
              reportType: 'daily',
              recipientCount,
              status: failCount > 0 ? 'error' : 'success',
              note: failCount > 0
                ? `ส่งสำเร็จ ${successCount} / ล้มเหลว ${failCount}`
                : 'ส่งซ้ำจาก tab ตั้งเวลา',
            },
            ...prev.slice(0, 4),
          ]);
        },
      });

      setScheduleResendStatus('success');
      if (result.failCount > 0) {
        setScheduleResendError(`ส่งสำเร็จ ${result.successCount} คน, ล้มเหลว ${result.failCount} คน`);
      }
      setTimeout(() => setScheduleResendStatus('idle'), 3000);
    } catch (err) {
      setScheduleResendStatus('error');
      setScheduleResendError(err instanceof Error ? err.message : 'ส่งไม่สำเร็จ');
    }
  }, [
    isLoading,
    leaveSummary,
    scheduleEligibleRecipients,
    selectedDate,
    staffSummary,
    studentSummary,
    submitReportSend,
  ]);

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
      const result = await submitReportSend({
        reportType,
        date: selectedDate,
        recipients: enabledRecipients,
        triggeredBy: 'manual',
        alertMessage: trimmedAlertMessage,
        staff: staffSummary,
        student: studentSummary,
        leave: leaveSummary,
        onSuccess: ({ docId, recipientCount, failCount, successCount }) => {
          setSendStatus('success');
          setActiveTab('history');
          setSendHistory(prev => [
            {
              id: docId,
              sentAt: new Date(),
              reportType,
              recipientCount,
              status: failCount > 0 ? 'error' : 'success',
              note:
                failCount > 0
                  ? `ส่งสำเร็จ ${successCount} / ล้มเหลว ${failCount}`
                  : reportType === 'alert'
                    ? trimmedAlertMessage
                    : undefined,
            },
            ...prev.slice(0, 4),
          ]);

          if (failCount > 0) {
            setSendError(`ส่งสำเร็จ ${successCount} คน, ล้มเหลว ${failCount} คน`);
          }

          setTimeout(() => setSendStatus('idle'), 4000);
        },
      });

      if (result.failCount > 0 && result.successCount > 0) {
        setSendStatus('success');
      }
    } catch (err) {
      setSendStatus('error');
      setSendError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
    }
  }, [
    enabledRecipients,
    reportType,
    selectedDate,
    staffSummary,
    studentSummary,
    leaveSummary,
    trimmedAlertMessage,
    submitReportSend,
  ]);

  const refresh = useCallback(() => {
    setSelectedDate(getBangkokDateIso());
    refreshStaff();
    setStudentSummary({
      sessions: 0,
      classes: 0,
      present: 0,
      late: 0,
      absent: 0,
      leave: 0,
      absentStudents: [],
      leaveStudents: [],
    });
    setStudentLoading(true);
  }, [refreshStaff]);

  if (accessDenied) {
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
            className="rounded-[1.5rem] border border-slate-200/80 bg-white/55 p-5 shadow-sm backdrop-blur-md flex flex-col gap-4"
          >
            {/* Date Picker & Refresh Row */}
            <div className="flex gap-2">
              <div className="flex flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-white/70 px-3 py-2">
                <CalendarDays size={14} className="text-slate-400" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={e => setSelectedDate(e.target.value)}
                  className="w-full bg-transparent text-xs font-bold text-slate-700 outline-none"
                />
              </div>
              <button
                type="button"
                onClick={() => setSelectedDate(getBangkokDateIso())}
                className="inline-flex h-9 shrink-0 items-center rounded-xl border border-slate-200 bg-white/80 px-3 text-xs font-semibold text-slate-600 hover:bg-white"
              >
                วันนี้
              </button>
              <button
                onClick={refresh}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white/80 px-3 text-xs font-semibold text-slate-600 hover:bg-white"
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
                  className="w-full appearance-none rounded-xl border border-slate-200 bg-white/70 px-4 py-2.5 pr-10 text-sm font-semibold text-slate-700 outline-none transition-all focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
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
            className="rounded-[1.5rem] border border-slate-200/80 bg-white/55 p-5 shadow-sm backdrop-blur-md"
          >
            <div className="mb-3 flex items-center gap-1.5">
              {RECIPIENT_ROLE_FILTERS.map(({ key, label, icon: Icon, activeClass }) => {
                const isActive = selectedRoleFilters.includes(key);
                return (
                  <button
                    key={key}
                    type="button"
                    title={label}
                    aria-label={`กรอง${label}`}
                    aria-pressed={isActive}
                    onClick={() => toggleRoleFilter(key)}
                    className={cn(
                      'inline-flex h-9 w-9 items-center justify-center rounded-xl border transition-all',
                      isActive
                        ? activeClass
                        : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50',
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </button>
                );
              })}
              <span className="ml-auto rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black text-emerald-700">
                {enabledFilteredRecipients.length}/{filteredRecipients.length} เปิด
              </span>
            </div>

            {loadingRecipients ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 size={20} className="animate-spin text-slate-400" />
              </div>
            ) : recipients.length === 0 ? (
              <p className="py-4 text-center text-sm text-slate-400">ไม่พบผู้รับรายงานในระบบ</p>
            ) : filteredRecipients.length === 0 ? (
              <p className="py-4 text-center text-sm text-slate-400">ไม่พบผู้รับรายงานในตัวกรองที่เลือก</p>
            ) : (
              <div className={cn('space-y-2', RECIPIENT_LIST_SCROLL_CLASS)}>
                {filteredRecipients.map(r => (
                  <div key={r.uid} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={r.photoURL} alt={r.displayName} />
                        <AvatarFallback
                          className={cn(
                            'text-xs font-black text-white',
                            r.lineToken ? 'bg-[#06c755]' : 'bg-slate-300',
                          )}
                        >
                          {r.displayName.slice(0, 1)}
                        </AvatarFallback>
                      </Avatar>
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
                      role="switch"
                      aria-checked={r.enabled}
                      aria-disabled={!r.lineToken}
                      onClick={() => r.lineToken && toggleRecipient(r.uid)}
                      className={cn(
                        'relative h-5 w-9 shrink-0 rounded-full transition-colors duration-200',
                        r.lineToken ? 'cursor-pointer' : 'cursor-not-allowed opacity-45',
                        r.enabled ? 'bg-[#06c755]' : 'bg-slate-300',
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

          {/* Block 3: Action Button */}
          <motion.div
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15 }}
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
                  `สร้างและส่งรายงานทันที (${enabledRecipients.length} คน)`
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
          className="flex flex-col rounded-[1.5rem] border border-slate-200/80 bg-white/55 p-5 shadow-sm backdrop-blur-md xl:col-span-3 min-h-[500px]"
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
              <button
                onClick={() => setActiveTab('schedule')}
                className={cn(
                  'rounded-lg px-3.5 py-1.5 text-xs font-black transition-all duration-200 flex items-center gap-1.5',
                  activeTab === 'schedule'
                    ? 'bg-white text-slate-800 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                )}
              >
                <Clock3 size={13} />
                <span>ตั้งเวลาส่ง</span>
                {scheduleEnabled && (
                  <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-black text-emerald-700">
                    ON
                  </span>
                )}
              </button>
            </div>

            {activeTab === 'preview' ? (
              <div className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1">
                <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
                <span className="text-[10px] font-black text-emerald-700">Real-time</span>
              </div>
            ) : activeTab === 'history' ? (
              <div className="flex items-center gap-1 text-[10px] font-black text-slate-400">
                ล่าสุด 5 รายการ
              </div>
            ) : (
              <div className="flex items-center gap-1 text-[10px] font-black text-blue-600">
                รายงานสรุปยอดประจำวัน
              </div>
            )}
          </div>

          <div className="flex flex-1 flex-col w-full overflow-auto py-2 scrollbar-hide">
            {activeTab === 'preview' ? (
              <div className="flex items-start justify-center">
                <LineFlexPreview
                  reportType={reportType}
                  selectedDate={selectedDate}
                  staffSummary={staffSummary}
                  studentSummary={studentSummary}
                  alertMessage={alertMessage}
                  isLoading={isLoading}
                />
              </div>
            ) : activeTab === 'history' ? (
              <div className="flex flex-col gap-3 w-full">
                {loadingHistory ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <Loader2 className="animate-spin text-slate-400 mb-3" size={28} />
                    <p className="text-sm font-bold text-slate-700">กำลังโหลดประวัติ...</p>
                  </div>
                ) : sendHistory.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="rounded-full bg-slate-100/80 p-4 text-slate-400 mb-3 shadow-inner">
                      <History size={28} className="text-slate-500" />
                    </div>
                    <p className="text-sm font-bold text-slate-700">ยังไม่มีประวัติการส่งในวันที่เลือก</p>
                    <p className="text-xs text-slate-400 mt-1">ประวัติการทำงานจะแสดงขึ้นหลังจากที่เริ่มสร้างและส่งรายงาน</p>
                  </div>
                ) : (
                  <div className="space-y-3 w-full">
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
            ) : (
              <div className="flex w-full flex-col gap-4">
                {loadingSchedule ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <Loader2 className="mb-3 animate-spin text-slate-400" size={28} />
                    <p className="text-sm font-bold text-slate-700">กำลังโหลดการตั้งเวลา...</p>
                  </div>
                ) : (
                  <>
                    <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50/80 to-white p-4">
                      <span className="inline-block rounded-lg border border-blue-100 bg-blue-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-blue-700">
                        {REPORT_TYPE_LABELS.daily}
                      </span>
                      <p className="mt-2 text-sm font-bold text-slate-700">
                        ส่งรายงานสรุปยอดประจำวันอัตโนมัติผ่าน LINE OA
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        เลือกผู้รับสำหรับส่งอัตโนมัติในรายการด้านล่าง (แยกจากรายชื่อส่งมือด้านซ้าย)
                      </p>
                      <p className="mt-2 rounded-xl border border-blue-100/80 bg-blue-50/60 px-3 py-2 text-[11px] leading-relaxed text-blue-900">
                        ส่งอัตโนมัติใช้ข้อมูลของ <span className="font-black">วันนี้ ({bangkokTodayLabel})</span> ตามเวลาไทย
                        — ไม่ต้องเลือกวันที่ด้านซ้าย (ตัวเลือกวันที่ใช้สำหรับส่งมือและดูประวัติเท่านั้น)
                      </p>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-bold text-slate-700">เปิดส่งอัตโนมัติ</p>
                          <p className="text-[11px] text-slate-400">ส่งทุกวันตามเวลาที่กำหนด</p>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={scheduleEnabled}
                          onClick={() => setScheduleEnabled(v => !v)}
                          className={cn(
                            'relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200',
                            scheduleEnabled ? 'bg-[#06c755]' : 'bg-slate-300',
                          )}
                        >
                          <span
                            className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-all duration-200"
                            style={{ left: scheduleEnabled ? '22px' : '2px' }}
                          />
                        </button>
                      </div>

                      <div className="mt-4">
                        <div className="mb-1.5 flex items-center justify-between gap-2">
                          <label className="text-xs font-bold text-slate-500">
                            รอบเวลาส่งประจำวัน
                          </label>
                          <span className="text-[10px] font-semibold text-slate-400">
                            {normalizedScheduleTimes.length}/{MAX_SCHEDULE_TIMES} รอบ
                          </span>
                        </div>
                        <div className="space-y-2">
                          {scheduleTimes.map((slot, index) => (
                            <div
                              key={`schedule-slot-${index}`}
                              className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 focus-within:border-slate-800 transition-colors"
                            >
                              <Clock3 size={14} className="shrink-0 text-slate-400" />
                              <input
                                type="time"
                                value={slot}
                                onChange={e => updateScheduleTimeAt(index, e.target.value)}
                                disabled={!scheduleEnabled}
                                aria-label={`เวลาส่งรอบที่ ${index + 1}`}
                                className="min-w-0 flex-1 bg-transparent text-sm font-bold text-slate-700 outline-none disabled:opacity-50"
                              />
                              <button
                                type="button"
                                onClick={() => removeScheduleTimeSlot(index)}
                                disabled={!scheduleEnabled || scheduleTimes.length <= 1}
                                aria-label={`ลบรอบที่ ${index + 1}`}
                                className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-500 disabled:cursor-not-allowed disabled:opacity-30"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                        <button
                          type="button"
                          onClick={addScheduleTimeSlot}
                          disabled={!scheduleEnabled || scheduleTimes.length >= MAX_SCHEDULE_TIMES}
                          className={cn(
                            'mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-300 py-2 text-xs font-bold text-slate-600 transition-colors hover:border-slate-400 hover:bg-slate-50',
                            (!scheduleEnabled || scheduleTimes.length >= MAX_SCHEDULE_TIMES) && 'cursor-not-allowed opacity-50',
                          )}
                        >
                          <Plus size={14} />
                          เพิ่มรอบส่ง
                        </button>
                        <p className="mt-1.5 text-[10px] leading-relaxed text-slate-400">
                          แต่ละรอบส่งรายงาน 1 ครั้งต่อวัน — ตั้งได้สูงสุด {MAX_SCHEDULE_TIMES} รอบ
                        </p>
                      </div>

                      <div className="mt-4">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <label className="text-xs font-bold text-slate-500">
                            ผู้รับที่จะส่ง
                          </label>
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black text-emerald-700">
                            {scheduleEligibleRecipients.length}/{scheduleLineRecipients.length} เปิด
                          </span>
                        </div>

                        {loadingRecipients ? (
                          <div className="flex items-center justify-center rounded-xl border border-slate-100 bg-slate-50 py-8">
                            <Loader2 size={20} className="animate-spin text-slate-400" />
                          </div>
                        ) : scheduleLineRecipients.length === 0 ? (
                          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-center">
                            <p className="text-xs font-bold text-slate-500">ยังไม่มีผู้ใช้ที่เชื่อม LINE</p>
                            <p className="mt-1 text-[11px] text-slate-400">ผู้รับต้องเชื่อม LINE OA ก่อนจึงจะส่งอัตโนมัติได้</p>
                          </div>
                        ) : (
                          <div className={cn('space-y-2 rounded-xl border border-slate-100 bg-slate-50/80 p-2', RECIPIENT_LIST_SCROLL_CLASS)}>
                            {scheduleLineRecipients.map(r => {
                              const isSelected = scheduleRecipientUidSet.has(r.uid);
                              return (
                                <div
                                  key={r.uid}
                                  className={cn(
                                    'flex items-center justify-between rounded-xl border bg-white px-3 py-2.5 shadow-sm transition-colors',
                                    isSelected ? 'border-emerald-200' : 'border-slate-200',
                                  )}
                                >
                                  <div className="flex min-w-0 items-center gap-2">
                                    <Avatar className="h-8 w-8 shrink-0">
                                      <AvatarImage src={r.photoURL} alt={r.displayName} />
                                      <AvatarFallback className="bg-[#06c755] text-xs font-black text-white">
                                        {r.displayName.slice(0, 1)}
                                      </AvatarFallback>
                                    </Avatar>
                                    <div className="min-w-0">
                                      <p className="truncate text-sm font-bold text-slate-700">{r.displayName}</p>
                                      <span className={cn(
                                        'mt-0.5 inline-flex rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide',
                                        roleBadgeClass(r.role),
                                      )}>
                                        {roleLabel(r.role)}
                                      </span>
                                      <p className="text-[10px] font-semibold text-[#06c755]">✓ เชื่อม LINE แล้ว</p>
                                    </div>
                                  </div>
                                  <div
                                    role="switch"
                                    aria-checked={isSelected}
                                    aria-label={`${isSelected ? 'ยกเลิก' : 'เลือก'} ${r.displayName}`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleScheduleRecipient(r.uid);
                                    }}
                                    className={cn(
                                      'relative z-10 h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors duration-200',
                                      isSelected ? 'bg-[#06c755]' : 'bg-slate-300',
                                    )}
                                  >
                                    <div
                                      className="pointer-events-none absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-all duration-200"
                                      style={{ left: isSelected ? '18px' : '2px' }}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {scheduleUpdatedAt && (
                          <p className="mt-2 text-[10px] text-slate-400">
                            บันทึกการตั้งค่าล่าสุด{' '}
                            {scheduleUpdatedAt.toLocaleString('th-TH', {
                              day: 'numeric',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        )}
                        {scheduleLastSentTimes.length > 0 && (
                          <p className="mt-1 text-[10px] font-semibold text-emerald-600">
                            ส่งอัตโนมัติแล้ววันนี้: {formatScheduleTimesLabel(scheduleLastSentTimes)}
                            {scheduleLastSentAt
                              ? ` · ล่าสุด ${scheduleLastSentAt.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.`
                              : ''}
                          </p>
                        )}
                        {scheduleEnabled && schedulePendingTimesToday.length > 0 && (
                          <p className="mt-1 text-[10px] font-semibold text-blue-600">
                            รอบถัดไปวันนี้: {formatScheduleTimesLabel(schedulePendingTimesToday)}
                          </p>
                        )}
                        {isSysAdmin && (scheduleLastSentTimes.length > 0 || scheduleLastSentDate === todayIso) && (
                          <button
                            type="button"
                            onClick={handleResetTodayScheduleSlots}
                            disabled={scheduleSlotResetStatus === 'saving'}
                            className="mt-2 w-full rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-bold text-amber-800 transition-colors hover:bg-amber-100 disabled:opacity-60"
                          >
                            {scheduleSlotResetStatus === 'saving' && 'กำลังล้าง...'}
                            {scheduleSlotResetStatus === 'success' && 'ล้างแล้ว — รอบถัดไปจะส่งตามเวลา'}
                            {scheduleSlotResetStatus === 'idle' && 'ล้างรอบที่ส่งแล้ววันนี้ (ให้ส่งอัตโนมัติซ้ำตามเวลาที่ตั้ง)'}
                            {scheduleSlotResetStatus === 'error' && 'ล้างไม่สำเร็จ — ลองอีกครั้ง'}
                          </button>
                        )}
                        {scheduleLastSentDate && scheduleLastSentDate !== todayIso && (
                          <p className="mt-1 text-[10px] text-slate-400">
                            ส่งล่าสุดเมื่อวันที่ {scheduleLastSentDate}
                          </p>
                        )}
                        {scheduleLastError && (
                          <p className="mt-1 text-[10px] font-semibold text-rose-600">
                            ส่งอัตโนมัติล่าสุดไม่สำเร็จ: {scheduleLastError === 'no recipients with LINE linked'
                              ? 'ไม่พบผู้รับที่เชื่อม LINE — กรุณาเลือกผู้รับแล้วกดบันทึกอีกครั้ง'
                              : scheduleLastError}
                          </p>
                        )}
                      </div>

                      <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
                        ส่งอัตโนมัติทุกวัน {formatScheduleTimesLabel(normalizedScheduleTimes)} (เวลาไทย)
                        — กด「บันทึกการตั้งเวลาส่ง」หลังเปลี่ยนรอบ/ผู้รับ · ปุ่มด้านล่างส่งมือได้โดยไม่กระทบรอบอัตโนมัติ
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleSendScheduledNow}
                      disabled={scheduleResendStatus === 'saving' || isLoading}
                      className={cn(
                        'w-full rounded-xl border border-slate-300 bg-white py-2.5 text-sm font-bold text-slate-700 transition-all hover:bg-slate-50',
                        (scheduleResendStatus === 'saving' || isLoading) && 'cursor-not-allowed opacity-60',
                      )}
                    >
                      <span className="flex items-center justify-center gap-2">
                        {scheduleResendStatus === 'saving' && <Loader2 size={15} className="animate-spin" />}
                        {scheduleResendStatus === 'success' && <CheckCircle2 size={15} className="text-emerald-500" />}
                        {scheduleResendStatus === 'error' && <AlertCircle size={15} className="text-rose-500" />}
                        {scheduleResendStatus === 'saving' && 'กำลังส่ง...'}
                        {scheduleResendStatus === 'success' && 'ส่งซ้ำสำเร็จ'}
                        {scheduleResendStatus === 'error' && 'ส่งซ้ำไม่สำเร็จ'}
                        {scheduleResendStatus === 'idle' && `ส่งรายงานตอนนี้ (ซ้ำได้ · ${scheduleEligibleRecipients.length} คน)`}
                      </span>
                    </button>

                    <AnimatePresence>
                      {scheduleResendStatus === 'error' && scheduleResendError && (
                        <motion.p
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          className="text-center text-xs font-semibold text-rose-600"
                        >
                          {scheduleResendError}
                        </motion.p>
                      )}
                    </AnimatePresence>

                    <button
                      type="button"
                      onClick={handleSaveSchedule}
                      disabled={scheduleSaveStatus === 'saving'}
                      className={cn(
                        'w-full rounded-xl py-2.5 text-sm font-bold text-white transition-all',
                        scheduleSaveStatus === 'success'
                          ? 'bg-emerald-500'
                          : scheduleSaveStatus === 'error'
                            ? 'bg-rose-500'
                            : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700',
                        scheduleSaveStatus === 'saving' && 'cursor-not-allowed opacity-80',
                      )}
                    >
                      <span className="flex items-center justify-center gap-2">
                        {scheduleSaveStatus === 'saving' && <Loader2 size={15} className="animate-spin" />}
                        {scheduleSaveStatus === 'success' && <CheckCircle2 size={15} />}
                        {scheduleSaveStatus === 'error' && <AlertCircle size={15} />}
                        {scheduleSaveStatus === 'saving' && 'กำลังบันทึก...'}
                        {scheduleSaveStatus === 'success' && 'บันทึกแล้ว'}
                        {scheduleSaveStatus === 'error' && 'บันทึกไม่สำเร็จ'}
                        {scheduleSaveStatus === 'idle' && 'บันทึกการตั้งเวลาส่ง'}
                      </span>
                    </button>

                    <AnimatePresence>
                      {scheduleSaveStatus === 'error' && scheduleSaveError && (
                        <motion.p
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          className="text-center text-xs font-semibold text-rose-600"
                        >
                          {scheduleSaveError}
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
