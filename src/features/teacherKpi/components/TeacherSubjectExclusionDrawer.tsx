// src/features/teacherKpi/components/TeacherSubjectExclusionDrawer.tsx
import { useEffect, useState } from 'react';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { cn } from '@/lib/utils';
import { getKpiStatusColor } from '@/types/teacherKpi';
import type { TeacherKpiRow } from '@/types/teacherKpi';

const SIDE_DRAWER_CONTENT_CLASS = cn(
  'h-dvh max-h-none font-sukhumvit pb-[max(1rem,env(safe-area-inset-bottom))]',
  'data-[vaul-drawer-direction=right]:w-screen data-[vaul-drawer-direction=right]:max-w-none',
  'data-[vaul-drawer-direction=right]:before:inset-0 data-[vaul-drawer-direction=right]:before:rounded-none',
  'sm:data-[vaul-drawer-direction=right]:w-full sm:data-[vaul-drawer-direction=right]:max-w-md',
  'sm:data-[vaul-drawer-direction=right]:before:inset-2 sm:data-[vaul-drawer-direction=right]:before:rounded-4xl',
  'sm:p-2',
);

const RATE_STATUS_TEXT = {
  neutral: 'text-emerald-600',
  warning: 'text-amber-600',
  critical: 'text-rose-600',
} as const;

interface TeacherSubjectExclusionDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teacher: TeacherKpiRow | null;
  canEdit: boolean;
  onSave: (subjectIds: string[]) => Promise<void>;
}

export function TeacherSubjectExclusionDrawer({
  open,
  onOpenChange,
  teacher,
  canEdit,
  onSave,
}: TeacherSubjectExclusionDrawerProps) {
  const [draft, setDraft] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open && teacher) {
      setDraft(new Set(teacher.subjectBreakdown.filter((s) => s.excluded).map((s) => s.subjectId)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, teacher?.teacherId]);

  const toggleSubject = (subjectId: string) => {
    if (!canEdit) return;
    setDraft((prev) => {
      const next = new Set(prev);
      if (next.has(subjectId)) next.delete(subjectId);
      else next.add(subjectId);
      return next;
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(Array.from(draft));
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  const subjectBreakdown = teacher?.subjectBreakdown ?? [];

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="right">
      <DrawerContent className={SIDE_DRAWER_CONTENT_CLASS}>
        <DrawerHeader className="text-left">
          <DrawerTitle className="text-base font-black text-slate-900">
            รายวิชาที่ไม่นำมาคำนวณ KPI
          </DrawerTitle>
          <DrawerDescription className="text-xs text-slate-500">
            {teacher?.name ?? ''} — % เช็คชื่อแยกรายวิชา และเลือกวิชาที่ไม่ต้องการนำมารวม
          </DrawerDescription>
        </DrawerHeader>

        <div className="flex-1 space-y-2 overflow-y-auto px-4">
          {subjectBreakdown.length === 0 ? (
            <p className="py-8 text-center font-sarabun text-[13px] text-slate-400">
              ไม่พบรายวิชาในตารางสอนของครูคนนี้
            </p>
          ) : (
            subjectBreakdown.map((subject) => {
              const isExcluded = draft.has(subject.subjectId);
              const rateStatus = getKpiStatusColor(subject.rate);
              return (
                <button
                  key={subject.subjectId}
                  type="button"
                  disabled={!canEdit}
                  onClick={() => toggleSubject(subject.subjectId)}
                  className={cn(
                    'flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors',
                    isExcluded
                      ? 'border-rose-200 bg-rose-50/60'
                      : 'border-slate-200 bg-white hover:bg-slate-50',
                    !canEdit && 'cursor-not-allowed opacity-70',
                  )}
                >
                  <div className="min-w-0">
                    <p className="truncate font-sukhumvit text-[13px] font-bold text-slate-800">
                      {subject.subjectName}
                    </p>
                    <p className="font-sarabun text-[11px] text-slate-400">
                      {subject.subjectCode && <span>{subject.subjectCode} · </span>}
                      {subject.rate !== null ? (
                        <span className={cn('font-bold tabular-nums', RATE_STATUS_TEXT[rateStatus])}>
                          {subject.rate.toFixed(1)}%
                        </span>
                      ) : (
                        <span>ไม่มีคาบที่ควรสอน</span>
                      )}
                      {' '}({subject.completedSessions}/{subject.expectedSessions} คาบ)
                    </p>
                    <span
                      className={cn(
                        'mt-1 inline-block rounded-full px-2 py-0.5 font-sukhumvit text-[9px] font-black uppercase tracking-wide',
                        subject.inSchedule ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600',
                      )}
                    >
                      {subject.inSchedule ? 'อยู่ในตารางสอนแล้ว' : 'ยังไม่มีในตารางสอน'}
                    </span>
                  </div>
                  <span
                    className={cn(
                      'shrink-0 rounded-full px-2.5 py-1 font-sukhumvit text-[10px] font-black uppercase tracking-wide',
                      isExcluded ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-400',
                    )}
                  >
                    {isExcluded ? 'ไม่คำนวณ' : 'คำนวณ'}
                  </span>
                </button>
              );
            })
          )}
        </div>

        {canEdit && subjectBreakdown.length > 0 && (
          <DrawerFooter className="flex-row gap-2">
            <button
              type="button"
              disabled={isSaving}
              onClick={() => void handleSave()}
              className="h-11 flex-1 rounded-xl bg-slate-900 text-[13px] font-black text-white shadow-md transition-colors hover:bg-slate-800 disabled:opacity-60"
            >
              {isSaving ? 'กำลังบันทึก...' : 'บันทึก'}
            </button>
          </DrawerFooter>
        )}
      </DrawerContent>
    </Drawer>
  );
}
