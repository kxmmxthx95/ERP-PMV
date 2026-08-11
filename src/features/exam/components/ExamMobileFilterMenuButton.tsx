import type { ReactNode } from 'react';
import { HiOutlineFunnel, HiXMark } from 'react-icons/hi2';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { HEADER_ICON_BTN } from '@/lib/headerIconBtn';
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
      className={cn(HEADER_ICON_BTN, 'pointer-events-auto', className)}
      title={title}
      aria-label={title}
    >
      <HiOutlineFunnel size={16} />
      {hasActiveFilters && (
        <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-destructive" aria-hidden />
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
  'h-dvh max-h-none p-0 before:inset-0 before:rounded-none',
  'data-[vaul-drawer-direction=right]:w-screen data-[vaul-drawer-direction=right]:max-w-none',
  'data-[vaul-drawer-direction=left]:w-screen data-[vaul-drawer-direction=left]:max-w-none',
  'sm:data-[vaul-drawer-direction=right]:w-full sm:data-[vaul-drawer-direction=right]:max-w-md',
  'sm:data-[vaul-drawer-direction=right]:p-2 sm:data-[vaul-drawer-direction=right]:before:inset-2 sm:data-[vaul-drawer-direction=right]:before:rounded-4xl',
  'sm:data-[vaul-drawer-direction=left]:w-full sm:data-[vaul-drawer-direction=left]:max-w-md',
  'sm:data-[vaul-drawer-direction=left]:p-2 sm:data-[vaul-drawer-direction=left]:before:inset-2 sm:data-[vaul-drawer-direction=left]:before:rounded-4xl',
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
          'font-sukhumvit',
          isSide
            ? cn(SIDE_DRAWER_CONTENT_CLASS, 'pb-[max(0.5rem,env(safe-area-inset-bottom))]')
            : 'pb-[max(1rem,env(safe-area-inset-bottom))]',
          contentClassName,
        )}
      >
        <DrawerHeader
          className={cn(
            isSide ? 'px-3 pt-3 pb-2 text-left' : 'text-center',
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div className={cn('min-w-0 flex-1', !isSide && 'text-center')}>
              <DrawerTitle className="text-base font-black text-slate-900">{title}</DrawerTitle>
              {description && (
                <DrawerDescription className="text-xs text-slate-500">{description}</DrawerDescription>
              )}
            </div>
            <DrawerClose asChild>
              <button
                type="button"
                className={HEADER_ICON_BTN}
                title="หุบ"
                aria-label="หุบ"
              >
                <HiXMark size={16} />
              </button>
            </DrawerClose>
          </div>
        </DrawerHeader>
        <div
          className={cn(
            isSide ? 'flex-1 space-y-4 overflow-y-auto px-3' : 'space-y-5 px-4',
          )}
        >
          {children}
        </div>
        {footer && (
          <DrawerFooter className={cn('flex-row gap-2', isSide && 'px-3 pt-2 pb-3')}>
            {footer}
          </DrawerFooter>
        )}
      </DrawerContent>
    </Drawer>
  );
}

export function ExamFilterShowResultsButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      type="button"
      onClick={onClick}
      className="h-11 min-w-0 flex-1 basis-0 shrink rounded-xl text-[13px] font-black"
    >
      แสดงผล
    </Button>
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
