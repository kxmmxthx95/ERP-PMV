import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, CalendarX, ArrowLeft, SlidersHorizontal } from 'lucide-react';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { EVENT_TYPE_CONFIG, type CalendarEvent, type CalendarEventType } from '@/types/calendar';
import { glassCard, cardAnim } from '../constants';
import UpcomingEventItem from './UpcomingEventItem';

interface UpcomingPanelProps {
  upcomingEvents: CalendarEvent[];
  activeFilters: Set<CalendarEventType>;
  selectedDate: Date | null;
  selectedEvents: CalendarEvent[];
  onClearSelection?: () => void;
  filterType: string;
  onTypeChange: (val: string) => void;
  allTypes: CalendarEventType[];
  onEditEvent?: (event: CalendarEvent) => void;
  onDeleteEvent?: (id: string) => void;
}

export default function UpcomingPanel({ 
  upcomingEvents, 
  activeFilters,
  selectedDate,
  selectedEvents,
  onClearSelection,
  filterType,
  onTypeChange,
  allTypes,
  onEditEvent,
  onDeleteEvent
}: UpcomingPanelProps) {
  const [currentPage, setCurrentPage] = useState(0);
  const itemsPerPage = 5;
  
  const isSelected = selectedDate && !isNaN(selectedDate.getTime());
  const displayEvents = isSelected ? selectedEvents : upcomingEvents;
  
  // Apply type filter logic here too if needed, but it's already handled by activeFilters in AcademicCalendar.
  // However, the Select will update filterType which updates activeFilters.
  const filtered = displayEvents.filter(e => activeFilters.has(e.type));
  
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginatedEvents = filtered.slice(currentPage * itemsPerPage, (currentPage + 1) * itemsPerPage);

  useEffect(() => {
    setCurrentPage(0);
  }, [isSelected, activeFilters]);

  const title = isSelected 
    ? `${format(selectedDate, 'd MMMM', { locale: th })} พ.ศ. ${selectedDate.getFullYear() + 543}`
    : 'กิจกรรมที่กำลังมาถึง';

  const subtitle = isSelected 
    ? `${filtered.length} กิจกรรมในวันนี้`
    : `${filtered.length} กิจกรรมทั้งหมด`;

  return (
    <motion.div variants={cardAnim} className="flex flex-col gap-3">
      {/* Main card */}
      <div
        className="rounded-[2rem] overflow-hidden flex-1 flex flex-col min-h-[480px]"
        style={glassCard}
      >
        {/* Header */}
        <div
          className="flex items-center gap-3 px-5 py-4"
          style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}
        >
          {isSelected ? (
            <motion.button
              whileHover={{ scale: 1.1, backgroundColor: 'rgba(0,0,0,0.05)' }}
              whileTap={{ scale: 0.9 }}
              onClick={onClearSelection}
              className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-slate-400 transition-colors"
            >
              <ArrowLeft size={16} />
            </motion.button>
          ) : (
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{
                background: 'rgba(15,23,42,0.08)',
                border: '1px solid rgba(15,23,42,0.14)',
              }}
            >
              <Sparkles size={14} className="text-slate-800" />
            </div>
          )}
          
          <div className="flex-1 min-w-0">
            <h2 className="text-[12px] font-black text-slate-700 font-sukhumvit truncate">{title}</h2>
            <p className="text-[10px] text-slate-400 font-sarabun mt-0.5">{subtitle}</p>
          </div>

          {/* Type Filter Select */}
          <div className="flex-shrink-0">
            <Select value={filterType} onValueChange={onTypeChange}>
              <SelectTrigger className="flex items-center gap-2 h-8 px-3 rounded-full bg-slate-50 border-slate-100 hover:bg-slate-100 transition-colors text-[10px] font-bold text-slate-600 font-sukhumvit shadow-none focus:ring-0">
                <SlidersHorizontal size={10} className="text-slate-400" />
                <SelectValue placeholder="ประเภท" />
              </SelectTrigger>
              <SelectContent 
                className="rounded-2xl p-1.5"
                style={{
                  background: 'rgba(255,255,255,0.98)',
                  backdropFilter: 'blur(20px)',
                  boxShadow: '0 10px 30px rgba(0,0,0,0.1)'
                }}
              >
                <SelectItem value="all" className="text-[10px] font-bold rounded-xl font-sukhumvit">กิจกรรมทั้งหมด</SelectItem>
                {allTypes.map((t) => (
                  <SelectItem key={t} value={t} className="text-[10px] font-bold rounded-xl font-sukhumvit">
                    {EVENT_TYPE_CONFIG[t]?.label ?? t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* List */}
        <div className="flex-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={`${isSelected ? 'selected' : 'upcoming'}-${currentPage}`}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.2}
              onDragEnd={(_, info) => {
                const swipeThreshold = 50;
                if (info.offset.x < -swipeThreshold && currentPage < totalPages - 1) {
                  setCurrentPage(prev => prev + 1);
                } else if (info.offset.x > swipeThreshold && currentPage > 0) {
                  setCurrentPage(prev => prev - 1);
                }
              }}
              className="cursor-grab active:cursor-grabbing"
            >
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-14 gap-2 text-slate-300">
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center mb-1"
                    style={{ background: 'rgba(0,0,0,0.03)' }}
                  >
                    {isSelected ? <CalendarX size={24} strokeWidth={1.5} /> : <Sparkles size={24} strokeWidth={1.5} />}
                  </div>
                  <p className="text-[11px] font-medium font-sarabun">
                    {isSelected ? 'ไม่มีกิจกรรมในวันนี้' : 'ไม่มีกิจกรรมที่กำลังจะมาถึง'}
                  </p>
                </div>
              ) : (
                <div className="divide-y" style={{ borderColor: 'rgba(0,0,0,0.04)' }}>
                  {paginatedEvents.map((ev, i) => (
                    <UpcomingEventItem 
                      key={ev.id} 
                      event={ev} 
                      index={i} 
                      onClick={onEditEvent}
                      onDelete={onDeleteEvent}
                    />
                  ))}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-2 py-6 px-5" style={{ borderTop: '1px solid rgba(0,0,0,0.03)' }}>
            {Array.from({ length: totalPages }).map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentPage(i)}
                className={`w-2 h-2 rounded-full transition-all duration-300 ${
                  currentPage === i 
                    ? 'bg-slate-800 w-6 shadow-sm' 
                    : 'bg-slate-200 hover:bg-slate-300'
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
