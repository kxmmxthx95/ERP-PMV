import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { WIDGET_CARD, WIDGET_GLASS } from '../widgetStyles';

export type WidgetSkeletonVariant = 'default' | 'profile' | 'list' | 'wide' | 'staff';

interface WidgetSkeletonProps {
  className?: string;
  variant?: WidgetSkeletonVariant;
}

export function WidgetSkeleton({ className, variant = 'default' }: WidgetSkeletonProps) {
  if (variant === 'profile') {
    return (
      <div style={WIDGET_GLASS} className={cn(WIDGET_CARD, className)}>
        <div className="flex shrink-0 items-center gap-2">
          <Skeleton className="h-9 w-9 shrink-0 rounded-xl bg-slate-200" />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Skeleton className="h-3.5 w-[75%] rounded-lg bg-slate-200" />
            <Skeleton className="h-3 w-1/2 rounded-lg bg-slate-100" />
          </div>
        </div>
        <div className="mt-auto flex flex-col gap-1.5">
          <Skeleton className="h-3 w-full rounded-lg bg-slate-100" />
          <Skeleton className="h-3 w-2/3 rounded-lg bg-slate-100" />
        </div>
      </div>
    );
  }

  if (variant === 'staff') {
    return (
      <div
        style={WIDGET_GLASS}
        className={cn('rounded-2xl flex w-full h-[142px] overflow-hidden relative p-0 pl-3', className)}
      >
        <div className="flex min-w-0 flex-1 flex-col justify-between py-3 pr-2">
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-3.5 w-[55%] rounded-lg bg-slate-200" />
            <Skeleton className="h-5 w-[40%] rounded-lg bg-slate-200" />
            <Skeleton className="h-3 w-[70%] rounded-lg bg-slate-100" />
          </div>
          <div className="flex items-center gap-1.5">
            <Skeleton className="h-8 w-8 shrink-0 rounded-full bg-slate-100" />
            <Skeleton className="h-8 w-8 shrink-0 rounded-full bg-slate-100" />
            <Skeleton className="h-8 w-8 shrink-0 rounded-full bg-slate-50" />
          </div>
        </div>
        <Skeleton className="h-full w-[34%] max-w-[92px] shrink-0 rounded-none rounded-r-2xl bg-slate-100" />
      </div>
    );
  }

  if (variant === 'list') {
    return (
      <div style={WIDGET_GLASS} className={cn(WIDGET_CARD, className)}>
        <Skeleton className="h-4 w-2/3 shrink-0 rounded-lg bg-slate-200" />
        <div className="flex min-h-0 flex-1 flex-col justify-center gap-2">
          <Skeleton className="h-3.5 w-full rounded-lg bg-slate-100" />
          <Skeleton className="h-3 w-[85%] rounded-lg bg-slate-100" />
          <Skeleton className="h-3 w-[65%] rounded-lg bg-slate-50" />
        </div>
      </div>
    );
  }

  if (variant === 'wide') {
    return (
      <div style={WIDGET_GLASS} className={cn(WIDGET_CARD, className)}>
        <Skeleton className="h-4 w-2/3 shrink-0 rounded-lg bg-slate-200" />
        <Skeleton className="min-h-0 flex-1 rounded-xl bg-slate-100" />
      </div>
    );
  }

  return (
    <div style={WIDGET_GLASS} className={cn(WIDGET_CARD, className)}>
      <div className="flex shrink-0 items-center justify-between">
        <Skeleton className="h-4 w-2/3 rounded-lg bg-slate-200" />
        <Skeleton className="h-3 w-3 shrink-0 rounded-full bg-slate-100" />
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-3 gap-2">
        <Skeleton className="rounded-lg bg-slate-100" />
        <Skeleton className="rounded-lg bg-slate-100" />
        <Skeleton className="rounded-lg bg-slate-100" />
      </div>
      <Skeleton className="h-8 w-full shrink-0 rounded-full bg-slate-100" />
    </div>
  );
}

const DASHBOARD_SKELETON_VARIANTS: WidgetSkeletonVariant[] = ['default', 'list', 'profile', 'default', 'wide', 'default', 'list', 'default'];

export function DashboardWidgetsSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-4 min-w-0">
      <div className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: count }, (_, index) => (
          <WidgetSkeleton
            key={index}
            variant={DASHBOARD_SKELETON_VARIANTS[index % DASHBOARD_SKELETON_VARIANTS.length]}
          />
        ))}
      </div>
    </div>
  );
}

export function MenuPageSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-3 lg:gap-8 lg:px-4 lg:py-6">
      {[0, 1].map((section) => (
        <div key={section} className="flex flex-col gap-3 lg:gap-3.5">
          <div className="flex flex-col gap-0.5">
            <Skeleton className="h-3.5 w-36 rounded-lg bg-muted lg:h-4 lg:w-48" />
            <Skeleton className="h-2.5 w-28 rounded-lg bg-muted/60 lg:h-3 lg:w-36" />
          </div>
          <div className="grid grid-cols-4 justify-items-center gap-x-4 gap-y-6 lg:grid-cols-6 lg:justify-items-stretch lg:gap-4 xl:grid-cols-8">
            {Array.from({ length: 8 }, (_, index) => (
              <div key={index} className="flex flex-col items-center gap-1 lg:items-stretch lg:gap-2">
                <Skeleton className="h-[58px] w-[58px] rounded-[14px] bg-muted lg:aspect-square lg:h-auto lg:w-full lg:rounded-2xl" />
                <Skeleton className="h-[26px] w-12 rounded-lg bg-muted/60 lg:hidden" />
                <Skeleton className="hidden h-3 w-3/4 rounded-lg bg-muted/60 lg:block" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
