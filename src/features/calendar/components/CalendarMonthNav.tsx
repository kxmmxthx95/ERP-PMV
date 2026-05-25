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
      className="flex items-center justify-between px-6 py-5"
      style={{ borderBottom: '1px solid rgba(0,0,0,0.04)' }}
    >
      <motion.button
        onClick={onPrev}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.92 }}
        className="w-9 h-9 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
        style={{
          background: 'rgba(0,0,0,0.04)',
          border: '1px solid rgba(0,0,0,0.05)',
        }}
        aria-label="เดือนก่อนหน้า"
      >
        <ChevronLeft size={15} />
      </motion.button>

      <motion.div
        key={currentMonth.toISOString()}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 24 }}
        className="text-center"
      >
        <h2 className="font-black text-slate-800 text-base tracking-tight font-sukhumvit">
          {toBuddhistYear(currentMonth)}
        </h2>
      </motion.div>

      <motion.button
        onClick={onNext}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.92 }}
        className="w-9 h-9 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
        style={{
          background: 'rgba(0,0,0,0.04)',
          border: '1px solid rgba(0,0,0,0.05)',
        }}
        aria-label="เดือนถัดไป"
      >
        <ChevronRight size={15} />
      </motion.button>
    </div>
  );
}
