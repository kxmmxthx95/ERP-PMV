import { useState, useMemo } from 'react';
import type { TeacherProfile, NewTeacherProfile, TeacherLoadInfo } from '@/types/teacher';
import { useCurriculum } from '@/hooks/useCurriculum';

// ── Seed Data ─────────────────────────────────────────────────────────────────
// สอดคล้องกับ SEED_TEACHERS ใน useSchedule.ts (id เดียวกัน)

const SEED_TEACHERS: TeacherProfile[] = [
  {
    id: 't01',
    name: 'ครูสมใจ ใจดี',
    nameEn: 'Somjai Jaidee',
    employeeCode: 'T001',
    email: 'somjai@school.ac.th',
    phone: '081-000-0001',
    department: 'primary',
    position: 'ครูชำนาญการ',
    teachingSubjectIds: ['s10', 's30', 's13', 's36'], // ภาษาไทย (ประถม+มัธยม), สังคมฯ
    maxHoursPerWeek: 18,
    status: 'active',
    createdAt: '2024-05-01',
  },
  {
    id: 't02',
    name: 'ครูวิไล รักเรียน',
    nameEn: 'Wilai Raklian',
    employeeCode: 'T002',
    email: 'wilai@school.ac.th',
    phone: '081-000-0002',
    department: 'primary',
    position: 'ครูชำนาญการพิเศษ',
    teachingSubjectIds: ['s13', 's36', 's40', 's17'], // สังคมฯ, ศิลปะ
    maxHoursPerWeek: 20,
    status: 'active',
    createdAt: '2024-05-01',
  },
  {
    id: 't03',
    name: 'ครูประเสริฐ มั่นคง',
    nameEn: 'Prasert Mankhong',
    employeeCode: 'T003',
    email: 'prasert@school.ac.th',
    phone: '081-000-0003',
    department: 'secondary',
    position: 'ครูชำนาญการพิเศษ',
    teachingSubjectIds: ['s31', 's42', 's11', 's33', 's34'], // คณิตฯ, ฟิสิกส์, เคมี
    maxHoursPerWeek: 20,
    status: 'active',
    createdAt: '2024-05-01',
  },
  {
    id: 't04',
    name: 'ครูนภา สดใส',
    nameEn: 'Napa Sodsai',
    employeeCode: 'T004',
    email: 'napa@school.ac.th',
    phone: '081-000-0004',
    department: 'secondary',
    position: 'ครูชำนาญการ',
    teachingSubjectIds: ['s32', 's35', 's12', 's44', 's48'], // วิทย์, ชีววิทยา, วิทยาการคำนวณ
    maxHoursPerWeek: 18,
    status: 'active',
    createdAt: '2024-05-01',
  },
  {
    id: 't05',
    name: 'ครูอรุณ แจ่มใส',
    nameEn: 'Arun Jaemsai',
    employeeCode: 'T005',
    email: 'arun@school.ac.th',
    phone: '081-000-0005',
    department: 'early',
    position: 'ครู',
    teachingSubjectIds: ['s01', 's02', 's03', 's04', 's05'], // ปฐมวัย ทุกวิชา
    maxHoursPerWeek: 22,
    status: 'active',
    createdAt: '2024-05-01',
  },
  {
    id: 't06',
    name: 'ครูปิยะ ศรีสุข',
    nameEn: 'Piya Srisuk',
    employeeCode: 'T006',
    email: 'piya@school.ac.th',
    phone: '081-000-0006',
    department: 'secondary',
    position: 'ครูชำนาญการ',
    teachingSubjectIds: ['s38', 's43', 's15', 's45', 's46'], // ภาษาอังกฤษ, ญี่ปุ่น, จีน
    maxHoursPerWeek: 18,
    status: 'active',
    createdAt: '2024-05-01',
  },
  {
    id: 't07',
    name: 'ครูเมธี ฉลาดเฉลียว',
    nameEn: 'Methi Chaladchaliao',
    employeeCode: 'T007',
    email: 'methi@school.ac.th',
    phone: '081-000-0007',
    department: 'primary',
    position: 'ครู',
    teachingSubjectIds: ['s18', 's41', 's19', 's44', 's22'], // การงานอาชีพ, คอมฯ
    maxHoursPerWeek: 20,
    status: 'active',
    createdAt: '2024-05-01',
  },
];

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useTeacherManager() {
  const [teachers, setTeachers] = useState<TeacherProfile[]>(SEED_TEACHERS);
  const curriculum = useCurriculum();

  // ── CRUD ──────────────────────────────────────────────────────────────────────

  const addTeacher = (data: NewTeacherProfile) => {
    const newTeacher: TeacherProfile = {
      ...data,
      id: `t-${Date.now()}`,
      createdAt: new Date().toISOString().slice(0, 10),
    };
    setTeachers(prev => [...prev, newTeacher]);
    return newTeacher;
  };

  const updateTeacher = (id: string, data: NewTeacherProfile) => {
    setTeachers(prev => prev.map(t => t.id === id ? { ...data, id, createdAt: t.createdAt } : t));
  };

  const deleteTeacher = (id: string) => {
    setTeachers(prev => prev.filter(t => t.id !== id));
  };

  const toggleTeacherStatus = (id: string) => {
    setTeachers(prev => prev.map(t =>
      t.id === id ? { ...t, status: t.status === 'active' ? 'inactive' : 'active' } : t,
    ));
  };

  // ── Subject Assignment ────────────────────────────────────────────────────────

  const assignSubject = (teacherId: string, subjectId: string) => {
    setTeachers(prev => prev.map(t => {
      if (t.id !== teacherId) return t;
      if (t.teachingSubjectIds.includes(subjectId)) return t;
      return { ...t, teachingSubjectIds: [...t.teachingSubjectIds, subjectId] };
    }));
  };

  const unassignSubject = (teacherId: string, subjectId: string) => {
    setTeachers(prev => prev.map(t => {
      if (t.id !== teacherId) return t;
      return { ...t, teachingSubjectIds: t.teachingSubjectIds.filter(id => id !== subjectId) };
    }));
  };

  const toggleSubjectAssignment = (teacherId: string, subjectId: string) => {
    const teacher = teachers.find(t => t.id === teacherId);
    if (!teacher) return;
    if (teacher.teachingSubjectIds.includes(subjectId)) {
      unassignSubject(teacherId, subjectId);
    } else {
      assignSubject(teacherId, subjectId);
    }
  };

  // ── Derived Queries ───────────────────────────────────────────────────────────

  // ดึงวิชาของครู (full Subject objects)
  const getTeacherSubjects = (teacherId: string) => {
    const teacher = teachers.find(t => t.id === teacherId);
    if (!teacher) return [];
    return curriculum.subjects.filter(s => teacher.teachingSubjectIds.includes(s.id));
  };

  // ดึงครูที่สอนวิชานั้น (ใช้ใน ScheduleSlotModal เพื่อ filter ครู)
  const getTeachersForSubject = (subjectId: string) =>
    teachers.filter(t => t.teachingSubjectIds.includes(subjectId) && t.status === 'active');

  // รายชื่อครูตามระดับ
  const teachersByDepartment = useMemo(() => {
    const map: Record<string, TeacherProfile[]> = { early: [], primary: [], secondary: [] };
    for (const t of teachers) {
      if (map[t.department]) map[t.department].push(t);
    }
    return map;
  }, [teachers]);

  // แปลง TeacherProfile → Teacher (schedule format) สำหรับส่งไปยัง schedule hooks
  const scheduleTeachers = useMemo(() =>
    teachers
      .filter(t => t.status === 'active')
      .map(t => ({
        id: t.id,
        name: t.name,
        nameEn: t.nameEn,
        department: t.department,
        teachingSubjectIds: t.teachingSubjectIds,
        maxHoursPerWeek: t.maxHoursPerWeek,
      })),
    [teachers],
  );

  // คำนวณ Teaching Load (ต้องรับ teacherLoadSummary จาก useSchedule มาเพิ่ม)
  const getTeacherLoadInfo = (
    teacherId: string,
    teacherLoadSummary: Record<string, number>,
  ): TeacherLoadInfo => {
    const teacher = teachers.find(t => t.id === teacherId);
    const currentHours = teacherLoadSummary[teacherId] ?? 0;
    const maxHours = teacher?.maxHoursPerWeek ?? 20;
    return {
      teacherId,
      currentHours,
      maxHours,
      isOverloaded: currentHours > maxHours,
      utilizationPct: Math.round((currentHours / maxHours) * 100),
    };
  };

  // สรุป overloaded teachers
  const overloadedTeachers = useMemo(() =>
    teachers.filter(t => t.status === 'active' && t.teachingSubjectIds.length === 0),
    [teachers],
  );

  return {
    teachers,
    teachersByDepartment,
    scheduleTeachers,
    overloadedTeachers,

    // CRUD
    addTeacher,
    updateTeacher,
    deleteTeacher,
    toggleTeacherStatus,

    // Subject assignment
    assignSubject,
    unassignSubject,
    toggleSubjectAssignment,

    // Queries
    getTeacherSubjects,
    getTeachersForSubject,
    getTeacherLoadInfo,

    // All subjects (for assignment UI)
    allSubjects: curriculum.subjects,
    subjectsByDepartment: curriculum.subjectsByDepartment,
  };
}
