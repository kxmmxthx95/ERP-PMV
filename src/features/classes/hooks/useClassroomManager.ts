import { useMemo, useState, useSyncExternalStore } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { sessionCache } from '@/lib/sessionCache';
import {
  getClassesByYearStore,
  getEnrollmentsByYearStore,
  type EnrollmentLike,
} from '@/lib/firestoreShared/studentSummaryStore';
import { useActiveAcademicYear } from '@/hooks/useActiveAcademicYear';
import { useTeacherManager } from '@/features/teachers/hooks/useTeacherManager';
import { useSchedule } from '@/hooks/useSchedule';
import type { ClassRoom, NewClassRoom, ClassRoomCard } from '@/types/class';
import { GRADE_LEVEL_ORDER } from '@/types/class';
import type { Department } from '@/types/curriculum';
import { DEPARTMENT_CONFIG } from '@/types/curriculum';
import { resolveHomeroomTeacherIds } from '@/features/classes/utils/homeroomTeachers';
import { PERIOD_COUNT, LUNCH_PERIOD } from '@/types/schedule';

// ── Subject Group Types ───────────────────────────────────────────────────────
export type SubjectGroupId =
  | 'thai'          // ภาษาไทย
  | 'math'          // คณิตศาสตร์
  | 'science'       // วิทยาศาสตร์และเทคโนโลยี
  | 'social'        // สังคมศึกษา สาสนา และวัฒนธรรม
  | 'health'        // สุขศึกษาและพลศึกษา
  | 'arts'          // ศิลปะ
  | 'career'        // การงานอาชีพ
  | 'language'      // ภาษาต่างประเทศ
  | 'IS'            // การศึกษาคันควัตด้วยตนเอง (IS)
  | 'none';         // ไม่มีกลุ่มสาระการเรียนรู้

export interface SubjectGroup {
  id: SubjectGroupId;
  name: string;
  thaiName: string;
  color?: string;
}

// ── Subject Group Config ──────────────────────────────────────────────────────
export const SUBJECT_GROUP_CONFIG: Record<SubjectGroupId, SubjectGroup> = {
  thai: {
    id: 'thai',
    name: 'Thai Language',
    thaiName: 'กลุ่มวิชาภาษาไทย',
  },
  math: {
    id: 'math',
    name: 'Mathematics',
    thaiName: 'กลุ่มวิชาคณิตศาสตร์',
  },
  science: {
    id: 'science',
    name: 'Science and Technology',
    thaiName: 'กลุ่มวิชาวิทยาศาสตร์และเทคโนโลยี',
  },
  social: {
    id: 'social',
    name: 'Social Studies, Religion, and Culture',
    thaiName: 'กลุ่มวิชาสังคมศึกษา สาสนา และวัฒนธรรม',
  },
  health: {
    id: 'health',
    name: 'Health and Physical Education',
    thaiName: 'กลุ่มวิชาสุขศึกษาและพลศึกษา',
  },
  arts: {
    id: 'arts',
    name: 'Arts',
    thaiName: 'กลุ่มวิชาศิลปะ',
  },
  career: {
    id: 'career',
    name: 'Career and Technology',
    thaiName: 'กลุ่มวิชาการงานอาชีพ',
  },
  language: {
    id: 'language',
    name: 'Foreign Language',
    thaiName: 'กลุ่มวิชาภาษาต่างประเทศ',
  },
  IS: {
    id: 'IS',
    name: 'Self-directed Learning (IS)',
    thaiName: 'การศึกษาคันควัตด้วยตนเอง (IS)',
  },
  none: {
    id: 'none',
    name: 'No Subject Group',
    thaiName: 'ไม่มีกลุ่มสาระการเรียนรู้',
  },
};

export const SUBJECT_GROUPS = Object.values(SUBJECT_GROUP_CONFIG);

// ── Constants ─────────────────────────────────────────────────────────────────

// คาบสอนจริงต่อวัน (ไม่นับคาบพัก) × 5 วัน
const TEACHING_PERIODS_PER_WEEK = (PERIOD_COUNT - 1) * 5; // 8 × 5 = 40 คาบ
void LUNCH_PERIOD; // used in calculation above
const CACHE_CLASSROOMS = 'cache:classroom-manager:classes';

function computeEnrollmentCounts(
  enrollmentDocs: EnrollmentLike[],
  classes: ClassRoom[],
  yearId: string,
  semester: 1 | 2,
): Record<string, number> {
  const normalizeText = (value: unknown) => String(value ?? '').trim();
  const getClassNameFromParts = (grade: unknown, room: unknown) => {
    const g = normalizeText(grade);
    const r = normalizeText(room);
    return g && r ? `${g}/${r}` : '';
  };

  const map: Record<string, number> = {};
  const candidateClasses = classes.filter((c) => {
    const sameYear =
      String(c.academicYearId ?? '') === String(yearId) ||
      String((c as { academicYear?: string }).academicYear ?? '') === String(yearId);
    const sameSemester = Number(c.semester ?? 0) === Number(semester) || !c.semester;
    return sameYear && sameSemester;
  });
  const classesInScope = candidateClasses.length > 0 ? candidateClasses : classes;
  const classById = new Map(classesInScope.map((c) => [String(c.id), c] as const));

  const classStudentIdSets = new Map<string, Set<string>>();
  const ensureSet = (classId: string) => {
    if (!classStudentIdSets.has(classId)) classStudentIdSets.set(classId, new Set<string>());
    return classStudentIdSets.get(classId)!;
  };

  enrollmentDocs.forEach((data) => {
    const sameYear =
      String(data.academicYearId ?? '') === String(yearId) ||
      String(data.academicYear ?? '') === String(yearId);
    const isStudying = (data.status ?? 'studying') === 'studying';
    if (!sameYear || !isStudying) return;

    const enrollmentClassId = normalizeText(data.classId ?? data.classroomId ?? data.roomId);
    let resolvedClassId = '';

    if (enrollmentClassId && classById.has(enrollmentClassId)) {
      resolvedClassId = enrollmentClassId;
    }

    if (!resolvedClassId) {
      const enrollmentClassName = normalizeText(data.className);
      const enrollmentComposedName = getClassNameFromParts(data.gradeLevel, data.roomNumber ?? data.roomNo);

      const matched = classesInScope.find((cls) => {
        const clsClassName = normalizeText(cls.className);
        if (enrollmentClassName && clsClassName && enrollmentClassName === clsClassName) return true;
        if (enrollmentComposedName && clsClassName && enrollmentComposedName === clsClassName) return true;

        const enrollmentGrade = normalizeText(data.gradeLevel);
        const clsGrade = normalizeText(cls.gradeLevel);
        const enrollmentRoom = normalizeText(data.roomNumber ?? data.roomNo);
        const clsRoom = normalizeText(cls.roomNumber);
        return !!(enrollmentGrade && clsGrade && enrollmentRoom && clsRoom && enrollmentGrade === clsGrade && enrollmentRoom === clsRoom);
      });

      if (matched?.id) resolvedClassId = String(matched.id);
    }

    if (!resolvedClassId) return;
    const studentId = normalizeText(data.studentId);
    if (!studentId) return;
    ensureSet(resolvedClassId).add(studentId);
  });

  classesInScope.forEach((cls) => {
    const classId = String(cls.id);
    const set = ensureSet(classId);
    const classStudentIds = Array.isArray((cls as { studentIds?: unknown[] }).studentIds)
      ? (cls as { studentIds?: unknown[] }).studentIds!
      : [];
    classStudentIds.forEach((id) => {
      const sid = normalizeText(id);
      if (sid) set.add(sid);
    });
    map[classId] = set.size;
  });

  return map;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useClassroomManager() {
  const { year: activeYearStr, activeSemester } = useActiveAcademicYear();
  const yearId   = activeYearStr ?? '2568';
  const semester = (activeSemester ?? 1) as 1 | 2;

  const teacherMgr = useTeacherManager();
  const schedule   = useSchedule();

  const classesStore = getClassesByYearStore(yearId);
  const enrollmentsStore = getEnrollmentsByYearStore(yearId);

  const rawClasses = useSyncExternalStore(
    classesStore.subscribe,
    classesStore.getSnapshot,
    classesStore.getSnapshot,
  );
  const classes = useMemo(
    () => rawClasses.map((d) => ({ id: d.id, ...(d as Record<string, unknown>) } as ClassRoom)),
    [rawClasses],
  );
  const enrollmentRows = useSyncExternalStore(
    enrollmentsStore.subscribe,
    enrollmentsStore.getSnapshot,
    enrollmentsStore.getSnapshot,
  );
  const enrollmentCounts = useMemo(
    () => computeEnrollmentCounts(enrollmentRows, classes, yearId, semester),
    [enrollmentRows, classes, yearId, semester],
  );

  // ── Filters ───────────────────────────────────────────────────────────────────
  const [filterDept,  setFilterDeptRaw]  = useState<Department | 'all'>('all');
  const [filterGrade, setFilterGradeRaw] = useState<string>('all');
  const [searchQ,     setSearchQ]     = useState('');

  // Auto-reset logic: when dept changes, reset grade
  const setFilterDept = (dept: Department | 'all') => {
    setFilterDeptRaw(dept);
    setFilterGradeRaw('all');
  };

  // Auto-reset logic: when grade changes, validate it against current dept
  const setFilterGrade = (grade: string) => {
    setFilterGradeRaw(grade);
  };

  // ── CRUD ──────────────────────────────────────────────────────────────────────

  const addClass = async (data: NewClassRoom): Promise<ClassRoom> => {
    const newClassData = {
      ...data,
      className: `${data.gradeLevel}/${data.roomNumber}`,
      // ── Alias fields for Firestore consistency ──
      academicYear: data.academicYearId,
      capacity: data.maxStudents,
      department: data.departmentId,
      homeroomTeacherIds: data.homeroomTeacherIds ?? (data.homeroomTeacherId ? [data.homeroomTeacherId] : []),
      enrolledCourses: data.enrolledCourses ?? [],
      createdAt: new Date().toISOString().slice(0, 10),
    };
    const docRef = await addDoc(collection(db, 'classes'), newClassData);
    sessionCache.invalidate(CACHE_CLASSROOMS);
    return { id: docRef.id, ...newClassData } as ClassRoom;
  };

  const updateClass = async (id: string, data: Partial<Omit<ClassRoom, 'id' | 'createdAt'>>) => {
    const updateData = { ...data };
    
    // Sync alias fields if their primary fields are being updated
    if (data.academicYearId) (updateData as any).academicYear = data.academicYearId;
    if (data.maxStudents !== undefined) (updateData as any).capacity = data.maxStudents;
    if (data.departmentId) (updateData as any).department = data.departmentId;

    if (data.homeroomTeacherIds !== undefined || data.homeroomTeacherId !== undefined) {
      const cls = classes.find((c) => c.id === id);
      const normalizedIds = resolveHomeroomTeacherIds(
        {
          homeroomTeacherId: data.homeroomTeacherId ?? cls?.homeroomTeacherId ?? '',
          homeroomTeacherIds: data.homeroomTeacherIds ?? cls?.homeroomTeacherIds ?? [],
        },
        teacherMgr.teachers,
      );
      updateData.homeroomTeacherIds = normalizedIds;
      updateData.homeroomTeacherId = normalizedIds[0] ?? '';
    }

    await updateDoc(doc(db, 'classes', id), updateData as any);
    sessionCache.invalidate(CACHE_CLASSROOMS);
  };

  const deleteClass = async (id: string) => {
    await deleteDoc(doc(db, 'classes', id));
    sessionCache.invalidate(CACHE_CLASSROOMS);
  };

  // ── Derived Data ──────────────────────────────────────────────────────────────

  // กรองเฉพาะปีการศึกษา + ภาคเรียนที่ active (ยืดหยุ่นขึ้น)
  const activeClasses = useMemo(() => {
    if (classes.length === 0) return [];
    
    // ลองกรองตามปี/เทอมก่อน
    const filtered = classes.filter(c => 
      (String(c.academicYearId) === String(yearId) || String((c as any).academicYear) === String(yearId)) && 
      (Number(c.semester) === Number(semester) || !c.semester)
    );

    // ถ้าไม่เจอเลยในระบบกรอง ให้แสดงทั้งหมดที่มีไปก่อนเพื่อไม่ให้หน้าว่าง (ป้องกันความสับสน)
    if (filtered.length === 0 && classes.length > 0) {
      return classes;
    }

    return filtered.sort((a, b) => {
      const orderA = GRADE_LEVEL_ORDER[a.gradeLevel] || 999;
      const orderB = GRADE_LEVEL_ORDER[b.gradeLevel] || 999;
      if (orderA !== orderB) return orderA - orderB;
      return a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true });
    });
  }, [classes, yearId, semester]);

  // จำนวนคาบที่จัดแล้วในตาราง ต่อห้อง
  const scheduledPeriodsMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const cls of activeClasses) {
      const entries = schedule.getEntriesForClass(cls.id, yearId, semester);
      map[cls.id] = entries.length;
    }
    return map;
  }, [activeClasses, schedule.entries, yearId, semester]);

  // ClassRoomCard (join กับ teacher + schedule)
  const classCards = useMemo((): ClassRoomCard[] => {
    if (!activeClasses || activeClasses.length === 0) return [];
    
    const cards = activeClasses.map(cls => {
      const teacherIds = resolveHomeroomTeacherIds(cls, teacherMgr.teachers);

      const resolvedTeachers = teacherIds
        .map((id) => teacherMgr.teachers.find((t) => t.id === id))
        .filter((t): t is NonNullable<typeof t> => !!t);

      const homeroomTeachers = resolvedTeachers.map((t) => ({
        id: t.id,
        name: t.name,
        position: t.position,
        photoURL: t.photoURL,
      }));

      const scheduled = (scheduledPeriodsMap && cls.id) ? (scheduledPeriodsMap[cls.id] ?? 0) : 0;
      
      const effectiveStudentCount = enrollmentCounts[cls.id] ?? cls.studentCount ?? 0;

      return {
        classRoom: {
          ...cls,
          studentCount: effectiveStudentCount,
        },
        homeroomTeacher: homeroomTeachers[0] ?? null,
        homeroomTeachers,
        scheduledPeriods: scheduled,
        totalPeriods: TEACHING_PERIODS_PER_WEEK,
        fillPct: Math.round((scheduled / TEACHING_PERIODS_PER_WEEK) * 100),
        isFull: effectiveStudentCount >= (cls.maxStudents || 40),
      };
    });

    return cards.sort((a, b) => {
      const ga = GRADE_LEVEL_ORDER[a.classRoom.gradeLevel] ?? 99;
      const gb = GRADE_LEVEL_ORDER[b.classRoom.gradeLevel] ?? 99;
      if (ga !== gb) return ga - gb;
      return String(a.classRoom.roomNumber || '').localeCompare(String(b.classRoom.roomNumber || ''));
    });
  }, [activeClasses, teacherMgr.teachers, scheduledPeriodsMap, enrollmentCounts]);

  // Filtered cards
  const filteredCards = useMemo(() => {
    return classCards.filter(card => {
      // 1. Department Filter (Robust mapping + Inference)
      if (filterDept !== 'all') {
        let cDept = card.classRoom.departmentId;
        
        // Inference if departmentId is missing
        if (!cDept) {
          const gl = card.classRoom.gradeLevel || '';
          if (gl.startsWith('ม')) cDept = 'secondary';
          else if (gl.startsWith('ป')) cDept = 'primary';
          else if (gl.startsWith('อ')) cDept = 'early';
        }

        const targetDept = filterDept;
        
        // Match both 'early' and 'early-childhood'
        const isEarlyMatch = (String(targetDept) === 'early' || String(targetDept) === 'early-childhood') && 
                            (String(cDept) === 'early' || String(cDept) === 'early-childhood');
        
        if (!isEarlyMatch && cDept !== targetDept) return false;
      }

      // 2. Grade Filter (Trimmed comparison)
      if (filterGrade !== 'all') {
        const cGrade = (card.classRoom.gradeLevel || '').trim();
        const fGrade = filterGrade.trim();
        if (cGrade !== fGrade) return false;
      }

      // 3. Search Filter
      if (searchQ) {
        const q = searchQ.toLowerCase().trim();
        const className = (card.classRoom.className || '').toLowerCase();
        const teacherName = card.homeroomTeachers
          .map((t) => t.name)
          .join(' ')
          .toLowerCase();
        if (!className.includes(q) && !teacherName.includes(q)) return false;
      }

      return true;
    });
  }, [classCards, filterDept, filterGrade, searchQ]);

  // สถิติภาพรวม
  const summary = useMemo(() => {
    const total        = activeClasses.length;
    const totalStudents = activeClasses.reduce((sum, c) => sum + (enrollmentCounts[c.id] ?? c.studentCount ?? 0), 0);
    const totalCapacity = activeClasses.reduce((sum, c) => sum + c.maxStudents, 0);
    const fullClasses   = activeClasses.filter(c => (enrollmentCounts[c.id] ?? c.studentCount ?? 0) >= c.maxStudents).length;

    const byDept = Object.fromEntries(
      (['early', 'primary', 'secondary'] as Department[]).map(dept => [
        dept,
        activeClasses.filter(c => c.departmentId === dept).length,
      ]),
    ) as Record<Department, number>;

    return { total, totalStudents, totalCapacity, fullClasses, byDept };
  }, [activeClasses, enrollmentCounts]);

  // Grade levels ที่มีในปีนี้ (สำหรับ filter dropdown)
  const availableGrades = useMemo(() => {
    const grades = [...new Set(activeClasses.map(c => c.gradeLevel))];
    return grades.sort((a, b) => (GRADE_LEVEL_ORDER[a] ?? 99) - (GRADE_LEVEL_ORDER[b] ?? 99));
  }, [activeClasses]);

  // ครูทั้งหมดสำหรับ dropdown ใน modal
  const availableTeachers = useMemo(
    () => teacherMgr.teachers.filter(t => t.status === 'active'),
    [teacherMgr.teachers],
  );

  // Department summary
  const deptSummary = useMemo(() =>
    (['early', 'primary', 'secondary'] as Department[]).map(dept => ({
      dept,
      cfg: DEPARTMENT_CONFIG[dept],
      count: summary.byDept[dept] ?? 0,
    })),
    [summary],
  );

  return {
    // Academic context
    yearId,
    semester,

    // Data
    classes: activeClasses,
    allClasses: classes, // ส่งห้องเรียนทั้งหมดออกไปด้วย (ไมผ่านการ Filter)
    classCards,
    filteredCards,
    summary,
    deptSummary,
    availableGrades,
    availableTeachers,

    // Filters
    filterDept,
    setFilterDept,
    filterGrade,
    setFilterGrade,
    searchQ,
    setSearchQ,

    // CRUD
    addClass,
    updateClass,
    deleteClass,
  };
}
