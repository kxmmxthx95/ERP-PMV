import { useMemo } from 'react';
import { useRolePermissions } from './useRolePermissions';
import type { NavItem } from '@/components/layout/DashboardSidebar';
import type { AccessLevel } from '@/types/rolePermission';

function pathToFeatureKey(path: string): string {
  const segment = path.split('/').pop() ?? '';
  return segment.replace(/-/g, '_'); // pending-users → pending_users
}

export interface NavItemWithAccess extends NavItem {
  accessLevel: AccessLevel;
}

export function useDynamicSidebar(roleId: string) {
  const { data: config, isLoading } = useRolePermissions(roleId);

  const permissionMap = useMemo(() => {
    if (!config?.permissions) return null;
    return new Map(config.permissions.map(p => [p.featureKey, p]));
  }, [config]);

  const filterNavItems = (items: NavItem[]): NavItemWithAccess[] => {
    return items
      .filter(item => {
        const featureKey = pathToFeatureKey(item.path);
        const perm = permissionMap?.get(featureKey);

        // 1. ถ้ายังไม่มี config ใน Firestore → แสดงทุก item (fallback)
        if (!permissionMap) return true;

        // 2. ถ้าเป็นหน้า Dashboard/Home ของ Portal (path สั้น เช่น /admin, /staff) 
        // ให้แสดงเสมอเพื่อให้ผู้ใช้เข้าหน้าแรกได้
        const pathSegments = item.path.split('/').filter(Boolean);
        if (pathSegments.length <= 1) return true;

        // 3. ถ้ามี config → แสดงเฉพาะที่ enabled
        return perm?.enabled === true;
      })
      .map(item => {
        const featureKey = pathToFeatureKey(item.path);
        const perm = permissionMap?.get(featureKey);
        return {
          ...item,
          accessLevel: (perm?.accessLevel ?? 'full') as AccessLevel,
        };
      });
  };

  const getAccessLevel = (featureKey: string): AccessLevel => {
    return (permissionMap?.get(featureKey)?.accessLevel ?? 'full') as AccessLevel;
  };

  const isFeatureEnabled = (featureKey: string): boolean => {
    if (!permissionMap) return true;
    const perm = permissionMap.get(featureKey);
    // ถ้าไม่มีข้อมูลในระบบสิทธิ์ (เช่น เมนูช่วยเหลือ) ให้ถือว่าเปิดใช้งานปกติ
    if (!perm) return true;
    return perm.enabled === true;
  };

  return { filterNavItems, getAccessLevel, isFeatureEnabled, permissionMap, isLoading };
}
