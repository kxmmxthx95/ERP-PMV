import { useMemo, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Plus, FileSpreadsheet } from 'lucide-react';
import { HiArrowLeft, HiBars3, HiChevronLeft, HiMagnifyingGlass, HiOutlineBookOpen, HiXMark } from 'react-icons/hi2';
import {
  ExamFilterShowResultsButton,
  ExamMobileFilterDrawer,
} from '@/features/exam/components/ExamMobileFilterMenuButton';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useQuestionSetBank, type QuestionSetFilters } from '@/hooks/useQuestionSetBank';
import type { NewQuestionSet, QuestionSet } from '@/types/questionBank';
import { DEPARTMENT_CONFIG, type Department, type SubjectGroupId } from '@/types/curriculum';
import QuestionSetBuilder from './components/QuestionSetBuilder';
import QuestionSetImportModal from './components/QuestionSetImportModal';
import QuestionSetExamSimulator from './components/QuestionSetExamSimulator';
import QuestionSetList from './components/QuestionSetList';
import QuestionSetQuestionManager from './components/QuestionSetQuestionManager';
import QuestionBankBrowseNav, {
  type QuestionBankBrowseStep,
  UNSPECIFIED_SUB_SUBJECT,
  browseStepLabel,
  nextBrowseStepAfterGroup,
  previousBrowseStep,
  QuestionBankBrowseHeader,
} from './components/QuestionBankBrowseNav';

const DEPT_OPTIONS = [
  { id: 'all', label: 'ทั้งหมด' },
  { id: 'early', label: 'อนุบาล' },
  { id: 'primary', label: 'ประถม' },
  { id: 'secondary', label: 'มัธยม' },
] as const;

/** แสดงระดับชั้นแบบสั้นใน pill: ป.1 → 1, ม.2 → 2 */
function gradeShortLabel(grade: string): string {
  const dot = grade.indexOf('.');
  return dot >= 0 ? grade.slice(dot + 1) : grade;
}

export default function QuestionBankManager() {
  const navigate = useNavigate();
  const location = useLocation();
  const { role } = useAuth();
  const isStudentView = role === 'student';
  const {
    isLoading: isSetLoading,
    questionSets,
    addQuestionSet,
    addQuestionSetsBulk,
    updateQuestionSet,
    setQuestionSetPublished,
    deleteQuestionSet,
    filterQuestionSets,
  } = useQuestionSetBank();

  const [setModalOpen, setSetModalOpen] = useState(false);
  const [createPrefill, setCreatePrefill] = useState<{
    title?: string;
    description?: string;
    gradeLevel?: string;
    department?: string;
    subjectGroup?: SubjectGroupId;
    subSubjectGroup?: string;
  } | null>(null);
  const [setImportModalOpen, setSetImportModalOpen] = useState(false);
  const [simulatingSet, setSimulatingSet] = useState<QuestionSet | null>(null);
  const [editingSet, setEditingSet] = useState<QuestionSet | null>(null);
  const [selectedSet, setSelectedSet] = useState<QuestionSet | null>(null);
  const [browseStep, setBrowseStep] = useState<QuestionBankBrowseStep>({ level: 'groups' });

  const [filters, setFilters] = useState<QuestionSetFilters>({
    search: '',
    department: 'all',
    gradeLevel: 'all',
  });

  const [headerFiltersPortalEl, setHeaderFiltersPortalEl] = useState<HTMLElement | null>(null);
  const [headerCenterMobilePortalEl, setHeaderCenterMobilePortalEl] = useState<HTMLElement | null>(null);
  const [headerMobileActionsPortalEl, setHeaderMobileActionsPortalEl] = useState<HTMLElement | null>(null);
  const [headerMobileBackPortalEl, setHeaderMobileBackPortalEl] = useState<HTMLElement | null>(null);
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [mobileFilterDrawerOpen, setMobileFilterDrawerOpen] = useState(false);
  const [mobileActionsMenuOpen, setMobileActionsMenuOpen] = useState(false);
  const [isMdOrBelow, setIsMdOrBelow] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 1024 : false,
  );

  useEffect(() => {
    setHeaderFiltersPortalEl(document.getElementById('header-portal-center'));
    setHeaderCenterMobilePortalEl(document.getElementById('header-portal-center-mobile'));
    setHeaderMobileActionsPortalEl(document.getElementById('header-portal-mobile-actions'));
    setHeaderMobileBackPortalEl(document.getElementById('header-portal-mobile-back'));
  }, []);

  useEffect(() => {
    if (!mobileActionsMenuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileActionsMenuOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mobileActionsMenuOpen]);

  useEffect(() => {
    const handleResize = () => setIsMdOrBelow(window.innerWidth < 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const defaultBack = document.getElementById('portal-default-mobile-back');
    if (!defaultBack) return;
    defaultBack.style.display = (selectedSet || browseStep.level !== 'groups') ? 'none' : '';
  }, [selectedSet, browseStep.level]);

  useEffect(() => {
    const state = location.state as {
      openCreateSet?: boolean;
      prefill?: {
        title?: string;
        description?: string;
        gradeLevel?: string;
        department?: string;
      };
    } | null;
    if (!state?.openCreateSet) return;
    setEditingSet(null);
    setCreatePrefill(state.prefill ?? null);
    setSetModalOpen(true);
    navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, location.state, navigate]);

  const clearFilters = () => {
    setFilters({
      search: '',
      department: 'all',
      gradeLevel: 'all',
    });
    setBrowseStep({ level: 'groups' });
    setIsSearchMode(false);
  };

  const hasActiveFilters =
    filters.search !== '' ||
    filters.department !== 'all' ||
    filters.gradeLevel !== 'all';

  const isSearchActive = Boolean(filters.search?.trim());

  const baseSets = useMemo(() => {
    const filtered = filterQuestionSets({
      search: '',
      subjectGroup: 'all',
      subSubjectGroup: 'all',
      department: filters.department,
      gradeLevel: filters.gradeLevel,
    }).filter((set) => set.setKind !== 'exercise');
    return isStudentView ? filtered.filter((set) => set.isPublished) : filtered;
  }, [filterQuestionSets, filters.department, filters.gradeLevel, isStudentView]);

  const visibleSets = useMemo(() => {
    const filtered = filterQuestionSets(filters).filter((set) => set.setKind !== 'exercise');
    return isStudentView ? filtered.filter((set) => set.isPublished) : filtered;
  }, [filterQuestionSets, filters, isStudentView]);

  const browseSets = useMemo(() => {
    if (browseStep.level !== 'sets') return [];
    return baseSets.filter((set) => {
      if (set.subjectGroup !== browseStep.subjectGroup) return false;
      if (!browseStep.subSubjectGroup) return true;
      if (browseStep.subSubjectGroup === UNSPECIFIED_SUB_SUBJECT) return !set.subSubjectGroup?.trim();
      return set.subSubjectGroup === browseStep.subSubjectGroup;
    });
  }, [baseSets, browseStep]);

  const handleBrowseBack = () => {
    setBrowseStep((prev) => previousBrowseStep(prev));
  };

  const handleSelectGroup = (subjectGroup: SubjectGroupId) => {
    setBrowseStep(nextBrowseStepAfterGroup(subjectGroup));
  };

  const handleSelectSubGroup = (subSubjectGroup: string) => {
    if (browseStep.level !== 'subgroups') return;
    setBrowseStep({
      level: 'sets',
      subjectGroup: browseStep.subjectGroup,
      subSubjectGroup,
    });
  };

  const getCreatePrefillFromBrowse = (): typeof createPrefill => {
    if (browseStep.level === 'sets') {
      return {
        subjectGroup: browseStep.subjectGroup,
        subSubjectGroup: browseStep.subSubjectGroup === UNSPECIFIED_SUB_SUBJECT
          ? ''
          : browseStep.subSubjectGroup,
        department: filters.department !== 'all' ? filters.department : undefined,
        gradeLevel: filters.gradeLevel !== 'all' ? filters.gradeLevel : undefined,
      };
    }
    if (browseStep.level === 'subgroups') {
      return {
        subjectGroup: browseStep.subjectGroup,
        department: filters.department !== 'all' ? filters.department : undefined,
        gradeLevel: filters.gradeLevel !== 'all' ? filters.gradeLevel : undefined,
      };
    }
    return {
      department: filters.department !== 'all' ? filters.department : undefined,
      gradeLevel: filters.gradeLevel !== 'all' ? filters.gradeLevel : undefined,
    };
  };

  const openCreateSet = () => {
    setEditingSet(null);
    setCreatePrefill(getCreatePrefillFromBrowse());
    setSetModalOpen(true);
  };
  const openImportSets = () => setSetImportModalOpen(true);
  const openEditSet = (set: QuestionSet) => { setEditingSet(set); setSetModalOpen(true); };

  const handleSetSubmit = async (data: NewQuestionSet) => {
    if (editingSet) {
      await updateQuestionSet(editingSet.id, data);
    } else {
      await addQuestionSet(data);
    }
  };

  const handleImportSets = async (items: NewQuestionSet[]) => {
    await addQuestionSetsBulk(items);
  };

  const handleDeleteSet = async (set: QuestionSet) => {
    if (!confirm(`ลบชุดข้อสอบนี้?\n\n${set.title}`)) return;
    if (selectedSet?.id === set.id) setSelectedSet(null);
    await deleteQuestionSet(set);
  };

  const handleTogglePublished = async (set: QuestionSet, isPublished: boolean) => {
    await setQuestionSetPublished(set.id, isPublished);
  };



  const filterCapsules = !selectedSet ? (
    <motion.div
      layout
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex items-center gap-1.5 h-10 p-1 rounded-full pointer-events-auto transition-all duration-300 ${
        isSearchMode
          ? 'bg-blue-50/90 shadow-md border border-blue-100'
          : 'bg-white/60 backdrop-blur-xl border border-white shadow-[0_8px_32px_rgba(0,0,0,0.04)]'
      }`}
    >
      {isSearchMode ? (
        <motion.div
          key="search-active"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex items-center gap-2 px-2.5 w-[360px] h-full"
        >
          <HiMagnifyingGlass size={15} className="text-slate-400 shrink-0" />
          <input
            value={filters.search || ''}
            onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
            placeholder="ค้นหาชุดข้อสอบ..."
            autoFocus
            className="w-full bg-transparent border-none outline-none text-[11px] font-bold text-slate-800 placeholder:text-slate-400 font-sukhumvit"
          />
          <button
            onClick={() => {
              setFilters((prev) => ({ ...prev, search: '' }));
              setIsSearchMode(false);
            }}
            className="flex items-center justify-center w-6 h-6 rounded-full text-slate-400 hover:text-slate-600 hover:bg-black/5 transition-all"
          >
            <HiXMark size={14} />
          </button>
        </motion.div>
      ) : (
        <div className="flex items-center gap-1.5">
          <AnimatePresence mode="wait">
            {filters.department === 'all' ? (
              <motion.div
                key="depts"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="flex items-center gap-0.5"
              >
                {DEPT_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setFilters(prev => ({ ...prev, department: opt.id as Department | 'all', gradeLevel: 'all' }))}
                    className={`h-8 px-4 rounded-full text-[11px] font-black transition-all whitespace-nowrap ${
                      filters.department === opt.id
                        ? 'bg-slate-900 text-white shadow-md'
                        : 'text-slate-500 hover:text-slate-800 hover:bg-black/5'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </motion.div>
            ) : (
              <motion.div
                key="grades"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="flex items-center gap-0.5"
              >
                <button
                  onClick={() => setFilters(prev => ({ ...prev, department: 'all', gradeLevel: 'all' }))}
                  className="w-8 h-8 flex items-center justify-center rounded-full text-slate-500 hover:text-slate-800 hover:bg-black/5 transition-all mr-1"
                >
                  <HiChevronLeft size={16} />
                </button>
                <button
                  onClick={() => setFilters(prev => ({ ...prev, gradeLevel: 'all' }))}
                  className={`h-8 px-4 rounded-full text-[11px] font-black transition-all whitespace-nowrap ${
                    filters.gradeLevel === 'all'
                      ? 'bg-slate-900 text-white shadow-md'
                      : 'text-slate-500 hover:text-slate-800 hover:bg-black/5'
                  }`}
                >
                  ทุกระดับ
                </button>
                <div className="flex items-center gap-0.5 max-w-[300px] overflow-x-auto no-scrollbar ml-1">
                  {(DEPARTMENT_CONFIG[filters.department as Department]?.grades || []).map((grade) => (
                    <button
                      key={grade}
                      onClick={() => setFilters(prev => ({ ...prev, gradeLevel: grade }))}
                      className={`h-8 px-4 rounded-full text-[11px] font-black transition-all whitespace-nowrap ${
                        filters.gradeLevel === grade
                          ? 'bg-slate-900 text-white shadow-md'
                          : 'text-slate-500 hover:text-slate-800 hover:bg-black/5'
                      }`}
                    >
                      {gradeShortLabel(grade)}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="w-px h-5 bg-black/10 mx-1 shrink-0" />

          {!isStudentView && (
            <>
              {/* Import CSV */}
              <button
                type="button"
                onClick={openImportSets}
                className="flex h-8 w-8 flex-shrink-0 cursor-pointer items-center justify-center rounded-full text-slate-600 transition-all hover:bg-black/5 hover:text-slate-800 active:scale-90"
                title="นำเข้าชุดข้อสอบจาก CSV/Excel"
                aria-label="นำเข้าชุดข้อสอบจาก CSV/Excel"
              >
                <FileSpreadsheet size={16} />
              </button>

              {/* Add Button */}
              <button
                onClick={openCreateSet}
                className="flex items-center justify-center w-8 h-8 rounded-full text-slate-600 hover:text-slate-800 hover:bg-black/5 transition-all active:scale-90 flex-shrink-0 cursor-pointer"
                title="เพิ่มชุดข้อสอบ"
              >
                <Plus size={16} strokeWidth={3} />
              </button>

              <div className="w-px h-5 bg-black/10 mx-1 shrink-0" />
            </>
          )}

          <button
            onClick={() => setIsSearchMode(true)}
            className="flex items-center justify-center w-8 h-8 rounded-full text-slate-600 hover:text-slate-800 hover:bg-black/5 transition-all active:scale-90"
            title="ค้นหาชุดข้อสอบ"
          >
            <HiMagnifyingGlass size={16} />
          </button>

          {hasActiveFilters && (
            <>
              <div className="w-px h-5 bg-black/10 mx-1 shrink-0" />
              <button
                onClick={clearFilters}
                className="h-8 w-8 rounded-full text-rose-500 hover:bg-rose-50 transition-all flex items-center justify-center"
                title="ล้างตัวกรองทั้งหมด"
              >
                <HiXMark size={14} />
              </button>
            </>
          )}
        </div>
      )}
    </motion.div>
  ) : null;

  const mobilePageTitle = selectedSet ? (
    <div className="pointer-events-auto flex min-w-0 items-center justify-center gap-1.5 max-w-[calc(100vw-112px)]">
      <HiOutlineBookOpen className="h-4 w-4 shrink-0 text-slate-500" />
      <span className="truncate text-[13px] font-black text-slate-800 tracking-tight font-sukhumvit">
        {selectedSet.title}
      </span>
    </div>
  ) : isSearchActive ? (
    <div className="pointer-events-auto flex items-center justify-center gap-1.5">
      <HiMagnifyingGlass className="h-4 w-4 shrink-0 text-slate-500" />
      <span className="text-[14px] font-black text-slate-800 tracking-tight font-sukhumvit">ค้นหาชุดข้อสอบ</span>
    </div>
  ) : browseStep.level !== 'groups' ? (
    <div className="pointer-events-auto flex min-w-0 items-center justify-center gap-1.5 max-w-[calc(100vw-112px)]">
      <HiOutlineBookOpen className="h-4 w-4 shrink-0 text-slate-500" />
      <span className="truncate text-[13px] font-black text-slate-800 tracking-tight font-sukhumvit">
        {browseStepLabel(browseStep)}
      </span>
    </div>
  ) : (
    <div className="pointer-events-auto flex items-center justify-center gap-1.5">
      <HiOutlineBookOpen className="h-4 w-4 shrink-0 text-slate-500" />
      <span className="text-[14px] font-black text-slate-800 tracking-tight font-sukhumvit">คลังข้อสอบ</span>
    </div>
  );

  return (
    <div className="relative w-full min-w-0 overflow-x-hidden h-full">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-24 -left-16 h-72 w-72 rounded-full bg-indigo-200/40 blur-3xl" />
        <div className="absolute top-24 -right-20 h-80 w-80 rounded-full bg-violet-200/35 blur-3xl" />
      </div>
      {!isMdOrBelow && headerFiltersPortalEl && filterCapsules && createPortal(filterCapsules, headerFiltersPortalEl)}

      {isMdOrBelow && headerCenterMobilePortalEl && createPortal(mobilePageTitle, headerCenterMobilePortalEl)}

      {isMdOrBelow && headerMobileBackPortalEl && (selectedSet || browseStep.level !== 'groups' || isSearchActive) && createPortal(
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          type="button"
          onClick={() => {
            if (selectedSet) {
              setSelectedSet(null);
              return;
            }
            if (isSearchActive) {
              setFilters((prev) => ({ ...prev, search: '' }));
              setIsSearchMode(false);
              return;
            }
            handleBrowseBack();
          }}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
          title={selectedSet ? 'กลับรายการชุดข้อสอบ' : 'กลับ'}
          aria-label={selectedSet ? 'กลับรายการชุดข้อสอบ' : 'กลับ'}
        >
          <HiArrowLeft className="h-5 w-5" />
        </motion.button>,
        headerMobileBackPortalEl,
      )}

      {isMdOrBelow && headerMobileActionsPortalEl && !selectedSet && createPortal(
        <div className="pointer-events-auto flex items-center gap-1.5">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            type="button"
            onClick={() => setMobileFilterDrawerOpen(true)}
            className={cn(
              'relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition-colors hover:bg-slate-50',
              hasActiveFilters && 'border-violet-200 bg-violet-50 text-violet-700',
            )}
            title="ค้นหาและตัวกรอง"
            aria-label="ค้นหาและตัวกรอง"
          >
            <HiMagnifyingGlass className="h-5 w-5" />
            {hasActiveFilters && (
              <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-violet-500" aria-hidden />
            )}
          </motion.button>
          {!isStudentView && (
            <div className="relative">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                type="button"
                onClick={() => setMobileActionsMenuOpen((open) => !open)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
                title="เมนูจัดการ"
                aria-label="เมนูจัดการ"
                aria-expanded={mobileActionsMenuOpen}
              >
                <HiBars3 className="h-5 w-5" />
              </motion.button>
              {mobileActionsMenuOpen && (
                <>
                  <button
                    type="button"
                    className="fixed inset-0 z-[90] bg-black/20"
                    aria-label="ปิดเมนู"
                    onClick={() => setMobileActionsMenuOpen(false)}
                  />
                  <div className="fixed right-4 top-14 z-[100] w-[min(240px,calc(100vw-2rem))] rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl">
                    <button
                      type="button"
                      onClick={() => {
                        setMobileActionsMenuOpen(false);
                        openImportSets();
                      }}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[13px] font-bold font-sukhumvit text-slate-700 transition-colors hover:bg-slate-50"
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-600">
                        <FileSpreadsheet size={14} />
                      </span>
                      <span>นำเข้าชุดข้อสอบ</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMobileActionsMenuOpen(false);
                        openCreateSet();
                      }}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[13px] font-bold font-sukhumvit text-slate-900 transition-colors hover:bg-slate-50"
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-900 bg-slate-900 text-white">
                        <Plus size={14} strokeWidth={2.5} />
                      </span>
                      <span>เพิ่มชุดข้อสอบ</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>,
        headerMobileActionsPortalEl,
      )}

      <ExamMobileFilterDrawer
        open={mobileFilterDrawerOpen}
        onOpenChange={setMobileFilterDrawerOpen}
        title="ค้นหาและตัวกรอง"
        description="ค้นหาชื่อชุดข้อสอบ หรือเลือกแผนก/ระดับชั้น"
        footer={(
          <ExamFilterShowResultsButton onClick={() => setMobileFilterDrawerOpen(false)} />
        )}
      >
        <div>
          <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-slate-400">ค้นหา</p>
          <div className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3">
            <HiMagnifyingGlass className="h-4 w-4 shrink-0 text-slate-400" />
            <input
              value={filters.search || ''}
              onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
              placeholder="ค้นหาชุดข้อสอบ..."
              className="min-w-0 flex-1 border-none bg-transparent text-[12px] font-bold text-slate-800 outline-none placeholder:text-slate-400 font-sukhumvit"
            />
            {filters.search && (
              <button
                type="button"
                onClick={() => setFilters((prev) => ({ ...prev, search: '' }))}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100"
                aria-label="ล้างคำค้นหา"
              >
                <HiXMark className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        <div>
          <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-slate-400">แผนก</p>
          <div className="grid grid-cols-2 gap-2">
            {DEPT_OPTIONS.map((opt) => {
              const isActive = filters.department === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setFilters((prev) => ({
                    ...prev,
                    department: opt.id as Department | 'all',
                    gradeLevel: 'all',
                  }))}
                  className={cn(
                    'rounded-xl border px-3 py-2.5 text-[12px] font-black transition-all font-sukhumvit',
                    isActive
                      ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
                  )}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {filters.department !== 'all' && (
          <div>
            <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-slate-400">ระดับชั้น</p>
            <div className="grid grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => setFilters((prev) => ({ ...prev, gradeLevel: 'all' }))}
                className={cn(
                  'rounded-xl border px-2 py-2.5 text-[12px] font-black transition-all font-sukhumvit',
                  filters.gradeLevel === 'all'
                    ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
                )}
              >
                ทั้งหมด
              </button>
              {(DEPARTMENT_CONFIG[filters.department as Department]?.grades || []).map((grade) => {
                const isActive = filters.gradeLevel === grade;
                return (
                  <button
                    key={grade}
                    type="button"
                    onClick={() => setFilters((prev) => ({ ...prev, gradeLevel: grade }))}
                    className={cn(
                      'rounded-xl border px-2 py-2.5 text-[12px] font-black transition-all font-sukhumvit',
                      isActive
                        ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
                    )}
                  >
                    {gradeShortLabel(grade)}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="w-full rounded-xl border border-rose-200 bg-rose-50 py-2.5 text-[12px] font-black text-rose-600 transition-colors hover:bg-rose-100 font-sukhumvit"
          >
            ล้างตัวกรองทั้งหมด
          </button>
        )}
      </ExamMobileFilterDrawer>

      <div className="w-full min-w-0 flex flex-col h-full gap-4 pb-24">
        <div className="flex-1 flex gap-4 min-h-0 min-w-0">
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className={`flex-1 flex flex-col min-h-0 min-w-0 w-full ${selectedSet ? 'p-0' : 'p-2'}`}
          >
            {!isMdOrBelow && !headerFiltersPortalEl && filterCapsules && (
              <div className="mb-6">
                {filterCapsules}
              </div>
            )}


            {isSetLoading ? (
              <SkeletonList />
            ) : selectedSet && !isStudentView ? (
              <QuestionSetQuestionManager
                set={selectedSet}
                onBack={() => setSelectedSet(null)}
                onSetUpdated={setSelectedSet}
                updateQuestionSet={updateQuestionSet}
              />
            ) : isSearchActive ? (
              <QuestionSetList
                sets={visibleSets}
                isStudentView={isStudentView}
                onSelect={setSelectedSet}
                onEdit={openEditSet}
                onDelete={handleDeleteSet}
                onSimulate={setSimulatingSet}
                onTogglePublished={handleTogglePublished}
              />
            ) : browseStep.level === 'groups' || browseStep.level === 'subgroups' ? (
              <>
                {browseStep.level === 'subgroups' && (
                  <QuestionBankBrowseHeader step={browseStep} onBack={handleBrowseBack} />
                )}
                <QuestionBankBrowseNav
                  step={browseStep}
                  sets={baseSets}
                  onSelectGroup={handleSelectGroup}
                  onSelectSubGroup={handleSelectSubGroup}
                />
              </>
            ) : (
              <>
                <QuestionBankBrowseHeader step={browseStep} onBack={handleBrowseBack} />
                <QuestionSetList
                  sets={browseSets}
                  isStudentView={isStudentView}
                  emptyTitle="ยังไม่มีชุดข้อสอบในรายการนี้"
                  emptyHint="ลองเปลี่ยนตัวกรองแผนก/ระดับชั้น หรือเพิ่มชุดข้อสอบใหม่"
                  onSelect={setSelectedSet}
                  onEdit={openEditSet}
                  onDelete={handleDeleteSet}
                  onSimulate={setSimulatingSet}
                  onTogglePublished={handleTogglePublished}
                />
              </>
            )}
          </motion.section>
        </div>
      </div>

      <QuestionSetBuilder
        key={`qsb-${setModalOpen ? (editingSet?.id ?? `new-${createPrefill?.title ?? ''}`) : 'closed'}`}
        open={setModalOpen}
        onClose={() => { setSetModalOpen(false); setCreatePrefill(null); }}
        initial={editingSet}
        prefill={createPrefill}
        existingSets={questionSets}
        onSubmit={handleSetSubmit}
      />

      <QuestionSetImportModal
        open={setImportModalOpen}
        onClose={() => setSetImportModalOpen(false)}
        onImport={handleImportSets}
      />

      {simulatingSet && (
        <QuestionSetExamSimulator
          set={simulatingSet}
          open={!!simulatingSet}
          onClose={() => setSimulatingSet(null)}
        />
      )}
    </div>
  );
}

function SkeletonList() {
  return (
    <div className="flex-1 space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <motion.div
          key={i}
          animate={{ opacity: [0.4, 0.8, 0.4] }}
          transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.1 }}
          className="h-16 rounded-[1.5rem] bg-white/40"
        />
      ))}
    </div>
  );
}
