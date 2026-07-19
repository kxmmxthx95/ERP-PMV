import {
  buildStudentLookup,
  resolveStudentsByFeeIds,
} from '@/features/tuition/utils/studentFeeDisplay';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  collectStudentIdsForClass,
  resolveEnrollmentClassId,
  resolveStudentClassDisplayName,
} from '@/lib/students/classRoster';
import { isTuitionRosterStudent, resolveStudentStudyStatus, type StudentStudyStatus } from '@/lib/students/studentStatus';
import type { ClassRoom } from '@/types/class';
import { DEPARTMENT_GRADES } from '@/types/class';
import type { Department } from '@/types/curriculum';
import type { Enrollment, Student } from '@/types/student';
import type { TuitionCampaign } from '@/types/tuition';

export interface CampaignStudentRosterEntry {
  studentId: string;
  student: Student;
  enrollment: Enrollment | null;
  classId: string;
  className: string;
  gradeLevel: string;
  departmentId: Department;
  studyStatus: StudentStudyStatus;
}

function classMatchesYear(cls: ClassRoom & { academicYear?: string }, yearId: string): boolean {
  return (
    String(cls.academicYearId ?? cls.academicYear ?? '') === String(yearId)
  );
}

function enrollmentMatchesYear(e: Enrollment & { academicYear?: string }, yearId: string): boolean {
  return String(e.academicYearId ?? e.academicYear ?? '') === String(yearId);
}

function departmentFromGrade(gradeLevel: string): Department {
  if (DEPARTMENT_GRADES.early.includes(gradeLevel)) return 'early';
  if (DEPARTMENT_GRADES.primary.includes(gradeLevel)) return 'primary';
  return 'secondary';
}

function parseGradeFromClassName(className: string): string {
  const [grade] = className.split(/[/／]/);
  return grade?.trim() || '';
}

function campaignNumericTerm(campaign: TuitionCampaign): 1 | 2 | null {
  if (campaign.term === '1' || campaign.term === '2') return Number(campaign.term) as 1 | 2;
  return null;
}

/** กรอง enrollment ตามเทอม — ข้ามเฉพาะเมื่อระบุ semester แล้วไม่ตรง (ไม่ตัดคนที่ไม่มี semester) */
export function filterEnrollmentsForCampaign(
  enrollments: Enrollment[],
  campaign: TuitionCampaign,
): Enrollment[] {
  const numericTerm = campaignNumericTerm(campaign);
  const yearMatched = enrollments.filter((e) => enrollmentMatchesYear(e, campaign.academicYearId));
  const rosterEligible = yearMatched.filter((e) => {
    const status = e.status ?? 'studying';
    return status === 'studying' || status === 'transferred';
  });
  const termMatched = rosterEligible.filter((e) => {
    if (numericTerm === null) return true;
    if (e.semester == null) return true;
    return Number(e.semester) === numericTerm;
  });

  if (numericTerm !== null) return termMatched;

  return [...termMatched]
    .sort((a, b) => (b.semester ?? 0) - (a.semester ?? 0))
    .filter((e, idx, arr) => arr.findIndex((x) => x.studentId === e.studentId) === idx);
}

async function fetchYearPartitioned<T extends { id: string }>(
  collectionName: string,
  academicYearId: string,
  mapDoc: (id: string, data: Record<string, unknown>) => T,
): Promise<T[]> {
  const [byYearIdSnap, byLegacySnap] = await Promise.all([
    getDocs(query(collection(db, collectionName), where('academicYearId', '==', academicYearId))),
    getDocs(query(collection(db, collectionName), where('academicYear', '==', academicYearId))),
  ]);

  const map = new Map<string, T>();
  for (const snap of [byYearIdSnap, byLegacySnap]) {
    for (const docSnap of snap.docs) {
      map.set(docSnap.id, mapDoc(docSnap.id, docSnap.data() as Record<string, unknown>));
    }
  }
  return [...map.values()];
}

function buildRosterEntry(
  studentId: string,
  student: Student,
  enrollment: Enrollment | null,
  classes: ClassRoom[],
  academicYearId: string,
  preferredClassId?: string,
): CampaignStudentRosterEntry | null {
  if (!isTuitionRosterStudent(student, enrollment?.status)) return null;

  const studyStatus = resolveStudentStudyStatus(student, enrollment?.status);

  const classId =
    preferredClassId
    || (enrollment ? resolveEnrollmentClassId(enrollment, classes, academicYearId) : null)
    || enrollment?.classId
    || String((student as Student & { classroomId?: string; classId?: string }).classroomId ?? '')
    || String((student as Student & { classId?: string }).classId ?? '');

  const cls = classId ? classes.find((c) => String(c.id) === String(classId)) : undefined;
  const className =
    resolveStudentClassDisplayName(
      {
        className: (student as Student & { className?: string }).className,
        classroomId: (student as Student & { classroomId?: string }).classroomId,
        classId: (student as Student & { classId?: string }).classId,
        gradeLevel: (student as Student & { gradeLevel?: string }).gradeLevel,
        roomNumber: (student as Student & { roomNumber?: string }).roomNumber,
      },
      enrollment,
      classes,
      academicYearId,
    )
    || enrollment?.className
    || cls?.className
    || (cls ? `${cls.gradeLevel}/${cls.roomNumber}` : '')
    || '';

  const gradeLevel =
    enrollment?.gradeLevel?.trim()
    || cls?.gradeLevel?.trim()
    || String((student as Student & { gradeLevel?: string }).gradeLevel ?? '').trim()
    || parseGradeFromClassName(className);

  const departmentId =
    enrollment?.departmentId
    || cls?.departmentId
    || departmentFromGrade(gradeLevel);

  if (!studentId || !gradeLevel) return null;

  return {
    studentId,
    student,
    enrollment,
    classId: classId || '',
    className,
    gradeLevel,
    departmentId,
    studyStatus,
  };
}

/** รวมนักเรียนที่ควรมีในตารางค่าเทอม — จาก enrollment + ห้องเรียน + classroomId บน student */
export async function resolveCampaignStudentRoster(
  campaign: TuitionCampaign,
): Promise<CampaignStudentRosterEntry[]> {
  const numericTerm = campaignNumericTerm(campaign);

  const [enrollmentRows, classRows, studentsSnap] = await Promise.all([
    fetchYearPartitioned('enrollments', campaign.academicYearId, (id, data) => ({ id, ...data } as Enrollment)),
    fetchYearPartitioned('classes', campaign.academicYearId, (id, data) => ({ id, ...data } as ClassRoom)),
    getDocs(collection(db, 'students')),
  ]);

  const enrollments = filterEnrollmentsForCampaign(enrollmentRows, campaign);
  const classes = classRows.filter((cls) => classMatchesYear(cls, campaign.academicYearId));
  const allStudents = studentsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Student));
  const studentById = buildStudentLookup(
    allStudents as unknown as Array<Record<string, unknown> & { id: string }>,
  );

  const candidateStudentIds = new Set<string>();
  for (const enrollment of enrollments) {
    if (enrollment.studentId) candidateStudentIds.add(enrollment.studentId);
  }
  for (const cls of classes) {
    if (numericTerm != null && cls.semester != null && Number(cls.semester) !== numericTerm) {
      continue;
    }
    for (const studentId of collectStudentIdsForClass(
      cls.id,
      enrollments,
      classes,
      campaign.academicYearId,
      numericTerm ?? undefined,
    )) {
      candidateStudentIds.add(studentId);
    }
  }

  const resolvedStudents = await resolveStudentsByFeeIds([...candidateStudentIds]);
  for (const [key, student] of resolvedStudents) {
    studentById.set(key, student);
  }

  const getStudent = (studentId: string): Student | undefined => {
    const row = studentById.get(studentId);
    if (!row) return undefined;
    const { id, ...rest } = row;
    return { id, ...rest } as Student;
  };

  const roster = new Map<string, CampaignStudentRosterEntry>();

  for (const enrollment of enrollments) {
    const student = getStudent(enrollment.studentId);
    if (!student) continue;
    const entry = buildRosterEntry(
      enrollment.studentId,
      student,
      enrollment,
      classes,
      campaign.academicYearId,
    );
    if (entry) roster.set(enrollment.studentId, entry);
  }

  for (const cls of classes) {
    if (numericTerm != null && cls.semester != null && Number(cls.semester) !== numericTerm) {
      continue;
    }

    const studentIds = collectStudentIdsForClass(
      cls.id,
      enrollments,
      classes,
      campaign.academicYearId,
      numericTerm ?? undefined,
    );

    for (const studentId of studentIds) {
      if (roster.has(studentId)) continue;
      const student = getStudent(studentId);
      if (!student) continue;
      const enrollment = enrollments.find((e) => e.studentId === studentId) ?? null;
      const entry = buildRosterEntry(
        studentId,
        student,
        enrollment,
        classes,
        campaign.academicYearId,
        cls.id,
      );
      if (entry) roster.set(studentId, entry);
    }
  }

  const seenStudentDocIds = new Set<string>();
  for (const studentRow of studentById.values()) {
    if (seenStudentDocIds.has(studentRow.id)) continue;
    seenStudentDocIds.add(studentRow.id);
    if (roster.has(studentRow.id)) continue;

    const student = getStudent(studentRow.id);
    if (!student) continue;
    const classroomId = String(
      (student as Student & { classroomId?: string; classId?: string }).classroomId
      ?? (student as Student & { classId?: string }).classId
      ?? '',
    );
    if (!classroomId) continue;

    const cls = classes.find((c: ClassRoom) => String(c.id) === classroomId);
    if (!cls) continue;

    const entry = buildRosterEntry(
      student.id,
      student,
      null,
      classes,
      campaign.academicYearId,
      cls.id,
    );
    if (entry) roster.set(student.id, entry);
  }

  return [...roster.values()];
}
