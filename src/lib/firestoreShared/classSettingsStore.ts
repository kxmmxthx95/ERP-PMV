import { collection, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { createSharedStore } from './createSharedStore';
import { listenQueryWithGetDocs } from './listenWithGetDocs';
import { listenDocWithGetDoc } from './listenDocWithGetDoc';
import type { ScheduleSettings } from '@/hooks/useScheduleSettings';

export type ClassSettingsMap = Record<string, Partial<ScheduleSettings>>;

let cached: ClassSettingsMap = {};

function mapClassSettings(rows: { id: string; [key: string]: unknown }[]): ClassSettingsMap {
  const next: ClassSettingsMap = {};
  rows.forEach((row) => {
    const { id, ...data } = row;
    next[id] = data as Partial<ScheduleSettings>;
  });
  return next;
}

/** Full collection — avoid on Home; use getClassSettingsBundleStore instead. */
export const classSettingsStore = createSharedStore<ClassSettingsMap>(
  (emit) => listenQueryWithGetDocs(
    collection(db, 'class_settings'),
    mapClassSettings,
    (value) => {
      cached = value;
      emit(value);
    },
    cached,
    'classSettingsStore',
  ),
  {},
);

function bundleKey(classIds: string[]) {
  return ['school_wide', ...[...new Set(classIds.filter(Boolean))].sort()].join('|');
}

const bundleStores = new Map<string, ReturnType<typeof createSharedStore<ClassSettingsMap>>>();

/** Doc-level listeners for school_wide + today's scheduled classes only. */
export function getClassSettingsBundleStore(classIds: string[]) {
  const key = bundleKey(classIds);
  let store = bundleStores.get(key);
  if (!store) {
    let snapshot: ClassSettingsMap = {};
    const docIds = key.split('|');

    store = createSharedStore<ClassSettingsMap>(
      (emit) => {
        const unsubs = docIds.map((id) => {
          const ref = doc(db, 'class_settings', id);
          return listenDocWithGetDoc(
            ref,
            (raw) => (raw ? (raw as Partial<ScheduleSettings>) : {}),
            (value) => {
              snapshot = { ...snapshot, [id]: value };
              emit(snapshot);
            },
            snapshot[id] ?? {},
            `classSettings:doc:${id}`,
          );
        });
        return () => unsubs.forEach((u) => u());
      },
      snapshot,
    );
    bundleStores.set(key, store);
  }
  return store;
}

export { bundleKey as classSettingsBundleKey };
