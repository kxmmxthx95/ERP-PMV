// src/features/teacherKpi/components/KpiStartDateSetting.tsx
import { useEffect, useState } from 'react';
import { HiOutlineCog6Tooth } from 'react-icons/hi2';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { cn } from '@/lib/utils';

interface KpiStartDateSettingProps {
  currentStartDate: string;
  semesterStartDate: string;
  semesterEndDate: string;
  onSave: (date: string) => Promise<void>;
}

const SIDE_DRAWER_CONTENT_CLASS = cn(
  'h-dvh max-h-none font-sukhumvit pb-[max(1rem,env(safe-area-inset-bottom))]',
  'data-[vaul-drawer-direction=right]:w-screen data-[vaul-drawer-direction=right]:max-w-none',
  'data-[vaul-drawer-direction=right]:before:inset-0 data-[vaul-drawer-direction=right]:before:rounded-none',
  'sm:data-[vaul-drawer-direction=right]:w-full sm:data-[vaul-drawer-direction=right]:max-w-md',
  'sm:data-[vaul-drawer-direction=right]:before:inset-2 sm:data-[vaul-drawer-direction=right]:before:rounded-4xl',
  'sm:p-2',
);

export function KpiStartDateSetting({
  currentStartDate,
  semesterStartDate,
  semesterEndDate,
  onSave,
}: KpiStartDateSettingProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(currentStartDate);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setDraft(currentStartDate);
  }, [currentStartDate]);

  useEffect(() => {
    if (open) setDraft(currentStartDate);
  }, [open, currentStartDate]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(draft);
      setOpen(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleClearAndSave = async () => {
    setIsSaving(true);
    try {
      await onSave('');
      setDraft('');
      setOpen(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="pointer-events-auto relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
        title="ตั้งวันเริ่มคำนวณ"
        aria-label="ตั้งวันเริ่มคำนวณ"
      >
        <HiOutlineCog6Tooth className="h-4 w-4" />
      </button>

      <Drawer open={open} onOpenChange={setOpen} direction="right">
        <DrawerContent className={SIDE_DRAWER_CONTENT_CLASS}>
          <DrawerHeader className="text-left">
            <DrawerTitle className="text-base font-black text-slate-900">ตั้งวันเริ่มคำนวณ</DrawerTitle>
            <DrawerDescription className="text-xs text-slate-500">
              กำหนดวันที่เริ่มนับ KPI (ว่าง = ใช้วันเริ่มเทอม)
            </DrawerDescription>
          </DrawerHeader>

          <div className="flex-1 space-y-4 overflow-y-auto px-4">
            <div>
              <label className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-slate-400">
                วันเริ่มคำนวณ
              </label>
              <input
                type="date"
                value={draft}
                min={semesterStartDate || undefined}
                max={semesterEndDate || undefined}
                onChange={(e) => setDraft(e.target.value)}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 font-sarabun text-[13px] font-bold text-slate-800 outline-none transition-all focus:border-blue-200 focus:ring-4 focus:ring-blue-50/50"
              />
              {(semesterStartDate || semesterEndDate) && (
                <p className="mt-2 font-sarabun text-[11px] text-slate-400">
                  ช่วงเทอม: {semesterStartDate || '—'} ถึง {semesterEndDate || '—'}
                </p>
              )}
            </div>
          </div>

          <DrawerFooter className="flex-row gap-2">
            {(draft || currentStartDate) && (
              <button
                type="button"
                disabled={isSaving}
                onClick={() => void handleClearAndSave()}
                className="h-11 flex-1 rounded-xl border border-rose-200 bg-rose-50 text-[13px] font-black text-rose-600 transition-colors hover:bg-rose-100 disabled:opacity-60"
              >
                ใช้วันเริ่มเทอม
              </button>
            )}
            <button
              type="button"
              disabled={isSaving}
              onClick={() => void handleSave()}
              className="h-11 flex-1 rounded-xl bg-slate-900 text-[13px] font-black text-white shadow-md transition-colors hover:bg-slate-800 disabled:opacity-60"
            >
              {isSaving ? 'กำลังบันทึก...' : 'บันทึก'}
            </button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  );
}
