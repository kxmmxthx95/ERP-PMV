import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { BookOpen, Search, X, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import type { TeacherProfile } from '@/types/teacher';
import type { Subject, Department } from '@/types/curriculum';
import { DEPARTMENT_CONFIG, CATEGORY_CONFIG } from '@/types/curriculum';
import { useSchoolStructure } from '@/hooks/useSchoolStructure';
import { useSubjectGroup } from '@/hooks/useSubjectGroup';

interface TeacherSubjectPanelProps {
  // Main props for the teacher subject panel
  teacher: TeacherProfile;
  allSubjects: Subject[];
  onEdit: () => void;
  onToggleStatus: () => void;
  onToggleSubject: (subjectId: string) => void;
}

const glassCard: React.CSSProperties = {
  background: 'rgba(255,255,255,0.72)',
  backdropFilter: 'blur(24px) saturate(150%)',
  WebkitBackdropFilter: 'blur(24px) saturate(150%)',
  border: '1px solid rgba(255,255,255,0.90)',
  boxShadow: '0 8px 32px rgba(0,0,0,0.06)',
};

export default function TeacherSubjectPanel({
  teacher,
  allSubjects,
  onToggleSubject,
}: TeacherSubjectPanelProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchGrade, setSearchGrade] = useState('all');
  const [searchGroup] = useState('all');
  const [searchDept, setSearchDept] = useState<Department | 'all'>('all');

  const [currentSearchPage, setCurrentSearchPage] = useState(1);
  const SEARCH_ITEMS_PER_PAGE = 6;

  const { departments } = useSchoolStructure();
  const { sortedGroups } = useSubjectGroup(allSubjects);





  const hasFilters = searchTerm.trim() !== '' || searchGrade !== 'all' || searchGroup !== 'all' || searchDept !== 'all';

  const filteredSubjects = useMemo(() => {
    if (!hasFilters) return [];

    return allSubjects.filter(s => {
      const matchSearch = !searchTerm || s.name.toLowerCase().includes(searchTerm.toLowerCase()) || s.code.toLowerCase().includes(searchTerm.toLowerCase());
      const matchDept = searchDept === 'all' || s.department === searchDept;
      const matchGrade = searchGrade === 'all' || s.gradeLevel === searchGrade;
      // Match group
      const matchGroup = searchGroup === 'all' || sortedGroups.find(g => g.id === searchGroup)?.subjectIds.includes(s.id);

      return matchSearch && matchDept && matchGrade && matchGroup;
    });
  }, [allSubjects, searchTerm, searchDept, searchGrade, searchGroup, sortedGroups, hasFilters]);

  const totalSearchPages = Math.ceil(filteredSubjects.length / SEARCH_ITEMS_PER_PAGE);
  const paginatedSubjects = filteredSubjects.slice((currentSearchPage - 1) * SEARCH_ITEMS_PER_PAGE, currentSearchPage * SEARCH_ITEMS_PER_PAGE);

  // Helpers to reset page
  const updateFilter = (fn: () => void) => {
    fn();
    setCurrentSearchPage(1);
  };

  return (
    <div className="flex flex-col h-full gap-3 min-h-0">
      {/* Unified Card: Teacher Info + Filters */}
      <div className="p-5 rounded-[2.2rem] shadow-sm shrink-0 space-y-5" style={glassCard}>
        {/* Row 2: Search Input */}
        <div className="relative group">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
          <Input
            value={searchTerm}
            onChange={e => updateFilter(() => setSearchTerm(e.target.value))}
            placeholder="ค้นหารหัสวิชา หรือ ชื่อวิชา..."
            className="h-9 pl-9 text-xs rounded-2xl bg-black/5 border-transparent focus-visible:ring-1 focus-visible:ring-blue-400 font-sukhumvit shadow-inner"
          />
        </div>

        {/* Row 3: Department Filter pills */}
        <div className="w-full">
          {searchDept === 'all' ? (
            <div className="flex items-center gap-1 p-1 rounded-full border border-slate-100 shadow-inner bg-slate-50/50">
              {departments.map(d => (
                <button
                  key={d.id}
                  onClick={() => updateFilter(() => { setSearchDept(d.id as any); setSearchGrade('all'); })}
                  className="flex-1 h-8 rounded-full text-[10px] font-bold transition-all text-slate-500 hover:text-slate-900 hover:bg-white shadow-sm hover:shadow-md"
                >
                  {d.label}
                </button>
              ))}
            </div>
          ) : (
            <button
              onClick={() => updateFilter(() => { setSearchDept('all'); setSearchGrade('all'); })}
              className="h-9 w-full rounded-full text-[11px] font-black bg-[#0f172a] text-white shadow-md flex items-center justify-center gap-2 group transition-all"
            >
              <X size={12} className="group-hover:rotate-90 transition-transform" />
              {departments.find(d => d.id === searchDept)?.label}
            </button>
          )}
        </div>
      </div>

        {/* Results List Area (Swipable) */}
        <div className="flex-1 flex flex-col min-h-0 mt-2 overflow-hidden relative">
          {!hasFilters ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-6 -mt-16">
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 0.6, scale: 1 }}
                className="flex flex-col items-center"
              >
                <BookOpen size={64} className="text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.5)] mb-4" />
                <p className="text-xl font-black text-white drop-shadow-md font-sukhumvit tracking-wide">ค้นหารายวิชา</p>
                <p className="text-sm font-medium text-white/80 drop-shadow-sm font-sarabun mt-1">เลือกแผนกเพื่อเริ่มต้นจัดการข้อมูล</p>
              </motion.div>
            </div>
          ) : paginatedSubjects.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-20 text-center opacity-40">
              <p className="text-xs font-black font-sukhumvit text-slate-400">ไม่พบวิชาที่ค้นหา</p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col min-h-0">
              {/* Swipable Grid Container */}
              <motion.div 
                key={currentSearchPage}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                onDragEnd={(_, info) => {
                  const threshold = 50;
                  if (info.offset.x < -threshold && currentSearchPage < totalSearchPages) {
                    setCurrentSearchPage(p => p + 1);
                  } else if (info.offset.x > threshold && currentSearchPage > 1) {
                    setCurrentSearchPage(p => p - 1);
                  }
                }}
                className="grid grid-cols-2 gap-2 px-1 py-1 cursor-grab active:cursor-grabbing content-start"
              >
                {paginatedSubjects.map(subject => {
                  const isAssigned = teacher.teachingSubjectIds.includes(subject.id);
                  const subjDeptCfg = DEPARTMENT_CONFIG[subject.department];
                  const catCfg = CATEGORY_CONFIG[subject.category];

                  return (
                    <div key={subject.id}>
                      <button
                        onClick={() => onToggleSubject(subject.id)}
                        className={`w-full min-h-[95px] flex flex-col justify-between p-2.5 rounded-xl transition-all text-left border relative overflow-hidden group pointer-events-auto ${isAssigned
                          ? 'bg-emerald-50/70 border-emerald-100 shadow-sm'
                          : 'bg-white/70 border-white/80 hover:border-blue-200 hover:shadow-lg'
                          }`}
                        style={{ backdropFilter: 'blur(10px)' }}
                      >
                        {/* Top: Code Badge */}
                        <div className="flex justify-between items-start">
                          <span className="font-mono text-[9px] font-black px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-500 shadow-inner">
                            {subject.code}
                          </span>
                        </div>

                        {/* Middle: Subject Name */}
                        <div className="flex-1 flex flex-col justify-center my-1.5">
                          <span className="text-[12px] font-black text-slate-800 leading-[1.3] line-clamp-2 font-sukhumvit">
                            {subject.name}
                          </span>
                          <span className="text-[8px] font-bold text-slate-400 mt-1 uppercase font-sarabun tracking-tighter">
                            {subjDeptCfg.label} • {catCfg.label}
                          </span>
                        </div>

                        {/* Bottom: Action Icon */}
                        <div className="flex justify-end">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${isAssigned
                            ? 'bg-emerald-500 text-white shadow-md rotate-45'
                            : 'bg-white text-blue-600 border border-slate-100 shadow-sm group-hover:bg-blue-600 group-hover:text-white'
                            }`}>
                            <Plus size={16} strokeWidth={3} />
                          </div>
                        </div>

                        {/* Subtle Glow for Assigned */}
                        {isAssigned && (
                          <div className="absolute -bottom-4 -right-4 w-12 h-12 bg-emerald-500/10 rounded-full blur-xl" />
                        )}
                      </button>
                    </div>
                  );
                })}
              </motion.div>

              {/* Pagination Dots Section */}
              {totalSearchPages > 1 && (
                <div className="py-2 flex flex-col items-center gap-1.5">
                  <div className="flex items-center gap-1.5">
                    {[...Array(totalSearchPages)].map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setCurrentSearchPage(i + 1)}
                        className={`h-1.5 rounded-full transition-all duration-300 ${
                          currentSearchPage === i + 1 
                          ? 'w-6 bg-blue-600 shadow-[0_0_8px_rgba(37,99,235,0.4)]' 
                          : 'w-1.5 bg-slate-200 hover:bg-slate-300'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
}
