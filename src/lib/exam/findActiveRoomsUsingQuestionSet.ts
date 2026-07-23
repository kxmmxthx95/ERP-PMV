import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { ExamRoom } from '@/types/exam';

function roomUsesQuestionSet(room: ExamRoom, setId: string): boolean {
  if (room.questionSetId === setId) return true;
  return Object.values(room.roundQuestions ?? {}).some((round) => round.questionSetId === setId);
}

/** ห้องสอบ status='active' ที่กำลังใช้ชุดข้อสอบนี้อยู่ — เตือนก่อนแก้/บันทึกเฉลยทับ */
export async function findActiveRoomsUsingQuestionSet(
  setId: string,
  academicYearId: string,
): Promise<ExamRoom[]> {
  const snap = await getDocs(query(
    collection(db, 'exam_rooms'),
    where('status', '==', 'active'),
    where('academicYearId', '==', academicYearId),
  ));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as ExamRoom)
    .filter((room) => roomUsesQuestionSet(room, setId));
}
