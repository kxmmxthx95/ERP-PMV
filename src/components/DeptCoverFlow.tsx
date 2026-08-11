import { useState } from 'react';
import { motion, type PanInfo } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  HiAcademicCap,
  HiBuildingLibrary,
  HiFaceSmile,
} from 'react-icons/hi2';
import type { IconType } from 'react-icons';
import { cn } from '@/lib/utils';
import { DEPARTMENT_CONFIG, type Department } from '@/types/curriculum';

const DEPARTMENTS: Department[] = ['early', 'primary', 'secondary'];

const DEPT_ICON: Record<Department, IconType> = {
  early: HiFaceSmile,
  primary: HiAcademicCap,
  secondary: HiBuildingLibrary,
};

const DEPT_COVER: Record<Department, { gradient: string; iconBg: string; labelText: string }> = {
  early: {
    gradient: 'linear-gradient(160deg, #f472b6 0%, #db2777 45%, #9333ea 100%)',
    iconBg: 'bg-white text-pink-600',
    labelText: 'text-pink-700',
  },
  primary: {
    gradient: 'linear-gradient(160deg, #60a5fa 0%, #2563eb 45%, #1e3a8a 100%)',
    iconBg: 'bg-white text-blue-600',
    labelText: 'text-blue-700',
  },
  secondary: {
    gradient: 'linear-gradient(160deg, #a78bfa 0%, #7c3aed 45%, #312e81 100%)',
    iconBg: 'bg-white text-violet-600',
    labelText: 'text-violet-700',
  },
};

type Props = {
  title: string;
  subtitle: string;
  countLabel: string;
  selectHint: string;
  onSelectDept: (dept: Department) => void;
  counts?: Partial<Record<Department, number>>;
  /** Default: all departments. Pass a subset (e.g. teacher home dept only). */
  departments?: Department[];
};

export default function DeptCoverFlow({
  title,
  subtitle,
  countLabel,
  selectHint,
  onSelectDept,
  counts,
  departments = DEPARTMENTS,
}: Props) {
  const [activeIndex, setActiveIndex] = useState(0);

  const deptCount = departments.length;
  const safeActiveIndex = deptCount > 0 ? Math.min(activeIndex, deptCount - 1) : 0;

  const goPrev = () => setActiveIndex((i) => Math.max(0, i - 1));
  const goNext = () => setActiveIndex((i) => Math.min(deptCount - 1, i + 1));

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x < -40 || info.velocity.x < -300) goNext();
    else if (info.offset.x > 40 || info.velocity.x > 300) goPrev();
  };

  const activeDept = departments[safeActiveIndex];
  const activeCfg = activeDept ? DEPARTMENT_CONFIG[activeDept] : null;

  if (!activeDept || !activeCfg) return null;

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden px-4 pb-6 pt-1 font-sukhumvit sm:pt-8">
      <div className="mt-1 shrink-0 text-center sm:mt-4">
        <h2 className="text-xl font-black tracking-tight text-foreground">{title}</h2>
        <p className="mt-1.5 px-2 text-[12px] font-bold leading-relaxed text-muted-foreground">
          {subtitle}
        </p>
      </div>

      <div className="relative mt-3 flex min-h-0 flex-1 flex-col justify-center sm:mt-5">
        <div
          className="relative mx-auto h-[min(58vh,420px)] w-full max-w-md"
          style={{ perspective: '1200px' }}
        >
          {departments.map((dept, index) => {
            const offset = index - safeActiveIndex;
            const cfg = DEPARTMENT_CONFIG[dept];
            const cover = DEPT_COVER[dept];
            const DeptIcon = DEPT_ICON[dept];
            const isCenter = offset === 0;
            const count = counts?.[dept];

            if (Math.abs(offset) > 1) return null;

            return (
              <motion.button
                key={dept}
                type="button"
                layout
                drag={isCenter ? 'x' : false}
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.12}
                onDragEnd={handleDragEnd}
                onClick={() => {
                  if (isCenter) onSelectDept(dept);
                  else setActiveIndex(index);
                }}
                animate={{
                  x: offset * 118,
                  scale: isCenter ? 1 : 0.82,
                  rotateY: offset * -28,
                  zIndex: 10 - Math.abs(offset),
                  opacity: 1,
                }}
                transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                className={cn(
                  'absolute left-1/2 top-1/2 h-[min(52vh,380px)] w-[min(62vw,240px)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[1.75rem] border border-white/30 shadow-[0_24px_60px_rgba(15,23,42,0.28)]',
                  'cursor-pointer',
                )}
                style={{ transformStyle: 'preserve-3d' }}
                aria-label={`${cfg.label}${count != null ? ` ${count} ${countLabel}` : ''}`}
              >
                <div
                  className="absolute inset-0"
                  style={{ background: cover.gradient }}
                />

                <div className="relative flex h-full flex-col items-center justify-center px-4 pb-16 pt-8">
                  <div className={cn('flex size-16 items-center justify-center rounded-2xl shadow-lg', cover.iconBg)}>
                    <DeptIcon className="size-8" aria-hidden />
                  </div>
                  <span className={cn('mt-5 rounded-full bg-white px-4 py-1.5 text-[12px] font-black shadow-sm', cover.labelText)}>
                    {cfg.label}
                  </span>
                  {count != null ? (
                    <span className="mt-2 text-[11px] font-bold text-white">
                      {count} {countLabel}
                    </span>
                  ) : null}
                </div>
              </motion.button>
            );
          })}
        </div>

        <div className="mt-6 flex items-center justify-center gap-3">
          {deptCount > 1 ? (
            <>
              <button
                type="button"
                onClick={goPrev}
                disabled={safeActiveIndex === 0}
                className="flex size-10 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-sm transition-opacity disabled:opacity-30"
                aria-label="แผนกก่อนหน้า"
              >
                <ChevronLeft size={18} />
              </button>

              <div className="flex items-center gap-1.5">
                {departments.map((dept, index) => (
                  <button
                    key={dept}
                    type="button"
                    aria-label={`ไปที่${DEPARTMENT_CONFIG[dept].label}`}
                    onClick={() => setActiveIndex(index)}
                    className={cn(
                      'h-1.5 rounded-full transition-all',
                      safeActiveIndex === index ? 'w-6 bg-primary' : 'w-1.5 bg-muted-foreground/30',
                    )}
                  />
                ))}
              </div>

              <button
                type="button"
                onClick={goNext}
                disabled={safeActiveIndex === deptCount - 1}
                className="flex size-10 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-sm transition-opacity disabled:opacity-30"
                aria-label="แผนกถัดไป"
              >
                <ChevronRight size={18} />
              </button>
            </>
          ) : null}
        </div>

        <p className="mt-4 text-center text-[11px] font-bold text-muted-foreground">
          แตะการ์ด <span className="text-foreground">{activeCfg.label}</span> เพื่อ{selectHint}
        </p>
      </div>
    </div>
  );
}
