import { motion, AnimatePresence } from 'framer-motion';
import { Plus, ChevronLeft, FileSpreadsheet, Search } from 'lucide-react';
import { ROLE_LABELS } from '@/types/mockUsers';

interface UserFilterCapsuleProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  filterRole: string;
  onRoleChange: (role: string) => void;
  filterDepartment: string;
  onDepartmentChange: (dept: string) => void;
  onAdd: () => void;
  onImport: () => void;
}

const DEPARTMENTS = [
  { id: 'all', label: 'ทั้งหมด' },
  { id: 'preschool', label: 'ปฐมวัย' },
  { id: 'primary', label: 'ประถม' },
  { id: 'secondary', label: 'มัธยม' },
];

export default function UserFilterCapsule({
  searchTerm,
  onSearchChange,
  filterRole,
  onRoleChange,
  filterDepartment,
  onDepartmentChange,
  onAdd,
  onImport
}: UserFilterCapsuleProps) {
  const isDeptView = filterRole === 'student' || filterRole === 'teacher';

  return (
    <div className="flex flex-col items-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-2 px-2 py-2 rounded-3xl border w-[94vw] sm:w-auto overflow-hidden"
        style={{
          background: 'rgba(255,255,255,0.2)',
          backdropFilter: 'blur(20px) saturate(160%)',
          WebkitBackdropFilter: 'blur(20px) saturate(160%)',
          border: '1px solid rgba(0,0,0,0.05)',
        }}
      >
        <div className="relative w-full sm:min-w-[360px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="ค้นหาชื่อ / อีเมล"
            className="w-full h-9 rounded-full bg-white/70 border border-black/5 pl-9 pr-3 text-xs font-bold text-slate-700 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-slate-200"
          />
        </div>

        <div className="flex items-center gap-1 w-full">
        <AnimatePresence mode="wait">
          {!isDeptView ? (
            <motion.div
              key="roles"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="flex items-center gap-1 overflow-x-auto scrollbar-hide px-1"
            >
              {/* All Roles Button */}
              <button
                onClick={() => onRoleChange('all')}
                className={`px-4 py-2 rounded-full text-[11px] font-black transition-all whitespace-nowrap flex-shrink-0 ${filterRole === 'all'
                    ? 'bg-[#0f172a] text-white shadow-md'
                    : 'text-slate-500 hover:text-slate-900 hover:bg-black/5'
                  }`}
              >
                ทั้งหมด
              </button>

              <div className="w-px h-4 bg-black/10 mx-1" />

              {/* Dynamic Role Buttons */}
              <div className="flex items-center gap-1">
                {Object.entries(ROLE_LABELS)
                  .filter(([key]) => key !== 'sysadmin')
                  .map(([key, style]) => (
                    <button
                      key={key}
                      onClick={() => onRoleChange(key)}
                      className={`px-4 py-2 rounded-full text-[11px] font-black transition-all whitespace-nowrap flex-shrink-0 ${filterRole === key
                          ? 'bg-[#0f172a] text-white'
                          : 'text-slate-500 hover:text-slate-900 hover:bg-black/5'
                        }`}
                    >
                      {style.label}
                    </button>
                  ))}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="depts"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="flex items-center gap-1 overflow-x-auto scrollbar-hide px-1"
            >
              <button
                onClick={() => onRoleChange('all')}
                className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-900 hover:bg-black/5 transition-all mr-1"
              >
                <ChevronLeft size={18} />
              </button>

              <div className="flex items-center rounded-full bg-slate-100/50 p-1 mr-2 flex-shrink-0">
                <span className="px-3 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  {ROLE_LABELS[filterRole as keyof typeof ROLE_LABELS]?.label ?? ''}
                </span>
              </div>

              {DEPARTMENTS.map((dept) => (
                <button
                  key={dept.id}
                  onClick={() => onDepartmentChange(dept.id)}
                  className={`px-4 py-2 rounded-full text-[11px] font-black transition-all whitespace-nowrap flex-shrink-0 ${filterDepartment === dept.id
                      ? 'bg-[#0f172a] text-white'
                      : 'text-slate-500 hover:text-slate-900 hover:bg-black/5'
                    }`}
                >
                  {dept.label}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="w-[1px] h-4 bg-black/10 mx-1" />

        {/* Add Button */}
        <button
          onClick={onAdd}
          className="w-9 h-9 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-900 hover:bg-black/5 transition-all active:scale-90"
        >
          <Plus size={18} />
        </button>

        <div className="w-[1px] h-4 bg-black/10 mx-1" />

        {/* Import Button */}
        <button
          onClick={onImport}
          className="w-9 h-9 flex items-center justify-center rounded-full text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all active:scale-90"
          title="นำเข้าข้อมูลจาก Google Sheets / CSV"
        >
          <FileSpreadsheet size={18} />
        </button>
        </div>
      </motion.div>
    </div>
  );
}
