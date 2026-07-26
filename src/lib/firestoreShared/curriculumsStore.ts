import { collection } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { sessionCache } from '@/lib/sessionCache';
import { createSharedStore } from './createSharedStore';
import { listenQueryWithGetDocs } from './listenWithGetDocs';

const CACHE_CURRICULUMS = 'cache:curriculums';

export type SharedCurriculumDoc = { id: string; [key: string]: unknown };

let sharedCurriculums: SharedCurriculumDoc[] = sessionCache.get<SharedCurriculumDoc[]>(CACHE_CURRICULUMS) ?? [];

function commitCurriculums(rows: SharedCurriculumDoc[], emit: (value: SharedCurriculumDoc[]) => void) {
  sharedCurriculums = rows;
  sessionCache.set(CACHE_CURRICULUMS, sharedCurriculums);
  emit(sharedCurriculums);
}

export const curriculumsCollectionStore = createSharedStore<SharedCurriculumDoc[]>(
  (emit) =>
    listenQueryWithGetDocs(
      collection(db, 'curriculums'),
      (rows) => rows as SharedCurriculumDoc[],
      (rows) => commitCurriculums(rows, emit),
      sharedCurriculums,
      'curriculumsStore',
    ),
  sharedCurriculums,
  { startReady: sharedCurriculums.length > 0 },
);
