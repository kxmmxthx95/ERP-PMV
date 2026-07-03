/** getDocs ก่อน onSnapshot — ได้ข้อมูลทันทีแม้ listener ล้ม (channel 400 / named DB) */

import type { DocumentData, Query, QuerySnapshot } from 'firebase/firestore';
import { getDocs, onSnapshot } from 'firebase/firestore';
import { whenFirestoreGatewayOpen } from './bootstrap';

type DocRow = { id: string; [key: string]: unknown };

function rowsFromSnap(snap: QuerySnapshot<DocumentData>): DocRow[] {
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export function listenQueryWithGetDocs<T>(
  q: Query<DocumentData>,
  mapRows: (rows: DocRow[]) => T,
  emit: (value: T) => void,
  fallback: T,
  logLabel: string,
): () => void {
  let unsub: (() => void) | null = null;
  let cancelled = false;

  void whenFirestoreGatewayOpen().then(async () => {
    if (cancelled) return;

    try {
      const snap = await getDocs(q);
      if (cancelled) return;
      emit(mapRows(rowsFromSnap(snap)));
    } catch (err) {
      console.error(`[${logLabel}] getDocs failed:`, err);
      if (cancelled) return;
      emit(fallback);
    }

    if (cancelled) return;

    unsub = onSnapshot(
      q,
      (snap) => {
        if (cancelled) return;
        emit(mapRows(rowsFromSnap(snap)));
      },
      (err) => {
        // getDocs อาจสำเร็จแล้ว — อย่า reset เป็น fallback ว่างเมื่อ listener ล้ม (pmv1 / long polling)
        console.warn(`[${logLabel}] onSnapshot error (keeping last getDocs data):`, err);
      },
    );
  });

  return () => {
    cancelled = true;
    unsub?.();
    unsub = null;
  };
}
