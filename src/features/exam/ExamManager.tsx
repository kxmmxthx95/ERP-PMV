// src/features/exam/ExamManager.tsx
import { useState, useMemo, useEffect, useRef, useCallback, lazy, Suspense, type MouseEvent as ReactMouseEvent } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { collection, doc, getDocs, onSnapshot, query, serverTimestamp, where, writeBatch } from 'firebase/firestore';
import {
  ClipboardList, Plus, Play, Square, Trash2, Eye,
  X, Pencil,
  ShieldAlert, Users, CheckCircle2,
  BookOpen, Check,
  Trophy, TrendingUp, RotateCcw
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
  HiChevronUp,
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
  HiBell,
  HiLink,
  HiCog6Tooth,
  HiAcademicCap,
  HiOutlineQuestionMarkCircle,
  HiExclamationTriangle,
  HiPlus,
  HiMinus,
  HiArrowsPointingOut,
  HiArrowsPointingIn,
} from 'react-icons/hi2';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import type { IconType } from 'react-icons';
import { Skeleton } from '@/components/ui/skeleton';
import { IndeterminateProgress } from '@/components/ui/progress';
import StudentAvatar from '@/features/students/components/StudentAvatar';
import { StudentExamScoreDetailDrawer } from '@/features/exam/components/StudentExamScoreDetailDrawer';
import { StudentRoomScorePanel } from '@/features/exam/components/StudentRoomScorePanel';
import { ExamManualGradingDrawer } from '@/features/exam/components/ExamManualGradingDrawer';
import ExamRoomsMobileFilterDrawer from '@/features/exam/components/ExamRoomsMobileFilterDrawer';
import ActiveExamRoomsDrawer from '@/features/exam/components/ActiveExamRoomsDrawer';
import ExamMobileBrowse from '@/features/exam/components/ExamMobileBrowse';
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { matchesTeacherIdentity, buildTeacherIdentityKeys, resolveTeacherFromAuth, resolveCanonicalTeacherId } from '@/lib/teachers/teacherIdentity';
import { useTeacherManager } from '@/features/teachers/hooks/useTeacherManager';
import { resolveQuestionSetCreatorName } from '@/features/questionBank/utils/questionSetCreatorName';
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
import { useBrowseVisibleDepartments } from '@/hooks/useBrowseVisibleDepartments';
import { shouldCountDepartment } from '@/lib/departments/homeDepartment';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import type { ExamRoom, ExamAttempt, ExamScoreOverrideRequest, GradeScoreType, GradeBookSubjectLink, ScoreCollectionType } from '@/types/exam';
import { rawPointsToPercent } from '@/types/grades';
import { formatScorePoints, resolveAttemptScoreDisplay } from '@/lib/exam/examRoomScoring';
import { resolveExamRoomIconSrc } from '@/lib/exam/examRoomIcons';
import {
  SCORE_COLLECTION_CONFIG,
  SCORE_COLLECTION_FILTER_OPTIONS,
  SCORE_COLLECTION_ICONS,
  SCORE_COLLECTION_PLATE_LABELS,
  SCORE_COLLECTION_TYPES,
  isRoomScoreCollectionUnset,
  resolveRoomScoreCollectionType,
  type ScoreCollectionFilterKey,
} from '@/lib/exam/scoreCollection';
import { PORTAL_MENU_TITLES } from '@/lib/portalMenu';
import { DRAWER_HEADER_ICON_BTN, DRAWER_HEADER_RIGHT_ACTIONS } from '@/lib/drawerHeaderBtn';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { DEPARTMENT_CONFIG, SUBJECT_GROUP_CONFIG, SUBJECT_SUBGROUP_CONFIG, type Department, type SubjectGroupId } from '@/types/curriculum';
import { useClassroomManager } from '@/features/classes/hooks/useClassroomManager';
import { useCurriculum } from '@/hooks/useCurriculum';
import { useCurriculumVersioned } from '@/hooks/useCurriculumVersioned';
import { useActiveAcademicYear } from '@/hooks/useActiveAcademicYear';
import { getSubjectColors, SubjectIcon, subjectIconGradient } from '@/features/curriculum/utils/subjectVisual';
import { useTeachingManager } from '@/hooks/useTeachingManager';
import { QUESTION_SETS_COL, useQuestionSetBank } from '@/hooks/useQuestionSetBank';
import type { Question, QuestionSet } from '@/types/questionBank';
import { getDefaultQuestionPoints, resolveQuestionPoints, sumSelectedQuestionPoints } from '@/lib/exam/questionPoints';
import {
  deriveSetOrder,
  getExamRoomRoundTotalPoints,
  isExamRoomQuestionsConfigured,
  isUsableRoundConfig,
  buildUnlimitedRoundKeys,
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
const QuestionSetStepSimulator = lazy(
  () => import('@/features/questionBank/components/QuestionSetStepSimulator'),
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

const EXAM_ROOM_QUESTIONS_REQUIRED_MESSAGE =
  'กรุณาเปิดแท็บ「ข้อสอบ」เลือกชุดข้อสอบของรอบที่จะเปิด แล้วกด「บันทึก」ก่อนเปิดห้องสอบ (บันทึกทีละรอบ)';

const EXAM_STATUS_FILTER_COLORS: Record<'all' | ExamRoom['status'], string> = {
  all: '#2563eb',
  upcoming: '#f59e0b',
  active: '#059669',
  closed: '#94a3b8',
};

const TAKERS_SKELETON_ROWS = 6;

/** Vertical + horizontal inset so card shadows are not clipped by scroll edges. */
const PORTAL_CARD_LIST_PADDING = 'px-1.5 pt-1.5 pb-4 sm:px-2';

const MOBILE_STUDENT_CARD_OUTER = 'px-0.5 py-0.5';

const MOBILE_STUDENT_CARD_SHELL =
  'rounded-2xl border border-border bg-card p-3';

// Canonical portal data-table tokens (GradeTable / ExamRoomScoreTable)
const TABLE_SHELL = 'rounded-2xl border border-border bg-card overflow-hidden';
const TABLE_HEADER_CELL = 'text-[13px] font-black text-foreground font-sukhumvit whitespace-nowrap';
const TABLE_HEADER_ROW = 'grid gap-3 border-b border-border bg-background px-4 py-3';
const TABLE_ROW =
  'grid gap-3 items-center border-b border-border px-4 py-3 transition-colors last:border-b-0 hover:bg-muted/40';

/** Badge สีตาม % คะแนน — ≥80 เขียว · ≥50 เหลือง · ต่ำกว่าแดง */
function examScorePercentBadgeClass(pct: number | null | undefined): string {
  if (pct == null || !Number.isFinite(pct)) return 'bg-muted text-muted-foreground';
  if (pct >= 80) return 'bg-emerald-500/10 text-emerald-600';
  if (pct >= 50) return 'bg-amber-500/10 text-amber-600';
  return 'bg-destructive/10 text-destructive';
}

const DRAWER_TAKERS_TABLE_GRID =
  'minmax(0, 2.2fr) minmax(5.5rem, 0.85fr) minmax(5rem, 0.85fr) minmax(5.5rem, 0.9fr)';

type DrawerListLayout = 'cards' | 'table';
type DrawerSortDir = 'asc' | 'desc';
type DrawerSummarySortKey = 'name' | 'best' | `round:${number}`;
type DrawerTakersSortKey = 'name' | 'status' | 'score' | 'round';

function compareNullableScore(a: number | null, b: number | null, dir: DrawerSortDir): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return dir === 'desc' ? b - a : a - b;
}

function DrawerTableSortHeader({
  label,
  title,
  active,
  dir,
  onClick,
  align = 'center',
}: {
  label: string;
  title?: string;
  active: boolean;
  dir: DrawerSortDir;
  onClick: () => void;
  align?: 'left' | 'center';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title ?? `${label} — คลิกเรียง`}
      aria-label={`${label} — เรียงลำดับ`}
      className={cn(
        TABLE_HEADER_CELL,
        'inline-flex max-w-full min-w-0 items-center gap-0.5 rounded-md px-0.5 py-0.5 transition-colors hover:bg-muted/60',
        align === 'center' ? 'justify-center' : 'justify-start',
        active && 'text-primary',
      )}
    >
      <span className="min-w-0 truncate">{label}</span>
      <span className="inline-flex shrink-0 flex-col leading-none" aria-hidden>
        <HiChevronUp
          className={cn(
            '-mb-0.5 h-3 w-3',
            active && dir === 'asc' ? 'text-primary' : 'text-muted-foreground/35',
          )}
        />
        <HiChevronDown
          className={cn(
            '-mt-0.5 h-3 w-3',
            active && dir === 'desc' ? 'text-primary' : 'text-muted-foreground/35',
          )}
        />
      </span>
    </button>
  );
}

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
    <div className={cn('min-w-0 w-full', className)}>
      <div className="relative w-full">
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

type RoundDraftSource = {
  questionSetId: string;
  questionIds: string[];
  questionSetByQuestionId?: Record<string, string>;
  questionPoints?: Record<string, number>;
};

function toRoundDraftEntry(v: RoundDraftSource): RoundDraftEntry {
  const mapped = v.questionSetByQuestionId ?? Object.fromEntries(
    v.questionIds.map((qid) => [qid, v.questionSetId]),
  );
  return {
    questionSetId: v.questionSetId,
    setOrder: deriveSetOrder(v.questionIds, mapped, v.questionSetId),
    questionIds: new Set(v.questionIds),
    questionSetByQuestionId: mapped,
    questionPoints: { ...(v.questionPoints ?? {}) },
  };
}

/**
 * Same fallback chain as roomRoundFingerprint / getRoundQuestionConfigForRound:
 * roundQuestions[N] → unlimited ∞ → top-level (round 1 only).
 */
function resolveRoundDraftSource(room: ExamRoom, rk: string): RoundDraftSource | undefined {
  const unlimited = (room.settings?.maxAttempts ?? 1) === 0;
  const saved = room.roundQuestions?.[rk]
    ?? (unlimited ? room.roundQuestions?.['∞'] : undefined);
  if (saved && isUsableRoundConfig(saved)) {
    return {
      questionSetId: saved.questionSetId,
      questionIds: saved.questionIds ?? [],
      questionSetByQuestionId: saved.questionSetByQuestionId,
      questionPoints: saved.questionPoints,
    };
  }
  if (
    rk === '1'
    && room.questionSetId?.trim()
    && (room.selectedQuestionIds?.length ?? 0) > 0
  ) {
    return {
      questionSetId: room.questionSetId,
      questionIds: room.selectedQuestionIds!,
    };
  }
  return undefined;
}

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

function roundDraftFingerprint(draft: RoundDraftEntry | undefined): string {
  if (!draft) return '';
  const order = draft.setOrder?.length
    ? draft.setOrder
    : deriveSetOrder(draft.questionIds, draft.questionSetByQuestionId, draft.questionSetId);
  return JSON.stringify({
    order,
    ids: Array.from(draft.questionIds).sort(),
    map: Object.fromEntries(Object.entries(draft.questionSetByQuestionId).sort(([a], [b]) => a.localeCompare(b))),
    pts: Object.fromEntries(Object.entries(draft.questionPoints).sort(([a], [b]) => a.localeCompare(b))),
  });
}

function roomRoundFingerprint(room: ExamRoom, rk: string): string {
  const unlimited = (room.settings?.maxAttempts ?? 1) === 0;
  const saved = room.roundQuestions?.[rk]
    ?? (unlimited ? room.roundQuestions?.['∞'] : undefined);
  if (saved) {
    const map = saved.questionSetByQuestionId
      ?? Object.fromEntries(saved.questionIds.map((qid) => [qid, saved.questionSetId]));
    const pts = saved.questionPoints ?? {};
    return JSON.stringify({
      order: deriveSetOrder(saved.questionIds, map, saved.questionSetId),
      ids: [...saved.questionIds].sort(),
      map: Object.fromEntries(Object.entries(map).sort(([a], [b]) => a.localeCompare(b))),
      pts: Object.fromEntries(Object.entries(pts).sort(([a], [b]) => a.localeCompare(b))),
    });
  }
  if ((rk === '1' || rk === '∞') && room.questionSetId && room.selectedQuestionIds?.length) {
    const map = Object.fromEntries(
      room.selectedQuestionIds.map((qid) => [qid, room.questionSetId as string]),
    );
    return JSON.stringify({
      order: deriveSetOrder(room.selectedQuestionIds, map, room.questionSetId),
      ids: [...room.selectedQuestionIds].sort(),
      map: Object.fromEntries(Object.entries(map).sort(([a], [b]) => a.localeCompare(b))),
      pts: {},
    });
  }
  return '';
}

/** บันทึกชุดข้อสอบของรอบ — ใช้ร่วมทั้งหน้า detail และ drawer */
async function saveRoomRoundQuestions(
  room: ExamRoom,
  attempts: ExamAttempt[],
  onUpdateRoom: (roomId: string, data: Partial<ExamRoom>) => Promise<void>,
  entry: {
    roundKey: string;
    questionSetId: string;
    questionIds: string[];
    questionSetByQuestionId: Record<string, string>;
    questionPoints: Record<string, number>;
    totalPoints: number;
  },
) {
  const { roundKey, questionSetId, questionIds, questionSetByQuestionId, questionPoints, totalPoints } = entry;
  const roundNum = normalizeExamRound(roundKey);
  if (attempts.some((att) => normalizeExamRound(att.round) === roundNum)) {
    toast.error('ไม่สามารถแก้ไขข้อสอบรอบนี้ได้ เนื่องจากมีนักเรียนทำข้อสอบไปแล้ว');
    return;
  }

  const roundQuestions = {
    ...(room.roundQuestions ?? {}),
    [roundKey]: { questionSetId, questionIds, questionSetByQuestionId, questionPoints, totalPoints },
  };
  // Mirror into top-level legacy fields for round "1"
  const isFirstRound = roundKey === '1';
  await onUpdateRoom(room.id, {
    ...(isFirstRound ? { questionSetId, selectedQuestionIds: questionIds, questionCount: questionIds.length, totalPoints } : {}),
    roundQuestions,
  });
}

function QuestionsPanel({
  room,
  attempts,
  onSave,
  onContentClick,
  mobileBankDrawerOpen = false,
  onMobileBankDrawerOpenChange,
  compact = false,
  fillParent = false,
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
  /** โหมดคอลัมน์เดียวสำหรับพื้นที่แคบ (drawer) — สลับคลัง/ชุดที่เลือกในตัวเอง */
  compact?: boolean;
  /** เติมความสูง parent (drawer ขยาย) — ไม่ล็อก h-[calc(100dvh-…)] */
  fillParent?: boolean;
}) {
  const maxAttempts = room.settings?.maxAttempts ?? 1;

  // Rounds that already have student attempts — editing questions for these is blocked
  const roundsWithAttempts = useMemo(() => {
    const set = new Set<number>();
    attempts.forEach((att) => set.add(normalizeExamRound(att.round)));
    return set;
  }, [attempts]);

  // Per-round selection state (local, synced from saved room data)
  const [roundDraft, setRoundDraft] = useState<Record<string, RoundDraftEntry>>(() => {
    const init: Record<string, RoundDraftEntry> = {};
    const seedKeys = new Set<string>();
    if (room.roundQuestions) {
      for (const k of Object.keys(room.roundQuestions)) {
        if (k === '∞') continue;
        seedKeys.add(k);
      }
    }
    seedKeys.add('1');
    if (maxAttempts === 0) {
      for (const k of buildUnlimitedRoundKeys(room)) seedKeys.add(k);
    } else {
      for (let i = 1; i <= maxAttempts; i++) seedKeys.add(String(i));
    }
    for (const k of seedKeys) {
      const src = resolveRoundDraftSource(room, k);
      if (src) init[k] = toRoundDraftEntry(src);
    }
    return init;
  });

  /** Extra empty slots from 「+」 — local only until save. Unlimited mode only. */
  const [manualMaxRound, setManualMaxRound] = useState(0);

  const baseUnlimitedMax = useMemo(() => {
    if (maxAttempts !== 0) return 1;
    return Number(buildUnlimitedRoundKeys(room).at(-1) ?? 1);
  }, [maxAttempts, room.completedRounds, room.currentRound, room.roundQuestions]);

  const roundKeys: string[] = useMemo(() => {
    if (maxAttempts === 0) {
      let maxN = Math.max(1, baseUnlimitedMax, manualMaxRound);
      for (const key of Object.keys(roundDraft)) {
        if (key === '∞') continue;
        const n = Number(key);
        if (Number.isFinite(n) && n > maxN) maxN = n;
      }
      return Array.from({ length: maxN }, (_, i) => String(i + 1));
    }
    return Array.from({ length: maxAttempts }, (_, i) => String(i + 1));
  }, [maxAttempts, baseUnlimitedMax, manualMaxRound, roundDraft]);

  // Fill empty draft slots from room (∞ / legacy) when room updates — never overwrite dirty edits
  useEffect(() => {
    setRoundDraft((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const rk of roundKeys) {
        const existing = next[rk];
        if (existing && existing.questionIds.size > 0) continue;
        const src = resolveRoundDraftSource(room, rk);
        if (!src || (src.questionIds?.length ?? 0) === 0) continue;
        next[rk] = toRoundDraftEntry(src);
        changed = true;
      }
      return changed ? next : prev;
    });
  }, [room, roundKeys]);

  // Active round tab
  const [activeRound, setActiveRound] = useState<string>(() => roundKeys[0] ?? '1');

  const canRemoveLastExtraRound = useMemo(() => {
    if (maxAttempts !== 0) return false;
    const last = Number(roundKeys[roundKeys.length - 1] ?? 1);
    if (!Number.isFinite(last) || last <= baseUnlimitedMax) return false;
    if (roundsWithAttempts.has(last)) return false;
    const rk = String(last);
    const draft = roundDraft[rk];
    if (draft && draft.questionIds.size > 0) return false;
    if (isUsableRoundConfig(room.roundQuestions?.[rk])) return false;
    return true;
  }, [
    maxAttempts,
    roundKeys,
    baseUnlimitedMax,
    roundsWithAttempts,
    roundDraft,
    room.roundQuestions,
  ]);

  const addEmptyRound = () => {
    if (maxAttempts !== 0) return;
    const next = Math.max(...roundKeys.map(Number), baseUnlimitedMax, 0) + 1;
    setManualMaxRound(next);
    setActiveRound(String(next));
  };

  const removeLastExtraRound = () => {
    if (!canRemoveLastExtraRound) return;
    const last = roundKeys[roundKeys.length - 1]!;
    const lastN = Number(last);
    setRoundDraft((prev) => {
      if (!(last in prev)) return prev;
      const next = { ...prev };
      delete next[last];
      return next;
    });
    setManualMaxRound(Math.max(0, lastN - 1));
    if (activeRound === last) setActiveRound(String(lastN - 1));
  };

  // Ensure activeRound stays valid when maxAttempts / roundKeys change
  useEffect(() => {
    if (activeRound === '∞') {
      setActiveRound('1');
      return;
    }
    if (!roundKeys.includes(activeRound)) setActiveRound(roundKeys[0] ?? '1');
  }, [roundKeys, activeRound]);

  const activeRoundHasAttempts = roundsWithAttempts.has(normalizeExamRound(activeRound));

  useEffect(() => {
    setExpandedPartSetId(null);
  }, [activeRound]);

  // Per-round: one whole question set (all questions in the set)
  const [selectingSetId, setSelectingSetId] = useState<string | null>(null);
  const [expandedPartSetId, setExpandedPartSetId] = useState<string | null>(null);
  const [pdfPreview, setPdfPreview] = useState<{ url: string; title: string } | null>(null);
  const [simulatingSet, setSimulatingSet] = useState<QuestionSet | null>(null);
  const [filterGroup, setFilterGroup] = useState<SubjectGroupId | 'all'>('all');
  const [filterDepartment, setFilterDepartment] = useState<Department | 'all'>('all');
  const [filterGradeLevel, setFilterGradeLevel] = useState<string | 'all'>('all');
  const failedHydrationRef = useRef<Set<string>>(new Set());

  const { questionSets, isLoading: setsLoading, filterQuestionSets } = useQuestionSetBank();
  const { teachers } = useTeacherManager();

  const [isLgUp, setIsLgUp] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 1024px)').matches : true,
  );
  const [compactPane, setCompactPane] = useState<'selected' | 'bank'>('selected');
  const isWide = isLgUp && !compact;

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
  /** fingerprint หลังเซฟสำเร็จในเซสชันนี้ — ซ่อนปุ่มทันทีแม้ room ยัง sync ไม่ทัน */
  const [savedDraftFp, setSavedDraftFp] = useState<Record<string, string>>({});
  const isRoundDirty = (rk: string) => {
    const draft = roundDraft[rk];
    if (!draft || draft.questionIds.size === 0) return false;
    const fp = roundDraftFingerprint(draft);
    if (savedDraftFp[rk] === fp) return false;
    return fp !== roomRoundFingerprint(room, rk);
  };

  /** บันทึกแล้วหรือมี attempts → ซ่อนลบ + lock คลัง (แก้รอบนั้นไม่ได้) */
  const isRoundLocked = (rk: string) => {
    if (roundsWithAttempts.has(normalizeExamRound(rk))) return true;
    if (isUsableRoundConfig(room.roundQuestions?.[rk])) return true;
    const draft = roundDraft[rk];
    if (
      savedDraftFp[rk]
      && draft
      && draft.questionIds.size > 0
      && roundDraftFingerprint(draft) === savedDraftFp[rk]
    ) {
      return true;
    }
    if (rk === '1') {
      const rq = room.roundQuestions ?? {};
      const hasNumericSaved = Object.keys(rq).some(
        (k) => k !== '∞' && isUsableRoundConfig(rq[k]),
      );
      if (!hasNumericSaved && isUsableRoundConfig(rq['∞'])) return true;
      if (
        !hasNumericSaved
        && !Object.values(rq).some(isUsableRoundConfig)
        && !!room.questionSetId?.trim()
        && (room.selectedQuestionIds?.length ?? 0) > 0
      ) {
        return true;
      }
    }
    return false;
  };
  const activeRoundLocked = isRoundLocked(activeRound);

  const showSaveForActiveRound =
    !activeRoundLocked
    && !!roundDraft[activeRound]
    && (isSaving === activeRound || isRoundDirty(activeRound));
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
        search: '',
        subjectGroup: filterGroup,
        department: filterDepartment,
        gradeLevel: filterGradeLevel,
      }),
    [filterQuestionSets, filterGroup, filterDepartment, filterGradeLevel],
  );

  const hasActiveBankFilters =
    filterGroup !== 'all' &&
    filterDepartment !== 'all' &&
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

  /**
   * ชุดที่ถูกใช้ใน "รอบอื่น" ของห้องนี้ (ไม่นับรอบที่กำลังแก้)
   * รวมทั้งที่บันทึกแล้ว (room.roundQuestions) และที่เลือกค้างใน draft — เตือนก่อนบันทึกได้
   */
  const usedSetRoundMap = useMemo(() => {
    const map = new Map<string, string[]>();
    const add = (rk: string, setId: string | undefined) => {
      if (!setId || rk === activeRound) return;
      const list = map.get(setId) ?? [];
      if (!list.includes(rk)) list.push(rk);
      map.set(setId, list);
    };

    for (const [rk, saved] of Object.entries(room.roundQuestions ?? {})) {
      const mapped =
        saved.questionSetByQuestionId ??
        Object.fromEntries(saved.questionIds.map((qid) => [qid, saved.questionSetId]));
      const order = deriveSetOrder(saved.questionIds, mapped, saved.questionSetId);
      for (const setId of order.length > 0 ? order : [saved.questionSetId]) add(rk, setId);
    }

    for (const rk of Object.keys(roundDraft)) {
      for (const setId of getDraftSetOrder(roundDraft[rk])) add(rk, setId);
    }

    return map;
  }, [room.roundQuestions, roundDraft, activeRound]);

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
    if (isRoundLocked(rk)) return;
    setRoundDraft(prev => {
      const round = prev[rk];
      if (!round) return prev;
      const nextPoints = { ...round.questionPoints };
      if (raw === '') {
        delete nextPoints[qid];
      } else {
        const parsed = Number(raw);
        if (!Number.isFinite(parsed)) return prev;
        nextPoints[qid] = Math.max(0, parsed);
      }
      return {
        ...prev,
        [rk]: {
          ...round,
          questionPoints: nextPoints,
        },
      };
    });
  };

  const openPdfPreview = (url: string, title: string) => {
    setPdfPreview({ url, title });
  };

  const clearRound = (rk: string) => {
    if (isRoundLocked(rk)) return;
    setRoundDraft(prev => {
      const next = { ...prev };
      delete next[rk];
      return next;
    });
  };

  const removeSetFromRound = (rk: string, setId: string) => {
    if (isRoundLocked(rk)) return;
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
    if (activeRoundLocked) return;
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
      const nextEntry: RoundDraftEntry = { ...draft, questionPoints };
      setRoundDraft((prev) => ({ ...prev, [rk]: nextEntry }));
      setSavedDraftFp((prev) => ({ ...prev, [rk]: roundDraftFingerprint(nextEntry) }));
      toast.success(`บันทึกข้อสอบรอบ ${rk} แล้ว`);
    } finally {
      setIsSaving(null);
    }
  };

  const getPersistedCount = (rk: string): number => {
    const src = resolveRoundDraftSource(room, rk);
    return src?.questionIds?.length ?? 0;
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
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg shrink-0 bg-blue-50 border border-blue-200">
          <HiCheckCircle className="w-3 h-3 text-blue-600 shrink-0" />
          <p className="text-[11px] font-black text-blue-700 font-sukhumvit">
            {setOrder.length} part · {totalCount} ข้อ · รวม {Math.round(totalPts)} คะแนน
          </p>
          {!isRoundLocked(rk) && (
            <button
              type="button"
              onClick={() => clearRound(rk)}
              className="ml-auto flex h-7 w-7 items-center justify-center rounded-full border border-rose-200 bg-white text-rose-500 transition-colors hover:bg-rose-50"
              title="ล้างทั้งหมด"
              aria-label="ล้างทั้งหมด"
            >
              <HiMiniTrash className="h-3.5 w-3.5" />
            </button>
          )}
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
                  'flex flex-col min-h-0 transition-all',
                  isExpanded
                    ? cn('rounded-2xl border border-primary/45 bg-card', isOnlyPart && 'flex-1')
                    : 'shrink-0',
                )}
              >
                <div
                  className={cn(
                    'relative flex items-center gap-2 px-3 py-3.5 pr-14 w-full transition-all',
                    isExpanded
                      ? 'rounded-t-2xl border-b border-border'
                      : 'rounded-lg bg-card border-[1.5px] border-primary/45',
                  )}
                >
                  <div className="relative h-11 w-11 shrink-0">
                    <div
                      className="flex h-full w-full items-center justify-center rounded-xl shadow-sm"
                      style={{
                        background: set
                          ? subjectIconGradient(set.subjectGroup)
                          : 'rgba(226,232,240,0.9)',
                      }}
                      aria-hidden
                    >
                      {set ? (
                        <SubjectIcon
                          subjectGroup={set.subjectGroup}
                          size={20}
                          className="text-white drop-shadow-sm"
                        />
                      ) : (
                        <span className="text-[11px] font-black font-sukhumvit text-slate-600">
                          {index + 1}
                        </span>
                      )}
                    </div>
                    {set?.examPdfUrl ? (
                      <button
                        type="button"
                        onClick={() => openPdfPreview(set.examPdfUrl!, set.title)}
                        className="absolute inset-0 z-10 flex items-center justify-center rounded-xl"
                        title="ดู PDF"
                        aria-label={`ดู PDF Part ${index + 1}`}
                      >
                        <span className="flex h-7 w-7 items-center justify-center rounded-full border border-white/50 bg-white/40 text-slate-500 shadow-lg backdrop-blur-md transition-colors hover:bg-white/60">
                          <HiEye className="h-3.5 w-3.5" />
                        </span>
                      </button>
                    ) : set && (set.questionCount ?? 0) > 0 ? (
                      <button
                        type="button"
                        onClick={() => setSimulatingSet(set)}
                        className="absolute inset-0 z-10 flex items-center justify-center rounded-xl"
                        title="จำลองการสอบ"
                        aria-label={`จำลอง Part ${index + 1}`}
                      >
                        <span className="flex h-7 w-7 items-center justify-center rounded-full border border-white/50 bg-white/40 text-slate-500 shadow-lg backdrop-blur-md transition-colors hover:bg-white/60">
                          <HiPlay className="h-3.5 w-3.5" />
                        </span>
                      </button>
                    ) : null}
                  </div>

                  <button
                    type="button"
                    onClick={() => toggleExpandedPart(setId)}
                    className="flex flex-1 min-w-0 items-center gap-3 text-left"
                    aria-expanded={isExpanded}
                  >
                    <div className="flex flex-1 min-w-0 flex-col gap-1.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-[12px] font-black font-sukhumvit text-slate-800 truncate">
                          {set?.title ?? 'ชุดข้อสอบ'}
                        </p>
                        {set?.examPdfUrl && (
                          <span className="text-[8px] font-black px-1.5 py-0.5 rounded-md bg-destructive text-white shrink-0">
                            PDF
                          </span>
                        )}
                      </div>
                      {grpCfg && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className="text-[9px] font-bold font-sarabun px-1.5 py-0.5 rounded-md"
                            style={{ color: grpCfg.color, background: grpCfg.bg }}
                          >
                            {set?.subjectGroup === 'social' ? 'สังคมศึกษาฯ' : grpCfg.name}
                          </span>
                        </div>
                      )}
                      {(() => {
                        const creator = set
                          ? resolveQuestionSetCreatorName(set, teachers)
                          : '';
                        return creator ? (
                          <p className="text-[9px] font-bold text-slate-600 font-sarabun truncate">
                            {creator}
                          </p>
                        ) : null;
                      })()}
                    </div>
                  </button>

                  <div className="absolute right-2.5 top-2.5 z-10 flex items-center gap-1">
                    {!isRoundLocked(rk) && (
                      <button
                        type="button"
                        onClick={() => {
                          if (expandedPartSetId === setId) setExpandedPartSetId(null);
                          removeSetFromRound(rk, setId);
                        }}
                        className="flex h-7 w-7 items-center justify-center rounded-full border border-border bg-card text-destructive transition-colors hover:bg-destructive/10"
                        title="ลบ part นี้"
                        aria-label={`ลบ Part ${index + 1}`}
                      >
                        <HiXMark className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="absolute bottom-2 right-2 z-10 flex flex-col items-end gap-1">
                    <span className="text-[8px] font-black px-1.5 py-0.5 rounded-md bg-primary/10 text-primary font-sukhumvit">
                      Part {index + 1}
                    </span>
                    <span className="inline-flex items-center rounded-full border border-white/40 bg-white/30 px-2 py-0.5 text-[9px] font-bold text-slate-700 shadow-sm ring-1 ring-black/5 backdrop-blur-xl font-sarabun">
                      {stats.count} ข้อ
                    </span>
                  </div>
                </div>

                {isExpanded && (
                  <div
                    className={cn(
                      'border-t border-border px-3 pb-3 pt-2 flex flex-col min-h-0 overflow-y-auto overscroll-y-contain scrollbar-hide',
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
                        const plain = questionPlainText(q.questionText);
                        return (
                          <div
                            key={q.id}
                            className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-2.5 py-2 mb-1.5 last:mb-0"
                          >
                            <span className="w-6 text-center text-[10px] font-black text-muted-foreground shrink-0 font-sukhumvit">
                              {qi + 1}
                            </span>
                            <p className="flex-1 min-w-0 text-[11px] font-sarabun text-foreground line-clamp-2 leading-snug">
                              {plain || `ข้อ ${qi + 1}`}
                            </p>
                            <label className="flex items-center gap-1 shrink-0">
                              <input
                                type="number"
                                min={0}
                                step={1}
                                value={draft.questionPoints[q.id] ?? ''}
                                onChange={(e) => updateQuestionPoint(rk, q.id, e.target.value)}
                                disabled={isRoundLocked(rk)}
                                className="w-14 h-8 rounded-lg border border-border bg-card px-1 text-center text-[11px] font-bold text-foreground outline-none focus:ring-2 focus:ring-primary/25 font-sukhumvit disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-muted"
                                aria-label={`คะแนนข้อ ${qi + 1}`}
                              />
                              <span className="text-[9px] text-muted-foreground font-sarabun hidden sm:inline">
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
      </div>
    );
  };

  const renderQuestionBank = () => (
    <div className="flex flex-col flex-1 min-h-0 gap-3">
      <div className="shrink-0 flex flex-col gap-3 px-1.5">
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
              เลือกตัวกรองครบเพื่อแสดงชุดข้อสอบ
            </p>
            <p className="mt-1 max-w-xs font-sarabun text-[11px] font-medium text-slate-400">
              ต้องเลือกกลุ่มสาระ แผนก และระดับชั้น
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
          const usedRounds = usedSetRoundMap.get(set.id);
          const isUsed = Boolean(usedRounds?.length);
          const isLoadingThis = selectingSetId === set.id;
          return (
            <div
              key={set.id}
              className={cn(
                'relative flex items-center gap-2 px-3 py-3.5 pr-14 rounded-lg w-full transition-all',
                selectedInRound
                  ? 'bg-card border-[1.5px] border-primary/45'
                  : isUsed
                    ? 'bg-amber-50/70 border-[1.5px] border-amber-400'
                    : 'bg-card border border-border',
              )}
            >
              <div className="relative h-11 w-11 shrink-0">
                <div
                  className="flex h-full w-full items-center justify-center rounded-xl shadow-sm"
                  style={{ background: subjectIconGradient(set.subjectGroup) }}
                  aria-hidden
                >
                  <SubjectIcon subjectGroup={set.subjectGroup} size={20} className="text-white drop-shadow-sm" />
                </div>
                {set.examPdfUrl ? (
                  <button
                    type="button"
                    onClick={() => openPdfPreview(set.examPdfUrl!, set.title)}
                    className="absolute inset-0 z-10 flex items-center justify-center rounded-xl"
                    title="ดู PDF"
                    aria-label={`ดู PDF ${set.title}`}
                  >
                    <span className="flex h-7 w-7 items-center justify-center rounded-full border border-white/50 bg-white/40 text-slate-500 shadow-lg backdrop-blur-md transition-colors hover:bg-white/60">
                      <HiEye className="h-3.5 w-3.5" />
                    </span>
                  </button>
                ) : (set.questionCount ?? 0) > 0 ? (
                  <button
                    type="button"
                    onClick={() => setSimulatingSet(set)}
                    className="absolute inset-0 z-10 flex items-center justify-center rounded-xl"
                    title="จำลองการสอบ"
                    aria-label={`จำลองการสอบ ${set.title}`}
                  >
                    <span className="flex h-7 w-7 items-center justify-center rounded-full border border-white/50 bg-white/40 text-slate-500 shadow-lg backdrop-blur-md transition-colors hover:bg-white/60">
                      <HiPlay className="h-3.5 w-3.5" />
                    </span>
                  </button>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => void selectQuestionSetForRound(set.id)}
                disabled={isLoadingThis}
                className="flex flex-1 min-w-0 items-center gap-3 text-left disabled:cursor-not-allowed"
              >
                <div className="flex flex-1 min-w-0 flex-col gap-1.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="text-[12px] font-black font-sukhumvit text-slate-800 truncate">{set.title}</p>
                    {set.examPdfUrl && (
                      <span className="text-[8px] font-black px-1.5 py-0.5 rounded-md bg-destructive text-white shrink-0">PDF</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[9px] font-bold font-sarabun px-1.5 py-0.5 rounded-md"
                      style={{ color: grpCfg?.color ?? '#6b7280', background: grpCfg?.bg ?? 'rgba(226,232,240,0.5)' }}>
                      {set.subjectGroup === 'social' ? 'สังคมศึกษาฯ' : (grpCfg?.name ?? set.subjectGroup)}
                    </span>
                  </div>
                  {(() => {
                    const creator = resolveQuestionSetCreatorName(set, teachers);
                    return creator ? (
                      <p className="text-[9px] font-bold text-slate-600 font-sarabun truncate">
                        {creator}
                      </p>
                    ) : null;
                  })()}
                </div>
              </button>
              {isLoadingThis ? (
                <div className="absolute right-2.5 top-1/2 z-10 w-5 h-5 -translate-y-1/2">
                  <IndeterminateProgress />
                </div>
              ) : (
                <div className="absolute right-2.5 top-1/2 z-10 flex -translate-y-1/2 items-center gap-1">
                  {isUsed && (
                    <HiExclamationTriangle
                      className="h-5 w-5 text-amber-500"
                      title={`เคยใช้ในรอบ ${usedRounds!.join(', ')}`}
                    />
                  )}
                  {selectedInRound && <HiCheckCircle className="h-5 w-5 text-primary" />}
                </div>
              )}
              <span className="absolute bottom-2 right-2 z-10 inline-flex items-center rounded-full border border-white/40 bg-white/30 px-2 py-0.5 text-[9px] font-bold text-slate-700 shadow-sm ring-1 ring-black/5 backdrop-blur-xl font-sarabun">
                {set.questionCount} ข้อ
              </span>
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

  const mobileEmptyBankHint = isWide
    ? 'เลือกชุดข้อสอบจากคลังด้านซ้าย — เพิ่มได้หลาย part'
    : compact
      ? 'กดปุ่ม「คลังข้อสอบ」ด้านบนเพื่อเพิ่ม part'
      : 'กดไอคอนหนังสือมุมขวาบนเพื่อเปิดคลังและเพิ่ม part';

  return (
    <div
      className={cn(
        'flex flex-col flex-1 min-h-0 gap-3 lg:gap-4',
        !compact && !fillParent && 'h-[calc(100dvh-10rem)] max-h-[calc(100dvh-10rem)]',
      )}
      onClick={onContentClick}
    >
      {/* เลือกรอบการสอบ — โชว์เสมอ (รอบเดียวก็รู้ว่ากำลังแก้รอบไหน) */}
      <div className={cn('flex w-full shrink-0', HEADER_ICON_BTN_GROUP)}>
        <div className="relative min-w-0 flex-1">
          <select
            value={activeRound}
            onChange={(e) => setActiveRound(e.target.value)}
            className={cn(
              EXAM_FILTER_SELECT_CLASS,
              'w-full appearance-none bg-white border-slate-200 text-slate-900 pl-3 pr-9',
            )}
            aria-label="เลือกรอบการสอบ"
          >
            {roundKeys.map((rk) => (
              <option key={rk} value={rk}>
                {`รอบ ${rk}`}
              </option>
            ))}
          </select>
          <HiChevronDown
            className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500"
            aria-hidden
          />
        </div>
        {maxAttempts === 0 && (
          <>
            {canRemoveLastExtraRound && (
              <button
                type="button"
                onClick={removeLastExtraRound}
                className={HEADER_ICON_BTN}
                title="ลบรอบว่าง"
                aria-label="ลบรอบว่าง"
              >
                <HiMinus size={16} />
              </button>
            )}
            <button
              type="button"
              onClick={addEmptyRound}
              className={HEADER_ICON_BTN}
              title="เพิ่มรอบ"
              aria-label="เพิ่มรอบ"
            >
              <HiPlus size={16} />
            </button>
          </>
        )}
      </div>

      {/* compact: สลับคลัง ↔ ชุดที่เลือก ในพื้นที่เดียว */}
      {compact && (
        <div className="grid shrink-0 grid-cols-2 gap-2">
          {(['selected', 'bank'] as const).map((pane) => (
            <button
              key={pane}
              type="button"
              onClick={() => setCompactPane(pane)}
              className={cn(
                'h-9 rounded-lg border text-[11px] font-black font-sukhumvit transition-colors',
                compactPane === pane
                  ? 'border-slate-800 bg-slate-900 text-white'
                  : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100',
              )}
            >
              {pane === 'selected' ? 'ชุดที่เลือก' : 'คลังข้อสอบ'}
            </button>
          ))}
        </div>
      )}

      {/* Two-card layout — independent scroll per card */}
      <div className="flex flex-1 min-h-0 flex-col lg:flex-row gap-4 items-stretch overflow-hidden">

        {/* ── Card 1: Bank browser (desktop only; mobile uses header book + drawer) ── */}
        <div
          className={cn(
            'flex-1 min-w-0 flex-col min-h-0 overflow-hidden',
            compact
              ? (compactPane === 'bank' ? 'flex gap-2 p-0' : 'hidden')
              : 'hidden lg:flex gap-3 rounded-2xl p-4',
          )}
          style={compact ? {
            opacity: activeRoundLocked ? 0.5 : 1,
            pointerEvents: activeRoundLocked ? 'none' : undefined,
          } : {
            background: 'rgba(248,250,252,0.8)',
            border: '1px solid rgba(226,232,240,0.6)',
            opacity: activeRoundLocked ? 0.5 : 1,
            pointerEvents: activeRoundLocked ? 'none' : undefined,
          }}
        >
          {!compact && (
            <div className="flex shrink-0 items-center justify-between">
              <span
                className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-800 bg-slate-900 px-3 text-[11px] font-black font-sukhumvit text-white"
              >
                คลังข้อสอบ
              </span>
            </div>
          )}

          <div className="flex flex-1 min-h-0 flex-col overflow-hidden">
            {renderQuestionBank()}
          </div>
        </div>

        {/* ── Card 2: Selected question set per round ── */}
        <div
          className={cn(
            'flex-1 min-w-0 flex-col min-h-0 overflow-hidden',
            compact
              ? (compactPane !== 'selected' ? 'hidden' : 'flex gap-2 p-0')
              : 'flex gap-3 rounded-2xl p-4',
          )}
          style={compact ? undefined : {
            background: 'rgba(255,255,255,0.9)',
            border: '1px solid rgba(226,232,240,0.6)',
          }}
        >
          <div className={cn(
            'flex items-center shrink-0',
            compact ? 'hidden' : 'justify-start',
          )}>
            <span
              className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg border border-slate-800 bg-slate-900 px-3 text-[11px] font-black font-sukhumvit text-white"
            >
              ชุดที่เลือก
            </span>
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

          <div className="shrink-0 space-y-1.5 pt-2">
            {roundKeys.length > 1 && (
              <p className="text-center text-[9px] font-bold text-slate-400 font-sarabun">
                {roundKeys.filter(rk => !!roundDraft[rk]?.questionIds.size).length}/{roundKeys.length} รอบตั้งค่าแล้ว
              </p>
            )}
            {activeRoundHasAttempts ? (
              <p className="text-center text-[10px] font-black text-rose-600 font-sukhumvit">
                มีนักเรียนทำข้อสอบรอบนี้แล้ว ไม่สามารถแก้ไขได้
              </p>
            ) : activeRoundLocked ? (
              <p className="flex items-center justify-center gap-1.5 text-center text-[11px] font-black text-emerald-600 font-sukhumvit">
                <HiCheck className="w-3.5 h-3.5" />
                บันทึกแล้ว ไม่สามารถแก้ไขได้
              </p>
            ) : showSaveForActiveRound ? (
              <button
                type="button"
                onClick={() => { requestSaveRound(activeRound); }}
                disabled={isSaving === activeRound || !roundDraft[activeRound]}
                className="flex h-10 w-full items-center justify-center gap-1.5 rounded-xl text-[12px] font-black transition-all font-sukhumvit border border-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: 'linear-gradient(135deg,#0f172a,#334155)',
                  color: '#fff',
                  opacity: (isSaving === activeRound || !roundDraft[activeRound]) ? 0.5 : 1,
                }}
              >
                <HiArrowDownTray className="w-3.5 h-3.5" />
                {isSaving === activeRound ? 'กำลังบันทึก...' : 'บันทึก'}
              </button>
            ) : roundDraft[activeRound]?.questionIds.size ? (
              <p className="flex items-center justify-center gap-1.5 text-center text-[11px] font-black text-emerald-600 font-sukhumvit">
                <HiCheck className="w-3.5 h-3.5" />
                บันทึกแล้ว
              </p>
            ) : null}
          </div>
        </div>
      </div>

      {/* Mobile: side drawer for question bank */}
      <Drawer
        open={mobileBankDrawerOpen && !isLgUp && !compact}
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
              opacity: activeRoundLocked ? 0.5 : 1,
              pointerEvents: activeRoundLocked ? 'none' : undefined,
            }}
          >
            {renderQuestionBank()}
          </div>
        </DrawerContent>
      </Drawer>

      {/* Desktop: PDF side panel from left (no overlay — score panel stays interactive) */}
      {pdfPreview && isWide && (
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
      <Dialog open={!!pdfPreview && !isWide} onOpenChange={(open) => !open && setPdfPreview(null)}>
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

      {simulatingSet && (
        <Suspense fallback={null}>
          <QuestionSetStepSimulator
            set={simulatingSet}
            open={!!simulatingSet}
            onClose={() => setSimulatingSet(null)}
          />
        </Suspense>
      )}
    </div>
  );
}

// ── Score Settings Panel ──────────────────────────────────────────────────────

const AUTO_SAVE_DEBOUNCE_MS = 500;

function AutoSaveStatus({ isSaving, saved }: { isSaving: boolean; saved: boolean }) {
  if (!isSaving && !saved) return null;
  return (
    <p className="text-center text-[11px] font-bold font-sukhumvit text-slate-400">
      {isSaving ? 'กำลังบันทึก…' : 'บันทึกแล้ว'}
    </p>
  );
}

function sameSortedIds(a: string[], b: string[]) {
  if (a.length !== b.length) return false;
  const sa = a.toSorted();
  const sb = b.toSorted();
  return sa.every((id, i) => id === sb[i]);
}

function ScoreSettingsPanel({ room, onSave }: {
  room: ExamRoom;
  onSave: (subjects: GradeBookSubjectLink[], scoreType: GradeScoreType) => Promise<void>;
}) {
  const { user, userData, role } = useAuth();
  const { teachers } = useTeacherManager();
  const { classes, allClasses } = useClassroomManager();
  const { subjects: legacySubjects } = useCurriculum();
  const { versions, coursesByVersion, loadCoursesForVersion } = useCurriculumVersioned();

  const canViewAllSubjects = role === 'admin' || role === 'sysadmin';
  const myTeacher = useMemo(
    () => (user?.uid ? resolveTeacherFromAuth(user.uid, teachers) : null),
    [user?.uid, teachers],
  );
  const teacherIdentityKeys = useMemo(
    () => buildTeacherIdentityKeys(user?.uid ?? '', myTeacher),
    [user?.uid, myTeacher],
  );
  const currentLinkerId = useMemo(() => {
    if (myTeacher?.id) return myTeacher.id;
    return resolveCanonicalTeacherId(user?.uid, teachers) || (user?.uid ?? '');
  }, [myTeacher, user?.uid, teachers]);

  const selfPhotoURL = useMemo(() => {
    const fromUserData = typeof userData?.photoURL === 'string' ? userData.photoURL.trim() : '';
    if (fromUserData) return fromUserData;
    const fromAuth = typeof user?.photoURL === 'string' ? user.photoURL.trim() : '';
    return fromAuth || '';
  }, [userData?.photoURL, user?.photoURL]);

  const selfDisplayName = useMemo(() => {
    const fromTeacher = String(myTeacher?.name || '').trim();
    if (fromTeacher) return fromTeacher;
    const fromUserData = String(userData?.displayName || userData?.name || '').trim();
    if (fromUserData) return fromUserData;
    return String(user?.displayName || '').trim();
  }, [myTeacher?.name, userData?.displayName, userData?.name, user?.displayName]);

  const initialLinks = useMemo((): GradeBookSubjectLink[] => {
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
  }, [room.settings]);

  const initialLinkedIds = useMemo(() => initialLinks.map((s) => s.subjectId), [initialLinks]);

  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>(initialLinkedIds);
  const [linkedByBySubjectId, setLinkedByBySubjectId] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    initialLinks.forEach((s) => {
      if (s.linkedByTeacherId) map[s.subjectId] = s.linkedByTeacherId;
    });
    return map;
  });
  const [selectedScoreType] = useState<GradeScoreType>(
    room.settings?.gradeBookScoreType ?? 'midterm'
  );
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pendingToggle, setPendingToggle] = useState<{
    subjectId: string;
    subjectName: string;
    nextSelected: boolean;
  } | null>(null);
  const maxLinkedSubjects = 3;
  const lastSavedIdsRef = useRef<string[]>(initialLinkedIds);
  const lastSavedLinkedByRef = useRef<Record<string, string>>(linkedByBySubjectId);
  const suppressDebounceRef = useRef(true);
  const savedFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flashSaved = useCallback(() => {
    setSaved(true);
    if (savedFlashTimerRef.current) clearTimeout(savedFlashTimerRef.current);
    savedFlashTimerRef.current = setTimeout(() => setSaved(false), 2000);
  }, []);

  useEffect(() => () => {
    if (savedFlashTimerRef.current) clearTimeout(savedFlashTimerRef.current);
  }, []);

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

  type SubjectOption = Subject & {
    semesters: Array<1 | 2>;
    assignedTeacherIds: string[];
    hasUnassignedTeacher: boolean;
  };

  // Build subjects list from enrolledCourses across semester 1 + 2.
  const subjects = useMemo((): SubjectOption[] => {
    if (!classRoom) return [];
    if (relatedClassRooms.length === 0) return [];

    const enrolledMap = new Map<string, {
      semesters: Set<1 | 2>;
      teacherIds: Set<string>;
      hasUnassignedTeacher: boolean;
    }>();
    relatedClassRooms.forEach((cls) => {
      (cls.enrolledCourses ?? []).forEach((ec) => {
        if (!ec.subjectId) return;
        const sem = (ec.semester ?? cls.semester) as 1 | 2;
        const prev = enrolledMap.get(ec.subjectId) ?? {
          semesters: new Set<1 | 2>(),
          teacherIds: new Set<string>(),
          hasUnassignedTeacher: false,
        };
        if (sem === 1 || sem === 2) prev.semesters.add(sem);
        const tid = String(ec.teacherId ?? '').trim();
        if (tid) prev.teacherIds.add(tid);
        else prev.hasUnassignedTeacher = true;
        enrolledMap.set(ec.subjectId, prev);
      });
    });

    if (enrolledMap.size === 0) return [];

    const allVersionedCourses = Object.values(coursesByVersion).flat();

    const allSubjects = Array.from(enrolledMap.entries())
      .map(([subjectId, meta]) => {
        const semesters = Array.from(meta.semesters).sort((a, b) => a - b) as Array<1 | 2>;
        const assignedTeacherIds = Array.from(meta.teacherIds);
        const hasUnassignedTeacher = meta.hasUnassignedTeacher;
        // 1. Look in legacy subjects
        const legacy = legacySubjects.find(s => s.id === subjectId);
        if (legacy) {
          return { ...legacy, semesters, assignedTeacherIds, hasUnassignedTeacher };
        }

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
            assignedTeacherIds,
            hasUnassignedTeacher,
          } satisfies SubjectOption;
        }
        return null;
      })
      .filter((s): s is SubjectOption => s !== null && s.category !== 'activity');

    if (canViewAllSubjects) return allSubjects;

    return allSubjects.filter((s) => {
      if (selectedSubjectIds.includes(s.id)) return true;
      if (s.hasUnassignedTeacher) return true;
      return s.assignedTeacherIds.some((tid) => matchesTeacherIdentity(tid, teacherIdentityKeys));
    });
  }, [
    classRoom,
    relatedClassRooms,
    legacySubjects,
    coursesByVersion,
    canViewAllSubjects,
    teacherIdentityKeys,
    selectedSubjectIds,
  ]);

  const teacherByIdentity = useMemo(() => {
    const map = new Map<string, (typeof teachers)[number]>();
    teachers.forEach((t) => {
      map.set(t.id, t);
      if (t.userId) map.set(String(t.userId).trim(), t);
    });
    return map;
  }, [teachers]);

  const resolveLinkerTeacher = useCallback((rawId: string) => {
    const id = String(rawId || '').trim();
    if (!id) return null;
    return teacherByIdentity.get(id)
      ?? teacherByIdentity.get(resolveCanonicalTeacherId(id, teachers))
      ?? null;
  }, [teacherByIdentity, teachers]);

  const persistSubjects = useCallback(async (
    ids: string[],
    linkedByMap: Record<string, string>,
  ) => {
    const selectedSubjects = ids
      .map((id) => subjects.find((s) => s.id === id))
      .filter((s): s is SubjectOption => !!s)
      .map((s) => ({
        subjectId: s.id,
        subjectName: s.name,
        subjectCode: s.code ?? '',
        linkedByTeacherId: linkedByMap[s.id] || currentLinkerId || undefined,
      }));
    await onSave(selectedSubjects, selectedScoreType);
  }, [subjects, onSave, selectedScoreType, currentLinkerId]);

  useEffect(() => {
    if (suppressDebounceRef.current) {
      suppressDebounceRef.current = false;
      return;
    }
    if (sameSortedIds(selectedSubjectIds, lastSavedIdsRef.current)) return;
    if (selectedSubjectIds.length === 0 && lastSavedIdsRef.current.length === 0) return;

    const snapshotIds = selectedSubjectIds;
    const snapshotLinkedBy = { ...linkedByBySubjectId };
    const prevIds = lastSavedIdsRef.current;
    const prevLinkedBy = lastSavedLinkedByRef.current;
    const timer = setTimeout(() => {
      void (async () => {
        setIsSaving(true);
        setSaved(false);
        try {
          await persistSubjects(snapshotIds, snapshotLinkedBy);
          lastSavedIdsRef.current = snapshotIds;
          lastSavedLinkedByRef.current = snapshotLinkedBy;
          flashSaved();
        } catch {
          toast.error('บันทึกการเชื่อมต่อไม่สำเร็จ');
          suppressDebounceRef.current = true;
          setSelectedSubjectIds(prevIds);
          setLinkedByBySubjectId(prevLinkedBy);
        } finally {
          setIsSaving(false);
        }
      })();
    }, AUTO_SAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [selectedSubjectIds, linkedByBySubjectId, persistSubjects, flashSaved]);

  const requestToggleSubject = (subject: { id: string; name: string }) => {
    const isSelected = selectedSubjectIds.includes(subject.id);
    if (!isSelected && selectedSubjectIds.length >= maxLinkedSubjects) {
      toast.error(`เชื่อมต่อได้สูงสุด ${maxLinkedSubjects} วิชา`);
      return;
    }
    setPendingToggle({
      subjectId: subject.id,
      subjectName: subject.name,
      nextSelected: !isSelected,
    });
  };

  const confirmToggleSubject = () => {
    if (!pendingToggle) return;
    const { subjectId, nextSelected } = pendingToggle;
    setSelectedSubjectIds((prev) => {
      if (nextSelected) {
        if (prev.includes(subjectId) || prev.length >= maxLinkedSubjects) return prev;
        return [...prev, subjectId];
      }
      return prev.filter((id) => id !== subjectId);
    });
    setLinkedByBySubjectId((prev) => {
      if (nextSelected) {
        return { ...prev, [subjectId]: currentLinkerId };
      }
      const next = { ...prev };
      delete next[subjectId];
      return next;
    });
    setPendingToggle(null);
  };

  return (
    <div className="flex flex-col gap-5">
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
              const linkerId = linkedByBySubjectId[subject.id] || currentLinkerId;
              const linker = resolveLinkerTeacher(linkerId) ?? myTeacher;
              const isSelfLinker = !linkerId
                || teacherIdentityKeys.has(linkerId)
                || (linker?.id ? teacherIdentityKeys.has(linker.id) : false);
              const linkerPhotoURL = (
                linker?.photoURL
                || (isSelfLinker ? selfPhotoURL : '')
                || ''
              ).trim();
              const linkerName = (
                linker?.name
                || (isSelfLinker ? selfDisplayName : '')
                || ''
              ).trim();
              const linkerInitial = (linkerName || '?').charAt(0);
              const linkerAvatarSrc = linkerPhotoURL
                || (linker?.id
                  ? `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(linker.id)}`
                  : linkerId
                    ? `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(linkerId)}`
                    : undefined);
              return (
                <motion.button
                  key={subject.id}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => requestToggleSubject(subject)}
                  className={cn(
                    'flex min-w-0 items-center gap-3 rounded-2xl border px-4 py-3.5 text-left transition-all',
                    isSelected
                      ? 'border-primary/40 bg-primary/5'
                      : 'border-border bg-card hover:bg-muted/40',
                  )}
                >
                  <div
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-sm"
                    style={{
                      background: `linear-gradient(135deg, ${iconColors[1]} 0%, ${iconColors[0]} 100%)`,
                    }}
                  >
                    <SubjectIcon subjectGroup={subjectGroupKey} size={20} className="text-white drop-shadow-sm" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={cn(
                      'truncate text-[13px] font-black font-sukhumvit',
                      isSelected ? 'text-primary' : 'text-foreground',
                    )}>
                      {subject.name}
                    </p>
                    {subject.code ? (
                      <p className={cn(
                        'mt-0.5 text-[11px] font-bold font-sarabun tabular-nums',
                        isSelected ? 'text-primary' : 'text-muted-foreground',
                      )}>
                        {subject.code}
                      </p>
                    ) : null}
                  </div>
                  {isSelected && (
                    <Avatar
                      className="h-8 w-8 shrink-0 border border-primary/20"
                      title={linkerName ? `เชื่อมโดย ${linkerName}` : 'เชื่อมต่อแล้ว'}
                    >
                      {linkerAvatarSrc ? (
                        <AvatarImage src={linkerAvatarSrc} alt={linkerName || ''} />
                      ) : null}
                      <AvatarFallback className="bg-primary/10 text-[10px] font-black text-primary">
                        {linkerInitial}
                      </AvatarFallback>
                    </Avatar>
                  )}
                </motion.button>
              );
            })}
          </div>
        )}
      </div>

      <AutoSaveStatus isSaving={isSaving} saved={saved} />

      <AlertDialog
        open={!!pendingToggle}
        onOpenChange={(open) => {
          if (!open) setPendingToggle(null);
        }}
      >
        <AlertDialogContent className="max-w-sm rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-sukhumvit">
              {pendingToggle?.nextSelected ? 'ยืนยันการเชื่อมต่อวิชา' : 'ยืนยันการยกเลิกเชื่อมต่อวิชา'}
            </AlertDialogTitle>
            <AlertDialogDescription className="font-sarabun">
              {pendingToggle?.nextSelected
                ? `ต้องการเชื่อมต่อ「${pendingToggle.subjectName}」กับสมุดบันทึกคะแนนหรือไม่? ระบบจะบันทึกอัตโนมัติหลังยืนยัน`
                : `ต้องการยกเลิกการเชื่อมต่อ「${pendingToggle?.subjectName ?? ''}」หรือไม่? ระบบจะบันทึกอัตโนมัติหลังยืนยัน`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              variant={pendingToggle?.nextSelected ? 'default' : 'destructive'}
              onClick={confirmToggleSubject}
            >
              ยืนยัน
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Score collection type plate (card overlay) ───────────────────────────────
const SCORE_TYPE_PLATE_W = 200;
const SCORE_TYPE_PLATE_H = 148;
const SCORE_TYPE_PLATE_GAP = 8;

function ScoreCollectionTypePlate({
  selectedType,
  anchorRect,
  onSelect,
  onClose,
}: {
  selectedType: ScoreCollectionType | null;
  anchorRect: DOMRect;
  onSelect: (type: ScoreCollectionType) => void;
  onClose: () => void;
}) {
  const placeBelow = anchorRect.top < SCORE_TYPE_PLATE_H + SCORE_TYPE_PLATE_GAP + 12;
  let left = anchorRect.left + anchorRect.width / 2 - SCORE_TYPE_PLATE_W / 2;
  left = Math.max(8, Math.min(left, window.innerWidth - SCORE_TYPE_PLATE_W - 8));
  const top = placeBelow
    ? Math.min(anchorRect.bottom + SCORE_TYPE_PLATE_GAP, window.innerHeight - SCORE_TYPE_PLATE_H - 8)
    : Math.max(8, anchorRect.top - SCORE_TYPE_PLATE_H - SCORE_TYPE_PLATE_GAP);

  return createPortal(
    <>
      <button
        type="button"
        aria-label="ปิดแผงประเภทคะแนน"
        className="fixed inset-0 z-[80] cursor-default bg-transparent"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-label="เลือกประเภทการเก็บคะแนน"
        className="fixed z-[90] w-[12.5rem] rounded-2xl border border-white/50 bg-white/55 p-2 shadow-lg backdrop-blur-xl"
        style={{ top, left }}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <p className="mb-1.5 px-0.5 text-center font-sukhumvit text-[10px] font-black uppercase tracking-wider text-muted-foreground">
          ประเภทคะแนน
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          {SCORE_COLLECTION_TYPES.map((type) => {
            const Icon = SCORE_COLLECTION_ICONS[type];
            const selected = selectedType !== null && type === selectedType;
            return (
              <button
                key={type}
                type="button"
                title={SCORE_COLLECTION_CONFIG[type].label}
                aria-label={SCORE_COLLECTION_PLATE_LABELS[type]}
                aria-pressed={selected}
                onClick={() => onSelect(type)}
                className={cn(
                  'flex flex-col items-center gap-1 rounded-xl px-2 py-2 transition-colors',
                  selected
                    ? 'bg-white/90 text-foreground ring-1 ring-foreground/20'
                    : 'text-muted-foreground hover:bg-white/50 hover:text-foreground',
                )}
              >
                <Icon className="h-4 w-4" aria-hidden />
                <span className="font-sukhumvit text-[10px] font-bold leading-none">
                  {SCORE_COLLECTION_PLATE_LABELS[type]}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </>,
    document.body,
  );
}

function ScoreCollectionBadgeButtonInner({
  room,
  scoreType,
  enabled,
  isUnset,
  canEdit,
  onOpenSettings,
  onUpdateRoom,
}: {
  room: ExamRoom;
  scoreType: ScoreCollectionType;
  enabled: boolean;
  isUnset?: boolean;
  canEdit?: boolean;
  onOpenSettings: (tab?: SettingsTab) => void;
  onUpdateRoom?: (roomId: string, data: Partial<ExamRoom>) => Promise<void>;
}) {
  const cfg = SCORE_COLLECTION_CONFIG[scoreType];
  const Icon = isUnset ? HiPlus : SCORE_COLLECTION_ICONS[scoreType];

  const [plateOpen, setPlateOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const canPickType = Boolean(canEdit && onUpdateRoom);

  const syncAnchorRect = () => {
    if (btnRef.current) setAnchorRect(btnRef.current.getBoundingClientRect());
  };

  useEffect(() => {
    if (!plateOpen) return;
    syncAnchorRect();
    const onReposition = () => syncAnchorRect();
    window.addEventListener('resize', onReposition);
    window.addEventListener('scroll', onReposition, true);
    return () => {
      window.removeEventListener('resize', onReposition);
      window.removeEventListener('scroll', onReposition, true);
    };
  }, [plateOpen]);

  const closePlate = () => {
    setPlateOpen(false);
    setAnchorRect(null);
  };

  const openPlate = () => {
    if (!canPickType) return;
    syncAnchorRect();
    setPlateOpen(true);
  };

  const handleClick = (e: ReactMouseEvent) => {
    e.stopPropagation();
    if (!canPickType) {
      onOpenSettings('score-config');
      return;
    }
    if (plateOpen) {
      closePlate();
      return;
    }
    openPlate();
  };

  const handleSelectType = async (type: ScoreCollectionType) => {
    closePlate();
    if (!onUpdateRoom) return;
    if (!isUnset && type === scoreType) return;
    await onUpdateRoom(room.id, {
      settings: {
        ...room.settings,
        scoreCollectionType: type,
      },
    });
  };

  const title = isUnset
    ? 'ตั้งประเภทการเก็บคะแนน'
    : canPickType
      ? `${enabled ? `เก็บคะแนน: ${cfg.label}` : `เก็บคะแนน: ${cfg.label} (ยังไม่เปิดใช้)`} — กดเพื่อเปลี่ยนประเภท`
      : enabled
        ? `เก็บคะแนน: ${cfg.label}`
        : `เก็บคะแนน: ${cfg.label} (ยังไม่เปิดใช้)`;

  const ariaLabel = isUnset
    ? 'ตั้งประเภทการเก็บคะแนน'
    : enabled
      ? `เก็บคะแนน: ${cfg.label}`
      : `เก็บคะแนน: ${cfg.label} ปิดอยู่`;

  const isGoldType = !isUnset && (scoreType === 'midterm' || scoreType === 'final');
  const isSilverType = !isUnset && scoreType === 'quiz';

  return (
    <>
      {plateOpen && anchorRect && (
        <ScoreCollectionTypePlate
          selectedType={isUnset ? null : scoreType}
          anchorRect={anchorRect}
          onSelect={(type) => { void handleSelectType(type); }}
          onClose={closePlate}
        />
      )}
      <button
        ref={btnRef}
        type="button"
        onClick={handleClick}
        onPointerDown={(e) => e.stopPropagation()}
        className={cn(
          'absolute top-2 right-2 z-10 inline-flex h-7 w-7 items-center justify-center rounded-full border shadow-lg ring-1 ring-black/5 transition-colors touch-manipulation select-none',
          isUnset
            ? 'border-white/45 bg-white/35 text-slate-600 backdrop-blur-xl hover:bg-white/50'
            : isGoldType
              ? 'border-amber-200/80 bg-amber-400 text-amber-950 hover:bg-amber-300'
              : isSilverType
                ? 'border-slate-200/70 bg-gradient-to-br from-white/80 via-slate-100/70 to-slate-300/55 text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] backdrop-blur-xl hover:from-white/90 hover:via-slate-100/80 hover:to-slate-300/65'
                : enabled
                  ? 'border-white/40 bg-white/30 text-slate-700 backdrop-blur-xl hover:bg-white/45'
                  : 'border-white/30 bg-white/20 text-slate-500 backdrop-blur-xl hover:bg-white/35',
        )}
        title={title}
        aria-label={ariaLabel}
        aria-expanded={canPickType ? plateOpen : undefined}
        aria-haspopup={canPickType ? 'dialog' : undefined}
      >
        <Icon
          className="h-3.5 w-3.5"
          style={isUnset ? undefined : { color: cfg.color }}
          aria-hidden
        />
      </button>
    </>
  );
}

function ScoreCollectionBadgeButton({
  room,
  canEdit,
  onOpenSettings,
  onUpdateRoom,
}: {
  room: ExamRoom;
  canEdit?: boolean;
  onOpenSettings: (tab?: SettingsTab) => void;
  onUpdateRoom?: (roomId: string, data: Partial<ExamRoom>) => Promise<void>;
}) {
  const rawType = room.settings?.scoreCollectionType ?? room.settings?.gradeBookScoreType;
  const enabled = room.settings?.scoreCollectionEnabled === true;
  const isUnset = !rawType && !enabled;
  const canPickType = Boolean(canEdit && onUpdateRoom);

  if (isUnset && !canPickType) return null;

  const scoreType = (rawType && rawType in SCORE_COLLECTION_CONFIG
    ? rawType
    : 'classwork') as ScoreCollectionType;

  return (
    <ScoreCollectionBadgeButtonInner
      room={room}
      scoreType={scoreType}
      enabled={enabled}
      isUnset={isUnset}
      canEdit={canEdit}
      onOpenSettings={onOpenSettings}
      onUpdateRoom={onUpdateRoom}
    />
  );
}

const DRAWER_QUICK_TABS: SettingsTab[] = ['takers', 'questions', 'score-settings', 'score-summary', 'score-config'];

const ROOM_DETAIL_DRAWER_CONTENT_CLASS = cn(
  'flex h-dvh max-h-dvh flex-col overflow-hidden bg-transparent p-2 before:hidden',
  'pb-[max(0.5rem,env(safe-area-inset-bottom))]',
  'data-[vaul-drawer-direction=right]:w-screen data-[vaul-drawer-direction=right]:max-w-none',
  'sm:h-full sm:max-h-full sm:p-2.5 sm:pb-2.5',
  'sm:data-[vaul-drawer-direction=right]:w-full sm:data-[vaul-drawer-direction=right]:max-w-md',
);

const ROOM_DETAIL_DRAWER_PANEL_CLASS = cn(
  'flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-white',
  'rounded-4xl border border-slate-200/80 shadow-2xl',
);

type ScoreSummaryStudent = {
  id: string;
  fullName: string;
  studentCode: string;
  photoURL?: string;
  gender?: 'male' | 'female';
};

/** รายชื่อผู้เข้าสอบ — การ์ดใน drawer แคบ / ตารางตอนขยายเต็มจอ */
function TakersDrawerPanel({
  room,
  attempts,
  loadRoomAttempts,
  canEdit,
  onResetStudent,
  layout = 'cards',
}: {
  room: ExamRoom;
  attempts: ExamAttempt[];
  loadRoomAttempts?: (roomId: string) => Promise<void>;
  canEdit?: boolean;
  onResetStudent?: (studentId: string, studentName: string) => void;
  layout?: DrawerListLayout;
}) {
  const { user, role } = useAuth();
  const canViewAllSubjects = role === 'admin' || role === 'sysadmin';
  const teachingMgr = useTeachingManager(user?.uid ?? '', canViewAllSubjects);
  const [mobileSelectedRound, setMobileSelectedRound] = useState<number | null>(null);
  const [sortKey, setSortKey] = useState<DrawerTakersSortKey>('name');
  const [sortDir, setSortDir] = useState<DrawerSortDir>('asc');
  const [loadingAttempts, setLoadingAttempts] = useState(false);

  useEffect(() => {
    if (!loadRoomAttempts) return;
    let cancelled = false;
    setLoadingAttempts(true);
    void loadRoomAttempts(room.id).finally(() => {
      if (!cancelled) setLoadingAttempts(false);
    });
    return () => { cancelled = true; };
  }, [room.id, loadRoomAttempts]);

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
    const hasForPreferred = attempts.some((a) => normalizeExamRound(a.round) === preferred);
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
    setSortKey('name');
    setSortDir('asc');
  }, [room.id]);

  const attemptsByStudentRound = useMemo(
    () => indexAttemptsByStudentRound(attempts, studentIdentityLookup),
    [attempts, studentIdentityLookup],
  );

  const getRoundTotalPoints = useCallback(
    (round: number) => getExamRoomRoundTotalPoints(room, round),
    [room],
  );

  const displayRows = useMemo(() => {
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
            activeMobileRound,
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
            photoURL: undefined as string | undefined,
            gender: undefined as 'male' | 'female' | undefined,
            attempt: att,
          }))
        : [];

    return rows.map((row) => {
      const att = row.attempt;
      const score = resolveAttemptTotalScore(att);
      const attemptRound = att ? normalizeExamRound(att.round) : activeMobileRound;
      const roundTotal = getRoundTotalPoints(attemptRound);
      const scorePercent = score !== null && roundTotal > 0
        ? Math.round(rawPointsToPercent(score, roundTotal))
        : null;
      const statusLabel = !att
        ? 'ยังไม่เข้าสอบ'
        : att.status === 'submitted' || att.status === 'graded'
          ? 'ส่งแล้ว'
          : 'เข้าสอบ';
      const statusClass = !att
        ? 'bg-muted text-muted-foreground'
        : att.status === 'submitted' || att.status === 'graded'
          ? 'bg-emerald-500/10 text-emerald-600'
          : 'bg-primary/10 text-primary';
      const statusRank = !att
        ? 0
        : att.status === 'in_progress'
          ? 1
          : 2;
      const isPending = !!att && att.status === 'submitted' && score === null;
      const isInProgress = !!att && att.status === 'in_progress';
      return {
        ...row,
        att,
        scorePercent,
        hasScore: scorePercent !== null,
        statusLabel,
        statusClass,
        statusRank,
        isPending,
        isInProgress,
        round: activeMobileRound,
      };
    });
  }, [
    classStudents,
    attempts,
    attemptsByStudentRound,
    activeMobileRound,
    getRoundTotalPoints,
  ]);

  const toggleSort = useCallback((key: DrawerTakersSortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
      return;
    }
    setSortKey(key);
    setSortDir(key === 'name' || key === 'status' ? 'asc' : 'desc');
  }, [sortKey]);

  const sortedRows = useMemo(() => {
    const list = [...displayRows];
    list.sort((a, b) => {
      if (sortKey === 'name') {
        const byCode = (a.studentCode || '').localeCompare(b.studentCode || '', 'th', { numeric: true });
        if (byCode !== 0) return sortDir === 'asc' ? byCode : -byCode;
        const byName = a.fullName.localeCompare(b.fullName, 'th');
        return sortDir === 'asc' ? byName : -byName;
      }
      if (sortKey === 'status') {
        const byRank = a.statusRank - b.statusRank;
        return sortDir === 'asc' ? byRank : -byRank;
      }
      if (sortKey === 'score') {
        return compareNullableScore(a.scorePercent, b.scorePercent, sortDir);
      }
      if (sortKey === 'round') {
        const byRound = a.round - b.round;
        return sortDir === 'asc' ? byRound : -byRound;
      }
      return 0;
    });
    return list;
  }, [displayRows, sortKey, sortDir]);

  if (isClassRosterLoading || loadingAttempts) {
    return (
      <div className="flex flex-col gap-2" aria-busy="true" aria-label="กำลังโหลดรายชื่อนักเรียน">
        {Array.from({ length: TAKERS_SKELETON_ROWS }).map((_, index) => (
          <div key={index} className={MOBILE_STUDENT_CARD_SHELL}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 flex-1 items-start gap-2.5">
                <Skeleton className="h-9 w-9 shrink-0 rounded-full bg-slate-100" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-4 w-[62%] rounded-lg bg-slate-100" />
                  <Skeleton className="h-3 w-[28%] rounded-lg bg-slate-50" />
                </div>
              </div>
              <Skeleton className="h-8 w-12 shrink-0 rounded-lg bg-slate-100" />
            </div>
            <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-border pt-2">
              <Skeleton className="h-3 w-14 rounded bg-slate-100" />
              <Skeleton className="h-5 w-12 rounded-full bg-slate-100" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (displayRows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
        <Users size={32} className="text-slate-300" />
        <p className="text-pretty text-[14px] font-sarabun text-slate-400">ยังไม่มีนักเรียนในห้องสอบ</p>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col gap-3', layout === 'table' && 'min-h-0 flex-1')}>
      <MobileRoundSelect
        rounds={roundNumbers}
        value={activeMobileRound}
        onChange={setMobileSelectedRound}
      />
      {layout === 'table' ? (
        <div className={cn(TABLE_SHELL, 'min-h-0 flex-1 overflow-y-auto scrollbar-hide')}>
          <div
            className={TABLE_HEADER_ROW}
            style={{ gridTemplateColumns: DRAWER_TAKERS_TABLE_GRID }}
          >
            <DrawerTableSortHeader
              label="นักเรียน"
              align="left"
              active={sortKey === 'name'}
              dir={sortDir}
              onClick={() => toggleSort('name')}
            />
            <div className="flex justify-center">
              <DrawerTableSortHeader
                label="สถานะ"
                active={sortKey === 'status'}
                dir={sortDir}
                onClick={() => toggleSort('status')}
              />
            </div>
            <div className="flex justify-center">
              <DrawerTableSortHeader
                label="คะแนน (%)"
                active={sortKey === 'score'}
                dir={sortDir}
                onClick={() => toggleSort('score')}
              />
            </div>
            <div className="flex justify-center">
              <DrawerTableSortHeader
                label="ครั้ง"
                active={sortKey === 'round'}
                dir={sortDir}
                onClick={() => toggleSort('round')}
              />
            </div>
          </div>
          <div className="flex flex-col">
            {sortedRows.map((row, index) => (
              <motion.div
                key={row.key}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: Math.min(index * 0.015, 0.2) }}
                className={TABLE_ROW}
                style={{ gridTemplateColumns: DRAWER_TAKERS_TABLE_GRID }}
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <StudentAvatar
                    photoURL={row.photoURL}
                    studentId={row.studentId || row.key}
                    name={row.fullName}
                    gender={row.gender}
                    className="h-9 w-9 shrink-0 rounded-full"
                  />
                  <div className="min-w-0">
                    <p
                      className="truncate font-sukhumvit text-[13px] font-bold text-foreground"
                      title={row.fullName}
                    >
                      {row.fullName}
                    </p>
                    <p className="mt-0.5 font-sukhumvit text-[11px] font-semibold tabular-nums text-muted-foreground">
                      {row.studentCode || '—'}
                    </p>
                  </div>
                </div>
                <div className="flex justify-center">
                  <span
                    className={cn(
                      'inline-flex rounded-full px-2.5 py-0.5 font-sukhumvit text-[10px] font-bold whitespace-nowrap',
                      row.statusClass,
                    )}
                  >
                    {row.statusLabel}
                  </span>
                </div>
                <div className="flex items-center justify-center gap-1.5">
                  {row.hasScore ? (
                    <span
                      className={cn(
                        'inline-flex rounded-full px-2.5 py-0.5 font-sukhumvit text-[10px] font-bold tabular-nums',
                        examScorePercentBadgeClass(row.scorePercent),
                      )}
                    >
                      {row.scorePercent}%
                    </span>
                  ) : (
                    <span className="text-[13px] font-bold text-muted-foreground/40">—</span>
                  )}
                  {canEdit && onResetStudent && row.att && (
                    <button
                      type="button"
                      onClick={() => onResetStudent(row.att!.studentId, row.fullName)}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border text-amber-500 transition-colors hover:bg-muted"
                      title={`รีเซ็ตการสอบของ ${row.fullName}`}
                      aria-label={`รีเซ็ตการสอบของ ${row.fullName}`}
                    >
                      <RotateCcw size={12} />
                    </button>
                  )}
                </div>
                <p className="text-center font-sukhumvit text-[12px] font-bold text-muted-foreground">
                  {row.round}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {sortedRows.map((row, index) => (
            <motion.div
              key={row.key}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(index * 0.02, 0.2), ease: 'easeOut' }}
            >
              <div className={MOBILE_STUDENT_CARD_SHELL}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 flex-1 items-start gap-2.5">
                    <StudentAvatar
                      photoURL={row.photoURL}
                      studentId={row.studentId || row.key}
                      name={row.fullName}
                      gender={row.gender}
                      className="h-9 w-9 shrink-0 rounded-full"
                    />
                    <div className="min-w-0 flex-1">
                      <p
                        className="truncate font-sukhumvit text-[13px] font-bold text-foreground"
                        title={row.fullName}
                      >
                        {row.fullName}
                      </p>
                      <p className="mt-0.5 font-sukhumvit text-[12px] font-semibold tabular-nums text-muted-foreground">
                        รหัส {row.studentCode || '—'}
                      </p>
                    </div>
                  </div>
                  <div className="shrink-0 text-center">
                    <span
                      className={cn(
                        'inline-flex rounded-full px-2.5 py-0.5 font-sukhumvit text-[10px] font-bold whitespace-nowrap',
                        row.statusClass,
                      )}
                    >
                      {row.statusLabel}
                    </span>
                  </div>
                </div>
                <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-border pt-2">
                  <p className="font-sukhumvit text-[11px] font-bold text-muted-foreground">
                    ครั้ง {row.round}
                  </p>
                  <div className="flex items-center gap-1.5">
                    {row.hasScore ? (
                      <span
                        className={cn(
                          'inline-flex items-center justify-center rounded-full px-2.5 py-0.5 font-sukhumvit text-[10px] font-bold tabular-nums',
                          examScorePercentBadgeClass(row.scorePercent),
                        )}
                      >
                        {row.scorePercent}%
                      </span>
                    ) : row.isInProgress ? (
                      <span className="inline-flex rounded-full bg-primary/10 px-2.5 py-0.5 font-sukhumvit text-[10px] font-bold text-primary">
                        กำลังสอบ
                      </span>
                    ) : row.isPending ? (
                      <span className="inline-flex rounded-full bg-amber-500/10 px-2.5 py-0.5 font-sukhumvit text-[10px] font-bold text-amber-600">
                        รอตรวจ
                      </span>
                    ) : (
                      <span className="font-sukhumvit text-[11px] font-bold text-muted-foreground">
                        ยังไม่เข้าสอบ
                      </span>
                    )}
                    {canEdit && onResetStudent && row.att && (
                      <button
                        type="button"
                        onClick={() => onResetStudent(row.att!.studentId, row.fullName)}
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border text-amber-500 transition-colors hover:bg-muted"
                        title={`รีเซ็ตการสอบของ ${row.fullName}`}
                        aria-label={`รีเซ็ตการสอบของ ${row.fullName}`}
                      >
                        <RotateCcw size={12} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

/** สรุปคะแนน — การ์ดใน drawer แคบ / ตารางตอนขยายเต็มจอ */
function ScoreSummaryDrawerPanel({
  room,
  attempts,
  loadRoomAttempts,
  onRecalculateScores,
  layout = 'cards',
}: {
  room: ExamRoom;
  attempts: ExamAttempt[];
  loadRoomAttempts?: (roomId: string) => Promise<void>;
  onRecalculateScores?: (roomId: string, round: number) => Promise<void>;
  layout?: DrawerListLayout;
}) {
  const { user, role } = useAuth();
  const canViewAllSubjects = role === 'admin' || role === 'sysadmin';
  const teachingMgr = useTeachingManager(user?.uid ?? '', canViewAllSubjects);
  const [mobileSelectedRound, setMobileSelectedRound] = useState<number | null>(null);
  const [sortKey, setSortKey] = useState<DrawerSummarySortKey>('name');
  const [sortDir, setSortDir] = useState<DrawerSortDir>('asc');
  const [scoreDetail, setScoreDetail] = useState<{
    student: ScoreSummaryStudent;
    initialRound?: number;
  } | null>(null);
  const [loadingAttempts, setLoadingAttempts] = useState(false);

  useEffect(() => {
    if (!loadRoomAttempts) return;
    let cancelled = false;
    setLoadingAttempts(true);
    void loadRoomAttempts(room.id).finally(() => {
      if (!cancelled) setLoadingAttempts(false);
    });
    return () => { cancelled = true; };
  }, [room.id, loadRoomAttempts]);

  useEffect(() => {
    if (!onRecalculateScores) return;
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
    void Promise.all([...roundsToRecalc].map((round) => onRecalculateScores(room.id, round)));
  }, [room.id, attempts, onRecalculateScores]);

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
    const hasForPreferred = attempts.some((a) => normalizeExamRound(a.round) === preferred);
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
    setSortKey('name');
    setSortDir('asc');
  }, [room.id]);

  const attemptsByStudentRound = useMemo(
    () => indexAttemptsByStudentRound(attempts, studentIdentityLookup),
    [attempts, studentIdentityLookup],
  );

  const summaryStudents = useMemo((): ScoreSummaryStudent[] => {
    if (room.classId && !teachingMgr.isRosterDataLoaded) return [];

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

    const map = new Map<string, ScoreSummaryStudent>();
    attempts.forEach((att) => {
      const studentId = String(att.studentId || '').trim();
      if (!studentId || map.has(studentId)) return;
      map.set(studentId, {
        id: studentId,
        fullName: att.studentName || 'ไม่ทราบชื่อ',
        studentCode: '-',
      });
    });
    return Array.from(map.values());
  }, [classStudents, attempts, room.classId, teachingMgr.isRosterDataLoaded]);

  const getRoundTotalPoints = useCallback(
    (round: number) => getExamRoomRoundTotalPoints(room, round),
    [room],
  );

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

  const rows = useMemo(() => {
    return summaryStudents.map((student) => {
      const studentRounds = attemptsByStudentRound.get(student.id);
      const bestScorePercent = bestPercentByStudent.get(student.id) ?? null;
      const bestScorePercentDisplay = bestScorePercent !== null ? Math.round(bestScorePercent) : null;
      const isTopScorer = highestBestPercent !== null && bestScorePercent === highestBestPercent;
      const isLowestScorer = lowestBestPercent !== null && bestScorePercent === lowestBestPercent;
      const rowHighlightClass = isTopScorer
        ? 'bg-primary/5'
        : isLowestScorer
          ? 'bg-destructive/5'
          : '';
      const bestScoreClass = examScorePercentBadgeClass(bestScorePercentDisplay);

      const round = activeMobileRound;
      const att = studentRounds?.get(round);
      const roundScore = resolveAttemptTotalScore(att);
      const roundTotal = getRoundTotalPoints(round);
      const roundScorePercent = roundScore !== null && roundTotal > 0
        ? Math.round(rawPointsToPercent(roundScore, roundTotal))
        : null;

      return {
        student,
        bestScorePercent: bestScorePercentDisplay,
        isTopScorer,
        isLowestScorer,
        rowHighlightClass,
        bestScoreClass,
        attemptsByRound: studentRounds ?? new Map<number, ExamAttempt>(),
        hasAnyAttempt: (studentRounds?.size ?? 0) > 0,
        round,
        roundScore,
        roundScorePercent,
        roundTotal,
        hasScore: roundScorePercent !== null,
        isPending: !!att && att.status === 'submitted' && roundScore === null,
        isInProgress: !!att && att.status === 'in_progress',
        needsManualReview: !!att?.pendingManualGrading,
        rounds: roundNumbers.map((r) => {
          const roundAtt = studentRounds?.get(r);
          const score = resolveAttemptTotalScore(roundAtt);
          const total = getRoundTotalPoints(r);
          const pct = score !== null && total > 0
            ? Math.round(rawPointsToPercent(score, total))
            : null;
          return {
            round: r,
            att: roundAtt,
            roundScore: score,
            roundScorePercent: pct,
            roundTotal: total,
            hasScore: pct !== null,
            isPending: !!roundAtt && roundAtt.status === 'submitted' && score === null,
            isInProgress: !!roundAtt && roundAtt.status === 'in_progress',
            needsManualReview: !!roundAtt?.pendingManualGrading,
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
    activeMobileRound,
    roundNumbers,
    getRoundTotalPoints,
  ]);

  const drawerSummaryTableGrid = useMemo(
    () =>
      ['minmax(0, 2.2fr)', ...roundNumbers.map(() => 'minmax(5rem, 0.85fr)'), 'minmax(5rem, 0.85fr)'].join(' '),
    [roundNumbers],
  );

  const toggleSort = useCallback((key: DrawerSummarySortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
      return;
    }
    setSortKey(key);
    setSortDir(key === 'name' ? 'asc' : 'desc');
  }, [sortKey]);

  const sortedRows = useMemo(() => {
    const list = [...rows];
    list.sort((a, b) => {
      if (sortKey === 'name') {
        const byCode = (a.student.studentCode || '').localeCompare(
          b.student.studentCode || '',
          'th',
          { numeric: true },
        );
        if (byCode !== 0) return sortDir === 'asc' ? byCode : -byCode;
        const byName = a.student.fullName.localeCompare(b.student.fullName, 'th');
        return sortDir === 'asc' ? byName : -byName;
      }
      if (sortKey === 'best') {
        return compareNullableScore(a.bestScorePercent, b.bestScorePercent, sortDir);
      }
      if (sortKey.startsWith('round:')) {
        const round = Number(sortKey.slice(6));
        const pctA = a.rounds.find((r) => r.round === round)?.roundScorePercent ?? null;
        const pctB = b.rounds.find((r) => r.round === round)?.roundScorePercent ?? null;
        return compareNullableScore(pctA, pctB, sortDir);
      }
      return 0;
    });
    return list;
  }, [rows, sortKey, sortDir]);

  const scoreDetailAttemptsByRound = useMemo(() => {
    if (!scoreDetail) return new Map<number, ExamAttempt>();
    return attemptsByStudentRound.get(scoreDetail.student.id) ?? new Map<number, ExamAttempt>();
  }, [scoreDetail, attemptsByStudentRound]);

  if (isClassRosterLoading || loadingAttempts) {
    return <ScoreSummarySkeleton />;
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
        <CheckCircle2 size={32} className="text-slate-300" />
        <p className="text-pretty text-[14px] font-sarabun text-slate-400">ยังไม่มีข้อมูลสรุปคะแนน</p>
      </div>
    );
  }

  return (
    <>
      <div className={cn('flex flex-col gap-3', layout === 'table' && 'min-h-0 flex-1')}>
        {layout !== 'table' && (
          <MobileRoundSelect
            rounds={roundNumbers}
            value={activeMobileRound}
            onChange={setMobileSelectedRound}
          />
        )}
        {layout === 'table' ? (
          <div className={cn(TABLE_SHELL, 'min-h-0 flex-1 overflow-x-auto overflow-y-auto scrollbar-hide')}>
            <div className="min-w-full">
              <div
                className={TABLE_HEADER_ROW}
                style={{ gridTemplateColumns: drawerSummaryTableGrid }}
              >
                <DrawerTableSortHeader
                  label="นักเรียน"
                  align="left"
                  active={sortKey === 'name'}
                  dir={sortDir}
                  onClick={() => toggleSort('name')}
                />
                {roundNumbers.map((round) => {
                  const key = `round:${round}` as const;
                  return (
                    <div key={round} className="flex justify-center">
                      <DrawerTableSortHeader
                        label={`ครั้ง ${round}`}
                        title={`ครั้ง ${round} — คลิกเรียงตาม %`}
                        active={sortKey === key}
                        dir={sortDir}
                        onClick={() => toggleSort(key)}
                      />
                    </div>
                  );
                })}
                <div className="flex justify-center">
                  <DrawerTableSortHeader
                    label="สูงสุด (%)"
                    title="สูงสุด (%) — คลิกเรียง"
                    active={sortKey === 'best'}
                    dir={sortDir}
                    onClick={() => toggleSort('best')}
                  />
                </div>
              </div>
              <div className="flex flex-col">
                {sortedRows.map((row, index) => (
                  <motion.div
                    key={row.student.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: Math.min(index * 0.015, 0.2) }}
                    className={cn(TABLE_ROW, row.rowHighlightClass)}
                    style={{ gridTemplateColumns: drawerSummaryTableGrid }}
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <StudentAvatar
                        photoURL={row.student.photoURL}
                        studentId={row.student.id}
                        name={row.student.fullName}
                        gender={row.student.gender}
                        className="h-9 w-9 shrink-0 rounded-full"
                      />
                      <div className="min-w-0">
                        {row.hasAnyAttempt ? (
                          <button
                            type="button"
                            onClick={() => setScoreDetail({ student: row.student })}
                            className="truncate text-left font-sukhumvit text-[13px] font-bold text-foreground hover:text-primary hover:underline underline-offset-2"
                            title={row.student.fullName}
                          >
                            {row.student.fullName}
                          </button>
                        ) : (
                          <p
                            className="truncate font-sukhumvit text-[13px] font-bold text-foreground"
                            title={row.student.fullName}
                          >
                            {row.student.fullName}
                          </p>
                        )}
                        <p className="mt-0.5 font-sukhumvit text-[11px] font-semibold tabular-nums text-muted-foreground">
                          {row.student.studentCode || '—'}
                        </p>
                      </div>
                    </div>
                    {row.rounds.map(({
                      round,
                      roundScore,
                      roundScorePercent,
                      roundTotal,
                      hasScore,
                      isPending,
                      isInProgress,
                      needsManualReview,
                    }) => (
                      <div key={round} className="flex justify-center">
                        {hasScore ? (
                          <button
                            type="button"
                            onClick={() => setScoreDetail({ student: row.student, initialRound: round })}
                            className={cn(
                              'inline-flex items-center justify-center gap-1 rounded-full px-2.5 py-0.5 font-sukhumvit text-[10px] font-bold tabular-nums transition-colors',
                              needsManualReview
                                ? 'bg-amber-500/10 text-amber-600 hover:bg-amber-500/20'
                                : cn(examScorePercentBadgeClass(roundScorePercent), 'hover:opacity-90'),
                            )}
                            title={`${formatScorePoints(roundScore)}/${formatScorePoints(roundTotal)} คะแนน (${roundScorePercent}%)`}
                          >
                            {roundScorePercent}%
                            {needsManualReview && <HiMiniPencil size={10} className="shrink-0" />}
                          </button>
                        ) : isInProgress ? (
                          <span className="inline-flex rounded-full bg-primary/10 px-2.5 py-0.5 font-sukhumvit text-[10px] font-bold text-primary">
                            กำลังสอบ
                          </span>
                        ) : isPending ? (
                          <button
                            type="button"
                            onClick={() => setScoreDetail({ student: row.student, initialRound: round })}
                            className="inline-flex rounded-full bg-amber-500/10 px-2.5 py-0.5 font-sukhumvit text-[10px] font-bold text-amber-600 hover:bg-amber-500/20"
                          >
                            รอตรวจ
                          </button>
                        ) : (
                          <span className="text-[13px] font-bold text-muted-foreground/40">—</span>
                        )}
                      </div>
                    ))}
                    <div className="flex justify-center">
                      {row.bestScorePercent !== null ? (
                        <span
                          className={cn(
                            'inline-flex rounded-full px-2.5 py-0.5 font-sukhumvit text-[10px] font-bold tabular-nums',
                            row.bestScoreClass,
                          )}
                        >
                          {row.bestScorePercent}%
                        </span>
                      ) : (
                        <span className="text-[13px] font-bold text-muted-foreground/40">—</span>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {rows.map((row, index) => (
              <motion.div
                key={row.student.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index * 0.02, 0.2), ease: 'easeOut' }}
              >
                <div className={cn(MOBILE_STUDENT_CARD_SHELL, row.rowHighlightClass)}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 flex-1 items-start gap-2.5">
                      <StudentAvatar
                        photoURL={row.student.photoURL}
                        studentId={row.student.id}
                        name={row.student.fullName}
                        gender={row.student.gender}
                        className="h-9 w-9 shrink-0 rounded-full"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-center gap-2">
                          {row.hasAnyAttempt ? (
                            <button
                              type="button"
                              onClick={() => setScoreDetail({ student: row.student })}
                              className="truncate text-left font-sukhumvit text-[13px] font-bold text-foreground hover:text-primary hover:underline underline-offset-2"
                              title={row.student.fullName}
                            >
                              {row.student.fullName}
                            </button>
                          ) : (
                            <p
                              className="truncate font-sukhumvit text-[13px] font-bold text-foreground"
                              title={row.student.fullName}
                            >
                              {row.student.fullName}
                            </p>
                          )}
                          {row.isTopScorer && (
                            <span className="inline-flex shrink-0 rounded-full bg-primary/10 px-2.5 py-0.5 font-sukhumvit text-[10px] font-bold text-primary">
                              สูงสุด
                            </span>
                          )}
                          {!row.isTopScorer && row.isLowestScorer && (
                            <span className="inline-flex shrink-0 rounded-full bg-destructive/10 px-2.5 py-0.5 font-sukhumvit text-[10px] font-bold text-destructive">
                              ต่ำสุด
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 font-sukhumvit text-[12px] font-semibold tabular-nums text-muted-foreground">
                          รหัส {row.student.studentCode || '—'}
                        </p>
                      </div>
                    </div>
                    <div className="shrink-0 text-center">
                      <p className="mb-0.5 font-sukhumvit text-[11px] font-bold text-muted-foreground">
                        สูงสุด (%)
                      </p>
                      {row.bestScorePercent !== null ? (
                        <span
                          className={cn(
                            'inline-flex items-center justify-center rounded-full px-2.5 py-0.5 font-sukhumvit text-[10px] font-bold tabular-nums',
                            row.bestScoreClass,
                          )}
                        >
                          {row.bestScorePercent}%
                        </span>
                      ) : (
                        <span className="text-[13px] font-bold text-muted-foreground/40">—</span>
                      )}
                    </div>
                  </div>
                  <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-border pt-2">
                    <p className="font-sukhumvit text-[11px] font-bold text-muted-foreground">
                      ครั้ง {row.round}
                    </p>
                    {row.hasScore ? (
                      <button
                        type="button"
                        onClick={() => setScoreDetail({ student: row.student, initialRound: row.round })}
                        className={cn(
                          'inline-flex items-center justify-center gap-1 rounded-full px-2.5 py-0.5 font-sukhumvit text-[10px] font-bold tabular-nums transition-colors',
                          row.needsManualReview
                            ? 'bg-amber-500/10 text-amber-600 hover:bg-amber-500/20'
                            : cn(examScorePercentBadgeClass(row.roundScorePercent), 'hover:opacity-90'),
                        )}
                        title={`${formatScorePoints(row.roundScore)}/${formatScorePoints(row.roundTotal)} คะแนน (${row.roundScorePercent}%)`}
                      >
                        {formatScorePoints(row.roundScore)}/{formatScorePoints(row.roundTotal)}
                        {row.roundScorePercent !== null ? ` · ${row.roundScorePercent}%` : ''}
                        {row.needsManualReview && <HiMiniPencil size={10} className="shrink-0" />}
                      </button>
                    ) : row.isInProgress ? (
                      <span className="inline-flex rounded-full bg-primary/10 px-2.5 py-0.5 font-sukhumvit text-[10px] font-bold text-primary">
                        กำลังสอบ
                      </span>
                    ) : row.isPending ? (
                      <button
                        type="button"
                        onClick={() => setScoreDetail({ student: row.student, initialRound: row.round })}
                        className="inline-flex rounded-full bg-amber-500/10 px-2.5 py-0.5 font-sukhumvit text-[10px] font-bold text-amber-600 hover:bg-amber-500/20"
                      >
                        รอตรวจ
                      </button>
                    ) : (
                      <span className="text-[13px] font-bold text-muted-foreground/40">—</span>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
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
    </>
  );
}

/** กดที่ icon ห้องสอบ → เปิด Drawer ด้านข้างแสดงรายละเอียดห้องสอบ + ปุ่ม tab ลัดไปหน้าจัดการห้องสอบ */
function RoomIconDetailDrawer({
  open,
  onClose,
  room,
  canEdit,
  isStudent,
  onOpenSettings,
  // ponytail: onEdit kept for compat
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onEdit: _onEdit,
  onDelete,
  onChangeStatus,
  onFinish,
  onUpdateRoom,
  attempts = [],
  loadRoomAttempts,
  onRecalculateScores,
  onResetStudent,
}: {
  open: boolean;
  onClose: () => void;
  room: ExamRoom;
  canEdit?: boolean;
  isStudent?: boolean;
  onOpenSettings: (tab?: SettingsTab) => void;
  onEdit: () => void;
  onDelete?: () => void;
  onChangeStatus?: (status: ExamRoom['status'], bypassConfirm?: boolean) => void;
  onFinish?: () => void;
  onUpdateRoom?: (roomId: string, data: Partial<ExamRoom>) => Promise<void>;
  attempts?: ExamAttempt[];
  loadRoomAttempts?: (roomId: string) => Promise<void>;
  onRecalculateScores?: (roomId: string, round: number) => Promise<void>;
  onResetStudent?: (studentId: string, studentName: string) => void;
}) {
  const { classes } = useClassroomManager();
  const { subjects } = useCurriculum();
  // ponytail: unused hooks kept for data pipeline
  void useActiveAcademicYear();
  void useAuth();

  const [isEditing, setIsEditing] = useState(false);
  const [drawerView, setDrawerView] = useState<
    'info' | 'takers' | 'questions' | 'score-summary' | 'score-config' | 'score-settings'
  >('info');
  const [listExpanded, setListExpanded] = useState(false);
  // ponytail: isSaving drives disabled state on submit button
  const [isSaving, setIsSaving] = useState(false);

  const [form, setForm] = useState({
    title: room.title || '',
    departmentId: (room.departmentId as Department) || '',
    gradeLevel: room.gradeLevel || '',
    classId: room.classId || '',
    subjectGroupId: (room.subjectGroupId as SubjectGroupId) || '',
    subSubjectGroup: room.subSubjectGroup || '',
    subjectId: room.subjectId || '',
    password: room.password || '',
    durationMinutes: room.durationMinutes || 60,
    maxAttempts: room.settings?.maxAttempts ?? 1,
    shuffleQuestions: room.settings?.shuffleQuestions || false,
    showResultImmediately: room.settings?.showResultImmediately || true,
  });

  const inferDepartmentFromGrade = (gradeLevel?: string): Department | '' => {
    if (!gradeLevel) return '';
    if (gradeLevel.startsWith('อ.')) return 'early';
    if (gradeLevel.startsWith('ป.')) return 'primary';
    if (gradeLevel.startsWith('ม.')) return 'secondary';
    return '';
  };

  useEffect(() => {
    if (open) {
      setForm({
        title: room.title || '',
        departmentId: (room.departmentId as Department) || '',
        gradeLevel: room.gradeLevel || '',
        classId: room.classId || '',
        subjectGroupId: (room.subjectGroupId as SubjectGroupId) || '',
        subSubjectGroup: room.subSubjectGroup || '',
        subjectId: room.subjectId || '',
        password: room.password || '',
        durationMinutes: room.durationMinutes || 60,
        maxAttempts: room.settings?.maxAttempts ?? 1,
        shuffleQuestions: room.settings?.shuffleQuestions || false,
        showResultImmediately: room.settings?.showResultImmediately || true,
      });
    } else {
      setIsEditing(false);
      setDrawerView('info');
      setListExpanded(false);
    }
  }, [room, open]);

  const canExpandList =
    drawerView === 'takers' || drawerView === 'score-summary' || drawerView === 'questions';

  useEffect(() => {
    if (!canExpandList) setListExpanded(false);
  }, [canExpandList]);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const onChange = () => {
      if (!mq.matches) setListExpanded(false);
    };
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const gradeOptions = form.departmentId ? DEPARTMENT_CONFIG[form.departmentId].grades : [];
  const classOptions = classes.filter((c) => {
    const classDept = c.departmentId || c.department || inferDepartmentFromGrade(c.gradeLevel);
    const passDept = !form.departmentId || classDept === form.departmentId;
    const passGrade = !form.gradeLevel || c.gradeLevel === form.gradeLevel;
    return passDept && passGrade;
  }).sort((a, b) => Number(a.roomNumber) - Number(b.roomNumber));

  const subjectGroupOptions = Object.entries(SUBJECT_GROUP_CONFIG).sort(([, a], [, b]) => a.order - b.order);
  const subSubjectOptions = form.subjectGroupId
    ? SUBJECT_SUBGROUP_CONFIG[form.subjectGroupId as SubjectGroupId] ?? []
    : [];

  const handleSave = async () => {
    if (!form.title || !form.password || !onUpdateRoom) return;
    setIsSaving(true);
    try {
      const selectedSubject = subjects.find((s) => s.id === form.subjectId);
      const subjectName = selectedSubject ? selectedSubject.name : (form.subjectId || '');

      const selectedClass = classes.find((c) => c.id === form.classId);
      const className = selectedClass ? `${selectedClass.gradeLevel}/${selectedClass.roomNumber}` : '';

      const roomData = {
        title: form.title,
        subjectId: form.subjectId,
        subjectName,
        classId: form.classId,
        className,
        password: form.password,
        durationMinutes: form.durationMinutes,
        departmentId: form.departmentId || 'secondary',
        gradeLevel: form.gradeLevel,
        subjectGroupId: form.subjectGroupId,
        subSubjectGroup: form.subSubjectGroup || undefined,
        settings: {
          ...room.settings,
          shuffleQuestions: form.shuffleQuestions,
          showResultImmediately: form.showResultImmediately,
          maxAttempts: form.maxAttempts,
        },
      };

      await onUpdateRoom(room.id, roomData);
      setIsEditing(false);
    } catch (err) {
      console.error('Error saving room detail:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const dept = (room.departmentId || 'secondary') as Department;
  const deptCfg = DEPARTMENT_CONFIG[dept];
  const groupCfg = room.subjectGroupId ? SUBJECT_GROUP_CONFIG[room.subjectGroupId as SubjectGroupId] : undefined;
  const subjectLabel = room.subSubjectGroup?.trim() || groupCfg?.name || '—';

  const hasNoQuestions = !isExamRoomQuestionsConfigured(room);
  const hasScoreConnection = Boolean(
    (room.settings?.gradeBookSubjects && room.settings.gradeBookSubjects.length > 0) ||
    room.settings?.gradeBookSubjectId
  );

  const rows: { label: string; value: React.ReactNode; isWarning?: boolean }[] = [
    { label: 'แผนก / ชั้น', value: `${deptCfg?.label ?? '—'} · ${getExamRoomGradeLevel(room) || '—'}` },
    { label: 'กลุ่มสาระ / สาระย่อย', value: subjectLabel },
    { label: 'ครูผู้สอน', value: room.teacherName || '—' },
    {
      label: 'จำนวนข้อ / คะแนนเต็ม',
      value: hasNoQuestions
        ? (canEdit && !isStudent ? 'กรุณาตั้งค่าข้อสอบก่อน' : 'ยังไม่มีข้อสอบ')
        : `${room.questionCount ?? 0} ข้อ · ${room.totalPoints ?? 0} คะแนน`,
      isWarning: hasNoQuestions,
    },
    { label: 'ระยะเวลาทำข้อสอบ', value: room.durationMinutes ? `${room.durationMinutes} นาที` : 'ไม่จำกัดเวลา' },
    { label: 'รอบสอบ', value: `เปิดแล้ว ${room.completedRounds ?? 0} รอบ · ปัจจุบันรอบ ${room.currentRound ?? 1}` },
    ...(canEdit && !isStudent ? [{ label: 'รหัสห้องสอบ', value: room.password || '—' }] : []),
    { label: 'สร้างเมื่อ', value: room.createdAt ? new Date(room.createdAt).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' }) : '—' },
  ];

  const isSubView = drawerView !== 'info';
  const listLayout: DrawerListLayout = listExpanded ? 'table' : 'cards';
  const drawerViewTitle =
    drawerView === 'takers' ? 'รายชื่อ'
      : drawerView === 'questions' ? 'ข้อสอบ'
        : drawerView === 'score-summary' ? 'สรุปคะแนน'
          : drawerView === 'score-config' ? 'เก็บคะแนน'
            : drawerView === 'score-settings' ? 'เชื่อมต่อ'
              : null;

  const handleSaveQuestionsInDrawer = useCallback(async (
    roundKey: string,
    questionSetId: string,
    questionIds: string[],
    questionSetByQuestionId: Record<string, string>,
    questionPoints: Record<string, number>,
    totalPoints: number,
  ) => {
    if (!onUpdateRoom) return;
    await saveRoomRoundQuestions(room, attempts, onUpdateRoom, {
      roundKey,
      questionSetId,
      questionIds,
      questionSetByQuestionId,
      questionPoints,
      totalPoints,
    });
    await loadRoomAttempts?.(room.id);
  }, [onUpdateRoom, room, attempts, loadRoomAttempts]);

  const handleSaveScoreConfigInDrawer = useCallback(async (data: Partial<ExamRoom['settings']>) => {
    if (!onUpdateRoom) return;
    await onUpdateRoom(room.id, {
      settings: { ...room.settings, ...data },
    });
  }, [onUpdateRoom, room.id, room.settings]);

  const handleSaveScoreSettingsInDrawer = useCallback(async (
    subjects: GradeBookSubjectLink[],
    scoreType: GradeScoreType,
  ) => {
    if (!onUpdateRoom) return;
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

  return (
    <Drawer open={open} onOpenChange={(next) => { if (!next) onClose(); }} direction="right">
      <DrawerContent
        className={cn(
          ROOM_DETAIL_DRAWER_CONTENT_CLASS,
          listExpanded && 'sm:data-[vaul-drawer-direction=right]:max-w-none',
        )}
      >
        <div className={ROOM_DETAIL_DRAWER_PANEL_CLASS}>
          <DrawerHeader className="shrink-0 border-b border-slate-100 px-5 pb-3 pt-5">
            <div className="relative flex min-h-10 items-center justify-start">
              <div className={cn('min-w-0 flex-1 text-left', canExpandList ? 'pr-24' : 'pr-12')}>
                <DrawerTitle className="line-clamp-2 min-h-[calc(1.375em*2)] text-balance font-sukhumvit text-[15px] font-black leading-snug text-slate-800 text-left">
                  {isEditing
                    ? 'แก้ไขรายละเอียดห้องสอบ'
                    : (drawerViewTitle ?? room.title)}
                </DrawerTitle>
                <DrawerDescription className="sr-only">
                  {room.title || 'รายละเอียดห้องสอบ'}
                </DrawerDescription>
              </div>
              <div className={DRAWER_HEADER_RIGHT_ACTIONS}>
                {canExpandList ? (
                  <button
                    type="button"
                    onClick={() => setListExpanded((v) => !v)}
                    className={cn(DRAWER_HEADER_ICON_BTN, 'hidden lg:inline-flex')}
                    aria-label={listExpanded ? 'หุบ Drawer' : 'ขยาย Drawer'}
                    title={listExpanded ? 'หุบ' : 'ขยายเต็มจอ'}
                  >
                    {listExpanded ? <HiArrowsPointingIn size={16} /> : <HiArrowsPointingOut size={16} />}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    if (isEditing) {
                      setIsEditing(false);
                      return;
                    }
                    if (isSubView) {
                      setDrawerView('info');
                      setListExpanded(false);
                      return;
                    }
                    onClose();
                  }}
                  className={DRAWER_HEADER_ICON_BTN}
                  aria-label={isEditing || isSubView ? 'กลับ' : 'ปิด'}
                  title={isEditing || isSubView ? 'กลับ' : 'ปิด'}
                >
                  {isEditing || isSubView ? <HiArrowLeft size={16} /> : <HiXMark size={16} />}
                </button>
              </div>
            </div>
          </DrawerHeader>

          {isEditing ? (
            <>
              {/* ─ edit mode: scrollable fields ─ */}
              <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-4 pb-4 scrollbar-hide">
                <form
                  id="edit-room-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void handleSave();
                  }}
                  className="space-y-4 text-left"
                >
                  {/* ชื่อห้องสอบ */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider pl-1">
                      ชื่อห้องสอบ <span className="text-rose-500">*</span>
                    </label>
                    <Input
                      value={form.title}
                      onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                      placeholder="เช่น สอบกลางภาค คณิตศาสตร์ ม.3"
                      className="h-10 rounded-xl border-none bg-slate-50/70 text-xs font-bold px-4"
                    />
                  </div>

                  {/* แผนก / ระดับชั้น / ห้องเรียน */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider pl-1">แผนก</label>
                      <select
                        value={form.departmentId}
                        onChange={(e) => setForm((p) => ({ ...p, departmentId: e.target.value as Department, gradeLevel: '', classId: '' }))}
                        className="h-10 w-full rounded-xl bg-slate-50/70 border-none px-3 text-xs font-bold outline-none"
                      >
                        <option value="">เลือกแผนก</option>
                        {Object.entries(DEPARTMENT_CONFIG).map(([id, cfg]) => (
                          <option key={id} value={id}>{cfg.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider pl-1">ระดับชั้น</label>
                      <select
                        value={form.gradeLevel}
                        onChange={(e) => setForm((p) => ({ ...p, gradeLevel: e.target.value, classId: '' }))}
                        disabled={!form.departmentId}
                        className="h-10 w-full rounded-xl bg-slate-50/70 border-none px-3 text-xs font-bold outline-none disabled:opacity-50"
                      >
                        <option value="">เลือกชั้น</option>
                        {gradeOptions.map((g) => (
                          <option key={g} value={g}>{g}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider pl-1">ห้อง</label>
                      <select
                        value={form.classId}
                        onChange={(e) => setForm((p) => ({ ...p, classId: e.target.value }))}
                        disabled={!form.departmentId}
                        className="h-10 w-full rounded-xl bg-slate-50/70 border-none px-3 text-xs font-bold outline-none disabled:opacity-50"
                      >
                        <option value="">เลือกห้อง</option>
                        {classOptions.map((c) => (
                          <option key={c.id} value={c.id}>{c.gradeLevel}/{c.roomNumber}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* กลุ่มสาระ */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider pl-1">กลุ่มสาระ</label>
                    <select
                      value={form.subjectGroupId}
                      onChange={(e) => setForm((p) => ({ ...p, subjectGroupId: e.target.value as SubjectGroupId, subSubjectGroup: '' }))}
                      className="h-10 w-full rounded-xl bg-slate-50/70 border-none px-3 text-xs font-bold outline-none"
                    >
                      <option value="">เลือกกลุ่มสาระ</option>
                      {subjectGroupOptions.map(([id, cfg]) => (
                        <option key={id} value={id}>{cfg.name}</option>
                      ))}
                    </select>
                  </div>

                  {subSubjectOptions.length > 0 && (
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider pl-1">
                        สาระย่อย <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={form.subSubjectGroup}
                        onChange={(e) => setForm((p) => ({ ...p, subSubjectGroup: e.target.value }))}
                        className="h-10 w-full rounded-xl bg-slate-50/70 border-none px-3 text-xs font-bold outline-none"
                      >
                        <option value="">เลือกสาระย่อย</option>
                        {subSubjectOptions.map((sub) => (
                          <option key={sub} value={sub}>{sub}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* รายวิชา */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider pl-1">รายวิชา</label>
                    <select
                      value={form.subjectId}
                      onChange={(e) => setForm((p) => ({ ...p, subjectId: e.target.value }))}
                      className="h-10 w-full rounded-xl bg-slate-50/70 border-none px-3 text-xs font-bold outline-none"
                    >
                      <option value="">เลือกรายวิชา</option>
                      {subjects.map((sub) => (
                        <option key={sub.id} value={sub.id}>[{sub.code}] {sub.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* รหัสผ่าน / เวลา */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider pl-1">
                        รหัสผ่าน <span className="text-rose-500">*</span>
                      </label>
                      <Input
                        value={form.password}
                        onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                        placeholder="รหัสผ่าน"
                        className="h-10 rounded-xl border-none bg-slate-50/70 text-xs font-bold px-4"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider pl-1">เวลา (นาที)</label>
                      <Input
                        type="number"
                        min={1}
                        value={form.durationMinutes}
                        onChange={(e) => setForm((p) => ({ ...p, durationMinutes: Number(e.target.value) }))}
                        className="h-10 rounded-xl border-none bg-slate-50/70 text-xs font-bold px-4"
                      />
                    </div>
                  </div>

                  {/* จำนวนครั้ง */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider pl-1">จำนวนครั้งที่สอบได้</label>
                    <select
                      value={form.maxAttempts}
                      onChange={(e) => setForm((p) => ({ ...p, maxAttempts: Number(e.target.value) }))}
                      className="h-10 w-full rounded-xl bg-slate-50/70 border-none px-3 text-xs font-bold outline-none"
                    >
                      <option value={0}>ไม่จำกัดจำนวนครั้ง</option>
                      <option value={1}>1 ครั้ง</option>
                      <option value={2}>2 ครั้ง</option>
                      <option value={3}>3 ครั้ง</option>
                    </select>
                  </div>

                  {/* ตัวเลือกเพิ่มเติม */}
                  <div className="space-y-3 pt-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider pl-1">ตัวเลือกการสอบ</label>
                    <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/50 px-4 py-2.5">
                      <span className="text-[11px] font-bold text-slate-600 font-sukhumvit">สลับข้อสอบและตัวเลือก</span>
                      <Switch
                        checked={form.shuffleQuestions}
                        onCheckedChange={(checked) => setForm((p) => ({ ...p, shuffleQuestions: checked }))}
                      />
                    </div>
                    <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/50 px-4 py-2.5">
                      <span className="text-[11px] font-bold text-slate-600 font-sukhumvit">แสดงผลคะแนนทันทีหลังส่ง</span>
                      <Switch
                        checked={form.showResultImmediately}
                        onCheckedChange={(checked: boolean) => setForm((p) => ({ ...p, showResultImmediately: checked as true }))}
                      />
                    </div>
                  </div>
                </form>
              </div>

              {/* ─ sticky footer ─ */}
              <div className="shrink-0 border-t border-slate-100 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsEditing(false)}
                  className="flex-1 rounded-xl font-bold h-10 text-xs text-slate-500"
                >
                  ยกเลิก
                </Button>
                <Button
                  form="edit-room-form"
                  type="submit"
                  disabled={isSaving || !form.title || !form.password}
                  className="flex-1 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold h-10 text-xs border border-slate-800"
                >
                  {isSaving ? 'กำลังบันทึก...' : 'บันทึก'}
                </Button>
              </div>
            </>
          ) : drawerView === 'takers' ? (
            <div
              className={cn(
                'min-h-0 flex-1 px-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3',
                listExpanded ? 'flex flex-col overflow-hidden' : 'overflow-y-auto scrollbar-hide',
              )}
            >
              <TakersDrawerPanel
                room={room}
                attempts={attempts}
                loadRoomAttempts={loadRoomAttempts}
                canEdit={canEdit}
                onResetStudent={onResetStudent}
                layout={listLayout}
              />
            </div>
          ) : drawerView === 'questions' ? (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
              <QuestionsPanel
                room={room}
                attempts={attempts}
                onSave={handleSaveQuestionsInDrawer}
                onContentClick={() => {}}
                compact={!listExpanded}
                fillParent={listExpanded}
              />
            </div>
          ) : drawerView === 'score-summary' ? (
            <div
              className={cn(
                'min-h-0 flex-1 px-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3',
                listExpanded ? 'flex flex-col overflow-hidden' : 'overflow-y-auto scrollbar-hide',
              )}
            >
              <ScoreSummaryDrawerPanel
                room={room}
                attempts={attempts}
                loadRoomAttempts={loadRoomAttempts}
                onRecalculateScores={onRecalculateScores}
                layout={listLayout}
              />
            </div>
          ) : drawerView === 'score-config' ? (
            <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 scrollbar-hide">
              <ScoreConfigPanel
                room={room}
                onSave={handleSaveScoreConfigInDrawer}
              />
            </div>
          ) : drawerView === 'score-settings' ? (
            <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 scrollbar-hide">
              <ScoreSettingsPanel
                room={room}
                onSave={handleSaveScoreSettingsInDrawer}
              />
            </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 scrollbar-hide">
              {canEdit && !isStudent && (
                <div className="mb-4 grid grid-cols-3 gap-2">
                  {DRAWER_QUICK_TABS.map((tab) => {
                    const cfg = TAB_CONFIG[tab];
                    const Icon = cfg.icon;
                    const isQuestionsOk = tab === 'questions' && !hasNoQuestions;
                    const isScoreConnected = tab === 'score-settings' && hasScoreConnection;
                    const isOk = isQuestionsOk || isScoreConnected;
                    const isRedWarning =
                      (tab === 'questions' && hasNoQuestions)
                      || (tab === 'score-settings' && !hasScoreConnection);
                    const toneClass = isOk
                      ? 'border-emerald-200 bg-emerald-50 hover:bg-emerald-100/80 text-emerald-700 shadow-xs'
                      : isRedWarning
                        ? 'border-rose-200 bg-rose-50 hover:bg-rose-100/80 text-rose-600 shadow-xs'
                        : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600';
                    const iconTone = isOk
                      ? 'text-emerald-700'
                      : isRedWarning
                        ? 'text-rose-600'
                        : 'text-slate-600';
                    return (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => {
                          if (tab === 'takers') {
                            setDrawerView('takers');
                            return;
                          }
                          if (tab === 'questions') {
                            setDrawerView('questions');
                            return;
                          }
                          if (tab === 'score-summary') {
                            setDrawerView('score-summary');
                            return;
                          }
                          if (tab === 'score-config') {
                            setDrawerView('score-config');
                            return;
                          }
                          if (tab === 'score-settings') {
                            setDrawerView('score-settings');
                            return;
                          }
                          onClose();
                          onOpenSettings(tab);
                        }}
                        className={cn(
                          'flex flex-col items-center gap-1 rounded-lg border px-3 py-2 transition-colors',
                          toneClass,
                        )}
                      >
                        <Icon className={cn('w-4 h-4', iconTone)} />
                        <span className={cn('text-[10px] font-bold font-sukhumvit', iconTone)}>
                          {cfg.label}
                        </span>
                      </button>
                    );
                  })}
                  {/* ── ปุ่มลบห้องสอบ ── */}
                  {onDelete && (
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`ลบห้องสอบ "${room.title}" หรือไม่?`)) {
                          onClose();
                          onDelete();
                        }
                      }}
                      className="flex flex-col items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 hover:bg-slate-100 text-slate-600 transition-colors"
                    >
                      <HiMiniTrash className="w-4 h-4 text-slate-600" />
                      <span className="text-[10px] font-bold font-sukhumvit text-slate-600">ลบ</span>
                    </button>
                  )}
                </div>
              )}
              {canEdit && !isStudent && (
                <>
                  <div className="mb-4 flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/50 px-4 py-3">
                    <div className="flex flex-col text-left">
                      <span className="text-[12px] font-black text-slate-800 font-sukhumvit">แก้ไขห้องสอบ</span>
                      <span className="text-[10px] text-slate-500 font-sukhumvit">
                        เปิดเพื่อสลับเข้าสู่โหมดแก้ไขรายละเอียดห้องสอบ
                      </span>
                    </div>
                    <Switch
                      checked={isEditing}
                      onCheckedChange={(checked) => setIsEditing(checked)}
                    />
                  </div>
                  <div className="mb-4 flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/50 px-4 py-3">
                    <div className="flex flex-col text-left">
                      <span className="text-[12px] font-black text-slate-800 font-sukhumvit">สถานะห้องสอบ</span>
                      <span className="text-[10px] text-slate-500 font-sukhumvit">
                        {room.status === 'closed' ? 'ปิดแล้ว (เปิดเพื่อเปิดห้องสอบอีกครั้ง)' : 'เปิดอยู่ (ปิดเพื่อจบห้องสอบถาวร)'}
                      </span>
                    </div>
                    <Switch
                      checked={room.status !== 'closed'}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          onChangeStatus?.('upcoming');
                        } else {
                          onFinish?.();
                        }
                      }}
                    />
                  </div>
                </>
              )}
              <div className="mb-4 flex justify-center">
                <RoomCardStatusPill room={room} />
              </div>
              <div className="flex flex-col divide-y divide-slate-100">
                {rows.map((row) => (
                  <div key={row.label} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                    <span className="shrink-0 text-[11px] font-bold text-slate-500 font-sukhumvit">{row.label}</span>
                    <span className={cn(
                      "min-w-0 truncate text-[12px] font-bold font-sukhumvit text-right",
                      row.isWarning ? "text-rose-500" : "text-slate-800"
                    )}>
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

// ── Room Card ─────────────────────────────────────────────────────────────────
function RoomCard({
  room, onProctor, onChangeStatus, onFinish, onDelete, onEdit, onOpenSettings, isStudent, onTakeExam,
  onOpenStudentScores,
  canEdit, canDelete, alert, onUpdateRoom,
  attempts, loadRoomAttempts, onRecalculateScores,
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
  /** Student: open own-score panel instead of teacher detail drawer */
  onOpenStudentScores?: () => void;
  canEdit?: boolean;
  canDelete?: boolean;
  /** ตรวจพบนักเรียนสลับหน้าจอ — การ์ดจะเปลี่ยนหน้าแสดงชื่อชั่วคราว (ไม่ใช้กับมุมมองนักเรียน) */
  alert?: { studentName: string; key: number } | null;
  onUpdateRoom?: (roomId: string, data: Partial<ExamRoom>) => Promise<void>;
  attempts?: ExamAttempt[];
  loadRoomAttempts?: (roomId: string) => Promise<void>;
  onRecalculateScores?: (roomId: string, round: number) => Promise<void>;
}) {
  const { role } = useAuth();
  const [showDetail, setShowDetail] = useState(false);
  // ponytail: mark unused props as read to satisfy TS6133
  void onDelete;
  void canDelete;
  const needsQuestionSetup = Boolean(!isStudent && canEdit && !isExamRoomQuestionsConfigured(room));


  const showStudentTakeExam = Boolean(isStudent && room.status === 'active');

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
            onClick={() => {
              if (isStudent) onOpenStudentScores?.();
              else setShowDetail(true);
            }}
            className={cn(
              'h-48 w-48 shrink-0 object-contain drop-shadow-sm cursor-pointer',
              room.status === 'closed' && 'opacity-50 grayscale',
              room.status === 'active' && 'animate-pulse drop-shadow-[0_0_16px_rgba(34,197,94,0.75)]',
            )}
          />
          {!isStudent && (
            <ScoreCollectionBadgeButton
              room={room}
              canEdit={canEdit}
              onOpenSettings={onOpenSettings}
              onUpdateRoom={onUpdateRoom}
            />
          )}
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
          {!isStudent && canEdit && room.status === 'upcoming' && (
            <motion.button
              type="button"
              whileTap={{ scale: 0.92 }}
              onClick={() => onChangeStatus('active')}
              title={
                needsQuestionSetup
                  ? 'กรุณาบันทึกชุดข้อสอบก่อนเปิดห้องสอบ'
                  : `เริ่มรอบ ${(room.completedRounds ?? 0) + 1}`
              }
              aria-label={
                needsQuestionSetup
                  ? 'ยังไม่ได้ตั้งค่าข้อสอบ'
                  : `เริ่มรอบ ${(room.completedRounds ?? 0) + 1}`
              }
              className={cn(
                'absolute inset-0 m-auto flex h-14 w-14 items-center justify-center rounded-full bg-white/40 backdrop-blur-md border border-white/50 shadow-lg transition-colors',
                needsQuestionSetup
                  ? 'text-slate-500 hover:bg-white/60'
                  : 'text-emerald-700 hover:bg-white/60',
              )}
            >
              {needsQuestionSetup ? (
                <HiLockClosed className="w-6 h-6" />
              ) : (
                <HiPlay className="w-6 h-6" />
              )}
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
          {!isStudent && room.status === 'closed' && (
            <motion.button
              type="button"
              whileTap={{ scale: 0.92 }}
              onClick={() => setShowDetail(true)}
              title="ดูรายละเอียดห้องสอบ"
              aria-label="ดูรายละเอียดห้องสอบ"
              className="absolute inset-0 m-auto flex h-14 w-14 items-center justify-center rounded-full bg-white/40 backdrop-blur-md border border-white/50 text-slate-700 shadow-lg hover:bg-white/60 transition-colors"
            >
              <HiEye className="w-6 h-6" />
            </motion.button>
          )}
          {role === 'teacher' && (room.className || getExamRoomGradeLevel(room)) && (() => {
            const label = room.className || getExamRoomGradeLevel(room);
            return (
              <span
                className="absolute bottom-2 left-2 z-10 inline-flex max-w-[calc(100%-2.75rem)] items-center rounded-full bg-white/30 backdrop-blur-xl border border-white/40 px-2 py-0.5 text-[9px] font-bold text-slate-700 truncate shadow-lg ring-1 ring-black/5"
                title={label}
              >
                {label}
              </span>
            );
          })()}
          {!isStudent && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowDetail(true);
              }}
              className={cn(
                'absolute bottom-2 right-2 z-10 inline-flex h-7 w-7 items-center justify-center rounded-full backdrop-blur-xl border shadow-lg ring-1 ring-black/5 transition-colors',
                hasScoreConnection
                  ? 'bg-emerald-500/90 border-emerald-400/80 text-white hover:bg-emerald-500'
                  : 'bg-white/30 border-white/40 text-slate-700 hover:bg-white/45',
              )}
              title={
                needsQuestionSetup
                  ? 'กรุณาบันทึกชุดข้อสอบก่อนเปิดห้องสอบ'
                  : hasScoreConnection
                    ? 'ตั้งค่าห้องสอบ · เชื่อมต่อรายวิชาแล้ว'
                    : 'ตั้งค่าห้องสอบ'
              }
              aria-label={
                needsQuestionSetup
                  ? 'ยังไม่ได้ตั้งค่าข้อสอบ'
                  : hasScoreConnection
                    ? 'ตั้งค่าห้องสอบ เชื่อมต่อรายวิชาแล้ว'
                    : 'ตั้งค่าห้องสอบ'
              }
            >
              <HiCog6Tooth className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="w-full space-y-1">
          <h3
            className="text-[13px] font-black text-slate-800 font-sukhumvit leading-snug line-clamp-2 min-h-[calc(1.375em*2)]"
            title={room.title}
          >
            {room.title}
          </h3>
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
        {!isStudent && canEdit && room.status === 'active' && (
          <div className="flex items-center justify-center gap-1.5">
            <RoomCardIconButton onClick={onProctor} title="Proctor">
              <HiEye className="w-4 h-4" />
            </RoomCardIconButton>
          </div>
        )}
      </div>
          </motion.div>
        )}
      </AnimatePresence>
      {showDetail && !isStudent && (
        <RoomIconDetailDrawer
          open={showDetail}
          onClose={() => setShowDetail(false)}
          room={room}
          canEdit={canEdit}
          isStudent={isStudent}
          onOpenSettings={(tab) => onOpenSettings(tab)}
          onEdit={onEdit}
          onDelete={onDelete}
          onChangeStatus={onChangeStatus}
          onFinish={onFinish}
          onUpdateRoom={onUpdateRoom}
          attempts={attempts}
          loadRoomAttempts={loadRoomAttempts}
          onRecalculateScores={onRecalculateScores}
        />
      )}
    </motion.div>
  );
}

// ── Score Config Panel ────────────────────────────────────────────────────────

function ScoreConfigPanel({ room, onSave }: {
  room: ExamRoom;
  onSave: (data: Partial<ExamRoom['settings']>) => Promise<void>;
}) {
  const initialType = (room.settings?.scoreCollectionType as ScoreCollectionType) ?? 'classwork';
  const initialEnabled = room.settings?.scoreCollectionEnabled === true;
  const [scoreType, setScoreType] = useState<ScoreCollectionType>(initialType);
  const [enabled, setEnabled] = useState(initialEnabled);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState<
    | { kind: 'select'; type: ScoreCollectionType }
    | { kind: 'clear'; type: ScoreCollectionType }
    | null
  >(null);
  const lastSavedRef = useRef({ enabled: initialEnabled, scoreType: initialType });
  const suppressDebounceRef = useRef(true);
  const savedFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flashSaved = useCallback(() => {
    setSaved(true);
    if (savedFlashTimerRef.current) clearTimeout(savedFlashTimerRef.current);
    savedFlashTimerRef.current = setTimeout(() => setSaved(false), 2000);
  }, []);

  useEffect(() => () => {
    if (savedFlashTimerRef.current) clearTimeout(savedFlashTimerRef.current);
  }, []);

  useEffect(() => {
    if (suppressDebounceRef.current) {
      suppressDebounceRef.current = false;
      return;
    }
    const last = lastSavedRef.current;
    if (enabled === last.enabled && scoreType === last.scoreType) return;

    const snapshot = { enabled, scoreType };
    const prev = last;
    const timer = setTimeout(() => {
      void (async () => {
        setIsSaving(true);
        setSaved(false);
        try {
          await onSave({
            scoreCollectionEnabled: snapshot.enabled,
            scoreCollectionType: snapshot.scoreType,
          });
          lastSavedRef.current = snapshot;
          flashSaved();
        } catch {
          toast.error('บันทึกการตั้งค่าคะแนนไม่สำเร็จ');
          suppressDebounceRef.current = true;
          setEnabled(prev.enabled);
          setScoreType(prev.scoreType);
        } finally {
          setIsSaving(false);
        }
      })();
    }, AUTO_SAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [enabled, scoreType, onSave, flashSaved]);

  const requestSelectType = (type: ScoreCollectionType) => {
    if (enabled && type === scoreType) {
      setPending({ kind: 'clear', type });
      return;
    }
    setPending({ kind: 'select', type });
  };

  const confirmPending = () => {
    if (!pending) return;
    if (pending.kind === 'clear') {
      setEnabled(false);
    } else {
      setScoreType(pending.type);
      setEnabled(true);
    }
    setPending(null);
  };

  const pendingLabel = pending ? SCORE_COLLECTION_CONFIG[pending.type].label : '';
  const isClearing = pending?.kind === 'clear';

  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="flex flex-col gap-2">
          {(Object.entries(SCORE_COLLECTION_CONFIG) as [ScoreCollectionType, typeof SCORE_COLLECTION_CONFIG[ScoreCollectionType]][]).map(([type, c]) => {
            const isActive = enabled && scoreType === type;
            return (
              <motion.button
                key={type}
                whileTap={{ scale: 0.98 }}
                onClick={() => requestSelectType(type)}
                className="flex flex-col gap-1 px-4 py-3 rounded-lg text-left transition-all"
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

      <AutoSaveStatus isSaving={isSaving} saved={saved} />

      <AlertDialog
        open={!!pending}
        onOpenChange={(open) => {
          if (!open) setPending(null);
        }}
      >
        <AlertDialogContent className="max-w-sm rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-sukhumvit">
              {isClearing ? 'ยืนยันการยกเลิกประเภทคะแนน' : 'ยืนยันประเภทการเก็บคะแนน'}
            </AlertDialogTitle>
            <AlertDialogDescription className="font-sarabun">
              {isClearing
                ? `ต้องการยกเลิก「${pendingLabel}」หรือไม่? คะแนนสอบนี้จะไม่ถูกนำไปคำนวณในสมุดบันทึกคะแนน และระบบจะบันทึกอัตโนมัติหลังยืนยัน`
                : `ต้องการตั้งค่าเป็น「${pendingLabel}」หรือไม่? คะแนนสอบนี้จะถูกนำไปคำนวณในสมุดบันทึกคะแนน และระบบจะบันทึกอัตโนมัติหลังยืนยัน`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              variant={isClearing ? 'destructive' : 'default'}
              onClick={confirmPending}
            >
              ยืนยัน
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Room Detail View (inline 4-tab settings) ──────────────────────────────────
type SettingsTab = 'takers' | 'questions' | 'score-settings' | 'score-config' | 'score-summary';

const TAB_CONFIG: Record<SettingsTab, { label: string; icon: IconType }> = {
  takers: { label: 'รายชื่อ', icon: HiUsers },
  questions: { label: 'ข้อสอบ', icon: HiDocumentText },
  'score-settings': { label: 'เชื่อมต่อ', icon: HiLink },
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

  const getRoundTotalPoints = useCallback(
    (round: number) => getExamRoomRoundTotalPoints(room, round),
    [room],
  );

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
        ? 'bg-primary/5'
        : isLowestScorer
          ? 'bg-destructive/5'
          : '';
      const bestScoreClass = examScorePercentBadgeClass(bestScorePercentDisplay);

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

  /** นักเรียน + 1 คอลัมน์ต่อรอบ + คอลัมน์สูงสุด */
  const summaryTableGrid = useMemo(
    () =>
      ['minmax(0, 2.2fr)', ...roundNumbers.map(() => 'minmax(5rem, 0.85fr)'), 'minmax(5rem, 0.85fr)'].join(' '),
    [roundNumbers],
  );

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

  const handleSaveQuestions = (
    roundKey: string,
    questionSetId: string,
    questionIds: string[],
    questionSetByQuestionId: Record<string, string>,
    questionPoints: Record<string, number>,
    totalPoints: number,
  ) => saveRoomRoundQuestions(room, attempts, onUpdateRoom, {
    roundKey,
    questionSetId,
    questionIds,
    questionSetByQuestionId,
    questionPoints,
    totalPoints,
  });

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

            {room.status === 'upcoming' && (() => {
              const questionsReady = isExamRoomQuestionsConfigured(room);
              return (
                <button
                  type="button"
                  onClick={() => {
                    closeRoomActionsMenu();
                    onChangeStatus('active');
                  }}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[13px] font-bold font-sukhumvit transition-colors',
                    questionsReady
                      ? 'text-emerald-700 hover:bg-emerald-50'
                      : 'text-slate-500 hover:bg-slate-50',
                  )}
                >
                  {questionsReady ? (
                    <Play size={16} fill="currentColor" className="shrink-0" />
                  ) : (
                    <HiLockClosed size={16} className="shrink-0" />
                  )}
                  <span>
                    {questionsReady
                      ? `เริ่มรอบ ${(room.completedRounds ?? 0) + 1}`
                      : 'ยังไม่ได้ตั้งค่าข้อสอบ'}
                  </span>
                </button>
              );
            })()}

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
                      ? 'bg-muted text-muted-foreground'
                      : att.status === 'submitted' || att.status === 'graded'
                        ? 'bg-emerald-500/10 text-emerald-600'
                        : 'bg-primary/10 text-primary';
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

                  const TAKERS_TABLE_GRID =
                    'minmax(0, 2.2fr) minmax(4.5rem, 0.7fr) minmax(5.5rem, 0.85fr) minmax(5rem, 0.85fr) minmax(8rem, 1.1fr)';

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
                                  className="h-9 w-9 shrink-0 rounded-full"
                                />
                                <div className="min-w-0 flex-1">
                                  <p
                                    className="text-[13px] font-bold text-foreground font-sukhumvit truncate"
                                    title={row.fullName}
                                  >
                                    {row.fullName}
                                  </p>
                                  <p className="mt-0.5 text-[12px] font-semibold text-blue-600 font-sukhumvit tabular-nums">
                                    รหัส {row.studentCode}
                                  </p>
                                </div>
                              </div>
                              <span
                                className={cn(
                                  'inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold font-sukhumvit whitespace-nowrap',
                                  row.statusClass,
                                )}
                              >
                                {row.statusLabel}
                              </span>
                            </div>
                            <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-border pt-2">
                              <div className="flex items-center gap-3">
                                <div>
                                  <p className="mb-0.5 text-[11px] font-bold text-muted-foreground font-sukhumvit">
                                    คะแนน รอบ {activeMobileRound} (%)
                                  </p>
                                  {row.hasScore ? (
                                    <span className="inline-flex items-center justify-center rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-bold text-primary font-sukhumvit tabular-nums">
                                      {row.scorePercent}%
                                    </span>
                                  ) : (
                                    <span className="text-[13px] font-bold text-muted-foreground/40">—</span>
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <p className="mb-0.5 text-[11px] font-bold text-muted-foreground font-sukhumvit">
                                    ส่งล่าสุด
                                  </p>
                                  <p className="truncate text-[12px] font-semibold text-muted-foreground font-sukhumvit tabular-nums">
                                    {row.submittedAt}
                                  </p>
                                </div>
                              </div>
                              {canEdit && onResetStudent && row.att && (
                                <motion.button
                                  type="button"
                                  whileTap={{ scale: 0.92 }}
                                  onClick={() => onResetStudent(row.att!.studentId, row.fullName)}
                                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border text-amber-500 transition-colors hover:bg-muted"
                                  title={`รีเซ็ตการสอบของ ${row.fullName}`}
                                  aria-label={`รีเซ็ตการสอบของ ${row.fullName}`}
                                >
                                  <RotateCcw size={14} />
                                </motion.button>
                              )}
                            </div>
                            </div>
                          </motion.div>
                        ))}
                      </div>

                      {/* Desktop: data-table grid */}
                      <div className={cn('hidden md:block min-h-0 flex-1 overflow-y-auto', TABLE_SHELL)}>
                        <div
                          className={TABLE_HEADER_ROW}
                          style={{ gridTemplateColumns: TAKERS_TABLE_GRID }}
                        >
                          <span className={TABLE_HEADER_CELL}>นักเรียน</span>
                          <span className={cn(TABLE_HEADER_CELL, 'text-center')}>รหัส</span>
                          <span className={cn(TABLE_HEADER_CELL, 'text-center')}>สถานะ</span>
                          <span className={cn(TABLE_HEADER_CELL, 'text-center')}>คะแนน (%)</span>
                          <span className={cn(TABLE_HEADER_CELL, 'text-center')}>ส่งล่าสุด</span>
                        </div>
                        <div className="flex flex-col">
                          {displayRows.map((row, index) => (
                            <motion.div
                              key={row.key}
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ delay: index * 0.015 }}
                              className={TABLE_ROW}
                              style={{ gridTemplateColumns: TAKERS_TABLE_GRID }}
                            >
                              <div className="flex min-w-0 items-center gap-2.5">
                                <StudentAvatar
                                  photoURL={row.photoURL}
                                  studentId={row.studentId || row.key}
                                  name={row.fullName}
                                  gender={row.gender}
                                  className="h-9 w-9 shrink-0 rounded-full"
                                />
                                <p
                                  className="truncate text-[13px] font-bold text-foreground font-sukhumvit"
                                  title={row.fullName}
                                >
                                  {row.fullName}
                                </p>
                              </div>
                              <p className="text-center text-[13px] font-black text-blue-600 font-sukhumvit tabular-nums">
                                {row.studentCode || '—'}
                              </p>
                              <div className="flex justify-center">
                                <span
                                  className={cn(
                                    'inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold font-sukhumvit whitespace-nowrap',
                                    row.statusClass,
                                  )}
                                >
                                  {row.statusLabel}
                                </span>
                              </div>
                              <div className="flex justify-center">
                                {row.hasScore ? (
                                  <span className="inline-flex rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-bold text-primary font-sukhumvit tabular-nums">
                                    {row.scorePercent}%
                                  </span>
                                ) : (
                                  <span className="text-[13px] font-bold text-muted-foreground/40">—</span>
                                )}
                              </div>
                              <div className="flex items-center justify-center gap-1.5 min-w-0">
                                <span className="truncate text-[12px] font-semibold text-muted-foreground font-sukhumvit tabular-nums">
                                  {row.submittedAt === '-' ? '—' : row.submittedAt}
                                </span>
                                {canEdit && onResetStudent && row.att && (
                                  <button
                                    type="button"
                                    onClick={() => onResetStudent(row.att!.studentId, row.fullName)}
                                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border text-amber-500 transition-colors hover:bg-muted"
                                    title={`รีเซ็ตการสอบของ ${row.fullName}`}
                                    aria-label={`รีเซ็ตการสอบของ ${row.fullName}`}
                                  >
                                    <RotateCcw size={12} />
                                  </button>
                                )}
                              </div>
                            </motion.div>
                          ))}
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
                />
              )}
              {activeTab === 'score-config' && (
                <ScoreConfigPanel
                  room={room}
                  onSave={handleSaveScoreConfig}
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
                    <MobileRoundSelect
                      rounds={roundNumbers}
                      value={activeMobileRound}
                      onChange={setMobileSelectedRound}
                      className="md:hidden px-1.5"
                    />

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
                                    className="h-9 w-9 shrink-0 rounded-full"
                                  />
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2 min-w-0">
                                      {row.hasAnyAttempt ? (
                                        <button
                                          type="button"
                                          onClick={() => openScoreDetail(row.student, row.attemptsByRound)}
                                          className="text-[13px] font-bold text-foreground font-sukhumvit truncate text-left hover:text-primary hover:underline underline-offset-2"
                                          title={row.student.fullName}
                                        >
                                          {row.student.fullName}
                                        </button>
                                      ) : (
                                        <p
                                          className="text-[13px] font-bold text-foreground font-sukhumvit truncate"
                                          title={row.student.fullName}
                                        >
                                          {row.student.fullName}
                                        </p>
                                      )}
                                      {row.isTopScorer && (
                                        <span className="inline-flex shrink-0 rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-bold text-primary font-sukhumvit">
                                          สูงสุด
                                        </span>
                                      )}
                                      {!row.isTopScorer && row.isLowestScorer && (
                                        <span className="inline-flex shrink-0 rounded-full bg-destructive/10 px-2.5 py-0.5 text-[10px] font-bold text-destructive font-sukhumvit">
                                          ต่ำสุด
                                        </span>
                                      )}
                                    </div>
                                    <p className="mt-0.5 text-[12px] font-semibold text-muted-foreground font-sukhumvit tabular-nums">
                                      รหัส {row.student.studentCode || '—'}
                                    </p>
                                  </div>
                                </div>
                                <div className="shrink-0 text-center">
                                  <p className="mb-0.5 text-[11px] font-bold text-muted-foreground font-sukhumvit">
                                    สูงสุด (%)
                                  </p>
                                  {row.bestScorePercent !== null ? (
                                    <span
                                      className={cn(
                                        'inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-[10px] font-bold font-sukhumvit tabular-nums',
                                        row.bestScoreClass,
                                      )}
                                    >
                                      {row.bestScorePercent}%
                                    </span>
                                  ) : (
                                    <span className="text-[13px] font-bold text-muted-foreground/40">—</span>
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
                              <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-border pt-2">
                                <div className="flex items-center gap-1">
                                  <p className="text-[11px] font-bold text-muted-foreground font-sukhumvit">
                                    ครั้ง {round}
                                  </p>
                                  {roundEssayMeta[round]?.hasManualEssay && (
                                    <button
                                      type="button"
                                      onClick={() => openManualGrading(round)}
                                      className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-500/10 text-amber-600"
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
                                      'inline-flex items-center justify-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold font-sukhumvit tabular-nums transition-colors',
                                      needsManualReview
                                        ? 'bg-amber-500/10 text-amber-600 hover:bg-amber-500/20'
                                        : cn(examScorePercentBadgeClass(roundScorePercent), 'hover:opacity-90'),
                                    )}
                                    title={`${formatScorePoints(roundScore)}/${formatScorePoints(roundTotal)} คะแนน (${roundScorePercent}%)${needsManualReview ? ' — รอตรวจข้ออัตนัย' : ''} — ดูรายละเอียด`}
                                  >
                                    {formatScorePoints(roundScore)}/{formatScorePoints(roundTotal)}
                                    {roundScorePercent !== null ? ` · ${roundScorePercent}%` : ''}
                                    {needsManualReview && <HiMiniPencil size={10} className="shrink-0" />}
                                  </button>
                                ) : isInProgress ? (
                                  <span className="inline-flex rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-bold text-primary font-sukhumvit">
                                    กำลังสอบ
                                  </span>
                                ) : isPending ? (
                                  <button
                                    type="button"
                                    onClick={() => openScoreDetail(row.student, row.attemptsByRound, round)}
                                    className="inline-flex rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-bold text-amber-600 font-sukhumvit hover:bg-amber-500/20"
                                    title="ดูรายละเอียดคำตอบ"
                                  >
                                    รอตรวจ
                                  </button>
                                ) : (
                                  <span className="text-[13px] font-bold text-muted-foreground/40">—</span>
                                )}
                              </div>
                                );
                              })()}
                              </div>
                            </motion.div>
                          ))}
                        </div>

                        {/* Desktop: table */}
                        <div className={cn('hidden md:block', TABLE_SHELL)}>
                          {role === 'teacher' && bulkEditMode && (
                            <div className="flex flex-col gap-2 border-b border-border bg-muted/40 px-4 py-3 sm:flex-row sm:items-center">
                              <input
                                value={bulkReason}
                                onChange={(e) => setBulkReason(e.target.value)}
                                placeholder="เหตุผลที่แก้ไขคะแนน (ใช้กับทุกคะแนนที่แก้ในครั้งนี้)"
                                className="h-9 flex-1 rounded-xl border border-border bg-card px-3 text-[12px] text-foreground font-sarabun outline-none focus:ring-2 focus:ring-ring/30"
                              />
                              <div className="flex gap-2 shrink-0">
                                <button
                                  type="button"
                                  disabled={isBulkSubmitting}
                                  onClick={() => void submitBulkOverrides()}
                                  className="h-9 rounded-xl bg-primary px-4 text-[12px] font-black text-primary-foreground font-sukhumvit hover:bg-primary/90 disabled:opacity-60"
                                >
                                  {isBulkSubmitting ? 'กำลังส่ง...' : 'ส่งคำขอทั้งหมด'}
                                </button>
                                <button
                                  type="button"
                                  onClick={cancelBulkEditMode}
                                  className="h-9 rounded-xl border border-border bg-card px-4 text-[12px] font-bold text-muted-foreground font-sukhumvit hover:bg-muted/60"
                                >
                                  ยกเลิก
                                </button>
                              </div>
                            </div>
                          )}
                          <div className="overflow-x-auto">
                            <div className="min-w-full">
                              <div className={TABLE_HEADER_ROW} style={{ gridTemplateColumns: summaryTableGrid }}>
                                <div className="flex items-center gap-1.5">
                                  <span className={TABLE_HEADER_CELL}>นักเรียน</span>
                                  {role === 'teacher' && (
                                    <button
                                      type="button"
                                      onClick={() => (bulkEditMode ? cancelBulkEditMode() : enterBulkEditMode())}
                                      className={cn(
                                        'flex h-6 w-6 items-center justify-center rounded-full transition-colors',
                                        bulkEditMode
                                          ? 'bg-primary text-primary-foreground'
                                          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
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
                                      className="flex h-6 items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 text-emerald-600 transition-colors hover:bg-emerald-500/20 disabled:opacity-60"
                                      title="อนุมัติคำขอแก้ไขคะแนนทั้งหมดในห้องนี้"
                                    >
                                      <HiCheckCircle size={12} />
                                      <span className="text-[10px] font-bold font-sukhumvit">
                                        {isApprovingAll ? 'กำลังอนุมัติ...' : `อนุมัติทั้งหมด (${pendingOverridesByAttemptId.size})`}
                                      </span>
                                    </button>
                                  )}
                                </div>
                                {roundNumbers.map((round) => (
                                  <span key={round} className={cn(TABLE_HEADER_CELL, 'text-center')}>
                                    {renderRoundHeader(round)}
                                  </span>
                                ))}
                                <span className={cn(TABLE_HEADER_CELL, 'text-center')}>สูงสุด (%)</span>
                              </div>

                              <div className="flex flex-col">
                                {pagedSummaryRows.map((row, rowIndex) => (
                                  <motion.div
                                    key={row.student.id}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: rowIndex * 0.015 }}
                                    className={cn(TABLE_ROW, row.rowHighlightClass)}
                                    style={{ gridTemplateColumns: summaryTableGrid }}
                                  >
                                    <div className="flex min-w-0 items-center gap-3">
                                      <StudentAvatar
                                        photoURL={row.student.photoURL}
                                        studentId={row.student.id}
                                        name={row.student.fullName}
                                        gender={row.student.gender}
                                        className="h-9 w-9 shrink-0 rounded-full"
                                      />
                                      <div className="min-w-0">
                                        <div className="flex min-w-0 items-center gap-2">
                                          {row.hasAnyAttempt ? (
                                            <button
                                              type="button"
                                              onClick={() => openScoreDetail(row.student, row.attemptsByRound)}
                                              className="truncate text-left text-[13px] font-bold text-foreground font-sukhumvit hover:text-primary hover:underline underline-offset-2"
                                              title={row.student.fullName}
                                            >
                                              {row.student.fullName}
                                            </button>
                                          ) : (
                                            <p
                                              className="truncate text-[13px] font-bold text-foreground font-sukhumvit"
                                              title={row.student.fullName}
                                            >
                                              {row.student.fullName}
                                            </p>
                                          )}
                                          {row.isTopScorer && (
                                            <span className="inline-flex shrink-0 rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-bold text-primary font-sukhumvit">
                                              สูงสุด
                                            </span>
                                          )}
                                          {!row.isTopScorer && row.isLowestScorer && (
                                            <span className="inline-flex shrink-0 rounded-full bg-destructive/10 px-2.5 py-0.5 text-[10px] font-bold text-destructive font-sukhumvit">
                                              ต่ำสุด
                                            </span>
                                          )}
                                        </div>
                                        <p className="text-[13px] font-black text-blue-600 font-sukhumvit tabular-nums">
                                          {row.student.studentCode || '—'}
                                        </p>
                                      </div>
                                    </div>

                                    {row.rounds.map(({ round, att, roundScore, roundScorePercent, hasScore, isPending, isInProgress, needsManualReview, roundTotal }) => {
                                      const pendingReq = att ? pendingOverridesByAttemptId.get(att.id) : undefined;
                                      return (
                                      <div key={`${row.student.id}-${round}`} className="text-center">
                                        {bulkEditMode && hasScore && att ? (
                                          pendingReq ? (
                                            <span
                                              className="inline-flex rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-bold text-muted-foreground font-sukhumvit"
                                              title={`รออนุมัติ: ${formatScorePoints(pendingReq.previousScore)} → ${formatScorePoints(pendingReq.requestedScore)}`}
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
                                                className="h-8 w-16 rounded-xl border border-border bg-card px-1 text-center text-[12px] font-black text-foreground font-sukhumvit tabular-nums outline-none focus:ring-2 focus:ring-ring/30"
                                                aria-label={`คะแนนใหม่ ${row.student.fullName} รอบ ${round}`}
                                              />
                                              <span className="text-[10px] text-muted-foreground font-sarabun">/{roundTotal}</span>
                                            </div>
                                          )
                                        ) : hasScore && pendingReq ? (
                                          <button
                                            type="button"
                                            onClick={() => openScoreDetail(row.student, row.attemptsByRound, round)}
                                            className="inline-flex items-center justify-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-bold text-primary font-sukhumvit tabular-nums hover:bg-primary/20"
                                            title={`รอ sysadmin/ผู้บริหารอนุมัติ — เหตุผล: ${pendingReq.reason}`}
                                          >
                                            {formatScorePoints(pendingReq.previousScore)} → {formatScorePoints(pendingReq.requestedScore)}
                                          </button>
                                        ) : hasScore ? (
                                          <button
                                            type="button"
                                            onClick={() => openScoreDetail(row.student, row.attemptsByRound, round)}
                                            className={cn(
                                              'inline-flex items-center justify-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold font-sukhumvit tabular-nums transition-colors',
                                              needsManualReview
                                                ? 'bg-amber-500/10 text-amber-600 hover:bg-amber-500/20'
                                                : cn(examScorePercentBadgeClass(roundScorePercent), 'hover:opacity-90'),
                                            )}
                                            title={`${formatScorePoints(roundScore)}/${formatScorePoints(roundTotal)} คะแนน (${roundScorePercent}%)${needsManualReview ? ' — รอตรวจข้ออัตนัย' : ''} — ดูรายละเอียด`}
                                          >
                                            {formatScorePoints(roundScore)}/{formatScorePoints(roundTotal)}
                                            {roundScorePercent !== null ? ` · ${roundScorePercent}%` : ''}
                                            {needsManualReview && <HiMiniPencil size={11} className="shrink-0" />}
                                          </button>
                                        ) : isInProgress ? (
                                          <span className="inline-flex rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-bold text-primary font-sukhumvit">
                                            กำลังสอบ
                                          </span>
                                        ) : isPending ? (
                                          <button
                                            type="button"
                                            onClick={() => openScoreDetail(row.student, row.attemptsByRound, round)}
                                            className="inline-flex rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-bold text-amber-600 font-sukhumvit hover:bg-amber-500/20"
                                            title="ดูรายละเอียดคำตอบ"
                                          >
                                            รอตรวจ
                                          </button>
                                        ) : (
                                          <span className="text-[13px] font-bold text-muted-foreground/40">—</span>
                                        )}
                                      </div>
                                      );
                                    })}

                                    <div className="text-center">
                                      {row.bestScorePercent !== null ? (
                                        <span
                                          className={cn(
                                            'inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-[10px] font-bold font-sukhumvit tabular-nums',
                                            row.bestScoreClass,
                                          )}
                                        >
                                          {row.bestScorePercent}%
                                        </span>
                                      ) : (
                                        <span className="text-[13px] font-bold text-muted-foreground/40">—</span>
                                      )}
                                    </div>
                                  </motion.div>
                                ))}

                                {pagedSummaryRows.length === 0 && (
                                  <div className="py-12 text-center text-muted-foreground">
                                    <p className="text-[13px] font-sarabun">ยังไม่มีข้อมูลนักเรียน</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
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
  const { homeDepartment, browseVisibleDepartments, isDeptScoped } = useBrowseVisibleDepartments();
  const isStudent = role === 'student';
  const { canEdit: canEditExam, canDelete: canDeleteExam } = useMyPermissions();
  const canEdit = canEditExam('exams');
  const canDelete = canDeleteExam('exams');

  // Declared before useExamRoom so their ids can be passed in as focusRoomIds — for
  // admin/staff/sysadmin (who see every active room school-wide, no teacherId filter) this
  // scopes live listeners to rooms actually opened here, instead of every active room in the
  // school getting re-listened by every concurrently-logged-in admin session.
  const [detailRoom, setDetailRoom] = useState<ExamRoom | null>(null);
  /** Student-only: own scores panel (never opens teacher RoomDetailView) */
  const [studentScoreRoom, setStudentScoreRoom] = useState<ExamRoom | null>(null);
  const [proctoringRoom, setProctoringRoom] = useState<ExamRoom | null>(null);
  const focusRoomIds = useMemo(
    () => [detailRoom?.id, proctoringRoom?.id].filter((id): id is string => Boolean(id)),
    [detailRoom?.id, proctoringRoom?.id],
  );

  const { rooms, attempts, isLoading, createRoom, updateRoom, updateRoomStatus, finishRoom, deleteRoom, getAttemptsForRoom, loadRoomAttempts, resetStudentAttempt, resetAllAttempts, calculateRoomScores } = useExamRoom({
    // Students only need own attempts; staff keep smart `all` (live for active rooms,
    // on-demand fetch for closed rooms via loadRoomAttempts — see below)
    loadAttempts: isStudent ? 'mine' : 'all',
    focusRoomIds,
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
  useEffect(() => {
    if (proctoringRoom) void loadRoomAttempts(proctoringRoom.id);
  }, [proctoringRoom?.id, loadRoomAttempts]);
  const [filterStatus, setFilterStatus] = useState<'all' | ExamRoom['status']>(isStudent ? 'active' : 'upcoming');
  const [filterScoreCollection, setFilterScoreCollection] = useState<ScoreCollectionFilterKey>('all');
  const [filterDepartment, setFilterDepartment] = useState<Department | 'all'>('all');
  const [filterGradeLevel, setFilterGradeLevel] = useState<string>('all');
  const [filterRoomNumber, setFilterRoomNumber] = useState<string>('all');
  const [filterSubjectGroup, setFilterSubjectGroup] = useState<SubjectGroupId | 'all'>('all');
  const [filterSubSubjectGroup, setFilterSubSubjectGroup] = useState<string>('all');
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  // Student มือถือ: false = การ์ดรายวิชา (browse), true = เลือกสถานะจากปุ่มกรองแล้ว โชว์รายการห้องสอบ
  const [mobileShowAllActive, setMobileShowAllActive] = useState(false);
  const [roomSearchText, setRoomSearchText] = useState('');
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

  useEffect(() => {
    setCurrentPage(1);
  }, [rooms, filterStatus, filterScoreCollection, filterDepartment, filterGradeLevel, filterRoomNumber, filterSubjectGroup, filterSubSubjectGroup, roomSearchText]);

  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [roomToDelete, setRoomToDelete] = useState<ExamRoom | null>(null);
  const [closeRoomConfirm, setCloseRoomConfirm] = useState<ExamRoom | null>(null);
  const [startRoomConfirm, setStartRoomConfirm] = useState<ExamRoom | null>(null);
  const [questionsRequiredAlert, setQuestionsRequiredAlert] = useState<ExamRoom | null>(null);
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

  const liveStudentScoreRoom = useMemo(() => {
    if (!studentScoreRoom) return null;
    return rooms.find((r) => r.id === studentScoreRoom.id) ?? studentScoreRoom;
  }, [rooms, studentScoreRoom]);

  const clearFocusedRoom = useCallback(() => {
    setDetailRoom(null);
    setDetailRoomTab(undefined);
    setStudentScoreRoom(null);
  }, []);

  const openStudentScoreRoom = useCallback((room: ExamRoom) => {
    setDetailRoom(null);
    setDetailRoomTab(undefined);
    setStudentScoreRoom(room);
  }, []);

  // Closed rooms aren't eagerly fetched anymore (see useExamRoom) — pull attempts for the
  // room the moment its detail view opens, and again if its status changes (active → closed).
  useEffect(() => {
    if (liveDetailRoom) void loadRoomAttempts(liveDetailRoom.id);
  }, [liveDetailRoom?.id, liveDetailRoom?.status, loadRoomAttempts]);

  const handleContentClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'IMG' && (target as HTMLImageElement).src) {
      setZoomedImage((target as HTMLImageElement).src);
    }
  };


  const [headerRightPortalEl, setHeaderRightPortalEl] = useState<HTMLElement | null>(null);
  const [headerCenterPortalEl, setHeaderCenterPortalEl] = useState<HTMLElement | null>(null);
  const [headerMobileActionsPortalEl, setHeaderMobileActionsPortalEl] = useState<HTMLElement | null>(null);
  const [headerCenterMobilePortalEl, setHeaderCenterMobilePortalEl] = useState<HTMLElement | null>(null);
  const [isLgOrBelow, setIsLgOrBelow] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 1024 : false,
  );
  useEffect(() => {
    setHeaderRightPortalEl(document.getElementById('header-portal-right-actions'));
    setHeaderCenterPortalEl(document.getElementById('header-portal-center'));
    setHeaderMobileActionsPortalEl(document.getElementById('header-portal-mobile-actions'));
    setHeaderCenterMobilePortalEl(document.getElementById('header-portal-center-mobile'));
  }, []);

  useEffect(() => {
    const handleResize = () => setIsLgOrBelow(window.innerWidth < 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    examShell?.setHideNav(Boolean(liveDetailRoom || liveStudentScoreRoom));
    return () => examShell?.setHideNav(false);
  }, [examShell, liveDetailRoom, liveStudentScoreRoom]);

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
    || roomSearchText.trim().length > 0
    || filterScoreCollection !== 'all';

  const availableSubSubjectGroups = useMemo(() => {
    if (filterSubjectGroup === 'all') return [] as string[];
    const configured = SUBJECT_SUBGROUP_CONFIG[filterSubjectGroup] ?? [];
    const subsInRooms = new Set<string>();
    rooms.forEach((room) => {
      if (room.subjectGroupId !== filterSubjectGroup) return;
      const dept = (room.departmentId || 'secondary') as Department;
      if (filterDepartment !== 'all' && dept !== filterDepartment) return;
      const grade = getExamRoomGradeLevel(room);
      if (filterGradeLevel !== 'all' && grade !== filterGradeLevel) return;
      const sub = room.subSubjectGroup?.trim();
      if (sub) subsInRooms.add(sub);
    });
    return configured.filter((sub) => subsInRooms.has(sub));
  }, [filterSubjectGroup, filterDepartment, filterGradeLevel, rooms]);

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

      const roomScoreType = resolveRoomScoreCollectionType(room);
      const matchScoreCollection = filterScoreCollection === 'all'
        || (filterScoreCollection === 'unset'
          ? isRoomScoreCollectionUnset(room)
          : roomScoreType === filterScoreCollection);

      return matchStatus && matchSearch && matchDepartment && matchGrade && matchRoom
        && matchSubjectGroup && matchSubSubjectGroup && matchScoreCollection;
    })
      .sort((a, b) => {
        const timeA = a.createdAt ?? 0;
        const timeB = b.createdAt ?? 0;
        if (timeA !== timeB) return timeB - timeA;
        return a.title.localeCompare(b.title, 'th', { numeric: true });
      });
  }, [rooms, filterStatus, filterScoreCollection, filterDepartment, filterGradeLevel, filterRoomNumber, filterSubjectGroup, filterSubSubjectGroup, roomSearchText]);

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
    clearFocusedRoom();
    setMobileShowAllActive(true);
  };

  const handleScoreCollectionFilterChange = (key: ScoreCollectionFilterKey) => {
    setFilterScoreCollection(key);
    clearFocusedRoom();
  };

  // Header: select กรองสถานะ + ประเภทเก็บคะแนน — ความสูงเท่าแถบสาระย่อย (h-8 track / h-7 chip)
  const statusFilterTabs = (
    <div className="mb-3 hidden w-full items-center gap-1.5 lg:flex">
      <div className="flex h-8 items-center rounded-lg border border-slate-200/20 bg-slate-100/80 p-0.5">
        <Select
          value={filterStatus}
          onValueChange={(value) => {
            if (!value) return;
            handleStatusFilterChange(value as typeof filterStatus);
          }}
        >
          <SelectTrigger
            size="sm"
            className="!h-7 min-h-7 w-auto min-w-0 gap-1 rounded-md border-none bg-white px-2.5 py-0 text-[11px] font-bold text-slate-800 shadow-xs focus-visible:border-none focus-visible:ring-0 data-[size=sm]:h-7 dark:bg-white [&_svg:not([class*='size-'])]:size-3"
            aria-label="ตัวกรองสถานะ"
          >
            <SelectValue placeholder="สถานะ" />
          </SelectTrigger>
          <SelectContent align="start" className="min-w-[10rem] rounded-xl font-sukhumvit">
            {statusFilterOptions.map((option) => (
              <SelectItem
                key={option.key}
                value={option.key}
                className="rounded-lg text-[11px] font-bold"
              >
                <span className="flex items-center gap-1.5">
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: EXAM_STATUS_FILTER_COLORS[option.key] }}
                    aria-hidden
                  />
                  {option.label}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex h-8 items-center rounded-lg border border-slate-200/20 bg-slate-100/80 p-0.5">
        <Select
          value={filterScoreCollection}
          onValueChange={(value) => {
            if (!value) return;
            handleScoreCollectionFilterChange(value as ScoreCollectionFilterKey);
          }}
        >
          <SelectTrigger
            size="sm"
            className="!h-7 min-h-7 w-auto min-w-0 gap-1 rounded-md border-none bg-white px-2.5 py-0 text-[11px] font-bold text-slate-800 shadow-xs focus-visible:border-none focus-visible:ring-0 data-[size=sm]:h-7 dark:bg-white [&_svg:not([class*='size-'])]:size-3"
            aria-label="เลือกประเภทการเก็บคะแนน"
          >
            <SelectValue placeholder="ประเภทเก็บคะแนน" />
          </SelectTrigger>
          <SelectContent align="start" className="min-w-[10rem] rounded-xl font-sukhumvit">
            {SCORE_COLLECTION_FILTER_OPTIONS.map((option) => {
              const Icon = option.key === 'all'
                ? HiSquares2X2
                : option.key === 'unset'
                  ? HiPlus
                  : SCORE_COLLECTION_ICONS[option.key];
              return (
                <SelectItem
                  key={option.key}
                  value={option.key}
                  className="rounded-lg text-[11px] font-bold"
                >
                  <span className="flex items-center gap-1.5">
                    <Icon
                      className="h-3 w-3 shrink-0"
                      style={{ color: option.color }}
                      aria-hidden
                    />
                    {option.label}
                  </span>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>
    </div>
  );

  const handleDepartmentFilterChange = (dept: Department | 'all') => {
    setFilterDepartment(dept);
    setFilterGradeLevel('all');
    setFilterRoomNumber('all');
    setFilterSubjectGroup('all');
    setFilterSubSubjectGroup('all');
    clearFocusedRoom();
  };

  const handleGradeFilterChange = (grade: string) => {
    setFilterGradeLevel(grade);
    setFilterRoomNumber('all');
    setFilterSubjectGroup('all');
    setFilterSubSubjectGroup('all');
    clearFocusedRoom();
  };

  const handleRoomFilterChange = (roomNumber: string) => {
    setFilterRoomNumber(roomNumber);
    clearFocusedRoom();
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

  // Student role: rooms ถูก scope จาก server เป็นของตัวเองอยู่แล้ว (ดู useExamRoom) —
  // กรองการ์ดกลุ่มสาระให้เหลือเฉพาะกลุ่มสาระที่มีห้องสอบของตัวเองจริง ไม่ต้องโหลด/แสดงทั้งโรงเรียน
  const myEnrolledSubjectGroupIds = useMemo(() => {
    if (!isStudent) return null;
    const groupIds = new Set<string>();
    rooms.forEach((r) => { if (r.subjectGroupId) groupIds.add(r.subjectGroupId); });
    return groupIds;
  }, [isStudent, rooms]);

  const visibleSubjectGroups = myAssignedSubjectGroupIds
    ? subjectGroups.filter(([id]) => myAssignedSubjectGroupIds.has(id))
    : myEnrolledSubjectGroupIds
      ? subjectGroups.filter(([id]) => myEnrolledSubjectGroupIds.has(id))
      : subjectGroups;

  // Teacher: ห้องของตัวเองที่กำลังเปิด · Admin/sysadmin: ทุกห้องที่กำลังเปิด (ปุ่ม header + drawer)
  const myActiveRooms = useMemo(() => {
    const active = rooms.filter((r) => r.status === 'active');
    if (role === 'teacher') {
      return active.filter((r) => matchesTeacherIdentity(r.teacherId, teachingMgr.teacherIdentityKeys));
    }
    if (role === 'admin' || role === 'sysadmin') return active;
    return [];
  }, [role, rooms, teachingMgr.teacherIdentityKeys]);

  const [activeRoomsDrawerOpen, setActiveRoomsDrawerOpen] = useState(false);
  const showActiveRoomsHeaderBtn =
    (role === 'teacher' || role === 'admin' || role === 'sysadmin')
    && !liveDetailRoom
    && !liveStudentScoreRoom;

  // ห้องสอบที่กำลังเปิดสอบอยู่ (bypass ด้านบน) โผล่มาก่อนเลือกกลุ่มสาระ — ให้ tab สถานะขึ้น "กำลังสอบ" ตามจริง ครั้งแรกที่เจอเท่านั้น
  const autoActiveStatusSetRef = useRef(false);
  useEffect(() => {
    if (autoActiveStatusSetRef.current) return;
    if (role === 'teacher' && myActiveRooms.length > 0) {
      autoActiveStatusSetRef.current = true;
      setFilterStatus('active');
    }
  }, [role, myActiveRooms]);

  const resetStructureFilters = () => {
    setFilterDepartment('all');
    setFilterGradeLevel('all');
    setFilterRoomNumber('all');
    setFilterSubjectGroup('all');
    setFilterSubSubjectGroup('all');
    setFilterScoreCollection('all');
    setRoomSearchText('');
    clearFocusedRoom();
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
                  clearFocusedRoom();
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

  const collapsedBrowseRail = (
    (!isStudent && filterDepartment !== 'all') || isStudent
  ) ? (
    <div
      className={cn(
        'flex w-full flex-col items-center gap-2 px-1.5 py-2',
        !isStudent && 'border-t border-border',
      )}
    >
      {!isStudent
        && filterDepartment !== 'all'
        && availableGradeLevels.map((grade) => {
          const active = filterGradeLevel === grade;
          return (
            <button
              key={grade}
              type="button"
              onClick={() => handleGradeFilterChange(grade)}
              title={grade}
              aria-label={grade}
              aria-pressed={active}
              className={cn(
                'flex size-11 shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl border transition-all',
                active
                  ? 'border-2 border-foreground bg-foreground text-background'
                  : 'border border-border bg-muted/40 text-foreground hover:bg-muted',
              )}
            >
              <HiAcademicCap className="h-3.5 w-3.5" />
              <span className="text-[9px] font-black font-sukhumvit leading-none">{grade}</span>
            </button>
          );
        })}

      {(isStudent || (filterDepartment !== 'all' && filterGradeLevel !== 'all'))
        ? visibleSubjectGroups.map(([id, cfg]) => {
            const active = filterSubjectGroup === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setFilterSubjectGroup(id as SubjectGroupId);
                  setFilterSubSubjectGroup('all');
                  clearFocusedRoom();
                }}
                title={cfg.name}
                aria-label={cfg.name}
                aria-pressed={active}
                className={cn(
                  'flex size-11 shrink-0 items-center justify-center rounded-xl border transition-all',
                  active ? 'border-2 text-white shadow-sm' : 'hover:opacity-90',
                )}
                style={
                  active
                    ? { background: cfg.color, borderColor: cfg.color }
                    : { background: cfg.bg, borderColor: cfg.border, color: cfg.color }
                }
              >
                <SubjectIcon
                  subjectGroup={id as SubjectGroupId}
                  size={18}
                  className={active ? 'text-white drop-shadow-sm' : 'text-current'}
                />
              </button>
            );
          })
        : null}
    </div>
  ) : null;

  const roomCountsByDept = useMemo(() => {
    const counts: Partial<Record<Department, number>> = {};
    rooms.forEach((room) => {
      const dept = (room.departmentId || 'secondary') as Department;
      if (dept in DEPARTMENT_CONFIG && shouldCountDepartment(dept, homeDepartment, isDeptScoped)) {
        counts[dept] = (counts[dept] ?? 0) + 1;
      }
    });
    return counts;
  }, [rooms, homeDepartment, isDeptScoped]);

  const gradeRoomCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    if (filterDepartment === 'all') return counts;
    rooms.forEach((room) => {
      const dept = (room.departmentId || 'secondary') as Department;
      if (dept !== filterDepartment) return;
      const grade = getExamRoomGradeLevel(room);
      if (grade) counts[grade] = (counts[grade] ?? 0) + 1;
    });
    return counts;
  }, [rooms, filterDepartment]);

  const canShowMobileSubjectGroups =
    !isStudent && filterDepartment !== 'all' && filterGradeLevel !== 'all';

  const showMobileBrowse =
    isLgOrBelow && !liveDetailRoom && !isStudent && filterSubjectGroup === 'all';

  const needsCustomMobileBack = isLgOrBelow && !liveDetailRoom && (
    isStudent
      ? filterSubjectGroup !== 'all'
      : filterDepartment !== 'all' || filterGradeLevel !== 'all' || filterSubjectGroup !== 'all'
  );

  const handleMobileBack = useCallback(() => {
    if (isStudent) {
      setFilterSubjectGroup('all');
      setFilterSubSubjectGroup('all');
      setMobileShowAllActive(false);
      return;
    }
    if (filterSubjectGroup !== 'all') {
      setFilterSubjectGroup('all');
      setFilterSubSubjectGroup('all');
      clearFocusedRoom();
      return;
    }
    if (filterGradeLevel !== 'all') {
      setFilterGradeLevel('all');
      setFilterRoomNumber('all');
      setFilterSubjectGroup('all');
      setFilterSubSubjectGroup('all');
      clearFocusedRoom();
      return;
    }
    if (filterDepartment !== 'all') {
      handleDepartmentFilterChange('all');
    }
  }, [isStudent, filterSubjectGroup, filterGradeLevel, filterDepartment, handleDepartmentFilterChange]);

  useEffect(() => {
    const isPortalBackButton = (target: EventTarget | null) => {
      if (!(target instanceof Element)) return false;
      const btn = target.closest('button');
      if (!btn) return false;
      return btn.id === 'portal-default-mobile-back';
    };

    const onClick = (e: MouseEvent) => {
      if (!isPortalBackButton(e.target)) return;

      if (liveDetailRoom) {
        e.preventDefault();
        e.stopImmediatePropagation();
        clearFocusedRoom();
      } else if (needsCustomMobileBack) {
        e.preventDefault();
        e.stopImmediatePropagation();
        handleMobileBack();
      }
    };

    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [liveDetailRoom, needsCustomMobileBack, handleMobileBack]);

  useEffect(() => {
    const defaultBack = document.getElementById('portal-default-mobile-back');
    if (!defaultBack) return;
    defaultBack.style.display = '';

    if (liveDetailRoom) {
      defaultBack.setAttribute('title', 'กลับรายการห้องสอบ');
      defaultBack.setAttribute('aria-label', 'กลับรายการห้องสอบ');
    } else if (needsCustomMobileBack) {
      const titleText = isStudent
        ? 'กลับเลือกกลุ่มสาระ'
        : filterSubjectGroup !== 'all'
          ? 'กลับเลือกกลุ่มสาระ'
          : filterGradeLevel !== 'all'
            ? 'กลับเลือกชั้น'
            : 'กลับเลือกแผนก';
      defaultBack.setAttribute('title', titleText);
      defaultBack.setAttribute('aria-label', titleText);
    } else {
      defaultBack.setAttribute('title', 'กลับเมนู');
      defaultBack.setAttribute('aria-label', 'กลับเมนู');
    }

    return () => {
      defaultBack.setAttribute('title', 'กลับเมนู');
      defaultBack.setAttribute('aria-label', 'กลับเมนู');
      defaultBack.style.display = '';
    };
  }, [liveDetailRoom, needsCustomMobileBack, isStudent, filterSubjectGroup, filterGradeLevel]);

  useEffect(() => {
    if (!isLgOrBelow) return;
    document.getElementById('portal-scroll-container')?.scrollTo({ top: 0 });
  }, [isLgOrBelow, filterDepartment, filterGradeLevel, filterSubjectGroup, liveDetailRoom]);

  const teacherActiveRoomsPrepend = role === 'teacher' && myActiveRooms.length > 0 ? (
    <div className="shrink-0 border-b border-border px-4 py-3">
      <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-emerald-600">
        ห้องสอบที่กำลังเปิดสอบอยู่
      </p>
      <div className="flex flex-col gap-2">
        {myActiveRooms.map((room) => (
          <button
            key={room.id}
            type="button"
            onClick={() => setProctoringRoom(room)}
            className="flex w-full items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50/80 px-3 py-2.5 text-left transition-colors hover:bg-emerald-50"
          >
            <span className="min-w-0 flex-1 truncate text-[13px] font-black text-foreground font-sukhumvit">
              {room.title}
            </span>
            <HiChevronRight className="shrink-0 text-emerald-600" size={16} />
          </button>
        ))}
      </div>
    </div>
  ) : null;

  // Header panel ฝั่งขวา: tab เลือกสาระย่อย — โผล่เฉพาะตอนกลุ่มสาระที่เลือกมีสาระย่อยจริง
  const subSubjectGroupTabs = filterSubjectGroup !== 'all' && availableSubSubjectGroups.length > 0 ? (
    <div className="mb-3 hidden w-full items-center gap-1.5 lg:flex">
      <div className="flex h-8 min-w-0 flex-1 items-center gap-0.5 overflow-x-auto rounded-lg border border-slate-200/20 bg-slate-100/80 p-0.5 scrollbar-hide">
        <button
          type="button"
          onClick={() => {
            setFilterSubSubjectGroup('all');
            clearFocusedRoom();
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
            clearFocusedRoom();
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
                clearFocusedRoom();
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
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={HEADER_ICON_BTN}
            title="คำอธิบายสีปุ่มตั้งค่า"
            aria-label="คำอธิบายสีปุ่มตั้งค่า"
          >
            <HiOutlineQuestionMarkCircle size={16} />
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72 gap-3 rounded-2xl p-4 font-sukhumvit">
          <p className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">
            สีพื้นหลังปุ่มตั้งค่า (มุมขวาล่างการ์ด)
          </p>
          <ul className="flex flex-col gap-2.5">
            <li className="flex items-start gap-3 text-[13px]">
              <span
                className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/90 text-white"
                aria-hidden
              >
                <HiCog6Tooth className="h-3 w-3" />
              </span>
              <span className="min-w-0 pt-0.5 font-bold text-muted-foreground">
                <span className="font-black text-foreground">เขียว</span>
                {' — '}เชื่อมต่อคะแนนกับรายวิชาแล้ว
              </span>
            </li>
            <li className="flex items-start gap-3 text-[13px]">
              <span
                className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/40 bg-white/60 text-slate-700 shadow-sm ring-1 ring-black/5"
                aria-hidden
              >
                <HiCog6Tooth className="h-3 w-3" />
              </span>
              <span className="min-w-0 pt-0.5 font-bold text-muted-foreground">
                <span className="font-black text-foreground">ขาว</span>
                {' — '}ยังไม่ได้เชื่อมคะแนนกับรายวิชา
              </span>
            </li>
          </ul>
          <p className="text-[11px] font-bold text-muted-foreground/80">
            ห้องที่ยังไม่ได้บันทึกชุดข้อสอบ จะขึ้นไอคอนกุญแจกลางการ์ดแทน
          </p>
        </PopoverContent>
      </Popover>
    </div>
  ) : null;

  const handleChangeStatus = async (roomId: string, status: ExamRoom['status'], bypassConfirm = false) => {
    if (status === 'active' && !bypassConfirm) {
      const room = rooms.find((r) => r.id === roomId);
      if (room) {
        if (!isExamRoomQuestionsConfigured(room)) {
          setQuestionsRequiredAlert(room);
          return;
        }
        setStartRoomConfirm(room);
        return;
      }
    }
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
        const room = rooms.find((r) => r.id === roomId) ?? null;
        setQuestionsRequiredAlert(room);
        return;
      }
      console.error('Failed to update room status:', err);
    }
  };

  const handleConfirmStartRoom = async () => {
    if (!startRoomConfirm) return;
    try {
      await updateRoomStatus(startRoomConfirm.id, 'active');
      setStartRoomConfirm(null);
    } catch (err) {
      if (err instanceof Error && err.message === 'EXAM_ROOM_QUESTIONS_NOT_SAVED') {
        const room = startRoomConfirm;
        setStartRoomConfirm(null);
        setQuestionsRequiredAlert(room);
        return;
      }
      console.error('Failed to start room:', err);
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
      if (liveDetailRoom?.id === roomToDelete.id || liveStudentScoreRoom?.id === roomToDelete.id) {
        clearFocusedRoom();
      }
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
    <div
      className={cn(
        'flex min-h-0 w-full flex-col overflow-hidden font-sukhumvit',
        'h-[calc(100dvh-4.25rem)] max-h-[calc(100dvh-4.25rem)]',
      )}
    >
      {headerCenterMobilePortalEl && !liveDetailRoom && createPortal(
        <span className="lg:hidden truncate text-[13px] font-black font-sukhumvit text-slate-800">
          {PORTAL_MENU_TITLES['/portal/exams']}
        </span>,
        headerCenterMobilePortalEl,
      )}
      {headerRightPortalEl && !liveDetailRoom && !liveStudentScoreRoom && !isStudent && showActiveRoomsHeaderBtn && createPortal(
        <div className={cn('pointer-events-auto hidden lg:flex', HEADER_ICON_BTN_GROUP)}>
          <button
            type="button"
            onClick={() => setActiveRoomsDrawerOpen(true)}
            className={cn(HEADER_ICON_BTN, 'relative')}
            title="ห้องสอบที่กำลังเปิดอยู่"
            aria-label="ห้องสอบที่กำลังเปิดอยู่"
          >
            <HiBell size={16} />
            {myActiveRooms.length > 0 && (
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-rose-500" aria-hidden />
            )}
          </button>
        </div>,
        headerRightPortalEl,
      )}
      {headerMobileActionsPortalEl && !liveDetailRoom && !liveStudentScoreRoom && !isStudent && createPortal(
        <div className={cn('pointer-events-auto relative flex lg:hidden', HEADER_ICON_BTN_GROUP)}>
          {showActiveRoomsHeaderBtn && (
            <button
              type="button"
              onClick={() => setActiveRoomsDrawerOpen(true)}
              className={cn(HEADER_ICON_BTN, 'relative')}
              title="ห้องสอบที่กำลังเปิดอยู่"
              aria-label="ห้องสอบที่กำลังเปิดอยู่"
            >
              <HiBell size={16} />
              {myActiveRooms.length > 0 && (
                <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-rose-500" aria-hidden />
              )}
            </button>
          )}
          {!showMobileBrowse && (
            <ExamMobileFilterTriggerButton
              onClick={() => setMobileFilterOpen(true)}
              title="ตัวกรองห้องสอบ"
              hasActiveFilters={hasStructureFilter}
            />
          )}
          {!showMobileBrowse && canEdit && (
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className={HEADER_ICON_BTN}
              title="สร้างห้องสอบ"
              aria-label="สร้างห้องสอบ"
            >
              <HiPlus size={16} />
            </button>
          )}
        </div>,
        headerMobileActionsPortalEl,
      )}
      <ActiveExamRoomsDrawer
        open={activeRoomsDrawerOpen}
        onClose={() => setActiveRoomsDrawerOpen(false)}
        rooms={myActiveRooms}
        onSelectRoom={(room) => setProctoringRoom(room)}
      />
      {!liveDetailRoom && !isStudent && (
        <ExamRoomsMobileFilterDrawer
          open={mobileFilterOpen}
          onOpenChange={setMobileFilterOpen}
          filterStatus={filterStatus}
          filterScoreCollection={filterScoreCollection}
          filterDepartment={filterDepartment}
          filterGradeLevel={filterGradeLevel}
          filterRoomNumber={filterRoomNumber}
          filterSubjectGroup={filterSubjectGroup}
          filterSubSubjectGroup={filterSubSubjectGroup}
          searchText={roomSearchText}
          availableGradeLevels={availableGradeLevels}
          availableRoomNumbers={availableRoomNumbers}
          availableSubSubjectGroups={availableSubSubjectGroups}
          subjectGroupOptions={visibleSubjectGroups}
          hasActiveFilters={hasStructureFilter}
          onStatusChange={handleStatusFilterChange}
          onScoreCollectionChange={handleScoreCollectionFilterChange}
          onDepartmentChange={handleDepartmentFilterChange}
          onGradeChange={handleGradeFilterChange}
          onRoomChange={handleRoomFilterChange}
          onSubjectGroupChange={(group) => {
            setFilterSubjectGroup(group);
            setFilterSubSubjectGroup('all');
            clearFocusedRoom();
          }}
          onSubSubjectGroupChange={(sub) => {
            setFilterSubSubjectGroup(sub);
            clearFocusedRoom();
          }}
          onSearchChange={setRoomSearchText}
          onClearFilters={resetStructureFilters}
        />
      )}

      {liveStudentScoreRoom && isStudent ? (
          <StudentRoomScorePanel
            key={liveStudentScoreRoom.id}
            room={liveStudentScoreRoom}
            attempts={getAttemptsForRoom(liveStudentScoreRoom.id)}
            onBack={clearFocusedRoom}
            onTakeExam={
              liveStudentScoreRoom.status === 'active'
                ? () => navigate(`/exam/${liveStudentScoreRoom.id}`)
                : undefined
            }
            headerPortalEl={headerCenterPortalEl ?? headerRightPortalEl}
          />
        ) : liveDetailRoom && !isStudent ? (
          <RoomDetailView
            key={liveDetailRoom.id}
            room={liveDetailRoom}
            initialTab={detailRoomTab}
            attempts={getAttemptsForRoom(liveDetailRoom.id)}
            onBack={clearFocusedRoom}
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
          <div
            className={cn(
              'flex h-full w-full min-h-0 flex-1 basis-0 flex-col gap-4 overflow-hidden lg:flex-row lg:items-stretch',
              !showMobileBrowse && 'pb-14 lg:pb-4',
            )}
          >
            {showMobileBrowse ? (
              <ExamMobileBrowse
                filterDepartment={filterDepartment}
                filterGradeLevel={filterGradeLevel}
                gradeOptions={availableGradeLevels}
                gradeRoomCounts={gradeRoomCounts}
                roomCountsByDept={roomCountsByDept}
                departments={browseVisibleDepartments}
                canShowSubjectGroups={canShowMobileSubjectGroups}
                onSelectDept={(dept) => handleDepartmentFilterChange(dept)}
                onSelectGrade={handleGradeFilterChange}
                subjectGroupNav={sidebarBrowseNav}
                prependContent={
                  filterDepartment !== 'all' ? teacherActiveRoomsPrepend : undefined
                }
              />
            ) : null}

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
                    departments={browseVisibleDepartments}
                    onSelectDept={handleDepartmentFilterChange}
                    onSelectGrade={handleGradeFilterChange}
                    onSelectClass={() => {}}
                    showRooms={false}
                    showGradeRoomNav={!isStudent}
                    hideDeptCards={isStudent}
                    collapsed={sidebarCollapsed}
                    collapsedExtra={collapsedBrowseRail}
                    headerAction={(
                      <div className={cn('flex', HEADER_ICON_BTN_GROUP)}>
                        {canEdit && !isStudent && !sidebarCollapsed && (
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

                <div className={cn(
                  'min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-y-contain scrollbar-hide',
                  showMobileBrowse && 'hidden lg:block',
                )}>
                {subSubjectGroupTabs}
                {filterSubjectGroup !== 'all' && statusFilterTabs}
                {isStudent && filterSubjectGroup === 'all' && !mobileShowAllActive && !isLoading && (
                  <div className="lg:hidden">
                    {rooms.filter((r) => r.status === 'active').length > 0 && (
                      <div className="mb-4 flex flex-col gap-2">
                        {rooms.filter((r) => r.status === 'active').map((room) => (
                          <button
                            key={room.id}
                            type="button"
                            onClick={() => navigate(`/exam/${room.id}`)}
                            className="flex items-center gap-3 rounded-2xl p-3 text-left transition-colors hover:bg-slate-50"
                          >
                            <div className="relative shrink-0">
                              <img
                                src={resolveExamRoomIconSrc(room)}
                                alt=""
                                className="h-14 w-14 object-contain animate-pulse drop-shadow-[0_0_6px_rgba(34,197,94,0.75)]"
                              />
                              <span className="absolute inset-x-0 bottom-0 flex justify-center">
                                <span className="rounded-full bg-emerald-600 px-1.5 py-0.5 text-[8px] font-black text-white font-sukhumvit">
                                  เข้าสอบ
                                </span>
                              </span>
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[13px] font-black text-slate-800 font-sukhumvit">{room.title}</p>
                              {room.subjectName && (
                                <p className="truncate text-[11px] text-slate-500 font-sarabun">{room.subjectName}</p>
                              )}
                              {(() => {
                                const bannerGroupCfg = room.subjectGroupId
                                  ? SUBJECT_GROUP_CONFIG[room.subjectGroupId as SubjectGroupId]
                                  : undefined;
                                if (!bannerGroupCfg) return null;
                                return (
                                  <div className="mt-1 flex flex-wrap items-center gap-1">
                                    <span
                                      className="rounded-full px-1.5 py-0.5 text-[9px] font-bold truncate"
                                      style={{ color: bannerGroupCfg.color, backgroundColor: bannerGroupCfg.bg }}
                                    >
                                      {bannerGroupCfg.name}
                                    </span>
                                    {room.subSubjectGroup?.trim() && (
                                      <span
                                        className="rounded-full px-1.5 py-0.5 text-[9px] font-bold truncate"
                                        style={{ color: bannerGroupCfg.color, backgroundColor: bannerGroupCfg.bg }}
                                      >
                                        {room.subSubjectGroup}
                                      </span>
                                    )}
                                  </div>
                                );
                              })()}
                            </div>
                            <HiChevronRight className="shrink-0 text-emerald-500" size={18} />
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-2.5">
                      {visibleSubjectGroups.map(([id, cfg]) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => {
                            setFilterSubjectGroup(id as SubjectGroupId);
                            setFilterSubSubjectGroup('all');
                            setFilterStatus('all');
                          }}
                          className="flex flex-col items-center gap-2 rounded-2xl border p-4 text-center transition-all"
                          style={{ backgroundColor: cfg.bg, borderColor: cfg.border }}
                        >
                          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white" style={{ color: cfg.color }}>
                            <SubjectIcon subjectGroup={id} size={20} className="text-current" />
                          </span>
                          <span className="text-[12px] font-black font-sukhumvit" style={{ color: cfg.color }}>{cfg.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div className={cn(isStudent && filterSubjectGroup === 'all' && !mobileShowAllActive && 'hidden lg:block')}>
                {isStudent && filterSubjectGroup === 'all' && mobileShowAllActive && (
                  <button
                    type="button"
                    onClick={() => setMobileShowAllActive(false)}
                    className="mb-3 flex items-center gap-1 font-sukhumvit text-[12px] font-bold text-slate-500 lg:hidden"
                  >
                    <HiChevronLeft size={14} /> รายวิชาของฉัน
                  </button>
                )}
                {isLoading ? (
                  <div className={cn('grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-3', PORTAL_CARD_LIST_PADDING)}>
                    {Array.from({ length: 8 }).map((_, i) => (
                      <div key={i} className="flex flex-col items-center gap-2 rounded-2xl p-3">
                        <Skeleton className="h-24 w-24 rounded-2xl" />
                        <Skeleton className="h-3.5 w-4/5 rounded-full" />
                        <Skeleton className="h-3 w-1/2 rounded-full" />
                      </div>
                    ))}
                  </div>
                ) : role === 'teacher' && filterSubjectGroup === 'all' && myActiveRooms.length > 0 ? (
                  <div className="flex flex-col gap-3">
                    <p className="font-sukhumvit text-[11px] font-black uppercase tracking-wider text-emerald-600">
                      ห้องสอบที่กำลังเปิดสอบอยู่
                    </p>
                    <div className={cn('grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-3', PORTAL_CARD_LIST_PADDING)}>
                      {myActiveRooms.map((room) => (
                        <RoomCard
                          key={room.id}
                          room={room}
                          isStudent={false}
                          onTakeExam={undefined}
                          onProctor={() => setProctoringRoom(room)}
                          onChangeStatus={(status, bypass) => handleChangeStatus(room.id, status, bypass)}
                          onFinish={() => setFinishRoomConfirm(room)}
                          onDelete={() => handleDelete(room)}
                          onEdit={() => { setEditingRoom(room); setShowCreate(true); }}
                          onOpenSettings={(tab) => { setDetailRoom(room); setDetailRoomTab(tab); }}
                          canEdit={canEdit}
                          canDelete={canDelete}
                          alert={cardAlerts[room.id] ?? null}
                          onUpdateRoom={updateRoom}
                          attempts={getAttemptsForRoom(room.id)}
                          loadRoomAttempts={loadRoomAttempts}
                          onRecalculateScores={calculateRoomScores}
                        />
                      ))}
                    </div>
                  </div>
                ) : !isStudent && filterSubjectGroup === 'all' ? (
                  <div className="flex h-full min-h-[50vh] flex-col items-center justify-center gap-3">
                    <div className="w-16 h-16 rounded-full bg-white/50 flex items-center justify-center">
                      <ClipboardList size={28} className="text-slate-300" />
                    </div>
                    <p className="text-slate-400 font-sukhumvit text-[14px]">
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
                    className="flex flex-col gap-5"
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
                            onTakeExam={() => navigate(`/exam/${room.id}`)}
                            onOpenStudentScores={() => openStudentScoreRoom(room)}
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
                            onUpdateRoom={updateRoom}
                            attempts={getAttemptsForRoom(room.id)}
                            loadRoomAttempts={loadRoomAttempts}
                            onRecalculateScores={calculateRoomScores}
                          />
                        </motion.div>
                      ))}
                    </div>

                    {totalPages > 1 && (
                      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-slate-200/60 pt-2 mt-1">
                        <p className="font-sukhumvit text-[11px] font-bold text-slate-500">
                          แสดง {rangeStart}–{rangeEnd} จาก {filtered.length} ห้องสอบ
                        </p>

                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                            className="h-7 w-7 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30 flex items-center justify-center"
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
                                      <span key={`ellipsis-${page}`} className="px-0.5 font-sukhumvit text-[10px] text-slate-300">
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
                                    'h-7 min-w-[28px] rounded-lg px-2 font-sukhumvit text-[11px] font-black transition-all',
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
                            className="h-7 w-7 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30 flex items-center justify-center"
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
                </div>
          </div>
        )}

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

      {/* ── Questions Required Alert Dialog ── */}
      <AnimatePresence>
        {questionsRequiredAlert && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setQuestionsRequiredAlert(null)}
              className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 16 }}
              className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl p-6 flex flex-col gap-4"
            >
              <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center mx-auto">
                <HiLockClosed size={26} className="text-amber-600" />
              </div>

              <div className="text-center">
                <h3 className="text-[16px] font-black text-slate-800 font-sukhumvit">
                  ยังไม่ได้ตั้งค่าข้อสอบ
                </h3>
                <p className="text-[13px] text-slate-500 font-sarabun mt-2">
                  ห้องสอบ 「{questionsRequiredAlert.title}」 ยังไม่มีชุดข้อสอบ
                </p>
                <p className="text-[13px] text-slate-500 font-sarabun mt-1">
                  {EXAM_ROOM_QUESTIONS_REQUIRED_MESSAGE}
                </p>
              </div>

              <div className="flex gap-3 mt-1">
                <button
                  type="button"
                  onClick={() => setQuestionsRequiredAlert(null)}
                  className="flex-1 h-11 rounded-2xl border border-slate-200 text-slate-600 text-[13px] font-black font-sukhumvit hover:bg-slate-50 transition-all"
                >
                  ปิด
                </button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  type="button"
                  onClick={() => {
                    const room = questionsRequiredAlert;
                    setQuestionsRequiredAlert(null);
                    setDetailRoom(room);
                    setDetailRoomTab('questions');
                  }}
                  className="flex-1 h-11 rounded-2xl bg-amber-500 text-white text-[13px] font-black font-sukhumvit flex items-center justify-center gap-2 hover:bg-amber-600 transition-all"
                >
                  ไปตั้งค่าข้อสอบ
                </motion.button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Start Round Confirmation Dialog ── */}
      <AnimatePresence>
        {startRoomConfirm && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setStartRoomConfirm(null)}
              className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 16 }}
              className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl p-6 flex flex-col gap-4"
            >
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center mx-auto">
                <HiPlay size={26} className="text-emerald-600" />
              </div>

              <div className="text-center">
                <h3 className="text-[16px] font-black text-slate-800 font-sukhumvit">
                  เริ่มรอบ {(startRoomConfirm.completedRounds ?? 0) + 1}
                </h3>
                <p className="text-[13px] text-slate-500 font-sarabun mt-2">
                  เปิดห้องสอบ 「{startRoomConfirm.title}」 ให้นักเรียนเข้าทำข้อสอบรอบนี้หรือไม่?
                </p>
              </div>

              <div className="flex gap-3 mt-1">
                <button
                  type="button"
                  onClick={() => setStartRoomConfirm(null)}
                  className="flex-1 h-11 rounded-2xl border border-slate-200 text-slate-600 text-[13px] font-black font-sukhumvit hover:bg-slate-50 transition-all"
                >
                  ยกเลิก
                </button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  type="button"
                  onClick={handleConfirmStartRoom}
                  className="flex-1 h-11 rounded-2xl bg-emerald-600 text-white text-[13px] font-black font-sukhumvit flex items-center justify-center gap-2 hover:bg-emerald-700 transition-all"
                >
                  <HiPlay size={14} /> ยืนยันเริ่มรอบ
                </motion.button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
