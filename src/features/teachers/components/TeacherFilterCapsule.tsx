import { motion } from 'framer-motion';
import { Plus, Search, X, ChevronDown } from 'lucide-react';

interface TeacherFilterCapsuleProps {
  departments: string[];
  selectedDept: string;
  onDepartmentChange: (dept: string) => void;
  onAdd: () => void;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  isSearchMode: boolean;
  onSearchModeChange: (active: boolean) => void;
}

const DEPT_LABEL: Record<string, string> = {
  'ทั้งหมด': 'All',
  'SECONDARY': 'มัธยม',
  'PRIMARY': 'ประถม',
  'EARLY': 'ปฐมวัย',
  'PRESCHOOL': 'ปฐมวัย',
  'KINDERGARTEN': 'ปฐมวัย',
  'ACADEMIC': 'วิชาการ',
  'ADMIN': 'บริหารงานทั่วไป',
  'STUDENT_AFFAIRS': 'กิจการนักเรียน',
};

function formatDept(dept: string) {
  return DEPT_LABEL[dept?.toUpperCase()] || dept || '';
}

export default function TeacherFilterCapsule({
  departments,
  selectedDept,
  onDepartmentChange,
  onAdd,
  searchTerm,
  onSearchChange,
  isSearchMode,
  onSearchModeChange
}: TeacherFilterCapsuleProps) {
  return (
    <div className="flex items-center justify-center w-full min-w-0">
      <motion.div
        layout
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className={`flex items-center gap-1.5 h-10 p-1.5 rounded-full pointer-events-auto transition-all duration-300 ${
          isSearchMode
            ? 'bg-blue-50/90 shadow-md border border-blue-100'
            : 'bg-white/60 backdrop-blur-xl border border-white shadow-[0_8px_32px_rgba(0,0,0,0.04)]'
        }`}
      >
        {isSearchMode ? (
          <motion.div
            key="search-active"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="flex items-center gap-2 px-2.5 w-full sm:w-[320px] h-full"
          >
            <Search size={15} className="text-slate-400 flex-shrink-0" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="ค้นหาชื่อหรือตำแหน่ง..."
              autoFocus
              className="bg-transparent text-xs font-bold text-slate-800 placeholder:text-slate-400 outline-none w-full font-sarabun"
            />
            <button
              onClick={() => {
                onSearchChange('');
                onSearchModeChange(false);
              }}
              className="flex items-center justify-center w-6 h-6 rounded-full text-slate-400 hover:text-slate-600 hover:bg-black/5 transition-all flex-shrink-0 cursor-pointer"
              title="ปิดการค้นหา"
            >
              <X size={14} />
            </button>
          </motion.div>
        ) : (
          <div className="flex items-center gap-1.5 w-full min-w-0 px-0.5">
            {/* Department Dropdown Selection */}
            <div className="relative flex items-center shrink-0">
              <select
                value={selectedDept}
                onChange={(e) => onDepartmentChange(e.target.value)}
                className="appearance-none bg-white hover:bg-slate-50 text-[11px] font-black text-slate-700 pl-4 pr-8 py-1.5 rounded-full border border-black/[0.05] shadow-xs focus:outline-none transition-all cursor-pointer font-sukhumvit"
              >
                {departments.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept === 'ทั้งหมด' ? 'All' : formatDept(dept) || dept}
                  </option>
                ))}
              </select>
              <ChevronDown size={11} className="absolute right-3 text-slate-400 pointer-events-none stroke-[3.5]" />
            </div>

            <div className="w-px h-4 bg-black/10 mx-1 shrink-0" />

            {/* Add Button */}
            <button
              onClick={onAdd}
              className="flex items-center justify-center w-8 h-8 rounded-full text-slate-600 hover:bg-black/5 hover:text-slate-900 transition-all active:scale-90 flex-shrink-0 cursor-pointer"
              title="เพิ่มครู"
            >
              <Plus size={16} />
            </button>

            <div className="w-px h-4 bg-black/10 mx-1 shrink-0" />

            {/* Search Toggle Button */}
            <button
              onClick={() => onSearchModeChange(true)}
              className="flex items-center justify-center w-8 h-8 rounded-full text-slate-600 hover:bg-black/5 hover:text-slate-900 transition-all active:scale-90 flex-shrink-0 cursor-pointer"
              title="ค้นหาครู"
            >
              <Search size={16} />
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
