import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  HiOutlineClipboardDocumentList,
  HiOutlinePlus,
  HiOutlineCheckCircle,
  HiOutlineClock,
  HiOutlineExclamationCircle,
  HiOutlineUser,
  HiOutlineChevronLeft,
  HiOutlineXMark,
  HiMiniCheckCircle,
  HiOutlineArrowPath,
  HiOutlineFlag,
} from 'react-icons/hi2';
import { useAuth } from '@/hooks/useAuth';
import { usePortalRecipientUsers } from '@/hooks/useStaffUsers';
import { useCreatedTasks, useCreateTask, useUpdateTaskStatus } from '@/hooks/useTasks';
import { cn } from '@/lib/utils';
import { glassStyles, typography, colors } from '@/lib/designTokens';
import type { Task, TaskPriority, CreateTaskInput } from '@/types/task';

const TODAY = new Date().toISOString().slice(0, 10);

function isOverdue(task: Task) {
  return task.status !== 'done' && task.dueDate < TODAY;
}

function formatDueDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
}

function daysLeft(dateStr: string): number {
  const due = new Date(dateStr + 'T00:00:00');
  const now = new Date(TODAY + 'T00:00:00');
  return Math.ceil((due.getTime() - now.getTime()) / 86_400_000);
}

const PRIORITY_CONFIG: Record<TaskPriority, {
  label: string;
  chip: string;
  stripe: string;
  dot: string;
  emoji: string;
}> = {
  normal: {
    label: 'ปกติ',
    chip: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    stripe: 'bg-emerald-400',
    dot: 'bg-emerald-400',
    emoji: '🟢',
  },
  urgent: {
    label: 'ด่วน',
    chip: 'bg-amber-50 text-amber-700 border border-amber-200',
    stripe: 'bg-amber-400',
    dot: 'bg-amber-400',
    emoji: '🟡',
  },
  critical: {
    label: 'ด่วนมาก',
    chip: 'bg-rose-50 text-rose-700 border border-rose-200',
    stripe: 'bg-rose-500',
    dot: 'bg-rose-500',
    emoji: '🔴',
  },
};

const STATUS_LABEL: Record<string, string> = {
  pending: 'รอดำเนินการ',
  'in-progress': 'กำลังทำ',
  done: 'เสร็จแล้ว',
};

function getInitials(name: string): string {
  return name.slice(0, 2) || '??';
}

const AVATAR_COLORS = [
  'from-sky-500 to-blue-600',
  'from-rose-500 to-pink-600',
  'from-violet-500 to-indigo-600',
  'from-emerald-500 to-teal-600',
  'from-amber-500 to-orange-600',
  'from-cyan-500 to-blue-500',
];

function avatarGradient(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = (hash * 31 + userId.charCodeAt(i)) & 0xffffffff;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// ── Create Task Modal ──────────────────────────────────────────────────────────

interface CreateTaskModalProps {
  open: boolean;
  onClose: () => void;
  defaultAssigneeId?: string;
  defaultAssigneeName?: string;
  onSubmit: (input: CreateTaskInput) => Promise<void>;
}

function CreateTaskModal({ open, onClose, defaultAssigneeId, defaultAssigneeName, onSubmit }: CreateTaskModalProps) {
  const { users } = usePortalRecipientUsers();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('normal');
  const [assigneeId, setAssigneeId] = useState(defaultAssigneeId ?? '');
  const [dueDate, setDueDate] = useState(TODAY);
  const [saving, setSaving] = useState(false);

  const selectedUser = useMemo(
    () => users.find((u) => u.userId === assigneeId),
    [users, assigneeId],
  );

  async function handleSubmit() {
    if (!title.trim() || !assigneeId) return;
    setSaving(true);
    try {
      await onSubmit({
        title,
        description,
        priority,
        assigneeId,
        assigneeName: selectedUser?.displayName ?? defaultAssigneeName ?? assigneeId,
        dueDate,
      });
      setTitle('');
      setDescription('');
      setPriority('normal');
      setAssigneeId(defaultAssigneeId ?? '');
      setDueDate(TODAY);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
        <motion.div
          className="relative w-full max-w-md rounded-3xl p-6 shadow-2xl"
          style={{
            background: 'rgba(255,255,255,0.95)',
            backdropFilter: 'blur(24px)',
            border: '1px solid rgba(0,0,0,0.08)',
          }}
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 40, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                <HiOutlinePlus className="text-white" size={16} />
              </div>
              <span className="font-bold text-black/80">มอบหมายงานใหม่</span>
            </div>
            <button onClick={onClose} className="w-7 h-7 rounded-full bg-black/5 flex items-center justify-center hover:bg-black/10 transition-colors">
              <HiOutlineXMark size={14} className="text-black/60" />
            </button>
          </div>

          <div className="space-y-4">
            {/* Assignee */}
            <div>
              <label className={typography.label}>มอบหมายให้</label>
              <select
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                className="w-full h-9 rounded-xl border border-black/10 bg-white px-3 text-sm text-black/80 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              >
                <option value="">เลือกบุคลากร...</option>
                {users.map((u) => (
                  <option key={u.userId} value={u.userId}>{u.displayName}</option>
                ))}
              </select>
            </div>

            {/* Title */}
            <div>
              <label className={typography.label}>ชื่องาน</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="ระบุชื่องาน..."
                className="w-full h-9 rounded-xl border border-black/10 bg-white px-3 text-sm text-black/80 placeholder:text-black/30 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
            </div>

            {/* Description */}
            <div>
              <label className={typography.label}>รายละเอียด (ไม่บังคับ)</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="รายละเอียดเพิ่มเติม..."
                rows={2}
                className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-black/80 placeholder:text-black/30 focus:outline-none focus:ring-2 focus:ring-blue-500/30 resize-none"
              />
            </div>

            {/* Priority */}
            <div>
              <label className={typography.label}>ระดับความสำคัญ</label>
              <div className="flex gap-2">
                {(['normal', 'urgent', 'critical'] as TaskPriority[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPriority(p)}
                    className={cn(
                      'flex-1 h-9 rounded-xl text-xs font-semibold border transition-all',
                      priority === p
                        ? PRIORITY_CONFIG[p].chip + ' scale-[1.02] shadow-sm'
                        : 'bg-black/5 text-black/40 border-transparent hover:bg-black/8',
                    )}
                  >
                    {PRIORITY_CONFIG[p].emoji} {PRIORITY_CONFIG[p].label}
                  </button>
                ))}
              </div>
            </div>

            {/* Due Date */}
            <div>
              <label className={typography.label}>กำหนดส่ง</label>
              <input
                type="date"
                value={dueDate}
                min={TODAY}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full h-9 rounded-xl border border-black/10 bg-white px-3 text-sm text-black/80 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex gap-2 mt-6">
            <button
              onClick={onClose}
              className="flex-1 h-10 rounded-xl bg-black/5 text-black/60 text-sm font-medium hover:bg-black/8 transition-colors"
            >
              ยกเลิก
            </button>
            <button
              onClick={handleSubmit}
              disabled={!title.trim() || !assigneeId || saving}
              className="flex-1 h-10 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg, #0056FF 0%, #2277FF 100%)' }}
            >
              {saving ? 'กำลังบันทึก...' : 'มอบหมายงาน'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ── Task Card ──────────────────────────────────────────────────────────────────

function TaskCard({ task, onStatusChange }: { task: Task; onStatusChange: (id: string, status: Task['status']) => void }) {
  const overdue = isOverdue(task);
  const days = daysLeft(task.dueDate);
  const cfg = PRIORITY_CONFIG[task.priority];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className={cn(
        'relative flex items-start gap-3 rounded-2xl p-3 transition-all',
        task.status === 'done' ? 'opacity-60' : '',
        overdue
          ? 'border-2 border-red-400 shadow-[0_0_0_1px_rgba(239,68,68,0.15)]'
          : 'border border-black/6',
      )}
      style={glassStyles.card}
    >
      {/* Overdue ping */}
      {overdue && (
        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full animate-ping" />
      )}

      {/* Priority stripe */}
      <div className={cn('w-1 shrink-0 rounded-full mt-0.5 self-stretch min-h-[2.5rem]', cfg.stripe)} />

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={cn('text-sm font-medium leading-tight', task.status === 'done' ? 'line-through text-black/40' : 'text-black/80')}>
            {task.title}
          </p>
          <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0', cfg.chip)}>
            {cfg.label}
          </span>
        </div>

        {task.description && (
          <p className="text-xs text-black/45 mt-0.5 line-clamp-2">{task.description}</p>
        )}

        <div className="flex items-center gap-3 mt-2">
          <span className={cn(
            'flex items-center gap-1 text-[11px] font-medium',
            overdue ? 'text-red-500' : days <= 1 ? 'text-amber-600' : 'text-black/45',
          )}>
            <HiOutlineClock size={12} />
            {overdue ? `เลย ${Math.abs(days)} วัน` : days === 0 ? 'วันนี้' : `${formatDueDate(task.dueDate)}`}
          </span>
          <span className="text-[11px] text-black/35">{STATUS_LABEL[task.status]}</span>
        </div>
      </div>

      {/* Action button */}
      {task.status !== 'done' ? (
        <button
          onClick={() => onStatusChange(task.id, 'done')}
          className="shrink-0 w-7 h-7 rounded-full border border-black/15 flex items-center justify-center hover:border-emerald-400 hover:bg-emerald-50 transition-all group"
          title="ทำเสร็จแล้ว"
        >
          <HiOutlineCheckCircle size={16} className="text-black/25 group-hover:text-emerald-500 transition-colors" />
        </button>
      ) : (
        <button
          onClick={() => onStatusChange(task.id, 'pending')}
          className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-emerald-500 hover:bg-emerald-50 transition-colors"
          title="เปิดงานใหม่"
        >
          <HiMiniCheckCircle size={18} />
        </button>
      )}
    </motion.div>
  );
}

// ── Main: Task Command Center ──────────────────────────────────────────────────

export default function TaskCommandCenter() {
  const { user, userData } = useAuth();
  const uid = user?.uid;
  const displayName: string = (userData as { name?: string; displayName?: string } | null)?.name
    ?? (userData as { name?: string; displayName?: string } | null)?.displayName
    ?? user?.email
    ?? '';

  const { data: tasks = [], isLoading, refetch } = useCreatedTasks(uid);
  const { mutateAsync: createTask } = useCreateTask(uid ?? '', displayName);
  const { mutate: updateStatus } = useUpdateTaskStatus();

  const [selectedAssigneeId, setSelectedAssigneeId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showMobileDetail, setShowMobileDetail] = useState(false);

  // Group tasks by assignee
  const assigneeGroups = useMemo(() => {
    const map = new Map<string, { assigneeId: string; assigneeName: string; tasks: Task[] }>();
    for (const t of tasks) {
      if (!map.has(t.assigneeId)) {
        map.set(t.assigneeId, { assigneeId: t.assigneeId, assigneeName: t.assigneeName, tasks: [] });
      }
      map.get(t.assigneeId)!.tasks.push(t);
    }
    return Array.from(map.values()).sort((a, b) => {
      const aPending = a.tasks.filter((t) => t.status !== 'done').length;
      const bPending = b.tasks.filter((t) => t.status !== 'done').length;
      return bPending - aPending;
    });
  }, [tasks]);

  const selectedGroup = useMemo(
    () => (selectedAssigneeId ? assigneeGroups.find((g) => g.assigneeId === selectedAssigneeId) : null),
    [assigneeGroups, selectedAssigneeId],
  );

  const selectedTasks = useMemo(() => {
    if (!selectedGroup) return [];
    return [...selectedGroup.tasks].sort((a, b) => {
      if (a.status === 'done' && b.status !== 'done') return 1;
      if (b.status === 'done' && a.status !== 'done') return -1;
      const pa = a.priority === 'critical' ? 0 : a.priority === 'urgent' ? 1 : 2;
      const pb = b.priority === 'critical' ? 0 : b.priority === 'urgent' ? 1 : 2;
      if (pa !== pb) return pa - pb;
      return a.dueDate.localeCompare(b.dueDate);
    });
  }, [selectedGroup]);

  const allStats = useMemo(() => ({
    total: tasks.length,
    done: tasks.filter((t) => t.status === 'done').length,
    overdue: tasks.filter(isOverdue).length,
    pending: tasks.filter((t) => t.status !== 'done').length,
  }), [tasks]);

  function handleSelectAssignee(id: string) {
    setSelectedAssigneeId(id);
    setShowMobileDetail(true);
  }

  function handleStatusChange(taskId: string, status: Task['status']) {
    updateStatus({ taskId, status });
  }

  async function handleCreateTask(input: CreateTaskInput) {
    await createTask(input);
    await refetch();
  }

  return (
    <div className="flex flex-col h-full" style={{ background: colors.palette.shell }}>
      {/* Header */}
      <div className="shrink-0 px-4 pt-5 pb-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-black/80 flex items-center gap-2">
              <HiOutlineClipboardDocumentList size={22} className="text-blue-600" />
              Task Command Center
            </h1>
            <p className="text-xs text-black/45 mt-0.5">ภาพรวมการมอบหมายงานทีม</p>
          </div>
          <button
            onClick={() => void refetch()}
            className="w-8 h-8 rounded-xl bg-white/80 border border-black/8 flex items-center justify-center hover:bg-white transition-colors"
          >
            <HiOutlineArrowPath size={16} className={cn('text-black/50', isLoading ? 'animate-spin' : '')} />
          </button>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-2 mt-4">
          {[
            { label: 'งานทั้งหมด', value: allStats.total, color: 'text-black/70' },
            { label: 'รอดำเนินการ', value: allStats.pending, color: 'text-amber-600' },
            { label: 'เกินกำหนด', value: allStats.overdue, color: 'text-red-500' },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl p-3 text-center" style={glassStyles.card}>
              <div className={cn('text-xl font-bold', s.color)}>{s.value}</div>
              <div className="text-[10px] text-black/45 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Body: Split View */}
      <div className="flex-1 flex overflow-hidden gap-0">
        {/* ── Left Sidebar ── */}
        <div className={cn(
          'flex flex-col bg-white/60 border-r border-black/6 overflow-hidden transition-all duration-300',
          // Mobile: hide when showing detail
          showMobileDetail ? 'hidden' : 'flex',
          // Desktop: always show
          'md:flex md:w-72 lg:w-80',
          !showMobileDetail ? 'w-full' : 'w-0',
        )}>
          <div className="px-3 py-3 border-b border-black/5">
            <p className={cn(typography.sectionTitle, 'mb-0')}>
              ทีมงาน · {assigneeGroups.length} คน
            </p>
          </div>

          <div className="flex-1 overflow-y-auto py-2 space-y-1 px-2">
            {isLoading ? (
              <div className="flex items-center justify-center h-24 text-black/30 text-sm">กำลังโหลด...</div>
            ) : assigneeGroups.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-black/30 gap-2">
                <HiOutlineUser size={28} />
                <p className="text-sm">ยังไม่มีงานที่มอบหมาย</p>
              </div>
            ) : (
              assigneeGroups.map((grp) => {
                const pending = grp.tasks.filter((t) => t.status !== 'done').length;
                const over = grp.tasks.filter(isOverdue).length;
                const done = grp.tasks.filter((t) => t.status === 'done').length;
                const pct = grp.tasks.length > 0 ? Math.round((done / grp.tasks.length) * 100) : 0;
                const isSelected = selectedAssigneeId === grp.assigneeId;

                return (
                  <button
                    key={grp.assigneeId}
                    onClick={() => handleSelectAssignee(grp.assigneeId)}
                    className={cn(
                      'w-full flex items-center gap-3 p-3 rounded-2xl text-left transition-all',
                      isSelected
                        ? 'bg-blue-600 shadow-md shadow-blue-200'
                        : 'hover:bg-black/5',
                    )}
                  >
                    {/* Avatar */}
                    <div className={cn(
                      'w-10 h-10 shrink-0 rounded-xl flex items-center justify-center text-white text-sm font-bold bg-gradient-to-br',
                      avatarGradient(grp.assigneeId),
                    )}>
                      {getInitials(grp.assigneeName)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className={cn('text-sm font-semibold truncate', isSelected ? 'text-white' : 'text-black/80')}>
                          {grp.assigneeName}
                        </span>
                        {pending > 0 && (
                          <span className={cn(
                            'w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0',
                            isSelected ? 'bg-white/20 text-white' : 'bg-red-500 text-white',
                          )}>
                            {pending > 9 ? '9+' : pending}
                          </span>
                        )}
                      </div>
                      {/* Progress bar */}
                      <div className={cn('w-full h-1 rounded-full mt-1.5', isSelected ? 'bg-white/20' : 'bg-black/10')}>
                        <div
                          className={cn('h-full rounded-full transition-all', isSelected ? 'bg-white' : 'bg-emerald-500')}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        {over > 0 && (
                          <span className={cn('text-[10px] flex items-center gap-0.5', isSelected ? 'text-red-200' : 'text-red-500')}>
                            <HiOutlineExclamationCircle size={10} /> เลยกำหนด {over}
                          </span>
                        )}
                        <span className={cn('text-[10px]', isSelected ? 'text-white/60' : 'text-black/35')}>
                          {done}/{grp.tasks.length} งาน
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* ── Right Panel ── */}
        <div className={cn(
          'flex-1 flex flex-col overflow-hidden',
          !showMobileDetail ? 'hidden md:flex' : 'flex',
        )}>
          {/* Mobile back */}
          {showMobileDetail && (
            <button
              onClick={() => setShowMobileDetail(false)}
              className="md:hidden flex items-center gap-1 px-4 pt-3 pb-1 text-blue-600 text-sm font-medium"
            >
              <HiOutlineChevronLeft size={16} /> กลับ
            </button>
          )}

          {!selectedGroup ? (
            <div className="flex-1 flex flex-col items-center justify-center text-black/30 gap-3">
              <HiOutlineClipboardDocumentList size={48} />
              <p className="text-sm">เลือกบุคลากรเพื่อดูงาน</p>
              <button
                onClick={() => setShowCreate(true)}
                className="mt-2 h-9 px-4 rounded-xl text-sm font-semibold text-white flex items-center gap-2"
                style={{ background: 'linear-gradient(135deg, #0056FF 0%, #2277FF 100%)' }}
              >
                <HiOutlinePlus size={16} /> สร้างงานใหม่
              </button>
            </div>
          ) : (
            <>
              {/* Person header */}
              <div className="shrink-0 px-4 pt-4 pb-3 border-b border-black/6 bg-white/40">
                <div className="flex items-center gap-3">
                  <div className={cn('w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold text-lg bg-gradient-to-br', avatarGradient(selectedGroup.assigneeId))}>
                    {getInitials(selectedGroup.assigneeName)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="font-bold text-black/80">{selectedGroup.assigneeName}</h2>
                    <div className="flex items-center gap-3 mt-0.5">
                      {[
                        { label: 'ทั้งหมด', value: selectedGroup.tasks.length, color: 'text-black/50' },
                        { label: 'ค้างอยู่', value: selectedGroup.tasks.filter((t) => t.status !== 'done').length, color: 'text-amber-600' },
                        { label: 'เสร็จ', value: selectedGroup.tasks.filter((t) => t.status === 'done').length, color: 'text-emerald-600' },
                      ].map((s) => (
                        <span key={s.label} className={cn('text-xs font-semibold', s.color)}>
                          {s.value} {s.label}
                        </span>
                      ))}
                    </div>
                    {/* Progress bar */}
                    <div className="w-full h-1.5 bg-black/8 rounded-full mt-2">
                      <motion.div
                        className="h-full bg-emerald-500 rounded-full"
                        initial={{ width: 0 }}
                        animate={{
                          width: `${selectedGroup.tasks.length > 0
                            ? (selectedGroup.tasks.filter((t) => t.status === 'done').length / selectedGroup.tasks.length) * 100
                            : 0}%`,
                        }}
                        transition={{ duration: 0.6, ease: 'easeOut' }}
                      />
                    </div>
                  </div>
                  <button
                    onClick={() => setShowCreate(true)}
                    className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-md transition-transform hover:scale-105 active:scale-95"
                    style={{ background: 'linear-gradient(135deg, #0056FF 0%, #2277FF 100%)' }}
                    title="เพิ่มงานให้คนนี้"
                  >
                    <HiOutlinePlus size={18} />
                  </button>
                </div>
              </div>

              {/* Task list */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                <AnimatePresence mode="popLayout">
                  {selectedTasks.length === 0 ? (
                    <motion.div
                      key="empty"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex flex-col items-center justify-center h-32 text-black/30 gap-2"
                    >
                      <HiOutlineFlag size={28} />
                      <p className="text-sm">ยังไม่มีงาน</p>
                    </motion.div>
                  ) : (
                    selectedTasks.map((task) => (
                      <TaskCard key={task.id} task={task} onStatusChange={handleStatusChange} />
                    ))
                  )}
                </AnimatePresence>
              </div>
            </>
          )}
        </div>
      </div>

      {/* FAB */}
      <motion.button
        onClick={() => setShowCreate(true)}
        className="fixed bottom-24 right-5 w-14 h-14 rounded-2xl shadow-xl flex items-center justify-center text-white z-40"
        style={{ background: 'linear-gradient(135deg, #0056FF 0%, #2277FF 100%)' }}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.95 }}
        title="มอบหมายงานใหม่"
      >
        <HiOutlinePlus size={26} />
      </motion.button>

      <CreateTaskModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        defaultAssigneeId={selectedGroup?.assigneeId}
        defaultAssigneeName={selectedGroup?.assigneeName}
        onSubmit={handleCreateTask}
      />
    </div>
  );
}
