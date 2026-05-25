import { motion } from 'framer-motion';
import { AlertCircle } from 'lucide-react';
import StudentAvatar from './StudentAvatar';
import { checkStudentCompletion } from '@/utils/studentValidation';

import type { StudentCard as StudentCardType } from '@/types/student';

const glassCard = "bg-white/80 backdrop-blur-xl border border-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.04)]";
interface StudentCardProps {
  studentCard: StudentCardType;
  isSelected: boolean;
  onSelect: (id: string) => void;
  index: number;
}

export default function StudentCard({ studentCard, isSelected, onSelect, index }: StudentCardProps) {
  const { student, currentClass, currentGrade } = studentCard;
  const completion = checkStudentCompletion(student);
  
  return (
    <motion.button
      layout
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ duration: 0.2, delay: index * 0.01 }}
      whileHover={{}}
      whileTap={{}}
      onClick={() => onSelect(student.id)}
      className={`group relative aspect-square rounded-[2rem] p-3 md:p-4 flex flex-col items-center justify-center gap-1 transition-all duration-300 ${glassCard} ${
        isSelected
          ? 'bg-white shadow-2xl border-indigo-400 scale-[1.02] z-10'
          : 'hover:shadow-[0_20px_50px_rgba(0,0,0,0.1)] hover:border-white'
      }`}
    >
      {/* Background decoration */}
      <div className={`absolute -top-10 -right-10 w-24 h-24 rounded-full transition-all duration-700 blur-3xl ${
        student.gender === 'male' ? 'bg-blue-400/10 group-hover:bg-blue-400/20' : 'bg-pink-400/10 group-hover:bg-pink-400/20'
      }`} />

      {/* Completion Badge */}
      {!completion.isComplete && (
        <div className="absolute top-4 left-4 z-20">
          <div className="flex items-center gap-1 bg-rose-500 text-white px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-tighter shadow-sm border border-rose-400/50 animate-pulse">
            <AlertCircle size={10} strokeWidth={3} />
            <span>ข้อมูลไม่ครบ</span>
          </div>
        </div>
      )}

      {/* Avatar Container */}
      <div className="relative">
        <StudentAvatar 
          photoURL={student.photoURL}
          studentId={student.id}
          name={student.firstName}
          gender={student.gender}
          className="w-16 h-16 md:w-20 md:h-20 rounded-[2rem]"
        />
        
        {/* Status indicator */}
        <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-white shadow-sm ${
          student.status === 'active' ? 'bg-emerald-500' : 'bg-amber-500'
        }`} />
      </div>

      {/* Info */}
      <div className="text-center w-full space-y-0.5">
        <h3 className="text-[13px] md:text-[15px] font-black text-slate-800 font-sukhumvit truncate px-1">
          {student.firstName} {student.lastName}
        </h3>
        <p className="text-[10px] md:text-[11px] font-bold text-slate-400 font-sarabun uppercase tracking-tight">
          ID: {student.studentCode}
        </p>
        <div className="flex items-center justify-center gap-1.5 mt-2">
          <span className="px-2 py-0.5 rounded-full bg-slate-900/5 text-[9px] font-black text-slate-600 border border-slate-200/50">
            {currentGrade || 'ไม่ระบุชั้น'}
          </span>
          {currentClass && (
            <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-[9px] font-black text-indigo-600 border border-indigo-100 shadow-sm">
              ห้อง {currentClass}
            </span>
          )}
        </div>
      </div>

      {/* Selection Glow */}
      {isSelected && (
        <motion.div
          layoutId="selection-glow"
          className="absolute inset-0 border-2 border-indigo-500/50 rounded-[2rem] pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        />
      )}
    </motion.button>
  );
}
