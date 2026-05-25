import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldAlert, CheckCircle, ChevronLeft, ChevronRight,
  Send, Lock, AlertTriangle, Eye, EyeOff,
  Maximize2, Minimize2, LayoutGrid, Info, HelpCircle
} from 'lucide-react';

import { IndeterminateProgress } from '@/components/ui/progress';
import { useExamAttempt } from '@/hooks/useExamRoom';
import { useAuth } from '@/hooks/useAuth';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

// ── Countdown Hook ────────────────────────────────────────────────────────────
function useCountdown(endTime: number | null | undefined) {
  const [remaining, setRemaining] = useState(0);
  const hasValidEndTime = typeof endTime === 'number' && Number.isFinite(endTime) && endTime > 0;

  useEffect(() => {
    if (!hasValidEndTime) return;
    const tick = () => setRemaining(Math.max(0, Math.floor((endTime - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endTime, hasValidEndTime]);

  const mm = Math.floor(remaining / 60).toString().padStart(2, '0');
  const ss = (remaining % 60).toString().padStart(2, '0');
  const isUrgent = hasValidEndTime && remaining > 0 && remaining < 300; // last 5 minutes
  const isExpired = hasValidEndTime && endTime <= Date.now();

  return { remaining, mm, ss, isUrgent, isExpired };
}

// ── Background Component ──────────────────────────────────────────────────────
function ExamBackground() {
  return (
    <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
      <div className="absolute inset-0 bg-slate-50" />
      <motion.div 
        animate={{ 
          scale: [1, 1.2, 1],
          opacity: [0.2, 0.28, 0.2],
          rotate: [0, 90, 0]
        }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        className="absolute -top-1/4 -left-1/4 w-[150%] h-[150%] bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.15)_0%,transparent_70%)]"
      />
      <motion.div 
        animate={{ 
          scale: [1.2, 1, 1.2],
          opacity: [0.16, 0.24, 0.16],
          rotate: [0, -90, 0]
        }}
        transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
        className="absolute -bottom-1/4 -right-1/4 w-[150%] h-[150%] bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.1)_0%,transparent_70%)]"
      />
      <div className="absolute inset-0 backdrop-blur-[90px]" />
    </div>
  );
}

// ── Join Screen ───────────────────────────────────────────────────────────────
function JoinScreen({
  roomId, onJoin, isJoining, error,
}: {
  roomId: string;
  onJoin: (password: string, studentId: string, studentName: string) => Promise<boolean>;
  isJoining: boolean;
  error: string | null;
}) {
  const navigate = useNavigate();
  const { user, userData } = useAuth();
  const [password, setPassword] = useState('');
  const [studentName, setStudentName] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (userData?.fullName) setStudentName(userData.fullName);
    else if (user?.displayName) setStudentName(user.displayName);
  }, [user, userData]);

  const handleJoin = useCallback(async () => {
    if (!password) return;
    const studentUid = user?.uid?.trim();
    if (!studentUid) {
      toast.error('ไม่พบข้อมูลผู้ใช้ กรุณาเข้าสู่ระบบใหม่');
      return;
    }
    const finalName = studentName || user?.displayName || user?.email || 'Anonymous Student';
    const success = await onJoin(password, studentUid, finalName);
    if (success) toast.success('ยินดีต้อนรับเข้าสู่ห้องสอบ');
  }, [password, studentName, onJoin, user]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden font-sarabun">
      <ExamBackground />
      
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="relative z-10 w-full max-w-[440px] rounded-[3rem] p-10 flex flex-col gap-8 overflow-hidden"
        style={{
          background: 'rgba(255,255,255,0.95)',
          border: '1px solid rgba(148,163,184,0.25)',
          backdropFilter: 'blur(20px)',
          boxShadow: '0 24px 64px rgba(15,23,42,0.12)',
        }}
      >
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-blue-500/50 to-transparent" />

        <button 
          onClick={() => navigate('/portal')}
          className="absolute top-6 left-6 w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-all z-20"
        >
          <ChevronLeft size={20} />
        </button>

        <div className="flex flex-col items-center gap-4">
          <motion.div 
            className="w-20 h-20 rounded-[2rem] flex items-center justify-center border border-blue-100"
            style={{ background: 'linear-gradient(135deg, #2563eb, #06b6d4)' }}
          >
            <Lock size={32} className="text-white" />
          </motion.div>
          <div className="text-center">
            <h1 className="text-[28px] font-black text-slate-900 font-sukhumvit tracking-tight">Examination</h1>
            <p className="text-[13px] text-slate-500 font-medium tracking-widest uppercase mt-1">Room ID: {roomId}</p>
          </div>
        </div>

        <div className="flex flex-col gap-6">

          <div className="space-y-2">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-[0.2em] ml-4">Access Password</label>
            <div className="relative">
              <Input
                value={password}
                onChange={e => setPassword(e.target.value)}
                type={showPassword ? "text" : "password"}
                placeholder="รหัสผ่านเข้าสอบ"
                className="h-14 rounded-2xl border border-slate-200 text-slate-900 text-[18px] font-black bg-white focus:bg-white transition-all pl-6 pr-14 tracking-[0.3em]"
                onKeyDown={e => { if (e.key === 'Enter') handleJoin(); }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          <AnimatePresence>
            {error && (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-rose-500/10 border border-rose-500/20">
                <AlertTriangle size={16} className="text-rose-400 shrink-0" />
                <p className="text-[13px] text-rose-200 font-medium">{error}</p>
              </motion.div>
            )}
          </AnimatePresence>

          <motion.button
            whileHover={{ backgroundColor: '#1d4ed8' }}
            whileTap={{ scale: 0.98 }}
            onClick={handleJoin}
            disabled={isJoining || !password}
            className="h-14 rounded-2xl text-white font-black text-[15px] font-sukhumvit transition-all disabled:opacity-30 disabled:cursor-not-allowed border border-blue-600 flex items-center justify-center gap-2"
            style={{ background: '#2563eb' }}
          >
            {isJoining ? (
              <IndeterminateProgress className="w-32" white />
            ) : (
              <>เริ่มทำข้อสอบ <ChevronRight size={18} /></>
            )}
          </motion.button>
        </div>

        <div className="flex items-center justify-center gap-2 text-[11px] text-slate-500 font-medium">
          <ShieldAlert size={12} />
          <span>ระบบป้องกันการทุจริตกำลังทำงาน</span>
        </div>
      </motion.div>
    </div>
  );
}

// ── Result Screen ─────────────────────────────────────────────────────────────
function ResultScreen({ score, total, canReview, onReview }: {
  score: number | null;
  total: number;
  canReview?: boolean;
  onReview?: () => void;
}) {
  const navigate = useNavigate();
  const pct = score !== null ? Math.round((score / total) * 100) : null;

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden font-sarabun">
      <ExamBackground />
      
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative z-10 w-full max-w-[480px] rounded-[3.5rem] p-12 flex flex-col gap-10 text-center"
        style={{
          background: 'rgba(255,255,255,0.95)',
          border: '1px solid rgba(148,163,184,0.25)',
          backdropFilter: 'blur(20px)',
        }}
      >
        <div className="flex flex-col items-center gap-6">
          <motion.div
            initial={{ scale: 0, rotate: -45 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', damping: 12, delay: 0.2 }}
            className="w-24 h-24 rounded-[2.5rem] flex items-center justify-center border border-emerald-200"
            style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
          >
            <CheckCircle size={44} className="text-white" />
          </motion.div>
          
          <div className="space-y-2">
            <h1 className="text-[32px] font-black text-slate-900 font-sukhumvit">ส่งข้อสอบเรียบร้อย</h1>
            <p className="text-[15px] text-slate-600">คุณได้ทำข้อสอบครบถ้วนและส่งข้อมูลเข้าระบบแล้ว</p>
          </div>
        </div>

        <div className="p-8 rounded-[2.5rem] bg-slate-50 border border-slate-200 space-y-4">
          {pct !== null ? (
            <>
              <div className="flex flex-col items-center">
                <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-[0.2em] mb-1">Final Score</span>
                <p className="text-[64px] font-black font-sukhumvit text-slate-900 leading-none">
                  {pct}<span className="text-[24px] text-slate-500 ml-1">%</span>
                </p>
              </div>
              <div className="h-[1px] w-full bg-slate-200" />
              <p className="text-[14px] font-bold text-slate-600">
                {score} / {total} คะแนน
              </p>
            </>
          ) : (
            <div className="flex flex-col items-center gap-3 py-4">
              <div className="w-10 h-10 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                <Info size={20} />
              </div>
              <p className="text-[14px] text-slate-600 font-medium">
                รอคุณครูสรุปคะแนนและประกาศผล<br />
                ผ่านหน้าแดชบอร์ดของคุณ
              </p>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3">
          {canReview && onReview && (
            <button
              onClick={onReview}
              className="h-14 rounded-2xl text-blue-700 font-black text-[15px] font-sukhumvit border border-blue-200 bg-blue-50 transition-all"
            >
              กลับไปดูข้อสอบที่ทำ
            </button>
          )}
          <button
            onClick={() => navigate('/portal')}
            className="h-14 rounded-2xl text-slate-700 font-bold text-[15px] font-sukhumvit border border-slate-200 bg-white transition-all"
          >
            กลับสู่หน้าหลัก
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Exam Interface ────────────────────────────────────────────────────────────
function ExamInterface({
  room, questions, answers, suspiciousActivities, endTime,
  onAnswer, onSubmit, onRecordSuspicious, isLoadingQuestions, readOnly = false, onExitReview,
}: {
  room: any;
  questions: any[];
  answers: Record<string, string>;
  suspiciousActivities: number;
  endTime: number;
  onAnswer: (qId: string, optId: string) => void;
  onSubmit: () => void;
  onRecordSuspicious: () => void;
  isLoadingQuestions?: boolean;
  readOnly?: boolean;
  onExitReview?: () => void;
}) {

  const [currentIdx, setCurrentIdx] = useState(0);
  const [showWarning, setShowWarning] = useState(false);
  const [warningMsg, setWarningMsg] = useState('');
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const hasAutoSubmittedRef = useRef(false);
  
  const { mm, ss, isUrgent, isExpired } = useCountdown(endTime);

  // Anti-cheat & Fullscreen
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        const nextSuspiciousCount = suspiciousActivities + 1;
        onRecordSuspicious();

        if (nextSuspiciousCount > 2 && !readOnly && !hasAutoSubmittedRef.current) {
          hasAutoSubmittedRef.current = true;
          setWarningMsg('ตรวจพบการสลับหน้าจอเกิน 2 ครั้ง ระบบจะส่งข้อสอบอัตโนมัติ');
          setShowWarning(true);
          setTimeout(() => {
            setShowWarning(false);
            onSubmit();
          }, 1500);
          return;
        }

        setWarningMsg(`ตรวจพบการสลับหน้าจอ (ครั้งที่ ${nextSuspiciousCount})`);
        setShowWarning(true);
        setTimeout(() => setShowWarning(false), 4000);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [onRecordSuspicious, onSubmit, readOnly, suspiciousActivities]);

  useEffect(() => {
    const blockCtx = (e: MouseEvent) => e.preventDefault();
    const blockCopy = (e: ClipboardEvent) => e.preventDefault();
    document.addEventListener('contextmenu', blockCtx);
    document.addEventListener('copy', blockCopy);
    return () => {
      document.removeEventListener('contextmenu', blockCtx);
      document.removeEventListener('copy', blockCopy);
    };
  }, []);

  useEffect(() => {
    if (isExpired && !readOnly) onSubmit();
  }, [isExpired, onSubmit, readOnly]);

  const handleContentClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'IMG' && (target as HTMLImageElement).src) {
      e.preventDefault();
      e.stopPropagation();
      setZoomedImage((target as HTMLImageElement).src);
    }
  };

  if (isLoadingQuestions) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-slate-900 bg-slate-50 font-sarabun gap-8">
        <IndeterminateProgress className="w-64" />
        <div className="text-center">
          <p className="text-lg font-bold text-slate-900">กำลังเตรียมข้อสอบ...</p>
          <p className="text-slate-500 text-sm mt-1">กรุณารอสักครู่ ระบบกำลังจัดเตรียมชุดข้อสอบให้คุณ</p>
        </div>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-slate-900 bg-slate-50 font-sarabun">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 rounded-3xl bg-white border border-slate-200 flex items-center justify-center mx-auto text-slate-400">
            <HelpCircle size={32} />
          </div>
          <p className="text-lg font-bold">ไม่พบข้อมูลข้อสอบ</p>
          <p className="text-slate-500">กรุณาแจ้งผู้ควบคุมการสอบ หรือรอสักครู่</p>
          <button onClick={() => window.location.reload()} className="px-6 py-2 rounded-xl bg-indigo-600 text-white font-bold">โหลดหน้าใหม่</button>
        </div>
      </div>
    );
  }

  const q = questions[currentIdx];
  const answeredCount = Object.keys(answers).length;
  const progress = (answeredCount / questions.length) * 100;

  return (
    <div className="min-h-screen bg-slate-50 relative overflow-y-auto select-none font-sarabun text-slate-900">
      <ExamBackground />

      {/* ── Warning toast ── */}
      <AnimatePresence>
        {showWarning && (
          <motion.div
            initial={{ opacity: 0, y: -40, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -40 }}
            className="fixed top-8 left-1/2 -translate-x-1/2 z-[100] px-6 py-3.5 rounded-[2rem] flex items-center gap-3 border border-red-200 bg-red-600/95 backdrop-blur-xl"
            style={{ background: '#be123c', border: '1px solid #fb7185' }}
          >
            <ShieldAlert size={18} className="text-white animate-pulse" />
            <p className="text-[14px] font-black font-sukhumvit text-white">{warningMsg}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Top Header ── */}
      <div className="fixed top-0 left-0 right-0 z-50 p-4 md:p-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="hidden md:flex flex-col">
            <h2 className="text-[11px] font-black text-blue-600 uppercase tracking-widest leading-none mb-1">Examination</h2>
            <p className="text-[15px] font-black text-slate-900 font-sukhumvit truncate max-w-[240px]">{room.title}</p>
          </div>
          {readOnly && (
            <span className="px-3 py-1 rounded-full bg-emerald-100 border border-emerald-300 text-[11px] font-black text-emerald-700 tracking-wide">
              โหมดดูคำตอบ
            </span>
          )}
        </div>

        {/* Global Progress Pill */}
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1 p-0.5 rounded-full bg-white border border-slate-200 shadow-sm backdrop-blur-xl">
          <div className="flex items-center gap-2.5 px-3 py-1.5">
             <div className="flex flex-col items-end">
                <span className="text-[9px] font-bold text-slate-500 leading-none">TIME</span>
                <span className={`text-[15px] font-black tabular-nums leading-none font-sukhumvit ${isUrgent ? 'text-rose-600' : 'text-slate-900'}`}>
                  {mm}:{ss}
                </span>
             </div>
             <div className="w-[1px] h-5 bg-slate-200" />
             <div className="flex flex-col">
                <span className="text-[9px] font-bold text-slate-500 leading-none">PROGRESS</span>
                <div className="flex items-center gap-2">
                  <span className="text-[15px] font-black leading-none font-sukhumvit text-slate-900">{Math.round(progress)}%</span>
                  <div className="w-10 h-1 rounded-full bg-slate-200 overflow-hidden">
                    <motion.div className="h-full bg-blue-600" animate={{ width: `${progress}%` }} />
                  </div>
                </div>
             </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={toggleFullscreen}
            className="w-10 h-10 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-900 transition-all"
          >
            {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
          <button 
            onClick={() => setShowMap(!showMap)}
            className="h-10 px-4 rounded-2xl bg-white border border-slate-200 flex items-center gap-2 text-[13px] font-bold text-slate-600 hover:text-slate-900 transition-all"
          >
            <LayoutGrid size={16} />
            <span className="hidden sm:inline">ข้อสอบ</span>
          </button>
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="relative z-10 min-h-screen flex flex-col md:flex-row items-stretch justify-start pt-24 pb-32 px-4 md:px-10 lg:px-20 gap-8">
        
        {/* Question Area */}
        <div className="flex flex-col items-center justify-start w-full">
          <div className="w-full max-w-4xl">
            <AnimatePresence mode="wait">
              <motion.div
                key={q.id}
                initial={{ opacity: 0, scale: 0.98, x: 20 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.98, x: -20 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                className="flex flex-col gap-10"
              >
                {/* Question Text */}
                <div className="space-y-4 text-left">
                   <div className="flex items-center justify-start gap-3">
                      <span className="px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-[11px] font-black text-indigo-400 tracking-[0.2em]">QUESTION {currentIdx + 1}</span>
                      <span className="text-[11px] font-bold text-slate-500 tracking-[0.1em]">{q.points} POINTS</span>
                   </div>
                    <div 
                      className="flex flex-col text-[24px] md:text-[32px] font-bold text-slate-900 font-sarabun leading-[1.5] text-balance cursor-pointer [&_p]:m-0 [&_p]:leading-[1.5] [&_div]:m-0 [&_div]:leading-[1.5] [&_span]:leading-[1.5] [&_img]:transition-all [&_img]:hover:brightness-105 [&_img]:order-last [&_img]:mt-6 [&_img]:w-full [&_img]:max-h-[300px] [&_img]:rounded-2xl [&_img]:border [&_img]:border-slate-200 [&_img]:bg-white [&_img]:p-1.5 [&_img]:object-contain [&_img]:cursor-zoom-in"
                      dangerouslySetInnerHTML={{ __html: q.text }}
                      onClick={handleContentClick}
                    />
                </div>

                {/* Options Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {q.options.map((opt: any, oi: number) => {
                    const isSelected = answers[q.id] === opt.id;
                    const label = String.fromCharCode(65 + oi);
                    return (
                      <motion.button
                        key={opt.id}
                        whileHover={{ backgroundColor: 'rgba(255,255,255,0.06)' }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => { if (!readOnly) onAnswer(q.id, opt.id); }}
                        disabled={readOnly}
                        className="group relative flex items-center gap-3 px-4 py-2.5 rounded-2xl text-left transition-all duration-300 border overflow-hidden"
                        style={{
                          background: isSelected ? 'rgba(37,99,235,0.08)' : 'rgba(255,255,255,0.96)',
                          borderColor: isSelected ? 'rgba(37,99,235,0.45)' : 'rgba(148,163,184,0.25)',
                          cursor: readOnly ? 'default' : 'pointer',
                        }}
                      >
                        {isSelected && (
                          <motion.div 
                            layoutId="active-opt"
                            className="absolute inset-0 bg-indigo-500/5 pointer-events-none"
                          />
                        )}
                        <div className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center font-black text-[14px] font-sukhumvit transition-all duration-300 ${
                            isSelected ? 'bg-blue-600 text-white border border-blue-500' : 'bg-slate-100 text-slate-500'
                          }`}>
                          {label}
                        </div>
                        <div 
                          className={`text-[15px] font-sarabun flex-1 transition-all duration-300 ${isSelected ? 'text-slate-900 font-bold' : 'text-slate-700 group-hover:text-slate-900'} cursor-pointer [&_img]:mt-2 [&_img]:block [&_img]:mx-auto [&_img]:w-full [&_img]:h-[170px] [&_img]:max-h-[170px] [&_img]:rounded-xl [&_img]:border [&_img]:border-slate-200 [&_img]:bg-white [&_img]:p-1 [&_img]:object-contain [&_img]:cursor-zoom-in`}
                          dangerouslySetInnerHTML={{ __html: opt.text }}
                          onClick={handleContentClick}
                        />
                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${isSelected ? 'border-blue-600 bg-blue-600' : 'border-slate-300 group-hover:border-slate-400'}`}>
                          {isSelected && <CheckCircle size={14} className="text-white" />}
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* ── Navigation bar ── */}
      <div className="fixed bottom-0 left-0 right-0 z-50">
        <div className="absolute inset-0 bg-white/90 border-t border-slate-200 backdrop-blur-xl" />
        <div className="relative p-4 md:p-6 flex items-center justify-center">
        <div className="w-full max-w-4xl flex items-center justify-between gap-4">
            <button 
              onClick={() => setCurrentIdx(p => Math.max(0, p - 1))}
              disabled={currentIdx === 0}
              className="w-10 h-10 md:w-auto md:px-5 rounded-xl bg-white border border-slate-200 flex items-center justify-center gap-2 text-[12px] font-black text-slate-600 hover:text-slate-900 disabled:opacity-20 transition-all"
            >
              <ChevronLeft size={16} />
              <span className="hidden md:inline">ข้อก่อนหน้า</span>
            </button>

           <div className="flex items-center gap-3">
              {readOnly ? (
                <button
                  onClick={() => onExitReview?.()}
                  className="h-10 px-6 rounded-xl bg-emerald-600 text-white font-black text-[13px] border border-emerald-500 hover:bg-emerald-500 transition-all flex items-center gap-2 font-sukhumvit"
                >
                  กลับหน้าสรุปผล
                </button>
              ) : (
                answeredCount === questions.length && (
                  <button 
                    onClick={() => setShowSubmitConfirm(true)}
                    className="h-10 px-6 rounded-xl bg-indigo-600 text-white font-black text-[13px] border border-indigo-500 hover:bg-indigo-500 transition-all flex items-center gap-2 font-sukhumvit"
                  >
                    <Send size={14} className="-rotate-12" /> ส่งข้อสอบ
                  </button>
                )
              )}
           </div>

           <button 
             onClick={() => setCurrentIdx(p => Math.min(questions.length - 1, p + 1))}
             disabled={currentIdx === questions.length - 1}
             className="w-10 h-10 md:w-auto md:px-5 rounded-xl bg-white border border-slate-200 flex items-center justify-center gap-2 text-[12px] font-black text-slate-600 hover:text-slate-900 disabled:opacity-20 transition-all"
           >
             <span className="hidden md:inline">ข้อถัดไป</span>
             <ChevronRight size={16} />
           </button>
        </div>
        </div>
      </div>

      {/* ── Question Map Overlay ── */}
      <AnimatePresence>
        {showMap && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowMap(false)}
              className="fixed inset-0 z-[60] bg-slate-900/35 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, x: '100%' }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: '100%' }}
              className="fixed right-0 top-0 bottom-0 z-[70] w-full max-w-[360px] bg-white border-l border-slate-200 p-8 flex flex-col gap-8"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-blue-600">
                  <LayoutGrid size={18} />
                  <h3 className="text-[18px] font-black font-sukhumvit text-slate-900">เลือกข้อสอบ</h3>
                </div>
                <button onClick={() => setShowMap(false)} className="text-slate-400 hover:text-slate-800 transition-all"><Maximize2 size={20} className="rotate-45" /></button>
              </div>

              <div className="grid grid-cols-5 gap-2">
                {questions.map((_, i) => (
                  <button 
                    key={i}
                    onClick={() => { setCurrentIdx(i); setShowMap(false); }}
                    className={`h-12 rounded-xl text-[14px] font-black transition-all flex items-center justify-center border ${
                      i === currentIdx 
                        ? 'bg-blue-600 border border-blue-500 text-white' 
                        : answers[questions[i].id]
                          ? 'bg-emerald-100 border-emerald-300 text-emerald-700'
                          : 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>

              <div className="mt-auto p-6 rounded-3xl bg-slate-50 border border-slate-200 space-y-4">
                 <div className="flex items-center justify-between text-[13px]">
                   <span className="text-slate-500">ทำไปแล้ว</span>
                   <span className="font-bold text-slate-900">{answeredCount} จาก {questions.length} ข้อ</span>
                 </div>
                 <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                    <motion.div className="h-full bg-emerald-500" animate={{ width: `${progress}%` }} />
                 </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Submit confirm ── */}
      <AnimatePresence>
        {!readOnly && showSubmitConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/35 backdrop-blur-sm"
              onClick={() => setShowSubmitConfirm(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative rounded-[3rem] p-10 flex flex-col gap-8 items-center text-center max-w-md w-full bg-white border border-slate-200"
            >
              <div className="w-20 h-20 rounded-[2.5rem] bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                <HelpCircle size={36} />
              </div>
              <div className="space-y-2">
                <h3 className="text-[24px] font-black text-slate-900 font-sukhumvit">ยืนยันการส่งข้อสอบ?</h3>
                <p className="text-[15px] text-slate-600 leading-relaxed">
                  ตรวจสอบความถูกต้องอีกครั้งก่อนส่งข้อมูล<br />
                  <span className="text-slate-800 font-bold">ตอบแล้ว {answeredCount} จาก {questions.length} ข้อ</span>
                </p>
                {answeredCount < questions.length && (
                  <div className="mt-4 px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 inline-block">
                    <p className="text-[12px] font-bold text-amber-400 uppercase tracking-wider">⚠️ คุณยังทำไม่ครบทุกข้อ!</p>
                  </div>
                )}
              </div>
              <div className="flex gap-3 w-full">
                <button onClick={() => setShowSubmitConfirm(false)}
                  className="flex-1 h-14 rounded-2xl text-[15px] font-bold text-slate-500 hover:text-slate-900 transition-all bg-slate-100 font-sukhumvit">
                  กลับไปทำต่อ
                </button>
                 <motion.button whileTap={{ scale: 0.98 }}
                  onClick={() => { setShowSubmitConfirm(false); onSubmit(); }}
                  className="flex-1 h-14 rounded-2xl text-[15px] font-black text-white font-sukhumvit transition-all border border-indigo-500 bg-indigo-600 hover:bg-indigo-500">
                  ส่งข้อสอบเลย
                </motion.button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Image Zoom (Lightbox) ── */}
      <AnimatePresence>
        {zoomedImage && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 md:p-10">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setZoomedImage(null)}
              className="absolute inset-0 bg-slate-950/90 backdrop-blur-md cursor-zoom-out" 
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative max-w-full max-h-full flex flex-col items-center gap-4"
            >
              <img 
                src={zoomedImage} 
                alt="Zoomed" 
                className="max-w-[96vw] max-h-[92vh] rounded-3xl border border-white/20 shadow-2xl object-contain" 
              />
              <button 
                onClick={() => setZoomedImage(null)}
                className="h-12 px-6 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-[14px] backdrop-blur-xl transition-all"
              >
                ปิดหน้าต่าง
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main Export ───────────────────────────────────────────────────────────────
export default function StudentExamPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { attempt, room, questions, isJoining, isLoadingQuestions, error, joinRoom, saveAnswer, recordSuspicious, submitAttempt, isSubmitted } = useExamAttempt(roomId || '');
  const [isReviewMode, setIsReviewMode] = useState(false);

  // If no roomId in URL, redirect to portal
  useEffect(() => {
    if (!roomId) navigate('/portal');
  }, [roomId, navigate]);

  const handleSubmit = useCallback(() => {
    submitAttempt();
  }, [submitAttempt]);

  if (!attempt || !room) {
    return (
      <JoinScreen
        roomId={roomId || ''}
        onJoin={joinRoom}
        isJoining={isJoining}
        error={error}
      />
    );
  }

  if ((isSubmitted || attempt.status === 'submitted' || attempt.status === 'graded') && !isReviewMode) {
    return (
      <ResultScreen
        score={attempt?.score ?? null}
        total={room?.totalPoints ?? 0}
        canReview={questions.length > 0}
        onReview={() => setIsReviewMode(true)}
      />
    );
  }

  return (
    <ExamInterface
      room={room}
      questions={questions}
      answers={attempt.answers}
      suspiciousActivities={attempt.suspiciousActivities}
      endTime={room.endTime}
      onAnswer={saveAnswer}
      onSubmit={handleSubmit}
      onRecordSuspicious={recordSuspicious}
      isLoadingQuestions={isLoadingQuestions}
      readOnly={isSubmitted || attempt.status === 'submitted' || attempt.status === 'graded'}
      onExitReview={() => setIsReviewMode(false)}
    />
  );
}
