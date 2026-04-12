import { useState } from 'react';
import { useActiveAcademicYear } from '@/hooks/useActiveAcademicYear';
import { useCurriculum } from '@/hooks/useCurriculum';
import { DEPARTMENT_CONFIG, type Department, type Subject } from '@/types/curriculum';

export function useCurriculumManager() {
  const { year: academicYear } = useActiveAcademicYear();
  const activeYear = academicYear ?? '2568';

  const curriculum = useCurriculum();

  // ── Department / Grade / Semester ──────────────────────────────────────────
  const [activeDepartment, setActiveDepartment] = useState<Department>('primary');
  const [activeGrade, setActiveGrade] = useState<string>('');
  const [activeSemester, setActiveSemester] = useState<1 | 2>(1);

  const handleChangeDepartment = (dept: Department) => {
    setActiveDepartment(dept);
    setActiveGrade('');
  };

  // ── Modal ──────────────────────────────────────────────────────────────────
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | undefined>(undefined);

  const openAddModal = () => {
    setEditingSubject(undefined);
    setModalOpen(true);
  };

  const openEditModal = (subject: Subject) => {
    setEditingSubject(subject);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingSubject(undefined);
  };

  // ── Derived ────────────────────────────────────────────────────────────────
  const deptSubjects = curriculum.subjectsByDepartment[activeDepartment] ?? [];

  const assignedIds = curriculum
    .getMapSubjects(activeGrade, activeSemester, activeYear)
    .map(s => s.id);

  const creditSummary = curriculum.getCreditSummary(activeGrade, activeSemester, activeYear);

  const stats = (['early', 'primary', 'secondary'] as Department[]).map(dept => ({
    dept,
    cfg: DEPARTMENT_CONFIG[dept],
    count: (curriculum.subjectsByDepartment[dept] ?? []).length,
  }));

  return {
    // Academic year
    activeYear,

    // Department / grade / semester
    activeDepartment,
    activeGrade,
    activeSemester,
    handleChangeDepartment,
    setActiveGrade,
    setActiveSemester,

    // Modal
    modalOpen,
    editingSubject,
    openAddModal,
    openEditModal,
    closeModal,

    // Derived
    deptSubjects,
    assignedIds,
    creditSummary,
    stats,
    totalSubjects: curriculum.subjects.length,
    allSubjects: curriculum.subjects,

    // Curriculum actions (pass-through)
    addSubject: curriculum.addSubject,
    updateSubject: curriculum.updateSubject,
    deleteSubject: curriculum.deleteSubject,
    toggleSubjectInMap: (id: string) =>
      curriculum.toggleSubjectInMap(activeGrade, activeDepartment, activeSemester, activeYear, id),

    // Registration
    cloneCurriculum: curriculum.cloneCurriculum,
    getYearRegistrationGrid: curriculum.getYearRegistrationGrid,
    getAllYears: curriculum.getAllYears,
  };
}
