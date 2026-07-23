import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DEPARTMENT_CONFIG, type Department } from '@/types/curriculum';

const DEPARTMENTS: Department[] = ['early', 'primary', 'secondary'];

export const DEPT_CARD_GRADIENT: Record<Department, string> = {
  early: 'linear-gradient(165deg, #f9a8d4 0%, #ec4899 48%, #db2777 100%)',
  primary: 'linear-gradient(165deg, #93c5fd 0%, #3b82f6 48%, #1d4ed8 100%)',
  secondary: 'linear-gradient(165deg, #c4b5fd 0%, #8b5cf6 48%, #6d28d9 100%)',
};

const DEPT_LABEL_EN: Record<Department, string> = {
  early: 'Kindergarten',
  primary: 'Primary',
  secondary: 'Secondary',
};

export type PickerCoverflowItem = {
  id: string;
  label: string;
  subtitle?: string;
  gradient: string;
  /** Optional profile image (e.g. teacher photo on subject cards). */
  imageUrl?: string;
  imageAlt?: string;
  /** Caption beside avatar — line1 = given name, line2 = surname. */
  imageCaption?: { line1: string; line2?: string };
};

/** Shared coverflow cards — canonical = department picker (attendance / micro syllabus). */
export function PickerCoverflow({
  items,
  onSelect,
  ariaLabel,
  initialActive = 0,
}: {
  items: PickerCoverflowItem[];
  onSelect: (id: string) => void;
  ariaLabel: string;
  initialActive?: number;
}) {
  const [active, setActive] = useState(() =>
    Math.min(items.length - 1, Math.max(0, initialActive)),
  );
  const dragOffsetRef = useRef(0);

  useEffect(() => {
    setActive((prev) => Math.min(items.length - 1, Math.max(0, prev)));
  }, [items.length]);

  if (items.length === 0) return null;

  const goBy = (delta: number) => {
    setActive((prev) => Math.min(items.length - 1, Math.max(0, prev + delta)));
  };

  return (
    <div className="flex w-full flex-col items-center gap-8 px-2">
      <motion.div
        className="relative mx-auto h-[min(420px,58vh)] w-full max-w-5xl cursor-grab touch-pan-y active:cursor-grabbing"
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.18}
        onDrag={(_, info) => {
          dragOffsetRef.current = info.offset.x;
        }}
        onDragEnd={(_, info) => {
          const { offset, velocity } = info;
          if (offset.x < -60 || velocity.x < -400) goBy(1);
          else if (offset.x > 60 || velocity.x > 400) goBy(-1);
          requestAnimationFrame(() => {
            dragOffsetRef.current = 0;
          });
        }}
      >
        {items.map((item, i) => {
          const offset = i - active;
          const isActive = offset === 0;
          const initials = (item.imageAlt || item.label)
            .split(/\s+/)
            .slice(0, 2)
            .map((p) => p[0] ?? '')
            .join('')
            .toUpperCase() || '?';

          return (
            <motion.button
              key={item.id}
              type="button"
              onClick={() => {
                if (Math.abs(dragOffsetRef.current) > 24) return;
                if (isActive) onSelect(item.id);
                else setActive(i);
              }}
              className={cn(
                'absolute left-1/2 top-1/2 h-[min(400px,54vh)] w-[min(250px,68vw)] origin-center rounded-[2rem]',
                'border border-white/25 shadow-[0_20px_50px_-20px_rgba(15,23,42,0.45)]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/30',
              )}
              initial={false}
              animate={{
                x: `calc(-50% + ${offset * 280}px)`,
                y: '-50%',
                scale: isActive ? 1 : 0.92,
                rotate: 0,
                zIndex: isActive ? 30 : 20 - Math.abs(offset),
                opacity: 1,
              }}
              transition={{ type: 'spring', stiffness: 280, damping: 30 }}
              style={{ background: item.gradient }}
              aria-label={item.subtitle ? `${item.label} · ${item.subtitle}` : item.label}
              aria-current={isActive ? 'true' : undefined}
            >
              <div className="absolute top-6 left-6 right-6 text-left">
                <p className="text-lg font-medium leading-tight tracking-tight text-white font-sukhumvit drop-shadow-sm sm:text-xl">
                  {item.label}
                </p>
                {item.subtitle ? (
                  <p className="mt-1.5 text-[13px] font-semibold tracking-wide text-white/85 font-sarabun">
                    {item.subtitle}
                  </p>
                ) : null}
              </div>

              {(item.imageUrl || item.imageAlt || item.imageCaption) && (
                <div className="absolute bottom-6 left-6 right-6 flex items-center gap-3">
                  <Avatar className="h-14 w-14 shrink-0 border-2 border-white/80 shadow-md">
                    {item.imageUrl ? (
                      <AvatarImage src={item.imageUrl} alt={item.imageAlt || item.label} />
                    ) : null}
                    <AvatarFallback className="bg-white/25 text-sm font-bold text-white backdrop-blur-sm">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  {item.imageCaption ? (
                    <div className="min-w-0 text-left">
                      <p className="truncate text-[13px] font-semibold leading-tight text-white font-sukhumvit drop-shadow-sm">
                        {item.imageCaption.line1}
                      </p>
                      {item.imageCaption.line2 ? (
                        <p className="mt-0.5 truncate text-[12px] font-semibold leading-tight text-white/85 font-sukhumvit">
                          {item.imageCaption.line2}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              )}
            </motion.button>
          );
        })}
      </motion.div>

      <div className="flex items-center gap-2" role="tablist" aria-label={ariaLabel}>
        {items.map((item, i) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={i === active}
            aria-label={item.label}
            onClick={() => setActive(i)}
            className={cn(
              'rounded-full transition-all',
              i === active
                ? 'h-2 w-8 bg-slate-800'
                : 'h-2 w-2 bg-slate-300 hover:bg-slate-400',
            )}
          />
        ))}
      </div>
    </div>
  );
}

/** Coverflow department cards — canonical = micro syllabus admin plan browser. */
export function DepartmentPickerCoverflow({
  onSelect,
}: {
  onSelect: (dept: Department) => void;
}) {
  return (
    <PickerCoverflow
      ariaLabel="แผนก"
      initialActive={1}
      onSelect={(id) => onSelect(id as Department)}
      items={DEPARTMENTS.map((dept) => ({
        id: dept,
        label: DEPARTMENT_CONFIG[dept].label,
        subtitle: DEPT_LABEL_EN[dept],
        gradient: DEPT_CARD_GRADIENT[dept],
      }))}
    />
  );
}
