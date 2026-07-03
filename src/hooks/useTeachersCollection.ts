import { useSyncExternalStore } from 'react';
import { teachersCollectionStore } from '@/lib/firestoreShared/teachersStore';

export function useTeachersCollection() {
  const teachers = useSyncExternalStore(
    teachersCollectionStore.subscribe,
    teachersCollectionStore.getSnapshot,
    teachersCollectionStore.getSnapshot,
  );
  const loading = !teachersCollectionStore.getReady();
  return { teachers, loading };
}
