import React from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Trash2, ChevronRight, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FormModalProps {
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
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  footerNote?: React.ReactNode;
  showCancel?: boolean;
}

const maxWMap = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
};

export default function FormModal({
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
  maxWidth = 'md',
  footerNote,
  showCancel = true,
}: FormModalProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          maxWMap[maxWidth],
          "w-[92vw] rounded-[2rem] sm:rounded-[2.5rem] border-none p-0 shadow-2xl overflow-hidden"
        )}
        style={{
          background: 'rgba(255,255,255,0.7)',
          backdropFilter: 'blur(24px) saturate(180%)',
          WebkitBackdropFilter: 'blur(24px) saturate(180%)'
        }}
      >
        {/* Visually hidden accessibility title */}
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <DialogDescription className="sr-only">{subtitle || title}</DialogDescription>

        <div className="flex flex-col min-h-0 max-h-[90vh]">
          {/* ── Header ── */}
          <div className="px-5 sm:px-6 pt-6 sm:pt-7 pb-2 sm:pb-3 shrink-0 flex justify-between items-start bg-transparent">
            <div className="space-y-1 pr-6">
              <div className="flex items-center gap-3">
                {icon && (
                  <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-600">
                    {icon}
                  </div>
                )}
                <h1 className="text-lg sm:text-xl font-black text-slate-800 tracking-tight">
                  {title}
                </h1>
              </div>
              {subtitle && (
                <p className="text-sm font-bold text-slate-400">
                  {subtitle}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              type="button"
              className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100/50 active:scale-90 transition-all shrink-0 -mt-1 -mr-1"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>

          {/* ── Scrollable Content ── */}
          <div className="flex-1 overflow-y-auto px-5 sm:px-6 pt-2 pb-4 sm:pb-5 custom-scrollbar">
            <div className="space-y-6">
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
          <DialogFooter className="px-5 sm:px-6 py-4 sm:py-5 flex items-center justify-end gap-3 border-t border-slate-100/50 shrink-0 bg-transparent">
            {showCancel && (
              <button
                onClick={onClose}
                className="px-4 h-10 rounded-xl text-sm font-bold text-slate-500 hover:text-slate-700 transition-all"
              >
                ยกเลิก
              </button>
            )}
            <button
              onClick={onSubmit}
              disabled={submitDisabled}
              className={cn(
                "h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-sm shadow-lg shadow-slate-900/20 transition-all active:scale-95 disabled:opacity-50 disabled:bg-slate-200",
                showCancel ? "px-10" : "w-full",
                submitClassName
              )}
            >
              {submitLabel}
            </button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─────────────────────────────────────────────
   Helper sub-components for Apple Settings rows
───────────────────────────────────────────── */

/** Wraps a group of <SettingsRow> items in a white rounded card */
export function SettingsGroup({
  label,
  icon,
  children,
}: {
  label?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-8">
      {label && (
        <div className="flex items-center gap-2.5 px-6 mb-4">
          {icon}
          <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">
            {label}
          </p>
        </div>
      )}
      <div className="rounded-[2.5rem] overflow-hidden bg-white/50 border-2 border-slate-100/50 shadow-sm divide-y divide-slate-100/50 transition-all hover:border-slate-200/50">
        {children}
      </div>
    </div>
  );
}

/** A single row inside a SettingsGroup */
export function SettingsRow({
  label,
  children,
  required,
  noChevron = false,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
  noChevron?: boolean;
}) {
  return (
    <div className="flex items-center min-h-[56px] px-8 gap-4 group active:bg-slate-50/50 transition-all">
      <span className="text-[15px] font-bold text-slate-800 shrink-0 min-w-[120px]">
        {label}
        {required && <span className="text-rose-500 ml-1">*</span>}
      </span>
      <div className="flex-1 flex items-center justify-end gap-2 min-w-0">
        <div className="flex-1 flex justify-end min-w-0">
          {children}
        </div>
        {!noChevron && (
          <ChevronRight size={18} className="text-slate-300 group-hover:text-slate-400 group-hover:translate-x-0.5 transition-all shrink-0" />
        )}
      </div>
    </div>
  );
}

/** Shared input style for rows — right-aligned, no border */
export const settingsInputCls =
  'w-full text-[15px] text-right text-[#8e8e93] placeholder:text-[#c7c7cc] bg-transparent outline-none focus:outline-none font-medium truncate focus:text-black transition-colors';

/** Shared select style */
export const settingsSelectCls =
  'text-[15px] text-right text-[#8e8e93] bg-transparent outline-none focus:outline-none appearance-none cursor-pointer font-medium pr-1 focus:text-black transition-colors';

/** Shared textarea style */
export const settingsTextareaCls =
  'w-full text-[15px] text-right text-[#8e8e93] placeholder:text-[#c7c7cc] bg-transparent outline-none focus:outline-none font-medium focus:text-black transition-colors py-2 min-h-[60px] resize-none';

/** ─────────────────────────────────────────────
    Modern Grid-based Modal Styles
───────────────────────────────────────────── */

export const modalLabelCls =
  'text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] px-1 block mb-1';

export const modalInputCls =
  'w-full h-12 px-5 rounded-[1.25rem] bg-slate-50 border border-slate-100/50 text-sm font-bold text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-200 transition-all';

export const modalSelectCls =
  'w-full h-12 px-5 rounded-[1.25rem] bg-slate-50 border border-slate-100/50 text-sm font-bold text-slate-700 appearance-none focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-200 transition-all';
