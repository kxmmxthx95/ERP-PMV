import { useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import type { TeacherProfile } from '@/types/teacher';
import type { Department } from '@/types/curriculum';
import { DEPARTMENT_CONFIG } from '@/types/curriculum';

interface TeacherListPanelProps {
  teachers: TeacherProfile[];
  selectedId: string | null;
  teacherLoadSummary: Record<string, number>; // teacherId → currentHours
  onSelect: (id: string) => void;
  onAdd: () => void;
}

const ALL_DEPT = 'all' as const;
type DeptFilter = Department | typeof ALL_DEPT;

const glassCard: React.CSSProperties = {
  background: 'rgba(255,255,255,0.72)',
  backdropFilter: 'blur(24px) saturate(150%)',
  WebkitBackdropFilter: 'blur(24px) saturate(150%)',
  border: '1px solid rgba(255,255,255,0.90)',
  boxShadow: '0 8px 32px rgba(0,0,0,0.06)',
};

export default function TeacherListPanel({
  teachers,
  selectedId,
  teacherLoadSummary,
  onSelect,
  onAdd,
}: TeacherListPanelProps) {
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState<DeptFilter>(ALL_DEPT);

  const filtered = teachers.filter(t => {
    const matchDept = deptFilter === ALL_DEPT || t.department === deptFilter;
    const q = search.toLowerCase();
    const matchSearch = !q || t.name.toLowerCase().includes(q) || t.employeeCode.toLowerCase().includes(q);
    return matchDept && matchSearch;
  });

  return (
    <div className="flex flex-col h-full rounded-2xl overflow-hidden" style={glassCard}>
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-black/05 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-black/80">รายชื่อครู</p>
            <p className="text-[11px] text-black/35 mt-0.5">{teachers.filter(t => t.status === 'active').length} คน (active)</p>
          </div>
          <button
            onClick={onAdd}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white transition-all"
            style={{ background: '#1e1e1e' }}
          >
            <Plus size={13} />
            เพิ่มครู
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-black/30" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="ค้นหาชื่อ / รหัสครู..."
            className="h-8 pl-8 text-xs rounded-xl bg-black/[0.03] border-transparent focus-visible:ring-1 focus-visible:ring-slate-300 placeholder:text-black/25"
          />
        </div>

        {/* Dept filter */}
        <div className="flex gap-1.5 flex-wrap">
          {([ALL_DEPT, 'early', 'primary', 'secondary'] as DeptFilter[]).map(dept => {
            const isAll = dept === ALL_DEPT;
            const cfg = isAll ? null : DEPARTMENT_CONFIG[dept as Department];
            const isActive = deptFilter === dept;
            return (
              <button
                key={dept}
                onClick={() => setDeptFilter(dept)}
                className="px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all border"
                style={{
                  background: isActive ? (cfg ? cfg.bg : 'rgba(0,0,0,0.08)') : 'transparent',
                  color: isActive ? (cfg ? cfg.color : 'rgba(0,0,0,0.70)') : 'rgba(0,0,0,0.40)',
                  borderColor: isActive ? (cfg ? cfg.border : 'rgba(0,0,0,0.15)') : 'rgba(0,0,0,0.06)',
                }}
              >
                {isAll ? 'ทั้งหมด' : cfg!.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-black/30">
            <p className="text-xs">ไม่พบครู</p>
          </div>
        ) : (
          <ul className="divide-y divide-black/[0.04]">
            {filtered.map(teacher => {
              const cfg = DEPARTMENT_CONFIG[teacher.department];
              const currentHours = teacherLoadSummary[teacher.id] ?? 0;
              const isOverloaded = currentHours > teacher.maxHoursPerWeek;
              const isSelected = selectedId === teacher.id;

              return (
                <li key={teacher.id}>
                  <button
                    onClick={() => onSelect(teacher.id)}
                    className="w-full text-left px-4 py-3 transition-colors hover:bg-black/[0.025]"
                    style={isSelected ? { background: 'rgba(0,0,0,0.04)' } : undefined}
                  >
                    <div className="flex items-start gap-3">
                      {/* Avatar */}
                      <div
                        className="w-8 h-8 rounded-xl flex items-center justify-center text-[11px] font-bold shrink-0 mt-0.5"
                        style={{ background: cfg.bg, color: cfg.color }}
                      >
                        {teacher.name.replace('ครู', '').trim().charAt(0)}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-semibold text-black/80 truncate">{teacher.name}</span>
                          {teacher.status === 'inactive' && (
                            <span className="text-[10px] text-black/30 bg-black/05 px-1.5 py-0.5 rounded-md">ไม่ active</span>
                          )}
                        </div>
                        <p className="text-[10px] text-black/40 mt-0.5">
                          <span className="font-mono">{teacher.employeeCode}</span>
                          {teacher.position && <span className="ml-1.5">· {teacher.position}</span>}
                        </p>
                        {/* Load bar */}
                        <div className="flex items-center gap-2 mt-1.5">
                          <div className="flex-1 h-1 rounded-full bg-black/[0.07] overflow-hidden max-w-[80px]">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${Math.min(100, Math.round(currentHours / teacher.maxHoursPerWeek * 100))}%`,
                                background: isOverloaded ? '#ef4444' : cfg.color,
                              }}
                            />
                          </div>
                          <span
                            className="text-[10px] font-mono"
                            style={{ color: isOverloaded ? '#ef4444' : 'rgba(0,0,0,0.35)' }}
                          >
                            {currentHours}/{teacher.maxHoursPerWeek} คาบ
                          </span>
                          {isOverloaded && (
                            <span className="text-[10px] text-red-500 font-semibold">เกิน!</span>
                          )}
                        </div>
                      </div>

                      {/* Subject count badge */}
                      <Badge
                        variant="outline"
                        className="text-[10px] shrink-0 rounded-lg border-black/10 text-black/40 font-mono"
                      >
                        {teacher.teachingSubjectIds.length} วิชา
                      </Badge>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
