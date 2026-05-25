// src/components/PermissionGate.tsx
// ใช้ครอบ route หรือ UI element เพื่อควบคุมการเข้าถึงตาม role_permissions ใน Firestore
// ไม่ต้องแตะ Firebase Rules ทุกครั้งที่เพิ่ม feature ใหม่
import { Navigate } from 'react-router-dom';
import { useMyPermissions } from '@/hooks/useMyPermissions';

interface PermissionGateProps {
  /** featureKey ที่ตรงกับ FEATURE_LIST ใน rolePermission.ts */
  featureKey: string;
  /** ระดับขั้นต่ำที่ต้องการ (default: 'view-only' = แค่ canAccess ก็พอ) */
  require?: 'view-only' | 'edit' | 'full';
  /** เส้นทาง redirect ถ้าไม่มีสิทธิ์ (default: /portal) */
  redirectTo?: string;
  children: React.ReactNode;
}

export function PermissionGate({
  featureKey,
  require = 'view-only',
  redirectTo = '/portal',
  children,
}: PermissionGateProps) {
  const { canAccess, canEdit, canDelete, isLoading } = useMyPermissions();

  // รอโหลดสิทธิ์จาก Firestore ก่อน
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="w-6 h-6 border-2 border-slate-200 border-t-slate-500 rounded-full animate-spin" />
      </div>
    );
  }

  const hasPermission =
    require === 'full'      ? canDelete(featureKey) :
    require === 'edit'      ? canEdit(featureKey)   :
    /* view-only */           canAccess(featureKey);

  if (!hasPermission) {
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
}

// ── ใช้ซ่อน/แสดง UI element (ปุ่ม, ฟอร์ม) โดยไม่ redirect ──────────────────
interface PermissionVisibleProps {
  featureKey: string;
  require?: 'view-only' | 'edit' | 'full';
  children: React.ReactNode;
  /** ถ้าไม่มีสิทธิ์ จะแสดง fallback แทน (optional) */
  fallback?: React.ReactNode;
}

export function PermissionVisible({
  featureKey,
  require = 'edit',
  children,
  fallback = null,
}: PermissionVisibleProps) {
  const { canAccess, canEdit, canDelete } = useMyPermissions();

  const visible =
    require === 'full'  ? canDelete(featureKey) :
    require === 'edit'  ? canEdit(featureKey)   :
    /* view-only */       canAccess(featureKey);

  return <>{visible ? children : fallback}</>;
}
