import { motion } from 'framer-motion';
import { Plus } from 'lucide-react';

interface AddStudentGhostCardProps {
  onClick: () => void;
  index: number;
}

export default function AddStudentGhostCard({ onClick, index }: AddStudentGhostCardProps) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ duration: 0.2, delay: index * 0.01 }}
      whileHover={{}}
      whileTap={{}}
      onClick={onClick}
      className="relative group cursor-pointer aspect-square"
    >
      <div className="absolute inset-0 bg-white/40 backdrop-blur-sm rounded-[2rem] border-2 border-dashed border-slate-300 group-hover:border-blue-400 group-hover:bg-blue-50/30 transition-all duration-300 flex flex-col items-center justify-center gap-3">
        <div className="w-12 h-12 rounded-full bg-white shadow-sm border border-slate-200 flex items-center justify-center text-slate-400 group-hover:text-blue-500 group-hover:shadow-md transition-all">
          <Plus size={24} strokeWidth={3} />
        </div>
        <div className="text-center">
          <p className="text-[13px] font-black text-slate-400 group-hover:text-blue-600 font-sukhumvit transition-colors">เพิ่มนักเรียนใหม่</p>
          <p className="text-[10px] text-slate-400/70 font-bold font-sukhumvit mt-0.5">คลิกเพื่อเพิ่มข้อมูล</p>
        </div>
      </div>
    </motion.div>
  );
}
