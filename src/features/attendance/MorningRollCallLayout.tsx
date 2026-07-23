import { Navigate, Outlet, useLocation } from 'react-router-dom';
import {
  MorningRollCallNavMenu,
  type MorningRollCallNavTab,
} from '@/features/attendance/components/MorningRollCallNavCapsule';
import { useAuth } from '@/hooks/useAuth';

function getActiveTab(pathname: string): MorningRollCallNavTab {
  return pathname.includes('/morning-rollcall/check') ? 'rollcall' : 'dashboard';
}

function isMorningRollCallDashboardPath(pathname: string): boolean {
  return (
    pathname === '/portal/morning-rollcall'
    || pathname === '/portal/morning-rollcall/'
    || pathname.includes('/morning-rollcall/dashboard')
  );
}

export default function MorningRollCallLayout() {
  const { pathname } = useLocation();
  const { role } = useAuth();
  const isTeacher = role === 'teacher';

  // ครูใช้แค่หน้าเช็กชื่อ — ไม่โชว์/ไม่โหลด Dashboard สรุป
  if (isTeacher && isMorningRollCallDashboardPath(pathname)) {
    return <Navigate to="/portal/morning-rollcall/check" replace />;
  }

  return (
    <div className="flex h-full min-h-0 flex-1 basis-0 flex-col overflow-hidden">
      {!isTeacher && <MorningRollCallNavMenu active={getActiveTab(pathname)} />}
      <Outlet />
    </div>
  );
}
