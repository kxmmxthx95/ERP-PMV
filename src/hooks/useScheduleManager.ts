import { useState, useMemo } from 'react';
import { useActiveAcademicYear } from '@/hooks/useActiveAcademicYear';
import { useSchedule } from '@/hooks/useSchedule';
import { useCurriculum } from '@/hooks/useCurriculum';
import { useTeacherManager } from '@/hooks/useTeacherManager';
import type { ScheduleEntry, SchoolDay } from '@/types/schedule';
import { SCHOOL_DAYS, PERIOD_COUNT, LUNCH_PERIOD } from '@/types/schedule';
import type { Department } from '@/types/curriculum';
import { DEPARTMENT_CONFIG } from '@/types/curriculum';

export type ViewMode = 'class' | 'teacher' | 'compare';

export interface SlotModalState {
  open: boolean;
  day: SchoolDay | null;
  period: number | null;
  editingEntry: ScheduleEntry | null;
}

export function useScheduleManager() {
  const { year: academicYear, activeSemester } = useActiveAcademicYear();
  const activeYear = academicYear ?? '2568';
  const [semester, setSemester] = useState<1 | 2>((activeSemester ?? 1) as 1 | 2);

  const schedule = useSchedule();
  const curriculum = useCurriculum();
  const teacherManager = useTeacherManager();

  // ── View mode ─────────────────────────────────────────────────────────────────
  const [viewMode, setViewMode] = useState<ViewMode>('class');

  // ── Department + Grade filters ────────────────────────────────────────────────
  const [filterDept,  setFilterDept]  = useState<Department | 'all'>('all');
  const [filterGrade, setFilterGrade] = useState<string>('all');

  // ── Filtered class list ───────────────────────────────────────────────────────
  const filteredClasses = useMemo(() => {
    return schedule.classes.filter(c => {
      if (filterDept !== 'all' && c.department !== filterDept) return false;
      if (filterGrade !== 'all' && c.gradeLevel !== filterGrade) return false;
      return true;
    });
  }, [schedule.classes, filterDept, filterGrade]);

  // Grade levels available for the selected dept
  const availableGrades = useMemo(() => {
    const src = filterDept === 'all' ? schedule.classes : schedule.classes.filter(c => c.department === filterDept);
    return [...new Set(src.map(c => c.gradeLevel))].sort();
  }, [schedule.classes, filterDept]);

  // Department summary — จำนวนห้องและคาบต่อแผนก
  const deptSummary = useMemo(() =>
    (['early', 'primary', 'secondary'] as Department[]).map(dept => ({
      dept,
      cfg: DEPARTMENT_CONFIG[dept],
      classCount: schedule.classes.filter(c => c.department === dept).length,
    })),
    [schedule.classes],
  );

  // ── Selection — auto-reset when filter changes ────────────────────────────────
  const defaultClassId = filteredClasses[0]?.id ?? schedule.classes[0]?.id ?? '';
  const [selectedClassId, setSelectedClassIdRaw] = useState<string>(schedule.classes[6]?.id ?? defaultClassId);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>(
    teacherManager.scheduleTeachers[0]?.id ?? '',
  );

  // ── Compare mode — second selection ───────────────────────────────────────────
  const [compareClassId, setCompareClassIdRaw] = useState<string>(schedule.classes[7]?.id ?? defaultClassId);
  const [compareTeacherId, setCompareTeacherId] = useState<string>(
    teacherManager.scheduleTeachers[1]?.id ?? teacherManager.scheduleTeachers[0]?.id ?? '',
  );

  const resolvedCompareClassId = schedule.classes.some(c => c.id === compareClassId)
    ? compareClassId
    : (schedule.classes[0]?.id ?? '');

  const setCompareClassId = (id: string) => setCompareClassIdRaw(id);

  // เมื่อ filter เปลี่ยน ถ้า selectedClassId ไม่อยู่ใน filteredClasses ให้ reset
  const resolvedClassId = selectedClassId 
    ? (filteredClasses.some(c => c.id === selectedClassId) ? selectedClassId : (filteredClasses[0]?.id ?? ''))
    : '';

  const setSelectedClassId = (id: string) => setSelectedClassIdRaw(id);

  const handleSetFilterDept = (dept: Department | 'all') => {
    setFilterDept(dept);
    setFilterGrade('all');
    // reset class selection to first of new filter
    const newFiltered = schedule.classes.filter(c => dept === 'all' || c.department === dept);
    if (newFiltered.length > 0) setSelectedClassIdRaw(newFiltered[0].id);
  };

  const handleSetFilterGrade = (grade: string) => {
    setFilterGrade(grade);
    // Reset room selection to force manual choice
    setSelectedClassIdRaw('');
  };

  // ── Slot modal ────────────────────────────────────────────────────────────────
  const [slotModal, setSlotModal] = useState<SlotModalState>({
    open: false, day: null, period: null, editingEntry: null,
  });

  const openSlotModal = (day: SchoolDay, period: number, editingEntry: ScheduleEntry | null = null) => {
    if (period === LUNCH_PERIOD) return; // คาบพักไม่สามารถแก้ไขได้
    setSlotModal({ open: true, day, period, editingEntry });
  };

  const closeSlotModal = () =>
    setSlotModal({ open: false, day: null, period: null, editingEntry: null });

  // ── Derived grid data ─────────────────────────────────────────────────────────
  const displayedEntries = useMemo(() => {
    if (viewMode === 'class' || viewMode === 'compare') {
      return schedule.getEntriesForClass(resolvedClassId, activeYear, semester);
    }
    return schedule.getEntriesForTeacher(selectedTeacherId, activeYear, semester);
  }, [viewMode, resolvedClassId, selectedTeacherId, activeYear, semester, schedule.entries]);

  // grid[day][period] => ScheduleEntry | null
  const grid = useMemo(() => {
    const g: Record<number, Record<number, ScheduleEntry | null>> = {};
    for (const day of SCHOOL_DAYS) {
      g[day] = {};
      for (let p = 1; p <= PERIOD_COUNT; p++) {
        g[day][p] = null;
      }
    }
    for (const entry of displayedEntries) {
      if (g[entry.day]) g[entry.day][entry.period] = entry;
    }
    return g;
  }, [displayedEntries]);

  // ── Compare grid ──────────────────────────────────────────────────────────────
  const compareEntries = useMemo(() => {
    if (viewMode !== 'compare') return [];
    return schedule.getEntriesForClass(resolvedCompareClassId, activeYear, semester);
  }, [viewMode, resolvedCompareClassId, activeYear, semester, schedule.entries]);

  const compareGrid = useMemo(() => {
    const g: Record<number, Record<number, ScheduleEntry | null>> = {};
    for (const day of SCHOOL_DAYS) {
      g[day] = {};
      for (let p = 1; p <= PERIOD_COUNT; p++) {
        g[day][p] = null;
      }
    }
    for (const entry of compareEntries) {
      if (g[entry.day]) g[entry.day][entry.period] = entry;
    }
    return g;
  }, [compareEntries]);

  // สรุปจำนวนคาบต่อครูในภาพรวม
  const currentTeacherLoad = schedule.teacherLoadSummary[selectedTeacherId] ?? 0;

  // วิชาที่มีในหลักสูตรของห้องที่เลือก (ดึงจาก curriculum subjects ตาม department)
  const selectedClass = schedule.classes.find(c => c.id === resolvedClassId);
  const availableSubjects = useMemo(() => {
    if (!selectedClass) return curriculum.subjects;
    return curriculum.subjects.filter(s => s.department === selectedClass.department);
  }, [selectedClass, curriculum.subjects]);

  return {
    // Academic year
    activeYear,
    semester,
    setSemester,

    // View mode
    viewMode,
    setViewMode,

    // Filters
    filterDept,
    setFilterDept: handleSetFilterDept,
    filterGrade,
    setFilterGrade: handleSetFilterGrade,
    filteredClasses,
    availableGrades,
    deptSummary,

    // Selection
    selectedClassId: resolvedClassId,
    setSelectedClassId,
    selectedTeacherId,
    setSelectedTeacherId,
    selectedClass,

    // Grid
    grid,
    displayedEntries,

    // Modal
    slotModal,
    openSlotModal,
    closeSlotModal,

    // Data
    classes: schedule.classes,
    teachers: teacherManager.scheduleTeachers,
    availableSubjects,
    teacherLoadSummary: schedule.teacherLoadSummary,
    currentTeacherLoad,

    // Compare mode
    compareClassId: resolvedCompareClassId,
    setCompareClassId,
    compareTeacherId,
    setCompareTeacherId,
    compareGrid,

    // Schedule actions
    addEntry: schedule.addEntry,
    updateEntry: schedule.updateEntry,
    deleteEntry: schedule.deleteEntry,
    moveEntry: schedule.moveEntry,
    detectConflicts: schedule.detectConflicts,
  };
}
