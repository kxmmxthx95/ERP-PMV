import { useCallback, useEffect, useState } from 'react';
import { collection, doc, getDocs, query, where, writeBatch, type QueryConstraint } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { ClassroomBehaviorRecord } from '@/types/classroomBehavior';

const COL = 'classroom_behavior';
const NONE: ClassroomBehaviorRecord[] = [];

/**
 * One-shot fetch (no realtime listener — quota). `filters` must include academicYearId + semester.
 * Pass null to skip. Call `reload()` after a save.
 */
export function useClassroomBehaviorRecords(filters: Record<string, unknown> | null) {
  const [loaded, setLoaded] = useState<{ token: string; rows: ClassroomBehaviorRecord[] }>({ token: '', rows: NONE });
  const [version, setVersion] = useState(0);
  const key = filters ? JSON.stringify(filters) : '';
  const token = `${key}#${version}`;

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    const constraints: QueryConstraint[] = Object.entries(JSON.parse(key) as Record<string, unknown>)
      .map(([k, v]) => Array.isArray(v) ? where(k, 'in', v) : where(k, '==', v));
    getDocs(query(collection(db, COL), ...constraints))
      .then((snap) => snap.docs.map((d) => ({ ...d.data(), id: d.id }) as ClassroomBehaviorRecord))
      .catch(() => NONE)
      .then((rows) => { if (!cancelled) setLoaded({ token, rows }); });
    return () => { cancelled = true; };
  }, [key, token]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  const ready = !!key && loaded.token === token;
  return { records: ready ? loaded.rows : NONE, loading: !!key && !ready, reload };
}

export async function saveClassroomBehaviorBatch(rows: ClassroomBehaviorRecord[]) {
  // ponytail: Firestore batch cap 500 — a class is ~50 students; chunk if that changes
  const batch = writeBatch(db);
  for (const { id, ...data } of rows) batch.set(doc(db, COL, id), data);
  await batch.commit();
}
