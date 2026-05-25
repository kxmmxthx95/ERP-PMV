import { motion } from 'framer-motion';
import { parseISO, format } from 'date-fns';
import { th } from 'date-fns/locale';
import { Trash2 } from 'lucide-react';
import { EVENT_TYPE_CONFIG } from '@/types/calendar';
import type { CalendarEvent } from '@/types/calendar';
import { formatEventDateRange } from '../utils';
import { toast } from 'sonner';

interface UpcomingEventItemProps {
  event: CalendarEvent;
  index: number;
  onClick?: (event: CalendarEvent) => void;
  onDelete?: (id: string) => void;
}

const isEditable = (event: CalendarEvent) => !event.id.startsWith('api-');

export default function UpcomingEventItem({ event, index, onClick, onDelete }: UpcomingEventItemProps) {
  const cfg = EVENT_TYPE_CONFIG[event.type];
  const start = parseISO(event.startDate);
  const editable = isEditable(event);

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบกิจกรรม "${event.title}"?`)) {
      onDelete?.(event.id);
      toast.success('ลบกิจกรรมเรียบร้อยแล้ว');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04 }}
      className={`flex items-center gap-4 px-5 py-4 transition-colors ${editable ? 'cursor-pointer' : 'cursor-default'} hover:bg-black/[0.025] group`}
      onClick={() => editable && onClick?.(event)}
      draggable={editable}
      onDragStart={(e: any) => {
        if (!editable) return;
        e.dataTransfer.setData('text/plain', event.id);
        e.dataTransfer.effectAllowed = 'move';
      }}
    >
      {/* Date badge */}
      <div
        className="flex flex-col items-center justify-center w-14 h-14 rounded-2xl flex-shrink-0 transition-transform duration-200 group-hover:scale-105"
        style={{
          background: cfg.bg,
          border: `1.5px solid ${cfg.border}`,
          boxShadow: `0 4px 12px ${cfg.color}18`,
        }}
      >
        <span className="text-lg font-black leading-none font-sukhumvit" style={{ color: cfg.color }}>
          {start.getDate()}
        </span>
        <span className="text-[11px] font-bold font-sukhumvit mt-0.5 uppercase" style={{ color: cfg.color }}>
          {format(start, 'MMM', { locale: th })}
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-slate-700 truncate font-sukhumvit leading-snug">{event.title}</p>
        <p className="text-xs text-slate-400 mt-1 font-sarabun">
          {formatEventDateRange(event.startDate, event.endDate)}
        </p>
      </div>

      {/* Actions / Type badge */}
      <div className="flex items-center gap-2">
        {editable && (
          <button
            onClick={handleDelete}
            className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100 flex-shrink-0"
            title="ลบกิจกรรม"
          >
            <Trash2 size={16} />
          </button>
        )}
        <span
          className="flex-shrink-0 text-[11px] font-black px-3 py-1 rounded-full self-center font-sukhumvit"
          style={{
            background: cfg.bg,
            color: cfg.color,
            border: `1px solid ${cfg.border}`,
          }}
        >
          {cfg.label}
        </span>
      </div>
    </motion.div>
  );
}
