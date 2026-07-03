import { useMutation } from '@tanstack/react-query';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useSyncExternalStore } from 'react';
import { db } from '@/lib/firebase';
import { toast } from 'sonner';
import type { RolePermissionConfig, FeaturePermission } from '@/types/rolePermission';
import { FEATURE_LIST } from '@/types/rolePermission';
import { getRolePermissionsStore } from '@/lib/firestoreShared/rolePermissionsStore';

const emptySubscribe = () => () => {};

export function useRolePermissions(roleId?: string) {
  const store = roleId ? getRolePermissionsStore(roleId) : null;
  const data = useSyncExternalStore(
    store?.subscribe ?? emptySubscribe,
    () => (roleId && store ? store.getSnapshot() : null),
    () => (roleId && store ? store.getSnapshot() : null),
  );

  // รอ getDoc ครั้งแรก — ถ้ามี cache แล้ว startReady จะเป็น true ทันที
  const isLoading = !!roleId && !!store && !store.getReady();

  return { data, isLoading };
}

export function useAllRolePermissions() {
  const studentStore = getRolePermissionsStore('student');
  const parentStore = getRolePermissionsStore('parent');
  const teacherStore = getRolePermissionsStore('teacher');
  const staffStore = getRolePermissionsStore('staff');
  const adminStore = getRolePermissionsStore('admin');
  const sysadminStore = getRolePermissionsStore('sysadmin');

  const student = useSyncExternalStore(studentStore.subscribe, studentStore.getSnapshot, studentStore.getSnapshot);
  const parent = useSyncExternalStore(parentStore.subscribe, parentStore.getSnapshot, parentStore.getSnapshot);
  const teacher = useSyncExternalStore(teacherStore.subscribe, teacherStore.getSnapshot, teacherStore.getSnapshot);
  const staff = useSyncExternalStore(staffStore.subscribe, staffStore.getSnapshot, staffStore.getSnapshot);
  const admin = useSyncExternalStore(adminStore.subscribe, adminStore.getSnapshot, adminStore.getSnapshot);
  const sysadmin = useSyncExternalStore(sysadminStore.subscribe, sysadminStore.getSnapshot, sysadminStore.getSnapshot);

  const data: Record<string, RolePermissionConfig | null> = {
    student,
    parent,
    teacher,
    staff,
    admin,
    sysadmin,
  };
  const isLoading = [studentStore, parentStore, teacherStore, staffStore, adminStore, sysadminStore]
    .some((store) => !store.getReady());

  return { data, isLoading };
}

function buildPermMap(permissions: FeaturePermission[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const p of permissions) {
    if (p.enabled) map[p.featureKey] = p.accessLevel;
  }
  return map;
}

export function useUpdateRolePermission() {
  return useMutation({
    mutationFn: async ({ roleId, permission }: { roleId: string; permission: FeaturePermission }) => {
      const docRef = doc(db, 'role_permissions', roleId);
      const docSnap = await getDoc(docRef);
      type FeaturePermissionExt = FeaturePermission & { _activatedOnce?: boolean };

      let permissions: FeaturePermissionExt[];
      if (docSnap.exists()) {
        const existingData = docSnap.data() as RolePermissionConfig;
        const prevPermissions = (Array.isArray(existingData.permissions) ? existingData.permissions : []) as FeaturePermissionExt[];
        const existingPerm = prevPermissions.find((p) => p.featureKey === permission.featureKey);
        const wasEnabled = !!existingPerm?.enabled;
        const wasActivatedOnce = !!existingPerm?._activatedOnce;
        const isWidgetFeature = permission.featureKey.startsWith('widget_');
        const nextPermission: FeaturePermissionExt = {
          ...(permission as FeaturePermissionExt),
          _activatedOnce: permission.enabled ? true : wasActivatedOnce,
        };

        const permIndex = existingData.permissions.findIndex(p => p.featureKey === permission.featureKey);
        if (permIndex >= 0) {
          (existingData.permissions as FeaturePermissionExt[])[permIndex] = nextPermission;
        } else {
          (existingData.permissions as FeaturePermissionExt[]).push(nextPermission);
        }
        permissions = existingData.permissions as FeaturePermissionExt[];

        // When a widget is enabled now (OFF -> ON), move it right after currently-enabled widgets.
        // This preserves "enabled later = shown later" ordering.
        // If widget was enabled before, keep its previous slot on re-enable.
        if (isWidgetFeature && permission.enabled && !wasEnabled && !wasActivatedOnce) {
          const withoutTarget = permissions.filter((p) => p.featureKey !== permission.featureKey);
          const lastEnabledWidgetIndex = withoutTarget.reduce((lastIndex, p, idx) => {
            if (p.featureKey.startsWith('widget_') && p.enabled) return idx;
            return lastIndex;
          }, -1);
          const insertAt = lastEnabledWidgetIndex + 1;
          withoutTarget.splice(insertAt, 0, nextPermission);
          permissions = withoutTarget;
        }
      } else {
        // document ยังไม่มี → สร้างใหม่พร้อม features ทั้งหมด (disabled ทั้งหมดก่อน แล้ว override ตัวที่กำลัง toggle)
        permissions = FEATURE_LIST.map(f =>
          f.featureKey === permission.featureKey
            ? ({ ...(permission as FeaturePermissionExt), _activatedOnce: permission.enabled } as FeaturePermissionExt)
            : ({ ...f, enabled: false, _activatedOnce: false } as FeaturePermissionExt)
        );
      }

      const config: RolePermissionConfig = {
        roleId,
        permissions: permissions as FeaturePermission[],
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
        if (['syllabus', 'teaching', 'schedule', 'students', 'grades', 'attendance', 'morningRollCall', 'calendar', 'exams', 'questionBank', 'feedback_manage', 'dutySchedule'].includes(f.featureKey)) {
          return { ...f, enabled: true, accessLevel: 'edit' as const };
        }
        if (['classes', 'announcements', 'widget_announcements', 'feedback', 'feedback_view_identity', 'widget_feedbackStatus', 'widget_leaveQuota', 'widget_schedule', 'widget_morningRollCall', 'widget_teacherDailyTasks', 'widget_staffAttendance'].includes(f.featureKey)) {
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
            if (['students', 'attendance', 'announcements', 'widget_announcements', 'feedback', 'widget_feedbackStatus', 'calendar', 'schedule', 'widget_schedule'].includes(f.featureKey)) {
              return { ...f, enabled: true, accessLevel: 'view-only' as const };
            }
            return { ...f, enabled: false, accessLevel: 'view-only' as const };
          })
        ),
        parent: makeConfig('parent',
          FEATURE_LIST.map(f => {
            if (['calendar', 'announcements', 'widget_announcements', 'widget_feedbackStatus', 'grades', 'attendance', 'schedule', 'widget_schedule'].includes(f.featureKey)) {
              return { ...f, enabled: true, accessLevel: 'view-only' as const };
            }
            return { ...f, enabled: false, accessLevel: 'view-only' as const };
          })
        ),
        student: makeConfig('student',
          FEATURE_LIST.map(f => {
            if (['calendar', 'announcements', 'widget_announcements', 'feedback', 'widget_feedbackStatus', 'grades', 'attendance', 'schedule', 'exams', 'widget_studentProfile', 'widget_leaveQuota', 'widget_studentLeave', 'widget_schedule'].includes(f.featureKey)) {
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
