import { useMutation } from '@tanstack/react-query';
import { doc, getDoc, setDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { toast } from 'sonner';
import type { RolePermissionConfig, FeaturePermission } from '@/types/rolePermission';
import { FEATURE_LIST } from '@/types/rolePermission';

export function useRolePermissions(roleId?: string) {
  const [snapshot, setSnapshot] = useState<{ roleId: string; data: RolePermissionConfig | null } | null>(null);

  useEffect(() => {
    if (!roleId) return;
    const docRef = doc(db, 'role_permissions', roleId);

    let cancelled = false;
    const unsubscribe = onSnapshot(
      docRef,
      (docSnap) => {
        if (cancelled) return;
        const rawData = docSnap.exists() ? docSnap.data() : null;
        let newData = rawData as RolePermissionConfig | null;

        if (newData && newData.permissions) {
          // Merge with FEATURE_LIST to ensure new features are present
          const mergedPermissions = mergeWithDefaults(newData.permissions);
          newData = {
            ...newData,
            permissions: mergedPermissions,
            permMap: buildPermMap(mergedPermissions)
          };
        }

        console.log(`[useRolePermissions] Listener fired for role: ${roleId}`, newData);
        setSnapshot({ roleId, data: newData });
      },
      (error) => {
        if (cancelled) return;
        console.error(`[useRolePermissions] Error listening to role ${roleId}:`, error);
        setSnapshot({ roleId, data: null });
      }
    );

    return () => { cancelled = true; unsubscribe(); };
  }, [roleId]);

  const isLoading = !!roleId && snapshot?.roleId !== roleId;
  const data = roleId && snapshot?.roleId === roleId ? snapshot.data : null;

  return { data, isLoading };
}

export function useAllRolePermissions() {
  const [data, setData] = useState<Record<string, RolePermissionConfig | null> | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const roles = ['student', 'parent', 'teacher', 'staff', 'admin', 'sysadmin'];
    const result: Record<string, RolePermissionConfig | null> = {};
    let loadedCount = 0;

    // Set up listeners for each role
    const unsubscribers: Array<() => void> = [];

    roles.forEach((role) => {
      const docRef = doc(db, 'role_permissions', role);
        const unsubscribe = onSnapshot(
          docRef,
        (docSnap) => {
          if (cancelled) return;
            const rawData = docSnap.exists() ? docSnap.data() : null;
            let roleData = rawData as RolePermissionConfig | null;

            if (roleData && roleData.permissions) {
              const mergedPermissions = mergeWithDefaults(roleData.permissions);
              roleData = {
                ...roleData,
                permissions: mergedPermissions,
                permMap: buildPermMap(mergedPermissions)
              };
            }

          result[role] = roleData;
          loadedCount++;

          if (loadedCount === roles.length) {
            setData({ ...result });
            setIsLoading(false);
          } else {
            setData({ ...result });
          }
        },
        (error) => {
          if (cancelled) return;
          console.error(`Error listening to ${role} permissions:`, error);
          loadedCount++;
          if (loadedCount === roles.length) {
            setIsLoading(false);
          }
        }
      );

      unsubscribers.push(unsubscribe);
    });

    return () => {
      cancelled = true;
      unsubscribers.forEach(unsub => unsub());
    };
  }, []);

  return { data, isLoading };
}

function buildPermMap(permissions: FeaturePermission[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const p of permissions) {
    if (p.enabled) map[p.featureKey] = p.accessLevel;
  }
  return map;
}

function mergeWithDefaults(existing: FeaturePermission[]): FeaturePermission[] {
  // Start with a copy of ALL features from FEATURE_LIST
  const merged = FEATURE_LIST.map(f => ({ ...f }));
  
  // Overlay existing permissions from database
  existing.forEach(p => {
    const idx = merged.findIndex(f => f.featureKey === p.featureKey);
    if (idx >= 0) {
      merged[idx] = { ...merged[idx], ...p };
    }
  });
  
  return merged;
}

export function useUpdateRolePermission() {
  return useMutation({
    mutationFn: async ({ roleId, permission }: { roleId: string; permission: FeaturePermission }) => {
      const docRef = doc(db, 'role_permissions', roleId);
      const docSnap = await getDoc(docRef);

      let permissions: FeaturePermission[];
      if (docSnap.exists()) {
        const existingData = docSnap.data() as RolePermissionConfig;
        const permIndex = existingData.permissions.findIndex(p => p.featureKey === permission.featureKey);
        if (permIndex >= 0) {
          existingData.permissions[permIndex] = permission;
        } else {
          existingData.permissions.push(permission);
        }
        permissions = existingData.permissions;
      } else {
        // document ยังไม่มี → สร้างใหม่พร้อม features ทั้งหมด (disabled ทั้งหมดก่อน แล้ว override ตัวที่กำลัง toggle)
        permissions = FEATURE_LIST.map(f =>
          f.featureKey === permission.featureKey ? permission : { ...f, enabled: false }
        );
      }

      const config: RolePermissionConfig = {
        roleId,
        permissions,
        permMap: buildPermMap(permissions),
        updatedAt: serverTimestamp(),
      };

      await setDoc(docRef, config);
      return config;
    },
    onSuccess: () => {
      toast.success('บันทึกสำเร็จ');
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'unknown error';
      toast.error(`เกิดข้อผิดพลาด: ${message}`);
    },
  });
}

export function useInitializeRolePermissions() {
  return useMutation({
    mutationFn: async () => {
      const roles = ['student', 'parent', 'teacher', 'staff', 'admin', 'sysadmin'];

      // กำหนด default permissions สำหรับแต่ละ role
      const makeConfig = (roleId: string, permissions: FeaturePermission[]): RolePermissionConfig => ({
        roleId,
        permissions,
        permMap: buildPermMap(permissions),
        updatedAt: serverTimestamp(),
      });

      const defaultConfigs: Record<string, RolePermissionConfig> = {
        sysadmin: makeConfig('sysadmin',
          FEATURE_LIST.map(f => ({ ...f, enabled: true, accessLevel: 'full' as const }))
        ),
        admin: makeConfig('admin',
          FEATURE_LIST.map(f => {
            if (['users', 'roles', 'logs', 'settings'].includes(f.featureKey)) {
              return { ...f, enabled: false, accessLevel: 'view-only' as const };
            }
            return { ...f, enabled: true, accessLevel: 'edit' as const };
          })
        ),
        teacher: makeConfig('teacher',
          FEATURE_LIST.map(f => {
            if (['syllabus', 'teaching', 'schedule', 'students', 'grades', 'attendance', 'calendar', 'exams', 'questionBank', 'feedback_manage'].includes(f.featureKey)) {
              return { ...f, enabled: true, accessLevel: 'edit' as const };
            }
            if (['classes', 'announcements', 'widget_announcements', 'feedback', 'feedback_view_identity', 'widget_feedbackStatus', 'widget_leaveQuota'].includes(f.featureKey)) {
              return { ...f, enabled: true, accessLevel: 'view-only' as const };
            }
            return { ...f, enabled: false, accessLevel: 'view-only' as const };
          })
        ),
        staff: makeConfig('staff',
          FEATURE_LIST.map(f => {
            if (['staffAttendance'].includes(f.featureKey)) {
              return { ...f, enabled: true, accessLevel: 'edit' as const };
            }
            if (['students', 'attendance', 'announcements', 'widget_announcements', 'feedback', 'widget_feedbackStatus', 'calendar', 'schedule'].includes(f.featureKey)) {
              return { ...f, enabled: true, accessLevel: 'view-only' as const };
            }
            return { ...f, enabled: false, accessLevel: 'view-only' as const };
          })
        ),
        parent: makeConfig('parent',
          FEATURE_LIST.map(f => {
            if (['calendar', 'announcements', 'widget_announcements', 'widget_feedbackStatus', 'grades', 'attendance', 'schedule'].includes(f.featureKey)) {
              return { ...f, enabled: true, accessLevel: 'view-only' as const };
            }
            return { ...f, enabled: false, accessLevel: 'view-only' as const };
          })
        ),
        student: makeConfig('student',
          FEATURE_LIST.map(f => {
            if (['calendar', 'announcements', 'widget_announcements', 'feedback', 'widget_feedbackStatus', 'grades', 'attendance', 'schedule', 'exams', 'widget_studentProfile', 'widget_leaveQuota', 'widget_studentLeave'].includes(f.featureKey)) {
              return { ...f, enabled: true, accessLevel: 'view-only' as const };
            }
            return { ...f, enabled: false, accessLevel: 'view-only' as const };
          })
        ),
      };

      for (const role of roles) {
        const config = defaultConfigs[role];
        if (config) {
          await setDoc(doc(db, 'role_permissions', role), config);
        }
      }
    },
    onSuccess: () => {
      toast.success('สร้างค่า default สำเร็จ');
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'unknown error';
      toast.error(`เกิดข้อผิดพลาด: ${message}`);
    },
  });
}
