import { useState, useMemo, useRef } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import {
  HiOutlineCheckCircle,
  HiOutlineClock,
  HiOutlineChevronDown,
  HiOutlineChevronUp,
  HiMiniCheckCircle,
  HiOutlineArrowPath,
  HiOutlineInbox,
  HiOutlineExclamationCircle,
} from 'react-icons/hi2';
import { useAuth } from '@/hooks/useAuth';
import { useMyTasks, useUpdateTaskStatus } from '@/hooks/useTasks';
import { cn } from '@/lib/utils';
import { glassStyles, typography, colors } from '@/lib/designTokens';
import type { Task, TaskPriority } from '@/types/task';

const TODAY = new Date().toISOString().slice(0, 10);

function isOverdue(task: Task) {
  return task.status !== 'done' && task.dueDate < TODAY;
}

function daysLeft(dateStr: string): number {
  const due = new Date(dateStr + 'T00:00:00');
  const now = new Date(TODAY + 'T00:00:00');
  return Math.ceil((due.getTime() - now.getTime()) / 86_400_000);
}

function formatDueDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
}

const PRIORITY_CONFIG: Record<TaskPriority, {
  label: string;
  chip: string;
  stripe: string;
  emoji: string;
}> = {
  normal: {
    label: 'ปกติ',
    chip: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    stripe: 'bg-emerald-400',
    emoji: '🟢',
  },
  urgent: {
    label: 'ด่วน',
    chip: 'bg-amber-50 text-amber-700 border border-amber-200',
    stripe: 'bg-amber-400',
    emoji: '🟡',
  },
  critical: {
    label: 'ด่วนมาก',
    chip: 'bg-rose-50 text-rose-700 border border-rose-200',
    stripe: 'bg-rose-500',
    emoji: '🔴',
  },
};

// ── Swipeable Task Item ────────────────────────────────────────────────────────

function SwipeableTaskItem({ task, onComplete }: { task: Task; onComplete: () => void }) {
  const x = useMotionValue(0);
  const background = useTransform(x, [0, 80], ['rgba(16,185,129,0)', 'rgba(16,185,129,0.15)']);
  const checkOpacity = useTransform(x, [20, 70], [0, 1]);
  const overdue = isOverdue(task);
  const days = daysLeft(task.dueDate);
  const cfg = PRIORITY_CONFIG[task.priority];
  const constraintRef = useRef<HTMLDivElement>(null);

  function handleDragEnd(_: unknown, info: { offset: { x: number } }) {
    if (info.offset.x > 80) {
      onComplete();
    }
  }

  return (
    <div ref={constraintRef} className="relative overflow-hidden rounded-2xl">
      {/* Swipe reveal background */}
      <motion.div
        className="absolute inset-0 rounded-2xl flex items-center pl-5 gap-2"
        style={{ background }}
      >
        <motion.div style={{ opacity: checkOpacity }}>
          <HiMiniCheckCircle size={22} className="text-emerald-500" />
        </motion.div>
        <motion.span style={{ opacity: checkOpacity }} className="text-sm font-semibold text-emerald-600">
          ทำเสร็จแล้ว!
        </motion.span>
      </motion.div>

      {/* Card */}
      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 100 }}
        dragElastic={{ left: 0, right: 0.3 }}
        onDragEnd={handleDragEnd}
        style={{ x }}
        className={cn(
          'relative flex items-start gap-3 rounded-2xl p-3.5 cursor-grab active:cursor-grabbing select-none',
          overdue
            ? 'border-2 border-red-400'
            : 'border border-black/6',
        )}
        whileDrag={{ scale: 1.01 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        layout
      >
        <div style={{ ...glassStyles.card, position: 'absolute', inset: 0, borderRadius: 'inherit', zIndex: -1 }} />

        {/* Overdue ping */}
        {overdue && (
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full animate-ping" />
        )}

        {/* Priority stripe */}
        <div className={cn('w-1 shrink-0 rounded-full self-stretch min-h-[2.5rem]', cfg.stripe)} />

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium text-black/80 leading-tight">{task.title}</p>
            <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0', cfg.chip)}>
              {cfg.emoji} {cfg.label}
            </span>
          </div>

          {task.description && (
            <p className="text-xs text-black/40 mt-0.5 line-clamp-2">{task.description}</p>
          )}

          <div className="flex items-center gap-3 mt-2">
            <span className={cn(
              'flex items-center gap-1 text-[11px] font-medium',
              overdue ? 'text-red-500' : days <= 1 ? 'text-amber-600' : 'text-black/45',
            )}>
              <HiOutlineClock size={12} />
              {overdue
                ? `เลยกำหนด ${Math.abs(days)} วัน`
                : days === 0
                  ? 'ครบกำหนดวันนี้'
                  : days === 1
                    ? 'พรุ่งนี้'
                    : formatDueDate(task.dueDate)}
            </span>
            <span className="text-[11px] text-black/30">จาก {task.createdByName || 'ผู้บริหาร'}</span>
          </div>
        </div>

        {/* Check button */}
        <button
          onClick={onComplete}
          className="shrink-0 w-8 h-8 rounded-full border border-black/12 flex items-center justify-center hover:border-emerald-400 hover:bg-emerald-50 transition-all group touch-manipulation"
        >
          <HiOutlineCheckCircle size={18} className="text-black/20 group-hover:text-emerald-500 transition-colors" />
        </button>
      </motion.div>
    </div>
  );
}

// ── Completed Task Row ─────────────────────────────────────────────────────────

function CompletedTaskRow({ task, onReopen }: { task: Task; onReopen: () => void }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/60 border border-black/5"
    >
      <button onClick={onReopen} className="shrink-0 text-emerald-500 hover:text-emerald-600 transition-colors">
        <HiMiniCheckCircle size={20} />
      </button>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-black/35 line-through truncate">{task.title}</p>
        {task.completedAt && (
          <p className="text-[10px] text-black/25">เสร็จ {formatDueDate(task.completedAt)}</p>
        )}
      </div>
      <span className={cn('text-[9px] font-semibold px-1.5 py-0.5 rounded-full', PRIORITY_CONFIG[task.priority].chip)}>
        {PRIORITY_CONFIG[task.priority].emoji}
      </span>
    </motion.div>
  );
}

// ── Main: My Task Inbox ────────────────────────────────────────────────────────

export default function MyTaskInbox() {
  const { user, userData } = useAuth();
  const uid = user?.uid;
  const displayName: string = (userData as { name?: string; displayName?: string } | null)?.name
    ?? (userData as { name?: string; displayName?: string } | null)?.displayName
    ?? 'คุณ';

  const { data: tasks = [], isLoading, refetch } = useMyTasks(uid);
  const { mutate: updateStatus } = useUpdateTaskStatus();
  const [showDone, setShowDone] = useState(false);

  const { pinned, regular, done } = useMemo(() => {
    const active = tasks.filter((t) => t.status !== 'done');
    const completed = tasks.filter((t) => t.status === 'done');

    const pinnedTasks = active.filter((t) => t.priority === 'critical' || t.priority === 'urgent');
    const regularTasks = active.filter((t) => t.priority === 'normal');

    // Sort: overdue first, then by due date
    const sortActive = (arr: Task[]) =>
      [...arr].sort((a, b) => {
        const aOver = isOverdue(a) ? 0 : 1;
        const bOver = isOverdue(b) ? 0 : 1;
        if (aOver !== bOver) return aOver - bOver;
        return a.dueDate.localeCompare(b.dueDate);
      });

    return {
      pinned: sortActive(pinnedTasks),
      regular: sortActive(regularTasks),
      done: completed.sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? '')),
    };
  }, [tasks]);

  const stats = useMemo(() => ({
    pending: tasks.filter((t) => t.status !== 'done').length,
    overdue: tasks.filter(isOverdue).length,
    done: tasks.filter((t) => t.status === 'done').length,
    urgent: tasks.filter((t) => t.status !== 'done' && (t.priority === 'critical' || t.priority === 'urgent')).length,
  }), [tasks]);

  function markDone(taskId: string) {
    updateStatus({ taskId, status: 'done' });
  }

  function reopen(taskId: string) {
    updateStatus({ taskId, status: 'pending' });
  }

  return (
    <div className="flex flex-col h-full" style={{ background: colors.palette.shell }}>
      {/* Header */}
      <div className="shrink-0 px-4 pt-5 pb-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-black/80">งานของ{displayName}</h1>
            <p className="text-xs text-black/40 mt-0.5">ปัดขวาที่การ์ด หรือกด ✓ เพื่อปิดงาน</p>
          </div>
          <button
            onClick={() => void refetch()}
            className="w-8 h-8 rounded-xl bg-white/80 border border-black/8 flex items-center justify-center hover:bg-white transition-colors"
          >
            <HiOutlineArrowPath size={16} className={cn('text-black/50', isLoading ? 'animate-spin' : '')} />
          </button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-4 gap-2 mt-4">
          {[
            { label: 'งานทั้งหมด', value: stats.pending, color: 'text-black/65' },
            { label: 'ด่วน/ด่วนมาก', value: stats.urgent, color: 'text-amber-600', hide: stats.urgent === 0 },
            { label: 'เกินกำหนด', value: stats.overdue, color: 'text-red-500', hide: stats.overdue === 0 },
            { label: 'เสร็จแล้ว', value: stats.done, color: 'text-emerald-600' },
          ]
            .filter((s) => !s.hide)
            .map((s) => (
              <div key={s.label} className="rounded-2xl p-2.5 text-center" style={glassStyles.card}>
                <div className={cn('text-xl font-bold', s.color)}>{s.value}</div>
                <div className="text-[9px] text-black/40 mt-0.5 leading-tight">{s.label}</div>
              </div>
            ))}
        </div>
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-y-auto px-4 pb-24 space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-32 text-black/30 text-sm">กำลังโหลด...</div>
        ) : tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3 text-black/30">
            <HiOutlineInbox size={48} />
            <p className="text-sm">ไม่มีงานที่ได้รับมอบหมาย</p>
          </div>
        ) : (
          <>
            {/* ── Pinned / Focus mode (urgent + critical) ── */}
            <AnimatePresence>
              {pinned.length > 0 && (
                <motion.div
                  key="pinned"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <HiOutlineExclamationCircle size={13} className="text-rose-500" />
                    <p className={cn(typography.sectionTitle, 'mb-0 text-rose-500')}>โฟกัส · ด่วน</p>
                  </div>
                  <div className="space-y-2">
                    {pinned.map((task) => (
                      <SwipeableTaskItem key={task.id} task={task} onComplete={() => markDone(task.id)} />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Regular tasks ── */}
            <AnimatePresence>
              {regular.length > 0 && (
                <motion.div
                  key="regular"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  {pinned.length > 0 && (
                    <p className={cn(typography.sectionTitle, 'mb-2')}>งานทั่วไป</p>
                  )}
                  <div className="space-y-2">
                    {regular.map((task) => (
                      <SwipeableTaskItem key={task.id} task={task} onComplete={() => markDone(task.id)} />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Completed ── */}
            {done.length > 0 && (
              <div>
                <button
                  onClick={() => setShowDone((v) => !v)}
                  className="flex items-center gap-2 mb-2 w-full text-left"
                >
                  <p className={cn(typography.sectionTitle, 'mb-0 text-black/30')}>
                    เสร็จแล้ว · {done.length} งาน
                  </p>
                  {showDone
                    ? <HiOutlineChevronUp size={12} className="text-black/30" />
                    : <HiOutlineChevronDown size={12} className="text-black/30" />}
                </button>
                <AnimatePresence>
                  {showDone && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-1.5 overflow-hidden"
                    >
                      {done.map((task) => (
                        <CompletedTaskRow key={task.id} task={task} onReopen={() => reopen(task.id)} />
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
