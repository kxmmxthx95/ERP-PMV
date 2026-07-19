import { useCallback, useEffect, useState } from 'react';
import {
  collection,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  doc,
  where,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import type { LessonSubmission } from '@/types/course';
import { logActivity } from '@/lib/activityLogger';

const MAX_UPLOAD_BYTES = 100 * 1024 * 1024; // 100 MB

export interface UploadProgress {
  percent: number;
  state: 'running' | 'paused' | 'error' | 'success';
  error?: string;
}

export function useLessonSubmission(
  courseId: string | null | undefined,
  lessonId: string | null | undefined,
  studentId: string | null | undefined,
) {
  const [submission, setSubmission] = useState<LessonSubmission | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!courseId || !lessonId || !studentId) {
      setSubmission(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    void getDocs(
      query(
        collection(db, 'lesson_submissions'),
        where('courseId', '==', courseId),
        where('lessonId', '==', lessonId),
        where('studentId', '==', studentId),
      ),
    ).then((snap) => {
      if (cancelled) return;
      setSubmission(
        snap.empty ? null : ({ id: snap.docs[0].id, ...snap.docs[0].data() } as LessonSubmission),
      );
      setIsLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [courseId, lessonId, studentId, reloadKey]);

  const uploadSubmission = useCallback(
    (
      file: File,
      student: { id: string; name: string; studentCode?: string; classId: string },
      onProgress: (p: UploadProgress) => void,
    ): Promise<void> => {
      return new Promise((resolve, reject) => {
        if (!courseId || !lessonId) {
          reject(new Error('ไม่ระบุคอร์สหรือบทเรียน'));
          return;
        }

        if (file.size > MAX_UPLOAD_BYTES) {
          reject(new Error(`ไฟล์ใหญ่เกิน 100 MB (${(file.size / 1024 / 1024).toFixed(1)} MB)`));
          return;
        }

        const timestamp = Date.now();
        const storagePath = `courses/${courseId}/submissions/${lessonId}/${student.id}_${timestamp}_${file.name}`;
        const storageRef = ref(storage, storagePath);
        const task = uploadBytesResumable(storageRef, file);

        task.on(
          'state_changed',
          (snap) => {
            onProgress({
              percent: Math.round((snap.bytesTransferred / snap.totalBytes) * 100),
              state: snap.state as UploadProgress['state'],
            });
          },
          (err) => {
            onProgress({ percent: 0, state: 'error', error: err.message });
            reject(err);
          },
          async () => {
            try {
              const downloadURL = await getDownloadURL(task.snapshot.ref);
              const submissionRef = doc(collection(db, 'lesson_submissions'));
              await setDoc(submissionRef, {
                lessonId,
                courseId,
                studentId: student.id,
                studentName: student.name,
                studentCode: student.studentCode ?? null,
                classId: student.classId,
                fileURL: downloadURL,
                fileName: file.name,
                fileSizeBytes: file.size,
                submittedAt: serverTimestamp(),
                grade: null,
                feedback: null,
                gradedBy: null,
                gradedAt: null,
              });
              await logActivity({
                action: 'lesson_submission_upload',
                category: 'academic',
                detail: `ส่งงาน: ${file.name} (${(file.size / 1024 / 1024).toFixed(1)} MB)`,
                targetId: lessonId,
              });
              onProgress({ percent: 100, state: 'success' });
              setReloadKey((v) => v + 1);
              resolve();
            } catch (err) {
              reject(err);
            }
          },
        );
      });
    },
    [courseId, lessonId],
  );

  return { submission, isLoading, uploadSubmission };
}
