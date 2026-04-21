import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Layers, Minus, AlertCircle, Sparkles, MousePointer2, PlusCircle, BookText, Search, X, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  CATEGORY_CONFIG,
  SUBJECT_GROUP_CONFIG,
  type SubjectCategory,
  type Subject,
  type CurriculumMap,
  type SubjectGroupId,
} from '@/types/curriculum';
import { useSchoolStructure } from '@/hooks/useSchoolStructure';
import { useSubjectGroup } from '@/hooks/useSubjectGroup';
import { Skeleton } from '@/components/ui/skeleton';

// ── Styles ─────────────────────────────────────────────────────────────────
const glassCard: React.CSSProperties = {
  background: 'rgba(255, 255, 255, 0.72)',
  backdropFilter: 'blur(24px) saturate(150%)',
  WebkitBackdropFilter: 'blur(24px) saturate(150%)',
  border: '1px solid rgba(255, 255, 255, 0.90)',
  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.04)',
};

const CATEGORIES: (SubjectCategory | 'all')[] = ['all', 'core', 'added', 'elective', 'activity'];
const CATEGORY_ALL_LABEL = 'ทั้งหมด';

// ── Types ──────────────────────────────────────────────────────────────────
interface CurriculumMapPanelProps {
  academicYear: string;
  subjects?: Subject[];
  allMaps?: CurriculumMap[];
  activeMapId?: string;
  activeSemester: 1 | 2;
  setActiveSemester: (s: 1 | 2) => void;
  getAssignedIds: (mapId: string) => string[];
  getCreditSummary: (mapId: string) => { total: number; core: number; added: number; elective: number; activity: number };
  onToggleSubject: (subjectId: string, mapId: string) => void;
  isEditMode?: boolean;
  // Shared Filter Props
  search: string;
  setSearch: (s: string) => void;
  filterDepartment: string;
  setFilterDepartment: (d: string) => void;
  filterGrade: string;
  setFilterGrade: (g: string) => void;
  filterGroup: string;
  setFilterGroup: (g: string) => void;
  categoryFilter: SubjectCategory | 'all';
  setCategoryFilter: (c: SubjectCategory | 'all') => void;
  isLoading?: boolean;
}

// ── Component ──────────────────────────────────────────────────────────────
export default function CurriculumMapPanel({
  subjects = [],
  allMaps = [],
  activeMapId,
  activeSemester,
  setActiveSemester,
  getAssignedIds,
  onToggleSubject,
  isEditMode = false,
  search, setSearch,
  filterDepartment, setFilterDepartment,
  filterGrade, setFilterGrade,
  filterGroup, setFilterGroup,
  categoryFilter, setCategoryFilter,
  isLoading = false,
}: CurriculumMapPanelProps) {
  const activeMap = useMemo(() => {
    return allMaps.find(m => m.id === activeMapId);
  }, [allMaps, activeMapId]);

  const assignedSubjectIds = useMemo(() => {
    if (!activeMap) return [];
    return getAssignedIds(activeMap.id);
  }, [activeMap, getAssignedIds]);

  const [isDragOver, setIsDragOver] = useState(false);

  // ── Filter state ──────────────────────────────────────────────────────────
  const { departments, getGradesBySection } = useSchoolStructure();
  const { sortedGroups } = useSubjectGroup(subjects);
  const grades = filterDepartment !== 'all' ? getGradesBySection(filterDepartment as any) : [];

  const hasFilters = search !== '' || filterDepartment !== 'all' || filterGrade !== 'all' || filterGroup !== 'all' || categoryFilter !== 'all';

  const handleClearFilters = () => {
    setSearch('');
    setFilterDepartment('all');
    setFilterGrade('all');
    setFilterGroup('all');
    setCategoryFilter('all');
  };

  // ── กรองวิชาในแผนที่ต้องการแสดงผล ──────────────────────────────────────────
  const assignedSubjects = useMemo(() => {
    return subjects
      .filter(s => assignedSubjectIds.includes(s.id))
      .filter(s => categoryFilter === 'all' || s.category === categoryFilter)
      .filter(s => {
        if (filterGroup === 'all') return true;
        const groupWithSubject = sortedGroups.find(g => g.subjectIds?.includes(s.id));
        return groupWithSubject?.id === filterGroup;
      })
      .filter(s =>
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.code.toLowerCase().includes(search.toLowerCase()),
      );
  }, [subjects, assignedSubjectIds, categoryFilter, filterGroup, search, sortedGroups]);

  // ── สรุปหน่วยกิต (คำนวณเฉพาะเมื่อมีการกรองเท่านั้น) ────────────────────────
  const summary = useMemo(() => {
    if (!hasFilters) {
      return { total: 0, core: 0, added: 0, elective: 0, activity: 0, count: 0 };
    }
    const result = { total: 0, core: 0, added: 0, elective: 0, activity: 0, count: assignedSubjects.length };
    assignedSubjects.forEach(s => {
      result.total += (s.credits || 0);
      if (s.category && s.category in result) {
        (result as any)[s.category] += (s.credits || 0);
      }
    });
    return result;
  }, [assignedSubjects, hasFilters]);

  const groupedSubjects = useMemo(() => {
    const groups: Record<SubjectCategory, Subject[]> = { core: [], added: [], elective: [], activity: [] };
    assignedSubjects.forEach(s => {
      if (s.category && s.category in groups) {
        groups[s.category as SubjectCategory].push(s);
      }
    });
    return groups;
  }, [assignedSubjects]);

  return (
    <div
      className={`h-full flex flex-col rounded-3xl overflow-hidden transition-all duration-200 relative ${isDragOver ? 'ring-2 ring-emerald-400 bg-emerald-50/40 shadow-[0_0_30px_rgba(16,185,129,0.15)]' : ''}`}
      style={glassCard}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragOver(false);
        const subjectId = e.dataTransfer.getData('text/plain');
        console.log('[CurriculumMapPanel] onDrop', { subjectId, isEditMode, activeMapId, assignedSubjectIds });
        if (!isEditMode) { console.warn('[CurriculumMapPanel] blocked: not in edit mode'); return; }
        if (!subjectId) { console.warn('[CurriculumMapPanel] blocked: no subjectId'); return; }
        if (!activeMapId) { console.warn('[CurriculumMapPanel] blocked: no activeMapId'); return; }
        if (assignedSubjectIds.includes(subjectId)) { console.warn('[CurriculumMapPanel] blocked: subject already assigned'); return; }
        onToggleSubject(subjectId, activeMapId);
      }}
    >
      {/* ── Drop Overlay ── */}
      <AnimatePresence>
        {isDragOver && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-x-2 inset-y-2 z-50 rounded-2xl border-2 border-dashed border-emerald-400/60 bg-emerald-50/20 flex flex-col items-center justify-center backdrop-blur-[2px]"
          >
            <div className="w-12 h-12 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-lg mb-3 animate-bounce">
              <PlusCircle size={24} />
            </div>
            <p className="text-sm font-bold text-emerald-600">วางวิชาเพื่อเพิ่มลงแผน</p>
            <p className="text-[10px] text-emerald-500/80 mt-1 uppercase tracking-widest font-bold">Release to assign</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Header ── */}
      <div className="p-2.5 sm:p-3" style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#1e1e1e] flex items-center justify-center text-white shadow-sm flex-shrink-0">
              <Layers size={14} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-bold text-black/80 leading-none">แผนผังการเรียน</p>
              </div>
              <p className="text-[9px] text-black/40 mt-0.5">
                {activeMap ? activeMap.name + ' · ' : ''}
                {hasFilters ? `${summary.count} วิชา · ${summary.total.toFixed(1)} นก.` : 'กรุณากรองข้อมูลเพื่อดูหน่วยกิต'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-1 justify-end">
            {/* Search Bar matching SubjectMasterPanel */}
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

            <div className="flex items-center gap-3 ml-2">
              {isEditMode && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center gap-1.5 text-amber-600 font-bold text-[10px] tracking-tight whitespace-nowrap"
                >
                  <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.6)]" />
                  เทอม {activeSemester}
                </motion.div>
              )}
              <div className="flex bg-black/5 p-0.5 rounded-lg gap-0.5">
                {([1, 2] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => setActiveSemester(s)}
                    className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all ${activeSemester === s
                      ? 'bg-white text-black shadow-sm'
                      : 'text-black/40 hover:text-black/60'
                      }`}
                  >
                    เทอม {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Filter Section ── */}
      <div className="p-2.5 sm:p-3 space-y-2" style={{ borderBottom: '1px solid rgba(0,0,0,0.05)', background: 'rgba(0,0,0,0.01)' }}>
        <div className="flex flex-col sm:flex-row gap-1.5">
          <Select value={filterDepartment} onValueChange={(val) => {
            setFilterDepartment(val);
            setFilterGrade('all');
            setFilterGroup('all');
          }}>
            <SelectTrigger className="w-full sm:flex-1 px-2 py-1 bg-black/5 hover:bg-black/10 border-transparent text-xs text-black/70 shadow-none focus:ring-1 focus:ring-slate-300 h-auto rounded-lg transition-colors flex-shrink-0">
              <SelectValue placeholder="แผนก" />
            </SelectTrigger>
            <SelectContent className="bg-white/90 backdrop-blur-xl border-white/50 rounded-xl">
              <SelectItem value="all" className="text-xs rounded-lg">แผนกทั้งหมด</SelectItem>
              {departments.map(d => (
                <SelectItem key={d.id} value={d.id} className="text-xs rounded-lg">{d.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterGrade} onValueChange={setFilterGrade} disabled={filterDepartment === 'all'}>
            <SelectTrigger className="w-full sm:flex-1 px-2 py-1 bg-black/5 hover:bg-black/10 border-transparent text-xs text-black/70 shadow-none focus:ring-1 focus:ring-slate-300 h-auto rounded-lg transition-colors flex-shrink-0">
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
          <AnimatePresence>
            {hasFilters && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8, width: 0 }}
                animate={{ opacity: 1, scale: 1, width: 'auto' }}
                exit={{ opacity: 0, scale: 0.8, width: 0 }}
                className="flex items-center"
              >
                <Button
                  onClick={handleClearFilters}
                  variant="ghost"
                  className="h-auto py-1 px-2 text-[10px] text-red-500/70 hover:text-red-600 hover:bg-red-50 whitespace-nowrap ml-1 sm:ml-0 flex-shrink-0"
                >
                  <X size={12} className="mr-0.5" /> ล้าง
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Category pills — full width, same as SubjectMasterPanel */}
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

      {/* ── Body (Subjects List) ── */}
      <div className="flex-1 p-2.5 sm:p-3 overflow-y-auto space-y-4 min-h-0">
        {!activeMapId ? (
          <div className="py-12 flex flex-col items-center justify-center text-black/30 border border-dashed border-black/10 rounded-2xl bg-black/[0.02]">
            <Layers size={28} className="mb-2 opacity-50" />
            <p className="text-xs font-medium">เลือกหลักสูตรจาก Dropdown ด้านบน</p>
            <p className="text-[10px] mt-1">เพื่อเริ่มเพิ่มรายวิชา</p>
          </div>
        ) : !hasFilters ? (
          <div className="flex flex-col items-center justify-center py-16 text-center text-black/30 border border-dashed border-black/10 rounded-2xl bg-black/[0.02] mt-4">
            <Search size={28} className="mb-2 opacity-50" />
            <p className="text-xs font-medium">กรุณากรองข้อมูลหรือค้นหา</p>
            <p className="text-[10px] mt-1 text-black/40">เพื่อแสดงรายวิชาที่อยู่ในแผนการเรียน</p>
          </div>
        ) : (
          <div className="mt-6 flex-1 min-h-0 flex flex-col">
            <div className="flex items-center justify-between mb-2 px-1">
              <h3 className="text-xs font-bold text-black/70">
                วิชาในหลักสูตร ({assignedSubjectIds.length})
              </h3>
            </div>

            <AnimatePresence mode="popLayout">
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="space-y-2">
                      <Skeleton className="w-20 h-3 rounded" />
                      <div className="space-y-1">
                        {[1, 2].map(j => (
                          <div key={j} className="flex items-center gap-3 px-2.5 py-3 rounded-xl border border-black/5 bg-white/40">
                            <Skeleton className="w-6 h-6 rounded-md" />
                            <div className="flex-1 space-y-2">
                              <Skeleton className="w-1/2 h-3 rounded" />
                              <Skeleton className="w-1/4 h-2 rounded" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : assignedSubjects.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="py-6 flex flex-col items-center justify-center text-black/30 border border-dashed border-black/10 rounded-2xl bg-black/[0.02]"
                >
                  <AlertCircle size={24} className="mb-2 opacity-50" />
                  <p className="text-xs font-medium">ยังไม่มีรายวิชาในหลักสูตรนี้</p>
                  <p className="text-[10px]">ลากรายวิชาจากคลังด้านซ้ายมาวางที่นี่ หรือกดปุ่ม (+)</p>
                </motion.div>
              ) : (
                (['core', 'added', 'elective', 'activity'] as SubjectCategory[]).map(cat => {
                  const catSubjects = groupedSubjects[cat] || [];
                  if (catSubjects.length === 0) return null;
                  const cfg = CATEGORY_CONFIG[cat];

                  const categoryIcons: Record<SubjectCategory, React.ReactNode> = {
                    core: <BookText size={12} />,
                    added: <PlusCircle size={12} />,
                    elective: <MousePointer2 size={12} />,
                    activity: <Sparkles size={12} />,
                  };

                  return (
                    <motion.div
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      key={cat}
                      className="mb-3 last:mb-0"
                    >
                      <div className="flex items-center gap-2 mb-1.5 px-1">
                        <div className="w-2 h-2 rounded-full shadow-sm" style={{ background: cfg.color }} />
                        <h4 className="text-[10px] font-bold text-black/60 uppercase tracking-wider">{cfg.label}</h4>
                        <span className="text-[9px] font-semibold text-black/40 ml-auto bg-white/50 px-1.5 py-0.5 rounded border border-black/5">
                          {catSubjects.length} วิชา · {catSubjects.reduce((sum, s) => sum + (s.credits || 0), 0)} นก.
                        </span>
                      </div>
                      <div className="space-y-1">
                        {catSubjects.map(s => {
                          const groupCfg = SUBJECT_GROUP_CONFIG[(s.subjectGroup || 'other') as SubjectGroupId];
                          return (
                            <motion.div
                              layout
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.95 }}
                              key={s.id}
                              className="group flex items-center gap-3 px-2.5 py-2 rounded-xl border transition-all hover:shadow-md"
                              style={{
                                backgroundColor: groupCfg.bg,
                                borderColor: groupCfg.border,
                              }}
                            >
                              {/* Code */}
                              <span
                                className="flex-shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                                style={{ background: 'rgba(0,0,0,0.05)', color: groupCfg.color }}
                              >
                                {s.code}
                              </span>

                              {/* Name */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <p className="text-[11px] font-semibold text-black/80 truncate">{s.name}</p>
                                  <div
                                    className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[8px] font-bold border flex-shrink-0 whitespace-nowrap"
                                    style={{
                                      background: cfg.bg,
                                      color: cfg.color,
                                      borderColor: cfg.border || 'transparent'
                                    }}
                                  >
                                    {categoryIcons[s.category]}
                                    {cfg.label}
                                  </div>
                                </div>
                              </div>

                              {/* Credits */}
                              <div className="flex-shrink-0 text-right whitespace-nowrap">
                                <p className="text-[9px] font-bold text-black/60">{s.credits || 0} นก. / {s.hoursPerWeek || 0} ชม.</p>
                              </div>

                              {/* Actions */}
                              <div className="flex-shrink-0 flex items-center gap-1">
                                {isEditMode && (
                                  <>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => onToggleSubject(s.id, activeMapId!)}
                                      className="w-6 h-6 rounded-md flex items-center justify-center bg-red-500 text-white hover:bg-red-600 transition-all shadow-sm focus-visible:ring-0"
                                      title="นำออกจากแผน"
                                    >
                                      <Minus size={13} />
                                    </Button>
                                    
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="w-6 h-6 rounded-md flex items-center justify-center bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white transition-all shadow-sm focus-visible:ring-0"
                                    >
                                      <Pencil size={12} />
                                    </Button>
                                    
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="w-6 h-6 rounded-md flex items-center justify-center bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white transition-all shadow-sm focus-visible:ring-0"
                                    >
                                      <Trash2 size={12} />
                                    </Button>
                                  </>
                                )}
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    </motion.div>
                  );
                })
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* ── Footer Summary ── */}
      <div className="p-2.5 sm:p-3 border-t border-black/5 bg-white/40 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 backdrop-blur-md">
        <div className="flex flex-wrap items-center gap-1">
          {(['core', 'added', 'elective', 'activity'] as SubjectCategory[]).map(cat => {
            const credits = (summary as any)[cat] || 0;
            if (credits === 0) return null;
            const cfg = CATEGORY_CONFIG[cat];
            return (
              <span
                key={cat}
                className="px-1.5 py-0.5 rounded-md text-[9px] font-bold"
                style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}
              >
                {cfg.label} {credits} นก.
              </span>
            );
          })}
        </div>
        <div className="flex items-center gap-2 ml-auto sm:ml-0">
          <span className="text-[10px] font-semibold text-black/60">
            {hasFilters ? 'รวมตามที่กรอง' : 'กรอกข้อมูลเพื่อดูหน่วยกิต'}
          </span>
          {hasFilters && (
            <span className="text-xs font-bold text-[#1e1e1e] bg-black/5 border border-black/10 px-2.5 py-1 rounded-lg shadow-sm">
              {summary.total.toFixed(1)} นก.
            </span>
          )}
        </div>
      </div>

    </div>
  );
}
