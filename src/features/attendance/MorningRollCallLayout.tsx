import { Outlet, useLocation } from 'react-router-dom';
import {
  MorningRollCallNavMenu,
  type MorningRollCallNavTab,
} from '@/features/attendance/components/MorningRollCallNavCapsule';

function getActiveTab(pathname: string): MorningRollCallNavTab {
  return pathname.includes('/morning-rollcall/check') ? 'rollcall' : 'dashboard';
}

export default function MorningRollCallLayout() {
  const { pathname } = useLocation();

  return (
    <>
      <MorningRollCallNavMenu active={getActiveTab(pathname)} />
      <div className="flex min-h-0 flex-col md:flex-1">
        <Outlet />
      </div>
    </>
  );
}
