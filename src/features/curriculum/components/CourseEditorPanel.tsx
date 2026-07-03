import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  HiPlus, HiPencil, HiTrash, HiBookOpen, HiAcademicCap,
  HiEllipsisHorizontal, HiTableCells, HiChevronDown, HiLockClosed, HiLockOpen, HiMagnifyingGlass, HiArrowPath, HiXMark,
  HiOutlineLanguage, HiOutlineCalculator, HiOutlineBeaker, HiOutlineGlobeAsiaAustralia, HiOutlineHeart, HiOutlinePaintBrush,
  HiOutlineBriefcase, HiOutlineChatBubbleLeftRight, HiOutlineSparkles, HiOutlineBookOpen
} from 'react-icons/hi2';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  SUBJECT_GROUP_CONFIG,
  type CurriculumVersion, type CurriculumCourse, type SubjectGroupId,
  type CourseCategory,
} from '@/types/curriculum';

interface CourseEditorPanelProps {
  version: CurriculumVersion;
  courses: CurriculumCourse[];
  isLoading: boolean;
  readOnly?: boolean;
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

const CATEGORY_STYLE = {
  basic: { bg: 'bg-sky-50', text: 'text-sky-600', dot: 'bg-sky-400', label: 'พื้นฐาน' },
  additional: { bg: 'bg-amber-50', text: 'text-amber-600', dot: 'bg-amber-400', label: 'เพิ่มเติม' },
  activity: { bg: 'bg-emerald-50', text: 'text-emerald-600', dot: 'bg-emerald-400', label: 'กิจกรรม' },
} as const;

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 40 : -40,
    opacity: 0,
    scale: 0.99,
  }),
  center: {
    x: 0,
    opacity: 1,
    scale: 1,
    transition: {
      x: { type: 'spring' as const, stiffness: 350, damping: 32 },
      opacity: { duration: 0.25 },
      scale: { duration: 0.25 },
      staggerChildren: 0.02,
      delayChildren: 0.05,
    },
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -40 : 40,
    opacity: 0,
    scale: 0.99,
    transition: {
      x: { type: 'spring' as const, stiffness: 350, damping: 32 },
      opacity: { duration: 0.2 },
      scale: { duration: 0.2 },
    },
  }),
};

const cardAnim = {
  enter: { opacity: 0, y: 8 },
  center: { opacity: 1, y: 0, transition: { duration: 0.18 } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.15 } },
};

export default function CourseEditorPanel({
  version,
  courses,
  isLoading,
  readOnly = false,
  onAddCourse,
  onEditCourse,
  onDeleteCourse,
  onEditVersion,
  onImportCSV,
  onToggleEditMode,
  externalSearch,
  onExternalSearchChange,
  externalDept,
  externalGrade,
  externalCategory,
  onExternalCategoryChange,
  externalGroup,
  onExternalGroupChange,
  externalSemester,
  onExternalSemesterChange,
}: CourseEditorPanelProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [localSearch, setLocalSearch] = useState(externalSearch || '');
  const [isSearchActive, setIsSearchActive] = useState(!!(externalSearch || (externalSearch === undefined && localSearch)));
  const itemsPerPage = 20;

  const [direction, setDirection] = useState(1);
  const [prevRank, setPrevRank] = useState(0);

  const currentRank = useMemo(() => {
    let semScore = 0;
    if (externalSemester === 1) semScore = 1;
    else if (externalSemester === 2) semScore = 2;

    let catScore = 0;
    if (externalCategory === 'basic') catScore = 1;
    else if (externalCategory === 'additional') catScore = 2;
    else if (externalCategory === 'activity') catScore = 3;

    return semScore * 10000 + catScore * 1000 + currentPage;
  }, [externalSemester, externalCategory, currentPage]);

  useEffect(() => {
    if (currentRank !== prevRank) {
      setDirection(currentRank > prevRank ? 1 : -1);
      setPrevRank(currentRank);
    }
  }, [currentRank, prevRank]);

  const effectiveSearch = externalSearch !== undefined ? externalSearch : localSearch;

  const filteredCourses = useMemo(() => {
    return courses.filter(c => {
      if (effectiveSearch) {
        const q = effectiveSearch.toLowerCase();
        const matchesSearch = c.courseName.toLowerCase().includes(q) || c.courseCode.toLowerCase().includes(q);
        if (!matchesSearch) return false;
      }
      if (externalDept && externalDept !== 'all' && c.department !== externalDept) return false;
      if (externalGrade && externalGrade !== 'all' && c.gradeLevel !== externalGrade) return false;
      if (externalCategory && externalCategory !== 'all' && c.category !== externalCategory) return false;
      if (externalGroup && externalGroup !== 'all' && c.subjectGroup !== externalGroup) return false;
      if (externalSemester && externalSemester !== 'all') {
        if (c.semester !== Number(externalSemester)) return false;
      }
      return true;
    }).sort((a, b) => (a.courseCode || '').localeCompare(b.courseCode || '', 'th'));
  }, [courses, effectiveSearch, externalDept, externalGrade, externalCategory, externalGroup, externalSemester]);

  const totalPages = Math.ceil(filteredCourses.length / itemsPerPage);
  const paginated = filteredCourses.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);





  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    const container = document.querySelector('.overflow-y-auto');
    if (container) container.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [effectiveSearch, externalDept, externalGrade, externalCategory, externalGroup, externalSemester]);

  // Credit summary by semester
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

  const summary = {
    totalCourses: filteredCourses.length,
    totalCredits: filteredCourses.reduce((s, c) => s + (c.credit || 0), 0),
  };

  return (
    <div className="flex flex-col h-full overflow-hidden relative font-sukhumvit">

      {/* ── Compact Header Strip ── */}
      <div className="flex-shrink-0 mb-4">
        {/* Title + Actions Row */}
        <div className="flex flex-wrap xl:flex-nowrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3 min-w-0 order-1">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shrink-0 shadow-md">
              <HiAcademicCap className="text-white" size={20} />
            </div>
            <div className="min-w-0">
              <h2 className="text-[16px] font-black text-slate-900 tracking-tight leading-none truncate">
                {version.name}
              </h2>
              <p className="text-[10px] font-medium text-slate-400 mt-0.5">
                {summary.totalCourses} วิชา · {summary.totalCredits.toFixed(1)} หน่วยกิต
                {!version.allowEdit && (
                  <span className="inline-flex items-center gap-1 ml-2 text-amber-500">
                    <HiLockClosed size={9} />ล็อก
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Filters Capsule */}
          <motion.div
            layout
            className={`order-3 xl:order-2 w-full xl:w-auto flex items-center gap-1 h-8 border p-0.5 rounded-full backdrop-blur-sm shadow-sm pointer-events-auto overflow-x-auto scrollbar-hide transition-all duration-305 ${
              isSearchActive
                ? 'bg-blue-50/90 border-blue-100'
                : 'bg-white/60 border-slate-200/80'
            }`}
          >
            <AnimatePresence mode="wait">
              {isSearchActive ? (
                <motion.div
                  key="search-active"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="flex items-center gap-1.5 px-2 w-[180px] sm:w-[240px] h-full"
                >
                  <HiMagnifyingGlass size={13} className="text-slate-400 flex-shrink-0" />
                  <input
                    type="text"
                    placeholder="ค้นหาวิชา หรือรหัสวิชา..."
                    value={effectiveSearch}
                    autoFocus
                    onChange={(e) => {
                      if (onExternalSearchChange) onExternalSearchChange(e.target.value);
                      else setLocalSearch(e.target.value);
                    }}
                    className="bg-transparent text-[10px] font-black text-slate-800 placeholder:text-slate-400 outline-none w-full font-sukhumvit"
                  />
                  <button
                    onClick={() => {
                      if (onExternalSearchChange) onExternalSearchChange('');
                      else setLocalSearch('');
                      setIsSearchActive(false);
                    }}
                    className="flex items-center justify-center w-5 h-5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-black/5 transition-all flex-shrink-0"
                    title="ปิดการค้นหา"
                  >
                    <HiXMark size={12} />
                  </button>
                </motion.div>
              ) : (
                <motion.div
                  key="filters-active"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="flex items-center gap-1 min-w-0"
                >
                  <button
                    onClick={() => {
                      onExternalCategoryChange?.('all');
                      onExternalSemesterChange?.('all');
                      onExternalGroupChange?.('all');
                    }}
                    className="flex items-center justify-center w-7 h-7 rounded-full hover:bg-rose-50 text-rose-500 hover:text-rose-600 transition-all border-r border-slate-200/80 pr-0.5 shrink-0"
                    title="ล้างตัวกรอง"
                  >
                    <HiArrowPath size={13} />
                  </button>

                  <div className="flex items-center gap-1 min-w-0">
                    <div className="relative shrink-0">
                      <select
                        value={externalSemester || 'all'}
                        onChange={(e) => onExternalSemesterChange?.(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                        className="appearance-none pl-3 pr-6 py-1 bg-transparent hover:bg-slate-50 text-slate-700 transition-all font-black text-[10px] outline-none cursor-pointer rounded-full"
                      >
                        <option value="all">ทุกเทอม</option>
                        <option value="1">เทอม 1</option>
                        <option value="2">เทอม 2</option>
                      </select>
                      <HiChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={10} />
                    </div>

                    <div className="w-px h-3.5 bg-slate-200 shrink-0" />

                    <div className="relative shrink-0 max-w-[120px]">
                      <select
                        value={externalGroup || 'all'}
                        onChange={(e) => onExternalGroupChange?.(e.target.value)}
                        className="appearance-none pl-3 pr-6 py-1 bg-transparent hover:bg-slate-50 text-slate-700 transition-all font-black text-[10px] outline-none cursor-pointer rounded-full truncate"
                      >
                        <option value="all">ทุกกลุ่มสาระ</option>
                        {Object.entries(SUBJECT_GROUP_CONFIG).map(([id, group]) => (
                          <option key={id} value={id}>{group.name}</option>
                        ))}
                      </select>
                      <HiChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={10} />
                    </div>

                    <div className="w-px h-3.5 bg-slate-200 shrink-0" />

                    <div className="relative shrink-0">
                      <select
                        value={externalCategory || 'all'}
                        onChange={(e) => onExternalCategoryChange?.(e.target.value as any)}
                        className="appearance-none pl-3 pr-6 py-1 bg-transparent hover:bg-slate-50 text-slate-700 transition-all font-black text-[10px] outline-none cursor-pointer rounded-full"
                      >
                        <option value="all">ทุกหมวด</option>
                        <option value="basic">พื้นฐาน</option>
                        <option value="additional">เพิ่มเติม</option>
                        <option value="activity">กิจกรรม</option>
                      </select>
                      <HiChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={10} />
                    </div>
                  </div>

                  <div className="w-px h-3.5 bg-slate-200 shrink-0 mx-0.5" />

                  {/* Search Toggle Button */}
                  <button
                    onClick={() => setIsSearchActive(true)}
                    className="flex items-center justify-center w-7 h-7 rounded-full hover:bg-slate-100 text-slate-600 hover:text-slate-800 transition-all shrink-0 cursor-pointer"
                    title="ค้นหา"
                  >
                    <HiMagnifyingGlass size={13} />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Action buttons — hidden for read-only roles */}
          {!readOnly && (
            <div className="flex items-center gap-2 shrink-0 order-2 xl:order-3">
              {onToggleEditMode && (
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={() => onToggleEditMode(!version.allowEdit)}
                  className={`flex items-center justify-center gap-1.5 h-8 w-8 md:w-auto md:px-3 rounded-full text-[11px] font-black transition-all ${
                    version.allowEdit
                      ? 'bg-amber-50 text-amber-600 hover:bg-amber-100'
                      : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                  }`}
                  title={version.allowEdit ? 'ล็อก' : 'ปลดล็อก'}
                >
                  {version.allowEdit ? <HiLockClosed size={14} /> : <HiLockOpen size={14} />}
                  <span className="hidden md:inline">{version.allowEdit ? 'ล็อก' : 'ปลดล็อก'}</span>
                </motion.button>
              )}
              {onImportCSV && (
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={onImportCSV}
                  className="flex items-center justify-center gap-1.5 h-8 w-8 md:w-auto md:px-3 rounded-full bg-white border border-slate-200 text-slate-600 text-[11px] font-black hover:bg-slate-50 transition-all shadow-sm"
                  title="นำเข้า"
                >
                  <HiTableCells size={14} />
                  <span className="hidden md:inline">นำเข้า</span>
                </motion.button>
              )}
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={() => onEditVersion(version)}
                className="flex items-center justify-center gap-1.5 h-8 w-8 md:w-auto md:px-3 rounded-full bg-white border border-slate-200 text-slate-600 text-[11px] font-black hover:bg-slate-50 transition-all shadow-sm"
                title="แก้ไข"
              >
                <HiPencil size={14} />
                <span className="hidden md:inline">แก้ไข</span>
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={onAddCourse}
                disabled={!version.allowEdit}
                className={`flex items-center justify-center gap-1.5 h-8 w-8 md:w-auto md:px-4 rounded-full text-[11px] font-black transition-all shadow-sm ${
                  version.allowEdit
                    ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-500/20'
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                }`}
                title="เพิ่มวิชา"
              >
                <HiPlus size={15} className="stroke-[2px]" />
                <span className="hidden md:inline">เพิ่มวิชา</span>
              </motion.button>
            </div>
          )}
        </div>

        {/* ── Credit Summary Cards ── */}
        <div className="flex lg:grid lg:grid-cols-2 overflow-x-auto lg:overflow-visible snap-x snap-mandatory scrollbar-hide gap-3 mb-1 md:mb-4">
          {([1, 2] as const).map(sem => (
            <div
              key={sem}
              className="w-full lg:w-auto shrink-0 snap-center rounded-[1.25rem] border border-slate-100 bg-white/80 hover:bg-white shadow-sm transition-colors p-4"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 bg-blue-600 text-white rounded-md flex items-center justify-center text-[10px] font-black">
                    {sem}
                  </div>
                  <span className="text-[11px] font-black text-slate-600 uppercase tracking-wider">ภาคเรียน {sem}</span>
                </div>
                <span className="text-[12px] font-black text-slate-900">
                  {creditSummary[sem].total.toFixed(1)}
                  <span className="text-[9px] font-bold text-slate-400 ml-0.5">นก.</span>
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {(['basic', 'additional', 'activity'] as const).map(cat => {
                  const catStyle = CATEGORY_STYLE[cat];
                  const val = creditSummary[sem][cat];
                  return (
                    <div key={cat} className={`rounded-xl px-2.5 py-2 ${catStyle.bg}`}>
                      <div className={`flex items-center gap-1 mb-1`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${catStyle.dot}`} />
                        <span className={`text-[9px] font-bold uppercase tracking-tight ${catStyle.text}`}>
                          {catStyle.label}
                        </span>
                      </div>
                      <span className="text-[14px] font-black text-slate-800">{val.toFixed(1)}</span>
                      <span className="text-[8px] font-bold text-slate-400 ml-0.5">นก.</span>
                    </div>
                  );
                })}
              </div>
              </div>
            ))}
        </div>
      </div>
      {/* ── Course List ── */}
      <div className="flex-1 min-h-0 relative overflow-hidden flex flex-col">
        {/* Clean, permanent table header bar */}
        <div className="hidden md:grid grid-cols-[1fr_6rem_12rem_5rem_5rem_4rem] items-center gap-3 px-5 py-2.5 text-[10px] font-black text-slate-500 uppercase tracking-widest bg-slate-100 rounded-xl mb-1.5 shrink-0">
          <div className="px-4">รายวิชา</div>
          <div className="text-center">ชั้นเรียน</div>
          <div className="px-3">กลุ่มสาระ</div>
          <div className="text-center">คาบ</div>
          <div className="text-center">หน่วยกิต</div>
          <div className="text-center">การจัดการ</div>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-hide">
          <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={`${externalSemester}-${externalCategory}-${externalGroup}-${currentPage}`}
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                className="flex flex-col gap-1.5 pb-4 w-full"
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.8}
                onDragEnd={(_, { offset }) => {
                  const swipe = offset.x;
                  if (swipe < -50 && currentPage < totalPages) {
                    handlePageChange(currentPage + 1);
                  } else if (swipe > 50 && currentPage > 1) {
                    handlePageChange(currentPage - 1);
                  }
                }}
              >
              {courses.length === 0 && !isLoading ? (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col items-center justify-center py-24 gap-5"
                >
                  <div className="w-20 h-20 rounded-3xl bg-slate-50 flex items-center justify-center">
                    <HiBookOpen size={36} className="text-slate-200" />
                  </div>
                  <div className="text-center">
                    <p className="text-[13px] font-black text-slate-400">ยังไม่มีรายวิชาในหลักสูตรนี้</p>
                    <p className="text-[11px] text-slate-300 mt-1">กดปุ่ม "เพิ่มวิชา" เพื่อเริ่มสร้างหลักสูตร</p>
                  </div>
                  {version.allowEdit && (
                    <motion.button
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={onAddCourse}
                      className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-full text-[12px] font-black shadow-lg hover:bg-blue-700 transition-all"
                    >
                      <HiPlus size={14} className="stroke-[2px]" />
                      เพิ่มรายวิชาแรก
                    </motion.button>
                  )}
                </motion.div>
              ) : isLoading ? (
                [...Array(8)].map((_, i) => (
                  <div key={i} className="flex items-center p-4 gap-4 rounded-2xl bg-white/60">
                    <Skeleton className="w-10 h-10 rounded-xl bg-slate-100" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-3.5 w-1/3 bg-slate-100" />
                      <Skeleton className="h-2.5 w-1/4 bg-slate-50" />
                    </div>
                    <Skeleton className="h-6 w-16 rounded-full bg-slate-100" />
                  </div>
                ))
              ) : paginated.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="py-20 flex flex-col items-center justify-center gap-3"
                >
                  <HiBookOpen size={28} className="text-slate-200" />
                  <p className="text-[12px] font-bold text-slate-300">ไม่พบรายวิชาที่ตรงกับเงื่อนไข</p>
                </motion.div>
              ) : (
                <>
                  {paginated.map((course, index) => (
                    <motion.div key={course.id} variants={cardAnim}>
                      <CourseCard
                        course={course}
                        index={(currentPage - 1) * itemsPerPage + index + 1}
                        canEdit={!readOnly && version.allowEdit}
                        onEdit={() => onEditCourse(course)}
                        onDelete={() => onDeleteCourse(course)}
                      />
                    </motion.div>
                  ))}

                </>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* ── Pagination ── */}
        {!isLoading && totalPages > 1 && (
          <div className="py-4 flex justify-center items-center gap-2 flex-shrink-0 border-t border-slate-100">
            {[...Array(totalPages)].map((_, i) => (
              <button
                key={i}
                onClick={() => handlePageChange(i + 1)}
                className="group relative p-1 transition-all"
              >
                <div
                  className={`h-1.5 rounded-full transition-all duration-500 ${
                    currentPage === i + 1
                      ? 'w-8 bg-blue-600 shadow-sm'
                      : 'w-1.5 bg-slate-200 group-hover:bg-slate-300'
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

// ── Color palettes ──────────────────────────────────────────────────────────────

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

function getSubjectColors(subjectGroup?: string): string[] {
  const g = (subjectGroup || '').toLowerCase();
  if (g.includes('thai') || g.includes('ภาษาไทย')) return THEME_COLORS.rose;
  if (g.includes('math') || g.includes('คณิต')) return THEME_COLORS.blue;
  if (g.includes('science') || g.includes('วิทยา')) return THEME_COLORS.emerald;
  if (g.includes('social') || g.includes('สังคม')) return THEME_COLORS.orange;
  if (g.includes('health') || g.includes('pe') || g.includes('พลศึกษา') || g.includes('สุขศึกษา')) return THEME_COLORS.red;
  if (g.includes('art') || g.includes('ศิลป')) return THEME_COLORS.purple;
  if (g.includes('career') || g.includes('งาน')) return THEME_COLORS.stone;
  if (g.includes('foreign') || g.includes('lang') || g.includes('ภาษา') || g.includes('ต่างประเทศ')) return THEME_COLORS.sky;
  return THEME_COLORS.gray;
}

function getGroupLabelThai(group?: string): string {
  const g = (group || '').toLowerCase();
  if (g.includes('thai') || g.includes('ภาษาไทย')) return 'ภาษาไทย';
  if (g.includes('math') || g.includes('คณิต')) return 'คณิตศาสตร์';
  if (g.includes('science') || g.includes('วิทยา')) return 'วิทยาศาสตร์';
  if (g.includes('social') || g.includes('สังคม')) return 'สังคมศึกษาฯ';
  if (g.includes('health') || g.includes('pe') || g.includes('สุขศึกษา') || g.includes('พลศึกษา')) return 'สุขศึกษาและพลศึกษา';
  if (g.includes('art') || g.includes('ศิลป')) return 'ศิลปะ';
  if (g.includes('career') || g.includes('งาน')) return 'การงานอาชีพ';
  if (g.includes('foreign') || g.includes('lang') || g.includes('ต่างประเทศ') || g.includes('ภาษา')) return 'ภาษาต่างประเทศ';
  if (g.includes('activity') || g.includes('กิจกรรม')) return 'กิจกรรมพัฒนาผู้เรียน';
  return group || 'อื่นๆ';
}

function SubjectIcon({ subjectGroup, className, size = 18 }: { subjectGroup?: string; className?: string; size?: number }) {
  const g = (subjectGroup || '').toLowerCase();
  const props = { size, className: className || "text-white drop-shadow-sm" };

  if (g.includes('thai') || g.includes('ภาษาไทย')) return <HiOutlineLanguage {...props} />;
  if (g.includes('math') || g.includes('คณิต')) return <HiOutlineCalculator {...props} />;
  if (g.includes('science') || g.includes('วิทยา')) return <HiOutlineBeaker {...props} />;
  if (g.includes('social') || g.includes('สังคม')) return <HiOutlineGlobeAsiaAustralia {...props} />;
  if (g.includes('health') || g.includes('pe') || g.includes('สุขศึกษา') || g.includes('พลศึกษา')) return <HiOutlineHeart {...props} />;
  if (g.includes('art') || g.includes('ศิลป')) return <HiOutlinePaintBrush {...props} />;
  if (g.includes('career') || g.includes('งาน')) return <HiOutlineBriefcase {...props} />;
  if (g.includes('foreign') || g.includes('lang') || g.includes('ต่างประเทศ') || g.includes('ภาษา')) return <HiOutlineChatBubbleLeftRight {...props} />;
  if (g.includes('activity') || g.includes('กิจกรรม')) return <HiOutlineSparkles {...props} />;
  return <HiOutlineBookOpen {...props} />;
}

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
  const [hovered, setHovered] = useState(false);
  const groupCfg = SUBJECT_GROUP_CONFIG[(course.subjectGroup || 'other') as SubjectGroupId] || SUBJECT_GROUP_CONFIG.other;

  const colors = getSubjectColors(course.subjectGroup || groupCfg.name);
  const catStyle = CATEGORY_STYLE[course.category as keyof typeof CATEGORY_STYLE] || CATEGORY_STYLE.basic;
  const groupLabel = getGroupLabelThai(course.subjectGroup || groupCfg.name);

  return (
    <motion.div
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      className={`group relative flex flex-col md:grid md:grid-cols-[1fr_6rem_12rem_5rem_5rem_4rem] items-start md:items-center gap-3 md:gap-3 p-4 md:px-5 md:py-2.5 border border-slate-100 md:border-0 md:border-b md:border-black/[0.04] rounded-[1.5rem] md:rounded-none hover:bg-slate-100/70 transition-all cursor-pointer text-left shadow-sm md:shadow-none bg-white md:bg-transparent ${
        index % 2 === 0 ? 'md:bg-white' : 'md:bg-slate-50/60'
      }`}
    >
      {/* 1. รายวิชา */}
      <div className="flex items-start md:items-center gap-4 min-w-0 w-full pr-8 md:pr-0">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 shadow-sm transition-all"
          style={{
            background: `linear-gradient(135deg, ${colors[1]} 0%, ${colors[0]} 100%)`,
          }}
        >
          <SubjectIcon subjectGroup={course.subjectGroup || groupCfg.name} />
        </div>
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-2 mb-0.5 min-w-0 flex-wrap">
            <h4 className={`text-[13px] font-black tracking-tight truncate max-w-[200px] sm:max-w-xs transition-colors ${
              hovered ? 'text-slate-900' : 'text-slate-800'
            }`}>
              {course.courseName}
            </h4>
            <span className={`inline-flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded-full shrink-0 ${catStyle.bg} ${catStyle.text}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${catStyle.dot}`} />
              {catStyle.label}
            </span>
          </div>
          <div>
            <span className="text-[10px] font-black text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded uppercase tracking-tighter">
              {course.courseCode}
            </span>
          </div>
        </div>
      </div>

      {/* Wrapper for items 2-5 to be flex on mobile, contents on desktop */}
      <div className="flex flex-wrap items-center gap-2 mt-1 md:mt-0 w-full md:contents">
        {/* 2. ชั้นเรียน */}
        <div className="flex justify-center shrink-0">
          <span className={`inline-flex items-center justify-center px-2.5 py-0.5 rounded-full bg-slate-100/80 border border-slate-200/40 text-[10px] font-black transition-colors ${
            hovered ? 'text-slate-900 bg-slate-200/80' : 'text-slate-600'
          }`}>
            {course.gradeLevel || '–'}
          </span>
        </div>

        {/* 3. กลุ่มสาระ */}
        <div className="px-0 md:px-3 min-w-0 shrink-0">
          <p className={`text-[10px] md:text-[12px] font-bold font-sarabun truncate transition-colors px-2.5 py-0.5 rounded-full bg-slate-50 md:bg-transparent md:px-0 md:py-0 border border-slate-200/40 md:border-0 ${
            hovered ? 'text-slate-900' : 'text-slate-600'
          }`}>
            {groupLabel}
          </p>
        </div>

        {/* 4. คาบ */}
        <div className="text-center shrink-0 flex items-center gap-1 bg-slate-50 md:bg-transparent px-2.5 py-0.5 md:px-0 md:py-0 rounded-full border border-slate-200/40 md:border-0">
          <span className="md:hidden text-[10px] text-slate-500 font-bold">คาบ:</span>
          <p className={`text-[11px] md:text-[13px] font-black font-sarabun transition-colors ${
            hovered ? 'text-slate-900' : 'text-slate-700'
          }`}>
            {course.periodsPerWeek || 0}
          </p>
        </div>

        {/* 5. หน่วยกิต */}
        <div className="text-center shrink-0 flex items-center gap-1 bg-blue-50 md:bg-transparent px-2.5 py-0.5 md:px-0 md:py-0 rounded-full border border-blue-100/50 md:border-0">
          <span className="md:hidden text-[10px] text-blue-600 font-bold">นก.:</span>
          <p className={`text-[11px] md:text-[13px] font-black font-sarabun transition-colors ${
            hovered ? 'text-blue-900 md:text-slate-950' : 'text-blue-700 md:text-slate-800'
          }`}>
            {Number(course.credit || 0).toFixed(1)}
          </p>
        </div>
      </div>

      {/* 6. การจัดการ */}
      <div className="absolute top-3 right-3 md:relative md:top-0 md:right-0 flex justify-center" onClick={(e) => e.stopPropagation()}>
        {canEdit ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={`p-2 rounded-full transition-colors focus:outline-none ${
                  hovered
                    ? 'text-slate-500 hover:bg-white hover:text-slate-700'
                    : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'
                }`}
              >
                <HiEllipsisHorizontal size={15} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40 rounded-2xl bg-white/95 backdrop-blur-xl border-slate-100 shadow-xl shadow-slate-900/10 z-50">
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(); }} className="gap-2 cursor-pointer rounded-xl text-[12px] font-bold text-slate-700 m-1">
                <HiPencil size={13} className="text-blue-500" />
                <span>แก้ไข</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDelete(); }} className="gap-2 cursor-pointer rounded-xl text-[12px] font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 focus:text-rose-700 focus:bg-rose-50 m-1">
                <HiTrash size={13} />
                <span>ลบวิชา</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <HiEllipsisHorizontal size={15} className={hovered ? 'text-slate-400' : 'text-slate-200'} />
        )}
      </div>
    </motion.div>
  );
}
