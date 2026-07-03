/** รอ Firebase Auth login สำเร็จก่อนเปิด Firestore — rules ต้องมี request.auth */

import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';

let gatewayPromise: Promise<void> | null = null;

function waitForAuthenticatedUser(): Promise<void> {
  return auth.authStateReady().then(() => {
    if (auth.currentUser) return;
    return new Promise<void>((resolve) => {
      const unsub = onAuthStateChanged(auth, (user) => {
        if (user) {
          unsub();
          resolve();
        }
      });
    });
  });
}

export function openFirestoreGateway(): Promise<void> {
  if (!gatewayPromise) {
    gatewayPromise = waitForAuthenticatedUser();
  }
  return gatewayPromise;
}

export function resetFirestoreGateway(): void {
  gatewayPromise = null;
}

export function whenFirestoreGatewayOpen(): Promise<void> {
  return openFirestoreGateway();
}

/** รันงานหลัง login พร้อม */
export function runAfterGateway(task: () => void | Promise<void>): Promise<void> {
  return whenFirestoreGatewayOpen().then(() => task());
}

/** @deprecated ใช้ runAfterGateway แทน */
export function runStaggeredFirestoreTask(task: () => void | Promise<void>): Promise<void> {
  return runAfterGateway(task);
}
