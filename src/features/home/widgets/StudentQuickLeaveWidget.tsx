import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, ChevronLeft, CheckCircle2 } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { useActiveAcademicYear } from '@/hooks/useActiveAcademicYear';
import { useMyLeaveRequests, countDays, getEarliestLeaveStartDate, validateLeaveSubmissionDates, LEAVE_SAME_DAY_CUTOFF_MESSAGE, isSameDayLeaveCutoffPassed } from '@/hooks/useLeaveRequests';
import { WIDGET_CARD, WIDGET_GLASS } from '../widgetStyles';
import { cn } from '@/lib/utils';
import type { LeaveType } from '@/types/leave';

export default function StudentQuickLeaveWidget() {

  const { user, userData } = useAuth();
  const uid = user?.uid ?? '';
  const displayName = userData?.name || userData?.displayName || userData?.email || 'นักเรียน';
  const { requests, submit } = useMyLeaveRequests(uid, 'student');

  const [view, setView] = useState<'summary' | 'form' | 'success'>('summary');
  const [leaveType, setLeaveType] = useState<LeaveType>('sick');
  const [reason, setReason] = useState('');
  const earliestStartDate = getEarliestLeaveStartDate();
  const [startDate, setStartDate] = useState(earliestStartDate);
  const [endDate, setEndDate] = useState(earliestStartDate);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [quota, setQuota] = useState<{ sick: number; personal: number }>({ sick: 0, personal: 0 });
  const { year: activeYear } = useActiveAcademicYear();

  useEffect(() => {
    async function fetchQuota() {
      if (!activeYear) return;
      try {
        const qDoc = await getDoc(doc(db, 'settings', 'leave_quota'));
        if (qDoc.exists()) {
          const data = qDoc.data();
          const yrData = data.quotasByAcademicYear?.[activeYear];
          if (yrData) {
            setQuota({
              sick: yrData.studentSickDays || 0,
              personal: yrData.studentPersonalDays || 0,
            });
          }
        }
      } catch (err) {
        console.error('Error fetching quota:', err);
      }
    }
    fetchQuota();
  }, [activeYear]);

  const approvedRequests = requests.filter(r => r.status === 'approved');
  const sickUsed = approvedRequests
    .filter(r => r.leaveType === 'sick')
    .reduce((acc, r) => acc + countDays(r.startDate, r.endDate), 0);
  const personalUsed = approvedRequests
    .filter(r => r.leaveType === 'personal')
    .reduce((acc, r) => acc + countDays(r.startDate, r.endDate), 0);


  const handleQuickSubmit = async () => {
    if (!reason.trim()) return;
    const validationError = validateLeaveSubmissionDates(startDate, endDate);
    if (validationError) {
      setError(validationError);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const requesterStudentCode =
        typeof userData?.studentCode === 'string'
          ? userData.studentCode
          : null;
      await submit(
        { leaveType, startDate, endDate, reason: reason.trim() },
        displayName,
        userData?.photoURL || '',
        requesterStudentCode,
        '',
        '',
      );
      setView('success');
      setReason('');
      setTimeout(() => setView('summary'), 3000);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'ไม่สามารถส่งคำขอได้ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      style={WIDGET_GLASS}
      className={cn(
        WIDGET_CARD,
        'relative overflow-hidden group transition-all duration-500',
        view !== 'summary' && '!h-auto min-h-[242px]',
      )}
    >
      {/* Background Decor - Added pointer-events-none to prevent blocking clicks */}
      <div className="absolute top-[-20%] right-[-10%] w-32 h-32 bg-orange-400/10 rounded-full blur-3xl group-hover:bg-orange-400/20 transition-colors duration-500 pointer-events-none z-0" />
      <div className="absolute bottom-[-10%] left-[-5%] w-24 h-24 bg-blue-400/10 rounded-full blur-2xl group-hover:bg-blue-400/20 transition-colors duration-500 pointer-events-none z-0" />

      <AnimatePresence mode="wait">
        {view === 'summary' && (
          <motion.div
            key="summary"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="flex flex-1 items-center justify-between gap-3 min-h-0 relative"
          >
            <div className="flex gap-6 min-w-0">
              <div className="flex flex-col items-start">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">ลาป่วย</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-lg font-black text-rose-500">{sickUsed}</span>
                  <span className="text-[10px] font-bold text-slate-400">/ {quota.sick}</span>
                </div>
              </div>
              <div className="flex flex-col items-start">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">ลากิจ</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-lg font-black text-amber-500">{personalUsed}</span>
                  <span className="text-[10px] font-bold text-slate-400">/ {quota.personal}</span>
                </div>
              </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setView('form')}
              className="w-14 h-14 shrink-0 rounded-full bg-rose-500 text-white flex items-center justify-center hover:bg-rose-600 transition-all group/btn shadow-md"
            >
              <Plus size={24} strokeWidth={3} className="text-white group-hover/btn:rotate-90 transition-transform duration-300" />
            </motion.button>
          </motion.div>
        )}

        {view === 'form' && (
          <motion.div
            key="form"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex flex-col gap-2 h-full relative"
          >
            <div className="flex items-center gap-3">
              <button
                onClick={() => setView('summary')}
                className="w-8 h-8 rounded-full bg-white/60 backdrop-blur-sm border border-black/[0.03] flex items-center justify-center hover:bg-white hover:shadow-sm transition-all shrink-0 text-slate-400 hover:text-slate-600"
              >
                <ChevronLeft size={16} />
              </button>
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">รายละเอียดการลา</h3>
            </div>

            <div className="space-y-4">
              {isSameDayLeaveCutoffPassed() && (
                <p className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-100 rounded-2xl px-3 py-2">
                  {LEAVE_SAME_DAY_CUTOFF_MESSAGE}
                </p>
              )}

              {/* Type Toggle */}
              <div className="flex gap-1 p-1">
                {(['sick', 'personal'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setLeaveType(t)}
                    className={`flex-1 py-1.5 rounded-full text-[10.5px] font-black transition-all ${
                      leaveType === t
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-slate-500 hover:bg-black/5'
                    }`}
                  >
                    {t === 'sick' ? 'ลาป่วย' : 'ลากิจ'}
                  </button>
                ))}
              </div>

              {/* Date Inputs */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">วันเริ่ม</label>
                  <input
                    type="date"
                    value={startDate}
                    min={earliestStartDate}
                    onChange={e => {
                      setError(null);
                      setStartDate(e.target.value);
                      if (e.target.value > endDate) setEndDate(e.target.value);
                    }}
                    className="w-full h-10 px-3 rounded-2xl bg-white/60 border border-slate-200/50 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/10"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">วันสิ้นสุด</label>
                  <input
                    type="date"
                    value={endDate}
                    min={startDate}
                    onChange={e => {
                      setError(null);
                      setEndDate(e.target.value);
                    }}
                    className="w-full h-10 px-3 rounded-2xl bg-white/60 border border-slate-200/50 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/10"
                  />
                </div>
              </div>

              {/* Reason */}
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">เหตุผลการลา</label>
                <textarea
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder="ระบุเหตุผลที่จำเป็น..."
                  className="w-full h-20 p-3 rounded-2xl bg-white/60 border border-slate-200/50 text-xs font-bold placeholder:text-slate-300 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/10"
                />
              </div>
            </div>

            {error && (
              <p className="text-[10px] font-bold text-rose-500 bg-rose-50 p-2.5 rounded-2xl border border-rose-100">
                {error}
              </p>
            )}

            <button
              onClick={handleQuickSubmit}
              disabled={submitting || !reason.trim() || !startDate || !endDate || !!validateLeaveSubmissionDates(startDate, endDate)}
              className="w-full py-3.5 rounded-full bg-slate-900 text-white font-black text-[13px] flex items-center justify-center gap-2 hover:bg-slate-800 disabled:opacity-50 disabled:bg-slate-300 disabled:cursor-not-allowed shadow-lg shadow-slate-900/10 active:scale-[0.98] transition-all mt-4"
            >
              {submitting ? 'กำลังส่ง...' : 'ยืนยันยื่นคำขอ'}
            </button>
          </motion.div>
        )}

        {view === 'success' && (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center h-full gap-4 text-center"
          >
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-500 mb-2">
              <CheckCircle2 size={32} />
            </div>
            <h3 className="text-lg font-black text-slate-800">ยื่นคำขอสำเร็จ!</h3>
            <p className="text-xs text-slate-400 font-medium px-4">
              คำขอของคุณถูกส่งไปยังครูที่เกี่ยวข้องแล้ว <br />สามารถติดตามผลได้ที่หน้าประวัติการลา
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer Hint */}

    </motion.div>
  );
}
