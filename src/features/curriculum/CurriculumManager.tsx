import { useState, useMemo, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  HiPlus,
  HiMagnifyingGlass,
  HiChevronRight,
  HiSparkles,
  HiAcademicCap,
  HiBookOpen,
  HiChevronLeft,
} from 'react-icons/hi2';
import { useCurriculumVersioned } from '@/hooks/useCurriculumVersioned';
import { useBrowseVisibleDepartments } from '@/hooks/useBrowseVisibleDepartments';
import { shouldCountDepartment } from '@/lib/departments/homeDepartment';

import CourseEditorPanel from './components/CourseEditorPanel';
import AddCurriculumVersionModal from './components/AddCurriculumVersionModal';
import GoogleSheetImportModal from './components/GoogleSheetImportModal';
import AddCourseModal from './components/AddCourseModal';
import AssignGradesModal from './components/AssignGradesModal';
import GradeBookClassSidebar from '@/features/grades/components/GradeBookClassSidebar';
import CurriculumDeptCoverFlow from './components/CurriculumDeptCoverFlow';
import CurriculumMobileGradeBrowse from './components/CurriculumMobileGradeBrowse';
import SidebarCollapseButton from '@/features/grades/components/SidebarCollapseButton';
import { HEADER_ICON_BTN } from '@/lib/headerIconBtn';
import { cn } from '@/lib/utils';
import {
  type CurriculumVersion, type CurriculumCourse, type NewCurriculumCourse, type CourseCategory, type CurriculumTrack,
  type Department,
  DEPARTMENT_CONFIG, CURRICULUM_TRACK_CONFIG,
} from '@/types/curriculum';



// Gradient palette for version cards
const VERSION_GRADIENTS = [
  'from-blue-600 to-indigo-700',
  'from-blue-500 to-cyan-600',
  'from-sky-500 to-indigo-600',
  'from-cyan-500 to-blue-600',
  'from-indigo-500 to-blue-700',
  'from-sky-600 to-cyan-700',
  'from-teal-500 to-blue-600',
  'from-blue-600 to-cyan-500',
];

function getVersionGradient(id: string) {
  const hash = id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return VERSION_GRADIENTS[hash % VERSION_GRADIENTS.length];
}

export default function CurriculumManager() {
  const { homeDepartment, browseVisibleDepartments, isDeptScoped } = useBrowseVisibleDepartments();

  const [selectedVersion, setSelectedVersion] = useState<CurriculumVersion | null>(null);
  const [filterDepartment, setFilterDepartment] = useState('all');
  const [filterGradeLevel, setFilterGradeLevel] = useState('all');
  const [filterCategory, setFilterCategory] = useState<CourseCategory | 'all'>('all');
  const [filterSubjectGroup, setFilterSubjectGroup] = useState('all');
  const [filterSemester, setFilterSemester] = useState<number | 'all'>(1);
  const [searchTerm, setSearchTerm] = useState('');

  // ── Sidebar drill-down: แผนก → ชั้น ──────────────────────────────────────
  const [sidebarDept, setSidebarDept] = useState<Department | ''>('');
  const [sidebarGrade, setSidebarGrade] = useState('');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const {
    isLoading,
    isReadOnly,
    versions,
    coursesByVersion,
    loadCoursesForVersion,
    createVersion,
    updateVersion,
    deleteVersion,
    assignGrades,
    toggleAllowEdit,
    addCourse,
    updateCourse,
    deleteCourse,
    duplicateVersion,
    getCourseSummary,
  } = useCurriculumVersioned();

  // ── Modals ────────────────────────────────────────────────────────────────
  const [versionModalOpen, setVersionModalOpen] = useState(false);
  const [versionToEdit, setVersionToEdit] = useState<CurriculumVersion | null>(null);

  const [courseModalOpen, setCourseModalOpen] = useState(false);
  const [courseToEdit, setCourseToEdit] = useState<CurriculumCourse | null>(null);

  const [assignGradesModalOpen, setAssignGradesModalOpen] = useState(false);
  const [versionToAssign, setVersionToAssign] = useState<CurriculumVersion | null>(null);

  const [sheetImportOpen, setSheetImportOpen] = useState(false);

  const [headerCenterMobilePortalEl, setHeaderCenterMobilePortalEl] = useState<HTMLElement | null>(null);
  const [headerMobileBackEl, setHeaderMobileBackEl] = useState<HTMLElement | null>(null);
  const [isMdOrBelow, setIsMdOrBelow] = useState(() => window.innerWidth < 1024);

  useEffect(() => {
    setHeaderCenterMobilePortalEl(document.getElementById('header-portal-center-mobile'));
    setHeaderMobileBackEl(document.getElementById('header-portal-mobile-back'));
  }, []);

  useEffect(() => {
    return () => {
      if (selectedVersion?.id) {
        toggleAllowEdit(selectedVersion.id, false);
      }
    };
  }, [selectedVersion?.id, toggleAllowEdit]);

  useEffect(() => {
    const handleResize = () => setIsMdOrBelow(window.innerWidth < 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleCreateOrDuplicateVersion = async (
    name: string, year: number, cloneFromId?: string, description?: string,
    meta?: { track?: CurriculumTrack; level?: string; department?: string }
  ) => {
    if (cloneFromId) {
      await duplicateVersion(cloneFromId, name, year, description);
      if (meta) {
        const fresh = versions.find(v => v.name === name);
        if (fresh) await updateVersion(fresh.id, meta);
      }
    } else {
      await createVersion({ name, year, assignedGrades: [], description, ...meta });
    }
  };

  const handleSheetImport = async (courses: NewCurriculumCourse[]) => {
    if (!selectedVersion) throw new Error('กรุณาเลือกหลักสูตรก่อนนำเข้า');
    for (const course of courses) {
      await addCourse(selectedVersion.id, course);
    }
  };

  const handleDeleteVersion = async (v: CurriculumVersion) => {
    if (!window.confirm(`ลบหลักสูตร "${v.name}" แน่หรือไม่?\nวิชาทั้งหมดในหลักสูตรนี้จะถูกลบด้วย`)) return;
    if (selectedVersion?.id === v.id) setSelectedVersion(null);
    await deleteVersion(v.id);
  };

  const handleAddCourse = async (data: NewCurriculumCourse) => {
    if (!selectedVersion) return;
    await addCourse(selectedVersion.id, data);
  };

  const handleUpdateCourse = async (id: string, data: Partial<CurriculumCourse>) => {
    if (!selectedVersion) return;
    await updateCourse(selectedVersion.id, id, data);
  };

  const handleDeleteCourse = async (course: CurriculumCourse) => {
    if (!selectedVersion) return;
    if (!window.confirm(`ลบวิชา "${course.courseName}" (${course.courseCode}) แน่หรือไม่?`)) return;
    await deleteCourse(selectedVersion.id, course.id);
    setCourseModalOpen(false);
  };

  const currentVersion = selectedVersion
    ? (versions.find(v => v.id === selectedVersion.id) ?? selectedVersion)
    : null;

  const filteredVersions = useMemo(() => {
    return versions.filter((v) => {
      if (!v.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      if (sidebarDept && v.department !== sidebarDept) return false;
      if (sidebarGrade && !(v.assignedGrades?.includes(sidebarGrade) || v.level === sidebarGrade)) return false;
      return true;
    });
  }, [versions, searchTerm, sidebarDept, sidebarGrade]);

  const versionCountsByDept = useMemo(() => {
    const counts: Partial<Record<Department, number>> = {};
    versions.forEach((v) => {
      const dept = v.department as Department | undefined;
      if (dept && shouldCountDepartment(dept, homeDepartment, isDeptScoped)) {
        counts[dept] = (counts[dept] ?? 0) + 1;
      }
    });
    return counts;
  }, [versions, homeDepartment, isDeptScoped]);

  const sidebarGradeOptions = sidebarDept ? DEPARTMENT_CONFIG[sidebarDept].grades : [];

  const gradeVersionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    if (!sidebarDept) return counts;
    versions.forEach((v) => {
      if (v.department !== sidebarDept) return;
      sidebarGradeOptions.forEach((grade) => {
        if (v.assignedGrades?.includes(grade) || v.level === grade) {
          counts[grade] = (counts[grade] ?? 0) + 1;
        }
      });
    });
    return counts;
  }, [versions, sidebarDept, sidebarGradeOptions]);

  const showMobileDeptCover = isMdOrBelow && !currentVersion && !sidebarDept;
  const showMobileGradeBrowse = isMdOrBelow && !currentVersion && Boolean(sidebarDept) && !sidebarGrade;
  const showMobileVersionList = isMdOrBelow && !currentVersion && Boolean(sidebarDept) && Boolean(sidebarGrade);
  const needsCustomMobileBack = isMdOrBelow && (Boolean(sidebarDept) || Boolean(currentVersion));

  const handleMobileBack = useCallback(() => {
    if (currentVersion) {
      setSelectedVersion(null);
      return;
    }
    if (sidebarGrade) {
      setSidebarGrade('');
      return;
    }
    setSidebarDept('');
  }, [currentVersion, sidebarGrade]);

  useEffect(() => {
    const defaultBack = document.getElementById('portal-default-mobile-back');
    if (!defaultBack) return;
    defaultBack.style.display = needsCustomMobileBack ? 'none' : '';
  }, [needsCustomMobileBack]);

  useEffect(() => {
    if (!isMdOrBelow) return;
    document.getElementById('portal-scroll-container')?.scrollTo({ top: 0 });
  }, [isMdOrBelow, sidebarDept, sidebarGrade, currentVersion?.id]);

  const handleSidebarSelectDept = (dept: Department) => {
    setSidebarDept((prev) => (prev === dept ? '' : dept));
    setSidebarGrade('');
    setSelectedVersion(null);
  };

  const handleSidebarSelectGrade = (grade: string) => {
    setSidebarGrade((prev) => (prev === grade ? '' : grade));
    setSelectedVersion(null);
  };

  const currentCourses = currentVersion ? (coursesByVersion[currentVersion.id] || []) : [];
  const existingCodes = currentCourses.map(c => c.courseCode);
  const collapsedVersionRail = useMemo(() => {
    if (!sidebarDept || !sidebarGrade) return null;
    return (
      <div className="flex flex-col items-center justify-center gap-2 mt-2 overflow-y-auto scrollbar-hide py-1 w-full min-h-0">
        {filteredVersions.map((v) => {
          const isActive = currentVersion?.id === v.id;
          const gradient = getVersionGradient(v.id);
          return (
            <button
              key={v.id}
              onClick={() => {
                setSelectedVersion(v);
                loadCoursesForVersion(v.id);
              }}
              className={cn(
                'w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center text-white text-[11px] font-black transition-all shrink-0 bg-gradient-to-br shadow-sm cursor-pointer',
                gradient,
                isActive ? 'ring-2 ring-blue-600 ring-offset-2 scale-105' : 'hover:scale-105'
              )}
              title={v.name}
            >
              {(v.year || '').toString().slice(-2)}
            </button>
          );
        })}
      </div>
    );
  }, [filteredVersions, currentVersion, loadCoursesForVersion, sidebarDept, sidebarGrade]);

  return (
    <div
      className={cn(
        'flex w-full bg-transparent overflow-hidden pb-4 gap-0 font-sukhumvit text-black',
        'h-[calc(100dvh-4.25rem)] max-h-[calc(100dvh-4.25rem)]',
      )}
    >

      {needsCustomMobileBack && headerMobileBackEl && createPortal(
        <button
          type="button"
          onClick={handleMobileBack}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-700 transition-colors hover:bg-slate-100"
          title={currentVersion ? 'กลับรายการหลักสูตร' : 'กลับเลือกแผนก'}
          aria-label={currentVersion ? 'กลับรายการหลักสูตร' : 'กลับเลือกแผนก'}
        >
          <HiChevronLeft size={16} />
        </button>,
        headerMobileBackEl,
      )}

      {isMdOrBelow && headerCenterMobilePortalEl && createPortal(
        <div className="pointer-events-none flex items-center gap-1.5 lg:hidden">
          <HiBookOpen className="h-4 w-4 shrink-0 text-black/80" />
          <span className="text-[13px] font-black leading-none tracking-tight text-black/80 whitespace-nowrap font-sukhumvit">
            หลักสูตร
          </span>
        </div>,
        headerCenterMobilePortalEl,
      )}

      <AnimatePresence mode="wait">
        {/* ── Versions Tab: Split layout ── */}
        <motion.div
          key="versions-layout"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="flex flex-1 min-w-0 h-full overflow-hidden relative gap-4"
        >
            {showMobileDeptCover ? (
              <CurriculumDeptCoverFlow
                versionCounts={versionCountsByDept}
                departments={browseVisibleDepartments}
                onSelectDept={handleSidebarSelectDept}
              />
            ) : null}

            {showMobileGradeBrowse && sidebarDept ? (
              <CurriculumMobileGradeBrowse
                department={sidebarDept}
                gradeOptions={sidebarGradeOptions}
                gradeVersionCounts={gradeVersionCounts}
                selectedGrade={sidebarGrade}
                onSelectGrade={handleSidebarSelectGrade}
              />
            ) : null}

            {/* LEFT — Version Sidebar (แผนก → ชั้น drill-down) */}
            <div className={cn(
              currentVersion ? 'hidden lg:flex' : (showMobileDeptCover || showMobileGradeBrowse) ? 'hidden lg:flex' : 'flex',
              showMobileVersionList && 'min-h-0 flex-1',
              sidebarCollapsed ? 'lg:w-20 xl:w-20' : 'lg:w-[300px] xl:w-[320px]',
              'w-full shrink-0 flex-col h-full overflow-hidden'
            )}>
              <GradeBookClassSidebar
                selectedDept={sidebarDept}
                selectedGrade={sidebarGrade}
                selectedClassId=""
                gradeOptions={sidebarGradeOptions}
                classOptions={[]}
                departments={browseVisibleDepartments}
                hideDeptCards={isMdOrBelow}
                hideFrameOnMobile
                showGradeRoomNav={!(isMdOrBelow && Boolean(sidebarGrade))}
                headerActionMobile={isMdOrBelow && Boolean(sidebarGrade)}
                onSelectDept={handleSidebarSelectDept}
                onSelectGrade={handleSidebarSelectGrade}
                onSelectClass={() => {}}
                showRooms={false}
                collapsed={sidebarCollapsed}
                collapsedExtra={collapsedVersionRail}
                headerAction={(
                  <div className={cn('flex items-center gap-1.5 w-full', sidebarCollapsed ? 'justify-center' : 'justify-between')}>
                    {!sidebarCollapsed && (
                      <div className="relative flex-1 min-w-0">
                        <HiMagnifyingGlass className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={12} />
                        <input
                          type="text"
                          placeholder="ค้นหาหลักสูตร..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-8 pr-2.5 py-1 bg-slate-50 border border-slate-200/60 rounded-xl text-[11px] font-bold focus:ring-2 focus:ring-slate-200 focus:border-slate-300 transition-all w-full outline-none placeholder:text-slate-300 h-8"
                        />
                      </div>
                    )}
                    <div className="flex items-center gap-1 shrink-0">
                      {!sidebarCollapsed && !isReadOnly && (
                        <button
                          type="button"
                          onClick={() => { setVersionToEdit(null); setVersionModalOpen(true); }}
                          className={cn(HEADER_ICON_BTN, "shrink-0")}
                          title="เพิ่มหลักสูตร"
                          aria-label="เพิ่มหลักสูตร"
                        >
                          <HiPlus size={16} />
                        </button>
                      )}
                      <SidebarCollapseButton
                        collapsed={sidebarCollapsed}
                        onToggle={() => setSidebarCollapsed((v) => !v)}
                      />
                    </div>
                  </div>
                )}
              >

                {sidebarDept && sidebarGrade && (
                  <p className="mb-2 flex-shrink-0 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    {filteredVersions.length} หลักสูตร
                  </p>
                )}

                {/* Version List */}
                <div className="flex-1 overflow-y-auto scrollbar-hide flex flex-col gap-2 pr-1">
                  <AnimatePresence>
                    {!sidebarDept ? (
                      <div className="h-32 flex flex-col items-center justify-center text-slate-400 opacity-60 rounded-2xl text-center px-4">
                        <span className="text-[11px] font-bold">เลือกแผนกด้านบนเพื่อดูหลักสูตร</span>
                      </div>
                    ) : !sidebarGrade ? (
                      <div className="h-32 flex flex-col items-center justify-center text-slate-400 opacity-60 rounded-2xl text-center px-4">
                        <span className="text-[11px] font-bold">เลือกระดับชั้นด้านบนเพื่อดูหลักสูตร</span>
                      </div>
                    ) : isLoading ? (
                      [...Array(4)].map((_, i) => (
                        <div key={i} className="h-[90px] rounded-2xl bg-slate-100 animate-pulse" />
                      ))
                    ) : filteredVersions.length === 0 ? (
                      <div className="h-32 flex flex-col items-center justify-center text-slate-400 opacity-50 border-2 border-dashed border-slate-200 rounded-2xl">
                        <HiMagnifyingGlass size={22} className="mb-2" />
                        <span className="text-xs font-bold">ไม่พบหลักสูตร</span>
                      </div>
                    ) : (
                      [...filteredVersions]
                        .sort((a, b) => a.name.localeCompare(b.name, 'th'))
                        .map((v) => {
                          const isActive = currentVersion?.id === v.id;
                          const trackCfg = v.track ? CURRICULUM_TRACK_CONFIG[v.track] : null;
                          const deptCfg = v.department ? DEPARTMENT_CONFIG[v.department as keyof typeof DEPARTMENT_CONFIG] : null;
                          const gradient = getVersionGradient(v.id);

                          return (
                            <motion.button
                              key={v.id}
                              layout
                              initial={{ opacity: 0, y: 8 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.96 }}
                              onClick={() => {
                                setSelectedVersion(v);
                                loadCoursesForVersion(v.id);
                              }}
                              className={`w-full text-left rounded-xl transition-all p-2.5 flex items-center gap-3 border ${
                                isActive
                                  ? 'bg-white border-blue-600 shadow-sm'
                                  : 'bg-white border-slate-100 hover:border-slate-200 hover:shadow-sm'
                              }`}
                            >
                              {/* Color block avatar */}
                              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shrink-0 shadow-sm`}>
                                <span className="text-white text-[13px] font-black">{(v.year || '').toString().slice(-2)}</span>
                              </div>

                              {/* Info */}
                              <div className="flex-1 min-w-0">
                                <h4 className={`text-[12px] font-black tracking-tight leading-tight truncate mb-1.5 ${isActive ? 'text-blue-600' : 'text-slate-800'}`}>
                                  {v.name}
                                </h4>

                                {/* Badges */}
                                <div className="flex items-center flex-wrap gap-1">
                                  {deptCfg && (
                                    <span
                                      className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-bold"
                                      style={{ background: deptCfg.bg, color: deptCfg.color, border: `1px solid ${deptCfg.border}` }}
                                    >
                                      {deptCfg.label}
                                    </span>
                                  )}
                                  {v.level && (
                                    <span
                                      className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-bold"
                                      style={{ background: 'rgba(100,116,139,0.08)', color: '#475569', border: '1px solid rgba(100,116,139,0.18)' }}
                                    >
                                      {v.level}
                                    </span>
                                  )}
                                  {trackCfg && (
                                    <span
                                      className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-bold"
                                      style={{ background: trackCfg.bg, color: trackCfg.color, border: `1px solid ${trackCfg.border}` }}
                                    >
                                      {trackCfg.label}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Chevron centered vertically */}
                              <div className="shrink-0 flex items-center justify-center text-slate-300">
                                <HiChevronRight size={12} className={isActive ? 'text-blue-500' : 'text-slate-300'} />
                              </div>
                            </motion.button>
                          );
                        })
                    )}
                  </AnimatePresence>
                </div>
              </GradeBookClassSidebar>
            </div>

            {/* RIGHT — Detail / Course Editor */}
            <div
              className={cn(
                !currentVersion ? 'hidden lg:flex' : 'flex',
                'flex-1 min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-card p-4 md:p-6 shadow-sm',
                isMdOrBelow && currentVersion && 'rounded-none border-0 bg-transparent p-0 shadow-none',
              )}
            >
              <AnimatePresence mode="wait">
                {currentVersion ? (
                  <motion.div
                    key={`editor-${currentVersion.id}`}
                    initial={{ opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -16 }}
                    className="flex-1 overflow-y-auto scrollbar-hide min-h-0"
                  >
                    <CourseEditorPanel
                      version={currentVersion}
                      courses={currentCourses}
                      isLoading={isLoading}
                      readOnly={isReadOnly}
                      onBack={() => setSelectedVersion(null)}
                      onAddCourse={() => { setCourseToEdit(null); setCourseModalOpen(true); }}
                      onEditCourse={(c) => { setCourseToEdit(c); setCourseModalOpen(true); }}
                      onDeleteCourse={(c) => handleDeleteCourse(c)}
                      onToggleEditMode={(allow) => toggleAllowEdit(currentVersion.id, allow)}
                      onEditVersion={(v) => { setVersionToEdit(v); setVersionModalOpen(true); }}
                      onDeleteVersion={(v) => handleDeleteVersion(v)}
                      onImportCSV={() => setSheetImportOpen(true)}
                      getCourseSummary={getCourseSummary}
                      externalSearch={searchTerm}
                      onExternalSearchChange={setSearchTerm}
                      externalDept={filterDepartment}
                      onExternalDeptChange={setFilterDepartment}
                      externalGrade={filterGradeLevel}
                      onExternalGradeChange={setFilterGradeLevel}
                      externalCategory={filterCategory}
                      onExternalCategoryChange={setFilterCategory}
                      externalGroup={filterSubjectGroup}
                      onExternalGroupChange={setFilterSubjectGroup}
                      externalSemester={filterSemester}
                      onExternalSemesterChange={setFilterSemester}
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key="no-selection"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center justify-center h-full gap-5"
                  >
                    {/* Decorative illustration */}
                    <div className="relative">
                      <div className="w-28 h-28 rounded-3xl bg-gradient-to-br from-slate-100 to-slate-50 flex items-center justify-center shadow-inner">
                        <HiAcademicCap size={52} className="text-slate-200" />
                      </div>
                      <div className="absolute -top-2 -right-2 w-8 h-8 rounded-xl bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center shadow-md">
                        <HiSparkles size={14} className="text-white" />
                      </div>
                    </div>
                    <div className="text-center">
                      <p className="text-[14px] font-black text-slate-500 tracking-tight">เลือกหลักสูตรเพื่อจัดการรายวิชา</p>
                      <p className="text-[11px] text-slate-300 mt-1 font-medium">คลิกที่หลักสูตรทางซ้ายเพื่อดูรายละเอียด</p>
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => { setVersionToEdit(null); setVersionModalOpen(true); }}
                      className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-full text-[12px] font-black shadow-lg hover:bg-blue-700 transition-all"
                    >
                      <HiPlus size={14} className="stroke-[2px]" />
                      สร้างหลักสูตรใหม่
                    </motion.button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
      </AnimatePresence>


      {/* ── Modals ── */}
      <AddCurriculumVersionModal
        open={versionModalOpen}
        onClose={() => { setVersionModalOpen(false); setVersionToEdit(null); }}
        onSubmit={handleCreateOrDuplicateVersion}
        versions={versions}
        versionToEdit={versionToEdit}
        onUpdate={async (id, data) => { await updateVersion(id, data); }}
      />

      {currentVersion && (
        <AddCourseModal
          open={courseModalOpen}
          onClose={() => { setCourseModalOpen(false); setCourseToEdit(null); }}
          onSubmit={handleAddCourse}
          onUpdate={handleUpdateCourse}
          onDelete={async (id) => {
            const course = currentCourses.find(c => c.id === id);
            if (course) await handleDeleteCourse(course);
          }}
          courseToEdit={courseToEdit}
          existingCodes={existingCodes}
        />
      )}

      <GoogleSheetImportModal
        open={sheetImportOpen}
        onClose={() => setSheetImportOpen(false)}
        onImport={handleSheetImport}
      />

      <AssignGradesModal
        open={assignGradesModalOpen}
        onClose={() => { setAssignGradesModalOpen(false); setVersionToAssign(null); }}
        version={versionToAssign}
        allVersions={versions}
        onAssign={assignGrades}
      />
    </div>
  );
}
