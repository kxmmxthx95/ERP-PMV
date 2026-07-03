import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { fpStatus, type FpStatusVariant } from '@/features/futurePlan/futurePlanTheme';

interface FuturePlanStatusBadgeProps {
  variant: FpStatusVariant;
  icon?: ReactNode;
  children: ReactNode;
  size?: 'sm' | 'md';
  className?: string;
}

export function FuturePlanStatusBadge({
  variant,
  icon,
  children,
  size = 'sm',
  className,
}: FuturePlanStatusBadgeProps) {
  const s = fpStatus[variant];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-bold whitespace-nowrap',
        size === 'sm' ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1.5 text-xs',
        s.bg,
        s.text,
        s.border,
        className,
      )}
    >
      {icon && <span className={cn('shrink-0 flex items-center', s.icon)}>{icon}</span>}
      {children}
    </span>
  );
}

interface FuturePlanRankBadgeProps {
  rank: number;
  className?: string;
}

export function FuturePlanRankBadge({ rank, className }: FuturePlanRankBadgeProps) {
  const variant =
    rank === 1 ? 'inReview' : rank === 2 ? 'inProgress' : rank === 3 ? 'submitted' : 'expired';
  const s = fpStatus[variant];
  return (
    <span
      className={cn(
        'inline-flex size-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-black',
        s.bg,
        s.text,
        s.border,
        className,
      )}
    >
      {rank}
    </span>
  );
}

/** Colored pill for selectable cards (plan type, study location) */
export function fpStatusCardClasses(variant: FpStatusVariant, active: boolean) {
  const s = fpStatus[variant];
  if (active) {
    return cn(
      'border-2 shadow-sm ring-2',
      s.border,
      s.bg,
      s.text,
      s.ring,
    );
  }
  return 'border-2 border-[#E3E7FC] bg-white/60 text-[#000000]/50 hover:border-[#2277FF]/40 hover:bg-white/90';
}
