import { motion, AnimatePresence } from 'framer-motion';
import { Search, RefreshCcw } from 'lucide-react';

interface StudentFilterCapsuleProps {
  filter: any;
  setFilter: (patch: any) => void;
  availableYears: string[];
  availableGrades: string[];
  availableClasses: any[];
  onAdd: () => void;
  onImport: () => void;
}

export default function StudentFilterCapsule({
  filter,
  setFilter,
}: StudentFilterCapsuleProps) {
  return (
    <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] flex flex-col items-center">
      <motion.div
        layout
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-2 px-2 py-1.5 rounded-full shadow-2xl"
        style={{
          background: 'rgba(255,255,255,0.85)',
          backdropFilter: 'blur(24px) saturate(200%)',
          WebkitBackdropFilter: 'blur(24px) saturate(200%)',
          border: '1px solid rgba(255,255,255,0.9)',
          boxShadow: '0 12px 40px rgba(0,0,0,0.15)',
        }}
      >
        {/* 1. Search Section */}
        <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-black/5 group focus-within:bg-white focus-within:shadow-inner transition-all">
          <Search size={14} className="text-slate-400 flex-shrink-0 group-focus-within:text-blue-500" />
          <input
            value={filter.searchText || ''}
            onChange={(e) => setFilter({ searchText: e.target.value })}
            placeholder="ค้นหา..."
            className="bg-transparent text-[11px] font-bold text-slate-700 placeholder:text-slate-400 outline-none w-24 font-sukhumvit"
          />
        </div>

        <div className="flex items-center gap-1.5 ml-1 flex-shrink-0">

          

          {/* Reset Button (Pink Circle) - Shows when filtering */}
          <AnimatePresence>
            {(filter.departmentId || filter.gradeLevel || filter.searchText) && (
              <motion.button
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5 }}
                onClick={() => setFilter({ departmentId: '', gradeLevel: '', classId: '', searchText: '' })}
                className="w-8 h-8 rounded-full bg-[#ff2d55] text-white flex items-center justify-center hover:bg-[#ff3b30] shadow-lg transition-all"
              >
                <RefreshCcw size={14} strokeWidth={3} />
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
