import { useState } from 'react';
import { useActiveAcademicYear } from '@/hooks/useActiveAcademicYear';
import { useCurriculum } from '@/hooks/useCurriculum';
import { DEPARTMENT_CONFIG, type Department, type Subject, type SubjectCategory } from '@/types/curriculum';

export function useCurriculumManager() {
  const { year: academicYear } = useActiveAcademicYear();
  const activeYear = academicYear ?? '2568';

  const curriculum = useCurriculum();

  // ── Department / Grade / Semester ──────────────────────────────────────────
  const [activeDepartment, setActiveDepartment] = useState<Department>('primary');
  const [activeGrade, setActiveGrade] = useState<string>('');
  const [activeSemester, setActiveSemester] = useState<1 | 2>(1);
  const [activeMapId, setActiveMapId] = useState<string | undefined>(undefined);

  const handleChangeDepartment = (dept: Department) => {
    setActiveDepartment(dept);
    setActiveGrade('');
    setActiveMapId(undefined);
  };

  const handleGradeChange = (grade: string) => {
    setActiveGrade(grade);
    setActiveMapId(undefined);
  };

  const handleSemesterChange = (semester: 1 | 2) => {
    setActiveSemester(semester);
    // ไม่ต้องล้างค่า activeMapId เพื่อให้ Dropdown อยู่เฉยๆ
  };

  const handleMapIdChange = (id: string) => {
    setActiveMapId(id);
  };

  // ── Global Filter State for Subjects ──
  const [filterDepartment, setFilterDepartment] = useState<string>('all');
  const [filterGrade, setFilterGrade] = useState<string>('all');
  const [filterGroup, setFilterGroup] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<SubjectCategory | 'all'>('all');
  const [search, setSearch] = useState('');

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

  // ดึง subjectIds จาก activeMapId โดยตรง
  const activeMapData = activeMapId ? curriculum.maps.find(m => m.id === activeMapId) : undefined;
  const semKey = activeSemester === 1 ? 'semester1' : 'semester2';
  const assignedIds = (activeMapId && filterDepartment !== 'all' && filterGrade !== 'all')
    ? (activeMapData?.sections?.[filterDepartment as Department]?.[filterGrade]?.[semKey] || [])
    : [];

  const creditSummary = (() => {
    const summary = { core: 0, added: 0, elective: 0, activity: 0, total: 0 };
    if (!assignedIds.length) return summary;
    const mapSubjects = curriculum.subjects.filter(s => assignedIds.includes(s.id));
    for (const s of mapSubjects) {
      summary[s.category] += s.credits;
      summary.total += s.credits;
    }
    return summary;
  })();

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
    setActiveGrade: handleGradeChange,
    setActiveSemester: handleSemesterChange,
    activeMapId,
    setActiveMapId: handleMapIdChange,

    // Filter State
    filterDepartment,
    setFilterDepartment,
    filterGrade,
    setFilterGrade,
    filterGroup,
    setFilterGroup,
    categoryFilter,
    setCategoryFilter,
    search,
    setSearch,

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
    isLoading: curriculum.isLoading,
    subjectsByDepartment: curriculum.subjectsByDepartment,
    allSubjects: curriculum.subjects,
    allMaps: curriculum.maps,
    getAssignedIds: (mapId: string) => {
      const m = curriculum.maps.find(map => map.id === mapId);
      if (!m) return [];
      const semKey = activeSemester === 1 ? 'semester1' : 'semester2';
      // ถ้าตั้ง filter ไว้ → ดูเฉพาะ section นั้น
      if (filterDepartment !== 'all' && filterGrade !== 'all') {
        return m.sections?.[filterDepartment as Department]?.[filterGrade]?.[semKey] || [];
      }
      // ไม่มี filter → รวบรวมจากทุก section
      const allIds = new Set<string>();
      for (const deptSections of Object.values(m.sections || {})) {
        for (const gradeSections of Object.values(deptSections || {})) {
          for (const id of (gradeSections as any)?.[semKey] || []) {
            allIds.add(id);
          }
        }
      }
      return Array.from(allIds);
    },
    getCreditSummary: (semester: 1 | 2, mapId: string) => {
      if (!mapId || filterDepartment === 'all' || filterGrade === 'all') return { core: 0, added: 0, elective: 0, activity: 0, total: 0 };
      return curriculum.getCreditSummary(mapId, filterDepartment as Department, filterGrade, semester);
    },

    // Curriculum actions (pass-through)
    addSubject: curriculum.addSubject,
    addBulkSubjects: curriculum.addBulkSubjects,
    updateSubject: curriculum.updateSubject,
    deleteSubject: curriculum.deleteSubject,
    deleteCurriculumMap: curriculum.deleteCurriculumMap,
    updateCurriculumMap: curriculum.updateCurriculumMap,
    createCurriculum: curriculum.createCurriculum,
    toggleSubjectInMap: (subjectId: string, mapId: string) => {
      console.log('[useCurriculumManager] toggleSubjectInMap called', { subjectId, mapId, filterDepartment, filterGrade, activeSemester });
      if (!mapId) { console.warn('[useCurriculumManager] blocked: no mapId'); return; }
      let dept = filterDepartment;
      let grade = filterGrade;
      // ถ้าไม่ได้ตั้ง filter → ใช้ข้อมูลจากวิชานั้นโดยตรง
      if (dept === 'all' || grade === 'all') {
        const subject = curriculum.subjects.find(s => s.id === subjectId);
        console.log('[useCurriculumManager] no filter, found subject:', subject);
        if (!subject) { console.warn('[useCurriculumManager] blocked: subject not found in curriculum.subjects'); return; }
        dept = subject.department;
        grade = subject.gradeLevel || '_common';
      }
      console.log('[useCurriculumManager] calling curriculum.toggleSubjectInMap', { mapId, dept, grade, activeSemester, subjectId });
      curriculum.toggleSubjectInMap(mapId, dept as Department, grade, activeSemester, subjectId);
    },

    // Registration
    getOrCreateMap: curriculum.getOrCreateMap,
    cloneCurriculum: curriculum.cloneCurriculum,
    getYearRegistrationGrid: curriculum.getYearRegistrationGrid,
    getAllYears: curriculum.getAllYears,
  };
}
