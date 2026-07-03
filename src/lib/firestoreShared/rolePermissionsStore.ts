import { doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { createSharedStore } from './createSharedStore';
import { listenDocWithGetDoc } from './listenDocWithGetDoc';
import { sessionCache } from '@/lib/sessionCache';
import type { FeaturePermission, RolePermissionConfig } from '@/types/rolePermission';
import { FEATURE_LIST } from '@/types/rolePermission';

const CACHE_PREFIX = 'cache:role_permissions:';

function buildPermMap(permissions: FeaturePermission[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const p of permissions) {
    if (p.enabled) map[p.featureKey] = p.accessLevel;
  }
  return map;
}

function mergeWithDefaults(existing: FeaturePermission[]): FeaturePermission[] {
  const merged = FEATURE_LIST.map((f) => ({ ...f }));
  existing.forEach((p) => {
    const idx = merged.findIndex((f) => f.featureKey === p.featureKey);
    if (idx >= 0) merged[idx] = { ...merged[idx], ...p };
  });
  return merged;
}

function normalizeRoleConfig(raw: RolePermissionConfig | null): RolePermissionConfig | null {
  if (!raw?.permissions) return raw;
  const mergedPermissions = mergeWithDefaults(raw.permissions);
  return {
    ...raw,
    permissions: mergedPermissions,
    permMap: buildPermMap(mergedPermissions),
  };
}

function cacheRoleConfig(roleId: string, config: RolePermissionConfig | null) {
  if (config?.permMap && Object.keys(config.permMap).length > 0) {
    sessionCache.set(`${CACHE_PREFIX}${roleId}`, config);
  }
}

const stores = new Map<string, ReturnType<typeof createSharedStore<RolePermissionConfig | null>>>();

export function getRolePermissionsStore(roleId: string) {
  let store = stores.get(roleId);
  if (!store) {
    const cacheKey = `${CACHE_PREFIX}${roleId}`;
    const cached = sessionCache.get<RolePermissionConfig | null>(cacheKey);
    const initial = cached ? normalizeRoleConfig(cached) : null;

    store = createSharedStore<RolePermissionConfig | null>(
      (emit) => {
        const roleRef = doc(db, 'role_permissions', roleId);
        return listenDocWithGetDoc(
          roleRef,
          (raw) => normalizeRoleConfig(raw ? (raw as RolePermissionConfig) : null),
          (value) => {
            cacheRoleConfig(roleId, value);
            emit(value);
          },
          initial,
          `rolePermissions:${roleId}`,
        );
      },
      initial,
      { startReady: !!initial?.permMap },
    );
    stores.set(roleId, store);
  }
  return store;
}
