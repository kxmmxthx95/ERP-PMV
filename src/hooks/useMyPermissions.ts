// src/hooks/useMyPermissions.ts
// ดึงสิทธิ์ของ role ที่ login อยู่ในปัจจุบัน พร้อม helper สำหรับตรวจสอบ
import { useAuth } from './useAuth';
import { useRolePermissions } from './useRolePermissions';
import type { AccessLevel } from '@/types/rolePermission';

export interface PermissionHelpers {
  /** true ถ้า role นี้เห็นเมนู/feature นั้น (enabled = true) */
  canAccess: (featureKey: string) => boolean;
  /** true ถ้า accessLevel เป็น 'edit' หรือ 'full' */
  canEdit: (featureKey: string) => boolean;
  /** true ถ้า accessLevel เป็น 'full' เท่านั้น */
  canDelete: (featureKey: string) => boolean;
  /** คืนค่า accessLevel ของ feature ('view-only' | 'edit' | 'full' | null) */
  getLevel: (featureKey: string) => AccessLevel | null;
  isLoading: boolean;
  isSysAdmin: boolean;
}

export function useMyPermissions(): PermissionHelpers {
  const { role } = useAuth();
  const isSysAdmin = role === 'sysadmin';

  // sysadmin ไม่ต้องโหลดจาก Firestore เลย
  const { data, isLoading } = useRolePermissions(isSysAdmin ? undefined : (role ?? undefined));

  const getLevel = (featureKey: string): AccessLevel | null => {
    if (isSysAdmin) return 'full';
    const level = data?.permMap?.[featureKey];
    return (level as AccessLevel) ?? null;
  };

  const canAccess = (featureKey: string): boolean => {
    if (isSysAdmin) return true;
    return !!data?.permMap?.[featureKey];
  };

  const canEdit = (featureKey: string): boolean => {
    if (isSysAdmin) return true;
    const level = data?.permMap?.[featureKey] as AccessLevel | undefined;
    return level === 'edit' || level === 'full';
  };

  const canDelete = (featureKey: string): boolean => {
    if (isSysAdmin) return true;
    return data?.permMap?.[featureKey] === 'full';
  };

  return {
    canAccess,
    canEdit,
    canDelete,
    getLevel,
    isLoading: isSysAdmin ? false : isLoading,
    isSysAdmin,
  };
}
