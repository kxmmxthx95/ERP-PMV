import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  HiMapPin,
  HiClock,
  HiCheckCircle,
  HiArrowRightOnRectangle,
  HiClipboardDocumentList,
  HiCalendarDays,
  HiCheck,
  HiSun,
} from 'react-icons/hi2';
import { useAuth } from '@/hooks/useAuth';
import {
  formatShiftEndLabel,
  isAtOrAfterShiftEnd,
  resolveStaffAttendanceDisplay,
  useStaffAttendance,
} from '@/hooks/useStaffAttendance';
import { useAttendanceConfig } from '@/hooks/useAttendanceConfig';
import { useTeachersCollection } from '@/hooks/useTeachersCollection';
import { resolveTeacherFromAuth } from '@/lib/teachers/teacherIdentity';
import { isSpecialTeacherPosition } from '@/lib/staffAttendance/specialTeacher';
import {
  useMyLeaveRequests,
  getEarliestLeaveStartDate,
  validateLeaveSubmissionDates,
  LEAVE_SAME_DAY_CUTOFF_MESSAGE,
  isSameDayLeaveCutoffPassed,
} from '@/hooks/useLeaveRequests';
import { useThaiHolidays } from '@/features/calendar/hooks/useThaiHolidays';
import { useActiveAcademicYear } from '@/hooks/useActiveAcademicYear';
import { WIDGET_CARD, DAY_CANDY_SURFACE_CLASS, getDayCandyBoxShadow, getDayCandyStyle, type DayCandyStyle } from '../widgetStyles';
import { cn } from '@/lib/utils';
import { formatThaiDateLabel, getLocalDateString } from '@/lib/dateUtils';
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { LeaveType } from '@/types/leave';
import {
  EMPTY_PERSONAL_STATS,
  loadPersonalAttendanceStats,
  type PersonalStatsSummary,
} from '@/lib/staffAttendance/personalStats';

const CalendarIcon = HiCalendarDays;
const ClockIcon = HiClock;
const CheckInIcon = HiMapPin;
const CheckOutIcon = HiArrowRightOnRectangle;
const DoneIcon = HiCheckCircle;
const LeaveIcon = HiClipboardDocumentList;
const SuccessIcon = HiCheck;

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
      const now = new Date();
      const h = now.getHours().toString().padStart(2, '0');
      const m = now.getMinutes().toString().padStart(2, '0');
      const s = now.getSeconds().toString().padStart(2, '0');
      setCurrentTime(`${h}:${m}:${s}`);
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

export default function StaffCheckInWidget() {
  const { user, userData } = useAuth();
  const { config } = useAttendanceConfig();
  const { teachers } = useTeachersCollection();
  const uid = user?.uid ?? '';
  const displayName = userData?.name || userData?.displayName || user?.displayName || user?.email || 'บุคลากร';
  const teacherProfile = uid ? resolveTeacherFromAuth(uid, teachers) : null;
  const isSpecialTeacher = isSpecialTeacherPosition(teacherProfile?.position);

  // Fetch Thai public holidays
  const currentYear = new Date().getFullYear();
  const { holidays: thaiHolidays } = useThaiHolidays(currentYear);
  const { year } = useActiveAcademicYear();

  const { todayRecord, actionLoading, error, checkIn, checkOut, isHoliday, holidayTitle } = useStaffAttendance(
    uid,
    displayName,
    config,
    thaiHolidays,
    year ?? undefined,
    isSpecialTeacher,
  );
  const myLeave = useMyLeaveRequests(uid, 'staff');

  const [leaveDrawerOpen, setLeaveDrawerOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const tick = () => setNow(new Date());
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  // Leave Form State
  const todayStr = getLocalDateString(now);
  const earliestLeaveStartDate = getEarliestLeaveStartDate(now);
  const isTodayOnLeave = myLeave.requests.some(req => 
    req.status === 'approved' && 
    req.startDate <= todayStr && 
    req.endDate >= todayStr
  );

  const [leaveType, setLeaveType] = useState<LeaveType>('sick');
  const [startDate, setStartDate] = useState(earliestLeaveStartDate);
  const [endDate, setEndDate] = useState(earliestLeaveStartDate);
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [leaveSubmitError, setLeaveSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
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

  const resolvedToday = resolveStaffAttendanceDisplay(
    todayRecord ?? { checkInTime: null, status: 'present', note: '', date: todayStr },
    { selectedDate: todayStr, isWorkingDay: !isHoliday, now, isSpecialTeacher },
  );
  const isAbsentFromWork =
    !isTodayOnLeave &&
    !checked &&
    resolvedToday.status === 'absent' &&
    resolvedToday.isAutoAbsent;

  const todayDateLabel = useMemo(() => {
    const full = formatThaiDateLabel(now);
    const spaceIdx = full.indexOf(' ');
    return spaceIdx === -1 ? full : `${full.slice(0, spaceIdx)} • ${full.slice(spaceIdx + 1)}`;
  }, [now]);

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

  useEffect(() => {
    if (!leaveDrawerOpen) return;
    setStartDate((prev) => (prev < earliestLeaveStartDate ? earliestLeaveStartDate : prev));
    setEndDate((prev) => (prev < earliestLeaveStartDate ? earliestLeaveStartDate : prev));
  }, [leaveDrawerOpen, earliestLeaveStartDate]);

  const handleLeaveSubmit = async () => {
    if (!reason.trim()) return;
    const validationError = validateLeaveSubmissionDates(startDate, endDate, now);
    if (validationError) {
      setLeaveSubmitError(validationError);
      return;
    }
    setIsSubmitting(true);
    setLeaveSubmitError(null);
    try {
      await myLeave.submit(
        { leaveType, startDate, endDate, reason: reason.trim() },
        displayName,
        userData?.photoURL || '',
        null,
        '',
        '',
      );
      setSubmitSuccess(true);
      setTimeout(() => {
        setSubmitSuccess(false);
        setLeaveDrawerOpen(false);
        setReason('');
        setLeaveSubmitError(null);
      }, 2000);
    } catch (err) {
      console.error(err);
      setLeaveSubmitError(err instanceof Error ? err.message : 'ไม่สามารถส่งคำขอได้ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsSubmitting(false);
    }
  };

  const todayNum = now.getDay();
  const dayCandyStyle = getDayCandyStyle(todayNum);
  const isSaturday = todayNum === 6;
  const isWeekendHoliday = isHoliday && (isSaturday || holidayTitle === 'วันอาทิตย์' || holidayTitle === 'วันเสาร์');
  const absentCardStyle: DayCandyStyle = {
    background: 'linear-gradient(to right, #EF4444 0%, #FF8A82 100%)',
    border: '1.5px solid rgba(255,255,255,0.55)',
    glow: 'rgba(239, 68, 68, 0.4)',
  };
  const widgetCardStyle = isAbsentFromWork ? absentCardStyle : dayCandyStyle;
  const useLightText = isAbsentFromWork;

  return (
    <>
      <div
        style={{
          ...widgetCardStyle,
          boxShadow: getDayCandyBoxShadow(widgetCardStyle.glow),
        }}
        className={cn(WIDGET_CARD, DAY_CANDY_SURFACE_CLASS, 'transition-all duration-500 relative')}
        onClick={() => openPersonalStats(false)}
      >
        {isHoliday && !showAdminBadge && (
          <span className={`absolute top-1.5 right-1.5 z-10 text-[10px] font-black px-2 py-0.5 rounded-lg border ${
            useLightText
              ? 'bg-white/20 text-white border-white/30'
              : 'bg-white/70 text-slate-900 border-white/50 shadow-sm'
          }`}>
            วันหยุด
          </span>
        )}
        {showAdminBadge && (
          <span className="absolute top-1.5 right-1.5 z-10 flex items-center gap-1 rounded-full bg-amber-400 px-1.5 py-0.5 text-[8px] font-black text-amber-950 shadow-sm">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-200 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-100" />
            </span>
            แอดมินเช็คให้
          </span>
        )}
        <motion.div
          key="default"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className={`flex flex-col flex-1 min-h-0 ${showPostCheckoutCountdown ? 'justify-center items-center text-center' : ''}`}
        >
            {showPostCheckoutCountdown ? (
              <div className="w-full flex flex-col items-center justify-center text-center gap-1">
                <p className={`text-[10px] font-bold leading-none ${useLightText ? 'text-white/75' : 'text-slate-800'}`}>
                  {todayDateLabel}
                </p>
                <p className={`text-[10px] font-black ${useLightText ? 'text-white/90' : 'text-slate-900'}`}>
                  เช็คเอาต์แล้ว — รีเซ็ต 05:00 น.
                </p>
                <CountdownToFiveAM lightText={useLightText} />
              </div>
            ) : isHoliday ? (
              <div className="flex-1 flex items-center min-w-0">
                <div className={`w-full rounded-xl border px-2.5 py-2 ${
                  useLightText ? 'border-white/25 bg-white/10' : 'border-white/50 bg-white/55 shadow-sm'
                }`}>
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      useLightText ? 'bg-white/20 border border-white/30' : 'bg-white/80 border border-white/60'
                    }`}>
                      {isWeekendHoliday ? (
                        <HiSun className={`w-5 h-5 ${useLightText ? 'text-white' : 'text-slate-800'}`} aria-hidden />
                      ) : (
                        <CalendarIcon className={`w-5 h-5 ${useLightText ? 'text-white' : 'text-slate-800'}`} aria-hidden />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`text-[10px] font-bold leading-none mb-0.5 truncate ${
                        useLightText ? 'text-white/75' : 'text-slate-700'
                      }`}>
                        {todayDateLabel}
                      </p>
                      <p className={`text-[11px] font-black leading-tight truncate ${
                        useLightText ? 'text-white' : 'text-slate-900'
                      }`}>
                        {isWeekendHoliday ? 'วันหยุดสุดสัปดาห์' : `วันหยุด · ${holidayTitle}`}
                      </p>
                      <p className={`text-[10px] font-bold mt-0.5 ${
                        useLightText ? 'text-white/80' : 'text-slate-700'
                      }`}>
                        สุขสันต์วันหยุด · ไม่ต้องลงเวลา
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 flex-1 min-h-0 w-full">
                <div className="flex-1 flex flex-col justify-center min-w-0">
                  <p className={`text-[10px] font-bold leading-none mb-0.5 truncate ${
                    useLightText ? 'text-white/75' : 'text-slate-800'
                  }`}>
                    {todayDateLabel}
                  </p>
                  <CurrentTimeClock lightText={useLightText} />
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1">
                    <div className={`flex items-center gap-1 text-[9px] font-bold ${
                      useLightText ? 'text-white/80' : 'text-slate-700'
                    }`}>
                      <ClockIcon className={`w-2.5 h-2.5 shrink-0 ${useLightText ? 'text-white' : 'text-slate-800'}`} />
                      <span>เข้า: <span className={useLightText ? 'text-white' : 'text-slate-900'}>{fmt(todayRecord?.checkInTime)}</span></span>
                    </div>
                    <div className={`flex items-center gap-1 text-[9px] font-bold ${
                      useLightText ? 'text-white/80' : 'text-slate-700'
                    }`}>
                      <CheckOutIcon className={`w-2.5 h-2.5 shrink-0 ${useLightText ? 'text-white' : 'text-slate-800'}`} />
                      <span>ออก: <span className={useLightText ? 'text-white' : 'text-slate-900'}>{fmt(todayRecord?.checkOutTime)}</span></span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div className="relative">
                    {isTodayOnLeave ? (
                      <div className={`w-14 h-14 rounded-full flex items-center justify-center ${
                        useLightText
                          ? 'bg-white/20 border border-white/35 text-white'
                          : 'bg-white/80 border border-white/60 text-slate-800 shadow-sm'
                      }`}>
                        <LeaveIcon className="w-5 h-5" />
                      </div>
                    ) : isAbsentFromWork ? (
                      <div className="flex items-center justify-center min-w-[3.5rem] px-2 py-1.5 rounded-xl bg-white/15 border border-white/30">
                        <span className="text-[11px] font-black text-white leading-none">ขาดงาน</span>
                      </div>
                    ) : !checked ? (
                      <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          pendingSuccessActionRef.current = 'checkin';
                          checkIn();
                        }}
                        disabled={actionLoading}
                        className={`w-14 h-14 rounded-full flex items-center justify-center shadow-md disabled:opacity-60 transition-all relative overflow-hidden group ${
                          useLightText
                            ? 'bg-white/25 border border-white/35 text-white'
                            : 'bg-white/90 border border-white/65 text-slate-800'
                        }`}
                      >
                        {actionLoading ? (
                          <div className={`w-5 h-5 border-2 rounded-full animate-spin ${
                            useLightText ? 'border-white/40 border-t-white' : 'border-slate-300 border-t-slate-800'
                          }`} />
                        ) : (
                          <CheckInIcon className="w-5 h-5 relative z-10" />
                        )}
                      </motion.button>
                    ) : !checkedOut ? (
                      <motion.button
                        whileTap={checkoutTimeReached ? { scale: 0.9 } : undefined}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!checkoutTimeReached || actionLoading) return;
                          pendingSuccessActionRef.current = 'checkout';
                          checkOut();
                        }}
                        disabled={actionLoading || !checkoutTimeReached}
                        title={
                          checkoutTimeReached
                            ? 'เช็คเอาต์'
                            : `เช็คเอาต์ได้หลัง ${shiftEndLabel} น.`
                        }
                        aria-label={
                          checkoutTimeReached
                            ? 'เช็คเอาต์'
                            : `ยังไม่ถึงเวลาเลิกงาน เช็คเอาต์ได้หลัง ${shiftEndLabel} น.`
                        }
                        className="relative w-14 h-14 rounded-full flex items-center justify-center shadow-md disabled:opacity-40 disabled:cursor-not-allowed transition-all overflow-hidden group bg-[#ef4444] border border-white/50 text-white"
                      >
                        {actionLoading ? (
                          <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                        ) : (
                          <CheckOutIcon className="w-5 h-5 relative z-10" />
                        )}
                      </motion.button>
                    ) : (
                      <div className={`w-14 h-14 rounded-full flex items-center justify-center ${
                        useLightText
                          ? 'bg-white/20 border border-white/35 text-white'
                          : 'bg-white/80 border border-white/60 text-slate-800 shadow-sm'
                      }`}>
                        <DoneIcon className="w-5 h-5" />
                      </div>
                    )}
                  </div>

                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setLeaveDrawerOpen(true);
                    }}
                    className={`w-14 h-14 rounded-full flex items-center justify-center transition-all shadow-sm ${
                      useLightText
                        ? 'border border-white/35 bg-white/20 text-white'
                        : 'border border-white/55 bg-white/70 text-slate-800'
                    }`}
                  >
                    <LeaveIcon className="w-5 h-5" />
                  </motion.button>
                </div>
              </div>
            )}

        </motion.div>
      </div>

      <Drawer open={leaveDrawerOpen} onOpenChange={setLeaveDrawerOpen}>
        <DrawerContent className="max-h-[85vh] overflow-hidden">
          <DrawerHeader className="px-4 pb-2 text-left">
            <DrawerTitle className="text-base font-black text-slate-800">ยื่นคำขอลา</DrawerTitle>
            <DrawerDescription className="text-xs text-slate-500">
              กรอกรายละเอียดการลาและส่งคำขอเพื่ออนุมัติ
            </DrawerDescription>
          </DrawerHeader>

          <div className="px-4 pb-4 overflow-y-auto">
            {submitSuccess ? (
              <div className="py-10 flex flex-col items-center justify-center text-center gap-3">
                <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                  <SuccessIcon className="w-6 h-6" />
                </div>
                <div>
                  <p className="font-black text-slate-800">ส่งคำขอสำเร็จ</p>
                  <p className="text-xs text-slate-400 font-bold">กำลังปิดฟอร์ม...</p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {isSameDayLeaveCutoffPassed(now) && (
                  <p className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                    {LEAVE_SAME_DAY_CUTOFF_MESSAGE}
                  </p>
                )}

                {leaveSubmitError && (
                  <p className="text-[11px] font-bold text-rose-600 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2">
                    {leaveSubmitError}
                  </p>
                )}

                {/* Leave Type Toggle */}
                <div className="flex gap-1.5 p-1 bg-slate-50 rounded-xl border border-slate-100">
                  {(['sick', 'personal'] as LeaveType[]).map(t => (
                    <button
                      key={t}
                      onClick={() => setLeaveType(t)}
                      className={cn(
                        "flex-1 py-2 rounded-lg text-[11px] font-black transition-all",
                        leaveType === t
                          ? "bg-white text-blue-600 shadow-sm ring-1 ring-slate-200/40"
                          : "text-slate-400 hover:text-slate-600"
                      )}
                    >
                      {t === 'sick' ? 'ลาป่วย' : 'ลากิจ'}
                    </button>
                  ))}
                </div>

                {/* Date Selection */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">เริ่ม</label>
                    <div className="relative">
                      <CalendarIcon size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="date"
                        value={startDate}
                        min={earliestLeaveStartDate}
                        onChange={e => {
                          setLeaveSubmitError(null);
                          setStartDate(e.target.value);
                          if (e.target.value > endDate) setEndDate(e.target.value);
                        }}
                        className="w-full pl-8 pr-2 py-2 bg-white border border-slate-200 rounded-xl text-[12px] font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500/40"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">ถึง</label>
                    <div className="relative">
                      <CalendarIcon size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="date"
                        value={endDate}
                        min={startDate}
                        onChange={e => {
                          setLeaveSubmitError(null);
                          setEndDate(e.target.value);
                        }}
                        className="w-full pl-8 pr-2 py-2 bg-white border border-slate-200 rounded-xl text-[12px] font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500/40"
                      />
                    </div>
                  </div>
                </div>

                {/* Reason */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1">เหตุผล</label>
                  <textarea
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    placeholder="ระบุเหตุผลการลา..."
                    rows={4}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-[12px] font-bold text-slate-700 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500/40"
                  />
                </div>

                <button
                  onClick={handleLeaveSubmit}
                  disabled={isSubmitting || !reason.trim() || !!validateLeaveSubmissionDates(startDate, endDate, now)}
                  className="w-full py-3 rounded-2xl bg-blue-600 text-white font-black text-[12px] flex items-center justify-center gap-2 hover:bg-blue-700 disabled:opacity-50 transition-all active:scale-95 mt-1"
                >
                  {isSubmitting ? (
                    <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  ) : 'ส่งคำขอลา'}
                </button>
              </div>
            )}
          </div>
        </DrawerContent>
      </Drawer>

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
    </>
  );
}
