import { useState, useMemo, useEffect } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { TeacherProfile, NewTeacherProfile, TeacherLoadInfo } from '@/types/teacher';
import { useCurriculum } from '@/hooks/useCurriculum';

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useTeacherManager() {
  const [teachers, setTeachers] = useState<TeacherProfile[]>([]);
  const curriculum = useCurriculum();

  // ── ดึงข้อมูล Real-time จาก Firebase ──────────────────────────────────────────
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'teachers'), (snap) => {
      setTeachers(snap.docs.map(d => ({ id: d.id, ...d.data() } as TeacherProfile)));
    });
    return () => unsub();
  }, []);

  // ── CRUD ──────────────────────────────────────────────────────────────────────

  const addTeacher = async (data: NewTeacherProfile): Promise<TeacherProfile> => {
    const newTeacherData = {
      ...data,
      teachingSubjectIds: data.teachingSubjectIds || [],
      createdAt: new Date().toISOString().slice(0, 10),
    };
    const docRef = await addDoc(collection(db, 'teachers'), newTeacherData);
    return { id: docRef.id, ...newTeacherData } as TeacherProfile;
  };

  const updateTeacher = async (id: string, data: Partial<TeacherProfile>) => {
    await updateDoc(doc(db, 'teachers', id), data as any);
  };

  const deleteTeacher = async (id: string) => {
    await deleteDoc(doc(db, 'teachers', id));
  };

  const toggleTeacherStatus = async (id: string) => {
    const teacher = teachers.find(t => t.id === id);
    if (teacher) {
      await updateDoc(doc(db, 'teachers', id), {
        status: teacher.status === 'active' ? 'inactive' : 'active'
      });
    }
  };

  // ── Subject Assignment ────────────────────────────────────────────────────────

  const assignSubject = async (teacherId: string, subjectId: string) => {
    const teacher = teachers.find(t => t.id === teacherId);
    if (!teacher || teacher.teachingSubjectIds.includes(subjectId)) return;
    await updateDoc(doc(db, 'teachers', teacherId), {
      teachingSubjectIds: [...teacher.teachingSubjectIds, subjectId]
    });
  };

  const unassignSubject = async (teacherId: string, subjectId: string) => {
    const teacher = teachers.find(t => t.id === teacherId);
    if (!teacher || !teacher.teachingSubjectIds.includes(subjectId)) return;
    await updateDoc(doc(db, 'teachers', teacherId), {
      teachingSubjectIds: teacher.teachingSubjectIds.filter(id => id !== subjectId)
    });
  };

  const toggleSubjectAssignment = async (teacherId: string, subjectId: string) => {
    const teacher = teachers.find(t => t.id === teacherId);
    if (!teacher) return;
    if (teacher.teachingSubjectIds.includes(subjectId)) {
      await unassignSubject(teacherId, subjectId);
    } else {
      await assignSubject(teacherId, subjectId);
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
