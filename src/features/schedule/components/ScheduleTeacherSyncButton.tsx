import { useState } from 'react';
import { HiArrowPath } from 'react-icons/hi2';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { TeacherSyncUpdate } from '@/features/schedule/utils/syncScheduleTeachers';

interface ScheduleTeacherSyncButtonProps {
  pendingUpdates: TeacherSyncUpdate[];
  isSyncing: boolean;
  onSync: () => Promise<{ updated: number }>;
  classLabel?: string;
  iconOnly?: boolean;
  disabled?: boolean;
  disabledReason?: string;
}

export default function ScheduleTeacherSyncButton({
  pendingUpdates,
  isSyncing,
  onSync,
  classLabel,
  iconOnly = false,
  disabled = false,
  disabledReason,
}: ScheduleTeacherSyncButtonProps) {
  const [open, setOpen] = useState(false);
  const pendingCount = pendingUpdates.length;
  const hasPending = pendingCount > 0;
  const isDisabled = disabled || isSyncing;

  const handleClick = () => {
    if (isDisabled) return;
    if (!hasPending) {
      toast.info('ครูผู้สอนในตารางตรงกับระบบจัดการห้องเรียนแล้ว');
      return;
    }
    setOpen(true);
  };

  const handleConfirm = async () => {
    try {
      const result = await onSync();
      setOpen(false);
      if (result.updated > 0) {
        toast.success(`อัปเดตครูผู้สอน ${result.updated} คาบเรียนแล้ว`);
      } else {
        toast.info('ไม่พบคาบที่ต้องอัปเดต — ตรวจสอบว่าเลือกห้องและภาคเรียนตรงกับที่แก้ในระบบจัดการห้องเรียน');
      }
    } catch (error) {
      console.error('Schedule teacher sync failed:', error);
      toast.error(error instanceof Error ? error.message : 'อัปเดตครูผู้สอนไม่สำเร็จ');
    }
  };

  const preview = pendingUpdates.slice(0, 6);
  const remaining = pendingCount - preview.length;

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={isDisabled}
        title={
          disabledReason
            ?? (hasPending
              ? `อัปเดตครูผู้สอน ${pendingCount} คาบจากระบบจัดการห้องเรียน`
              : 'อัปเดตครูผู้สอนจากระบบจัดการห้องเรียน')
        }
        className={cn(
          'relative flex items-center justify-center font-black transition-all shrink-0',
          iconOnly
            ? 'h-9 w-9 rounded-full border border-black/[0.07] bg-white/70 text-amber-600 hover:bg-amber-50 disabled:opacity-40'
            : 'h-7 gap-1 rounded-full px-2.5 text-[10px] border border-amber-200/80 bg-amber-50 text-amber-700 hover:bg-amber-100 disabled:opacity-40',
          hasPending && !isDisabled && (iconOnly ? 'border-amber-300 bg-amber-50' : 'bg-amber-500 text-white border-amber-500 hover:bg-amber-600'),
        )}
      >
        <HiArrowPath className={cn('shrink-0', iconOnly ? 'w-4 h-4' : 'w-3.5 h-3.5', isSyncing && 'animate-spin')} />
        {!iconOnly && <span>อัปเดต</span>}
        {hasPending && (
          <span
            className={cn(
              'font-black leading-none',
              iconOnly
                ? 'absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-[9px] flex items-center justify-center'
                : 'min-w-[16px] h-4 px-1 rounded-full bg-white/25 text-[9px] flex items-center justify-center',
            )}
          >
            {pendingCount}
          </span>
        )}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogTitle className="text-lg font-black text-slate-800">
            อัปเดตครูผู้สอนในตาราง?
          </DialogTitle>
          <DialogDescription className="text-[13px] text-slate-500 leading-relaxed">
            {classLabel
              ? `พบ ${pendingCount} คาบในห้อง ${classLabel} ที่ครูผู้สอนไม่ตรงกับที่กำหนดในระบบจัดการห้องเรียน`
              : `พบ ${pendingCount} คาบที่ครูผู้สอนไม่ตรงกับที่กำหนดในระบบจัดการห้องเรียน`}
          </DialogDescription>

          <div className="mt-2 max-h-52 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50/80 divide-y divide-slate-100">
            {preview.map((item) => (
              <div key={item.entryId} className="px-3 py-2.5">
                <p className="text-[12px] font-bold text-slate-800 truncate">
                  {item.subjectCode ? `${item.subjectCode} ` : ''}{item.subjectName}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                  {item.oldTeacherName || '—'} → {item.newTeacherName}
                </p>
              </div>
            ))}
            {remaining > 0 && (
              <p className="px-3 py-2 text-[11px] font-medium text-slate-400">
                และอีก {remaining} คาบ
              </p>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isSyncing}>
              ยกเลิก
            </Button>
            <Button type="button" onClick={handleConfirm} disabled={isSyncing}>
              {isSyncing ? 'กำลังอัปเดต...' : 'อัปเดตตาราง'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
