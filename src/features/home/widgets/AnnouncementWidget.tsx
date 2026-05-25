import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, ChevronRight, Pin, X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useAnnouncements } from '@/hooks/useAnnouncements';
import { WIDGET_GLASS } from '../widgetStyles';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';

function formatDate(ts: unknown): string {
  const sec = (ts as { seconds?: number } | undefined)?.seconds;
  if (!sec) return 'ไม่ระบุเวลา';
  return new Date(sec * 1000).toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function AnnouncementWidget() {
  const navigate = useNavigate();
  const { role } = useAuth();
  const { announcements, loading } = useAnnouncements(role ?? undefined);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<any>(null);

  const top3 = useMemo(() => announcements.slice(0, 3), [announcements]);

  return (
    <>
      <div
        style={WIDGET_GLASS}
        className="rounded-3xl p-5 flex flex-col gap-3 cursor-pointer group w-full"
        onClick={() => navigate('/portal/announcements')}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center">
              <Bell size={14} />
            </div>
            <span className="font-bold text-sm text-slate-700">ประกาศข่าวสาร</span>
          </div>
          <ChevronRight size={14} className="text-slate-400 group-hover:text-slate-600 transition-colors" />
        </div>

        <div className="flex flex-col gap-2">
          {loading && (
            <div className="py-3 flex items-center justify-center">
              <div className="w-5 h-5 border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
            </div>
          )}

          {!loading && top3.length === 0 && (
            <div className="py-3 text-center text-[11px] text-slate-400 font-bold">
              ยังไม่มีประกาศ
            </div>
          )}

          {!loading && top3.map((a) => (
            <div 
              key={a.id} 
              className="flex items-start justify-between gap-2 p-1.5 -mx-1.5 rounded-xl hover:bg-white/50 transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedAnnouncement(a);
              }}
            >
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-semibold text-slate-700 leading-snug break-words">{a.title}</span>
                <span className="text-[10px] text-slate-400">{formatDate(a.createdAt)}</span>
              </div>
              {a.isPinned && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-600 shrink-0 inline-flex items-center gap-1">
                  <Pin size={9} />
                  ปักหมุด
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      <Dialog open={!!selectedAnnouncement} onOpenChange={(open) => !open && setSelectedAnnouncement(null)}>
        <DialogContent showCloseButton={false} className="sm:max-w-md p-0 overflow-hidden rounded-[2.5rem] border-none shadow-2xl font-sukhumvit">
          <DialogTitle className="sr-only">{selectedAnnouncement?.title}</DialogTitle>
          <DialogDescription className="sr-only">รายละเอียดประกาศ</DialogDescription>
          
          <div className="p-8 space-y-6">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                    <Bell size={16} />
                  </div>
                  <span className="text-[10px] font-black text-amber-600/70 uppercase tracking-widest">ประกาศข่าวสาร</span>
                </div>
                <h2 className="text-xl font-black text-slate-800 leading-tight pt-2">
                  {selectedAnnouncement?.title}
                </h2>
                <p className="text-[11px] font-bold text-slate-400">
                  {formatDate(selectedAnnouncement?.createdAt)}
                </p>
              </div>
              <button 
                onClick={() => setSelectedAnnouncement(null)}
                className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="bg-slate-50/50 rounded-3xl p-6 border border-slate-100">
              <p className="text-[15px] text-slate-600 leading-relaxed font-medium whitespace-pre-wrap">
                {selectedAnnouncement?.content || 'ไม่มีรายละเอียดเพิ่มเติม'}
              </p>
            </div>

            {selectedAnnouncement?.isPinned && (
              <div className="flex items-center gap-2 px-1">
                <Pin size={12} className="text-blue-500" />
                <span className="text-[11px] font-bold text-blue-500/80">ประกาศนี้ถูกปักหมุดไว้ที่หน้าหลัก</span>
              </div>
            )}
          </div>

          <div className="px-8 py-5 bg-slate-50 border-t border-slate-100 flex justify-end">
            <button
              onClick={() => setSelectedAnnouncement(null)}
              className="px-6 h-11 rounded-2xl bg-slate-900 text-white text-sm font-black shadow-lg shadow-slate-900/20 active:scale-95 transition-all"
            >
              รับทราบ
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
