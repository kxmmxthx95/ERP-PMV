import { useEffect, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useActiveAcademicYear } from '@/hooks/useActiveAcademicYear';
import type { Course } from '@/types/course';

interface Options {
  role?: string;
  userId?: string;
  classId?: string;
}

export function useCourseList({ role, userId, classId }: Options) {
  const { year } = useActiveAcademicYear();
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!year || !role) {
      setCourses([]);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    const base = collection(db, 'courses');
    let q;

    if (role === 'student' && classId) {
      q = query(
        base,
        where('academicYearId', '==', year),
        where('status', '==', 'published'),
        where('classIds', 'array-contains', classId),
      );
    } else if (role === 'teacher' && userId) {
      q = query(
        base,
        where('academicYearId', '==', year),
        where('teacherId', '==', userId),
      );
    } else {
      // admin / sysadmin — all courses this year
      q = query(base, where('academicYearId', '==', year));
    }

    void getDocs(q).then((snap) => {
      if (cancelled) return;
      setCourses(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Course)));
      setIsLoading(false);
    });

    return () => { cancelled = true; };
  }, [year, role, userId, classId, reloadKey]);

  const refresh = () => setReloadKey((v) => v + 1);

  return { courses, isLoading, refresh };
}
