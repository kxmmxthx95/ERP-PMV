import { useCallback, useEffect, useState } from 'react';
import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { LessonComment } from '@/types/course';

export function useLessonComments(
  courseId: string | null | undefined,
  lessonId: string | null | undefined,
) {
  const [comments, setComments] = useState<LessonComment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!courseId || !lessonId) {
      setComments([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    // Requires composite index: courseId ASC + lessonId ASC + createdAt ASC
    const q = query(
      collection(db, 'lesson_comments'),
      where('courseId', '==', courseId),
      where('lessonId', '==', lessonId),
      orderBy('createdAt', 'asc'),
    );

    // onSnapshot returns its own unsubscribe — return it directly for cleanup.
    const unsub = onSnapshot(
      q,
      (snap) => {
        setComments(snap.docs.map((d) => ({ id: d.id, ...d.data() } as LessonComment)));
        setIsLoading(false);
      },
      (err) => {
        console.error('[useLessonComments] snapshot error:', err);
        setIsLoading(false);
      },
    );

    return unsub;
  }, [courseId, lessonId]);

  const postComment = useCallback(
    async (
      content: string,
      author: { id: string; name: string; role: string },
      parentId?: string,
    ) => {
      if (!courseId || !lessonId || !content.trim()) return;
      await addDoc(collection(db, 'lesson_comments'), {
        courseId,
        lessonId,
        authorId: author.id,
        authorName: author.name,
        authorRole: author.role,
        content: content.trim(),
        parentId: parentId ?? null,
        createdAt: serverTimestamp(),
      });
    },
    [courseId, lessonId],
  );

  return { comments, isLoading, postComment };
}
