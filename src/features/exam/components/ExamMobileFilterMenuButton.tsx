import type { ReactNode } from 'react';
import { HiBars3 } from 'react-icons/hi2';
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
        hasActiveFilters && 'border-violet-200 bg-violet-50 text-violet-700',
        className,
      )}
      title={title}
      aria-label={title}
    >
      <HiBars3 className="h-4 w-4" />
      {hasActiveFilters && (
        <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-violet-500" aria-hidden />
      )}
    </button>
  );
}

type DrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
};

export function ExamMobileFilterDrawer({
  open,
  onOpenChange,
  title = 'ตัวกรอง',
  description,
  children,
  footer,
}: DrawerProps) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="bottom">
      <DrawerContent className="font-sukhumvit pb-[max(1rem,env(safe-area-inset-bottom))]">
        <DrawerHeader className="text-center">
          <DrawerTitle className="text-base font-black text-slate-900">{title}</DrawerTitle>
          {description && (
            <DrawerDescription className="text-xs text-slate-500">{description}</DrawerDescription>
          )}
        </DrawerHeader>
        <div className="space-y-5 px-4">{children}</div>
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
