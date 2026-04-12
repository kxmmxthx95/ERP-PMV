import { motion } from 'framer-motion';
import { CalendarDays } from 'lucide-react';
import type { CalendarEvent, CalendarEventType } from '@/types/calendar';
import { glassCard, cardAnim } from '../constants';
import UpcomingEventItem from './UpcomingEventItem';
import EventLegend from './EventLegend';

interface UpcomingPanelProps {
  upcomingEvents: CalendarEvent[];
  activeFilters: Set<CalendarEventType>;
}

export default function UpcomingPanel({ upcomingEvents, activeFilters }: UpcomingPanelProps) {
  const filtered = upcomingEvents.filter(e => activeFilters.has(e.type));

  return (
    <motion.div variants={cardAnim} className="flex flex-col gap-4">
      {/* Upcoming list */}
      <div className="rounded-3xl overflow-hidden flex-1" style={glassCard}>
        <div
          className="flex items-center gap-2 px-5 py-4"
          style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}
        >
          <CalendarDays size={16} className="text-black/30" />
          <h2 className="font-bold text-black/75 text-sm">กิจกรรมที่กำลังจะมาถึง</h2>
        </div>

        <div className="overflow-y-auto" style={{ maxHeight: 460 }}>
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-black/25">
              <CalendarDays size={32} className="mb-2 opacity-40" />
              <p className="text-xs">ไม่มีกิจกรรม</p>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: 'rgba(0,0,0,0.05)' }}>
              {filtered.map(ev => (
                <UpcomingEventItem key={ev.id} event={ev} />
              ))}
            </div>
          )}
        </div>
      </div>

      <EventLegend />
    </motion.div>
  );
}
