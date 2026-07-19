// src/lib/firestoreShared/teacherKpiSettingsStore.ts
import { doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { createSharedStore } from './createSharedStore';
import { listenDocWithGetDoc } from './listenDocWithGetDoc';
import type { TeacherKpiSettings } from '@/types/teacherKpi';

const stores = new Map<string, ReturnType<typeof createSharedStore<TeacherKpiSettings>>>();

export function teacherKpiSettingsDocId(academicYearId: string, semester: 1 | 2): string {
  return `${academicYearId}_${semester}`;
}

function emptySettings(academicYearId: string, semester: 1 | 2): TeacherKpiSettings {
  return { academicYearId, semester, startDate: '' };
}

export function getTeacherKpiSettingsStore(academicYearId: string, semester: 1 | 2) {
  const key = teacherKpiSettingsDocId(academicYearId, semester);
  let store = stores.get(key);
  if (!store) {
    const fallback = emptySettings(academicYearId, semester);
    store = createSharedStore<TeacherKpiSettings>(
      (emit) =>
        listenDocWithGetDoc(
          doc(db, 'teacher_kpi_settings', key),
          (raw) => (raw ? { ...fallback, ...raw } as TeacherKpiSettings : fallback),
          emit,
          fallback,
          `teacherKpiSettingsStore:${key}`,
        ),
      fallback,
    );
    stores.set(key, store);
  }
  return store;
}
