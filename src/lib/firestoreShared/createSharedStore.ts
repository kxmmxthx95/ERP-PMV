/** Ref-counted external store — one Firestore subscription shared by all hook instances. */

import { runAfterGateway } from './bootstrap';

type SharedStoreOptions = {
  /** มีข้อมูลจาก cache แล้ว — ไม่ block UI ด้วย loading */
  startReady?: boolean;
};

export function createSharedStore<T>(
  startListener: (emit: (value: T) => void) => () => void,
  initial: T,
  options?: SharedStoreOptions,
) {
  let snapshot = initial;
  let refCount = 0;
  let unsubscribe: (() => void) | null = null;
  let starting = false;
  let ready = options?.startReady ?? false;
  const listeners = new Set<() => void>();

  const notify = () => {
    listeners.forEach((listener) => listener());
  };

  const ensureStarted = () => {
    if (unsubscribe || starting) return;
    starting = true;
    void runAfterGateway(() => {
      if (refCount <= 0 || unsubscribe) return;
      try {
        unsubscribe = startListener((value) => {
          snapshot = value;
          ready = true;
          notify();
        });
      } catch (err) {
        console.error('[createSharedStore] startListener failed:', err);
        ready = true;
        notify();
      }
    }).finally(() => {
      starting = false;
      if (refCount > 0 && !unsubscribe) ensureStarted();
    });
  };

  const ensureStopped = () => {
    if (refCount > 0 || !unsubscribe) return;
    unsubscribe();
    unsubscribe = null;
    starting = false;
    ready = options?.startReady ?? false;
  };

  const publish = (value: T) => {
    snapshot = value;
    ready = true;
    notify();
  };

  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      refCount += 1;
      ensureStarted();
      return () => {
        listeners.delete(listener);
        refCount -= 1;
        ensureStopped();
      };
    },
    getSnapshot: () => snapshot,
    getReady: () => ready,
    bump: notify,
    publish,
  };
}
