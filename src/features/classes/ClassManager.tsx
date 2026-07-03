import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { HiChevronLeft, HiChevronRight, HiAcademicCap, HiMagnifyingGlass, HiPlus, HiXMark } from 'react-icons/hi2';
import { TbFilter2 } from 'react-icons/tb';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { cn } from '@/lib/utils';
import { useClassroomManager } from './hooks/useClassroomManager';
import ClassCard from './components/ClassCard';
import ClassFormModal from './components/ClassFormModal';
import ClassStudentPanel from './components/ClassStudentPanel';
import ClassFilterCapsule from './components/ClassFilterCapsule';
import type { ClassRoom, NewClassRoom } from '@/types/class';
import { useSchoolStructure } from '@/hooks/useSchoolStructure';

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

const ITEMS_PER_PAGE = 12;

const DEPT_OPTIONS = [
  { id: 'all' as const, label: 'ทั้งหมด' },
  { id: 'early' as const, label: 'ปฐมวัย' },
  { id: 'primary' as const, label: 'ประถม' },
  { id: 'secondary' as const, label: 'มัธยม' },
];

export default function ClassManager() {
  const mgr = useClassroomManager();
  const { getGradesBySection } = useSchoolStructure();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassRoom | null>(null);
  const [selectedClass, setSelectedClass] = useState<ClassRoom | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [isMdOrBelow, setIsMdOrBelow] = useState(() => window.innerWidth < 1024);
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [headerFiltersPortalEl, setHeaderFiltersPortalEl] = useState<HTMLElement | null>(null);
  const [headerCenterMobilePortalEl, setHeaderCenterMobilePortalEl] = useState<HTMLElement | null>(null);
  const [headerMobileActionsEl, setHeaderMobileActionsEl] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setHeaderFiltersPortalEl(document.getElementById('header-portal-filters'));
    setHeaderCenterMobilePortalEl(document.getElementById('header-portal-center-mobile'));
    setHeaderMobileActionsEl(document.getElementById('header-portal-mobile-actions'));
  }, []);

  useEffect(() => {
    const handleResize = () => setIsMdOrBelow(window.innerWidth < 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Direction and rank state for premium slide animation matching the online exam
  const [direction, setDirection] = useState(1);
  const [prevRank, setPrevRank] = useState(0);

  const currentRank = useMemo(() => {
    let deptScore = 0;
    if (mgr.filterDept === 'early') deptScore = 1;
    else if (mgr.filterDept === 'primary') deptScore = 2;
    else if (mgr.filterDept === 'secondary') deptScore = 3;

    let gradeScore = 0;
    if (mgr.filterGrade !== 'all') {
      const num = parseInt(mgr.filterGrade.replace(/[^0-9]/g, ''), 10);
      if (!isNaN(num)) gradeScore = num;
    }

    return deptScore * 10000 + gradeScore * 100 + currentPage;
  }, [mgr.filterDept, mgr.filterGrade, currentPage]);

  useEffect(() => {
    if (currentRank !== prevRank) {
      setDirection(currentRank > prevRank ? 1 : -1);
      setPrevRank(currentRank);
    }
  }, [currentRank, prevRank]);

  const closeModal = () => { setModalOpen(false); setEditingClass(null); };

  const normalizedDept = mgr.filterDept === 'early' ? 'early-childhood' : mgr.filterDept;
  const grades = mgr.filterDept !== 'all' ? getGradesBySection(normalizedDept as any) : [];
  const hasActiveFilters = mgr.filterDept !== 'all' || mgr.filterGrade !== 'all' || !!mgr.searchQ;

  const handleClearFilters = () => {
    mgr.setFilterDept('all');
    mgr.setFilterGrade('all');
    mgr.setSearchQ('');
  };

  const totalPages = Math.ceil(mgr.filteredCards.length / ITEMS_PER_PAGE);
  const paginatedCards = mgr.filteredCards.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  useEffect(() => { setCurrentPage(1); }, [mgr.searchQ, mgr.filterDept, mgr.filterGrade]);
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) setCurrentPage(1);
  }, [mgr.filteredCards.length, totalPages, currentPage]);

  if (selectedClass) {
    return (
      <ClassStudentPanel
        classRoom={selectedClass}
        onBack={() => setSelectedClass(null)}
      />
    );
  }

  const capsuleElement = (
    <ClassFilterCapsule
      filterDept={mgr.filterDept}
      onDeptChange={mgr.setFilterDept}
      filterGrade={mgr.filterGrade}
      onGradeChange={mgr.setFilterGrade}
      grades={grades}
      onAdd={() => { setEditingClass(null); setModalOpen(true); }}
      searchTerm={mgr.searchQ}
      onSearchChange={mgr.setSearchQ}
      isSearchMode={isSearchMode}
      onSearchModeChange={setIsSearchMode}
      showDepartmentSection={false}
    />
  );

  return (
    <div className="flex flex-1 flex-col min-h-0 gap-5 font-sukhumvit pb-24 relative">
      {headerFiltersPortalEl && createPortal(
        <div className="hidden lg:flex items-center gap-1.5 h-10 p-1 rounded-full bg-white/60 backdrop-blur-xl border border-white shadow-[0_8px_32px_rgba(0,0,0,0.04)] pointer-events-auto">
          <button
            onClick={() => mgr.setFilterDept('all')}
            className={`h-8 px-6 rounded-full text-[11px] font-black transition-all whitespace-nowrap ${
              mgr.filterDept === 'all'
                ? 'bg-slate-900 text-white shadow-md'
                : 'text-slate-500 hover:text-slate-800 hover:bg-black/5'
            }`}
          >
            ทั้งหมด
          </button>
          <div className="w-px h-5 bg-black/10 mx-1 shrink-0" />
          {(['early', 'primary', 'secondary'] as const).map((dept) => (
            <button
              key={dept}
              onClick={() => mgr.setFilterDept(dept)}
              className={`h-8 px-6 rounded-full text-[11px] font-black transition-all whitespace-nowrap ${
                mgr.filterDept === dept
                  ? 'bg-slate-900 text-white shadow-md'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-black/5'
              }`}
            >
              {dept === 'early' ? 'ปฐมวัย' : dept === 'primary' ? 'ประถม' : 'มัธยม'}
            </button>
          ))}
        </div>,
        headerFiltersPortalEl
      )}

      {headerCenterMobilePortalEl && createPortal(
        <div className="pointer-events-none flex items-center gap-1.5 lg:hidden">
          <HiAcademicCap className="h-4 w-4 shrink-0 text-black/80" />
          <span className="text-[13px] font-black leading-none tracking-tight text-black/80 whitespace-nowrap font-sukhumvit">
            ห้องเรียน
          </span>
        </div>,
        headerCenterMobilePortalEl,
      )}

      {isMdOrBelow && headerMobileActionsEl && createPortal(
        <motion.button
          whileTap={{ scale: 0.95 }}
          type="button"
          onClick={() => setFilterDrawerOpen(true)}
          className="pointer-events-auto relative flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
          title="ตัวกรอง"
          aria-label="ตัวกรอง"
        >
          <TbFilter2 className="h-5 w-5" />
          {hasActiveFilters && (
            <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-rose-500" aria-hidden />
          )}
        </motion.button>,
        headerMobileActionsEl,
      )}

      <Drawer open={filterDrawerOpen} onOpenChange={setFilterDrawerOpen} direction="bottom">
        <DrawerContent className="font-sukhumvit pb-[max(1rem,env(safe-area-inset-bottom))]">
          <DrawerHeader className="text-left">
            <DrawerTitle className="text-base font-black text-slate-900">ตัวกรองห้องเรียน</DrawerTitle>
            <DrawerDescription className="text-xs text-slate-500">
              เลือกแผนก ระดับชั้น หรือค้นหาห้องเรียน
            </DrawerDescription>
          </DrawerHeader>

          <div className="space-y-5 px-4">
            <div>
              <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-slate-400">แผนก</p>
              <div className="grid grid-cols-2 gap-2">
                {DEPT_OPTIONS.map((dept) => {
                  const isActive = mgr.filterDept === dept.id;
                  return (
                    <button
                      key={dept.id}
                      type="button"
                      onClick={() => {
                        mgr.setFilterDept(dept.id);
                        if (dept.id === 'all') mgr.setFilterGrade('all');
                      }}
                      className={cn(
                        'rounded-xl border px-3 py-2.5 text-[12px] font-black transition-all',
                        isActive
                          ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
                      )}
                    >
                      {dept.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {mgr.filterDept !== 'all' && (
              <div>
                <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-slate-400">ระดับชั้น</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => mgr.setFilterGrade('all')}
                    className={cn(
                      'rounded-full px-3 py-1.5 text-[11px] font-black transition-all',
                      mgr.filterGrade === 'all'
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600',
                    )}
                  >
                    ทุกระดับ
                  </button>
                  {grades.map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => mgr.setFilterGrade(g.shortLabel)}
                      className={cn(
                        'rounded-full px-3 py-1.5 text-[11px] font-black transition-all',
                        mgr.filterGrade === g.shortLabel
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-600',
                      )}
                    >
                      {g.shortLabel || g.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-slate-400">
                ค้นหา
              </label>
              <div className="relative">
                <HiMagnifyingGlass className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <input
                  type="text"
                  placeholder="ชื่อห้อง หรือครูประจำชั้น..."
                  value={mgr.searchQ}
                  onChange={(e) => mgr.setSearchQ(e.target.value)}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-9 text-[13px] font-bold text-slate-800 placeholder:text-slate-400 outline-none transition-all focus:border-blue-200 focus:ring-4 focus:ring-blue-50/50"
                />
                {mgr.searchQ && (
                  <button
                    type="button"
                    onClick={() => mgr.setSearchQ('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    aria-label="ล้างคำค้นหา"
                  >
                    <HiXMark size={14} />
                  </button>
                )}
              </div>
            </div>
          </div>

          <DrawerFooter className="flex-row gap-2">
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="h-11 flex-1 rounded-xl border border-rose-200 bg-rose-50 text-[13px] font-black text-rose-600 transition-colors hover:bg-rose-100"
              >
                ล้างตัวกรอง
              </button>
            )}
            <button
              type="button"
              onClick={() => { setEditingClass(null); setModalOpen(true); setFilterDrawerOpen(false); }}
              className="h-11 flex-1 rounded-xl border border-slate-200 bg-white text-[13px] font-black text-slate-700 transition-colors hover:bg-slate-50"
            >
              <span className="inline-flex items-center justify-center gap-1.5">
                <HiPlus className="h-4 w-4" />
                เพิ่มห้อง
              </span>
            </button>
            <button
              type="button"
              onClick={() => setFilterDrawerOpen(false)}
              className="h-11 flex-1 rounded-xl bg-slate-900 text-[13px] font-black text-white shadow-md transition-colors hover:bg-slate-800"
            >
              แสดงผล
            </button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* Desktop (lg+): inject capsule into header portal */}
      {!isMdOrBelow && createPortal(
        capsuleElement,
        document.getElementById('header-portal-right-actions') || document.body
      )}

      {/* ── Card grid / empty state ── */}
      {!hasActiveFilters ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-1 flex-col items-center justify-center gap-3 min-h-[calc(100dvh-11rem)] px-6"
        >
          <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
            <HiAcademicCap className="w-6 h-6" />
          </div>
          <p className="text-sm font-bold text-slate-400 text-center px-6">
            กรุณาเลือกตัวกรองเพื่อแสดงห้องเรียน
          </p>
          {isMdOrBelow && (
            <button
              type="button"
              onClick={() => setFilterDrawerOpen(true)}
              className="px-5 py-2 bg-slate-900 text-white text-[11px] font-black rounded-full hover:bg-slate-800 active:scale-95 transition-all cursor-pointer"
            >
              เปิดตัวกรอง
            </button>
          )}
        </motion.div>
      ) : mgr.filteredCards.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center h-64 gap-3 bg-white/60 rounded-3xl border border-slate-100 shadow-sm"
        >
          <div className="w-14 h-14 rounded-full bg-slate-50 flex items-center justify-center text-slate-400">
            <HiAcademicCap className="w-6 h-6" />
          </div>
          <p className="text-sm font-bold text-slate-400">ไม่พบข้อมูลที่ตรงตามเงื่อนไข</p>
          <button
            onClick={handleClearFilters}
            className="px-5 py-2 bg-slate-900 text-white text-[11px] font-black rounded-full shadow hover:bg-slate-800 active:scale-95 transition-all cursor-pointer"
          >
            ล้างการกรองทั้งหมด
          </button>
        </motion.div>
      ) : (
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={`${mgr.filterDept}-${mgr.filterGrade}-${currentPage}`}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            className="grid grid-cols-1 lg:grid-cols-5 xl:grid-cols-6 gap-3"
          >
            {paginatedCards.map(card => (
              <motion.div key={card.classRoom.id} variants={cardAnim}>
                <div
                  className="cursor-pointer"
                  onClick={() => setSelectedClass(card.classRoom)}
                >
                  <ClassCard card={card} />
                </div>
              </motion.div>
            ))}
          </motion.div>
        </AnimatePresence>
      )}

      {/* ── Pagination ── */}
      {hasActiveFilters && totalPages > 1 && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="flex items-center justify-center gap-2 pt-2"
        >
          <button
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
            className="flex items-center gap-1 px-4 py-1.5 rounded-full border border-black/[0.08] text-[11px] font-bold text-slate-600 bg-white hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
          >
            <HiChevronLeft className="w-3.5 h-3.5" />
            ก่อนหน้า
          </button>
          <span className="text-[11px] font-medium text-slate-400 px-2">
            {currentPage} / {totalPages}
          </span>
          <button
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
            className="flex items-center gap-1 px-4 py-1.5 rounded-full border border-black/[0.08] text-[11px] font-bold text-slate-600 bg-white hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
          >
            ถัดไป
            <HiChevronRight className="w-3.5 h-3.5" />
          </button>
        </motion.div>
      )}

      {/* ── Modal ── */}
      <ClassFormModal
        open={modalOpen}
        editingClass={editingClass}
        yearId={mgr.yearId}
        semester={mgr.semester}
        teachers={mgr.availableTeachers}
        onClose={closeModal}
        onSubmit={async (data: NewClassRoom) => await mgr.addClass(data)}
        onUpdate={async (id, data) => await mgr.updateClass(id, data)}
        onDelete={async id => await mgr.deleteClass(id)}
      />
    </div>
  );
}
