import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldAlert, CheckCircle, ChevronLeft, ChevronRight,
  Send, Lock, AlertTriangle, Eye, EyeOff,
  Maximize2, LayoutGrid, Info, HelpCircle, ClipboardList, FileText
} from 'lucide-react';

import { IndeterminateProgress } from '@/components/ui/progress';
import { useExamAttempt, type ExamAnswerSheetGroup, type ExamPdfPart, type ExamRoomPreview } from '@/hooks/useExamRoom';
import { useAuth } from '@/hooks/useAuth';
import { Input } from '@/components/ui/input';
import { PdfAnswerSheet, PdfPagePagination, PdfPageViewer } from '@/features/exam/components/PdfExamViewer';
import ExamQuestionContent from '@/features/questionBank/components/ExamQuestionContent';
import EssayAnswerPanel from '@/features/exam/components/EssayAnswerPanel';
import { isExamAnswerFilled } from '@/lib/exam/examAnswerFormat';
import {
  canSubmitExamManually,
  formatExamSubmitWait,
  getExamSubmitWaitSeconds,
} from '@/lib/exam/examSubmitPolicy';
import { getVisiblePdfPages, snapToVisiblePdfPage } from '@/features/questionBank/utils/pdfExamPages';
import { getPartBadgeTheme } from '@/features/exam/utils/partBadgeTheme';
import { colors } from '@/lib/designTokens';
import {
  resolveAttemptObjectiveScoreDisplay,
  resolveAttemptScoreDisplay,
} from '@/lib/exam/examRoomScoring';
import type { ExamAttempt, ExamRoom } from '@/types/exam';
import { cn } from '@/lib/utils';
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

// ── Background Component (matches Portal Dashboard shell) ───────────────────
function ExamBackground() {
  return (
    <div
      className="fixed inset-0 z-0 pointer-events-none"
      style={{ background: colors.palette.shell }}
    />
  );
}

function resolveJoinGradeLabel(preview: ExamRoomPreview | null): string {
  if (!preview) return '';
  if (preview.gradeLevel?.trim()) return preview.gradeLevel.trim();
  const fromClass = preview.className?.split('/')[0]?.trim();
  return fromClass || '';
}

// ── Join Screen ───────────────────────────────────────────────────────────────
function JoinScreen({
  roomPreview, onJoin, isJoining, error,
}: {
  roomPreview: ExamRoomPreview | null;
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
    await onJoin(password, studentUid, finalName);
  }, [password, studentName, onJoin, user]);

  const gradeLabel = resolveJoinGradeLabel(roomPreview);
  const roomTitle = roomPreview?.title || 'ห้องสอบออนไลน์';
  const subjectLabel = roomPreview?.subjectName?.trim() || '';

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 relative overflow-hidden font-sarabun">
      <ExamBackground />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-[360px] rounded-2xl flex flex-col gap-4 overflow-hidden bg-white border border-slate-200 shadow-xl"
      >
        <div className="px-4 pt-4">
          <button
            onClick={() => navigate('/portal')}
            className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-all"
            aria-label="กลับหน้าหลัก"
          >
            <ChevronLeft size={18} />
          </button>
        </div>

        <div className="flex flex-col items-center text-center gap-2 px-5 -mt-1">
          <div
            className="shrink-0 w-11 h-11 rounded-xl flex items-center justify-center border border-blue-100"
            style={{ background: 'linear-gradient(135deg, #2563eb, #06b6d4)' }}
          >
            <Lock size={18} className="text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider leading-none mb-1">
              เข้าห้องสอบ
            </p>
            <h1 className="text-[17px] font-black text-slate-900 font-sukhumvit leading-snug line-clamp-2">
              {roomTitle}
            </h1>
            {(gradeLabel || subjectLabel) && (
              <div className="flex flex-wrap items-center justify-center gap-1.5 mt-1.5">
                {gradeLabel && (
                  <span className="px-2 py-0.5 rounded-md bg-blue-50 border border-blue-100 text-[11px] font-black text-blue-700 font-sukhumvit">
                    {gradeLabel}
                  </span>
                )}
                {subjectLabel && (
                  <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-[11px] font-bold text-slate-600 truncate max-w-[160px]">
                    {subjectLabel}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-3 px-5 pb-5">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">
              รหัสผ่านเข้าสอบ
            </label>
            <div className="relative">
              <Input
                value={password}
                onChange={e => setPassword(e.target.value)}
                type={showPassword ? 'text' : 'password'}
                placeholder="กรอกรหัสผ่าน"
                className="h-11 rounded-xl border border-slate-200 text-slate-900 text-[15px] font-bold bg-white focus:bg-white transition-all pl-4 pr-11"
                onKeyDown={e => { if (e.key === 'Enter') handleJoin(); }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-rose-50 border border-rose-200"
              >
                <AlertTriangle size={15} className="text-rose-500 shrink-0" />
                <p className="text-[12px] text-rose-700 font-medium">{error}</p>
              </motion.div>
            )}
          </AnimatePresence>

          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={handleJoin}
            disabled={isJoining || !password}
            className="h-11 rounded-xl text-white font-black text-[14px] font-sukhumvit transition-all disabled:opacity-30 disabled:cursor-not-allowed border border-blue-600 flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700"
          >
            {isJoining ? (
              <IndeterminateProgress className="w-28" white />
            ) : (
              <>เริ่มทำข้อสอบ <ChevronRight size={16} /></>
            )}
          </motion.button>

          <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-400">
            <ShieldAlert size={11} />
            <span>ระบบป้องกันการทุจริตกำลังทำงาน</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

import type { ExamQuestionPublic } from '@/types/exam';

// ── Result summary ────────────────────────────────────────────────────────────
function resolveResultSummary({
  room,
  attempt,
  status,
  pendingManualGrading,
  objectiveMaxPoints,
  manualEssayCount,
  questions,
}: {
  room: ExamRoom;
  attempt: ExamAttempt;
  status: string;
  pendingManualGrading?: boolean;
  objectiveMaxPoints?: number | null;
  manualEssayCount?: number;
  questions: ExamQuestionPublic[];
}) {
  const essayCountFromQuestions = questions.filter((q) => q.questionType === 'essay').length;
  const manualCount = manualEssayCount ?? essayCountFromQuestions;
  const pending = pendingManualGrading === true
    || (pendingManualGrading !== false && status === 'submitted' && manualCount > 0);

  const objectiveMaxFromQuestions = questions
    .filter((q) => q.questionType !== 'essay')
    .reduce((sum, q) => sum + (q.points || 0), 0);

  if (pending && manualCount > 0) {
    const display = resolveAttemptObjectiveScoreDisplay(
      attempt,
      objectiveMaxPoints ?? objectiveMaxFromQuestions,
    );
    return {
      pendingManual: true,
      manualCount,
      displayScore: display.score,
      displayMax: display.maxPoints,
      pct: display.percent,
    };
  }

  const display = resolveAttemptScoreDisplay(room, attempt);
  return {
    pendingManual: false,
    manualCount: 0,
    displayScore: display.score,
    displayMax: display.maxPoints,
    pct: display.percent,
  };
}

// ── Result Screen ─────────────────────────────────────────────────────────────
function ResultScreen({
  room,
  attempt,
  status,
  pendingManualGrading,
  objectiveMaxPoints,
  manualEssayCount,
  questions,
}: {
  room: ExamRoom;
  attempt: ExamAttempt;
  status: string;
  pendingManualGrading?: boolean;
  objectiveMaxPoints?: number | null;
  manualEssayCount?: number;
  questions: ExamQuestionPublic[];
}) {
  const navigate = useNavigate();
  const summary = resolveResultSummary({
    room,
    attempt,
    status,
    pendingManualGrading,
    objectiveMaxPoints,
    manualEssayCount,
    questions,
  });

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 relative overflow-hidden font-sarabun">
      <ExamBackground />

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="relative z-10 w-full max-w-[340px] rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_2px_8px_rgba(15,23,42,0.035)]"
      >
        <div className="flex items-start gap-3">
          <div
            className="shrink-0 w-11 h-11 rounded-xl flex items-center justify-center border border-emerald-200"
            style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
          >
            <CheckCircle size={22} className="text-white" />
          </div>
          <div className="min-w-0 flex-1 text-left pt-0.5">
            <h1 className="text-[17px] font-black text-slate-900 font-sukhumvit leading-snug">
              ส่งข้อสอบเรียบร้อย
            </h1>
            <p className="mt-0.5 text-[12px] text-slate-500 leading-snug">
              ส่งคำตอบเข้าระบบแล้ว
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          {summary.pct !== null ? (
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className={`text-[10px] font-bold uppercase tracking-wider ${summary.pendingManual ? 'text-blue-600' : 'text-emerald-600'}`}>
                  {summary.pendingManual ? 'คะแนนข้อปรนัย' : 'คะแนน'}
                </p>
                <p className="mt-0.5 text-[13px] font-bold text-slate-600">
                  {summary.displayScore} / {summary.displayMax} คะแนน
                </p>
              </div>
              <p className="text-[36px] font-black font-sukhumvit text-slate-900 leading-none tabular-nums">
                {summary.pct}
                <span className="text-[16px] text-slate-400 ml-0.5">%</span>
              </p>
            </div>
          ) : status === 'submitted' && summary.displayScore === null ? (
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-600 shrink-0">
                <Info size={16} />
              </div>
              <p className="text-[12px] text-slate-600 leading-snug text-left">
                ส่งคำตอบแล้ว — รอครูปิดห้องสอบเพื่อสรุปคะแนนทั้งรอบ
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-500 shrink-0">
                <Info size={16} />
              </div>
              <p className="text-[12px] text-slate-600 leading-snug text-left">
                รอคุณครูสรุปคะแนนและประกาศผลผ่านแดชบอร์ด
              </p>
            </div>
          )}
        </div>

        {summary.pendingManual && (
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 flex items-start gap-2.5">
            <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
            <div className="min-w-0 text-left">
              <p className="text-[12px] font-bold text-amber-800 font-sukhumvit leading-snug">
                มีข้ออัตนัย {summary.manualCount} ข้อ รอครูตรวจเพิ่ม
              </p>
              <p className="mt-0.5 text-[11px] text-amber-700/90 leading-snug">
                คะแนนรวมจะประกาศหลังตรวจครบทุกข้อ
              </p>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => navigate('/portal')}
          className="mt-4 w-full h-10 rounded-xl text-slate-700 font-bold text-[13px] font-sukhumvit border border-slate-200 bg-white hover:bg-slate-50 transition-colors"
        >
          กลับสู่หน้าหลัก
        </button>
      </motion.div>
    </div>
  );
}

// ── Exam Interface ────────────────────────────────────────────────────────────
function ExamInterface({
  room, roomId, attemptId, questions, answers, suspiciousActivities, endTime, startedAt, examPdfParts, answerSheetGroups,
  onAnswer, onSubmit, onRecordSuspicious, isLoadingQuestions, readOnly = false, onExitReview,
}: {
  room: any;
  roomId: string;
  attemptId: string;
  questions: any[];
  answers: Record<string, string>;
  suspiciousActivities: number;
  endTime: number;
  startedAt: number;
  examPdfParts: ExamPdfPart[];
  answerSheetGroups: ExamAnswerSheetGroup[];
  onAnswer: (qId: string, value: string) => void;
  onSubmit: (options?: { force?: boolean }) => void;
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
  const [pdfPanelMode, setPdfPanelMode] = useState<'pdf' | 'answers'>('pdf');
  const [activePdfPartIndex, setActivePdfPartIndex] = useState(0);
  const [pdfPageNum, setPdfPageNum] = useState(1);
  const [pdfTotalPages, setPdfTotalPages] = useState(0);
  const [pdfLoading, setPdfLoading] = useState(true);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const suppressSuspiciousRef = useRef(false);
  const suppressSuspiciousUntilRef = useRef(0);
  const answerSheetPartGroups = useMemo(
    () => answerSheetGroups.map((group) => ({
      partLabel: group.partLabel,
      title: group.title,
      questions: group.questions,
    })),
    [answerSheetGroups],
  );
  const hasPdfExam = examPdfParts.length > 0;
  const activePdfPart = examPdfParts[activePdfPartIndex] ?? examPdfParts[0] ?? null;
  const activePdfHiddenPages = activePdfPart?.examPdfHiddenPages ?? [];

  useEffect(() => {
    if (activePdfPartIndex >= examPdfParts.length) {
      setActivePdfPartIndex(0);
    }
  }, [activePdfPartIndex, examPdfParts.length]);

  const handleSelectPdfPart = useCallback((index: number) => {
    setActivePdfPartIndex(index);
    setPdfPageNum(1);
    setPdfTotalPages(0);
    setPdfLoading(true);
    setPdfError(null);
  }, []);

  const hasAutoSubmittedRef = useRef(false);
  const { mm, ss, isUrgent, isExpired } = useCountdown(endTime);
  const [submitWaitSeconds, setSubmitWaitSeconds] = useState(() => getExamSubmitWaitSeconds(startedAt));
  const canSubmitManually = canSubmitExamManually(startedAt);

  useEffect(() => {
    const tick = () => setSubmitWaitSeconds(getExamSubmitWaitSeconds(startedAt));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [startedAt]);

  const requestManualSubmit = useCallback(() => {
    if (!canSubmitExamManually(startedAt)) {
      toast.error(`ยังไม่สามารถส่งข้อสอบได้ กรุณารออีก ${formatExamSubmitWait(submitWaitSeconds)}`);
      return;
    }
    setShowSubmitConfirm(true);
  }, [startedAt, submitWaitSeconds]);

  const handleCameraSessionChange = useCallback((active: boolean) => {
    if (active) {
      suppressSuspiciousRef.current = true;
      suppressSuspiciousUntilRef.current = Date.now() + 6000;
      return;
    }
    suppressSuspiciousUntilRef.current = Date.now() + 2000;
    window.setTimeout(() => {
      if (Date.now() >= suppressSuspiciousUntilRef.current) {
        suppressSuspiciousRef.current = false;
      }
    }, 2100);
  }, []);

  // Anti-cheat
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        if (suppressSuspiciousRef.current || Date.now() < suppressSuspiciousUntilRef.current) {
          return;
        }
        const nextSuspiciousCount = suspiciousActivities + 1;
        onRecordSuspicious();

        if (nextSuspiciousCount > 2 && !readOnly && !hasAutoSubmittedRef.current) {
          hasAutoSubmittedRef.current = true;
          setWarningMsg('ตรวจพบการสลับหน้าจอเกิน 2 ครั้ง ระบบจะส่งข้อสอบอัตโนมัติ');
          setShowWarning(true);
          setTimeout(() => {
            setShowWarning(false);
            onSubmit({ force: true });
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
    if (isExpired && !readOnly) onSubmit({ force: true });
  }, [isExpired, onSubmit, readOnly]);

  const handlePdfLoadState = useCallback(
    (state: { pageNum: number; totalPages: number; loading: boolean; error: string | null }) => {
      setPdfTotalPages(state.totalPages);
      setPdfLoading(state.loading);
      setPdfError(state.error);
      setPdfPageNum((prev) => (prev === state.pageNum ? prev : state.pageNum));
    },
    [],
  );

  const pdfVisiblePages = useMemo(
    () => getVisiblePdfPages(pdfTotalPages, activePdfHiddenPages),
    [pdfTotalPages, activePdfHiddenPages],
  );

  useEffect(() => {
    if (pdfVisiblePages.length === 0) return;
    setPdfPageNum((prev) => snapToVisiblePdfPage(prev, pdfVisiblePages));
  }, [pdfVisiblePages]);

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
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-slate-900 font-sarabun gap-8" style={{ background: colors.palette.shell }}>
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
      <div className="min-h-screen flex items-center justify-center p-6 text-slate-900 font-sarabun" style={{ background: colors.palette.shell }}>
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
  const answeredCount = questions.filter((question) =>
    isExamAnswerFilled(answers[question.id], question.questionType === 'essay'),
  ).length;
  const progress = (answeredCount / questions.length) * 100;

  return (
    <div
      className={cn(
        'relative select-none font-sarabun text-slate-900',
        hasPdfExam ? 'flex h-dvh flex-col overflow-hidden' : 'flex h-dvh flex-col overflow-y-auto overscroll-y-contain',
      )}
    >
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
      <div className={cn('z-50 shrink-0', hasPdfExam ? 'relative' : 'sticky top-0')}>
        <div className="absolute inset-0 bg-white/90 border-b border-slate-200 backdrop-blur-xl" />
        <div className="relative p-4 md:p-6 flex items-center justify-between">
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
             <span className={`text-[15px] font-black tabular-nums leading-none font-sukhumvit ${isUrgent ? 'text-rose-600' : 'text-slate-900'}`}>
               {mm}:{ss}
             </span>
             <div className="w-[1px] h-5 bg-slate-200" />
             <div className="flex items-center gap-2">
               <span className="text-[15px] font-black leading-none font-sukhumvit text-slate-900">{Math.round(progress)}%</span>
               <div className="w-10 h-1 rounded-full bg-slate-200 overflow-hidden">
                 <motion.div className="h-full bg-blue-600" animate={{ width: `${progress}%` }} />
               </div>
             </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            title={
              hasPdfExam
                ? pdfPanelMode === 'pdf'
                  ? 'กระดาษคำตอบ'
                  : 'ดูข้อสอบ'
                : 'เลือกข้อสอบ'
            }
            onClick={() => {
              if (hasPdfExam) {
                setPdfPanelMode(m => (m === 'pdf' ? 'answers' : 'pdf'));
                return;
              }
              setShowMap(!showMap);
            }}
            className={`w-10 h-10 rounded-full border flex items-center justify-center shrink-0 transition-all shadow-[0_2px_8px_rgba(15,23,42,0.08)] lg:hidden ${
              hasPdfExam && pdfPanelMode === 'answers'
                ? 'bg-blue-50 border-blue-300 text-blue-700'
                : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900'
            }`}
          >
            {hasPdfExam ? (
              pdfPanelMode === 'pdf' ? (
                <ClipboardList size={16} />
              ) : (
                <FileText size={16} />
              )
            ) : (
              <LayoutGrid size={16} />
            )}
          </button>
        </div>
        </div>
      </div>

      {/* ── Main content ── */}
      {hasPdfExam && activePdfPart ? (
        <div className="relative z-10 flex min-h-0 flex-1 flex-col gap-4 overflow-hidden px-4 pb-28 pt-2 md:px-6 lg:flex-row lg:gap-0 lg:divide-x lg:divide-slate-200">
          <div
            className={cn(
              'flex min-h-0 flex-1 flex-col overflow-hidden lg:pr-6',
              pdfPanelMode !== 'pdf' ? 'hidden lg:flex' : 'flex',
            )}
          >
            {examPdfParts.length > 1 && (
              <div className="mb-2 flex shrink-0 gap-2 overflow-x-auto pb-1 scrollbar-hide">
                {examPdfParts.map((part, index) => {
                  const isActive = index === activePdfPartIndex;
                  const theme = getPartBadgeTheme(index);
                  return (
                    <button
                      key={part.setId}
                      type="button"
                      onClick={() => handleSelectPdfPart(index)}
                      className={cn(
                        'shrink-0 rounded-xl border px-3 py-2 text-left transition-colors',
                        isActive
                          ? theme.tabActive
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50',
                      )}
                      aria-pressed={isActive}
                    >
                      <span
                        className={cn(
                          'inline-block rounded-md px-1.5 py-0.5 font-sukhumvit text-[10px] font-black uppercase tracking-wide text-white',
                          theme.badge,
                        )}
                      >
                        {part.partLabel}
                      </span>
                      <span className="block max-w-[10rem] truncate font-sarabun text-[11px] font-bold">
                        {part.title}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
            <p className="mb-2 hidden shrink-0 font-sukhumvit text-[11px] font-black uppercase tracking-[0.15em] text-slate-500 lg:block">
              {examPdfParts.length > 1 ? activePdfPart.partLabel : 'ข้อสอบ PDF'}
              {examPdfParts.length > 1 && (
                <span className="ml-2 font-sarabun font-bold normal-case tracking-normal text-slate-400">
                  {activePdfPart.title}
                </span>
              )}
            </p>
            <PdfPageViewer
              key={activePdfPart.setId}
              url={activePdfPart.examPdfUrl}
              className="min-h-0 flex-1"
              pageNum={pdfPageNum}
              onPageNumChange={setPdfPageNum}
              onLoadStateChange={handlePdfLoadState}
              showPagination={false}
              hiddenPages={activePdfHiddenPages}
              applyHiddenPages
            />
          </div>
          <div
            className={cn(
              'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden lg:pl-6',
              pdfPanelMode !== 'answers' ? 'hidden lg:flex' : 'flex',
            )}
          >
            <PdfAnswerSheet
              questions={questions}
              groups={answerSheetPartGroups.length > 0 ? answerSheetPartGroups : undefined}
              answers={answers}
              readOnly={readOnly}
              onAnswer={onAnswer}
              roomId={roomId}
              attemptId={attemptId}
              onCameraSessionChange={handleCameraSessionChange}
              className="min-h-0 flex-1"
            />
          </div>
        </div>
      ) : (
      <div className="relative z-10 flex flex-col md:flex-row items-stretch justify-start pt-5 md:pt-6 pb-32 px-4 md:px-10 lg:px-20 gap-8">
        
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
                className="flex flex-col gap-4"
              >
                {/* Question Text */}
                <div className="space-y-3 text-left">
                   <div className="flex items-center justify-start gap-3">
                      <span className="px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-[11px] font-black text-blue-600 tracking-[0.2em]">QUESTION {currentIdx + 1}</span>
                      <span className="text-[11px] font-bold text-slate-500 tracking-[0.1em]">{q.points} POINTS</span>
                   </div>
                    <div onClick={handleContentClick}>
                      <ExamQuestionContent
                        html={q.text}
                        variant="question"
                        onImagePreview={setZoomedImage}
                      />
                    </div>
                </div>

                {q.questionType === 'essay' ? (
                  <EssayAnswerPanel
                    questionId={q.id}
                    value={answers[q.id]}
                    readOnly={readOnly}
                    roomId={roomId}
                    attemptId={attemptId}
                    onSave={onAnswer}
                    onCameraSessionChange={handleCameraSessionChange}
                  />
                ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {q.options.map((opt: any, oi: number) => {
                    const isSelected = answers[q.id] === opt.id;
                    const label = String.fromCharCode(65 + oi);
                    return (
                      <motion.button
                        key={opt.id}
                        whileHover={{ backgroundColor: 'rgba(255,255,255,0.06)' }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => {
                          if (readOnly) return;
                          onAnswer(q.id, isSelected ? '' : opt.id);
                        }}
                        disabled={readOnly}
                        className="group relative flex items-center gap-3 px-4 py-2.5 rounded-2xl text-left transition-all duration-300 border overflow-hidden"
                        style={{
                          background: '#ffffff',
                          border: isSelected
                            ? '1.5px solid rgba(37,99,235,0.45)'
                            : '1px solid rgba(148,163,184,0.25)',
                          cursor: readOnly ? 'default' : 'pointer',
                        }}
                      >
                        <div className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center font-black text-[14px] font-sukhumvit transition-all duration-300 ${
                            isSelected ? 'bg-blue-600 text-white border border-blue-500' : 'bg-slate-100 text-slate-500'
                          }`}>
                          {label}
                        </div>
                        <div
                          className="min-w-0 flex-1"
                          onClick={handleContentClick}
                        >
                          <ExamQuestionContent
                            html={opt.text}
                            variant="option"
                            onImagePreview={setZoomedImage}
                            className={cn(
                              'bg-transparent px-0 py-0',
                              isSelected && 'font-bold text-slate-900',
                            )}
                          />
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
      )}

      {/* ── Navigation bar ── */}
      <div className="fixed bottom-0 left-0 right-0 z-50">
        <div className="absolute inset-0 bg-white/90 border-t border-slate-200 backdrop-blur-xl" />
        <div className="relative p-4 md:p-6 flex items-center justify-center">
        <div className="w-full max-w-4xl flex items-center justify-between gap-4">
            {hasPdfExam ? (
              <div className="relative flex w-full min-h-10 items-center justify-center">
                {pdfTotalPages > 0 && !pdfError && (
                  <PdfPagePagination
                    pageNum={pdfPageNum}
                    totalPages={pdfTotalPages}
                    onPageChange={setPdfPageNum}
                    disabled={pdfLoading}
                    appearance="inline"
                    enableKeyboard={pdfPanelMode === 'pdf'}
                    className={cn(pdfPanelMode !== 'pdf' && 'hidden lg:flex')}
                    visiblePages={
                      activePdfHiddenPages.length > 0 && pdfVisiblePages.length > 0
                        ? pdfVisiblePages
                        : undefined
                    }
                  />
                )}
                <div className="absolute right-0 top-1/2 flex -translate-y-1/2 items-center gap-3">
                  {readOnly ? (
                    <button
                      onClick={() => onExitReview?.()}
                      className="h-10 px-6 rounded-xl bg-emerald-600 text-white font-black text-[13px] border border-emerald-500 hover:bg-emerald-500 transition-all flex items-center gap-2 font-sukhumvit"
                    >
                      กลับหน้าสรุปผล
                    </button>
                  ) : (
                    answeredCount === questions.length && (
                      canSubmitManually ? (
                        <button
                          onClick={requestManualSubmit}
                          className="h-10 px-6 rounded-xl bg-blue-600 text-white font-black text-[13px] border border-blue-500 hover:bg-blue-700 transition-all flex items-center gap-2 font-sukhumvit"
                        >
                          <Send size={14} className="-rotate-12" /> ส่งข้อสอบ
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled
                          className="h-10 px-5 rounded-xl bg-slate-200 text-slate-500 font-black text-[12px] border border-slate-300 cursor-not-allowed flex items-center gap-2 font-sukhumvit"
                          title={`ส่งได้ในอีก ${formatExamSubmitWait(submitWaitSeconds)}`}
                        >
                          <Send size={14} className="-rotate-12 opacity-50" />
                          ส่งได้ในอีก {formatExamSubmitWait(submitWaitSeconds)}
                        </button>
                      )
                    )
                  )}
                </div>
              </div>
            ) : (
              <>
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
                  canSubmitManually ? (
                    <button
                      onClick={requestManualSubmit}
                      className="h-10 px-6 rounded-xl bg-blue-600 text-white font-black text-[13px] border border-blue-500 hover:bg-blue-700 transition-all flex items-center gap-2 font-sukhumvit"
                    >
                      <Send size={14} className="-rotate-12" /> ส่งข้อสอบ
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="h-10 px-5 rounded-xl bg-slate-200 text-slate-500 font-black text-[12px] border border-slate-300 cursor-not-allowed flex items-center gap-2 font-sukhumvit"
                      title={`ส่งได้ในอีก ${formatExamSubmitWait(submitWaitSeconds)}`}
                    >
                      <Send size={14} className="-rotate-12 opacity-50" />
                      ส่งได้ในอีก {formatExamSubmitWait(submitWaitSeconds)}
                    </button>
                  )
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
              </>
            )}
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
                        : isExamAnswerFilled(
                            answers[questions[i].id],
                            questions[i].questionType === 'essay',
                          )
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
                  className="flex-1 h-14 rounded-2xl text-[15px] font-black text-white font-sukhumvit transition-all border border-blue-500 bg-blue-600 hover:bg-blue-700">
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
  const { user, isLoading: authLoading } = useAuth();
  const { attempt, room, roomPreview, questions, examPdfParts, answerSheetGroups, isJoining, isLoadingQuestions, error, joinRoom, saveAnswer, recordSuspicious, submitAttempt, isSubmitted } = useExamAttempt(roomId || '');

  // If no roomId in URL, redirect to portal
  useEffect(() => {
    if (!roomId) navigate('/portal');
  }, [roomId, navigate]);

  // Exam content (question_sets) requires signed-in student — redirect to login with return URL
  useEffect(() => {
    if (authLoading || !roomId) return;
    if (!user) {
      navigate(`/login?redirect=${encodeURIComponent(`/exam/${roomId}`)}`, { replace: true });
    }
  }, [authLoading, user, roomId, navigate]);

  const handleSubmit = useCallback((options?: { force?: boolean }) => {
    submitAttempt(options);
  }, [submitAttempt]);

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: colors.palette.shell }}>
        <IndeterminateProgress />
      </div>
    );
  }

  if (!roomId) return null;

  if (!attempt || !room) {
    return (
      <JoinScreen
        roomPreview={roomPreview}
        onJoin={joinRoom}
        isJoining={isJoining}
        error={error}
      />
    );
  }

  if (isSubmitted || attempt.status === 'submitted' || attempt.status === 'graded') {
    return (
      <ResultScreen
        room={room}
        attempt={attempt}
        status={attempt.status}
        pendingManualGrading={attempt.pendingManualGrading}
        objectiveMaxPoints={attempt.objectiveMaxPoints}
        manualEssayCount={attempt.manualEssayCount}
        questions={questions}
      />
    );
  }

  return (
    <ExamInterface
      room={room}
      roomId={roomId}
      attemptId={attempt.id}
      questions={questions}
      answers={attempt.answers}
      suspiciousActivities={attempt.suspiciousActivities}
      endTime={room.endTime}
      startedAt={attempt.startedAt}
      examPdfParts={examPdfParts}
      answerSheetGroups={answerSheetGroups}
      onAnswer={saveAnswer}
      onSubmit={handleSubmit}
      onRecordSuspicious={recordSuspicious}
      isLoadingQuestions={isLoadingQuestions}
    />
  );
}
