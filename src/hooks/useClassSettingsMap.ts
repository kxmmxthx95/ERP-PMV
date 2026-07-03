import { useMemo, useSyncExternalStore } from 'react';
import {
  classSettingsStore,
  getClassSettingsBundleStore,
  classSettingsBundleKey,
  type ClassSettingsMap,
} from '@/lib/firestoreShared/classSettingsStore';

export function useClassSettingsMap(): ClassSettingsMap {
  return useSyncExternalStore(
    classSettingsStore.subscribe,
    classSettingsStore.getSnapshot,
    classSettingsStore.getSnapshot,
  );
}

/** Doc-level listeners for school_wide + scheduled class ids (Home executive widget). */
export function useExecutiveClassSettings(classIds: string[]): ClassSettingsMap {
  const key = classSettingsBundleKey(classIds);
  const store = useMemo(() => getClassSettingsBundleStore(classIds), [key]);
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}
