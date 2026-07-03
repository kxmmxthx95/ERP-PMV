import { useMemo } from 'react';
import { HiOutlineXMark } from 'react-icons/hi2';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { FuturePlanSummaryPanel } from '@/features/futurePlan/components/FuturePlanSummaryPanel';
import StudentAvatar from '@/features/students/components/StudentAvatar';
import type { FuturePlanFormData, StudentFuturePlan } from '@/types/futurePlan';
import { cn } from '@/lib/utils';

const DRAWER_CONTENT_CLASS = cn(
  'h-dvh flex flex-col p-0 rounded-none',
  'data-[vaul-drawer-direction=right]:w-screen data-[vaul-drawer-direction=right]:max-w-none',
  'data-[vaul-drawer-direction=right]:before:inset-0 data-[vaul-drawer-direction=right]:before:rounded-none',
  'sm:h-full sm:rounded-l-3xl',
  'sm:data-[vaul-drawer-direction=right]:w-full sm:data-[vaul-drawer-direction=right]:max-w-md',
  'sm:data-[vaul-drawer-direction=right]:before:inset-2 sm:data-[vaul-drawer-direction=right]:before:rounded-4xl',
);

function formatUpdatedAt(iso: string | undefined): string | undefined {
  if (!iso) return undefined;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
}

function planToFormData(plan: StudentFuturePlan): FuturePlanFormData {
  return {
    lifeGoal: plan.lifeGoal ?? '',
    desiredCareer: plan.desiredCareer ?? '',
    planType: plan.planType,
    studyLocation: plan.studyLocation ?? 'domestic',
    notContinueReason: plan.notContinueReason ?? '',
    universityChoices: plan.universityChoices ?? [],
  };
}

export function FuturePlanAdminDetailDrawer({
  plan,
  open,
  onOpenChange,
}: {
  plan: StudentFuturePlan | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const form = useMemo(() => (plan ? planToFormData(plan) : null), [plan]);
  const updatedLabel = plan ? formatUpdatedAt(plan.updatedAt) : undefined;
  const metaParts = plan
    ? [plan.className, plan.gradeLevel, plan.studentCode ? `รหัส ${plan.studentCode}` : null].filter(Boolean)
    : [];

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="right">
      <DrawerContent className={DRAWER_CONTENT_CLASS}>
        {plan && form && (
          <>
            <DrawerHeader className="shrink-0 px-4 pb-3 pt-4">
              <div className="relative flex min-h-10 items-center justify-center">
                <div className="min-w-0 px-12 text-center">
                  <DrawerTitle className="truncate text-base font-black text-slate-900">
                    {plan.studentName}
                  </DrawerTitle>
                  <DrawerDescription className="truncate text-xs text-slate-500">
                    {metaParts.length > 0 ? metaParts.join(' · ') : 'รายละเอียดแผนการศึกษาต่อ'}
                  </DrawerDescription>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  className="absolute right-0 top-1/2 inline-flex size-9 -translate-y-1/2 items-center justify-center rounded-full border border-[#E3E7FC] bg-white text-slate-500 transition hover:bg-slate-100/80 hover:text-slate-700 active:scale-[0.98]"
                  aria-label="ปิด"
                >
                  <HiOutlineXMark className="size-5" />
                </button>
              </div>

              <div className="mt-3 flex items-center gap-3 rounded-2xl border border-slate-200/70 bg-slate-50/80 p-3">
                <StudentAvatar
                  photoURL={plan.photoURL}
                  studentId={plan.studentId}
                  name={plan.studentName}
                  gender={plan.gender}
                  className="size-12 shrink-0 rounded-xl border-2 border-white shadow-sm"
                />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900">{plan.studentName}</p>
                  <p className="text-xs text-slate-500">
                    {plan.studentCode ? `รหัส ${plan.studentCode}` : 'ไม่มีรหัสนักเรียน'}
                  </p>
                </div>
              </div>
            </DrawerHeader>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
              <FuturePlanSummaryPanel
                form={form}
                lastUpdatedLabel={updatedLabel ? `บันทึกล่าสุด ${updatedLabel}` : undefined}
              />
            </div>
          </>
        )}
      </DrawerContent>
    </Drawer>
  );
}
