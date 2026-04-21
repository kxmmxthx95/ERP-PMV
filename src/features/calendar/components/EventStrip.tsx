import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import { Pencil } from 'lucide-react';
import { EVENT_TYPE_CONFIG, type CalendarEventType, type CalendarEvent } from '@/types/calendar';

interface EventStripProps {
  selectedDate: Date | null;
  events: CalendarEvent[];
  activeFilters: Set<CalendarEventType>;
  onEditEvent?: (event: CalendarEvent) => void;
}

// Google Calendar holidays (id starts with "gcal-") are read-only
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
          transition={{ duration: 0.2, ease: 'easeInOut' }}
          style={{ borderTop: '1px solid rgba(0,0,0,0.06)', overflow: 'hidden' }}
        >
          <div className="px-6 py-4">
            <p className="text-xs font-bold text-black/40 mb-3 uppercase tracking-wider">
              {format(selectedDate, 'd MMMM', { locale: th })} {selectedDate.getFullYear() + 543}
            </p>

            {filtered.length === 0 ? (
              <p className="text-xs text-black/30 italic">ไม่มีกิจกรรมในวันนี้</p>
            ) : (
              <div className="space-y-2">
                {filtered.map(ev => {
                  const cfg = EVENT_TYPE_CONFIG[ev.type];
                  const editable = isEditable(ev);
                  return (
                    <div
                      key={ev.id}
                      draggable={editable}
                      onDragStart={(e: any) => {
                        if (!editable) return;
                        e.dataTransfer.setData('text/plain', ev.id);
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      className={`flex items-start gap-3 p-3 rounded-2xl ${editable ? 'cursor-grab active:cursor-grabbing' : ''}`}
                      style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}
                    >
                      <span
                        className="w-2 h-2 rounded-full mt-0.5 flex-shrink-0"
                        style={{ background: cfg.color, boxShadow: `0 0 6px ${cfg.glow}` }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-black/75 truncate">{ev.title}</p>
                        {ev.description && (
                          <p className="text-[11px] text-black/40 mt-0.5 line-clamp-2">{ev.description}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span
                          className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                          style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}
                        >
                          {cfg.label}
                        </span>

                        {editable && onEditEvent && (
                          <button
                            onClick={() => onEditEvent(ev)}
                            className="w-6 h-6 rounded-full flex items-center justify-center transition-all duration-150 hover:scale-110 active:scale-95"
                            style={{
                              background: 'rgba(0,0,0,0.06)',
                              color: 'rgba(0,0,0,0.40)',
                            }}
                            title="แก้ไขกิจกรรม"
                          >
                            <Pencil size={11} />
                          </button>
                        )}
                      </div>
                    </div>
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
