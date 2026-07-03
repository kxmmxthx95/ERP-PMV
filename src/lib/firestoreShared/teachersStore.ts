import { collection } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { sessionCache } from '@/lib/sessionCache';
import { createSharedStore } from './createSharedStore';
import { listenQueryWithGetDocs } from './listenWithGetDocs';
import type { TeacherProfile } from '@/types/teacher';

const CACHE_TEACHERS = 'cache:teacher-manager:teachers';

let sharedTeachers: TeacherProfile[] = sessionCache.get<TeacherProfile[]>(CACHE_TEACHERS) ?? [];

function commitTeachers(rows: TeacherProfile[], emit: (value: TeacherProfile[]) => void) {
  sharedTeachers = rows;
  sessionCache.set(CACHE_TEACHERS, sharedTeachers);
  emit(sharedTeachers);
}

export const teachersCollectionStore = createSharedStore<TeacherProfile[]>(
  (emit) =>
    listenQueryWithGetDocs(
      collection(db, 'teachers'),
      (rows) => rows as unknown as TeacherProfile[],
      (rows) => commitTeachers(rows, emit),
      sharedTeachers,
      'teachersStore',
    ),
  sharedTeachers,
  { startReady: sharedTeachers.length > 0 },
);

export function invalidateTeachersCache() {
  sessionCache.invalidate(CACHE_TEACHERS);
  teachersCollectionStore.bump();
}
