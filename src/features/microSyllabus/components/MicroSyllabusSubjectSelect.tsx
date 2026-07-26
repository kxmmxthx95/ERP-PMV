import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { HiOutlineCalendarDays, HiOutlineChevronDown } from 'react-icons/hi2';
import { cn } from '@/lib/utils';
import { PORTAL_MENU_TITLES } from '@/lib/portalMenu';

export const MICRO_SYLLABUS_FEATURE_TITLE = PORTAL_MENU_TITLES['/portal/micro-syllabus'];

export interface MicroSyllabusSubjectOption {
  key: string;
  subjectName: string;
  className: string;
}

interface Props {
  options: MicroSyllabusSubjectOption[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
  active: boolean;
}

function MicroSyllabusFeatureTitle({ className }: { className?: string }) {
  return (
    <div className={cn('pointer-events-none flex items-center gap-1.5', className)}>
      <HiOutlineCalendarDays className="h-4 w-4 shrink-0 text-black/80" aria-hidden />
      <span className="whitespace-nowrap font-sukhumvit text-[13px] font-black leading-none tracking-tight text-black/80">
        {MICRO_SYLLABUS_FEATURE_TITLE}
      </span>
    </div>
  );
}

function SubjectSelectCapsule({
  options,
  selectedKey,
  onSelect,
  compact = false,
}: {
  options: MicroSyllabusSubjectOption[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
  compact?: boolean;
}) {
  const selected = options.find((option) => option.key === selectedKey) ?? options[0];

  return (
    <div
      className={cn(
        'pointer-events-auto flex min-w-0 items-center',
        compact
          ? 'max-w-[calc(100vw-112px)]'
          : 'max-w-[min(480px,calc(100vw-480px))]',
      )}
    >
      <div className="relative min-w-0 flex-1">
        <label className="sr-only" htmlFor={compact ? 'micro-syllabus-subject-select-mobile' : 'micro-syllabus-subject-select'}>
          เลือกรายวิชา
        </label>
        <select
          id={compact ? 'micro-syllabus-subject-select-mobile' : 'micro-syllabus-subject-select'}
          value={selectedKey ?? selected.key}
          onChange={(event) => onSelect(event.target.value)}
          className={cn(
            'h-8 w-full appearance-none truncate rounded-full bg-transparent',
            'pr-8 font-sukhumvit text-[13px] font-black text-slate-800',
            'focus:outline-none focus:ring-2 focus:ring-indigo-500/20',
            compact ? 'min-w-0 max-w-[calc(100vw-112px)] pl-1' : 'min-w-[180px] pl-2.5',
          )}
          aria-label="เลือกรายวิชา"
        >
          {options.map((option) => (
            <option key={option.key} value={option.key} className="bg-white font-bold text-slate-800">
              {option.subjectName} · {option.className}
            </option>
          ))}
        </select>
        <HiOutlineChevronDown
          size={16}
          className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-400"
          aria-hidden
        />
      </div>
    </div>
  );
}

export function MicroSyllabusSubjectSelect({
  options,
  selectedKey,
  onSelect,
  active,
}: Props) {
  const [centerMobileEl, setCenterMobileEl] = useState<HTMLElement | null>(null);
  const [isMdOrBelow, setIsMdOrBelow] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 1024 : false,
  );

  useEffect(() => {
    setCenterMobileEl(document.getElementById('header-portal-center-mobile'));
  }, []);

  useEffect(() => {
    const handleResize = () => setIsMdOrBelow(window.innerWidth < 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const showSubjectSelect = active && options.length > 0;

  // Desktop: subject shown in breadcrumb — no center select
  if (!isMdOrBelow) return null;

  return centerMobileEl
    ? createPortal(
        showSubjectSelect ? (
          <SubjectSelectCapsule
            options={options}
            selectedKey={selectedKey}
            onSelect={onSelect}
            compact
          />
        ) : (
          <MicroSyllabusFeatureTitle className="lg:hidden" />
        ),
        centerMobileEl,
      )
    : null;
}
