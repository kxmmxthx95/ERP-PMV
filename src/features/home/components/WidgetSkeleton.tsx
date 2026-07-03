import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { WIDGET_CARD, WIDGET_GLASS } from '../widgetStyles';

export type WidgetSkeletonVariant = 'default' | 'profile' | 'list' | 'wide';

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
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-6">
      {[0, 1].map((section) => (
        <div key={section} className="flex flex-col gap-3.5">
          <Skeleton className="h-4 w-56 rounded-lg bg-slate-200" />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
            {Array.from({ length: 8 }, (_, index) => (
              <div key={index} className="flex flex-col gap-2">
                <Skeleton className="aspect-square w-full rounded-2xl bg-slate-200" />
                <Skeleton className="h-3 w-3/4 rounded-lg bg-slate-100" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
