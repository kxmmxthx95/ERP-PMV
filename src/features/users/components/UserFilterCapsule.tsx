import { motion } from 'framer-motion';
import { Plus, FileSpreadsheet, Zap, Search, X } from 'lucide-react';

interface UserFilterCapsuleProps {
  onAdd: () => void;
  onImport: () => void;
  onForceLogout: () => void;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  isSearchMode: boolean;
  onSearchModeChange: (active: boolean) => void;
}

export default function UserFilterCapsule({
  onAdd,
  onImport,
  onForceLogout,
  searchTerm,
  onSearchChange,
  isSearchMode,
  onSearchModeChange,
}: UserFilterCapsuleProps) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={`flex items-center gap-1.5 h-10 p-1 rounded-full pointer-events-auto transition-all duration-300 ${
          isSearchMode
            ? 'w-[min(360px,calc(100vw-2rem))] bg-blue-50/90 shadow-md border border-blue-100'
            : 'bg-white/60 backdrop-blur-xl border border-white shadow-[0_8px_32px_rgba(0,0,0,0.04)]'
        }`}
      >
        {isSearchMode ? (
          <motion.div
            key="search-active"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="flex items-center gap-2 px-2.5 w-full h-full"
          >
            <Search size={15} className="text-slate-400 flex-shrink-0" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="ค้นหาชื่อ, นามสกุล, หรืออีเมล..."
              autoFocus
              className="bg-transparent text-xs font-bold text-slate-800 placeholder:text-slate-400 outline-none w-full font-sarabun"
            />
            <button
              onClick={() => {
                onSearchChange('');
                onSearchModeChange(false);
              }}
              className="flex items-center justify-center w-6 h-6 rounded-full text-slate-400 hover:text-slate-600 hover:bg-black/5 transition-all flex-shrink-0"
              title="ปิดการค้นหา"
            >
              <X size={14} />
            </button>
          </motion.div>
        ) : (
          <div className="flex items-center gap-1 px-1">
            <button
              onClick={onAdd}
              className="flex items-center justify-center w-8 h-8 rounded-full text-slate-600 hover:text-slate-800 hover:bg-black/5 transition-all active:scale-90 flex-shrink-0"
              title="เพิ่มผู้ใช้"
            >
              <Plus size={16} />
            </button>

            <div className="w-px h-5 bg-black/10 mx-0.5 shrink-0" />

            <button
              onClick={onImport}
              className="flex items-center justify-center w-8 h-8 rounded-full text-slate-600 hover:text-slate-800 hover:bg-black/5 transition-all active:scale-90 flex-shrink-0"
              title="นำเข้าข้อมูลจาก Google Sheets / CSV"
            >
              <FileSpreadsheet size={16} />
            </button>

            <div className="w-px h-5 bg-black/10 mx-0.5 shrink-0" />

            <button
              onClick={onForceLogout}
              className="flex items-center justify-center w-8 h-8 rounded-full text-slate-600 hover:text-slate-800 hover:bg-black/5 transition-all active:scale-90 flex-shrink-0"
              title="บังคับทุกคนออกจากระบบ (Force Logout All)"
            >
              <Zap size={16} />
            </button>

            <div className="w-px h-5 bg-black/10 mx-0.5 shrink-0" />

            <button
              onClick={() => onSearchModeChange(true)}
              className="flex items-center justify-center w-8 h-8 rounded-full text-slate-600 hover:text-slate-800 hover:bg-black/5 transition-all active:scale-90 flex-shrink-0"
              title="ค้นหาผู้ใช้"
            >
              <Search size={16} />
            </button>
          </div>
        )}
    </motion.div>
  );
}
