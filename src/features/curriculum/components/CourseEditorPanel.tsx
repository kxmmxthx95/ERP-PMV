import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Pencil, Trash2, BookOpen, GraduationCap,
  Languages, Calculator, Atom, Globe, HeartPulse, Palette, Briefcase, MessageSquare, Sparkles,
  MoreHorizontal, FileSpreadsheet, ChevronDown
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  SUBJECT_GROUP_CONFIG, DEPARTMENT_CONFIG, COURSE_CATEGORY_CONFIG,
  type CurriculumVersion, type CurriculumCourse, type SubjectGroupId,
  type CourseCategory,
} from '@/types/curriculum';
import { SUBJECT_THEMES } from '../constants/subjectColors';

interface CourseEditorPanelProps {
  version: CurriculumVersion;
  courses: CurriculumCourse[];
  isLoading: boolean;
  onBack?: () => void;
  onAddCourse: () => void;
  onEditCourse: (course: CurriculumCourse) => void;
  onDeleteCourse: (course: CurriculumCourse) => void;
  onEditVersion: (version: CurriculumVersion) => void;
  onDeleteVersion: (version: CurriculumVersion) => void;
  onImportCSV?: () => void;
  onToggleEditMode?: (allow: boolean) => void;
  getCourseSummary: (versionId: string) => { count: number; totalCredit: number };
  searchQuery?: string;
  externalSearch?: string;
  onExternalSearchChange?: (val: string) => void;
  externalDept?: string;
  onExternalDeptChange?: (val: string) => void;
  externalGrade?: string;
  onExternalGradeChange?: (val: string) => void;
  externalCategory?: CourseCategory | 'all';
  onExternalCategoryChange?: (val: CourseCategory | 'all') => void;
  externalGroup?: string;
  onExternalGroupChange?: (val: string) => void;
  externalSemester?: number | 'all';
  onExternalSemesterChange?: (val: number | 'all') => void;
}

export default function CourseEditorPanel({
  version,
  courses,
  isLoading,
  onAddCourse,
  onEditCourse,
  onDeleteCourse,
  onEditVersion,
  onDeleteVersion,
  onImportCSV,
  externalSearch,
  externalDept,
  onExternalDeptChange,
  externalGrade,
  onExternalGradeChange,
  externalCategory,
  externalGroup,
  onExternalGroupChange,
  externalSemester,
}: CourseEditorPanelProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const effectiveSearch = externalSearch || '';

  const filteredCourses = useMemo(() => {
    return courses.filter(c => {
      // Search
      if (effectiveSearch) {
        const q = effectiveSearch.toLowerCase();
        const matchesSearch = c.courseName.toLowerCase().includes(q) || c.courseCode.toLowerCase().includes(q);
        if (!matchesSearch) return false;
      }

      // Department
      if (externalDept && externalDept !== 'all' && c.department !== externalDept) return false;

      // Grade Level
      if (externalGrade && externalGrade !== 'all' && c.gradeLevel !== externalGrade) return false;

      // Category
      if (externalCategory && externalCategory !== 'all' && c.category !== externalCategory) return false;

      // Subject Group
      if (externalGroup && externalGroup !== 'all' && c.subjectGroup !== externalGroup) return false;

      // Semester
      if (externalSemester && externalSemester !== 'all') {
        if (c.semester !== Number(externalSemester)) return false;
      }

      return true;
    }).sort((a, b) => (a.courseCode || '').localeCompare(b.courseCode || '', 'th'));
  }, [
    courses,
    effectiveSearch,
    externalDept,
    externalGrade,
    externalCategory,
    externalGroup,
    externalSemester
  ]);

  const totalPages = Math.ceil(filteredCourses.length / itemsPerPage);
  const paginated = filteredCourses.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const isSearching = effectiveSearch.length > 0 ||
    (externalDept && externalDept !== 'all') ||
    (externalGrade && externalGrade !== 'all') ||
    (externalCategory && externalCategory !== 'all') ||
    (externalGroup && externalGroup !== 'all') ||
    (externalSemester && externalSemester !== 'all');
  const showGhostCardOnThisPage = currentPage === 1 || paginated.length === 0;

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    const container = document.querySelector('.overflow-y-auto');
    if (container) container.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [effectiveSearch, externalDept, externalGrade, externalCategory, externalGroup, externalSemester]);

  const creditSummary = useMemo(() => {
    const res = {
      1: { basic: 0, additional: 0, activity: 0, total: 0 },
      2: { basic: 0, additional: 0, activity: 0, total: 0 },
    };

    filteredCourses.forEach(c => {
      const sem = c.semester === 2 ? 2 : 1;
      const cat = (c.category || 'basic') as 'basic' | 'additional' | 'activity';
      if (res[sem] && typeof res[sem][cat] === 'number') {
        res[sem][cat] += c.credit || 0;
        res[sem].total += c.credit || 0;
      }
    });

    return res;
  }, [filteredCourses]);

  return (
    <div className="flex flex-col h-full bg-white overflow-hidden relative font-sukhumvit">
      {/* ── Header ── */}
      <div className="px-8 pt-8 pb-4 bg-white relative">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-4">
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl flex items-center justify-center shrink-0">
              <GraduationCap className="text-white" size={28} strokeWidth={2} />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-[18px] font-bold text-slate-900 tracking-tight leading-none">
                  {version.name}
                </h2>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onAddCourse}
              disabled={!version.allowEdit}
              className={`flex items-center gap-2 px-6 py-2 rounded-full transition-all font-black text-[13px] font-sukhumvit ${version.allowEdit ? 'bg-[#f2f2f7] hover:bg-[#e5e5ea] text-blue-600' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
            >
              <Plus size={15} strokeWidth={3} />
              <span className="hidden lg:inline">เพิ่มรายวิชา</span>
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onEditVersion(version)}
              className="flex items-center gap-2 px-6 py-2 bg-[#f2f2f7] hover:bg-[#e5e5ea] text-blue-600 rounded-full transition-all font-black text-[13px] font-sukhumvit"
            >
              <Pencil size={15} strokeWidth={3} />
              <span className="hidden lg:inline">แก้ไขหลักสูตร</span>
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onImportCSV}
              className="flex items-center gap-2 px-6 py-2 bg-[#f2f2f7] hover:bg-[#e5e5ea] text-emerald-600 rounded-full transition-all font-black text-[13px] font-sukhumvit"
            >
              <FileSpreadsheet size={15} strokeWidth={3} />
              <span className="hidden lg:inline">นำเข้า CSV</span>
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onDeleteVersion(version)}
              className="flex items-center gap-2 px-6 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-full transition-all font-black text-[13px] font-sukhumvit"
            >
              <Trash2 size={15} strokeWidth={3} />
              <span className="hidden lg:inline">ลบหลักสูตร</span>
            </motion.button>
          </div>
        </div>

        {/* ── Credit Insight Panel ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map(sem => (
            <div key={sem} className="bg-slate-50/50 rounded-2xl p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-slate-900 text-white rounded-lg flex items-center justify-center text-[10px] font-black">
                    {sem}
                  </div>
                  <span className="text-[11px] font-black text-slate-800 uppercase tracking-widest">ภาคเรียนที่ {sem}</span>
                </div>
                <div className="text-[12px] font-black text-slate-900">
                  <span className="text-slate-400 font-bold mr-1 text-[10px]">TOTAL</span>
                  {creditSummary[sem as 1 | 2].total.toFixed(1)} <span className="text-[9px] opacity-50">นก.</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {(['basic', 'additional', 'activity'] as const).map(cat => {
                  const cfg = COURSE_CATEGORY_CONFIG[cat];
                  const val = creditSummary[sem as 1 | 2][cat];
                  return (
                    <div key={cat} className="flex flex-col gap-1">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter truncate">
                        {cfg.label.replace('วิชา', '')}
                      </span>
                      <div className="flex items-baseline gap-1">
                        <span className="text-[13px] font-black text-slate-800">{val.toFixed(1)}</span>
                        <span className="text-[8px] font-bold text-slate-400">นก.</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="h-px bg-slate-100 mx-8" />

      {/* ── Sliding List Container ── */}
      <div className="flex-1 relative overflow-hidden flex flex-col">
        <div className="flex-1 relative overflow-x-auto scrollbar-hide">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentPage}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="w-full flex flex-col min-w-[800px]"
            >
              {/* List Header */}
              {isSearching && paginated.length > 0 && (
                <div className="flex items-center px-4 py-3 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-white sticky top-0 z-30 font-sarabun">
                  <div className="w-16 shrink-0 text-center">#</div>
                  <div className="flex-1 min-w-0 px-4">รายวิชา</div>

                  {/* Dept Filter */}
                  <div className="w-40 shrink-0 px-4 flex items-center justify-center gap-1 group/header">
                    <select
                      value={externalDept || 'all'}
                      onChange={(e) => onExternalDeptChange?.(e.target.value)}
                      className="appearance-none bg-transparent hover:bg-slate-50 px-2 py-1 rounded cursor-pointer outline-none text-center font-black transition-colors"
                    >
                      <option value="all">แผนก</option>
                      {Object.entries(DEPARTMENT_CONFIG).map(([id, d]) => (
                        <option key={id} value={id}>{d.label}</option>
                      ))}
                    </select>
                    <ChevronDown size={10} className="text-slate-300" />
                  </div>

                  {/* Grade Filter */}
                  <div className="w-32 shrink-0 px-4 flex items-center justify-center gap-1 group/header">
                    <select
                      value={externalGrade || 'all'}
                      onChange={(e) => onExternalGradeChange?.(e.target.value)}
                      className="appearance-none bg-transparent hover:bg-slate-50 px-2 py-1 rounded cursor-pointer outline-none text-center font-black transition-colors"
                    >
                      <option value="all">ชั้น</option>
                      {externalDept !== 'all' && DEPARTMENT_CONFIG[externalDept as keyof typeof DEPARTMENT_CONFIG]?.grades.map(g => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                    <ChevronDown size={10} className="text-slate-300" />
                  </div>

                  {/* Group Filter */}
                  <div className="w-64 shrink-0 px-4 flex items-center gap-1 group/header">
                    <select
                      value={externalGroup || 'all'}
                      onChange={(e) => onExternalGroupChange?.(e.target.value)}
                      className="appearance-none bg-transparent hover:bg-slate-50 px-2 py-1 rounded cursor-pointer outline-none font-black transition-colors max-w-full truncate"
                    >
                      <option value="all">กลุ่มสาระทั้งหมด</option>
                      {Object.entries(SUBJECT_GROUP_CONFIG).map(([id, g]) => (
                        <option key={id} value={id}>{g.name}</option>
                      ))}
                    </select>
                    <ChevronDown size={10} className="text-slate-300 shrink-0" />
                  </div>

                  <div className="w-32 shrink-0 px-4 text-center">หน่วยกิต</div>
                  <div className="w-20 shrink-0"></div>
                </div>
              )}

              {courses.length === 0 && !isLoading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4 text-slate-500">
                  <div className="w-20 h-20 rounded-full bg-black/5 flex items-center justify-center">
                    <BookOpen size={40} strokeWidth={1.5} />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-black font-sukhumvit">ยังไม่มีรายวิชาในหลักสูตรนี้</p>
                    <p className="text-[10px] font-medium font-sarabun mt-1">กดปุ่ม "เพิ่มรายวิชา" เพื่อเริ่มสร้างหลักสูตร</p>
                  </div>
                </div>
              ) : isLoading ? (
                [...Array(8)].map((_, i) => (
                  <div key={i} className="flex items-center px-4 py-4 border-b border-slate-50 gap-4">
                    <Skeleton className="w-10 h-10 rounded-lg bg-slate-100" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-1/3 bg-slate-100" />
                      <Skeleton className="h-3 w-1/4 bg-slate-50" />
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex flex-col">
                  {paginated.length === 0 && !showGhostCardOnThisPage ? (
                    <motion.div
                      key="no-results"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="py-20 flex flex-col items-center justify-center"
                    >
                      <BookOpen size={28} className="text-black/15 mb-3" />
                      <p className="text-sm font-bold text-black/25 font-sukhumvit">ไม่พบรายวิชา</p>
                    </motion.div>
                  ) : (
                    <>
                      {paginated.map((course, index) => (
                        <CourseCard
                          key={course.id}
                          course={course}
                          index={(currentPage - 1) * itemsPerPage + index + 1}
                          canEdit={version.allowEdit}
                          onEdit={() => onEditCourse(course)}
                          onDelete={() => onDeleteCourse(course)}
                        />
                      ))}

                      {showGhostCardOnThisPage && version.allowEdit && (
                        <motion.button
                          onClick={onAddCourse}
                          whileHover={{ backgroundColor: 'rgba(0,0,0,0.02)' }}
                          className="flex items-center px-4 py-4 group transition-colors border-b border-slate-50 cursor-pointer text-left"
                        >
                          <div className="w-16 shrink-0 flex justify-center">
                            <Plus size={16} className="text-slate-300 group-hover:text-slate-900 transition-colors" />
                          </div>
                          <div className="flex-1 px-4">
                            <span className="text-sm font-black font-sukhumvit text-slate-300 group-hover:text-slate-900 transition-colors tracking-wide">เพิ่มรายวิชาใหม่...</span>
                          </div>
                        </motion.button>
                      )}
                    </>
                  )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* ── Pagination Dots ── */}
        {!isLoading && totalPages > 1 && (
          <div className="py-8 flex justify-center items-center gap-2">
            {[...Array(totalPages)].map((_, i) => (
              <button
                key={i}
                onClick={() => handlePageChange(i + 1)}
                className="group relative p-1 transition-all"
              >
                <div
                  className={`h-1.5 rounded-full transition-all duration-500 ${currentPage === i + 1
                    ? 'w-8 bg-slate-900 shadow-lg'
                    : 'w-1.5 bg-slate-900/20 group-hover:bg-slate-900/40'
                    }`}
                />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const THEME_COLORS: Record<string, string[]> = {
  blue: ['#3b82f6', '#60a5fa', '#2563eb'],
  emerald: ['#10b981', '#34d399', '#059669'],
  sky: ['#0ea5e9', '#38bdf8', '#0284c7'],
  rose: ['#f43f5e', '#fb7185', '#e11d48'],
  orange: ['#f97316', '#fb923c', '#ea580c'],
  purple: ['#a855f7', '#c084fc', '#9333ea'],
  red: ['#ef4444', '#f87171', '#dc2626'],
  stone: ['#78716c', '#a8a29e', '#57534e'],
  gray: ['#6b7280', '#9ca3af', '#4b5563'],
};

function CourseCard({
  course,
  index,
  canEdit,
  onEdit,
  onDelete,
}: {
  course: CurriculumCourse;
  index: number;
  canEdit: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const groupCfg = SUBJECT_GROUP_CONFIG[(course.subjectGroup || 'other') as SubjectGroupId] || SUBJECT_GROUP_CONFIG.other;

  const themeKey = (Object.entries(SUBJECT_THEMES).find(([key]) => {
    if (!groupCfg) return false;
    const name = groupCfg.name?.toLowerCase() || '';
    const nameEn = groupCfg.nameEn?.toLowerCase() || '';
    return name.includes(key) || nameEn.includes(key);
  })?.[1] || 'gray') as string;

  const colors = THEME_COLORS[themeKey] || THEME_COLORS.gray;

  return (
    <motion.div
      className="group flex items-center px-4 py-3 hover:bg-blue-600 transition-all border border-transparent border-b-slate-50/50 hover:shadow-md hover:z-10 rounded-xl relative cursor-pointer"
    >
      {/* Index */}
      <div className="w-16 shrink-0 flex items-center justify-center text-[11px] font-black text-slate-400 group-hover:text-blue-100 font-sarabun transition-colors">
        {index}
      </div>

      {/* Course Main Info */}
      <div className="flex-1 min-w-0 px-4 flex items-center gap-4">
        {/* Thumbnail */}
        <div
          className="w-10 h-10 rounded-lg shrink-0 flex items-center justify-center shadow-sm"
          style={{
            background: `linear-gradient(135deg, ${colors[0]}, ${colors[1]})`
          }}
        >
          {(() => {
            const isAdditional = course.category === 'additional';
            const isActivity = course.category === 'activity';

            let iconColor = '#FFFFFF';
            if (isAdditional) iconColor = '#FFD700';
            else if (isActivity) iconColor = '#8B4513';

            const iconProps = {
              size: 18,
              className: isAdditional ? "opacity-100 shadow-[0_0_8px_rgba(255,215,0,0.4)]" : "opacity-90",
              color: iconColor
            };
            const group = (course.subjectGroup || '').toLowerCase();
            if (group.includes('thai')) return <Languages {...iconProps} />;
            if (group.includes('math')) return <Calculator {...iconProps} />;
            if (group.includes('science')) return <Atom {...iconProps} />;
            if (group.includes('social')) return <Globe {...iconProps} />;
            if (group.includes('health') || group.includes('pe')) return <HeartPulse {...iconProps} />;
            if (group.includes('art')) return <Palette {...iconProps} />;
            if (group.includes('career')) return <Briefcase {...iconProps} />;
            if (group.includes('foreign') || group.includes('lang')) return <MessageSquare {...iconProps} />;
            if (group.includes('activity') || group.includes('other')) return <Sparkles {...iconProps} />;
            return <BookOpen {...iconProps} />;
          })()}
        </div>

        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-black text-slate-900 group-hover:text-white transition-colors font-sukhumvit truncate">
            {course.courseName}
          </h4>
          <p className="text-[10px] font-bold text-slate-400 group-hover:text-blue-100 transition-colors font-sarabun uppercase tracking-tight">
            {course.courseCode} · {course.category === 'basic' ? 'พื้นฐาน' : course.category === 'additional' ? 'เพิ่มเติม' : 'กิจกรรม'}
          </p>
        </div>
      </div>

      {/* Department */}
      <div className="w-40 shrink-0 px-4 text-center">
        <span className="inline-block px-3 py-1 bg-slate-50 text-slate-500 group-hover:bg-white/20 group-hover:text-white group-hover:border-transparent transition-colors text-[10px] font-bold rounded-lg border border-slate-100 font-sukhumvit uppercase tracking-tight">
          {course.department === 'primary' ? 'ประถม' : course.department === 'secondary' ? 'มัธยม' : 'อนุบาล'}
        </span>
      </div>

      {/* Grade Level */}
      <div className="w-32 shrink-0 px-4 text-center">
        <p className="text-xs font-black text-slate-900 group-hover:text-white transition-colors font-sukhumvit">
          {course.gradeLevel || '-'}
        </p>
      </div>

      {/* Subject Group */}
      <div className="w-64 shrink-0 px-4">
        <p className="text-xs font-medium text-slate-500 group-hover:text-blue-100 transition-colors font-sukhumvit truncate">
          {groupCfg.name}
        </p>
      </div>

      {/* Credits */}
      <div className="w-32 shrink-0 px-4 text-center">
        <p className="text-xs font-black text-slate-900 group-hover:text-white transition-colors font-sarabun">
          {course.credit.toFixed(1)}
        </p>
      </div>

      {/* Actions */}
      <div className="w-20 shrink-0 flex justify-center">
        {canEdit ? (
          <div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  onClick={(e) => e.stopPropagation()}
                  className="p-2 hover:bg-slate-200 group-hover:text-white group-hover:hover:bg-white/20 rounded-full text-slate-600 transition-colors focus:outline-none"
                >
                  <MoreHorizontal size={16} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40 rounded-xl bg-white/90 backdrop-blur-xl border-slate-200/50 shadow-xl">
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(); }} className="gap-2 cursor-pointer rounded-lg text-[13px] font-medium font-sarabun text-slate-700">
                  <Pencil size={14} className="text-blue-500" />
                  <span>แก้ไขข้อมูล</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDelete(); }} className="gap-2 cursor-pointer rounded-lg text-[13px] font-medium font-sarabun text-rose-600 hover:text-rose-700 hover:bg-rose-50 focus:text-rose-700 focus:bg-rose-50">
                  <Trash2 size={14} />
                  <span>ลบรายวิชา</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : (
          <MoreHorizontal size={16} className="text-slate-300" />
        )}
      </div>
    </motion.div>
  );
}
