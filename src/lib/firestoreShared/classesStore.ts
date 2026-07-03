import { collection } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { sessionCache } from '@/lib/sessionCache';
import { createSharedStore } from './createSharedStore';
import { listenQueryWithGetDocs } from './listenWithGetDocs';

const CACHE_CLASSES = 'cache:classes';

export type SharedClassDoc = { id: string; [key: string]: unknown };

let sharedClasses: SharedClassDoc[] = sessionCache.get<SharedClassDoc[]>(CACHE_CLASSES) ?? [];

function commitClasses(rows: SharedClassDoc[], emit: (value: SharedClassDoc[]) => void) {
  sharedClasses = rows;
  sessionCache.set(CACHE_CLASSES, sharedClasses);
  emit(sharedClasses);
}

export const classesCollectionStore = createSharedStore<SharedClassDoc[]>(
  (emit) =>
    listenQueryWithGetDocs(
      collection(db, 'classes'),
      (rows) => rows as SharedClassDoc[],
      (rows) => commitClasses(rows, emit),
      sharedClasses,
      'classesStore',
    ),
  sharedClasses,
  { startReady: sharedClasses.length > 0 },
);
