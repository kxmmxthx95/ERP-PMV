import { useMemo, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Plus, FileSpreadsheet } from 'lucide-react';
import { HiArrowLeft, HiChevronLeft, HiMagnifyingGlass, HiOutlineBookOpen, HiXMark } from 'react-icons/hi2';
import { useAuth } from '@/hooks/useAuth';
import { useQuestionSetBank, type QuestionSetFilters } from '@/hooks/useQuestionSetBank';
import type { NewQuestionSet, QuestionSet } from '@/types/questionBank';
import { SUBJECT_GROUP_CONFIG, SUBJECT_SUBGROUP_CONFIG, DEPARTMENT_CONFIG, type Department, type SubjectGroupId } from '@/types/curriculum';
import QuestionSetBuilder from './components/QuestionSetBuilder';
import QuestionSetImportModal from './components/QuestionSetImportModal';
import QuestionSetExamSimulator from './components/QuestionSetExamSimulator';
import QuestionSetList from './components/QuestionSetList';
import QuestionSetQuestionManager from './components/QuestionSetQuestionManager';

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
  } | null>(null);
  const [setImportModalOpen, setSetImportModalOpen] = useState(false);
  const [simulatingSet, setSimulatingSet] = useState<QuestionSet | null>(null);
  const [editingSet, setEditingSet] = useState<QuestionSet | null>(null);
  const [selectedSet, setSelectedSet] = useState<QuestionSet | null>(null);

  const [filters, setFilters] = useState<QuestionSetFilters>({
    search: '',
    subjectGroup: 'all',
    subSubjectGroup: 'all',
    department: 'all',
    gradeLevel: 'all',
  });

  const [headerFiltersPortalEl, setHeaderFiltersPortalEl] = useState<HTMLElement | null>(null);
  const [headerCenterMobilePortalEl, setHeaderCenterMobilePortalEl] = useState<HTMLElement | null>(null);
  const [headerMobileActionsPortalEl, setHeaderMobileActionsPortalEl] = useState<HTMLElement | null>(null);
  const [headerMobileBackPortalEl, setHeaderMobileBackPortalEl] = useState<HTMLElement | null>(null);
  const [isSearchMode, setIsSearchMode] = useState(false);
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
    const handleResize = () => setIsMdOrBelow(window.innerWidth < 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const defaultBack = document.getElementById('portal-default-mobile-back');
    if (!defaultBack) return;
    defaultBack.style.display = selectedSet ? 'none' : '';
  }, [selectedSet]);

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
      subjectGroup: 'all',
      subSubjectGroup: 'all',
      department: 'all',
      gradeLevel: 'all',
    });
  };

  const hasActiveFilters = 
    filters.search !== '' || 
    filters.subjectGroup !== 'all' || 
    filters.subSubjectGroup !== 'all' || 
    filters.department !== 'all' || 
    filters.gradeLevel !== 'all';

  const visibleSets = useMemo(() => {
    const filtered = filterQuestionSets(filters).filter((set) => set.setKind !== 'exercise');
    return isStudentView ? filtered.filter((set) => set.isPublished) : filtered;
  }, [filterQuestionSets, filters, isStudentView]);

  const openCreateSet = () => { setEditingSet(null); setCreatePrefill(null); setSetModalOpen(true); };
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
          <select
            value={filters.subjectGroup}
            onChange={(e) => setFilters(prev => ({ ...prev, subjectGroup: e.target.value as SubjectGroupId | 'all', subSubjectGroup: 'all' }))}
            className="h-8 px-3 rounded-full text-[11px] font-black text-slate-500 hover:text-slate-800 hover:bg-black/5 transition-all outline-none cursor-pointer font-sukhumvit"
          >
            <option value="all">ทุกกลุ่มสาระ</option>
            {Object.entries(SUBJECT_GROUP_CONFIG)
              .sort(([, a], [, b]) => a.order - b.order)
              .map(([id, cfg]) => (
                <option key={id} value={id}>{cfg.name}</option>
              ))}
          </select>

          {filters.subjectGroup && filters.subjectGroup !== 'all' && SUBJECT_SUBGROUP_CONFIG[filters.subjectGroup] && (
            <select
              value={filters.subSubjectGroup}
              onChange={(e) => setFilters(prev => ({ ...prev, subSubjectGroup: e.target.value }))}
              className="h-8 px-3 rounded-full text-[11px] font-black text-slate-500 hover:text-slate-800 hover:bg-black/5 transition-all outline-none cursor-pointer font-sukhumvit"
            >
              <option value="all">ทุกวิชา/สาระย่อย</option>
              {SUBJECT_SUBGROUP_CONFIG[filters.subjectGroup]?.map(sub => (
                <option key={sub} value={sub}>{sub}</option>
              ))}
            </select>
          )}

          <div className="w-px h-5 bg-black/10 mx-1 shrink-0" />

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

  const mobileFilterCapsules = !selectedSet ? (
    <motion.div
      layout
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className={`pointer-events-auto flex w-full min-w-0 flex-col gap-2 rounded-2xl p-2 transition-all duration-300 ${
        isSearchMode
          ? 'border border-blue-100 bg-blue-50/90 shadow-md'
          : 'border border-white bg-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.04)] backdrop-blur-xl'
      }`}
    >
      {isSearchMode ? (
        <div className="flex h-9 w-full min-w-0 items-center gap-2 px-2">
          <HiMagnifyingGlass size={15} className="shrink-0 text-slate-400" />
          <input
            value={filters.search || ''}
            onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
            placeholder="ค้นหาชุดข้อสอบ..."
            autoFocus
            className="min-w-0 flex-1 border-none bg-transparent text-[11px] font-bold text-slate-800 outline-none placeholder:text-slate-400 font-sukhumvit"
          />
          <button
            type="button"
            onClick={() => {
              setFilters((prev) => ({ ...prev, search: '' }));
              setIsSearchMode(false);
            }}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-400 transition-all hover:bg-black/5 hover:text-slate-600"
            aria-label="ปิดการค้นหา"
          >
            <HiXMark size={14} />
          </button>
        </div>
      ) : (
        <>
          <div className="flex w-full min-w-0 gap-2">
            <select
              value={filters.subjectGroup}
              onChange={(e) => setFilters(prev => ({ ...prev, subjectGroup: e.target.value as SubjectGroupId | 'all', subSubjectGroup: 'all' }))}
              className="h-8 min-w-0 flex-1 rounded-xl bg-white/80 px-2 text-[10px] font-black text-slate-600 outline-none cursor-pointer font-sukhumvit"
            >
              <option value="all">ทุกกลุ่มสาระ</option>
              {Object.entries(SUBJECT_GROUP_CONFIG)
                .sort(([, a], [, b]) => a.order - b.order)
                .map(([id, cfg]) => (
                  <option key={id} value={id}>{cfg.name}</option>
                ))}
            </select>

            {filters.subjectGroup && filters.subjectGroup !== 'all' && SUBJECT_SUBGROUP_CONFIG[filters.subjectGroup] && (
              <select
                value={filters.subSubjectGroup}
                onChange={(e) => setFilters(prev => ({ ...prev, subSubjectGroup: e.target.value }))}
                className="h-8 min-w-0 flex-1 rounded-xl bg-white/80 px-2 text-[10px] font-black text-slate-600 outline-none cursor-pointer font-sukhumvit"
              >
                <option value="all">ทุกสาระย่อย</option>
                {SUBJECT_SUBGROUP_CONFIG[filters.subjectGroup]?.map(sub => (
                  <option key={sub} value={sub}>{sub}</option>
                ))}
              </select>
            )}
          </div>

          <div className="flex w-full min-w-0 items-center gap-1">
            <AnimatePresence mode="wait">
              {filters.department === 'all' ? (
                <motion.div
                  key="mobile-depts"
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 8 }}
                  className="flex min-w-0 flex-1 items-center gap-1"
                >
                  {DEPT_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setFilters(prev => ({ ...prev, department: opt.id as Department | 'all', gradeLevel: 'all' }))}
                      className={`h-8 min-w-0 flex-1 rounded-full px-1 text-center text-[10px] font-black whitespace-nowrap transition-all font-sukhumvit ${
                        filters.department === opt.id
                          ? 'bg-slate-900 text-white shadow-md'
                          : 'bg-white/80 text-slate-500 hover:bg-black/5 hover:text-slate-800'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </motion.div>
              ) : (
                <motion.div
                  key="mobile-grades"
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto no-scrollbar"
                >
                  <button
                    type="button"
                    onClick={() => setFilters(prev => ({ ...prev, department: 'all', gradeLevel: 'all' }))}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/80 text-slate-500 transition-all hover:bg-black/5 hover:text-slate-800"
                    aria-label="กลับเลือกแผนก"
                  >
                    <HiChevronLeft size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilters(prev => ({ ...prev, gradeLevel: 'all' }))}
                    className={`h-8 shrink-0 rounded-full px-3 text-[10px] font-black whitespace-nowrap transition-all font-sukhumvit ${
                      filters.gradeLevel === 'all'
                        ? 'bg-slate-900 text-white shadow-md'
                        : 'bg-white/80 text-slate-500 hover:bg-black/5 hover:text-slate-800'
                    }`}
                  >
                    ทุกระดับ
                  </button>
                  {(DEPARTMENT_CONFIG[filters.department as Department]?.grades || []).map((grade) => (
                    <button
                      key={grade}
                      type="button"
                      onClick={() => setFilters(prev => ({ ...prev, gradeLevel: grade }))}
                      className={`h-8 shrink-0 rounded-full px-3 text-[10px] font-black whitespace-nowrap transition-all font-sukhumvit ${
                        filters.gradeLevel === grade
                          ? 'bg-slate-900 text-white shadow-md'
                          : 'bg-white/80 text-slate-500 hover:bg-black/5 hover:text-slate-800'
                      }`}
                    >
                      {gradeShortLabel(grade)}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="ml-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-rose-500 transition-all hover:bg-rose-50"
                title="ล้างตัวกรองทั้งหมด"
                aria-label="ล้างตัวกรองทั้งหมด"
              >
                <HiXMark size={14} />
              </button>
            )}
          </div>
        </>
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
  ) : (
    <div className="pointer-events-auto flex items-center justify-center gap-1.5">
      <HiOutlineBookOpen className="h-4 w-4 shrink-0 text-slate-500" />
      <span className="text-[14px] font-black text-slate-800 tracking-tight font-sukhumvit">คลังข้อสอบ</span>
    </div>
  );

  return (
    <div className="relative w-full min-w-0 bg-transparent overflow-x-hidden h-full">
      {!isMdOrBelow && headerFiltersPortalEl && filterCapsules && createPortal(filterCapsules, headerFiltersPortalEl)}

      {isMdOrBelow && headerCenterMobilePortalEl && createPortal(mobilePageTitle, headerCenterMobilePortalEl)}

      {isMdOrBelow && headerMobileBackPortalEl && selectedSet && createPortal(
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          type="button"
          onClick={() => setSelectedSet(null)}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
          title="กลับรายการชุดข้อสอบ"
          aria-label="กลับรายการชุดข้อสอบ"
        >
          <HiArrowLeft className="h-5 w-5" />
        </motion.button>,
        headerMobileBackPortalEl,
      )}

      {isMdOrBelow && headerMobileActionsPortalEl && !selectedSet && createPortal(
        <div className="flex items-center gap-1.5">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            type="button"
            onClick={() => setIsSearchMode(true)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
            title="ค้นหาชุดข้อสอบ"
            aria-label="ค้นหาชุดข้อสอบ"
          >
            <HiMagnifyingGlass className="h-5 w-5" />
          </motion.button>
          {!isStudentView && (
            <>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                type="button"
                onClick={openImportSets}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
                title="นำเข้าชุดข้อสอบจาก CSV/Excel"
                aria-label="นำเข้าชุดข้อสอบจาก CSV/Excel"
              >
                <FileSpreadsheet className="h-5 w-5" />
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                type="button"
                onClick={openCreateSet}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-900 bg-slate-900 text-white shadow-sm transition-colors hover:bg-slate-800"
                title="เพิ่มชุดข้อสอบ"
                aria-label="เพิ่มชุดข้อสอบ"
              >
                <Plus className="h-5 w-5" strokeWidth={2.5} />
              </motion.button>
            </>
          )}
        </div>,
        headerMobileActionsPortalEl,
      )}

      <div className="w-full min-w-0 flex flex-col h-full gap-4 pb-24">
        <div className="flex-1 flex gap-4 min-h-0 min-w-0">
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className={`flex-1 flex flex-col min-h-0 min-w-0 w-full ${selectedSet ? 'p-0' : 'p-2'}`}
          >
            {isMdOrBelow && !selectedSet && mobileFilterCapsules && (
              <div className="mb-4 w-full min-w-0 lg:hidden">
                {mobileFilterCapsules}
              </div>
            )}
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
              />
            ) : !hasActiveFilters ? (
              <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white/50 py-16 text-center text-slate-400">
                <HiOutlineBookOpen className="mb-3 h-10 w-10 opacity-40" />
                <p className="font-sukhumvit text-[14px] font-black text-slate-600">
                  เลือกตัวกรองเพื่อแสดงชุดข้อสอบ
                </p>
                <p className="mt-1 max-w-xs font-sarabun text-[12px] font-medium text-slate-400">
                  เลือกกลุ่มสาระ แผนก ระดับชั้น หรือค้นหาชื่อชุดข้อสอบ
                </p>
              </div>
            ) : (
              <QuestionSetList
                sets={visibleSets}
                isStudentView={isStudentView}
                onSelect={setSelectedSet}
                onEdit={openEditSet}
                onDelete={handleDeleteSet}
                onSimulate={setSimulatingSet}
                onTogglePublished={handleTogglePublished}
              />
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
