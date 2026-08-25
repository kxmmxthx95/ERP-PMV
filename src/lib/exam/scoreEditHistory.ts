import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

/** Records one manual score edit to score_edit_history — call alongside the attempt updateDoc. */
export async function logScoreEdit(entry: {
  roomId: string;
  roomTitle: string;
  attemptId: string;
  studentId: string;
  studentName: string;
  round: number;
  previousScore: number | null;
  newScore: number;
  maxPoints: number;
  reason: string;
  editedBy: string;
  editedByName: string;
}): Promise<void> {
  await addDoc(collection(db, 'score_edit_history'), {
    ...entry,
    createdAt: serverTimestamp(),
  });
}
