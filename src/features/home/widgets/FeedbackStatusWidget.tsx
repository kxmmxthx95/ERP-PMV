import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useVisibleFeedbackTimeline } from '@/hooks/useStudentFeedback';
import {
  WIDGET_CARD,
  WIDGET_GLASS,
  WIDGET_STAT_CELL,
  WIDGET_STAT_LABEL,
  WIDGET_STAT_VALUE,
} from '../widgetStyles';
import { WidgetSkeleton } from '../components/WidgetSkeleton';

export default function FeedbackStatusWidget() {
  const navigate = useNavigate();
  const { role } = useAuth();
  const { items, loading } = useVisibleFeedbackTimeline(role ?? undefined);

  const stats = useMemo(() => {
    const inProgress = items.filter((i) => i.status === 'in_progress').length;
    const resolved = items.filter((i) => i.status === 'resolved').length;
    const latest = items[0]?.message ?? '';
    return { inProgress, resolved, latest };
  }, [items]);

  if (loading) return <WidgetSkeleton />;

  return (
    <div
      style={WIDGET_GLASS}
      className={`${WIDGET_CARD} cursor-pointer group`}
      onClick={() => navigate('/portal/feedback')}
    >
      <div className="flex items-center justify-between shrink-0">
        <span className="font-bold text-sm text-slate-700 truncate">PMV Voice</span>
        <ChevronRight size={14} className="text-slate-400 group-hover:text-slate-600 transition-colors shrink-0" />
      </div>

      <div className="grid grid-cols-2 gap-2 flex-1 min-h-0">
        <div className={WIDGET_STAT_CELL}>
          <span className={`${WIDGET_STAT_VALUE} text-amber-600`}>
            {stats.inProgress}
          </span>
          <span className={WIDGET_STAT_LABEL}>กำลังแก้ไข</span>
        </div>
        <div className={WIDGET_STAT_CELL}>
          <span className={`${WIDGET_STAT_VALUE} text-emerald-600`}>
            {stats.resolved}
          </span>
          <span className={WIDGET_STAT_LABEL}>เสร็จสิ้น</span>
        </div>
      </div>

      <p className="mt-auto shrink-0 text-[10px] text-slate-400 font-medium line-clamp-1 min-h-[14px]">
        {stats.latest || 'ยังไม่มีรายการอัปเดต'}
      </p>
    </div>
  );
}
