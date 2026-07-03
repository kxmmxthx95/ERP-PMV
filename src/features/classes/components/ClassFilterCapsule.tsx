import { motion, AnimatePresence } from 'framer-motion';
import { HiPlus, HiChevronLeft, HiMagnifyingGlass, HiXMark } from 'react-icons/hi2';
import type { Department } from '@/types/curriculum';
import { DEPARTMENT_CONFIG } from '@/types/curriculum';

interface ClassFilterCapsuleProps {
  filterDept: Department | 'all';
  onDeptChange: (dept: Department | 'all') => void;
  filterGrade: string;
  onGradeChange: (grade: string) => void;
  grades: Array<{ id: string; label: string; shortLabel: string }>;
  onAdd: () => void;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  isSearchMode: boolean;
  onSearchModeChange: (active: boolean) => void;
  showDepartmentSection?: boolean;
}

const DEPT_LABELS: Record<string, string> = {
  early: DEPARTMENT_CONFIG.early.label,
  primary: DEPARTMENT_CONFIG.primary.label,
  secondary: DEPARTMENT_CONFIG.secondary.label,
};

export default function ClassFilterCapsule({
  filterDept,
  onDeptChange,
  filterGrade,
  onGradeChange,
  grades,
  onAdd,
  searchTerm,
  onSearchChange,
  isSearchMode,
  onSearchModeChange,
  showDepartmentSection = true,
}: ClassFilterCapsuleProps) {
  const isGradeView = filterDept !== 'all';

  return (
    <div className="flex flex-col items-center font-sukhumvit">
      <motion.div
        layout
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className={`flex items-center gap-1.5 h-10 p-1 rounded-full pointer-events-auto w-[94vw] sm:w-auto transition-all duration-300 ${
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
            <HiMagnifyingGlass size={15} className="text-slate-400 flex-shrink-0" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="ค้นหาห้องเรียน หรือชื่อครูประจำชั้น..."
              autoFocus
              className="bg-transparent text-xs font-bold text-slate-800 placeholder:text-slate-400 outline-none w-full font-sukhumvit"
            />
            <button
              onClick={() => {
                onSearchChange('');
                onSearchModeChange(false);
              }}
              className="flex items-center justify-center w-6 h-6 rounded-full text-slate-400 hover:text-slate-600 hover:bg-black/5 transition-all flex-shrink-0"
              title="ปิดการค้นหา"
            >
              <HiXMark size={14} />
            </button>
          </motion.div>
        ) : (
          <div className="flex items-center gap-1.5 w-full">
            {showDepartmentSection && (
              <AnimatePresence mode="wait">
                {!isGradeView ? (
                <motion.div
                  key="depts"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="flex items-center gap-1 px-1"
                >
                  {/* All Departments Button */}
                  <button
                    onClick={() => onDeptChange('all')}
                    className={`h-8 px-6 rounded-full text-[11px] font-black transition-all whitespace-nowrap flex-shrink-0 flex items-center justify-center gap-1.5 cursor-pointer ${
                      filterDept === 'all'
                        ? 'bg-slate-900 text-white shadow-md'
                        : 'text-slate-500 hover:text-slate-800 hover:bg-black/5'
                    }`}
                  >
                    ทั้งหมด
                  </button>

                  <div className="w-px h-5 bg-black/10 mx-1 shrink-0" />

                  {/* Department Buttons */}
                  <div className="flex items-center gap-1">
                    {(['early', 'primary', 'secondary'] as Department[]).map((dept) => (
                      <button
                        key={dept}
                        onClick={() => onDeptChange(dept)}
                        className={`h-8 px-6 rounded-full text-[11px] font-black transition-all whitespace-nowrap flex-shrink-0 flex items-center justify-center gap-1.5 cursor-pointer ${
                          (filterDept as string) === dept
                            ? 'bg-slate-900 text-white shadow-md'
                            : 'text-slate-500 hover:text-slate-800 hover:bg-black/5'
                        }`}
                      >
                        {DEPT_LABELS[dept]}
                      </button>
                    ))}
                  </div>
                </motion.div>
                ) : (
                <motion.div
                  key="grades"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="flex items-center gap-1 px-1"
                >
                  <button
                    onClick={() => onDeptChange('all')}
                    className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-full text-slate-500 hover:text-slate-800 hover:bg-black/5 transition-all mr-1 cursor-pointer"
                  >
                    <HiChevronLeft size={16} />
                  </button>

                  <div className="flex items-center rounded-full bg-slate-100/60 backdrop-blur-md border border-slate-200/40 p-1 mr-2 flex-shrink-0 h-8">
                    <span className="px-3 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                      {DEPT_LABELS[filterDept] ?? ''}
                    </span>
                  </div>

                  <button
                    onClick={() => onGradeChange('all')}
                    className={`h-8 px-4 rounded-full text-[11px] font-black transition-all whitespace-nowrap cursor-pointer ${
                      filterGrade === 'all'
                        ? 'bg-slate-900 text-white shadow-md'
                        : 'text-slate-500 hover:text-slate-800 hover:bg-black/5'
                    }`}
                  >
                    ทุกระดับ
                  </button>

                  {grades.map((g) => (
                    <button
                      key={g.id}
                      onClick={() => onGradeChange(g.shortLabel)}
                      className={`w-8 h-8 rounded-full text-[11px] font-black flex items-center justify-center transition-all cursor-pointer ${
                        filterGrade === g.shortLabel
                          ? 'bg-slate-900 text-white shadow-md'
                          : 'text-slate-500 hover:text-slate-800 hover:bg-black/5'
                      }`}
                    >
                      {(g.shortLabel || g.label).replace(/[^0-9]/g, '')}
                    </button>
                  ))}
                </motion.div>
                )}
              </AnimatePresence>
            )}

            {showDepartmentSection && <div className="w-px h-5 bg-black/10 mx-1 shrink-0" />}

            {/* Add Button */}
            <button
              onClick={onAdd}
              className="flex items-center justify-center w-8 h-8 rounded-full text-slate-600 hover:text-slate-800 hover:bg-black/5 transition-all active:scale-90 flex-shrink-0 cursor-pointer"
              title="เพิ่มห้องเรียน"
            >
              <HiPlus size={16} />
            </button>

            <div className="w-px h-5 bg-black/10 mx-1 shrink-0" />

            {/* Search Toggle Button */}
            <button
              onClick={() => onSearchModeChange(true)}
              className="flex items-center justify-center w-8 h-8 rounded-full text-slate-600 hover:text-slate-800 hover:bg-black/5 transition-all active:scale-90 flex-shrink-0 cursor-pointer"
              title="ค้นหาห้องเรียน"
            >
              <HiMagnifyingGlass size={16} />
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
