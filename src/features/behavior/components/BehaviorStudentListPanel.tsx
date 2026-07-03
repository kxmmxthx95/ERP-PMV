import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { HiOutlineMagnifyingGlass, HiChevronLeft, HiChevronRight, HiXMark } from 'react-icons/hi2';
import { TbFilter2 } from 'react-icons/tb';
import { useActiveAcademicYear } from '@/hooks/useActiveAcademicYear';
import { useStudentManager } from '@/hooks/useStudentManager';
import { useBehaviorTotals } from '@/hooks/useBehaviorScore';
import StudentAvatar from '@/features/students/components/StudentAvatar';
import type { StudentCard } from '@/types/student';
import type { BehaviorTotal } from '@/types/behavior';
import { DEPARTMENT_CONFIG, type Department } from '@/types/curriculum';
import { GRADE_LEVEL_ORDER } from '@/types/class';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';

const StudentQuickTapModal = lazy(() => import('./StudentQuickTapModal'));

const BASELINE_POINTS = 100;
const MIN_SEARCH_LENGTH = 6;
const ITEMS_PER_PAGE = 24;

const DEPARTMENT_OPTIONS: Array<{ value: '' | Department; label: string }> = [
  { value: '', label: 'ทุกแผนก' },
  { value: 'early', label: DEPARTMENT_CONFIG.early.label },
  { value: 'primary', label: DEPARTMENT_CONFIG.primary.label },
  { value: 'secondary', label: DEPARTMENT_CONFIG.secondary.label },
];

const GRADES_BY_DEPARTMENT: Record<Department, string[]> = {
  early: DEPARTMENT_CONFIG.early.grades,
  primary: DEPARTMENT_CONFIG.primary.grades,
  secondary: DEPARTMENT_CONFIG.secondary.grades,
};

const selectClassName =
  'h-9 px-2.5 rounded-xl bg-white border border-slate-100 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/5 focus:border-blue-200 transition-all min-w-0';

function DrawerFilterField({
  label,
  value,
  onChange,
  options,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-slate-400">
        {label}
      </label>
      <div className="relative">
        <select
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className="h-11 w-full appearance-none rounded-xl border border-slate-200 bg-white px-3.5 pr-9 text-[13px] font-bold text-slate-800 outline-none transition-all focus:border-blue-200 focus:ring-4 focus:ring-blue-50/50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {options.map((o) => (
            <option key={o.value || 'empty'} value={o.value}>{o.label}</option>
          ))}
        </select>
        <HiChevronRight className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 rotate-90 text-slate-400" />
      </div>
    </div>
  );
}

interface BehaviorStudentListPanelProps {
  academicYearId: string;
}

export default function BehaviorStudentListPanel({ academicYearId }: BehaviorStudentListPanelProps) {
  const { activeSemester } = useActiveAcademicYear();
  const studentMgr = useStudentManager(academicYearId);
  const { totals, loading: loadingTotals } = useBehaviorTotals(academicYearId);

  const [localTotals, setLocalTotals] = useState<Map<string, BehaviorTotal>>(new Map());
  const [selectedCard, setSelectedCard] = useState<StudentCard | null>(null);
  const [searchInput, setSearchInput] = useState(studentMgr.filter.searchText);
  const [currentPage, setCurrentPage] = useState(1);
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [headerMobileActionsEl, setHeaderMobileActionsEl] = useState<HTMLElement | null>(null);
  const [isMdOrBelow, setIsMdOrBelow] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 1024 : false,
  );

  useEffect(() => {
    setHeaderMobileActionsEl(document.getElementById('header-portal-mobile-actions'));
  }, []);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const onChange = () => setIsMdOrBelow(!mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const {
    filteredStudentCards,
    isDataLoaded,
    filter,
    setFilter,
    availableClasses,
  } = studentMgr;

  useEffect(() => {
    const nextSearch = searchInput.length >= MIN_SEARCH_LENGTH ? searchInput : '';
    setFilter((f) => (f.searchText === nextSearch ? f : { ...f, searchText: nextSearch }));
  }, [searchInput, setFilter]);

  const gradeOptions = useMemo(() => {
    const dept = filter.department as Department | '';
    if (!dept) return [];
    return [...GRADES_BY_DEPARTMENT[dept]].sort(
      (a, b) => (GRADE_LEVEL_ORDER[a] ?? 99) - (GRADE_LEVEL_ORDER[b] ?? 99),
    );
  }, [filter.department]);

  const drawerDepartmentOptions = useMemo(
    () => DEPARTMENT_OPTIONS.map((opt) => (
      opt.value === '' ? { value: '', label: 'เลือกแผนก' } : opt
    )),
    [],
  );

  const drawerGradeOptions = useMemo(() => [
    { value: '', label: filter.department ? 'ทุกชั้น' : 'เลือกแผนกก่อน' },
    ...gradeOptions.map((grade) => ({ value: grade, label: grade })),
  ], [filter.department, gradeOptions]);

  const drawerClassOptions = useMemo(() => [
    { value: '', label: filter.gradeLevel ? 'ทุกห้อง' : 'เลือกชั้นก่อน' },
    ...availableClasses.map((c) => ({ value: c.classId, label: c.className })),
  ], [availableClasses, filter.gradeLevel]);

  const hasAppliedFilter = Boolean(
    filter.department
    || filter.gradeLevel
    || filter.classId
    || filter.searchText,
  );

  const isFilterActive = Boolean(
    filter.department
    || filter.gradeLevel
    || filter.classId
    || searchInput,
  );

  const clearFilters = () => {
    setSearchInput('');
    setCurrentPage(1);
    setFilter((f) => ({
      ...f,
      department: '',
      gradeLevel: '',
      classId: '',
      searchText: '',
    }));
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [filter.department, filter.gradeLevel, filter.classId, filter.searchText]);

  const totalPages = Math.max(1, Math.ceil(filteredStudentCards.length / ITEMS_PER_PAGE));
  const paginatedStudentCards = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredStudentCards.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredStudentCards, currentPage]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const rangeStart = filteredStudentCards.length === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1;
  const rangeEnd = Math.min(currentPage * ITEMS_PER_PAGE, filteredStudentCards.length);

  const mergedTotals = useMemo(() => {
    const merged = new Map(totals);
    localTotals.forEach((v, k) => merged.set(k, v));
    return merged;
  }, [totals, localTotals]);

  const desktopFilterBar = (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <HiOutlineMagnifyingGlass size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="ค้นหาชื่อ หรือรหัสนักเรียน (มากกว่า 5 ตัวอักษร)"
            className="h-9 w-full rounded-xl border border-slate-100 bg-white pl-9 pr-3 text-xs font-bold text-slate-700 placeholder:text-slate-300 transition-all focus:border-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500/5"
          />
        </div>

        <select
          value={filter.department}
          onChange={(e) => {
            const department = e.target.value;
            setFilter((f) => ({
              ...f,
              department,
              gradeLevel: '',
              classId: '',
            }));
          }}
          className={cn(selectClassName, 'w-[118px] shrink-0')}
        >
          {DEPARTMENT_OPTIONS.map((opt) => (
            <option key={opt.value || 'all'} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        <select
          value={filter.gradeLevel}
          onChange={(e) => {
            const gradeLevel = e.target.value;
            setFilter((f) => ({
              ...f,
              gradeLevel,
              classId: '',
            }));
          }}
          disabled={!filter.department}
          className={cn(
            selectClassName,
            'w-[118px] shrink-0',
            !filter.department && 'cursor-not-allowed opacity-50',
          )}
        >
          <option value="">{filter.department ? 'ทุกชั้น' : 'เลือกแผนกก่อน'}</option>
          {gradeOptions.map((grade) => (
            <option key={grade} value={grade}>{grade}</option>
          ))}
        </select>

        <select
          value={filter.classId}
          onChange={(e) => setFilter((f) => ({ ...f, classId: e.target.value }))}
          disabled={!filter.gradeLevel}
          className={cn(
            selectClassName,
            'w-[118px] shrink-0',
            !filter.gradeLevel && 'cursor-not-allowed opacity-50',
          )}
        >
          <option value="">{filter.gradeLevel ? 'ทุกห้อง' : 'เลือกชั้นก่อน'}</option>
          {availableClasses.map((c) => (
            <option key={c.classId} value={c.classId}>{c.className}</option>
          ))}
        </select>

        {isFilterActive && (
          <button
            type="button"
            onClick={clearFilters}
            className="h-9 shrink-0 whitespace-nowrap rounded-xl bg-slate-100 px-2.5 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-200"
          >
            ล้างตัวกรอง
          </button>
        )}
      </div>

      {searchInput.length > 0 && searchInput.length < MIN_SEARCH_LENGTH && (
        <p className="px-1 text-[11px] font-bold text-amber-600">
          พิมพ์มากกว่า 5 ตัวอักษรเพื่อค้นหาอัตโนมัติ ({searchInput.length}/{MIN_SEARCH_LENGTH})
        </p>
      )}
    </div>
  );

  const mobileFilterButtonPortal = isMdOrBelow && headerMobileActionsEl && createPortal(
    <motion.button
      whileTap={{ scale: 0.95 }}
      type="button"
      onClick={() => setFilterDrawerOpen(true)}
      className="pointer-events-auto relative flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
      title="ตัวกรอง"
      aria-label="ตัวกรอง"
    >
      <TbFilter2 className="h-5 w-5" />
      {isFilterActive && (
        <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-rose-500" aria-hidden />
      )}
    </motion.button>,
    headerMobileActionsEl,
  );

  return (
    <div
      className={cn(
        'flex w-full flex-1 flex-col min-h-0 gap-5',
        !hasAppliedFilter && isMdOrBelow && 'min-h-[calc(100dvh-11rem)]',
      )}
    >
      {mobileFilterButtonPortal}

      <Drawer open={filterDrawerOpen} onOpenChange={setFilterDrawerOpen} direction="bottom">
        <DrawerContent className="font-sukhumvit pb-[max(1rem,env(safe-area-inset-bottom))]">
          <DrawerHeader className="text-left">
            <DrawerTitle className="text-base font-black text-slate-900">ตัวกรองรายชื่อ</DrawerTitle>
            <DrawerDescription className="text-xs text-slate-500">
              เลือกแผนก ชั้น ห้อง หรือค้นหานักเรียน
            </DrawerDescription>
          </DrawerHeader>

          <div className="space-y-4 px-4">
            <DrawerFilterField
              label="แผนก"
              value={filter.department}
              onChange={(department) => setFilter((f) => ({
                ...f,
                department,
                gradeLevel: '',
                classId: '',
              }))}
              options={drawerDepartmentOptions}
            />
            <DrawerFilterField
              label="ชั้น"
              value={filter.gradeLevel}
              onChange={(gradeLevel) => setFilter((f) => ({
                ...f,
                gradeLevel,
                classId: '',
              }))}
              options={drawerGradeOptions}
              disabled={!filter.department}
            />
            <DrawerFilterField
              label="ห้องเรียน"
              value={filter.classId}
              onChange={(classId) => setFilter((f) => ({ ...f, classId }))}
              options={drawerClassOptions}
              disabled={!filter.gradeLevel}
            />
            <div>
              <label className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-slate-400">
                ค้นหา
              </label>
              <div className="relative">
                <HiOutlineMagnifyingGlass className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <input
                  type="text"
                  placeholder="ชื่อ หรือรหัสนักเรียน (มากกว่า 5 ตัวอักษร)"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-9 text-[13px] font-bold text-slate-800 placeholder:text-slate-400 outline-none transition-all focus:border-blue-200 focus:ring-4 focus:ring-blue-50/50"
                />
                {searchInput && (
                  <button
                    type="button"
                    onClick={() => setSearchInput('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    aria-label="ล้างคำค้นหา"
                  >
                    <HiXMark size={14} />
                  </button>
                )}
              </div>
              {searchInput.length > 0 && searchInput.length < MIN_SEARCH_LENGTH && (
                <p className="mt-1.5 text-[11px] font-bold text-amber-600">
                  พิมพ์มากกว่า 5 ตัวอักษรเพื่อค้นหา ({searchInput.length}/{MIN_SEARCH_LENGTH})
                </p>
              )}
            </div>
          </div>

          <DrawerFooter className="flex-row gap-2">
            {isFilterActive && (
              <button
                type="button"
                onClick={() => {
                  clearFilters();
                }}
                className="h-11 flex-1 rounded-xl border border-rose-200 bg-rose-50 text-[13px] font-black text-rose-600 transition-colors hover:bg-rose-100"
              >
                ล้างตัวกรอง
              </button>
            )}
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

      <div className="hidden lg:block">{desktopFilterBar}</div>

      {!hasAppliedFilter ? (
        <div
          className={cn(
            'flex flex-1 items-center justify-center px-6',
            !isMdOrBelow && 'min-h-[45vh]',
          )}
        >
          <p className="max-w-xs text-center text-sm font-bold text-slate-400">
            กรุณาเลือกแผนก ชั้น ห้อง หรือค้นหานักเรียนเพื่อแสดงรายชื่อ
          </p>
        </div>
      ) : !isDataLoaded || loadingTotals ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-7 h-7 border-2 border-slate-200 border-t-slate-500 rounded-full animate-spin" />
        </div>
      ) : filteredStudentCards.length === 0 ? (
        <p className="text-center text-sm font-bold text-slate-400 py-16">ไม่พบนักเรียน</p>
      ) : (
        <div className="flex w-full flex-1 flex-col min-h-0 gap-4">
          <div className="grid w-full grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-3">
            {paginatedStudentCards.map((card) => {
            const studentName = `${card.student.prefix ?? ''}${card.student.firstName} ${card.student.lastName}`.trim();
            const total = mergedTotals.get(card.student.id);
            const score = total?.totalPoints ?? BASELINE_POINTS;
            return (
              <motion.button
                key={card.student.id}
                whileTap={{ scale: 0.96 }}
                onClick={() => setSelectedCard(card)}
                className="flex h-full w-full min-w-0 flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-white border border-slate-100 shadow-sm hover:border-slate-200 transition-all text-center"
              >
                <StudentAvatar
                  studentId={card.student.id}
                  name={studentName}
                  photoURL={card.student.photoURL}
                  gender={card.student.gender}
                  className="w-14 h-14 rounded-2xl"
                />
                <div className="min-w-0 w-full">
                  <p className="text-xs font-black text-slate-800 truncate">{studentName}</p>
                  <p className="text-[10px] font-bold text-slate-400 truncate">{card.student.studentCode}</p>
                </div>
                <span
                  className={cn(
                    'text-xs font-black px-2.5 py-1 rounded-xl',
                    score >= BASELINE_POINTS ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600',
                  )}
                >
                  {score}
                </span>
              </motion.button>
            );
            })}
          </div>

          {totalPages > 1 && (
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-slate-200/60 bg-slate-50/80 rounded-xl px-3 py-3 mt-1">
              <p className="font-sarabun text-[11px] font-bold text-slate-500">
                แสดง {rangeStart}–{rangeEnd} จาก {filteredStudentCards.length} คน
              </p>

              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="h-8 w-8 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30 flex items-center justify-center"
                  aria-label="หน้าก่อนหน้า"
                >
                  <HiChevronLeft size={16} />
                </Button>

                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((page) => {
                    if (totalPages > 5) {
                      if (page !== 1 && page !== totalPages && Math.abs(page - currentPage) > 1) {
                        if (page === 2 || page === totalPages - 1) {
                          return (
                            <span key={`ellipsis-${page}`} className="px-0.5 font-sarabun text-[10px] text-slate-300">
                              …
                            </span>
                          );
                        }
                        return null;
                      }
                    }

                    const isActive = currentPage === page;
                    return (
                      <button
                        key={page}
                        type="button"
                        onClick={() => setCurrentPage(page)}
                        className={cn(
                          'h-8 min-w-[32px] rounded-lg px-2 font-sukhumvit text-[11px] font-black transition-all',
                          isActive
                            ? 'bg-slate-900 text-white shadow-sm'
                            : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800',
                        )}
                      >
                        {page}
                      </button>
                    );
                  })}
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="h-8 w-8 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30 flex items-center justify-center"
                  aria-label="หน้าถัดไป"
                >
                  <HiChevronRight size={16} />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {selectedCard !== null && (
        <Suspense fallback={null}>
          <StudentQuickTapModal
            open
            onClose={() => setSelectedCard(null)}
            studentCard={selectedCard}
            academicYearId={academicYearId}
            semester={activeSemester}
            currentTotal={mergedTotals.get(selectedCard.student.id)}
            onRecorded={(next) => {
              setLocalTotals((prev) => {
                const updated = new Map(prev);
                updated.set(next.studentId, next);
                return updated;
              });
            }}
          />
        </Suspense>
      )}
    </div>
  );
}
