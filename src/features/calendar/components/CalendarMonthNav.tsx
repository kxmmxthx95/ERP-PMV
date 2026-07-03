import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { toBuddhistYear } from '../utils';

interface CalendarMonthNavProps {
  currentMonth: Date;
  onPrev: () => void;
  onNext: () => void;
  onGoToToday?: () => void;
}

export default function CalendarMonthNav({ currentMonth, onPrev, onNext, onGoToToday }: CalendarMonthNavProps) {
  const isNotCurrentMonth = 
    currentMonth.getFullYear() !== new Date().getFullYear() || 
    currentMonth.getMonth() !== new Date().getMonth();

  return (
    <div
      className="flex items-center justify-between px-6 py-4"
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

      <div className="flex flex-col items-center min-h-[46px] justify-center">
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

        {isNotCurrentMonth && onGoToToday && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onGoToToday}
            className="text-[9px] font-black text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-2.5 py-0.5 rounded-full transition-all border border-blue-100/50 mt-1 font-sukhumvit"
          >
            กลับสู่วันนี้
          </motion.button>
        )}
      </div>

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
