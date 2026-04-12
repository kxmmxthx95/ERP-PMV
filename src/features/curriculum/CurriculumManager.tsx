import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GraduationCap, BookOpen, LayoutDashboard, Plus, ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCurriculumManager } from '@/hooks/useCurriculumManager';
import SubjectMasterPanel from './components/SubjectMasterPanel';
import CurriculumMapPanel from './components/CurriculumMapPanel';
import AddSubjectModal from './components/AddSubjectModal';
import AddCurriculumModal from './components/AddCurriculumModal';
import CurriculumDashboard from './components/CurriculumDashboard';
import CurriculumRegistrationTab from './components/CurriculumRegistrationTab';

const containerAnim = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};
const cardAnim = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

export default function CurriculumManager() {
  const [activeTab, setActiveTab] = useState<'manage' | 'register' | 'dashboard'>('manage');
  const [isAddCurriculumOpen, setIsAddCurriculumOpen] = useState(false);

  const {
    activeYear,
    activeDepartment,
    activeGrade,
    activeSemester,
    handleChangeDepartment,
    setActiveGrade,
    setActiveSemester,
    modalOpen,
    editingSubject,
    openAddModal,
    openEditModal,
    closeModal,
    assignedIds,
    creditSummary,
    totalSubjects,
    allSubjects,
    addSubject,
    updateSubject,
    deleteSubject,
    toggleSubjectInMap,
    cloneCurriculum,
    getYearRegistrationGrid,
    getAllYears,
  } = useCurriculumManager();

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
              { id: 'manage', label: 'จัดการหลักสูตร', icon: BookOpen },
              { id: 'register', label: 'ลงทะเบียน', icon: ClipboardList },
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

          {/* Add Curriculum Button */}
          <Button
            className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold text-white transition-all duration-150 hover:scale-[1.02] active:scale-[0.98] h-auto border-0 bg-[#1e1e1e] hover:bg-[#2a2a2a] flex-shrink-0"
            style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
            onClick={() => setIsAddCurriculumOpen(true)}
          >
            <Plus size={14} />
            สร้างหลักสูตร
          </Button>
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
            className="grid grid-cols-1 xl:grid-cols-2 gap-4 auto-rows-max"
            style={{ minHeight: '78vh' }}
          >
            <motion.div variants={cardAnim} className="flex flex-col h-full min-w-0 max-h-[78vh]">
              <SubjectMasterPanel
                subjects={allSubjects}
                activeDepartment={activeDepartment}
                assignedSubjectIds={assignedIds}
                onAddSubject={openAddModal}
                onEditSubject={openEditModal}
                onDeleteSubject={deleteSubject}
                onFilterDepartmentChange={(dept) => handleChangeDepartment(dept as any)}
                onFilterGradeChange={setActiveGrade}
                onToggleSubject={toggleSubjectInMap}
              />
            </motion.div>

            <motion.div variants={cardAnim} className="flex flex-col h-full min-w-0 max-h-[78vh]">
              <CurriculumMapPanel
                activeDepartment={activeDepartment}
                activeGrade={activeGrade}
                activeSemester={activeSemester}
                academicYear={activeYear}
                subjects={allSubjects}
                assignedSubjectIds={assignedIds}
                creditSummary={creditSummary}
                onToggleSubject={toggleSubjectInMap}
                onChangeGrade={setActiveGrade}
                onChangeSemester={(semester) => setActiveSemester(semester as 1 | 2)}
              />
            </motion.div>
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
              activeYear={activeYear}
              allYears={getAllYears()}
              getYearRegistrationGrid={getYearRegistrationGrid}
              cloneCurriculum={cloneCurriculum}
              onSelectCell={(grade, semester) => {
                setActiveGrade(grade);
                setActiveSemester(semester);
                setActiveTab('manage');
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
        defaultDepartment={activeDepartment}
        subjectToEdit={editingSubject}
        onClose={closeModal}
        onSubmit={addSubject}
        onUpdate={updateSubject}
        onDelete={deleteSubject}
      />

      {/* ── Add Curriculum Modal ── */}
      <AddCurriculumModal 
        open={isAddCurriculumOpen}
        onClose={() => setIsAddCurriculumOpen(false)}
      />
    </div>
  );
}
