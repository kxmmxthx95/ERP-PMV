import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { useActiveAcademicYear } from '@/hooks/useActiveAcademicYear';
import { useSchedule } from '@/hooks/useSchedule';
import { useScheduleSettings } from '@/hooks/useScheduleSettings';
import { useCurriculum } from '@/hooks/useCurriculum';
import { useCurriculumVersioned } from '@/hooks/useCurriculumVersioned';
import { useTeacherManager } from '@/features/teachers/hooks/useTeacherManager';
import type { ScheduleEntry, SchoolDay } from '@/types/schedule';
import { SCHOOL_DAYS, PERIOD_COUNT } from '@/types/schedule';
import type { Department } from '@/types/curriculum';
import { DEPARTMENT_CONFIG } from '@/types/curriculum';
import {
  buildSubjectCatalogForClass,
  enrolledCourseMatchesTeacher,
  getTeacherSyncUpdates,
  resolveScheduleTeacherId,
  scheduleEntryMatchesTeacher,
} from '@/features/schedule/utils/syncScheduleTeachers';

export type ViewMode = 'class' | 'teacher' | 'compare';

export interface SlotModalState {
  open: boolean;
  day: SchoolDay | null;
  period: number | null;
  editingEntry: ScheduleEntry | null;
}

const isGradeMatch = (curriculumGrade?: string, classroomGrade?: string) => {
  if (!curriculumGrade || !classroomGrade) return true;
  const normalize = (s: string) => s.trim().replace(/\s+/g, '').replace('ชั้น', '');
  const g1 = normalize(curriculumGrade);
  const g2 = normalize(classroomGrade);
  return g1 === g2 || g1.includes(g2) || g2.includes(g1);
};

const normalizeGrade = (grade?: string) =>
  (grade || '').trim().replace(/\s+/g, '').replace('ชั้น', '');

const normalizeDepartment = (dept?: string, gradeLevel?: string): Department | undefined => {
  const raw = (dept || '').trim().toLowerCase();
  if (raw === 'early' || raw === 'early-childhood' || raw === 'อนุบาล' || raw === 'ปฐมวัย') return 'early';
  if (raw === 'primary' || raw === 'ประถม') return 'primary';
  if (raw === 'secondary' || raw === 'มัธยม') return 'secondary';

  const g = normalizeGrade(gradeLevel);
  if (g.startsWith('อ')) return 'early';
  if (g.startsWith('ป')) return 'primary';
  if (g.startsWith('ม')) return 'secondary';
  return undefined;
};

export function useScheduleManager() {
  const { year: academicYear, activeSemester } = useActiveAcademicYear();
  const activeYear = academicYear ?? '2568';
  const [semester, setSemester] = useState<1 | 2>((activeSemester ?? 1) as 1 | 2);

  const schedule = useSchedule();
  const curriculum = useCurriculum();
  const curriculumVersioned = useCurriculumVersioned();
  const teacherManager = useTeacherManager();

  // ── View mode ─────────────────────────────────────────────────────────────────
  const [viewMode, setViewMode] = useState<ViewMode>('class');

  // ── Department + Grade filters ────────────────────────────────────────────────
  const [filterDept, setFilterDept] = useState<Department | 'all'>('all');
  const [filterGrade, setFilterGrade] = useState<string>('all');

  // ── Filtered class list ───────────────────────────────────────────────────────
  const filteredClasses = useMemo(() => {
    const gradeFilter = normalizeGrade(filterGrade);

    const base = schedule.classes.filter(c => {
      const dept = normalizeDepartment(c.department || c.departmentId, c.gradeLevel);
      if (filterDept !== 'all' && dept !== filterDept) return false;
      if (filterGrade !== 'all' && normalizeGrade(c.gradeLevel) !== gradeFilter) return false;
      return true;
    });

    // พยายามกรองตามปีการศึกษาก่อน แต่ถ้าว่างให้ fallback ไปที่รายการ base
    const yearFiltered = base.filter(c => !c.academicYear || String(c.academicYear) === String(activeYear));
    const source = yearFiltered.length > 0 ? yearFiltered : base;

    return source.sort((a, b) =>
      (a.gradeLevel || '').localeCompare(b.gradeLevel || '', 'th', { numeric: true }) ||
      (a.label || '').localeCompare(b.label || '', 'th', { numeric: true })
    );
  }, [schedule.classes, activeYear, filterDept, filterGrade]);

  // Grade levels available for the selected dept
  const availableGrades = useMemo(() => {
    const src = filterDept === 'all'
      ? schedule.classes
      : schedule.classes.filter(c => normalizeDepartment(c.department || c.departmentId, c.gradeLevel) === filterDept);

    return [...new Set(src.map(c => c.gradeLevel).filter(Boolean))].sort();
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
  const [selectedClassId, setSelectedClassIdRaw] = useState<string>('');
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');

  // ── Compare mode — second selection ───────────────────────────────────────────
  const [compareClassId, setCompareClassIdRaw] = useState<string>('');
  const [compareTeacherId, setCompareTeacherId] = useState<string>('');

  const resolvedCompareClassId = compareClassId && schedule.classes.some(c => c.id === compareClassId)
    ? compareClassId
    : '';

  const setCompareClassId = (id: string) => setCompareClassIdRaw(id);

  // เมื่อ filter เปลี่ยน ถ้า selectedClassId ไม่อยู่ใน filteredClasses ให้ reset
  const resolvedClassId = selectedClassId && filteredClasses.some(c => c.id === selectedClassId)
    ? selectedClassId
    : '';

  const settingsId = viewMode === 'teacher' ? selectedTeacherId : resolvedClassId;
  const { periodTimes, lunchPeriods, breakPeriods } = useScheduleSettings(settingsId);
  // คาบพัก/คาบพักกลางวันตั้งค่าได้ต่อห้อง (class_settings) — ไม่ใช่ตัวเลขตายตัวเสมอ (LUNCH_PERIOD=6 คือ default เฉยๆ)
  const nonTeachingPeriods = useMemo(
    () => new Set([...lunchPeriods, ...breakPeriods]),
    [lunchPeriods, breakPeriods],
  );

  const setSelectedClassId = (id: string) => setSelectedClassIdRaw(id);

  const handleSetFilterDept = (dept: Department | 'all') => {
    setFilterDept(dept);
    setFilterGrade('all');
    // reset class selection and wait for explicit user search
    setSelectedClassIdRaw('');
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
    if (nonTeachingPeriods.has(period)) return; // คาบพัก/คาบพักกลางวัน (ตามค่าตั้งของห้องนี้) แก้ไขไม่ได้
    setSlotModal({ open: true, day, period, editingEntry });
  };

  const closeSlotModal = () =>
    setSlotModal({ open: false, day: null, period: null, editingEntry: null });

  // ── Edit mode ────────────────────────────────────────────────────────────────
  const [isEditMode, setIsEditMode] = useState(false);


  // ── Export / Print ─────────────────────────────────────────────────────────────
  const exportRef = useRef<HTMLDivElement>(null);
  const handlePrint = useCallback(() => {
    if (!exportRef.current) return;
    window.print();
  }, []);

  // ── Derived grid data ─────────────────────────────────────────────────────────
  const displayedEntries = useMemo(() => {
    if (viewMode === 'class' || viewMode === 'compare') {
      return schedule.getEntriesForClass(resolvedClassId, activeYear, semester);
    }
    if (!selectedTeacherId) return [];
    return schedule.entries.filter((entry) =>
      scheduleEntryMatchesTeacher(
        entry,
        selectedTeacherId,
        activeYear,
        semester,
        teacherManager.teachers,
        teacherManager.scheduleTeachers,
      ),
    );
  }, [
    viewMode,
    resolvedClassId,
    selectedTeacherId,
    activeYear,
    semester,
    schedule.entries,
    teacherManager.teachers,
    teacherManager.scheduleTeachers,
  ]);

  // grid[day][period] => ScheduleEntry[]
  const grid = useMemo(() => {
    const g: Record<number, Record<number, ScheduleEntry[]>> = {};
    for (const day of SCHOOL_DAYS) {
      g[day] = {};
      for (let p = 1; p <= PERIOD_COUNT; p++) {
        g[day][p] = [];
      }
    }

    for (const entry of displayedEntries) {
      if (g[entry.day] && g[entry.day][entry.period]) {
        g[entry.day][entry.period].push(entry);
      } else if (g[entry.day]) {
        if (!g[entry.day][entry.period]) g[entry.day][entry.period] = [];
        g[entry.day][entry.period].push(entry);
      }
    }

    return g;
  }, [displayedEntries, periodTimes]);

  // ── Compare grid ──────────────────────────────────────────────────────────────
  const compareEntries = useMemo(() => {
    if (viewMode !== 'compare') return [];
    return schedule.getEntriesForClass(resolvedCompareClassId, activeYear, semester);
  }, [viewMode, resolvedCompareClassId, activeYear, semester, schedule.entries]);

  const compareGrid = useMemo(() => {
    const g: Record<number, Record<number, ScheduleEntry[]>> = {};
    for (const day of SCHOOL_DAYS) {
      g[day] = {};
      for (let p = 1; p <= PERIOD_COUNT; p++) {
        g[day][p] = [];
      }
    }
    for (const entry of compareEntries) {
      if (g[entry.day] && g[entry.day][entry.period]) {
        g[entry.day][entry.period].push(entry);
      }
    }
    return g;
  }, [compareEntries]);

  const teacherLoadSummary = useMemo(() => {
    const map: Record<string, number> = {};
    for (const entry of schedule.entries) {
      if (String(entry.year) !== String(activeYear) || Number(entry.semester) !== Number(semester)) {
        continue;
      }
      const canonicalId = resolveScheduleTeacherId(
        teacherManager.teachers,
        teacherManager.scheduleTeachers,
        entry.teacherId,
        entry.teacherName,
      ) || entry.teacherId;
      if (!canonicalId) continue;
      map[canonicalId] = (map[canonicalId] ?? 0) + 1;
    }
    return map;
  }, [
    schedule.entries,
    activeYear,
    semester,
    teacherManager.teachers,
    teacherManager.scheduleTeachers,
  ]);

  const currentTeacherLoad = teacherLoadSummary[selectedTeacherId] ?? 0;

  // ── Primary: ดึงวิชาจาก enrolledCourses ของห้องเรียน (เหมือน ClassCourseTab) ──
  // selectedClassRoom ดึงจาก schedule.classes (shared listener)
  const selectedClassRoom = schedule.classes.find(c => c.id === resolvedClassId);

  const selectedClassSubjectCatalog = useMemo(() => {
    const fromVersion = buildSubjectCatalogForClass(selectedClassRoom, curriculumVersioned.coursesByVersion);
    const fromGeneral = curriculum.subjects.map((subject) => ({
      id: String(subject.id || ''),
      code: String(subject.code || ''),
      name: String(subject.name || ''),
    }));
    return [...fromVersion, ...fromGeneral];
  }, [selectedClassRoom, curriculumVersioned.coursesByVersion, curriculum.subjects]);

  const computeTeacherSyncUpdates = useCallback(() => {
    if (!resolvedClassId || !selectedClassRoom) return [];
    return getTeacherSyncUpdates({
      classId: resolvedClassId,
      year: activeYear,
      semester,
      entries: schedule.entries,
      classRoom: selectedClassRoom,
      profiles: teacherManager.teachers,
      scheduleTeachers: teacherManager.scheduleTeachers,
      subjectCatalog: selectedClassSubjectCatalog,
    });
  }, [
    resolvedClassId,
    selectedClassRoom,
    activeYear,
    semester,
    schedule.entries,
    teacherManager.teachers,
    teacherManager.scheduleTeachers,
    selectedClassSubjectCatalog,
  ]);

  const pendingTeacherSync = useMemo(() => {
    if (viewMode !== 'class') return [];
    return computeTeacherSyncUpdates();
  }, [viewMode, computeTeacherSyncUpdates]);

  const [isSyncingTeachers, setIsSyncingTeachers] = useState(false);

  const syncTeachersFromClassManagement = useCallback(async () => {
    const updates = computeTeacherSyncUpdates();
    if (updates.length === 0) return { updated: 0 };

    setIsSyncingTeachers(true);
    try {
      await schedule.batchUpdateTeacherFields(
        updates.map((item) => ({
          id: item.entryId,
          teacherId: item.newTeacherId,
          teacherName: item.newTeacherName,
        })),
      );
      return { updated: updates.length };
    } finally {
      setIsSyncingTeachers(false);
    }
  }, [computeTeacherSyncUpdates, schedule]);

  // Ensure versioned curriculum courses are loaded for all classrooms in the schedule
  useEffect(() => {
    if (!schedule.classes.length || !curriculumVersioned.versions.length) return;

    schedule.classes.forEach((c) => {
      const classPackageId = (c as any).curriculumPackageId || (c as any).curriculumId;
      const academicYearId = (c as any).academicYearId || (c as any).academicYear || activeYear;
      const currentYearNum = Number.parseInt(String(academicYearId), 10);

      let targetVersionId: string | undefined = classPackageId;
      if (!targetVersionId) {
        const matchedVersion = curriculumVersioned.versions.find((v) =>
          Number(v.year) === currentYearNum &&
          (!v.assignedGrades?.length || v.assignedGrades.some((g) => isGradeMatch(g, c.gradeLevel))),
        );
        targetVersionId = matchedVersion?.id;
      }

      if (
        targetVersionId &&
        !curriculumVersioned.coursesByVersion[targetVersionId] &&
        !curriculumVersioned.loadingVersionIds.has(targetVersionId)
      ) {
        void curriculumVersioned.loadCoursesForVersion(targetVersionId);
      }
    });
  }, [
    activeYear,
    curriculumVersioned,
    schedule.classes,
  ]);

  const availableSubjects = useMemo(() => {
    if (viewMode === 'teacher' && !selectedTeacherId) return [];
    if (viewMode === 'class' && !selectedClassRoom) return [];

    // ── Case 1: Teacher View — Show all subjects this teacher is assigned to ──
    if (viewMode === 'teacher' && selectedTeacherId) {
      const teacherSubjects: any[] = [];
      const seen = new Set<string>();

      schedule.classes.forEach(c => {
        const enrolled = c.enrolledCourses || [];
        enrolled.forEach(ec => {
          if (enrolledCourseMatchesTeacher(
            ec.teacherId,
            selectedTeacherId,
            teacherManager.teachers,
            teacherManager.scheduleTeachers,
          )) {
            const subjectKey = `${c.id}-${ec.subjectId}`;
            if (seen.has(subjectKey)) return;
            seen.add(subjectKey);

            // Find subject details (same fallback logic)
            const allVersioned = Object.values(curriculumVersioned.coursesByVersion).flat();
            const courseDetail = allVersioned.find(v => v.id === ec.subjectId || v.courseCode === ec.subjectId);
            const genSubject = curriculum.subjects.find(s => s.id === ec.subjectId || s.code === ec.subjectId);

            teacherSubjects.push({
              id: ec.subjectId,
              code: courseDetail?.courseCode || genSubject?.code || ec.subjectId,
              name: courseDetail?.courseName || genSubject?.name || 'Unknown Subject',
              credits: courseDetail?.credit || genSubject?.credits || 0,
              hoursPerWeek: courseDetail?.periodsPerWeek || genSubject?.hoursPerWeek || 0,
              department: (courseDetail?.department || genSubject?.department || c.departmentId || c.department) as any,
              gradeLevel: courseDetail?.gradeLevel || genSubject?.gradeLevel || c.gradeLevel,
              category: (courseDetail?.category || (genSubject as any)?.category) as any,
              subjectGroup: courseDetail?.subjectGroup || genSubject?.subjectGroup,
              semester: ec.semester,
              assignedTeacherId: selectedTeacherId,
              classId: c.id, // Keep track of which class this is for
              className: c.className
            });
          }
        });
      });
      return teacherSubjects.sort((a, b) => a.className.localeCompare(b.className, 'th') || a.code.localeCompare(b.code));
    }

    // ── Case 2: Class View — Only show subjects with assigned teachers ──
    const validTeacherIds = new Set((teacherManager.scheduleTeachers || []).map(t => t.id));

    const enrolledCourses = selectedClassRoom?.enrolledCourses || [];
    const classPackageId = (selectedClassRoom as any)?.curriculumPackageId || (selectedClassRoom as any)?.curriculumId;
    const packageCourses = classPackageId ? (curriculumVersioned.coursesByVersion[classPackageId] || []) : [];

    // ดึงวิชาจากหลักสูตรที่ผูกกับห้องเรียนก่อน แล้ว match ครูจาก enrolledCourses
    if (packageCourses.length > 0) {
      const enrolledByKey = new Map<string, any>();
      enrolledCourses.forEach((ec: any) => {
        const sid = String(ec.subjectId || '').trim();
        if (sid) enrolledByKey.set(sid, ec);
      });

      const seen = new Set<string>();
      const subjects = packageCourses
        .filter((course: any) => {
          if (course.semester && Number(course.semester) !== Number(semester)) return false;
          return isGradeMatch(course.gradeLevel, selectedClassRoom?.gradeLevel);
        })
        .map((course: any) => {
          const byId = enrolledByKey.get(String(course.id || '').trim());
          const byCode = enrolledByKey.get(String(course.courseCode || '').trim());
          const enrolled = byId || byCode;
          const teacherId = enrolled?.teacherId ? String(enrolled.teacherId) : '';

          return {
            id: String(course.id || course.courseCode || ''),
            code: String(course.courseCode || ''),
            name: String(course.courseName || 'Unknown Subject'),
            credits: Number(course.credit || 0),
            hoursPerWeek: Number(course.periodsPerWeek || 0),
            totalHours: Number(course.totalHours || 0),
            department: (course.department || selectedClassRoom?.department || selectedClassRoom?.departmentId) as any,
            gradeLevel: course.gradeLevel || selectedClassRoom?.gradeLevel || '',
            category: course.category as any,
            subjectGroup: course.subjectGroup,
            semester: enrolled?.semester || course.semester,
            assignedTeacherId: teacherId || undefined,
          };
        })
        .filter((s: any) => {
          if (!s.code) return false;
          if (!s.assignedTeacherId) return false;
          if (!validTeacherIds.has(String(s.assignedTeacherId))) return false;
          const uniq = `${s.id}|${s.code}`;
          if (seen.has(uniq)) return false;
          seen.add(uniq);
          return true;
        });

      if (subjects.length > 0) {
        return subjects.sort((a, b) => (a.code || '').localeCompare(b.code || '', 'th'));
      }

      return [];
    }

    if (enrolledCourses.length > 0) {
      const allVersionedCourses = Object.values(curriculumVersioned.coursesByVersion).flat();
      const seen = new Set<string>();
      const subjects = enrolledCourses
        .filter(ec =>
          (!ec.semester || Number(ec.semester) === Number(semester))
          && !!ec.teacherId
          && validTeacherIds.has(String(ec.teacherId)),
        )
        .map(ec => {
          const courseDetail = allVersionedCourses.find(c => c.id === ec.subjectId || c.courseCode === ec.subjectId);
          const genSubject = curriculum.subjects.find(s => s.id === ec.subjectId || s.code === ec.subjectId);
          const id = String(courseDetail?.id || ec.subjectId || '');
          const code = String(courseDetail?.courseCode || genSubject?.code || '');

          return {
            id,
            code,
            name: courseDetail?.courseName || genSubject?.name || 'Unknown Subject',
            credits: courseDetail?.credit || genSubject?.credits || 0,
            hoursPerWeek: courseDetail?.periodsPerWeek || genSubject?.hoursPerWeek || 0,
            totalHours: courseDetail?.totalHours || genSubject?.totalHours || 0,
            department: (courseDetail?.department || genSubject?.department) as any,
            gradeLevel: courseDetail?.gradeLevel || genSubject?.gradeLevel || '',
            category: (courseDetail?.category || (genSubject as any)?.category) as any,
            subjectGroup: courseDetail?.subjectGroup || genSubject?.subjectGroup,
            semester: ec.semester,
            assignedTeacherId: ec.teacherId,
          };
        })
        .filter((s: any) => {
          if (!s.code) return false;
          const uniq = `${s.id}|${s.code}`;
          if (seen.has(uniq)) return false;
          seen.add(uniq);
          return true;
        });

      if (subjects.length > 0) {
        return subjects.sort((a, b) => (a.code || '').localeCompare(b.code || '', 'th'));
      }

      // ถ้ายังไม่ได้กำหนดครูผู้สอนใน enrolledCourses จะไม่แสดงรายวิชาให้เลือก
      return [];
    }

    // Only show subjects with explicitly assigned teachers from enrolledCourses
    // Don't show fallback curriculum subjects without teacher assignments
    return [];
  }, [
    viewMode,
    selectedTeacherId,
    selectedClassRoom,
    schedule.classes,
    curriculumVersioned.coursesByVersion,
    curriculum.subjects,
    teacherManager.scheduleTeachers,
    semester,
    activeYear
  ]);


  // selectedClass ยังคงใช้เพื่อ display breadcrumb / pass to child components
  const selectedClass = selectedClassRoom
    ? {
        id: selectedClassRoom.id,
        label: selectedClassRoom.className,
        gradeLevel: selectedClassRoom.gradeLevel,
        department: (selectedClassRoom.department || selectedClassRoom.departmentId) as Department,
        academicYear: selectedClassRoom.academicYearId || (selectedClassRoom as any).academicYear,
      }
    : schedule.classes.find(c => c.id === resolvedClassId);

  // ── Drag & Drop ──────────────────────────────────────────────────────────────
  const handleSubjectDrop = useCallback(async (day: SchoolDay, period: number, subjectId: string, teacherId: string, classId?: string) => {
    if (!isEditMode) return;
    if (nonTeachingPeriods.has(period)) {
      toast.error('วางวิชาที่คาบพักไม่ได้', {
        description: 'คาบนี้เป็นคาบพัก/คาบพักกลางวันของห้องนี้ ไม่สามารถผูกวิชาเข้าคาบนี้ได้',
      });
      return;
    }

    const subject = availableSubjects.find(s => {
      const idMatch = s.id === subjectId || s.code === subjectId;
      if (!idMatch) return false;
      if (classId && (s as any).classId) {
        return (s as any).classId === classId;
      }
      return true;
    });
    if (!subject) return;

    // Check if slot already has an entry (only 1 subject per slot allowed)
    const existingEntries = grid[day]?.[period] || [];
    if (existingEntries.length > 0) {
      toast.error('คาบนี้มีรายวิชาแล้ว', {
        description: 'แต่ละคาบสามารถมีได้เพียงวิชาเดียว กรุณาลบรายวิชาเดิมออกก่อน',
      });
      return;
    }

    const targetTeacherId = (subject as any).assignedTeacherId || teacherId;
    const targetClassId = (subject as any).classId || resolvedClassId;

    const resolvedTeacherId = resolveScheduleTeacherId(
      teacherManager.teachers,
      teacherManager.scheduleTeachers,
      targetTeacherId,
      (subject as any).teacherName,
    );
    const teacher = resolvedTeacherId
      ? teacherManager.scheduleTeachers.find(t => t.id === resolvedTeacherId)
      : undefined;

    if (!teacher) {
      openSlotModal(day, period, null);
      return;
    }

    if (targetClassId) {
      const newEntry = {
        classId: targetClassId,
        day,
        period,
        subjectId: subject.id,
        subjectCode: subject.code,
        subjectName: subject.name,
        subjectGroup: subject.subjectGroup,
        teacherId: resolvedTeacherId || teacher.id,
        teacherName: teacher.name,
        year: activeYear,
        semester,
      };

      const result = await schedule.addEntry(newEntry);
      if (result.hasConflict) {
        toast.error('ไม่สามารถเพิ่มได้', {
          description: result.conflicts[0]?.message,
        });
      } else {
        toast.success('บันทึกแล้ว');
      }
    }
  }, [isEditMode, nonTeachingPeriods, availableSubjects, teacherManager.scheduleTeachers, resolvedClassId, activeYear, semester, grid, openSlotModal, schedule]);

  // ── Handle Edit Mode Toggle ──────────────────────────────────────────────────
  const handleSetIsEditMode = useCallback((newValue: boolean) => {
    setIsEditMode(newValue);
    if (newValue) {
      toast.success('เข้าโหมดแก้ไข', {
        description: 'ลากรายวิชาลงในตารางเพื่อเพิ่ม หรือลบรายวิชาออก',
      });
    } else {
      toast.message('ปิดโหมดแก้ไข');
    }
  }, []);

  return {
    // Academic year
    year: activeYear,
    semester,
    setSemester,

    // View mode
    viewMode,
    setViewMode,
    isEditMode,
    setIsEditMode: handleSetIsEditMode,

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
    handleSubjectDrop,

    // Modal
    slotModal,
    openSlotModal,
    closeSlotModal,

    // Data
    allEntries: schedule.entries,
    classes: schedule.classes,
    teachers: teacherManager.scheduleTeachers,
    availableSubjects,
    teacherLoadSummary,
    currentTeacherLoad,

    // Print
    exportRef,
    handlePrint,

    // Compare mode
    compareClassId: resolvedCompareClassId,
    setCompareClassId,
    compareTeacherId,
    setCompareTeacherId,
    compareGrid,

    // Schedule actions — all write directly to Firebase immediately
    addEntry: schedule.addEntry,
    updateEntry: schedule.updateEntry,
    deleteEntry: schedule.deleteEntry,
    deleteEntriesInSlot: (day: SchoolDay, period: number, criteria: { teacherId?: string, classId?: string }) =>
      schedule.deleteEntriesInSlot(day, period, activeYear, semester, criteria),
    moveEntry: schedule.moveEntry,
    detectConflicts: schedule.detectConflicts,

    pendingTeacherSync,
    isSyncingTeachers,
    syncTeachersFromClassManagement,
  };
}
