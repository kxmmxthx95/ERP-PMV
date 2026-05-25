import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Clock, UserCheck, LogOut, AlertCircle, ClipboardList, ChevronLeft, Calendar as CalendarIcon, Check } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useStaffAttendance } from '@/hooks/useStaffAttendance';
import { useAttendanceConfig } from '@/hooks/useAttendanceConfig';
import { useMyLeaveRequests } from '@/hooks/useLeaveRequests';
import { useThaiHolidays } from '@/features/calendar/hooks/useThaiHolidays';
import { WIDGET_GLASS } from '../widgetStyles';
import { cn } from '@/lib/utils';
import type { LeaveType } from '@/types/leave';

function fmt(ts: any): string {
  if (!ts) return '--:--';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
}

function CountdownClock({ targetHour, targetMinute }: { targetHour: number; targetMinute: number }) {
  const [timeLeft, setTimeLeft] = useState('');
  const [isUrgent, setIsUrgent] = useState(false);

  useEffect(() => {
    const update = () => {
      const now = new Date();
      const target = new Date();
      target.setHours(targetHour, targetMinute, 0, 0);

      const diff = target.getTime() - now.getTime();
      if (diff <= 0) {
        setTimeLeft('เลิกงานแล้ว');
        setIsUrgent(false);
        return;
      }

      // Urgent if less than 1 hour
      setIsUrgent(diff < 1000 * 60 * 60);

      const h = Math.floor(diff / (1000 * 60 * 60));
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
    };

    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [targetHour, targetMinute]);

  return (
    <span className={cn(
      "font-mono tabular-nums text-3xl font-black tracking-tighter transition-colors duration-500",
      isUrgent ? "text-rose-500 animate-pulse" : "text-slate-800"
    )}>
      {timeLeft}
    </span>
  );
}

export default function StaffCheckInWidget() {
  const { user, userData } = useAuth();
  const { config } = useAttendanceConfig();
  const uid = user?.uid ?? '';
  const displayName = userData?.name || userData?.displayName || user?.displayName || user?.email || 'บุคลากร';

  // Fetch Thai public holidays
  const currentYear = new Date().getFullYear();
  const { holidays: thaiHolidays } = useThaiHolidays(currentYear);

  const { todayRecord, actionLoading, error, checkIn, checkOut, isHoliday, holidayTitle } = useStaffAttendance(uid, displayName, config, thaiHolidays);
  const myLeave = useMyLeaveRequests(uid, 'staff');

  const [mode, setMode] = useState<'default' | 'leave'>('default');

  // Leave Form State
  const todayStr = new Date().toISOString().slice(0, 10);
  const isTodayOnLeave = myLeave.requests.some(req => 
    req.status === 'approved' && 
    req.startDate <= todayStr && 
    req.endDate >= todayStr
  );

  const [leaveType, setLeaveType] = useState<LeaveType>('sick');
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(todayStr);
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const checked = !!todayRecord?.checkInTime || !!todayRecord?.overrideBy;
  const checkedOut = !!todayRecord?.checkOutTime;

  const handleLeaveSubmit = async () => {
    if (!reason.trim()) return;
    setIsSubmitting(true);
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
        setMode('default');
        setReason('');
      }, 2000);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={WIDGET_GLASS} className="rounded-3xl p-5 flex flex-col min-h-[300px] w-full transition-all duration-500 overflow-hidden">
      <AnimatePresence mode="wait">
        {mode === 'default' ? (
          <motion.div
            key="default"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="flex flex-col gap-5 h-full"
          >
            {/* Header */}
            {!isHoliday && (
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-sm text-slate-700">ลงเวลาทำงาน</p>
                </div>
              </div>
            )}

            {/* Time Row or Holiday View */}
            {isHoliday ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center gap-4 py-2">
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="w-16 h-16 rounded-3xl bg-blue-50 flex items-center justify-center text-blue-500 shadow-inner border border-blue-100/50"
                >
                  <CalendarIcon size={32} />
                </motion.div>
                <div>
                  <p className="text-2xl font-black text-slate-800 tabular-nums">
                    {new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                  <p className="text-blue-600 font-bold mt-1">{holidayTitle}</p>
                </div>
                <div className="px-6 py-4 rounded-2xl bg-gradient-to-br from-blue-50/50 to-indigo-50/50 border border-blue-100/30">
                  <p className="text-sm font-black text-slate-700 leading-relaxed">
                    สุขสันต์วันหยุด<br />
                    <span className="text-blue-600/80">พักผ่อน อย่างสุขใจ</span>
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <div className="flex-1 flex flex-col">
                  <CountdownClock targetHour={config.shiftEndHour} targetMinute={config.shiftEndMinute} />
                  <div className="flex flex-col gap-1 mt-2">
                    <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400">
                      <Clock size={11} className="text-blue-500" />
                      <span>เข้า: <span className="text-slate-600">{fmt(todayRecord?.checkInTime)}</span></span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400">
                      <LogOut size={11} className="text-slate-400" />
                      <span>ออก: <span className="text-slate-600">{fmt(todayRecord?.checkOutTime)}</span></span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Error or Leave Status */}
            {error && (
              <div className="flex items-start gap-2 rounded-xl bg-red-50 border border-red-100 p-3 text-xs text-red-600">
                <AlertCircle size={14} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {isTodayOnLeave && (
              <div className="flex items-center gap-2 rounded-xl bg-violet-50 border border-violet-100 p-3 text-xs text-violet-600">
                <ClipboardList size={14} className="shrink-0" />
                <span className="font-bold">วันนี้คุณอยู่ในช่วงลางาน (ได้รับการอนุมัติแล้ว)</span>
              </div>
            )}

            {!isHoliday && (
              <div className="flex items-center justify-around mt-auto pt-2 pb-1">
                {/* Check-In / Check-Out Circle */}
                <div className="flex flex-col items-center gap-2">
                  {isTodayOnLeave ? (
                    <div className="w-16 h-16 rounded-full bg-violet-50 border border-violet-100 text-violet-500 flex items-center justify-center">
                      <ClipboardList size={24} />
                    </div>
                  ) : !checked ? (
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={checkIn}
                      disabled={actionLoading}
                      className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-blue-200 disabled:opacity-60 transition-all relative overflow-hidden group"
                    >
                      <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                      {actionLoading ? (
                        <div className="w-6 h-6 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      ) : (
                        <MapPin size={24} className="relative z-10" />
                      )}
                    </motion.button>
                  ) : !checkedOut ? (
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={checkOut}
                      disabled={actionLoading}
                      className="w-16 h-16 rounded-full bg-gradient-to-br from-slate-600 to-slate-800 text-white flex items-center justify-center shadow-lg shadow-slate-200 disabled:opacity-60 transition-all relative overflow-hidden group"
                    >
                      <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                      {actionLoading ? (
                        <div className="w-6 h-6 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      ) : (
                        <LogOut size={24} className="relative z-10" />
                      )}
                    </motion.button>
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-500 flex items-center justify-center">
                      <UserCheck size={24} />
                    </div>
                  )}
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-tighter">
                    {isTodayOnLeave ? 'On Leave' : !checked ? 'Check In' : !checkedOut ? 'Check Out' : 'Done'}
                  </span>
                </div>

                {/* Leave Circle */}
                <div className="flex flex-col items-center gap-2">
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setMode('leave')}
                    className="w-16 h-16 rounded-full bg-slate-50 border border-slate-100 text-slate-400 flex items-center justify-center hover:bg-slate-100 hover:text-slate-600 transition-all shadow-sm"
                  >
                    <ClipboardList size={24} />
                  </motion.button>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Leave Request</span>
                </div>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="leave"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex flex-col gap-4 h-full"
          >
            {/* Header */}
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setMode('default')}
                className="p-1.5 rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="font-bold text-sm text-slate-700">ยื่นคำขอลา</span>
            </div>

            {submitSuccess ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center gap-3">
                <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                  <Check size={24} strokeWidth={3} />
                </div>
                <div>
                  <p className="font-black text-slate-800">ส่งคำขอสำเร็จ</p>
                  <p className="text-xs text-slate-400 font-bold">กำลังกลับสู่หน้าหลัก...</p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {/* Leave Type Toggle */}
                <div className="flex gap-1.5 p-1 bg-slate-50 rounded-xl border border-slate-100">
                  {(['sick', 'personal'] as LeaveType[]).map(t => (
                    <button
                      key={t}
                      onClick={() => setLeaveType(t)}
                      className={cn(
                        "flex-1 py-1.5 rounded-lg text-[10px] font-black transition-all",
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
                    <label className="text-[9px] font-black text-slate-400 uppercase ml-1">เริ่ม</label>
                    <div className="relative">
                      <CalendarIcon size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input 
                        type="date"
                        value={startDate}
                        onChange={e => setStartDate(e.target.value)}
                        className="w-full pl-8 pr-2 py-2 bg-white border border-slate-200 rounded-xl text-[11px] font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500/40"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase ml-1">ถึง</label>
                    <div className="relative">
                      <CalendarIcon size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input 
                        type="date"
                        value={endDate}
                        min={startDate}
                        onChange={e => setEndDate(e.target.value)}
                        className="w-full pl-8 pr-2 py-2 bg-white border border-slate-200 rounded-xl text-[11px] font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500/40"
                      />
                    </div>
                  </div>
                </div>

                {/* Reason */}
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase ml-1">เหตุผล</label>
                  <textarea 
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    placeholder="ระบุเหตุผลการลา..."
                    rows={3}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-[11px] font-bold text-slate-700 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500/40"
                  />
                </div>

                <button
                  onClick={handleLeaveSubmit}
                  disabled={isSubmitting || !reason.trim()}
                  className="w-full py-3 rounded-2xl bg-blue-600 text-white font-black text-[12px] flex items-center justify-center gap-2 hover:bg-blue-700 disabled:opacity-50 transition-all active:scale-95 mt-1"
                >
                  {isSubmitting ? (
                    <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  ) : 'ส่งคำขอลา'}
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
