import { motion } from 'framer-motion';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DEPARTMENT_CONFIG } from '@/types/curriculum';
import { Mars, Venus } from 'lucide-react';
import type { TeacherProfile } from '@/types/teacher';

interface TeacherCardProps {
  teacher: TeacherProfile;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

export default function TeacherCard({
  teacher,
  isSelected,
  onSelect,
}: TeacherCardProps) {
  const cfg = DEPARTMENT_CONFIG[teacher.department];
  const initial = teacher.name.charAt(0).toUpperCase();

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      onClick={() => onSelect(teacher.id)}
      className={`group relative aspect-square rounded-[2rem] cursor-pointer transition-all duration-300 border-2 overflow-hidden ${isSelected
        ? 'border-blue-500 bg-white shadow-xl z-10'
        : 'border-white bg-white/95 hover:bg-white hover:shadow-lg hover:border-blue-100'
        }`}
      style={{
        backdropFilter: 'blur(20px)',
      }}
    >
      <div className="absolute inset-0 flex flex-col justify-between p-4">
        {/* Top: Name */}
        <div className="flex flex-col text-left">
          <p className="text-[14px] font-black text-slate-800 leading-tight font-sukhumvit line-clamp-1">
            {teacher.name.split(' ')[0]}
          </p>
          <p className="text-[9px] font-bold text-slate-400 font-sarabun truncate">
            {teacher.name.split(' ').slice(1).join(' ') || '-'}
          </p>
        </div>

        {/* Gender Icon (Top Right) */}
        <div className="absolute top-4 right-4 md:top-6 md:right-6">
          {(() => {
            const isFemale = teacher.name.includes('นาง') || teacher.name.includes('น.ส.');
            const Icon = isFemale ? Venus : Mars;
            const colorClass = isFemale ? 'text-rose-400' : 'text-blue-400';
            return (
              <div className={`p-1.5 rounded-xl bg-white/50 backdrop-blur-sm border border-white/60 shadow-sm ${colorClass}`}>
                <Icon size={14} strokeWidth={3} />
              </div>
            );
          })()}
        </div>

        {/* Center: Count */}
        <div className="flex flex-col items-center justify-center">
          <p className="text-[28px] font-black text-slate-800 leading-none font-sukhumvit">
            {teacher.teachingSubjectIds.length}
          </p>
          <p className="text-[9px] font-bold text-slate-400 font-sarabun uppercase tracking-widest mt-0.5">
            วิชาที่สอน
          </p>
        </div>

        {/* Bottom Section */}
        <div className="flex items-end justify-between w-full">
          {/* Avatar (Bottom Left) */}
          <div className="relative">
            <Avatar className="w-9 h-9 border-2 border-white shadow-md overflow-visible">
              <AvatarImage src={teacher.photoURL} alt={teacher.name} className="object-cover rounded-full" />
              <AvatarFallback
                className="text-white font-bold text-[10px] rounded-full"
                style={{ background: '#e11d48' }}
              >
                {initial}
              </AvatarFallback>
            </Avatar>
            <div className={`absolute top-0 right-0 w-3 h-3 rounded-full border-2 border-white ${teacher.status === 'active' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' : 'bg-slate-300'}`} />
          </div>

          {/* Badges (Bottom Right) */}
          <div className="flex flex-col items-end gap-1">
            <span className="text-[7.5px] font-black uppercase px-2 py-0.5 rounded-full bg-rose-500 text-white shadow-sm tracking-wider">
              ครูผู้สอน
            </span>
            <span className="text-[7.5px] font-bold uppercase px-2 py-0.5 rounded-full border border-slate-100 text-slate-500 bg-white shadow-sm font-sarabun truncate max-w-[70px]">
              {cfg.label}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
