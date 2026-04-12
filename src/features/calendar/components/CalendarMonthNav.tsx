import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { toBuddhistYear } from '../utils';

interface CalendarMonthNavProps {
  currentMonth: Date;
  onPrev: () => void;
  onNext: () => void;
}

export default function CalendarMonthNav({ currentMonth, onPrev, onNext }: CalendarMonthNavProps) {
  return (
    <div
      className="flex items-center justify-between px-6 py-4"
      style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}
    >
      <button
        onClick={onPrev}
        className="w-8 h-8 rounded-full flex items-center justify-center text-black/40 hover:bg-black/06 transition-colors"
        aria-label="เดือนก่อนหน้า"
      >
        <ChevronLeft size={18} />
      </button>

      <motion.h2
        key={currentMonth.toISOString()}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        className="font-bold text-black/75 text-sm tracking-wide"
      >
        {toBuddhistYear(currentMonth)}
      </motion.h2>

      <button
        onClick={onNext}
        className="w-8 h-8 rounded-full flex items-center justify-center text-black/40 hover:bg-black/06 transition-colors"
        aria-label="เดือนถัดไป"
      >
        <ChevronRight size={18} />
      </button>
    </div>
  );
}
