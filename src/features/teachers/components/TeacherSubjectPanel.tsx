import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  HiBookOpen,
  HiMagnifyingGlass,
  HiXMark,
  HiPlus,
  HiLanguage,
  HiCalculator,
  HiBeaker,
  HiGlobeAmericas,
  HiHeart,
  HiPaintBrush,
  HiBriefcase,
  HiChatBubbleLeftRight,
  HiSparkles,
} from 'react-icons/hi2';
import { Input } from '@/components/ui/input';
import type { TeacherProfile } from '@/types/teacher';
import type { Subject, Department } from '@/types/curriculum';
import { DEPARTMENT_CONFIG, SUBJECT_GROUP_CONFIG, type SubjectGroupId } from '@/types/curriculum';
import { useSchoolStructure } from '@/hooks/useSchoolStructure';
import { useSubjectGroup } from '@/hooks/useSubjectGroup';
import { SUBJECT_THEMES } from '@/features/curriculum/constants/subjectColors';

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

const CATEGORY_STYLE = {
  basic: { bg: 'bg-sky-50', text: 'text-sky-600', dot: 'bg-sky-400', label: 'พื้นฐาน' },
  additional: { bg: 'bg-amber-50', text: 'text-amber-600', dot: 'bg-amber-400', label: 'เพิ่มเติม' },
  activity: { bg: 'bg-emerald-50', text: 'text-emerald-600', dot: 'bg-emerald-400', label: 'กิจกรรม' },
} as const;

const THEME_COLORS: Record<string, [string, string]> = {
  blue: ['#3b82f6', '#eff6ff'],
  emerald: ['#10b981', '#ecfdf5'],
  sky: ['#0ea5e9', '#f0f9ff'],
  rose: ['#f43f5e', '#fff1f2'],
  orange: ['#f97316', '#fff7ed'],
  purple: ['#a855f7', '#faf5ff'],
  red: ['#ef4444', '#fef2f2'],
  stone: ['#78716c', '#fafaf9'],
  gray: ['#6b7280', '#f9fafb'],
};

const getSubjectVisual = (subject: Subject) => {
  const groupCfg = SUBJECT_GROUP_CONFIG[(subject.subjectGroup || 'other') as SubjectGroupId] || SUBJECT_GROUP_CONFIG.other;
  const themeKey = (Object.entries(SUBJECT_THEMES).find(([key]) => {
    const name = groupCfg.name?.toLowerCase() || '';
    const nameEn = groupCfg.nameEn?.toLowerCase() || '';
    return name.includes(key) || nameEn.includes(key);
  })?.[1] || 'gray') as string;
  const colors = THEME_COLORS[themeKey] || THEME_COLORS.gray;

  const group = (subject.subjectGroup || '').toLowerCase();
  if (group.includes('thai')) return { Icon: HiLanguage, colors };
  if (group.includes('math')) return { Icon: HiCalculator, colors };
  if (group.includes('science')) return { Icon: HiBeaker, colors };
  if (group.includes('social')) return { Icon: HiGlobeAmericas, colors };
  if (group.includes('health') || group.includes('pe')) return { Icon: HiHeart, colors };
  if (group.includes('art')) return { Icon: HiPaintBrush, colors };
  if (group.includes('career')) return { Icon: HiBriefcase, colors };
  if (group.includes('foreign') || group.includes('lang')) return { Icon: HiChatBubbleLeftRight, colors };
  if (group.includes('activity') || group.includes('other')) return { Icon: HiSparkles, colors };
  return { Icon: HiBookOpen, colors };
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
          <HiMagnifyingGlass size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
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
              <HiXMark size={12} className="group-hover:rotate-90 transition-transform" />
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
                <HiBookOpen size={64} className="text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.5)] mb-4" />
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
                className="grid grid-cols-1 gap-1.5 px-1 py-1 cursor-grab active:cursor-grabbing content-start"
              >
                {paginatedSubjects.map(subject => {
                  const isAssigned = teacher.teachingSubjectIds.includes(subject.id);
                  const catCfg = CATEGORY_STYLE[subject.category as keyof typeof CATEGORY_STYLE] || CATEGORY_STYLE.basic;
                  const deptCfg = DEPARTMENT_CONFIG[subject.department];
                  const { Icon: SubjectIcon, colors } = getSubjectVisual(subject);
                  const [mainColor, softColor] = colors;

                  return (
                    <div key={subject.id}>
                      <button
                        onClick={() => onToggleSubject(subject.id)}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all text-left border relative overflow-hidden group pointer-events-auto ${
                          isAssigned
                            ? 'bg-slate-50/60 border-black/[0.06]'
                            : 'bg-transparent border-black/[0.03] hover:bg-slate-50/50 hover:border-black/[0.05]'
                        }`}
                      >
                        <div
                          className="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center shadow-sm transition-all"
                          style={{ background: `linear-gradient(135deg, ${softColor} 0%, ${mainColor} 100%)` }}
                        >
                          <SubjectIcon size={17} style={{ color: 'white' }} />
                        </div>

                        <div className="flex-1 min-w-0">
                          <h4 className="text-[13px] font-black text-slate-800 tracking-tight leading-tight truncate">
                            {subject.name}
                          </h4>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                            {subject.code} · {deptCfg.label}
                          </p>
                        </div>

                        <div className="w-20 shrink-0 flex justify-center">
                          <span className={`inline-flex items-center gap-1 text-[9px] font-black px-2 py-1 rounded-full ${catCfg.bg} ${catCfg.text}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${catCfg.dot}`} />
                            {catCfg.label}
                          </span>
                        </div>

                        <div className={`w-8 h-8 rounded-full flex items-center justify-center border transition-all ${
                          isAssigned
                            ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm'
                            : 'bg-white border-slate-200 text-slate-400 group-hover:border-blue-200 group-hover:text-blue-600'
                        }`}>
                          <HiPlus size={14} className={isAssigned ? 'rotate-45' : ''} />
                        </div>
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
