/**
 * สร้างเมทริกซ์ GPA ห้องเรียน × รายวิชา — คำนวณเพื่อแสดงบน Dashboard เท่านั้น
 * - ไม่เขียน grade_records (ไม่กระทบสมุดครู)
 * - logic เดียวกับสมุดคะแนน (displaySummaries):
 *   base = grade_records ถ้ามี · ไม่งั้น exams/exam_scores
 *   แล้ว merge ห้องสอบออนไลน์ที่เชื่อมสมุด → คิดเกรดจากคะแนนรวม
 * - ข้ามวิชากิจกรรม (ผ่าน/ไม่ผ่าน)
 */
import {
  collection,
  collectionGroup,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  averagePercentScores,
  DEFAULT_THRESHOLDS,
  DEFAULT_WEIGHTS,
  gradeLetterToGpa,
  rawPointsToPercent,
  type GradeLetter,
  type GradeRecord,
  type GradeThreshold,
  type GradeWeightConfig,
} from '@/types/grades';
import { GRADE_LEVEL_ORDER, type ClassRoom, type EnrolledCourse } from '@/types/class';
import type { Exam, ExamScore } from '@/types/teaching';
import type { ExamAttempt, ExamRoom } from '@/types/exam';
import type { Student } from '@/types/student';
import {
  SUBJECT_GROUP_CONFIG,
  type SubjectGroupId,
} from '@/types/curriculum';
import { chunkIds } from '@/lib/firestoreShared/fetchStudentsByIds';
import {
  buildStudentLookup,
  resolveStudentsByFeeIds,
} from '@/features/tuition/utils/studentFeeDisplay';
import { getBestPercentByStudent } from '@/lib/exam/examRoomScoring';
import {
  buildStudentIdentityLookup,
  findScoreRecordForStudent,
  scoreCollectionTypeToGradeField,
} from '@/lib/students/studentIdentity';
import type {
  GradeAssessmentCell,
  GradeAssessmentClassRow,
  GradeAssessmentMatrix,
  GradeAssessmentRow,
  GradeAssessmentStudentCell,
  GradeAssessmentStudentRow,
  GradeAssessmentSubjectCol,
} from '@/types/academicGradeAssessment';

/** ตัวอักษที่ใช้คิด GPA เฉลี่ย — ไม่รวม ร / มส / 0 */
const GPA_AVG_LETTERS = new Set(['A', 'B+', 'B', 'C+', 'C', 'D+', 'D', 'F']);

type CategoryScores = {
  classworkScore: number | null;
  midtermScore: number | null;
  finalScore: number | null;
};

type OnlineLinkedFields = {
  classwork: boolean;
  midterm: boolean;
  final: boolean;
};

type OnlineBundle = {
  byStudent: Map<string, CategoryScores>;
  linkedFields: OnlineLinkedFields;
};

function isGpaLetter(grade: string | null | undefined): grade is GradeLetter {
  return !!grade && GPA_AVG_LETTERS.has(String(grade).trim());
}

/** ม1 / ม.1 / ม. 1 / ม๑ → ม.1 */
function normalizeGradeLevel(raw: string | undefined | null): string {
  const original = String(raw ?? '').trim();
  if (!original) return '—';
  const thaiDigits: Record<string, string> = {
    '๐': '0', '๑': '1', '๒': '2', '๓': '3', '๔': '4',
    '๕': '5', '๖': '6', '๗': '7', '๘': '8', '๙': '9',
  };
  const head = original
    .split('/')[0]
    .trim()
    .replace(/\s+/g, '')
    .replace(/[๐-๙]/g, (d) => thaiDigits[d] ?? d);
  const m = head.match(/^(ม|ป|อ)\.?(\d+)$/i);
  if (m) return `${m[1]}.${m[2]}`;
  // className แบบ "1" ในแผนกมัธยม — ไม่เดา; คืนค่าเดิมหลังตัด /
  return original.split('/')[0].trim() || '—';
}

function addStudentToClass(
  studentsByClass: Map<string, string[]>,
  classId: string,
  studentId: string,
) {
  const cid = String(classId ?? '').trim();
  const sid = String(studentId ?? '').trim();
  if (!cid || !sid) return;
  const arr = studentsByClass.get(cid) ?? [];
  if (!arr.includes(sid)) arr.push(sid);
  studentsByClass.set(cid, arr);
}

function calcGrade(pct: number, thresholds: GradeThreshold[]): GradeLetter {
  const sorted = [...thresholds].sort((a, b) => b.minScore - a.minScore);
  for (const t of sorted) {
    if (pct >= t.minScore) return t.grade;
  }
  return 'F';
}

function gradeFromScores(
  scores: CategoryScores,
  thresholds: GradeThreshold[],
  weights: { classwork: number; midterm: number; final: number },
): GradeLetter | null {
  const wCw = (weights.classwork ?? 0) / 100;
  const wMid = (weights.midterm ?? 0) / 100;
  const wFin = (weights.final ?? 0) / 100;

  let weightedSum = 0;
  let hasAny = false;
  if (scores.classworkScore !== null) {
    weightedSum += scores.classworkScore * wCw;
    hasAny = true;
  }
  if (scores.midtermScore !== null) {
    weightedSum += scores.midtermScore * wMid;
    hasAny = true;
  }
  if (scores.finalScore !== null) {
    weightedSum += scores.finalScore * wFin;
    hasAny = true;
  }
  if (!hasAny) return null;
  return calcGrade(Math.round(weightedSum * 10) / 10, thresholds);
}

/** รวมออนไลน์ทับช่องที่เชื่อม — เหมือน mergeOnlineExamScores ในสมุดคะแนน */
function mergeOnlineIntoScores(
  base: CategoryScores,
  online: CategoryScores | undefined,
  linked: OnlineLinkedFields,
): CategoryScores {
  if (!online) return base;
  return {
    classworkScore: linked.classwork
      ? (online.classworkScore ?? base.classworkScore)
      : base.classworkScore,
    midtermScore: linked.midterm
      ? (online.midtermScore ?? base.midtermScore)
      : base.midtermScore,
    finalScore: linked.final
      ? (online.finalScore ?? base.finalScore)
      : base.finalScore,
  };
}

function courseMatchesSemester(ec: EnrolledCourse, semester: 1 | 2): boolean {
  return ec.semester == null || Number(ec.semester) === Number(semester);
}

function shouldSyncExamRoomScores(room: ExamRoom): boolean {
  if (room.settings?.scoreCollectionLinked === false) return false;
  if (room.settings?.scoreCollectionEnabled === true) return true;
  if (room.settings?.scoreCollectionEnabled === false) return false;
  return (
    (room.settings?.gradeBookSubjects?.length ?? 0) > 0
    || !!room.settings?.gradeBookSubjectId
  );
}

function roomLinkedSubjectIds(room: ExamRoom): string[] {
  const linked = room.settings?.gradeBookSubjects ?? [];
  if (linked.length > 0) {
    return [...new Set(linked.map((s) => s.subjectId).filter(Boolean))];
  }
  if (room.settings?.gradeBookSubjectId) {
    return [room.settings.gradeBookSubjectId];
  }
  if (
    room.subjectId
    && (
      room.settings?.scoreCollectionEnabled === true
      || room.settings?.scoreCollectionLinked === false
    )
  ) {
    return [room.subjectId];
  }
  return [];
}

function roomAppliesToClass(room: ExamRoom, cls: ClassRoom): boolean {
  if (room.classId && room.classId === cls.id) return true;
  if (room.gradeLevel) {
    const roomLv = normalizeGradeLevel(room.gradeLevel);
    const classLv = normalizeGradeLevel(cls.gradeLevel || cls.className);
    if (roomLv !== '—' && roomLv === classLv) return true;
  }
  return false;
}

function normalizeExamTs(val: unknown): number {
  if (typeof val === 'number') return val;
  if (val && typeof (val as { toMillis?: () => number }).toMillis === 'function') {
    return (val as { toMillis: () => number }).toMillis();
  }
  if (val && typeof (val as { seconds?: number }).seconds === 'number') {
    return (val as { seconds: number; nanoseconds?: number }).seconds * 1000
      + ((val as { nanoseconds?: number }).nanoseconds ?? 0) / 1e6;
  }
  return 0;
}

function offlineScoresFromExams(
  student: { id: string; studentCode?: string; authUid?: string; userId?: string; email?: string },
  exams: Exam[],
  scoresByExamId: Map<string, Map<string, ExamScore>>,
  identityLookup: Map<string, string>,
): CategoryScores {
  if (exams.length === 0) {
    return { classworkScore: null, midtermScore: null, finalScore: null };
  }

  const examByType = new Map<string, Exam[]>();
  exams.forEach((e) => {
    const arr = examByType.get(e.type) ?? [];
    arr.push(e);
    examByType.set(e.type, arr);
  });

  const getLatest = (examType: string): number | null => {
    const typeExams = examByType.get(examType) ?? [];
    if (typeExams.length === 0) return null;
    const sorted = [...typeExams].sort((a, b) => b.examDate.localeCompare(a.examDate));
    for (const exam of sorted) {
      const examScores = scoresByExamId.get(exam.id);
      if (!examScores) continue;
      const sc = findScoreRecordForStudent(examScores, student, identityLookup);
      if (sc && !sc.absent && sc.score !== undefined) {
        return rawPointsToPercent(sc.score, exam.maxScore);
      }
    }
    return null;
  };

  const classworkExams = [...(examByType.get('quiz') ?? []), ...(examByType.get('makeup') ?? [])];
  const classworkPcts: number[] = [];
  classworkExams.forEach((exam) => {
    const examScores = scoresByExamId.get(exam.id);
    if (!examScores) return;
    const sc = findScoreRecordForStudent(examScores, student, identityLookup);
    if (sc && !sc.absent && sc.score !== undefined) {
      classworkPcts.push(rawPointsToPercent(sc.score, exam.maxScore));
    }
  });

  return {
    classworkScore: averagePercentScores(classworkPcts),
    midtermScore: getLatest('midterm'),
    finalScore: getLatest('final'),
  };
}

function emptyOnlineBundle(): OnlineBundle {
  return {
    byStudent: new Map(),
    linkedFields: { classwork: false, midterm: false, final: false },
  };
}

function ensureOnlineBundle(map: Map<string, OnlineBundle>, key: string): OnlineBundle {
  const cur = map.get(key) ?? emptyOnlineBundle();
  map.set(key, cur);
  return cur;
}

function sortGradeLevels(a: string, b: string): number {
  return (GRADE_LEVEL_ORDER[a] ?? 999) - (GRADE_LEVEL_ORDER[b] ?? 999)
    || a.localeCompare(b, 'th');
}

type SubjectMeta = {
  id: string;
  name: string;
  code: string;
  category: string;
  subjectGroupId: SubjectGroupId;
};

/** ลำดับหัวตารางตามที่ขอ: คณิต → วิทย์ → ภาษาต่างประเทศ → ภาษาไทย → สังคม → อื่นๆ */
const MATRIX_GROUP_ORDER: SubjectGroupId[] = [
  'math',
  'science',
  'foreign',
  'thai',
  'social',
  'pe',
  'arts',
  'careers',
  'examM4',
  'onet',
  'alevel',
  'other',
];

function groupOrderIndex(id: SubjectGroupId | undefined): number {
  const i = MATRIX_GROUP_ORDER.indexOf(id ?? 'other');
  return i >= 0 ? i : MATRIX_GROUP_ORDER.length;
}

function resolveSubjectGroupId(
  rawId: string | undefined,
  rawLabel: string | undefined,
  name: string,
  code: string,
): SubjectGroupId {
  const id = String(rawId ?? '').trim();
  if (id && id in SUBJECT_GROUP_CONFIG) return id as SubjectGroupId;

  const label = String(rawLabel ?? '').trim().toLowerCase();
  if (label) {
    for (const [gid, cfg] of Object.entries(SUBJECT_GROUP_CONFIG) as [SubjectGroupId, { name: string; nameEn: string }][]) {
      const n = cfg.name.toLowerCase();
      const en = cfg.nameEn.toLowerCase();
      if (label === n || label === en || n.includes(label) || label.includes(n.split(' ')[0]!)) {
        return gid;
      }
    }
    if (label.includes('คณิต')) return 'math';
    if (label.includes('วิทยา') || label.includes('science')) return 'science';
    if (label.includes('ต่างประเทศ') || label.includes('อังกฤษ') || label.includes('english')) return 'foreign';
    if (label.includes('ไทย') && !label.includes('ต่าง')) return 'thai';
    if (label.includes('สังคม')) return 'social';
  }

  const codeHead = String(code ?? '').trim().charAt(0);
  const codeMap: Record<string, SubjectGroupId> = {
    ท: 'thai',
    ค: 'math',
    ว: 'science',
    ส: 'social',
    อ: 'foreign',
    พ: 'pe',
    ศ: 'arts',
    ง: 'careers',
  };
  if (codeHead && codeMap[codeHead]) return codeMap[codeHead]!;

  const nm = String(name ?? '').toLowerCase();
  if (nm.includes('คณิต')) return 'math';
  if (nm.includes('ฟิสิกส์') || nm.includes('เคมี') || nm.includes('ชีว') || nm.includes('วิทยา')) return 'science';
  if (nm.includes('อังกฤษ') || nm.includes('english') || nm.includes('จีน') || nm.includes('ญี่ปุ่น')) return 'foreign';
  if (nm.includes('ไทย') && !nm.includes('ต่าง')) return 'thai';
  if (nm.includes('สังคม') || nm.includes('ประวัติ') || nm.includes('ภูมิศาสตร์')) return 'social';

  return 'other';
}

function resolveCategory(raw: string | undefined): string {
  if (!raw) return 'core';
  const c = String(raw).trim().toLowerCase();
  if (c === 'basic' || c === 'core' || c.includes('พื้นฐาน')) return 'core';
  if (c === 'additional' || c === 'added' || c.includes('เพิ่มเติม')) return 'added';
  if (c === 'activity' || c.includes('กิจกรรม')) return 'activity';
  return c;
}

function isActivityCategory(category: string | undefined): boolean {
  return resolveCategory(category) === 'activity';
}

async function loadSubjectMeta(): Promise<Map<string, SubjectMeta>> {
  const map = new Map<string, SubjectMeta>();

  const subjectsSnap = await getDocs(collection(db, 'subjects')).catch(() => null);
  subjectsSnap?.docs.forEach((d) => {
    const data = d.data() as {
      name?: string;
      code?: string;
      category?: string;
      subjectGroup?: string;
      subjectGroupId?: string;
    };
    const name = data.name ?? d.id;
    const code = data.code ?? '';
    map.set(d.id, {
      id: d.id,
      name,
      code,
      category: resolveCategory(data.category),
      subjectGroupId: resolveSubjectGroupId(data.subjectGroupId, data.subjectGroup, name, code),
    });
  });

  const coursesSnap = await getDocs(collectionGroup(db, 'courses')).catch(() => null);
  coursesSnap?.docs.forEach((d) => {
    if (map.has(d.id)) return;
    const data = d.data() as {
      courseName?: string;
      courseCode?: string;
      category?: string;
      subjectGroup?: string;
      subjectGroupId?: string;
      isDeleted?: boolean;
      isRetired?: boolean;
    };
    if (data.isDeleted || data.isRetired) return;
    const name = data.courseName ?? d.id;
    const code = data.courseCode ?? '';
    map.set(d.id, {
      id: d.id,
      name,
      code,
      category: resolveCategory(data.category),
      subjectGroupId: resolveSubjectGroupId(data.subjectGroupId, data.subjectGroup, name, code),
    });
  });

  return map;
}

export async function fetchGradeAssessmentMatrix(params: {
  academicYearId: string;
  semester: 1 | 2;
}): Promise<GradeAssessmentMatrix> {
  const { academicYearId, semester } = params;
  const year = String(academicYearId);

  const [classesSnap, enrollSnap, recordsSnap, examsSnap, configsSnap, roomsSnap, subjectMeta] =
    await Promise.all([
      getDocs(query(collection(db, 'classes'), where('academicYearId', '==', year))),
      getDocs(query(collection(db, 'enrollments'), where('academicYearId', '==', year))),
      getDocs(query(collection(db, 'grade_records'), where('academicYearId', '==', year))),
      getDocs(
        query(
          collection(db, 'exams'),
          where('academicYearId', '==', year),
          where('semester', '==', semester),
        ),
      ).catch(() =>
        getDocs(query(collection(db, 'exams'), where('academicYearId', '==', year))).catch(
          () => null,
        ),
      ),
      getDocs(
        query(
          collection(db, 'grade_configs'),
          where('academicYearId', '==', year),
          where('semester', '==', semester),
        ),
      ).catch(() =>
        getDocs(query(collection(db, 'grade_configs'), where('academicYearId', '==', year))).catch(
          () => null,
        ),
      ),
      getDocs(
        query(
          collection(db, 'exam_rooms'),
          where('academicYearId', '==', year),
          where('semester', '==', semester),
        ),
      ).catch(() =>
        getDocs(query(collection(db, 'exam_rooms'), where('academicYearId', '==', year))).catch(
          () => null,
        ),
      ),
      loadSubjectMeta(),
    ]);

  const classes = classesSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as ClassRoom);
  const classById = new Map(classes.map((c) => [c.id, c] as const));
  const classIds = classes.map((c) => c.id).filter(Boolean);

  const studentsByClass = new Map<string, string[]>();

  // 1) enrollments ของปีนี้
  enrollSnap.docs.forEach((d) => {
    const data = d.data() as { classId?: string; studentId?: string };
    addStudentToClass(studentsByClass, String(data.classId ?? ''), String(data.studentId ?? ''));
  });

  // 2) ห้องที่ยังไม่มี roster → ดึง enrollments แบบไม่กรองปี (backward compat เหมือนสมุดคะแนน)
  const emptyRosterClassIds = classIds.filter((id) => (studentsByClass.get(id) ?? []).length === 0);
  if (emptyRosterClassIds.length > 0) {
    const fallbackSnaps = await Promise.all(
      chunkIds(emptyRosterClassIds).map((group) =>
        getDocs(query(collection(db, 'enrollments'), where('classId', 'in', group))).catch(() => null),
      ),
    );
    fallbackSnaps.forEach((snap) => {
      snap?.docs.forEach((d) => {
        const data = d.data() as { classId?: string; studentId?: string };
        addStudentToClass(studentsByClass, String(data.classId ?? ''), String(data.studentId ?? ''));
      });
    });
  }

  // 3) fallback เหมือนสมุด: student.classroomId / student.classId (additive)
  for (const group of chunkIds(classIds)) {
    const [byClassId, byClassroomId] = await Promise.all([
      getDocs(query(collection(db, 'students'), where('classId', 'in', group))).catch(() => null),
      getDocs(query(collection(db, 'students'), where('classroomId', 'in', group))).catch(() => null),
    ]);
    [...(byClassId?.docs ?? []), ...(byClassroomId?.docs ?? [])].forEach((docSnap) => {
      const data = docSnap.data() as { classId?: string; classroomId?: string };
      const cid = String(data.classroomId ?? data.classId ?? '').trim();
      if (!cid || !classById.has(cid)) return;
      addStudentToClass(studentsByClass, cid, docSnap.id);
    });
  }

  // 4) class.studentIds ถ้ามี
  classes.forEach((cls) => {
    (cls as ClassRoom & { studentIds?: string[] }).studentIds?.forEach((sid) => {
      addStudentToClass(studentsByClass, cls.id, sid);
    });
  });

  const allStudentIds = [...new Set([...studentsByClass.values()].flat())];
  // รวม studentId จาก grade_records ด้วย — กันคนที่มีคะแนนแต่ไม่โผล่ใน roster
  recordsSnap.docs.forEach((d) => {
    const data = d.data() as { studentId?: string; classId?: string; semester?: number | string };
    if (Number(data.semester) !== Number(semester)) return;
    const sid = String(data.studentId ?? '').trim();
    const cid = String(data.classId ?? '').trim();
    if (sid) allStudentIds.push(sid);
    if (sid && cid) addStudentToClass(studentsByClass, cid, sid);
  });

  const uniqueStudentIds = [...new Set(allStudentIds)];
  // studentId ในเกรด/enrollment อาจเป็น authUid ไม่ใช่ students/{id}
  const resolvedLookup = await resolveStudentsByFeeIds(uniqueStudentIds);
  const students = [
    ...new Map(
      [...resolvedLookup.values()].map((s) => [s.id, s as unknown as Student]),
    ).values(),
  ];
  const studentById = buildStudentLookup(
    students.map((s) => s as unknown as Record<string, unknown> & { id: string }),
  ) as unknown as Map<string, Student>;
  const identityLookup = buildStudentIdentityLookup(students.map((s) => ({ student: s })));
  const canonicalStudentId = (rawId: string) => identityLookup.get(rawId) ?? rawId;

  const records = recordsSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as GradeRecord)
    .filter((r) => Number(r.semester) === Number(semester));

  const recordByKey = new Map<string, GradeRecord>();
  records.forEach((r) => {
    const classId = String(r.classId ?? '').trim();
    const subjectId = String(r.subjectId ?? '').trim();
    const studentId = String(r.studentId ?? '').trim();
    if (!classId || !subjectId || !studentId) return;
    recordByKey.set(`${classId}_${subjectId}_${canonicalStudentId(studentId)}`, r);
  });

  const exams = (examsSnap?.docs.map((d) => ({ id: d.id, ...d.data() }) as Exam) ?? [])
    .filter((e) => Number(e.semester) === Number(semester));

  const examIds = exams.map((e) => e.id);
  const allScores: ExamScore[] = [];
  for (let i = 0; i < examIds.length; i += 30) {
    const chunk = examIds.slice(i, i + 30);
    if (chunk.length === 0) continue;
    const snap = await getDocs(
      query(collection(db, 'exam_scores'), where('examId', 'in', chunk)),
    ).catch(() => null);
    snap?.docs.forEach((d) => allScores.push({ id: d.id, ...d.data() } as ExamScore));
  }

  const scoresByExamId = new Map<string, Map<string, ExamScore>>();
  allScores.forEach((s) => {
    let m = scoresByExamId.get(s.examId);
    if (!m) {
      m = new Map();
      scoresByExamId.set(s.examId, m);
    }
    m.set(s.studentId, s);
  });

  const configByClassSubject = new Map<string, GradeWeightConfig>();
  configsSnap?.docs.forEach((d) => {
    const cfg = { id: d.id, ...d.data() } as GradeWeightConfig;
    if (Number(cfg.semester) !== Number(semester)) return;
    configByClassSubject.set(`${cfg.classId}_${cfg.subjectId}`, cfg);
  });

  const examsByClassSubject = new Map<string, Exam[]>();
  exams.forEach((e) => {
    const key = `${e.classId}_${e.subjectId}`;
    const arr = examsByClassSubject.get(key) ?? [];
    arr.push(e);
    examsByClassSubject.set(key, arr);
  });

  // ── Online exam rooms → scores per class+subject (เหมือนสมุดคะแนน) ──
  const rooms = (roomsSnap?.docs.map((d) => {
    const raw = d.data();
    return {
      ...raw,
      id: d.id,
      startTime: normalizeExamTs(raw.startTime),
      endTime: normalizeExamTs(raw.endTime),
      createdAt: normalizeExamTs(raw.createdAt),
    } as ExamRoom;
  }) ?? []).filter((r) => Number(r.semester) === Number(semester) && shouldSyncExamRoomScores(r));

  const attemptsByRoomId = new Map<string, ExamAttempt[]>();
  const roomIds = rooms.map((r) => r.id);
  if (roomIds.length > 0) {
    const attemptSnaps = await Promise.all(
      chunkIds(roomIds).map((group) =>
        getDocs(query(collectionGroup(db, 'attempts'), where('roomId', 'in', group))).catch(
          () => null,
        ),
      ),
    );
    attemptSnaps.forEach((attSnap) => {
      attSnap?.docs.forEach((d) => {
        const raw = d.data();
        if (raw.status !== 'submitted' && raw.status !== 'graded') return;
        const roomId = String(raw.roomId ?? '');
        if (!roomId) return;
        const att = {
          ...raw,
          id: d.id,
          roomId,
          startedAt: normalizeExamTs(raw.startedAt),
          submittedAt: raw.submittedAt ? normalizeExamTs(raw.submittedAt) : null,
          lastSavedAt: normalizeExamTs(raw.lastSavedAt),
        } as ExamAttempt;
        const arr = attemptsByRoomId.get(roomId) ?? [];
        arr.push(att);
        attemptsByRoomId.set(roomId, arr);
      });
    });
  }

  const onlineByClassSubject = new Map<string, OnlineBundle>();
  const classworkPctsTemp = new Map<string, Map<string, number[]>>();

  for (const room of rooms) {
    const subjectIds = roomLinkedSubjectIds(room);
    if (subjectIds.length === 0) continue;

    const collectionType = room.settings?.scoreCollectionType
      ?? room.settings?.gradeBookScoreType
      ?? 'classwork';
    const field = scoreCollectionTypeToGradeField(collectionType);
    const attempts = attemptsByRoomId.get(room.id) ?? [];
    if (attempts.length === 0) continue;

    for (const cls of classes) {
      if (cls.isActive === false) continue;
      if (!roomAppliesToClass(room, cls)) continue;

      const studentIds = [...new Set(studentsByClass.get(cls.id) ?? [])];
      if (studentIds.length === 0) continue;

      const classStudents = studentIds
        .map((id) => studentById.get(id))
        .filter((s): s is Student => Boolean(s))
        .map((student) => ({ student }));

      if (classStudents.length === 0) continue;

      const bestPercents = getBestPercentByStudent(room, attempts, classStudents);

      for (const subjectId of subjectIds) {
        if (isActivityCategory(subjectMeta.get(subjectId)?.category)) continue;

        const bundleKey = `${cls.id}_${subjectId}`;
        const bundle = ensureOnlineBundle(onlineByClassSubject, bundleKey);
        if (field === 'classworkScore') bundle.linkedFields.classwork = true;
        if (field === 'midtermScore') bundle.linkedFields.midterm = true;
        if (field === 'finalScore') bundle.linkedFields.final = true;

        let classworkMap = classworkPctsTemp.get(bundleKey);
        if (!classworkMap) {
          classworkMap = new Map();
          classworkPctsTemp.set(bundleKey, classworkMap);
        }

        bestPercents.forEach((pct, studentId) => {
          let entry = bundle.byStudent.get(studentId);
          if (!entry) {
            entry = { classworkScore: null, midtermScore: null, finalScore: null };
            bundle.byStudent.set(studentId, entry);
          }
          if (field === 'classworkScore') {
            const pcts = classworkMap!.get(studentId) ?? [];
            pcts.push(pct);
            classworkMap!.set(studentId, pcts);
          } else if (field === 'midtermScore') {
            entry.midtermScore = entry.midtermScore !== null
              ? Math.max(entry.midtermScore, pct)
              : pct;
          } else {
            entry.finalScore = entry.finalScore !== null
              ? Math.max(entry.finalScore, pct)
              : pct;
          }
        });
      }
    }
  }

  classworkPctsTemp.forEach((byStudent, bundleKey) => {
    const bundle = onlineByClassSubject.get(bundleKey);
    if (!bundle) return;
    byStudent.forEach((pcts, studentId) => {
      let entry = bundle.byStudent.get(studentId);
      if (!entry) {
        entry = { classworkScore: null, midtermScore: null, finalScore: null };
        bundle.byStudent.set(studentId, entry);
      }
      entry.classworkScore = averagePercentScores(pcts);
    });
  });

  const countedKeys = new Set<string>();
  const buckets = new Map<string, Map<string, number[]>>();
  const classBuckets = new Map<string, Map<string, number[]>>();
  const classMeta = new Map<string, { className: string; gradeLevel: string }>();
  const subjectNames = new Map<string, GradeAssessmentSubjectCol>();
  /** classId → studentId → subjectId → cell */
  const studentGradesByClass = new Map<
    string,
    Map<string, Map<string, GradeAssessmentStudentCell>>
  >();

  const ensureBucket = (
    map: Map<string, Map<string, number[]>>,
    rowKey: string,
    subjectId: string,
  ) => {
    let bySub = map.get(rowKey);
    if (!bySub) {
      bySub = new Map();
      map.set(rowKey, bySub);
    }
    let pts = bySub.get(subjectId);
    if (!pts) {
      pts = [];
      bySub.set(subjectId, pts);
    }
    return pts;
  };

  const rememberSubject = (subjectId: string, name: string, code: string) => {
    if (!subjectId || subjectNames.has(subjectId)) return;
    const meta = subjectMeta.get(subjectId);
    subjectNames.set(subjectId, {
      subjectId,
      subjectName: name || subjectId,
      subjectCode: code || '',
      subjectGroupId: meta?.subjectGroupId
        ?? resolveSubjectGroupId(undefined, undefined, name, code),
    });
  };

  const pushGpa = (
    classId: string,
    gradeLevel: string,
    subjectId: string,
    studentId: string,
    grade: string,
    gpa: number,
  ) => {
    const sid = canonicalStudentId(studentId);
    const key = `${classId}_${subjectId}_${sid}`;
    if (countedKeys.has(key)) return;
    countedKeys.add(key);
    ensureBucket(buckets, gradeLevel, subjectId).push(gpa);
    ensureBucket(classBuckets, classId, subjectId).push(gpa);

    let byStu = studentGradesByClass.get(classId);
    if (!byStu) {
      byStu = new Map();
      studentGradesByClass.set(classId, byStu);
    }
    let bySub = byStu.get(sid);
    if (!bySub) {
      bySub = new Map();
      byStu.set(sid, bySub);
    }
    bySub.set(subjectId, { grade, gpa });
  };

  const ensureClassMeta = (classId: string, className: string, gradeLevelRaw: string) => {
    const gradeLevel = normalizeGradeLevel(gradeLevelRaw);
    if (!classMeta.has(classId)) {
      classMeta.set(classId, { className: className || classId, gradeLevel });
    }
    if (!classBuckets.has(classId)) classBuckets.set(classId, new Map());
    return classMeta.get(classId)!;
  };

  for (const cls of classes) {
    if (cls.isActive === false) continue;
    const metaRow = ensureClassMeta(cls.id, cls.className || cls.id, cls.gradeLevel || cls.className);
    const studentIds = [...new Set(studentsByClass.get(cls.id) ?? [])];
    const courses = (cls.enrolledCourses ?? []).filter((ec) => courseMatchesSemester(ec, semester));

    for (const ec of courses) {
      const meta = subjectMeta.get(ec.subjectId);
      if (isActivityCategory(meta?.category)) continue;

      const subjectName = meta?.name
        ?? records.find((r) => r.subjectId === ec.subjectId)?.subjectName
        ?? ec.subjectId;
      const subjectCode = meta?.code
        ?? records.find((r) => r.subjectId === ec.subjectId)?.subjectCode
        ?? '';
      rememberSubject(ec.subjectId, subjectName, subjectCode);

      const cfg = configByClassSubject.get(`${cls.id}_${ec.subjectId}`);
      const weights = cfg?.weights ?? DEFAULT_WEIGHTS;
      const thresholds = cfg?.thresholds ?? DEFAULT_THRESHOLDS;
      const subjectExams = examsByClassSubject.get(`${cls.id}_${ec.subjectId}`) ?? [];
      const onlineBundle = onlineByClassSubject.get(`${cls.id}_${ec.subjectId}`);

      for (const studentId of studentIds) {
        const student = studentById.get(studentId);
        const roster = student
          ? {
              id: student.id,
              studentCode: student.studentCode,
              authUid: student.authUid,
              userId: student.userId,
              email: student.email,
            }
          : { id: studentId };

        const saved = recordByKey.get(`${cls.id}_${ec.subjectId}_${canonicalStudentId(studentId)}`);
        if (saved?.absent) continue;
        if (saved?.result === 'pass' || saved?.result === 'fail') continue;

        // base เหมือนสมุด: มี record → คะแนนจาก record · ไม่มี → จากสอบออฟไลน์
        const base: CategoryScores = saved
          ? {
              classworkScore: saved.classworkScore,
              midtermScore: saved.midtermScore,
              finalScore: saved.finalScore,
            }
          : offlineScoresFromExams(roster, subjectExams, scoresByExamId, identityLookup);

        const merged = mergeOnlineIntoScores(
          base,
          onlineBundle?.byStudent.get(canonicalStudentId(studentId))
            ?? onlineBundle?.byStudent.get(studentId),
          onlineBundle?.linkedFields ?? { classwork: false, midterm: false, final: false },
        );

        // คิดเกรดจากคะแนนหลัง merge — เหมือน withRecalculatedTotals ในสมุด
        const grade = gradeFromScores(merged, thresholds, weights);
        if (!isGpaLetter(grade)) continue;
        pushGpa(cls.id, metaRow.gradeLevel, ec.subjectId, studentId, grade, gradeLetterToGpa(grade));
      }
    }
  }

  // record ของวิชาที่ไม่อยู่ใน enrolledCourses — ยังโชว์ได้ (อ่านอย่างเดียว)
  for (const r of records) {
    const classId = String(r.classId ?? '').trim();
    const subjectId = String(r.subjectId ?? '').trim();
    const studentId = String(r.studentId ?? '').trim();
    if (!classId || !subjectId || !studentId) continue;
    if (r.absent) continue;
    if (r.result === 'pass' || r.result === 'fail') continue;

    const meta = subjectMeta.get(subjectId);
    if (isActivityCategory(meta?.category)) continue;

    const cls = classById.get(classId);
    if (cls?.isActive === false) continue;

    const already = countedKeys.has(
      `${classId}_${subjectId}_${canonicalStudentId(studentId)}`,
    );
    if (already) continue;

    const metaRow = ensureClassMeta(
      classId,
      cls?.className || r.className || classId,
      cls?.gradeLevel || cls?.className || r.className,
    );

    rememberSubject(
      subjectId,
      meta?.name || r.subjectName || subjectId,
      meta?.code || r.subjectCode || '',
    );

    const cfg = configByClassSubject.get(`${classId}_${subjectId}`);
    const weights = cfg?.weights ?? DEFAULT_WEIGHTS;
    const thresholds = cfg?.thresholds ?? DEFAULT_THRESHOLDS;
    const onlineBundle = onlineByClassSubject.get(`${classId}_${subjectId}`);

    const base: CategoryScores = {
      classworkScore: r.classworkScore,
      midtermScore: r.midtermScore,
      finalScore: r.finalScore,
    };
    const merged = mergeOnlineIntoScores(
      base,
      onlineBundle?.byStudent.get(canonicalStudentId(studentId))
        ?? onlineBundle?.byStudent.get(studentId),
      onlineBundle?.linkedFields ?? { classwork: false, midterm: false, final: false },
    );
    const grade = gradeFromScores(merged, thresholds, weights);
    if (!isGpaLetter(grade)) continue;
    pushGpa(classId, metaRow.gradeLevel, subjectId, studentId, grade, gradeLetterToGpa(grade));
  }

  const usedSubjectIds = new Set<string>();
  classBuckets.forEach((bySub) => {
    bySub.forEach((pts, subjectId) => {
      if (pts.length > 0) usedSubjectIds.add(subjectId);
    });
  });

  const subjectsCols = [...usedSubjectIds]
    .map((id) => subjectNames.get(id) ?? {
      subjectId: id,
      subjectName: id,
      subjectCode: '',
      subjectGroupId: 'other' as const,
    })
    .sort((a, b) =>
      groupOrderIndex(a.subjectGroupId) - groupOrderIndex(b.subjectGroupId)
      || a.subjectName.localeCompare(b.subjectName, 'th', { numeric: true })
      || (a.subjectCode || '').localeCompare(b.subjectCode || '', 'th', { numeric: true }),
    );

  function buildRowFromBucket(
    bySub: Map<string, number[]>,
  ): { bySubject: Record<string, GradeAssessmentCell>; rowAvgGpa: number | null; rowN: number } {
    const bySubject: Record<string, GradeAssessmentCell> = {};
    const allPts: number[] = [];
    subjectsCols.forEach((col) => {
      const pts = bySub.get(col.subjectId) ?? [];
      if (pts.length === 0) return;
      const avg = Math.round((pts.reduce((s, n) => s + n, 0) / pts.length) * 100) / 100;
      bySubject[col.subjectId] = { avgGpa: avg, n: pts.length };
      allPts.push(...pts);
    });
    const rowAvgGpa = allPts.length > 0
      ? Math.round((allPts.reduce((s, n) => s + n, 0) / allPts.length) * 100) / 100
      : null;
    return { bySubject, rowAvgGpa, rowN: allPts.length };
  }

  const rows: GradeAssessmentRow[] = [...buckets.keys()]
    .sort(sortGradeLevels)
    .map((gradeLevel) => {
      const built = buildRowFromBucket(buckets.get(gradeLevel)!);
      return { gradeLevel, ...built };
    })
    .filter((r) => r.rowN > 0);

  const classRows: GradeAssessmentClassRow[] = [...classMeta.keys()]
    .map((classId) => {
      const meta = classMeta.get(classId)!;
      const built = buildRowFromBucket(classBuckets.get(classId) ?? new Map());
      return {
        classId,
        className: meta.className,
        gradeLevel: meta.gradeLevel,
        ...built,
      };
    })
    .sort((a, b) =>
      sortGradeLevels(a.gradeLevel, b.gradeLevel)
      || a.className.localeCompare(b.className, 'th', { numeric: true }),
    );

  const gradeLevels = [...new Set(classRows.map((r) => r.gradeLevel))]
    .filter((lv) => lv && lv !== '—')
    .sort(sortGradeLevels);

  const overallPts: number[] = [];
  classBuckets.forEach((bySub) => {
    bySub.forEach((pts) => overallPts.push(...pts));
  });
  const overallAvgGpa = overallPts.length > 0
    ? Math.round((overallPts.reduce((s, n) => s + n, 0) / overallPts.length) * 100) / 100
    : null;

  const studentsByClassOut: Record<string, GradeAssessmentStudentRow[]> = {};
  /** snapshot ชื่อจาก grade_records — ใช้เมื่อหา students doc ไม่เจอ */
  const nameSnapByStudent = new Map<string, { name: string; code: string }>();
  records.forEach((r) => {
    const sid = canonicalStudentId(String(r.studentId ?? '').trim());
    if (!sid || nameSnapByStudent.has(sid)) return;
    const name = String(r.studentName ?? '').trim();
    const code = String(r.studentCode ?? '').trim();
    if (name || code) nameSnapByStudent.set(sid, { name, code });
  });

  const looksLikeOpaqueId = (value: string) =>
    /^[A-Za-z0-9_-]{16,}$/.test(value) && !/[\u0E00-\u0E7F]/.test(value);

  for (const classId of classMeta.keys()) {
    const rosterIds = studentsByClass.get(classId) ?? [];
    const gradeMap = studentGradesByClass.get(classId);
    const allIds = new Set<string>([
      ...rosterIds.map((id) => canonicalStudentId(id)),
      ...(gradeMap ? [...gradeMap.keys()] : []),
    ]);

    const rows: GradeAssessmentStudentRow[] = [...allIds].map((sid) => {
      const s = studentById.get(sid)
        ?? [...studentById.values()].find((x) => canonicalStudentId(x.id) === sid);
      const snap = nameSnapByStudent.get(sid);
      const bySubMap = gradeMap?.get(sid) ?? new Map();
      const bySubject: Record<string, GradeAssessmentStudentCell> = {};
      let sum = 0;
      let n = 0;
      bySubMap.forEach((cell, subjectId) => {
        bySubject[subjectId] = cell;
        sum += cell.gpa;
        n += 1;
      });
      const fromProfile = s
        ? [s.prefix, s.firstName, s.lastName].filter(Boolean).join(' ').trim()
        : '';
      const fullName = fromProfile || snap?.name || 'ไม่ระบุชื่อ';
      return {
        studentId: s?.id ?? sid,
        studentCode: s?.studentCode || snap?.code || '',
        fullName: looksLikeOpaqueId(fullName) ? 'ไม่ระบุชื่อ' : fullName,
        photoURL: s?.photoURL,
        bySubject,
        rowAvgGpa: n > 0 ? Math.round((sum / n) * 100) / 100 : null,
        rowN: n,
      };
    }).sort((a, b) =>
      (a.studentCode || a.fullName).localeCompare(b.studentCode || b.fullName, 'th', { numeric: true }),
    );

    studentsByClassOut[classId] = rows;
  }

  return {
    academicYearId: year,
    semester,
    updatedAt: new Date().toISOString(),
    subjects: subjectsCols,
    rows,
    classRows,
    studentsByClass: studentsByClassOut,
    gradeLevels,
    classes: classRows.map((r) => ({
      classId: r.classId,
      className: r.className,
      gradeLevel: r.gradeLevel,
    })),
    overallAvgGpa,
    overallN: overallPts.length,
  };
}
