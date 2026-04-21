import { useState, useMemo, useEffect } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useActiveAcademicYear } from '@/hooks/useActiveAcademicYear';
import { useTeacherManager } from '@/hooks/useTeacherManager';
import { useSchedule } from '@/hooks/useSchedule';
import type { ClassRoom, NewClassRoom, ClassRoomCard } from '@/types/class';
import { GRADE_LEVEL_ORDER } from '@/types/class';
import type { Department } from '@/types/curriculum';
import { DEPARTMENT_CONFIG } from '@/types/curriculum';
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

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useClassManager() {
  const { year: activeYearStr, activeSemester } = useActiveAcademicYear();
  const yearId   = activeYearStr ?? '2568';
  const semester = (activeSemester ?? 1) as 1 | 2;

  const teacherMgr = useTeacherManager();
  const schedule   = useSchedule();

  const [classes,  setClasses]  = useState<ClassRoom[]>([]);

  // ── ดึงข้อมูล Real-time จาก Firebase ──────────────────────────────────────────
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'classes'), (snap) => {
      setClasses(snap.docs.map(d => ({ id: d.id, ...d.data() } as ClassRoom)));
    });
    return () => unsub();
  }, []);

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
      createdAt: new Date().toISOString().slice(0, 10),
    };
    const docRef = await addDoc(collection(db, 'classes'), newClassData);
    return { id: docRef.id, ...newClassData } as ClassRoom;
  };

  const updateClass = async (id: string, data: Partial<Omit<ClassRoom, 'id' | 'createdAt'>>) => {
    await updateDoc(doc(db, 'classes', id), data as any);
  };

  const deleteClass = async (id: string) => {
    await deleteDoc(doc(db, 'classes', id));
  };

  // ── Derived Data ──────────────────────────────────────────────────────────────

  // กรองเฉพาะปีการศึกษา + ภาคเรียนที่ active
  const activeClasses = useMemo(() =>
    classes.filter(c => c.academicYearId === yearId && c.semester === semester),
    [classes, yearId, semester],
  );

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
    return activeClasses
      .map(cls => {
        const teacher = teacherMgr.teachers.find(t => t.id === cls.homeroomTeacherId);
        const scheduled = scheduledPeriodsMap[cls.id] ?? 0;
        return {
          classRoom: cls,
          homeroomTeacher: teacher
            ? { id: teacher.id, name: teacher.name, position: teacher.position }
            : null,
          scheduledPeriods: scheduled,
          totalPeriods: TEACHING_PERIODS_PER_WEEK,
          fillPct: Math.round(scheduled / TEACHING_PERIODS_PER_WEEK * 100),
          isFull: cls.studentCount >= cls.maxStudents,
        };
      })
      .sort((a, b) => {
        const ga = GRADE_LEVEL_ORDER[a.classRoom.gradeLevel] ?? 99;
        const gb = GRADE_LEVEL_ORDER[b.classRoom.gradeLevel] ?? 99;
        if (ga !== gb) return ga - gb;
        return a.classRoom.roomNumber.localeCompare(b.classRoom.roomNumber);
      });
  }, [activeClasses, teacherMgr.teachers, scheduledPeriodsMap]);

  // Filtered cards
  const filteredCards = useMemo(() => {
    return classCards.filter(card => {
      if (filterDept !== 'all' && card.classRoom.departmentId !== filterDept) return false;
      if (filterGrade !== 'all' && card.classRoom.gradeLevel !== filterGrade) return false;
      if (searchQ) {
        const q = searchQ.toLowerCase();
        const matchClass   = card.classRoom.className.toLowerCase().includes(q);
        const matchTeacher = card.homeroomTeacher?.name.toLowerCase().includes(q);
        if (!matchClass && !matchTeacher) return false;
      }
      return true;
    });
  }, [classCards, filterDept, filterGrade, searchQ]);

  // สถิติภาพรวม
  const summary = useMemo(() => {
    const total        = activeClasses.length;
    const totalStudents = activeClasses.reduce((sum, c) => sum + c.studentCount, 0);
    const totalCapacity = activeClasses.reduce((sum, c) => sum + c.maxStudents, 0);
    const fullClasses   = activeClasses.filter(c => c.studentCount >= c.maxStudents).length;

    const byDept = Object.fromEntries(
      (['early', 'primary', 'secondary'] as Department[]).map(dept => [
        dept,
        activeClasses.filter(c => c.departmentId === dept).length,
      ]),
    ) as Record<Department, number>;

    return { total, totalStudents, totalCapacity, fullClasses, byDept };
  }, [activeClasses]);

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
