import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, Wrench, CheckCircle2, ChevronRight } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useVisibleFeedbackTimeline } from '@/hooks/useStudentFeedback';
import { WIDGET_GLASS } from '../widgetStyles';

const CATEGORY_LABEL: Record<string, string> = {
  academic: 'วิชาการ',
  facilities: 'อาคารสถานที่',
  cafeteria: 'โรงอาหาร',
  general: 'ทั่วไป',
};

export default function FeedbackStatusWidget() {
  const navigate = useNavigate();
  const { role } = useAuth();
  const { items, loading } = useVisibleFeedbackTimeline(role ?? undefined);

  const stats = useMemo(() => {
    const inProgress = items.filter((i) => i.status === 'in_progress').length;
    const resolved = items.filter((i) => i.status === 'resolved').length;
    const latest = items.slice(0, 3);
    return { inProgress, resolved, latest };
  }, [items]);

  return (
    <div
      style={WIDGET_GLASS}
      className="rounded-3xl p-5 flex flex-col gap-3 cursor-pointer group w-full"
      onClick={() => navigate('/portal/feedback')}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center">
            <MessageSquare size={14} />
          </div>
          <span className="font-bold text-sm text-slate-700">PMV Voice</span>
        </div>
        <ChevronRight size={14} className="text-slate-400 group-hover:text-slate-600 transition-colors" />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-2.5">
          <div className="text-[10px] text-amber-700 font-bold flex items-center gap-1">
            <Wrench size={11} />
            กำลังแก้ไข
          </div>
          <p className="text-lg font-black text-amber-800">{loading ? '...' : stats.inProgress}</p>
        </div>
        <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-2.5">
          <div className="text-[10px] text-emerald-700 font-bold flex items-center gap-1">
            <CheckCircle2 size={11} />
            เสร็จสิ้น
          </div>
          <p className="text-lg font-black text-emerald-800">{loading ? '...' : stats.resolved}</p>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        {loading && <p className="text-[11px] text-slate-400 font-medium">กำลังโหลด...</p>}
        {!loading && stats.latest.length === 0 && (
          <p className="text-[11px] text-slate-400 font-medium">ยังไม่มีรายการอัปเดต</p>
        )}
        {!loading && stats.latest.map((item) => (
          <div key={item.id} className="rounded-xl border border-slate-100 bg-white/70 px-3 py-2">
            <p className="text-[11px] font-bold text-slate-700 line-clamp-1">{item.message}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">
              {CATEGORY_LABEL[item.category] ?? 'ทั่วไป'}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
