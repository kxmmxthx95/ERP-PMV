import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  HiPlus, HiPencil, HiTrash, HiBookOpen, HiAcademicCap,
  HiEllipsisHorizontal, HiTableCells, HiChevronDown, HiLockClosed, HiLockOpen, HiMagnifyingGlass, HiArrowPath, HiXMark,
  HiOutlineLanguage, HiOutlineCalculator, HiOutlineBeaker, HiOutlineGlobeAsiaAustralia, HiOutlineHeart, HiOutlinePaintBrush,
  HiOutlineBriefcase, HiOutlineChatBubbleLeftRight, HiOutlineSparkles, HiOutlineBookOpen,
  HiOutlineFunnel
} from 'react-icons/hi2';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
  DrawerClose,
} from '@/components/ui/drawer';
import { cn } from '@/lib/utils';
import { DRAWER_HEADER_ICON_BTN, DRAWER_HEADER_RIGHT_ACTIONS } from '@/lib/drawerHeaderBtn';
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
  onDeleteVersion,
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
  const [localSearch, setLocalSearch] = useState(externalSearch || '');
  const [isSearchActive, setIsSearchActive] = useState(!!(externalSearch || (externalSearch === undefined && localSearch)));
  const [isFilterOpen, setIsFilterOpen] = useState(false);

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
    }).sort((a, b) => {
      const categoryOrder: Record<string, number> = { basic: 1, additional: 2, activity: 3 };
      const orderA = categoryOrder[a.category || ''] || 99;
      const orderB = categoryOrder[b.category || ''] || 99;
      if (orderA !== orderB) return orderA - orderB;
      return (a.courseCode || '').localeCompare(b.courseCode || '', 'th');
    });
  }, [courses, effectiveSearch, externalDept, externalGrade, externalCategory, externalGroup, externalSemester]);

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



          {/* Filters Right-Side Drawer */}
          <Drawer open={isFilterOpen} onOpenChange={setIsFilterOpen} direction="right">
            <DrawerContent className="h-dvh max-h-none sm:p-2 sm:data-[vaul-drawer-direction=right]:max-w-md sm:data-[vaul-drawer-direction=right]:before:inset-2 sm:data-[vaul-drawer-direction=right]:before:rounded-4xl font-sukhumvit">
              <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-white sm:rounded-4xl sm:border sm:border-border sm:shadow-xl p-4">
                <DrawerHeader className="shrink-0 px-0 pb-4 pt-2 border-b border-slate-100">
                  <div className="relative flex min-h-10 items-center justify-between">
                    <DrawerTitle className="text-base font-black text-slate-800">
                      ตัวกรองรายวิชา
                    </DrawerTitle>
                    <div className={DRAWER_HEADER_RIGHT_ACTIONS}>
                      <DrawerClose asChild>
                        <button
                          type="button"
                          className={DRAWER_HEADER_ICON_BTN}
                          aria-label="ปิด"
                          title="ปิด"
                        >
                          <HiXMark className="h-4 w-4" />
                        </button>
                      </DrawerClose>
                    </div>
                  </div>
                </DrawerHeader>

                <div className="min-h-0 flex-1 overflow-y-auto py-6 space-y-6">
                  {/* Semester Filter */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-600 pl-1">เทอม</label>
                    <div className="relative">
                      <select
                        value={externalSemester || 1}
                        onChange={(e) => onExternalSemesterChange?.(Number(e.target.value))}
                        className="w-full h-10 rounded-xl border-none bg-slate-50/70 px-3 text-xs font-bold appearance-none text-slate-700 outline-none focus:ring-2 focus:ring-blue-100"
                      >
                        <option value="1">เทอม 1</option>
                        <option value="2">เทอม 2</option>
                      </select>
                      <HiChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
                    </div>
                  </div>

                  {/* Subject Group Filter */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-600 pl-1">กลุ่มสาระ</label>
                    <div className="relative">
                      <select
                        value={externalGroup || 'all'}
                        onChange={(e) => onExternalGroupChange?.(e.target.value)}
                        className="w-full h-10 rounded-xl border-none bg-slate-50/70 px-3 text-xs font-bold appearance-none text-slate-700 outline-none focus:ring-2 focus:ring-blue-100"
                      >
                        <option value="all">ทุกกลุ่มสาระ</option>
                        {Object.entries(SUBJECT_GROUP_CONFIG).map(([id, group]) => (
                          <option key={id} value={id}>{group.name}</option>
                        ))}
                      </select>
                      <HiChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
                    </div>
                  </div>

                  {/* Category Filter */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-600 pl-1">หมวดวิชา</label>
                    <div className="relative">
                      <select
                        value={externalCategory || 'all'}
                        onChange={(e) => onExternalCategoryChange?.(e.target.value as any)}
                        className="w-full h-10 rounded-xl border-none bg-slate-50/70 px-3 text-xs font-bold appearance-none text-slate-700 outline-none focus:ring-2 focus:ring-blue-100"
                      >
                        <option value="all">ทุกหมวด</option>
                        <option value="basic">พื้นฐาน</option>
                        <option value="additional">เพิ่มเติม</option>
                        <option value="activity">กิจกรรม</option>
                      </select>
                      <HiChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
                    </div>
                  </div>
                </div>

                {(externalSemester !== 1 || externalGroup !== 'all' || externalCategory !== 'all') && (
                  <DrawerFooter className="px-0 pt-4 border-t border-slate-100 gap-2 shrink-0">
                    <button
                      onClick={() => {
                        onExternalCategoryChange?.('all');
                        onExternalSemesterChange?.(1);
                        onExternalGroupChange?.('all');
                      }}
                      className="flex h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-rose-100 bg-rose-50 text-xs font-bold text-rose-600 hover:bg-rose-100 transition-colors cursor-pointer"
                    >
                      <HiArrowPath size={14} />
                      ล้างตัวกรองทั้งหมด
                    </button>
                  </DrawerFooter>
                )}
              </div>
            </DrawerContent>
          </Drawer>

          {/* Action buttons unified Dock Group */}
          {!readOnly && (
            <div className="flex items-center border border-slate-200/80 bg-white p-1 rounded-full shadow-xs shrink-0 order-2 xl:order-3 gap-1 h-10">
              {onToggleEditMode && (
                <button
                  type="button"
                  onClick={() => onToggleEditMode(!version.allowEdit)}
                  className={cn(
                    "flex items-center justify-center h-8 w-8 text-xs font-black transition-all rounded-full cursor-pointer",
                    version.allowEdit
                      ? "text-emerald-500 hover:bg-emerald-50"
                      : "text-amber-500 hover:bg-amber-50"
                  )}
                  title={version.allowEdit ? 'ล็อกหลักสูตร' : 'เปิดการแก้ไข'}
                >
                  {version.allowEdit ? <HiLockOpen size={16} /> : <HiLockClosed size={16} />}
                </button>
              )}

              {/* Search button / input */}
              {isSearchActive ? (
                <div className="flex items-center gap-1.5 px-2 bg-blue-50/95 border border-blue-100/50 rounded-full h-8 w-[150px] sm:w-[180px] transition-all">
                  <HiMagnifyingGlass size={13} className="text-slate-400 flex-shrink-0" />
                  <input
                    type="text"
                    placeholder="ค้นหา..."
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
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsSearchActive(true)}
                  className="flex items-center justify-center h-8 w-8 text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition-all rounded-full cursor-pointer"
                  title="ค้นหา"
                >
                  <HiMagnifyingGlass size={16} />
                </button>
              )}

              {/* Filter button */}
              <button
                type="button"
                onClick={() => setIsFilterOpen(true)}
                className={cn(
                  "flex items-center justify-center h-8 w-8 transition-all rounded-full cursor-pointer relative",
                  (externalSemester !== 'all' || externalGroup !== 'all' || externalCategory !== 'all')
                    ? "bg-blue-50 text-blue-600"
                    : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                )}
                title="ตัวกรอง"
              >
                <HiOutlineFunnel size={16} />
                {(externalSemester !== 'all' || externalGroup !== 'all' || externalCategory !== 'all') && (
                  <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-destructive" aria-hidden />
                )}
              </button>

              {version.allowEdit && (
                <>
                  {onImportCSV && (
                    <button
                      type="button"
                      onClick={onImportCSV}
                      className="flex items-center justify-center h-8 w-8 text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition-all rounded-full cursor-pointer"
                      title="นำเข้า"
                    >
                      <HiTableCells size={16} />
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => onEditVersion(version)}
                    className="flex items-center justify-center h-8 w-8 text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition-all rounded-full cursor-pointer"
                    title="แก้ไขหลักสูตร"
                  >
                    <HiPencil size={16} />
                  </button>

                  {onDeleteVersion && (
                    <button
                      type="button"
                      onClick={() => onDeleteVersion(version)}
                      className="flex items-center justify-center h-8 w-8 text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition-all rounded-full cursor-pointer"
                      title="ลบหลักสูตร"
                    >
                      <HiTrash size={16} />
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={onAddCourse}
                    className="flex items-center justify-center h-8 w-8 text-xs font-black transition-all rounded-full bg-blue-600 text-white hover:bg-blue-700 shadow-xs cursor-pointer"
                    title="เพิ่มวิชา"
                  >
                    <HiPlus size={16} className="stroke-[2px]" />
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* ── Credit Summary Card (Single with inline switcher) ── */}
        <div className="mb-1 md:mb-4">
          {(() => {
            const currentSemester = (externalSemester === 2 ? 2 : 1) as 1 | 2;
            return (
              <div className="rounded-[1.25rem] border border-slate-100 bg-white p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="inline-flex rounded-xl bg-slate-50 p-0.5 border border-slate-200/40">
                      <button
                        type="button"
                        onClick={() => onExternalSemesterChange?.(1)}
                        className={cn(
                          "px-3 py-1 rounded-lg text-[10px] font-black transition-all cursor-pointer",
                          currentSemester === 1
                            ? "bg-white text-blue-600 shadow-sm border border-slate-200/10"
                            : "text-slate-500 hover:text-slate-800"
                        )}
                      >
                        ภาคเรียน 1
                      </button>
                      <button
                        type="button"
                        onClick={() => onExternalSemesterChange?.(2)}
                        className={cn(
                          "px-3 py-1 rounded-lg text-[10px] font-black transition-all cursor-pointer",
                          currentSemester === 2
                            ? "bg-white text-blue-600 shadow-sm border border-slate-200/10"
                            : "text-slate-500 hover:text-slate-800"
                        )}
                      >
                        ภาคเรียน 2
                      </button>
                    </div>
                  </div>
                  <span className="text-[14px] font-black text-slate-900">
                    {creditSummary[currentSemester].total.toFixed(1)}
                    <span className="text-[9px] font-bold text-slate-400 ml-0.5">นก.</span>
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {(['basic', 'additional', 'activity'] as const).map(cat => {
                    const catStyle = CATEGORY_STYLE[cat];
                    const val = creditSummary[currentSemester][cat];
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
            );
          })()}
        </div>
      </div>
      {/* ── Course List ── */}
      <div className="flex-1 min-h-0 relative overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto scrollbar-hide">
          {/* Sticky Table Header */}
          <div className="sticky top-0 z-10 hidden md:grid grid-cols-[1fr_6rem_6rem_12rem_5rem_5rem_4rem] items-center gap-3 px-5 py-3 text-[11px] font-black text-slate-700 bg-slate-50/90 backdrop-blur-md border-b border-slate-100/80 mb-2 shrink-0">
            <div className="pl-[60px]">รายวิชา</div>
            <div className="text-center">ภาคเรียน</div>
            <div className="text-center">ชั้นเรียน</div>
            <div className="px-3">กลุ่มสาระ</div>
            <div className="text-center">คาบ</div>
            <div className="text-center">หน่วยกิต</div>
            <div className="text-center">การจัดการ</div>
          </div>
          <div className="flex flex-col gap-1.5 pb-4 w-full">
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
            ) : filteredCourses.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="py-20 flex flex-col items-center justify-center gap-3"
              >
                <HiBookOpen size={28} className="text-slate-200" />
                <p className="text-[12px] font-bold text-slate-300">ไม่พบรายวิชาที่ตรงกับเงื่อนไข</p>
              </motion.div>
            ) : (
              filteredCourses.map((course) => (
                <motion.div key={course.id} variants={cardAnim} initial="enter" animate="center" exit="exit">
                  <CourseCard
                    course={course}
                    canEdit={!readOnly && version.allowEdit}
                    onEdit={() => onEditCourse(course)}
                    onDelete={() => onDeleteCourse(course)}
                  />
                </motion.div>
              ))
            )}
          </div>
        </div>
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
  if (g.includes('other') || g.includes('อื่นๆ')) return 'อื่นๆ';
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
  canEdit,
  onEdit,
  onDelete,
}: {
  course: CurriculumCourse;
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
      className={cn(
        "group relative flex flex-col md:grid md:grid-cols-[1fr_6rem_6rem_12rem_5rem_5rem_4rem] items-start md:items-center gap-3 p-4 md:px-5 md:py-3 border border-slate-100 md:border-0 md:border-b md:border-slate-100/70 rounded-2xl md:rounded-none transition-all cursor-pointer text-left bg-white hover:bg-slate-50/70"
      )}
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
            <h4 className={`text-[13px] font-black tracking-tight truncate max-w-[200px] sm:max-w-xs transition-colors ${hovered ? 'text-slate-900' : 'text-slate-800'
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
        {/* 2. ภาคเรียน */}
        <div className="flex justify-center shrink-0">
          <span className={cn(
            "inline-flex items-center justify-center px-2.5 py-0.5 rounded-full border text-[10px] font-black transition-colors",
            course.semester === 2
              ? hovered
                ? "bg-indigo-100/50 border-indigo-200/30 text-indigo-900"
                : "bg-indigo-50/50 border-indigo-100/20 text-indigo-600"
              : hovered
                ? "bg-blue-100/50 border-blue-200/30 text-blue-900"
                : "bg-blue-50/50 border-blue-100/20 text-blue-600"
          )}>
            เทอม {course.semester || '–'}
          </span>
        </div>

        {/* 3. ชั้นเรียน */}
        <div className="flex justify-center shrink-0">
          <span className={`inline-flex items-center justify-center px-2.5 py-0.5 rounded-full bg-slate-100/80 border border-slate-200/40 text-[10px] font-black transition-colors ${hovered ? 'text-slate-900 bg-slate-200/80' : 'text-slate-600'
            }`}>
            {course.gradeLevel || '–'}
          </span>
        </div>

        {/* 3. กลุ่มสาระ */}
        <div className="px-0 md:px-3 min-w-0 shrink-0">
          <p className={`text-[10px] md:text-[12px] font-bold font-sarabun truncate transition-colors px-2.5 py-0.5 rounded-full bg-slate-50 md:bg-transparent md:px-0 md:py-0 border border-slate-200/40 md:border-0 ${hovered ? 'text-slate-900' : 'text-slate-600'
            }`}>
            {groupLabel}
          </p>
        </div>

        {/* 4. คาบ */}
        <div className="text-center shrink-0 flex items-center md:justify-center md:w-full gap-1 bg-slate-50 md:bg-transparent px-2.5 py-0.5 md:px-0 md:py-0 rounded-full border border-slate-200/40 md:border-0">
          <span className="md:hidden text-[10px] text-slate-500 font-bold">คาบ:</span>
          <p className={`text-[11px] md:text-[13px] font-black font-sarabun transition-colors ${hovered ? 'text-slate-900' : 'text-slate-700'
            }`}>
            {course.periodsPerWeek || 0}
          </p>
        </div>

        {/* 5. หน่วยกิต */}
        <div className="text-center shrink-0 flex items-center md:justify-center md:w-full gap-1 bg-blue-50 md:bg-transparent px-2.5 py-0.5 md:px-0 md:py-0 rounded-full border border-blue-100/50 md:border-0">
          <span className="md:hidden text-[10px] text-blue-600 font-bold">นก.:</span>
          <p className={`text-[11px] md:text-[13px] font-black font-sarabun transition-colors ${hovered ? 'text-blue-900 md:text-slate-950' : 'text-blue-700 md:text-slate-800'
            }`}>
            {Number(course.credit || 0).toFixed(1)}
          </p>
        </div>
      </div>

      {/* 6. การจัดการ */}
      <div className="absolute top-3 right-3 md:relative md:top-0 md:right-0 flex justify-center">
        {canEdit ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={`p-2 rounded-full transition-colors focus:outline-none ${hovered
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
