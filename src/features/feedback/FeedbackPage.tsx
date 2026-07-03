import { useEffect, useMemo, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { motion } from 'framer-motion';
import {
  Send,
  Shield,
  UserRound,
  Wrench,
  CheckCircle2,
  Clock3,
} from 'lucide-react';
import { toast } from 'sonner';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import {
  useFeedbackActions,
  useVisibleFeedbackTimeline,
} from '@/hooks/useStudentFeedback';
import type {
  CreateFeedbackInput,
  FeedbackCategory,
  FeedbackMode,
  FeedbackStatus,
  StudentFeedback,
} from '@/types/feedback';

const CATEGORY_LABEL: Record<FeedbackCategory, string> = {
  academic: 'วิชาการ/การเรียนการสอน',
  facilities: 'อาคารสถานที่/ความสะอาด',
  cafeteria: 'โรงอาหาร/โภชนาการ',
  general: 'กิจกรรม/อื่นๆ',
};

const STATUS_LABEL: Record<FeedbackStatus, string> = {
  new: 'รอรับเรื่อง',
  in_progress: 'กำลังแก้ไข',
  resolved: 'แก้ไขเสร็จสิ้น',
};

const STATUS_BADGE: Record<FeedbackStatus, string> = {
  new: 'bg-slate-100 text-slate-600 border-slate-200',
  in_progress: 'bg-amber-50 text-amber-700 border-amber-200',
  resolved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

const DEPARTMENTS = [
  'ปฐมวัย',
  'ประถมศึกษา',
  'มัธยมศึกษา',
];

const GRADE_LEVELS: Record<string, string[]> = {
  'ปฐมวัย': ['อ.1', 'อ.2', 'อ.3'],
  'ประถมศึกษา': ['ป.1', 'ป.2', 'ป.3', 'ป.4', 'ป.5', 'ป.6'],
  'มัธยมศึกษา': ['ม.1', 'ม.2', 'ม.3', 'ม.4', 'ม.5', 'ม.6'],
};

function formatDateTime(ts: unknown): string {
  const sec = (ts as { seconds?: number } | undefined)?.seconds;
  if (!sec) return 'ไม่ระบุเวลา';
  return new Date(sec * 1000).toLocaleString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getUserDisplayName(userData: Record<string, unknown> | null, fallbackEmail?: string | null) {
  const firstName = typeof userData?.firstName === 'string' ? userData.firstName : '';
  const lastName = typeof userData?.lastName === 'string' ? userData.lastName : '';
  const prefix = typeof userData?.prefix === 'string' ? userData.prefix : '';
  const display = `${prefix}${firstName} ${lastName}`.trim();
  if (display) return display;
  if (typeof userData?.displayName === 'string') return userData.displayName;
  if (typeof userData?.email === 'string') return userData.email;
  return fallbackEmail ?? 'นักเรียน';
}

function statusIcon(status: FeedbackStatus) {
  if (status === 'resolved') return <CheckCircle2 size={12} />;
  if (status === 'in_progress') return <Wrench size={12} />;
  return <Clock3 size={12} />;
}

function FeedbackCard({
  item,
  canManage,
  currentStatus,
  currentNote,
  onStatusChange,
  onNoteChange,
  onSave,
}: {
  item: StudentFeedback;
  canManage: boolean;
  currentStatus: FeedbackStatus;
  currentNote: string;
  onStatusChange: (status: FeedbackStatus) => void;
  onNoteChange: (note: string) => void;
  onSave: () => void;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-[1.75rem] border border-slate-200 bg-white/85 p-5 flex flex-col gap-3"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2 py-1 rounded-full text-[10px] font-black bg-blue-50 text-blue-700 border border-blue-200">
              {CATEGORY_LABEL[item.category]}
            </span>
            <span className={`px-2 py-1 rounded-full text-[10px] font-black border inline-flex items-center gap-1 ${STATUS_BADGE[item.status]}`}>
              {statusIcon(item.status)}
              {STATUS_LABEL[item.status]}
            </span>
            {item.mode === 'anonymous' ? (
              <span className="px-2 py-1 rounded-full text-[10px] font-black bg-violet-50 text-violet-700 border border-violet-200 inline-flex items-center gap-1">
                <Shield size={10} />
                Anonymous
              </span>
            ) : (
              <span className="px-2 py-1 rounded-full text-[10px] font-black bg-slate-50 text-slate-600 border border-slate-200 inline-flex items-center gap-1">
                <UserRound size={10} />
                เปิดเผยตัวตน {item.studentName ? `(${item.studentName})` : ''}
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-500 font-bold">
            {item.department !== 'ไม่ระบุ' && `${item.department} • `}ชั้น: {item.gradeLevel} • {formatDateTime(item.createdAt)}
          </p>
        </div>
      </div>

      <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap break-words">{item.message}</p>

      {item.adminNote && (
        <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 px-3 py-2">
          <p className="text-[10px] font-black text-emerald-700 uppercase tracking-wide">หมายเหตุจากผู้ดูแล</p>
          <p className="text-sm text-emerald-800 mt-1">{item.adminNote}</p>
        </div>
      )}

      {canManage && (
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 space-y-2">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <select
              value={currentStatus}
              onChange={(e) => onStatusChange(e.target.value as FeedbackStatus)}
              className="h-10 px-3 rounded-lg border border-slate-200 text-sm font-bold text-slate-700 bg-white"
            >
              <option value="new">รอรับเรื่อง</option>
              <option value="in_progress">กำลังแก้ไข</option>
              <option value="resolved">แก้ไขเสร็จสิ้น</option>
            </select>
            <input
              value={currentNote}
              onChange={(e) => onNoteChange(e.target.value)}
              placeholder="โน้ตสำหรับแสดงให้นักเรียนเห็น (ไม่บังคับ)"
              className="md:col-span-2 h-10 px-3 rounded-lg border border-slate-200 text-sm font-bold text-slate-700 bg-white"
            />
          </div>
          <div className="flex justify-end">
            <button
              onClick={onSave}
              className="h-9 px-4 rounded-full bg-slate-900 text-white text-xs font-black"
            >
              บันทึกสถานะ
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
}

export default function FeedbackPage() {
  const { user, role, userData, isLoading: authLoading } = useAuth();
  const { canAccess, canEdit } = useMyPermissions();
  const isStudent = role === 'student';
  const isExecutive = role === 'admin';
  const canManage = canEdit('feedback_manage');
  const canViewIdentity = canAccess('feedback_view_identity') || canManage;
  const canAccessFeedback = canAccess('feedback');

  const [mode, setMode] = useState<FeedbackMode>('identified');
  const [category, setCategory] = useState<FeedbackCategory>('academic');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [department, setDepartment] = useState(DEPARTMENTS[0]);
  const [gradeLevel, setGradeLevel] = useState(GRADE_LEVELS[DEPARTMENTS[0]][0]);
  const [statusFilter, setStatusFilter] = useState<'all' | FeedbackStatus>('all');

  const [statusDraft, setStatusDraft] = useState<Record<string, FeedbackStatus>>({});
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({});

  const { createFeedback, updateFeedbackStatus } = useFeedbackActions();
  const { items: timeline, loading: timelineLoading } = useVisibleFeedbackTimeline(role ?? undefined, canManage);

  useEffect(() => {
    async function detectGrade() {
      if (!user?.uid) return;
      const fromUser =
        typeof userData?.gradeLevel === 'string'
          ? userData.gradeLevel
          : typeof userData?.currentGrade === 'string'
            ? userData.currentGrade
            : '';
      if (fromUser) {
        setGradeLevel(fromUser);
        return;
      }

      try {
        const studentSnap = await getDoc(doc(db, 'students', user.uid));
        if (!studentSnap.exists()) return;
        const data = studentSnap.data() as Record<string, unknown>;
        const grade =
          typeof data.gradeLevel === 'string'
            ? data.gradeLevel
            : typeof data.currentGrade === 'string'
              ? data.currentGrade
              : '';
        if (grade) setGradeLevel(grade);
      } catch {
        // ignore
      }
    }
    void detectGrade();
  }, [user?.uid, userData]);

  const filteredTimeline = useMemo(() => {
    if (statusFilter === 'all') return timeline;
    return timeline.filter((i) => i.status === statusFilter);
  }, [timeline, statusFilter]);

  const handleSubmit = async () => {
    if (!user?.uid) return;
    if (!canAccessFeedback) {
      toast.error('คุณไม่มีสิทธิ์ส่งความคิดเห็น');
      return;
    }
    if (!message.trim()) {
      toast.error('กรุณาระบุข้อความความคิดเห็น');
      return;
    }
    setSubmitting(true);
    try {
      const input: CreateFeedbackInput = {
        mode,
        category,
        message: message.trim(),
        department,
        gradeLevel,
        studentName: getUserDisplayName((userData as Record<string, unknown> | null) ?? null, user.email),
      };
      await createFeedback(user.uid, input);
      setMessage('');
      toast.success('ส่งความคิดเห็นเรียบร้อยแล้ว');
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'ไม่สามารถส่งความคิดเห็นได้';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveStatus = async (item: StudentFeedback) => {
    if (!canManage) {
      toast.error('คุณไม่มีสิทธิ์จัดการสถานะ');
      return;
    }
    const nextStatus = statusDraft[item.id] ?? item.status;
    const nextNote = noteDraft[item.id] ?? item.adminNote ?? '';
    try {
      await updateFeedbackStatus(item.id, nextStatus, nextNote);
      toast.success('อัปเดตสถานะเรียบร้อย');
    } catch {
      toast.error('อัปเดตสถานะไม่สำเร็จ');
    }
  };

  const renderTimeline = (options: { showFilter: boolean; manage: boolean }) => (
    <>
      {options.showFilter && (
        <div className="rounded-[1.5rem] border border-slate-200 bg-white p-3">
          <div className="flex w-full items-stretch gap-1.5 sm:gap-2">
            {(['all', 'new', 'in_progress', 'resolved'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`flex-1 min-w-0 h-8 px-1 sm:px-2 rounded-full text-[9px] sm:text-[10px] font-black transition-all text-center leading-tight ${statusFilter === s ? 'bg-slate-900 text-white shadow-sm' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
              >
                {s === 'all' ? 'ทั้งหมด' : STATUS_LABEL[s]}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="min-h-0 overflow-y-auto pr-1 space-y-3">
        {timelineLoading && (
          <div className="h-36 flex items-center justify-center">
            <div className="w-7 h-7 border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
          </div>
        )}
        {!timelineLoading && filteredTimeline.length === 0 && (
          <div className="rounded-[1.75rem] border border-slate-200 bg-white p-8 text-center text-slate-400 font-bold">
            {isStudent ? 'ยังไม่มีรายการที่โรงเรียนอัปเดตสถานะ' : 'ยังไม่มีรายการในเงื่อนไขนี้'}
          </div>
        )}

        {!timelineLoading && filteredTimeline.map((item) => (
          <FeedbackCard
            key={item.id}
            item={{
              ...item,
              studentName: canViewIdentity ? item.studentName : null,
            }}
            canManage={options.manage}
            currentStatus={statusDraft[item.id] ?? item.status}
            currentNote={noteDraft[item.id] ?? item.adminNote ?? ''}
            onStatusChange={(v) => setStatusDraft((prev) => ({ ...prev, [item.id]: v }))}
            onNoteChange={(v) => setNoteDraft((prev) => ({ ...prev, [item.id]: v }))}
            onSave={() => { void handleSaveStatus(item); }}
          />
        ))}
      </div>
    </>
  );

  const renderSubmitForm = () => (
    <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 space-y-4">
      <h2 className="text-sm font-black text-slate-800">ส่งความคิดเห็น</h2>

      <div className="grid grid-cols-2 gap-1">
        <button
          onClick={() => setMode('identified')}
          className={`h-9 rounded-full text-xs font-black transition-all ${mode === 'identified' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-black/5'}`}
        >
          เปิดเผยตัวตน
        </button>
        <button
          onClick={() => setMode('anonymous')}
          className={`h-9 rounded-full text-xs font-black transition-all ${mode === 'anonymous' ? 'bg-violet-600 text-white shadow-md' : 'text-slate-500 hover:bg-black/5'}`}
        >
          Anonymous
        </button>
      </div>

      {mode === 'anonymous' && (
        <div className="rounded-xl border border-violet-100 bg-violet-50/70 px-3 py-2 text-[11px] font-bold text-violet-700">
          โหมดไม่ระบุตัวตนจะไม่บันทึก studentId และจำกัดการส่งวันละ 1 ครั้ง
        </div>
      )}

      <div className="space-y-1">
        <label className="text-[11px] font-black text-slate-500">หมวดหมู่</label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as FeedbackCategory)}
          className="w-full h-10 px-3 rounded-2xl border border-slate-200 text-sm font-bold text-slate-700 bg-white focus:ring-2 focus:ring-slate-900/5 transition-all outline-none"
        >
          <option value="academic">วิชาการ/การเรียนการสอน</option>
          <option value="facilities">อาคารสถานที่/ความสะอาด</option>
          <option value="cafeteria">โรงอาหาร/โภชนาการ</option>
          <option value="general">กิจกรรม/อื่นๆ</option>
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-[11px] font-black text-slate-500">แผนก</label>
          <select
            value={department}
            onChange={(e) => {
              const newDept = e.target.value;
              setDepartment(newDept);
              setGradeLevel(GRADE_LEVELS[newDept][0]);
            }}
            className="w-full h-10 px-3 rounded-2xl border border-slate-200 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-slate-900/5 transition-all outline-none bg-white"
          >
            {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-[11px] font-black text-slate-500">ระดับชั้นที่ส่ง</label>
          <select
            value={gradeLevel}
            onChange={(e) => setGradeLevel(e.target.value)}
            className="w-full h-10 px-3 rounded-2xl border border-slate-200 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-slate-900/5 transition-all outline-none bg-white"
          >
            {(GRADE_LEVELS[department] || []).map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-[11px] font-black text-slate-500">รายละเอียด</label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={5}
          className="w-full px-3 py-2 rounded-2xl border border-slate-200 text-sm text-slate-700 resize-none focus:ring-2 focus:ring-slate-900/5 transition-all outline-none bg-white"
          placeholder="บอกสิ่งที่ต้องการให้โรงเรียนปรับปรุง..."
        />
      </div>

      <button
        onClick={handleSubmit}
        disabled={!canAccessFeedback || submitting || !message.trim()}
        className="w-full h-11 rounded-full bg-slate-900 text-white text-sm font-black disabled:opacity-50 inline-flex items-center justify-center gap-2 shadow-lg shadow-slate-900/10 active:scale-[0.98] transition-all"
      >
        <Send size={14} />
        {submitting ? 'กำลังส่ง...' : 'ส่งความคิดเห็น'}
      </button>
      {!canAccessFeedback && (
        <p className="text-[11px] text-rose-500 font-bold">สิทธิ์การส่งความคิดเห็นถูกปิดไว้</p>
      )}
    </div>
  );

  return (
    <div className="h-full min-h-0 flex flex-col gap-4 overflow-y-auto">
      {authLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-7 h-7 border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
        </div>
      ) : isStudent ? (
        <div className="flex flex-col gap-4 max-w-2xl mx-auto w-full pb-4">
          {renderSubmitForm()}
          <div className="space-y-3">
            <h2 className="text-sm font-black text-slate-800 px-1">ติดตามสถานะ</h2>
            {renderTimeline({ showFilter: false, manage: false })}
          </div>
        </div>
      ) : (
        <div className="min-h-0 flex-1 grid grid-cols-1 xl:grid-cols-3 gap-4 pb-4">
          <div className={isExecutive ? 'hidden xl:block xl:col-span-1' : 'xl:col-span-1'}>
            {renderSubmitForm()}
          </div>
          <div className="xl:col-span-2 min-h-0 flex flex-col gap-3">
            {renderTimeline({ showFilter: true, manage: canManage })}
          </div>
        </div>
      )}
    </div>
  );
}
