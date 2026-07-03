import { useState } from 'react';
import { HiOutlineStar } from 'react-icons/hi2';
import { useActiveAcademicYear } from '@/hooks/useActiveAcademicYear';
import BehaviorScoreQuickDrawer from '@/features/behavior/components/BehaviorScoreQuickDrawer';
import { cn } from '@/lib/utils';

export default function BehaviorScoreWidget() {
  const { year, isLoaded } = useActiveAcademicYear();
  const [drawerOpen, setDrawerOpen] = useState(false);

  if (!isLoaded || !year) return null;

  return (
    <>
      <div
        className={cn(
          'relative h-[142px] w-full overflow-hidden rounded-3xl',
          'bg-gradient-to-r from-blue-800 via-blue-600 to-blue-400',
          'shadow-[0_8px_24px_rgba(37,99,235,0.28)]',
        )}
      >
        <div
          className="pointer-events-none absolute -right-6 -top-8 h-32 w-32 rounded-full bg-white/10 blur-2xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -left-4 bottom-0 h-24 w-24 rounded-full bg-blue-400/20 blur-xl"
          aria-hidden
        />

        <div className="relative z-10 flex h-full items-center justify-between gap-3 px-5">
          <div className="flex min-w-0 flex-col gap-3">
            <p className="text-[15px] font-black leading-tight text-white drop-shadow-sm">
              คะแนนพฤติกรรม
            </p>
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="w-fit rounded-full bg-white px-4 py-2 text-[11px] font-black text-blue-600 shadow-md transition-all hover:bg-blue-50 active:scale-[0.97]"
            >
              บันทึกคะแนน
            </button>
          </div>

          <div className="pointer-events-none relative -mr-3 flex shrink-0 items-center justify-end">
            <HiOutlineStar
              className="h-[7.5rem] w-[7.5rem] rotate-12 text-white/90 drop-shadow-[0_4px_12px_rgba(0,0,0,0.15)]"
              strokeWidth={1.25}
              aria-hidden
            />
          </div>
        </div>
      </div>

      <BehaviorScoreQuickDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        academicYearId={year}
      />
    </>
  );
}
