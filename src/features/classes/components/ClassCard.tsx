import { AlertCircle } from 'lucide-react';
import type { ClassRoomCard } from '@/types/class';
import type { Department } from '@/types/curriculum';

interface ClassCardProps {
  card: ClassRoomCard;
}

const DEPT_THEMES: Record<Department, { gradient: string; labelEn: string }> = {
  early: {
    gradient: 'linear-gradient(135deg, #FF5E9B 0%, #FF9966 100%)',
    labelEn: 'Early'
  },
  primary: {
    gradient: 'linear-gradient(135deg, #4FACFE 0%, #00F2FE 100%)',
    labelEn: 'Primary'
  },
  secondary: {
    gradient: 'linear-gradient(135deg, #667EEA 0%, #764BA2 100%)',
    labelEn: 'Secondary'
  }
};

export default function ClassCard({ card }: ClassCardProps) {
  const { classRoom, homeroomTeacher, isFull } = card;

  const theme = DEPT_THEMES[classRoom.departmentId as Department] || DEPT_THEMES.secondary;

  return (
    <div className="group cursor-pointer select-none">
      {/* ── Main Music-style Card ── */}
      <div
        className="aspect-square rounded-2xl relative overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.12)] transition-all duration-500 group-hover:shadow-[0_20px_40px_rgba(0,0,0,0.2)] group-hover:-translate-y-1 active:scale-95"
        style={{ background: theme.gradient }}
      >
        {/* Top Right: Grade Level */}
        <div className="absolute top-3 right-4 text-white font-black text-lg tracking-tighter drop-shadow-md flex items-center gap-1">
          {classRoom.gradeLevel}
        </div>

        {/* Bottom Left: Dept Label (English) */}
        <div className="absolute bottom-3 left-3 right-3">
          <h2 className="text-white text-2xl font-black tracking-tighter leading-none drop-shadow-md">
            {theme.labelEn}
          </h2>
        </div>

        {/* Subtle Overlay Glow */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-60" />
      </div>

      {/* ── Album Style Info (Below Card) ── */}
      <div className="mt-2 px-1">
        <h3 className="text-[13px] font-bold text-slate-900 leading-tight group-hover:text-blue-600 transition-colors">
          ห้อง {classRoom.className}
        </h3>
        <p className="text-[11px] text-slate-500 mt-0.5 font-medium flex items-center gap-1.5">
          {homeroomTeacher?.name || 'ยังไม่ได้ระบุครู'}
          {isFull && <AlertCircle size={10} className="text-red-400" />}
        </p>
      </div>
    </div>
  );
}

