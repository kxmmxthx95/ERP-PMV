import { useState } from 'react';
import {
  HiChatBubbleLeftRight,
  HiClipboardDocument,
  HiExclamationCircle,
  HiCheck,
  HiArrowTopRightOnSquare,
} from 'react-icons/hi2';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const LINE_OA_ID_RAW = (import.meta.env.VITE_LINE_OA_ID || '@pmv-one').trim();
const LINE_OA_ID = LINE_OA_ID_RAW.startsWith('@') ? LINE_OA_ID_RAW : `@${LINE_OA_ID_RAW}`;
const LINK_KEYWORD = 'PMV';
const DEFAULT_LINE_ADD_FRIEND_URL = 'https://lin.ee/QKGIt0J';
const LINE_ADD_FRIEND_URL =
  (import.meta.env.VITE_LINE_ADD_FRIEND_URL || '').trim() || DEFAULT_LINE_ADD_FRIEND_URL;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function LineConnectDialog({ open, onOpenChange }: Props) {
  const [copiedKeyword, setCopiedKeyword] = useState(false);

  function handleCopyKeyword() {
    navigator.clipboard.writeText(LINK_KEYWORD).then(() => {
      setCopiedKeyword(true);
      setTimeout(() => setCopiedKeyword(false), 1800);
    });
  }

  function openLineAddFriend() {
    window.open(LINE_ADD_FRIEND_URL, '_blank', 'noopener,noreferrer');
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-black text-slate-900">เชื่อมต่อ LINE</DialogTitle>
          <DialogDescription className="text-xs font-medium text-slate-500">
            เชื่อมผ่าน LINE Official Account เพื่อรับการแจ้งเตือนจากระบบ PMV
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-2xl bg-slate-50 px-4 py-3">
          <div className="flex items-center gap-2 text-amber-700">
            <HiExclamationCircle className="h-4 w-4 shrink-0" />
            <p className="text-sm font-black">ยังไม่ได้เชื่อมบัญชี LINE</p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="rounded-2xl border border-[#06c755]/30 bg-[#06c755]/5 p-4 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
            <p className="text-xs font-black text-slate-700">
              1. เพิ่มเพื่อน LINE OA: <span className="font-mono">{LINE_OA_ID}</span>
            </p>
            <button
              type="button"
              onClick={openLineAddFriend}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#06c755] px-3 py-1.5 text-xs font-black text-white hover:bg-[#05b84d] flex-shrink-0"
            >
              <HiChatBubbleLeftRight className="h-3 w-3" />
              เพิ่มเพื่อน
              <HiArrowTopRightOnSquare className="h-3 w-3 opacity-80" />
            </button>
          </div>

          <div className="rounded-2xl border border-violet-100 bg-violet-50 p-4">
            <p className="text-xs font-black text-slate-700 mb-2">2. พิมพ์ข้อความนี้ในแชต LINE OA</p>
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-violet-200 bg-white px-3 py-3">
              <span className="flex-1 min-w-0 break-all font-mono text-base font-black tracking-[0.2em] text-violet-700">
                {LINK_KEYWORD}
              </span>
              <button
                type="button"
                onClick={handleCopyKeyword}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-black',
                  copiedKeyword
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-violet-100 text-violet-700 hover:bg-violet-200',
                )}
              >
                {copiedKeyword ? <HiCheck className="h-3 w-3" /> : <HiClipboardDocument className="h-3 w-3" />}
                {copiedKeyword ? 'คัดลอกแล้ว' : 'คัดลอก'}
              </button>
            </div>
            <p className="mt-2 text-[11px] text-slate-500">ระบบจะส่งลิงก์ยืนยันอัตโนมัติกลับมาในแชต LINE</p>
          </div>

          <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 space-y-2">
            <p className="text-xs font-black text-slate-700">3. กดลิงก์ยืนยันที่บอทส่งมา แล้วล็อกอินบัญชีโรงเรียน</p>
            <p className="text-[12px] text-blue-700">
              หลังยืนยันสำเร็จ ระบบจะเชื่อมบัญชี LINE ให้อัตโนมัติทันที
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
