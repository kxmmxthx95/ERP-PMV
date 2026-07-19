import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { tuitionTermLabel } from '@/types/tuition';
import { useTuitionCampaignSelection } from '../context/TuitionCampaignContext';

const SELECT_CLASS =
  'pointer-events-auto w-auto shrink-0 [&_select]:h-9 [&_select]:rounded-full [&_select]:border [&_select]:border-slate-200 [&_select]:bg-white [&_select]:pl-3 [&_select]:pr-8 [&_select]:text-[11px] [&_select]:font-black [&_select]:text-slate-700 [&_select]:shadow-sm';

export function TuitionCampaignHeaderSelect() {
  const { pathname } = useLocation();
  const isDashboard = pathname === '/portal/tuition' || pathname === '/portal/tuition/';
  const { sortedCampaigns, activeCampaignId, setSelectedCampaignId, isLoadingCampaigns } = useTuitionCampaignSelection();

  const [headerHomeActionsEl, setHeaderHomeActionsEl] = useState<HTMLElement | null>(null);
  const [headerMobileActionsEl, setHeaderMobileActionsEl] = useState<HTMLElement | null>(null);
  const [isLgUp, setIsLgUp] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : true,
  );

  useEffect(() => {
    setHeaderHomeActionsEl(document.getElementById('header-portal-home-actions'));
    setHeaderMobileActionsEl(document.getElementById('header-portal-mobile-actions'));
  }, []);

  useEffect(() => {
    const handleResize = () => setIsLgUp(window.innerWidth >= 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (!isDashboard || isLoadingCampaigns || sortedCampaigns.length === 0) return null;

  const select = (
    <NativeSelect
      value={activeCampaignId ?? ''}
      onChange={(e) => setSelectedCampaignId(e.target.value)}
      aria-label="เลือกรอบเก็บค่าเทอม"
      className={SELECT_CLASS}
    >
      {sortedCampaigns.map((c) => (
        <NativeSelectOption key={c.id} value={c.id}>
          {c.academicYearId} · {tuitionTermLabel(c.term)}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  );

  return (
    <>
      {isLgUp && headerHomeActionsEl && createPortal(select, headerHomeActionsEl)}
      {!isLgUp && headerMobileActionsEl && createPortal(select, headerMobileActionsEl)}
    </>
  );
}
