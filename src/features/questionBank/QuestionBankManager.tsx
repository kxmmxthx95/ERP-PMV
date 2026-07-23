import { useMemo, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, FileSpreadsheet, FileText } from 'lucide-react';
import {
  HiAcademicCap,
  HiArrowLeft,
  HiBars3,
  HiChevronLeft,
  HiChevronRight,
  HiMagnifyingGlass,
  HiOutlineBookOpen,
  HiOutlineFunnel,
  HiXMark,
} from 'react-icons/hi2';
import {
  ExamFilterShowResultsButton,
  ExamMobileFilterDrawer,
} from '@/features/exam/components/ExamMobileFilterMenuButton';
import { cn } from '@/lib/utils';
import { HEADER_ICON_BTN, HEADER_ICON_BTN_GROUP } from '@/lib/headerIconBtn';
import { useAuth } from '@/hooks/useAuth';
import { useQuestionSetBank, type QuestionSetFilters } from '@/hooks/useQuestionSetBank';
import type { NewQuestionSet, QuestionSet } from '@/types/questionBank';
import {
  DEPARTMENT_CONFIG,
  SUBJECT_GROUP_CONFIG,
  type Department,
  type SubjectGroupId,
} from '@/types/curriculum';
import GradeBookClassSidebar from '@/features/grades/components/GradeBookClassSidebar';
import SidebarCollapseButton from '@/features/grades/components/SidebarCollapseButton';
import { SubjectIcon } from '@/features/curriculum/utils/subjectVisual';
import { useTeachersCollection } from '@/hooks/useTeachersCollection';
import { resolveQuestionSetCreatorName } from '@/features/questionBank/utils/questionSetCreatorName';
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
} from './components/QuestionBankBrowseNav';

type BrowseNavFrame = {
  browseStep: QuestionBankBrowseStep;
  selectedSetId: string | null;
};

const SUBJECT_GROUP_ENTRIES = (
  Object.entries(SUBJECT_GROUP_CONFIG) as [SubjectGroupId, (typeof SUBJECT_GROUP_CONFIG)[SubjectGroupId]][]
).sort(([, a], [, b]) => a.order - b.order);

export default function QuestionBankManager() {
  const navigate = useNavigate();
  const location = useLocation();
  const { role } = useAuth();
  const isStudentView = role === 'student';
  const { teachers } = useTeachersCollection();
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
  /** Frames popped by back — forward restores these (cleared on new branch). */
  const [browseFuture, setBrowseFuture] = useState<BrowseNavFrame[]>([]);

  const [filterDepartment, setFilterDepartment] = useState('');
  const [filterGradeLevel, setFilterGradeLevel] = useState('');
  const [search, setSearch] = useState('');

  const [headerCenterMobilePortalEl, setHeaderCenterMobilePortalEl] = useState<HTMLElement | null>(null);
  const [headerMobileActionsPortalEl, setHeaderMobileActionsPortalEl] = useState<HTMLElement | null>(null);
  const [headerMobileBackPortalEl, setHeaderMobileBackPortalEl] = useState<HTMLElement | null>(null);
  const [mobileFilterDrawerOpen, setMobileFilterDrawerOpen] = useState(false);
  const [mobileActionsMenuOpen, setMobileActionsMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [desktopActionsHost, setDesktopActionsHost] = useState<HTMLElement | null>(null);
  const [browseAddMenuOpen, setBrowseAddMenuOpen] = useState(false);
  /** After create-set from browse + menu — open PDF / Sheets / CSV on the new set. */
  const [pendingCreateAction, setPendingCreateAction] = useState<'pdf' | 'sheets' | 'csv' | null>(null);
  const [setLaunchAction, setSetLaunchAction] = useState<'pdf' | 'sheets' | 'csv' | null>(null);
  const [isMdOrBelow, setIsMdOrBelow] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 1024 : false,
  );

  useEffect(() => {
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

  const snapshotBrowse = (): BrowseNavFrame => ({
    browseStep,
    selectedSetId: selectedSet?.id ?? null,
  });

  const resolveBrowseSet = (setId: string | null) => {
    if (!setId) return null;
    if (selectedSet?.id === setId) return selectedSet;
    return questionSets.find((s) => s.id === setId) ?? null;
  };

  const applyBrowseFrame = (frame: BrowseNavFrame) => {
    setBrowseStep(frame.browseStep);
    setSelectedSet(resolveBrowseSet(frame.selectedSetId));
  };

  const resetBrowseNav = () => {
    setBrowseStep({ level: 'groups' });
    setSelectedSet(null);
    setBrowseFuture([]);
  };

  /** New branch (sidebar / folder click) — drop forward history. */
  const goBrowseTo = (frame: BrowseNavFrame) => {
    setBrowseFuture([]);
    applyBrowseFrame(frame);
  };

  const canBrowseBack = Boolean(selectedSet) || browseStep.level !== 'groups';
  const canBrowseForward = browseFuture.length > 0;

  const handleBrowseBack = () => {
    if (!canBrowseBack) return;
    setBrowseFuture((future) => [snapshotBrowse(), ...future]);
    if (selectedSet) {
      setSelectedSet(null);
      return;
    }
    setBrowseStep((prev) => previousBrowseStep(prev));
  };

  const handleBrowseForward = () => {
    if (browseFuture.length === 0) return;
    const [next, ...rest] = browseFuture;
    setBrowseFuture(rest);
    applyBrowseFrame(next);
  };

  const openBrowseSet = (set: QuestionSet) => {
    goBrowseTo({ browseStep, selectedSetId: set.id });
  };

  const hasRightSelection =
    Boolean(selectedSet)
    || browseStep.level === 'sets'
    || browseStep.level === 'subgroups'
    || Boolean(search.trim());

  useEffect(() => {
    const defaultBack = document.getElementById('portal-default-mobile-back');
    if (!defaultBack) return;
    defaultBack.style.display = hasRightSelection ? 'none' : '';
  }, [hasRightSelection]);

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

  const filters: QuestionSetFilters = useMemo(() => ({
    search,
    department: (filterDepartment || 'all') as Department | 'all',
    gradeLevel: filterGradeLevel || 'all',
  }), [search, filterDepartment, filterGradeLevel]);

  const gradeOptions = useMemo(() => {
    if (!filterDepartment) return [];
    return DEPARTMENT_CONFIG[filterDepartment as Department]?.grades ?? [];
  }, [filterDepartment]);

  const clearFilters = () => {
    setFilterDepartment('');
    setFilterGradeLevel('');
    setSearch('');
    resetBrowseNav();
  };

  const hasActiveFilters =
    search !== ''
    || filterDepartment !== ''
    || filterGradeLevel !== ''
    || browseStep.level !== 'groups';

  const isSearchActive = Boolean(search.trim());

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

  const handleSelectDept = (dept: Department) => {
    setFilterDepartment(dept);
    setFilterGradeLevel('');
    resetBrowseNav();
  };

  const handleSelectGrade = (grade: string) => {
    setFilterGradeLevel(grade);
    resetBrowseNav();
  };

  const showRightBrowseNav =
    !isSearchActive
    && (
      Boolean(selectedSet)
      || canBrowseForward
      || browseStep.level === 'subgroups'
      || browseStep.level === 'sets'
      || canBrowseBack
    );

  const selectedSetCreatorName = selectedSet
    ? resolveQuestionSetCreatorName(selectedSet, teachers)
    : '';

  const handleSelectGroup = (subjectGroup: SubjectGroupId) => {
    goBrowseTo({
      browseStep: nextBrowseStepAfterGroup(subjectGroup),
      selectedSetId: null,
    });
  };

  const handleSelectSubGroup = (subSubjectGroup: string) => {
    if (browseStep.level !== 'subgroups') return;
    goBrowseTo({
      browseStep: {
        level: 'sets',
        subjectGroup: browseStep.subjectGroup,
        subSubjectGroup,
      },
      selectedSetId: null,
    });
  };

  const getCreatePrefillFromBrowse = (): typeof createPrefill => {
    if (browseStep.level === 'sets') {
      return {
        subjectGroup: browseStep.subjectGroup,
        subSubjectGroup: browseStep.subSubjectGroup === UNSPECIFIED_SUB_SUBJECT
          ? ''
          : browseStep.subSubjectGroup,
        department: filterDepartment || undefined,
        gradeLevel: filterGradeLevel || undefined,
      };
    }
    if (browseStep.level === 'subgroups') {
      return {
        subjectGroup: browseStep.subjectGroup,
        department: filterDepartment || undefined,
        gradeLevel: filterGradeLevel || undefined,
      };
    }
    return {
      department: filterDepartment || undefined,
      gradeLevel: filterGradeLevel || undefined,
    };
  };

  const openCreateSet = () => {
    setEditingSet(null);
    setCreatePrefill(getCreatePrefillFromBrowse());
    setSetModalOpen(true);
  };
  const openImportSets = () => setSetImportModalOpen(true);
  const openEditSet = (set: QuestionSet) => { setEditingSet(set); setSetModalOpen(true); };

  const openCreateThenLaunch = (action: 'pdf' | 'sheets' | 'csv' | null) => {
    setBrowseAddMenuOpen(false);
    setPendingCreateAction(action);
    openCreateSet();
  };

  const handleSetSubmit = async (data: NewQuestionSet) => {
    if (editingSet) {
      await updateQuestionSet(editingSet.id, data);
      setPendingCreateAction(null);
      return;
    }
    const id = await addQuestionSet(data);
    const action = pendingCreateAction;
    setPendingCreateAction(null);
    if (!id) return;
    const now = Date.now();
    setBrowseFuture([]);
    setSelectedSet({
      id,
      ...data,
      questionCount: 0,
      isPublished: data.isPublished ?? false,
      createdBy: 'pending',
      createdAt: now,
      updatedAt: now,
    });
    if (action) setSetLaunchAction(action);
  };

  const handleImportSets = async (items: NewQuestionSet[]) => {
    await addQuestionSetsBulk(items);
  };

  const handleDeleteSet = async (set: QuestionSet) => {
    if (!confirm(`ลบชุดข้อสอบนี้?\n\n${set.title}`)) return;
    if (selectedSet?.id === set.id) handleBrowseBack();
    await deleteQuestionSet(set);
  };

  const handleTogglePublished = async (set: QuestionSet, isPublished: boolean) => {
    await setQuestionSetPublished(set.id, isPublished);
  };

  const selectedSubjectGroup =
    browseStep.level === 'groups' ? '' : browseStep.subjectGroup;

  const emptyHint = !filterDepartment
    ? 'เลือกแผนกจากแถบด้านซ้าย'
    : !filterGradeLevel
      ? 'เลือกระดับชั้นเพื่อดูกลุ่มสาระ'
      : 'เลือกกลุ่มสาระเพื่อดูชุดข้อสอบ';

  const subjectGroupNav = filterGradeLevel ? (
    <section className="pb-1">
      <p className="mb-2 px-0.5 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
        กลุ่มสาระ
      </p>
      <div className="flex flex-col gap-2">
        {SUBJECT_GROUP_ENTRIES.map(([id, cfg]) => {
          const count = baseSets.filter((s) => s.subjectGroup === id).length;
          const active = selectedSubjectGroup === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => handleSelectGroup(id)}
              className={cn(
                'flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all',
                active ? 'text-white shadow-sm' : 'hover:opacity-90',
              )}
              style={
                active
                  ? { background: cfg.color, borderColor: cfg.color }
                  : { background: cfg.bg, borderColor: cfg.border, color: cfg.color }
              }
            >
              <span
                className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                  active ? 'bg-white/20' : 'bg-white/70',
                )}
              >
                <SubjectIcon
                  subjectGroup={id}
                  size={18}
                  className={active ? 'text-white drop-shadow-sm' : 'text-current'}
                />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-black font-sukhumvit">
                  {cfg.name}
                </span>
                <span
                  className={cn(
                    'block text-[10px] font-bold',
                    active ? 'text-white/80' : 'opacity-70',
                  )}
                >
                  {count.toLocaleString('th-TH')} ชุด
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  ) : null;

  const collapsedBrowseRail = filterDepartment ? (
    <div className="flex max-h-[min(50vh,24rem)] w-full flex-col items-center gap-2 overflow-y-auto overscroll-y-contain scrollbar-hide border-t border-border px-1.5 py-2">
      {gradeOptions.map((grade) => {
        const active = filterGradeLevel === grade;
        return (
          <button
            key={grade}
            type="button"
            onClick={() => handleSelectGrade(grade)}
            title={grade}
            aria-label={grade}
            aria-pressed={active}
            className={cn(
              'flex size-11 shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl border transition-all',
              active
                ? 'border-2 border-foreground bg-foreground text-background'
                : 'border border-border bg-muted/40 text-foreground hover:bg-muted',
            )}
          >
            <HiAcademicCap className="h-3.5 w-3.5" />
            <span className="text-[9px] font-black font-sukhumvit leading-none">{grade}</span>
          </button>
        );
      })}

      {filterGradeLevel
        ? SUBJECT_GROUP_ENTRIES.map(([id, cfg]) => {
            const active = selectedSubjectGroup === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => handleSelectGroup(id)}
                title={cfg.name}
                aria-label={cfg.name}
                aria-pressed={active}
                className={cn(
                  'flex size-11 shrink-0 items-center justify-center rounded-xl border transition-all',
                  active ? 'border-2 text-white shadow-sm' : 'hover:opacity-90',
                )}
                style={
                  active
                    ? { background: cfg.color, borderColor: cfg.color }
                    : { background: cfg.bg, borderColor: cfg.border, color: cfg.color }
                }
              >
                <SubjectIcon
                  subjectGroup={id}
                  size={18}
                  className={active ? 'text-white drop-shadow-sm' : 'text-current'}
                />
              </button>
            );
          })
        : null}
    </div>
  ) : null;

  return (
    <div
      className={cn(
        'flex min-h-0 w-full flex-col overflow-hidden font-sukhumvit',
        'h-[calc(100dvh-4.25rem)] max-h-[calc(100dvh-4.25rem)]',
      )}
    >
      {headerCenterMobilePortalEl && createPortal(
        <div className="pointer-events-none flex min-w-0 max-w-[calc(100vw-112px)] items-center justify-center gap-1.5">
          <HiOutlineBookOpen className="h-4 w-4 shrink-0 text-slate-500" />
          <span className="truncate text-[13px] font-black tracking-tight text-slate-800">
            {selectedSet
              ? selectedSet.title
              : isSearchActive
                ? 'ค้นหาชุดข้อสอบ'
                : browseStep.level !== 'groups'
                  ? browseStepLabel(browseStep)
                  : 'คลังข้อสอบ'}
          </span>
        </div>,
        headerCenterMobilePortalEl,
      )}

      {isMdOrBelow && headerMobileBackPortalEl && hasRightSelection && createPortal(
        <button
          type="button"
          onClick={() => {
            if (isSearchActive) {
              setSearch('');
              return;
            }
            if (canBrowseBack) {
              handleBrowseBack();
              return;
            }
            resetBrowseNav();
          }}
          className={HEADER_ICON_BTN}
          title="กลับ"
          aria-label="กลับ"
        >
          <HiArrowLeft size={16} />
        </button>,
        headerMobileBackPortalEl,
      )}

      {headerMobileActionsPortalEl && createPortal(
        <div className={cn('pointer-events-auto relative flex lg:hidden', HEADER_ICON_BTN_GROUP)}>
          <button
            type="button"
            onClick={() => setMobileFilterDrawerOpen(true)}
            className={HEADER_ICON_BTN}
            title="ตัวกรอง"
            aria-label="ตัวกรอง"
          >
            <HiOutlineFunnel size={16} />
            {hasActiveFilters && (
              <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-destructive" aria-hidden />
            )}
          </button>
          {!isStudentView && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setMobileActionsMenuOpen((open) => !open)}
                className={HEADER_ICON_BTN}
                title="เมนูจัดการ"
                aria-label="เมนูจัดการ"
                aria-expanded={mobileActionsMenuOpen}
              >
                <HiBars3 className="h-4 w-4" />
              </button>
              {mobileActionsMenuOpen && (
                <>
                  <button
                    type="button"
                    className="fixed inset-0 z-[90] bg-black/20"
                    aria-label="ปิดเมนู"
                    onClick={() => setMobileActionsMenuOpen(false)}
                  />
                  <div className="fixed right-4 top-14 z-[100] w-[min(240px,calc(100vw-2rem))] rounded-2xl border border-border bg-card p-1.5 shadow-xl">
                    <button
                      type="button"
                      onClick={() => {
                        setMobileActionsMenuOpen(false);
                        openImportSets();
                      }}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[13px] font-bold text-foreground hover:bg-muted/50"
                    >
                      <FileSpreadsheet size={14} />
                      นำเข้าชุดข้อสอบ
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMobileActionsMenuOpen(false);
                        openCreateSet();
                      }}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[13px] font-bold text-foreground hover:bg-muted/50"
                    >
                      <Plus size={14} strokeWidth={2.5} />
                      เพิ่มชุดข้อสอบ
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
        description="ค้นหาชื่อชุดข้อสอบ"
        footer={(
          <ExamFilterShowResultsButton onClick={() => setMobileFilterDrawerOpen(false)} />
        )}
      >
        <div>
          <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-slate-400">ค้นหา</p>
          <div className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3">
            <HiMagnifyingGlass className="h-4 w-4 shrink-0 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ค้นหาชุดข้อสอบ..."
              className="min-w-0 flex-1 border-none bg-transparent text-[12px] font-bold text-slate-800 outline-none placeholder:text-slate-400 font-sukhumvit"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100"
                aria-label="ล้างคำค้นหา"
              >
                <HiXMark className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

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

      <div className="flex min-h-0 flex-1 basis-0 flex-col gap-4 overflow-hidden lg:flex-row lg:items-stretch">
        <div
          className={cn(
            'flex h-full min-h-0 w-full shrink-0 flex-col self-stretch overflow-hidden',
            sidebarCollapsed ? 'lg:w-20 xl:w-20' : 'lg:w-[280px] xl:w-[300px]',
            hasRightSelection ? 'hidden lg:flex' : 'flex min-h-0 flex-1 lg:flex-none',
          )}
        >
          <GradeBookClassSidebar
            selectedDept={filterDepartment}
            selectedGrade={filterGradeLevel}
            selectedClassId=""
            gradeOptions={gradeOptions}
            classOptions={[]}
            onSelectDept={handleSelectDept}
            onSelectGrade={handleSelectGrade}
            onSelectClass={() => {}}
            showRooms={false}
            collapsed={sidebarCollapsed}
            collapsedExtra={collapsedBrowseRail}
            headerAction={(
              <div className={cn('flex', HEADER_ICON_BTN_GROUP)}>
                {!isStudentView && !sidebarCollapsed && (
                  <>
                    <button
                      type="button"
                      onClick={openImportSets}
                      className={HEADER_ICON_BTN}
                      title="นำเข้าชุดข้อสอบจาก CSV/Excel"
                      aria-label="นำเข้าชุดข้อสอบจาก CSV/Excel"
                    >
                      <FileSpreadsheet size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={openCreateSet}
                      className={HEADER_ICON_BTN}
                      title="เพิ่มชุดข้อสอบ"
                      aria-label="เพิ่มชุดข้อสอบ"
                    >
                      <Plus size={16} strokeWidth={3} />
                    </button>
                  </>
                )}
                <SidebarCollapseButton
                  collapsed={sidebarCollapsed}
                  onToggle={() => setSidebarCollapsed((v) => !v)}
                />
              </div>
            )}
          >
            {subjectGroupNav}
          </GradeBookClassSidebar>
        </div>

        <div
          className={cn(
            'relative flex min-h-0 flex-1 basis-0 flex-col self-stretch overflow-hidden rounded-2xl border border-border bg-card px-2 pb-2 sm:px-2.5 sm:pb-2.5',
            !hasRightSelection && 'hidden lg:flex',
          )}
        >
          {showRightBrowseNav && (
            <div className="mb-2 hidden min-h-[3.25rem] w-full shrink-0 items-center gap-3 border-b border-border px-0 pb-2 pt-2 sm:pt-2.5 lg:flex">
              <div className={cn('flex shrink-0', HEADER_ICON_BTN_GROUP)}>
                <button
                  type="button"
                  onClick={handleBrowseBack}
                  disabled={!canBrowseBack}
                  className={cn(HEADER_ICON_BTN, !canBrowseBack && 'pointer-events-none opacity-30')}
                  title="ย้อนกลับ"
                  aria-label="ย้อนกลับ"
                >
                  <HiChevronLeft size={16} />
                </button>
                <button
                  type="button"
                  onClick={handleBrowseForward}
                  disabled={!canBrowseForward}
                  className={cn(HEADER_ICON_BTN, !canBrowseForward && 'pointer-events-none opacity-30')}
                  title="ไปข้างหน้า"
                  aria-label="ไปข้างหน้า"
                >
                  <HiChevronRight size={16} />
                </button>
              </div>
              {selectedSet && !isStudentView && (
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-sukhumvit text-[15px] font-black leading-tight text-foreground">
                    {selectedSet.title}
                  </h3>
                  {selectedSetCreatorName ? (
                    <p className="mt-0.5 truncate font-sarabun text-[11px] font-semibold text-muted-foreground">
                      สร้างโดย {selectedSetCreatorName}
                    </p>
                  ) : null}
                </div>
              )}
              {!isStudentView && (
                selectedSet ? (
                  <div
                    ref={setDesktopActionsHost}
                    className={cn('ml-auto flex shrink-0', HEADER_ICON_BTN_GROUP)}
                  />
                ) : browseStep.level === 'sets' ? (
                  <div className={cn('relative ml-auto flex shrink-0', HEADER_ICON_BTN_GROUP)}>
                    <button
                      type="button"
                      onClick={() => setBrowseAddMenuOpen((open) => !open)}
                      className={HEADER_ICON_BTN}
                      title="เพิ่ม / นำเข้าข้อสอบ"
                      aria-label="เพิ่ม / นำเข้าข้อสอบ"
                      aria-expanded={browseAddMenuOpen}
                    >
                      <Plus size={16} strokeWidth={3} />
                    </button>
                    {browseAddMenuOpen && (
                      <>
                        <button
                          type="button"
                          className="fixed inset-0 z-[90] bg-black/20"
                          aria-label="ปิดเมนู"
                          onClick={() => setBrowseAddMenuOpen(false)}
                        />
                        <div className="absolute right-0 top-full z-[100] mt-2 w-[min(240px,calc(100vw-2rem))] rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl">
                          <button
                            type="button"
                            onClick={() => openCreateThenLaunch(null)}
                            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[13px] font-bold font-sukhumvit text-slate-900 transition-colors hover:bg-slate-50"
                          >
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700">
                              <Plus size={14} strokeWidth={3} />
                            </span>
                            <span>เพิ่มชุดข้อสอบ</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => openCreateThenLaunch('pdf')}
                            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[13px] font-bold font-sukhumvit text-slate-900 transition-colors hover:bg-slate-50"
                          >
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-600">
                              <FileText size={14} strokeWidth={2.5} />
                            </span>
                            <span>อัปโหลด PDF / ตั้งค่าเฉลย</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => openCreateThenLaunch('sheets')}
                            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[13px] font-bold font-sukhumvit text-slate-700 transition-colors hover:bg-slate-50"
                          >
                            <span
                              className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200"
                              style={{ background: 'linear-gradient(135deg, #e8f0fe 0%, #e6f4ea 100%)' }}
                            >
                              <svg width="14" height="14" viewBox="0 0 48 48" aria-hidden>
                                <path d="M10 8h28v32H10z" fill="#34a853" rx="3" />
                                <rect x="14" y="16" width="20" height="2.5" rx="1.25" fill="white" />
                                <rect x="14" y="22" width="20" height="2.5" rx="1.25" fill="white" fillOpacity=".8" />
                              </svg>
                            </span>
                            <span>นำเข้า Google Sheets</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setBrowseAddMenuOpen(false);
                              openImportSets();
                            }}
                            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[13px] font-bold font-sukhumvit text-slate-700 transition-colors hover:bg-slate-50"
                          >
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600">
                              <FileSpreadsheet size={14} strokeWidth={2.5} />
                            </span>
                            <span>นำเข้า CSV/Excel</span>
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ) : null
              )}
            </div>
          )}

          {isSetLoading ? (
            <SkeletonList />
          ) : selectedSet && !isStudentView ? (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <QuestionSetQuestionManager
                set={selectedSet}
                onBack={handleBrowseBack}
                onSetUpdated={setSelectedSet}
                updateQuestionSet={updateQuestionSet}
                hideDesktopBack
                desktopActionsHost={desktopActionsHost}
                launchAction={setLaunchAction}
                onLaunchActionConsumed={() => setSetLaunchAction(null)}
              />
            </div>
          ) : isSearchActive ? (
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain scrollbar-hide">
              <QuestionSetList
                sets={visibleSets}
                isStudentView={isStudentView}
                onSelect={openBrowseSet}
                onEdit={openEditSet}
                onDelete={handleDeleteSet}
                onSimulate={setSimulatingSet}
                onTogglePublished={handleTogglePublished}
              />
            </div>
          ) : browseStep.level === 'subgroups' ? (
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain scrollbar-hide">
              <QuestionBankBrowseNav
                step={browseStep}
                sets={baseSets}
                onSelectGroup={handleSelectGroup}
                onSelectSubGroup={handleSelectSubGroup}
              />
            </div>
          ) : browseStep.level === 'sets' ? (
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain scrollbar-hide">
              <QuestionSetList
                sets={browseSets}
                isStudentView={isStudentView}
                emptyTitle="ยังไม่มีชุดข้อสอบในรายการนี้"
                emptyHint="ลองเปลี่ยนตัวกรองแผนก/ระดับชั้น หรือเพิ่มชุดข้อสอบใหม่"
                onSelect={openBrowseSet}
                onEdit={openEditSet}
                onDelete={handleDeleteSet}
                onSimulate={setSimulatingSet}
                onTogglePublished={handleTogglePublished}
              />
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-6 py-10 text-center">
              <HiOutlineBookOpen className="h-8 w-8 text-muted-foreground/40" />
              <p className="font-sukhumvit text-[13px] font-black text-muted-foreground">
                {emptyHint}
              </p>
            </div>
          )}
        </div>
      </div>

      <QuestionSetBuilder
        key={`qsb-${setModalOpen ? (editingSet?.id ?? `new-${createPrefill?.title ?? ''}`) : 'closed'}`}
        open={setModalOpen}
        onClose={() => {
          setSetModalOpen(false);
          setCreatePrefill(null);
          setPendingCreateAction(null);
        }}
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
    <div className="flex-1 space-y-2 p-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <motion.div
          key={i}
          animate={{ opacity: [0.4, 0.8, 0.4] }}
          transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.1 }}
          className="h-16 rounded-2xl bg-muted/60"
        />
      ))}
    </div>
  );
}
