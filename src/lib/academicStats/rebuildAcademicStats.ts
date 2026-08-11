import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { ExamRoom } from '@/types/exam';
import { SUBJECT_GROUP_CONFIG, type SubjectGroupId } from '@/types/curriculum';
import {
  academicStatsDocId,
  emptyAcademicStats,
  type AcademicAtRiskClass,
  type AcademicExamType,
  type AcademicGradeLevelAvg,
  type AcademicStatsDoc,
  type AcademicSubjectAvg,
  type AcademicTeacherPassRank,
  type AcademicTeacherRoomPass,
  type AcademicUnlinkedRoom,
} from '@/types/academicStats';
import {
  classMidtermReportDocId,
  type ClassMidtermReportColumn,
  type ClassMidtermReportDoc,
  type ClassMidtermReportStudent,
} from '@/types/classMidtermReport';
import type { Student } from '@/types/student';
import {
  buildStudentIdentityLookup,
  extractPmStudentCode,
  resolveCanonicalStudentId,
} from '@/lib/students/studentIdentity';
import { mapRowsToTScoresByGroup } from '@/lib/academicStats/tScore';

type ScoreRow = {
  studentId: string;
  pct: number;
  subjectId: string;
  subjectName: string;
  classId: string;
  className: string;
  gradeLevel: string;
  subjectGroup: string;
  subjectGroupId: string;
  subSubjectGroup: string;
  teacherId: string;
  teacherName: string;
  teacherPhotoURL: string;
  examRoomId: string;
  roomStatus: string;
};

type ClassReportAcc = {
  classId: string;
  className: string;
  gradeLevel: string;
  columns: Map<string, ClassMidtermReportColumn>;
  /** studentId → examRoomId → best % */
  scoresByStudent: Map<string, Map<string, number>>;
  namesFromAttempts: Map<string, string>;
};

function ensureClassReport(
  map: Map<string, ClassReportAcc>,
  classId: string,
  className: string,
  gradeLevel: string,
): ClassReportAcc {
  const cur = map.get(classId) ?? {
    classId,
    className,
    gradeLevel,
    columns: new Map(),
    scoresByStudent: new Map(),
    namesFromAttempts: new Map(),
  };
  if (className && className !== classId) cur.className = className;
  if (gradeLevel && gradeLevel !== '—') cur.gradeLevel = gradeLevel;
  map.set(classId, cur);
  return cur;
}

function displayStudentName(student: Student): string {
  const name = `${student.prefix ?? ''}${student.firstName ?? ''} ${student.lastName ?? ''}`
    .replace(/\s+/g, ' ')
    .trim();
  return name || student.studentCode || student.id;
}

async function loadStudentsByIds(ids: string[]): Promise<Student[]> {
  const unique = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
  const out: Student[] = [];
  for (let i = 0; i < unique.length; i += 10) {
    const chunk = unique.slice(i, i + 10);
    const snaps = await Promise.all(chunk.map((id) => getDoc(doc(db, 'students', id))));
    snaps.forEach((snap) => {
      if (snap.exists()) out.push({ id: snap.id, ...snap.data() } as Student);
    });
  }
  return out;
}

async function loadClassRosterStudents(
  classId: string,
  academicYearId: string,
): Promise<Student[]> {
  let enrollSnap = academicYearId
    ? await getDocs(
        query(
          collection(db, 'enrollments'),
          where('classId', '==', classId),
          where('academicYearId', '==', academicYearId),
        ),
      )
    : null;

  if (!enrollSnap || enrollSnap.empty) {
    enrollSnap = await getDocs(
      query(collection(db, 'enrollments'), where('classId', '==', classId)),
    );
  }

  const enrollIds = enrollSnap.docs
    .map((d) => String((d.data() as { studentId?: string }).studentId ?? '').trim())
    .filter(Boolean);

  if (enrollIds.length > 0) {
    return loadStudentsByIds(enrollIds);
  }

  // Fallback: legacy classroomId on student docs
  const byClassroom = await getDocs(
    query(collection(db, 'students'), where('classroomId', '==', classId)),
  );
  return byClassroom.docs.map((d) => ({ id: d.id, ...d.data() }) as Student);
}

async function resolveRosterForClassReport(
  acc: ClassReportAcc,
  academicYearId: string,
): Promise<Student[]> {
  // Strict: only enrolled / classroomId students — never pull by attempt email alone
  return loadClassRosterStudents(acc.classId, academicYearId);
}

async function writeClassMidtermReports(params: {
  academicYearId: string;
  semester: 1 | 2;
  examType: AcademicExamType;
  classReports: Map<string, ClassReportAcc>;
}): Promise<void> {
  const { academicYearId, semester, examType, classReports } = params;
  const updatedAt = Date.now();

  for (const acc of classReports.values()) {
    const columns = Array.from(acc.columns.values()).sort((a, b) =>
      a.label.localeCompare(b.label, 'th')
      || a.subjectName.localeCompare(b.subjectName, 'th'),
    );

    const classStudents = await resolveRosterForClassReport(acc, academicYearId);
    const rosterIds = new Set(classStudents.map((s) => s.id));
    const lookup = buildStudentIdentityLookup(classStudents.map((student) => ({ student })));

    // Link attempt keys (auth uid / email) → students/{id} ในห้องนี้เท่านั้น
    acc.scoresByStudent.forEach((_, rawId) => {
      if (lookup.has(rawId)) return;
      const code =
        extractPmStudentCode(rawId)
        ?? extractPmStudentCode(acc.namesFromAttempts.get(rawId) ?? '');
      if (!code) return;
      const hit = classStudents.find((s) => String(s.studentCode ?? '').trim() === code);
      if (hit) lookup.set(rawId, hit.id);
    });

    // Remap scores onto canonical roster ids only
    const scoresByCanonical = new Map<string, Map<string, number>>();
    acc.scoresByStudent.forEach((byRoom, rawId) => {
      const canonical = resolveCanonicalStudentId(rawId, lookup);
      if (!rosterIds.has(canonical)) return;
      const merged = scoresByCanonical.get(canonical) ?? new Map<string, number>();
      byRoom.forEach((pct, roomId) => {
        const prev = merged.get(roomId);
        if (prev == null || pct > prev) merged.set(roomId, pct);
      });
      scoresByCanonical.set(canonical, merged);
    });

    const students: ClassMidtermReportStudent[] = classStudents
      .map((student) => {
        const scores: Record<string, number | null> = {};
        const byRoom = scoresByCanonical.get(student.id);
        columns.forEach((col) => {
          const pct = byRoom?.get(col.key);
          scores[col.key] = pct != null ? Math.round(pct * 10) / 10 : null;
        });
        return {
          studentId: student.id,
          studentCode: String(student.studentCode ?? ''),
          fullName: displayStudentName(student),
          ...(student.photoURL ? { photoURL: student.photoURL } : {}),
          scores,
        };
      })
      .sort((a, b) =>
        a.studentCode.localeCompare(b.studentCode, 'th', { numeric: true })
        || a.fullName.localeCompare(b.fullName, 'th'),
      );

    const id = classMidtermReportDocId(examType, semester, academicYearId, acc.classId);
    const docData: ClassMidtermReportDoc = {
      id,
      academicYearId,
      semester,
      examType,
      classId: acc.classId,
      className: acc.className,
      gradeLevel: acc.gradeLevel,
      updatedAt,
      columns,
      students,
    };
    await setDoc(doc(db, 'class_midterm_reports', id), docData);
  }
}

function isMidtermRoom(room: ExamRoom, examType: AcademicExamType): boolean {
  // เฉพาะห้องที่ตั้งค่า scoreCollectionType เป็นกลางภาค/ปลายภาคเท่านั้น
  // (ไม่ใช้ gradeBookScoreType / ชื่อเรื่อง — มักเป็นค่า default จากลิงก์สมุดคะแนน)
  return room.settings?.scoreCollectionType === examType;
}

function roomMaxPoints(room: ExamRoom): number {
  const fromRounds = Object.values(room.roundQuestions ?? {}).map((r) => r.totalPoints ?? 0);
  const roundMax = fromRounds.length > 0 ? Math.max(...fromRounds) : 0;
  return Math.max(room.totalPoints || 0, roundMax, 1);
}

function resolveSubjectGroupLabel(subjectGroupId?: string): string {
  if (!subjectGroupId) return '—';
  const cfg = SUBJECT_GROUP_CONFIG[subjectGroupId as SubjectGroupId];
  return cfg?.name ?? subjectGroupId;
}

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return Math.round((nums.reduce((s, n) => s + n, 0) / nums.length) * 10) / 10;
}

function subjectKey(subjectName: string, gradeLevel: string): string {
  return `${subjectName}|${gradeLevel || '—'}`;
}

/** Build aggregated academic stats from midterm (or final) exam rooms + attempts. */
export async function rebuildAcademicStatsClient(params: {
  academicYearId: string;
  semester: 1 | 2;
  examType?: AcademicExamType;
}): Promise<AcademicStatsDoc> {
  const examType = params.examType ?? 'midterm';
  const { academicYearId, semester } = params;
  const id = academicStatsDocId(examType, semester, academicYearId);
  const empty = emptyAcademicStats(id, examType, academicYearId, semester);

  const roomsSnap = await getDocs(
    query(
      collection(db, 'exam_rooms'),
      where('academicYearId', '==', academicYearId),
      where('semester', '==', semester),
    ),
  );

  const rooms = roomsSnap.docs
    .map((d) => ({ id: d.id, ...d.data() } as ExamRoom))
    .filter((r) => isMidtermRoom(r, examType));

  if (rooms.length === 0) {
    await setDoc(doc(db, 'academic_stats', id), empty);
    return empty;
  }

  const scoreRows: ScoreRow[] = [];
  let roomsGraded = 0;
  const unlinkedRooms: AcademicUnlinkedRoom[] = [];
  /** ห้อง midterm ที่มีคะแนน — ใช้กรอง at-risk (รวม active / upcoming / closed) */
  const atRiskRoomIds = new Set<string>();
  /** ห้องที่ยังรอตรวจข้ออัตนัย / คะแนนไม่ครบ — ยังไม่นำ % มาคิด */
  const pendingGradingRoomIds = new Set<string>();
  const classReports = new Map<string, ClassReportAcc>();

  // ponytail: sequential room attempts — N rooms small for midterm window; upgrade → batched getAll / CF
  for (const room of rooms) {
    const attemptsSnap = await getDocs(collection(db, 'exam_rooms', room.id, 'attempts'));
    const maxPts = roomMaxPoints(room);
    const bestByStudent = new Map<string, number>();
    const namesByStudent = new Map<string, string>();
    let pendingGrading = false;

    attemptsSnap.docs.forEach((aDoc) => {
      const data = aDoc.data();
      const status = String(data.status ?? '');
      if (status !== 'graded' && status !== 'submitted') return;
      if (data.pendingManualGrading === true) {
        pendingGrading = true;
        return;
      }
      const score = typeof data.score === 'number' ? data.score : null;
      if (score == null) {
        if (status === 'submitted') pendingGrading = true;
        return;
      }
      const objMax =
        typeof data.objectiveMaxPoints === 'number' && data.objectiveMaxPoints > 0
          ? data.objectiveMaxPoints
          : maxPts;
      const pct = Math.min(100, Math.max(0, (score / objMax) * 100));
      const studentId = String(data.studentId ?? aDoc.id);
      const studentName = String(data.studentName ?? '').trim();
      if (studentName) namesByStudent.set(studentId, studentName);
      const prev = bestByStudent.get(studentId);
      if (prev == null || pct > prev) bestByStudent.set(studentId, pct);
    });

    if (pendingGrading) pendingGradingRoomIds.add(room.id);

    const subjectName = room.subjectName || room.title || 'ไม่ระบุวิชา';
    const subjectId = room.subjectId || room.id;
    const classId = room.classId || 'unknown';
    const className = room.className || classId;
    const gradeLevel = room.gradeLevel || '—';
    const subjectGroupId = String(room.subjectGroupId ?? '').trim();
    const subjectGroup = resolveSubjectGroupLabel(room.subjectGroupId);
    const subSubjectGroup = room.subSubjectGroup?.trim() || '—';
    const teacherName = room.teacherName?.trim() || '—';
    const teacherId = String(room.teacherId ?? '').trim() || teacherName;
    const teacherPhotoURL = room.teacherPhotoURL?.trim() || '';

    // class report column — even if pending (shows subject, no scores yet)
    if (classId !== 'unknown') {
      const report = ensureClassReport(classReports, classId, className, gradeLevel);
      const label =
        subSubjectGroup !== '—'
          ? subSubjectGroup
          : (subjectGroup !== '—' ? subjectGroup : subjectName);
      report.columns.set(room.id, {
        key: room.id,
        label,
        subjectId,
        subjectName,
        ...(subjectGroupId ? { subjectGroupId } : {}),
        ...(subjectGroup && subjectGroup !== '—' ? { subjectGroup } : {}),
        ...(subSubjectGroup !== '—' ? { subSubjectGroup } : {}),
      });
      namesByStudent.forEach((name, sid) => {
        if (!report.namesFromAttempts.has(sid)) report.namesFromAttempts.set(sid, name);
      });
      if (!pendingGrading) {
        bestByStudent.forEach((pct, studentId) => {
          const byRoom = report.scoresByStudent.get(studentId) ?? new Map();
          const prev = byRoom.get(room.id);
          if (prev == null || pct > prev) byRoom.set(room.id, pct);
          report.scoresByStudent.set(studentId, byRoom);
        });
      }
    }

    const scoreCollectionOn =
      room.settings?.scoreCollectionEnabled === true
      || room.settings?.scoreCollectionLinked === true;
    // ห้องรอตรวจ — ยังไม่นับคะแนน / at-risk / roomsGraded
    if (pendingGrading) {
      continue;
    }

    // at-risk: ห้องกลางภาคที่มีคะแนนแล้ว (active / upcoming / closed)
    if (bestByStudent.size > 0) {
      atRiskRoomIds.add(room.id);
    }

    const linked = scoreCollectionOn || bestByStudent.size > 0;
    if (linked) {
      roomsGraded += 1;
    } else {
      unlinkedRooms.push({
        examRoomId: room.id,
        title: room.title || subjectName,
        subjectName,
        className,
        gradeLevel,
        subjectGroup,
        subjectGroupId,
        subSubjectGroup,
        teacherId,
        teacherName,
        teacherPhotoURL,
      });
    }

    bestByStudent.forEach((pct, studentId) => {
      scoreRows.push({
        studentId,
        pct,
        subjectId,
        subjectName,
        classId,
        className,
        gradeLevel,
        subjectGroup,
        subjectGroupId,
        subSubjectGroup,
        teacherId,
        teacherName,
        teacherPhotoURL,
        examRoomId: room.id,
        roomStatus: room.status || 'upcoming',
      });
    });
  }

  // แดชบอร์ด: T ทั้งโรงเรียนสำหรับ KPI/ระดับชั้น/ครู · at-risk ใช้ T ต่อห้อง (ตรงตารางเจาะห้อง)
  // class_midterm_reports ยังเก็บ % ดิบจากลูปด้านบน
  const schoolTRows = mapRowsToTScoresByGroup(scoreRows, () => 'school');
  const roomTRows = mapRowsToTScoresByGroup(scoreRows, (r) => r.examRoomId);
  const pcts = schoolTRows.map((r) => r.pct);
  const passCount = pcts.filter((p) => p >= 50).length;
  const failCount = pcts.length - passCount;

  // Subject averages
  const bySubject = new Map<string, number[]>();
  schoolTRows.forEach((r) => {
    const key = subjectKey(r.subjectName, r.gradeLevel);
    const list = bySubject.get(key) ?? [];
    list.push(r.pct);
    bySubject.set(key, list);
  });

  const subjectAvgs: AcademicSubjectAvg[] = Array.from(bySubject.entries()).map(([key, list]) => {
    const [subjectName, gradeLevel] = key.split('|');
    return {
      key,
      label: gradeLevel && gradeLevel !== '—' ? `${subjectName} ${gradeLevel}` : subjectName,
      subjectName,
      gradeLevel: gradeLevel || '—',
      avgPct: avg(list),
      n: list.length,
    };
  });

  const sortedAsc = [...subjectAvgs].sort((a, b) => a.avgPct - b.avgPct || a.label.localeCompare(b.label, 'th'));
  const bottomSubjects = sortedAsc.slice(0, 5);
  const topSubjects = [...sortedAsc].reverse().slice(0, 5);

  // Grade-level averages
  const byGrade = new Map<string, number[]>();
  schoolTRows.forEach((r) => {
    const g = r.gradeLevel || '—';
    const list = byGrade.get(g) ?? [];
    list.push(r.pct);
    byGrade.set(g, list);
  });
  const byGradeLevel: AcademicGradeLevelAvg[] = Array.from(byGrade.entries())
    .map(([gradeLevel, list]) => ({ gradeLevel, avgPct: avg(list), n: list.length }))
    .sort((a, b) => a.gradeLevel.localeCompare(b.gradeLevel, 'th', { numeric: true }));

  // T-Score bands: ≥60 ดี · 40–59 ปานกลาง · <40 ต้องปรับปรุง
  const distribution = {
    excellent: pcts.filter((p) => p >= 60).length,
    average: pcts.filter((p) => p >= 40 && p < 60).length,
    needsImprovement: pcts.filter((p) => p < 40).length,
  };

  // At-risk: อัตรา T<50 ในห้อง > 50% — ใช้ T ต่อห้องสอบ
  const classSubject = new Map<string, { fail: number; total: number; meta: Omit<AcademicAtRiskClass, 'failRatePct' | 'failCount' | 'totalCount'> }>();
  roomTRows.forEach((r) => {
    if (!atRiskRoomIds.has(r.examRoomId)) return;
    const key = `${r.classId}|${r.subjectId}|${r.examRoomId}`;
    const cur = classSubject.get(key) ?? {
      fail: 0,
      total: 0,
      meta: {
        classId: r.classId,
        className: r.className,
        subjectId: r.subjectId,
        subjectName: r.subjectName,
        gradeLevel: r.gradeLevel,
        subjectGroup: r.subjectGroup,
        subjectGroupId: r.subjectGroupId,
        subSubjectGroup: r.subSubjectGroup,
        teacherName: r.teacherName,
        teacherPhotoURL: r.teacherPhotoURL,
        examRoomId: r.examRoomId,
        roomStatus: r.roomStatus,
      },
    };
    cur.total += 1;
    if (r.pct < 50) cur.fail += 1;
    classSubject.set(key, cur);
  });

  const atRiskClasses: AcademicAtRiskClass[] = Array.from(classSubject.values())
    .map((c) => ({
      ...c.meta,
      failCount: c.fail,
      totalCount: c.total,
      failRatePct: c.total > 0 ? Math.round((c.fail / c.total) * 1000) / 10 : 0,
    }))
    .filter((c) => c.totalCount >= 3 && c.failRatePct > 50)
    .sort((a, b) => b.failRatePct - a.failRatePct)
    .slice(0, 20);

  unlinkedRooms.sort((a, b) =>
    a.gradeLevel.localeCompare(b.gradeLevel, 'th', { numeric: true })
    || a.className.localeCompare(b.className, 'th')
    || a.subjectName.localeCompare(b.subjectName, 'th'),
  );

  const byTeacher = new Map<string, {
    teacherId: string;
    teacherName: string;
    teacherPhotoURL: string;
    pass: number;
    total: number;
    sumPct: number;
    rooms: Map<string, {
      examRoomId: string;
      subjectName: string;
      className: string;
      gradeLevel: string;
      subjectGroup: string;
      subjectGroupId: string;
      subSubjectGroup: string;
      pass: number;
      total: number;
      pendingGrading: boolean;
    }>;
  }>();

  const ensureTeacher = (
    teacherId: string,
    teacherName: string,
    teacherPhotoURL: string,
  ) => {
    const key = teacherId || teacherName;
    const cur = byTeacher.get(key) ?? {
      teacherId: key,
      teacherName,
      teacherPhotoURL: teacherPhotoURL || '',
      pass: 0,
      total: 0,
      sumPct: 0,
      rooms: new Map(),
    };
    if (!cur.teacherPhotoURL && teacherPhotoURL) cur.teacherPhotoURL = teacherPhotoURL;
    byTeacher.set(key, cur);
    return cur;
  };

  const roomWasOpened = (room: ExamRoom) =>
    room.status === 'active'
    || room.status === 'closed'
    || (room.currentRound ?? 0) > 0
    || (room.completedRounds ?? 0) > 0;

  // รายชื่อครูที่เปิดข้อสอบกลางภาคแล้ว (แม้ยังไม่มีคะแนน)
  for (const room of rooms) {
    if (!roomWasOpened(room)) continue;
    const teacherName = room.teacherName?.trim() || '—';
    if (teacherName === '—') continue;
    const teacherId = String(room.teacherId ?? '').trim() || teacherName;
    const teacherPhotoURL = room.teacherPhotoURL?.trim() || '';
    const cur = ensureTeacher(teacherId, teacherName, teacherPhotoURL);
    const pendingGrading = pendingGradingRoomIds.has(room.id);
    const subjectGroupId = String(room.subjectGroupId ?? '').trim();
    const subjectGroup = resolveSubjectGroupLabel(room.subjectGroupId);
    const subSubjectGroup = room.subSubjectGroup?.trim() || '—';
    if (!cur.rooms.has(room.id)) {
      cur.rooms.set(room.id, {
        examRoomId: room.id,
        subjectName: room.subjectName || room.title || 'ไม่ระบุวิชา',
        className: room.className || room.classId || '—',
        gradeLevel: room.gradeLevel || '—',
        subjectGroup,
        subjectGroupId,
        subSubjectGroup,
        pass: 0,
        total: 0,
        pendingGrading,
      });
    } else if (pendingGrading) {
      cur.rooms.get(room.id)!.pendingGrading = true;
    }
  }

  schoolTRows.forEach((r) => {
    if (!r.teacherName || r.teacherName === '—') return;
    const cur = ensureTeacher(r.teacherId, r.teacherName, r.teacherPhotoURL);
    cur.total += 1;
    cur.sumPct += r.pct;
    if (r.pct >= 50) cur.pass += 1;

    const room = cur.rooms.get(r.examRoomId) ?? {
      examRoomId: r.examRoomId,
      subjectName: r.subjectName,
      className: r.className,
      gradeLevel: r.gradeLevel,
      subjectGroup: r.subjectGroup,
      subjectGroupId: r.subjectGroupId,
      subSubjectGroup: r.subSubjectGroup,
      pass: 0,
      total: 0,
      pendingGrading: false,
    };
    room.total += 1;
    if (r.pct >= 50) room.pass += 1;
    cur.rooms.set(r.examRoomId, room);
  });

  const teacherPassRanking: AcademicTeacherPassRank[] = Array.from(byTeacher.values())
    .map((t) => {
      const rooms: AcademicTeacherRoomPass[] = Array.from(t.rooms.values())
        .map((room) => ({
          examRoomId: room.examRoomId,
          subjectName: room.subjectName,
          className: room.className,
          gradeLevel: room.gradeLevel,
          passCount: room.pass,
          totalCount: room.total,
          passRatePct: room.pendingGrading || room.total === 0
            ? 0
            : Math.round((room.pass / room.total) * 1000) / 10,
          ...(room.subjectGroup && room.subjectGroup !== '—'
            ? { subjectGroup: room.subjectGroup }
            : {}),
          ...(room.subjectGroupId ? { subjectGroupId: room.subjectGroupId } : {}),
          ...(room.subSubjectGroup && room.subSubjectGroup !== '—'
            ? { subSubjectGroup: room.subSubjectGroup }
            : {}),
          ...(room.pendingGrading ? { pendingGrading: true as const } : {}),
        }))
        .sort((a, b) => {
          // รอตรวจขึ้นก่อน · แล้วเรียง % ผ่าน
          if (!!a.pendingGrading !== !!b.pendingGrading) return a.pendingGrading ? -1 : 1;
          return (
            b.passRatePct - a.passRatePct
            || a.gradeLevel.localeCompare(b.gradeLevel, 'th', { numeric: true })
            || a.className.localeCompare(b.className, 'th')
            || a.subjectName.localeCompare(b.subjectName, 'th')
          );
        });

      return {
        rank: 0,
        teacherId: t.teacherId,
        teacherName: t.teacherName,
        teacherPhotoURL: t.teacherPhotoURL || '',
        passCount: t.pass,
        failCount: t.total - t.pass,
        totalCount: t.total,
        passRatePct: t.total > 0 ? Math.round((t.pass / t.total) * 1000) / 10 : 0,
        avgPct: t.total > 0 ? Math.round((t.sumPct / t.total) * 10) / 10 : 0,
        rooms,
      };
    })
    .sort((a, b) => {
      // มีคะแนนมาก่อน · เรียง % ผ่าน · ไม่มีคะแนนอยู่ท้ายเรียงชื่อ
      if (a.totalCount === 0 && b.totalCount > 0) return 1;
      if (b.totalCount === 0 && a.totalCount > 0) return -1;
      if (a.totalCount === 0 && b.totalCount === 0) {
        return a.teacherName.localeCompare(b.teacherName, 'th');
      }
      return (
        b.passRatePct - a.passRatePct
        || b.avgPct - a.avgPct
        || b.totalCount - a.totalCount
        || a.teacherName.localeCompare(b.teacherName, 'th')
      );
    })
    .map((t, i) => ({ ...t, rank: i + 1 }));

  const docData: AcademicStatsDoc = {
    id,
    examType,
    academicYearId,
    semester,
    updatedAt: Date.now(),
    kpi: {
      overallAveragePct: avg(pcts),
      passRatePct: pcts.length > 0 ? Math.round((passCount / pcts.length) * 1000) / 10 : 0,
      failRatePct: pcts.length > 0 ? Math.round((failCount / pcts.length) * 1000) / 10 : 0,
      gradingProgressPct: rooms.length > 0 ? Math.round((roomsGraded / rooms.length) * 1000) / 10 : 0,
      roomsTotal: rooms.length,
      roomsGraded,
      studentScoreCount: pcts.length,
    },
    topSubjects,
    bottomSubjects,
    byGradeLevel,
    distribution,
    atRiskClasses,
    unlinkedRooms,
    teacherPassRanking,
  };

  await setDoc(doc(db, 'academic_stats', id), docData);
  await writeClassMidtermReports({ academicYearId, semester, examType, classReports });
  return docData;
}
