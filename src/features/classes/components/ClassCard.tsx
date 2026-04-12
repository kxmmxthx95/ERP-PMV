import { Users, MapPin, CalendarDays, ChevronRight, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { ClassRoomCard } from '@/types/class';
import type { Department } from '@/types/curriculum';
import { DEPARTMENT_CONFIG } from '@/types/curriculum';

interface ClassCardProps {
  card:     ClassRoomCard;
  onEdit:   () => void;
}

const glassCard: React.CSSProperties = {
  background: 'rgba(255,255,255,0.78)',
  backdropFilter: 'blur(24px) saturate(150%)',
  WebkitBackdropFilter: 'blur(24px) saturate(150%)',
  border: '1px solid rgba(255,255,255,0.92)',
  boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
};

export default function ClassCard({ card, onEdit }: ClassCardProps) {
  const navigate  = useNavigate();
  const { classRoom, homeroomTeacher, scheduledPeriods, totalPeriods, fillPct, isFull } = card;
  const cfg       = DEPARTMENT_CONFIG[classRoom.departmentId as Department];
  const fillColor = fillPct >= 80 ? '#10b981' : fillPct >= 40 ? '#f59e0b' : '#ef4444';
  const occupancy = Math.round(classRoom.studentCount / classRoom.maxStudents * 100);

  return (
    <div
      className="rounded-2xl overflow-hidden flex flex-col transition-all hover:shadow-md group"
      style={glassCard}
    >
      {/* ── Header ── */}
      <div
        className="px-4 pt-4 pb-3 flex items-start justify-between"
        style={{ borderBottom: `2px solid ${cfg.color}20` }}
      >
        <div className="flex items-center gap-3">
          {/* Dept badge */}
          <div
            className="w-11 h-11 rounded-2xl flex items-center justify-center text-lg font-extrabold shrink-0"
            style={{ background: cfg.bg, color: cfg.color }}
          >
            {classRoom.className.split('/')[0].slice(-1)}
          </div>
          <div>
            <h3 className="text-base font-bold text-black/80 leading-tight">{classRoom.className}</h3>
            <p className="text-[10px] font-semibold mt-0.5" style={{ color: cfg.color }}>
              {cfg.label}
            </p>
          </div>
        </div>

        {/* Edit button */}
        <button
          onClick={onEdit}
          className="opacity-0 group-hover:opacity-100 transition-opacity w-7 h-7 rounded-xl flex items-center justify-center text-black/40 hover:bg-black/06 hover:text-black/60"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9.5 2.5L11.5 4.5L4.5 11.5H2.5V9.5L9.5 2.5Z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      {/* ── Info ── */}
      <div className="px-4 py-3 space-y-2.5 flex-1">
        {/* Homeroom teacher */}
        <div className="flex items-center gap-2">
          <div
            className="w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0"
            style={{ background: cfg.bg, color: cfg.color }}
          >
            {homeroomTeacher?.name.replace('ครู', '').trim().charAt(0) ?? '?'}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-black/70 truncate">
              {homeroomTeacher?.name ?? <span className="text-black/30 italic">ยังไม่ได้กำหนด</span>}
            </p>
            {homeroomTeacher?.position && (
              <p className="text-[10px] text-black/35">{homeroomTeacher.position}</p>
            )}
          </div>
        </div>

        {/* Room location */}
        {classRoom.room && (
          <div className="flex items-center gap-1.5">
            <MapPin size={11} className="text-black/30 shrink-0" />
            <span className="text-[10px] text-black/45 truncate">{classRoom.room}</span>
          </div>
        )}

        {/* Student count */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Users size={11} className="text-black/30 shrink-0" />
              <span className="text-[11px] text-black/55 font-semibold">
                {classRoom.studentCount} / {classRoom.maxStudents} คน
              </span>
            </div>
            {isFull && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-red-50 text-red-500 flex items-center gap-1">
                <AlertCircle size={9} />เต็ม
              </span>
            )}
          </div>
          {/* Occupancy bar */}
          <div className="h-1.5 rounded-full bg-black/[0.06] overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.min(100, occupancy)}%`,
                background: isFull ? '#ef4444' : cfg.color,
              }}
            />
          </div>
        </div>

        {/* Schedule fill */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <CalendarDays size={11} className="text-black/30 shrink-0" />
              <span className="text-[10px] text-black/45">
                ตาราง: {scheduledPeriods}/{totalPeriods} คาบ
              </span>
            </div>
            <span className="text-[10px] font-bold" style={{ color: fillColor }}>
              {fillPct}%
            </span>
          </div>
          <div className="h-1 rounded-full bg-black/[0.06] overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${fillPct}%`, background: fillColor }}
            />
          </div>
        </div>
      </div>

      {/* ── Quick Actions ── */}
      <div className="grid grid-cols-3 divide-x divide-black/[0.05] border-t border-black/[0.05]">
        <QuickAction
          label="นักเรียน"
          icon={<Users size={12} />}
          onClick={() => navigate(`/admin/students?class=${classRoom.id}`)}
          color={cfg.color}
        />
        <QuickAction
          label="ตารางสอน"
          icon={<CalendarDays size={12} />}
          onClick={() => navigate(`/sysadmin/schedule?class=${classRoom.id}`)}
          color={cfg.color}
        />
        <QuickAction
          label="แก้ไข"
          icon={<ChevronRight size={12} />}
          onClick={onEdit}
          color={cfg.color}
        />
      </div>
    </div>
  );
}

// ── Quick Action Button ────────────────────────────────────────────────────────

function QuickAction({
  label, icon, onClick, color,
}: { label: string; icon: React.ReactNode; onClick: () => void; color: string }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1 py-2.5 text-center transition-all hover:bg-black/[0.025]"
    >
      <span className="text-black/35 group-hover:text-black/60 transition-colors" style={{ color }}>
        {icon}
      </span>
      <span className="text-[9px] font-semibold text-black/45">{label}</span>
    </button>
  );
}
