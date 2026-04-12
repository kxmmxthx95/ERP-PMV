import { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search, Plus, Minus, Pencil, Trash2, BookOpen, GripVertical } from 'lucide-react';
import {
  CATEGORY_CONFIG, DEPARTMENT_CONFIG,
  type Subject, type Department, type SubjectCategory,
} from '@/types/curriculum';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useSchoolStructure } from '@/hooks/useSchoolStructure';
import { useSubjectGroup } from '@/hooks/useSubjectGroup';

const glassCard: React.CSSProperties = {
  background: 'rgba(255,255,255,0.70)',
  backdropFilter: 'blur(24px) saturate(160%)',
  WebkitBackdropFilter: 'blur(24px) saturate(160%)',
  border: '1px solid rgba(255,255,255,0.90)',
  boxShadow: '0 8px 32px rgba(0,0,0,0.06)',
};

const CATEGORIES: (SubjectCategory | 'all')[] = ['all', 'core', 'added', 'elective', 'activity'];
const CATEGORY_ALL_LABEL = 'ทั้งหมด';

interface SubjectMasterPanelProps {
  subjects: Subject[];
  activeDepartment: Department;
  assignedSubjectIds?: string[];
  onAddSubject: () => void;
  onEditSubject: (subject: Subject) => void;
  onDeleteSubject: (id: string) => void;
  onFilterDepartmentChange?: (deptId: string) => void;
  onFilterGradeChange?: (gradeId: string) => void;
  onToggleSubject: (id: string) => void;
}

export default function SubjectMasterPanel({
  subjects,
  assignedSubjectIds = [],
  onAddSubject,
  onEditSubject,
  onDeleteSubject,
  onFilterDepartmentChange,
  onFilterGradeChange,
  onToggleSubject,
}: SubjectMasterPanelProps) {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<SubjectCategory | 'all'>('all');
  const [filterDepartment, setFilterDepartment] = useState<string>('all');
  const [filterGrade, setFilterGrade] = useState<string>('all');
  const [filterGroup, setFilterGroup] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);

  const { departments, getGradesBySection } = useSchoolStructure();
  const { sortedGroups, subjectsByGroup } = useSubjectGroup(subjects);
  const grades = filterDepartment !== 'all' ? getGradesBySection(filterDepartment as any) : [];

  const filtered = subjects
    .filter(s => filterDepartment === 'all' || s.department === filterDepartment)
    .filter(s => filterGrade === 'all' || (s as any).gradeLevel === filterGrade || (s as any).grade === filterGrade)
    .filter(s => categoryFilter === 'all' || s.category === categoryFilter)
    .filter(s => {
      if (filterGroup === 'all') return true;
      // ตรวจสอบว่า subject อยู่ในกลุ่มที่เลือก
      for (const groupId of Object.keys(subjectsByGroup)) {
        if (subjectsByGroup[groupId]?.some(sub => sub.id === s.id) &&
            (subjectsByGroup as any)[groupId] === sortedGroups.find(g => g.id === filterGroup)?.subjectIds) {
          return true;
        }
      }
      // ใช้ simple check: หา group ที่มี subject นี้
      const groupWithSubject = sortedGroups.find(g => g.subjectIds.includes(s.id));
      return groupWithSubject?.id === filterGroup;
    })
    .filter(s =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.code.toLowerCase().includes(search.toLowerCase()),
    );

  // ── Pagination ──
  const ITEMS_PER_PAGE = 20;
  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, categoryFilter, filterDepartment, filterGrade, filterGroup]);

  // จัดกลุ่มวิชาตามหมวดหมู่
  const groupedSubjects = useMemo(() => {
    const groups: Record<string, typeof paginated> = {
      core: [],
      added: [],
      elective: [],
      activity: [],
    };
    paginated.forEach(s => {
      if (groups[s.category]) groups[s.category].push(s);
    });
    return groups;
  }, [paginated]);

  const deptCfg = filterDepartment !== 'all' && DEPARTMENT_CONFIG[filterDepartment as Department]
    ? DEPARTMENT_CONFIG[filterDepartment as Department]
    : { bg: 'rgba(0,0,0,0.05)', color: '#1e1e1e', border: 'transparent', label: 'เลือกแผนก' };
  const totalCredits = filtered.reduce((sum, s) => sum + s.credits, 0);

  return (
    <div
      className="rounded-3xl overflow-hidden flex flex-col h-full"
      style={{ ...glassCard, minHeight: 0 }}
    >
      {/* Header */}
      <div className="p-2.5 sm:p-3" style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center shadow-sm flex-shrink-0"
              style={{ background: deptCfg.bg, border: `1px solid ${deptCfg.border}` }}
            >
              <BookOpen size={14} style={{ color: deptCfg.color }} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-black/80 leading-none">คลังวิชา</p>
              <p className="text-[9px] text-black/40 mt-0.5">{deptCfg.label} · {filtered.length} วิชา · {totalCredits} นก.</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-1 justify-end">
            <div className="relative w-full max-w-[140px] sm:max-w-[180px]">
              <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-black/30 z-10" />
              <Input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="ค้นหา..."
              className="w-full pl-7 pr-2 py-1.5 bg-black/5 hover:bg-black/10 border-transparent outline-none text-xs placeholder:text-black/40 shadow-none focus-visible:ring-1 focus-visible:ring-slate-300 h-auto rounded-lg transition-colors"
              />
            </div>
            <Button
              onClick={onAddSubject}
            className="flex items-center gap-1 px-3 py-1.5 rounded-md text-[11px] font-semibold text-white transition-all duration-150 hover:scale-[1.02] active:scale-[0.98] h-auto border-0 bg-[#1e1e1e] hover:bg-[#2a2a2a] flex-shrink-0"
              style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
            >
            <Plus size={13} />
            เพิ่มวิชา
            </Button>
          </div>
        </div>
      </div>

      {/* Filter Section - Static */}
      <div className="p-2.5 sm:p-3 space-y-2" style={{ borderBottom: '1px solid rgba(0,0,0,0.05)', background: 'rgba(0,0,0,0.01)' }}>
        <div className="flex flex-col sm:flex-row gap-1.5">
          <Select value={filterDepartment} onValueChange={(val) => {
            setFilterDepartment(val);
            setFilterGrade('all');
            setFilterGroup('all');
            if (val !== 'all' && onFilterDepartmentChange) {
              onFilterDepartmentChange(val);
            }
          }}>
            <SelectTrigger className="w-full sm:flex-1 px-2 py-1 bg-black/5 hover:bg-black/10 border-transparent text-xs text-black/70 shadow-none focus:ring-1 focus:ring-slate-300 h-auto rounded-lg transition-colors flex-shrink-0">
              <SelectValue placeholder="แผนก" />
            </SelectTrigger>
            <SelectContent className="bg-white/90 backdrop-blur-xl border-white/50 rounded-xl">
              <SelectItem value="all" className="text-xs rounded-lg">เลือกแผนก</SelectItem>
              {departments.map(d => (
                <SelectItem key={d.id} value={d.id} className="text-xs rounded-lg">{d.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterGrade} onValueChange={(val) => {
            setFilterGrade(val);
            if (val !== 'all' && onFilterGradeChange) {
              onFilterGradeChange(val);
            } else if (val === 'all' && onFilterGradeChange) {
              onFilterGradeChange('');
            }
          }} disabled={filterDepartment === 'all'}>
            <SelectTrigger className="w-full sm:flex-1 px-2 py-1 bg-black/5 hover:bg-black/10 border-transparent text-xs text-black/70 shadow-none focus:ring-1 focus:ring-slate-300 h-auto rounded-lg transition-colors disabled:opacity-50 flex-shrink-0">
              <SelectValue placeholder="ชั้น" />
            </SelectTrigger>
            <SelectContent className="bg-white/90 backdrop-blur-xl border-white/50 rounded-xl">
              <SelectItem value="all" className="text-xs rounded-lg">เลือกระดับชั้น</SelectItem>
              {grades.map(g => (
                <SelectItem key={g.id} value={g.id} className="text-xs rounded-lg">{g.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterGroup} onValueChange={setFilterGroup}>
            <SelectTrigger className="w-full sm:flex-1 px-2 py-1 bg-black/5 hover:bg-black/10 border-transparent text-xs text-black/70 shadow-none focus:ring-1 focus:ring-slate-300 h-auto rounded-lg transition-colors flex-shrink-0">
              <SelectValue placeholder="กลุ่มสาระ" />
            </SelectTrigger>
            <SelectContent className="bg-white/90 backdrop-blur-xl border-white/50 rounded-xl">
              <SelectItem value="all" className="text-xs rounded-lg">ทั้งหมด</SelectItem>
              {sortedGroups.map(g => (
                <SelectItem key={g.id} value={g.id} className="text-xs rounded-lg">{g.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div
          className="flex gap-1 overflow-x-auto rounded-xl shadow-sm max-w-full"
          style={{
            background: 'rgba(255, 255, 255, 0.4)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid rgba(255, 255, 255, 0.6)',
            padding: '0.25rem',
          }}
        >
          {CATEGORIES.map(cat => {
            const active = categoryFilter === cat;
            return (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className="flex items-center justify-center px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all duration-200 flex-shrink-0 flex-1"
                style={{
                  background: active ? '#1e1e1e' : 'transparent',
                  color: active ? '#fff' : 'rgba(0, 0, 0, 0.6)',
                  boxShadow: active ? '0 4px 12px rgba(0,0,0,0.15)' : 'none',
                }}
                onMouseEnter={e => {
                  if (!active) (e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.05)';
                }}
                onMouseLeave={e => {
                  if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent';
                }}
              >
                {cat === 'all' ? CATEGORY_ALL_LABEL : CATEGORY_CONFIG[cat].label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Table/List Section */}
      <motion.div
        layout
        className="flex-1 overflow-y-auto px-2.5 py-2 space-y-2.5 min-h-0"
      >
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <BookOpen size={28} className="text-black/15 mb-2" />
            <p className="text-xs text-black/40 font-medium">ไม่พบวิชาที่ค้นหา</p>
          </div>
        ) : (
          (CATEGORIES.filter(c => c !== 'all') as SubjectCategory[]).map(cat => {
            const catSubjects = groupedSubjects[cat] || [];
            if (catSubjects.length === 0) return null;

            const showHeader = categoryFilter === 'all';
            const cfg = CATEGORY_CONFIG[cat];

            return (
              <div
                key={cat}
                className="space-y-1"
              >
                {showHeader && (
                  <div className="flex items-center gap-1.5 px-2 py-0.5 mt-1 first:mt-0">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: cfg.color }} />
                    <h4 className="text-[10px] font-bold text-black/50 uppercase tracking-wider">{cfg.label}</h4>
                  </div>
                )}
                {catSubjects.map(subject => (
                  <SubjectRow
                    key={subject.id}
                    subject={subject}
                    isAssigned={assignedSubjectIds.includes(subject.id)}
                    onEdit={() => onEditSubject(subject)}
                    onDelete={() => onDeleteSubject(subject.id)}
                    onToggleSubject={() => onToggleSubject(subject.id)}
                  />
                ))}
              </div>
            );
          })
        )}

        {/* ── Pagination ── */}
        {totalPages > 1 && (
          <div className="px-3 py-2 border-t border-black/5 bg-white/40 flex items-center justify-between mt-auto shrink-0 backdrop-blur-md">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              className="h-7 text-[10px] px-2.5 rounded-lg bg-white/60 hover:bg-white shadow-none"
            >
              ก่อนหน้า
            </Button>
            <span className="text-[10px] text-black/50 font-medium">
              หน้า {currentPage} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              className="h-7 text-[10px] px-2.5 rounded-lg bg-white/60 hover:bg-white shadow-none"
            >
              ถัดไป
            </Button>
          </div>
        )}
      </motion.div>
    </div>
  );
}

// ── Subject Row ───────────────────────────────────────────────────────────────
function SubjectRow({
  subject,
  isAssigned,
  onEdit,
  onDelete,
  onToggleSubject,
}: {
  subject: Subject;
  isAssigned: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onToggleSubject: () => void;
}) {
  const catCfg = CATEGORY_CONFIG[subject.category];

  return (
    <div
      draggable={!isAssigned}
      onDragStart={(e) => {
        if (isAssigned) {
          e.preventDefault();
          return;
        }
        e.dataTransfer.setData('text/plain', subject.id);
        e.dataTransfer.effectAllowed = 'copy';
      }}
      className={`group flex items-center gap-2 px-2 py-1.5 rounded-xl transition-colors ${isAssigned ? 'bg-emerald-50/50 border border-emerald-100/50' : 'hover:bg-black/[0.03] border border-transparent cursor-grab active:cursor-grabbing'}`}
    >
      {/* Drag handle icon */}
      {!isAssigned && (
        <div className="opacity-0 group-hover:opacity-40 transition-opacity -ml-1 flex-shrink-0 text-black/40">
          <GripVertical size={13} />
        </div>
      )}

      {/* Code badge */}
      <span
        className="flex-shrink-0 text-[9px] font-bold px-1.5 py-0.25 rounded-md"
        style={{ background: catCfg.bg, color: catCfg.color }}
      >
        {subject.code}
      </span>

      {/* Name */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <p className="text-xs font-semibold text-black/75 truncate">{subject.name}</p>
          {isAssigned && (
            <span className="px-1 py-0.25 rounded text-[7px] font-bold bg-emerald-100 text-emerald-700 flex-shrink-0 whitespace-nowrap">อยู่ในแผน</span>
          )}
        </div>
      </div>

      {/* Credits + hours */}
      <div className="flex-shrink-0 text-right whitespace-nowrap">
        <p className="text-[9px] font-bold text-black/60">{subject.credits} นก. / {subject.hoursPerWeek}ชม.</p>
      </div>

      {/* Actions */}
      <div className="flex-shrink-0 flex items-center gap-0.5">
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleSubject}
          title={isAssigned ? "นำออก" : "เพิ่มเข้า"}
          className={`w-5 h-5 rounded-md flex items-center justify-center transition-colors focus-visible:ring-0 ${
            isAssigned
              ? "text-red-500 bg-red-50 hover:bg-red-100 hover:text-red-600"
              : "hover:bg-emerald-50 text-black/40 hover:text-emerald-600"
          }`}
        >
          {isAssigned ? <Minus size={12} /> : <Plus size={12} />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onEdit}
          className="w-5 h-5 rounded-md flex items-center justify-center hover:bg-blue-50 text-black/40 hover:text-blue-600 transition-colors focus-visible:ring-0"
        >
          <Pencil size={12} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onDelete}
          className="w-5 h-5 rounded-md flex items-center justify-center hover:bg-red-50 text-black/40 hover:text-red-600 transition-colors focus-visible:ring-0"
        >
          <Trash2 size={12} />
        </Button>
      </div>
    </div>
  );
}
