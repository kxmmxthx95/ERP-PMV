import { useEffect, useMemo, useState } from 'react';
import { collection, documentId, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { sessionCache } from '@/lib/sessionCache';

const CACHE_PREFIX = 'teacher_photo:';
const CHUNK_SIZE = 30;

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}

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

    let cancelled = false;

    async function fetchPhotos() {
      const result: Record<string, string> = {};
      const missing: string[] = [];

      // Serve from cache first; collect what needs fetching
      for (const id of ids) {
        const hit = sessionCache.get<string>(CACHE_PREFIX + id);
        if (hit !== null) {
          if (hit) result[id] = hit; // empty string = "no photo" sentinel
        } else {
          missing.push(id);
        }
      }

      if (!cancelled && Object.keys(result).length > 0) setPhotosById(result);
      if (missing.length === 0) return;

      // One getDocs call per chunk of 30 — no realtime connections
      for (const chunk of chunkArray(missing, CHUNK_SIZE)) {
        if (cancelled) return;
        const snap = await getDocs(
          query(collection(db, 'users'), where(documentId(), 'in', chunk)),
        );
        const found = new Set<string>();
        for (const docSnap of snap.docs) {
          found.add(docSnap.id);
          const raw = docSnap.data().photoURL;
          const photo = typeof raw === 'string' && raw.trim() ? raw.trim() : '';
          sessionCache.set(CACHE_PREFIX + docSnap.id, photo); // cache URL or "" sentinel
          if (photo) result[docSnap.id] = photo;
        }
        // Cache missing docs so we don't re-fetch them next render
        for (const id of chunk) {
          if (!found.has(id)) sessionCache.set(CACHE_PREFIX + id, '');
        }
      }

      if (!cancelled) setPhotosById({ ...result });
    }

    fetchPhotos();
    return () => { cancelled = true; };
  }, [idsKey]);

  return photosById;
}
