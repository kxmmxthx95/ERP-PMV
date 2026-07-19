// src/lib/firestoreShared/teacherKpiSettingsStore.ts
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { createSharedStore } from './createSharedStore';
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
      (emit) => {
        let cancelled = false;
        void getDoc(doc(db, 'teacher_kpi_settings', key))
          .then((snap) => {
            if (cancelled) return;
            const raw = snap.exists() ? snap.data() : undefined;
            emit(raw ? { ...fallback, ...raw } as TeacherKpiSettings : fallback);
          })
          .catch((err) => {
            console.warn(`[teacherKpiSettingsStore:${key}] getDoc failed:`, err);
            if (!cancelled) emit(fallback);
          });
        return () => {
          cancelled = true;
        };
      },
      fallback,
    );
    stores.set(key, store);
  }
  return store;
}
