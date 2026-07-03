import { useEffect, useMemo, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export function useTeacherPhotosById(teacherIds: string[]) {
  const [photosById, setPhotosById] = useState<Record<string, string>>({});

  const normalizedIds = useMemo(
    () => [...new Set(teacherIds.map((id) => id.trim()).filter(Boolean))].sort(),
    [teacherIds],
  );

  const idsKey = normalizedIds.join(',');

  useEffect(() => {
    const ids = idsKey ? idsKey.split(',') : [];
    if (ids.length === 0) {
      setPhotosById({});
      return;
    }

    const unsubs = ids.map((teacherId) =>
      onSnapshot(
        doc(db, 'users', teacherId),
        (snap) => {
          const photoURL = snap.exists() ? snap.data().photoURL : undefined;
          const nextPhoto =
            typeof photoURL === 'string' && photoURL.trim() ? photoURL.trim() : undefined;

          setPhotosById((prev) => {
            if (prev[teacherId] === nextPhoto) return prev;
            if (!nextPhoto) {
              const { [teacherId]: _removed, ...rest } = prev;
              return rest;
            }
            return { ...prev, [teacherId]: nextPhoto };
          });
        },
        () => {
          setPhotosById((prev) => {
            if (!(teacherId in prev)) return prev;
            const { [teacherId]: _removed, ...rest } = prev;
            return rest;
          });
        },
      ),
    );

    return () => {
      unsubs.forEach((unsub) => unsub());
    };
  }, [idsKey]);

  return photosById;
}
