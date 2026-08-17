// src/lib/exam/fetchMissedExams.ts
// ดึงรายการ "ขาดสอบ" แบบ one-shot รวม 2 ระบบ: ห้องสอบออนไลน์ (exam_rooms) + สอบในห้อง/offline (exams+exam_scores)
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { ExamAttempt, ExamRoom } from '@/types/exam';
import type { Exam, ExamScore } from '@/types/teaching';
import type { Student } from '@/types/student';
import {
  buildStudentIdentityLookup,
  enrichStudentIdentityLookupFromAttempts,
  resolveCanonicalStudentId,
  studentIdentityKeys,
} from '@/lib/students/studentIdentity';

export type MissedExamRow = {
  id: string;
  source: 'online' | 'offline';
  subjectName: string;
  title: string;
  className?: string;
  date?: string;
  studentId: string;
  studentName: string;
  studentCode: string;
  isExempt: boolean;
};

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function displayName(student: Student): string {
  const name = `${student.prefix ?? ''}${student.firstName ?? ''} ${student.lastName ?? ''}`.replace(/\s+/g, ' ').trim();
  return name || student.studentCode || student.id;
}

async function loadStudentsByIds(ids: string[]): Promise<Student[]> {
  const unique = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
  const out: Student[] = [];
  for (const c of chunk(unique, 10)) {
    const snaps = await Promise.all(c.map((id) => getDoc(doc(db, 'students', id))));
    snaps.forEach((snap) => {
      if (snap.exists()) out.push({ id: snap.id, ...snap.data() } as Student);
    });
  }
  return out;
}

async function loadClassRoster(classId: string, academicYearId: string): Promise<Student[]> {
  if (!classId.trim()) return [];
  let enrollSnap = await getDocs(
    query(
      collection(db, 'enrollments'),
      where('classId', '==', classId),
      where('academicYearId', '==', academicYearId),
    ),
  );
  if (enrollSnap.empty) {
    enrollSnap = await getDocs(query(collection(db, 'enrollments'), where('classId', '==', classId)));
  }
  const ids = enrollSnap.docs
    .map((d) => String((d.data() as { studentId?: string }).studentId ?? '').trim())
    .filter(Boolean);
  return loadStudentsByIds(ids);
}

/** ห้องสอบออนไลน์: roster อยู่ในห้อง, room สอบไปแล้วอย่างน้อย 1 รอบ, แต่ไม่มี attempt เลยสักรอบ = ขาดสอบ */
async function missedOnlineRowsForRoom(room: ExamRoom): Promise<MissedExamRow[]> {
  if ((room.completedRounds ?? 0) <= 0) return [];
  if (!room.classId) return [];

  const [roster, attemptsSnap] = await Promise.all([
    loadClassRoster(room.classId, room.academicYearId),
    getDocs(collection(db, 'exam_rooms', room.id, 'attempts')),
  ]);
  const attempts = attemptsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as ExamAttempt));
  if (roster.length === 0) return [];

  const rosterWrapped = roster.map((student) => ({ student }));
  const identityLookup = enrichStudentIdentityLookupFromAttempts(
    buildStudentIdentityLookup(rosterWrapped),
    rosterWrapped,
    attempts,
  );

  const studentIdsWithAttempt = new Set(
    attempts.map((att) => resolveCanonicalStudentId(String(att.studentId ?? ''), identityLookup)),
  );

  const exemptIds = new Set(room.settings?.examExemptStudentIds ?? []);
  const rows: MissedExamRow[] = [];
  roster.forEach((student) => {
    if (studentIdsWithAttempt.has(student.id)) return;
    rows.push({
      id: `online-${room.id}-${student.id}`,
      source: 'online',
      subjectName: room.subjectName ?? '',
      title: room.title,
      className: room.className,
      date: room.startTime ? new Date(room.startTime).toISOString().slice(0, 10) : undefined,
      studentId: student.id,
      studentName: displayName(student),
      studentCode: student.studentCode ?? '',
      isExempt: exemptIds.has(student.id),
    });
  });
  return rows;
}

async function offlineExamScoreRows(exams: Exam[]): Promise<MissedExamRow[]> {
  if (exams.length === 0) return [];
  const examById = new Map(exams.map((e) => [e.id, e]));
  const rows: MissedExamRow[] = [];

  for (const idChunk of chunk(exams.map((e) => e.id), 10)) {
    const snap = await getDocs(query(collection(db, 'exam_scores'), where('examId', 'in', idChunk)));
    snap.docs.forEach((d) => {
      const score = { id: d.id, ...d.data() } as ExamScore;
      if (!score.absent) return;
      const exam = examById.get(score.examId);
      if (!exam) return;
      rows.push({
        id: `offline-${score.id}`,
        source: 'offline',
        subjectName: exam.subjectName,
        title: exam.title,
        className: exam.className,
        date: exam.examDate,
        studentId: score.studentId,
        studentName: score.studentName,
        studentCode: score.studentCode,
        isExempt: false,
      });
    });
  }
  return rows;
}

/**
 * มุมมองครู/แอดมิน: ถ้าระบุ teacherId = เฉพาะห้องสอบ/สอบที่ตัวเองเป็นคนสอน
 * ไม่ระบุ (admin/sysadmin) = ทุกห้องสอบ/สอบในปี-เทอมนั้น เหมือน useExamRoom.ts admin path
 */
export async function fetchMissedExamsForTeacher(
  teacherId: string | undefined,
  academicYearId: string,
  semester: 1 | 2,
): Promise<MissedExamRow[]> {
  const roomsBase = [
    where('academicYearId', '==', academicYearId),
    where('semester', '==', semester),
    ...(teacherId ? [where('teacherId', '==', teacherId)] : []),
  ];
  const [roomsSnap, examsSnap] = await Promise.all([
    getDocs(query(collection(db, 'exam_rooms'), ...roomsBase)),
    getDocs(query(collection(db, 'exams'), ...roomsBase)),
  ]);

  const rooms = roomsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as ExamRoom));
  const exams = examsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Exam));

  const [onlineRowsByRoom, offlineRows] = await Promise.all([
    Promise.all(rooms.map(missedOnlineRowsForRoom)),
    offlineExamScoreRows(exams),
  ]);

  return [...onlineRowsByRoom.flat(), ...offlineRows];
}

/** มุมมองนักเรียน: เฉพาะของตัวเอง — resolve classId จาก enrollments ก่อน แล้วกรองเฉพาะ studentId นี้ */
export async function fetchMissedExamsForStudent(
  studentUid: string,
  academicYearId: string,
  semester: 1 | 2,
): Promise<MissedExamRow[]> {
  const studentSnap = await getDoc(doc(db, 'students', studentUid));
  const student = studentSnap.exists() ? ({ id: studentSnap.id, ...studentSnap.data() } as Student) : null;

  const enrollSnap = await getDocs(query(
    collection(db, 'enrollments'),
    where('studentId', '==', student?.id ?? studentUid),
    where('academicYearId', '==', academicYearId),
  ));
  const classId = String(enrollSnap.docs[0]?.data()?.classId ?? '').trim();
  if (!classId) return [];

  const [roomsSnap, examsSnap] = await Promise.all([
    getDocs(query(
      collection(db, 'exam_rooms'),
      where('classId', '==', classId),
      where('academicYearId', '==', academicYearId),
      where('semester', '==', semester),
    )),
    getDocs(query(
      collection(db, 'exams'),
      where('classId', '==', classId),
      where('academicYearId', '==', academicYearId),
      where('semester', '==', semester),
    )),
  ]);

  const rooms = roomsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as ExamRoom));
  const exams = examsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Exam));

  const [onlineRowsByRoom, offlineRows] = await Promise.all([
    Promise.all(rooms.map(missedOnlineRowsForRoom)),
    offlineExamScoreRows(exams),
  ]);

  const keys = student ? studentIdentityKeys(student) : new Set([studentUid]);
  const belongsToStudent = (row: MissedExamRow) => row.studentId === studentUid || keys.has(row.studentId);

  return [...onlineRowsByRoom.flat(), ...offlineRows].filter(belongsToStudent);
}
