import { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { GraduationCap, Search, X, Check } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useTeacherManager } from '@/features/teachers/hooks/useTeacherManager';
import { useClassroomManager } from '@/features/classes/hooks/useClassroomManager';
import type { ClassRoom } from '@/types/class';
import { toast } from 'sonner';

interface Props {
  classRoom: ClassRoom;
  cfg: { bg: string; color: string; label: string };
}



const deptConfig: Record<string, { color: string; label: string }> = {
  early: { color: '#ec4899', label: 'ปฐมวัย' },
  primary: { color: '#10b981', label: 'ประถม' },
  secondary: { color: '#3b82f6', label: 'มัธยม' },
};

export default function ClassTeacherTab({ classRoom }: Props) {
  const { teachers } = useTeacherManager();
  const { updateClass } = useClassroomManager();

  const currentIds: string[] = classRoom.homeroomTeacherIds?.length
    ? classRoom.homeroomTeacherIds
    : classRoom.homeroomTeacherId ? [classRoom.homeroomTeacherId] : [];

  const [selectedIds, setSelectedIds] = useState<string[]>(currentIds);
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState<string>('all');


  const activeTeachers = useMemo(
    () => teachers.filter(t => t.status === 'active'),
    [teachers],
  );

  const filtered = useMemo(() =>
    activeTeachers.filter(t => {
      const q = search.toLowerCase();
      const matchesName = t.name.toLowerCase().includes(q);
      const matchesDept = selectedDept === 'all' || t.department === selectedDept;
      return matchesName && matchesDept;
    }),
    [activeTeachers, search, selectedDept],
  );

  const selectedTeachers = useMemo(
    () => activeTeachers.filter(t => selectedIds.includes(t.id)),
    [activeTeachers, selectedIds],
  );



  const toggleTeacher = (id: string) => {
    setSelectedIds(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= 2) {
        toast.error('กำหนดครูประจำชั้นได้สูงสุด 2 คน');
        return prev;
      }
      return [...prev, id];
    });
  };

  // Auto-save when selectedIds changes
  useEffect(() => {
    const saveChanges = async () => {
      // Only save if it's actually different from the current classroom data
      const current = classRoom.homeroomTeacherIds || [];
      if (JSON.stringify([...selectedIds].sort()) === JSON.stringify([...current].sort())) return;

      try {
        await updateClass(classRoom.id, {
          homeroomTeacherIds: selectedIds,
          homeroomTeacherId: selectedIds[0] ?? '',
        });
      } catch (err) {
        console.error("Auto-save failed:", err);
      }
    };

    const timeoutId = setTimeout(saveChanges, 1000); // 1s debounce
    return () => clearTimeout(timeoutId);
  }, [selectedIds, classRoom.id, updateClass, classRoom.homeroomTeacherIds]);
  return (
    <div className="flex flex-col gap-3 h-full">
      {/* ── Apple Music Style Header ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-4 flex-shrink-0"
      >
        <div className="flex flex-col lg:flex-row gap-8 items-start">
          {/* 1. Class Hero Card */}
          <div className="flex flex-col gap-3 shrink-0">
            <div className={`w-48 h-48 lg:w-56 lg:h-56 rounded-[2.5rem] bg-gradient-to-br ${
              classRoom.departmentId === 'secondary' ? 'from-indigo-600 to-purple-700' :
              classRoom.departmentId === 'primary' ? 'from-blue-500 to-cyan-500' :
              'from-rose-500 to-orange-500'
            } relative overflow-hidden shadow-xl shadow-black/5 group`}>
              <div className="absolute inset-0 bg-black/10 opacity-40" />
              <div className="absolute top-6 right-8 text-white/90 font-black text-3xl tracking-tighter drop-shadow-md">
                {classRoom.gradeLevel}
              </div>
              <div className="absolute bottom-6 left-8">
                <p className="text-white/60 text-[11px] font-black uppercase tracking-widest mb-1">
                  {classRoom.departmentId === 'secondary' ? 'Secondary' : 
                   classRoom.departmentId === 'primary' ? 'Primary' : 'Early'}
                </p>
                <h2 className="text-white text-3xl font-black tracking-tighter leading-none drop-shadow-lg">
                  ห้อง {classRoom.className}
                </h2>
              </div>
              <div className="absolute -bottom-12 -right-12 w-48 h-48 bg-white/20 rounded-full blur-3xl" />
            </div>
          </div>

          {/* 2. Selected Teachers List */}
          <div className="flex-1 w-full pt-2">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">ครูประจำชั้นที่เลือก</p>
                <p className="text-[10px] text-slate-400 mt-0.5 font-medium italic opacity-60">เลือกได้สูงสุด 2 คน (ระบบบันทึกอัตโนมัติ)</p>
              </div>
            </div>

            {selectedTeachers.length === 0 ? (
              <div className="flex items-center gap-3 p-6 rounded-[2rem] bg-black/[0.02] border border-dashed border-black/5 text-black/20">
                <GraduationCap size={24} strokeWidth={1.5} />
                <p className="text-xs font-bold uppercase tracking-widest">ยังไม่ได้เลือกครูประจำชั้น</p>
              </div>
            ) : (
              <div className="flex flex-wrap gap-3">
                {selectedTeachers.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center gap-4 px-4 py-3 bg-white rounded-[2rem] border border-black/5 shadow-sm hover:shadow-md transition-all group min-w-[260px]"
                  >
                    <div
                      className="w-14 h-14 rounded-2xl flex items-center justify-center text-[18px] font-black shrink-0 text-white shadow-sm overflow-hidden"
                      style={{ background: t.photoURL ? 'transparent' : (deptConfig[t.department]?.color || '#cbd5e1') }}
                    >
                      {t.photoURL ? (
                        <img 
                          src={t.photoURL} 
                          alt={t.name} 
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        t.name.charAt(0)
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-black text-slate-800 truncate tracking-tight">{t.name}</p>
                      <p className="text-[10px] font-black text-slate-400 truncate uppercase tracking-widest mt-0.5">{t.position || 'ครูประจำชั้น'}</p>
                    </div>
                    <button
                      onClick={() => toggleTeacher(t.id)}
                      className="w-8 h-8 rounded-full flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"
                    >
                      <X size={16} strokeWidth={3} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Search teachers */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="flex-1 min-h-0 flex flex-col gap-6 p-4"
      >
        <div className="flex-shrink-0 flex items-center justify-between gap-4">
          <div className="flex flex-wrap gap-1.5">
            {[
              { id: 'all', label: 'ทั้งหมด' },
              { id: 'early', label: 'ปฐมวัย' },
              { id: 'primary', label: 'ประถม' },
              { id: 'secondary', label: 'มัธยม' },
            ].map(dept => (
              <button
                key={dept.id}
                onClick={() => setSelectedDept(dept.id)}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all ${
                  selectedDept === dept.id
                    ? 'bg-blue-500 text-white shadow-md shadow-blue-500/20'
                    : 'bg-white/60 text-slate-400 hover:bg-white'
                }`}
              >
                {dept.label}
              </button>
            ))}
          </div>

          <div className="relative w-64 shrink-0">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-black/30" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="ค้นหาชื่อครู..."
              className="pl-8 h-10 text-[12px] rounded-xl bg-white border-black/10 focus-visible:ring-1 focus-visible:ring-blue-500 focus:border-blue-500 transition-all shadow-sm"
            />
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-x-auto pb-8">
          <table className="w-full text-left text-sm border-separate border-spacing-0 min-w-[600px]">
            <thead>
              <tr className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">
                <th className="py-4 px-4 w-[45%] border-b border-black/[0.08]">ชื่อ-นามสกุล</th>
                <th className="py-4 px-4 w-[25%] border-b border-black/[0.08]">ตำแหน่ง</th>
                <th className="py-4 px-4 w-[20%] border-b border-black/[0.08]">แผนก</th>
                <th className="py-4 px-4 text-center w-[10%] border-b border-black/[0.08]">เลือก</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-10 text-center text-black/20">
                    <GraduationCap size={28} strokeWidth={1.5} className="mx-auto mb-2 opacity-30" />
                    <p className="text-xs">ไม่พบรายชื่อครู</p>
                  </td>
                </tr>
              ) : (
                filtered.map((t, idx) => {
                  const isSelected = selectedIds.includes(t.id);
                  const prevIsSelected = idx > 0 && selectedIds.includes(filtered[idx - 1].id);
                  const nextIsSelected = idx < filtered.length - 1 && selectedIds.includes(filtered[idx + 1].id);
                  const cfg = deptConfig[t.department] || { color: '#cbd5e1' };
                  
                  return (
                    <tr
                      key={t.id}
                      onClick={() => toggleTeacher(t.id)}
                      className="group cursor-pointer"
                    >
                      <td className={`py-3 px-4 transition-colors 
                        ${isSelected ? 'bg-blue-600 text-white' : 'hover:bg-black/[0.02] border-b border-black/[0.04]'} 
                        ${isSelected && !prevIsSelected && 'rounded-tl-3xl'} 
                        ${isSelected && !nextIsSelected && 'rounded-bl-3xl'}
                      `}>
                        <div className="flex items-center gap-4">
                          <div
                            className={`w-14 h-14 rounded-2xl flex items-center justify-center text-[20px] font-black shrink-0 shadow-sm overflow-hidden transition-colors ${
                              isSelected ? 'bg-white text-blue-600' : 'text-white'
                            }`}
                            style={{ background: isSelected ? '#ffffff' : (t.photoURL ? 'transparent' : cfg.color) }}
                          >
                            {t.photoURL ? (
                              <img 
                                src={t.photoURL} 
                                alt={t.name} 
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              t.name.charAt(0)
                            )}
                          </div>
                          <div className="flex flex-col">
                            <span className={`font-black text-[14px] tracking-tight leading-tight ${isSelected ? 'text-white' : 'text-slate-800'}`}>
                              {t.name}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className={`py-3 px-4 font-black text-[9px] uppercase tracking-widest transition-colors 
                        ${isSelected ? 'bg-blue-600 text-white/70' : 'text-slate-400 border-b border-black/[0.04] group-hover:bg-black/[0.02]'}
                      `}>
                        {t.position || 'ครูผู้สอน'}
                      </td>
                      <td className={`py-3 px-4 font-black text-[9px] uppercase tracking-widest transition-colors 
                        ${isSelected ? 'bg-blue-600 text-white/70' : 'text-slate-400 border-b border-black/[0.04] group-hover:bg-black/[0.02]'}
                      `}>
                        {t.department === 'secondary' ? 'มัธยม' : t.department === 'primary' ? 'ประถม' : 'ปฐมวัย'}
                      </td>
                      <td className={`py-3 px-4 text-center transition-colors 
                        ${isSelected ? 'bg-blue-600' : 'border-b border-black/[0.04] group-hover:bg-black/[0.02]'}
                        ${isSelected && !prevIsSelected && 'rounded-tr-3xl'} 
                        ${isSelected && !nextIsSelected && 'rounded-br-3xl'}
                      `}>
                        <div className={`mx-auto w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-all ${
                          isSelected ? 'bg-white text-blue-600 shadow-md scale-110' : 'bg-black/5 text-transparent group-hover:text-slate-300'
                        }`}>
                          <Check size={14} strokeWidth={4} />
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}
