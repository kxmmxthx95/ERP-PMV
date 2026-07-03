import { useState, useMemo, useEffect, useCallback, useSyncExternalStore } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc, writeBatch, query, where, getDocs, arrayRemove } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  getClassesByYearStore,
  getEnrollmentsByYearStore,
  getStudentsByYearStore,
  invalidateStudentSummaryCache,
} from '@/lib/firestoreShared/studentSummaryStore';
import {
  buildResolveStudentsCacheKey,
  resolveStudentsForYear,
} from '@/lib/students/resolveStudentsForYear';
import { resolveStudentClassDisplayName } from '@/lib/students/classRoster';
import { isStudyingStudent } from '@/lib/students/studentStatus';
import { isFemaleStudent, isMaleStudent } from '@/lib/students/studentGender';
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

function normalizeEnrollmentYear(e: Enrollment, fallbackYear: string): Enrollment {
  const row = e as Enrollment & { academicYear?: string };
  const year = String(row.academicYearId ?? row.academicYear ?? fallbackYear);
  return { ...e, academicYearId: year };
}

function enrollmentMatchesYear(e: Enrollment, yearId: string): boolean {
  const row = e as Enrollment & { academicYear?: string };
  return String(row.academicYearId ?? row.academicYear ?? '') === String(yearId);
}

const noopSubscribe = () => () => {};
const readySnapshot = () => true;
const getEmptyRowsSnapshot = <T,>(): T => [] as T;

function useSharedStoreRows<T>(
  store: {
    subscribe: (listener: () => void) => () => void;
    getSnapshot: () => T;
    getReady: () => boolean;
  } | null,
) {
  const subscribe = store?.subscribe ?? noopSubscribe;
  const getSnapshot = store ? store.getSnapshot : getEmptyRowsSnapshot<T>;
  const getReady = store ? store.getReady : readySnapshot;
  const rows = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const ready = useSyncExternalStore(subscribe, getReady, getReady);
  return { rows, ready };
}

// ── Hook ───────────────────────────────────────────────────────────────────────

export function useStudentManager(defaultYear?: string) {
  const [students, setStudents] = useState<Student[]>([]);
  const [resolvingStudents, setResolvingStudents] = useState(false);

  const [filter, setFilter] = useState<StudentFilter>({
    academicYearId: defaultYear ?? '2568',
    department: '',
    gradeLevel: '',
    classId: '',
    searchText: '',
    status: '',
  });

  // อัปเดตปีการศึกษาเมื่อ defaultYear (จากระบบ) เปลี่ยนแปลง
  useEffect(() => {
    if (defaultYear) {
      setFilter(prev => ({ ...prev, academicYearId: defaultYear }));
    }
  }, [defaultYear]);

  const yearId = filter.academicYearId;
  const enrollmentStore = useMemo(() => getEnrollmentsByYearStore(yearId), [yearId]);
  const classStore = useMemo(() => getClassesByYearStore(yearId), [yearId]);
  const studentsStore = useMemo(() => getStudentsByYearStore(yearId), [yearId]);

  const { rows: enrollmentRows, ready: enrollmentsReady } = useSharedStoreRows(enrollmentStore);
  const { rows: classRows, ready: classesReady } = useSharedStoreRows(classStore);
  const { rows: yearStudents, ready: yearStudentsReady } = useSharedStoreRows(studentsStore);

  const enrollments = useMemo(
    () => enrollmentRows.map((row) => normalizeEnrollmentYear(row as Enrollment, yearId)),
    [enrollmentRows, yearId],
  );
  const classrooms = classRows;

  const resolveCacheKey = useMemo(
    () => buildResolveStudentsCacheKey(yearId, enrollmentRows, classRows, yearStudents),
    [yearId, enrollmentRows, classRows, yearStudents],
  );

  useEffect(() => {
    if (!enrollmentsReady || !classesReady || !yearStudentsReady) {
      setResolvingStudents(true);
      return;
    }

    let cancelled = false;
    setResolvingStudents(true);

    void resolveStudentsForYear(yearId, enrollmentRows, classRows, yearStudents)
      .then((merged) => {
        if (cancelled) return;
        setStudents(merged as Student[]);
      })
      .catch((err) => {
        console.error('[useStudentManager] resolveStudentsForYear failed:', err);
      })
      .finally(() => {
        if (!cancelled) setResolvingStudents(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    resolveCacheKey,
    yearId,
    enrollmentRows,
    classRows,
    yearStudents,
    enrollmentsReady,
    classesReady,
    yearStudentsReady,
  ]);

  const isDataLoaded = enrollmentsReady && classesReady && yearStudentsReady && !resolvingStudents;

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

    const classesWithStudent = getClassesByYearStore(yearId)
      .getSnapshot()
      .filter((c) => (c.studentIds ?? []).includes(id));

    const batch = writeBatch(db);
    batch.delete(doc(db, 'students', id));

    const relatedEnrollments = enrollments.filter(e => e.studentId === id);
    relatedEnrollments.forEach(e => {
      batch.delete(doc(db, 'enrollments', e.id!));
    });

    classesWithStudent.forEach((c) => {
      batch.update(doc(db, 'classes', c.id), { studentIds: arrayRemove(id) });
    });

    await batch.commit();
    setStudents(prev => prev.filter(s => s.id !== id));
    await invalidateStudentSummaryCache(yearId);
  }, [students, enrollments, yearId]);

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
      return { ...existing, ...data } as Enrollment;
    }
    const newEnrollmentData = {
      ...data,
      enrolledAt: new Date().toISOString().slice(0, 10),
    };
    const docRef = await addDoc(collection(db, 'enrollments'), newEnrollmentData);
    return { id: docRef.id, ...newEnrollmentData } as Enrollment;
  }, [enrollments]);

  const updateEnrollment = useCallback(async (id: string, data: Partial<Enrollment>) => {
    await updateDoc(doc(db, 'enrollments', id), data as any);
  }, []);

  // ── Derived — Filtered Students ───────────────────────────────────────────────

  // หา enrollment ของนักเรียนในปี/ภาคเรียนที่ filter
  const getEnrollment = (studentId: string): Enrollment | null =>
    enrollments.find(
      (e) => e.studentId === studentId && enrollmentMatchesYear(e, filter.academicYearId),
    ) ?? null;

  const filteredStudentCards = useMemo((): StudentCard[] => {
    // 1. กรอง Enrollments ตามปี, แผนก, ชั้น, ห้อง
    const matchingEnrollments = enrollments.filter((e) => {
      if (!enrollmentMatchesYear(e, filter.academicYearId)) return false;
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
        // นักเรียนที่จบการศึกษาหรือย้ายออกแล้ว ไม่แสดงในรายชื่อ
        if (!isStudyingStudent(s)) return false;
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
        const sData = s as Student & {
          className?: string;
          classroomId?: string;
          classId?: string;
          gradeLevel?: string;
          roomNumber?: string;
        };
        return {
          student: s,
          enrollment,
          currentClass: resolveStudentClassDisplayName(
            sData,
            enrollment,
            classrooms,
            filter.academicYearId,
          ),
          currentGrade: enrollment?.gradeLevel || sData.gradeLevel || null,
        };
      })
      .sort((a, b) => {
        const codeA = a.student.studentCode || '';
        const codeB = b.student.studentCode || '';
        return codeA.localeCompare(codeB, undefined, { numeric: true });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [students, enrollments, classrooms, filter]);

  const visibleStudentCards = useMemo((): StudentCard[] => {
    const hasExtraFilters = !!(filter.searchText || filter.status || filter.department || filter.gradeLevel || filter.classId);
    if (filteredStudentCards.length > 0 || hasExtraFilters || students.length === 0) {
      return filteredStudentCards;
    }
    // ปีการศึกษาไม่ตรงกับ enrollment — แสดงนักเรียนทั้งหมด (sysadmin/admin ยังเห็นข้อมูล)
    return students
      .filter((s) => isStudyingStudent(s))
      .map((s) => {
        const sData = s as Student & {
          className?: string;
          classroomId?: string;
          classId?: string;
          gradeLevel?: string;
          roomNumber?: string;
        };
        const enrollment = getEnrollment(s.id);
        return {
          student: s,
          enrollment,
          currentClass: resolveStudentClassDisplayName(
            sData,
            enrollment,
            classrooms,
            filter.academicYearId,
          ),
          currentGrade: enrollment?.gradeLevel || sData.gradeLevel || null,
        };
      })
      .sort((a, b) => (a.student.studentCode || '').localeCompare(b.student.studentCode || '', undefined, { numeric: true }));
  }, [filteredStudentCards, filter, students, enrollments, classrooms]);

  // ── Derived — Available grades & classes for filter dropdowns ─────────────────

  const availableGradeLevels = useMemo((): string[] => {
    const yearEnrollments = enrollments.filter((e) =>
      enrollmentMatchesYear(e, filter.academicYearId),
    );
    return [...new Set(yearEnrollments.map(e => e.gradeLevel))].sort();
  }, [enrollments, filter.academicYearId]);

  const availableClasses = useMemo((): Array<{ classId: string; className: string }> => {
    const yearClasses = classrooms.filter((c) => {
      const sameYear =
        String(c.academicYearId) === String(filter.academicYearId) ||
        String(c.academicYear) === String(filter.academicYearId);
      return sameYear && (filter.gradeLevel ? c.gradeLevel === filter.gradeLevel : true);
    });
    return yearClasses
      .map((c) => ({ classId: c.id, className: String(c.className ?? '') }))
      .sort((a, b) => a.className.localeCompare(b.className, 'th'));
  }, [classrooms, filter.academicYearId, filter.gradeLevel]);

  // ── Stats ────────────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const active = visibleStudentCards.filter(c => c.student.status === 'active').length;
    const male = visibleStudentCards.filter(c => isMaleStudent(c.student)).length;
    const female = visibleStudentCards.filter(c => isFemaleStudent(c.student)).length;
    return { total: visibleStudentCards.length, active, male, female };
  }, [visibleStudentCards]);

  // ── Queries ──────────────────────────────────────────────────────────────────

  const getStudentById = (id: string) => students.find(s => s.id === id) ?? null;

  const getStudentEnrollments = (studentId: string) =>
    enrollments.filter(e => e.studentId === studentId)
      .sort((a, b) => b.academicYearId.localeCompare(a.academicYearId));

  return {
    // Data
    students,
    enrollments,
    filteredStudentCards: visibleStudentCards,
    stats,
    isDataLoaded,

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
