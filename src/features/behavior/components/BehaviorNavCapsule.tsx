import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  HiOutlineChartPie,
  HiOutlineUsers,
  HiOutlineDocumentText,
  HiOutlineScale,
  HiChevronDown,
} from 'react-icons/hi2';
import type { IconType } from 'react-icons';
import { cn } from '@/lib/utils';

export type BehaviorTab = 'dashboard' | 'list' | 'report' | 'rules';

export const BEHAVIOR_TAB_CONFIG: Record<BehaviorTab, { label: string; icon: IconType }> = {
  dashboard: { label: 'Dashboard', icon: HiOutlineChartPie },
  list: { label: 'รายชื่อ', icon: HiOutlineUsers },
  report: { label: 'รายงาน', icon: HiOutlineDocumentText },
  rules: { label: 'ระเบียบโรงเรียน', icon: HiOutlineScale },
};

interface BehaviorNavCapsuleProps {
  activeTab: BehaviorTab;
  onTabChange: (tab: BehaviorTab) => void;
  showRulesTab?: boolean;
}

export default function BehaviorNavCapsule({
  activeTab,
  onTabChange,
  showRulesTab = true,
}: BehaviorNavCapsuleProps) {
  const [headerCenterEl, setHeaderCenterEl] = useState<HTMLElement | null>(null);
  const [headerCenterMobileEl, setHeaderCenterMobileEl] = useState<HTMLElement | null>(null);
  const [isMdOrBelow, setIsMdOrBelow] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 1024 : false,
  );
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setHeaderCenterEl(document.getElementById('header-portal-center'));
    setHeaderCenterMobileEl(document.getElementById('header-portal-center-mobile'));
  }, []);

  useEffect(() => {
    const handleResize = () => setIsMdOrBelow(window.innerWidth < 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const close = () => setMobileMenuOpen(false);
    window.addEventListener('scroll', close, true);
    return () => window.removeEventListener('scroll', close, true);
  }, [mobileMenuOpen]);

  const tabs = (Object.entries(BEHAVIOR_TAB_CONFIG) as [BehaviorTab, typeof BEHAVIOR_TAB_CONFIG[BehaviorTab]][])
    .filter(([key]) => key !== 'rules' || showRulesTab);

  const activeConfig = BEHAVIOR_TAB_CONFIG[activeTab];
  const ActiveIcon = activeConfig.icon;

  const desktopCapsule = (
    <div className="pointer-events-auto flex items-center rounded-full border border-white bg-white/60 p-1 shadow-[0_8px_32px_rgba(0,0,0,0.04)] backdrop-blur-xl">
      {tabs.map(([key, cfg]) => {
        const isActive = activeTab === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onTabChange(key)}
            className={cn(
              'flex h-8 items-center whitespace-nowrap rounded-full px-4 text-[11px] font-black transition-all',
              isActive
                ? 'bg-slate-900 text-white shadow-md'
                : 'text-slate-500 hover:bg-black/5 hover:text-slate-800',
            )}
          >
            {cfg.label}
          </button>
        );
      })}
    </div>
  );

  const mobileCapsule = (
    <div className="pointer-events-auto relative flex min-w-0 max-w-[calc(100vw-112px)] items-center justify-center lg:hidden">
      <button
        type="button"
        onClick={() => setMobileMenuOpen((open) => !open)}
        className="flex min-w-0 items-center gap-1.5 text-black/80 transition-colors hover:text-black/60"
        aria-label="เปิดเมนูแท็บพฤติกรรม"
        aria-expanded={mobileMenuOpen}
      >
        <ActiveIcon className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate font-sukhumvit text-[12px] font-black">{activeConfig.label}</span>
        <HiChevronDown
          className={cn('h-3.5 w-3.5 shrink-0 text-black/45 transition-transform', mobileMenuOpen && 'rotate-180')}
        />
      </button>

      {mobileMenuOpen && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[90] bg-black/20"
            aria-label="ปิดเมนูแท็บ"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="fixed left-1/2 top-14 z-[100] w-[min(280px,calc(100vw-2rem))] -translate-x-1/2 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl">
            <p className="px-3 py-1.5 font-sukhumvit text-[10px] font-black uppercase tracking-widest text-slate-400">
              คะแนนพฤติกรรม
            </p>
            {tabs.map(([key, cfg]) => {
              const Icon = cfg.icon;
              const isActive = activeTab === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    onTabChange(key);
                    setMobileMenuOpen(false);
                  }}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left font-sukhumvit text-[13px] font-bold transition-colors',
                    isActive ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50',
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{cfg.label}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );

  return (
    <>
      {!isMdOrBelow && headerCenterEl && createPortal(desktopCapsule, headerCenterEl)}
      {isMdOrBelow && headerCenterMobileEl && createPortal(mobileCapsule, headerCenterMobileEl)}
      {!headerCenterEl && !headerCenterMobileEl && (
        <div className="flex justify-center px-4 py-2">{desktopCapsule}</div>
      )}
    </>
  );
}
