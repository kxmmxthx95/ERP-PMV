import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { HiOutlineArrowLeft, HiOutlineCalendarDays, HiOutlineChevronDown } from 'react-icons/hi2';
import { cn } from '@/lib/utils';

export const MICRO_SYLLABUS_FEATURE_TITLE = 'แผนการสอน';

export interface MicroSyllabusSubjectOption {
  key: string;
  subjectName: string;
  className: string;
}

interface Props {
  options: MicroSyllabusSubjectOption[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
  onBack: () => void;
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
  onBack,
  showBack = true,
}: {
  options: MicroSyllabusSubjectOption[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
  onBack: () => void;
  showBack?: boolean;
}) {
  const selected = options.find((option) => option.key === selectedKey) ?? options[0];

  return (
    <div
      className={cn(
        'pointer-events-auto flex min-w-0 items-center gap-1',
        showBack
          ? 'max-w-[min(480px,calc(100vw-480px))] rounded-full border border-white bg-white/60 p-1 shadow-[0_4px_10px_-2px_rgba(0,0,0,0.025)] backdrop-blur-xl'
          : 'max-w-[calc(100vw-112px)]',
      )}
    >
      {showBack && (
        <>
          <button
            type="button"
            onClick={onBack}
            className="flex h-8 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-slate-500 transition-colors hover:bg-white hover:text-slate-800"
            aria-label="กลับไปเลือกวิชา"
            title="กลับไปเลือกวิชา"
          >
            <HiOutlineArrowLeft size={16} />
          </button>
          <div className="h-5 w-px shrink-0 bg-slate-200/80" aria-hidden />
        </>
      )}

      <div className="relative min-w-0 flex-1">
        <label className="sr-only" htmlFor={showBack ? 'micro-syllabus-subject-select' : 'micro-syllabus-subject-select-mobile'}>
          เลือกรายวิชา
        </label>
        <select
          id={showBack ? 'micro-syllabus-subject-select' : 'micro-syllabus-subject-select-mobile'}
          value={selectedKey ?? selected.key}
          onChange={(event) => onSelect(event.target.value)}
          className={cn(
            'h-8 w-full appearance-none truncate rounded-full bg-transparent',
            'pr-8 font-sukhumvit text-[13px] font-black text-slate-800',
            'focus:outline-none focus:ring-2 focus:ring-indigo-500/20',
            showBack ? 'min-w-[180px] pl-2.5' : 'min-w-0 max-w-[calc(100vw-112px)] pl-1',
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
  onBack,
  active,
}: Props) {
  const [centerEl, setCenterEl] = useState<HTMLElement | null>(null);
  const [centerMobileEl, setCenterMobileEl] = useState<HTMLElement | null>(null);
  const [mobileBackEl, setMobileBackEl] = useState<HTMLElement | null>(null);
  const [isMdOrBelow, setIsMdOrBelow] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 1024 : false,
  );

  useEffect(() => {
    setCenterEl(document.getElementById('header-portal-center'));
    setCenterMobileEl(document.getElementById('header-portal-center-mobile'));
    setMobileBackEl(document.getElementById('header-portal-mobile-back'));
  }, []);

  useEffect(() => {
    const handleResize = () => setIsMdOrBelow(window.innerWidth < 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const showSubjectSelect = active && options.length > 0;
  const showMobileSubjectBack = isMdOrBelow && showSubjectSelect;

  useEffect(() => {
    const defaultBack = document.getElementById('portal-default-mobile-back');
    if (!defaultBack) return;
    defaultBack.style.display = showMobileSubjectBack ? 'none' : '';
  }, [showMobileSubjectBack]);

  return (
    <>
      {showSubjectSelect && centerEl && createPortal(
        <SubjectSelectCapsule
          options={options}
          selectedKey={selectedKey}
          onSelect={onSelect}
          onBack={onBack}
        />,
        centerEl,
      )}

      {isMdOrBelow && centerMobileEl && createPortal(
        showSubjectSelect ? (
          <SubjectSelectCapsule
            options={options}
            selectedKey={selectedKey}
            onSelect={onSelect}
            onBack={onBack}
            showBack={false}
          />
        ) : (
          <MicroSyllabusFeatureTitle className="lg:hidden" />
        ),
        centerMobileEl,
      )}

      {showMobileSubjectBack && mobileBackEl && createPortal(
        <button
          type="button"
          onClick={onBack}
          className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition-colors hover:bg-slate-50 lg:hidden"
          title="กลับไปเลือกวิชา"
          aria-label="กลับไปเลือกวิชา"
        >
          <HiOutlineArrowLeft size={18} />
        </button>,
        mobileBackEl,
      )}
    </>
  );
}
