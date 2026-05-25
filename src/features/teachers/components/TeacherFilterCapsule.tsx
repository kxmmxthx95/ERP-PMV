import { motion } from 'framer-motion';
import { Search } from 'lucide-react';

interface TeacherFilterCapsuleProps {
  filterDept: string;
  onDeptChange: (dept: string) => void;
  onGradeChange: (grade: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export default function TeacherFilterCapsule({
  filterDept,
  onDeptChange,
  onGradeChange,
  searchQuery,
  onSearchChange,
}: TeacherFilterCapsuleProps) {




  return (
    <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center">
      {/* Main Filter Capsule (Slim & High Density) */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-1 px-2 py-1.5 rounded-full shadow-2xl"
        style={{
          background: 'rgba(255,255,255,0.85)',
          backdropFilter: 'blur(24px) saturate(200%)',
          WebkitBackdropFilter: 'blur(24px) saturate(200%)',
          border: '1px solid rgba(255,255,255,0.9)',
          boxShadow: '0 12px 40px rgba(0,0,0,0.15)',
        }}
      >
        {/* Search Box in Capsule */}
        <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-black/5 mr-1 group focus-within:bg-white focus-within:shadow-inner transition-all">
          <Search size={14} className="text-slate-400 flex-shrink-0 group-focus-within:text-blue-500" />
          <input
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="ค้นหาชื่อ หรือ รหัส..."
            className="bg-transparent text-[11px] font-bold text-slate-700 placeholder:text-slate-400 outline-none w-44 font-sukhumvit"
          />
        </div>

        <div className="w-px h-5 bg-black/10 mx-1" />

        {/* Dept Selector (Pills) */}
        <div className="flex items-center gap-0.5">
          {[
            { id: 'all', label: 'ทุกแผนก' },
            { id: 'kindergarten', label: 'ปฐมวัย' },
            { id: 'primary', label: 'ประถม' },
            { id: 'secondary', label: 'มัธยม' },
          ].map((dept) => (
            <button
              key={dept.id}
              onClick={() => {
                onDeptChange(dept.id);
                onGradeChange('all');
              }}
              className={`px-4 py-1.5 rounded-full text-[11px] font-black transition-all ${
                filterDept === dept.id
                  ? 'bg-[#0f172a] text-white shadow-md'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-black/5'
              }`}
            >
              {dept.label}
            </button>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
