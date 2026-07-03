import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { HiChevronDown } from 'react-icons/hi2';
import { cn } from '@/lib/utils';
import type { BehaviorDashboardPeriod } from '../utils/behaviorDashboardStats';

const PERIOD_OPTIONS: { key: BehaviorDashboardPeriod; label: string }[] = [
  { key: 'day', label: 'รายวัน' },
  { key: 'week', label: 'รายสัปดาห์' },
  { key: 'month', label: 'รายเดือน' },
];

interface BehaviorPeriodFilterProps {
  period: BehaviorDashboardPeriod;
  onPeriodChange: (period: BehaviorDashboardPeriod) => void;
}

function periodButtonClass(isActive: boolean): string {
  return cn(
    'h-9 rounded-full px-5 text-[11px] font-black transition-all',
    isActive
      ? 'bg-slate-900 text-white shadow-md'
      : 'border border-slate-200 bg-white text-slate-500 hover:bg-slate-50',
  );
}

export default function BehaviorPeriodFilter({ period, onPeriodChange }: BehaviorPeriodFilterProps) {
  const [headerMobileActionsEl, setHeaderMobileActionsEl] = useState<HTMLElement | null>(null);
  const [isLgOrBelow, setIsLgOrBelow] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 1024 : false,
  );
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setHeaderMobileActionsEl(document.getElementById('header-portal-mobile-actions'));
  }, []);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const onChange = () => setIsLgOrBelow(!mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const close = () => setMenuOpen(false);
    window.addEventListener('scroll', close, true);
    return () => window.removeEventListener('scroll', close, true);
  }, [menuOpen]);

  const activeLabel = PERIOD_OPTIONS.find((option) => option.key === period)?.label ?? 'รายเดือน';

  const mobilePortal = isLgOrBelow && headerMobileActionsEl && createPortal(
    <div className="pointer-events-auto relative">
      <button
        type="button"
        onClick={() => setMenuOpen((open) => !open)}
        aria-label="เลือกช่วงเวลา"
        aria-expanded={menuOpen}
        className="inline-flex h-9 items-center gap-1 rounded-full border border-slate-200 bg-white px-3 text-[10px] font-black text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
      >
        <span>{activeLabel}</span>
        <HiChevronDown
          className={cn('h-3.5 w-3.5 text-slate-400 transition-transform', menuOpen && 'rotate-180')}
        />
      </button>

      {menuOpen && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[90]"
            aria-label="ปิดเมนูช่วงเวลา"
            onClick={() => setMenuOpen(false)}
          />
          <div className="absolute right-0 top-full z-[100] mt-1.5 w-36 rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
            {PERIOD_OPTIONS.map((option) => {
              const isActive = period === option.key;
              return (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => {
                    onPeriodChange(option.key);
                    setMenuOpen(false);
                  }}
                  className={cn(
                    'flex w-full items-center rounded-lg px-3 py-2 text-left text-[11px] font-bold transition-colors',
                    isActive ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50',
                  )}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>,
    headerMobileActionsEl,
  );

  return (
    <>
      <div className="hidden flex-wrap gap-2 lg:flex">
        {PERIOD_OPTIONS.map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() => onPeriodChange(option.key)}
            className={periodButtonClass(period === option.key)}
          >
            {option.label}
          </button>
        ))}
      </div>
      {mobilePortal}
    </>
  );
}
