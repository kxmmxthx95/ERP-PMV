import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc, writeBatch, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type {
  Student, NewStudent, Enrollment, NewEnrollment, StudentCard, StudentStatus,
} from '@/types/student';


// ── Filter State ───────────────────────────────────────────────────────────────

export interface StudentFilter {
  academicYearId: string;
  department: string;
  gradeLevel: string;
  classId: string;
  searchText: string;
  status: StudentStatus | '';
}

const GRADE_ORDER: Record<string, string[]> = {
  early: ['อ.1', 'อ.2', 'อ.3'],
  primary: ['ป.1', 'ป.2', 'ป.3', 'ป.4', 'ป.5', 'ป.6'],
  secondary: ['ม.1', 'ม.2', 'ม.3', 'ม.4', 'ม.5', 'ม.6'],
};

// ── Hook ───────────────────────────────────────────────────────────────────────

export function useStudentManager(defaultYear?: string) {
  const [students, setStudents] = useState<Student[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [classrooms, setClassrooms] = useState<any[]>([]);

  const [filter, setFilter] = useState<StudentFilter>({
    academicYearId: defaultYear ?? '2568',
    department: '',
    gradeLevel: '',
    classId: '',
    searchText: '',
    status: '',
  });

  const dataLoadedRef = useRef(false);

  // อัปเดตปีการศึกษาเมื่อ defaultYear (จากระบบ) เปลี่ยนแปลง
  useEffect(() => {
    if (defaultYear) {
      setFilter(prev => ({ ...prev, academicYearId: defaultYear }));
    }
  }, [defaultYear]);

  // ── Load data on-demand with academicYearId filter ──────────────────────────────
  const loadData = useCallback(async (academicYearId: string) => {
    if (dataLoadedRef.current) return;

    try {
      // Load enrollments filtered by academicYearId
      const enrollmentsQuery = query(
        collection(db, 'enrollments'),
        where('academicYearId', '==', academicYearId)
      );
      const enrollmentsSnap = await getDocs(enrollmentsQuery);
      const enrollmentsData = enrollmentsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Enrollment));
      setEnrollments(enrollmentsData);

      // Load classes filtered by academicYearId
      const classesQuery = query(
        collection(db, 'classes'),
        where('academicYearId', '==', academicYearId)
      );
      const classesSnap = await getDocs(classesQuery);
      const classesData = classesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setClassrooms(classesData);

      // Load all students (no filter needed — used for enrollment lookup)
      const studentsSnap = await getDocs(collection(db, 'students'));
      const studentsData = studentsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Student));
      setStudents(studentsData);

      dataLoadedRef.current = true;
    } catch (err) {
      console.error('[useStudentManager] Error loading data:', err);
    }
  }, []);

  // Load data when academicYearId changes
  useEffect(() => {
    dataLoadedRef.current = false;
    loadData(filter.academicYearId);
  }, [filter.academicYearId, loadData]);

  // ── CRUD — Students ──────────────────────────────────────────────────────────

  const addStudent = useCallback(async (data: NewStudent): Promise<Student> => {
    const newStudentData = {
      ...data,
      createdAt: new Date().toISOString().slice(0, 10),
    };
    const docRef = await addDoc(collection(db, 'students'), newStudentData);
    const newStudent = { id: docRef.id, ...newStudentData } as Student;
    setStudents(prev => [...prev, newStudent]);
    return newStudent;
  }, []);

  const updateStudent = useCallback(async (id: string, data: Partial<Student>) => {
    // 1. Update students collection
    await updateDoc(doc(db, 'students', id), data as any);

    // 2. Update local state for instant UI feedback
    setStudents(prev =>
      prev.map(s => s.id === id ? { ...s, ...data } : s)
    );

    // 3. Sync core fields to users collection for identity consistency
    const userUpdate: any = {};
    if (data.firstName !== undefined) userUpdate.firstName = data.firstName;
    if (data.lastName !== undefined) userUpdate.lastName = data.lastName;
    if (data.prefix !== undefined) userUpdate.prefix = data.prefix;
    if (data.email !== undefined) userUpdate.email = data.email;
    if (data.phone !== undefined) userUpdate.phone = data.phone;
    if (data.photoURL !== undefined) userUpdate.photoURL = data.photoURL;
    if (data.studentCode !== undefined) userUpdate.studentCode = data.studentCode;

    if (data.prefix || data.firstName || data.lastName) {
      const s = students.find(item => item.id === id);
      const p = data.prefix ?? s?.prefix ?? '';
      const f = data.firstName ?? s?.firstName ?? '';
      const l = data.lastName ?? s?.lastName ?? '';
      userUpdate.name = `${p}${f} ${l}`;
    }

    if (Object.keys(userUpdate).length > 0) {
      try {
        await updateDoc(doc(db, 'users', id), userUpdate);
      } catch (err) {
        const s = students.find(item => item.id === id);
        const sCode = data.studentCode ?? s?.studentCode;
        if (sCode) {
          const q = query(collection(db, 'users'), where('studentCode', '==', sCode));
          const querySnap = await getDocs(q);
          if (!querySnap.empty) {
            await updateDoc(doc(db, 'users', querySnap.docs[0].id), userUpdate);
          }
        }
      }
    }
  }, [students]);

  const deleteStudent = useCallback(async (id: string) => {
    const student = students.find(s => s.id === id);
    if (student) {
      const authUid = (student as any).userId || (student as any).uid || id;
      try {
        await deleteDoc(doc(db, 'users', authUid));
      } catch (err) {
        console.warn("Could not delete associated user record:", err);
      }
    }

    await deleteDoc(doc(db, 'students', id));
    setStudents(prev => prev.filter(s => s.id !== id));

    const relatedEnrollments = enrollments.filter(e => e.studentId === id);
    if (relatedEnrollments.length > 0) {
      const batch = writeBatch(db);
      relatedEnrollments.forEach(e => {
        batch.delete(doc(db, 'enrollments', e.id));
      });
      await batch.commit();
      setEnrollments(prev => prev.filter(e => e.studentId !== id));
    }
  }, [students, enrollments]);

  const toggleStudentStatus = useCallback(async (id: string) => {
    const student = students.find(s => s.id === id);
    if (student) {
      const newStatus = student.status === 'active' ? 'inactive' : 'active';
      await updateDoc(doc(db, 'students', id), { status: newStatus });
      setStudents(prev =>
        prev.map(s => s.id === id ? { ...s, status: newStatus } : s)
      );
    }
  }, [students]);

  // ── CRUD — Enrollments ───────────────────────────────────────────────────────

  const addEnrollment = useCallback(async (data: NewEnrollment): Promise<Enrollment> => {
    const existing = enrollments.find(
      e => e.studentId === data.studentId &&
        e.academicYearId === data.academicYearId &&
        e.semester === data.semester,
    );
    if (existing) {
      await updateDoc(doc(db, 'enrollments', existing.id), data as any);
      setEnrollments(prev =>
        prev.map(e => e.id === existing.id ? { ...e, ...data } : e)
      );
      return { ...existing, ...data } as Enrollment;
    }
    const newEnrollmentData = {
      ...data,
      enrolledAt: new Date().toISOString().slice(0, 10),
    };
    const docRef = await addDoc(collection(db, 'enrollments'), newEnrollmentData);
    const newEnrollment = { id: docRef.id, ...newEnrollmentData } as Enrollment;
    setEnrollments(prev => [...prev, newEnrollment]);
    return newEnrollment;
  }, [enrollments]);

  const updateEnrollment = useCallback(async (id: string, data: Partial<Enrollment>) => {
    await updateDoc(doc(db, 'enrollments', id), data as any);
    setEnrollments(prev =>
      prev.map(e => e.id === id ? { ...e, ...data } : e)
    );
  }, []);

  // ── Derived — Filtered Students ───────────────────────────────────────────────

  // หา enrollment ของนักเรียนในปี/ภาคเรียนที่ filter
  const getEnrollment = (studentId: string): Enrollment | null =>
    enrollments.find(
      e => e.studentId === studentId &&
        e.academicYearId === filter.academicYearId
    ) ?? null;

  const filteredStudentCards = useMemo((): StudentCard[] => {
    // 1. กรอง Enrollments ตามปี, แผนก, ชั้น, ห้อง
    const matchingEnrollments = enrollments.filter(e => {
      if (e.academicYearId !== filter.academicYearId) return false;
      if (filter.gradeLevel && e.gradeLevel !== filter.gradeLevel) return false;
      if (filter.classId && e.classId !== filter.classId) return false;
      
      if (filter.department) {
        const gradesInDept = GRADE_ORDER[filter.department] || [];
        if (!gradesInDept.includes(e.gradeLevel)) return false;
      }
      return true;
    });

    const enrolledStudentIds = new Set(matchingEnrollments.map(e => e.studentId));

    // 2. กรอง Students
    const baseStudents = students.filter(s => {
      // กรองผ่าน Enrollment (ถ้ามี)
      if (enrolledStudentIds.has(s.id)) return true;

      // FALLBACK: กรองผ่านฟิลด์ในตัวนักเรียนโดยตรง
      const sData = s as any;
      const currentYear = sData.academicYear || sData.academicYearId;

      // Check if student's current operational context matches the year filter
      let isYearMatch = false;
      if (sData.classroomId) {
        const cls = classrooms.find(c => c.id === sData.classroomId);
        if (cls && (String(cls.academicYearId) === filter.academicYearId || String(cls.academicYear) === filter.academicYearId)) {
          isYearMatch = true;
        }
      } else if (filter.academicYearId && String(currentYear) === filter.academicYearId) {
        isYearMatch = true;
      }

      if (isYearMatch) {
        // MUST still validate other filters
        // เช็คแผนก
        if (filter.department) {
          const gradesInDept = GRADE_ORDER[filter.department] || [];
          if (!gradesInDept.includes(sData.gradeLevel)) return false;
        }
        // เช็คชั้น
        if (filter.gradeLevel && sData.gradeLevel !== filter.gradeLevel) return false;
        // เช็คห้อง
        if (filter.classId && (sData.classroomId !== filter.classId && sData.classId !== filter.classId)) return false;
        
        return true;
      }

      return false;
    });

    return baseStudents
      .filter(s => {
        if (filter.status && s.status !== filter.status) return false;
        if (filter.searchText) {
          const q = filter.searchText.toLowerCase();
          const fullName = `${s.prefix}${s.firstName} ${s.lastName}`.toLowerCase();
          const studentCode = s.studentCode ? String(s.studentCode).toLowerCase() : '';
          if (!fullName.includes(q) && !studentCode.includes(q)) return false;
        }
        return true;
      })
      .map(s => {
        const enrollment = getEnrollment(s.id);
        const sData = s as any;
        return {
          student: s,
          enrollment,
          currentClass: enrollment?.className || sData.className || null,
          currentGrade: enrollment?.gradeLevel || sData.gradeLevel || null,
        };
      })
      .sort((a, b) => {
        const codeA = a.student.studentCode || '';
        const codeB = b.student.studentCode || '';
        // เรียงตามรหัส (ตัวเลข)
        return codeA.localeCompare(codeB, undefined, { numeric: true });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [students, enrollments, filter]);

  // ── Derived — Available grades & classes for filter dropdowns ─────────────────

  const availableGradeLevels = useMemo((): string[] => {
    const yearEnrollments = enrollments.filter(
      e => e.academicYearId === filter.academicYearId
    );
    return [...new Set(yearEnrollments.map(e => e.gradeLevel))].sort();
  }, [enrollments, filter.academicYearId]);

  const availableClasses = useMemo((): Array<{ classId: string; className: string }> => {
    const yearClasses = classrooms.filter(
      c => c.academicYearId === filter.academicYearId &&
        (filter.gradeLevel ? c.gradeLevel === filter.gradeLevel : true)
    );
    return yearClasses.map(c => ({ classId: c.id, className: c.className }))
      .sort((a, b) => a.className.localeCompare(b.className, 'th'));
  }, [classrooms, filter.academicYearId, filter.gradeLevel]);

  // ── Stats ────────────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const active = filteredStudentCards.filter(c => c.student.status === 'active').length;
    const male = filteredStudentCards.filter(c => c.student.gender === 'male').length;
    const female = filteredStudentCards.filter(c => c.student.gender === 'female').length;
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
