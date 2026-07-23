import { HiStar } from 'react-icons/hi2';
import { cn } from '@/lib/utils';
import type { TeachingOverview } from '@/types/microSyllabus';

const STAR_HINTS: Record<TeachingOverview, string> = {
  1: 'ต้องปรับปรุงมาก',
  2: 'ต้องปรับปรุง',
  3: 'ปานกลาง',
  4: 'ดี',
  5: 'ดีมาก',
};

interface TeachingStarRatingProps {
  value: TeachingOverview;
  onChange: (value: TeachingOverview) => void;
  label?: string;
  className?: string;
}

export function TeachingStarRating({
  value,
  onChange,
  label = 'ผลการสอน',
  className,
}: TeachingStarRatingProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[11px] font-black text-slate-600 font-sukhumvit">{label}</p>
        <p className="text-[11px] font-bold text-amber-600 font-sarabun">{STAR_HINTS[value]}</p>
      </div>
      <div className="flex items-center justify-between gap-1 rounded-xl border border-slate-200 bg-white px-2 py-2">
        {([1, 2, 3, 4, 5] as const).map((star) => {
          const active = star <= value;
          return (
            <button
              key={star}
              type="button"
              onClick={() => onChange(star)}
              className={cn(
                'flex h-10 flex-1 items-center justify-center rounded-lg transition-colors',
                active ? 'text-amber-400' : 'text-slate-200 hover:text-amber-200',
              )}
              aria-label={`${star} ดาว`}
              aria-pressed={active}
              title={STAR_HINTS[star]}
            >
              <HiStar className="h-7 w-7" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
