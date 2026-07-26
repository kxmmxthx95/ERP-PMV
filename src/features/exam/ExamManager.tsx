// src/features/exam/ExamManager.tsx
import { useState, useMemo, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { collection, doc, getDocs, onSnapshot, query, serverTimestamp, where, writeBatch } from 'firebase/firestore';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from 'recharts';
import {
  ClipboardList, Plus, Play, Square, Trash2, Eye,
  X, Pencil,
  ShieldAlert, Users, CheckCircle2,
  BookOpen, Check, Link2,
  BarChart2, Trophy, TrendingUp, RotateCcw
} from 'lucide-react';
import {
  HiArrowLeft,
  HiUsers,
  HiDocumentText,
  HiBookOpen,
  HiAdjustmentsHorizontal,
  HiMiniPencil,
  HiMiniTrash,
  HiEye,
  HiStop,
  HiPresentationChartLine,
  HiChevronDown,
  HiClock,
  HiPlay,
  HiLockClosed,
  HiSquares2X2,
  HiBars3,
  HiCheckCircle,
  HiCheck,
  HiXMark,
  HiChevronRight,
  HiChevronLeft,
  HiArrowDownTray,
  HiOutlineXMark,
} from 'react-icons/hi2';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { cn } from '@/lib/utils';
import type { IconType } from 'react-icons';
import { Skeleton } from '@/components/ui/skeleton';
import { IndeterminateProgress } from '@/components/ui/progress';
import StudentAvatar from '@/features/students/components/StudentAvatar';
import { StudentExamScoreDetailDrawer } from '@/features/exam/components/StudentExamScoreDetailDrawer';
import { ExamManualGradingDrawer } from '@/features/exam/components/ExamManualGradingDrawer';
import ExamRoomsMobileFilterDrawer from '@/features/exam/components/ExamRoomsMobileFilterDrawer';
import { CreateRoomModal, type CreateRoomPrefill } from '@/features/exam/components/CreateRoomModal';
import {
  ExamMobileFilterTriggerButton,
} from '@/features/exam/components/ExamMobileFilterMenuButton';
import { fetchRoomRoundExamData } from '@/lib/exam/fetchRoomRoundQuestions';
import {
  countPendingManualAttempts,
  getManualEssayQuestions,
  resolveAttemptTotalScore,
} from '@/lib/exam/manualEssayGrading';
import { toast } from 'sonner';
import { useExamShell } from '@/features/exam/ExamLayout';
import { matchesTeacherIdentity } from '@/lib/teachers/teacherIdentity';
import { HEADER_ICON_BTN, HEADER_ICON_BTN_GROUP } from '@/lib/headerIconBtn';
import GradeBookClassSidebar from '@/features/grades/components/GradeBookClassSidebar';
import SidebarCollapseButton from '@/features/grades/components/SidebarCollapseButton';

function DeleteConfirmDialog({
  open,
  onClose,
  onConfirm,
  roomTitle
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  roomTitle: string;
}) {
  const [confirmValue, setConfirmValue] = useState('');
  const isMatch = confirmValue.trim() === roomTitle.trim();

  // Reset input when dialog closes
  useEffect(() => {
    if (!open) setConfirmValue('');
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="max-w-[400px] rounded-[2.5rem] p-0 overflow-hidden border-none shadow-2xl">
        <div className="p-8 flex flex-col items-center text-center">
          <div className="w-20 h-20 rounded-[2.5rem] bg-rose-50 flex items-center justify-center text-rose-500 mb-6">
            <Trash2 size={40} strokeWidth={1.5} />
          </div>
          
          <DialogTitle className="text-[22px] font-black text-slate-800 font-sukhumvit mb-2">ยืนยันการลบห้องสอบ?</DialogTitle>
          <p className="text-[14px] text-slate-500 font-sarabun leading-relaxed mb-6">
            คุณแน่ใจหรือไม่ว่าต้องการลบห้องสอบ <span className="font-bold text-slate-800">"{roomTitle}"</span>? 
            <br />กรุณาพิมพ์ชื่อห้องสอบเพื่อยืนยันการลบ
          </p>

          <div className="w-full mb-8">
            <input
              type="text"
              placeholder="พิมพ์ชื่อห้องสอบที่นี่..."
              value={confirmValue}
              onChange={(e) => setConfirmValue(e.target.value)}
              className="w-full h-12 rounded-2xl border border-slate-200 px-4 text-center text-sm font-bold font-sarabun focus:ring-2 focus:ring-rose-500 focus:border-transparent outline-none transition-all"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-3 w-full">
            <button
              onClick={onClose}
              className="h-14 rounded-2xl bg-slate-100 text-slate-600 font-bold font-sukhumvit hover:bg-slate-200 transition-all text-[15px]"
            >
              ยกเลิก
            </button>
            <button
              onClick={onConfirm}
              disabled={!isMatch}
              className={`h-14 rounded-2xl font-black font-sukhumvit transition-all shadow-lg text-[15px] ${
                isMatch 
                  ? 'bg-rose-600 text-white hover:bg-rose-700 shadow-rose-600/20' 
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              ยืนยันการลบ
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StudentScoreSummaryModal({
  open,
  onClose,
  room,
  attempt
}: {
  open: boolean;
  onClose: () => void;
  room: ExamRoom;
  attempt: ExamAttempt;
}) {
  const { score, maxPoints: total, percent: percentage } = resolveAttemptScoreDisplay(room, attempt);
  const displayScore = score ?? 0;
  const displayPercent = percentage ?? 0;
  
  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="max-w-[340px] rounded-[2.5rem] p-0 overflow-hidden border-none shadow-2xl bg-white/90 backdrop-blur-xl [&>button]:hidden">
        <div className="p-7 flex flex-col items-center">
          <div className="w-full flex justify-between items-center mb-5">
            <DialogTitle className="text-[16px] font-black text-slate-800 font-sukhumvit">สรุปผลคะแนน</DialogTitle>
            <button 
              onClick={onClose} 
              className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 hover:bg-slate-200 transition-all"
            >
               <X size={14} />
            </button>
          </div>

          {/* Score Chart Circle */}
          <div className="relative w-40 h-40 flex items-center justify-center mb-6">
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="80" cy="80" r="74"
                fill="transparent"
                stroke="#f1f5f9"
                strokeWidth="10"
              />
              <motion.circle
                cx="80" cy="80" r="74"
                fill="transparent"
                stroke="url(#scoreGradient)"
                strokeWidth="10"
                strokeDasharray={464.95}
                initial={{ strokeDashoffset: 464.95 }}
                animate={{ strokeDashoffset: 464.95 - (464.95 * displayPercent) / 100 }}
                transition={{ duration: 1.5, ease: "easeOut" }}
                strokeLinecap="round"
              />
              <defs>
                <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#6366f1" />
                  <stop offset="100%" stopColor="#8b5cf6" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[36px] font-black text-slate-800 font-sukhumvit leading-none">{displayScore}</span>
              <div className="h-[1px] w-10 bg-slate-200 my-1" />
              <span className="text-[14px] font-bold text-slate-400 font-sarabun">{total}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 w-full mb-8">
            <div className="p-4 rounded-[2rem] bg-indigo-50/50 border border-indigo-100 flex flex-col items-center gap-1">
              <Trophy size={20} className="text-indigo-500 mb-1" />
              <span className="text-[18px] font-black text-indigo-600">{displayPercent}%</span>
              <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">เปอร์เซ็นต์</span>
            </div>
            <div className="p-4 rounded-[2rem] bg-emerald-50/50 border border-emerald-100 flex flex-col items-center gap-1">
              <TrendingUp size={20} className="text-emerald-500 mb-1" />
              <span className="text-[18px] font-black text-emerald-600">รอบที่ {attempt.round}</span>
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">ครั้งที่สอบ</span>
            </div>
          </div>

          <div className="w-full space-y-3 bg-slate-50/80 p-5 rounded-[2rem] border border-slate-100 mb-8">
             <div className="flex justify-between text-[13px] font-sarabun">
                <span className="text-slate-400">ชื่อวิชา</span>
                <span className="font-bold text-slate-700 truncate ml-4 text-right">{room.subjectName || '-'}</span>
             </div>
             <div className="flex justify-between text-[13px] font-sarabun">
                <span className="text-slate-400">ชื่อการสอบ</span>
                <span className="font-bold text-slate-700 truncate ml-4 text-right">{room.title}</span>
             </div>
             <div className="flex justify-between text-[13px] font-sarabun">
                <span className="text-slate-400">เวลาที่ส่ง</span>
                <span className="font-bold text-slate-700">
                   {attempt.submittedAt ? new Date(attempt.submittedAt).toLocaleString('th-TH') : '-'}
                </span>
             </div>
          </div>

          <button
            onClick={onClose}
            className="w-full h-14 rounded-2xl bg-slate-900 text-white font-bold font-sukhumvit hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/20"
          >
            ตกลง
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

import { useExamRoom } from '@/hooks/useExamRoom';
import { useAuth } from '@/hooks/useAuth';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import type { ExamRoom, ExamAttempt, ExamScoreOverrideRequest, GradeScoreType, GradeBookSubjectLink, ScoreCollectionType } from '@/types/exam';
import { rawPointsToPercent } from '@/types/grades';
import { resolveAttemptScoreDisplay } from '@/lib/exam/examRoomScoring';
import { resolveExamRoomIconSrc } from '@/lib/exam/examRoomIcons';
import { DRAWER_HEADER_ICON_BTN, DRAWER_HEADER_RIGHT_ACTIONS } from '@/lib/drawerHeaderBtn';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogTitle } from '@/components/ui/dialog';
import { DEPARTMENT_CONFIG, SUBJECT_GROUP_CONFIG, SUBJECT_SUBGROUP_CONFIG, type Department, type SubjectGroupId } from '@/types/curriculum';
import { useClassroomManager } from '@/features/classes/hooks/useClassroomManager';
import { useCurriculum } from '@/hooks/useCurriculum';
import { useCurriculumVersioned } from '@/hooks/useCurriculumVersioned';
import { getSubjectColors, SubjectIcon } from '@/features/curriculum/utils/subjectVisual';
import { useTeachingManager } from '@/hooks/useTeachingManager';
import { QUESTION_SETS_COL, useQuestionSetBank } from '@/hooks/useQuestionSetBank';
import type { Question } from '@/types/questionBank';
import { getDefaultQuestionPoints, resolveQuestionPoints, sumSelectedQuestionPoints } from '@/lib/exam/questionPoints';
import {
  deriveSetOrder,
  isExamRoomQuestionsConfigured,
  propagateRoundConfigToEmptyRounds,
} from '@/lib/exam/roundQuestions';
import type { Subject } from '@/types/curriculum';
import { db } from '@/lib/firebase';
import { logActivity } from '@/lib/activityLogger';
import { approveScoreOverride } from '@/lib/exam/scoreOverride';
import {
  buildStudentIdentityLookup,
  buildStudentDisplayNameByIdentityKey,
  enrichStudentIdentityLookupFromAttempts,
  findTakerAttemptForStudent,
  indexAttemptsByStudentRound,
  normalizeExamRound,
  resolveAttemptDisplayName,
} from '@/lib/students/studentIdentity';

const PdfPreviewFrame = lazy(() =>
  import('@/features/exam/components/PdfExamViewer').then((m) => ({ default: m.PdfPreviewFrame })),
);
// ── Status badge ──────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<ExamRoom['status'], { label: string; color: string; bg: string; icon: IconType }> = {
  upcoming: { label: 'รอเปิด', color: '#d97706', bg: '#fef3c7', icon: HiClock },
  active: { label: 'กำลังสอบ', color: '#059669', bg: '#d1fae5', icon: HiPlay },
  closed: { label: 'ปิดแล้ว', color: '#94a3b8', bg: '#f1f5f9', icon: HiLockClosed },
};

// Hide media in compact question cards (picker/selected list) while keeping full preview dialog intact.

function parseExamRoomClassName(className?: string): { gradeLevel?: string; roomNumber?: string } {
  if (!className) return {};
  const [gradeLevel, roomNumber] = className.split('/');
  return {
    gradeLevel: gradeLevel || undefined,
    roomNumber: roomNumber || undefined,
  };
}

function getExamRoomGradeLevel(room: ExamRoom): string {
  return room.gradeLevel || parseExamRoomClassName(room.className).gradeLevel || '';
}

function getExamRoomNumber(room: ExamRoom): string {
  return parseExamRoomClassName(room.className).roomNumber || '';
}


function sortGradeLevels(grades: string[], department: Department | 'all'): string[] {
  const order = department !== 'all'
    ? DEPARTMENT_CONFIG[department].grades
    : Object.values(DEPARTMENT_CONFIG).flatMap((cfg) => cfg.grades);
  return [...grades].sort((a, b) => {
    const indexA = order.indexOf(a);
    const indexB = order.indexOf(b);
    if (indexA === -1 && indexB === -1) return a.localeCompare(b, 'th', { numeric: true });
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    return indexA - indexB;
  });
}



const EXAM_FILTER_SELECT_CLASS =
  'h-9 min-w-0 flex-1 basis-0 rounded-xl border border-slate-200 bg-white/95 px-2 sm:px-3 text-[11px] sm:text-[12px] font-bold text-slate-700 font-sukhumvit outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500/25 disabled:opacity-50 disabled:cursor-not-allowed';

/** Sentinel for "ไม่มีสาระย่อย" — ห้องสอบที่ไม่ได้ระบุสาระย่อยไว้ */
const NO_SUB_SUBJECT_GROUP = '__none__';

const EXAM_STATUS_FILTER_COLORS: Record<'all' | ExamRoom['status'], string> = {
  all: '#6366f1',
  upcoming: '#f59e0b',
  active: '#059669',
  closed: '#94a3b8',
};

const TAKERS_SKELETON_ROWS = 6;

/** Vertical + horizontal inset so card shadows are not clipped by scroll edges. */
const PORTAL_CARD_LIST_PADDING = 'px-1.5 pt-1.5 pb-4 sm:px-2';

const MOBILE_STUDENT_CARD_OUTER = 'px-0.5 py-0.5';

const MOBILE_STUDENT_CARD_SHELL =
  'rounded-2xl bg-white/90 p-3 shadow-sm';

function TakersListSkeleton() {
  return (
    <div className="flex flex-col flex-1 min-h-0 w-full gap-3" aria-busy="true" aria-label="กำลังโหลดรายชื่อนักเรียน">
      <div className={cn('md:hidden flex flex-col gap-2.5', PORTAL_CARD_LIST_PADDING)}>
        {Array.from({ length: TAKERS_SKELETON_ROWS }).map((_, index) => (
          <div key={index} className={MOBILE_STUDENT_CARD_OUTER}>
            <div className={MOBILE_STUDENT_CARD_SHELL}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 flex-1 items-start gap-2.5">
                <Skeleton className="h-10 w-10 shrink-0 rounded-xl bg-slate-100" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-4 w-[62%] rounded-lg bg-slate-100" />
                  <Skeleton className="h-3 w-[28%] rounded-lg bg-slate-50" />
                </div>
              </div>
              <Skeleton className="h-6 w-14 shrink-0 rounded-lg bg-slate-100" />
            </div>
            <div className="mt-2.5 flex items-center gap-3 border-t border-slate-100 pt-2.5">
              <Skeleton className="h-8 w-12 rounded-lg bg-slate-100" />
              <Skeleton className="h-8 w-28 rounded-lg bg-slate-50" />
              <Skeleton className="ml-auto h-8 w-8 shrink-0 rounded-lg bg-slate-100" />
            </div>
            </div>
          </div>
        ))}
      </div>

      <div className="hidden md:flex flex-1 min-h-0 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white/80">
        <div className="w-full">
          <div className="flex items-center gap-4 border-b border-slate-200 bg-slate-50/90 px-4 py-3">
            <Skeleton className="h-3 flex-1 rounded bg-slate-100" />
            <Skeleton className="h-3 w-16 rounded bg-slate-100" />
            <Skeleton className="h-3 w-20 rounded bg-slate-100" />
            <Skeleton className="h-3 w-12 rounded bg-slate-100" />
            <Skeleton className="h-3 w-24 rounded bg-slate-100" />
          </div>
          {Array.from({ length: TAKERS_SKELETON_ROWS }).map((_, index) => (
            <div
              key={index}
              className="flex items-center gap-4 border-b border-slate-100 px-4 py-3 last:border-b-0"
            >
              <Skeleton className="h-4 flex-1 rounded-lg bg-slate-100" />
              <Skeleton className="h-4 w-16 rounded-lg bg-slate-50" />
              <Skeleton className="h-6 w-20 rounded-lg bg-slate-100" />
              <Skeleton className="h-6 w-10 rounded-lg bg-slate-100" />
              <Skeleton className="h-4 w-28 rounded-lg bg-slate-50" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ScoreSummarySkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-busy="true" aria-label="กำลังโหลดสรุปคะแนน">
      <div className="flex flex-col items-center justify-center gap-2 md:flex-row md:items-center md:justify-between">
        <Skeleton className="h-4 w-56 max-w-full rounded-lg bg-slate-100" />
        <Skeleton className="h-9 w-48 max-w-full rounded-xl bg-slate-100" />
      </div>
      <div className={cn('md:hidden flex flex-col gap-2.5', PORTAL_CARD_LIST_PADDING)}>
        {Array.from({ length: TAKERS_SKELETON_ROWS }).map((_, index) => (
          <div key={index} className={MOBILE_STUDENT_CARD_OUTER}>
            <div className={MOBILE_STUDENT_CARD_SHELL}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 flex-1 items-start gap-2.5">
                <Skeleton className="h-10 w-10 shrink-0 rounded-xl bg-slate-100" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-4 w-[58%] rounded-lg bg-slate-100" />
                  <Skeleton className="h-3 w-[24%] rounded-lg bg-slate-50" />
                </div>
              </div>
              <Skeleton className="h-10 w-12 shrink-0 rounded-lg bg-slate-100" />
            </div>
            <div className="mt-2.5 grid grid-cols-3 gap-2 border-t border-slate-100 pt-2.5">
              <Skeleton className="mx-auto h-8 w-12 rounded-lg bg-slate-100" />
              <Skeleton className="mx-auto h-8 w-12 rounded-lg bg-slate-100" />
              <Skeleton className="mx-auto h-8 w-12 rounded-lg bg-slate-100" />
            </div>
            </div>
          </div>
        ))}
      </div>
      <div className="hidden md:block overflow-hidden rounded-2xl border border-slate-200 bg-white/80">
        <div className="flex items-center gap-4 border-b border-slate-200 bg-slate-50/90 px-4 py-3">
          <Skeleton className="h-3 w-24 rounded bg-slate-100" />
          <Skeleton className="h-3 w-16 rounded bg-slate-100" />
          <Skeleton className="h-3 w-16 rounded bg-slate-100" />
          <Skeleton className="h-3 w-16 rounded bg-slate-100" />
          <Skeleton className="h-3 w-14 rounded bg-slate-100" />
        </div>
        {Array.from({ length: TAKERS_SKELETON_ROWS }).map((_, index) => (
          <div
            key={index}
            className="flex items-center gap-4 border-b border-slate-100 px-4 py-3 last:border-b-0"
          >
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-[45%] rounded-lg bg-slate-100" />
              <Skeleton className="h-3 w-[22%] rounded-lg bg-slate-50" />
            </div>
            <Skeleton className="h-7 w-12 rounded-lg bg-slate-100" />
            <Skeleton className="h-7 w-12 rounded-lg bg-slate-100" />
            <Skeleton className="h-7 w-12 rounded-lg bg-slate-100" />
            <Skeleton className="h-7 w-12 rounded-lg bg-slate-100" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** ไฟแดงกระพริบ — ห้องสอบกำลังเปิดอยู่ */
function ExamRoomLiveIndicator({ className = '' }: { className?: string }) {
  return (
    <span
      className={`relative inline-flex h-2.5 w-2.5 shrink-0 ${className}`}
      title="กำลังเปิดสอบ"
      aria-label="กำลังเปิดสอบ"
    >
      <span className="absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75 animate-ping" />
      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse" />
    </span>
  );
}

function RoomCardStatusPill({ room }: { room: ExamRoom }) {
  const cfg = STATUS_CONFIG[room.status];
  const Icon = cfg.icon;
  const completedRounds = room.completedRounds ?? 0;
  const nextRound = completedRounds + 1;

  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase font-sukhumvit shrink-0"
      style={{ color: cfg.color, background: cfg.bg }}
    >
      <Icon className="w-2.5 h-2.5 shrink-0" />
      {cfg.label}
      {room.status === 'upcoming' && completedRounds > 0 && (
        <span className="normal-case font-bold">· รอบ {nextRound}</span>
      )}
      {room.status === 'active' && (
        <span className="normal-case font-bold">· รอบ {room.currentRound ?? 1}</span>
      )}
    </span>
  );
}

const ROOM_CARD_ICON_BTN_BASE =
  'w-8 h-8 rounded-xl flex items-center justify-center transition-colors shrink-0';

function RoomCardIconButton({
  onClick,
  title,
  children,
  variant = 'default',
}: {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
  variant?: 'default' | 'danger';
}) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.92 }}
      onClick={onClick}
      title={title}
      className={cn(
        ROOM_CARD_ICON_BTN_BASE,
        variant === 'danger'
          ? 'bg-white hover:bg-rose-50 text-rose-500 border border-slate-200/80'
          : 'bg-slate-100 hover:bg-slate-200/80 text-slate-900',
      )}
    >
      {children}
    </motion.button>
  );
}

function RoomCardActionsPanel({
  canEdit,
  canDelete,
  needsQuestionSetup,
  onEdit,
  onOpenSettings,
  onDelete,
  onClose,
}: {
  canEdit?: boolean;
  canDelete?: boolean;
  needsQuestionSetup: boolean;
  onEdit: () => void;
  onOpenSettings: (tab: SettingsTab) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const run = (fn: () => void) => {
    onClose();
    fn();
  };

  const actions = [
    canEdit && {
      key: 'edit',
      label: 'แก้ไขห้องสอบ',
      shortLabel: 'แก้ไข',
      icon: HiMiniPencil,
      onClick: () => run(onEdit),
    },
    canEdit && {
      key: 'takers',
      label: 'รายชื่อ',
      shortLabel: 'รายชื่อ',
      icon: HiUsers,
      onClick: () => run(() => onOpenSettings('takers')),
    },
    canEdit && {
      key: 'questions',
      label: 'ข้อสอบ',
      shortLabel: 'ข้อสอบ',
      icon: HiDocumentText,
      onClick: () => run(() => onOpenSettings('questions')),
      warning: needsQuestionSetup,
    },
    canEdit && {
      key: 'score-summary',
      label: 'สรุปคะแนน',
      shortLabel: 'สรุปคะแนน',
      icon: HiPresentationChartLine,
      onClick: () => run(() => onOpenSettings('score-summary')),
    },
    canEdit && {
      key: 'score-config',
      label: 'เก็บคะแนน',
      shortLabel: 'เก็บคะแนน',
      icon: HiAdjustmentsHorizontal,
      onClick: () => run(() => onOpenSettings('score-config')),
    },
    canDelete && {
      key: 'delete',
      label: 'ลบห้องสอบ',
      shortLabel: 'ลบ',
      icon: HiMiniTrash,
      onClick: () => run(onDelete),
      danger: true,
    },
  ].filter(Boolean) as Array<{
    key: string;
    label: string;
    shortLabel: string;
    icon: IconType;
    onClick: () => void;
    warning?: boolean;
    danger?: boolean;
  }>;

  return (
    <div className="grid grid-cols-3 gap-1.5">
      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <motion.button
            key={action.key}
            type="button"
            whileTap={{ scale: 0.92 }}
            onClick={action.onClick}
            title={action.label}
            className={cn(
              'flex flex-col items-center justify-center gap-1 rounded-xl px-1 py-2.5 transition-colors min-h-[58px]',
              action.danger
                ? 'bg-rose-50 hover:bg-rose-100 text-rose-600'
                : action.warning
                  ? 'bg-amber-50 hover:bg-amber-100 text-amber-700'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700',
            )}
          >
            <Icon
              className={cn(
                'h-4 w-4 shrink-0',
                action.warning && 'text-rose-500',
              )}
            />
            <span className="text-[9px] font-bold font-sukhumvit leading-tight text-center line-clamp-2">
              {action.shortLabel}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}

/** ปุ่มเมนู (จัดการห้องสอบ) กดแล้วลอยเป็น plate แทนที่จะดันเนื้อหาการ์ด — ตำแหน่งอิงจากปุ่มที่กด */
function RoomCardActionsPlate({
  anchorRect,
  onClose,
  canEdit,
  canDelete,
  needsQuestionSetup,
  onEdit,
  onOpenSettings,
  onDelete,
}: {
  anchorRect: DOMRect;
  onClose: () => void;
  canEdit?: boolean;
  canDelete?: boolean;
  needsQuestionSetup: boolean;
  onEdit: () => void;
  onOpenSettings: (tab: SettingsTab) => void;
  onDelete: () => void;
}) {
  const PLATE_W = 224;
  const GAP = 8;
  const placeBelow = anchorRect.bottom + 220 < window.innerHeight;
  let left = anchorRect.right - PLATE_W;
  left = Math.max(8, Math.min(left, window.innerWidth - PLATE_W - 8));

  return createPortal(
    <>
      <button
        type="button"
        aria-label="ปิดเมนู"
        className="fixed inset-0 z-[80] cursor-default bg-transparent"
        onClick={onClose}
      />
      <div
        role="menu"
        className="fixed z-[90] w-[224px] rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl"
        style={
          placeBelow
            ? { top: anchorRect.bottom + GAP, left }
            : { bottom: window.innerHeight - anchorRect.top + GAP, left }
        }
        onClick={(e) => e.stopPropagation()}
      >
        <RoomCardActionsPanel
          canEdit={canEdit}
          canDelete={canDelete}
          needsQuestionSetup={needsQuestionSetup}
          onEdit={onEdit}
          onOpenSettings={onOpenSettings}
          onDelete={onDelete}
          onClose={onClose}
        />
      </div>
    </>,
    document.body,
  );
}

function MobileRoundSelect({
  rounds,
  value,
  onChange,
  className,
}: {
  rounds: number[];
  value: number;
  onChange: (round: number) => void;
  className?: string;
}) {
  if (rounds.length <= 1) return null;

  return (
    <div className={cn('flex items-center gap-2 min-w-0', className)}>
      <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider font-sukhumvit shrink-0">
        รอบ
      </label>
      <div className="relative w-full max-w-[160px]">
        <select
          value={String(value)}
          onChange={(e) => onChange(Number(e.target.value))}
          className={cn(
            EXAM_FILTER_SELECT_CLASS,
            'w-full appearance-none bg-slate-100 border-slate-200/80 text-slate-900 pl-3 pr-9',
          )}
          aria-label="เลือกรอบการสอบ"
        >
          {rounds.map((round) => (
            <option key={round} value={String(round)}>
              รอบ {round}
            </option>
          ))}
        </select>
        <HiChevronDown
          className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500"
          aria-hidden
        />
      </div>
    </div>
  );
}

function CountdownTimer({
  startTime,
  durationMinutes,
  onExpire,
  variant = 'badge',
}: {
  startTime?: number;
  durationMinutes: number;
  onExpire?: () => void;
  variant?: 'badge' | 'plain';
}) {
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const hasExpiredRef = useRef(false);
  const onExpireRef = useRef(onExpire);

  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  useEffect(() => {
    if (!startTime) return;
    hasExpiredRef.current = false;

    const calculateTimeLeft = () => {
      const end = startTime + durationMinutes * 60 * 1000;
      const diff = end - Date.now();
      const left = Math.max(0, diff);

      if (left <= 0 && !hasExpiredRef.current) {
        hasExpiredRef.current = true;
        if (onExpireRef.current) {
          onExpireRef.current();
        }
      }
      return left;
    };

    setTimeLeft(calculateTimeLeft());
    const timer = setInterval(() => setTimeLeft(calculateTimeLeft()), 1000);
    return () => clearInterval(timer);
  }, [startTime, durationMinutes]);

  if (!startTime) return null;
  if (timeLeft === null) return null;
  if (timeLeft <= 0) {
    if (variant === 'plain') {
      return (
        <span className="text-[10px] font-black font-mono tabular-nums text-rose-600 shrink-0">
          หมดเวลา
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-black font-sukhumvit bg-red-600 text-white">
        หมดเวลา
      </span>
    );
  }

  const m = Math.floor(timeLeft / 60000);
  const s = Math.floor((timeLeft % 60000) / 1000);
  const timeLabel = `${m}:${s.toString().padStart(2, '0')}`;

  if (variant === 'plain') {
    return (
      <span className="text-[10px] font-black font-mono tabular-nums text-rose-600 shrink-0">
        {timeLabel}
      </span>
    );
  }

  return (
    <motion.span
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-black font-mono tabular-nums bg-red-600 text-white"
    >
      <HiClock className="w-2.5 h-2.5 shrink-0 text-white animate-pulse" />
      {timeLabel}
    </motion.span>
  );
}

// ── Attempt status dot ────────────────────────────────────────────────────────
function AttemptCard({
  att,
  displayName,
}: {
  att: ExamAttempt;
  displayName?: string;
}) {
  const isSuspicious = att.suspiciousActivities >= 1;
  const statusColor = att.status === 'submitted' ? '#059669' : att.status === 'graded' ? '#6366f1' : '#f59e0b';
  const statusLabel = att.status === 'submitted' ? 'ส่งแล้ว' : att.status === 'graded' ? 'ตรวจแล้ว' : 'กำลังทำ';
  const name = displayName?.trim() || att.studentName || 'ไม่ทราบชื่อ';
  const avatarInitial = name.replace(/^[^\p{L}\p{N}]+/u, '').charAt(0) || '?';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center justify-between px-4 py-3 rounded-[1.25rem]"
      style={{ background: 'rgba(255,255,255,0.85)', border: '1px solid rgba(255,255,255,1)' }}
    >
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-black"
          style={{ background: 'linear-gradient(135deg,#f43f5e,#fb7185)' }}>
          {avatarInitial}
        </div>
        <div>
          <p className="text-[13px] font-bold text-slate-800 font-sukhumvit">{name}</p>
          <p className="text-[10px] text-slate-400 font-sarabun">
            ตอบแล้ว {Object.keys(att.answers).length} ข้อ
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {isSuspicious && (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-xl bg-rose-50 text-rose-500 text-[9px] font-black">
            <ShieldAlert size={9} /> {att.suspiciousActivities}ครั้ง
          </span>
        )}
        <span className="text-[10px] font-black px-2.5 py-1 rounded-xl font-sukhumvit"
          style={{ color: statusColor, background: statusColor + '18' }}>
          {statusLabel}
        </span>
        {att.score !== null && (
          <span className="text-[13px] font-black text-slate-700">{att.score}คะแนน</span>
        )}
      </div>
    </motion.div>
  );
}

// ── Proctor Dashboard Modal ───────────────────────────────────────────────────
function ProctoringModal({
  room, attempts, onClose, onRecalculateScores,
}: {
  room: ExamRoom;
  attempts: ExamAttempt[];
  onClose: () => void;
  onRecalculateScores?: (roomId: string, round: number) => Promise<void>;
}) {
  const { user, role } = useAuth();
  const canViewAllSubjects = role === 'admin' || role === 'sysadmin';
  const teachingMgr = useTeachingManager(user?.uid ?? '', canViewAllSubjects);
  const classStudents = useMemo(() => {
    if (!room.classId) return [] as ReturnType<typeof teachingMgr.getStudentsForClass>;
    return teachingMgr.getStudentsForClass(room.classId);
  }, [room.classId, teachingMgr.getStudentsForClass]);

  const displayNameByKey = useMemo(
    () => buildStudentDisplayNameByIdentityKey(classStudents, attempts),
    [classStudents, attempts],
  );

  const [isRecalculating, setIsRecalculating] = useState(false);
  const canRecalculateScores = Boolean(onRecalculateScores && room.status !== 'active');

  const runRecalculate = useCallback(async () => {
    if (!onRecalculateScores || room.status === 'active') return;
    setIsRecalculating(true);
    try {
      const rounds = Array.from(new Set(
        attempts.map((a) => normalizeExamRound(a.round)),
      )).filter((r) => r > 0);
      const targetRounds = rounds.length > 0
        ? rounds
        : [normalizeExamRound(room.currentRound)];
      await Promise.all(
        targetRounds.map((round) => onRecalculateScores(room.id, round)),
      );
    } finally {
      setIsRecalculating(false);
    }
  }, [attempts, onRecalculateScores, room.currentRound, room.id, room.status]);

  const proctorRound = normalizeExamRound(room.currentRound);
  const roundAttempts = useMemo(
    () => attempts.filter((a) => normalizeExamRound(a.round) === proctorRound),
    [attempts, proctorRound],
  );

  const inProgress = roundAttempts.filter(a => a.status === 'in_progress').length;
  const submitted = roundAttempts.filter(a => a.status === 'submitted' || a.status === 'graded').length;
  const suspicious = roundAttempts.filter(a => a.suspiciousActivities >= 1).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="absolute inset-0 bg-black/20 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative w-full max-w-2xl rounded-[2.5rem] p-6 flex flex-col gap-5 max-h-[85vh]"
        style={{
          background: 'rgba(255,255,255,0.85)',
          backdropFilter: 'blur(40px) saturate(180%)',
          WebkitBackdropFilter: 'blur(40px) saturate(180%)',
          border: '1px solid rgba(255,255,255,0.7)',
          boxShadow: '0 32px 80px rgba(0,0,0,0.12)',
        }}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest font-sukhumvit">PROCTOR DASHBOARD</p>
            <h2 className="text-[18px] font-black text-slate-800 font-sukhumvit mt-0.5">{room.title}</h2>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {canRecalculateScores && (
              <button
                type="button"
                onClick={() => void runRecalculate()}
                disabled={isRecalculating}
                className="h-8 px-3 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[10px] font-black font-sukhumvit transition-all disabled:opacity-50"
              >
                {isRecalculating ? 'กำลังคำนวณ...' : 'คำนวณคะแนนใหม่'}
              </button>
            )}
            <button onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-all">
              <X size={14} className="text-slate-500" />
            </button>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'กำลังทำ', value: inProgress, color: '#f59e0b', bg: '#fef3c7' },
            { label: 'ส่งแล้ว', value: submitted, color: '#059669', bg: '#d1fae5' },
            { label: 'น่าสงสัย', value: suspicious, color: '#e11d48', bg: '#ffe4e6' },
          ].map(stat => (
            <div key={stat.label} className="rounded-[1.5rem] p-4 flex flex-col items-center gap-1"
              style={{ background: stat.bg }}>
              <p className="text-[28px] font-black font-sukhumvit" style={{ color: stat.color }}>{stat.value}</p>
              <p className="text-[10px] font-bold text-slate-500 font-sarabun">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Attempt list */}
        <div className="flex-1 overflow-y-auto min-h-0 scrollbar-hide flex flex-col gap-2">
          {roundAttempts.length === 0 ? (
            <div className="text-center py-10 text-slate-400 font-sarabun text-[13px]">
              ยังไม่มีนักเรียนเข้าห้องสอบในรอบนี้
            </div>
          ) : (
            roundAttempts.map((att) => (
              <div key={att.id}>
                <AttemptCard
                  att={att}
                  displayName={resolveAttemptDisplayName(att, displayNameByKey)}
                />
              </div>
            ))
          )}
        </div>

        <p className="text-center text-[10px] text-slate-400 font-sarabun">
          อัปเดตล่าสุด: {new Date().toLocaleTimeString('th-TH')}
        </p>
      </motion.div>
    </div>
  );
}

// ── Create Room Modal ─────────────────────────────────────────────────────────
// ── Questions Panel ───────────────────────────────────────────────────────────
// Two-card layout: LEFT = bank browser + question picker, RIGHT = selected questions per round.
// Firebase efficiency: question sub-collections are fetched only when user opens a set (lazy).
// Round configs are stored as IDs inside the ExamRoom document (no extra sub-collection reads).

// Round draft state for QuestionsPanel
type RoundDraftEntry = {
  questionSetId: string;
  /** ลำดับชุดข้อสอบ (part) ในรอบนี้ */
  setOrder?: string[];
  questionIds: Set<string>;
  questionSetByQuestionId: Record<string, string>;
  questionPoints: Record<string, number>;
};

const EXAM_BANK_PAGE_SIZE = 8;

function questionPlainText(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

function QuestionsPanel({
  room,
  attempts,
  onSave,
  onContentClick,
  mobileBankDrawerOpen = false,
  onMobileBankDrawerOpenChange,
}: {
  room: ExamRoom;
  attempts: ExamAttempt[];
  onSave: (
    roundKey: string,
    questionSetId: string,
    questionIds: string[],
    questionSetByQuestionId: Record<string, string>,
    questionPoints: Record<string, number>,
    totalPoints: number,
  ) => Promise<void>;
  onContentClick: (e: React.MouseEvent) => void;
  mobileBankDrawerOpen?: boolean;
  onMobileBankDrawerOpenChange?: (open: boolean) => void;
}) {
  const maxAttempts = room.settings?.maxAttempts ?? 1;
  // Build round keys: unlimited (0) → show single "∞" slot; else 1..maxAttempts
  const roundKeys: string[] = useMemo(() => {
    if (maxAttempts === 0) return ['∞'];
    return Array.from({ length: maxAttempts }, (_, i) => String(i + 1));
  }, [maxAttempts]);

  // Active round tab
  const [activeRound, setActiveRound] = useState<string>(roundKeys[0] ?? '1');

  // Ensure activeRound stays valid when maxAttempts changes
  useEffect(() => {
    if (!roundKeys.includes(activeRound)) setActiveRound(roundKeys[0] ?? '1');
  }, [roundKeys, activeRound]);

  // Rounds that already have student attempts — editing questions for these is blocked
  const roundsWithAttempts = useMemo(() => {
    const set = new Set<number>();
    attempts.forEach((att) => set.add(normalizeExamRound(att.round)));
    return set;
  }, [attempts]);
  const activeRoundHasAttempts = roundsWithAttempts.has(normalizeExamRound(activeRound));

  useEffect(() => {
    setExpandedPartSetId(null);
  }, [activeRound]);

  // Per-round selection state (local, synced from saved room data)
  const [roundDraft, setRoundDraft] = useState<Record<string, RoundDraftEntry>>(() => {
    const init: Record<string, RoundDraftEntry> = {};
    // Migrate legacy single-round data
    if (room.questionSetId && room.selectedQuestionIds) {
      const questionSetByQuestionId = Object.fromEntries(
        room.selectedQuestionIds.map(qid => [qid, room.questionSetId as string]),
      );
      init['1'] = {
        questionSetId: room.questionSetId,
        setOrder: deriveSetOrder(room.selectedQuestionIds, questionSetByQuestionId, room.questionSetId),
        questionIds: new Set(room.selectedQuestionIds),
        questionSetByQuestionId,
        questionPoints: {},
      };
    }
    // Load per-round data
    if (room.roundQuestions) {
      Object.entries(room.roundQuestions).forEach(([k, v]) => {
        const mapped = v.questionSetByQuestionId ?? Object.fromEntries(
          v.questionIds.map(qid => [qid, v.questionSetId]),
        );
        init[k] = {
          questionSetId: v.questionSetId,
          setOrder: deriveSetOrder(v.questionIds, mapped, v.questionSetId),
          questionIds: new Set(v.questionIds),
          questionSetByQuestionId: mapped,
          questionPoints: { ...(v.questionPoints ?? {}) },
        };
      });
    }
    return init;
  });

  // Per-round: one whole question set (all questions in the set)
  const [selectingSetId, setSelectingSetId] = useState<string | null>(null);
  const [expandedPartSetId, setExpandedPartSetId] = useState<string | null>(null);
  const [pdfPreview, setPdfPreview] = useState<{ url: string; title: string } | null>(null);
  const [searchText, setSearchText] = useState('');
  const [filterGroup, setFilterGroup] = useState<SubjectGroupId | 'all'>('all');
  const [filterDepartment, setFilterDepartment] = useState<Department | 'all'>('all');
  const [filterGradeLevel, setFilterGradeLevel] = useState<string | 'all'>('all');
  const failedHydrationRef = useRef<Set<string>>(new Set());

  const { questionSets, isLoading: setsLoading, filterQuestionSets } = useQuestionSetBank();

  const [isLgUp, setIsLgUp] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 1024px)').matches : true,
  );

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const onChange = () => {
      setIsLgUp(mq.matches);
      if (mq.matches) onMobileBankDrawerOpenChange?.(false);
    };
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [onMobileBankDrawerOpenChange]);

  const setBankDrawerOpen = (open: boolean) => {
    onMobileBankDrawerOpenChange?.(open);
  };

  // Cart-like cache: keep every loaded question so selections across multiple sets
  // can still be rendered on the right card without losing content.
  const [questionCache, setQuestionCache] = useState<Map<string, Question>>(
    () => new Map(),
  );
  const [setQuestionIdsMap, setSetQuestionIdsMap] = useState<Map<string, Set<string>>>(
    () => new Map(),
  );
  const rightCardQuestions = useMemo(() => Array.from(questionCache.values()), [questionCache]);

  const [isSaving, setIsSaving] = useState<string | null>(null); // round key being saved
  const [savedRound, setSavedRound] = useState<string | null>(null);
  const [confirmSaveRound, setConfirmSaveRound] = useState<{ rk: string; removedCount: number } | null>(null);
  const [isHydratingSelected, setIsHydratingSelected] = useState(false);
  const rightCardLoading = isHydratingSelected || selectingSetId !== null;

  const subjectGroupOptions = useMemo(
    () =>
      (Object.entries(SUBJECT_GROUP_CONFIG) as [SubjectGroupId, typeof SUBJECT_GROUP_CONFIG[SubjectGroupId]][])
        .sort(([, a], [, b]) => a.order - b.order),
    [],
  );

  const filteredSets = useMemo(
    () =>
      filterQuestionSets({
        search: searchText,
        subjectGroup: filterGroup,
        department: filterDepartment,
        gradeLevel: filterGradeLevel,
      }),
    [filterQuestionSets, searchText, filterGroup, filterDepartment, filterGradeLevel],
  );

  const hasActiveBankFilters =
    searchText !== '' ||
    filterGroup !== 'all' ||
    filterDepartment !== 'all' ||
    filterGradeLevel !== 'all';

  const [bankPage, setBankPage] = useState(1);
  const bankTotalPages = Math.max(1, Math.ceil(filteredSets.length / EXAM_BANK_PAGE_SIZE));
  const filteredSetIdsKey = filteredSets.map((s) => s.id).join(',');

  useEffect(() => {
    setBankPage(1);
  }, [filteredSetIdsKey]);

  useEffect(() => {
    setBankPage((page) => Math.min(page, bankTotalPages));
  }, [bankTotalPages]);

  const paginatedBankSets = useMemo(
    () => filteredSets.slice(
      (bankPage - 1) * EXAM_BANK_PAGE_SIZE,
      bankPage * EXAM_BANK_PAGE_SIZE,
    ),
    [filteredSets, bankPage],
  );

  const bankRangeStart = filteredSets.length === 0 ? 0 : (bankPage - 1) * EXAM_BANK_PAGE_SIZE + 1;
  const bankRangeEnd = Math.min(bankPage * EXAM_BANK_PAGE_SIZE, filteredSets.length);

  const getDraftSetOrder = (draft: RoundDraftEntry | undefined): string[] => {
    if (!draft) return [];
    if (draft.setOrder?.length) return draft.setOrder;
    return deriveSetOrder(draft.questionIds, draft.questionSetByQuestionId, draft.questionSetId);
  };

  const isSetInDraft = (draft: RoundDraftEntry | undefined, setId: string) =>
    !!draft && getDraftSetOrder(draft).includes(setId);

  const isSetSelectedInRound = (setId: string, rk = activeRound) =>
    isSetInDraft(roundDraft[rk], setId);

  const getSetStatsInDraft = (draft: RoundDraftEntry, setId: string) => {
    const qids = Array.from(draft.questionIds).filter(
      qid => draft.questionSetByQuestionId[qid] === setId,
    );
    const byId = new Map<string, Pick<Question, 'type' | 'payload'>>();
    rightCardQuestions.forEach(q => byId.set(q.id, q));
    const subset = new Set(qids);
    const pts = sumSelectedQuestionPoints(subset, draft.questionPoints, byId);
    return { count: qids.length, points: pts };
  };

  const getQuestionsForSetInDraft = (draft: RoundDraftEntry, setId: string): Question[] =>
    Array.from(draft.questionIds)
      .filter(qid => draft.questionSetByQuestionId[qid] === setId)
      .map(qid => questionCache.get(qid))
      .filter((q): q is Question => !!q)
      .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));

  const toggleExpandedPart = (setId: string) => {
    setExpandedPartSetId(prev => (prev === setId ? null : setId));
  };

  const updateQuestionPoint = (rk: string, qid: string, raw: string) => {
    const parsed = Number(raw);
    const pts = Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
    setRoundDraft(prev => {
      const round = prev[rk];
      if (!round) return prev;
      return {
        ...prev,
        [rk]: {
          ...round,
          questionPoints: { ...round.questionPoints, [qid]: pts },
        },
      };
    });
  };

  const openPdfPreview = (url: string, title: string) => {
    setPdfPreview({ url, title });
  };

  const pdfPreviewButtonClass =
    'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm transition-colors hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700';

  const clearRound = (rk: string) => {
    setRoundDraft(prev => {
      const next = { ...prev };
      delete next[rk];
      return next;
    });
  };

  const removeSetFromRound = (rk: string, setId: string) => {
    setRoundDraft(prev => {
      const existing = prev[rk];
      if (!existing) return prev;

      const idsToRemove = Array.from(existing.questionIds).filter(
        qid => existing.questionSetByQuestionId[qid] === setId,
      );
      if (idsToRemove.length === 0) return prev;

      const nextIds = new Set(existing.questionIds);
      const nextMap = { ...existing.questionSetByQuestionId };
      const nextPts = { ...existing.questionPoints };
      idsToRemove.forEach(qid => {
        nextIds.delete(qid);
        delete nextMap[qid];
        delete nextPts[qid];
      });

      if (nextIds.size === 0) {
        const next = { ...prev };
        delete next[rk];
        return next;
      }

      const nextOrder = getDraftSetOrder(existing).filter(id => id !== setId);
      return {
        ...prev,
        [rk]: {
          questionSetId: nextOrder[0] ?? existing.questionSetId,
          setOrder: nextOrder,
          questionIds: nextIds,
          questionSetByQuestionId: nextMap,
          questionPoints: nextPts,
        },
      };
    });
  };

  const selectQuestionSetForRound = async (setId: string) => {
    if (isSetSelectedInRound(setId)) {
      removeSetFromRound(activeRound, setId);
      return;
    }

    setSelectingSetId(setId);
    try {
      const snap = await getDocs(collection(db, QUESTION_SETS_COL, setId, 'questions'));
      const qs = snap.docs
        .map(d => ({ id: d.id, setId, ...d.data() } as Question))
        .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));

      if (qs.length === 0) {
        toast.error('ชุดข้อสอบนี้ยังไม่มีข้อสอบ');
        return;
      }

      const ids = new Set(qs.map(q => q.id));
      const setMap = Object.fromEntries(qs.map(q => [q.id, setId]));
      const ptsMap = Object.fromEntries(qs.map(q => [q.id, getDefaultQuestionPoints(q)]));

      setQuestionCache(prev => {
        const next = new Map(prev);
        qs.forEach(q => next.set(q.id, q));
        return next;
      });
      setSetQuestionIdsMap(prev => {
        const next = new Map(prev);
        next.set(setId, ids);
        return next;
      });

      setRoundDraft(prev => {
        const existing = prev[activeRound];
        const mergedIds = new Set(existing?.questionIds ?? []);
        qs.forEach(q => mergedIds.add(q.id));
        const mergedOrder = existing
          ? [...getDraftSetOrder(existing), setId]
          : [setId];

        return {
          ...prev,
          [activeRound]: {
            questionSetId: existing?.questionSetId || setId,
            setOrder: mergedOrder,
            questionIds: mergedIds,
            questionSetByQuestionId: {
              ...(existing?.questionSetByQuestionId ?? {}),
              ...setMap,
            },
            questionPoints: {
              ...(existing?.questionPoints ?? {}),
              ...ptsMap,
            },
          },
        };
      });
    } catch (err) {
      console.error('Error loading question set:', setId, err);
      toast.error('โหลดชุดข้อสอบไม่สำเร็จ');
    } finally {
      setSelectingSetId(null);
    }
  };

  const getDraftTotalPoints = (draft: RoundDraftEntry) => {
    const byId = new Map<string, Pick<Question, 'type' | 'payload'>>();
    rightCardQuestions.forEach(q => byId.set(q.id, q));
    return sumSelectedQuestionPoints(draft.questionIds, draft.questionPoints, byId);
  };

  const handleSaveRound = async (rk: string) => {
    const draft = roundDraft[rk];
    if (!draft) return;
    const byId = new Map<string, Pick<Question, 'type' | 'payload'>>();
    rightCardQuestions.forEach(q => byId.set(q.id, q));
    const questionPoints: Record<string, number> = {};
    draft.questionIds.forEach(qid => {
      questionPoints[qid] = resolveQuestionPoints(qid, draft.questionPoints, byId.get(qid));
    });
    const pts = sumSelectedQuestionPoints(draft.questionIds, questionPoints, byId);
    const setOrder = getDraftSetOrder(draft);
    setIsSaving(rk);
    try {
      await onSave(
        rk,
        setOrder[0] || draft.questionSetId || '',
        Array.from(draft.questionIds),
        draft.questionSetByQuestionId,
        questionPoints,
        pts,
      );
      setSavedRound(rk);
      setTimeout(() => setSavedRound(null), 2000);
    } finally {
      setIsSaving(null);
    }
  };

  const getPersistedCount = (rk: string): number => {
    const roundSaved = room.roundQuestions?.[rk];
    if (roundSaved) return roundSaved.questionIds.length;
    if ((rk === '1' || rk === '∞') && room.selectedQuestionIds?.length) {
      return room.selectedQuestionIds.length;
    }
    return 0;
  };

  const requestSaveRound = (rk: string) => {
    const draft = roundDraft[rk];
    if (!draft) return;
    const persistedCount = getPersistedCount(rk);
    const currentCount = draft.questionIds.size;
    if (persistedCount > 0 && currentCount < persistedCount) {
      setConfirmSaveRound({ rk, removedCount: persistedCount - currentCount });
      return;
    }
    void handleSaveRound(rk);
  };

  // Hydrate selected questions from all referenced sets (for reload/restore case).
  useEffect(() => {
    let cancelled = false;
    const hydrate = async () => {
      const draft = roundDraft[activeRound];
      if (!draft || draft.questionIds.size === 0) return;

      const missingIds = Array.from(draft.questionIds).filter(
        qid => !questionCache.has(qid) && !failedHydrationRef.current.has(qid)
      );
      if (missingIds.length === 0) return;

      const requestedSetIds = Array.from(new Set(
        missingIds
          .map(qid => draft.questionSetByQuestionId[qid] || draft.questionSetId)
          .filter(Boolean),
      )) as string[];
      const fetchedSetIds = new Set<string>();

      setIsHydratingSelected(true);
      try {
        const mergedMap = new Map<string, Question>();
        const mergedSetMap = new Map<string, Set<string>>();
        const fetchSet = async (setId: string) => {
          if (!setId || fetchedSetIds.has(setId)) return;
          fetchedSetIds.add(setId);
          try {
            const snap = await getDocs(collection(db, QUESTION_SETS_COL, setId, 'questions'));
            const qs = snap.docs.map(d => ({ id: d.id, setId, ...d.data() })) as Question[];
            mergedSetMap.set(setId, new Set(qs.map(q => q.id)));
            qs.forEach(q => mergedMap.set(q.id, q));
          } catch (err) {
            console.error('Error fetching set for hydration:', setId, err);
          }
        };

        // 1) Fetch mapped sets first
        for (const setId of requestedSetIds) {
          await fetchSet(setId);
        }

        // 2) Legacy fallback
        const findStillMissing = () =>
          missingIds.filter(qid => !questionCache.has(qid) && !mergedMap.has(qid));

        let stillMissing = findStillMissing();
        if (stillMissing.length > 0) {
          for (const [setId, ids] of setQuestionIdsMap.entries()) {
            if (stillMissing.some(qid => ids.has(qid))) {
              await fetchSet(setId);
              stillMissing = findStillMissing();
              if (stillMissing.length === 0) break;
            }
          }
        }

        // 3) Final fallback: scan available sets (limit to first 10 for performance if many)
        stillMissing = findStillMissing();
        if (stillMissing.length > 0) {
          const setsToScan = questionSets.slice(0, 20); // Safety limit
          for (const set of setsToScan) {
            if (fetchedSetIds.has(set.id)) continue;
            await fetchSet(set.id);
            stillMissing = findStillMissing();
            if (stillMissing.length === 0) break;
          }
        }

        if (cancelled) return;

        // Mark remaining missing as failed so we don't loop
        stillMissing = findStillMissing();
        stillMissing.forEach(id => failedHydrationRef.current.add(id));

        if (mergedMap.size > 0) {
          setQuestionCache(prev => {
            const next = new Map(prev);
            mergedMap.forEach((q, qid) => next.set(qid, q));
            return next;
          });
        }
        
        if (mergedSetMap.size > 0) {
          setSetQuestionIdsMap(prev => {
            const next = new Map(prev);
            mergedSetMap.forEach((ids, setId) => {
              const old = next.get(setId);
              next.set(setId, old ? new Set([...old, ...ids]) : ids);
            });
            return next;
          });
        }

        // Repair draft mapping
        if (mergedMap.size > 0) {
          setRoundDraft(prev => {
            const round = prev[activeRound];
            if (!round) return prev;
            const nextMap = { ...round.questionSetByQuestionId };
            let changed = false;
            missingIds.forEach(qid => {
              const found = mergedMap.get(qid) as ({ setId?: string } | undefined);
              if (found?.setId && nextMap[qid] !== found.setId) {
                nextMap[qid] = found.setId;
                changed = true;
              }
            });
            if (!changed) return prev;
            return {
              ...prev,
              [activeRound]: { ...round, questionSetByQuestionId: nextMap },
            };
          });
        }

        // Repair stale question IDs: PDF sets regenerate question docs when the
        // answer key is re-saved, so saved rooms can reference IDs that no longer
        // exist. Swap them for the set's current questions.
        const staleSetIds = new Set<string>();
        missingIds.forEach(qid => {
          if (mergedMap.has(qid) || questionCache.has(qid)) return;
          const setId = draft.questionSetByQuestionId[qid] || draft.questionSetId;
          if (setId && mergedSetMap.has(setId)) staleSetIds.add(setId);
        });

        if (staleSetIds.size > 0) {
          setRoundDraft(prev => {
            const round = prev[activeRound];
            if (!round) return prev;
            const nextIds = new Set(round.questionIds);
            const nextMap = { ...round.questionSetByQuestionId };
            const nextPts = { ...round.questionPoints };

            staleSetIds.forEach(setId => {
              const currentIds = mergedSetMap.get(setId);
              if (!currentIds) return;
              const fresh = Array.from(currentIds)
                .map(id => mergedMap.get(id))
                .filter((q): q is Question => !!q)
                .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));
              if (fresh.length === 0) return;

              const oldIdsInOrder = Array.from(round.questionIds).filter(
                qid => (round.questionSetByQuestionId[qid] || round.questionSetId) === setId,
              );
              const oldPts = oldIdsInOrder.map(qid => round.questionPoints[qid]);

              oldIdsInOrder.forEach(qid => {
                nextIds.delete(qid);
                delete nextMap[qid];
                delete nextPts[qid];
              });

              const canKeepPoints = fresh.length === oldIdsInOrder.length;
              fresh.forEach((q, i) => {
                nextIds.add(q.id);
                nextMap[q.id] = setId;
                const preserved = canKeepPoints ? oldPts[i] : undefined;
                nextPts[q.id] = preserved ?? getDefaultQuestionPoints(q);
              });
            });

            return {
              ...prev,
              [activeRound]: {
                ...round,
                questionIds: nextIds,
                questionSetByQuestionId: nextMap,
                questionPoints: nextPts,
              },
            };
          });
        }
      } finally {
        if (!cancelled) setIsHydratingSelected(false);
      }
    };
    void hydrate();
    return () => { cancelled = true; };
  }, [activeRound, questionCache, questionSets, roundDraft, setQuestionIdsMap]);

  const renderSelectedPartsList = (rk: string, draft: RoundDraftEntry) => {
    const setOrder = getDraftSetOrder(draft);
    const totalPts = getDraftTotalPoints(draft);
    const totalCount = draft.questionIds.size;

    return (
      <div className="flex flex-col gap-3 flex-1 min-h-0">
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl shrink-0 bg-blue-50 border border-blue-200">
          <HiCheckCircle className="w-3 h-3 text-blue-600 shrink-0" />
          <p className="text-[11px] font-black text-blue-700 font-sukhumvit">
            {setOrder.length} part · {totalCount} ข้อ · รวม {totalPts} คะแนน
          </p>
          <button
            type="button"
            onClick={() => clearRound(rk)}
            className="ml-auto text-[10px] font-bold text-rose-500 hover:text-rose-600 font-sarabun"
          >
            ล้างทั้งหมด
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-2 scrollbar-hide overscroll-y-contain">
          {setOrder.map((setId, index) => {
            const set = questionSets.find(s => s.id === setId);
            const grpCfg = set ? SUBJECT_GROUP_CONFIG[set.subjectGroup] : null;
            const stats = getSetStatsInDraft(draft, setId);
            const isExpanded = expandedPartSetId === setId;
            const setQuestions = getQuestionsForSetInDraft(draft, setId);
            const isOnlyPart = setOrder.length === 1;

            return (
              <div
                key={setId}
                className={cn(
                  'rounded-2xl border transition-all flex flex-col min-h-0',
                  isExpanded
                    ? cn('border-blue-300 bg-white', isOnlyPart && 'flex-1')
                    : 'shrink-0 border-slate-200/80 bg-white overflow-hidden',
                )}
              >
                <div className="flex items-start gap-2 p-3 shrink-0">
                  <button
                    type="button"
                    onClick={() => toggleExpandedPart(setId)}
                    className="flex flex-1 min-w-0 items-start gap-3 text-left rounded-xl -m-1 p-1 hover:bg-slate-50/80 transition-colors"
                    aria-expanded={isExpanded}
                  >
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: grpCfg?.bg ?? 'rgba(226,232,240,0.5)' }}
                    >
                      <span className="text-[11px] font-black font-sukhumvit text-slate-700">
                        {index + 1}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[9px] font-black uppercase tracking-wide text-blue-600 font-sukhumvit">
                          Part {index + 1}
                        </span>
                        <p className="text-[13px] font-black font-sukhumvit text-slate-800 truncate">
                          {set?.title ?? 'ชุดข้อสอบ'}
                        </p>
                        {set && !set.isPublished && (
                          <span className="text-[8px] font-black px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-600 shrink-0">
                            ร่าง
                          </span>
                        )}
                        {set?.examPdfUrl && (
                          <span className="text-[8px] font-black px-1.5 py-0.5 rounded-md bg-sky-50 text-sky-600 shrink-0">
                            PDF
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        {grpCfg && (
                          <span
                            className="text-[9px] font-bold font-sarabun px-1.5 py-0.5 rounded-md"
                            style={{ color: grpCfg.color, background: grpCfg.bg }}
                          >
                            {grpCfg.name}
                          </span>
                        )}
                        <span className="text-[10px] text-slate-500 font-sarabun">
                          {stats.count} ข้อ · {stats.points} คะแนน
                          {set?.createdByName ? ` · ${set.createdByName}` : ''}
                        </span>
                      </div>
                    </div>
                    <HiChevronDown
                      className={cn(
                        'w-4 h-4 shrink-0 text-slate-400 transition-transform mt-2',
                        isExpanded && 'rotate-180 text-blue-500',
                      )}
                    />
                  </button>
                  <div className="flex shrink-0 items-center gap-1.5 pt-0.5">
                    {set?.examPdfUrl && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openPdfPreview(set.examPdfUrl!, set.title);
                        }}
                        className={pdfPreviewButtonClass}
                        title="ดู PDF"
                        aria-label={`ดู PDF Part ${index + 1}`}
                      >
                        <HiEye className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {!roundsWithAttempts.has(normalizeExamRound(rk)) && (
                      <button
                        type="button"
                        onClick={() => {
                          if (expandedPartSetId === setId) setExpandedPartSetId(null);
                          removeSetFromRound(rk, setId);
                        }}
                        className="flex h-8 w-8 items-center justify-center rounded-xl border border-rose-200 bg-white text-rose-500 shadow-sm transition-colors hover:bg-rose-50"
                        title="ลบ part นี้"
                        aria-label={`ลบ Part ${index + 1}`}
                      >
                        <HiXMark className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <div
                    className={cn(
                      'border-t border-slate-100 px-3 pb-3 pt-2 flex flex-col min-h-0 overflow-y-auto overscroll-y-contain scrollbar-hide',
                      isOnlyPart ? 'flex-1' : 'max-h-[min(50vh,28rem)]',
                    )}
                  >
                    {setQuestions.length === 0 ? (
                      isHydratingSelected ? (
                        <div className="py-6 flex flex-col items-center justify-center gap-2 text-slate-400">
                          <IndeterminateProgress />
                          <p className="text-[10px] font-sarabun">กำลังโหลดข้อสอบ...</p>
                        </div>
                      ) : (
                        <div className="py-6 flex flex-col items-center justify-center gap-2 text-slate-400">
                          <p className="text-[11px] font-sarabun text-center leading-relaxed">
                            ไม่พบข้อสอบในชุดนี้ — เฉลยอาจถูกแก้ไขหลังบันทึกห้องสอบ
                            <br />
                            ลองลบ part นี้แล้วเลือกชุดข้อสอบใหม่อีกครั้ง
                          </p>
                        </div>
                      )
                    ) : (
                      setQuestions.map((q, qi) => {
                        const pts = resolveQuestionPoints(q.id, draft.questionPoints, q);
                        const plain = questionPlainText(q.questionText);
                        return (
                          <div
                            key={q.id}
                            className="flex items-start gap-2 rounded-xl border border-slate-100 bg-slate-50/60 px-2.5 py-2 mb-1.5 last:mb-0"
                          >
                            <span className="w-6 text-center text-[10px] font-black text-slate-500 shrink-0 pt-1 font-sukhumvit">
                              {qi + 1}
                            </span>
                            <p className="flex-1 min-w-0 text-[11px] font-sarabun text-slate-700 line-clamp-2 leading-snug">
                              {plain || `ข้อ ${qi + 1}`}
                            </p>
                            <label className="flex items-center gap-1 shrink-0">
                              <input
                                type="number"
                                min={0}
                                step={1}
                                value={draft.questionPoints[q.id] ?? pts}
                                onChange={(e) => updateQuestionPoint(rk, q.id, e.target.value)}
                                disabled={roundsWithAttempts.has(normalizeExamRound(rk))}
                                className="w-14 h-8 rounded-lg border border-slate-200 bg-white px-1 text-center text-[11px] font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-300 font-sukhumvit disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-100"
                                aria-label={`คะแนนข้อ ${qi + 1}`}
                              />
                              <span className="text-[9px] text-slate-400 font-sarabun hidden sm:inline">
                                คะแนน
                              </span>
                            </label>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <p className="text-[10px] text-slate-400 font-sarabun shrink-0 px-1">
          แตะการ์ด part เพื่อกำหนดคะแนนแต่ละข้อ — เพิ่ม part ได้จากคลังด้านซ้าย
        </p>
      </div>
    );
  };

  const renderQuestionBank = () => (
    <div className="flex flex-col flex-1 min-h-0 gap-3">
      <div className="shrink-0 flex flex-col gap-3 px-1.5">
        <div className="relative">
          <input
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            placeholder="ค้นหาชุดข้อสอบ..."
            className="w-full h-9 rounded-xl bg-white/95 border border-slate-200 px-3 pr-9 text-[12px] font-bold outline-none text-slate-700 placeholder:text-slate-400 font-sarabun focus:ring-2 focus:ring-inset focus:ring-indigo-500/25"
          />
          {searchText && (
            <button onClick={() => setSearchText('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <HiXMark className="w-3 h-3" />
            </button>
          )}
        </div>

        <div className="flex gap-2 min-w-0">
          <select
            value={filterGroup}
            onChange={(e) => setFilterGroup(e.target.value as SubjectGroupId | 'all')}
            className="h-9 flex-1 min-w-0 rounded-xl border border-slate-200 bg-white/95 pl-3 pr-8 text-[12px] font-bold text-slate-700 font-sukhumvit outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500/25 transition-all"
          >
            <option value="all">ทุกกลุ่มสาระ</option>
            {subjectGroupOptions.map(([gid, cfg]) => (
              <option key={gid} value={gid}>
                {cfg.name}
              </option>
            ))}
          </select>
          <select
            value={filterDepartment}
            onChange={(e) => {
              const nextDepartment = e.target.value as Department | 'all';
              setFilterDepartment(nextDepartment);
              setFilterGradeLevel('all');
            }}
            className="h-9 flex-1 min-w-0 rounded-xl border border-slate-200 bg-white/95 pl-3 pr-8 text-[12px] font-bold text-slate-700 font-sukhumvit outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500/25 transition-all"
          >
            <option value="all">ทุกแผนก</option>
            {Object.entries(DEPARTMENT_CONFIG).map(([deptId, cfg]) => (
              <option key={deptId} value={deptId}>
                {cfg.label}
              </option>
            ))}
          </select>
          <select
            value={filterGradeLevel}
            onChange={(e) => setFilterGradeLevel(e.target.value)}
            disabled={filterDepartment === 'all'}
            className="h-9 flex-1 min-w-0 rounded-xl border border-slate-200 bg-white/95 pl-3 pr-8 text-[12px] font-bold text-slate-700 font-sukhumvit outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <option value="all">ทุกระดับชั้น</option>
            {filterDepartment !== 'all' &&
              (DEPARTMENT_CONFIG[filterDepartment]?.grades || []).map((grade) => (
                <option key={grade} value={grade}>
                  {grade}
                </option>
              ))}
          </select>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto scrollbar-hide px-1.5">
        {!hasActiveBankFilters ? (
          <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white/50 py-10 text-center text-slate-400">
            <HiBookOpen className="mb-3 h-10 w-10 opacity-40" />
            <p className="font-sukhumvit text-[13px] font-black text-slate-600">
              เลือกตัวกรองเพื่อแสดงชุดข้อสอบ
            </p>
            <p className="mt-1 max-w-xs font-sarabun text-[11px] font-medium text-slate-400">
              เลือกกลุ่มสาระ แผนก ระดับชั้น หรือค้นหาชื่อชุดข้อสอบ
            </p>
          </div>
        ) : setsLoading ? (
          <div className="py-10 flex flex-col items-center justify-center gap-4">
            <IndeterminateProgress />
            <p className="text-slate-400 text-[12px] font-sarabun text-center">กำลังโหลด...</p>
          </div>
        ) : filteredSets.length === 0 ? (
          <div className="py-10 text-center text-slate-400">
            <HiDocumentText className="w-6 h-6 mx-auto mb-2 text-slate-300" />
            <p className="text-[12px] font-sarabun">ไม่พบชุดข้อสอบ</p>
          </div>
        ) : paginatedBankSets.map(set => {
          const grpCfg = SUBJECT_GROUP_CONFIG[set.subjectGroup];
          const selectedInRound = isSetSelectedInRound(set.id);
          const isLoadingThis = selectingSetId === set.id;
          return (
            <div
              key={set.id}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-2xl w-full transition-all ${
                selectedInRound
                  ? 'bg-white/90 border-[1.5px] border-blue-300'
                  : 'bg-white/90 border border-slate-200/50'
              }`}
            >
              <button
                type="button"
                onClick={() => void selectQuestionSetForRound(set.id)}
                disabled={isLoadingThis}
                className="flex flex-1 min-w-0 items-center gap-3 text-left disabled:cursor-not-allowed"
              >
                <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: grpCfg?.bg ?? 'rgba(226,232,240,0.5)' }}>
                  <HiBookOpen className="w-3 h-3" style={{ color: grpCfg?.color ?? '#94a3b8' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="text-[12px] font-black font-sukhumvit text-slate-800 truncate">{set.title}</p>
                    {!set.isPublished && (
                      <span className="text-[8px] font-black px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-600 shrink-0">ร่าง</span>
                    )}
                    {set.examPdfUrl && (
                      <span className="text-[8px] font-black px-1.5 py-0.5 rounded-md bg-sky-50 text-sky-600 shrink-0">PDF</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    <span className="text-[9px] font-bold font-sarabun px-1.5 py-0.5 rounded-md"
                      style={{ color: grpCfg?.color ?? '#6b7280', background: grpCfg?.bg ?? 'rgba(226,232,240,0.5)' }}>
                      {grpCfg?.name ?? set.subjectGroup}
                    </span>
                    <span className="text-[9px] text-slate-400 font-sarabun">{set.questionCount} ข้อ</span>
                    {set.createdByName && (
                      <span className="text-[9px] text-slate-400 font-sarabun truncate max-w-[120px]">
                        · {set.createdByName}
                      </span>
                    )}
                  </div>
                </div>
              </button>
              {set.examPdfUrl && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    openPdfPreview(set.examPdfUrl!, set.title);
                  }}
                  className={pdfPreviewButtonClass}
                  title="ดู PDF"
                  aria-label={`ดู PDF ${set.title}`}
                >
                  <HiEye className="w-3.5 h-3.5" />
                </button>
              )}
              {isLoadingThis ? (
                <div className="shrink-0 w-5 h-5">
                  <IndeterminateProgress />
                </div>
              ) : selectedInRound ? (
                <HiCheckCircle className="w-5 h-5 text-blue-600 shrink-0" />
              ) : (
                <HiChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
              )}
            </div>
          );
        })}
        </div>

        {hasActiveBankFilters && !setsLoading && filteredSets.length > 0 && (
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-slate-200/80 px-1.5 pt-2">
            <p className="font-sarabun text-[10px] font-bold text-slate-500">
              แสดง {bankRangeStart}–{bankRangeEnd} จาก {filteredSets.length} ชุด
            </p>
            {bankTotalPages > 1 && (
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={bankPage === 1}
                  onClick={() => setBankPage((p) => Math.max(1, p - 1))}
                  className="h-7 w-7 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                  aria-label="หน้าก่อนหน้า"
                >
                  <HiChevronLeft className="h-4 w-4" />
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: bankTotalPages }, (_, idx) => idx + 1).map((page) => {
                    if (bankTotalPages > 5) {
                      if (page !== 1 && page !== bankTotalPages && Math.abs(page - bankPage) > 1) {
                        if (page === 2 || page === bankTotalPages - 1) {
                          return (
                            <span key={`ellipsis-${page}`} className="px-0.5 font-sarabun text-[10px] text-slate-300">
                              …
                            </span>
                          );
                        }
                        return null;
                      }
                    }
                    const isActive = bankPage === page;
                    return (
                      <button
                        key={page}
                        type="button"
                        onClick={() => setBankPage(page)}
                        className={cn(
                          'h-7 min-w-[28px] rounded-lg px-1.5 font-sukhumvit text-[10px] font-black transition-all',
                          isActive
                            ? 'bg-slate-900 text-white shadow-sm'
                            : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800',
                        )}
                      >
                        {page}
                      </button>
                    );
                  })}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={bankPage === bankTotalPages}
                  onClick={() => setBankPage((p) => Math.min(bankTotalPages, p + 1))}
                  className="h-7 w-7 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                  aria-label="หน้าถัดไป"
                >
                  <HiChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  const mobileEmptyBankHint = isLgUp
    ? 'เลือกชุดข้อสอบจากคลังด้านซ้าย — เพิ่มได้หลาย part'
    : 'กดไอคอนหนังสือมุมขวาบนเพื่อเปิดคลังและเพิ่ม part';

  return (
    <div
      className="flex flex-col flex-1 min-h-0 gap-3 lg:gap-4 h-[calc(100dvh-10rem)] max-h-[calc(100dvh-10rem)]"
      onClick={onContentClick}
    >
      {/* Round tabs — shown only when maxAttempts > 1 */}
      {roundKeys.length > 1 && (
        <div className="flex items-center justify-center gap-2 flex-wrap lg:justify-start">
          {roundKeys.map(rk => {
            const hasDraft = !!roundDraft[rk]?.questionIds.size;
            const isActive = activeRound === rk;
            return (
              <button key={rk} onClick={() => setActiveRound(rk)}
                className="h-7 px-3 rounded-xl text-[11px] font-black transition-all font-sukhumvit relative"
                style={{
                  background: isActive ? '#0f172a' : hasDraft ? 'rgba(99,102,241,0.08)' : 'rgba(241,245,249,0.9)',
                  color: isActive ? '#fff' : hasDraft ? '#6366f1' : '#64748b',
                  border: isActive ? 'none' : hasDraft ? '1px solid rgba(99,102,241,0.25)' : '1px solid rgba(226,232,240,0.8)',
                }}>
                รอบ {rk}
                {hasDraft && !isActive && (
                  <span className="ml-1 text-[9px]">
                    • {getDraftSetOrder(roundDraft[rk]).length} part
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Two-card layout — independent scroll per card */}
      <div className="flex flex-1 min-h-0 flex-col lg:flex-row gap-4 items-stretch overflow-hidden">

        {/* ── Card 1: Bank browser (desktop only; mobile uses header book + drawer) ── */}
        <div
          className="hidden lg:flex flex-1 min-w-0 flex-col gap-3 rounded-[1.75rem] p-4 min-h-0 overflow-hidden"
          style={{
            background: 'rgba(248,250,252,0.8)',
            border: '1px solid rgba(226,232,240,0.6)',
            opacity: activeRoundHasAttempts ? 0.5 : 1,
            pointerEvents: activeRoundHasAttempts ? 'none' : undefined,
          }}
        >
          <div className="flex items-center justify-between shrink-0">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-sukhumvit">
              คลังข้อสอบ
            </p>
          </div>

          <div className="flex flex-1 min-h-0 flex-col overflow-hidden">
            {renderQuestionBank()}
          </div>
        </div>

        {/* ── Card 2: Selected question set per round ── */}
        <div
          className="flex flex-1 min-w-0 flex-col gap-3 rounded-[1.75rem] p-4 min-h-0 overflow-hidden"
          style={{
            background: 'rgba(255,255,255,0.9)',
            border: '1px solid rgba(226,232,240,0.6)',
          }}
        >
          <div className="flex items-center justify-between shrink-0">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-sukhumvit">
              ชุดข้อสอบที่เลือก
            </p>
            <div className="flex items-center gap-3">
              {roundKeys.length > 1 && (
                <span className="text-[9px] font-bold text-slate-400 font-sarabun">
                  {roundKeys.filter(rk => !!roundDraft[rk]?.questionIds.size).length}/{roundKeys.length} รอบตั้งค่าแล้ว
                </span>
              )}

              {activeRoundHasAttempts ? (
                <span className="text-[10px] font-black text-rose-600 font-sukhumvit">
                  มีนักเรียนทำข้อสอบรอบนี้แล้ว ไม่สามารถแก้ไขได้
                </span>
              ) : (
                <button
                  onClick={() => { requestSaveRound(activeRound); }}
                  disabled={isSaving === activeRound || !roundDraft[activeRound]}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black transition-all font-sukhumvit border border-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: savedRound === activeRound
                      ? 'linear-gradient(135deg,#059669,#10b981)'
                      : 'linear-gradient(135deg,#0f172a,#334155)',
                    color: '#fff',
                    opacity: (isSaving === activeRound || !roundDraft[activeRound]) ? 0.5 : 1,
                  }}
                >
                  {savedRound === activeRound ? <HiCheck className="w-2.5 h-2.5" /> : <HiArrowDownTray className="w-2.5 h-2.5" />}
                  {savedRound === activeRound ? 'บันทึกแล้ว' : isSaving === activeRound ? 'กำลังบันทึก...' : 'บันทึก'}
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
          {roundKeys.length === 1 ? (
            (() => {
              const draft = roundDraft[roundKeys[0]!];
              if (!draft || draft.questionIds.size === 0) {
                return (
                  <div className="flex-1 min-h-0 flex flex-col items-center justify-center text-slate-400">
                    <HiDocumentText className="w-7 h-7 mb-2 text-slate-300" />
                    <p className="text-[12px] font-sarabun">ยังไม่มีชุดข้อสอบที่เลือก</p>
                    <p className="text-[10px] text-slate-300 font-sarabun mt-1">{mobileEmptyBankHint}</p>
                  </div>
                );
              }
              if (rightCardLoading) {
                return (
                  <div className="flex-1 flex flex-col items-center justify-center text-slate-400 py-12">
                    <div className="mb-4">
                      <IndeterminateProgress />
                    </div>
                    <p className="text-[10px] font-sarabun">กำลังโหลดชุดข้อสอบ...</p>
                  </div>
                );
              }
              return renderSelectedPartsList(roundKeys[0]!, draft);
            })()
          ) : (
            (() => {
              const rk = activeRound;
              const draft = roundDraft[rk];

              if (!draft || draft.questionIds.size === 0) {
                return (
                  <div className="flex-1 min-h-0 flex flex-col items-center justify-center text-slate-400 py-12">
                    <HiDocumentText className="w-7 h-7 mb-2 text-slate-300" />
                    <p className="text-[12px] font-sarabun">ยังไม่มีชุดข้อสอบที่เลือกในรอบนี้</p>
                    <p className="text-[10px] text-slate-300 font-sarabun mt-1">{mobileEmptyBankHint}</p>
                  </div>
                );
              }

              if (rightCardLoading) {
                return (
                  <div className="flex-1 min-h-0 flex flex-col items-center justify-center text-slate-400 py-12">
                    <div className="mb-4">
                      <IndeterminateProgress />
                    </div>
                    <p className="text-[10px] font-sarabun">กำลังโหลดชุดข้อสอบ...</p>
                  </div>
                );
              }

              return renderSelectedPartsList(rk, draft);
            })()
          )}
          </div>
        </div>
      </div>

      {/* Mobile: side drawer for question bank */}
      <Drawer
        open={mobileBankDrawerOpen && !isLgUp}
        onOpenChange={setBankDrawerOpen}
        direction="right"
      >
        <DrawerContent
          className={cn(
            'h-dvh flex flex-col p-0 rounded-none',
            'data-[vaul-drawer-direction=right]:w-screen data-[vaul-drawer-direction=right]:max-w-none',
            'data-[vaul-drawer-direction=right]:before:inset-0 data-[vaul-drawer-direction=right]:before:rounded-none',
          )}
        >
          <DrawerHeader className="shrink-0 border-b border-slate-200/70 px-4 pb-3 pt-4">
            <div className="relative flex min-h-10 items-center justify-center">
              <div className="min-w-0 px-12 text-center">
                <DrawerTitle className="truncate text-sm font-black text-slate-900 font-sukhumvit">
                  คลังข้อสอบ
                </DrawerTitle>
                <DrawerDescription className="truncate text-[11px] text-slate-500 font-sarabun">
                  แตะชุดข้อสอบเพื่อเพิ่มเป็น part ในรอบ {activeRound}
                </DrawerDescription>
              </div>
              <button
                type="button"
                onClick={() => setBankDrawerOpen(false)}
                className="absolute right-0 top-1/2 inline-flex size-9 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 active:scale-[0.98]"
                aria-label="ปิด"
              >
                <HiOutlineXMark className="size-5" />
              </button>
            </div>
          </DrawerHeader>
          <div
            className="flex flex-1 min-h-0 flex-col overflow-hidden p-4 pt-3"
            style={{
              opacity: activeRoundHasAttempts ? 0.5 : 1,
              pointerEvents: activeRoundHasAttempts ? 'none' : undefined,
            }}
          >
            {renderQuestionBank()}
          </div>
        </DrawerContent>
      </Drawer>

      {/* Desktop: PDF side panel from left (no overlay — score panel stays interactive) */}
      {pdfPreview && isLgUp && (
        <aside
          className="fixed inset-y-0 left-0 z-50 flex w-[min(560px,42vw)] flex-col border-r border-slate-200/80 bg-white shadow-2xl"
          aria-label="PDF preview"
        >
          <div className="shrink-0 border-b border-slate-200/70 px-4 pb-3 pt-4">
            <div className="relative flex min-h-10 items-center gap-3">
              <div className="min-w-0 flex-1 pr-10">
                <h2 className="truncate text-sm font-black text-slate-900 font-sukhumvit">
                  {pdfPreview.title}
                </h2>
                <p className="truncate text-[11px] text-slate-500 font-sarabun">
                  ตัวอย่างชุดข้อสอบ PDF
                </p>
              </div>
              <a
                href={pdfPreview.url}
                target="_blank"
                rel="noreferrer"
                className="absolute right-10 top-1/2 inline-flex h-8 -translate-y-1/2 items-center rounded-xl border border-slate-200 bg-white px-3 text-[11px] font-bold text-slate-700 hover:bg-slate-50"
              >
                เปิดในแท็บใหม่
              </a>
              <button
                type="button"
                onClick={() => setPdfPreview(null)}
                className="absolute right-0 top-1/2 inline-flex size-9 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 active:scale-[0.98]"
                aria-label="ปิด"
              >
                <HiOutlineXMark className="size-5" />
              </button>
            </div>
          </div>
          <Suspense
            fallback={
              <div className="flex min-h-0 flex-1 items-center justify-center bg-slate-100">
                <IndeterminateProgress className="w-40" />
              </div>
            }
          >
            <PdfPreviewFrame url={pdfPreview.url} />
          </Suspense>
        </aside>
      )}

      {/* Mobile: PDF preview dialog */}
      <Dialog open={!!pdfPreview && !isLgUp} onOpenChange={(open) => !open && setPdfPreview(null)}>
        <DialogContent
          showCloseButton={false}
          className="flex h-[min(90dvh,820px)] w-[calc(100%-2rem)] max-w-4xl flex-col gap-0 overflow-hidden rounded-[1.5rem] border border-slate-200/60 p-0"
        >
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200/70 px-4 py-3">
            <div className="min-w-0">
              <DialogTitle className="truncate text-[15px] font-black text-slate-800 font-sukhumvit">
                {pdfPreview?.title ?? 'ดู PDF'}
              </DialogTitle>
              <p className="text-[11px] text-slate-500 font-sarabun">ตัวอย่างชุดข้อสอบ PDF</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {pdfPreview?.url && (
                <a
                  href={pdfPreview.url}
                  target="_blank"
                  rel="noreferrer"
                  className="hidden h-8 items-center rounded-xl border border-slate-200 bg-white px-3 text-[11px] font-bold text-slate-700 hover:bg-slate-50 sm:inline-flex"
                >
                  เปิดในแท็บใหม่
                </a>
              )}
              <button
                type="button"
                onClick={() => setPdfPreview(null)}
                className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                aria-label="ปิด"
              >
                <HiXMark className="w-4 h-4" />
              </button>
            </div>
          </div>
          {pdfPreview?.url && (
            <Suspense
              fallback={
                <div className="flex min-h-0 flex-1 items-center justify-center bg-slate-100">
                  <IndeterminateProgress className="w-40" />
                </div>
              }
            >
              <PdfPreviewFrame url={pdfPreview.url} className="pt-0" />
            </Suspense>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmSaveRound} onOpenChange={(open) => !open && setConfirmSaveRound(null)}>
        <DialogContent className="max-w-md rounded-[1.5rem] border border-slate-200/60 p-0 overflow-hidden bg-white">
          <div className="px-5 pt-5 pb-3">
            <DialogTitle className="text-[16px] font-black text-slate-800 font-sukhumvit">
              ยืนยันการบันทึกการลบข้อสอบ
            </DialogTitle>
            <p className="mt-2 text-[12px] leading-relaxed text-slate-600 font-sarabun">
              คุณกำลังลบข้อสอบออกจากห้องสอบรอบ {confirmSaveRound?.rk}{' '}
              จำนวน {confirmSaveRound?.removedCount ?? 0} ข้อ
              หลังบันทึกแล้วนักเรียนจะไม่เห็นข้อสอบที่ถูกลบในรอบนี้
            </p>
          </div>
          <DialogFooter className="px-5 pb-5 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setConfirmSaveRound(null)}
              className="rounded-xl font-bold text-slate-500 h-9"
            >
              ยกเลิก
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (!confirmSaveRound) return;
                const rk = confirmSaveRound.rk;
                setConfirmSaveRound(null);
                void handleSaveRound(rk);
              }}
              className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold h-9 px-4"
            >
              ยืนยันและบันทึก
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Score Settings Panel ──────────────────────────────────────────────────────

type MobileSaveAction = {
  onSave: () => void;
  disabled: boolean;
  isSaving: boolean;
  saved: boolean;
};

function ExamSettingsSaveButton({
  onClick,
  disabled,
  isSaving,
  saved,
  variant = 'default',
}: {
  onClick: () => void;
  disabled: boolean;
  isSaving: boolean;
  saved: boolean;
  variant?: 'default' | 'compact';
}) {
  const label = saved
    ? '✓ บันทึกเรียบร้อย'
    : isSaving
      ? 'กำลังบันทึก...'
      : 'บันทึกการตั้งค่า';

  if (variant === 'compact') {
    const compactTitle = saved ? 'บันทึกเรียบร้อย' : isSaving ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า';
    return (
      <motion.button
        whileTap={{ scale: 0.98 }}
        onClick={onClick}
        disabled={disabled}
        title={compactTitle}
        aria-label={compactTitle}
        className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-40 shrink-0"
      >
        {saved ? (
          <HiCheck className="h-5 w-5 text-emerald-600" />
        ) : isSaving ? (
          <span className="h-4 w-4 rounded-full border-2 border-slate-200 border-t-slate-700 animate-spin" />
        ) : (
          <HiArrowDownTray className="h-5 w-5 text-slate-700" />
        )}
      </motion.button>
    );
  }

  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      disabled={disabled}
      className="px-12 py-2.5 rounded-xl text-[13px] font-black text-white transition-all disabled:opacity-40 font-sukhumvit min-w-[200px]"
      style={{
        background: saved
          ? 'linear-gradient(135deg,#059669,#10b981)'
          : 'linear-gradient(135deg,#0f172a,#334155)',
        boxShadow: saved ? '0 8px 20px -6px rgba(5,150,105,0.25)' : '0 8px 20px -6px rgba(15,23,42,0.2)',
      }}
    >
      {label}
    </motion.button>
  );
}

function ScoreSettingsPanel({ room, onSave, onRegisterMobileSave }: {
  room: ExamRoom;
  onSave: (subjects: GradeBookSubjectLink[], scoreType: GradeScoreType) => Promise<void>;
  onRegisterMobileSave?: (action: MobileSaveAction | null) => void;
}) {
  const { classes, allClasses } = useClassroomManager();
  const { subjects: legacySubjects } = useCurriculum();
  const { versions, coursesByVersion, loadCoursesForVersion } = useCurriculumVersioned();

  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>(() => {
    const linked = room.settings?.gradeBookSubjects ?? [];
    if (linked.length > 0) return linked.map((s) => s.subjectId);
    if (room.settings?.gradeBookSubjectId) return [room.settings.gradeBookSubjectId];
    return [];
  });
  const [selectedScoreType] = useState<GradeScoreType>(
    room.settings?.gradeBookScoreType ?? 'midterm'
  );
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const maxLinkedSubjects = 3;

  // Resolve the classroom object for this exam room
  // NOTE: use allClasses so we can find classes from both semester 1 and 2.
  const classRoom = useMemo(
    () => allClasses.find(c => c.id === room.classId) ?? classes.find(c => c.id === room.classId) ?? null,
    [allClasses, classes, room.classId],
  );

  // Classes for the same room (same year + grade + roomNumber) across semesters.
  const relatedClassRooms = useMemo(() => {
    if (!classRoom) return [] as typeof allClasses;
    return allClasses.filter(c =>
      String(c.academicYearId) === String(classRoom.academicYearId) &&
      String(c.gradeLevel) === String(classRoom.gradeLevel) &&
      String(c.roomNumber) === String(classRoom.roomNumber),
    );
  }, [allClasses, classRoom]);

  // Lazy-load versioned courses for the matching curriculum package
  useEffect(() => {
    if (!classRoom) return;
    const pkgId = (classRoom as any).curriculumPackageId || (classRoom as any).curriculumId;
    const target = pkgId
      ? versions.find(v => v.id === pkgId)
      : versions.find(v => Number(v.year) === Number(classRoom.academicYearId));
    if (target && !coursesByVersion[target.id]) {
      loadCoursesForVersion(target.id);
    }
  }, [classRoom, versions, coursesByVersion, loadCoursesForVersion]);

  type SubjectOption = Subject & { semesters: Array<1 | 2> };

  // Build subjects list from enrolledCourses across semester 1 + 2.
  const subjects = useMemo((): SubjectOption[] => {
    if (!classRoom) return [];
    if (relatedClassRooms.length === 0) return [];

    const enrolledMap = new Map<string, Set<1 | 2>>();
    relatedClassRooms.forEach((cls) => {
      (cls.enrolledCourses ?? []).forEach((ec) => {
        if (!ec.subjectId) return;
        const sem = (ec.semester ?? cls.semester) as 1 | 2;
        const prev = enrolledMap.get(ec.subjectId) ?? new Set<1 | 2>();
        if (sem === 1 || sem === 2) prev.add(sem);
        enrolledMap.set(ec.subjectId, prev);
      });
    });

    if (enrolledMap.size === 0) return [];

    const allVersionedCourses = Object.values(coursesByVersion).flat();

    return Array.from(enrolledMap.entries())
      .map(([subjectId, semesterSet]) => {
        const semesters = Array.from(semesterSet).sort((a, b) => a - b) as Array<1 | 2>;
        // 1. Look in legacy subjects
        const legacy = legacySubjects.find(s => s.id === subjectId);
        if (legacy) return { ...legacy, semesters };

        // 2. Look in versioned curriculum courses
        const versioned = allVersionedCourses.find(vc => vc.id === subjectId);
        if (versioned) {
          const dept =
            versioned.department === 'early' || versioned.department === 'primary' || versioned.department === 'secondary'
              ? versioned.department
              : 'secondary';
          return {
            id: versioned.id,
            name: versioned.courseName,
            code: versioned.courseCode,
            credits: versioned.credit || 0,
            hoursPerWeek: versioned.periodsPerWeek ?? 1,
            totalHours: versioned.totalHours ?? (versioned.periodsPerWeek ?? 1) * 18,
            category: (versioned.category === 'basic' ? 'core' : versioned.category === 'additional' ? 'added' : 'activity') as Subject['category'],
            department: dept,
            subjectGroup: versioned.subjectGroup,
            semesters,
          } satisfies SubjectOption;
        }
        return null;
      })
      .filter((s): s is SubjectOption => s !== null);
  }, [classRoom, relatedClassRooms, legacySubjects, coursesByVersion]);

  const currentLinked = (() => {
    const linked = room.settings?.gradeBookSubjects ?? [];
    if (linked.length > 0) return linked;
    if (room.settings?.gradeBookSubjectId) {
      return [{
        subjectId: room.settings.gradeBookSubjectId,
        subjectName: room.settings.gradeBookSubjectName ?? '',
        subjectCode: room.settings.gradeBookSubjectCode ?? '',
      }];
    }
    return [];
  })();
  const hasCurrentLinked = currentLinked.length > 0;

  const handleSave = useCallback(async () => {
    const selectedSubjects = selectedSubjectIds
      .map((id) => subjects.find((s) => s.id === id))
      .filter((s): s is SubjectOption => !!s)
      .map((s) => ({
        subjectId: s.id,
        subjectName: s.name,
        subjectCode: s.code ?? '',
      }));
    if (selectedSubjects.length === 0 && !hasCurrentLinked) return;
    setIsSaving(true);
    try {
      await onSave(selectedSubjects, selectedScoreType);
      setSaved(true);
      toast.success('เชื่อมต่อวิชากับสมุดบันทึกคะแนนเรียบร้อยแล้ว');
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setIsSaving(false);
    }
  }, [selectedSubjectIds, subjects, hasCurrentLinked, onSave, selectedScoreType]);

  const handleSaveRef = useRef(handleSave);
  handleSaveRef.current = handleSave;

  const stableMobileSave = useCallback(() => {
    void handleSaveRef.current();
  }, []);

  const mobileSaveDisabled = (!selectedSubjectIds.length && !hasCurrentLinked) || isSaving;

  useEffect(() => {
    if (!onRegisterMobileSave) return;
    onRegisterMobileSave({
      onSave: stableMobileSave,
      disabled: mobileSaveDisabled,
      isSaving,
      saved,
    });
    return () => onRegisterMobileSave(null);
  }, [onRegisterMobileSave, stableMobileSave, mobileSaveDisabled, isSaving, saved]);

  const handleDisconnect = async () => {
    setIsSaving(true);
    try {
      await onSave([], selectedScoreType);
      setSelectedSubjectIds([]);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Current link status */}
      {currentLinked.length > 0 ? (
        <div className="flex items-center gap-3 px-4 py-3 rounded-2xl"
          style={{ background: 'rgba(5,150,105,0.07)', border: '1px solid rgba(5,150,105,0.2)' }}>
          <Link2 size={14} className="text-emerald-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-black text-emerald-700 font-sukhumvit">เชื่อมต่อกับสมุดบันทึกคะแนนแล้ว</p>
            <div className="flex flex-wrap items-center gap-1.5 mt-1">
              {currentLinked.map((s) => (
                <span
                  key={s.subjectId}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold font-sarabun bg-white/80 text-slate-700 border border-emerald-100"
                >
                  {s.subjectCode && <span className="text-slate-400">{s.subjectCode}</span>}
                  <span>{s.subjectName || s.subjectId}</span>
                </span>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={() => { void handleDisconnect(); }}
            disabled={isSaving}
            className="h-8 px-3 rounded-xl text-[11px] font-bold font-sukhumvit text-rose-600 bg-rose-50 border border-rose-200 hover:bg-rose-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          >
            ยกเลิกการเชื่อมต่อ
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-3 px-4 py-3 rounded-2xl"
          style={{ background: 'rgba(248,250,252,0.8)', border: '1px solid rgba(226,232,240,0.8)' }}>
          <BookOpen size={14} className="text-slate-300 shrink-0" />
          <p className="text-[12px] font-sarabun text-slate-400">ยังไม่ได้เชื่อมต่อกับสมุดบันทึกคะแนน</p>
        </div>
      )}

      <div>
        {!classRoom ? (
          <div className="py-8 text-center text-slate-400">
            <BookOpen size={28} className="mx-auto mb-2 text-slate-300" />
            <p className="text-[13px] font-sarabun">ห้องสอบนี้ยังไม่ได้ผูกกับห้องเรียน</p>
            <p className="text-[11px] font-sarabun text-slate-300 mt-1">กรุณาแก้ไขห้องสอบและเลือกห้องเรียน</p>
          </div>
        ) : subjects.length === 0 ? (
          <div className="py-8 text-center text-slate-400">
            <BookOpen size={28} className="mx-auto mb-2 text-slate-300" />
            <p className="text-[13px] font-sarabun">ยังไม่มีรายวิชาที่ผูกกับห้องนี้</p>
            <p className="text-[11px] font-sarabun text-slate-300 mt-1">กรุณาผูกรายวิชาในหน้าจัดการห้องเรียนก่อน</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {subjects.map(subject => {
              const isSelected = selectedSubjectIds.includes(subject.id);
              const subjectGroupKey = subject.subjectGroup || subject.name;
              const iconColors = getSubjectColors(subjectGroupKey);
              return (
                <motion.button
                  key={subject.id}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => {
                    setSelectedSubjectIds((prev) => {
                      if (prev.includes(subject.id)) {
                        return prev.filter((id) => id !== subject.id);
                      }
                      if (prev.length >= maxLinkedSubjects) return prev;
                      return [...prev, subject.id];
                    });
                  }}
                  className="flex items-center gap-3 px-4 py-3 rounded-2xl text-left w-full transition-all"
                  style={{
                    background: isSelected ? '#ffffff' : 'rgba(248,250,252,0.8)',
                    border: isSelected ? '1.5px solid rgba(37,99,235,0.45)' : '1px solid rgba(226,232,240,0.6)',
                  }}
                >
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-sm"
                    style={{
                      background: `linear-gradient(135deg, ${iconColors[1]} 0%, ${iconColors[0]} 100%)`,
                    }}
                  >
                    <SubjectIcon subjectGroup={subjectGroupKey} size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-[13px] font-black font-sukhumvit truncate ${isSelected ? 'text-blue-700' : 'text-slate-700'}`}>
                      {subject.name}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      {subject.code && (
                        <p className={`text-[10px] font-bold font-sarabun ${isSelected ? 'text-blue-600' : 'text-slate-400'}`}>{subject.code}</p>
                      )}
                      <span className="text-[9px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-md font-sarabun">
                        เทอม {subject.semesters.join('/')}
                      </span>
                    </div>
                  </div>
                  {isSelected && (
                    <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
                      <Check size={11} className="text-white" />
                    </div>
                  )}
                </motion.button>
              );
            })}
          </div>
        )}
      </div>



      {/* Save button — desktop only (mobile uses header action) */}
      <div className="hidden lg:flex justify-center mt-6">
        <ExamSettingsSaveButton
          onClick={() => { void handleSave(); }}
          disabled={(!selectedSubjectIds.length && !hasCurrentLinked) || isSaving}
          isSaving={isSaving}
          saved={saved}
        />
      </div>
    </div>
  );
}

// ── Score collection type (shared: card badge + score-config panel) ───────────
const SCORE_COLLECTION_CONFIG: Record<ScoreCollectionType, { label: string; desc: string; color: string; bg: string; border: string }> = {
  classwork: { label: 'ประเมินผล', desc: 'คะแนนเก็บระหว่างเรียน', color: '#6366f1', bg: 'rgba(99,102,241,0.08)', border: 'rgba(99,102,241,0.25)' },
  quiz: { label: 'สอบย่อย', desc: 'ทดสอบย่อยในชั้นเรียน', color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.3)' },
  midterm: { label: 'กลางภาค', desc: 'สอบกลางภาคเรียน', color: '#0ea5e9', bg: 'rgba(14,165,233,0.08)', border: 'rgba(14,165,233,0.25)' },
  final: { label: 'ปลายภาค', desc: 'สอบปลายภาคเรียน', color: '#059669', bg: 'rgba(5,150,105,0.08)', border: 'rgba(5,150,105,0.25)' },
};

const DRAWER_QUICK_TABS: SettingsTab[] = ['takers', 'questions', 'score-settings', 'score-summary', 'score-config'];

const ROOM_DETAIL_DRAWER_CONTENT_CLASS = cn(
  'flex h-dvh max-h-dvh flex-col overflow-hidden bg-transparent p-0 before:hidden',
  'data-[vaul-drawer-direction=right]:w-screen data-[vaul-drawer-direction=right]:max-w-none',
  'sm:h-full sm:max-h-full sm:p-2.5',
  'sm:data-[vaul-drawer-direction=right]:w-full sm:data-[vaul-drawer-direction=right]:max-w-md',
);

const ROOM_DETAIL_DRAWER_PANEL_CLASS = cn(
  'flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-white',
  'sm:rounded-4xl sm:border sm:border-slate-200/80 sm:shadow-2xl',
);

/** กดที่ icon ห้องสอบ → เปิด Drawer ด้านข้างแสดงรายละเอียดห้องสอบ + ปุ่ม tab ลัดไปหน้าจัดการห้องสอบ */
function RoomIconDetailDrawer({ open, onClose, room, canEdit, isStudent, onOpenSettings, onEdit }: {
  open: boolean;
  onClose: () => void;
  room: ExamRoom;
  canEdit?: boolean;
  isStudent?: boolean;
  onOpenSettings: (tab?: SettingsTab) => void;
  onEdit: () => void;
}) {
  const dept = (room.departmentId || 'secondary') as Department;
  const deptCfg = DEPARTMENT_CONFIG[dept];
  const groupCfg = room.subjectGroupId ? SUBJECT_GROUP_CONFIG[room.subjectGroupId as SubjectGroupId] : undefined;
  const subjectLabel = room.subSubjectGroup?.trim() || groupCfg?.name || '—';

  const rows: { label: string; value: string }[] = [
    { label: 'แผนก / ชั้น', value: `${deptCfg?.label ?? '—'} · ${getExamRoomGradeLevel(room) || '—'}` },
    { label: 'กลุ่มสาระ / สาระย่อย', value: subjectLabel },
    { label: 'ครูผู้สอน', value: room.teacherName || '—' },
    { label: 'จำนวนข้อ / คะแนนเต็ม', value: `${room.questionCount ?? 0} ข้อ · ${room.totalPoints ?? 0} คะแนน` },
    { label: 'ระยะเวลาทำข้อสอบ', value: room.durationMinutes ? `${room.durationMinutes} นาที` : 'ไม่จำกัดเวลา' },
    { label: 'รอบสอบ', value: `เปิดแล้ว ${room.completedRounds ?? 0} รอบ · ปัจจุบันรอบ ${room.currentRound ?? 1}` },
    ...(canEdit && !isStudent ? [{ label: 'รหัสห้องสอบ', value: room.password || '—' }] : []),
    { label: 'สร้างเมื่อ', value: room.createdAt ? new Date(room.createdAt).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' }) : '—' },
  ];

  return (
    <Drawer open={open} onOpenChange={(next) => { if (!next) onClose(); }} direction="right">
      <DrawerContent className={ROOM_DETAIL_DRAWER_CONTENT_CLASS}>
        <div className={ROOM_DETAIL_DRAWER_PANEL_CLASS}>
          <DrawerHeader className="shrink-0 border-b border-slate-100 px-5 pb-3 pt-5">
            <div className="relative flex min-h-10 items-center justify-start">
              <div className="flex items-center gap-2.5 min-w-0 pr-12">
                <img src={resolveExamRoomIconSrc(room)} alt="" className="h-9 w-9 shrink-0 object-contain" />
                <div className="min-w-0 text-left">
                  <DrawerTitle className="line-clamp-2 min-h-[calc(1.375em*2)] font-sukhumvit text-[15px] font-black leading-snug text-slate-800 text-left">
                    {room.title}
                  </DrawerTitle>
                  <DrawerDescription className="truncate font-sukhumvit text-[11px] text-slate-400 text-left">
                    {room.subjectName || '—'}
                  </DrawerDescription>
                </div>
              </div>
              <div className={DRAWER_HEADER_RIGHT_ACTIONS}>
                <button
                  type="button"
                  onClick={onClose}
                  className={DRAWER_HEADER_ICON_BTN}
                  aria-label="ปิด"
                >
                  <HiXMark size={16} />
                </button>
              </div>
            </div>
          </DrawerHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 scrollbar-hide">
            {canEdit && !isStudent && (
              <div className="mb-4 grid grid-cols-3 gap-2">
                {DRAWER_QUICK_TABS.map((tab) => {
                  const cfg = TAB_CONFIG[tab];
                  const Icon = cfg.icon;
                  return (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => { onClose(); onOpenSettings(tab); }}
                      className="flex flex-col items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 hover:bg-slate-100 transition-colors"
                    >
                      <Icon className="w-4 h-4 text-slate-600" />
                      <span className="text-[10px] font-bold text-slate-600 font-sukhumvit">{cfg.label}</span>
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => { onClose(); onEdit(); }}
                  className="flex flex-col items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 hover:bg-slate-100 transition-colors"
                >
                  <HiMiniPencil className="w-4 h-4 text-slate-600" />
                  <span className="text-[10px] font-bold text-slate-600 font-sukhumvit">แก้ไข</span>
                </button>
              </div>
            )}
            <div className="mb-4 flex justify-center">
              <RoomCardStatusPill room={room} />
            </div>
            <div className="flex flex-col divide-y divide-slate-100">
              {rows.map((row) => (
                <div key={row.label} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                  <span className="shrink-0 text-[11px] font-bold text-slate-500 font-sukhumvit">{row.label}</span>
                  <span className="min-w-0 truncate text-[12px] font-bold text-slate-800 font-sukhumvit text-right">{row.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

// ── Room Card ─────────────────────────────────────────────────────────────────
function RoomCard({
  room, onProctor, onChangeStatus, onFinish, onDelete, onEdit, onOpenSettings, isStudent, onTakeExam,
  canEdit, canDelete, myAttempt, onShowSummary, alert,
}: {
  room: ExamRoom;
  onProctor: () => void;
  onChangeStatus: (status: ExamRoom['status'], bypassConfirm?: boolean) => void;
  onFinish?: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onOpenSettings: (tab?: SettingsTab) => void;
  isStudent?: boolean;
  onTakeExam?: () => void;
  canEdit?: boolean;
  canDelete?: boolean;
  myAttempt?: ExamAttempt | null;
  onShowSummary: (room: ExamRoom, attempt: ExamAttempt) => void;
  /** ตรวจพบนักเรียนสลับหน้าจอ — การ์ดจะเปลี่ยนหน้าแสดงชื่อชั่วคราว (ไม่ใช้กับมุมมองนักเรียน) */
  alert?: { studentName: string; key: number } | null;
}) {
  const { role } = useAuth();
  const [showActions, setShowActions] = useState(false);
  const [actionsAnchorRect, setActionsAnchorRect] = useState<DOMRect | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const needsQuestionSetup = Boolean(!isStudent && canEdit && !isExamRoomQuestionsConfigured(room));
  // Unlimited-round rooms (maxAttempts === 0) cycle active <-> upcoming forever —
  // they need an explicit way to reach a terminal 'closed' state.
  const isUnlimitedRoom = (room.settings?.maxAttempts ?? 1) === 0;
  const showFinishButton = Boolean(!isStudent && canEdit && isUnlimitedRoom && room.status !== 'closed');
  const showClosedFinishDisabled = Boolean(!isStudent && canEdit && room.status === 'closed');

  const showStudentTakeExam = Boolean(isStudent && room.status === 'active');
  const showStudentResults = Boolean(
    isStudent && myAttempt && (myAttempt.status === 'submitted' || myAttempt.status === 'graded'),
  );
  const showFooterActions = showStudentResults
    || showFinishButton
    || showClosedFinishDisabled;

  const hasScoreConnection = Boolean(
    (room.settings?.gradeBookSubjects && room.settings.gradeBookSubjects.length > 0) ||
    room.settings?.gradeBookSubjectId
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-2xl p-2.5 flex flex-col gap-2 h-full transition-all duration-300"
      style={{ perspective: 800 }}
    >
      <AnimatePresence mode="wait" initial={false}>
        {alert ? (
          <motion.div
            key={`suspicious-alert-${alert.key}`}
            initial={{ opacity: 0, rotateX: -90 }}
            animate={{ opacity: 1, rotateX: 0 }}
            exit={{ opacity: 0, rotateX: 90 }}
            transition={{ duration: 0.35 }}
            className="flex flex-1 flex-col items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 py-4 text-center"
          >
            <ShieldAlert className="w-7 h-7 text-rose-500" />
            <p className="text-[10px] font-black uppercase tracking-wider text-rose-500 font-sukhumvit">
              ตรวจพบสลับหน้าจอ
            </p>
            <p className="px-3 text-[15px] font-black text-slate-800 font-sukhumvit leading-snug line-clamp-2">
              {alert.studentName}
            </p>
          </motion.div>
        ) : (
          <motion.div
            key="card-face"
            initial={{ opacity: 0, rotateX: 90 }}
            animate={{ opacity: 1, rotateX: 0 }}
            exit={{ opacity: 0, rotateX: -90 }}
            transition={{ duration: 0.35 }}
            className="flex flex-1 flex-col gap-2 min-h-0"
          >
      {/* Icon + name — หลักการเดียวกับโฟลเดอร์แผนการสอน: รูปกับชื่ออยู่บนสุด กึ่งกลาง ปุ่ม/สถานะตามด้านล่าง */}
      <div className="flex flex-col items-center gap-1.5 text-center">
        <div className="relative shrink-0">
          <img
            src={resolveExamRoomIconSrc(room)}
            alt=""
            draggable={false}
            onClick={() => setShowDetail(true)}
            className={cn(
              'h-48 w-48 shrink-0 object-contain drop-shadow-sm cursor-pointer',
              room.status === 'closed' && 'opacity-50 grayscale',
              room.status === 'active' && 'animate-pulse drop-shadow-[0_0_16px_rgba(34,197,94,0.75)]',
              needsQuestionSetup && 'drop-shadow-[0_0_16px_rgba(244,63,94,0.75)]',
            )}
          />
          {showStudentTakeExam && (
            <motion.button
              type="button"
              whileTap={{ scale: 0.92 }}
              onClick={onTakeExam}
              title="ทำข้อสอบ"
              className="absolute inset-0 m-auto flex h-14 w-14 items-center justify-center rounded-full bg-white/40 backdrop-blur-md border border-white/50 text-slate-800 shadow-lg hover:bg-white/60 transition-colors"
            >
              <HiPlay className="w-6 h-6" />
            </motion.button>
          )}
          {!isStudent && canEdit && room.status === 'active' && (
            <>
              <motion.button
                type="button"
                whileTap={{ scale: 0.92 }}
                onClick={() => onChangeStatus('closed')}
                title={`ปิดรอบ ${room.currentRound ?? 1}`}
                className="absolute inset-0 m-auto flex h-14 w-14 items-center justify-center rounded-full bg-white/40 backdrop-blur-md border border-white/50 text-rose-600 shadow-lg hover:bg-white/60 transition-colors"
              >
                <HiStop className="w-6 h-6" />
              </motion.button>
              <div className="absolute inset-x-0 bottom-1 flex justify-center">
                <span className="rounded-full bg-white/70 backdrop-blur-md px-2 py-0.5 text-[10px] font-bold text-rose-600 font-sukhumvit">
                  <CountdownTimer
                    startTime={room.startTime}
                    durationMinutes={room.durationMinutes}
                    onExpire={() => onChangeStatus('closed', true)}
                    variant="plain"
                  />
                </span>
              </div>
            </>
          )}
        </div>
        <div className="w-full space-y-1">
          <h3
            className="text-[13px] font-black text-slate-800 font-sukhumvit leading-snug line-clamp-2 min-h-[calc(1.375em*2)]"
            title={room.title}
          >
            {room.title}
          </h3>
          {role === 'sysadmin' && (
            <p className="text-[9px] font-mono text-slate-400 truncate" title={room.id}>
              {room.id}
            </p>
          )}
        </div>
        {(() => {
          const groupCfg = room.subjectGroupId
            ? SUBJECT_GROUP_CONFIG[room.subjectGroupId as SubjectGroupId]
            : undefined;
          const label = room.subSubjectGroup?.trim() || groupCfg?.name;
          if (!label) return null;
          return (
            <span
              className="inline-flex max-w-full items-center rounded-full px-2 py-0.5 text-[9px] font-bold truncate"
              style={{ color: groupCfg?.color, backgroundColor: groupCfg?.bg }}
              title={label}
            >
              {label}
            </span>
          );
        })()}
        {!isStudent && (canEdit || canDelete) && (
          <div className="flex items-center justify-center gap-1.5">
            {hasScoreConnection && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenSettings('score-settings');
                }}
                className="shrink-0 inline-flex items-center justify-center p-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-100 transition-all text-emerald-600 hover:text-emerald-700 cursor-pointer"
                title="เชื่อมต่อคะแนนกับรายวิชาแล้ว - คลิกเพื่อดูวิชาที่เชื่อมต่อ"
              >
                <Link2 className="w-3.5 h-3.5" />
              </button>
            )}
            {canEdit && (
              <RoomCardIconButton onClick={onProctor} title="Proctor">
                <HiEye className="w-4 h-4" />
              </RoomCardIconButton>
            )}
            {!isStudent && room.status === 'upcoming' && (
              <motion.button
                whileTap={{ scale: 0.92 }}
                onClick={() => onChangeStatus('active')}
                title={`เริ่มรอบ ${(room.completedRounds ?? 0) + 1}`}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 hover:bg-emerald-200/80 transition-colors"
              >
                <HiPlay className="w-4 h-4" />
              </motion.button>
            )}
            {showFinishButton && (
              <motion.button
                whileTap={{ scale: 0.92 }}
                onClick={onFinish}
                title="จบห้องสอบถาวร — ห้องสอบนี้จะไม่สามารถเปิดได้อีก"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200/80 transition-colors"
              >
                <HiCheckCircle className="w-4 h-4" />
              </motion.button>
            )}
            {showClosedFinishDisabled && (
              <button
                type="button"
                disabled
                title="ห้องสอบนี้ปิดแล้ว"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-400 cursor-not-allowed"
              >
                <HiCheckCircle className="w-4 h-4" />
              </button>
            )}
            <motion.button
              type="button"
              whileTap={{ scale: 0.92 }}
              onClick={(e) => {
                if (showActions) {
                  setShowActions(false);
                  setActionsAnchorRect(null);
                  return;
                }
                setActionsAnchorRect(e.currentTarget.getBoundingClientRect());
                setShowActions(true);
              }}
              title="จัดการห้องสอบ"
              className={cn(ROOM_CARD_ICON_BTN_BASE, 'bg-slate-100 hover:bg-slate-200/80 text-slate-900')}
            >
              <HiSquares2X2 className="w-4 h-4" />
            </motion.button>
          </div>
        )}
      </div>

      {showActions && actionsAnchorRect && (
        <RoomCardActionsPlate
          anchorRect={actionsAnchorRect}
          canEdit={canEdit}
          canDelete={canDelete}
          needsQuestionSetup={needsQuestionSetup}
          onEdit={onEdit}
          onOpenSettings={onOpenSettings}
          onDelete={onDelete}
          onClose={() => {
            setShowActions(false);
            setActionsAnchorRect(null);
          }}
        />
      )}

      <div className="flex flex-col gap-2 flex-1 min-h-0">
            {room.subjectName && (
              <div className="flex flex-nowrap items-center gap-1 min-w-0 overflow-hidden min-h-[1.5rem]">
                <span className="text-[10px] text-slate-500 font-sarabun truncate">{room.subjectName}</span>
              </div>
            )}

            {showFooterActions && (
              <div className="flex items-center justify-center gap-1.5 pt-0.5 mt-auto">        {isStudent ? (
          <>
            {showStudentResults && (
              <>
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={() => { window.location.href = `/exam/${room.id}`; }}
                  className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-slate-100 hover:bg-slate-200/80 text-slate-900 transition-colors"
                  title="ดูผล"
                >
                  <HiPlay className="w-3.5 h-3.5" />
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.92 }}
                  onClick={() => onShowSummary(room, myAttempt!)}
                  className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-slate-100 hover:bg-slate-200/80 text-slate-900 transition-colors"
                  title="สรุปคะแนน"
                >
                  <HiPresentationChartLine className="w-3.5 h-3.5" />
                </motion.button>
              </>
            )}
          </>
        ) : null}
              </div>
            )}
      </div>
          </motion.div>
        )}
      </AnimatePresence>
      {showDetail && (
        <RoomIconDetailDrawer
          open={showDetail}
          onClose={() => setShowDetail(false)}
          room={room}
          canEdit={canEdit}
          isStudent={isStudent}
          onOpenSettings={(tab) => onOpenSettings(tab)}
          onEdit={onEdit}
        />
      )}
    </motion.div>
  );
}

// ── Score Config Panel ────────────────────────────────────────────────────────

function ScoreConfigPanel({ room, onSave, onRegisterMobileSave }: {
  room: ExamRoom;
  onSave: (data: Partial<ExamRoom['settings']>) => Promise<void>;
  onRegisterMobileSave?: (action: MobileSaveAction | null) => void;
}) {
  const [enabled, setEnabled] = useState<boolean>(
    room.settings?.scoreCollectionEnabled ?? false,
  );
  const [scoreType, setScoreType] = useState<ScoreCollectionType>(
    (room.settings?.scoreCollectionType as ScoreCollectionType) ?? 'classwork',
  );
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      await onSave({
        scoreCollectionEnabled: enabled,
        scoreCollectionType: scoreType,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setIsSaving(false);
    }
  }, [enabled, scoreType, onSave]);

  const handleSaveRef = useRef(handleSave);
  handleSaveRef.current = handleSave;

  const stableMobileSave = useCallback(() => {
    void handleSaveRef.current();
  }, []);

  useEffect(() => {
    if (!onRegisterMobileSave) return;
    onRegisterMobileSave({
      onSave: stableMobileSave,
      disabled: isSaving,
      isSaving,
      saved,
    });
    return () => onRegisterMobileSave(null);
  }, [onRegisterMobileSave, stableMobileSave, isSaving, saved]);

  return (
    <div className="flex flex-col gap-5">
      {/* Toggle */}
      <div className="flex items-center justify-between px-4 py-4 rounded-2xl bg-white border border-slate-200">
        <div>
          <p className="text-[13px] font-black text-slate-800 font-sukhumvit">นำคะแนนไปคำนวณในสมุดบันทึกคะแนน</p>
          <p className="text-[11px] text-slate-400 font-sarabun mt-0.5">
            {enabled ? 'เปิดใช้งาน — คะแนนจะถูกส่งไปยัง Grade Book' : 'ปิดอยู่ — คะแนนสอบนี้จะไม่ถูกนำไปคำนวณ'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEnabled(v => !v)}
          className="relative h-7 w-[52px] rounded-full p-1 transition-colors duration-200 shrink-0"
          style={{ background: enabled ? '#10b981' : '#cbd5e1' }}
        >
          <span
            className="block h-5 w-5 rounded-full bg-white border border-slate-200 transition-transform duration-200"
            style={{ transform: enabled ? 'translateX(24px)' : 'translateX(0)' }}
          />
        </button>
      </div>

      {/* Score collection type */}
      <AnimatePresence>
        {enabled && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex flex-col gap-4 overflow-hidden"
          >
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 font-sukhumvit">
                ประเภทการเก็บคะแนน
              </p>
              <div className="flex flex-col gap-2">
                {(Object.entries(SCORE_COLLECTION_CONFIG) as [ScoreCollectionType, typeof SCORE_COLLECTION_CONFIG[ScoreCollectionType]][]).map(([type, c]) => {
                  const isActive = scoreType === type;
                  return (
                    <motion.button
                      key={type}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setScoreType(type)}
                      className="flex flex-col gap-1 px-4 py-3 rounded-2xl text-left transition-all"
                      style={{
                        background: isActive ? '#ffffff' : 'rgba(248,250,252,0.8)',
                        border: isActive ? '1.5px solid rgba(37,99,235,0.45)' : '1px solid rgba(226,232,240,0.6)',
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-[13px] font-black font-sukhumvit ${isActive ? 'text-blue-600' : 'text-slate-600'}`}>
                          {c.label}
                        </span>
                        {isActive && (
                          <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0 bg-blue-600">
                            <Check size={9} className="text-white" />
                          </div>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 font-sarabun">{c.desc}</span>
                    </motion.button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Save — desktop only (mobile uses header action) */}
      <div className="hidden lg:flex justify-center mt-6">
        <ExamSettingsSaveButton
          onClick={() => { void handleSave(); }}
          disabled={isSaving}
          isSaving={isSaving}
          saved={saved}
        />
      </div>
    </div>
  );
}

// ── Room Detail View (inline 4-tab settings) ──────────────────────────────────
type SettingsTab = 'takers' | 'questions' | 'score-settings' | 'score-config' | 'score-summary';

const TAB_CONFIG: Record<SettingsTab, { label: string; icon: IconType }> = {
  takers: { label: 'รายชื่อ', icon: HiUsers },
  questions: { label: 'ข้อสอบ', icon: HiDocumentText },
  'score-settings': { label: 'รายวิชา', icon: HiBookOpen },
  'score-config': { label: 'เก็บคะแนน', icon: HiAdjustmentsHorizontal },
  'score-summary': { label: 'สรุปคะแนน', icon: HiPresentationChartLine },
};

function RoomDetailView({
  room, attempts, onBack, onUpdateRoom, onChangeStatus, onEdit, onDelete, onProctor, headerPortalEl,
  canEdit, canDelete, onContentClick, onResetStudent, onResetAll, onRecalculateScores, initialTab,
}: {
  room: ExamRoom;
  attempts: ExamAttempt[];
  onBack: () => void;
  onUpdateRoom: (roomId: string, data: Partial<ExamRoom>) => Promise<void>;
  onChangeStatus: (status: ExamRoom['status'], bypassConfirm?: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
  onProctor: () => void;
  headerPortalEl?: HTMLElement | null;
  canEdit?: boolean;
  canDelete?: boolean;
  onContentClick: (e: React.MouseEvent) => void;
  onResetStudent?: (studentId: string, studentName: string) => void;
  onResetAll?: () => void;
  onRecalculateScores?: (roomId: string, round: number) => Promise<void>;
  initialTab?: SettingsTab;
}) {
  const { user, role, userData } = useAuth();
  const canViewAllSubjects = role === 'admin' || role === 'sysadmin';
  const teachingMgr = useTeachingManager(user?.uid ?? '', canViewAllSubjects);
  const currentUserName = [userData?.prefix, userData?.firstName, userData?.lastName].filter(Boolean).join(' ').trim()
    || userData?.displayName || userData?.name || user?.displayName || 'ไม่ทราบชื่อ';
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab || 'takers');

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  const [summaryView, setSummaryView] = useState<'table' | 'dashboard'>('table');
  const [scoreDetail, setScoreDetail] = useState<{
    student: {
      id: string;
      fullName: string;
      studentCode: string;
      photoURL?: string;
      gender?: 'male' | 'female';
    };
    initialRound?: number;
  } | null>(null);
  const [manualGradingRound, setManualGradingRound] = useState<number | null>(null);
  const [roundEssayMeta, setRoundEssayMeta] = useState<
    Record<number, { hasManualEssay: boolean; pendingCount: number }>
  >({});
  const [mobileSelectedRound, setMobileSelectedRound] = useState<number | null>(null);
  const [mobileTabMenuOpen, setMobileTabMenuOpen] = useState(false);
  const [roomActionsMenuOpen, setRoomActionsMenuOpen] = useState(false);
  const [mobileSaveAction, setMobileSaveAction] = useState<MobileSaveAction | null>(null);
  const registerMobileSave = useCallback((action: MobileSaveAction | null) => {
    setMobileSaveAction((prev) => {
      if (!prev && !action) return prev;
      if (!prev || !action) return action;
      if (
        prev.disabled === action.disabled &&
        prev.isSaving === action.isSaving &&
        prev.saved === action.saved
      ) {
        return prev;
      }
      return action;
    });
  }, []);
  const [questionBankDrawerOpen, setQuestionBankDrawerOpen] = useState(false);
  const [headerMobilePortalEl, setHeaderMobilePortalEl] = useState<HTMLElement | null>(null);
  const [headerRightActionsEl, setHeaderRightActionsEl] = useState<HTMLElement | null>(null);
  const [headerMobileActionsEl, setHeaderMobileActionsEl] = useState<HTMLElement | null>(null);
  const [isLgUp, setIsLgUp] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 1024px)').matches : true,
  );

  useEffect(() => {
    setHeaderMobilePortalEl(document.getElementById('header-portal-center-mobile'));
    setHeaderRightActionsEl(document.getElementById('header-portal-right-actions'));
    setHeaderMobileActionsEl(document.getElementById('header-portal-mobile-actions'));
  }, []);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const onChange = () => {
      setIsLgUp(mq.matches);
      setMobileTabMenuOpen(false);
      setRoomActionsMenuOpen(false);
      setMobileSaveAction(null);
      if (mq.matches) setQuestionBankDrawerOpen(false);
    };
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Re-grade submitted attempts when opening the score summary tab
  useEffect(() => {
    if (activeTab !== 'score-summary' || !onRecalculateScores) return;

    const roundsToRecalc = new Set<number>();
    attempts.forEach((att) => {
      const round = normalizeExamRound(att.round);
      const score = resolveAttemptTotalScore(att);
      const answerCount = att.answers ? Object.keys(att.answers).length : 0;
      if (att.status === 'submitted' && score === null && answerCount > 0) {
        roundsToRecalc.add(round);
        return;
      }
      if (att.status === 'graded' && score === 0 && answerCount > 0) {
        const manualTotal = Object.values(att.manualScores ?? {}).reduce(
          (sum, value) => sum + (typeof value === 'number' && Number.isFinite(value) ? value : 0),
          0,
        );
        if (manualTotal > 0) return;
        roundsToRecalc.add(round);
      }
    });

    if (roundsToRecalc.size === 0) return;
    void Promise.all(
      [...roundsToRecalc].map((round) => onRecalculateScores(room.id, round)),
    );
  }, [activeTab, room.id, attempts, onRecalculateScores]);

  useEffect(() => {
    setMobileTabMenuOpen(false);
    setRoomActionsMenuOpen(false);
    setQuestionBankDrawerOpen(false);
    setMobileSaveAction(null);
  }, [activeTab]);

  const visibleTabs = (Object.entries(TAB_CONFIG) as [SettingsTab, typeof TAB_CONFIG[SettingsTab]][])
    .filter(([key]) => {
      if (key === 'questions' || key === 'score-settings' || key === 'score-config') return canEdit;
      return true;
    });

  const activeTabConfig = TAB_CONFIG[activeTab];

  // Compute student list for this room's class
  const classStudents = useMemo(() => {
    if (!room.classId) return [] as ReturnType<typeof teachingMgr.getStudentsForClass>;
    return teachingMgr.getStudentsForClass(room.classId);
  }, [room.classId, teachingMgr.getStudentsForClass]);

  const isClassRosterLoading = Boolean(room.classId) && !teachingMgr.isRosterDataLoaded;

  const studentIdentityLookup = useMemo(
    () => enrichStudentIdentityLookupFromAttempts(
      buildStudentIdentityLookup(classStudents),
      classStudents,
      attempts,
    ),
    [classStudents, attempts],
  );

  const roundNumbers = useMemo(() => {
    const maxAttempts = room.settings?.maxAttempts ?? 1;
    const configuredRounds = maxAttempts === 0
      ? []
      : Array.from({ length: maxAttempts }, (_, i) => i + 1);
    const attemptRounds = attempts
      .map((a) => Number(a.round))
      .filter((r) => Number.isFinite(r) && r > 0);
    const merged = Array.from(new Set([...configuredRounds, ...attemptRounds])).sort((a, b) => a - b);
    return merged.length > 0 ? merged : [1];
  }, [room.settings?.maxAttempts, attempts]);

  const defaultMobileRound = useMemo(() => {
    const preferred = normalizeExamRound(room.currentRound);
    const hasForPreferred = attempts.some(
      (a) => normalizeExamRound(a.round) === preferred,
    );
    if (hasForPreferred) return preferred;
    const attemptRounds = attempts
      .map((a) => normalizeExamRound(a.round))
      .filter((r) => r > 0);
    if (attemptRounds.length === 0) {
      return roundNumbers.includes(preferred) ? preferred : (roundNumbers[0] ?? 1);
    }
    return Math.max(...attemptRounds);
  }, [room.currentRound, attempts, roundNumbers]);

  const activeMobileRound = mobileSelectedRound ?? defaultMobileRound;

  useEffect(() => {
    setMobileSelectedRound(null);
  }, [room.id]);

  useEffect(() => {
    if (mobileSelectedRound !== null && !roundNumbers.includes(mobileSelectedRound)) {
      setMobileSelectedRound(null);
    }
  }, [roundNumbers, mobileSelectedRound]);

  const takersRound = activeMobileRound;

  const attemptsByStudentRound = useMemo(
    () => indexAttemptsByStudentRound(attempts, studentIdentityLookup),
    [attempts, studentIdentityLookup],
  );

  useEffect(() => {
    if (activeTab !== 'score-summary') return;

    let cancelled = false;
    void Promise.all(
      roundNumbers.map(async (round) => {
        try {
          const { questions } = await fetchRoomRoundExamData(room, round);
          const manualEssays = getManualEssayQuestions(questions);
          return {
            round,
            hasManualEssay: manualEssays.length > 0,
            pendingCount: countPendingManualAttempts(attempts, round, manualEssays),
          };
        } catch {
          return { round, hasManualEssay: false, pendingCount: 0 };
        }
      }),
    ).then((entries) => {
      if (cancelled) return;
      const next: Record<number, { hasManualEssay: boolean; pendingCount: number }> = {};
      entries.forEach(({ round, hasManualEssay, pendingCount }) => {
        next[round] = { hasManualEssay, pendingCount };
      });
      setRoundEssayMeta(next);
    });

    return () => {
      cancelled = true;
    };
  }, [activeTab, room, roundNumbers, attempts]);

  const openManualGrading = useCallback((round: number) => {
    if (!roundEssayMeta[round]?.hasManualEssay) {
      toast.info('รอบนี้ไม่มีข้ออัตนัยที่ต้องตรวจ');
      return;
    }
    setManualGradingRound(round);
  }, [roundEssayMeta]);

  const renderRoundHeader = useCallback((round: number) => {
    const meta = roundEssayMeta[round];
    return (
      <div className="inline-flex items-center justify-center gap-1.5">
        <span>ครั้ง {round}</span>
        {meta?.hasManualEssay && (
          <button
            type="button"
            onClick={() => openManualGrading(round)}
            className="relative inline-flex h-6 w-6 items-center justify-center rounded-lg border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors"
            title={`ตรวจข้ออัตนัย${meta.pendingCount > 0 ? ` (${meta.pendingCount} รอตรวจ)` : ''}`}
          >
            <HiMiniPencil size={12} />
            {meta.pendingCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-rose-500 px-0.5 text-[8px] font-black text-white">
                {meta.pendingCount > 9 ? '9+' : meta.pendingCount}
              </span>
            )}
          </button>
        )}
      </div>
    );
  }, [openManualGrading, roundEssayMeta]);

  const summaryStudents = useMemo(() => {
    if (room.classId && !teachingMgr.isRosterDataLoaded) {
      return [] as {
        id: string;
        fullName: string;
        studentCode: string;
        photoURL?: string;
        gender?: 'male' | 'female';
      }[];
    }

    if (classStudents.length > 0) {
      return classStudents.map(({ student }: { student: unknown }) => {
        const s = (student && typeof student === 'object')
          ? (student as Record<string, unknown>)
          : {};
        const firstName = typeof s.firstName === 'string' ? s.firstName : '';
        const lastName = typeof s.lastName === 'string' ? s.lastName : '';
        const prefix = typeof s.prefix === 'string' ? s.prefix : '';
        const studentName = typeof s.studentName === 'string' ? s.studentName : '';
        const studentCode = typeof s.studentCode === 'string' ? s.studentCode : '-';
        const studentId = typeof s.id === 'string' ? s.id : '';
        const photoURL = typeof s.photoURL === 'string' ? s.photoURL : undefined;
        const gender: 'male' | 'female' | undefined =
          s.gender === 'male' ? 'male' : s.gender === 'female' ? 'female' : undefined;
        const fullName = firstName
          ? `${prefix}${firstName} ${lastName}`.trim()
          : (studentName || 'ไม่ทราบชื่อ');
        return {
          id: studentId || `${studentCode}-${fullName}`,
          fullName,
          studentCode,
          photoURL,
          gender,
        };
      });
    }

    const map = new Map<string, {
      id: string;
      fullName: string;
      studentCode: string;
      photoURL?: string;
      gender?: 'male' | 'female';
    }>();
    attempts.forEach((att) => {
      const studentId = String(att.studentId || '').trim();
      if (!studentId) return;
      if (map.has(studentId)) return;
      map.set(studentId, {
        id: studentId,
        fullName: att.studentName || 'ไม่ทราบชื่อ',
        studentCode: '-',
      });
    });
    return Array.from(map.values());
  }, [classStudents, attempts, room.classId, teachingMgr.isRosterDataLoaded]);

  const getRoundTotalPoints = useCallback((round: number) => {
    const roundKey = String(round);
    const roundPoints =
      room.roundQuestions?.[roundKey]?.totalPoints
      ?? room.roundQuestions?.['∞']?.totalPoints
      ?? room.roundQuestions?.['1']?.totalPoints
      ?? room.totalPoints
      ?? 0;
    return Number(roundPoints) > 0 ? Number(roundPoints) : 0;
  }, [room.roundQuestions, room.totalPoints]);

  const bestPercentByStudent = useMemo(() => {
    const map = new Map<string, number | null>();
    summaryStudents.forEach((student) => {
      const studentRounds = attemptsByStudentRound.get(student.id);
      const bestPercent = roundNumbers
        .map((round) => {
          const score = resolveAttemptTotalScore(studentRounds?.get(round));
          const total = getRoundTotalPoints(round);
          if (score === null || total <= 0) return null;
          return rawPointsToPercent(score, total);
        })
        .filter((v): v is number => typeof v === 'number');
      map.set(student.id, bestPercent.length > 0 ? Math.max(...bestPercent) : null);
    });
    return map;
  }, [summaryStudents, attemptsByStudentRound, roundNumbers, getRoundTotalPoints]);

  const highestBestPercent = useMemo(() => {
    const values = Array.from(bestPercentByStudent.values()).filter((v): v is number => typeof v === 'number');
    return values.length > 0 ? Math.max(...values) : null;
  }, [bestPercentByStudent]);

  const lowestBestPercent = useMemo(() => {
    const values = Array.from(bestPercentByStudent.values()).filter((v): v is number => typeof v === 'number');
    return values.length > 0 ? Math.min(...values) : null;
  }, [bestPercentByStudent]);

  const pagedSummaryRows = useMemo(() => {
    return summaryStudents.map((student) => {
      const studentRounds = attemptsByStudentRound.get(student.id);
      const bestScorePercent = bestPercentByStudent.get(student.id) ?? null;
      const bestScorePercentDisplay = bestScorePercent !== null ? Math.round(bestScorePercent) : null;
      const isTopScorer = highestBestPercent !== null && bestScorePercent === highestBestPercent;
      const isLowestScorer = lowestBestPercent !== null && bestScorePercent === lowestBestPercent;
      const rowHighlightClass = isTopScorer
        ? 'bg-emerald-50/70'
        : isLowestScorer
          ? 'bg-rose-50/60'
          : '';
      const bestScoreClass = isTopScorer
        ? 'bg-emerald-100 text-emerald-700'
        : isLowestScorer
          ? 'bg-rose-100 text-rose-700'
          : 'bg-blue-50 text-blue-700';

      return {
        student,
        bestScorePercent: bestScorePercentDisplay,
        isTopScorer,
        isLowestScorer,
        rowHighlightClass,
        bestScoreClass,
        attemptsByRound: studentRounds ?? new Map<number, ExamAttempt>(),
        hasAnyAttempt: (studentRounds?.size ?? 0) > 0,
        rounds: roundNumbers.map((round) => {
          const att = studentRounds?.get(round);
          const roundScore = resolveAttemptTotalScore(att);
          const roundTotal = getRoundTotalPoints(round);
          const roundScorePercent = roundScore !== null && roundTotal > 0
            ? Math.round(rawPointsToPercent(roundScore, roundTotal))
            : null;
          const isInProgress = !!att && att.status === 'in_progress';
          const isPending = !!att
            && att.status === 'submitted'
            && roundScore === null;
          const needsManualReview = !!att?.pendingManualGrading;
          return {
            round,
            att,
            roundScore,
            roundScorePercent,
            hasScore: roundScorePercent !== null,
            isPending,
            isInProgress,
            needsManualReview,
            roundTotal,
          };
        }),
      };
    });
  }, [
    summaryStudents,
    attemptsByStudentRound,
    bestPercentByStudent,
    highestBestPercent,
    lowestBestPercent,
    roundNumbers,
    getRoundTotalPoints,
  ]);

  // ── Pending score-override requests for this room (live — powers old→new badges everywhere) ──
  const [pendingOverridesByAttemptId, setPendingOverridesByAttemptId] = useState<Map<string, ExamScoreOverrideRequest>>(new Map());

  useEffect(() => {
    if (activeTab !== 'score-summary') return;
    const q = query(
      collection(db, 'exam_score_overrides'),
      where('roomId', '==', room.id),
      where('status', '==', 'pending'),
    );
    const unsub = onSnapshot(q, (snap) => {
      const map = new Map<string, ExamScoreOverrideRequest>();
      snap.docs.forEach((d) => {
        const raw = d.data();
        map.set(raw.attemptId as string, { ...raw, id: d.id } as ExamScoreOverrideRequest);
      });
      setPendingOverridesByAttemptId(map);
    });
    return () => unsub();
  }, [activeTab, room.id]);

  // ── Bulk score-override edit mode (whole-table manual score entry) ─────────
  const [bulkEditMode, setBulkEditMode] = useState(false);
  const [bulkEditValues, setBulkEditValues] = useState<Record<string, string>>({});
  const [bulkReason, setBulkReason] = useState('');
  const [isBulkSubmitting, setIsBulkSubmitting] = useState(false);

  const bulkEditKey = useCallback((studentId: string, round: number) => `${studentId}:${round}`, []);

  const cancelBulkEditMode = useCallback(() => {
    setBulkEditMode(false);
    setBulkEditValues({});
    setBulkReason('');
  }, []);

  const enterBulkEditMode = useCallback(() => {
    setBulkEditValues({});
    setBulkReason('');
    setBulkEditMode(true);
  }, []);

  const submitBulkOverrides = useCallback(async () => {
    if (!user) return;
    const entries = Object.entries(bulkEditValues).filter(([, v]) => v.trim() !== '');
    if (entries.length === 0) {
      toast.error('ยังไม่มีคะแนนที่แก้ไข');
      return;
    }
    if (!bulkReason.trim()) {
      toast.error('กรุณาระบุเหตุผลที่แก้ไขคะแนน');
      return;
    }
    setIsBulkSubmitting(true);
    try {
      const batch = writeBatch(db);
      let count = 0;
      for (const [key, rawValue] of entries) {
        const [studentId, roundStr] = key.split(':');
        const round = Number(roundStr);
        const row = pagedSummaryRows.find((r) => r.student.id === studentId);
        const roundData = row?.rounds.find((r) => r.round === round);
        if (!row || !roundData || !roundData.att || !roundData.hasScore) continue;
        if (pendingOverridesByAttemptId.has(roundData.att.id)) continue;
        const parsed = Number(rawValue);
        if (!Number.isFinite(parsed) || parsed < 0 || (roundData.roundTotal > 0 && parsed > roundData.roundTotal)) continue;
        if (parsed === roundData.roundScore) continue;
        const ref = doc(collection(db, 'exam_score_overrides'));
        batch.set(ref, {
          roomId: room.id,
          roomTitle: room.title,
          attemptId: roundData.att.id,
          studentId,
          studentName: row.student.fullName,
          round,
          requestedScore: parsed,
          maxPoints: roundData.roundTotal,
          previousScore: roundData.roundScore,
          reason: bulkReason.trim(),
          requestedBy: user.uid,
          requestedByName: currentUserName,
          status: 'pending',
          createdAt: serverTimestamp(),
        });
        count += 1;
      }
      if (count === 0) {
        toast.info('ไม่มีคะแนนที่เปลี่ยนแปลง หรือคะแนนอยู่นอกช่วงที่กำหนด');
        return;
      }
      await batch.commit();
      await logActivity({
        action: 'request_score_override_bulk',
        category: 'academic',
        status: 'success',
        targetId: room.id,
        metadata: { roomId: room.id, count },
      });
      toast.success(`ส่งคำขอแก้ไขคะแนน ${count} รายการแล้ว รอ sysadmin/ผู้บริหารอนุมัติ`);
      cancelBulkEditMode();
    } catch {
      toast.error('ส่งคำขอไม่สำเร็จ');
    } finally {
      setIsBulkSubmitting(false);
    }
  }, [bulkEditValues, bulkReason, user, pagedSummaryRows, pendingOverridesByAttemptId, room.id, room.title, currentUserName, cancelBulkEditMode]);

  const [isApprovingAll, setIsApprovingAll] = useState(false);

  const approveAllPending = useCallback(async () => {
    if (!user) return;
    const requests = Array.from(pendingOverridesByAttemptId.values());
    if (requests.length === 0) return;
    if (!window.confirm(`อนุมัติคำขอแก้ไขคะแนนทั้งหมด ${requests.length} รายการ?`)) return;
    setIsApprovingAll(true);
    try {
      const results = await Promise.allSettled(
        requests.map((req) => approveScoreOverride(req, user.uid, currentUserName)),
      );
      const failed = results.filter((r) => r.status === 'rejected').length;
      const succeeded = results.length - failed;
      if (succeeded > 0) toast.success(`อนุมัติคะแนนแล้ว ${succeeded} รายการ`);
      if (failed > 0) toast.error(`อนุมัติไม่สำเร็จ ${failed} รายการ`);
    } finally {
      setIsApprovingAll(false);
    }
  }, [pendingOverridesByAttemptId, user, currentUserName]);

  const openScoreDetail = useCallback((
    student: {
      id: string;
      fullName: string;
      studentCode: string;
      photoURL?: string;
      gender?: 'male' | 'female';
    },
    attemptsByRound: Map<number, ExamAttempt>,
    initialRound?: number,
  ) => {
    if (attemptsByRound.size === 0) {
      toast.info('ยังไม่มีข้อมูลการสอบของนักเรียนคนนี้');
      return;
    }
    setScoreDetail({ student, initialRound });
  }, []);

  const scoreDetailAttemptsByRound = useMemo(() => {
    if (!scoreDetail) return new Map<number, ExamAttempt>();
    return attemptsByStudentRound.get(scoreDetail.student.id) ?? new Map<number, ExamAttempt>();
  }, [scoreDetail, attemptsByStudentRound]);

  const summaryDashboard = useMemo(() => {
    const percentValues = Array.from(bestPercentByStudent.values()).filter((v): v is number => typeof v === 'number');
    const sortedPercent = [...percentValues].sort((a, b) => a - b);
    const totalStudents = summaryStudents.length;
    const scoredStudents = percentValues.length;
    const pendingStudents = Math.max(0, totalStudents - scoredStudents);
    const avgPercent = scoredStudents > 0
      ? percentValues.reduce((sum, v) => sum + v, 0) / scoredStudents
      : 0;
    const medianPercent = scoredStudents === 0
      ? 0
      : (scoredStudents % 2 === 1
        ? sortedPercent[Math.floor(scoredStudents / 2)]
        : (sortedPercent[scoredStudents / 2 - 1] + sortedPercent[scoredStudents / 2]) / 2);
    const maxPercent = scoredStudents > 0 ? Math.max(...percentValues) : 0;
    const minPercent = scoredStudents > 0 ? Math.min(...percentValues) : 0;
    const passCount = percentValues.filter((v) => v >= 50).length;
    const passRate = scoredStudents > 0 ? (passCount / scoredStudents) * 100 : 0;

    const distribution = [
      { name: '0-39%', value: percentValues.filter((v) => v < 40).length, color: '#ef4444' },
      { name: '40-59%', value: percentValues.filter((v) => v >= 40 && v < 60).length, color: '#f59e0b' },
      { name: '60-79%', value: percentValues.filter((v) => v >= 60 && v < 80).length, color: '#3b82f6' },
      { name: '80-100%', value: percentValues.filter((v) => v >= 80).length, color: '#10b981' },
    ];

    const roundStats = roundNumbers.map((round) => {
      const total = getRoundTotalPoints(round);
      const scores = summaryStudents
        .map((student) => resolveAttemptTotalScore(attemptsByStudentRound.get(student.id)?.get(round)))
        .filter((score): score is number => score !== null);
      const avgRaw = scores.length > 0 ? scores.reduce((sum, v) => sum + v, 0) / scores.length : 0;
      const avgRoundPercent = total > 0 ? (avgRaw / total) * 100 : 0;
      return {
        round: `ครั้ง ${round}`,
        avgPercent: Number(avgRoundPercent.toFixed(1)),
        scored: scores.length,
      };
    });

    return {
      totalStudents,
      scoredStudents,
      pendingStudents,
      avgPercent,
      medianPercent,
      maxPercent,
      minPercent,
      passCount,
      passRate,
      distribution,
      roundStats,
    };
  }, [summaryStudents, bestPercentByStudent, roundNumbers, attemptsByStudentRound, getRoundTotalPoints]);

  const handleSaveQuestions = async (
    roundKey: string,
    questionSetId: string,
    questionIds: string[],
    questionSetByQuestionId: Record<string, string>,
    questionPoints: Record<string, number>,
    totalPoints: number,
  ) => {
    const roundNum = normalizeExamRound(roundKey);
    const hasExistingAttempts = attempts.some((att) => normalizeExamRound(att.round) === roundNum);
    if (hasExistingAttempts) {
      toast.error('ไม่สามารถแก้ไขข้อสอบรอบนี้ได้ เนื่องจากมีนักเรียนทำข้อสอบไปแล้ว');
      return;
    }

    const savedEntry = {
      questionSetId,
      questionIds,
      questionSetByQuestionId,
      questionPoints,
      totalPoints,
    };
    const previousEntry = room.roundQuestions?.[roundKey];
    const roundQuestions = propagateRoundConfigToEmptyRounds(
      room.roundQuestions ?? {},
      roundKey,
      savedEntry,
      room.settings?.maxAttempts ?? 1,
      { previousEntryForSavedRound: previousEntry },
    );
    // Also mirror into top-level legacy fields for round "1" / "∞"
    const isFirstRound = roundKey === '1' || roundKey === '∞';
    await onUpdateRoom(room.id, {
      ...(isFirstRound ? { questionSetId, selectedQuestionIds: questionIds, questionCount: questionIds.length, totalPoints } : {}),
      roundQuestions,
    });
  };

  const handleSaveScoreSettings = useCallback(async (
    subjects: GradeBookSubjectLink[],
    scoreType: GradeScoreType,
  ) => {
    const primary = subjects[0];
    await onUpdateRoom(room.id, {
      settings: {
        ...room.settings,
        gradeBookSubjects: subjects,
        gradeBookSubjectId: primary?.subjectId ?? '',
        gradeBookSubjectName: primary?.subjectName ?? '',
        gradeBookSubjectCode: primary?.subjectCode ?? '',
        gradeBookScoreType: scoreType,
      },
    });
  }, [onUpdateRoom, room.id, room.settings]);

  const handleSaveScoreConfig = useCallback(async (data: Partial<ExamRoom['settings']>) => {
    await onUpdateRoom(room.id, {
      settings: { ...room.settings, ...data },
    });
  }, [onUpdateRoom, room.id, room.settings]);

  const ActiveTabIcon = activeTabConfig.icon;
  const closeRoomActionsMenu = () => setRoomActionsMenuOpen(false);

  const roomActionsMenu = canEdit ? (
    <div className="pointer-events-auto relative flex items-center gap-2 shrink-0">
      {!isLgUp && activeTab === 'questions' && (
        <button
          type="button"
          onClick={() => setQuestionBankDrawerOpen(true)}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
          title="คลังข้อสอบ"
          aria-label="คลังข้อสอบ"
        >
          <HiBookOpen className="h-5 w-5" />
        </button>
      )}
      {!isLgUp && mobileSaveAction && (
        <ExamSettingsSaveButton
          variant="compact"
          onClick={mobileSaveAction.onSave}
          disabled={mobileSaveAction.disabled}
          isSaving={mobileSaveAction.isSaving}
          saved={mobileSaveAction.saved}
        />
      )}
      <div className="relative flex items-center shrink-0">
      <button
        type="button"
        onClick={() => setRoomActionsMenuOpen((open) => !open)}
        className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
        title="เมนูจัดการห้องสอบ"
        aria-label="เมนูจัดการห้องสอบ"
        aria-expanded={roomActionsMenuOpen}
      >
        <HiBars3 className="h-5 w-5" />
      </button>

      {roomActionsMenuOpen && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[90] bg-black/20"
            aria-label="ปิดเมนูจัดการห้องสอบ"
            onClick={closeRoomActionsMenu}
          />
          <div
            className={`z-[100] w-[min(260px,calc(100vw-2rem))] rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl ${
              isLgUp ? 'absolute right-0 top-full mt-2' : 'fixed right-4 top-14'
            }`}
          >
            <button
              type="button"
              onClick={() => {
                closeRoomActionsMenu();
                onProctor();
              }}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[13px] font-bold font-sukhumvit text-slate-700 transition-colors hover:bg-slate-50"
            >
              <Eye size={16} className="shrink-0 text-slate-500" />
              <span>Proctor</span>
            </button>

            {room.status === 'upcoming' && (
              <button
                type="button"
                onClick={() => {
                  closeRoomActionsMenu();
                  onChangeStatus('active');
                }}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[13px] font-bold font-sukhumvit text-emerald-700 transition-colors hover:bg-emerald-50"
              >
                <Play size={16} fill="currentColor" className="shrink-0" />
                <span>เริ่มรอบ {(room.completedRounds ?? 0) + 1}</span>
              </button>
            )}

            {room.status === 'active' && (
              <button
                type="button"
                onClick={() => {
                  closeRoomActionsMenu();
                  onChangeStatus('closed');
                }}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[13px] font-bold font-sukhumvit text-rose-700 transition-colors hover:bg-rose-50"
              >
                <Square size={16} fill="currentColor" className="shrink-0" />
                <span>ปิด รอบ {room.currentRound ?? 1}</span>
              </button>
            )}

            {onResetAll && attempts.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  closeRoomActionsMenu();
                  onResetAll();
                }}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[13px] font-bold font-sukhumvit text-amber-700 transition-colors hover:bg-amber-50"
              >
                <RotateCcw size={16} className="shrink-0" />
                <span>รีเซ็ตทั้งหมด</span>
              </button>
            )}

            <div className="my-1 h-px bg-slate-100" />

            <button
              type="button"
              onClick={() => {
                closeRoomActionsMenu();
                onEdit();
              }}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[13px] font-bold font-sukhumvit text-slate-700 transition-colors hover:bg-slate-50"
            >
              <Pencil size={16} className="shrink-0 text-slate-500" />
              <span>แก้ไขห้องสอบ</span>
            </button>

            {canDelete && (
              <button
                type="button"
                onClick={() => {
                  closeRoomActionsMenu();
                  onDelete();
                }}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[13px] font-bold font-sukhumvit text-rose-600 transition-colors hover:bg-rose-50"
              >
                <Trash2 size={16} className="shrink-0" />
                <span>ลบห้องสอบ</span>
              </button>
            )}
          </div>
        </>
      )}
      </div>
    </div>
  ) : null;

  const roomActionsMenuPortal =
    roomActionsMenu && isLgUp && headerRightActionsEl
      ? createPortal(roomActionsMenu, headerRightActionsEl)
      : roomActionsMenu && !isLgUp && headerMobileActionsEl
        ? createPortal(roomActionsMenu, headerMobileActionsEl)
        : null;

  return (
    <motion.div
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 24 }}
      className="flex flex-col flex-1 min-h-0 h-full gap-3 lg:gap-4"
    >


      {/* ── 4 Tabs + Content panel ── */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden" onClick={onContentClick}>
        {/* Tab bar - desktop header portal + mobile menu button */}
        {isLgUp && headerPortalEl ? createPortal(
          <div className="pointer-events-auto flex items-center gap-2 h-10 border border-black/[0.07] p-1 rounded-full bg-white/60 backdrop-blur-md">
            <button
              type="button"
              onClick={onBack}
              className="h-8 pl-2 pr-3 rounded-full text-black/45 hover:bg-black/5 flex items-center gap-1 transition-all cursor-pointer"
              title="กลับหน้าหลัก"
            >
              <HiArrowLeft className="w-3 h-3 shrink-0" />
              <span className="text-[10px] font-black uppercase">กลับ</span>
            </button>

            {room.status === 'active' && (
              <div className="flex items-center gap-2 pl-1 pr-0.5 border-l border-black/5">
                <ExamRoomLiveIndicator />
                <CountdownTimer
                  startTime={room.startTime}
                  durationMinutes={room.durationMinutes}
                  onExpire={() => onChangeStatus('closed', true)}
                />
              </div>
            )}

            <div className="w-[1px] h-4 bg-black/[0.07] mx-1" />

            {visibleTabs.map(([key, cfg]) => {
              const isActive = activeTab === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveTab(key)}
                  className={`h-8 px-4 rounded-full text-[11px] font-bold transition-all whitespace-nowrap flex items-center cursor-pointer ${
                    isActive
                      ? 'bg-blue-600 text-white border border-blue-700'
                      : 'text-black/45 hover:bg-black/5'
                  }`}
                >
                  <span>{cfg.label}</span>
                </button>
              );
            })}
          </div>,
          headerPortalEl
        ) : null}

        {!isLgUp && headerMobilePortalEl ? createPortal(
          <div className="lg:hidden pointer-events-auto relative flex items-center justify-center min-w-0 max-w-[calc(100vw-112px)]">
            <button
              type="button"
              onClick={() => setMobileTabMenuOpen((open) => !open)}
              className="flex min-w-0 items-center gap-1.5 text-slate-800 transition-colors hover:text-slate-600"
              aria-label="เปิดเมนูแท็บ"
              aria-expanded={mobileTabMenuOpen}
            >
              {room.status === 'active' && <ExamRoomLiveIndicator />}
              <ActiveTabIcon className="h-3.5 w-3.5 shrink-0 text-slate-600" />
              <span className="truncate text-[12px] font-black font-sukhumvit">
                {activeTabConfig.label}
              </span>
              <HiChevronDown
                className={`h-3.5 w-3.5 shrink-0 text-slate-500 transition-transform ${mobileTabMenuOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {mobileTabMenuOpen && (
              <>
                <button
                  type="button"
                  className="fixed inset-0 z-[90] bg-black/20"
                  aria-label="ปิดเมนูแท็บ"
                  onClick={() => setMobileTabMenuOpen(false)}
                />
                <div className="fixed left-1/2 top-14 z-[100] w-[min(280px,calc(100vw-2rem))] -translate-x-1/2 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl">
                  {visibleTabs.map(([key, cfg]) => {
                    const Icon = cfg.icon;
                    const isActive = activeTab === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setActiveTab(key)}
                        className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[13px] font-bold font-sukhumvit transition-colors ${
                          isActive
                            ? 'bg-blue-600 text-white'
                            : 'text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                        <span>{cfg.label}</span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>,
          headerMobilePortalEl
        ) : null}

        {roomActionsMenuPortal}

        {/* Tab content */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div
            className={`flex-1 min-h-0 flex flex-col ${
              activeTab === 'questions' ? 'overflow-hidden' : 'overflow-y-auto scrollbar-hide'
            }`}
          >
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              className={`flex flex-col flex-1 min-h-0 ${activeTab === 'questions' ? 'overflow-hidden' : ''}`}
            >
              {activeTab === 'takers' && (
                (() => {
                  if (isClassRosterLoading) {
                    return <TakersListSkeleton />;
                  }

                  // Fallback: If no classId or no students found, just show attempts
                  if (attempts.length === 0 && classStudents.length === 0) {
                    return (
                    <div className="py-16 text-center text-slate-400">
                      <Users size={32} className="mx-auto mb-3 text-slate-300" />
                      <p className="text-[14px] font-sarabun">ยังไม่มีนักเรียนในห้องสอบ</p>
                    </div>
                    );
                  }

                  const rows = classStudents.length > 0
                    ? classStudents.map(({ student }: { student: unknown }) => {
                        const s = (student && typeof student === 'object')
                          ? (student as Record<string, unknown>)
                          : {};
                        const studentId = typeof s.id === 'string' ? s.id : '';
                        const studentCode = typeof s.studentCode === 'string' ? s.studentCode : '-';
                        const prefix = typeof s.prefix === 'string' ? s.prefix : '';
                        const firstName = typeof s.firstName === 'string' ? s.firstName : '';
                        const lastName = typeof s.lastName === 'string' ? s.lastName : '';
                        const studentName = typeof s.studentName === 'string' ? s.studentName : '';
                        const fullName = `${prefix}${firstName} ${lastName}`.trim() || studentName || 'ไม่ทราบชื่อ';
                        const photoURL = typeof s.photoURL === 'string' ? s.photoURL : undefined;
                        const gender: 'male' | 'female' | undefined =
                          s.gender === 'male' ? 'male' : s.gender === 'female' ? 'female' : undefined;
                        const identity = {
                          id: studentId,
                          authUid: typeof s.authUid === 'string' ? s.authUid : undefined,
                          userId: typeof s.userId === 'string' ? s.userId : undefined,
                          studentCode: typeof s.studentCode === 'string' ? s.studentCode : undefined,
                          email: typeof s.email === 'string' ? s.email : undefined,
                        };
                        const attempt = findTakerAttemptForStudent(
                          attempts,
                          identity,
                          attemptsByStudentRound,
                          takersRound,
                        );
                        return {
                          key: studentId || `${studentCode}-${fullName}`,
                          studentId,
                          fullName,
                          studentCode,
                          photoURL,
                          gender,
                          attempt,
                        };
                      })
                    : attempts.length > 0
                      ? attempts.map((att) => ({
                          key: att.id,
                          studentId: att.studentId,
                          fullName: att.studentName || 'ไม่ทราบชื่อ',
                          studentCode: '-',
                          photoURL: undefined,
                          gender: undefined,
                          attempt: att,
                        }))
                      : [];

                  const displayRows = rows.map((row) => {
                    const att = row.attempt;
                    const score = resolveAttemptTotalScore(att);
                    const attemptRound = att ? normalizeExamRound(att.round) : takersRound;
                    const roundTotal = getRoundTotalPoints(attemptRound);
                    const scorePercent = score !== null && roundTotal > 0
                      ? Math.round(rawPointsToPercent(score, roundTotal))
                      : null;
                    const hasScore = scorePercent !== null;
                    const submittedAt = att?.submittedAt
                      ? new Date(att.submittedAt).toLocaleString('th-TH')
                      : '-';
                    const statusLabel = !att
                      ? 'ยังไม่เข้าสอบ'
                      : att.status === 'submitted' || att.status === 'graded'
                        ? 'ส่งแล้ว'
                        : 'เข้าสอบ';
                    const statusClass = !att
                      ? 'bg-slate-100 text-slate-500'
                      : att.status === 'submitted' || att.status === 'graded'
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-amber-50 text-amber-700';
                    return {
                      ...row,
                      att,
                      score,
                      scorePercent,
                      hasScore,
                      submittedAt,
                      statusLabel,
                      statusClass,
                    };
                  });

                  return (
                    <div className="flex flex-col w-full gap-3 md:flex-1 md:min-h-0">
                      <MobileRoundSelect
                        rounds={roundNumbers}
                        value={activeMobileRound}
                        onChange={setMobileSelectedRound}
                        className="md:hidden px-1.5"
                      />
                      {/* Mobile: card list */}
                      <div className={cn('md:hidden flex flex-col gap-2.5', PORTAL_CARD_LIST_PADDING)}>
                        {displayRows.map((row, index) => (
                          <motion.div
                            key={row.key}
                            className={MOBILE_STUDENT_CARD_OUTER}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.02 }}
                            whileTap={{ scale: 0.99 }}
                          >
                            <div className={MOBILE_STUDENT_CARD_SHELL}>
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex min-w-0 flex-1 items-start gap-2.5">
                                <StudentAvatar
                                  photoURL={row.photoURL}
                                  studentId={row.studentId || row.key}
                                  name={row.fullName}
                                  gender={row.gender}
                                  className="h-10 w-10 shrink-0 rounded-xl"
                                />
                                <div className="min-w-0 flex-1">
                                  <p
                                    className="text-[13px] font-bold text-slate-800 font-sukhumvit truncate"
                                    title={row.fullName}
                                  >
                                    {row.fullName}
                                  </p>
                                  <p className="text-[11px] text-blue-600 font-sarabun tabular-nums mt-0.5">
                                    รหัส {row.studentCode}
                                  </p>
                                </div>
                              </div>
                              <span
                                className={`inline-flex shrink-0 items-center justify-center px-2 py-1 rounded-lg text-[10px] font-bold font-sarabun whitespace-nowrap ${row.statusClass}`}
                              >
                                {row.statusLabel}
                              </span>
                            </div>
                            <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2">
                              <div className="flex items-center gap-3">
                                <div>
                                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-wide font-sukhumvit mb-0.5">
                                    คะแนน รอบ {activeMobileRound} (%)
                                  </p>
                                  {row.hasScore ? (
                                    <span className="inline-flex items-center justify-center min-w-8 px-2 py-0.5 rounded-lg bg-blue-50 text-blue-700 text-[13px] font-black font-sukhumvit tabular-nums">
                                      {row.scorePercent}%
                                    </span>
                                  ) : (
                                    <span className="text-[12px] text-slate-300 font-bold">-</span>
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-wide font-sukhumvit mb-0.5">
                                    ส่งล่าสุด
                                  </p>
                                  <p className="text-[10px] text-slate-500 font-sarabun tabular-nums truncate">
                                    {row.submittedAt}
                                  </p>
                                </div>
                              </div>
                              {canEdit && onResetStudent && row.att && (
                                <motion.button
                                  type="button"
                                  whileTap={{ scale: 0.92 }}
                                  onClick={() => onResetStudent(row.att!.studentId, row.fullName)}
                                  className="w-9 h-9 shrink-0 rounded-lg flex items-center justify-center text-amber-500 hover:bg-amber-50 border border-amber-200 transition-colors"
                                  title={`รีเซ็ตการสอบของ ${row.fullName}`}
                                >
                                  <RotateCcw size={14} />
                                </motion.button>
                              )}
                            </div>
                            </div>
                          </motion.div>
                        ))}
                      </div>

                      {/* Desktop: table */}
                      <div className="hidden md:flex flex-1 min-h-0 overflow-y-auto rounded-2xl border border-slate-200 bg-white/80 w-full">
                        <div className="overflow-x-auto w-full">
                          <table className="w-full table-fixed text-left">
                            <colgroup>
                              <col />
                              <col className="w-[6.5rem]" />
                              <col className="w-[7.5rem]" />
                              <col className="w-[4.5rem]" />
                              <col className="w-[10rem]" />
                            </colgroup>
                            <thead>
                              <tr className="bg-slate-50/90 border-b border-slate-200">
                                <th className="px-4 py-3 text-[11px] font-black text-slate-500 uppercase tracking-wider font-sukhumvit">
                                  นักเรียน
                                </th>
                                <th className="px-3 py-3 text-[11px] font-black text-slate-500 uppercase tracking-wider font-sukhumvit whitespace-nowrap text-center">
                                  รหัส
                                </th>
                                <th className="px-3 py-3 text-[11px] font-black text-slate-500 uppercase tracking-wider font-sukhumvit whitespace-nowrap text-center">
                                  สถานะ
                                </th>
                                <th className="px-3 py-3 text-[11px] font-black text-slate-500 uppercase tracking-wider font-sukhumvit whitespace-nowrap text-center">
                                  คะแนน (%)
                                </th>
                                <th className="px-3 py-3 text-[11px] font-black text-slate-500 uppercase tracking-wider font-sukhumvit whitespace-nowrap text-center">
                                  ส่งล่าสุด
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {displayRows.map((row) => (
                                <tr key={row.key} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/50">
                                  <td className="px-4 py-3 min-w-0">
                                    <p className="text-[13px] font-bold text-slate-800 font-sukhumvit truncate" title={row.fullName}>
                                      {row.fullName}
                                    </p>
                                  </td>
                                  <td className="px-3 py-3 text-center">
                                    <span className="text-[12px] text-blue-600 font-sarabun tabular-nums">{row.studentCode}</span>
                                  </td>
                                  <td className="px-3 py-3 text-center">
                                    <span className={`inline-flex items-center justify-center px-2 py-1 rounded-lg text-[11px] font-bold font-sarabun whitespace-nowrap ${row.statusClass}`}>
                                      {row.statusLabel}
                                    </span>
                                  </td>
                                  <td className="px-3 py-3 text-center">
                                    {row.hasScore ? (
                                      <span className="inline-flex items-center justify-center min-w-8 px-2 py-1 rounded-lg bg-blue-50 text-blue-700 text-[12px] font-black font-sukhumvit tabular-nums">
                                        {row.scorePercent}%
                                      </span>
                                    ) : (
                                      <span className="text-[12px] text-slate-300 font-bold">-</span>
                                    )}
                                  </td>
                                  <td className="px-3 py-3">
                                    <div className="flex items-center justify-center gap-1 min-w-0">
                                      <span className="text-[11px] text-slate-400 font-sarabun truncate tabular-nums">
                                        {row.submittedAt}
                                      </span>
                                      {canEdit && onResetStudent && row.att && (
                                        <button
                                          onClick={() => onResetStudent(
                                            row.att!.studentId,
                                            row.fullName,
                                          )}
                                          className="w-7 h-7 shrink-0 rounded-lg flex items-center justify-center text-amber-500 hover:bg-amber-50 border border-amber-200 transition-all"
                                          title={`รีเซ็ตการสอบของ ${row.fullName}`}
                                        >
                                          <RotateCcw size={12} />
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                    </div>
                  );
                })()
              )}
              {activeTab === 'questions' && (
                <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
                  <QuestionsPanel
                    room={room}
                    attempts={attempts}
                    onSave={handleSaveQuestions}
                    onContentClick={onContentClick}
                    mobileBankDrawerOpen={questionBankDrawerOpen}
                    onMobileBankDrawerOpenChange={setQuestionBankDrawerOpen}
                  />
                </div>
              )}
              {activeTab === 'score-settings' && (
                <ScoreSettingsPanel
                  room={room}
                  onSave={handleSaveScoreSettings}
                  onRegisterMobileSave={!isLgUp ? registerMobileSave : undefined}
                />
              )}
              {activeTab === 'score-config' && (
                <ScoreConfigPanel
                  room={room}
                  onSave={handleSaveScoreConfig}
                  onRegisterMobileSave={!isLgUp ? registerMobileSave : undefined}
                />
              )}
              {activeTab === 'score-summary' && (
                isClassRosterLoading ? (
                  <ScoreSummarySkeleton />
                ) : summaryStudents.length === 0 ? (
                  <div className="py-16 text-center text-slate-400">
                    <CheckCircle2 size={32} className="mx-auto mb-3 text-slate-300" />
                    <p className="text-[14px] font-sarabun">ยังไม่มีข้อมูลสรุปคะแนน</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-col items-center justify-center gap-2 text-center md:flex-row md:items-center md:justify-between md:text-left">
                      <p className="text-[12px] font-bold text-slate-500 font-sarabun">
                        {summaryView === 'table'
                          ? 'แสดงคะแนนสอบรายครั้งของนักเรียนทั้งหมด'
                          : 'แดชบอร์ดสรุปสถิติภาพรวมของห้องสอบ'}
                      </p>
                      <div className="flex items-center gap-4">
                        <p className="text-[11px] font-black text-slate-400 font-sukhumvit uppercase tracking-widest">
                          {summaryStudents.length} คน
                          <span className="hidden md:inline"> • {roundNumbers.length} รอบ</span>
                        </p>
                        <div className="hidden md:block h-4 w-px bg-slate-300" />
                        <button
                          onClick={() => setSummaryView((prev) => (prev === 'table' ? 'dashboard' : 'table'))}
                          className="h-8 px-3 rounded-xl border border-slate-200 bg-white text-[11px] font-black font-sukhumvit text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-all flex items-center gap-1.5"
                          title={summaryView === 'table' ? 'สลับเป็น Dashboard' : 'สลับเป็นตาราง'}
                        >
                          <BarChart2 size={13} />
                          {summaryView === 'table' ? 'Dashboard' : 'Table'}
                        </button>
                      </div>
                    </div>

                    <MobileRoundSelect
                      rounds={roundNumbers}
                      value={activeMobileRound}
                      onChange={setMobileSelectedRound}
                      className="md:hidden px-1.5"
                    />

                    {summaryView === 'table' ? (
                      <>
                        {/* Mobile: card list */}
                        <div className={cn('md:hidden flex flex-col gap-2.5', PORTAL_CARD_LIST_PADDING)}>
                          {pagedSummaryRows.map((row, index) => (
                            <motion.div
                              key={row.student.id}
                              className={MOBILE_STUDENT_CARD_OUTER}
                              initial={{ opacity: 0, y: 8 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: index * 0.02 }}
                              whileTap={{ scale: 0.99 }}
                            >
                              <div className={cn(MOBILE_STUDENT_CARD_SHELL, row.rowHighlightClass)}>
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex min-w-0 flex-1 items-start gap-2.5">
                                  <StudentAvatar
                                    photoURL={row.student.photoURL}
                                    studentId={row.student.id}
                                    name={row.student.fullName}
                                    gender={row.student.gender}
                                    className="h-10 w-10 shrink-0 rounded-xl"
                                  />
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2 min-w-0">
                                      {row.hasAnyAttempt ? (
                                        <button
                                          type="button"
                                          onClick={() => openScoreDetail(row.student, row.attemptsByRound)}
                                          className="text-[13px] font-bold text-slate-800 font-sukhumvit truncate text-left hover:text-blue-700 hover:underline underline-offset-2"
                                          title={row.student.fullName}
                                        >
                                          {row.student.fullName}
                                        </button>
                                      ) : (
                                        <p
                                          className="text-[13px] font-bold text-slate-800 font-sukhumvit truncate"
                                          title={row.student.fullName}
                                        >
                                          {row.student.fullName}
                                        </p>
                                      )}
                                      {row.isTopScorer && (
                                        <span className="inline-flex shrink-0 items-center px-2 py-0.5 rounded-md text-[10px] font-black font-sukhumvit bg-emerald-100 text-emerald-700">
                                          สูงสุด
                                        </span>
                                      )}
                                      {!row.isTopScorer && row.isLowestScorer && (
                                        <span className="inline-flex shrink-0 items-center px-2 py-0.5 rounded-md text-[10px] font-black font-sukhumvit bg-rose-100 text-rose-700">
                                          ต่ำสุด
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-[11px] text-blue-600 font-sarabun tabular-nums mt-0.5">
                                      รหัส {row.student.studentCode}
                                    </p>
                                  </div>
                                </div>
                                <div className="shrink-0 text-center">
                                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-wide font-sukhumvit mb-0.5">
                                    สูงสุด (%)
                                  </p>
                                  {row.bestScorePercent !== null ? (
                                    <span
                                      className={cn(
                                        'inline-flex items-center justify-center min-w-8 px-2 py-0.5 rounded-lg text-[13px] font-black font-sukhumvit tabular-nums',
                                        row.bestScoreClass,
                                      )}
                                    >
                                      {row.bestScorePercent}%
                                    </span>
                                  ) : (
                                    <span className="text-[12px] text-slate-300 font-bold">-</span>
                                  )}
                                </div>
                              </div>
                              {(() => {
                                const roundData = row.rounds.find((item) => item.round === activeMobileRound);
                                if (!roundData) return null;
                                const {
                                  round,
                                  roundScore,
                                  roundScorePercent,
                                  hasScore,
                                  isPending,
                                  isInProgress,
                                  needsManualReview,
                                  roundTotal,
                                } = roundData;
                                return (
                              <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1">
                                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-wide font-sukhumvit">
                                    ครั้ง {round}
                                  </p>
                                  {roundEssayMeta[round]?.hasManualEssay && (
                                    <button
                                      type="button"
                                      onClick={() => openManualGrading(round)}
                                      className="inline-flex h-5 w-5 items-center justify-center rounded-md border border-amber-200 bg-amber-50 text-amber-700"
                                      title="ตรวจข้ออัตนัย"
                                    >
                                      <HiMiniPencil size={10} />
                                    </button>
                                  )}
                                </div>
                                {hasScore ? (
                                  <button
                                    type="button"
                                    onClick={() => openScoreDetail(row.student, row.attemptsByRound, round)}
                                    className={cn(
                                      'inline-flex items-center justify-center gap-1 min-w-8 px-2 py-0.5 rounded-lg text-[12px] font-black font-sukhumvit tabular-nums hover:opacity-90',
                                      needsManualReview
                                        ? 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                                        : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
                                    )}
                                    title={`${roundScore}/${roundTotal || '-'} คะแนน (${roundScorePercent}%)${needsManualReview ? ' — รอตรวจข้ออัตนัย' : ''} — ดูรายละเอียด`}
                                  >
                                    {roundScorePercent}%
                                    {needsManualReview && <HiMiniPencil size={10} className="shrink-0" />}
                                  </button>
                                ) : isInProgress ? (
                                  <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-lg bg-blue-50 text-blue-600 text-[10px] font-bold font-sarabun">
                                    กำลังสอบ
                                  </span>
                                ) : isPending ? (
                                  <button
                                    type="button"
                                    onClick={() => openScoreDetail(row.student, row.attemptsByRound, round)}
                                    className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-lg bg-amber-50 text-amber-600 text-[10px] font-bold font-sarabun hover:bg-amber-100"
                                    title="ดูรายละเอียดคำตอบ"
                                  >
                                    รอตรวจ
                                  </button>
                                ) : (
                                  <span className="text-[12px] text-slate-300 font-bold">-</span>
                                )}
                              </div>
                                );
                              })()}
                              </div>
                            </motion.div>
                          ))}
                        </div>

                        {/* Desktop: table */}
                        <div className="hidden md:block rounded-2xl border border-slate-200 bg-white/80 overflow-hidden">
                          {role === 'teacher' && bulkEditMode && (
                            <div className="flex flex-col gap-2 border-b border-indigo-100 bg-indigo-50/60 px-4 py-3 sm:flex-row sm:items-center">
                              <input
                                value={bulkReason}
                                onChange={(e) => setBulkReason(e.target.value)}
                                placeholder="เหตุผลที่แก้ไขคะแนน (ใช้กับทุกคะแนนที่แก้ในครั้งนี้)"
                                className="h-9 flex-1 rounded-lg border border-indigo-200 bg-white px-3 text-[12px] text-slate-700 font-sarabun outline-none focus:ring-2 focus:ring-indigo-500/30"
                              />
                              <div className="flex gap-2 shrink-0">
                                <button
                                  type="button"
                                  disabled={isBulkSubmitting}
                                  onClick={() => void submitBulkOverrides()}
                                  className="h-9 rounded-xl bg-indigo-600 px-4 text-[12px] font-black text-white font-sukhumvit hover:bg-indigo-700 disabled:opacity-60"
                                >
                                  {isBulkSubmitting ? 'กำลังส่ง...' : 'ส่งคำขอทั้งหมด'}
                                </button>
                                <button
                                  type="button"
                                  onClick={cancelBulkEditMode}
                                  className="h-9 rounded-xl border border-slate-200 bg-white px-4 text-[12px] font-bold text-slate-500 font-sukhumvit hover:bg-slate-50"
                                >
                                  ยกเลิก
                                </button>
                              </div>
                            </div>
                          )}
                          <div className="overflow-x-auto">
                            <table className="min-w-full text-left">
                              <thead>
                                <tr className="bg-slate-50/90 border-b border-slate-200">
                                  <th className="px-4 py-3 text-[11px] font-black text-slate-500 uppercase tracking-wider font-sukhumvit">
                                    <div className="flex items-center gap-1.5">
                                      นักเรียน
                                      {role === 'teacher' && (
                                        <button
                                          type="button"
                                          onClick={() => (bulkEditMode ? cancelBulkEditMode() : enterBulkEditMode())}
                                          className={cn(
                                            'flex h-6 w-6 items-center justify-center rounded-md transition-colors',
                                            bulkEditMode
                                              ? 'bg-indigo-600 text-white'
                                              : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600',
                                          )}
                                          title={bulkEditMode ? 'ออกจากโหมดแก้ไขคะแนน' : 'กรอกคะแนนเองทั้งตาราง'}
                                        >
                                          <HiMiniPencil size={12} />
                                        </button>
                                      )}
                                      {(role === 'admin' || role === 'sysadmin') && pendingOverridesByAttemptId.size > 0 && (
                                        <button
                                          type="button"
                                          disabled={isApprovingAll}
                                          onClick={() => void approveAllPending()}
                                          className="flex h-6 items-center gap-1 rounded-md bg-emerald-600 px-2 text-white normal-case tracking-normal transition-colors hover:bg-emerald-700 disabled:opacity-60"
                                          title="อนุมัติคำขอแก้ไขคะแนนทั้งหมดในห้องนี้"
                                        >
                                          <HiCheckCircle size={12} />
                                          <span className="text-[10px] font-black">
                                            {isApprovingAll ? 'กำลังอนุมัติ...' : `อนุมัติทั้งหมด (${pendingOverridesByAttemptId.size})`}
                                          </span>
                                        </button>
                                      )}
                                    </div>
                                  </th>
                                  {roundNumbers.map((round) => (
                                    <th
                                      key={round}
                                      className="px-4 py-3 text-[11px] font-black text-slate-500 uppercase tracking-wider font-sukhumvit text-center whitespace-nowrap"
                                    >
                                      {renderRoundHeader(round)}
                                    </th>
                                  ))}
                                  <th className="px-4 py-3 text-[11px] font-black text-slate-500 uppercase tracking-wider font-sukhumvit text-center whitespace-nowrap">
                                    สูงสุด (%)
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {pagedSummaryRows.map((row) => (
                                  <tr
                                    key={row.student.id}
                                    className={cn(
                                      'border-b border-slate-100 last:border-b-0 hover:bg-slate-50/50',
                                      row.rowHighlightClass,
                                    )}
                                  >
                                    <td className="px-4 py-3">
                                      <div className="flex items-center gap-2">
                                        {row.hasAnyAttempt ? (
                                          <button
                                            type="button"
                                            onClick={() => openScoreDetail(row.student, row.attemptsByRound)}
                                            className="text-[13px] font-bold text-slate-800 font-sukhumvit text-left hover:text-blue-700 hover:underline underline-offset-2"
                                          >
                                            {row.student.fullName}
                                          </button>
                                        ) : (
                                          <p className="text-[13px] font-bold text-slate-800 font-sukhumvit">
                                            {row.student.fullName}
                                          </p>
                                        )}
                                        {row.isTopScorer && (
                                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black font-sukhumvit bg-emerald-100 text-emerald-700">
                                            สูงสุด
                                          </span>
                                        )}
                                        {!row.isTopScorer && row.isLowestScorer && (
                                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black font-sukhumvit bg-rose-100 text-rose-700">
                                            ต่ำสุด
                                          </span>
                                        )}
                                      </div>
                                      <p className="text-[11px] text-blue-600 font-sarabun">
                                        รหัส {row.student.studentCode}
                                      </p>
                                    </td>

                                    {row.rounds.map(({ round, att, roundScore, roundScorePercent, hasScore, isPending, isInProgress, needsManualReview, roundTotal }) => {
                                      const pendingReq = att ? pendingOverridesByAttemptId.get(att.id) : undefined;
                                      return (
                                      <td key={`${row.student.id}-${round}`} className="px-4 py-3 text-center">
                                        {bulkEditMode && hasScore && att ? (
                                          pendingReq ? (
                                            <span
                                              className="inline-flex items-center justify-center gap-1 px-2 py-1 rounded-lg bg-slate-100 text-slate-500 text-[11px] font-bold font-sarabun"
                                              title={`รออนุมัติ: ${pendingReq.previousScore ?? '-'} → ${pendingReq.requestedScore}`}
                                            >
                                              รออนุมัติ
                                            </span>
                                          ) : (
                                            <div className="inline-flex items-center gap-1">
                                              <input
                                                type="number"
                                                min={0}
                                                max={roundTotal}
                                                step={0.5}
                                                defaultValue={roundScore ?? undefined}
                                                onChange={(e) => {
                                                  const key = bulkEditKey(row.student.id, round);
                                                  setBulkEditValues((prev) => ({ ...prev, [key]: e.target.value }));
                                                }}
                                                className="h-8 w-16 rounded-lg border border-indigo-200 bg-white px-1 text-center text-[12px] font-black text-slate-800 font-sukhumvit tabular-nums outline-none focus:ring-2 focus:ring-indigo-500/30"
                                                aria-label={`คะแนนใหม่ ${row.student.fullName} รอบ ${round}`}
                                              />
                                              <span className="text-[10px] text-slate-400 font-sarabun">/{roundTotal}</span>
                                            </div>
                                          )
                                        ) : hasScore && pendingReq ? (
                                          <button
                                            type="button"
                                            onClick={() => openScoreDetail(row.student, row.attemptsByRound, round)}
                                            className="inline-flex items-center justify-center gap-1 px-2 py-1 rounded-lg bg-indigo-50 text-indigo-700 text-[12px] font-black font-sukhumvit hover:bg-indigo-100 tabular-nums"
                                            title={`รอ sysadmin/ผู้บริหารอนุมัติ — เหตุผล: ${pendingReq.reason}`}
                                          >
                                            {pendingReq.previousScore ?? '-'} → {pendingReq.requestedScore}
                                          </button>
                                        ) : hasScore ? (
                                          <button
                                            type="button"
                                            onClick={() => openScoreDetail(row.student, row.attemptsByRound, round)}
                                            className={cn(
                                              'inline-flex items-center justify-center gap-1 min-w-10 px-2 py-1 rounded-lg text-[12px] font-black font-sukhumvit hover:opacity-90',
                                              needsManualReview
                                                ? 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                                                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
                                            )}
                                            title={`${roundScore}/${roundTotal || '-'} คะแนน (${roundScorePercent}%)${needsManualReview ? ' — รอตรวจข้ออัตนัย' : ''} — ดูรายละเอียด`}
                                          >
                                            {roundScorePercent}%
                                            {needsManualReview && <HiMiniPencil size={11} className="shrink-0" />}
                                          </button>
                                        ) : isInProgress ? (
                                          <span className="inline-flex items-center justify-center px-2 py-1 rounded-lg bg-blue-50 text-blue-600 text-[11px] font-bold font-sarabun">
                                            กำลังสอบ
                                          </span>
                                        ) : isPending ? (
                                          <button
                                            type="button"
                                            onClick={() => openScoreDetail(row.student, row.attemptsByRound, round)}
                                            className="inline-flex items-center justify-center px-2 py-1 rounded-lg bg-amber-50 text-amber-600 text-[11px] font-bold font-sarabun hover:bg-amber-100"
                                            title="ดูรายละเอียดคำตอบ"
                                          >
                                            รอตรวจ
                                          </button>
                                        ) : (
                                          <span className="text-[12px] text-slate-300 font-bold">-</span>
                                        )}
                                      </td>
                                      );
                                    })}

                                    <td className="px-4 py-3 text-center">
                                      {row.bestScorePercent !== null ? (
                                        <span
                                          className={cn(
                                            'inline-flex items-center justify-center min-w-10 px-2 py-1 rounded-lg text-[12px] font-black font-sukhumvit',
                                            row.bestScoreClass,
                                          )}
                                        >
                                          {row.bestScorePercent}%
                                        </span>
                                      ) : (
                                        <span className="text-[12px] text-slate-300 font-bold">-</span>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                          <div className="rounded-2xl border border-slate-200 bg-white p-4">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-sukhumvit">นักเรียนทั้งหมด</p>
                            <p className="mt-1 text-[28px] font-black text-slate-800 font-sukhumvit">{summaryDashboard.totalStudents}</p>
                          </div>
                          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
                            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest font-sukhumvit">มีคะแนนแล้ว</p>
                            <p className="mt-1 text-[28px] font-black text-emerald-700 font-sukhumvit">{summaryDashboard.scoredStudents}</p>
                          </div>
                          <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
                            <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest font-sukhumvit">รอตรวจ</p>
                            <p className="mt-1 text-[28px] font-black text-amber-700 font-sukhumvit">{summaryDashboard.pendingStudents}</p>
                          </div>
                          <div className="rounded-2xl border border-blue-200 bg-blue-50/60 p-4">
                            <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest font-sukhumvit">ผ่านเกณฑ์ (≥ 50%)</p>
                            <p className="mt-1 text-[28px] font-black text-blue-700 font-sukhumvit">{summaryDashboard.passRate.toFixed(1)}%</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                          <div className="rounded-2xl border border-slate-200 bg-white p-4">
                            <h4 className="text-[12px] font-black text-slate-700 font-sukhumvit mb-3">คะแนนเฉลี่ยต่อรอบ (%)</h4>
                            <div className="h-64">
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={summaryDashboard.roundStats}>
                                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                  <XAxis dataKey="round" tick={{ fontSize: 11, fill: '#64748b' }} />
                                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748b' }} />
                                  <Tooltip formatter={(value: any) => [`${value}%`, 'เฉลี่ย']} />
                                  <Bar dataKey="avgPercent" fill="#3b82f6" radius={[8, 8, 0, 0]} />
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                          </div>

                          <div className="rounded-2xl border border-slate-200 bg-white p-4">
                            <h4 className="text-[12px] font-black text-slate-700 font-sukhumvit mb-3">สัดส่วนช่วงคะแนน (%)</h4>
                            <div className="h-64">
                              <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                  <Pie
                                    data={summaryDashboard.distribution}
                                    cx="50%"
                                    cy="50%"
                                    outerRadius={86}
                                    innerRadius={48}
                                    paddingAngle={2}
                                    dataKey="value"
                                    nameKey="name"
                                  >
                                    {summaryDashboard.distribution.map((entry) => (
                                      <Cell key={entry.name} fill={entry.color} />
                                    ))}
                                  </Pie>
                                  <Tooltip formatter={(value: any, _name: any, props: any) => [`${value} คน`, props.payload?.name ?? '']} />
                                </PieChart>
                              </ResponsiveContainer>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                          <div className="rounded-2xl border border-slate-200 bg-white p-4">
                            <h4 className="text-[12px] font-black text-slate-700 font-sukhumvit mb-3">จำนวนผู้มีคะแนนต่อรอบ</h4>
                            <div className="h-56">
                              <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={summaryDashboard.roundStats}>
                                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                  <XAxis dataKey="round" tick={{ fontSize: 11, fill: '#64748b' }} />
                                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                                  <Tooltip formatter={(value: any) => [`${value} คน`, 'มีคะแนน']} />
                                  <Line type="monotone" dataKey="scored" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} />
                                </LineChart>
                              </ResponsiveContainer>
                            </div>
                          </div>

                          <div className="rounded-2xl border border-slate-200 bg-white p-4">
                            <h4 className="text-[12px] font-black text-slate-700 font-sukhumvit mb-3">ค่าสถิติสำคัญ</h4>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="rounded-xl bg-slate-50 p-3 border border-slate-200">
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wide">Mean</p>
                                <p className="text-[20px] font-black text-slate-800 font-sukhumvit">{summaryDashboard.avgPercent.toFixed(1)}%</p>
                              </div>
                              <div className="rounded-xl bg-slate-50 p-3 border border-slate-200">
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wide">Median</p>
                                <p className="text-[20px] font-black text-slate-800 font-sukhumvit">{summaryDashboard.medianPercent.toFixed(1)}%</p>
                              </div>
                              <div className="rounded-xl bg-emerald-50 p-3 border border-emerald-200">
                                <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-wide">Highest</p>
                                <p className="text-[20px] font-black text-emerald-700 font-sukhumvit">{summaryDashboard.maxPercent.toFixed(1)}%</p>
                              </div>
                              <div className="rounded-xl bg-rose-50 p-3 border border-rose-200">
                                <p className="text-[10px] text-rose-600 font-bold uppercase tracking-wide">Lowest</p>
                                <p className="text-[20px] font-black text-rose-700 font-sukhumvit">{summaryDashboard.minPercent.toFixed(1)}%</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              )}
            </motion.div>
          </AnimatePresence>
          </div>
        </div>
      </div>
      <StudentExamScoreDetailDrawer
        open={scoreDetail !== null}
        onClose={() => setScoreDetail(null)}
        room={room}
        student={scoreDetail?.student ?? null}
        attemptsByRound={scoreDetailAttemptsByRound}
        roundNumbers={roundNumbers}
        initialRound={scoreDetail?.initialRound}
      />
      <ExamManualGradingDrawer
        open={manualGradingRound !== null}
        onClose={() => setManualGradingRound(null)}
        room={room}
        round={manualGradingRound ?? 1}
        students={summaryStudents}
        attempts={attempts}
      />
    </motion.div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function ExamManager() {
  const navigate = useNavigate();
  const location = useLocation();
  const examShell = useExamShell();
  const { role, user } = useAuth();
  const isStudent = role === 'student';
  const { canEdit: canEditExam, canDelete: canDeleteExam } = useMyPermissions();
  const canEdit = canEditExam('exams');
  const canDelete = canDeleteExam('exams');
  const { rooms, attempts, isLoading, createRoom, updateRoom, updateRoomStatus, finishRoom, deleteRoom, getAttemptsForRoom, resetStudentAttempt, resetAllAttempts, calculateRoomScores } = useExamRoom({
    // Students only need own attempts; staff keep smart `all` (full once + active poll)
    loadAttempts: isStudent ? 'mine' : 'all',
  });
  // Roster lookup for resolving a student's real name (not their login email) on the
  // suspicious-activity card alert below — same resolver ProctoringModal/RoomDetailView use.
  const canViewAllSubjects = role === 'admin' || role === 'sysadmin';
  const teachingMgr = useTeachingManager(user?.uid ?? '', canViewAllSubjects);

  const handleRecalculateScores = useCallback(async (roomId: string, round: number) => {
    await calculateRoomScores(roomId, round, { includeGraded: true });
  }, [calculateRoomScores]);

  // Suspicious-activity alert on the room card: flips the card to show the
  // student's name + reads it aloud every time any attempt's suspiciousActivities
  // counter goes up (tab-switch detected in StudentExamPage). Keyed per attempt so
  // the first snapshot (existing counts) never fires — only later increments do.
  const [cardAlerts, setCardAlerts] = useState<Record<string, { studentName: string; key: number }>>({});
  const prevSuspiciousRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    attempts.forEach((att) => {
      const prevCount = prevSuspiciousRef.current.get(att.id);
      const currentCount = att.suspiciousActivities ?? 0;
      if (prevCount !== undefined && currentCount > prevCount) {
        const room = rooms.find((r) => r.id === att.roomId);
        const classStudents = room?.classId ? teachingMgr.getStudentsForClass(room.classId) : [];
        const roomAttempts = attempts.filter((a) => a.roomId === att.roomId);
        const displayNameByKey = buildStudentDisplayNameByIdentityKey(classStudents, roomAttempts);
        const studentName = resolveAttemptDisplayName(att, displayNameByKey);
        const alertKey = Date.now();
        setCardAlerts((prev) => ({ ...prev, [att.roomId]: { studentName, key: alertKey } }));
        window.setTimeout(() => {
          setCardAlerts((prev) => {
            if (prev[att.roomId]?.key !== alertKey) return prev;
            const next = { ...prev };
            delete next[att.roomId];
            return next;
          });
        }, 6000);

        try {
          const utterance = new SpeechSynthesisUtterance(`นักเรียน ${studentName} สลับหน้าจอ`);
          utterance.lang = 'th-TH';
          window.speechSynthesis?.speak(utterance);
        } catch (err) {
          console.warn('[ExamManager] speech synthesis failed:', err);
        }
      }
      prevSuspiciousRef.current.set(att.id, currentCount);
    });
  }, [attempts, rooms, teachingMgr]);
  const [showCreate, setShowCreate] = useState(false);
  const [createPrefill, setCreatePrefill] = useState<CreateRoomPrefill | null>(null);
  const [editingRoom, setEditingRoom] = useState<ExamRoom | null>(null);
  const [proctoringRoom, setProctoringRoom] = useState<ExamRoom | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | ExamRoom['status']>(isStudent ? 'active' : 'upcoming');
  const [filterDepartment, setFilterDepartment] = useState<Department | 'all'>('all');
  const [filterGradeLevel, setFilterGradeLevel] = useState<string>('all');
  const [filterRoomNumber, setFilterRoomNumber] = useState<string>('all');
  const [filterSubjectGroup, setFilterSubjectGroup] = useState<SubjectGroupId | 'all'>('all');
  const [filterSubSubjectGroup, setFilterSubSubjectGroup] = useState<string>('all');
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileStatusMenuOpen, setMobileStatusMenuOpen] = useState(false);
  const [roomSearchText, setRoomSearchText] = useState('');
  const [detailRoom, setDetailRoom] = useState<ExamRoom | null>(null);
  const [detailRoomTab, setDetailRoomTab] = useState<SettingsTab | undefined>(undefined);

  useEffect(() => {
    const state = location.state as {
      openCreateExam?: boolean;
      prefill?: {
        title?: string;
        subjectId?: string;
        classId?: string;
        gradeLevel?: string;
      };
    } | null;
    if (!state?.openCreateExam) return;
    setShowCreate(true);
    setCreatePrefill(state.prefill ?? null);
    navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, location.state, navigate]);

  useEffect(() => {
    if (!detailRoom) {
      setDetailRoomTab(undefined);
    }
  }, [detailRoom]);

  const [currentPage, setCurrentPage] = useState(1);
  const swipeStartX = useRef<number | null>(null);

  useEffect(() => {
    setCurrentPage(1);
  }, [rooms, filterStatus, filterDepartment, filterGradeLevel, filterRoomNumber, filterSubjectGroup, filterSubSubjectGroup, roomSearchText]);

  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [roomToDelete, setRoomToDelete] = useState<ExamRoom | null>(null);
  const [closeRoomConfirm, setCloseRoomConfirm] = useState<ExamRoom | null>(null);
  const [finishRoomConfirm, setFinishRoomConfirm] = useState<ExamRoom | null>(null);
  const [summaryData, setSummaryData] = useState<{ room: ExamRoom, attempt: ExamAttempt } | null>(null);
  // Reset exam state
  const [resetConfirm, setResetConfirm] = useState<{
    type: 'student' | 'all';
    studentId?: string;
    studentName?: string;
    isResetting?: boolean;
  } | null>(null);
  const liveDetailRoom = useMemo(() => {
    if (!detailRoom) return null;
    return rooms.find((r) => r.id === detailRoom.id) ?? detailRoom;
  }, [rooms, detailRoom]);

  useEffect(() => {
    setMobileStatusMenuOpen(false);
  }, [liveDetailRoom]);

  useEffect(() => {
    if (!mobileStatusMenuOpen) return;
    const close = () => setMobileStatusMenuOpen(false);
    window.addEventListener('scroll', close, true);
    return () => window.removeEventListener('scroll', close, true);
  }, [mobileStatusMenuOpen]);

  const handleContentClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'IMG' && (target as HTMLImageElement).src) {
      setZoomedImage((target as HTMLImageElement).src);
    }
  };


  const [headerRightPortalEl, setHeaderRightPortalEl] = useState<HTMLElement | null>(null);
  const [headerCenterPortalEl, setHeaderCenterPortalEl] = useState<HTMLElement | null>(null);
  const [headerMobileActionsPortalEl, setHeaderMobileActionsPortalEl] = useState<HTMLElement | null>(null);
  const [headerMobileBackPortalEl, setHeaderMobileBackPortalEl] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setHeaderRightPortalEl(document.getElementById('header-portal-right-actions'));
    setHeaderCenterPortalEl(document.getElementById('header-portal-center'));
    setHeaderMobileActionsPortalEl(document.getElementById('header-portal-mobile-actions'));
    setHeaderMobileBackPortalEl(document.getElementById('header-portal-mobile-back'));
  }, []);

  useEffect(() => {
    const defaultBack = document.getElementById('portal-default-mobile-back');
    if (!defaultBack) return;
    defaultBack.style.display = liveDetailRoom ? 'none' : '';
  }, [liveDetailRoom]);

  useEffect(() => {
    examShell?.setHideNav(Boolean(liveDetailRoom));
    return () => examShell?.setHideNav(false);
  }, [examShell, liveDetailRoom]);

  const examFilterOptions = useMemo(() => {
    const departments = new Set<Department>();
    const gradesByDept = new Map<string, Set<string>>();
    const roomsByDeptGrade = new Map<string, Set<string>>();

    rooms.forEach((room) => {
      const dept = (room.departmentId || 'secondary') as Department;
      if (dept in DEPARTMENT_CONFIG) departments.add(dept);

      const grade = getExamRoomGradeLevel(room);
      if (!grade) return;

      if (!gradesByDept.has(dept)) gradesByDept.set(dept, new Set());
      gradesByDept.get(dept)!.add(grade);

      const roomNumber = getExamRoomNumber(room);
      if (roomNumber) {
        const key = `${dept}|${grade}`;
        if (!roomsByDeptGrade.has(key)) roomsByDeptGrade.set(key, new Set());
        roomsByDeptGrade.get(key)!.add(roomNumber);
      }
    });

    return { departments: Array.from(departments), gradesByDept, roomsByDeptGrade };
  }, [rooms]);

  const availableGradeLevels = useMemo(() => {
    if (filterDepartment === 'all') {
      const allGrades = new Set<string>();
      examFilterOptions.gradesByDept.forEach((grades) => grades.forEach((grade) => allGrades.add(grade)));
      return sortGradeLevels(Array.from(allGrades), 'all');
    }
    return sortGradeLevels(
      Array.from(examFilterOptions.gradesByDept.get(filterDepartment) ?? []),
      filterDepartment,
    );
  }, [filterDepartment, examFilterOptions]);

  const availableRoomNumbers = useMemo(() => {
    if (filterDepartment === 'all' || filterGradeLevel === 'all') return [] as string[];
    const key = `${filterDepartment}|${filterGradeLevel}`;
    return Array.from(examFilterOptions.roomsByDeptGrade.get(key) ?? []).sort((a, b) =>
      a.localeCompare(b, 'th', { numeric: true }),
    );
  }, [filterDepartment, filterGradeLevel, examFilterOptions]);

  const hasStructureFilter =
    filterDepartment !== 'all'
    || filterGradeLevel !== 'all'
    || filterRoomNumber !== 'all'
    || filterSubjectGroup !== 'all'
    || filterSubSubjectGroup !== 'all'
    || roomSearchText.trim().length > 0;

  const availableSubSubjectGroups = useMemo(() => {
    if (filterSubjectGroup === 'all') return [] as string[];
    return SUBJECT_SUBGROUP_CONFIG[filterSubjectGroup] ?? [];
  }, [filterSubjectGroup]);

  const filtered = useMemo(() => {
    return rooms
      .filter((room) => {
      const matchStatus = filterStatus === 'all' || room.status === filterStatus;
      const matchSearch = room.title.toLowerCase().includes(roomSearchText.toLowerCase()) ||
        (room.className?.toLowerCase() || '').includes(roomSearchText.toLowerCase());

      const dept = (room.departmentId || 'secondary') as Department;
      const matchDepartment = filterDepartment === 'all' || dept === filterDepartment;

      const grade = getExamRoomGradeLevel(room);
      const matchGrade = filterGradeLevel === 'all' || grade === filterGradeLevel;

      const roomNumber = getExamRoomNumber(room);
      const matchRoom = filterRoomNumber === 'all' || roomNumber === filterRoomNumber;

      const matchSubjectGroup = filterSubjectGroup === 'all' || room.subjectGroupId === filterSubjectGroup;
      const matchSubSubjectGroup = filterSubSubjectGroup === 'all'
        || (filterSubSubjectGroup === NO_SUB_SUBJECT_GROUP
          ? !room.subSubjectGroup?.trim()
          : (room.subSubjectGroup?.trim() || '') === filterSubSubjectGroup);

      return matchStatus && matchSearch && matchDepartment && matchGrade && matchRoom && matchSubjectGroup && matchSubSubjectGroup;
    })
      .sort((a, b) => {
        const timeA = a.createdAt ?? 0;
        const timeB = b.createdAt ?? 0;
        if (timeA !== timeB) return timeB - timeA;
        return a.title.localeCompare(b.title, 'th', { numeric: true });
      });
  }, [rooms, filterStatus, filterDepartment, filterGradeLevel, filterRoomNumber, filterSubjectGroup, filterSubSubjectGroup, roomSearchText]);

  const CARDS_PER_PAGE = 12;
  const totalPages = Math.max(1, Math.ceil(filtered.length / CARDS_PER_PAGE));
  const paginatedRooms = useMemo(() => {
    const start = (currentPage - 1) * CARDS_PER_PAGE;
    return filtered.slice(start, start + CARDS_PER_PAGE);
  }, [filtered, currentPage]);

  const rangeStart = filtered.length === 0 ? 0 : (currentPage - 1) * CARDS_PER_PAGE + 1;
  const rangeEnd = Math.min(currentPage * CARDS_PER_PAGE, filtered.length);

  const statusFilterOptions: ReadonlyArray<{
    key: typeof filterStatus;
    label: string;
  }> = [
    { key: 'all', label: 'ทั้งหมด' },
    { key: 'upcoming', label: 'รอเปิด' },
    { key: 'active', label: 'กำลังสอบ' },
    { key: 'closed', label: 'ปิดแล้ว' },
  ];

  const handleStatusFilterChange = (key: typeof filterStatus) => {
    setFilterStatus(key);
    setDetailRoom(null);
    setMobileStatusMenuOpen(false);
  };

  // Header panel ฝั่งขวา มุมขวา: tab กรองสถานะห้องสอบ (ย้ายมาจาก select บน header บนสุด)
  const statusFilterTabs = (
    <div className="mb-3 hidden justify-start lg:flex">
      <div className="flex h-8 items-center gap-0.5 rounded-lg border border-slate-200/20 bg-slate-100/80 p-0.5">
        {statusFilterOptions.map((option) => {
          const active = filterStatus === option.key;
          return (
            <button
              key={option.key}
              type="button"
              onClick={() => handleStatusFilterChange(option.key)}
              className={cn(
                'flex h-7 shrink-0 items-center gap-1.5 rounded-md px-3 text-[11px] font-bold transition-all',
                active ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-800',
              )}
            >
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: EXAM_STATUS_FILTER_COLORS[option.key] }}
                aria-hidden
              />
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );

  const mobileStatusFilterButton = (
    <div className="relative shrink-0 lg:hidden">
      <button
        type="button"
        onClick={() => setMobileStatusMenuOpen((open) => !open)}
        className={cn(
          'flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm transition-colors hover:bg-slate-50',
          filterStatus !== 'all' && 'border-slate-300',
        )}
        title="กรองตามสถานะห้องสอบ"
        aria-label="กรองตามสถานะห้องสอบ"
        aria-expanded={mobileStatusMenuOpen}
      >
        <span
          className="h-2 w-2 rounded-full"
          style={{ backgroundColor: EXAM_STATUS_FILTER_COLORS[filterStatus] }}
        />
      </button>

      {mobileStatusMenuOpen && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[90]"
            aria-label="ปิดเมนูสถานะห้องสอบ"
            onClick={() => setMobileStatusMenuOpen(false)}
          />
          <div className="absolute right-0 top-full z-[100] mt-2 w-44 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl">
            {statusFilterOptions.map((option) => {
              const isActive = filterStatus === option.key;
              return (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => handleStatusFilterChange(option.key)}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left font-sukhumvit text-[13px] font-bold transition-colors',
                    isActive ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-50',
                  )}
                >
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: EXAM_STATUS_FILTER_COLORS[option.key] }}
                    aria-hidden
                  />
                  <span className="flex-1">{option.label}</span>
                  {isActive && <HiCheck className="h-4 w-4 shrink-0" aria-hidden />}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );

  const handleDepartmentFilterChange = (dept: Department | 'all') => {
    setFilterDepartment(dept);
    setFilterGradeLevel('all');
    setFilterRoomNumber('all');
    setFilterSubjectGroup('all');
    setFilterSubSubjectGroup('all');
    setDetailRoom(null);
  };

  const handleGradeFilterChange = (grade: string) => {
    setFilterGradeLevel(grade);
    setFilterRoomNumber('all');
    setFilterSubjectGroup('all');
    setFilterSubSubjectGroup('all');
    setDetailRoom(null);
  };

  const handleRoomFilterChange = (roomNumber: string) => {
    setFilterRoomNumber(roomNumber);
    setDetailRoom(null);
  };

  const subjectGroups = useMemo(() => {
    return Object.entries(SUBJECT_GROUP_CONFIG).sort(([, a], [, b]) => a.order - b.order);
  }, []);

  // Teacher role: กรอง sidebar ให้เหลือเฉพาะกลุ่มสาระที่ได้รับมอบหมายสอนจริงในชั้นที่เลือก
  const myAssignedSubjectGroupIds = useMemo(() => {
    if (role !== 'teacher' || filterDepartment === 'all' || filterGradeLevel === 'all') return null;
    const subjectGroupBySubjectId = new Map(
      teachingMgr.mySubjects
        .filter((s) => s.subjectGroup)
        .map((s) => [s.id, s.subjectGroup as string]),
    );
    const groupIds = new Set<string>();
    teachingMgr.yearClasses
      .filter((c) => (c.departmentId || c.department) === filterDepartment && c.gradeLevel === filterGradeLevel)
      .forEach((c) => {
        (c.enrolledCourses ?? []).forEach((ec) => {
          if (!matchesTeacherIdentity(ec.teacherId, teachingMgr.teacherIdentityKeys)) return;
          const groupId = subjectGroupBySubjectId.get(ec.subjectId);
          if (groupId) groupIds.add(groupId);
        });
      });
    return groupIds;
  }, [role, filterDepartment, filterGradeLevel, teachingMgr.mySubjects, teachingMgr.yearClasses, teachingMgr.teacherIdentityKeys]);

  const visibleSubjectGroups = myAssignedSubjectGroupIds
    ? subjectGroups.filter(([id]) => myAssignedSubjectGroupIds.has(id))
    : subjectGroups;

  const resetStructureFilters = () => {
    setFilterDepartment('all');
    setFilterGradeLevel('all');
    setFilterRoomNumber('all');
    setFilterSubjectGroup('all');
    setFilterSubSubjectGroup('all');
    setRoomSearchText('');
    setDetailRoom(null);
  };

  // Sidebar: แผนก → ชั้น (built-in cascade) → กลุ่มสาระ (children, card-based)
  // Student: dept/grade การ์ดถูกซ่อน (rooms ถูก scope จากฝั่ง server มาเป็นของตัวเองแล้ว) จึงข้ามไปแสดงกลุ่มสาระได้เลย
  const sidebarBrowseNav = isStudent || (filterDepartment !== 'all' && filterGradeLevel !== 'all') ? (
    <>
      <section className="pb-1">
        <p className="mb-2 px-0.5 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
          กลุ่มสาระ
        </p>
        <div className="flex flex-col gap-2">
          {visibleSubjectGroups.map(([id, cfg]) => {
            const active = filterSubjectGroup === id;
            const count = rooms.filter((r) => {
              const dept = (r.departmentId || 'secondary') as Department;
              return (filterDepartment === 'all' || dept === filterDepartment)
                && (filterGradeLevel === 'all' || getExamRoomGradeLevel(r) === filterGradeLevel)
                && r.subjectGroupId === id;
            }).length;
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setFilterSubjectGroup(id as SubjectGroupId);
                  setFilterSubSubjectGroup('all');
                  setDetailRoom(null);
                }}
                className="flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all shadow-sm"
                style={{
                  backgroundColor: active ? cfg.color : cfg.bg,
                  borderColor: active ? cfg.color : cfg.border,
                }}
              >
                <span
                  className={cn(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg shadow-sm',
                    active ? 'bg-white/20' : 'bg-white',
                  )}
                  style={{ color: active ? '#ffffff' : cfg.color }}
                >
                  <SubjectIcon subjectGroup={id} size={18} className="text-current drop-shadow-sm" />
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className="block truncate text-[13px] font-black font-sukhumvit"
                    style={{ color: active ? '#ffffff' : cfg.color }}
                  >
                    {cfg.name}
                  </span>
                  <span
                    className="block text-[10px] font-bold"
                    style={{ color: active ? 'rgba(255,255,255,0.75)' : cfg.color, opacity: active ? 1 : 0.75 }}
                  >
                    {count.toLocaleString('th-TH')} ห้องสอบ
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </section>
    </>
  ) : null;

  // Header panel ฝั่งขวา: tab เลือกสาระย่อย — โผล่เฉพาะตอนกลุ่มสาระที่เลือกมีสาระย่อยจริง
  const subSubjectGroupTabs = filterSubjectGroup !== 'all' ? (
    <div className="mb-3 flex h-8 w-full items-center gap-0.5 overflow-x-auto rounded-lg border border-slate-200/20 bg-slate-100/80 p-0.5 scrollbar-hide">
      <button
        type="button"
        onClick={() => {
          setFilterSubSubjectGroup('all');
          setDetailRoom(null);
        }}
        className={cn(
          'flex h-7 shrink-0 items-center justify-center rounded-md px-3 text-[11px] font-bold transition-all',
          filterSubSubjectGroup === 'all'
            ? 'bg-white text-slate-800 shadow-xs'
            : 'text-slate-500 hover:text-slate-800',
        )}
      >
        ทั้งหมด
      </button>
      <button
        type="button"
        onClick={() => {
          setFilterSubSubjectGroup(NO_SUB_SUBJECT_GROUP);
          setDetailRoom(null);
        }}
        className={cn(
          'flex h-7 shrink-0 items-center justify-center rounded-md px-3 text-[11px] font-bold transition-all',
          filterSubSubjectGroup === NO_SUB_SUBJECT_GROUP
            ? 'bg-white text-slate-800 shadow-xs'
            : 'text-slate-500 hover:text-slate-800',
        )}
      >
        ไม่มีสาระย่อย
      </button>
      {availableSubSubjectGroups.map((sub) => {
        const active = filterSubSubjectGroup === sub;
        return (
          <button
            key={sub}
            type="button"
            onClick={() => {
              setFilterSubSubjectGroup(sub);
              setDetailRoom(null);
            }}
            className={cn(
              'flex h-7 shrink-0 items-center justify-center rounded-md px-3 text-[11px] font-bold transition-all',
              active
                ? 'bg-white text-slate-800 shadow-xs'
                : 'text-slate-500 hover:text-slate-800',
            )}
          >
            {sub}
          </button>
        );
      })}
    </div>
  ) : null;

  const handleChangeStatus = async (roomId: string, status: ExamRoom['status'], bypassConfirm = false) => {
    if (status === 'closed' && !bypassConfirm) {
      const room = rooms.find((r) => r.id === roomId);
      if (room) {
        setCloseRoomConfirm(room);
        return;
      }
    }
    try {
      await updateRoomStatus(roomId, status);
    } catch (err) {
      if (err instanceof Error && err.message === 'EXAM_ROOM_QUESTIONS_NOT_SAVED') {
        toast.error('กรุณาเปิดแท็บ「ข้อสอบ」เลือกชุดข้อสอบ แล้วกด「บันทึก」ก่อนเปิดห้องสอบ');
        return;
      }
      console.error('Failed to update room status:', err);
    }
  };

  const handleConfirmCloseRoom = async () => {
    if (!closeRoomConfirm) return;
    try {
      await updateRoomStatus(closeRoomConfirm.id, 'closed');
      setCloseRoomConfirm(null);
    } catch (err) {
      console.error('Failed to close room:', err);
    }
  };

  const handleConfirmFinishRoom = async () => {
    if (!finishRoomConfirm) return;
    try {
      await finishRoom(finishRoomConfirm.id);
      setFinishRoomConfirm(null);
    } catch (err) {
      console.error('Failed to finish room:', err);
    }
  };

  const handleDelete = (room: ExamRoom) => {
    setRoomToDelete(room);
  };

  const handleConfirmDelete = async () => {
    if (!roomToDelete) return;
    try {
      await deleteRoom(roomToDelete.id);
      if (liveDetailRoom?.id === roomToDelete.id) setDetailRoom(null);
      setRoomToDelete(null);
    } catch (err) {
      console.error('Failed to delete room:', err);
    }
  };

  // Reset handlers
  const handleResetStudent = (studentId: string, studentName: string) => {
    setResetConfirm({ type: 'student', studentId, studentName });
  };
  const handleResetAll = () => {
    setResetConfirm({ type: 'all' });
  };
  const handleConfirmReset = async () => {
    if (!resetConfirm || !liveDetailRoom) return;
    setResetConfirm(prev => prev ? { ...prev, isResetting: true } : null);
    try {
      if (resetConfirm.type === 'student' && resetConfirm.studentId) {
        await resetStudentAttempt(liveDetailRoom.id, resetConfirm.studentId);
      } else if (resetConfirm.type === 'all') {
        await resetAllAttempts(liveDetailRoom.id);
      }
    } catch (err) {
      console.error('Reset failed:', err);
      alert('รีเซ็ตไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setResetConfirm(null);
    }
  };

  return (
    <div className="relative flex w-full min-h-0 flex-1 flex-col h-[calc(100dvh-4.25rem)] max-h-[calc(100dvh-4.25rem)]">
      {headerMobileActionsPortalEl && !liveDetailRoom && createPortal(
        <div className="pointer-events-auto flex items-center gap-1.5">
          <ExamMobileFilterTriggerButton
            onClick={() => setMobileFilterOpen(true)}
            title="ตัวกรองห้องสอบ"
            hasActiveFilters={hasStructureFilter}
          />
          {mobileStatusFilterButton}
          {canEdit && !isStudent && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              type="button"
              onClick={() => setShowCreate(true)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-black shadow-sm transition-colors hover:bg-slate-50"
              title="สร้างห้องสอบ"
              aria-label="สร้างห้องสอบ"
            >
              <Plus className="h-5 w-5" />
            </motion.button>
          )}
        </div>,
        headerMobileActionsPortalEl,
      )}
      {!liveDetailRoom && (
        <ExamRoomsMobileFilterDrawer
          open={mobileFilterOpen}
          onOpenChange={setMobileFilterOpen}
          filterDepartment={filterDepartment}
          filterGradeLevel={filterGradeLevel}
          filterRoomNumber={filterRoomNumber}
          filterSubjectGroup={filterSubjectGroup}
          filterSubSubjectGroup={filterSubSubjectGroup}
          searchText={roomSearchText}
          availableGradeLevels={availableGradeLevels}
          availableRoomNumbers={availableRoomNumbers}
          availableSubSubjectGroups={availableSubSubjectGroups}
          hasActiveFilters={hasStructureFilter}
          canCreate={canEdit && !isStudent}
          onDepartmentChange={handleDepartmentFilterChange}
          onGradeChange={handleGradeFilterChange}
          onRoomChange={handleRoomFilterChange}
          onSubjectGroupChange={(group) => {
            setFilterSubjectGroup(group);
            setFilterSubSubjectGroup('all');
            setDetailRoom(null);
          }}
          onSubSubjectGroupChange={(sub) => {
            setFilterSubSubjectGroup(sub);
            setDetailRoom(null);
          }}
          onSearchChange={setRoomSearchText}
          onClearFilters={resetStructureFilters}
          onCreateRoom={() => setShowCreate(true)}
        />
      )}
      {headerMobileBackPortalEl && liveDetailRoom && createPortal(
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          type="button"
          onClick={() => setDetailRoom(null)}
          className="lg:hidden flex h-9 w-9 rounded-full items-center justify-center text-slate-700 transition-colors border border-slate-200 bg-white shadow-sm hover:bg-slate-50"
          title="กลับรายการห้องสอบ"
          aria-label="กลับรายการห้องสอบ"
        >
          <HiArrowLeft className="w-5 h-5" />
        </motion.button>,
        headerMobileBackPortalEl,
      )}
      <div className={cn('flex w-full min-h-0 flex-1 flex-col gap-4', !liveDetailRoom && 'pb-24 lg:pb-0')}>

        {/* ── Main area: rooms grid/detail ── */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <AnimatePresence mode="wait">
            {liveDetailRoom ? (
              <RoomDetailView
                key={liveDetailRoom.id}
                room={liveDetailRoom}
                initialTab={detailRoomTab}
                attempts={getAttemptsForRoom(liveDetailRoom.id)}
                onBack={() => setDetailRoom(null)}
                onUpdateRoom={updateRoom}
                onChangeStatus={(status, bypass) => handleChangeStatus(liveDetailRoom.id, status, bypass)}
                onEdit={() => { setEditingRoom(liveDetailRoom); setShowCreate(true); }}
                onDelete={() => handleDelete(liveDetailRoom)}
                onProctor={() => setProctoringRoom(liveDetailRoom)}
                headerPortalEl={headerCenterPortalEl ?? headerRightPortalEl}
                canEdit={canEdit}
                canDelete={canDelete}
                onContentClick={handleContentClick}
                onResetStudent={canEdit ? handleResetStudent : undefined}
                onResetAll={canEdit ? handleResetAll : undefined}
                onRecalculateScores={canEdit ? handleRecalculateScores : undefined}
              />
            ) : (
              <motion.div
                key="grid"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex min-h-0 w-full flex-1 flex-col gap-4 lg:flex-row lg:items-stretch"
              >
                <div
                  className={cn(
                    'hidden shrink-0 flex-col overflow-hidden lg:flex lg:h-auto lg:max-h-full',
                    sidebarCollapsed ? 'lg:w-20 xl:w-20' : 'lg:w-[280px] xl:w-[300px]',
                  )}
                >
                  <GradeBookClassSidebar
                    selectedDept={filterDepartment === 'all' ? '' : filterDepartment}
                    selectedGrade={filterGradeLevel === 'all' ? '' : filterGradeLevel}
                    selectedClassId=""
                    gradeOptions={availableGradeLevels}
                    classOptions={[]}
                    onSelectDept={handleDepartmentFilterChange}
                    onSelectGrade={handleGradeFilterChange}
                    onSelectClass={() => {}}
                    showRooms={false}
                    showGradeRoomNav={!isStudent}
                    hideDeptCards={isStudent}
                    collapsed={sidebarCollapsed}
                    headerAction={(
                      <div className={cn('flex', HEADER_ICON_BTN_GROUP)}>
                        {canEdit && !isStudent && (
                          <button
                            type="button"
                            onClick={() => setShowCreate(true)}
                            className={HEADER_ICON_BTN}
                            title="สร้างห้องสอบ"
                            aria-label="สร้างห้องสอบ"
                          >
                            <Plus size={16} strokeWidth={3} />
                          </button>
                        )}
                        <SidebarCollapseButton
                          collapsed={sidebarCollapsed}
                          onToggle={() => setSidebarCollapsed((v) => !v)}
                        />
                      </div>
                    )}
                  >
                    {sidebarBrowseNav}
                  </GradeBookClassSidebar>
                </div>

                <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-y-contain scrollbar-hide">
                {statusFilterTabs}
                {subSubjectGroupTabs}
                {isLoading ? (
                  <div className="flex-1 flex flex-col items-center justify-center py-40 gap-6">
                    <IndeterminateProgress />
                    <p className="text-slate-400 font-sarabun text-[14px]">กำลังโหลดข้อมูลห้องสอบ...</p>
                  </div>
                ) : !isStudent && filterSubjectGroup === 'all' ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-3">
                    <div className="w-16 h-16 rounded-full bg-white/50 flex items-center justify-center">
                      <ClipboardList size={28} className="text-slate-300" />
                    </div>
                    <p className="text-slate-400 font-sarabun text-[14px]">
                      เลือกกลุ่มสาระด้านซ้ายเพื่อดูห้องสอบ
                    </p>
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-3">
                    <div className="w-16 h-16 rounded-full bg-white/50 flex items-center justify-center">
                      <ClipboardList size={28} className="text-slate-300" />
                    </div>
                    <p className="text-slate-400 font-sarabun text-[14px]">
                      {rooms.length === 0
                        ? 'ยังไม่มีห้องสอบ'
                        : hasStructureFilter || filterStatus !== 'all'
                          ? 'ไม่พบห้องสอบที่ตรงกับตัวกรอง'
                          : 'ยังไม่มีห้องสอบ'}
                    </p>
                    {rooms.length === 0 && canEdit && !isStudent && (
                      <motion.button whileTap={{ scale: 0.98 }}
                        onClick={() => setShowCreate(true)}
                        className="px-5 py-2 rounded-xl text-[12px] font-bold text-white"
                        style={{ background: '#0f172a' }}>
                        <Plus size={13} className="inline mr-1" />สร้างห้องสอบ
                      </motion.button>
                    )}
                  </div>
                ) : (
                  <div
                    className="flex flex-col gap-5 touch-pan-y"
                    onTouchStart={(e) => {
                      swipeStartX.current = e.changedTouches[0]?.clientX ?? null;
                    }}
                    onTouchEnd={(e) => {
                      if (swipeStartX.current == null) return;
                      const deltaX = e.changedTouches[0].clientX - swipeStartX.current;
                      swipeStartX.current = null;
                      if (deltaX < -50 && currentPage < totalPages) {
                        setCurrentPage((prev) => prev + 1);
                      } else if (deltaX > 50 && currentPage > 1) {
                        setCurrentPage((prev) => prev - 1);
                      }
                    }}
                  >
                    <div className={cn('grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-3', PORTAL_CARD_LIST_PADDING)}>
                      {paginatedRooms.map((room, i) => (
                        <motion.div
                          key={room.id}
                          className="h-full py-0.5"
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.04 }}
                        >
                          <RoomCard
                            room={room}
                            isStudent={isStudent}
                            myAttempt={isStudent && user?.uid ? getAttemptsForRoom(room.id).filter(a => String(a.studentId).trim() === user.uid).sort((a, b) => (b.round ?? 0) - (a.round ?? 0))[0] ?? null : null}
                            onTakeExam={() => navigate(`/exam/${room.id}`)}
                            onShowSummary={(r, a) => setSummaryData({ room: r, attempt: a })}
                            onProctor={() => setProctoringRoom(room)}
                            onChangeStatus={(status, bypass) => handleChangeStatus(room.id, status, bypass)}
                            onFinish={() => setFinishRoomConfirm(room)}
                            onDelete={() => handleDelete(room)}
                            onEdit={() => { setEditingRoom(room); setShowCreate(true); }}
                            onOpenSettings={(tab) => {
                              setDetailRoom(room);
                              setDetailRoomTab(tab);
                            }}
                            canEdit={canEdit}
                            canDelete={canDelete}
                            alert={!isStudent ? cardAlerts[room.id] ?? null : null}
                          />
                        </motion.div>
                      ))}
                    </div>

                    {totalPages > 1 && (
                      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-slate-200/60 pt-4 mt-2">
                        <p className="font-sarabun text-[11px] font-bold text-slate-500">
                          แสดง {rangeStart}–{rangeEnd} จาก {filtered.length} ห้องสอบ
                        </p>

                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                            className="h-8 w-8 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30 flex items-center justify-center"
                            aria-label="หน้าก่อนหน้า"
                          >
                            <HiChevronLeft size={16} />
                          </Button>

                          <div className="flex items-center gap-1">
                            {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((page) => {
                              if (totalPages > 5) {
                                if (page !== 1 && page !== totalPages && Math.abs(page - currentPage) > 1) {
                                  if (page === 2 || page === totalPages - 1) {
                                    return (
                                      <span key={`ellipsis-${page}`} className="px-0.5 font-sarabun text-[10px] text-slate-300">
                                        …
                                      </span>
                                    );
                                  }
                                  return null;
                                }
                              }

                              const isActive = currentPage === page;
                              return (
                                <button
                                  key={page}
                                  type="button"
                                  onClick={() => setCurrentPage(page)}
                                  className={cn(
                                    'h-8 min-w-[32px] rounded-lg px-2 font-sukhumvit text-[11px] font-black transition-all',
                                    isActive
                                      ? 'bg-slate-900 text-white shadow-sm'
                                      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800',
                                  )}
                                >
                                  {page}
                                </button>
                              );
                            })}
                          </div>

                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            disabled={currentPage === totalPages}
                            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                            className="h-8 w-8 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30 flex items-center justify-center"
                            aria-label="หน้าถัดไป"
                          >
                            <HiChevronRight size={16} />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {summaryData && (
        <StudentScoreSummaryModal
          open={!!summaryData}
          onClose={() => setSummaryData(null)}
          room={summaryData.room}
          attempt={summaryData.attempt}
        />
      )}

      {/* ── Modals ── */}
      {showCreate && (
        <CreateRoomModal
          key={editingRoom?.id ?? `new-${createPrefill?.title ?? ''}`}
          editRoom={editingRoom}
          prefill={createPrefill}
          onClose={() => { setShowCreate(false); setEditingRoom(null); setCreatePrefill(null); }}
          onCreate={createRoom}
          onUpdate={updateRoom}
        />
      )}

      <AnimatePresence>
        {proctoringRoom && (
          <ProctoringModal
            room={proctoringRoom}
            attempts={getAttemptsForRoom(proctoringRoom.id)}
            onClose={() => setProctoringRoom(null)}
            onRecalculateScores={canEdit ? handleRecalculateScores : undefined}
          />
        )}
      </AnimatePresence>

      <DeleteConfirmDialog
        open={!!roomToDelete}
        onClose={() => setRoomToDelete(null)}
        onConfirm={handleConfirmDelete}
        roomTitle={roomToDelete?.title || ''}
      />

      {/* ── Close Room Confirmation Dialog ── */}
      <AnimatePresence>
        {closeRoomConfirm && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setCloseRoomConfirm(null)}
              className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 16 }}
              className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl p-6 flex flex-col gap-4"
            >
              {/* Icon */}
              <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center mx-auto">
                <HiStop size={26} className="text-rose-500" />
              </div>

              <div className="text-center">
                <h3 className="text-[16px] font-black text-slate-800 font-sukhumvit">
                  ปิดห้องสอบ รอบ {closeRoomConfirm.currentRound ?? 1}
                </h3>
                <p className="text-[13px] text-slate-500 font-sarabun mt-2">
                  คุณต้องการปิดห้องสอบ 「{closeRoomConfirm.title}」 หรือไม่?
                  นักเรียนทั้งหมดที่กำลังสอบอยู่จะถูกส่งกระดาษคำตอบโดยอัตโนมัติ และจะไม่สามารถกลับเข้ามาทำข้อสอบในรอบนี้ได้อีก
                </p>
                <p className="text-[11px] text-rose-500 font-bold font-sarabun mt-1">
                  ⚠️ การกระทำนี้ไม่สามารถย้อนกลับได้
                </p>
              </div>

              <div className="flex gap-3 mt-1">
                <button
                  type="button"
                  onClick={() => setCloseRoomConfirm(null)}
                  className="flex-1 h-11 rounded-2xl border border-slate-200 text-slate-600 text-[13px] font-black font-sukhumvit hover:bg-slate-50 transition-all"
                >
                  ยกเลิก
                </button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  type="button"
                  onClick={handleConfirmCloseRoom}
                  className="flex-1 h-11 rounded-2xl bg-rose-500 text-white text-[13px] font-black font-sukhumvit flex items-center justify-center gap-2 hover:bg-rose-600 transition-all"
                >
                  <HiStop size={14} /> ยืนยันปิดห้องสอบ
                </motion.button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Finish Room (Unlimited Rounds) Confirmation Dialog ── */}
      <AnimatePresence>
        {finishRoomConfirm && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setFinishRoomConfirm(null)}
              className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 16 }}
              className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl p-6 flex flex-col gap-4"
            >
              {/* Icon */}
              <div className="w-14 h-14 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center mx-auto">
                <HiCheckCircle size={26} className="text-slate-700" />
              </div>

              <div className="text-center">
                <h3 className="text-[16px] font-black text-slate-800 font-sukhumvit">
                  จบห้องสอบ 「{finishRoomConfirm.title}」?
                </h3>
                <p className="text-[13px] text-slate-500 font-sarabun mt-2">
                  ห้องสอบนี้จะไม่สามารถเปิดได้อีก ถ้าต้องการทำสอบ ให้ทำการสร้างห้องสอบอีกและตั้งค่าให้ถูกต้อง
                </p>
                <p className="text-[11px] text-rose-500 font-bold font-sarabun mt-1">
                  ⚠️ การกระทำนี้ไม่สามารถย้อนกลับได้
                </p>
              </div>

              <div className="flex gap-3 mt-1">
                <button
                  type="button"
                  onClick={() => setFinishRoomConfirm(null)}
                  className="flex-1 h-11 rounded-2xl border border-slate-200 text-slate-600 text-[13px] font-black font-sukhumvit hover:bg-slate-50 transition-all"
                >
                  ยกเลิก
                </button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  type="button"
                  onClick={handleConfirmFinishRoom}
                  className="flex-1 h-11 rounded-2xl bg-slate-800 text-white text-[13px] font-black font-sukhumvit flex items-center justify-center gap-2 hover:bg-slate-900 transition-all"
                >
                  <HiCheckCircle size={14} /> ยืนยันเสร็จสิ้น
                </motion.button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Reset Confirmation Dialog ── */}
      <AnimatePresence>
        {resetConfirm && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => !resetConfirm.isResetting && setResetConfirm(null)}
              className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 16 }}
              className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl p-6 flex flex-col gap-4"
            >
              {/* Icon */}
              <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center mx-auto">
                <RotateCcw size={26} className="text-amber-500" />
              </div>

              <div className="text-center">
                <h3 className="text-[16px] font-black text-slate-800 font-sukhumvit">
                  {resetConfirm.type === 'student'
                    ? `รีเซ็ตการสอบของ ${resetConfirm.studentName}`
                    : 'รีเซ็ตการสอบทั้งหมด'}
                </h3>
                <p className="text-[13px] text-slate-500 font-sarabun mt-2">
                  {resetConfirm.type === 'student'
                    ? 'ข้อมูลการสอบและคะแนนของนักเรียนคนนี้จะถูกลบออก นักเรียนจะสามารถเข้าสอบใหม่ได้'
                    : 'ข้อมูลการสอบและคะแนนของนักเรียนทั้งหมดจะถูกลบออก ห้องสอบจะกลับสู่สถานะรอเปิด'}
                </p>
                <p className="text-[11px] text-rose-500 font-bold font-sarabun mt-1">
                  ⚠️ การกระทำนี้ไม่สามารถย้อนกลับได้
                </p>
              </div>

              <div className="flex gap-3 mt-1">
                <button
                  onClick={() => setResetConfirm(null)}
                  disabled={resetConfirm.isResetting}
                  className="flex-1 h-11 rounded-2xl border border-slate-200 text-slate-600 text-[13px] font-black font-sukhumvit hover:bg-slate-50 transition-all disabled:opacity-50"
                >
                  ยกเลิก
                </button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={handleConfirmReset}
                  disabled={resetConfirm.isResetting}
                  className="flex-1 h-11 rounded-2xl bg-amber-500 text-white text-[13px] font-black font-sukhumvit flex items-center justify-center gap-2 hover:bg-amber-600 transition-all disabled:opacity-60"
                >
                  {resetConfirm.isResetting ? (
                    <><RotateCcw size={14} className="animate-spin" /> กำลังรีเซ็ต...</>
                  ) : (
                    <><RotateCcw size={14} /> ยืนยันรีเซ็ต</>
                  )}
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
                className="max-w-full max-h-[85vh] rounded-3xl border border-white/10 shadow-2xl object-contain bg-white" 
              />
              <button 
                onClick={() => setZoomedImage(null)}
                className="h-12 px-6 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-[14px] backdrop-blur-xl transition-all border border-white/10"
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
