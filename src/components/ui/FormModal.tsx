import React from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
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
  onDelete?: () => void;
  deleteLabel?: string;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  footerNote?: React.ReactNode;
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
  onDelete,
  deleteLabel = 'ลบข้อมูล',
  children,
  maxWidth = 'md',
  footerNote,
}: FormModalProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          maxWMap[maxWidth],
          "rounded-[3.5rem] bg-white/90 backdrop-blur-2xl border-2 border-white/50 p-0 overflow-hidden font-sukhumvit focus:outline-none shadow-[0_32px_64px_-12px_rgba(0,0,0,0.14)]"
        )}
      >
        {/* Visually hidden accessibility title */}
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <DialogDescription className="sr-only">{subtitle || title}</DialogDescription>

        <div className="flex flex-col min-h-0 max-h-[90vh]">
          {/* ── Header ── */}
          <div className="px-10 pt-10 pb-4 shrink-0 flex items-start justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-3">
                {icon && (
                  <div className="w-10 h-10 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-600">
                    {icon}
                  </div>
                )}
                <h1 className="text-2xl font-black text-slate-800 tracking-tight leading-tight">
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
              className="w-12 h-12 rounded-full bg-slate-50/80 flex items-center justify-center text-slate-400 hover:bg-white hover:text-slate-600 transition-all border border-slate-100/50"
            >
              <X size={20} />
            </button>
          </div>

          {/* ── Scrollable Content ── */}
          <div className="flex-1 overflow-y-auto px-10 pt-2 pb-6 scrollbar-hide">
            <div className="space-y-6">
              {children}

              {footerNote && (
                <div className="mt-4 p-4 rounded-2xl bg-blue-50/30 border border-blue-100/50">
                  <p className="text-[12px] font-bold text-blue-500/70 text-center">{footerNote}</p>
                </div>
              )}

              {onDelete && (
                <div className="pt-4">
                  <button
                    onClick={onDelete}
                    className="w-full flex items-center justify-center gap-2 h-14 rounded-3xl text-sm font-black text-rose-500 bg-rose-50/50 hover:bg-rose-50 transition-colors border border-rose-100/50"
                  >
                    <Trash2 size={18} />
                    {deleteLabel}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* ── Fixed Footer ── */}
          <div className="px-10 py-6 bg-white/50 backdrop-blur-md flex items-center justify-end gap-4 border-t border-slate-100/50 shrink-0">
            <button
              onClick={onClose}
              className="px-6 h-12 rounded-2xl text-sm font-black text-slate-400 hover:text-slate-600 transition-all"
            >
              ยกเลิก
            </button>
            <button
              onClick={onSubmit}
              disabled={submitDisabled}
              className="px-8 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-black text-sm shadow-xl shadow-slate-900/10 transition-all active:scale-95 disabled:opacity-50 disabled:bg-slate-200 focus:outline-none"
            >
              {submitLabel}
            </button>
          </div>
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
