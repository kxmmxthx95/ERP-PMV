import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  HiChevronDown,
  HiOutlineChartPie,
  HiOutlineRectangleStack,
} from 'react-icons/hi2';
import type { IconType } from 'react-icons';
import { cn } from '@/lib/utils';

export type ExamNavTab = 'dashboard' | 'rooms';

const EXAM_TAB_CONFIG: Record<
  ExamNavTab,
  { label: string; icon: IconType; path: string }
> = {
  dashboard: {
    label: 'สรุป',
    icon: HiOutlineChartPie,
    path: '/portal/exams',
  },
  rooms: {
    label: 'ห้องสอบ',
    icon: HiOutlineRectangleStack,
    path: '/portal/exams/rooms',
  },
};

const TABS = (Object.entries(EXAM_TAB_CONFIG) as [ExamNavTab, typeof EXAM_TAB_CONFIG[ExamNavTab]][]);

interface ExamNavMenuProps {
  active: ExamNavTab;
}

export function ExamNavMenu({ active }: ExamNavMenuProps) {
  const navigate = useNavigate();
  const [centerEl, setCenterEl] = useState<HTMLElement | null>(null);
  const [centerMobileEl, setCenterMobileEl] = useState<HTMLElement | null>(null);
  const [isLgUp, setIsLgUp] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : true,
  );
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

  const activeConfig = EXAM_TAB_CONFIG[active];
  const ActiveIcon = activeConfig.icon;

  const desktopCapsule = (
    <div className="pointer-events-auto grid w-[240px] grid-cols-2 rounded-full border border-white bg-white/60 p-1 shadow-[0_8px_32px_rgba(0,0,0,0.04)] backdrop-blur-xl">
      {TABS.map(([key, tab]) => {
        const isActive = key === active;
        return (
          <button
            key={key}
            type="button"
            onClick={() => navigate(tab.path)}
            className={cn(
              'flex h-8 items-center justify-center whitespace-nowrap rounded-full text-[11px] font-black transition-colors',
              isActive
                ? 'bg-slate-900 text-white shadow-md'
                : 'text-slate-500 hover:bg-black/5 hover:text-slate-800',
            )}
          >
            {key === 'dashboard' ? 'Dashboard' : tab.label}
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
        aria-label="เลือกหน้าห้องสอบออนไลน์"
        aria-expanded={mobileMenuOpen}
      >
        <ActiveIcon className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate font-sukhumvit text-[12px] font-black">{activeConfig.label}</span>
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
              ห้องสอบออนไลน์
            </p>
            {TABS.map(([key, tab]) => {
              const Icon = tab.icon;
              const isActive = active === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    navigate(tab.path);
                    setMobileMenuOpen(false);
                  }}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left font-sukhumvit text-[13px] font-bold transition-colors',
                    isActive ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50',
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{tab.label}</span>
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
