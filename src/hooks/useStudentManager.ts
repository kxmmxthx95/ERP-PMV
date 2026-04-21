import { useState, useMemo, useEffect } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type {
  Student, NewStudent, Enrollment, NewEnrollment, StudentCard, StudentStatus,
} from '@/types/student';
import type { Department } from '@/types/curriculum';

// ── Filter State ───────────────────────────────────────────────────────────────

export interface StudentFilter {
  academicYearId: string;
  departmentId: Department | '';
  gradeLevel: string;
  classId: string;
  searchText: string;
  status: StudentStatus | '';
}

// ── Hook ───────────────────────────────────────────────────────────────────────

export function useStudentManager(defaultYear?: string) {
  const [students, setStudents] = useState<Student[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);

  const [filter, setFilter] = useState<StudentFilter>({
    academicYearId: defaultYear ?? '2568',
    departmentId: 'secondary',
    gradeLevel: '',
    classId: '',
    searchText: '',
    status: '',
  });

  // ── ดึงข้อมูล Real-time จาก Firebase ──────────────────────────────────────────
  useEffect(() => {
    const unsubStudents = onSnapshot(collection(db, 'students'), (snap) => {
      setStudents(snap.docs.map(d => ({ id: d.id, ...d.data() } as Student)));
    });
    const unsubEnrollments = onSnapshot(collection(db, 'enrollments'), (snap) => {
      setEnrollments(snap.docs.map(d => ({ id: d.id, ...d.data() } as Enrollment)));
    });
    return () => {
      unsubStudents();
      unsubEnrollments();
    };
  }, []);

  // ── CRUD — Students ──────────────────────────────────────────────────────────

  const addStudent = async (data: NewStudent): Promise<Student> => {
    const newStudentData = {
      ...data,
      createdAt: new Date().toISOString().slice(0, 10),
    };
    const docRef = await addDoc(collection(db, 'students'), newStudentData);
    return { id: docRef.id, ...newStudentData } as Student;
  };

  const updateStudent = async (id: string, data: Partial<Student>) => {
    await updateDoc(doc(db, 'students', id), data as any);
  };

  const deleteStudent = async (id: string) => {
    await deleteDoc(doc(db, 'students', id));
    
    // ลบการลงทะเบียน (Enrollments) ของนักเรียนคนนี้ออกด้วย
    const relatedEnrollments = enrollments.filter(e => e.studentId === id);
    if (relatedEnrollments.length > 0) {
      const batch = writeBatch(db);
      relatedEnrollments.forEach(e => {
        batch.delete(doc(db, 'enrollments', e.id));
      });
      await batch.commit();
    }
  };

  const toggleStudentStatus = async (id: string) => {
    const student = students.find(s => s.id === id);
    if (student) {
      await updateDoc(doc(db, 'students', id), {
        status: student.status === 'active' ? 'inactive' : 'active'
      });
    }
  };

  // ── CRUD — Enrollments ───────────────────────────────────────────────────────

  const addEnrollment = async (data: NewEnrollment): Promise<Enrollment> => {
    const existing = enrollments.find(
      e => e.studentId === data.studentId &&
           e.academicYearId === data.academicYearId &&
           e.semester === data.semester,
    );
    if (existing) {
      await updateDoc(doc(db, 'enrollments', existing.id), data as any);
      return { ...existing, ...data } as Enrollment;
    }
    const newEnrollmentData = {
      ...data,
      enrolledAt: new Date().toISOString().slice(0, 10),
    };
    const docRef = await addDoc(collection(db, 'enrollments'), newEnrollmentData);
    return { id: docRef.id, ...newEnrollmentData } as Enrollment;
  };

  const updateEnrollment = async (id: string, data: Partial<Enrollment>) => {
    await updateDoc(doc(db, 'enrollments', id), data as any);
  };

  // ── Derived — Filtered Students ───────────────────────────────────────────────

  // หา enrollment ของนักเรียนในปี/ภาคเรียนที่ filter
  const getEnrollment = (studentId: string): Enrollment | null =>
    enrollments.find(
      e => e.studentId === studentId &&
           e.academicYearId === filter.academicYearId &&
           (filter.departmentId ? e.departmentId === filter.departmentId : true),
    ) ?? null;

  const filteredStudentCards = useMemo((): StudentCard[] => {
    // เริ่มจาก enrollments ที่ match filter (academicYear + department)
    const matchingEnrollments = enrollments.filter(e => {
      if (e.academicYearId !== filter.academicYearId) return false;
      if (filter.departmentId && e.departmentId !== filter.departmentId) return false;
      if (filter.gradeLevel && e.gradeLevel !== filter.gradeLevel) return false;
      if (filter.classId && e.classId !== filter.classId) return false;
      return true;
    });

    // ดึง studentIds ที่ match
    const enrolledStudentIds = new Set(matchingEnrollments.map(e => e.studentId));

    // ถ้ามี filter ด้าน class/grade → แสดงเฉพาะนักเรียนที่ enrolled ใน class นั้น
    // ถ้าไม่มี class filter → แสดงนักเรียนทุกคนที่ enrolled ในปี/แผนกนั้น
    const baseStudents = (filter.gradeLevel || filter.classId)
      ? students.filter(s => enrolledStudentIds.has(s.id))
      : students; // แสดงทุกคน แต่ join enrollment ถ้ามี

    return baseStudents
      .filter(s => {
        if (filter.status && s.status !== filter.status) return false;
        if (filter.searchText) {
          const q = filter.searchText.toLowerCase();
          const fullName = `${s.prefix}${s.firstName} ${s.lastName}`.toLowerCase();
          if (!fullName.includes(q) && !s.studentCode.includes(q)) return false;
        }
        return true;
      })
      .map(s => {
        const enrollment = getEnrollment(s.id);
        return {
          student: s,
          enrollment,
          currentClass: enrollment?.className ?? null,
          currentGrade: enrollment?.gradeLevel ?? null,
        };
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [students, enrollments, filter]);

  // ── Derived — Available grades & classes for filter dropdowns ─────────────────

  const availableGradeLevels = useMemo((): string[] => {
    const yearEnrollments = enrollments.filter(
      e => e.academicYearId === filter.academicYearId &&
           (filter.departmentId ? e.departmentId === filter.departmentId : true),
    );
    return [...new Set(yearEnrollments.map(e => e.gradeLevel))].sort();
  }, [enrollments, filter.academicYearId, filter.departmentId]);

  const availableClasses = useMemo((): Array<{ classId: string; className: string }> => {
    const yearEnrollments = enrollments.filter(
      e => e.academicYearId === filter.academicYearId &&
           (filter.departmentId ? e.departmentId === filter.departmentId : true) &&
           (filter.gradeLevel ? e.gradeLevel === filter.gradeLevel : true),
    );
    const map = new Map<string, string>();
    for (const e of yearEnrollments) map.set(e.classId, e.className);
    return [...map.entries()].map(([classId, className]) => ({ classId, className })).sort((a, b) => a.className.localeCompare(b.className, 'th'));
  }, [enrollments, filter.academicYearId, filter.departmentId, filter.gradeLevel]);

  // ── Stats ────────────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const active  = filteredStudentCards.filter(c => c.student.status === 'active').length;
    const male    = filteredStudentCards.filter(c => c.student.gender === 'male').length;
    const female  = filteredStudentCards.filter(c => c.student.gender === 'female').length;
    return { total: filteredStudentCards.length, active, male, female };
  }, [filteredStudentCards]);

  // ── Queries ──────────────────────────────────────────────────────────────────

  const getStudentById = (id: string) => students.find(s => s.id === id) ?? null;

  const getStudentEnrollments = (studentId: string) =>
    enrollments.filter(e => e.studentId === studentId)
               .sort((a, b) => b.academicYearId.localeCompare(a.academicYearId));

  return {
    // Data
    students,
    enrollments,
    filteredStudentCards,
    stats,

    // Filter
    filter,
    setFilter,
    availableGradeLevels,
    availableClasses,

    // Student CRUD
    addStudent,
    updateStudent,
    deleteStudent,
    toggleStudentStatus,

    // Enrollment CRUD
    addEnrollment,
    updateEnrollment,

    // Queries
    getStudentById,
    getStudentEnrollments,
    getEnrollment,
  };
}
