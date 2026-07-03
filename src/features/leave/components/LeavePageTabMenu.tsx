import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { HiChevronDown } from 'react-icons/hi2';
import { cn } from '@/lib/utils';

export type LeavePageTab = 'my' | 'team' | 'report' | 'settings';

export type LeavePageTabOption = {
  key: LeavePageTab;
  label: string;
};

interface LeavePageTabMenuProps {
  tabs: LeavePageTabOption[];
  pageTab: LeavePageTab;
  onTabChange: (tab: LeavePageTab) => void;
}

export default function LeavePageTabMenu({
  tabs,
  pageTab,
  onTabChange,
}: LeavePageTabMenuProps) {
  const [centerEl, setCenterEl] = useState<HTMLElement | null>(null);
  const [centerMobileEl, setCenterMobileEl] = useState<HTMLElement | null>(null);
  const [isLgUp, setIsLgUp] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : true,
  );
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const activeTab = tabs.find((tab) => tab.key === pageTab) ?? tabs[0];

  useEffect(() => {
    setCenterEl(document.getElementById('header-portal-center'));
    setCenterMobileEl(document.getElementById('header-portal-center-mobile'));
  }, []);

  useEffect(() => {
    const handleResize = () => setIsLgUp(window.innerWidth >= 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const close = () => setMobileMenuOpen(false);
    window.addEventListener('scroll', close, true);
    return () => window.removeEventListener('scroll', close, true);
  }, [mobileMenuOpen]);

  const desktopCapsule = (
    <div className="pointer-events-auto flex items-center rounded-full border border-white bg-white/60 p-1 shadow-[0_8px_32px_rgba(0,0,0,0.04)] backdrop-blur-xl">
      {tabs.map((tab) => {
        const isActive = pageTab === tab.key;
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onTabChange(tab.key)}
            className={cn(
              'whitespace-nowrap rounded-full px-5 py-1.5 text-[11px] font-black transition-all',
              isActive
                ? 'bg-slate-900 text-white shadow-md'
                : 'text-slate-500 hover:bg-black/5 hover:text-slate-800',
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );

  const mobileTabSelect = (
    <div className="pointer-events-auto relative flex min-w-0 max-w-[calc(100vw-112px)] items-center justify-center lg:hidden">
      <button
        type="button"
        onClick={() => setMobileMenuOpen((open) => !open)}
        className="flex min-w-0 items-center gap-1.5 text-black/80 transition-colors hover:text-black/60"
        aria-label="เลือกแท็บจัดการคำขอลา"
        aria-expanded={mobileMenuOpen}
      >
        <span className="truncate font-sukhumvit text-[12px] font-black">{activeTab?.label}</span>
        <HiChevronDown
          className={cn(
            'h-3.5 w-3.5 shrink-0 text-black/45 transition-transform',
            mobileMenuOpen && 'rotate-180',
          )}
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
              จัดการคำขอลา
            </p>
            {tabs.map((tab) => {
              const isActive = pageTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => {
                    onTabChange(tab.key);
                    setMobileMenuOpen(false);
                  }}
                  className={cn(
                    'flex w-full items-center rounded-xl px-3 py-2.5 text-left font-sukhumvit text-[13px] font-bold transition-colors',
                    isActive ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50',
                  )}
                >
                  {tab.label}
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
      {isLgUp && centerEl && createPortal(desktopCapsule, centerEl)}
      {!isLgUp && centerMobileEl && createPortal(mobileTabSelect, centerMobileEl)}
    </>
  );
}
