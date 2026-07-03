import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  HiPlus,
  HiMagnifyingGlass,
  HiLockClosed,
  HiChevronRight,
  HiSparkles,
  HiAcademicCap,
  HiBookOpen,
} from 'react-icons/hi2';
import { useCurriculumVersioned } from '@/hooks/useCurriculumVersioned';

import CourseEditorPanel from './components/CourseEditorPanel';
import AddCurriculumVersionModal from './components/AddCurriculumVersionModal';
import GoogleSheetImportModal from './components/GoogleSheetImportModal';
import AddCourseModal from './components/AddCourseModal';
import AssignGradesModal from './components/AssignGradesModal';
import {
  type CurriculumVersion, type CurriculumCourse, type NewCurriculumCourse, type CourseCategory, type CurriculumTrack,
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

  const [selectedVersion, setSelectedVersion] = useState<CurriculumVersion | null>(null);
  const [filterDepartment, setFilterDepartment] = useState('all');
  const [filterGradeLevel, setFilterGradeLevel] = useState('all');
  const [filterCategory, setFilterCategory] = useState<CourseCategory | 'all'>('all');
  const [filterSubjectGroup, setFilterSubjectGroup] = useState('all');
  const [filterSemester, setFilterSemester] = useState<number | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');

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
  const [isMdOrBelow, setIsMdOrBelow] = useState(() => window.innerWidth < 1024);

  useEffect(() => {
    setHeaderCenterMobilePortalEl(document.getElementById('header-portal-center-mobile'));
  }, []);

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
    return versions.filter(v =>
      v.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [versions, searchTerm]);

  const currentCourses = currentVersion ? (coursesByVersion[currentVersion.id] || []) : [];
  const existingCodes = currentCourses.map(c => c.courseCode);



  return (
    <div className="flex h-full w-full bg-transparent overflow-hidden pb-4 gap-0 font-sukhumvit text-black">

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
            {/* LEFT — Version Sidebar */}
            <div className={`${currentVersion ? 'hidden lg:flex' : 'flex'} w-full lg:w-[300px] xl:w-[320px] shrink-0 flex-col h-full overflow-hidden rounded-[2rem] border border-white/30 bg-white/30 backdrop-blur-sm shadow-sm p-4`}>
              {/* Sidebar Header */}
              <div className="flex items-center justify-between pb-3 flex-shrink-0">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">หลักสูตรทั้งหมด</p>
                  <p className="text-[13px] font-black text-slate-800 mt-0.5">{filteredVersions.length} หลักสูตร</p>
                </div>
                {!isReadOnly && (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => { setVersionToEdit(null); setVersionModalOpen(true); }}
                    className="flex items-center justify-center w-8 h-8 bg-blue-600 text-white rounded-full shadow-md hover:bg-blue-700 transition-all"
                    title="เพิ่มหลักสูตร"
                  >
                    <HiPlus size={14} className="stroke-[2px]" />
                  </motion.button>
                )}
              </div>

              {/* Search */}
              <div className="relative mb-3 flex-shrink-0">
                <HiMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
                <input
                  type="text"
                  placeholder="ค้นหาหลักสูตร..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 pr-3 py-2 bg-slate-50/80 border border-slate-200/60 rounded-xl text-[11px] font-bold focus:ring-2 focus:ring-slate-200 focus:border-slate-300 transition-all w-full outline-none placeholder:text-slate-300"
                />
              </div>

              {/* Version List */}
              <div className="flex-1 overflow-y-auto scrollbar-hide flex flex-col gap-2 pr-1">
                <AnimatePresence>
                  {isLoading ? (
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
                        const summary = getCourseSummary(v.id);
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
                            className={`w-full text-left rounded-2xl transition-all p-3 flex items-center gap-3 border ${
                              isActive
                                ? 'bg-blue-600 border-blue-500 shadow-lg shadow-blue-500/20'
                                : 'bg-white/80 border-slate-100 hover:border-slate-200 hover:shadow-md hover:shadow-slate-100/80 backdrop-blur-sm'
                            }`}
                          >
                            {/* Color block avatar */}
                            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shrink-0 shadow-sm`}>
                              <span className="text-white text-[13px] font-black">{(v.year || '').toString().slice(-2)}</span>
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <h4 className={`text-[12px] font-black tracking-tight leading-tight truncate mb-1 ${isActive ? 'text-white' : 'text-slate-800'}`}>
                                {v.name}
                              </h4>

                              {/* Badges */}
                              <div className="flex items-center flex-wrap gap-1 mb-1">
                                {deptCfg && (
                                  <span
                                    className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-bold"
                                    style={isActive
                                      ? { background: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.85)' }
                                      : { background: deptCfg.bg, color: deptCfg.color, border: `1px solid ${deptCfg.border}` }
                                    }
                                  >
                                    {deptCfg.label}
                                  </span>
                                )}
                                {v.level && (
                                  <span
                                    className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-bold"
                                    style={isActive
                                      ? { background: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.85)' }
                                      : { background: 'rgba(100,116,139,0.08)', color: '#475569', border: '1px solid rgba(100,116,139,0.18)' }
                                    }
                                  >
                                    {v.level}
                                  </span>
                                )}
                                {trackCfg && (
                                  <span
                                    className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-bold"
                                    style={isActive
                                      ? { background: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.85)' }
                                      : { background: trackCfg.bg, color: trackCfg.color, border: `1px solid ${trackCfg.border}` }
                                    }
                                  >
                                    {trackCfg.label}
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center justify-between">
                                <p className={`text-[10px] font-medium ${isActive ? 'text-white/50' : 'text-slate-400'}`}>
                                  {summary.count} วิชา · {summary.totalCredit.toFixed(1)} นก.
                                  {!v.allowEdit && <HiLockClosed size={9} className="inline ml-1.5 opacity-60" />}
                                </p>
                                <HiChevronRight size={12} className={isActive ? 'text-white/40' : 'text-slate-300'} />
                              </div>
                            </div>
                          </motion.button>
                        );
                      })
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* RIGHT — Detail / Course Editor */}
            <div className={`${!currentVersion ? 'hidden lg:flex' : 'flex'} flex-1 min-w-0 flex-col overflow-hidden rounded-[2rem] border border-white/30 bg-white/30 backdrop-blur-sm shadow-sm p-4`}>
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
