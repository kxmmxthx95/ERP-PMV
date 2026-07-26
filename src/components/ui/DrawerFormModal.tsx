import React from 'react';
import { Drawer, DrawerContent, DrawerHeader, DrawerFooter } from '@/components/ui/drawer';
import { Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { DRAWER_HEADER_ICON_BTN, DRAWER_HEADER_RIGHT_ACTIONS } from '@/lib/drawerHeaderBtn';

interface DrawerFormModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  onSubmit: () => void;
  submitLabel?: string;
  submitDisabled?: boolean;
  submitClassName?: string;
  onDelete?: () => void;
  deleteLabel?: string;
  children: React.ReactNode;
  footerNote?: React.ReactNode;
  direction?: 'left' | 'right' | 'top' | 'bottom';
}

const DRAWER_CONTENT_CLASS = cn(
  'flex h-dvh max-h-dvh flex-col overflow-hidden bg-transparent p-0 before:hidden z-50 outline-none focus:outline-none',
  'data-[vaul-drawer-direction=right]:w-screen data-[vaul-drawer-direction=right]:max-w-none',
  'sm:h-full sm:max-h-full sm:p-2',
  'sm:data-[vaul-drawer-direction=right]:w-full sm:data-[vaul-drawer-direction=right]:max-w-md',
);

const DRAWER_PANEL_CLASS = cn(
  'flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-white',
  'sm:rounded-4xl sm:border sm:border-border sm:shadow-xl',
);

export default function DrawerFormModal({
  open,
  onClose,
  title,
  subtitle,
  icon,
  onSubmit,
  submitLabel = 'Done',
  submitDisabled = false,
  submitClassName,
  onDelete,
  deleteLabel = 'ลบข้อมูล',
  children,
  footerNote,
  direction = 'bottom',
}: DrawerFormModalProps) {
  return (
    <Drawer open={open} onOpenChange={(v) => !v && onClose()} direction={direction}>
      <DrawerContent className={DRAWER_CONTENT_CLASS}>
        <div className={DRAWER_PANEL_CLASS}>
          {/* ── Header ── */}
          <DrawerHeader className="shrink-0 py-4 border-b border-border bg-slate-50/50 backdrop-blur-xs px-4 sm:px-6">
            <div className="relative flex min-h-12 items-center justify-between">
              <div className="flex items-center gap-3 pr-8">
                {icon && (
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-blue-500/10 text-blue-600">
                    {icon}
                  </div>
                )}
                <div className="min-w-0 flex-1 text-left">
                  <h1 className="truncate text-[18px] sm:text-xl font-black font-sukhumvit text-slate-800">
                    {title}
                  </h1>
                  {subtitle && (
                    <p className="mt-0.5 text-xs font-bold text-slate-500 font-sukhumvit">
                      {subtitle}
                    </p>
                  )}
                </div>
              </div>
              <div className={DRAWER_HEADER_RIGHT_ACTIONS}>
                <button
                  type="button"
                  onClick={onClose}
                  className={DRAWER_HEADER_ICON_BTN}
                  aria-label="ปิด"
                >
                  ✕
                </button>
              </div>
            </div>
          </DrawerHeader>

          {/* ── Scrollable Content ── */}
          <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="px-4 py-4 space-y-5 sm:px-6">
              {children}

              {footerNote && (
                <div className="mt-3 p-3 rounded-xl bg-blue-50/40 border border-blue-100/50">
                  <p className="text-[11px] font-bold text-blue-500/70 text-center">{footerNote}</p>
                </div>
              )}

              {onDelete && (
                <div className="pt-4">
                  <button
                    onClick={onDelete}
                    className="w-full flex items-center justify-center gap-2 h-10 rounded-xl text-sm font-bold text-rose-500 bg-rose-50/50 hover:bg-rose-50 transition-colors border border-rose-100/50"
                  >
                    <Trash2 size={16} />
                    {deleteLabel}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* ── Fixed Footer ── */}
          <DrawerFooter className="px-4 py-4 flex items-center justify-end gap-3 border-t border-border shrink-0 bg-white sm:px-6">
            <Button
              onClick={onSubmit}
              disabled={submitDisabled}
              className={cn(
                "h-10 rounded-xl font-bold text-sm w-full",
                submitClassName
              )}
            >
              {submitLabel}
            </Button>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
