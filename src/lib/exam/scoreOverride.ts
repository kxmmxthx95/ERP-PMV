import {
  doc, getDoc, serverTimestamp, setDoc, updateDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { logActivity } from '@/lib/activityLogger';
import { rawPointsToPercent } from '@/types/grades';
import type { NewGradeRecord } from '@/types/grades';
import { scoreCollectionTypeToGradeField } from '@/lib/students/studentIdentity';
import type { ExamRoom, ExamScoreOverrideRequest } from '@/types/exam';

/** Mirrors GradeBookPage's shouldSyncExamRoomScores — room must be linked to a grade-book subject. */
function isLinkedToGradeBook(room: ExamRoom): boolean {
  if (room.settings?.scoreCollectionLinked === false) return false;
  if (room.settings?.scoreCollectionEnabled === true) return true;
  if (room.settings?.scoreCollectionEnabled === false) return false;
  return (room.settings?.gradeBookSubjects?.length ?? 0) > 0 || !!room.settings?.gradeBookSubjectId;
}

/**
 * Pushes the approved score into grade_records so the grade book reflects it
 * immediately, without waiting for the teacher to reselect the class/subject
 * (grade_records is read before the live exam-room merge — see useGradeBook.ts).
 * No-ops when the room isn't linked to a grade-book subject/class — same as
 * the grade book's own online-sync behavior for unlinked rooms.
 */
async function syncApprovedScoreToGradeBook(
  request: ExamScoreOverrideRequest,
  room: ExamRoom,
): Promise<void> {
  if (!isLinkedToGradeBook(room)) return;

  const link = room.settings.gradeBookSubjects?.[0];
  const subjectId = room.settings.gradeBookSubjectId ?? link?.subjectId ?? room.subjectId;
  const subjectName = room.settings.gradeBookSubjectName ?? link?.subjectName ?? room.subjectName;
  const subjectCode = room.settings.gradeBookSubjectCode ?? link?.subjectCode;
  const { classId, className } = room;
  if (!subjectId || !subjectName || !subjectCode || !classId || !className) return;

  const field = scoreCollectionTypeToGradeField(room.settings.scoreCollectionType ?? room.settings.gradeBookScoreType);
  const percent = rawPointsToPercent(request.requestedScore, request.maxPoints);

  const docId = `${subjectId}_${classId}_${request.studentId}_${room.academicYearId}_${room.semester}`;
  const ref = doc(db, 'grade_records', docId);
  const existing = (await getDoc(ref)).data() as NewGradeRecord | undefined;

  const record: NewGradeRecord = {
    studentId: request.studentId,
    studentName: existing?.studentName ?? request.studentName,
    studentCode: existing?.studentCode ?? '',
    subjectId,
    subjectName,
    subjectCode,
    classId,
    className,
    teacherId: existing?.teacherId ?? room.teacherId,
    departmentId: existing?.departmentId ?? room.departmentId as NewGradeRecord['departmentId'],
    academicYearId: room.academicYearId,
    semester: room.semester,
    classworkScore: existing?.classworkScore ?? null,
    midtermScore: existing?.midtermScore ?? null,
    finalScore: existing?.finalScore ?? null,
    totalScore: existing?.totalScore ?? null,
    grade: existing?.grade ?? null,
    result: existing?.result,
    absent: existing?.absent ?? false,
    note: existing?.note,
    updatedAt: new Date().toISOString(),
    [field]: percent,
  };
  await setDoc(ref, record, { merge: true });
}

export async function approveScoreOverride(
  request: ExamScoreOverrideRequest,
  approverId: string,
  approverName: string,
): Promise<void> {
  await updateDoc(doc(db, 'exam_rooms', request.roomId, 'attempts', request.attemptId), {
    score: request.requestedScore,
    objectiveScore: request.requestedScore,
    manuallyOverridden: true,
  });

  const roomSnap = await getDoc(doc(db, 'exam_rooms', request.roomId));
  if (roomSnap.exists()) {
    await syncApprovedScoreToGradeBook(request, { id: roomSnap.id, ...roomSnap.data() } as ExamRoom);
  }

  await updateDoc(doc(db, 'exam_score_overrides', request.id), {
    status: 'approved',
    approverId,
    approverName,
    updatedAt: serverTimestamp(),
  });
  await logActivity({
    action: 'approve_score_override',
    category: 'academic',
    status: 'success',
    targetId: request.id,
    metadata: {
      roomId: request.roomId,
      attemptId: request.attemptId,
      studentId: request.studentId,
      requestedScore: request.requestedScore,
    },
  });
}

export async function rejectScoreOverride(
  request: ExamScoreOverrideRequest,
  approverId: string,
  approverName: string,
  note: string,
): Promise<void> {
  await updateDoc(doc(db, 'exam_score_overrides', request.id), {
    status: 'rejected',
    approverId,
    approverName,
    approverNote: note,
    updatedAt: serverTimestamp(),
  });
  await logActivity({
    action: 'reject_score_override',
    category: 'academic',
    status: 'success',
    targetId: request.id,
    metadata: { roomId: request.roomId, requestedScore: request.requestedScore },
  });
}
