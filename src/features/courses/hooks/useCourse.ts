import { useEffect, useState } from 'react';
import { collection, doc, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Course, Lesson } from '@/types/course';

export function useCourse(courseId: string | null | undefined) {
  const [course, setCourse] = useState<Course | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!courseId) {
      setCourse(null);
      setLessons([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    // Track both subscriptions so we only set isLoading=false once both arrive.
    let courseReady = false;
    let lessonsReady = false;
    let cancelled = false;

    const trySetLoaded = () => {
      if (courseReady && lessonsReady && !cancelled) setIsLoading(false);
    };

    const courseUnsub = onSnapshot(
      doc(db, 'courses', courseId),
      (snap) => {
        if (cancelled) return;
        setCourse(snap.exists() ? ({ id: snap.id, ...snap.data() } as Course) : null);
        if (!snap.exists()) setError('ไม่พบคอร์สนี้');
        courseReady = true;
        trySetLoaded();
      },
      (err) => {
        if (!cancelled) {
          setError(err.message);
          courseReady = true;
          trySetLoaded();
        }
      },
    );

    const lessonsUnsub = onSnapshot(
      query(collection(db, 'courses', courseId, 'lessons'), orderBy('order', 'asc')),
      (snap) => {
        if (cancelled) return;
        setLessons(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Lesson)));
        lessonsReady = true;
        trySetLoaded();
      },
      (err) => {
        if (!cancelled) {
          console.error('[useCourse] lessons error:', err);
          lessonsReady = true;
          trySetLoaded();
        }
      },
    );

    return () => {
      cancelled = true;
      courseUnsub();
      lessonsUnsub();
    };
  }, [courseId]);

  return { course, lessons, isLoading, error };
}
