import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { logActivity } from '@/lib/activityLogger';
import type { ExamScoreOverrideRequest } from '@/types/exam';

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
