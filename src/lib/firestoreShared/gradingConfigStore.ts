import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { createSharedStore } from './createSharedStore';
import { DEFAULT_GRADING_CONFIG, type GradingConfig } from '@/types/gradingConfig';

export const gradingConfigStore = createSharedStore<GradingConfig>(
  (emit) => {
    let cancelled = false;
    void getDoc(doc(db, 'system_config', 'grading'))
      .then((snap) => {
        if (cancelled) return;
        const raw = snap.data();
        const config = raw ? { ...DEFAULT_GRADING_CONFIG, ...raw } as GradingConfig : DEFAULT_GRADING_CONFIG;
        emit(config);
      })
      .catch((err) => {
        console.warn('[gradingConfigStore] getDoc failed:', err);
        if (!cancelled) emit(DEFAULT_GRADING_CONFIG);
      });
    return () => {
      cancelled = true;
    };
  },
  DEFAULT_GRADING_CONFIG,
);
