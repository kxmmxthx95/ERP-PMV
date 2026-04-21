import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from 'sonner';
import type { RolePermissionConfig, FeaturePermission } from '@/types/rolePermission';
import { FEATURE_LIST } from '@/types/rolePermission';

export function useRolePermissions(roleId?: string) {
  return useQuery({
    queryKey: ['rolePermissions', roleId],
    queryFn: async () => {
      if (!roleId) return null;
      const docRef = doc(db, 'role_permissions', roleId);
      const docSnap = await getDoc(docRef);
      return (docSnap.exists() ? docSnap.data() : null) as RolePermissionConfig | null;
    },
    enabled: !!roleId,
  });
}

export function useAllRolePermissions() {
  return useQuery({
    queryKey: ['allRolePermissions'],
    queryFn: async () => {
      const roles = ['student', 'parent', 'teacher', 'staff', 'admin', 'sysadmin'];
      const result: Record<string, RolePermissionConfig | null> = {};

      for (const role of roles) {
        const docRef = doc(db, 'role_permissions', role);
        const docSnap = await getDoc(docRef);
        result[role] = docSnap.exists() ? (docSnap.data() as RolePermissionConfig) : null;
      }

      return result;
    },
  });
}

export function useUpdateRolePermission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ roleId, permission }: { roleId: string; permission: FeaturePermission }) => {
      const docRef = doc(db, 'role_permissions', roleId);
      const docSnap = await getDoc(docRef);

      let config: RolePermissionConfig;
      if (docSnap.exists()) {
        const existingData = docSnap.data() as RolePermissionConfig;
        const permIndex = existingData.permissions.findIndex(p => p.featureKey === permission.featureKey);
        if (permIndex >= 0) {
          existingData.permissions[permIndex] = permission;
        } else {
          existingData.permissions.push(permission);
        }
        config = { ...existingData, updatedAt: serverTimestamp() };
      } else {
        config = {
          roleId,
          permissions: [permission],
          updatedAt: serverTimestamp(),
        };
      }

      await setDoc(docRef, config);
      return config;
    },
    onSuccess: (_, { roleId }) => {
      queryClient.invalidateQueries({ queryKey: ['rolePermissions', roleId] });
      queryClient.invalidateQueries({ queryKey: ['allRolePermissions'] });
      toast.success('บันทึกสำเร็จ');
    },
    onError: (error: any) => {
      toast.error(`เกิดข้อผิดพลาด: ${error.message}`);
    },
  });
}

export function useInitializeRolePermissions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const roles = ['student', 'parent', 'teacher', 'staff', 'admin', 'sysadmin'];

      // กำหนด default permissions สำหรับแต่ละ role
      const defaultConfigs: Record<string, RolePermissionConfig> = {
        sysadmin: {
          roleId: 'sysadmin',
          permissions: FEATURE_LIST.map(f => ({ ...f, enabled: true, accessLevel: 'full' as const })),
          updatedAt: serverTimestamp(),
        },
        admin: {
          roleId: 'admin',
          permissions: FEATURE_LIST.map(f => {
            if (['users', 'pending_users', 'roles', 'logs', 'settings'].includes(f.featureKey)) {
              return { ...f, enabled: false, accessLevel: 'view-only' as const };
            }
            if (['structure'].includes(f.featureKey)) {
              return { ...f, enabled: true, accessLevel: 'view-only' as const };
            }
            return { ...f, enabled: true, accessLevel: 'edit' as const };
          }),
          updatedAt: serverTimestamp(),
        },
        teacher: {
          roleId: 'teacher',
          permissions: FEATURE_LIST.map(f => {
            if (['syllabus', 'schedule', 'students', 'grades', 'attendance', 'calendar'].includes(f.featureKey)) {
              return { ...f, enabled: true, accessLevel: 'edit' as const };
            }
            return { ...f, enabled: false, accessLevel: 'view-only' as const };
          }),
          updatedAt: serverTimestamp(),
        },
        staff: {
          roleId: 'staff',
          permissions: FEATURE_LIST.map(f => {
            if (['students', 'attendance', 'documents', 'announcements', 'calendar'].includes(f.featureKey)) {
              return { ...f, enabled: true, accessLevel: f.featureKey === 'attendance' ? 'edit' : 'view-only' as const };
            }
            return { ...f, enabled: false, accessLevel: 'view-only' as const };
          }),
          updatedAt: serverTimestamp(),
        },
        parent: {
          roleId: 'parent',
          permissions: FEATURE_LIST.map(f => {
            if (['calendar', 'announcements'].includes(f.featureKey)) {
              return { ...f, enabled: true, accessLevel: 'view-only' as const };
            }
            return { ...f, enabled: false, accessLevel: 'view-only' as const };
          }),
          updatedAt: serverTimestamp(),
        },
        student: {
          roleId: 'student',
          permissions: FEATURE_LIST.map(f => {
            if (['calendar', 'announcements'].includes(f.featureKey)) {
              return { ...f, enabled: true, accessLevel: 'view-only' as const };
            }
            return { ...f, enabled: false, accessLevel: 'view-only' as const };
          }),
          updatedAt: serverTimestamp(),
        },
      };

      for (const role of roles) {
        const config = defaultConfigs[role];
        if (config) {
          await setDoc(doc(db, 'role_permissions', role), config);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allRolePermissions'] });
      queryClient.invalidateQueries({ queryKey: ['rolePermissions'] });
      toast.success('สร้างค่า default สำเร็จ');
    },
    onError: (error: any) => {
      toast.error(`เกิดข้อผิดพลาด: ${error.message}`);
    },
  });
}
