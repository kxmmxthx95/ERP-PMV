import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import { Pencil, GripVertical, CalendarX } from 'lucide-react';
import { EVENT_TYPE_CONFIG, type CalendarEventType, type CalendarEvent } from '@/types/calendar';

interface EventStripProps {
  selectedDate: Date | null;
  events: CalendarEvent[];
  activeFilters: Set<CalendarEventType>;
  onEditEvent?: (event: CalendarEvent) => void;
}

const isEditable = (event: CalendarEvent) => !event.id.startsWith('gcal-') && !event.id.startsWith('api-');

export default function EventStrip({ selectedDate, events, activeFilters, onEditEvent }: EventStripProps) {
  const filtered = events.filter(e => activeFilters.has(e.type));

  return (
    <AnimatePresence>
      {selectedDate && !isNaN(selectedDate.getTime()) && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
          style={{ borderTop: '1px solid rgba(0,0,0,0.05)', overflow: 'hidden' }}
        >
          <div className="px-5 pt-4 pb-5">
            {/* Date label */}
            <div className="flex items-center gap-2.5 mb-4">
              <div
                className="w-1 h-5 rounded-full"
                style={{ background: 'linear-gradient(180deg, #7c3aed, #4f46e5)' }}
              />
              <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest font-sukhumvit">
                {format(selectedDate, 'd MMMM', { locale: th })} พ.ศ. {selectedDate.getFullYear() + 543}
              </p>
            </div>

            {filtered.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-4 text-slate-300">
                <CalendarX size={24} strokeWidth={1.5} />
                <p className="text-[11px] font-medium font-sarabun">ไม่มีกิจกรรมในวันนี้</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filtered.map((ev, i) => {
                  const cfg = EVENT_TYPE_CONFIG[ev.type];
                  const editable = isEditable(ev);
                  return (
                    <motion.div
                      key={ev.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04 }}
                      draggable={editable}
                      onDragStart={(e: any) => {
                        if (!editable) return;
                        e.dataTransfer.setData('text/plain', ev.id);
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-150 ${editable ? 'cursor-grab active:cursor-grabbing hover:shadow-md' : ''}`}
                      style={{
                        background: cfg.bg,
                        border: `1px solid ${cfg.border}`,
                      }}
                    >
                      {editable && (
                        <GripVertical size={13} className="text-slate-300 flex-shrink-0" />
                      )}

                      <span
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{
                          background: cfg.color,
                          boxShadow: `0 0 8px ${cfg.glow}`,
                        }}
                      />

                      <div className="min-w-0 flex-1">
                        <p className="text-[12px] font-bold text-slate-700 truncate font-sukhumvit">{ev.title}</p>
                        {ev.description && (
                          <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-1 font-sarabun">{ev.description}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span
                          className="text-[9px] font-black px-2.5 py-1 rounded-full font-sukhumvit"
                          style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}
                        >
                          {cfg.label}
                        </span>

                        {editable && onEditEvent && (
                          <motion.button
                            onClick={() => onEditEvent(ev)}
                            whileHover={{ scale: 1.12 }}
                            whileTap={{ scale: 0.88 }}
                            className="w-7 h-7 rounded-full flex items-center justify-center transition-all duration-150"
                            style={{
                              background: 'rgba(15,23,42,0.06)',
                              color: 'rgba(15,23,42,0.40)',
                            }}
                            title="แก้ไขกิจกรรม"
                          >
                            <Pencil size={10} />
                          </motion.button>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
