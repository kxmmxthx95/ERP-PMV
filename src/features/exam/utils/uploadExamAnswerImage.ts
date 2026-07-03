import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { compressImage } from '@/features/students/components/studentDetailFormShared';
import { storage } from '@/lib/firebase';

export async function uploadExamAnswerImage(
  roomId: string,
  attemptId: string,
  questionId: string,
  file: File,
): Promise<string> {
  const compressed = await compressImage(file, 1200, 1200, 0.72);
  const storageRef = ref(
    storage,
    `exam_rooms/${roomId}/attempts/${attemptId}/answers/${questionId}_${Date.now()}.jpg`,
  );
  await uploadBytes(storageRef, compressed, { contentType: 'image/jpeg' });
  return getDownloadURL(storageRef);
}
