import { useEffect, useRef, useState } from 'react';
import { HiOutlinePlus, HiOutlineTrash, HiOutlineXMark } from 'react-icons/hi2';
import { toast } from 'sonner';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { cn } from '@/lib/utils';

const DRAWER_CONTENT_CLASS = cn(
  'flex h-dvh flex-col bg-transparent p-0 before:hidden',
  'data-[vaul-drawer-direction=right]:w-screen data-[vaul-drawer-direction=right]:max-w-none',
  'sm:h-full sm:data-[vaul-drawer-direction=right]:w-full sm:data-[vaul-drawer-direction=right]:max-w-md sm:p-2',
);

const DRAWER_PANEL_CLASS = cn(
  'flex h-full min-h-0 flex-col overflow-hidden bg-white',
  'sm:rounded-4xl sm:border sm:border-slate-200/70 sm:shadow-xl',
);

interface Props {
  open: boolean;
  onClose: () => void;
  lessonOptions: string[];
  onSave: (lessonOptions: string[]) => Promise<void>;
  subjectName?: string;
  className?: string;
}

export default function LessonContentSettingsDrawer({
  open,
  onClose,
  lessonOptions,
  onSave,
  subjectName,
  className,
}: Props) {
  const [items, setItems] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setItems(lessonOptions);
      setDraft('');
    }
    wasOpenRef.current = open;
  }, [open, lessonOptions]);

  const buildItemsForSave = () => {
    const nextItems = [...items];
    const pending = draft.trim();
    if (!pending) return nextItems;
    if (!nextItems.some((item) => item.toLowerCase() === pending.toLowerCase())) {
      nextItems.push(pending);
    }
    return nextItems;
  };

  const addItem = () => {
    const value = draft.trim();
    if (!value) return;
    if (items.some((item) => item.toLowerCase() === value.toLowerCase())) {
      setDraft('');
      return;
    }
    setItems((current) => [...current, value]);
    setDraft('');
  };

  const removeItem = (index: number) => {
    setItems((current) => current.filter((_, itemIndex) => itemIndex !== index));
  };

  const handleSave = async () => {
    const nextItems = buildItemsForSave();
    if (nextItems.length === 0) {
      toast.error('กรุณาเพิ่มบทเรียนอย่างน้อย 1 รายการ');
      return;
    }

    setSaving(true);
    try {
      await onSave(nextItems);
      setItems(nextItems);
      setDraft('');
      toast.success('บันทึกรายการบทเรียนแล้ว');
      onClose();
    } catch (error) {
      console.error('LessonContentSettingsDrawer save failed:', error);
      toast.error('บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()} direction="right">
      <DrawerContent className={DRAWER_CONTENT_CLASS}>
        <div className={DRAWER_PANEL_CLASS}>
          <DrawerHeader className="shrink-0 border-b border-slate-100 px-4 pb-3 pt-4">
            <div className="relative flex min-h-10 items-center justify-center">
              <div className="min-w-0 px-12 text-center">
                <DrawerTitle className="text-base font-black text-slate-800 font-sukhumvit">
                  ตั้งค่าเนื้อหาบทเรียน
                </DrawerTitle>
                <DrawerDescription className="text-xs text-slate-500 font-sarabun">
                  {[subjectName, className].filter(Boolean).join(' · ') || 'รายการบทเรียนสำหรับเลือกในแผนการสอน'}
                </DrawerDescription>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="absolute right-0 top-1/2 inline-flex size-9 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 active:scale-[0.98]"
                aria-label="ปิด"
              >
                <HiOutlineXMark className="size-5" />
              </button>
            </div>
          </DrawerHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 space-y-4">
            <div className="space-y-2">
              <label className="text-[11px] font-black uppercase tracking-wide text-slate-500 font-sukhumvit">
                เพิ่มบทเรียน
              </label>
              <div className="flex gap-2">
                <input
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      addItem();
                    }
                  }}
                  placeholder="เช่น บทที่ 1 จำนวนและการดำเนินการ"
                  className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-sarabun text-slate-800 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                />
                <button
                  type="button"
                  onClick={addItem}
                  disabled={!draft.trim()}
                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-indigo-200 bg-indigo-50 text-indigo-700 transition hover:bg-indigo-100 disabled:opacity-50"
                  aria-label="เพิ่มบทเรียน"
                >
                  <HiOutlinePlus size={18} />
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-[11px] font-black uppercase tracking-wide text-slate-500 font-sukhumvit">
                รายการบทเรียน ({items.length})
              </p>
              {items.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm font-bold text-slate-400 font-sarabun">
                  ยังไม่มีรายการบทเรียน
                </div>
              ) : (
                <div className="space-y-2">
                  {items.map((item, index) => (
                    <div
                      key={`${item}-${index}`}
                      className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2.5"
                    >
                      <p className="min-w-0 flex-1 text-sm font-bold text-slate-800 font-sarabun">{item}</p>
                      <button
                        type="button"
                        onClick={() => removeItem(index)}
                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-rose-500 hover:bg-rose-50"
                        aria-label={`ลบ ${item}`}
                      >
                        <HiOutlineTrash size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DrawerFooter className="mt-0 shrink-0 border-t border-slate-100 bg-white px-4 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] flex-row gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex-1 h-11 rounded-2xl border border-slate-200 bg-white text-sm font-black text-slate-600 hover:bg-slate-50 disabled:opacity-60"
            >
              ยกเลิก
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              className="flex-1 h-11 rounded-2xl bg-blue-600 text-sm font-black text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? 'กำลังบันทึก...' : 'บันทึก'}
            </button>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
