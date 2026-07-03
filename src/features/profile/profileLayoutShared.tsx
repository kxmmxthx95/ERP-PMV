import type { ReactNode } from 'react';
import { HiChevronRight } from 'react-icons/hi2';
import { cn } from '@/lib/utils';

export function ProfileCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-3xl bg-slate-50/90 p-4 sm:p-5">
      <h2 className="text-sm font-black text-slate-900">{title}</h2>
      <div className="mt-3 divide-y divide-slate-200/70">{children}</div>
    </section>
  );
}

export function ProfileRow({
  icon,
  label,
  value,
  onClick,
  trailing,
}: {
  icon: ReactNode;
  label: string;
  value?: string;
  onClick?: () => void;
  trailing?: ReactNode;
}) {
  const Wrapper = onClick ? 'button' : 'div';

  return (
    <Wrapper
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 py-3.5 text-left',
        onClick && 'transition-colors hover:bg-white/60 rounded-xl -mx-1 px-1',
      )}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center text-slate-700">
        {icon}
      </span>
      <span className="min-w-0 flex-1 text-sm font-semibold text-slate-800">{label}</span>
      {value ? (
        <span className="max-w-[45%] truncate text-sm font-medium text-slate-400">{value}</span>
      ) : null}
      {trailing ?? (onClick ? <HiChevronRight className="h-4 w-4 shrink-0 text-slate-300" /> : null)}
    </Wrapper>
  );
}

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
}
