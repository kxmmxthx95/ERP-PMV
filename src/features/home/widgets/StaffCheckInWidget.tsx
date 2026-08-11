import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  HiMapPin,
  HiCheckCircle,
  HiArrowRightOnRectangle,
  HiClipboardDocumentList,
  HiClipboardDocumentCheck,
  HiAcademicCap,
  HiCheck,
  HiUser,
  HiXMark,
  HiChatBubbleLeftRight,
} from 'react-icons/hi2';
import { useAuth } from '@/hooks/useAuth';
import {
  formatShiftEndLabel,
  isAtOrAfterShiftEnd,
  useStaffAttendance,
} from '@/hooks/useStaffAttendance';
import { useAttendanceConfig } from '@/hooks/useAttendanceConfig';
import { useTeachersCollection } from '@/hooks/useTeachersCollection';
import { resolveTeacherFromAuth } from '@/lib/teachers/teacherIdentity';
import { isSpecialTeacherPosition } from '@/lib/staffAttendance/specialTeacher';
import {
  useMyLeaveRequests,
  useStudentLeaveRequests,
} from '@/hooks/useLeaveRequests';
import { useTeacherDailyTasks } from '@/hooks/useTeacherDailyTasks';
import { useIsSchoolDayToday } from '@/hooks/useIsSchoolDayToday';
import { useThaiHolidays } from '@/features/calendar/hooks/useThaiHolidays';
import { useActiveAcademicYear } from '@/hooks/useActiveAcademicYear';
import { useLeaveRequesterClassMap } from '@/features/leave/hooks/useLeaveRequesterClassMap';
import { getGradeLevelBadgeStyle } from '@/lib/school/gradeLevelBadge';
import { DEPARTMENT_CONFIG, type Department } from '@/types/curriculum';
import { ROLE_LABELS } from '@/types/mockUsers';
import { WIDGET_CARD, WIDGET_GLASS, getDayCandyBoxShadow, type DayCandyStyle } from '../widgetStyles';
import { WidgetSkeleton } from '../components/WidgetSkeleton';
import { cn } from '@/lib/utils';
import { formatThaiDateLabel, getLocalDateString } from '@/lib/dateUtils';
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { LineConnectDialog } from '@/features/profile/LineConnectDialog';
import type { LeaveType } from '@/types/leave';
import {
  EMPTY_PERSONAL_STATS,
  loadPersonalAttendanceStats,
  type PersonalStatsSummary,
} from '@/lib/staffAttendance/personalStats';
import PersonalAttendanceCalendarPanel from './PersonalAttendanceCalendarPanel';
import { TeacherDailyTasksPanel } from './TeacherDailyTasksPanel';

const CheckInIcon = HiMapPin;
const CheckOutIcon = HiArrowRightOnRectangle;
const DoneIcon = HiCheckCircle;
const LeaveIcon = HiClipboardDocumentList;
const SuccessIcon = HiCheck;

const LEAVE_TYPE_LABEL_SHORT: Record<LeaveType, string> = { sick: 'ป่วย', personal: 'กิจ' };

const PERSONNEL_ID_CARD_SURFACE: CSSProperties = {
  background: 'linear-gradient(145deg, #1d4ed8 0%, #2563eb 42%, #60a5fa 100%)',
};

const PERSONNEL_ID_CARD_WAVE: CSSProperties = {
  backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="140" height="90" viewBox="0 0 140 90">
  <path d="M-10 52 C25 28, 45 28, 70 52 S115 76, 150 52" fill="none" stroke="rgba(255,255,255,0.16)" stroke-width="1.1"/>
  <path d="M-10 68 C30 44, 50 44, 75 68 S120 92, 150 68" fill="none" stroke="rgba(255,255,255,0.10)" stroke-width="0.9"/>
  <path d="M10 22 C28 8, 38 8, 52 22 S76 36, 94 22" fill="none" stroke="rgba(255,255,255,0.14)" stroke-width="1"/>
</svg>
`.trim())}")`,
  backgroundSize: '140px 90px',
  backgroundRepeat: 'repeat',
};

function StaffPersonnelIdCard({
  fullName,
  departmentLabel,
  positionLabel,
  roleLabel,
  email,
  phone,
  photoUrl,
  isLineConnected,
  onLineConnectClick,
  onClose,
}: {
  fullName: string;
  departmentLabel: string;
  positionLabel: string;
  roleLabel: string;
  email: string;
  phone: string;
  photoUrl: string | null;
  isLineConnected: boolean;
  onLineConnectClick?: () => void;
  onClose: () => void;
}) {
  const subtitle = [departmentLabel, positionLabel].filter(Boolean).join(' · ');

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-2xl p-3" style={PERSONNEL_ID_CARD_SURFACE}>
      <div className="pointer-events-none absolute inset-0 opacity-90" style={PERSONNEL_ID_CARD_WAVE} aria-hidden />
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="absolute right-2 top-2 z-[2] flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white backdrop-blur-sm transition-colors hover:bg-white/20"
        aria-label="ปิดบัตร"
        title="ปิด"
      >
        <HiXMark size={14} />
      </button>

      <div className="relative z-[1] flex min-h-0 flex-1 flex-col">
        <div className="pr-8">
          <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/75">PMV-ONE</p>
          <p className="mt-0.5 text-[11px] font-bold text-white/90 font-sukhumvit">บัตรประจำตัวบุคลากร</p>
        </div>

        <div className="mt-3 flex flex-col items-center text-center">
          {photoUrl ? (
            <img src={photoUrl} alt="" className="h-16 w-16 shrink-0 rounded-full border-2 border-white/40 object-cover" />
          ) : (
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-2 border-white/30 bg-white/10 text-white">
              <HiUser className="h-8 w-8" aria-hidden />
            </div>
          )}
          <p className="mt-2 max-w-full truncate px-2 text-[14px] font-black leading-tight text-white font-sukhumvit">{fullName}</p>
          {subtitle ? (
            <p className="mt-0.5 max-w-full truncate px-2 text-[10px] font-bold text-white/80 font-sukhumvit">{subtitle}</p>
          ) : null}
          {roleLabel ? (
            <span className="mt-1 inline-flex rounded-full border border-white/25 bg-white/15 px-2 py-0.5 text-[9px] font-black text-white backdrop-blur-sm">
              {roleLabel}
            </span>
          ) : null}
        </div>

        <div className="mt-auto space-y-1 rounded-xl border border-white/20 bg-white/10 px-3 py-2 backdrop-blur-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="shrink-0 text-[10px] font-bold text-white/65 font-sukhumvit">อีเมล</span>
            <span className="truncate text-[10px] font-black text-white font-sukhumvit">{email || '—'}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="shrink-0 text-[10px] font-bold text-white/65 font-sukhumvit">เบอร์โทร</span>
            <span className="text-[10px] font-black text-white tabular-nums font-sukhumvit">{phone || '—'}</span>
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-white/15 pt-1">
            <span className="shrink-0 text-[10px] font-bold text-white/65 font-sukhumvit">LINE</span>
            {isLineConnected ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#06c755] px-2 py-0.5 text-[9px] font-black text-white">
                <HiCheck className="h-3 w-3" strokeWidth={2.5} />
                เชื่อมแล้ว
              </span>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onLineConnectClick?.();
                }}
                className="inline-flex items-center gap-1 rounded-full border border-white/30 bg-white/15 px-2 py-0.5 text-[9px] font-black text-white backdrop-blur-sm transition-colors hover:bg-white/25"
              >
                <HiChatBubbleLeftRight className="h-3 w-3" />
                เชื่อม LINE
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function LeaveDepartmentBadge({ departmentId }: { departmentId: Department }) {
  const cfg = DEPARTMENT_CONFIG[departmentId];
  return (
    <span
      className="inline-flex shrink-0 items-center rounded-md px-1.5 py-0.5 text-[10px] font-black"
      style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}` }}
    >
      {cfg.label}
    </span>
  );
}

function LeaveClassroomBadge({ className, gradeLevel }: { className: string; gradeLevel: string }) {
  const style = getGradeLevelBadgeStyle(gradeLevel || className.split('/')[0] || className);
  return (
    <span
      className="inline-flex shrink-0 items-center rounded-md px-1.5 py-0.5 text-[10px] font-black"
      style={{ color: style.color, backgroundColor: style.bg, border: `1px solid ${style.border}` }}
    >
      {className}
    </span>
  );
}

function fmt(ts: any): string {
  if (!ts) return '--:--';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
}

function PersonalStatsGrid({ stats, loading }: { stats: PersonalStatsSummary; loading?: boolean }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
          <p className="text-[10px] font-bold text-emerald-600">มา</p>
          <p className="text-lg font-black text-emerald-700">{loading ? '…' : stats.present}</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
          <p className="text-[10px] font-bold text-amber-600">สาย</p>
          <p className="text-lg font-black text-amber-700">{loading ? '…' : stats.late}</p>
        </div>
        <div className="rounded-xl border border-[#F22C07] bg-[#F22C07]/10 px-3 py-2">
          <p className="text-[10px] font-bold text-[#F22C07]">ขาด</p>
          <p className="text-lg font-black text-[#F22C07]">{loading ? '…' : stats.absent}</p>
        </div>
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2">
          <p className="text-[10px] font-bold text-blue-600">ลา</p>
          <p className="text-lg font-black text-blue-700">{loading ? '…' : stats.leave}</p>
        </div>
      </div>
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
        <p className="text-[11px] text-slate-500">สรุปรวม</p>
        <p className="text-xl font-black text-slate-800">{loading ? '…' : `${stats.total} รายการ`}</p>
      </div>
    </>
  );
}

function CurrentTimeClock({ lightText = false }: { lightText?: boolean }) {
  const [currentTime, setCurrentTime] = useState('');

  useEffect(() => {
    const update = () => {
      const d = new Date();
      const h = d.getHours().toString().padStart(2, '0');
      const m = d.getMinutes().toString().padStart(2, '0');
      const s = d.getSeconds().toString().padStart(2, '0');
      setCurrentTime(`${h}:${m}:${s}`);
    };

    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <span className={cn(
      'font-mono tabular-nums text-xl font-black tracking-tighter font-sukhumvit',
      lightText ? 'text-white' : 'text-slate-900',
    )}>
      {currentTime}
    </span>
  );
}

function CountdownToFiveAM({ lightText = false }: { lightText?: boolean }) {
  const [timeLeft, setTimeLeft] = useState('00:00:00');

  useEffect(() => {
    const update = () => {
      const now = new Date();
      const target = new Date(now);
      target.setHours(5, 0, 0, 0);
      if (now.getTime() >= target.getTime()) {
        target.setDate(target.getDate() + 1);
      }

      const diffMs = Math.max(0, target.getTime() - now.getTime());
      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);
      setTimeLeft(
        `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`,
      );
    };

    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <span className={cn(
      'font-mono tabular-nums text-xl font-black tracking-tighter',
      lightText ? 'text-white' : 'text-slate-900',
    )}>
      {timeLeft}
    </span>
  );
}

// ── Quick action circular button — shared shape for all 4 widget buttons ──────
type QuickActionTone = 'neutral' | 'primary' | 'danger' | 'success';

const QUICK_ACTION_TONE_CLASS: Record<QuickActionTone, string> = {
  neutral: 'bg-slate-100 text-slate-600 hover:bg-slate-200',
  primary: 'bg-blue-600 text-white shadow-md hover:bg-blue-700',
  danger: 'bg-[#ef4444] text-white shadow-md hover:bg-red-600',
  success: 'bg-emerald-50 text-emerald-600',
};

function QuickActionButton({
  icon,
  onClick,
  title,
  disabled = false,
  loading = false,
  badge = 0,
  tone = 'neutral',
}: {
  icon: ReactNode;
  onClick?: () => void;
  title: string;
  disabled?: boolean;
  loading?: boolean;
  badge?: number;
  tone?: QuickActionTone;
}) {
  return (
    <motion.button
      type="button"
      whileTap={disabled ? undefined : { scale: 0.9 }}
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled) onClick?.();
      }}
      disabled={disabled}
      title={title}
      aria-label={title}
      className={cn(
        'relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-all disabled:opacity-40',
        QUICK_ACTION_TONE_CLASS[tone],
      )}
    >
      {loading ? (
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent opacity-70" />
      ) : icon}
      {badge > 0 && (
        <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-black text-white">
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </motion.button>
  );
}

// ── Button 3 — จัดการลา: รายชื่อนักเรียนที่รอพิจารณา ─────────────────────────
function StudentLeaveQuickAction() {
  const { user, userData } = useAuth();
  const { year } = useActiveAcademicYear();
  const [open, setOpen] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);
  const sinceDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 90);
    return getLocalDateString(d);
  }, []);
  const { requests, loading, updateStatus } = useStudentLeaveRequests(sinceDate);

  const pendingRequests = useMemo(() => {
    return requests
      .filter((r) => r.status === 'pending')
      .sort((a, b) => {
        const aMs = (a.createdAt as any)?.toMillis?.() ?? 0;
        const bMs = (b.createdAt as any)?.toMillis?.() ?? 0;
        return bMs - aMs;
      });
  }, [requests]);

  const requesterIds = useMemo(
    () => pendingRequests.map((r) => r.requesterId).filter(Boolean),
    [pendingRequests],
  );
  const requesterStudentCodes = useMemo(
    () => Object.fromEntries(
      pendingRequests
        .map((r) => [r.requesterId, String(r.requesterStudentCode ?? '').trim()] as const)
        .filter((entry): entry is [string, string] => Boolean(entry[1])),
    ),
    [pendingRequests],
  );
  const requesterClassMap = useLeaveRequesterClassMap(year, requesterIds, requesterStudentCodes);

  const pendingCount = pendingRequests.length;
  const approverName = userData?.name || userData?.displayName || userData?.fullName || userData?.email || 'ผู้ใช้';

  const handleAct = async (id: string, status: 'approved' | 'rejected') => {
    setActingId(id);
    try {
      await updateStatus(id, status, undefined, user?.uid ?? '', approverName);
    } finally {
      setActingId(null);
    }
  };

  return (
    <>
      <QuickActionButton
        title="จัดการลานักเรียน"
        icon={<HiClipboardDocumentCheck className="w-5 h-5" />}
        badge={pendingCount}
        onClick={() => setOpen(true)}
      />

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent className="max-h-[85vh] overflow-hidden">
          <DrawerHeader className="px-4 pb-2 text-left">
            <DrawerTitle className="text-base font-black text-slate-800">นักเรียนที่ลา</DrawerTitle>
            <DrawerDescription className="text-xs text-slate-500">
              รายชื่อนักเรียนที่รอพิจารณา
            </DrawerDescription>
          </DrawerHeader>

          <div className="px-4 pb-4 overflow-y-auto space-y-2">
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <div className="w-6 h-6 border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
              </div>
            ) : pendingRequests.length === 0 ? (
              <p className="text-center text-sm font-bold text-slate-400 py-10">ไม่มีคำขอลารอพิจารณา</p>
            ) : (
              pendingRequests.map((req) => {
                const requesterProfile = requesterClassMap.get(req.requesterId);
                return (
                <div key={req.id} className="rounded-2xl border border-slate-200 bg-white p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[13px] font-black text-slate-800 truncate">{req.requesterName || '—'}</p>
                      {req.requesterStudentCode ? (
                        <p className="text-[11px] font-bold text-primary tabular-nums mt-0.5">
                          รหัส {req.requesterStudentCode}
                        </p>
                      ) : null}
                      {requesterProfile && (requesterProfile.departmentId || requesterProfile.className) ? (
                        <div className="mt-1 flex flex-wrap items-center gap-1">
                          {requesterProfile.departmentId ? (
                            <LeaveDepartmentBadge departmentId={requesterProfile.departmentId} />
                          ) : null}
                          {requesterProfile.className ? (
                            <LeaveClassroomBadge
                              className={requesterProfile.className}
                              gradeLevel={requesterProfile.gradeLevel}
                            />
                          ) : null}
                        </div>
                      ) : null}
                      <p className="text-[11px] font-bold text-slate-400 mt-0.5">
                        ลา{LEAVE_TYPE_LABEL_SHORT[req.leaveType]} ·{' '}
                        {req.startDate === req.endDate ? req.startDate : `${req.startDate} – ${req.endDate}`}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-lg bg-amber-50 px-2 py-0.5 text-[10px] font-black text-amber-600">
                      รอพิจารณา
                    </span>
                  </div>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      disabled={actingId === req.id}
                      onClick={() => handleAct(req.id, 'approved')}
                      className="flex-1 h-8 rounded-lg bg-emerald-50 text-[11px] font-black text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 transition-colors"
                    >
                      อนุมัติ
                    </button>
                    <button
                      type="button"
                      disabled={actingId === req.id}
                      onClick={() => handleAct(req.id, 'rejected')}
                      className="flex-1 h-8 rounded-lg bg-rose-50 text-[11px] font-black text-rose-700 hover:bg-rose-100 disabled:opacity-50 transition-colors"
                    >
                      ไม่อนุมัติ
                    </button>
                  </div>
                </div>
              );
              })
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}

// ── Button 4 — งานประจำวันครู: quick view of today's teaching tasks ───────────
function TeacherDailyTaskQuickAction() {
  const [open, setOpen] = useState(false);
  const {
    today,
    loading,
    rollCallStats,
    classStats,
    reflectionStats,
  } = useTeacherDailyTasks();
  const { isHoliday: isBlocked } = useIsSchoolDayToday('teacher', today);

  const pendingTotal = rollCallStats.pending + classStats.pending + reflectionStats.pending;
  // ตอนโหลด sessions ยังไม่มา → นับ pending ทั้งก้อนผิด — ค้างเลขรอบก่อนไว้จนกว่าโหลดจบ
  const settledPendingRef = useRef<number | null>(null);
  if (!loading) settledPendingRef.current = pendingTotal;
  const displayPending = isBlocked
    ? 0
    : loading
      ? (settledPendingRef.current ?? 0)
      : pendingTotal;

  return (
    <>
      <QuickActionButton
        title="งานประจำวันครู"
        icon={<HiAcademicCap className="w-5 h-5" />}
        badge={displayPending}
        onClick={() => setOpen(true)}
      />
      <TeacherDailyTasksPanel open={open} onOpenChange={setOpen} />
    </>
  );
}

export default function StaffCheckInWidget() {
  const { user, userData, role } = useAuth();
  const { config } = useAttendanceConfig();
  const { teachers } = useTeachersCollection();
  const uid = user?.uid ?? '';
  const displayName = userData?.name || userData?.displayName || user?.displayName || user?.email || 'บุคลากร';
  const personName = userData?.firstName
    ? [userData.firstName, userData.lastName].filter(Boolean).join(' ')
    : displayName;
  const photoUrl = userData?.photoURL || null;
  const teacherProfile = uid ? resolveTeacherFromAuth(uid, teachers) : null;
  const isSpecialTeacher = isSpecialTeacherPosition(teacherProfile?.position);
  const isTeacherRole = role === 'teacher';

  // Fetch Thai public holidays
  const currentYear = new Date().getFullYear();
  const { holidays: thaiHolidays } = useThaiHolidays(currentYear);
  const { year } = useActiveAcademicYear();

  const { todayRecord, actionLoading, error, checkIn, checkOut, isHoliday, loading: attendanceLoading } = useStaffAttendance(
    uid,
    displayName,
    config,
    thaiHolidays,
    year ?? undefined,
    isSpecialTeacher,
  );
  const myLeave = useMyLeaveRequests(uid, 'staff');

  const [profileCardOpen, setProfileCardOpen] = useState(false);
  const [lineModalOpen, setLineModalOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  const todayStr = getLocalDateString(now);
  const isTodayOnLeave = myLeave.requests.some(req => 
    req.status === 'approved' && 
    req.startDate <= todayStr && 
    req.endDate >= todayStr
  );

  const [geofencePopupOpen, setGeofencePopupOpen] = useState(false);
  const [geofenceMessage, setGeofenceMessage] = useState('');
  const [errorPopupOpen, setErrorPopupOpen] = useState(false);
  const [errorPopupMessage, setErrorPopupMessage] = useState('');
  const [successPopupOpen, setSuccessPopupOpen] = useState(false);
  const [successPopupMessage, setSuccessPopupMessage] = useState('');
  const [personalStatsOpen, setPersonalStatsOpen] = useState(false);
  const [personalStatsFromCheckIn, setPersonalStatsFromCheckIn] = useState(false);
  const [personalStats, setPersonalStats] = useState<PersonalStatsSummary>(EMPTY_PERSONAL_STATS);
  const [personalStatsLoading, setPersonalStatsLoading] = useState(false);
  const [attendanceExpanded, setAttendanceExpanded] = useState(false);
  /** Keep expanded shell until calendar exit finishes — avoids snap/flicker on collapse. */
  const [attendanceClosing, setAttendanceClosing] = useState(false);
  const attendanceShellOpen = attendanceExpanded || attendanceClosing;
  const initializedRef = useRef(false);
  const prevCheckInRef = useRef<boolean>(false);
  const prevCheckOutRef = useRef<boolean>(false);
  const prevAdminOverrideRef = useRef(false);
  const pendingSuccessActionRef = useRef<'checkin' | 'checkout' | null>(null);

  const isCheckedInStatus = todayRecord?.status === 'present' || todayRecord?.status === 'late';
  const isAdminOverride = !!todayRecord?.overrideBy && isCheckedInStatus;
  const checked = !!todayRecord?.checkInTime || isAdminOverride;
  const checkedOut = !!todayRecord?.checkOutTime;
  const checkoutTimeReached = isAtOrAfterShiftEnd(now, config);
  const shiftEndLabel = formatShiftEndLabel(config);
  const showAdminBadge = isAdminOverride && !checkedOut;
  const showPostCheckoutCountdown = checked && checkedOut;
  const isOutsideSchoolAreaError = !!error && error.includes('นอกพื้นที่โรงเรียน');
  const isCheckoutSuccess = successPopupMessage.includes('เช็คเอาต์') || successPopupMessage.includes('เช็คเอ้าท์');

  // เฉพาะสถานะ 'absent' ที่ถูกบันทึกจริง (เช่น แอดมิน override) เท่านั้นที่ซ่อนปุ่มเช็คอิน —
  // ห้ามใช้ resolveStaffAttendanceDisplay (ออกแบบไว้สรุปวันที่ปิดแล้วในรายงานย้อนหลัง) กับวันนี้แบบเรียลไทม์
  // เพราะมันตีความ "ยังไม่เช็คอิน" เป็น "ขาดงาน" ทันที ทำให้ปุ่มเช็คอินหายไปตลอดทั้งวันก่อนเช็คอิน
  const isAbsentFromWork = !isTodayOnLeave && !checked && todayRecord?.status === 'absent';

  const todayDateLabel = useMemo(() => {
    const full = formatThaiDateLabel(now);
    const spaceIdx = full.indexOf(' ');
    return spaceIdx === -1 ? full : `${full.slice(0, spaceIdx)} • ${full.slice(spaceIdx + 1)}`;
  }, [now]);

  const fullDisplayName = useMemo(() => {
    if (userData?.firstName) {
      return `${userData.prefix || ''}${userData.firstName} ${userData.lastName || ''}`.trim();
    }
    return displayName;
  }, [userData?.firstName, userData?.lastName, userData?.prefix, displayName]);

  const departmentLabel = useMemo(() => {
    const dept = teacherProfile?.department
      ?? (typeof userData?.department === 'string' ? userData.department as Department : undefined);
    return dept && dept in DEPARTMENT_CONFIG ? DEPARTMENT_CONFIG[dept as Department].label : '';
  }, [teacherProfile?.department, userData?.department]);

  const roleLabel = ROLE_LABELS[role ?? '']?.label ?? role ?? '';
  const profileEmail = user?.email || userData?.email || '';
  const profilePhone = userData?.phone || teacherProfile?.phone || '';
  const profilePosition = teacherProfile?.position || '';
  const isLineConnected = Boolean(String(userData?.lineUid || userData?.lineToken || '').trim());

  const refreshPersonalStats = useCallback(async () => {
    if (!uid) {
      setPersonalStats(EMPTY_PERSONAL_STATS);
      return;
    }
    setPersonalStatsLoading(true);
    try {
      const stats = await loadPersonalAttendanceStats(uid, myLeave.requests, isSpecialTeacher);
      setPersonalStats(stats);
    } catch {
      setPersonalStats(EMPTY_PERSONAL_STATS);
    } finally {
      setPersonalStatsLoading(false);
    }
  }, [uid, myLeave.requests, isSpecialTeacher]);

  const openPersonalStats = (fromCheckIn: boolean) => {
    setPersonalStatsFromCheckIn(fromCheckIn);
    setPersonalStatsOpen(true);
    void refreshPersonalStats();
  };

  useEffect(() => {
    if (profileCardOpen) setAttendanceExpanded(false);
  }, [profileCardOpen]);

  useEffect(() => {
    if (!personalStatsOpen) return;
    void refreshPersonalStats();
  }, [personalStatsOpen, todayRecord?.checkInTime, todayRecord?.checkOutTime, todayRecord?.status, refreshPersonalStats]);

  useEffect(() => {
    if (isOutsideSchoolAreaError && error) {
      setGeofenceMessage(error);
      setGeofencePopupOpen(true);
    }
  }, [error, isOutsideSchoolAreaError]);

  useEffect(() => {
    if (error && !isOutsideSchoolAreaError) {
      setErrorPopupMessage(error);
      setErrorPopupOpen(true);
    }
  }, [error, isOutsideSchoolAreaError]);

  useEffect(() => {
    const hasCheckIn = !!todayRecord?.checkInTime;
    const hasCheckOut = !!todayRecord?.checkOutTime;
    const hasAdminOverride = isAdminOverride && hasCheckIn && !hasCheckOut;

    if (!initializedRef.current) {
      prevCheckInRef.current = hasCheckIn;
      prevCheckOutRef.current = hasCheckOut;
      prevAdminOverrideRef.current = hasAdminOverride;
      initializedRef.current = true;
      return;
    }

    if (pendingSuccessActionRef.current === 'checkin' && !prevCheckInRef.current && hasCheckIn) {
      openPersonalStats(true);
      pendingSuccessActionRef.current = null;
    }

    if (pendingSuccessActionRef.current === 'checkout' && !prevCheckOutRef.current && hasCheckOut) {
      setSuccessPopupMessage('เช็คเอาต์สำเร็จ');
      setSuccessPopupOpen(true);
      pendingSuccessActionRef.current = null;
    }

    if (!prevAdminOverrideRef.current && hasAdminOverride) {
      setSuccessPopupMessage('แอดมินบันทึกเวลาเข้าให้แล้ว');
      setSuccessPopupOpen(true);
    }

    prevCheckInRef.current = hasCheckIn;
    prevCheckOutRef.current = hasCheckOut;
    prevAdminOverrideRef.current = hasAdminOverride;
  }, [todayRecord?.checkInTime, todayRecord?.checkOutTime, isAdminOverride]);

  const absentCardStyle: DayCandyStyle = {
    background: 'linear-gradient(to right, #EF4444 0%, #FF8A82 100%)',
    border: '1.5px solid rgba(255,255,255,0.55)',
    glow: 'rgba(239, 68, 68, 0.4)',
  };
  const useLightText = isAbsentFromWork;

  // Button 1 — check-in / check-out state (icon, tone, action)
  const checkButtonConfig = isTodayOnLeave
    ? { icon: <LeaveIcon className="w-5 h-5" />, tone: 'neutral' as const, title: 'วันนี้คุณลา', disabled: true }
    : isAbsentFromWork
      ? { icon: <HiXMark className="w-5 h-5" />, tone: 'danger' as const, title: 'ขาดงาน', disabled: true }
      : !checked
        ? {
            icon: <CheckInIcon className="w-5 h-5" />,
            tone: 'primary' as const,
            title: 'เช็คอิน',
            disabled: actionLoading,
            onClick: () => {
              pendingSuccessActionRef.current = 'checkin';
              checkIn();
            },
          }
        : !checkedOut
          ? {
              icon: <CheckOutIcon className="w-5 h-5" />,
              tone: (checkoutTimeReached ? 'danger' : 'neutral') as QuickActionTone,
              title: checkoutTimeReached ? 'เช็คเอาต์' : `เช็คเอาต์ได้หลัง ${shiftEndLabel} น.`,
              disabled: actionLoading || !checkoutTimeReached,
              onClick: () => {
                pendingSuccessActionRef.current = 'checkout';
                checkOut();
              },
            }
          : { icon: <DoneIcon className="w-5 h-5" />, tone: 'success' as const, title: 'เช็คอินสำเร็จวันนี้', disabled: true };

  if (attendanceLoading || myLeave.loading) {
    return <WidgetSkeleton variant="staff" />;
  }

  return (
    <>
      <div
        style={
          profileCardOpen
            ? undefined
            : isAbsentFromWork
              ? { ...absentCardStyle, boxShadow: getDayCandyBoxShadow(absentCardStyle.glow) }
              : WIDGET_GLASS
        }
        className={cn(
          'rounded-2xl flex flex-col w-full overflow-hidden relative',
          profileCardOpen
            ? 'h-[300px] p-0'
            : attendanceShellOpen
              ? 'h-auto min-h-[142px] gap-0 p-0 pl-3'
              : cn(WIDGET_CARD, !showPostCheckoutCountdown && 'gap-0 p-0 pl-3'),
        )}
      >
        {!profileCardOpen && showAdminBadge && (
          <span className="absolute top-1.5 right-1.5 z-10 flex items-center gap-1 rounded-full bg-amber-400 px-1.5 py-0.5 text-[8px] font-black text-amber-950 shadow-sm">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-200 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-100" />
            </span>
            แอดมินเช็คให้
          </span>
        )}
        <motion.div
          key={profileCardOpen ? 'profile-card' : 'default'}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            'flex flex-col',
            // ตอนเปิดปฏิทิน: อย่า flex-1/min-h-0 — ไม่งั้นความสูงถูกบีบแล้วช่องวันซ้อนกัน
            attendanceShellOpen && !profileCardOpen ? 'shrink-0' : 'flex-1 min-h-0',
            !profileCardOpen && showPostCheckoutCountdown ? 'justify-center items-center text-center' : '',
          )}
        >
            {profileCardOpen ? (
              <StaffPersonnelIdCard
                fullName={fullDisplayName}
                departmentLabel={departmentLabel}
                positionLabel={profilePosition}
                roleLabel={roleLabel}
                email={profileEmail}
                phone={profilePhone}
                photoUrl={photoUrl}
                isLineConnected={isLineConnected}
                onLineConnectClick={() => setLineModalOpen(true)}
                onClose={() => setProfileCardOpen(false)}
              />
            ) : showPostCheckoutCountdown ? (
              <div className="w-full flex flex-col items-center justify-center text-center gap-1 py-3">
                <p className={`text-[10px] font-bold leading-none ${useLightText ? 'text-white/75' : 'text-slate-800'}`}>
                  {todayDateLabel}
                </p>
                <p className={`text-[10px] font-black ${useLightText ? 'text-white/90' : 'text-slate-900'}`}>
                  เช็คเอาต์แล้ว — รีเซ็ต 05:00 น.
                </p>
                <CountdownToFiveAM lightText={useLightText} />
              </div>
            ) : (
              <>
              <div className={cn(
                'relative flex w-full shrink-0 items-stretch',
                attendanceShellOpen ? 'h-[142px] min-h-[142px]' : 'flex-1 min-h-0',
              )}>
                <div className="flex min-w-0 flex-1 flex-col justify-between py-3">
                  <div className="min-w-0 pr-1">
                    <p className={cn(
                      'text-[11px] font-black leading-tight truncate font-sukhumvit',
                      useLightText ? 'text-white' : 'text-slate-800',
                    )}>
                      {personName}
                    </p>
                    <div className="mt-1">
                      <CurrentTimeClock lightText={useLightText} />
                    </div>
                    <p className={cn(
                      'mt-0.5 text-[10px] font-bold leading-tight truncate font-sukhumvit',
                      useLightText ? 'text-white/80' : 'text-slate-500',
                    )}>
                      {todayDateLabel}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-end justify-between gap-1.5" onClick={(e) => e.stopPropagation()}>
                  <QuickActionButton
                    title={checkButtonConfig.title}
                    icon={checkButtonConfig.icon}
                    tone={checkButtonConfig.tone}
                    disabled={checkButtonConfig.disabled}
                    loading={actionLoading && !isTodayOnLeave && !isAbsentFromWork}
                    onClick={checkButtonConfig.onClick}
                  />

                  <QuickActionButton
                    title="ข้อมูลส่วนตัว"
                    icon={<HiUser className="w-5 h-5" />}
                    tone={profileCardOpen ? 'primary' : 'neutral'}
                    onClick={() => setProfileCardOpen((open) => !open)}
                  />

                  {isTeacherRole && <StudentLeaveQuickAction />}
                  {isTeacherRole && <TeacherDailyTaskQuickAction />}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setAttendanceExpanded((open) => {
                      if (open) {
                        setAttendanceClosing(true);
                        return false;
                      }
                      setAttendanceClosing(false);
                      return true;
                    });
                  }}
                  className="relative w-[34%] max-w-[92px] shrink-0 self-stretch overflow-hidden rounded-r-2xl"
                  title={attendanceExpanded ? 'ปิดตารางเข้างาน' : 'ดูตารางเข้างาน'}
                  aria-label={attendanceExpanded ? 'ปิดตารางเข้างาน' : 'ดูตารางเข้างาน'}
                  aria-expanded={attendanceExpanded}
                >
                  {photoUrl ? (
                    <img
                      src={photoUrl}
                      alt={personName}
                      className={cn(
                        'absolute inset-0 h-full w-full object-cover object-top',
                        !useLightText && 'mix-blend-multiply',
                      )}
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <HiUser className="h-8 w-8 text-slate-300" aria-hidden />
                    </div>
                  )}
                  {isHoliday && !showAdminBadge ? (
                    <span className={`absolute bottom-1.5 right-1.5 z-10 text-[10px] font-black px-2 py-0.5 rounded-lg border ${
                      useLightText
                        ? 'bg-white/20 text-white border-white/30'
                        : 'bg-white/70 text-slate-900 border-white/50 shadow-sm'
                    }`}>
                      วันหยุด
                    </span>
                  ) : null}
                </button>
              </div>

              <AnimatePresence
                initial={false}
                onExitComplete={() => setAttendanceClosing(false)}
              >
                {attendanceExpanded ? (
                  <motion.div
                    key="attendance-calendar"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.36, ease: [0.32, 0.72, 0, 1] }}
                    className="shrink-0 overflow-hidden"
                  >
                    {uid ? (
                      <PersonalAttendanceCalendarPanel
                        userId={uid}
                        leaveRequests={myLeave.requests}
                        isSpecialTeacher={isSpecialTeacher}
                      />
                    ) : null}
                  </motion.div>
                ) : null}
              </AnimatePresence>
              </>
            )}

        </motion.div>
      </div>

      <Dialog open={geofencePopupOpen} onOpenChange={setGeofencePopupOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base font-black text-rose-600">อยู่นอกพื้นที่โรงเรียน</DialogTitle>
            <DialogDescription className="text-sm text-slate-600">
              {geofenceMessage || 'คุณอยู่นอกพื้นที่ที่อนุญาตให้ลงเวลา กรุณาเข้าใกล้โรงเรียนแล้วลองใหม่อีกครั้ง'}
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>

      <Dialog open={errorPopupOpen} onOpenChange={setErrorPopupOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base font-black text-amber-600">แจ้งเตือนการลงเวลา</DialogTitle>
            <DialogDescription className="text-sm text-slate-600">
              {errorPopupMessage || 'ไม่สามารถดำเนินการได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง'}
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>

      <Dialog open={successPopupOpen} onOpenChange={setSuccessPopupOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader className="items-center text-center">
            <div
              className={`w-14 h-14 rounded-full flex items-center justify-center ${
                isCheckoutSuccess ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'
              }`}
            >
              <SuccessIcon className="w-7 h-7" />
            </div>
            <DialogTitle className={`text-lg font-black ${isCheckoutSuccess ? 'text-red-600' : 'text-emerald-600'}`}>
              {successPopupMessage || 'เช็คอินสำเร็จ'}
            </DialogTitle>
          </DialogHeader>
        </DialogContent>
      </Dialog>

      <Dialog
        open={personalStatsOpen}
        onOpenChange={(open) => {
          setPersonalStatsOpen(open);
          if (!open) setPersonalStatsFromCheckIn(false);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          {personalStatsFromCheckIn ? (
            <>
              <DialogHeader className="items-center text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                  <SuccessIcon className="h-7 w-7" />
                </div>
                <DialogTitle className="text-lg font-black text-emerald-600">เช็คอินสำเร็จ</DialogTitle>
                <DialogDescription className="text-sm text-slate-600">
                  เวลาเข้างาน {fmt(todayRecord?.checkInTime)} · {todayDateLabel}
                </DialogDescription>
              </DialogHeader>
              <p className="text-center font-sukhumvit text-[13px] font-black text-slate-800">สถิติการลงเวลาของฉัน</p>
              <PersonalStatsGrid stats={personalStats} loading={personalStatsLoading} />
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="text-base font-black text-slate-800">สถิติการลงเวลาของฉัน</DialogTitle>
                <DialogDescription className="text-sm text-slate-600">
                  ภาพรวมการลงเวลางานทั้งหมดของบัญชีนี้
                </DialogDescription>
              </DialogHeader>
              <PersonalStatsGrid stats={personalStats} loading={personalStatsLoading} />
            </>
          )}
        </DialogContent>
      </Dialog>

      <LineConnectDialog open={lineModalOpen} onOpenChange={setLineModalOpen} />
    </>
  );
}
