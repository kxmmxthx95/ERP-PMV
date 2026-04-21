import { X } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogHeader } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

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
  submitLabel = 'บันทึก',
  submitDisabled = false,
  onDelete,
  deleteLabel = 'ลบ',
  children,
  maxWidth = 'md',
  footerNote,
}: FormModalProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className={`${maxWMap[maxWidth]} rounded-3xl border-0 p-0 overflow-hidden`}
        style={{
          background: 'rgba(255,255,255,0.98)',
          backdropFilter: 'blur(32px)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.16)',
        }}
      >
        <DialogHeader className="px-5 py-3.5 border-b border-black/[0.04] flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-2.5">
            {icon && (
              <div className="w-8 h-8 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600">
                {icon}
              </div>
            )}
            <div>
              <DialogTitle className="text-sm font-bold text-black/80">{title}</DialogTitle>
              {subtitle ? (
                <DialogDescription className="text-[10px] text-black/40 font-medium">{subtitle}</DialogDescription>
              ) : (
                <DialogDescription className="sr-only">
                  คำอธิบายสำหรับฟอร์ม {title}
                </DialogDescription>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-5 h-5 rounded-lg flex items-center justify-center text-red-500 hover:bg-red-50 transition-colors flex-shrink-0"
          >
            <X size={14} />
          </button>
        </DialogHeader>

        {/* Content */}
        <div className="px-5 py-1.5 space-y-2 max-h-[75vh] overflow-y-auto custom-scrollbar">
          {children}
        </div>

        {/* Footer */}
        <div className={`px-5 pb-4 pt-3 border-t border-black/[0.04] ${footerNote ? 'flex items-center justify-between gap-4' : 'flex items-center justify-between gap-2'}`}>
          <div className="flex items-center gap-2">
            {footerNote && <div className="text-[10px] font-medium text-red-500 flex-shrink-0">{footerNote}</div>}
            {onDelete && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onDelete}
                className="text-red-500 hover:text-red-600 hover:bg-red-50 text-[11px] h-8 rounded-lg"
              >
                {deleteLabel}
              </Button>
            )}
          </div>
          <Button
            size="sm"
            onClick={onSubmit}
            disabled={submitDisabled}
            className="text-[11px] h-8 rounded-lg bg-blue-500 hover:bg-blue-600 text-white disabled:opacity-40 px-6"
          >
            {submitLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
