import { useState, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc,
  doc, query, where, writeBatch, getDocs,
} from 'firebase/firestore';

function chunkArray<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
import { db } from '@/lib/firebase';
import { useActiveAcademicYear } from '@/hooks/useActiveAcademicYear';
import { useTeacherManager } from '@/features/teachers/hooks/useTeacherManager';
import { useStudentManager } from '@/hooks/useStudentManager';
import {
  getClassesByYearStore,
  getTeachingClassesStore,
} from '@/lib/firestoreShared/studentSummaryStore';
import { useCurriculum } from '@/hooks/useCurriculum';
import { useCurriculumVersioned } from '@/hooks/useCurriculumVersioned';
import { useStudentLeaveRequests } from '@/hooks/useLeaveRequests';
import {
  buildTeacherIdentityKeys,
  matchesTeacherIdentity,
  resolveTeacherFromAuth,
} from '@/lib/teachers/teacherIdentity';
import type { Subject } from '@/types/curriculum';
import type { ClassRoom } from '@/types/class';
import { GRADE_LEVEL_ORDER } from '@/types/class';
import type {
  AttendanceRecord, ClassSession, NewAttendanceRecord, StudentAttendance,
  Assignment, NewAssignment,
  AssignmentSubmission, NewAssignmentSubmission,
  Exam, NewExam,
  ExamScore, NewExamScore,
} from '@/types/teaching';

const noopSubscribeClasses = () => () => {};
// ค่าอ้างอิงเดียวคงที่ ห้ามสร้าง [] ใหม่ทุกครั้ง ไม่งั้น useSyncExternalStore วน re-render ไม่จบ
const EMPTY_CLASS_ROWS: { id: string; [key: string]: unknown }[] = [];
const getEmptyClassRows = () => EMPTY_CLASS_ROWS;

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useTeachingManager(currentTeacherId: string, canViewAllSubjects?: boolean) {
  const { year: academicYear, activeSemester } = useActiveAcademicYear();
  const activeYearStr = academicYear ?? '2568';
  const semester = (activeSemester ?? 1) as 1 | 2;

  const teacherMgr = useTeacherManager();
  // Memoize teachers array by ID list to avoid recreating teacherIdentityKeys on every store emit
  const memoizedTeachers = useMemo(
    () => teacherMgr.teachers,
    [teacherMgr.teachers.map(t => t.id).join(',')], // depend on ID list, not array ref
  );
  const studentMgr = useStudentManager(activeYearStr);
  // Always-current students ref — lets the attendance listener below read the latest
  // roster without listing studentMgr.students as a dependency, so the listener isn't
  // torn down and re-subscribed (re-reading the whole collection) every time that
  // array gets a new reference.
  const studentsRef = useRef(studentMgr.students);
  studentsRef.current = studentMgr.students;
  const curriculum = useCurriculum();
  const { versions, coursesByVersion, loadCoursesForVersion } = useCurriculumVersioned();
  const { requests: leaveRequests } = useStudentLeaveRequests(`${Number(activeYearStr) - 543}-01-01`);

  // ── Local State ──────────────────────────────────────────────────────────────
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<AssignmentSubmission[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [examScores, setExamScores] = useState<ExamScore[]>([]);
  // Version counters: bump to trigger a re-fetch after local mutations
  const [submissionsVersion, setSubmissionsVersion] = useState(0);
  const [examScoresVersion, setExamScoresVersion] = useState(0);

  // ── Current Teacher ──────────────────────────────────────────────────────────
  const currentTeacher = useMemo(
    () => resolveTeacherFromAuth(currentTeacherId, memoizedTeachers),
    [memoizedTeachers, currentTeacherId],
  );

  const teacherIdentityKeys = useMemo(() => {
    return buildTeacherIdentityKeys(currentTeacherId, currentTeacher);
  }, [currentTeacherId, currentTeacher]);

  // ── Classes ──────────────────────────────────────────────────────────────────
  // canViewAllSubjects (admin/sysadmin overview) ต้องเห็นทุกห้อง — ครูทั่วไปเห็นแค่ห้อง
  // ที่มีวิชาตัวเองสอน (teacherIds ที่ sync มาจาก enrolledCourses) ไม่ต้องโหลดทั้งโรงเรียน
  const identityKeysList = useMemo(() => [...teacherIdentityKeys], [teacherIdentityKeys]);
  const scopedClassesStore = !canViewAllSubjects && activeYearStr && identityKeysList.length > 0
    ? getTeachingClassesStore(activeYearStr, identityKeysList)
    : null;
  const fullClassesStore = canViewAllSubjects && activeYearStr
    ? getClassesByYearStore(activeYearStr)
    : null;

  const scopedRawClasses = useSyncExternalStore(
    scopedClassesStore?.subscribe ?? noopSubscribeClasses,
    scopedClassesStore ? scopedClassesStore.getSnapshot : getEmptyClassRows,
    scopedClassesStore ? scopedClassesStore.getSnapshot : getEmptyClassRows,
  );
  const fullRawClasses = useSyncExternalStore(
    fullClassesStore?.subscribe ?? noopSubscribeClasses,
    fullClassesStore ? fullClassesStore.getSnapshot : getEmptyClassRows,
    fullClassesStore ? fullClassesStore.getSnapshot : getEmptyClassRows,
  );
  const rawClasses = canViewAllSubjects ? fullRawClasses : scopedRawClasses;

  const allClasses = useMemo(
    () => rawClasses.map((d) => ({ id: d.id, ...(d as Record<string, unknown>) } as ClassRoom)),
    [rawClasses],
  );

  // เหมือน useClassroomManager.classes (activeClasses) — กรองปี+เทอม, sort, fallback แสดง
  // ทั้งหมดถ้ากรองแล้วว่างเปล่า (กันหน้าว่างตอนข้อมูล semester ไม่ตรง)
  // Memoize by ID list to stabilize across store updates
  const activeClasses = useMemo(() => {
    if (allClasses.length === 0) return [];
    const filtered = allClasses.filter((c) =>
      (String(c.academicYearId) === String(activeYearStr) || String((c as { academicYear?: string }).academicYear) === String(activeYearStr))
      && (Number(c.semester) === Number(semester) || !c.semester),
    );
    const source = filtered.length === 0 ? allClasses : filtered;
    return [...source].sort((a, b) => {
      const orderA = GRADE_LEVEL_ORDER[a.gradeLevel] || 999;
      const orderB = GRADE_LEVEL_ORDER[b.gradeLevel] || 999;
      if (orderA !== orderB) return orderA - orderB;
      return a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true });
    });
  }, [allClasses.map(c => c.id).join(','), activeYearStr, semester]);

  // ห้องเรียนทั้งปี — ไม่กรองตาม class.semester (ภาคเรียนอยู่ที่ enrolledCourses)
  // Memoize by ID list to stabilize across store updates
  const yearClasses = useMemo(
    () => allClasses.filter(c =>
      String(c.academicYearId) === String(activeYearStr)
      || String((c as { academicYear?: string }).academicYear) === String(activeYearStr),
    ),
    [allClasses.map(c => c.id).join(','), activeYearStr],
  );

  // Preload versioned courses so enrolledCourses.subjectId can resolve to names
  useEffect(() => {
    if (!yearClasses.length || !versions.length) return;
    const versionIds = new Set<string>();
    for (const cls of yearClasses) {
      const pkgId = cls.curriculumPackageId || (cls as { curriculumId?: string }).curriculumId;
      if (pkgId) versionIds.add(String(pkgId));
    }
    for (const versionId of versionIds) {
      if (!versions.some((v) => v.id === versionId)) continue;
      if (!coursesByVersion[versionId]) void loadCoursesForVersion(versionId);
    }
  }, [yearClasses, versions, coursesByVersion, loadCoursesForVersion]);

  // ── Subjects assigned to this teacher via enrolledCourses (stamp) ────────────
  // กรองจาก classes.enrolledCourses ที่ teacherId ตรงกับ currentTeacherId
  // และ semester ตรงกับ activeSemester (หรือ semester == null สำหรับ backward compat)
  const mySubjects = useMemo(() => {
    const assignedSubjectIds = new Set<string>();
    const allVersionedCourses = Object.values(coursesByVersion).flat();

    // ใช้ yearClasses เพื่อให้ครูเห็นภาระงานปีปัจจุบัน
    for (const cls of yearClasses) {
      for (const ec of (cls.enrolledCourses ?? [])) {
        if (
          canViewAllSubjects ||
          (matchesTeacherIdentity(ec.teacherId, teacherIdentityKeys) &&
          (ec.semester === semester || ec.semester == null))
        ) {
          assignedSubjectIds.add(ec.subjectId);
        }
      }
    }

    for (const subjectId of currentTeacher?.teachingSubjectIds ?? []) {
      assignedSubjectIds.add(subjectId);
    }

    const result: Subject[] = [];
    assignedSubjectIds.forEach(id => {
      // 1. หาใน Repository (ระบบเดิม)
      const s = curriculum.subjects.find(sub => sub.id === id || sub.code === id);
      if (s) {
        result.push(s);
        return;
      }
      // 2. หาใน Versioned (ระบบใหม่)
      const v = allVersionedCourses.find(vc => vc.id === id || vc.courseCode === id);
      if (v) {
        const department =
          v.department === 'early' || v.department === 'primary' || v.department === 'secondary'
            ? v.department
            : 'secondary';
        const category =
          v.category === 'basic'
            ? 'core'
            : v.category === 'additional'
              ? 'added'
              : 'activity';

        result.push({
          id: v.id,
          name: v.courseName,
          code: v.courseCode,
          credits: v.credit || 0,
          hoursPerWeek: v.periodsPerWeek ?? 1,
          totalHours: v.totalHours ?? (v.periodsPerWeek ?? 1) * 18,
          category,
          department,
          subjectGroup: v.subjectGroup,
        });
        return;
      }
      // 3. stub — ยังโชว์การ์ดได้ก่อน curriculum โหลดครบ
      result.push({
        id,
        name: id,
        code: '',
        credits: 0,
        hoursPerWeek: 1,
        totalHours: 18,
        category: 'core',
        department: 'secondary',
      });
    });

    return result;
  }, [
    canViewAllSubjects,
    coursesByVersion,
    curriculum.subjects,
    currentTeacher?.teachingSubjectIds,
    semester,
    teacherIdentityKeys,
    yearClasses,
  ]);

  // Stable ID lists used to scope submissions/scores queries
  const assignmentIds = useMemo(() => assignments.map(a => a.id), [assignments]);
  const examIds = useMemo(() => exams.map(e => e.id), [exams]);

  const getStudentsForClass = (classId: string) => {
    // 1. Identify students via official enrollments
    let matchedEnrollments = studentMgr.enrollments.filter(
      e => e.classId === classId && String(e.academicYearId) === String(activeYearStr),
    );

    // Fallback: If no enrollments found for this year, try classId alone (backward compat)
    if (matchedEnrollments.length === 0) {
      matchedEnrollments = studentMgr.enrollments.filter(e => e.classId === classId);
    }

    const studentIdsFromEnrollments = new Set(matchedEnrollments.map(e => e.studentId));
    
    // 2. Build the final list
    const result: { student: typeof studentMgr.students[0]; enrollment?: typeof studentMgr.enrollments[0] }[] = [];

    // Add students from enrollments
    matchedEnrollments.forEach(e => {
      const student = studentMgr.students.find(s => s.id === e.studentId);
      if (student) {
        result.push({ student, enrollment: e });
      }
    });

    // 3. Fallback: Add students who are NOT in enrollments but have classroomId/classId matching this class
    studentMgr.students.forEach(student => {
      if (studentIdsFromEnrollments.has(student.id)) return;
      
      const sData = student as any;
      if (sData.classroomId === classId || sData.classId === classId) {
        result.push({ student });
      }
    });

    // Sort by studentCode
    return result.sort((a, b) => 
      (a.student.studentCode || '').localeCompare(b.student.studentCode || '', undefined, { numeric: true })
    );
  };

  // ── Realtime Firestore Subscriptions ─────────────────────────────────────────
  useEffect(() => {
    if (!currentTeacherId) return;

    const classSessionsColl = collection(db, 'class_sessions');

    const flattenSessions = (sessions: ClassSession[]) => {
      const studentMap = new Map(studentsRef.current.map(s => [s.id, s]));
      return sessions.flatMap(session => {
        const subjectName = session.subjectName ?? '';
        const className = session.className ?? '';
        const recordedAt = typeof session.updatedAt === 'string'
          ? session.updatedAt
          : new Date().toISOString();

        return (session.attendance ?? []).map((entry: StudentAttendance) => {
          const student = studentMap.get(entry.studentId);
          return {
            id: `${session.id ?? 'session'}_${entry.studentId}`,
            studentId: entry.studentId,
            studentName: student ? `${student.prefix}${student.firstName} ${student.lastName}` : '',
            studentCode: student?.studentCode ?? '',
            subjectId: session.subjectId,
            subjectName,
            classId: session.classId,
            className,
            teacherId: session.teacherId,
            departmentId: session.departmentId,
            academicYearId: session.academicYearId,
            semester: session.semester,
            date: session.date,
            period: Number(session.period),
            // 'excused' คือสถานะเก่าที่ถูกยุบรวมเข้ากับ 'leave' แล้ว (ไม่มีปุ่มตั้งค่านี้แยกอีกต่อไป)
            status: entry.status === 'excused' ? 'leave' : entry.status,
            note: entry.note ?? '',
            recordedAt,
          } as AttendanceRecord;
        });
      });
    };

    // Widget / schedule may store teacherId as auth uid OR teachers/{id}.
    // Listen every identity key and merge by session doc id.
    const teacherIdsToWatch = canViewAllSubjects
      ? null
      : [...teacherIdentityKeys].filter(Boolean);

    const sessionBuckets = new Map<string, Map<string, ClassSession>>();
    const unsubs: Array<() => void> = [];

    const publishAttendance = () => {
      const merged = new Map<string, ClassSession>();
      for (const bucket of sessionBuckets.values()) {
        for (const [id, session] of bucket) merged.set(id, session);
      }
      setAttendance(flattenSessions([...merged.values()]));
    };

    if (canViewAllSubjects || !teacherIdsToWatch || teacherIdsToWatch.length === 0) {
      const attendanceQuery = query(
        classSessionsColl,
        where('academicYearId', '==', activeYearStr),
        where('semester', '==', semester),
      );
      unsubs.push(onSnapshot(
        attendanceQuery,
        {
          next: snap => {
            const sessions = snap.docs.map(d => ({ id: d.id, ...d.data() } as ClassSession));
            const filtered = canViewAllSubjects
              ? sessions
              : sessions.filter(s => matchesTeacherIdentity(s.teacherId, teacherIdentityKeys));
            sessionBuckets.set('all', new Map(filtered.map(s => [s.id ?? '', s])));
            publishAttendance();
          },
          error: () => { /* Silent fail */ },
        },
      ));
    } else {
      for (const tid of teacherIdsToWatch) {
        const attendanceQuery = query(
          classSessionsColl,
          where('academicYearId', '==', activeYearStr),
          where('semester', '==', semester),
          where('teacherId', '==', tid),
        );
        unsubs.push(onSnapshot(
          attendanceQuery,
          {
            next: snap => {
              const sessions = snap.docs.map(d => ({ id: d.id, ...d.data() } as ClassSession));
              sessionBuckets.set(tid, new Map(sessions.map(s => [s.id ?? '', s])));
              publishAttendance();
            },
            error: () => { /* Silent fail */ },
          },
        ));
      }
    }

    const assignmentsColl = collection(db, 'assignments');
    const assignmentsQuery = canViewAllSubjects
      ? query(assignmentsColl,
          where('academicYearId', '==', activeYearStr),
          where('semester', '==', semester)
        )
      : query(assignmentsColl,
          where('teacherId', '==', currentTeacher?.id ?? currentTeacherId),
          where('academicYearId', '==', activeYearStr),
          where('semester', '==', semester)
        );

    const unsubAssignments = onSnapshot(
      assignmentsQuery,
      {
        next: snap => setAssignments(snap.docs.map(d => ({ id: d.id, ...d.data() } as Assignment))),
        error: () => { /* Silent fail */ }
      }
    );

    const examsColl = collection(db, 'exams');
    const examsQuery = canViewAllSubjects
      ? query(examsColl,
          where('academicYearId', '==', activeYearStr),
          where('semester', '==', semester)
        )
      : query(examsColl,
          where('teacherId', '==', currentTeacher?.id ?? currentTeacherId),
          where('academicYearId', '==', activeYearStr),
          where('semester', '==', semester)
        );

    const unsubExams = onSnapshot(
      examsQuery,
      {
        next: snap => setExams(snap.docs.map(d => ({ id: d.id, ...d.data() } as Exam))),
        error: () => { /* Silent fail */ }
      }
    );

    return () => {
      unsubs.forEach(u => u());
      unsubAssignments();
      unsubExams();
    };
  }, [
    activeYearStr,
    canViewAllSubjects,
    currentTeacher?.id,
    currentTeacherId,
    semester,
    teacherIdentityKeys,
  ]);

  // ── Submissions: one-shot fetch scoped to known assignment IDs ───────────────
  // assignment_submissions has no academicYearId field — filter by assignmentId instead
  useEffect(() => {
    if (assignmentIds.length === 0) { setSubmissions([]); return; }
    let cancelled = false;
    async function fetchSubmissions() {
      const all: AssignmentSubmission[] = [];
      for (const chunk of chunkArray(assignmentIds, 30)) {
        if (cancelled) return;
        const snap = await getDocs(
          query(collection(db, 'assignment_submissions'), where('assignmentId', 'in', chunk)),
        );
        snap.docs.forEach(d => all.push({ id: d.id, ...d.data() } as AssignmentSubmission));
      }
      if (!cancelled) setSubmissions(all);
    }
    fetchSubmissions();
    return () => { cancelled = true; };
  }, [assignmentIds, submissionsVersion]);

  // ── Exam scores: one-shot fetch scoped to known exam IDs ─────────────────────
  // exam_scores has no academicYearId field — filter by examId instead
  useEffect(() => {
    if (examIds.length === 0) { setExamScores([]); return; }
    let cancelled = false;
    async function fetchExamScores() {
      const all: ExamScore[] = [];
      for (const chunk of chunkArray(examIds, 30)) {
        if (cancelled) return;
        const snap = await getDocs(
          query(collection(db, 'exam_scores'), where('examId', 'in', chunk)),
        );
        snap.docs.forEach(d => all.push({ id: d.id, ...d.data() } as ExamScore));
      }
      if (!cancelled) setExamScores(all);
    }
    fetchExamScores();
    return () => { cancelled = true; };
  }, [examIds, examScoresVersion]);

  // ── ATTENDANCE CRUD ──────────────────────────────────────────────────────────

  const saveAttendanceSession = async (records: NewAttendanceRecord[]) => {
    if (records.length === 0) return;

    const batch = writeBatch(db);
    const recordedAt = new Date().toISOString();

    const toDocId = (input: string) => input.replace(/[^\w.-]/g, '_');
    const subjectById = new Map(mySubjects.map(subject => [subject.id, subject]));
    const grouped = new Map<string, NewAttendanceRecord[]>();

    records.forEach(record => {
      const key = `${record.date}|${record.classId}|${record.subjectId}|${record.period}|${record.teacherId}|${record.academicYearId}|${record.semester}`;
      const bucket = grouped.get(key) ?? [];
      bucket.push(record);
      grouped.set(key, bucket);
    });

    grouped.forEach(sessionRecords => {
      const seed = sessionRecords[0];
      const sessionDocId = `${seed.date}_${toDocId(seed.classId)}_${toDocId(seed.subjectId)}_${seed.period}`;
      const sessionRef = doc(db, 'class_sessions', sessionDocId);

      const attendanceItems: StudentAttendance[] = sessionRecords.map(record => ({
        studentId: record.studentId,
        status: record.status,
        note: record.note ?? '',
      }));

      const presentStudentIds = sessionRecords.filter(r => r.status === 'present').map(r => r.studentId);
      const absentStudentIds = sessionRecords.filter(r => r.status === 'absent').map(r => r.studentId);
      const lateStudentIds = sessionRecords.filter(r => r.status === 'late').map(r => r.studentId);
      const excusedStudentIds = sessionRecords.filter(r => r.status === 'excused').map(r => r.studentId);
      const leaveStudentIds = sessionRecords.filter(r => r.status === 'leave').map(r => r.studentId);

      const summary = {
        present: presentStudentIds.length,
        late: lateStudentIds.length,
        absent: absentStudentIds.length,
        leave: leaveStudentIds.length + excusedStudentIds.length,
      };

      const subject = subjectById.get(seed.subjectId);

      batch.set(
        sessionRef,
        {
          scheduleId: sessionDocId,
          subjectId: seed.subjectId,
          subjectName: seed.subjectName,
          subjectCode: subject?.code ?? '',
          classId: seed.classId,
          className: seed.className,
          teacherId: seed.teacherId,
          teacherName: currentTeacher?.name ?? '',
          departmentId: seed.departmentId,
          academicYearId: seed.academicYearId,
          semester: seed.semester,
          date: seed.date,
          period: seed.period,
          topic: '',
          summary,
          attendance: attendanceItems,
          presentStudentIds,
          absentStudentIds,
          lateStudentIds,
          excusedStudentIds,
          leaveStudentIds,
          totalStudents: sessionRecords.length,
          updatedAt: recordedAt,
          createdAt: recordedAt,
        },
        { merge: true },
      );
    });

    await batch.commit();
  };

  const getAttendanceForSession = (subjectId: string, classId: string, date: string, period: number) =>
    attendance.filter(a =>
      a.subjectId === subjectId && a.classId === classId &&
      a.date === date && Number(a.period) === Number(period),
    );

  // ── ASSIGNMENT CRUD ──────────────────────────────────────────────────────────

  const createAssignment = async (data: NewAssignment) => {
    const ref = await addDoc(collection(db, 'assignments'), {
      ...data,
      createdAt: new Date().toISOString(),
    });
    return ref.id;
  };

  const updateAssignment = async (id: string, data: Partial<Assignment>) => {
    await updateDoc(doc(db, 'assignments', id), data);
  };

  const deleteAssignment = async (id: string) => {
    await deleteDoc(doc(db, 'assignments', id));
  };

  const saveSubmissionScore = async (sub: AssignmentSubmission) => {
    await updateDoc(doc(db, 'assignment_submissions', sub.id), {
      score: sub.score,
      gradedAt: new Date().toISOString(),
      note: sub.note ?? '',
    });
    setSubmissionsVersion(v => v + 1);
  };

  const initSubmissions = async (assignmentId: string, classId: string) => {
    const students = getStudentsForClass(classId);
    const existing = submissions.filter(s => s.assignmentId === assignmentId);
    const existingIds = new Set(existing.map(s => s.studentId));
    const batch = writeBatch(db);
    students.forEach(({ student }) => {
      if (!existingIds.has(student.id)) {
        const ref = doc(collection(db, 'assignment_submissions'));
        batch.set(ref, {
          assignmentId,
          studentId: student.id,
          studentName: `${student.prefix}${student.firstName} ${student.lastName}`,
          studentCode: student.studentCode,
          photoURL: student.photoURL,
          gender: student.gender,
        } as NewAssignmentSubmission);
      }
    });
    await batch.commit();
    setSubmissionsVersion(v => v + 1);
  };

  const getSubmissionsForAssignment = (assignmentId: string) =>
    submissions.filter(s => s.assignmentId === assignmentId);

  // ── EXAM CRUD ────────────────────────────────────────────────────────────────

  const createExam = async (data: NewExam) => {
    const ref = await addDoc(collection(db, 'exams'), {
      ...data,
      createdAt: new Date().toISOString(),
    });
    return ref.id;
  };

  const updateExam = async (id: string, data: Partial<Exam>) => {
    await updateDoc(doc(db, 'exams', id), data);
  };

  const deleteExam = async (id: string) => {
    await deleteDoc(doc(db, 'exams', id));
  };

  const initExamScores = async (examId: string, classId: string) => {
    const students = getStudentsForClass(classId);
    const existing = examScores.filter(s => s.examId === examId);
    const existingIds = new Set(existing.map(s => s.studentId));
    const batch = writeBatch(db);
    students.forEach(({ student }) => {
      if (!existingIds.has(student.id)) {
        const ref = doc(collection(db, 'exam_scores'));
        batch.set(ref, {
          examId,
          studentId: student.id,
          studentName: `${student.prefix}${student.firstName} ${student.lastName}`,
          studentCode: student.studentCode,
          photoURL: student.photoURL,
          gender: student.gender,
          absent: false,
        } as NewExamScore);
      }
    });
    await batch.commit();
    setExamScoresVersion(v => v + 1);
  };

  const saveExamScore = async (score: ExamScore) => {
    await updateDoc(doc(db, 'exam_scores', score.id), {
      score: score.score,
      absent: score.absent,
      note: score.note ?? '',
      gradedAt: new Date().toISOString(),
    });
    setExamScoresVersion(v => v + 1);
  };

  const getScoresForExam = (examId: string) =>
    examScores.filter(s => s.examId === examId);

  // ── Summary Stats ────────────────────────────────────────────────────────────

  const stats = useMemo(() => ({
    totalAssignments: assignments.length,
    activeAssignments: assignments.filter(a => a.status === 'active').length,
    totalExams: exams.length,
    upcomingExams: exams.filter(e => e.status === 'scheduled' && e.examDate >= new Date().toISOString().slice(0, 10)).length,
  }), [assignments, exams]);

  return {
    // data
    attendance,
    assignments,
    submissions,
    exams,
    examScores,
    leaveRequests,
    // derived
    currentTeacher,
    mySubjects,
    stats,
    teacherIdentityKeys,
    isRosterDataLoaded: studentMgr.isDataLoaded,
    // helpers
    getStudentsForClass,
    getAttendanceForSession,
    getSubmissionsForAssignment,
    getScoresForExam,
    // attendance
    saveAttendanceSession,
    // assignments
    createAssignment,
    updateAssignment,
    deleteAssignment,
    saveSubmissionScore,
    initSubmissions,
    // exams
    createExam,
    updateExam,
    deleteExam,
    initExamScores,
    saveExamScore,
    // context
    activeYearStr,
    semester,
    classes: activeClasses,
    yearClasses,
    teachers: memoizedTeachers,
  };
}
