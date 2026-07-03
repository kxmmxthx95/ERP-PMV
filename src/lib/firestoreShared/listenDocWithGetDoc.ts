import type { DocumentData, DocumentReference } from 'firebase/firestore';
import { getDoc, onSnapshot } from 'firebase/firestore';
import { whenFirestoreGatewayOpen } from './bootstrap';

export function listenDocWithGetDoc<T>(
  ref: DocumentReference<DocumentData>,
  mapDoc: (raw: DocumentData | undefined, id: string) => T,
  emit: (value: T) => void,
  fallback: T,
  logLabel: string,
): () => void {
  let unsub: (() => void) | null = null;
  let cancelled = false;

  void whenFirestoreGatewayOpen().then(async () => {
    if (cancelled) return;

    try {
      const snap = await getDoc(ref);
      if (cancelled) return;
      emit(mapDoc(snap.exists() ? snap.data() : undefined, snap.id));
    } catch (err) {
      console.error(`[${logLabel}] getDoc failed:`, err);
      if (cancelled) return;
      emit(fallback);
    }

    if (cancelled) return;

    unsub = onSnapshot(
      ref,
      (snap) => {
        if (cancelled) return;
        emit(mapDoc(snap.exists() ? snap.data() : undefined, snap.id));
      },
      (err) => {
        console.warn(`[${logLabel}] onSnapshot error (keeping last getDoc data):`, err);
      },
    );
  });

  return () => {
    cancelled = true;
    unsub?.();
    unsub = null;
  };
}
