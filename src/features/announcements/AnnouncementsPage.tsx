import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell,
  Plus,
  Pin,
  TriangleAlert,
  Megaphone,
  Pencil,
  Trash2,
  CalendarDays,
} from 'lucide-react';
import FormModal, { modalInputCls, modalLabelCls } from '@/components/ui/FormModal';
import { useAuth } from '@/hooks/useAuth';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import { useAnnouncements, useManageAnnouncements } from '@/hooks/useAnnouncements';
import { cn } from '@/lib/utils';
import type { Announcement, AnnouncementPriority, CreateAnnouncementInput } from '@/types/announcement';

const ROLE_OPTIONS = [
  { value: 'all', label: 'ทุกคน' },
  { value: 'student', label: 'นักเรียน' },
  { value: 'teacher', label: 'ครู' },
  { value: 'staff', label: 'เจ้าหน้าที่' },
  { value: 'admin', label: 'ผู้บริหาร' },
  { value: 'sysadmin', label: 'System Admin' },
];

const PRIORITY_BADGE: Record<AnnouncementPriority, string> = {
  normal: 'bg-slate-100 text-slate-600 border-slate-200',
  important: 'bg-amber-50 text-amber-700 border-amber-200',
  urgent: 'bg-rose-50 text-rose-700 border-rose-200',
};

const PRIORITY_LABEL: Record<AnnouncementPriority, string> = {
  normal: 'ทั่วไป',
  important: 'สำคัญ',
  urgent: 'ด่วน',
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

function audienceLabel(targetRoles: string[]) {
  if (targetRoles.includes('all')) return 'ทุกคน';
  return ROLE_OPTIONS
    .filter((r) => targetRoles.includes(r.value))
    .map((r) => r.label)
    .join(', ');
}

function AnnouncementEditor({
  initial,
  onClose,
  onSubmit,
  onDelete,
}: {
  initial?: Announcement | null;
  onClose: () => void;
  onSubmit: (input: CreateAnnouncementInput) => Promise<void>;
  onDelete?: () => Promise<void>;
}) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [content, setContent] = useState(initial?.content ?? '');
  const [priority, setPriority] = useState<AnnouncementPriority>(initial?.priority ?? 'normal');
  const [isPinned, setIsPinned] = useState(initial?.isPinned ?? false);
  const [expiresAt, setExpiresAt] = useState(initial?.expiresAt ?? '');
  const [targetRoles, setTargetRoles] = useState<string[]>(initial?.targetRoles?.length ? initial.targetRoles : ['all']);
  const [saving, setSaving] = useState(false);

  const toggleRole = (roleValue: string) => {
    setTargetRoles((prev) => {
      if (roleValue === 'all') return ['all'];
      const withoutAll = prev.filter((v) => v !== 'all');
      const next = withoutAll.includes(roleValue)
        ? withoutAll.filter((v) => v !== roleValue)
        : [...withoutAll, roleValue];
      return next.length > 0 ? next : ['all'];
    });
  };

  const submit = async () => {
    if (!title.trim() || !content.trim()) return;
    setSaving(true);
    try {
      await onSubmit({
        title: title.trim(),
        content: content.trim(),
        priority,
        isPinned,
        targetRoles,
        expiresAt: expiresAt || null,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormModal
      open
      onClose={onClose}
      title={initial ? 'แก้ไขประกาศ' : 'สร้างประกาศใหม่'}
      subtitle="Announcement Management"
      icon={<Megaphone size={18} />}
      onSubmit={submit}
      submitLabel={saving ? 'กำลังบันทึก...' : 'บันทึกประกาศ'}
      submitDisabled={saving || !title.trim() || !content.trim()}
      onDelete={onDelete ? () => { void onDelete(); } : undefined}
      deleteLabel="ลบประกาศ"
      maxWidth="2xl"
    >
      <div className="space-y-5">
        <div className="space-y-1.5">
          <label className={modalLabelCls}>หัวข้อประกาศ</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="เช่น แจ้งหยุดเรียนชดเชยวันสงกรานต์"
            className={modalInputCls}
          />
        </div>

        <div className="space-y-1.5">
          <label className={modalLabelCls}>รายละเอียด</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={5}
            className={cn(modalInputCls, 'h-auto min-h-[140px] py-4 resize-none')}
            placeholder="ระบุรายละเอียดประกาศ..."
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label className={modalLabelCls}>ระดับความสำคัญ</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as AnnouncementPriority)}
              className={modalInputCls}
            >
              <option value="normal">ทั่วไป</option>
              <option value="important">สำคัญ</option>
              <option value="urgent">ด่วน</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className={modalLabelCls}>วันหมดอายุ (ไม่บังคับ)</label>
            <input
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className={modalInputCls}
            />
          </div>
          <div className="space-y-1.5">
            <label className={modalLabelCls}>ปักหมุด</label>
            <button
              type="button"
              onClick={() => setIsPinned((v) => !v)}
              className={cn(
                modalInputCls,
                'flex items-center justify-start gap-2 text-left',
                isPinned ? 'border-blue-200 text-blue-700 bg-blue-50' : ''
              )}
            >
              <Pin size={15} />
              {isPinned ? 'ปักหมุดแล้ว' : 'ไม่ปักหมุด'}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <label className={modalLabelCls}>กลุ่มเป้าหมาย</label>
          <div className="flex flex-wrap gap-2">
            {ROLE_OPTIONS.map((r) => {
              const active = targetRoles.includes(r.value);
              return (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => toggleRole(r.value)}
                  className={cn(
                    'px-3 py-2 rounded-xl text-xs font-black border transition-colors',
                    active
                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                      : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                  )}
                >
                  {r.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </FormModal>
  );
}

export default function AnnouncementsPage() {
  const { role, user, userData } = useAuth();
  const { canEdit } = useMyPermissions();
  const canManage = canEdit('announcements');
  const { announcements: visibleAnnouncements, loading: loadingVisible } = useAnnouncements(role ?? undefined);
  const {
    announcements: allAnnouncements,
    loading: loadingAll,
    createAnnouncement,
    updateAnnouncement,
    deleteAnnouncement,
  } = useManageAnnouncements(canManage);

  const [search, setSearch] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [selected, setSelected] = useState<Announcement | null>(null);

  const source = canManage ? allAnnouncements : visibleAnnouncements;
  const loading = canManage ? loadingAll : loadingVisible;

  const items = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return source;
    return source.filter((a) =>
      a.title.toLowerCase().includes(q) || a.content.toLowerCase().includes(q)
    );
  }, [search, source]);

  const creatorName = userData?.firstName
    ? `${userData.prefix ?? ''}${userData.firstName} ${userData.lastName ?? ''}`.trim()
    : userData?.displayName || userData?.email || user?.email || 'ไม่ระบุ';

  return (
    <div className="h-full min-h-0 flex flex-col gap-4">
      <div className="rounded-[2rem] border border-slate-200 bg-white/80 backdrop-blur p-5 flex flex-col md:flex-row md:items-center gap-3 md:justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center">
            <Bell size={18} />
          </div>
          <div>
            <h1 className="text-lg font-black text-slate-800">ศูนย์ประกาศ</h1>
            <p className="text-xs font-bold text-slate-400">Announcements Center</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ค้นหาประกาศ..."
            className="h-10 px-4 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-700 outline-none focus:border-blue-300"
          />
          {canManage && (
            <button
              onClick={() => {
                setSelected(null);
                setEditorOpen(true);
              }}
              className="h-10 px-4 rounded-xl bg-slate-900 text-white text-xs font-black flex items-center gap-2"
            >
              <Plus size={14} />
              เพิ่มประกาศ
            </button>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {loading ? (
          <div className="h-40 flex items-center justify-center">
            <div className="w-7 h-7 border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-[2rem] border border-slate-200 bg-white p-10 text-center">
            <p className="font-black text-slate-700">ยังไม่มีประกาศ</p>
            <p className="text-xs text-slate-400 mt-1">เมื่อมีประกาศใหม่จะปรากฏที่หน้านี้</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <AnimatePresence initial={false}>
              {items.map((a) => (
                <motion.div
                  key={a.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="rounded-[1.75rem] border border-slate-200 bg-white p-5 flex flex-col gap-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {a.isPinned && (
                          <span className="px-2 py-1 rounded-lg text-[10px] font-black bg-blue-50 text-blue-700 border border-blue-200 inline-flex items-center gap-1">
                            <Pin size={10} /> ปักหมุด
                          </span>
                        )}
                        <span className={cn('px-2 py-1 rounded-lg text-[10px] font-black border inline-flex items-center gap-1', PRIORITY_BADGE[a.priority])}>
                          {a.priority === 'urgent' ? <TriangleAlert size={10} /> : <Megaphone size={10} />}
                          {PRIORITY_LABEL[a.priority]}
                        </span>
                      </div>
                      <h3 className="text-[15px] font-black text-slate-800 leading-snug break-words">{a.title}</h3>
                    </div>

                    {canManage && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            setSelected(a);
                            setEditorOpen(true);
                          }}
                          className="w-8 h-8 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-700"
                        >
                          <Pencil size={13} className="mx-auto" />
                        </button>
                        <button
                          onClick={() => { void deleteAnnouncement(a.id); }}
                          className="w-8 h-8 rounded-lg border border-rose-200 text-rose-500 hover:text-rose-700"
                        >
                          <Trash2 size={13} className="mx-auto" />
                        </button>
                      </div>
                    )}
                  </div>

                  <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap break-words">
                    {a.content}
                  </p>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-400 font-bold pt-2 border-t border-slate-100">
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarDays size={12} />
                      {formatDateTime(a.createdAt)}
                    </span>
                    <span>ผู้ประกาศ: {a.createdByName || 'ไม่ระบุ'}</span>
                    <span>กลุ่มเป้าหมาย: {audienceLabel(a.targetRoles)}</span>
                    {a.expiresAt && <span>หมดอายุ: {a.expiresAt}</span>}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {editorOpen && canManage && (
        <AnnouncementEditor
          initial={selected}
          onClose={() => {
            setEditorOpen(false);
            setSelected(null);
          }}
          onSubmit={async (input) => {
            if (selected) {
              await updateAnnouncement(selected.id, input);
              return;
            }
            if (!user?.uid) return;
            await createAnnouncement(input, user.uid, creatorName);
          }}
          onDelete={selected ? async () => {
            await deleteAnnouncement(selected.id);
            setEditorOpen(false);
            setSelected(null);
          } : undefined}
        />
      )}
    </div>
  );
}
