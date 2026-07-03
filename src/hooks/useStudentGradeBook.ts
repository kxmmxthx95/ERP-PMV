import { useCallback, useEffect, useMemo, useState } from 'react';
import { collection, collectionGroup, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { useActiveAcademicYear } from '@/hooks/useActiveAcademicYear';
import { useCurriculum } from '@/hooks/useCurriculum';
import { useCurriculumVersioned } from '@/hooks/useCurriculumVersioned';
import { resolveStudentByAuthUser } from '@/lib/resolveStudentProfile';
import { whenFirestoreGatewayOpen } from '@/lib/firestoreShared/bootstrap';
import type { ClassRoom } from '@/types/class';
import type { GradeLetter, GradeRecord, GradeWeightConfig } from '@/types/grades';
import type { AttendanceStatus, Exam, ExamScore } from '@/types/teaching';
import type { Student } from '@/types/student';
import type { Subject } from '@/types/curriculum';
import type { CurriculumCourse } from '@/types/curriculum';
import type { ExamAttempt, ExamRoom } from '@/types/exam';
import { CATEGORY_CONFIG } from '@/types/curriculum';
import { calcStudentSubjectAttendancePct } from '@/features/grades/utils/studentSubjectAttendanceHistory';
import {
  DEFAULT_THRESHOLDS,
  DEFAULT_WEIGHTS,
  rawPointsToPercent,
  averagePercentScores,
} from '@/types/grades';
import { attemptScorePercent } from '@/lib/exam/examRoomScoring';
import { scoreCollectionTypeToGradeField, normalizeExamScore } from '@/lib/students/studentIdentity';

function calcGrade(pct: number, thresholds: { minScore: number; grade: GradeLetter }[]): GradeLetter {
  const sorted = [...thresholds].sort((a, b) => b.minScore - a.minScore);
  for (const t of sorted) {
    if (pct >= t.minScore) return t.grade;
  }
  return 'F';
}


function looksLikeUnresolvedSubjectId(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  if (/[\u0E00-\u0E7F]/.test(trimmed)) return false;
  return /^[A-Za-z0-9_-]{16,}$/.test(trimmed);
}

function curriculumCourseToSubject(course: CurriculumCourse): Subject {
  const department = course.department === 'early' || course.department === 'primary' || course.department === 'secondary'
    ? course.department
    : 'secondary';
  const category = course.category === 'basic' ? 'core' : course.category === 'additional' ? 'added' : 'activity';
  return {
    id: course.id,
    code: course.courseCode ?? '',
    name: course.courseName,
    credits: course.credit || 0,
    hoursPerWeek: course.periodsPerWeek ?? 1,
    totalHours: course.totalHours ?? 0,
    department,
    category,
    subjectGroup: course.subjectGroup,
    gradeLevel: course.gradeLevel,
  };
}

function mergeCoursesIntoSubjectMap(map: Map<string, Subject>, courses: CurriculumCourse[]): void {
  courses.forEach((course) => {
    if (map.has(course.id)) return;
    map.set(course.id, curriculumCourseToSubject(course));
  });
}

export interface StudentSubjectGradeCard {
  key: string;
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  subjectGroup?: string;
  semester: 1 | 2;
  category: string;
  categoryLabel: string;
  attendancePct: number | null;
  totalScore: number | null;
  grade: GradeLetter | null;
  classId: string;
  className: string;
}

function calcAttendancePct(
  studentId: string,
  subjectId: string,
  semester: 1 | 2,
  sessions: Array<{
    id?: string;
    subjectId?: string;
    semester?: 1 | 2;
    date?: string;
    period?: number;
    attendance?: Array<{ studentId: string; status: AttendanceStatus; note?: string }>;
  }>,
  scheduleSlots: Array<{ day: number; period: number; subjectId?: string; semester?: 1 | 2 }>,
  rangeStart: string,
  rangeEnd: string,
  academicYearId: string,
): number | null {
  const scopedSessions = sessions.map((session) => ({
    id: session.id ?? `${session.date ?? ''}_${session.period ?? 0}`,
    ...session,
  }));
  const scopedSlots = scheduleSlots
    .filter((slot) => slot.subjectId === subjectId && (slot.semester ?? semester) === semester)
    .map((slot) => ({ day: slot.day, period: slot.period }));

  return calcStudentSubjectAttendancePct(
    studentId,
    subjectId,
    semester,
    scopedSessions,
    scopedSlots,
    rangeStart,
    rangeEnd,
    academicYearId,
  );
}

export function useStudentGradeBook() {
  const { user, userData } = useAuth();
  const { year: academicYear, activeYear } = useActiveAcademicYear();
  const yearStartDate = activeYear?.startDate ?? '';
  const yearEndDate = activeYear?.endDate ?? '';
  const { subjects, isLoading: subjectsLoading } = useCurriculum();
  const { coursesByVersion, loadCoursesForVersion } = useCurriculumVersioned();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [student, setStudent] = useState<Student | null>(null);
  const [classRoom, setClassRoom] = useState<ClassRoom | null>(null);
  const [subjectCards, setSubjectCards] = useState<StudentSubjectGradeCard[]>([]);

  const subjectById = useMemo(() => {
    const map = new Map<string, Subject>();
    subjects.forEach((s) => map.set(s.id, s));
    Object.values(coursesByVersion).flat().forEach((course) => {
      if (map.has(course.id)) return;
      map.set(course.id, curriculumCourseToSubject(course));
    });
    return map;
  }, [subjects, coursesByVersion]);

  const reload = useCallback(async () => {
    if (!user?.uid || !academicYear) {
      setStudent(null);
      setClassRoom(null);
      setSubjectCards([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    let keepLoading = false;

    try {
      await whenFirestoreGatewayOpen();

      const resolvedStudent = await resolveStudentByAuthUser(user.uid, {
        studentCode: typeof userData?.studentCode === 'string' ? userData.studentCode : undefined,
        email: user.email ?? undefined,
      });

      if (!resolvedStudent) {
        setStudent(null);
        setClassRoom(null);
        setSubjectCards([]);
        setError('ไม่พบข้อมูลนักเรียนที่ผูกกับบัญชีนี้');
        return;
      }

      const enrollmentSnap = await getDocs(
        query(collection(db, 'enrollments'), where('studentId', '==', resolvedStudent.id)),
      );
      const enrollmentRows = enrollmentSnap.docs.map((d) => d.data() as {
        classId?: string;
        academicYearId?: string;
        academicYear?: string;
        semester?: 1 | 2;
        enrolledAt?: string;
      }).filter((row) => row.classId);

      const sortedEnrollments = [...enrollmentRows].sort((a, b) => {
        const yearA = Number(a.academicYearId ?? a.academicYear ?? 0);
        const yearB = Number(b.academicYearId ?? b.academicYear ?? 0);
        if (yearA !== yearB) return yearB - yearA;
        return (b.enrolledAt ?? '').localeCompare(a.enrolledAt ?? '');
      });

      const yearEnrollment = sortedEnrollments.find(
        (row) => String(row.academicYearId ?? row.academicYear) === String(academicYear),
      ) ?? sortedEnrollments[0];

      const studentWithClass = resolvedStudent as Student & { classroomId?: string; classId?: string };
      const classId = yearEnrollment?.classId || studentWithClass.classroomId || studentWithClass.classId || '';

      if (!classId) {
        setStudent(resolvedStudent);
        setClassRoom(null);
        setSubjectCards([]);
        setError('ยังไม่ได้ลงทะเบียนชั้นเรียน');
        return;
      }

      const classSnap = await getDoc(doc(db, 'classes', classId));
      if (!classSnap.exists()) {
        setStudent(resolvedStudent);
        setClassRoom(null);
        setSubjectCards([]);
        setError('ไม่พบข้อมูลห้องเรียน');
        return;
      }

      const cls = { id: classSnap.id, ...classSnap.data() } as ClassRoom;
      setStudent(resolvedStudent);
      setClassRoom(cls);

      const packageId = cls.curriculumPackageId ?? (cls as { curriculumId?: string }).curriculumId;
      const localSubjectMap = new Map(subjectById);
      if (packageId) {
        const courses = await loadCoursesForVersion(packageId);
        mergeCoursesIntoSubjectMap(localSubjectMap, courses);
      }

      const [
        sessionsSnap,
        gradeSnap,
        schedulesSnap,
        configsSnap,
        examsSnap,
        examScoresSnap,
        roomsByClassSnap,
        roomsByGradeSnap,
        attemptsSnap,
      ] = await Promise.all([
        getDocs(query(
          collection(db, 'class_sessions'),
          where('classId', '==', classId),
          where('academicYearId', '==', String(academicYear)),
        )).catch(() => null),
        getDocs(query(
          collection(db, 'grade_records'),
          where('classId', '==', classId),
          where('academicYearId', '==', String(academicYear)),
        )).catch(() => null),
        getDocs(query(
          collection(db, 'schedules'),
          where('year', '==', String(academicYear)),
          where('classId', '==', classId),
        )).catch(() => null),
        getDocs(query(
          collection(db, 'grade_configs'),
          where('classId', '==', classId),
          where('academicYearId', '==', String(academicYear)),
        )).catch(() => null),
        getDocs(query(
          collection(db, 'exams'),
          where('classId', '==', classId),
          where('academicYearId', '==', String(academicYear)),
        )).catch(() => null),
        getDocs(query(
          collection(db, 'exam_scores'),
          where('studentId', 'in', Array.from(new Set([resolvedStudent.id, user.uid].filter(Boolean)))),
        )).catch(() => null),
        getDocs(query(
          collection(db, 'exam_rooms'),
          where('classId', '==', classId),
          where('academicYearId', '==', String(academicYear)),
        )).catch(() => null),
        cls.gradeLevel
          ? getDocs(query(
              collection(db, 'exam_rooms'),
              where('gradeLevel', '==', cls.gradeLevel),
              where('academicYearId', '==', String(academicYear)),
            )).catch(() => null)
          : Promise.resolve(null),
        getDocs(query(
          collectionGroup(db, 'attempts'),
          where('studentId', 'in', Array.from(new Set([resolvedStudent.id, user.uid].filter(Boolean)))),
        )).catch(() => null),
      ]);

      const sessionDocs = sessionsSnap?.docs.map((d) => ({ id: d.id, ...d.data() })) ?? [];
      const scheduleSlots = (schedulesSnap?.docs ?? []).map((d) => {
        const data = d.data() as {
          day?: number;
          dayOfWeek?: number;
          period?: number;
          subjectId?: string;
          semester?: 1 | 2;
        };
        return {
          day: data.day ?? data.dayOfWeek ?? 0,
          period: data.period ?? 0,
          subjectId: data.subjectId,
          semester: data.semester,
        };
      });

      const gradeRecords: GradeRecord[] = (gradeSnap?.docs ?? [])
        .map((d) => ({ id: d.id, ...d.data() } as GradeRecord))
        .filter((record) => record.studentId === resolvedStudent.id);

      const gradeByKey = new Map<string, GradeRecord>();
      gradeRecords.forEach((record) => {
        gradeByKey.set(`${record.subjectId}_${record.semester}`, record);
      });

      const sessionSubjectNames = new Map<string, string>();
      (sessionsSnap?.docs ?? []).forEach((d) => {
        const data = d.data() as { subjectId?: string; subjectName?: string };
        if (data.subjectId && data.subjectName && !sessionSubjectNames.has(data.subjectId)) {
          sessionSubjectNames.set(data.subjectId, data.subjectName);
        }
      });

      const configs = configsSnap?.docs.map((d) => ({ id: d.id, ...d.data() } as GradeWeightConfig)) ?? [];
      const configBySubjectSem = new Map<string, GradeWeightConfig>();
      configs.forEach((c) => {
        configBySubjectSem.set(`${c.subjectId}_${c.semester}`, c);
      });

      const exams: Exam[] = examsSnap?.docs.map((d) => ({ id: d.id, ...d.data() } as Exam)) ?? [];
      const examScores: ExamScore[] = examScoresSnap?.docs.map((d) => ({ id: d.id, ...d.data() } as ExamScore)) ?? [];

      const normalizeTs = (val: unknown): number => {
        if (typeof val === 'number') return val;
        if (val && typeof (val as { toMillis?: () => number }).toMillis === 'function') {
          return (val as { toMillis: () => number }).toMillis();
        }
        return 0;
      };

      const rooms = [
        ...(roomsByClassSnap?.docs ?? []),
        ...(roomsByGradeSnap?.docs.filter((d) => !roomsByClassSnap?.docs.some((c) => c.id === d.id)) ?? []),
      ].map((d) => {
        const raw = d.data();
        return {
          ...raw,
          id: d.id,
          startTime: normalizeTs(raw.startTime),
          endTime: normalizeTs(raw.endTime),
        } as ExamRoom;
      });

      const studentAttempts = attemptsSnap?.docs.map((d) => {
        const raw = d.data();
        return {
          ...raw,
          id: d.id,
          roomId: d.ref.parent.parent?.id ?? '',
          score: normalizeExamScore(raw.score),
        } as ExamAttempt;
      }) ?? [];

      const cards: StudentSubjectGradeCard[] = [];
      const seen = new Set<string>();

      ([1, 2] as const).forEach((semester) => {
        (cls.enrolledCourses ?? []).forEach((ec) => {
          if (ec.semester != null && ec.semester !== semester) return;
          const key = `${ec.subjectId}_${semester}`;
          if (seen.has(key)) return;
          seen.add(key);

          const subject = localSubjectMap.get(ec.subjectId);
          const grade = gradeByKey.get(key);
          const resolvedName = subject?.name
            ?? grade?.subjectName
            ?? sessionSubjectNames.get(ec.subjectId)
            ?? '';
          const category = subject?.category ?? 'core';
          const catCfg = CATEGORY_CONFIG[category as keyof typeof CATEGORY_CONFIG]
            ?? { label: category, color: '#64748b', bg: '#f1f5f9' };

          // ── Dynamic Grade Calculation ──
          let totalScore: number | null = null;
          let calculatedGrade: GradeLetter | null = null;

          if (grade) {
            totalScore = grade.totalScore ?? null;
            calculatedGrade = grade.grade ?? null;
          } else {
            // Find grade config for this subject & semester
            const cfg = configBySubjectSem.get(`${ec.subjectId}_${semester}`) || {
              weights: DEFAULT_WEIGHTS,
              thresholds: DEFAULT_THRESHOLDS,
            };

            // Get offline exams for this subject & semester
            const subjectExams = exams.filter((e) => e.subjectId === ec.subjectId && e.semester === semester);
            const subjectExamIds = subjectExams.map((e) => e.id);

            // Get offline exam scores for this student
            const scores = examScores.filter((s) => subjectExamIds.includes(s.examId));
            const scoresByExamId = new Map(scores.map((s) => [s.examId, s]));

            // Filter exams by type
            const examsByType = new Map<string, Exam[]>();
            subjectExams.forEach((e) => {
              const arr = examsByType.get(e.type) ?? [];
              arr.push(e);
              examsByType.set(e.type, arr);
            });

            const getLatestOfflineScore = (examType: string): number | null => {
              const typeExams = examsByType.get(examType) ?? [];
              if (typeExams.length === 0) return null;
              const sorted = [...typeExams].sort((a, b) => b.examDate.localeCompare(a.examDate));
              for (const exam of sorted) {
                const sc = scoresByExamId.get(exam.id);
                if (sc && !sc.absent && sc.score !== undefined) {
                  return rawPointsToPercent(sc.score, exam.maxScore);
                }
              }
              return null;
            };

            // Calculate offline classwork scores
            const classworkOfflinePcts: number[] = [];
            const classworkExams = [...(examsByType.get('quiz') ?? []), ...(examsByType.get('makeup') ?? [])];
            classworkExams.forEach((exam) => {
              const sc = scoresByExamId.get(exam.id);
              if (sc && !sc.absent && sc.score !== undefined) {
                classworkOfflinePcts.push(rawPointsToPercent(sc.score, exam.maxScore));
              }
            });

            // Get online exam rooms for this subject & semester
            const subjectOnlineRooms = rooms.filter((room) => {
              const linked = room.settings?.gradeBookSubjects ?? [];
              if (linked.length > 0) {
                return linked.some((item) => item.subjectId === ec.subjectId);
              }
              const legacyId = room.settings?.gradeBookSubjectId ?? room.subjectId;
              return legacyId === ec.subjectId;
            });

            // Map of attempts for this student, grouped by roomId
            const attemptsByRoomId = new Map<string, ExamAttempt[]>();
            studentAttempts.forEach((att) => {
              const arr = attemptsByRoomId.get(att.roomId) ?? [];
              arr.push(att);
              attemptsByRoomId.set(att.roomId, arr);
            });

            // Get online score percentages
            const classworkOnlinePcts: number[] = [];
            let midtermOnlinePct: number | null = null;
            let finalOnlinePct: number | null = null;

            subjectOnlineRooms.forEach((room) => {
              // Check if room score linking is enabled
              if (room.settings?.scoreCollectionLinked === false) return;
              if (room.settings?.scoreCollectionEnabled === false) return;

              const collectionType = room.settings?.scoreCollectionType
                ?? room.settings?.gradeBookScoreType
                ?? 'classwork';
              const field = scoreCollectionTypeToGradeField(collectionType);

              const roomAttempts = attemptsByRoomId.get(room.id) ?? [];
              if (roomAttempts.length === 0) return;

              // Find best attempt
              const bestPct = roomAttempts
                .map((att) => attemptScorePercent(room, att))
                .filter((pct): pct is number => pct !== null)
                .sort((a, b) => b - a)[0] ?? null;

              if (bestPct !== null) {
                if (field === 'classworkScore') {
                  classworkOnlinePcts.push(bestPct);
                } else if (field === 'midtermScore') {
                  midtermOnlinePct = midtermOnlinePct !== null ? Math.max(midtermOnlinePct, bestPct) : bestPct;
                } else if (field === 'finalScore') {
                  finalOnlinePct = finalOnlinePct !== null ? Math.max(finalOnlinePct, bestPct) : bestPct;
                }
              }
            });

            // Combine offline and online scores
            const classworkPcts = [...classworkOfflinePcts, ...classworkOnlinePcts];
            const classworkScore = averagePercentScores(classworkPcts);

            const midtermOffline = getLatestOfflineScore('midterm');
            const midtermScore = midtermOnlinePct !== null
              ? (midtermOffline !== null ? Math.max(midtermOffline, midtermOnlinePct) : midtermOnlinePct)
              : midtermOffline;

            const finalOffline = getLatestOfflineScore('final');
            const finalScore = finalOnlinePct !== null
              ? (finalOffline !== null ? Math.max(finalOffline, finalOnlinePct) : finalOnlinePct)
              : finalOffline;

            // Recalculate totals
            if (classworkScore !== null || midtermScore !== null || finalScore !== null) {
              const weights = cfg.weights ?? DEFAULT_WEIGHTS;
              const wCw = (weights.classwork ?? 0) / 100;
              const wMid = (weights.midterm ?? 0) / 100;
              const wFin = (weights.final ?? 0) / 100;

              let weightedSum = 0;
              if (classworkScore !== null) weightedSum += classworkScore * wCw;
              if (midtermScore !== null) weightedSum += midtermScore * wMid;
              if (finalScore !== null) weightedSum += finalScore * wFin;

              totalScore = Math.round(weightedSum * 10) / 10;
              calculatedGrade = calcGrade(totalScore, cfg.thresholds ?? DEFAULT_THRESHOLDS);
            }
          }

          cards.push({
            key,
            subjectId: ec.subjectId,
            subjectName: resolvedName || ec.subjectId,
            subjectCode: subject?.code ?? grade?.subjectCode ?? '',
            subjectGroup: subject?.subjectGroup,
            semester,
            category,
            categoryLabel: catCfg.label,
            attendancePct: calcAttendancePct(
              resolvedStudent.id,
              ec.subjectId,
              semester,
              sessionDocs,
              scheduleSlots,
              yearStartDate,
              yearEndDate,
              String(academicYear),
            ),
            totalScore,
            grade: calculatedGrade,
            classId,
            className: cls.className,
          });
        });
      });


      const metadataReady = cards.every(
        (card) => !looksLikeUnresolvedSubjectId(card.subjectName),
      );

      cards.sort((a, b) => {
        if (a.semester !== b.semester) return a.semester - b.semester;
        return (a.subjectCode || a.subjectName).localeCompare(b.subjectCode || b.subjectName, 'th', { numeric: true });
      });

      if (!metadataReady) {
        // Keep spinner only while subject metadata may still arrive
        keepLoading = subjectsLoading;
        setSubjectCards(keepLoading ? [] : cards);
      } else {
        setSubjectCards(cards);
      }
    } catch (err) {
      console.error('[useStudentGradeBook]', err);
      setError('โหลดข้อมูลสมุดคะแนนไม่สำเร็จ');
    } finally {
      setLoading(keepLoading);
    }
  }, [user?.uid, user?.email, userData?.studentCode, academicYear, yearStartDate, yearEndDate, subjectById, loadCoursesForVersion, subjectsLoading]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return {
    loading,
    error,
    student,
    classRoom,
    subjectCards,
    academicYear,
    yearStartDate,
    yearEndDate,
    reload,
  };
}
