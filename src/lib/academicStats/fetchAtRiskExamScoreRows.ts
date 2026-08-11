import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { attemptScorePercent } from '@/lib/exam/examRoomScoring';
import {
  buildStudentIdentityLookup,
  enrichStudentIdentityLookupFromAttempts,
  extractPmStudentCode,
  findAttemptForStudent,
  resolveCanonicalStudentId,
} from '@/lib/students/studentIdentity';
import type { ExamRoomScoreRow } from '@/features/grades/components/ExamRoomScoreTable';
import type { ExamAttempt, ExamRoom } from '@/types/exam';
import type { Student } from '@/types/student';

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

async function loadClassStudents(room: ExamRoom): Promise<Student[]> {
  const classId = String(room.classId ?? '').trim();
  if (!classId) return [];

  const year = String(room.academicYearId ?? '').trim();
  let enrollSnap = year
    ? await getDocs(
        query(
          collection(db, 'enrollments'),
          where('classId', '==', classId),
          where('academicYearId', '==', year),
        ),
      )
    : null;

  if (!enrollSnap || enrollSnap.empty) {
    enrollSnap = await getDocs(
      query(collection(db, 'enrollments'), where('classId', '==', classId)),
    );
  }

  const ids = enrollSnap.docs
    .map((d) => String((d.data() as { studentId?: string }).studentId ?? '').trim())
    .filter(Boolean);

  return loadStudentsByIds(ids);
}

function displayName(student: Student): string {
  const name = `${student.prefix ?? ''}${student.firstName ?? ''} ${student.lastName ?? ''}`.replace(/\s+/g, ' ').trim();
  return name || student.studentCode || student.id;
}

function looksLikeEmail(value: string): boolean {
  return value.includes('@');
}

/** Load ExamRoomScoreTable rows for one midterm room (best % per student). */
export async function fetchAtRiskExamScoreRows(examRoomId: string): Promise<ExamRoomScoreRow[]> {
  const roomSnap = await getDoc(doc(db, 'exam_rooms', examRoomId));
  if (!roomSnap.exists()) return [];

  const room = { id: roomSnap.id, ...roomSnap.data() } as ExamRoom;
  const attemptsSnap = await getDocs(collection(db, 'exam_rooms', examRoomId, 'attempts'));
  const attempts = attemptsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as ExamAttempt));

  let classStudents = (await loadClassStudents(room)).map((student) => ({ student }));

  // Fallback: resolve by PMV email / studentCode on attempts when class roster empty/incomplete
  if (classStudents.length === 0 && attempts.length > 0) {
    const codes = [
      ...new Set(
        attempts.flatMap((att) => {
          const fromName = extractPmStudentCode(att.studentName ?? '');
          const fromId = extractPmStudentCode(att.studentId ?? '');
          return [fromName, fromId].filter(Boolean) as string[];
        }),
      ),
    ];
    if (codes.length > 0) {
      const byCode: Student[] = [];
      for (let i = 0; i < codes.length; i += 10) {
        const chunk = codes.slice(i, i + 10);
        const snap = await getDocs(
          query(collection(db, 'students'), where('studentCode', 'in', chunk)),
        );
        snap.docs.forEach((d) => byCode.push({ id: d.id, ...d.data() } as Student));
      }
      classStudents = byCode.map((student) => ({ student }));
    }
  }

  const identityLookup = enrichStudentIdentityLookupFromAttempts(
    buildStudentIdentityLookup(classStudents),
    classStudents,
    attempts,
  );

  const bestPctByCanonical = new Map<string, { attempt: ExamAttempt; pct: number }>();
  attempts.forEach((attempt) => {
    const status = String(attempt.status ?? '');
    if (status !== 'graded' && status !== 'submitted') return;
    const pct = attemptScorePercent(room, attempt);
    if (pct == null) return;
    const canonicalId = resolveCanonicalStudentId(String(attempt.studentId ?? ''), identityLookup);
    const prev = bestPctByCanonical.get(canonicalId);
    if (prev == null || pct > prev.pct) {
      bestPctByCanonical.set(canonicalId, { attempt, pct });
    }
  });

  const studentById = new Map(classStudents.map(({ student }) => [student.id, student]));

  const rowsFromRoster: ExamRoomScoreRow[] = [];
  classStudents.forEach(({ student }) => {
    const matched = bestPctByCanonical.get(student.id);
    const att = matched?.attempt ?? findAttemptForStudent(attempts, student) ?? undefined;
    const pct = matched?.pct ?? (att ? attemptScorePercent(room, att) : null);
    if (pct == null) return;

    const status: ExamRoomScoreRow['status'] = !att
      ? 'none'
      : att.status === 'graded'
        ? 'graded'
        : att.status === 'submitted'
          ? 'submitted'
          : 'none';

    rowsFromRoster.push({
      studentId: student.id,
      studentName: displayName(student),
      studentCode: student.studentCode ?? '',
      photoURL: student.photoURL,
      gender: student.gender,
      status,
      scorePercent: Math.round(pct * 10) / 10,
    });
  });

  // Orphan attempts not linked to roster
  const rosterIds = new Set(rowsFromRoster.map((r) => r.studentId));
  const orphanRows: ExamRoomScoreRow[] = [];
  bestPctByCanonical.forEach(({ attempt, pct }, canonicalId) => {
    if (rosterIds.has(canonicalId) || studentById.has(canonicalId)) return;
    const code =
      extractPmStudentCode(attempt.studentName ?? '')
      ?? extractPmStudentCode(attempt.studentId ?? '')
      ?? '';
    const rawName = String(attempt.studentName ?? '').trim();
    orphanRows.push({
      studentId: canonicalId,
      studentName: looksLikeEmail(rawName) ? (code || rawName) : rawName || code || canonicalId,
      studentCode: code,
      status: attempt.status === 'graded' ? 'graded' : attempt.status === 'submitted' ? 'submitted' : 'none',
      scorePercent: Math.round(pct * 10) / 10,
    });
  });

  // Prefer roster rows; append unmatched attempt rows
  const rows = [...rowsFromRoster, ...orphanRows];

  return rows.sort((a, b) => {
    const ap = a.scorePercent ?? 999;
    const bp = b.scorePercent ?? 999;
    if (ap !== bp) return ap - bp;
    return (a.studentCode || a.studentName).localeCompare(b.studentCode || b.studentName, 'th', {
      numeric: true,
    });
  });
}
