import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, ChevronRight, Pin, X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useAnnouncements } from '@/hooks/useAnnouncements';
import { WIDGET_CARD, WIDGET_GLASS } from '../widgetStyles';
import { WidgetSkeleton } from '../components/WidgetSkeleton';
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

  const top1 = useMemo(() => announcements.slice(0, 1), [announcements]);

  if (loading) return <WidgetSkeleton variant="list" />;

  return (
    <>
      <div
        style={WIDGET_GLASS}
        className={`${WIDGET_CARD} cursor-pointer group`}
        onClick={() => navigate('/portal/announcements')}
      >
        <div className="flex items-center justify-between shrink-0">
          <span className="font-bold text-sm text-slate-700 truncate">ประกาศข่าวสาร</span>
          <ChevronRight size={14} className="text-slate-400 group-hover:text-slate-600 transition-colors shrink-0" />
        </div>

        <div className="flex flex-col flex-1 min-h-0 justify-center overflow-hidden">
          {top1.length === 0 && (
            <p className="text-center text-[11px] text-slate-400 font-bold">
              ยังไม่มีประกาศ
            </p>
          )}

          {top1.map((a) => (
            <div
              key={a.id}
              className="min-w-0 p-1 -mx-1 rounded-xl hover:bg-white/50 transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedAnnouncement(a);
              }}
            >
              <p className="text-xs font-semibold text-slate-700 leading-snug line-clamp-2">{a.title}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">{formatDate(a.createdAt)}</p>
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
