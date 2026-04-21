import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GraduationCap, BookOpen, LayoutDashboard, ClipboardList } from 'lucide-react';
import { useCurriculumManager } from '@/hooks/useCurriculumManager';
import { useActiveAcademicYear } from '@/hooks/useActiveAcademicYear';
import SubjectMasterPanel from './components/SubjectMasterPanel';
import CurriculumMapPanel from './components/CurriculumMapPanel';
import AddSubjectModal from './components/AddSubjectModal';
import AddCurriculumModal from './components/AddCurriculumModal';
import CurriculumDashboard from './components/CurriculumDashboard';
import CurriculumRegistrationTab from './components/CurriculumRegistrationTab';
import CurriculumFilterCard from './components/CurriculumFilterCard';

const containerAnim = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};
const cardAnim = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

export default function CurriculumManager() {
  const [activeTab, setActiveTab] = useState<'manage' | 'register' | 'dashboard'>('register');
  const [editMode, setEditMode] = useState(false);

  useActiveAcademicYear();
  const {
    activeYear,
    activeDepartment,
    activeSemester,
    activeMapId,
    setActiveMapId,
    setActiveSemester,
    modalOpen,
    editingSubject,
    openAddModal,
    openEditModal,
    closeModal,
    totalSubjects,
    allSubjects,
    addSubject,
    addBulkSubjects,
    updateSubject,
    deleteSubject,
    toggleSubjectInMap,
    deleteCurriculumMap,
    allMaps,
    getAssignedIds,
    getCreditSummary,
    isLoading,
 
    // Filter State
    filterDepartment, setFilterDepartment,
    filterGrade, setFilterGrade,
    filterGroup, setFilterGroup,
    categoryFilter, setCategoryFilter,
    search, setSearch,
  } = useCurriculumManager();

  const [addCurriculumOpen, setAddCurriculumOpen] = useState(false);

  return (
    <div className="space-y-5 text-black">
      {/* ── Page Header ── */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"
      >
        <div>
          <div className="flex items-center gap-2.5">
            <GraduationCap size={22} className="text-black/70" />
            <h1 className="text-xl font-bold text-black/85 tracking-tight">จัดการหลักสูตร</h1>
          </div>
          <p className="text-xs text-black/40 mt-1">{totalSubjects} วิชาทั้งหมดในคลังระบบ</p>
        </div>

        {/* ── Actions & Tab Switcher ── */}
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
          {/* Tab Switcher */}
          <div
            className="flex gap-1 overflow-x-auto rounded-xl shadow-sm max-w-full"
            style={{
              background: 'rgba(255, 255, 255, 0.4)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: '1px solid rgba(255, 255, 255, 0.6)',
              padding: '0.25rem',
            }}
          >
            {[
              { id: 'register', label: 'หลักสูตร', icon: ClipboardList },
              { id: 'manage', label: 'จัดการหลักสูตร', icon: BookOpen },
              { id: 'dashboard', label: 'ภาพรวม', icon: LayoutDashboard },
            ].map(tab => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as 'manage' | 'register' | 'dashboard')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-200 flex-shrink-0"
                  style={{
                    background: active ? '#1e1e1e' : 'transparent',
                    color: active ? '#fff' : 'rgba(0, 0, 0, 0.6)',
                    boxShadow: active ? '0 4px 12px rgba(0,0,0,0.15)' : 'none',
                  }}
                  onMouseEnter={e => {
                    if (!active) (e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.05)';
                  }}
                  onMouseLeave={e => {
                    if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent';
                  }}
                >
                  <Icon size={14} className="flex-shrink-0" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </motion.div>

      {/* ── Content Area ── */}
      <AnimatePresence mode="wait">
        {activeTab === 'manage' && (
          <motion.div
            key="manage"
            variants={containerAnim}
            initial="hidden"
            animate="show"
            exit={{ opacity: 0, y: -10 }}
            className="flex flex-col gap-4"
          >
            <motion.div variants={cardAnim}>
              <CurriculumFilterCard
                maps={allMaps}
                activeMapId={activeMapId || ''}
                setActiveMapId={setActiveMapId}
                editMode={editMode}
                onEditModeChange={setEditMode}
                isLoading={isLoading}
              />
            </motion.div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 auto-rows-max" style={{ minHeight: '78vh' }}>
              <motion.div variants={cardAnim} className="flex flex-col h-full min-w-0 max-h-[78vh]">
                <SubjectMasterPanel
                  subjects={allSubjects}
                  assignedSubjectIds={getAssignedIds(activeMapId ?? '')}
                  onAddSubject={openAddModal}
                  onAddBulkSubjects={addBulkSubjects}
                  onEditSubject={openEditModal}
                  onDeleteSubject={deleteSubject}
                  onToggleSubject={(id) => editMode && activeMapId && toggleSubjectInMap(id, activeMapId)}
                  isEditMode={editMode}
                  search={search} setSearch={setSearch}
                  filterDepartment={filterDepartment} setFilterDepartment={setFilterDepartment}
                  filterGrade={filterGrade} setFilterGrade={setFilterGrade}
                  filterGroup={filterGroup} setFilterGroup={setFilterGroup}
                  categoryFilter={categoryFilter} setCategoryFilter={setCategoryFilter}
                  isLoading={isLoading}
                />
              </motion.div>

              <motion.div variants={cardAnim} className="flex flex-col h-full min-w-0 max-h-[78vh]">
                <CurriculumMapPanel
                  academicYear={activeYear}
                  subjects={allSubjects}
                  allMaps={allMaps}
                  activeMapId={activeMapId}
                  activeSemester={activeSemester}
                  setActiveSemester={setActiveSemester}
                  getAssignedIds={getAssignedIds}
                  getCreditSummary={(mapId) => getCreditSummary(activeSemester, mapId)}
                  onToggleSubject={toggleSubjectInMap}
                  isEditMode={editMode}
                  search={search} setSearch={setSearch}
                  filterDepartment={filterDepartment} setFilterDepartment={setFilterDepartment}
                  filterGrade={filterGrade} setFilterGrade={setFilterGrade}
                  filterGroup={filterGroup} setFilterGroup={setFilterGroup}
                  categoryFilter={categoryFilter} setCategoryFilter={setCategoryFilter}
                  isLoading={isLoading}
                />
              </motion.div>
            </div>
          </motion.div>
        )}

        {activeTab === 'register' && (
          <motion.div
            key="register"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="min-h-[78vh]"
          >
            <CurriculumRegistrationTab
              maps={allMaps}
              deleteCurriculumMap={deleteCurriculumMap}
              onSelectMap={(mapId) => {
                setActiveMapId(mapId);
                setActiveTab('manage');
              }}
              onAdd={() => setAddCurriculumOpen(true)}
              isLoading={isLoading}
            />
            <AddCurriculumModal
              open={addCurriculumOpen}
              onClose={() => setAddCurriculumOpen(false)}
              onCreated={(mapId) => {
                setActiveMapId(mapId);
                setAddCurriculumOpen(false);
              }}
            />
          </motion.div>
        )}

        {activeTab === 'dashboard' && (
          <motion.div
            key="dashboard"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="min-h-[78vh]"
          >
            <CurriculumDashboard subjects={allSubjects} academicYear={activeYear} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Modal ── */}
      <AddSubjectModal
        open={modalOpen}
        defaultDepartment={filterDepartment === 'all' ? activeDepartment : (filterDepartment as any)}
        defaultGrade={filterGrade === 'all' ? '' : filterGrade}
        defaultSubjectGroup={filterGroup === 'all' ? '' : filterGroup}
        defaultCategory={categoryFilter === 'all' ? 'core' : (categoryFilter as any)}
        subjectToEdit={editingSubject}
        existingSubjects={allSubjects}
        onClose={closeModal}
        onSubmit={addSubject}
        onUpdate={updateSubject}
        onDelete={deleteSubject}
      />
    </div>
  );
}
