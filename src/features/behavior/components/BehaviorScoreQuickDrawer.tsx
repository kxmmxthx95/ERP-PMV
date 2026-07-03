import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { HiChevronLeft, HiChevronRight, HiOutlineMagnifyingGlass, HiXMark } from 'react-icons/hi2';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { useActiveAcademicYear } from '@/hooks/useActiveAcademicYear';
import { useStudentManager } from '@/hooks/useStudentManager';
import { useBehaviorTotals } from '@/hooks/useBehaviorScore';
import StudentAvatar from '@/features/students/components/StudentAvatar';
import type { StudentCard } from '@/types/student';
import type { BehaviorTotal } from '@/types/behavior';
import type { Department } from '@/types/curriculum';
import { GRADE_LEVEL_ORDER } from '@/types/class';
import { cn } from '@/lib/utils';
import {
  BEHAVIOR_DEPARTMENT_OPTIONS,
  BEHAVIOR_GRADES_BY_DEPARTMENT,
  BEHAVIOR_MIN_SEARCH_LENGTH,
} from '../utils/behaviorStudentFilters';

const StudentQuickTapModal = lazy(() => import('./StudentQuickTapModal'));

const BASELINE_POINTS = 100;
const ITEMS_PER_PAGE = 24;

const DRAWER_CONTENT_CLASS = cn(
  'flex h-dvh flex-col bg-transparent p-0 font-sukhumvit before:hidden',
  'data-[vaul-drawer-direction=right]:w-screen data-[vaul-drawer-direction=right]:max-w-none',
  'sm:h-full sm:data-[vaul-drawer-direction=right]:w-full sm:data-[vaul-drawer-direction=right]:max-w-lg sm:p-2',
);

const DRAWER_PANEL_CLASS = cn(
  'flex h-full min-h-0 flex-col overflow-hidden bg-white',
  'sm:rounded-4xl sm:border sm:border-slate-200/70 sm:shadow-xl',
);

const selectClassName =
  'h-10 w-full min-w-0 appearance-none truncate rounded-xl border border-slate-200 bg-white px-2 pr-7 text-[11px] font-bold text-slate-800 outline-none transition-all focus:border-blue-200 focus:ring-4 focus:ring-blue-50/50 disabled:cursor-not-allowed disabled:opacity-40';

function FilterSelect({
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
    <div className="min-w-0">
      <div className="relative min-w-0">
        <select
          aria-label={label}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={selectClassName}
        >
          {options.map((o) => (
            <option key={o.value || 'empty'} value={o.value}>{o.label}</option>
          ))}
        </select>
        <HiChevronRight className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 rotate-90 text-slate-400" />
      </div>
    </div>
  );
}

interface BehaviorScoreQuickDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  academicYearId: string;
}

export default function BehaviorScoreQuickDrawer({
  open,
  onOpenChange,
  academicYearId,
}: BehaviorScoreQuickDrawerProps) {
  const { activeSemester } = useActiveAcademicYear();
  const studentMgr = useStudentManager(academicYearId);
  const { totals, loading: loadingTotals } = useBehaviorTotals(academicYearId);

  const [localTotals, setLocalTotals] = useState<Map<string, BehaviorTotal>>(new Map());
  const [selectedCard, setSelectedCard] = useState<StudentCard | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const { filteredStudentCards, isDataLoaded, filter, setFilter, availableClasses } = studentMgr;

  useEffect(() => {
    if (!open) {
      setSearchInput('');
      setCurrentPage(1);
      setSelectedCard(null);
      setFilter((f) => ({
        ...f,
        department: '',
        gradeLevel: '',
        classId: '',
        searchText: '',
      }));
    }
  }, [open, setFilter]);

  useEffect(() => {
    const nextSearch = searchInput.length >= BEHAVIOR_MIN_SEARCH_LENGTH ? searchInput : '';
    setFilter((f) => (f.searchText === nextSearch ? f : { ...f, searchText: nextSearch }));
  }, [searchInput, setFilter]);

  const gradeOptions = useMemo(() => {
    const dept = filter.department as Department | '';
    if (!dept) return [];
    return [...BEHAVIOR_GRADES_BY_DEPARTMENT[dept]].sort(
      (a, b) => (GRADE_LEVEL_ORDER[a] ?? 99) - (GRADE_LEVEL_ORDER[b] ?? 99),
    );
  }, [filter.department]);

  const departmentOptions = useMemo(
    () => BEHAVIOR_DEPARTMENT_OPTIONS.map((opt) => (
      opt.value === '' ? { value: '', label: 'เลือกแผนก' } : opt
    )),
    [],
  );

  const gradeSelectOptions = useMemo(() => [
    { value: '', label: filter.department ? 'ทุกชั้น' : 'เลือกแผนกก่อน' },
    ...gradeOptions.map((grade) => ({ value: grade, label: grade })),
  ], [filter.department, gradeOptions]);

  const classSelectOptions = useMemo(() => [
    { value: '', label: filter.gradeLevel ? 'ทุกห้อง' : 'เลือกชั้นก่อน' },
    ...availableClasses.map((c) => ({ value: c.classId, label: c.className })),
  ], [availableClasses, filter.gradeLevel]);

  const hasAppliedFilter = Boolean(
    filter.department || filter.gradeLevel || filter.classId || filter.searchText,
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

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange} direction="right">
        <DrawerContent className={DRAWER_CONTENT_CLASS}>
          <div className={DRAWER_PANEL_CLASS}>
            <DrawerHeader className="shrink-0 border-b border-slate-100/70 px-5 pb-4 pt-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <DrawerTitle className="text-base font-black text-slate-800">
                    บันทึกคะแนนพฤติกรรม
                  </DrawerTitle>
                  <DrawerDescription className="text-xs font-bold text-slate-400">
                    เลือกแผนก ชั้น ห้อง หรือค้นหานักเรียน
                  </DrawerDescription>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition-all hover:bg-slate-50 active:scale-95"
                  aria-label="ปิด"
                >
                  <HiXMark size={18} />
                </button>
              </div>
            </DrawerHeader>

            <div className="shrink-0 space-y-3 border-b border-slate-100/70 px-5 py-4">
              <div className="relative">
                <HiOutlineMagnifyingGlass
                  size={16}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-300"
                />
                <input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder={`ค้นหาชื่อหรือรหัส (มากกว่า ${BEHAVIOR_MIN_SEARCH_LENGTH} ตัวอักษร)`}
                  className="h-10 w-full rounded-xl border border-slate-100 bg-slate-50 pl-9 pr-3 text-xs font-bold text-slate-700 placeholder:text-slate-300 focus:border-blue-200 focus:outline-none focus:ring-4 focus:ring-blue-500/5"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <FilterSelect
                  label="แผนก"
                  value={filter.department}
                  onChange={(department) => {
                    setFilter((f) => ({ ...f, department, gradeLevel: '', classId: '' }));
                  }}
                  options={departmentOptions}
                />
                <FilterSelect
                  label="ระดับชั้น"
                  value={filter.gradeLevel}
                  onChange={(gradeLevel) => {
                    setFilter((f) => ({ ...f, gradeLevel, classId: '' }));
                  }}
                  options={gradeSelectOptions}
                  disabled={!filter.department}
                />
                <FilterSelect
                  label="ห้อง"
                  value={filter.classId}
                  onChange={(classId) => setFilter((f) => ({ ...f, classId }))}
                  options={classSelectOptions}
                  disabled={!filter.gradeLevel}
                />
              </div>

              {searchInput.length > 0 && searchInput.length < BEHAVIOR_MIN_SEARCH_LENGTH && (
                <p className="text-[11px] font-bold text-amber-600">
                  พิมพ์มากกว่า {BEHAVIOR_MIN_SEARCH_LENGTH} ตัวอักษรเพื่อค้นหา ({searchInput.length}/{BEHAVIOR_MIN_SEARCH_LENGTH})
                </p>
              )}

              {hasAppliedFilter && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-[11px] font-bold text-rose-600 transition-colors hover:text-rose-700"
                >
                  ล้างตัวกรอง
                </button>
              )}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              {!hasAppliedFilter ? (
                <div className="flex h-full min-h-[240px] items-center justify-center px-4">
                  <p className="max-w-xs text-center text-sm font-bold text-slate-400">
                    กรุณาเลือกแผนก ชั้น ห้อง หรือค้นหานักเรียนเพื่อแสดงรายชื่อ
                  </p>
                </div>
              ) : !isDataLoaded || loadingTotals ? (
                <div className="flex items-center justify-center py-16">
                  <div className="h-7 w-7 animate-spin rounded-full border-2 border-slate-200 border-t-slate-500" />
                </div>
              ) : filteredStudentCards.length === 0 ? (
                <p className="py-16 text-center text-sm font-bold text-slate-400">ไม่พบนักเรียน</p>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] gap-3">
                    {paginatedStudentCards.map((card) => {
                      const studentName = `${card.student.prefix ?? ''}${card.student.firstName} ${card.student.lastName}`.trim();
                      const total = mergedTotals.get(card.student.id);
                      const score = total?.totalPoints ?? BASELINE_POINTS;
                      return (
                        <motion.button
                          key={card.student.id}
                          type="button"
                          whileTap={{ scale: 0.96 }}
                          onClick={() => setSelectedCard(card)}
                          className="flex w-full min-w-0 flex-col items-center gap-2 rounded-2xl border border-slate-100 bg-white p-3 text-center shadow-sm transition-all hover:border-slate-200"
                        >
                          <StudentAvatar
                            studentId={card.student.id}
                            name={studentName}
                            photoURL={card.student.photoURL}
                            gender={card.student.gender}
                            className="h-12 w-12 rounded-2xl"
                          />
                          <div className="min-w-0 w-full">
                            <p className="truncate text-xs font-black text-slate-800">{studentName}</p>
                            <p className="truncate text-[10px] font-bold text-slate-400">{card.student.studentCode}</p>
                          </div>
                          <span
                            className={cn(
                              'rounded-xl px-2.5 py-1 text-xs font-black',
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
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-3">
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
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                          aria-label="หน้าก่อนหน้า"
                        >
                          <HiChevronLeft size={16} />
                        </Button>
                        <span className="px-2 font-sukhumvit text-[11px] font-black text-slate-600">
                          {currentPage}/{totalPages}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled={currentPage === totalPages}
                          onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                          aria-label="หน้าถัดไป"
                        >
                          <HiChevronRight size={16} />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </DrawerContent>
      </Drawer>

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
    </>
  );
}
