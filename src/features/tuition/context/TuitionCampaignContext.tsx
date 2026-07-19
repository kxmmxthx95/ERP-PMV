import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { useActiveAcademicYear } from '@/hooks/useActiveAcademicYear';
import { findCurrentCampaign, useTuitionCampaigns } from '../hooks/useTuitionCampaigns';
import type { TuitionCampaign } from '@/types/tuition';

type TuitionCampaignContextValue = {
  campaigns: TuitionCampaign[];
  sortedCampaigns: TuitionCampaign[];
  isLoadingCampaigns: boolean;
  selectedCampaignId: string | null;
  setSelectedCampaignId: (id: string | null) => void;
  activeCampaignId: string | null;
  activeCampaign: TuitionCampaign | null;
};

const TuitionCampaignContext = createContext<TuitionCampaignContextValue | null>(null);

export function TuitionCampaignProvider({ children }: { children: ReactNode }) {
  const { year, activeSemester } = useActiveAcademicYear();
  const { campaigns, isLoading: isLoadingCampaigns } = useTuitionCampaigns();
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);

  const sortedCampaigns = useMemo(
    () => [...campaigns].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [campaigns],
  );

  const defaultCampaign = useMemo(
    () => findCurrentCampaign(campaigns, year, activeSemester) ?? sortedCampaigns[0] ?? null,
    [campaigns, sortedCampaigns, year, activeSemester],
  );

  const activeCampaignId = selectedCampaignId ?? defaultCampaign?.id ?? null;
  const activeCampaign = campaigns.find((c) => c.id === activeCampaignId) ?? null;

  const value = useMemo(
    () => ({
      campaigns,
      sortedCampaigns,
      isLoadingCampaigns,
      selectedCampaignId,
      setSelectedCampaignId,
      activeCampaignId,
      activeCampaign,
    }),
    [campaigns, sortedCampaigns, isLoadingCampaigns, selectedCampaignId, activeCampaignId, activeCampaign],
  );

  return <TuitionCampaignContext.Provider value={value}>{children}</TuitionCampaignContext.Provider>;
}

export function useTuitionCampaignSelection() {
  const ctx = useContext(TuitionCampaignContext);
  if (!ctx) {
    throw new Error('useTuitionCampaignSelection must be used within TuitionCampaignProvider');
  }
  return ctx;
}
