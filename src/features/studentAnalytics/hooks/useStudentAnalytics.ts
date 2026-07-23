import { useQuery } from '@tanstack/react-query';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useActiveAcademicYear } from '@/hooks/useActiveAcademicYear';
import { GRADE_LETTER_TO_GPA, type GradeLetter, type GradeRecord } from '@/types/grades';
import type { AttendanceStatus } from '@/types/teaching';
import type { MorningRollCallSession } from '@/types/morningRollCall';
import { calcRiskLevel } from '../utils/riskScore';
import type { StudentAnalyticsRow } from '../types';

interface StudentRow {
  id: string;
  studentCode?: string;
  firstName?: string;
  lastName?: string;
  photoURL?: string;
}

interface ClassSessionRow {
  attendance?: Array<{ studentId: string; status: AttendanceStatus }>;
}

function tallyRate(entries: AttendanceStatus[]): number | null {
  if (entries.length === 0) return null;
  const attended = entries.filter((s) => s === 'present' || s === 'late').length;
  return Math.round((attended / entries.length) * 100);
}

async function fetchStudentAnalytics(classId: string, academicYearId: string, className: string) {
  const [studentsSnap, gradesSnap, sessionsSnap, rollCallSnap] = await Promise.all([
    getDocs(query(collection(db, 'students'), where('classroomId', '==', classId))),
    getDocs(query(
      collection(db, 'grade_records'),
      where('classId', '==', classId),
      where('academicYearId', '==', academicYearId),
    )),
    getDocs(query(
      collection(db, 'class_sessions'),
      where('classId', '==', classId),
      where('academicYearId', '==', academicYearId),
    )),
    getDocs(query(
      collection(db, 'morning_rollcall'),
      where('classId', '==', classId),
      where('academicYearId', '==', academicYearId),
    )),
  ]);

  const students = studentsSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as StudentRow);
  const gradeRecords = gradesSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as GradeRecord);
  const sessions = sessionsSnap.docs.map((d) => d.data() as ClassSessionRow);
  const rollCallSessions = rollCallSnap.docs.map((d) => d.data() as MorningRollCallSession);

  const gradesByStudent = new Map<string, GradeRecord[]>();
  gradeRecords.forEach((r) => {
    const arr = gradesByStudent.get(r.studentId) ?? [];
    arr.push(r);
    gradesByStudent.set(r.studentId, arr);
  });

  const attendanceByStudent = new Map<string, AttendanceStatus[]>();
  sessions.forEach((session) => {
    (session.attendance ?? []).forEach((entry) => {
      const arr = attendanceByStudent.get(entry.studentId) ?? [];
      arr.push(entry.status);
      attendanceByStudent.set(entry.studentId, arr);
    });
  });

  const rollCallByStudent = new Map<string, AttendanceStatus[]>();
  rollCallSessions.forEach((session) => {
    (session.attendance ?? []).forEach((entry) => {
      const arr = rollCallByStudent.get(entry.studentId) ?? [];
      arr.push(entry.status as AttendanceStatus);
      rollCallByStudent.set(entry.studentId, arr);
    });
  });

  const rows: StudentAnalyticsRow[] = students.map((student) => {
    const grades = gradesByStudent.get(student.id) ?? [];
    const gpaPoints = grades
      .map((g) => (g.grade ? GRADE_LETTER_TO_GPA[g.grade as GradeLetter] : undefined))
      .filter((v): v is number => v !== undefined);
    const gpa = gpaPoints.length > 0
      ? Math.round((gpaPoints.reduce((a, b) => a + b, 0) / gpaPoints.length) * 100) / 100
      : null;
    const failingSubjects = grades.filter((g) => g.grade === 'F').length;

    const attendanceRate = tallyRate(attendanceByStudent.get(student.id) ?? []);
    const rollCallRate = tallyRate(rollCallByStudent.get(student.id) ?? []);

    const { riskLevel, riskReasons } = calcRiskLevel({
      gpa,
      failingSubjects,
      attendanceRate,
      rollCallRate,
    });

    return {
      studentId: student.id,
      studentCode: student.studentCode ?? '',
      fullName: `${student.firstName ?? ''} ${student.lastName ?? ''}`.trim(),
      photoURL: student.photoURL,
      classId,
      className,
      gpa,
      failingSubjects,
      gradedSubjects: grades.length,
      attendanceRate,
      rollCallRate,
      riskLevel,
      riskReasons,
    };
  });

  rows.sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2, none: 3 };
    if (order[a.riskLevel] !== order[b.riskLevel]) return order[a.riskLevel] - order[b.riskLevel];
    return (a.gpa ?? 4) - (b.gpa ?? 4);
  });

  return rows;
}

export function useStudentAnalytics(classId: string | null, className: string) {
  const { year } = useActiveAcademicYear();

  return useQuery({
    queryKey: ['studentAnalytics', classId, year],
    queryFn: () => fetchStudentAnalytics(classId as string, String(year), className),
    enabled: !!classId && !!year,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}
