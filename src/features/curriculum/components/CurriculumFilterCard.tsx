import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Layers } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { Skeleton } from '@/components/ui/skeleton';

interface CurriculumFilterCardProps {
  maps: any[];
  activeMapId: string;
  setActiveMapId: (id: string) => void;
  editMode?: boolean;
  onEditModeChange?: (editMode: boolean) => void;
  isLoading?: boolean;
}

export default function CurriculumFilterCard({ maps, activeMapId, setActiveMapId, editMode = false, onEditModeChange, isLoading = false }: CurriculumFilterCardProps) {
  const mapsForFilter = useMemo(() => {
    // แสดงทุก map ไม่กรองตามปี เพราะ CurriculumMapPanel จัดการ filter เองอยู่แล้ว
    return maps;
  }, [maps]);

  return (
    <div
      className="rounded-2xl p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
      style={{
        background: 'rgba(255, 255, 255, 0.65)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.8)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.04)',
      }}
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#1e1e1e] flex items-center justify-center text-white shadow-sm flex-shrink-0">
          <Layers size={20} />
        </div>
        <div>
          <h3 className="text-[14px] font-bold text-black/80">รายละเอียดหลักสูตร</h3>
          <p className="text-[11px] text-black/40">เลือกหลักสูตรที่ต้องการจัดการในตาราง</p>
        </div>
      </div>

      <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap sm:flex-nowrap">
          {isLoading ? (
            <>
              <Skeleton className="h-4 w-20 rounded" />
              <Skeleton className="h-9 w-full sm:w-[200px] rounded-xl" />
              <Skeleton className="h-8 w-24 rounded-lg" />
            </>
          ) : (
            <>
              <span className="text-[11px] font-bold text-black/80 whitespace-nowrap">เลือกหลักสูตร:</span>
              {mapsForFilter.length > 0 ? (
                <Select value={activeMapId || ''} onValueChange={(v) => setActiveMapId(v)}>
                  <SelectTrigger className="w-full sm:w-[200px] rounded-xl bg-white/50 border-black/5 h-9 text-xs">
                    <SelectValue placeholder="เลือกหลักสูตร" />
                  </SelectTrigger>
                  <SelectContent className="bg-white/95 backdrop-blur-xl border-white/50 rounded-xl">
                    {mapsForFilter.map(m => (
                      <SelectItem key={m.id} value={m.id} className="text-xs rounded-lg">
                        {m.name || `หลักสูตรไม่มีชื่อ (${m.id})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="text-xs text-black/40 w-full sm:w-[200px] h-9 flex items-center px-3 bg-white/50 rounded-xl border border-black/5">
                    ไม่มีหลักสูตร
                </div>
              )}

              {/* Frameless Edit Mode Toggle */}
              <button
                onClick={() => onEditModeChange?.(!editMode)}
                className={`relative flex items-center gap-2 h-9 px-2 rounded-xl text-xs font-bold transition-all duration-300 flex-shrink-0 whitespace-nowrap overflow-hidden border border-transparent ${
                  editMode 
                    ? 'text-amber-600' 
                    : 'text-black/50 hover:text-black/70 hover:bg-black/5'
                }`}
              >
                <div className={`relative flex items-center h-4.5 w-8 rounded-full transition-colors duration-300 ${editMode ? 'bg-amber-400' : 'bg-black/20'}`}>
                  <motion.div
                    animate={{ x: editMode ? 16 : 2 }}
                    className="h-3 w-3 rounded-full bg-white shadow-sm"
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                </div>
                <span>โหมดแก้ไข</span>
              </button>
            </>
          )}
      </div>
    </div>
  );
}
