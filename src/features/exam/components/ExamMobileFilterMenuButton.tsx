import type { ReactNode } from 'react';
import { HiOutlineFunnel } from 'react-icons/hi2';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { cn } from '@/lib/utils';
import type { Department } from '@/types/curriculum';

export const EXAM_DEPT_FILTER_OPTIONS = [
  { id: 'all' as const, label: 'ทั้งหมด' },
  { id: 'early' as const, label: 'ปฐมวัย' },
  { id: 'primary' as const, label: 'ประถม' },
  { id: 'secondary' as const, label: 'มัธยม' },
] satisfies ReadonlyArray<{ id: Department | 'all'; label: string }>;

type TriggerProps = {
  onClick: () => void;
  title?: string;
  hasActiveFilters?: boolean;
  className?: string;
};

export function ExamMobileFilterTriggerButton({
  onClick,
  title = 'ตัวกรอง',
  hasActiveFilters = false,
  className,
}: TriggerProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'pointer-events-auto relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition-colors hover:bg-slate-50',
        className,
      )}
      title={title}
      aria-label={title}
    >
      <HiOutlineFunnel className="h-4 w-4" />
      {hasActiveFilters && (
        <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-rose-500" aria-hidden />
      )}
    </button>
  );
}

type DrawerDirection = 'bottom' | 'right' | 'left' | 'top';

type DrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  direction?: DrawerDirection;
  contentClassName?: string;
};

const SIDE_DRAWER_CONTENT_CLASS = cn(
  'h-dvh max-h-none',
  'data-[vaul-drawer-direction=right]:w-screen data-[vaul-drawer-direction=right]:max-w-none',
  'data-[vaul-drawer-direction=right]:before:inset-0 data-[vaul-drawer-direction=right]:before:rounded-none',
  'data-[vaul-drawer-direction=left]:w-screen data-[vaul-drawer-direction=left]:max-w-none',
  'data-[vaul-drawer-direction=left]:before:inset-0 data-[vaul-drawer-direction=left]:before:rounded-none',
  'sm:data-[vaul-drawer-direction=right]:w-full sm:data-[vaul-drawer-direction=right]:max-w-md',
  'sm:data-[vaul-drawer-direction=right]:before:inset-2 sm:data-[vaul-drawer-direction=right]:before:rounded-4xl',
  'sm:data-[vaul-drawer-direction=left]:w-full sm:data-[vaul-drawer-direction=left]:max-w-md',
  'sm:data-[vaul-drawer-direction=left]:before:inset-2 sm:data-[vaul-drawer-direction=left]:before:rounded-4xl',
  'sm:p-2',
);

export function ExamMobileFilterDrawer({
  open,
  onOpenChange,
  title = 'ตัวกรอง',
  description,
  children,
  footer,
  direction = 'bottom',
  contentClassName,
}: DrawerProps) {
  const isSide = direction === 'right' || direction === 'left';

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction={direction}>
      <DrawerContent
        className={cn(
          'font-sukhumvit pb-[max(1rem,env(safe-area-inset-bottom))]',
          isSide && SIDE_DRAWER_CONTENT_CLASS,
          contentClassName,
        )}
      >
        <DrawerHeader className={isSide ? 'text-left' : 'text-center'}>
          <DrawerTitle className="text-base font-black text-slate-900">{title}</DrawerTitle>
          {description && (
            <DrawerDescription className="text-xs text-slate-500">{description}</DrawerDescription>
          )}
        </DrawerHeader>
        <div className={cn('space-y-5 px-4', isSide && 'flex-1 overflow-y-auto')}>{children}</div>
        {footer && <DrawerFooter className="flex-row gap-2">{footer}</DrawerFooter>}
      </DrawerContent>
    </Drawer>
  );
}

export function ExamFilterShowResultsButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-11 flex-1 rounded-xl bg-slate-900 text-[13px] font-black text-white shadow-md transition-colors hover:bg-slate-800"
    >
      แสดงผล
    </button>
  );
}

type MenuProps = TriggerProps & DrawerProps & {
  open: boolean;
};

export default function ExamMobileFilterMenuButton({
  open,
  onOpenChange,
  onClick,
  title = 'ตัวกรอง',
  description,
  hasActiveFilters = false,
  children,
  footer,
  className,
}: MenuProps & { children: ReactNode }) {
  return (
    <>
      <ExamMobileFilterTriggerButton
        onClick={onClick}
        title={title}
        hasActiveFilters={hasActiveFilters}
        className={className}
      />
      <ExamMobileFilterDrawer
        open={open}
        onOpenChange={onOpenChange}
        title={title}
        description={description}
        footer={footer}
      >
        {children}
      </ExamMobileFilterDrawer>
    </>
  );
}
