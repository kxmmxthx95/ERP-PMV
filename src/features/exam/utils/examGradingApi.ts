import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';

export type ExamGradingCallableResult = {
  status: string;
  score?: number;
};

export async function requestExamAttemptGrading(
  roomId: string,
  attemptId: string,
): Promise<ExamGradingCallableResult> {
  const fn = httpsCallable<
    { roomId: string; attemptId: string },
    ExamGradingCallableResult
  >(functions, 'requestExamAttemptGrading');
  const res = await fn({ roomId, attemptId });
  return res.data;
}
