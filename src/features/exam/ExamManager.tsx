// src/features/exam/ExamManager.tsx
import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { collection, getDocs } from 'firebase/firestore';
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
  Clock, X, Pencil, Settings, Save,
  ShieldAlert, Timer, Users, FileText, CheckCircle2,
  BookOpen, Check, Link2, ArrowLeft, SlidersHorizontal,
  BarChart2, Trophy, TrendingUp, RotateCcw
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { IndeterminateProgress } from '@/components/ui/progress';


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
  const score = attempt.score ?? 0;
  const total = room.totalPoints ?? 1;
  const percentage = Math.round((score / total) * 100);
  
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
                animate={{ strokeDashoffset: 464.95 - (464.95 * percentage) / 100 }}
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
              <span className="text-[36px] font-black text-slate-800 font-sukhumvit leading-none">{score}</span>
              <div className="h-[1px] w-10 bg-slate-200 my-1" />
              <span className="text-[14px] font-bold text-slate-400 font-sarabun">{total}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 w-full mb-8">
            <div className="p-4 rounded-[2rem] bg-indigo-50/50 border border-indigo-100 flex flex-col items-center gap-1">
              <Trophy size={20} className="text-indigo-500 mb-1" />
              <span className="text-[18px] font-black text-indigo-600">{percentage}%</span>
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
import { useActiveAcademicYear } from '@/hooks/useActiveAcademicYear';
import type { ExamRoom, ExamAttempt, GradeScoreType, GradeBookSubjectLink } from '@/types/exam';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogTitle } from '@/components/ui/dialog';
import { DEPARTMENT_CONFIG, SUBJECT_GROUP_CONFIG, SUBJECT_SUBGROUP_CONFIG, type Department, type SubjectGroupId } from '@/types/curriculum';
import { useClassroomManager } from '@/features/classes/hooks/useClassroomManager';
import { useCurriculum } from '@/hooks/useCurriculum';
import { useCurriculumVersioned } from '@/hooks/useCurriculumVersioned';
import { useTeachingManager } from '@/hooks/useTeachingManager';
import { QUESTION_SETS_COL, useQuestionSetBank } from '@/hooks/useQuestionSetBank';
import { useSetQuestions } from '@/hooks/useSetQuestions';
import { DIFFICULTY_CONFIG, TYPE_CONFIG } from '@/types/questionBank';
import type { Subject } from '@/types/curriculum';
import { db } from '@/lib/firebase';

// ── Status badge ──────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  upcoming: { label: 'รอเปิด', color: '#6366f1', bg: '#eef2ff', icon: Clock },
  active: { label: 'กำลังสอบ', color: '#059669', bg: '#d1fae5', icon: Play },
  closed: { label: 'ปิดแล้ว', color: '#94a3b8', bg: '#f1f5f9', icon: Square },
};

// Hide media in compact question cards (picker/selected list) while keeping full preview dialog intact.
const stripImagesFromHtml = (html: string) =>
  (html || '')
    .replace(/<figure\b[^>]*>[\s\S]*?<\/figure>/gi, '')
    .replace(/<img\b[^>]*>/gi, '');

function StatusBadge({ status }: { status: ExamRoom['status'] }) {
  const cfg = STATUS_CONFIG[status];
  const Icon = cfg.icon;
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-black uppercase font-sukhumvit"
      style={{ color: cfg.color, background: cfg.bg }}>
      <Icon size={9} />
      {cfg.label}
    </span>
  );
}

function CountdownTimer({ startTime, durationMinutes }: { startTime?: number; durationMinutes: number }) {
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!startTime) return;

    const calculateTimeLeft = () => {
      const end = startTime + durationMinutes * 60 * 1000;
      const diff = end - Date.now();
      return Math.max(0, diff);
    };

    setTimeLeft(calculateTimeLeft());
    const timer = setInterval(() => setTimeLeft(calculateTimeLeft()), 1000);
    return () => clearInterval(timer);
  }, [startTime, durationMinutes]);

  if (!startTime) return null;
  if (timeLeft === null) return null;
  if (timeLeft <= 0) return <span className="text-rose-500 font-bold">หมดเวลา</span>;

  const m = Math.floor(timeLeft / 60000);
  const s = Math.floor((timeLeft % 60000) / 1000);

  return (
    <motion.span 
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[11px] font-black font-mono border border-slate-200/60"
      style={{ 
        background: 'linear-gradient(135deg, #ecfdf5, #d1fae5)',
        color: '#059669',
        borderColor: '#10b98130'
      }}>
      <Clock size={10} className="animate-pulse" />
      {m}:{s.toString().padStart(2, '0')}
    </motion.span>
  );
}

// ── Attempt status dot ────────────────────────────────────────────────────────
function AttemptCard({ att }: { att: ExamAttempt }) {
  const isSuspicious = att.suspiciousActivities >= 2;
  const statusColor = att.status === 'submitted' ? '#059669' : att.status === 'graded' ? '#6366f1' : '#f59e0b';
  const statusLabel = att.status === 'submitted' ? 'ส่งแล้ว' : att.status === 'graded' ? 'ตรวจแล้ว' : 'กำลังทำ';

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
          {att.studentName.charAt(3)}
        </div>
        <div>
          <p className="text-[13px] font-bold text-slate-800 font-sukhumvit">{att.studentName}</p>
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
  room, attempts, onClose,
}: { room: ExamRoom; attempts: ExamAttempt[]; onClose: () => void }) {
  const inProgress = attempts.filter(a => a.status === 'in_progress').length;
  const submitted = attempts.filter(a => a.status === 'submitted' || a.status === 'graded').length;
  const suspicious = attempts.filter(a => a.suspiciousActivities >= 2).length;

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
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest font-sukhumvit">PROCTOR DASHBOARD</p>
            <h2 className="text-[18px] font-black text-slate-800 font-sukhumvit mt-0.5">{room.title}</h2>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-all">
            <X size={14} className="text-slate-500" />
          </button>
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
          {attempts.length === 0 ? (
            <div className="text-center py-10 text-slate-400 font-sarabun text-[13px]">
              ยังไม่มีนักเรียนเข้าห้องสอบ
            </div>
          ) : (
            attempts.map((att) => (
              <div key={att.id}>
                <AttemptCard att={att} />
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
function CreateRoomModal({ onClose, onCreate, onUpdate, editRoom }: {
  onClose: () => void;
  onCreate: (data: Omit<ExamRoom, 'id' | 'createdAt' | 'status' | 'currentRound' | 'completedRounds'>) => Promise<ExamRoom>;
  onUpdate: (roomId: string, data: Partial<ExamRoom>) => Promise<void>;
  editRoom?: ExamRoom | null;
}) {
  const { user } = useAuth();
  const { year: academicYear, activeSemester } = useActiveAcademicYear();
  const { classes } = useClassroomManager();
  const { subjects } = useCurriculum();

  const [form, setForm] = useState({
    title: editRoom?.title || '',
    departmentId: (editRoom?.departmentId as Department) || ('' as Department | ''),
    gradeLevel: editRoom?.gradeLevel || '',
    classId: editRoom?.classId || '',
    subjectGroupId: (editRoom?.subjectGroupId as SubjectGroupId) || ('' as SubjectGroupId | ''),
    subjectId: editRoom?.subjectId || '',
    password: editRoom?.password || '',
    durationMinutes: editRoom?.durationMinutes || 60,
    maxAttempts: editRoom?.settings?.maxAttempts ?? 1,
    shuffleQuestions: editRoom?.settings?.shuffleQuestions || false,
    showResultImmediately: editRoom?.settings?.showResultImmediately || true,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setForm({
      title: editRoom?.title || '',
      departmentId: (editRoom?.departmentId as Department) || ('' as Department | ''),
      gradeLevel: editRoom?.gradeLevel || '',
      classId: editRoom?.classId || '',
      subjectGroupId: (editRoom?.subjectGroupId as SubjectGroupId) || ('' as SubjectGroupId | ''),
      subjectId: editRoom?.subjectId || '',
      password: editRoom?.password || '',
      durationMinutes: editRoom?.durationMinutes || 60,
      maxAttempts: editRoom?.settings?.maxAttempts ?? 1,
      shuffleQuestions: editRoom?.settings?.shuffleQuestions || false,
      showResultImmediately: (editRoom?.settings?.showResultImmediately ?? true) as true,
    });
  }, [editRoom]);

  const inferDepartmentFromGrade = (gradeLevel?: string): Department | '' => {
    if (!gradeLevel) return '';
    if (gradeLevel.startsWith('อ.')) return 'early';
    if (gradeLevel.startsWith('ป.')) return 'primary';
    if (gradeLevel.startsWith('ม.')) return 'secondary';
    return '';
  };

  // Derived options
  const gradeOptions = form.departmentId ? DEPARTMENT_CONFIG[form.departmentId].grades : [];
  const classOptions = classes.filter((c) => {
    const classDept = c.departmentId || c.department || inferDepartmentFromGrade(c.gradeLevel);
    const passDept = !form.departmentId || classDept === form.departmentId;
    const passGrade = !form.gradeLevel || c.gradeLevel === form.gradeLevel;
    return passDept && passGrade;
  }).sort((a, b) => Number(a.roomNumber) - Number(b.roomNumber));

  const subjectOptions = subjects.filter((s) => {
    const subjectDept = s.department || inferDepartmentFromGrade(s.gradeLevel);
    const passDept = !form.departmentId || subjectDept === form.departmentId;
    const passGrade =
      !form.gradeLevel ||
      !s.gradeLevel ||
      s.gradeLevel === form.gradeLevel ||
      s.gradeLevel.includes(form.gradeLevel);
    const passSubjectGroup = !form.subjectGroupId || s.subjectGroup === form.subjectGroupId;
    return passDept && passGrade && passSubjectGroup;
  });
  const subjectGroupOptions = Object.entries(SUBJECT_GROUP_CONFIG).sort(([, a], [, b]) => a.order - b.order);
  const subSubjectOptions = form.subjectGroupId ? (SUBJECT_SUBGROUP_CONFIG[form.subjectGroupId] ?? []) : [];
  const subjectSelectMode: 'subgroup' | 'curriculum' =
    form.subjectGroupId && subSubjectOptions.length > 0 ? 'subgroup' : 'curriculum';

  const handleSubmit = async () => {
    if (!form.title || !form.password || !user?.uid || !academicYear || !activeSemester) return;
    setIsSubmitting(true);
    try {
      const selectedSubject = subjects.find(s => s.id === form.subjectId);
      const subjectName = selectedSubject ? selectedSubject.name : (form.subjectId || '');

      const selectedClass = classes.find(c => c.id === form.classId);
      const className = selectedClass ? `${selectedClass.gradeLevel}/${selectedClass.roomNumber}` : '';

      const now = Date.now();
      const roomData = {
        title: form.title,
        subjectId: form.subjectId,
        subjectName: subjectName,
        classId: form.classId,
        className: className,
        password: form.password,
        durationMinutes: form.durationMinutes,
        academicYearId: String(academicYear),
        departmentId: form.departmentId || 'secondary',
        gradeLevel: form.gradeLevel,
        subjectGroupId: form.subjectGroupId,
        semester: activeSemester as 1 | 2,
        settings: {
          shuffleQuestions: form.shuffleQuestions,
          showResultImmediately: form.showResultImmediately,
          allowReview: true,
          maxAttempts: form.maxAttempts,
        },
      };

      if (editRoom) {
        await onUpdate(editRoom.id, roomData);
      } else {
        await onCreate({
          ...roomData,
          startTime: now,
          endTime: now + form.durationMinutes * 60 * 1000,
          examPaperId: 'paper-001',
          teacherId: user.uid,
          teacherName: user.displayName || 'ครู',
          questionCount: 5,
          totalPoints: 100,
        });
      }
      onClose();
    } catch (err) {
      console.error('Error creating exam room:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="w-[92vw] sm:max-w-2xl rounded-[2rem] sm:rounded-[2.5rem] border border-slate-200/60 p-0 overflow-hidden"
        style={{
          background: 'rgba(255,255,255,0.7)',
          backdropFilter: 'blur(24px) saturate(180%)',
          WebkitBackdropFilter: 'blur(24px) saturate(180%)',
        }}
      >
        <div className="px-5 sm:px-6 pt-6 sm:pt-7 pb-2 sm:pb-3 flex justify-between items-center bg-transparent">
          <DialogTitle className="text-lg sm:text-xl font-black text-slate-800 tracking-tight">
            {editRoom ? 'แก้ไขห้องสอบ' : 'สร้างห้องสอบใหม่'}
          </DialogTitle>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleSubmit();
          }}
          className="px-5 sm:px-6 pb-6 sm:pb-7 space-y-3 max-h-[80vh] overflow-y-auto custom-scrollbar"
        >
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
              ชื่อห้องสอบ <span className="text-rose-400">*</span>
            </label>
            <Input
              value={form.title}
              onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
              placeholder="เช่น สอบกลางภาค คณิตศาสตร์ ม.3"
              className="h-9 rounded-xl bg-slate-50 border-none text-xs font-bold px-4"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">แผนก</label>
              <select
                value={form.departmentId}
                onChange={e => setForm(p => ({ ...p, departmentId: e.target.value as Department, gradeLevel: '', classId: '' }))}
                className="h-9 w-full rounded-xl bg-slate-50 border-none px-3 text-xs font-bold outline-none"
              >
                <option value="">เลือกแผนก</option>
                {Object.entries(DEPARTMENT_CONFIG).map(([id, cfg]) => (
                  <option key={id} value={id}>{cfg.label}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">ระดับชั้น</label>
              <select
                value={form.gradeLevel}
                onChange={e => setForm(p => ({ ...p, gradeLevel: e.target.value, classId: '' }))}
                disabled={!form.departmentId}
                className="h-9 w-full rounded-xl bg-slate-50 border-none px-3 text-xs font-bold outline-none disabled:opacity-50"
              >
                <option value="">เลือกระดับชั้น</option>
                {gradeOptions.map(g => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">ห้องเรียน</label>
              <select
                value={form.classId}
                onChange={e => setForm(p => ({ ...p, classId: e.target.value }))}
                disabled={!form.departmentId}
                className="h-9 w-full rounded-xl bg-slate-50 border-none px-3 text-xs font-bold outline-none disabled:opacity-50"
              >
                <option value="">เลือกห้องเรียน</option>
                {classOptions.map(c => (
                  <option key={c.id} value={c.id}>{c.gradeLevel}/{c.roomNumber}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">กลุ่มสาระ</label>
              <select
                value={form.subjectGroupId}
                onChange={e => setForm(p => ({ ...p, subjectGroupId: e.target.value as SubjectGroupId, subjectId: '' }))}
                className="h-9 w-full rounded-xl bg-slate-50 border-none px-3 text-xs font-bold outline-none"
              >
                <option value="">เลือกกลุ่มสาระ</option>
                {subjectGroupOptions.map(([id, cfg]) => (
                  <option key={id} value={id}>{cfg.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">วิชา / สาระย่อย</label>
              <select
                value={form.subjectId}
                onChange={e => setForm(p => ({ ...p, subjectId: e.target.value }))}
                disabled={!form.departmentId}
                className="h-9 w-full rounded-xl bg-slate-50 border-none px-3 text-xs font-bold outline-none disabled:opacity-50"
              >
                <option value="">
                  {subjectSelectMode === 'subgroup' ? 'เลือกวิชา/สาระย่อย' : 'เลือกรายวิชา'}
                </option>
                {subjectSelectMode === 'subgroup'
                  ? subSubjectOptions.map((sub) => (
                    <option key={sub} value={sub}>{sub}</option>
                  ))
                  : subjectOptions.map((s) => (
                    <option key={s.id} value={s.id}>{s.code} {s.name}</option>
                  ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                รหัสเข้าห้องสอบ <span className="text-rose-400">*</span>
              </label>
              <Input
                value={form.password}
                onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                placeholder="1234"
                className="h-9 rounded-xl bg-slate-50 border-none text-xs font-bold px-4"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">เวลา (นาที)</label>
              <Input
                type="number"
                min={1}
                value={form.durationMinutes}
                onChange={e => setForm(p => ({ ...p, durationMinutes: Number(e.target.value) }))}
                className="h-9 rounded-xl bg-slate-50 border-none text-xs font-bold px-4"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">จำนวนครั้งที่สอบได้</label>
              <select
                value={form.maxAttempts}
                onChange={e => setForm(p => ({ ...p, maxAttempts: Number(e.target.value) }))}
                className="h-9 w-full rounded-xl bg-slate-50 border-none px-3 text-xs font-bold outline-none"
              >
                <option value={0}>ไม่จำกัด</option>
                <option value={1}>1 ครั้ง</option>
                <option value={2}>2 ครั้ง</option>
                <option value={3}>3 ครั้ง</option>
              </select>
            </div>
          </div>

          <div className="space-y-2 rounded-xl bg-slate-50 p-3">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">ตั้งค่าการสอบ</p>
            {[
              { key: 'shuffleQuestions', label: 'สับเปลี่ยนลำดับข้อ' },
              { key: 'showResultImmediately', label: 'แสดงผลทันทีหลังส่ง' },
            ].map((opt) => {
              const isOn = Boolean(form[opt.key as keyof typeof form]);
              return (
                <label key={opt.key} className="flex items-center justify-between text-xs font-bold text-slate-600">
                  <span>{opt.label}</span>
                  <button
                    type="button"
                    onClick={() => setForm(p => ({ ...p, [opt.key]: !p[opt.key as keyof typeof p] }))}
                    className={`h-6 w-11 rounded-full p-0.5 transition-colors ${isOn ? 'bg-slate-900' : 'bg-slate-300'}`}
                  >
                    <span
                      className={`block h-5 w-5 rounded-full bg-white transition-transform ${isOn ? 'translate-x-5' : 'translate-x-0'}`}
                    />
                  </button>
                </label>
              );
            })}
          </div>

          <DialogFooter className="pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              className="rounded-xl font-bold text-slate-500 h-10"
            >
              ยกเลิก
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !form.title || !form.password}
              className="rounded-xl bg-slate-900 text-white font-bold px-10 h-10 border border-slate-800"
            >
              {isSubmitting ? 'กำลังบันทึก...' : editRoom ? 'บันทึกการแก้ไข' : 'สร้างห้องสอบ'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}


// ── Questions Panel ───────────────────────────────────────────────────────────
// Two-card layout: LEFT = bank browser + question picker, RIGHT = selected questions per round.
// Firebase efficiency: question sub-collections are fetched only when user opens a set (lazy).
// Round configs are stored as IDs inside the ExamRoom document (no extra sub-collection reads).

function QuestionsPanel({ room, onSave, onContentClick }: {
  room: ExamRoom;
  onSave: (
    roundKey: string,
    questionSetId: string,
    questionIds: string[],
    questionSetByQuestionId: Record<string, string>,
    totalPoints: number,
  ) => Promise<void>;
  onContentClick: (e: React.MouseEvent) => void;
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

  // Per-round selection state (local, synced from saved room data)
  const [roundDraft, setRoundDraft] = useState<Record<string, {
    questionSetId: string;
    questionIds: Set<string>;
    questionSetByQuestionId: Record<string, string>;
  }>>(() => {
    const init: Record<string, {
      questionSetId: string;
      questionIds: Set<string>;
      questionSetByQuestionId: Record<string, string>;
    }> = {};
    // Migrate legacy single-round data
    if (room.questionSetId && room.selectedQuestionIds) {
      init['1'] = {
        questionSetId: room.questionSetId,
        questionIds: new Set(room.selectedQuestionIds),
        questionSetByQuestionId: Object.fromEntries(
          room.selectedQuestionIds.map(qid => [qid, room.questionSetId as string]),
        ),
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
          questionIds: new Set(v.questionIds),
          questionSetByQuestionId: mapped,
        };
      });
    }
    return init;
  });

  // Left panel state: which set is open for picking
  const [openSetId, setOpenSetId] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [filterGroup, setFilterGroup] = useState<SubjectGroupId | 'all'>('all');
  const [filterDepartment, setFilterDepartment] = useState<Department | 'all'>('all');
  const [filterGradeLevel, setFilterGradeLevel] = useState<string | 'all'>('all');
  const failedHydrationRef = useRef<Set<string>>(new Set());

  const { questionSets, isLoading: setsLoading, filterQuestionSets } = useQuestionSetBank();
  // Lazy-load questions for the picker (left card)
  const { questions, isLoading: qLoading } = useSetQuestions(openSetId);

  // Cart-like cache: keep every loaded question so selections across multiple sets
  // can still be rendered on the right card without losing content.
  const [questionCache, setQuestionCache] = useState<Map<string, (typeof questions)[number]>>(
    () => new Map(),
  );
  const [setQuestionIdsMap, setSetQuestionIdsMap] = useState<Map<string, Set<string>>>(
    () => new Map(),
  );

  useEffect(() => {
    if (!openSetId) return;
    if (qLoading) return;
    setQuestionCache(prev => {
      const next = new Map(prev);
      questions.forEach(q => next.set(q.id, q));
      return next;
    });
    setSetQuestionIdsMap(prev => {
      const next = new Map(prev);
      next.set(openSetId, new Set(questions.map(q => q.id)));
      return next;
    });
  }, [openSetId, qLoading, questions]);

  const rightCardQuestions = useMemo(() => Array.from(questionCache.values()), [questionCache]);
  const [isHydratingSelected, setIsHydratingSelected] = useState(false);
  const rightCardLoading = isHydratingSelected;

  const [isSaving, setIsSaving] = useState<string | null>(null); // round key being saved
  const [savedRound, setSavedRound] = useState<string | null>(null);
  const [confirmSaveRound, setConfirmSaveRound] = useState<{ rk: string; removedCount: number } | null>(null);
  const [previewQuestion, setPreviewQuestion] = useState<any | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Synchronize picker set with active round when switching rounds
  useEffect(() => {
    const draft = roundDraft[activeRound];
    let timeoutId: any;
    if (draft?.questionSetId && draft.questionSetId !== openSetId) {
      setIsSyncing(true);
      setOpenSetId(draft.questionSetId);
      // Brief delay to allow hook to start loading
      timeoutId = setTimeout(() => setIsSyncing(false), 300);
    }
    return () => { if (timeoutId) clearTimeout(timeoutId); };
  }, [activeRound]); // Only sync when switching rounds

  const openSet = openSetId ? questionSets.find(s => s.id === openSetId) : null;

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

  // Currently selected IDs for the open set in the active round draft
  const currentDraft = roundDraft[activeRound];
  const draftIds = currentDraft?.questionIds ?? new Set<string>();
  const draftSetByQid = currentDraft?.questionSetByQuestionId ?? {};
  const pickerActive = openSetId !== null;

  const toggleQuestion = (id: string) => {
    if (!openSetId) return;
    setRoundDraft(prev => {
      const existing = prev[activeRound];
      const ids = existing ? new Set(existing.questionIds) : new Set<string>();
      const setMap = existing ? { ...existing.questionSetByQuestionId } : {} as Record<string, string>;
      if (ids.has(id)) {
        ids.delete(id);
        delete setMap[id];
      } else {
        // Prevent selecting the same question in another round
        const usedInOtherRound = roundKeys
          .filter(rk => rk !== activeRound)
          .some(rk => prev[rk]?.questionIds.has(id));
        if (usedInOtherRound) return prev;
        ids.add(id);
        setMap[id] = openSetId;
      }
      return {
        ...prev,
        [activeRound]: { questionSetId: openSetId, questionIds: ids, questionSetByQuestionId: setMap },
      };
    });
  };

  const selectAll = () => {
    if (!openSetId) return;
    setRoundDraft(prev => {
      const existing = prev[activeRound];
      const ids = existing ? new Set(existing.questionIds) : new Set<string>();
      const setMap = existing ? { ...existing.questionSetByQuestionId } : {} as Record<string, string>;
      questions.forEach(q => {
        const usedInOtherRound = roundKeys
          .filter(rk => rk !== activeRound)
          .some(rk => prev[rk]?.questionIds.has(q.id));
        if (!usedInOtherRound) {
          ids.add(q.id);
          setMap[q.id] = openSetId;
        }
      });
      return {
        ...prev,
        [activeRound]: { questionSetId: openSetId, questionIds: ids, questionSetByQuestionId: setMap },
      };
    });
  };

  const clearRound = (rk: string) => {
    setRoundDraft(prev => {
      const next = { ...prev };
      delete next[rk];
      return next;
    });
  };

  const calcPoints = (ids: Set<string>, allQ: typeof questions) =>
    allQ.filter(q => ids.has(q.id)).reduce((s, q) => {
      if (q.type === 'essay') { const p = q.payload as { maxScore?: number }; return s + (p.maxScore ?? 0); }
      return s + 1;
    }, 0);

  const handleSaveRound = async (rk: string) => {
    const draft = roundDraft[rk];
    if (!draft) return;
    // Points from cached questions (cart across sets); fallback = count
    const cached = Array.from(questionCache.values());
    const pts = cached.length > 0
      ? calcPoints(draft.questionIds, cached)
      : draft.questionIds.size;
    setIsSaving(rk);
    try {
      await onSave(
        rk,
        draft.questionSetId || openSetId || '',
        Array.from(draft.questionIds),
        draft.questionSetByQuestionId,
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
        const mergedMap = new Map<string, (typeof questions)[number]>();
        const mergedSetMap = new Map<string, Set<string>>();
        const fetchSet = async (setId: string) => {
          if (!setId || fetchedSetIds.has(setId)) return;
          fetchedSetIds.add(setId);
          try {
            const snap = await getDocs(collection(db, QUESTION_SETS_COL, setId, 'questions'));
            const qs = snap.docs.map(d => ({ id: d.id, setId, ...d.data() })) as (typeof questions)[number][];
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
      } finally {
        if (!cancelled) setIsHydratingSelected(false);
      }
    };
    void hydrate();
    return () => { cancelled = true; };
  }, [activeRound, questionCache, questionSets, questions, roundDraft, setQuestionIdsMap]);

  // ── Derived: total counts per round for the right card ──────────────────
  const roundSummary = useMemo(() => {
    const res: Record<string, { count: number }> = {};
    roundKeys.forEach(rk => {
      const draft = roundDraft[rk];
      if (draft) {
        res[rk] = { count: draft.questionIds.size };
      }
    });
    return res;
  }, [roundDraft, roundKeys]);

  return (
    <div className="flex flex-col gap-4">
      {/* Round tabs — shown only when maxAttempts > 1 */}
      {roundKeys.length > 1 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-sukhumvit shrink-0">รอบ</span>
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
                  <span className="ml-1 text-[9px]">• {roundDraft[rk]!.questionIds.size}</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Two-card layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* ── Card 1: Bank browser ── */}
        <div className="flex flex-col gap-3 rounded-[1.75rem] p-4"
          style={{
            background: 'rgba(248,250,252,0.8)',
            border: '1px solid rgba(226,232,240,0.6)',
            minHeight: '420px',
          }}>
          <div className="flex items-center justify-between shrink-0">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-sukhumvit">
              {openSet ? openSet.title : 'คลังข้อสอบ'}
            </p>
            {openSet && (
              <button onClick={() => setOpenSetId(null)}
                className="flex items-center gap-1 text-[10px] font-bold text-slate-500 hover:text-slate-700 transition-colors font-sarabun">
                <ArrowLeft size={11} /> กลับ
              </button>
            )}
          </div>

          {!openSet ? (
            <>
              {/* Search */}
              <div className="relative shrink-0">
                <input
                  value={searchText}
                  onChange={e => setSearchText(e.target.value)}
                  placeholder="ค้นหาชุดข้อสอบ..."
                  className="w-full h-12 rounded-[1.25rem] bg-white/95 border border-slate-200 px-5 pr-10 text-[14px] font-bold outline-none text-slate-700 placeholder:text-slate-400 font-sarabun"
                />
                {searchText && (
                  <button onClick={() => setSearchText('')}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Group select */}
              <div className="shrink-0">
                <select
                  value={filterGroup}
                  onChange={(e) => setFilterGroup(e.target.value as SubjectGroupId | 'all')}
                  className="h-11 w-full rounded-[1.1rem] border border-slate-200 bg-white/95 px-4 text-[13px] font-bold text-slate-700 font-sukhumvit outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                >
                  <option value="all">ทุกกลุ่มสาระ</option>
                  {subjectGroupOptions.map(([gid, cfg]) => (
                    <option key={gid} value={gid}>
                      {cfg.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Department select */}
              <div className="shrink-0">
                <select
                  value={filterDepartment}
                  onChange={(e) => {
                    const nextDepartment = e.target.value as Department | 'all';
                    setFilterDepartment(nextDepartment);
                    setFilterGradeLevel('all');
                  }}
                  className="h-11 w-full rounded-[1.1rem] border border-slate-200 bg-white/95 px-4 text-[13px] font-bold text-slate-700 font-sukhumvit outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                >
                  <option value="all">ทุกแผนก</option>
                  {Object.entries(DEPARTMENT_CONFIG).map(([deptId, cfg]) => (
                    <option key={deptId} value={deptId}>
                      {cfg.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Grade level select */}
              <div className="shrink-0">
                <select
                  value={filterGradeLevel}
                  onChange={(e) => setFilterGradeLevel(e.target.value)}
                  disabled={filterDepartment === 'all'}
                  className="h-11 w-full rounded-[1.1rem] border border-slate-200 bg-white/95 px-4 text-[13px] font-bold text-slate-700 font-sukhumvit outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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

              {/* Set list */}
              <div className="flex-1 overflow-y-auto flex flex-col gap-2 min-h-0 scrollbar-hide">
                {setsLoading ? (
                  <div className="py-10 flex flex-col items-center justify-center gap-4">
                    <IndeterminateProgress />
                    <p className="text-slate-400 text-[12px] font-sarabun text-center">กำลังโหลด...</p>
                  </div>
                ) : filteredSets.length === 0 ? (
                  <div className="py-10 text-center text-slate-400">
                    <FileText size={24} className="mx-auto mb-2 text-slate-300" />
                    <p className="text-[12px] font-sarabun">ไม่พบชุดข้อสอบ</p>
                  </div>
                ) : filteredSets.map(set => {
                  const grpCfg = SUBJECT_GROUP_CONFIG[set.subjectGroup];
                  const selectedIds = roundDraft[activeRound]?.questionIds ?? new Set<string>();
                  const selectedInThisSet = Array.from(selectedIds).reduce(
                    (acc, qid) => acc + ((roundDraft[activeRound]?.questionSetByQuestionId?.[qid] === set.id) ? 1 : 0),
                    0,
                  );
                  const usedInRound = selectedInThisSet > 0;
                  return (
                    <button key={set.id}
                      onClick={() => setOpenSetId(set.id)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-2xl text-left w-full transition-all"
                      style={{
                        background: usedInRound ? 'rgba(99,102,241,0.07)' : 'rgba(255,255,255,0.9)',
                        border: usedInRound ? '1.5px solid rgba(99,102,241,0.22)' : '1px solid rgba(226,232,240,0.5)',
                      }}>
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: grpCfg?.bg ?? 'rgba(226,232,240,0.5)' }}>
                        <BookOpen size={12} style={{ color: grpCfg?.color ?? '#94a3b8' }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-[12px] font-black font-sukhumvit text-slate-800 truncate">{set.title}</p>
                          {!set.isPublished && (
                            <span className="text-[8px] font-black px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-600 shrink-0">ร่าง</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[9px] font-bold font-sarabun px-1.5 py-0.5 rounded-md"
                            style={{ color: grpCfg?.color ?? '#6b7280', background: grpCfg?.bg ?? 'rgba(226,232,240,0.5)' }}>
                            {grpCfg?.name ?? set.subjectGroup}
                          </span>
                          <span className="text-[9px] text-slate-400 font-sarabun">{set.questionCount} ข้อ</span>
                        </div>
                      </div>
                      {usedInRound && (
                        <div className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg"
                          style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.2)' }}>
                          <CheckCircle2 size={10} className="text-indigo-500" />
                          <span className="text-[9px] font-black text-indigo-600 font-sukhumvit">เลือกแล้ว {selectedInThisSet}</span>
                        </div>
                      )}
                      <span className="text-slate-300 shrink-0 text-sm">›</span>
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            /* ── Question picker (inside a set) ── */
            <>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={selectAll}
                  className="px-2 py-1 rounded-lg text-[10px] font-black text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-all font-sukhumvit">
                  เลือกทั้งหมด
                </button>
                <button onClick={() => {
                  if (!openSetId) return;
                  setRoundDraft(prev => {
                    const existing = prev[activeRound];
                    if (!existing) return prev;
                    const nextIds = new Set(
                      Array.from(existing.questionIds).filter(
                        id => existing.questionSetByQuestionId[id] !== openSetId,
                      ),
                    );
                    if (nextIds.size === 0) {
                      const next = { ...prev };
                      delete next[activeRound];
                      return next;
                    }
                    return {
                      ...prev,
                      [activeRound]: {
                        questionSetId: existing.questionSetId,
                        questionIds: nextIds,
                        questionSetByQuestionId: Object.fromEntries(
                          Array.from(nextIds).map(id => [id, existing.questionSetByQuestionId[id] ?? openSetId ?? '']),
                        ),
                      },
                    };
                  });
                }}
                  className="px-2 py-1 rounded-lg text-[10px] font-black text-slate-500 bg-slate-100 hover:bg-slate-200 transition-all font-sukhumvit">
                  ล้าง
                </button>
                <span className="ml-auto text-[10px] text-slate-400 font-sarabun">
                  {pickerActive ? draftIds.size : 0}/{questions.length} ข้อ
                </span>
              </div>

              <div className="flex-1 overflow-y-auto flex flex-col gap-2 min-h-0 scrollbar-hide">
                {pickerActive && draftIds.size > 0 && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl shrink-0"
                    style={{ background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.16)' }}>
                    <CheckCircle2 size={12} className="text-indigo-500 shrink-0" />
                    <p className="text-[10px] font-black text-indigo-600 font-sukhumvit">
                      ข้อสอบจากชุดนี้ถูกเลือกแล้ว {
                        openSetId
                          ? Array.from(draftIds).reduce((acc, qid) => acc + (draftSetByQid[qid] === openSetId ? 1 : 0), 0)
                          : 0
                      } ข้อ
                    </p>
                  </div>
                )}
                {qLoading ? (
                  <div className="py-8 flex flex-col items-center justify-center gap-4">
                    <IndeterminateProgress />
                    <p className="text-slate-400 text-[12px] font-sarabun text-center">กำลังโหลด...</p>
                  </div>
                ) : questions.length === 0 ? (
                  <div className="py-8 text-center text-slate-400">
                    <FileText size={20} className="mx-auto mb-1.5 text-slate-300" />
                    <p className="text-[12px] font-sarabun">ไม่มีข้อสอบในชุดนี้</p>
                  </div>
                ) : questions.map((q, idx) => {
                  const isSelected = pickerActive && draftIds.has(q.id);
                  const usedInOtherRound = roundKeys
                    .filter(rk => rk !== activeRound)
                    .some(rk => roundDraft[rk]?.questionIds.has(q.id));
                  const diffCfg = DIFFICULTY_CONFIG[q.difficulty];
                  const typeCfg = TYPE_CONFIG[q.type];
                  return (
                    <button key={q.id}
                      onClick={() => !usedInOtherRound && toggleQuestion(q.id)}
                      disabled={usedInOtherRound}
                      className="flex items-start gap-2.5 px-3 py-2.5 rounded-2xl text-left w-full transition-all"
                      style={{
                        background: isSelected ? 'rgba(99,102,241,0.07)' : usedInOtherRound ? 'rgba(241,245,249,0.6)' : 'rgba(255,255,255,0.9)',
                        border: isSelected ? '1.5px solid rgba(99,102,241,0.25)' : usedInOtherRound ? '1px solid rgba(226,232,240,0.4)' : '1px solid rgba(226,232,240,0.5)',
                        opacity: usedInOtherRound ? 0.5 : 1,
                        cursor: usedInOtherRound ? 'not-allowed' : 'pointer',
                      }}>
                      <div className="w-4.5 h-4.5 rounded-md shrink-0 mt-0.5 flex items-center justify-center"
                        style={{
                          width: 18, height: 18,
                          background: isSelected ? '#6366f1' : 'rgba(226,232,240,0.6)',
                          border: isSelected ? 'none' : '1.5px solid rgba(203,213,225,0.8)',
                        }}>
                        {isSelected && <Check size={10} className="text-white" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1 mb-0.5 flex-wrap">
                          <span className="text-[9px] font-black text-slate-400">#{idx + 1}</span>
                          <span className="text-[8px] font-black px-1 py-0.5 rounded-md"
                            style={{ color: diffCfg.color, background: diffCfg.bg }}>{diffCfg.label}</span>
                          <span className="text-[8px] font-black px-1 py-0.5 rounded-md"
                            style={{ color: typeCfg.color, background: typeCfg.bg }}>{typeCfg.shortLabel}</span>
                          {usedInOtherRound && (
                            <span className="text-[8px] font-black px-1 py-0.5 rounded-md bg-amber-50 text-amber-500 shrink-0">ใช้แล้ว</span>
                          )}
                          <div onClick={(e) => { e.stopPropagation(); setPreviewQuestion(q); }}
                            role="button"
                            tabIndex={0}
                            className="ml-auto w-5 h-5 rounded-md bg-indigo-50 hover:bg-indigo-100 flex items-center justify-center transition-all cursor-pointer">
                            <Eye size={10} className="text-indigo-500" />
                          </div>
                        </div>
                        <p className="text-[11px] font-bold text-slate-700 font-sarabun leading-snug line-clamp-3 [&_p]:m-0"
                          dangerouslySetInnerHTML={{ __html: stripImagesFromHtml(q.questionText) }} />
                      </div>
                    </button>
                  );
                })}
              </div>

            </>
          )}
        </div>

        {/* ── Card 2: Selected questions per round ── */}
        <div className="flex flex-col gap-3 rounded-[1.75rem] p-4"
          style={{
            background: 'rgba(255,255,255,0.9)',
            border: '1px solid rgba(226,232,240,0.6)',
            minHeight: '420px',
          }}>
          <div className="flex items-center justify-between shrink-0">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-sukhumvit">
              ข้อสอบที่เลือก
            </p>
            <div className="flex items-center gap-3">
              {roundKeys.length > 1 && (
                <span className="text-[9px] font-bold text-slate-400 font-sarabun">
                  {roundKeys.filter(rk => !!roundDraft[rk]?.questionIds.size).length}/{roundKeys.length} รอบตั้งค่าแล้ว
                </span>
              )}

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
                {savedRound === activeRound ? <Check size={11} /> : <Save size={11} />}
                {savedRound === activeRound ? 'บันทึกแล้ว' : isSaving === activeRound ? 'กำลังบันทึก...' : 'บันทึก'}
              </button>
            </div>
          </div>

          {roundKeys.length === 1 ? (
            /* Single round: simple card-style question list */
            (() => {
              const draft = roundDraft[roundKeys[0]!];
              if (!draft || draft.questionIds.size === 0) {
                return (
                  <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                    <FileText size={28} className="mb-2 text-slate-300" />
                    <p className="text-[12px] font-sarabun">ยังไม่มีข้อสอบที่เลือก</p>
                    <p className="text-[10px] text-slate-300 font-sarabun mt-1">เลือกจากคลังด้านซ้าย</p>
                  </div>
                );
              }
              return (
                <div className="flex flex-col gap-3 flex-1 min-h-0">
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl shrink-0"
                    style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)' }}>
                    <CheckCircle2 size={12} className="text-indigo-500 shrink-0" />
                    <p className="text-[11px] font-black text-indigo-700 font-sukhumvit">
                      เลือกแล้ว {draft.questionIds.size} ข้อ
                    </p>
                    <button onClick={() => clearRound(roundKeys[0]!)}
                      className="ml-auto w-6 h-6 rounded-lg bg-rose-50 hover:bg-rose-100 flex items-center justify-center transition-all shrink-0">
                      <X size={10} className="text-rose-400" />
                    </button>
                  </div>
                  {rightCardLoading ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-400 py-12">
                      <div className="mb-4">
                        <IndeterminateProgress />
                      </div>
                      <p className="text-[10px] font-sarabun">กำลังโหลดข้อสอบ...</p>
                    </div>
                  ) : (
                    <div className="flex-1 overflow-y-auto flex flex-col gap-2 min-h-0 scrollbar-hide">
                      {Array.from(draft.questionIds).map((qId, i) => {
                        const q = rightCardQuestions.find(item => item.id === qId);
                        if (!q) return (
                          <div key={qId} className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-100 text-[10px] text-slate-400">
                            #{i + 1} {qId.slice(-6)}
                          </div>
                        );
                        const diffCfg = DIFFICULTY_CONFIG[q.difficulty];
                        const typeCfg = TYPE_CONFIG[q.type];
                        return (
                          <div key={q.id}
                            className="flex items-start gap-2.5 px-3 py-2.5 rounded-2xl bg-white border border-slate-100 transition-all hover:border-indigo-100">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1 mb-0.5 flex-wrap">
                                <span className="text-[9px] font-black text-slate-400">#{i + 1}</span>
                                <span className="text-[8px] font-black px-1 py-0.5 rounded-md"
                                  style={{ color: diffCfg.color, background: diffCfg.bg }}>{diffCfg.label}</span>
                                <span className="text-[8px] font-black px-1 py-0.5 rounded-md"
                                  style={{ color: typeCfg.color, background: typeCfg.bg }}>{typeCfg.shortLabel}</span>
                                <button onClick={(e) => { e.stopPropagation(); setPreviewQuestion(q); }}
                                  className="ml-auto w-5 h-5 rounded-md bg-indigo-50 hover:bg-indigo-100 flex items-center justify-center transition-all">
                                  <Eye size={10} className="text-indigo-500" />
                                </button>
                              </div>
                              <p className="text-[11px] font-bold text-slate-700 font-sarabun leading-snug line-clamp-3 [&_p]:m-0"
                                dangerouslySetInnerHTML={{ __html: stripImagesFromHtml(q.questionText) }} />
                            </div>
                            <button onClick={() => toggleQuestion(q.id)}
                              className="w-6 h-6 rounded-lg bg-rose-50 hover:bg-rose-100 flex items-center justify-center transition-all shrink-0">
                              <X size={10} className="text-rose-400" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()
          ) : (
            /* Multi-round: show only the active round's selected questions as a clean list */
            <div className="flex-1 overflow-y-auto flex flex-col gap-2 min-h-0 scrollbar-hide">
              {(() => {
                const rk = activeRound;
                const draft = roundDraft[rk];
                const summary = roundSummary[rk];

                if (!summary || summary.count === 0) {
                  return (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-400 py-12">
                      <FileText size={28} className="mb-2 text-slate-300" />
                      <p className="text-[12px] font-sarabun">ยังไม่มีข้อสอบที่เลือกในรอบนี้</p>
                      <p className="text-[10px] text-slate-300 font-sarabun mt-1">เลือกจากคลังด้านซ้าย</p>
                    </div>
                  );
                }

                if (isSyncing || rightCardLoading) {
                  return (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-400 py-12">
                      <div className="mb-4">
                        <IndeterminateProgress />
                      </div>
                      <p className="text-[10px] font-sarabun">กำลังโหลดข้อสอบ...</p>
                    </div>
                  );
                }

                return (
                  <div className="flex flex-col gap-2">
                    {Array.from(draft.questionIds).map((qId, i) => {
                      const q = rightCardQuestions.find(item => item.id === qId);
                      if (!q) {
                        // If we have questionIds but q is not found, and we're not loading, 
                        // it might be a momentary mismatch or the set changed.
                        return (
                          <div key={qId} className="px-3 py-2.5 rounded-2xl bg-slate-50 border border-slate-100 text-[10px] text-slate-400 flex items-center justify-between">
                            <span>#{i + 1} {qId.slice(-6)} (ไม่พบข้อมูล)</span>
                            <button onClick={(e) => { e.stopPropagation(); toggleQuestion(qId); }}
                              className="w-6 h-6 rounded-lg bg-rose-50 hover:bg-rose-100 flex items-center justify-center transition-all shrink-0">
                              <X size={10} className="text-rose-400" />
                            </button>
                          </div>
                        );
                      }
                      const diffCfg = DIFFICULTY_CONFIG[q.difficulty];
                      const typeCfg = TYPE_CONFIG[q.type];
                      return (
                        <div key={q.id}
                          className="flex items-start gap-2.5 px-3 py-2.5 rounded-2xl transition-all bg-white border border-slate-100">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1 mb-0.5 flex-wrap">
                              <span className="text-[9px] font-black text-slate-400">#{i + 1}</span>
                              <span className="text-[8px] font-black px-1 py-0.5 rounded-md"
                                style={{ color: diffCfg.color, background: diffCfg.bg }}>{diffCfg.label}</span>
                              <span className="text-[8px] font-black px-1 py-0.5 rounded-md"
                                style={{ color: typeCfg.color, background: typeCfg.bg }}>{typeCfg.shortLabel}</span>
                              <button onClick={(e) => { e.stopPropagation(); setPreviewQuestion(q); }}
                                className="ml-auto w-5 h-5 rounded-md bg-indigo-50 hover:bg-indigo-100 flex items-center justify-center transition-all">
                                <Eye size={10} className="text-indigo-500" />
                              </button>
                            </div>
                            <p className="text-[11px] font-bold text-slate-700 font-sarabun leading-snug line-clamp-3 [&_p]:m-0"
                              dangerouslySetInnerHTML={{ __html: stripImagesFromHtml(q.questionText) }} />
                          </div>
                          <button onClick={(e) => { e.stopPropagation(); toggleQuestion(q.id); }}
                            className="w-6 h-6 rounded-lg bg-rose-50 hover:bg-rose-100 flex items-center justify-center transition-all shrink-0">
                            <X size={10} className="text-rose-400" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </div>

      {/* ── Question Preview Dialog ────────────────────────────────────────── */}
      <Dialog open={!!previewQuestion} onOpenChange={() => setPreviewQuestion(null)}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto rounded-[2rem] p-0 border border-slate-200/60 bg-slate-50/95 backdrop-blur-xl">
          <DialogTitle className="sr-only">พรีวิวข้อสอบ</DialogTitle>
          {previewQuestion && (
            <div className="flex flex-col">
              {/* Header */}
              <div className="px-6 py-4 flex items-center justify-between border-b border-white/40 sticky top-0 bg-slate-50/50 backdrop-blur-md z-10">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-indigo-500 flex items-center justify-center text-white">
                    <FileText size={16} />
                  </div>
                  <div>
                    <div className="text-[14px] font-black text-slate-800 font-sukhumvit">พรีวิวข้อสอบ</div>
                    <p className="text-[10px] text-slate-400 font-sarabun uppercase tracking-widest">
                      {DIFFICULTY_CONFIG[previewQuestion.difficulty as keyof typeof DIFFICULTY_CONFIG]?.label} • {TYPE_CONFIG[previewQuestion.type as keyof typeof TYPE_CONFIG]?.label}
                    </p>
                  </div>
                </div>
                <button onClick={() => setPreviewQuestion(null)}
                  className="w-8 h-8 rounded-full bg-white border border-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-all">
                  <X size={16} />
                </button>
              </div>

              {/* Content */}
              <div className="p-8">
                <div className="prose prose-slate max-w-none">
                  <div className="flex flex-col text-[16px] text-slate-700 font-sarabun leading-relaxed break-words [&_img]:max-w-full [&_img]:rounded-2xl [&_img]:border [&_img]:border-slate-100 [&_img]:my-6 [&_img]:mx-auto cursor-pointer [&_img]:transition-all [&_img]:hover:brightness-110 [&_img]:order-last"
                    dangerouslySetInnerHTML={{ __html: previewQuestion.questionText }}
                    onClick={onContentClick} />
                </div>

                {/* Choices if available */}
                {previewQuestion.type === 'multiple_choice' && (previewQuestion.payload as any)?.options && (
                  <div className="mt-8 grid grid-cols-2 gap-3">
                    {(previewQuestion.payload as any).options.map((choice: any, idx: number) => {
                      const isCorrect = choice.isCorrect;
                      return (
                        <div key={idx} className="flex items-start gap-3 py-2.5 px-4 rounded-xl transition-all"
                          style={{ 
                            background: isCorrect ? 'rgba(16,185,129,0.05)' : 'white',
                            border: isCorrect ? '1.5px solid rgba(16,185,129,0.3)' : '1px solid rgba(226,232,240,0.8)'
                          }}>
                          <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5"
                            style={{ 
                              background: isCorrect ? '#10b981' : 'rgba(241,245,249,0.9)',
                              color: isCorrect ? 'white' : '#94a3b8',
                              border: isCorrect ? 'none' : '1px solid rgba(226,232,240,0.8)'
                            }}>
                            {isCorrect ? <Check size={10} /> : String.fromCharCode(65 + idx)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div 
                              className="text-[14px] text-slate-700 font-sarabun leading-relaxed cursor-pointer break-words prose prose-slate prose-sm max-w-none [&_p]:m-0"
                              dangerouslySetInnerHTML={{ __html: choice.text || '<span class="text-slate-400 font-normal italic">ไม่มีข้อความ</span>' }}
                              onClick={onContentClick} 
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="p-6 bg-white/50 border-t border-white/40 flex justify-end">
                <Button onClick={() => setPreviewQuestion(null)} className="rounded-xl px-6 font-black font-sukhumvit bg-slate-800 hover:bg-slate-900">
                  ปิดหน้าต่าง
                </Button>
              </div>
            </div>
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


function ScoreSettingsPanel({ room, onSave }: {
  room: ExamRoom;
  onSave: (subjects: GradeBookSubjectLink[], scoreType: GradeScoreType) => Promise<void>;
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
            semesters,
          } satisfies SubjectOption;
        }
        return null;
      })
      .filter((s): s is SubjectOption => s !== null);
  }, [classRoom, relatedClassRooms, legacySubjects, coursesByVersion]);

  const handleSave = async () => {
    const selectedSubjects = selectedSubjectIds
      .map((id) => subjects.find((s) => s.id === id))
      .filter((s): s is SubjectOption => !!s)
      .map((s) => ({
        subjectId: s.id,
        subjectName: s.name,
        subjectCode: s.code ?? '',
      }));
    const hasLinkedNow = currentLinked.length > 0;
    if (selectedSubjects.length === 0 && !hasLinkedNow) return;
    setIsSaving(true);
    try {
      await onSave(selectedSubjects, selectedScoreType);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setIsSaving(false);
    }
  };

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

      {/* Section label */}
      <div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 font-sukhumvit">
          รายวิชาที่ผูกกับห้องเรียน{classRoom ? ` ${classRoom.gradeLevel}/${classRoom.roomNumber}` : ''}
        </p>
        <p className="text-[11px] text-slate-400 font-sarabun mb-3">
          เลือกได้สูงสุด {maxLinkedSubjects} วิชา (ขณะนี้เลือก {selectedSubjectIds.length} วิชา)
        </p>

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
                    background: isSelected ? 'rgba(99,102,241,0.08)' : 'rgba(248,250,252,0.8)',
                    border: isSelected ? '1.5px solid rgba(99,102,241,0.35)' : '1px solid rgba(226,232,240,0.6)',
                  }}
                >
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: isSelected ? 'rgba(99,102,241,0.15)' : 'rgba(226,232,240,0.5)' }}>
                    <FileText size={13} className={isSelected ? 'text-indigo-500' : 'text-slate-400'} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-[13px] font-black font-sukhumvit truncate ${isSelected ? 'text-indigo-700' : 'text-slate-700'}`}>
                      {subject.name}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      {subject.code && (
                        <p className="text-[10px] font-bold text-slate-400 font-sarabun">{subject.code}</p>
                      )}
                      <span className="text-[9px] font-bold text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded-md font-sarabun">
                        เทอม {subject.semesters.join('/')}
                      </span>
                    </div>
                  </div>
                  {isSelected && (
                    <div className="w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center shrink-0">
                      <Check size={11} className="text-white" />
                    </div>
                  )}
                </motion.button>
              );
            })}
          </div>
        )}
      </div>



      {/* Save button */}
      <div className="flex justify-center mt-6">
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={() => { void handleSave(); }}
          disabled={(!selectedSubjectIds.length && !hasCurrentLinked) || isSaving}
          className="px-12 py-2.5 rounded-xl text-[13px] font-black text-white transition-all disabled:opacity-40 font-sukhumvit min-w-[200px]"
          style={{
            background: saved
              ? 'linear-gradient(135deg,#059669,#10b981)'
              : 'linear-gradient(135deg,#0f172a,#334155)',
            boxShadow: saved ? '0 8px 20px -6px rgba(5,150,105,0.25)' : '0 8px 20px -6px rgba(15,23,42,0.2)',
          }}
        >
          {saved ? '✓ บันทึกเรียบร้อย' : isSaving ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}
        </motion.button>
      </div>
    </div>
  );
}

// ── Room Card ─────────────────────────────────────────────────────────────────
function RoomCard({
  room, onProctor, onChangeStatus, onDelete, onEdit, onOpenSettings, isStudent, onTakeExam,
  canEdit, canDelete, myAttempt, onShowSummary,
}: {
  room: ExamRoom;
  onProctor: () => void;
  onChangeStatus: (status: ExamRoom['status']) => void;
  onDelete: () => void;
  onEdit: () => void;
  onOpenSettings: () => void;
  isStudent?: boolean;
  onTakeExam?: () => void;
  canEdit?: boolean;
  canDelete?: boolean;
  myAttempt?: ExamAttempt | null;
  onShowSummary: (room: ExamRoom, attempt: ExamAttempt) => void;
}) {
  const maxAttempts = room.settings?.maxAttempts ?? 1;
  const completedRounds = room.completedRounds ?? 0;
  const currentRound = room.currentRound ?? 0;
  const roundLabel = maxAttempts === 0
    ? `รอบที่ ${currentRound > 0 ? currentRound : completedRounds + 1}`
    : `${completedRounds}/${maxAttempts} รอบ`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-[2rem] p-5 flex flex-col gap-4 transition-all duration-300"
      style={{
        background: 'rgba(255,255,255,0.92)',
        border: '1px solid rgba(226,232,240,0.8)',
      }}
    >
      {/* Top */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <StatusBadge status={room.status} />
            {room.subjectName && (
              <span className="text-[10px] font-bold text-slate-400 font-sarabun truncate">{room.subjectName}</span>
            )}
          </div>
          <h3 className="text-[15px] font-black text-slate-800 font-sukhumvit leading-tight">{room.title}</h3>
          {room.className && (
            <p className="text-[11px] text-slate-400 font-sarabun mt-0.5">ห้อง {room.className}</p>
          )}
        </div>
        {/* Gear button → only for users with edit permission */}
        {!isStudent && canEdit && (
          <button
            onClick={onOpenSettings}
            className="w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:bg-slate-100 border border-slate-100 shrink-0"
            title="ตั้งค่าห้องสอบ"
          >
            <Settings size={14} className="text-slate-400" />
          </button>
        )}
      </div>

      {/* Info row */}
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col items-center gap-0.5 py-2 rounded-2xl border border-slate-100"
          style={{ background: 'rgba(248,250,252,0.8)' }}>
          <Timer size={12} className="text-slate-400" />
          <p className="text-[12px] font-black text-slate-700 font-sukhumvit">{room.durationMinutes} นาที</p>
          <p className="text-[9px] text-slate-400 font-sarabun">เวลาสอบ</p>
        </div>
        <div className="flex flex-col items-center gap-0.5 py-2 rounded-2xl border border-slate-100"
          style={{ background: room.status === 'active' ? 'rgba(5,150,105,0.08)' : 'rgba(248,250,252,0.8)' }}>
          <Users size={12} className={room.status === 'active' ? 'text-emerald-500' : 'text-slate-400'} />
          <p className={`text-[12px] font-black font-sukhumvit ${room.status === 'active' ? 'text-emerald-600' : 'text-slate-700'}`}>
            {roundLabel}
          </p>
          <p className="text-[9px] text-slate-400 font-sarabun">รอบการสอบ</p>
        </div>
      </div>

      {/* Time info */}
      <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-sarabun">
        <Clock size={11} />
        {room.status === 'active' && (
          <div className="flex items-center gap-2">
            <span>กำลังสอบ <b className="text-emerald-600">รอบที่ {room.currentRound ?? 1}</b></span>
            <CountdownTimer startTime={room.startTime} durationMinutes={room.durationMinutes} />
          </div>
        )}
        {room.status === 'upcoming' && (room.completedRounds ?? 0) > 0 && (
          <span>รอเปิด <b className="text-slate-700">รอบที่ {(room.completedRounds ?? 0) + 1}</b></span>
        )}
        {room.status === 'upcoming' && (room.completedRounds ?? 0) === 0 && (
          <span className="text-slate-400">รอเปิดสอบ</span>
        )}
        {room.status === 'closed' && <span className="text-slate-400">สิ้นสุดการสอบทุกรอบแล้ว</span>}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        {isStudent ? (
          /* Student view */
          <div className="flex items-center gap-2 flex-1">
            {room.status === 'active' && (
              <motion.button whileTap={{ scale: 0.98 }}
                onClick={onTakeExam}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[11px] font-bold text-white flex-1 justify-center transition-all border border-indigo-200/50"
                style={{ background: 'linear-gradient(135deg,#6366f1,#818cf8)' }}>
                <BookOpen size={12} /> ทำข้อสอบ
              </motion.button>
            )}
            {myAttempt && (myAttempt.status === 'submitted' || myAttempt.status === 'graded') && (
              <div className="flex items-center gap-2 flex-1">
                <motion.button whileTap={{ scale: 0.98 }}
                  onClick={() => window.location.href = `/exam/${room.id}`}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[11px] font-bold flex-1 justify-center transition-all border"
                  style={{
                    background: myAttempt.score !== null && myAttempt.score !== undefined
                      ? 'rgba(5,150,105,0.08)' : 'rgba(248,250,252,0.9)',
                    borderColor: myAttempt.score !== null && myAttempt.score !== undefined
                      ? 'rgba(5,150,105,0.25)' : 'rgba(226,232,240,0.8)',
                    color: myAttempt.score !== null && myAttempt.score !== undefined ? '#059669' : '#64748b',
                  }}>
                  <FileText size={12} />
                  {myAttempt.score !== null && myAttempt.score !== undefined
                    ? `${myAttempt.score}/${room.totalPoints ?? '?'} คะแนน`
                    : 'ดูผลสอบ'}
                </motion.button>
                
                <motion.button whileTap={{ scale: 0.9 }}
                  onClick={() => onShowSummary(room, myAttempt)}
                  className="w-9 h-9 rounded-xl flex items-center justify-center transition-all border shrink-0"
                  style={{
                    background: 'rgba(99,102,241,0.08)',
                    borderColor: 'rgba(99,102,241,0.2)',
                    color: '#6366f1'
                  }}
                  title="สรุปคะแนน">
                  <BarChart2 size={14} />
                </motion.button>
              </div>
            )}
          </div>
        ) : (
          <>
            {canEdit && (
              <motion.button whileTap={{ scale: 0.98 }}
                onClick={onProctor}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold text-white flex-1 justify-center transition-all"
                style={{ background: '#0f172a' }}>
                <Eye size={12} /> Proctor
              </motion.button>
            )}

            {canEdit && room.status === 'upcoming' && (
              <motion.button whileTap={{ scale: 0.98 }}
                onClick={() => onChangeStatus('active')}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold flex-1 justify-center transition-all"
                style={{ background: '#d1fae5', color: '#059669' }}>
                <Play size={12} />
                เปิดสอบ{(room.completedRounds ?? 0) > 0 ? ` รอบ ${(room.completedRounds ?? 0) + 1}` : ''}
              </motion.button>
            )}
            {canEdit && room.status === 'active' && (
              <motion.button whileTap={{ scale: 0.98 }}
                onClick={() => onChangeStatus('closed')}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold flex-1 justify-center transition-all"
                style={{ background: '#ffe4e6', color: '#e11d48' }}>
                <Square size={12} /> ปิดสอบรอบ {room.currentRound ?? 1}
              </motion.button>
            )}

            {canEdit && (
              <motion.button whileTap={{ scale: 0.95 }}
                onClick={onEdit}
                className="w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:bg-slate-100">
                <Pencil size={13} className="text-slate-400" />
              </motion.button>
            )}

            {canDelete && (
              <motion.button whileTap={{ scale: 0.95 }}
                onClick={onDelete}
                className="w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:bg-rose-50">
                <Trash2 size={13} className="text-rose-400" />
              </motion.button>
            )}
          </>
        )}
      </div>
    </motion.div>
  );
}

// ── Score Config Panel ────────────────────────────────────────────────────────

type ScoreCollectionTypeLocal = 'classwork' | 'quiz' | 'midterm' | 'final';

const SCORE_COLLECTION_CONFIG: Record<ScoreCollectionTypeLocal, { label: string; desc: string; color: string; bg: string; border: string }> = {
  classwork: { label: 'ประเมินผล', desc: 'คะแนนเก็บระหว่างเรียน', color: '#6366f1', bg: 'rgba(99,102,241,0.08)', border: 'rgba(99,102,241,0.25)' },
  quiz: { label: 'สอบย่อย', desc: 'ทดสอบย่อยในชั้นเรียน', color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.3)' },
  midterm: { label: 'กลางภาค', desc: 'สอบกลางภาคเรียน', color: '#0ea5e9', bg: 'rgba(14,165,233,0.08)', border: 'rgba(14,165,233,0.25)' },
  final: { label: 'ปลายภาค', desc: 'สอบปลายภาคเรียน', color: '#059669', bg: 'rgba(5,150,105,0.08)', border: 'rgba(5,150,105,0.25)' },
};

function ScoreConfigPanel({ room, onSave }: {
  room: ExamRoom;
  onSave: (data: Partial<ExamRoom['settings']>) => Promise<void>;
}) {
  const [enabled, setEnabled] = useState<boolean>(
    room.settings?.scoreCollectionEnabled ?? false,
  );
  const [scoreType, setScoreType] = useState<ScoreCollectionTypeLocal>(
    (room.settings?.scoreCollectionType as ScoreCollectionTypeLocal) ?? 'classwork',
  );
  const [maxScore, setMaxScore] = useState<number>(
    room.settings?.scoreCollectionMaxScore ?? room.totalPoints ?? 100,
  );
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave({
        scoreCollectionEnabled: enabled,
        scoreCollectionType: scoreType,
        scoreCollectionMaxScore: maxScore,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setIsSaving(false);
    }
  };

  const cfg = SCORE_COLLECTION_CONFIG[scoreType];

  return (
    <div className="flex flex-col gap-5">
      {/* Toggle */}
      <div className="flex items-center justify-between px-4 py-4 rounded-2xl"
        style={{
          background: enabled ? 'rgba(99,102,241,0.06)' : 'rgba(248,250,252,0.8)',
          border: `1px solid ${enabled ? 'rgba(99,102,241,0.2)' : 'rgba(226,232,240,0.8)'}`,
        }}>
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
          style={{ background: enabled ? '#6366f1' : '#cbd5e1' }}
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
              <div className="grid grid-cols-2 gap-2">
                {(Object.entries(SCORE_COLLECTION_CONFIG) as [ScoreCollectionTypeLocal, typeof SCORE_COLLECTION_CONFIG[ScoreCollectionTypeLocal]][]).map(([type, c]) => {
                  const isActive = scoreType === type;
                  return (
                    <motion.button
                      key={type}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setScoreType(type)}
                      className="flex flex-col gap-1 px-4 py-3 rounded-2xl text-left transition-all"
                      style={{
                        background: isActive ? c.bg : 'rgba(248,250,252,0.8)',
                        border: isActive ? `1.5px solid ${c.border}` : '1px solid rgba(226,232,240,0.6)',
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[13px] font-black font-sukhumvit" style={{ color: isActive ? c.color : '#475569' }}>
                          {c.label}
                        </span>
                        {isActive && (
                          <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0"
                            style={{ background: c.color }}>
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

            {/* Max score */}
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 font-sukhumvit">
                คะแนนเต็ม
              </p>
              <div className="flex items-center gap-3 px-4 py-3 rounded-2xl"
                style={{ background: 'rgba(248,250,252,0.8)', border: '1px solid rgba(226,232,240,0.6)' }}>
                <div className="flex-1">
                  <p className="text-[11px] text-slate-500 font-sarabun mb-1">กำหนดตามจำนวนข้อสอบ</p>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={1000}
                      value={maxScore}
                      onChange={e => setMaxScore(Math.max(1, Number(e.target.value)))}
                      className="w-24 h-9 rounded-xl bg-white border border-slate-200 px-3 text-[14px] font-black text-slate-800 font-sukhumvit outline-none focus:border-indigo-300 transition-colors"
                    />
                    <span className="text-[12px] font-bold text-slate-500 font-sarabun">คะแนน</span>
                  </div>
                </div>
                {/* Quick-set buttons */}
                <div className="flex flex-col gap-1">
                  {[10, 20, 30, 50, 100].map(v => (
                    <button key={v} onClick={() => setMaxScore(v)}
                      className="px-3 py-1 rounded-lg text-[10px] font-black transition-all font-sukhumvit"
                      style={{
                        background: maxScore === v ? cfg.bg : 'rgba(241,245,249,0.8)',
                        color: maxScore === v ? cfg.color : '#64748b',
                        border: maxScore === v ? `1px solid ${cfg.border}` : '1px solid transparent',
                      }}>
                      {v}
                    </button>
                  ))}
                </div>
              </div>
              {room.questionCount > 0 && (
                <button
                  onClick={() => setMaxScore(room.questionCount)}
                  className="mt-1.5 text-[10px] font-bold text-indigo-400 hover:text-indigo-600 transition-colors font-sarabun"
                >
                  ใช้จำนวนข้อสอบ ({room.questionCount} ข้อ) เป็นคะแนนเต็ม
                </button>
              )}
            </div>

            {/* Summary chip */}
            <div className="flex items-center gap-2 px-4 py-3 rounded-2xl"
              style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}>
              <div className="w-2 h-2 rounded-full shrink-0" style={{ background: cfg.color }} />
              <p className="text-[12px] font-bold font-sarabun" style={{ color: cfg.color }}>
                เก็บเป็นคะแนน<span className="font-black">{cfg.label}</span> เต็ม <span className="font-black">{maxScore}</span> คะแนน
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Save */}
      <div className="flex justify-center mt-6">
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={() => { void handleSave(); }}
          disabled={isSaving}
          className="px-12 py-2.5 rounded-xl text-[13px] font-black text-white transition-all disabled:opacity-40 font-sukhumvit min-w-[200px]"
          style={{
            background: saved
              ? 'linear-gradient(135deg,#059669,#10b981)'
              : 'linear-gradient(135deg,#0f172a,#334155)',
            boxShadow: saved ? '0 8px 20px -6px rgba(5,150,105,0.25)' : '0 8px 20px -6px rgba(15,23,42,0.2)',
          }}
        >
          {saved ? '✓ บันทึกเรียบร้อย' : isSaving ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}
        </motion.button>
      </div>
    </div>
  );
}

// ── Room Detail View (inline 4-tab settings) ──────────────────────────────────
type SettingsTab = 'takers' | 'questions' | 'score-settings' | 'score-config' | 'score-summary';

const TAB_CONFIG: Record<SettingsTab, { label: string; icon: React.ElementType }> = {
  takers: { label: 'รายชื่อ', icon: Users },
  questions: { label: 'ข้อสอบ', icon: FileText },
  'score-settings': { label: 'รายวิชา', icon: BookOpen },
  'score-config': { label: 'เก็บคะแนน', icon: SlidersHorizontal },
  'score-summary': { label: 'สรุปคะแนน', icon: CheckCircle2 },
};

function RoomDetailView({
  room, attempts, onBack, onUpdateRoom, onChangeStatus, onEdit, onDelete, onProctor, headerPortalEl,
  canEdit, canDelete, onContentClick, onResetStudent, onResetAll,
}: {
  room: ExamRoom;
  attempts: ExamAttempt[];
  onBack: () => void;
  onUpdateRoom: (roomId: string, data: Partial<ExamRoom>) => Promise<void>;
  onChangeStatus: (status: ExamRoom['status']) => void;
  onEdit: () => void;
  onDelete: () => void;
  onProctor: () => void;
  headerPortalEl?: HTMLElement | null;
  canEdit?: boolean;
  canDelete?: boolean;
  onContentClick: (e: React.MouseEvent) => void;
  onResetStudent?: (studentId: string, studentName: string) => void;
  onResetAll?: () => void;
}) {
  const { user } = useAuth();
  const teachingMgr = useTeachingManager(user?.uid ?? '');
  const [activeTab, setActiveTab] = useState<SettingsTab>('takers');
  const [takersPage, setTakersPage] = useState(1);
  const [summaryPage, setSummaryPage] = useState(1);
  const [showSummaryAsPercent, setShowSummaryAsPercent] = useState(false);
  const [summaryView, setSummaryView] = useState<'table' | 'dashboard'>('table');
  const [viewportHeight, setViewportHeight] = useState<number>(
    typeof window !== 'undefined' ? window.innerHeight : 900,
  );

  useEffect(() => {
    const onResize = () => setViewportHeight(window.innerHeight);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Auto page size based on current display height.
  // Tuned for table rows (after switching "รายชื่อ" from cards to table).
  const takersPageSize = Math.max(6, Math.floor((viewportHeight - 360) / 56));
  const summaryPageSize = Math.max(6, Math.floor((viewportHeight - 360) / 56));

  const visibleTabs = (Object.entries(TAB_CONFIG) as [SettingsTab, typeof TAB_CONFIG[SettingsTab]][])
    .filter(([key]) => {
      if (key === 'questions' || key === 'score-settings' || key === 'score-config') return canEdit;
      return true;
    });

  // Compute student list for this room's class
  const classStudents = useMemo(() => {
    if (!room.classId) return [] as ReturnType<typeof teachingMgr.getStudentsForClass>;
    return teachingMgr.getStudentsForClass(room.classId);
  }, [room.classId, teachingMgr.getStudentsForClass]);

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

  const attemptsByStudentRound = useMemo(() => {
    const byStudent = new Map<string, Map<number, ExamAttempt>>();

    attempts.forEach((att) => {
      const studentId = String(att.studentId || '').trim();
      if (!studentId) return;
      const round = Number(att.round);
      if (!Number.isFinite(round) || round <= 0) return;

      const studentRounds = byStudent.get(studentId) ?? new Map<number, ExamAttempt>();
      const prev = studentRounds.get(round);
      if (!prev) {
        studentRounds.set(round, att);
        byStudent.set(studentId, studentRounds);
        return;
      }

      const prevStamp = Number(prev.submittedAt ?? prev.lastSavedAt ?? prev.startedAt ?? 0);
      const nextStamp = Number(att.submittedAt ?? att.lastSavedAt ?? att.startedAt ?? 0);
      if (nextStamp >= prevStamp) {
        studentRounds.set(round, att);
      }
      byStudent.set(studentId, studentRounds);
    });

    return byStudent;
  }, [attempts]);

  const summaryStudents = useMemo(() => {
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
        const fullName = firstName
          ? `${prefix}${firstName} ${lastName}`.trim()
          : (studentName || 'ไม่ทราบชื่อ');
        return {
          id: studentId || `${studentCode}-${fullName}`,
          fullName,
          studentCode,
        };
      });
    }

    const map = new Map<string, { id: string; fullName: string; studentCode: string }>();
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
  }, [classStudents, attempts]);

  const takersTotalItems = classStudents.length > 0 ? classStudents.length : attempts.length;
  const takersPageCount = Math.max(1, Math.ceil(takersTotalItems / takersPageSize));
  const safeTakersPage = Math.min(takersPage, takersPageCount);
  const takersStart = (safeTakersPage - 1) * takersPageSize;
  const pagedClassStudents = useMemo(
    () => classStudents.slice(takersStart, takersStart + takersPageSize),
    [classStudents, takersStart, takersPageSize],
  );
  const pagedAttempts = useMemo(
    () => attempts.slice(takersStart, takersStart + takersPageSize),
    [attempts, takersStart, takersPageSize],
  );

  const summaryPageCount = Math.max(1, Math.ceil(summaryStudents.length / summaryPageSize));
  const safeSummaryPage = Math.min(summaryPage, summaryPageCount);
  const summaryStart = (safeSummaryPage - 1) * summaryPageSize;
  const pagedSummaryStudents = useMemo(
    () => summaryStudents.slice(summaryStart, summaryStart + summaryPageSize),
    [summaryStudents, summaryStart, summaryPageSize],
  );
  const bestScoreByStudent = useMemo(() => {
    const map = new Map<string, number | null>();
    summaryStudents.forEach((student) => {
      const studentRounds = attemptsByStudentRound.get(student.id);
      const scored = roundNumbers
        .map((r) => studentRounds?.get(r)?.score)
        .filter((score): score is number => typeof score === 'number');
      map.set(student.id, scored.length > 0 ? Math.max(...scored) : null);
    });
    return map;
  }, [summaryStudents, attemptsByStudentRound, roundNumbers]);
  const highestBestScore = useMemo(() => {
    const values = Array.from(bestScoreByStudent.values()).filter((score): score is number => typeof score === 'number');
    return values.length > 0 ? Math.max(...values) : null;
  }, [bestScoreByStudent]);
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
  const lowestBestScore = useMemo(() => {
    const values = Array.from(bestScoreByStudent.values()).filter((score): score is number => typeof score === 'number');
    return values.length > 0 ? Math.min(...values) : null;
  }, [bestScoreByStudent]);

  const bestPercentByStudent = useMemo(() => {
    const map = new Map<string, number | null>();
    summaryStudents.forEach((student) => {
      const studentRounds = attemptsByStudentRound.get(student.id);
      const bestPercent = roundNumbers
        .map((round) => {
          const score = studentRounds?.get(round)?.score;
          const total = getRoundTotalPoints(round);
          if (typeof score !== 'number' || total <= 0) return null;
          return (score / total) * 100;
        })
        .filter((v): v is number => typeof v === 'number');
      map.set(student.id, bestPercent.length > 0 ? Math.max(...bestPercent) : null);
    });
    return map;
  }, [summaryStudents, attemptsByStudentRound, roundNumbers, getRoundTotalPoints]);

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
        .map((student) => attemptsByStudentRound.get(student.id)?.get(round)?.score)
        .filter((score): score is number => typeof score === 'number');
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
    totalPoints: number,
  ) => {
    const roundQuestions = {
      ...(room.roundQuestions ?? {}),
      [roundKey]: { questionSetId, questionIds, questionSetByQuestionId, totalPoints },
    };
    // Also mirror into top-level legacy fields for round "1" / "∞"
    const isFirstRound = roundKey === '1' || roundKey === '∞';
    await onUpdateRoom(room.id, {
      ...(isFirstRound ? { questionSetId, selectedQuestionIds: questionIds, questionCount: questionIds.length, totalPoints } : {}),
      roundQuestions,
    });
  };

  const handleSaveScoreSettings = async (
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
  };

  const handleSaveScoreConfig = async (data: Partial<ExamRoom['settings']>) => {
    await onUpdateRoom(room.id, {
      settings: { ...room.settings, ...data },
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 24 }}
      className="flex flex-col h-full gap-4"
    >


      {/* ── 4 Tabs + Content panel ── */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden" onClick={onContentClick}>
        {/* Tab bar - rendered into header portal if available */}
        {headerPortalEl ? createPortal(
          <div className="flex items-center gap-2 h-10 border border-black/[0.07] p-1 rounded-full bg-white/60 backdrop-blur-md">
            <button
              onClick={onBack}
              className="h-8 pl-2 pr-3 rounded-full text-black/45 hover:bg-black/5 flex items-center gap-1 transition-all"
              title="กลับหน้าหลัก"
            >
              <ArrowLeft size={12} strokeWidth={3} />
              <span className="text-[10px] font-black uppercase">กลับ</span>
            </button>

            {room.status === 'active' && (
              <div className="flex items-center px-2 border-l border-black/5">
                <CountdownTimer startTime={room.startTime} durationMinutes={room.durationMinutes} />
              </div>
            )}

            <div className="w-[1px] h-4 bg-black/[0.07] mx-1" />

            {visibleTabs.map(([key, cfg]) => {
              const Icon = cfg.icon;
              const isActive = activeTab === key;
              return (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`h-8 px-4 rounded-full text-[11px] font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-blue-600 text-white border border-blue-700'
                      : 'text-black/45 hover:bg-black/5'
                  }`}
                >
                  <Icon size={12} className={isActive ? 'text-white' : 'text-black/40'} />
                  <span>{cfg.label}</span>
                </button>
              );
            })}
          </div>,
          headerPortalEl
        ) : (
          <div className="flex justify-center border-b border-slate-100 px-2 pt-2 gap-1 shrink-0">
            {visibleTabs.map(([key, cfg]) => {
              const Icon = cfg.icon;
              const isActive = activeTab === key;
              return (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-t-xl text-[12px] font-black transition-all font-sukhumvit relative"
                  style={{
                    color: isActive ? '#0f172a' : '#94a3b8',
                    background: isActive ? 'rgba(248,250,252,1)' : 'transparent',
                  }}
                >
                  <Icon size={13} />
                  <span className="hidden sm:inline">{cfg.label}</span>
                  {isActive && (
                    <motion.div
                      layoutId="tab-underline"
                      className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-slate-800"
                    />
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto scrollbar-hide p-5">
          {canEdit && (
            <div className="flex flex-wrap items-center gap-2 mb-6 p-3 rounded-2xl bg-white border border-slate-200">
              <div className="flex items-center gap-2 mr-auto px-2">
                <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                <span className="text-[12px] font-bold text-slate-800">จัดการห้องสอบ</span>
              </div>
              
              <div className="flex items-center gap-1.5">
                <button onClick={onProctor}
                  className="h-9 px-4 rounded-xl text-[12px] font-bold text-slate-600 hover:bg-slate-50 border border-slate-200 flex items-center gap-2 transition-all">
                  <Eye size={14} /> Proctor
                </button>
                
                {room.status === 'upcoming' && (
                  <button onClick={() => onChangeStatus('active')}
                    className="h-9 px-4 rounded-xl text-[12px] font-bold flex items-center gap-2 transition-all bg-emerald-600 text-white border border-emerald-700 hover:bg-emerald-700">
                    <Play size={14} fill="currentColor" /> เปิดสอบ
                  </button>
                )}
                
                {room.status === 'active' && (
                  <button onClick={() => onChangeStatus('closed')}
                    className="h-9 px-4 rounded-xl text-[12px] font-bold flex items-center gap-2 transition-all bg-rose-600 text-white border border-rose-700 hover:bg-rose-700">
                    <Square size={14} fill="currentColor" /> ปิดสอบ
                  </button>
                )}

                <div className="w-[1px] h-4 bg-slate-200 mx-1" />

                {/* Reset All */}
                {onResetAll && attempts.length > 0 && (
                  <button
                    onClick={onResetAll}
                    className="h-9 px-3 rounded-xl text-[12px] font-bold flex items-center gap-2 transition-all text-amber-600 hover:bg-amber-50 border border-amber-200"
                    title="รีเซ็ตการสอบทั้งหมด"
                  >
                    <RotateCcw size={14} />
                    รีเซ็ตทั้งหมด
                  </button>
                )}

                <div className="w-[1px] h-4 bg-slate-200 mx-1" />

                <button onClick={onEdit}
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:bg-slate-50 border border-slate-200 transition-all">
                  <Pencil size={14} />
                </button>
                
                {canDelete && (
                  <button onClick={onDelete}
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-rose-400 hover:bg-rose-50 border border-rose-100 transition-all">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          )}

          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
            >
              {activeTab === 'takers' && (
                (() => {
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
                    ? pagedClassStudents.map(({ student }: { student: unknown }) => {
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
                        const attempt = attempts.find(a => a.studentId === studentId);
                        return {
                          key: studentId || `${studentCode}-${fullName}`,
                          fullName,
                          studentCode,
                          attempt,
                        };
                      })
                    : pagedAttempts.map((att) => ({
                        key: att.id,
                        fullName: att.studentName || 'ไม่ทราบชื่อ',
                        studentCode: '-',
                        attempt: att,
                      }));

                  return (
                    <div className="space-y-3">
                      <div className="rounded-2xl border border-slate-200 bg-white/80 overflow-hidden">
                        <div className="overflow-x-auto">
                          <table className="min-w-full text-left">
                            <thead>
                              <tr className="bg-slate-50/90 border-b border-slate-200">
                                <th className="px-4 py-3 text-[11px] font-black text-slate-500 uppercase tracking-wider font-sukhumvit">
                                  นักเรียน
                                </th>
                                <th className="px-4 py-3 text-[11px] font-black text-slate-500 uppercase tracking-wider font-sukhumvit whitespace-nowrap">
                                  รหัสนักเรียน
                                </th>
                                <th className="px-4 py-3 text-[11px] font-black text-slate-500 uppercase tracking-wider font-sukhumvit whitespace-nowrap text-center">
                                  สถานะ
                                </th>
                                <th className="px-4 py-3 text-[11px] font-black text-slate-500 uppercase tracking-wider font-sukhumvit whitespace-nowrap text-center">
                                  คะแนน
                                </th>
                                <th className="px-4 py-3 text-[11px] font-black text-slate-500 uppercase tracking-wider font-sukhumvit whitespace-nowrap text-center">
                                  ส่งล่าสุด
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {rows.map((row) => {
                                const att = row.attempt;
                                const hasScore = typeof att?.score === 'number';
                                const submittedAt = att?.submittedAt ? new Date(att.submittedAt).toLocaleString('th-TH') : '-';
                                const statusLabel = !att
                                  ? 'ยังไม่เข้าสอบ'
                                  : att.status === 'submitted' || att.status === 'graded'
                                    ? 'ส่งแล้ว'
                                    : 'กำลังทำ';
                                const statusClass = !att
                                  ? 'bg-slate-100 text-slate-500'
                                  : att.status === 'submitted' || att.status === 'graded'
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : 'bg-amber-50 text-amber-700';

                                return (
                                  <tr key={row.key} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/50">
                                    <td className="px-4 py-3">
                                      <p className="text-[13px] font-bold text-slate-800 font-sukhumvit">{row.fullName}</p>
                                    </td>
                                    <td className="px-4 py-3">
                                      <span className="text-[12px] text-slate-500 font-sarabun">{row.studentCode}</span>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                      <span className={`inline-flex items-center justify-center px-2 py-1 rounded-lg text-[11px] font-bold font-sarabun ${statusClass}`}>
                                        {statusLabel}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                      {hasScore ? (
                                        <span className="inline-flex items-center justify-center min-w-10 px-2 py-1 rounded-lg bg-blue-50 text-blue-700 text-[12px] font-black font-sukhumvit">
                                          {att?.score}
                                        </span>
                                      ) : (
                                        <span className="text-[12px] text-slate-300 font-bold">-</span>
                                      )}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                      <span className="text-[11px] text-slate-400 font-sarabun">{submittedAt}</span>
                                    </td>
                                    {canEdit && onResetStudent && att && (
                                      <td className="px-3 py-3 text-center">
                                        <button
                                          onClick={() => onResetStudent(
                                            att.studentId,
                                            row.fullName,
                                          )}
                                          className="w-7 h-7 rounded-lg flex items-center justify-center text-amber-500 hover:bg-amber-50 border border-amber-200 transition-all"
                                          title={`รีเซ็ตการสอบของ ${row.fullName}`}
                                        >
                                          <RotateCcw size={12} />
                                        </button>
                                      </td>
                                    )}
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {takersTotalItems > takersPageSize && (
                        <div className="flex items-center justify-between px-1 pt-2">
                          <p className="text-[11px] text-slate-400 font-sarabun">
                            หน้า {safeTakersPage}/{takersPageCount} • {takersTotalItems} คน
                          </p>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setTakersPage((p) => Math.max(1, p - 1))}
                              disabled={safeTakersPage <= 1}
                              className="h-8 px-3 rounded-lg text-[11px] font-bold border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              ก่อนหน้า
                            </button>
                            <button
                              onClick={() => setTakersPage((p) => Math.min(takersPageCount, p + 1))}
                              disabled={safeTakersPage >= takersPageCount}
                              className="h-8 px-3 rounded-lg text-[11px] font-bold border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              ถัดไป
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()
              )}
              {activeTab === 'questions' && (
                <QuestionsPanel room={room} onSave={handleSaveQuestions} onContentClick={onContentClick} />
              )}
              {activeTab === 'score-settings' && (
                <ScoreSettingsPanel room={room} onSave={handleSaveScoreSettings} />
              )}
              {activeTab === 'score-config' && (
                <ScoreConfigPanel room={room} onSave={handleSaveScoreConfig} />
              )}
              {activeTab === 'score-summary' && (
                summaryStudents.length === 0 ? (
                  <div className="py-16 text-center text-slate-400">
                    <CheckCircle2 size={32} className="mx-auto mb-3 text-slate-300" />
                    <p className="text-[14px] font-sarabun">ยังไม่มีข้อมูลสรุปคะแนน</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[12px] font-bold text-slate-500 font-sarabun">
                        {summaryView === 'table'
                          ? 'แสดงคะแนนสอบรายครั้งของนักเรียนทั้งหมด'
                          : 'แดชบอร์ดสรุปสถิติภาพรวมของห้องสอบ'}
                      </p>
                      <div className="flex items-center gap-4 bg-slate-100/50 px-3 py-1.5 rounded-2xl border border-slate-200/60 shadow-sm">
                        <label className="flex items-center gap-2.5 cursor-pointer select-none group">
                          <span className="text-[11px] font-bold text-slate-500 group-hover:text-slate-700 transition-colors font-sarabun">
                            แสดงเป็นเปอร์เซ็นต์
                          </span>
                          <Switch
                            checked={showSummaryAsPercent}
                            onCheckedChange={setShowSummaryAsPercent}
                            title="สลับการแสดงผลคะแนนดิบ/เปอร์เซ็นต์"
                          />
                        </label>
                        <div className="h-4 w-px bg-slate-300" />
                        <p className="text-[11px] font-black text-slate-400 font-sukhumvit uppercase tracking-widest">
                          {summaryStudents.length} คน • {roundNumbers.length} รอบ
                        </p>
                        <div className="h-4 w-px bg-slate-300" />
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

                    {summaryView === 'table' ? (
                      <>
                        <div className="rounded-2xl border border-slate-200 bg-white/80 overflow-hidden">
                          <div className="overflow-x-auto">
                            <table className="min-w-full text-left">
                              <thead>
                                <tr className="bg-slate-50/90 border-b border-slate-200">
                                  <th className="px-4 py-3 text-[11px] font-black text-slate-500 uppercase tracking-wider font-sukhumvit">
                                    นักเรียน
                                  </th>
                                  {roundNumbers.map((round) => (
                                    <th
                                      key={round}
                                      className="px-4 py-3 text-[11px] font-black text-slate-500 uppercase tracking-wider font-sukhumvit text-center whitespace-nowrap"
                                    >
                                      ครั้ง {round}
                                    </th>
                                  ))}
                                  <th className="px-4 py-3 text-[11px] font-black text-slate-500 uppercase tracking-wider font-sukhumvit text-center whitespace-nowrap">
                                    สูงสุด
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {pagedSummaryStudents.map((student) => {
                                  const studentRounds = attemptsByStudentRound.get(student.id);
                                  const bestScore = bestScoreByStudent.get(student.id) ?? null;
                                  const isTopScorer = highestBestScore !== null && bestScore === highestBestScore;
                                  const isLowestScorer = lowestBestScore !== null && bestScore === lowestBestScore;
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

                                  return (
                                    <tr key={student.id} className={`border-b border-slate-100 last:border-b-0 hover:bg-slate-50/50 ${rowHighlightClass}`}>
                                      <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                          <p className="text-[13px] font-bold text-slate-800 font-sukhumvit">{student.fullName}</p>
                                          {isTopScorer && (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black font-sukhumvit bg-emerald-100 text-emerald-700">
                                              สูงสุด
                                            </span>
                                          )}
                                          {!isTopScorer && isLowestScorer && (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black font-sukhumvit bg-rose-100 text-rose-700">
                                              ต่ำสุด
                                            </span>
                                          )}
                                        </div>
                                        <p className="text-[11px] text-slate-400 font-sarabun">รหัส {student.studentCode}</p>
                                      </td>

                                      {roundNumbers.map((round) => {
                                        const att = studentRounds?.get(round);
                                        const hasScore = typeof att?.score === 'number';
                                        const isPending = !!att && !hasScore;
                                        const roundTotal = getRoundTotalPoints(round);
                                        const percentText = hasScore && roundTotal > 0
                                          ? `${(((att.score as number) / roundTotal) * 100).toFixed(1)}%`
                                          : null;

                                        return (
                                          <td key={`${student.id}-${round}`} className="px-4 py-3 text-center">
                                            {hasScore ? (
                                              <span
                                                className="inline-flex items-center justify-center min-w-10 px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-[12px] font-black font-sukhumvit"
                                                title={`${att.score}/${roundTotal || '-'} คะแนน`}
                                              >
                                                {showSummaryAsPercent ? (percentText ?? '-') : att.score}
                                              </span>
                                            ) : isPending ? (
                                              <span className="inline-flex items-center justify-center px-2 py-1 rounded-lg bg-amber-50 text-amber-600 text-[11px] font-bold font-sarabun">
                                                รอตรวจ
                                              </span>
                                            ) : (
                                              <span className="text-[12px] text-slate-300 font-bold">-</span>
                                            )}
                                          </td>
                                        );
                                      })}

                                      <td className="px-4 py-3 text-center">
                                        {bestScore !== null ? (
                                        <span className={`inline-flex items-center justify-center min-w-10 px-2 py-1 rounded-lg text-[12px] font-black font-sukhumvit ${bestScoreClass}`}>
                                            {showSummaryAsPercent
                                              ? (() => {
                                                  const bestPercent = bestPercentByStudent.get(student.id);
                                                  return typeof bestPercent === 'number' ? `${bestPercent.toFixed(1)}%` : '-';
                                                })()
                                              : bestScore}
                                          </span>
                                        ) : (
                                          <span className="text-[12px] text-slate-300 font-bold">-</span>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                        {summaryStudents.length > summaryPageSize && (
                          <div className="flex items-center justify-between px-1 pt-2">
                            <p className="text-[11px] text-slate-400 font-sarabun">
                              หน้า {safeSummaryPage}/{summaryPageCount} • {summaryStudents.length} คน
                            </p>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setSummaryPage((p) => Math.max(1, p - 1))}
                                disabled={safeSummaryPage <= 1}
                                className="h-8 px-3 rounded-lg text-[11px] font-bold border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                ก่อนหน้า
                              </button>
                              <button
                                onClick={() => setSummaryPage((p) => Math.min(summaryPageCount, p + 1))}
                                disabled={safeSummaryPage >= summaryPageCount}
                                className="h-8 px-3 rounded-lg text-[11px] font-bold border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                ถัดไป
                              </button>
                            </div>
                          </div>
                        )}
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
    </motion.div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function ExamManager() {
  const navigate = useNavigate();
  const { role, user } = useAuth();
  const isStudent = role === 'student';
  const { canEdit: canEditExam, canDelete: canDeleteExam } = useMyPermissions();
  const canEdit = canEditExam('exams');
  const canDelete = canDeleteExam('exams');
  const { rooms, isLoading, createRoom, updateRoom, updateRoomStatus, deleteRoom, getAttemptsForRoom, resetStudentAttempt, resetAllAttempts } = useExamRoom();
  const [showCreate, setShowCreate] = useState(false);
  const [editingRoom, setEditingRoom] = useState<ExamRoom | null>(null);
  const [proctoringRoom, setProctoringRoom] = useState<ExamRoom | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | ExamRoom['status']>('all');
  const [roomSearchText] = useState('');
  const [detailRoom, setDetailRoom] = useState<ExamRoom | null>(null);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [roomToDelete, setRoomToDelete] = useState<ExamRoom | null>(null);
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

  const handleContentClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'IMG' && (target as HTMLImageElement).src) {
      setZoomedImage((target as HTMLImageElement).src);
    }
  };


  const headerRightPortalEl =
    typeof document !== 'undefined'
      ? document.getElementById('header-portal-right-actions')
      : null;
  const headerCenterPortalEl =
    typeof document !== 'undefined'
      ? document.getElementById('header-portal-center')
      : null;

  const filtered = useMemo(() => {
    return rooms.filter(r => {
      const matchStatus = filterStatus === 'all' || r.status === filterStatus;
      const matchSearch = r.title.toLowerCase().includes(roomSearchText.toLowerCase()) || 
                          (r.className?.toLowerCase() || '').includes(roomSearchText.toLowerCase());
      return matchStatus && matchSearch;
    });
  }, [rooms, filterStatus, roomSearchText]);

  const statsMap = {
    all: rooms.length,
    upcoming: rooms.filter(r => r.status === 'upcoming').length,
    active: rooms.filter(r => r.status === 'active').length,
    closed: rooms.filter(r => r.status === 'closed').length,
  };
  const statusFilterOptions = [
    { key: 'all', label: 'ทั้งหมด', color: '#6366f1', activeBg: 'rgba(99,102,241,0.12)', activeBorder: 'rgba(99,102,241,0.3)' },
    { key: 'upcoming', label: 'รอเปิด', color: '#f59e0b', activeBg: 'rgba(245,158,11,0.12)', activeBorder: 'rgba(245,158,11,0.3)' },
    { key: 'active', label: 'กำลังสอบ', color: '#059669', activeBg: 'rgba(5,150,105,0.12)', activeBorder: 'rgba(5,150,105,0.3)' },
    { key: 'closed', label: 'ปิดแล้ว', color: '#94a3b8', activeBg: 'rgba(148,163,184,0.15)', activeBorder: 'rgba(148,163,184,0.35)' },
  ] as const;

  const statusFilterPills = (
    <div className="flex gap-1.5 items-center px-1 overflow-x-auto scrollbar-hide flex-nowrap">
      {statusFilterOptions.map((s) => {
        const isActive = filterStatus === s.key;
        return (
          <button
            key={s.key}
            onClick={() => { setFilterStatus(s.key as typeof filterStatus); setDetailRoom(null); }}
            className="px-4 sm:px-6 h-9 sm:h-10 rounded-full text-[12px] sm:text-[13px] font-black transition-all font-sukhumvit border flex items-center gap-2 flex-shrink-0"
            style={{
              background: isActive ? s.activeBg : 'white',
              color: isActive ? s.color : '#64748b',
              borderColor: isActive ? s.activeBorder : 'rgba(226,232,240,0.8)',
            }}
          >
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: s.color }} />
            {s.label}
            <span className="ml-1 opacity-40 text-[10px]">
              {statsMap[s.key as keyof typeof statsMap]}
            </span>
          </button>
        );
      })}
    </div>
  );

  const handleChangeStatus = async (roomId: string, status: ExamRoom['status']) => {
    try {
      await updateRoomStatus(roomId, status);
    } catch (err) {
      console.error('Failed to update room status:', err);
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
    <div className="relative w-full bg-transparent overflow-hidden h-full">
      {headerRightPortalEl && !liveDetailRoom && canEdit && !isStudent &&
        createPortal(
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center justify-center w-9 h-9 rounded-full text-white transition-all border border-slate-800"
            style={{ background: '#0f172a' }}
            title="สร้างห้องสอบ"
          >
            <Plus size={18} />
          </button>,
          headerRightPortalEl
        )}
      {headerCenterPortalEl && !liveDetailRoom && createPortal(
        <div className="hidden lg:flex items-center justify-center py-1">
          {statusFilterPills}
        </div>,
        headerCenterPortalEl
      )}
      <div className="max-w-[1400px] mx-auto flex flex-col h-full gap-4 pb-10 pt-4 px-6">

        {!liveDetailRoom && (
          <div className="lg:hidden flex items-center justify-center w-full overflow-hidden">
            {statusFilterPills}
          </div>
        )}

        {/* ── Main area: grid OR detail ── */}
        <div className="flex-1 min-h-0">
          <AnimatePresence mode="wait">
            {liveDetailRoom ? (
              <RoomDetailView
                key={liveDetailRoom.id}
                room={liveDetailRoom}
                attempts={getAttemptsForRoom(liveDetailRoom.id)}
                onBack={() => setDetailRoom(null)}
                onUpdateRoom={updateRoom}
                onChangeStatus={status => handleChangeStatus(liveDetailRoom.id, status)}
                onEdit={() => { setEditingRoom(liveDetailRoom); setShowCreate(true); }}
                onDelete={() => handleDelete(liveDetailRoom)}
                onProctor={() => setProctoringRoom(liveDetailRoom)}
                headerPortalEl={headerCenterPortalEl ?? headerRightPortalEl}
                canEdit={canEdit}
                canDelete={canDelete}
                onContentClick={handleContentClick}
                onResetStudent={canEdit ? handleResetStudent : undefined}
                onResetAll={canEdit ? handleResetAll : undefined}
              />
            ) : (
              <motion.div
                key="grid"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-full overflow-y-auto scrollbar-hide"
              >
                {isLoading ? (
                  <div className="flex-1 flex flex-col items-center justify-center py-40 gap-6">
                    <IndeterminateProgress />
                    <p className="text-slate-400 font-sarabun text-[14px]">กำลังโหลดข้อมูลห้องสอบ...</p>
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-3">
                    <div className="w-16 h-16 rounded-full bg-white/50 flex items-center justify-center">
                      <ClipboardList size={28} className="text-slate-300" />
                    </div>
                    <p className="text-slate-400 font-sarabun text-[14px]">ยังไม่มีห้องสอบ</p>
                    {canEdit && !isStudent && (
                      <motion.button whileTap={{ scale: 0.98 }}
                        onClick={() => setShowCreate(true)}
                        className="px-5 py-2 rounded-xl text-[12px] font-bold text-white"
                        style={{ background: '#0f172a' }}>
                        <Plus size={13} className="inline mr-1" />สร้างห้องสอบ
                      </motion.button>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-4">
                    {filtered.map((room, i) => (
                      <motion.div key={room.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.04 }}>
                        <RoomCard
                          room={room}
                          isStudent={isStudent}
                          myAttempt={isStudent && user?.uid ? getAttemptsForRoom(room.id).filter(a => String(a.studentId).trim() === user.uid).sort((a, b) => (b.round ?? 0) - (a.round ?? 0))[0] ?? null : null}
                          onTakeExam={() => navigate(`/exam/${room.id}`)}
                          onShowSummary={(r, a) => setSummaryData({ room: r, attempt: a })}
                          onProctor={() => setProctoringRoom(room)}
                          onChangeStatus={status => handleChangeStatus(room.id, status)}
                          onDelete={() => handleDelete(room)}
                          onEdit={() => { setEditingRoom(room); setShowCreate(true); }}
                          onOpenSettings={() => setDetailRoom(room)}
                          canEdit={canEdit}
                          canDelete={canDelete}
                        />
                      </motion.div>
                    ))}
                  </div>
                )}
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
          key={editingRoom?.id ?? 'new'}
          editRoom={editingRoom}
          onClose={() => { setShowCreate(false); setEditingRoom(null); }}
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
          />
        )}
      </AnimatePresence>

      <DeleteConfirmDialog
        open={!!roomToDelete}
        onClose={() => setRoomToDelete(null)}
        onConfirm={handleConfirmDelete}
        roomTitle={roomToDelete?.title || ''}
      />

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
