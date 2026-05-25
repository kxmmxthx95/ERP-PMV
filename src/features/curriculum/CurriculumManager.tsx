import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, ClipboardList, Search,
  Plus, BookOpen, Lock,
  ChevronDown, RotateCcw
} from 'lucide-react';
import { useCurriculumVersioned } from '@/hooks/useCurriculumVersioned';

import CourseEditorPanel from './components/CourseEditorPanel';
import AddCurriculumVersionModal from './components/AddCurriculumVersionModal';
import GoogleSheetImportModal from './components/GoogleSheetImportModal';
import AddCourseModal from './components/AddCourseModal';
import AssignGradesModal from './components/AssignGradesModal';
import CurriculumDashboard from './components/CurriculumDashboard';
import {
  type CurriculumVersion, type CurriculumCourse, type NewCurriculumCourse, type CourseCategory, type CurriculumTrack,
  DEPARTMENT_CONFIG, SUBJECT_GROUP_CONFIG, CURRICULUM_TRACK_CONFIG,
} from '@/types/curriculum';

const TABS = [
  { id: 'dashboard', label: 'ภาพรวม', icon: LayoutDashboard },
  { id: 'versions', label: 'หลักสูตร', icon: ClipboardList },
] as const;

type TabId = typeof TABS[number]['id'];

export default function CurriculumManager() {
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [selectedVersion, setSelectedVersion] = useState<CurriculumVersion | null>(null);
  const [filterDepartment, setFilterDepartment] = useState('all');
  const [filterGradeLevel, setFilterGradeLevel] = useState('all');
  const [filterCategory, setFilterCategory] = useState<CourseCategory | 'all'>('all');
  const [filterSubjectGroup, setFilterSubjectGroup] = useState('all');
  const [filterSemester, setFilterSemester] = useState<number | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const {
    isLoading,
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

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleCreateOrDuplicateVersion = async (
    name: string, year: number, cloneFromId?: string, description?: string,
    meta?: { track?: CurriculumTrack; level?: string; department?: string }
  ) => {
    if (cloneFromId) {
      await duplicateVersion(cloneFromId, name, year, description);
      // patch meta after duplicate
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

  // Sync selectedVersion with fresh data
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

  // Header portal
  const headerPortalEl = typeof document !== 'undefined' ? document.getElementById('header-portal-center') : null;
  const filtersPortalEl = typeof document !== 'undefined' ? document.getElementById('header-portal-filters') : null;

  return (
    <div className="flex h-full w-full bg-transparent overflow-hidden pb-4 gap-6 font-sukhumvit text-black">

      {/* ── Header: Tab Navigation ── */}
      {headerPortalEl && createPortal(
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-0.5 h-10 border border-black/[0.07] p-1 rounded-full bg-white/60 backdrop-blur-md pointer-events-auto"
        >
          {TABS.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); setSelectedVersion(null); }}
                className={`h-8 px-4 rounded-full text-[11px] font-bold transition-all whitespace-nowrap ${
                  active
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-black/45 hover:bg-black/5'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </motion.div>,
        headerPortalEl
      )}

      <AnimatePresence mode="wait">
        {/* ── Dashboard Tab ── */}
        {activeTab === 'dashboard' && (
          <motion.div
            key="dashboard"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex-1 overflow-y-auto scrollbar-hide px-2 pb-6 pt-1"
          >
            <CurriculumDashboard
              versions={versions}
              coursesByVersion={coursesByVersion}
              getCourseSummary={getCourseSummary}
              isLoading={isLoading}
            />
          </motion.div>
        )}

        {/* ── Versions Tab: Split layout ── */}
        {activeTab === 'versions' && (
          <motion.div
            key="versions-layout"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-1 min-w-0 h-full overflow-hidden relative"
          >
            {/* LEFT — Detail / Course Editor */}
            <div className="flex-1 min-w-0 flex flex-col pr-6 overflow-hidden">
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
                    className="flex flex-col items-center justify-center h-full text-slate-300"
                  >
                    <BookOpen size={64} className="opacity-10 mb-4" />
                    <p className="text-sm font-black opacity-30 uppercase tracking-widest">เลือกหลักสูตรเพื่อจัดการรายวิชา</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* DIVIDER */}
            <div className="w-px bg-slate-200/80 shrink-0 self-stretch my-4" />

            {/* RIGHT — Version List */}
            <div className="w-[280px] xl:w-[340px] shrink-0 flex flex-col pl-6 pt-1">

              {/* Search */}
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
                <input
                  type="text"
                  placeholder="ค้นหาหลักสูตร..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 pr-3 py-1.5 bg-white/70 backdrop-blur-md border border-slate-200 rounded-full text-[10px] font-bold focus:ring-4 focus:ring-blue-100 focus:border-blue-300 transition-all w-full outline-none placeholder:text-slate-400 shadow-sm"
                />
              </div>

              <div className="h-px bg-slate-100/80 mb-2" />

              {/* Version List */}
              <div className="flex-1 overflow-y-auto scrollbar-hide flex flex-col pt-1">
                <AnimatePresence>
                  {isLoading ? (
                    [...Array(4)].map((_, i) => (
                      <div key={i} className="mx-2 my-1.5 h-[76px] rounded-2xl bg-slate-100 animate-pulse" />
                    ))
                  ) : filteredVersions.length === 0 ? (
                    <div className="h-32 flex flex-col items-center justify-center text-slate-400 opacity-50 border-2 border-dashed border-slate-200 rounded-2xl mx-2">
                      <Search size={22} className="mb-2" />
                      <span className="text-xs font-bold">ไม่พบหลักสูตร</span>
                    </div>
                  ) : (
                    [...filteredVersions].sort((a, b) => a.name.localeCompare(b.name, 'th')).map((v) => {
                      const summary = getCourseSummary(v.id);
                      const isActive = currentVersion?.id === v.id;
                      const trackCfg = v.track ? CURRICULUM_TRACK_CONFIG[v.track] : null;
                      const deptCfg = v.department ? DEPARTMENT_CONFIG[v.department as keyof typeof DEPARTMENT_CONFIG] : null;

                      return (
                        <div key={v.id} className="px-2">
                          <motion.div
                            layout
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => {
                              setSelectedVersion(v);
                              loadCoursesForVersion(v.id);
                            }}
                            className={`w-full flex items-center gap-3 p-2.5 transition-all text-left cursor-pointer group relative ${isActive
                              ? 'bg-blue-600 rounded-xl z-10'
                              : 'bg-transparent hover:bg-black/[0.02] rounded-xl'
                            }`}
                          >
                            {/* Avatar */}
                            <div
                              className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0 shadow-sm overflow-hidden"
                              style={{ background: 'linear-gradient(to bottom right, #34d399, #06b6d4)', color: 'white' }}
                            >
                              <span className="text-xl font-black font-sarabun">{(v.year || '').toString().slice(-2)}</span>
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <h4 className={`text-[13px] font-black tracking-tight leading-none mb-1 truncate ${isActive ? 'text-white' : 'text-slate-800'}`}>
                                {v.name}
                              </h4>

                              {/* Badges row: dept + level + track */}
                              <div className="flex items-center flex-wrap gap-1 mb-1">
                                {deptCfg && (
                                  <span
                                    className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-bold"
                                    style={isActive
                                      ? { background: 'rgba(255,255,255,0.20)', color: 'white' }
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
                                      ? { background: 'rgba(255,255,255,0.20)', color: 'white' }
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
                                      ? { background: 'rgba(255,255,255,0.20)', color: 'white' }
                                      : { background: trackCfg.bg, color: trackCfg.color, border: `1px solid ${trackCfg.border}` }
                                    }
                                  >
                                    {trackCfg.label}
                                  </span>
                                )}
                              </div>

                              <p className={`text-[10px] font-medium tracking-tight ${isActive ? 'text-blue-100/70' : 'text-slate-400'}`}>
                                {summary.count} วิชา · {summary.totalCredit.toFixed(1)} นก.
                                {!v.allowEdit && <Lock size={9} className="inline ml-1.5 opacity-60" />}
                              </p>
                            </div>
                          </motion.div>
                          <div className="mx-4 h-[1px] bg-black/[0.04]" />
                        </div>
                      );
                    })
                  )}
                </AnimatePresence>
              </div>

              {/* Footer */}
              <div className="pt-3 border-t border-slate-100 mt-2 flex items-center justify-between">
                <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">
                  {filteredVersions.length} หลักสูตร
                </p>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => { setVersionToEdit(null); setVersionModalOpen(true); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white rounded-full text-[10px] font-black shadow-md hover:bg-slate-700 transition-all"
                >
                  <Plus size={12} strokeWidth={3} />
                  เพิ่มหลักสูตร
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Filter Bar (portal) ── */}
      {activeTab === 'versions' && currentVersion && filtersPortalEl && createPortal(
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-1 h-10 border border-black/[0.07] p-1 rounded-full bg-white/60 backdrop-blur-md pointer-events-auto overflow-x-auto scrollbar-hide"
        >
          <button
            onClick={() => {
              setFilterCategory('all');
              setFilterSemester('all');
              setFilterSubjectGroup('all');
            }}
            className="flex items-center justify-center w-9 h-9 rounded-full hover:bg-red-50 text-rose-500 hover:text-rose-600 transition-all border-r border-slate-200 pr-1 shrink-0"
            title="ล้างตัวกรอง"
          >
            <RotateCcw size={14} />
          </button>

          <div className="flex items-center gap-1 min-w-0">
            <div className="w-px h-4 bg-slate-200 mx-1 shrink-0" />

            <div className="relative shrink-0">
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value as any)}
                className="appearance-none pl-4 pr-7 py-1.5 bg-transparent hover:bg-slate-50 text-slate-900 transition-all font-black text-[11px] outline-none cursor-pointer rounded-full"
              >
                <option value="all">ทุกหมวด</option>
                <option value="basic">พื้นฐาน</option>
                <option value="additional">เพิ่มเติม</option>
                <option value="activity">กิจกรรม</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" size={12} />
            </div>

            <div className="relative shrink-0">
              <select
                value={filterSemester}
                onChange={(e) => setFilterSemester(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                className="appearance-none pl-4 pr-7 py-1.5 bg-transparent hover:bg-slate-50 text-slate-900 transition-all font-black text-[11px] outline-none cursor-pointer rounded-full"
              >
                <option value="all">ทุกเทอม</option>
                <option value="1">เทอม 1</option>
                <option value="2">เทอม 2</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" size={12} />
            </div>

            <div className="w-px h-4 bg-slate-200 mx-1 shrink-0" />

            <div className="relative shrink-0 max-w-[150px]">
              <select
                value={filterSubjectGroup}
                onChange={(e) => setFilterSubjectGroup(e.target.value)}
                className="appearance-none pl-4 pr-7 py-1.5 bg-transparent hover:bg-slate-50 text-slate-900 transition-all font-black text-[11px] outline-none cursor-pointer rounded-full truncate"
              >
                <option value="all">ทุกกลุ่มสาระ</option>
                {Object.entries(SUBJECT_GROUP_CONFIG).map(([id, group]) => (
                  <option key={id} value={id}>{group.name}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" size={12} />
            </div>
          </div>
        </motion.div>,
        filtersPortalEl
      )}

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
