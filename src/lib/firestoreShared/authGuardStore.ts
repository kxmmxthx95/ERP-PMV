import { doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { createSharedStore } from './createSharedStore';
import { listenDocWithGetDoc } from './listenDocWithGetDoc';

export type UserGuardSnapshot = {
  status?: string;
  forceLogoutAt?: unknown;
  sessionInvalidatedAt?: unknown;
  hardResetAt?: unknown;
} | null;

export type AuthControlsSnapshot = {
  forceLogoutAllAt?: unknown;
  hardResetAllAt?: unknown;
} | null;

function mapUserGuard(raw: Record<string, unknown> | undefined): UserGuardSnapshot {
  if (!raw) return null;
  return {
    status: typeof raw.status === 'string' ? raw.status : undefined,
    forceLogoutAt: raw.forceLogoutAt,
    sessionInvalidatedAt: raw.sessionInvalidatedAt,
    hardResetAt: raw.hardResetAt,
  };
}

function mapAuthControls(raw: Record<string, unknown> | undefined): AuthControlsSnapshot {
  if (!raw) return null;
  return {
    forceLogoutAllAt: raw.forceLogoutAllAt,
    hardResetAllAt: raw.hardResetAllAt,
  };
}

const userGuardStores = new Map<string, ReturnType<typeof createSharedStore<UserGuardSnapshot>>>();

export function getUserGuardStore(userId: string) {
  let store = userGuardStores.get(userId);
  if (!store) {
    let cached: UserGuardSnapshot = null;
    store = createSharedStore<UserGuardSnapshot>(
      (emit) => {
        const ref = doc(db, 'users', userId);
        return listenDocWithGetDoc(
          ref,
          (raw) => mapUserGuard(raw as Record<string, unknown> | undefined),
          (value) => {
            cached = value;
            emit(value);
          },
          cached,
          `authGuard:user:${userId}`,
        );
      },
      cached,
    );
    userGuardStores.set(userId, store);
  }
  return store;
}

let sharedAuthControls: AuthControlsSnapshot = null;

export const authControlsStore = createSharedStore<AuthControlsSnapshot>(
  (emit) => {
    const ref = doc(db, 'system_config', 'auth_controls');
    return listenDocWithGetDoc(
      ref,
      (raw) => mapAuthControls(raw as Record<string, unknown> | undefined),
      (value) => {
        sharedAuthControls = value;
        emit(value);
      },
      sharedAuthControls,
      'authGuard:controls',
    );
  },
  sharedAuthControls,
);
