import { Search, X, Users } from 'lucide-react';
import { motion } from 'framer-motion';
import type { StudentCard, StudentStatus } from '@/types/student';
import type { StudentFilter } from '@/hooks/useStudentManager';

interface StudentListPanelProps {
  cards: StudentCard[];
  filter: StudentFilter;
  onFilterChange: (patch: Partial<StudentFilter>) => void;
  availableYears: string[];
  availableGrades: string[];
  availableClasses: Array<{ classId: string; className: string }>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
  stats: { total: number; active: number; male: number; female: number };
}

const STATUS_COLOR: Record<StudentStatus, string> = {
  active: '#10b981',
  inactive: '#f59e0b',
  graduated: '#6366f1',
  transferred: '#94a3b8',
};

const glassCard: React.CSSProperties = {
  background: 'rgba(255,255,255,0.80)',
  backdropFilter: 'blur(20px)',
  border: '1px solid rgba(0,0,0,0.06)',
  boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
};

const itemAnim = {
  hidden: { opacity: 0, x: -8 },
  show: { opacity: 1, x: 0, transition: { duration: 0.2 } },
};
const listAnim = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.04 } },
};

export default function StudentListPanel({
  cards, filter, onFilterChange,
  selectedId, onSelect, stats,
}: StudentListPanelProps) {


  return (
    <div className="flex flex-col h-full gap-3">

      {/* ── Stats bar ── */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: 'ทั้งหมด', value: stats.total, color: '#6366f1' },
          { label: 'กำลังศึกษา', value: stats.active, color: '#10b981' },
          { label: 'ชาย', value: stats.male, color: '#3b82f6' },
          { label: 'หญิง', value: stats.female, color: '#ec4899' },
        ].map(s => (
          <div key={s.label} className="flex flex-col items-center py-2 rounded-xl" style={glassCard}>
            <span className="text-lg font-bold" style={{ color: s.color }}>{s.value}</span>
            <span className="text-[10px] text-black/40">{s.label}</span>
          </div>
        ))}
      </div>

      {/* ── Search bar (Compact) ── */}
      <div className="flex items-center gap-2 h-10 px-4 rounded-2xl bg-white shadow-sm border border-black/5 focus-within:ring-2 focus-within:ring-indigo-100 transition-all">
        <Search size={14} className="text-black/30 flex-shrink-0" />
        <input
          value={filter.searchText}
          onChange={e => onFilterChange({ searchText: e.target.value })}
          placeholder="ค้นหาด้วยชื่อหรือรหัสนักเรียน..."
          className="bg-transparent text-xs text-black/70 placeholder-black/25 outline-none flex-1 font-medium"
        />
        {filter.searchText && (
          <button onClick={() => onFilterChange({ searchText: '' })} className="text-black/25 hover:text-black/50 transition-colors flex-shrink-0">
            <X size={14} />
          </button>
        )}
      </div>

      {/* ── Student list ── */}
      <div className="flex-1 overflow-y-auto">
        {cards.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3 text-black/30">
            <Users size={32} className="opacity-30" />
            <p className="text-sm">ไม่พบนักเรียนที่ตรงกับเงื่อนไข</p>
          </div>
        ) : (
          <motion.div className="space-y-1.5" variants={listAnim} initial="hidden" animate="show" key={JSON.stringify(filter)}>
            {cards.map(({ student, currentClass, currentGrade, enrollment }) => {
              const isSelected = selectedId === student.id;
              const statusColor = STATUS_COLOR[student.status];

              return (
                <motion.button
                  key={student.id}
                  variants={itemAnim}
                  onClick={() => onSelect(student.id)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left"
                  style={{
                    background: isSelected ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.70)',
                    border: isSelected ? '1px solid rgba(16,185,129,0.25)' : '1px solid rgba(0,0,0,0.05)',
                    boxShadow: isSelected ? '0 0 0 2px rgba(16,185,129,0.10)' : '0 1px 4px rgba(0,0,0,0.04)',
                  }}
                >
                  {/* Avatar */}
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                    style={{
                      background: student.gender === 'male'
                        ? 'linear-gradient(135deg, #3b82f6, #6366f1)'
                        : 'linear-gradient(135deg, #ec4899, #f43f5e)',
                    }}
                  >
                    {student.firstName.charAt(0)}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-black/80 truncate">
                      {student.prefix}{student.firstName} {student.lastName}
                    </p>
                    <p className="text-[10px] text-black/40">
                      {student.studentCode}
                      {currentGrade ? ` · ${currentGrade}` : ''}
                      {currentClass ? ` (${currentClass})` : ''}
                    </p>
                  </div>

                  {/* Status dot */}
                  <div className="flex-shrink-0 flex flex-col items-end gap-1">
                    <div className="w-2 h-2 rounded-full" style={{ background: statusColor }} />
                    {enrollment?.status === 'transferred' && (
                      <span className="text-[9px] text-black/30">ย้ายออก</span>
                    )}
                  </div>
                </motion.button>
              );
            })}
          </motion.div>
        )}
      </div>

      {/* Footer count */}
      <p className="text-[10px] text-black/30 text-center">
        แสดง {cards.length} จาก {stats.total} คน
      </p>
    </div>
  );
}
