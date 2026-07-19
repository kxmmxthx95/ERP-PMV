import { Outlet, useLocation } from 'react-router-dom';
import { TuitionCampaignProvider } from './context/TuitionCampaignContext';
import { TuitionCampaignHeaderSelect } from './components/TuitionCampaignHeaderSelect';
import { TuitionNavMenu, type TuitionNavTab } from './components/TuitionNavMenu';

function getActiveTab(pathname: string): TuitionNavTab {
  return pathname.includes('/tuition/campaigns') ? 'campaigns' : 'dashboard';
}

export default function TuitionLayout() {
  const { pathname } = useLocation();

  return (
    <TuitionCampaignProvider>
      <TuitionNavMenu active={getActiveTab(pathname)} />
      <TuitionCampaignHeaderSelect />
      <div className="flex min-h-0 flex-col md:flex-1">
        <Outlet />
      </div>
    </TuitionCampaignProvider>
  );
}
