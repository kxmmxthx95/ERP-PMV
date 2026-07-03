import { useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Plus, X, ChevronDown } from 'lucide-react';

interface CalendarFilterCapsuleProps {
  filterDept: string;
  onDeptChange: (val: string) => void;
  departments: any[];
  deptIdMap: Record<string, string>;
  searchQuery: string;
  onSearchChange: (val: string) => void;
  onAddEvent: () => void;
  isPortal?: boolean;
}

export default function CalendarFilterCapsule({
  filterDept,
  onDeptChange,
  departments,
  deptIdMap,
  searchQuery,
  onSearchChange,
  onAddEvent,
  isPortal = false,
}: CalendarFilterCapsuleProps) {
  const [isSearchMode, setIsSearchMode] = useState(false);

  const allDepts = [
    { id: 'all', label: 'All' },
    ...departments
  ];

  return (
    <div className={isPortal ? "flex items-center" : "fixed bottom-10 left-1/2 -translate-x-1/2 z-50"}>
      <motion.div
        initial={{ opacity: 0, y: isPortal ? -10 : 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`flex items-center gap-1.5 p-1 rounded-full pointer-events-auto ${
          isPortal
            ? 'h-10 bg-white/60 backdrop-blur-xl border border-white shadow-[0_8px_32px_rgba(0,0,0,0.04)]'
            : ''
        }`}
        style={isPortal ? {} : {
          background: 'rgba(255,255,255,0.8)',
          backdropFilter: 'blur(24px) saturate(200%)',
          WebkitBackdropFilter: 'blur(24px) saturate(200%)',
          border: '1px solid rgba(255,255,255,0.9)',
          boxShadow: '0 12px 40px rgba(0,0,0,0.15)',
        }}
      >
        {isSearchMode ? (
          <div className={`flex items-center gap-2 px-3 rounded-full bg-black/5 ${isPortal ? 'h-8 w-[260px]' : 'py-1.5 min-w-[220px]'}`}>
            <Search size={14} className="text-slate-400 flex-shrink-0" />
            <input
              value={searchQuery}
              onChange={e => onSearchChange(e.target.value)}
              placeholder="ค้นหา..."
              autoFocus
              className="bg-transparent text-[11px] text-slate-700 placeholder:text-slate-400 outline-none w-full font-sarabun"
            />
            <button
              onClick={() => {
                onSearchChange('');
                setIsSearchMode(false);
              }}
              className="flex items-center justify-center w-6 h-6 rounded-full text-slate-400 hover:text-slate-700 hover:bg-black/5 transition-all"
              title="ปิดค้นหา"
            >
              <X size={13} />
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-1">
              {/* Mobile Select */}
              <div className="relative md:hidden flex items-center">
                <select
                  value={filterDept}
                  onChange={(e) => onDeptChange(e.target.value)}
                  className={`appearance-none bg-slate-100 text-[11px] font-bold text-slate-700 rounded-full pl-3 pr-7 focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${isPortal ? 'h-8' : 'h-7'}`}
                >
                  {allDepts.map((dept) => {
                    const val = deptIdMap[dept.id] ?? dept.id;
                    return (
                      <option key={dept.id} value={val}>
                        {dept.label.replace('ศึกษา', '')}
                      </option>
                    );
                  })}
                </select>
                <ChevronDown size={12} className="absolute right-2.5 pointer-events-none text-slate-500" />
              </div>

              {/* Desktop Pills */}
              <div className="hidden md:flex items-center gap-1">
                {allDepts.map((dept) => {
                  const val = deptIdMap[dept.id] ?? dept.id;
                  const isActive = filterDept === val;

                  return (
                    <button
                      key={dept.id}
                      onClick={() => onDeptChange(val)}
                      className={`px-3.5 rounded-full text-[11px] font-bold transition-all font-sukhumvit whitespace-nowrap ${
                        isPortal ? 'h-8' : 'py-1.5'
                      } ${
                        isActive
                          ? `bg-slate-900 text-white shadow-md`
                          : 'text-slate-500 hover:text-slate-800 hover:bg-black/5'
                      }`}
                    >
                      {dept.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="w-px h-5 bg-slate-200 mx-1" />

            {/* Add Event Button */}
            <motion.button
              onClick={onAddEvent}
              whileHover={{ scale: 1.08, backgroundColor: 'rgba(15,23,42,0.06)' }}
              whileTap={{ scale: 0.9 }}
              className="flex items-center justify-center w-8 h-8 rounded-full text-slate-500 hover:text-slate-900 transition-colors"
              title="เพิ่มกิจกรรม"
            >
              <Plus size={16} />
            </motion.button>

            <div className="w-px h-5 bg-slate-200 mx-1" />

            {/* Search Toggle */}
            <button
              onClick={() => setIsSearchMode(true)}
              className="flex items-center justify-center w-8 h-8 rounded-full text-slate-500 hover:text-slate-900 hover:bg-black/5 transition-all"
              title="ค้นหา"
            >
              <Search size={15} />
            </button>
          </>
        )}
      </motion.div>
    </div>
  );
}
