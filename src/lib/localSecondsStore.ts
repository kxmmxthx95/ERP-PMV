import { useSyncExternalStore } from 'react';

function getLocalNowSeconds(): number {
  const now = new Date();
  return now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
}

let snapshot = getLocalNowSeconds();
const listeners = new Set<() => void>();
let intervalId: ReturnType<typeof setInterval> | null = null;
let subscriberCount = 0;

function emit() {
  snapshot = getLocalNowSeconds();
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  subscriberCount += 1;
  if (subscriberCount === 1 && intervalId === null) {
    emit();
    intervalId = setInterval(emit, 1000);
  }
  return () => {
    listeners.delete(listener);
    subscriberCount = Math.max(0, subscriberCount - 1);
    if (subscriberCount === 0 && intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };
}

function getSnapshot(): number {
  return snapshot;
}

/** Shared 1s clock — one interval app-wide; stops when nothing subscribes. */
export function useLocalNowSeconds(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function getRemainingSeconds(nowSeconds: number, targetMin: number): number {
  return Math.max(0, targetMin * 60 - nowSeconds);
}

export function formatCountdown(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
