import { useCallback, useSyncExternalStore } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { gradingConfigStore } from '@/lib/firestoreShared/gradingConfigStore';
import {
  DEFAULT_GRADING_CONFIG,
  type GradingConfig,
} from '@/types/gradingConfig';

export type { GradingConfig };
export { DEFAULT_GRADING_CONFIG };

export function useGradingConfig() {
  const config = useSyncExternalStore(
    gradingConfigStore.subscribe,
    gradingConfigStore.getSnapshot,
    gradingConfigStore.getSnapshot,
  );

  const saveConfig = useCallback(async (next: GradingConfig) => {
    const ref = doc(db, 'system_config', 'grading');
    await setDoc(ref, { ...next, updatedAt: new Date().toISOString() });
    gradingConfigStore.publish(next);
  }, []);

  return { config, loading: false, saveConfig };
}
