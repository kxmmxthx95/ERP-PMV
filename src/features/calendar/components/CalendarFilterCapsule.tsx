import { motion } from 'framer-motion';
import { Search, Plus } from 'lucide-react';

interface CalendarFilterCapsuleProps {
  filterDept: string;
  onDeptChange: (val: string) => void;
  departments: any[];
  deptIdMap: Record<string, string>;
  searchQuery: string;
  onSearchChange: (val: string) => void;
  onAddEvent: () => void;
}

export default function CalendarFilterCapsule({
  filterDept,
  onDeptChange,
  departments,
  deptIdMap,
  searchQuery,
  onSearchChange,
  onAddEvent,
}: CalendarFilterCapsuleProps) {
  
  const allDepts = [
    { id: 'all', label: 'ทั้งหมด' },
    ...departments
  ];

  return (
    <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-1.5 px-2.5 py-2 rounded-full shadow-2xl"
        style={{
          background: 'rgba(255,255,255,0.8)',
          backdropFilter: 'blur(24px) saturate(200%)',
          WebkitBackdropFilter: 'blur(24px) saturate(200%)',
          border: '1px solid rgba(255,255,255,0.9)',
          boxShadow: '0 12px 40px rgba(0,0,0,0.15)',
        }}
      >
        {/* Search Input in Capsule */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/5 mr-1">
          <Search size={14} className="text-slate-400 flex-shrink-0" />
          <input
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="ค้นหา..."
            className="bg-transparent text-[11px] text-slate-700 placeholder:text-slate-400 outline-none w-28 font-sarabun"
          />
        </div>

        <div className="w-px h-5 bg-black/10 mx-1" />

        {/* Department filter pills */}
        <div className="flex items-center gap-1">
          {allDepts.map((dept) => {
            const val = deptIdMap[dept.id] ?? dept.id;
            const isActive = filterDept === val;

            return (
              <button
                key={dept.id}
                onClick={() => onDeptChange(val)}
                className={`px-3.5 py-1.5 rounded-full text-[11px] font-bold transition-all font-sukhumvit whitespace-nowrap ${
                  isActive 
                    ? 'bg-slate-900 text-white shadow-md' 
                    : 'text-slate-500 hover:bg-black/5'
                }`}
              >
                {dept.label}
              </button>
            );
          })}
        </div>

        <div className="w-px h-5 bg-black/10 mx-1" />

        {/* Add Event Button */}
        <motion.button
          onClick={onAddEvent}
          whileHover={{ scale: 1.1, backgroundColor: 'rgba(0,0,0,0.05)' }}
          whileTap={{ scale: 0.9 }}
          className="flex items-center justify-center w-8 h-8 rounded-full text-slate-600 transition-colors"
          title="เพิ่มกิจกรรม"
        >
          <Plus size={16} />
        </motion.button>
      </motion.div>
    </div>
  );
}
