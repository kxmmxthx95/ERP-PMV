import { useState, useCallback } from 'react';
import type { AppRole, AccessLevel, PermissionMatrix } from '@/types/permission';
import { DEFAULT_PERMISSION_MATRIX } from '@/types/permission';

const STORAGE_KEY = 'rolePermissionMatrix';

function loadMatrix(): PermissionMatrix {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored) as PermissionMatrix;
  } catch {
    // ignore
  }
  return DEFAULT_PERMISSION_MATRIX;
}

function saveMatrix(matrix: PermissionMatrix) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(matrix));
}

export function useRolePermissions() {
  const [matrix, setMatrix] = useState<PermissionMatrix>(loadMatrix);
  const [isDirty, setIsDirty] = useState(false);

  const getAccess = useCallback(
    (role: AppRole, featureId: string): AccessLevel =>
      matrix[role]?.[featureId] ?? 'none',
    [matrix],
  );

  // วน access level: none → partial → full → none
  const cycleAccess = useCallback((role: AppRole, featureId: string) => {
    setMatrix(prev => {
      const current = prev[role]?.[featureId] ?? 'none';
      const next: AccessLevel =
        current === 'none' ? 'partial' :
        current === 'partial' ? 'full' : 'none';
      const updated = {
        ...prev,
        [role]: { ...prev[role], [featureId]: next },
      };
      return updated;
    });
    setIsDirty(true);
  }, []);

  const setAccess = useCallback((role: AppRole, featureId: string, level: AccessLevel) => {
    setMatrix(prev => ({
      ...prev,
      [role]: { ...prev[role], [featureId]: level },
    }));
    setIsDirty(true);
  }, []);

  const save = useCallback(() => {
    saveMatrix(matrix);
    setIsDirty(false);
  }, [matrix]);

  const reset = useCallback(() => {
    setMatrix(DEFAULT_PERMISSION_MATRIX);
    setIsDirty(true);
  }, []);

  const discard = useCallback(() => {
    setMatrix(loadMatrix());
    setIsDirty(false);
  }, []);

  // สรุปจำนวน feature ที่ role นั้นเข้าถึงได้
  const getRoleSummary = useCallback((role: AppRole) => {
    const perms = matrix[role] ?? {};
    const full    = Object.values(perms).filter(v => v === 'full').length;
    const partial = Object.values(perms).filter(v => v === 'partial').length;
    const total   = Object.keys(perms).length;
    return { full, partial, none: total - full - partial, total };
  }, [matrix]);

  return {
    matrix,
    isDirty,
    getAccess,
    cycleAccess,
    setAccess,
    save,
    reset,
    discard,
    getRoleSummary,
  };
}
