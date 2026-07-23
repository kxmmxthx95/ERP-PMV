import { collection, documentId, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const CHUNK_SIZE = 30;

export async function fetchStudentsByIds<T extends { id: string }>(ids: string[]): Promise<T[]> {
  const unique = [...new Set(ids.map((id) => String(id).trim()).filter(Boolean))];
  if (unique.length === 0) return [];

  const byId = new Map<string, T>();
  const chunks: string[][] = [];
  for (let i = 0; i < unique.length; i += CHUNK_SIZE) {
    chunks.push(unique.slice(i, i + CHUNK_SIZE));
  }
  // 1.5 Promise.all — parallel chunk reads instead of sequential waterfall
  const snaps = await Promise.all(
    chunks.map((group) =>
      getDocs(query(collection(db, 'students'), where(documentId(), 'in', group))),
    ),
  );
  for (const snap of snaps) {
    snap.docs.forEach((docSnap) => {
      byId.set(docSnap.id, { id: docSnap.id, ...docSnap.data() } as T);
    });
  }
  return [...byId.values()];
}

export function chunkIds(ids: string[], size = CHUNK_SIZE): string[][] {
  const unique = [...new Set(ids.filter(Boolean))];
  const chunks: string[][] = [];
  for (let i = 0; i < unique.length; i += size) {
    chunks.push(unique.slice(i, i + size));
  }
  return chunks;
}
