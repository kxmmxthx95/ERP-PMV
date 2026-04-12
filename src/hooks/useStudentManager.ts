import { useState, useMemo } from 'react';
import type {
  Student, NewStudent, Enrollment, NewEnrollment, StudentCard, StudentStatus,
} from '@/types/student';
import type { Department } from '@/types/curriculum';

// ── Seed Data ──────────────────────────────────────────────────────────────────

const SEED_STUDENTS: Student[] = [
  { id: 'st01', studentCode: '67001', prefix: 'เด็กชาย', firstName: 'กิตติ', lastName: 'สมใจ', gender: 'male', birthDate: '2012-03-15', bloodType: 'A', guardianName: 'นายสมชาย สมใจ', guardianPhone: '081-111-0001', guardianRelation: 'บิดา', status: 'active', createdAt: '2024-05-01' },
  { id: 'st02', studentCode: '67002', prefix: 'เด็กหญิง', firstName: 'นภา', lastName: 'แสงดาว', gender: 'female', birthDate: '2012-07-22', bloodType: 'B', guardianName: 'นางสุดา แสงดาว', guardianPhone: '081-111-0002', guardianRelation: 'มารดา', status: 'active', createdAt: '2024-05-01' },
  { id: 'st03', studentCode: '67003', prefix: 'เด็กชาย', firstName: 'ธนพล', lastName: 'วงศ์ไทย', gender: 'male', birthDate: '2012-01-10', bloodType: 'O', guardianName: 'นายวิชาญ วงศ์ไทย', guardianPhone: '081-111-0003', guardianRelation: 'บิดา', status: 'active', createdAt: '2024-05-01' },
  { id: 'st04', studentCode: '67004', prefix: 'เด็กหญิง', firstName: 'พิมพ์ชนก', lastName: 'รุ่งเรือง', gender: 'female', birthDate: '2012-05-08', bloodType: 'AB', guardianName: 'นางพัชรา รุ่งเรือง', guardianPhone: '081-111-0004', guardianRelation: 'มารดา', status: 'active', createdAt: '2024-05-01' },
  { id: 'st05', studentCode: '67005', prefix: 'นาย', firstName: 'ปิยะ', lastName: 'ฉลาดดี', gender: 'male', birthDate: '2009-11-30', bloodType: 'A', guardianName: 'นายสุรชาติ ฉลาดดี', guardianPhone: '081-111-0005', guardianRelation: 'บิดา', status: 'active', createdAt: '2024-05-01' },
  { id: 'st06', studentCode: '67006', prefix: 'นางสาว', firstName: 'อรอนงค์', lastName: 'เพชรดี', gender: 'female', birthDate: '2009-04-17', bloodType: 'B', guardianName: 'นางมาลี เพชรดี', guardianPhone: '081-111-0006', guardianRelation: 'มารดา', status: 'active', createdAt: '2024-05-01' },
  { id: 'st07', studentCode: '67007', prefix: 'นาย', firstName: 'ศุภวิชญ์', lastName: 'มาลาวงษ์', gender: 'male', birthDate: '2008-08-05', bloodType: 'O', guardianName: 'นายมานพ มาลาวงษ์', guardianPhone: '081-111-0007', guardianRelation: 'บิดา', status: 'active', createdAt: '2024-05-01' },
  { id: 'st08', studentCode: '67008', prefix: 'นางสาว', firstName: 'ณัฐสุดา', lastName: 'ทองคำ', gender: 'female', birthDate: '2008-12-25', bloodType: 'A', guardianName: 'นางทองใบ ทองคำ', guardianPhone: '081-111-0008', guardianRelation: 'มารดา', status: 'active', createdAt: '2024-05-01' },
  { id: 'st09', studentCode: '67009', prefix: 'นาย', firstName: 'ภานุวัฒน์', lastName: 'สุขศิริ', gender: 'male', birthDate: '2007-02-14', bloodType: 'B', guardianName: 'นายวัฒนา สุขศิริ', guardianPhone: '081-111-0009', guardianRelation: 'บิดา', status: 'active', createdAt: '2024-05-01' },
  { id: 'st10', studentCode: '67010', prefix: 'นางสาว', firstName: 'ชนิดา', lastName: 'ศรีสม', gender: 'female', birthDate: '2007-09-03', bloodType: 'AB', guardianName: 'นางศรีนวล ศรีสม', guardianPhone: '081-111-0010', guardianRelation: 'มารดา', status: 'active', createdAt: '2024-05-01' },
  { id: 'st11', studentCode: '67011', prefix: 'นาย', firstName: 'กฤษณะ', lastName: 'แก้วมณี', gender: 'male', birthDate: '2006-06-20', bloodType: 'O', guardianName: 'นายแก้ว แก้วมณี', guardianPhone: '081-111-0011', guardianRelation: 'บิดา', status: 'active', createdAt: '2024-05-01' },
  { id: 'st12', studentCode: '67012', prefix: 'นางสาว', firstName: 'สุภาพร', lastName: 'ดาวเรือง', gender: 'female', birthDate: '2006-10-11', bloodType: 'A', guardianName: 'นางดาว ดาวเรือง', guardianPhone: '081-111-0012', guardianRelation: 'มารดา', status: 'inactive', createdAt: '2024-05-01' },
];

const SEED_ENROLLMENTS: Enrollment[] = [
  // ม.1/1 — academicYearId: "2568"
  { id: 'en01', studentId: 'st01', classId: 'c-m1-1', className: 'ม.1/1', gradeLevel: 'ม.1', departmentId: 'secondary', academicYearId: '2568', semester: 1, status: 'studying', enrolledAt: '2024-05-15' },
  { id: 'en02', studentId: 'st02', classId: 'c-m1-1', className: 'ม.1/1', gradeLevel: 'ม.1', departmentId: 'secondary', academicYearId: '2568', semester: 1, status: 'studying', enrolledAt: '2024-05-15' },
  { id: 'en03', studentId: 'st03', classId: 'c-m1-1', className: 'ม.1/1', gradeLevel: 'ม.1', departmentId: 'secondary', academicYearId: '2568', semester: 1, status: 'studying', enrolledAt: '2024-05-15' },
  // ม.3/1
  { id: 'en04', studentId: 'st04', classId: 'c-m3-1', className: 'ม.3/1', gradeLevel: 'ม.3', departmentId: 'secondary', academicYearId: '2568', semester: 1, status: 'studying', enrolledAt: '2024-05-15' },
  { id: 'en05', studentId: 'st05', classId: 'c-m3-1', className: 'ม.3/1', gradeLevel: 'ม.3', departmentId: 'secondary', academicYearId: '2568', semester: 1, status: 'studying', enrolledAt: '2024-05-15' },
  { id: 'en06', studentId: 'st06', classId: 'c-m3-1', className: 'ม.3/1', gradeLevel: 'ม.3', departmentId: 'secondary', academicYearId: '2568', semester: 1, status: 'studying', enrolledAt: '2024-05-15' },
  // ม.4/2
  { id: 'en07', studentId: 'st07', classId: 'c-m4-2', className: 'ม.4/2', gradeLevel: 'ม.4', departmentId: 'secondary', academicYearId: '2568', semester: 1, status: 'studying', enrolledAt: '2024-05-15' },
  { id: 'en08', studentId: 'st08', classId: 'c-m4-2', className: 'ม.4/2', gradeLevel: 'ม.4', departmentId: 'secondary', academicYearId: '2568', semester: 1, status: 'studying', enrolledAt: '2024-05-15' },
  // ม.6/1
  { id: 'en09', studentId: 'st09', classId: 'c-m6-1', className: 'ม.6/1', gradeLevel: 'ม.6', departmentId: 'secondary', academicYearId: '2568', semester: 1, status: 'studying', enrolledAt: '2024-05-15' },
  { id: 'en10', studentId: 'st10', classId: 'c-m6-1', className: 'ม.6/1', gradeLevel: 'ม.6', departmentId: 'secondary', academicYearId: '2568', semester: 1, status: 'studying', enrolledAt: '2024-05-15' },
  { id: 'en11', studentId: 'st11', classId: 'c-m6-1', className: 'ม.6/1', gradeLevel: 'ม.6', departmentId: 'secondary', academicYearId: '2568', semester: 1, status: 'studying', enrolledAt: '2024-05-15' },
  { id: 'en12', studentId: 'st12', classId: 'c-m6-1', className: 'ม.6/1', gradeLevel: 'ม.6', departmentId: 'secondary', academicYearId: '2568', semester: 1, status: 'transferred', enrolledAt: '2024-05-15' },
];

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
  const [students, setStudents] = useState<Student[]>(SEED_STUDENTS);
  const [enrollments, setEnrollments] = useState<Enrollment[]>(SEED_ENROLLMENTS);

  const [filter, setFilter] = useState<StudentFilter>({
    academicYearId: defaultYear ?? '2568',
    departmentId: 'secondary',
    gradeLevel: '',
    classId: '',
    searchText: '',
    status: '',
  });

  // ── CRUD — Students ──────────────────────────────────────────────────────────

  const addStudent = (data: NewStudent): Student => {
    const newStudent: Student = {
      ...data,
      id: `st-${Date.now()}`,
      createdAt: new Date().toISOString().slice(0, 10),
    };
    setStudents(prev => [...prev, newStudent]);
    return newStudent;
  };

  const updateStudent = (id: string, data: NewStudent) => {
    setStudents(prev => prev.map(s => s.id === id ? { ...data, id, createdAt: s.createdAt } : s));
  };

  const deleteStudent = (id: string) => {
    setStudents(prev => prev.filter(s => s.id !== id));
    setEnrollments(prev => prev.filter(e => e.studentId !== id));
  };

  const toggleStudentStatus = (id: string) => {
    setStudents(prev => prev.map(s =>
      s.id === id ? { ...s, status: s.status === 'active' ? 'inactive' : 'active' } : s,
    ));
  };

  // ── CRUD — Enrollments ───────────────────────────────────────────────────────

  const addEnrollment = (data: NewEnrollment): Enrollment => {
    const existing = enrollments.find(
      e => e.studentId === data.studentId &&
           e.academicYearId === data.academicYearId &&
           e.semester === data.semester,
    );
    if (existing) {
      // อัปเดต enrollment ที่มีอยู่แล้ว
      const updated = { ...existing, ...data };
      setEnrollments(prev => prev.map(e => e.id === existing.id ? updated : e));
      return updated;
    }
    const newEnrollment: Enrollment = {
      ...data,
      id: `en-${Date.now()}`,
      enrolledAt: new Date().toISOString().slice(0, 10),
    };
    setEnrollments(prev => [...prev, newEnrollment]);
    return newEnrollment;
  };

  const updateEnrollment = (id: string, data: Partial<Enrollment>) => {
    setEnrollments(prev => prev.map(e => e.id === id ? { ...e, ...data } : e));
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
