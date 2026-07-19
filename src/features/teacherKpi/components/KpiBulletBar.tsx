// src/features/teacherKpi/components/KpiBulletBar.tsx
import { HiOutlineExclamationTriangle } from 'react-icons/hi2';
import { cn } from '@/lib/utils';
import { getKpiStatusColor, KPI_WARNING_THRESHOLD } from '@/types/teacherKpi';

const STATUS_STYLES = {
  neutral: { bar: 'bg-emerald-500', text: 'text-emerald-700' },
  warning: { bar: 'bg-amber-500', text: 'text-amber-700' },
  critical: { bar: 'bg-rose-600', text: 'text-rose-700' },
} as const;

interface KpiBulletBarProps {
  value: number | null;
  emptyLabel?: string;
}

export function KpiBulletBar({ value, emptyLabel = 'ไม่มีข้อมูล' }: KpiBulletBarProps) {
  if (value === null) {
    return (
      <div className="flex items-center gap-2">
        <div className="h-1 flex-1 rounded-full bg-slate-100" />
        <span className="w-14 shrink-0 text-right font-sarabun text-xs text-slate-300">{emptyLabel}</span>
      </div>
    );
  }

  const status = getKpiStatusColor(value);
  const style = STATUS_STYLES[status];
  const widthPercent = Math.max(0, Math.min(100, value));

  return (
    <div className="flex items-center gap-2">
      <div className="relative h-1 flex-1 rounded-full bg-slate-150 bg-slate-200/80">
        <div
          className={cn('h-1 rounded-full transition-all duration-300', style.bar)}
          style={{ width: `${widthPercent}%` }}
        />
        <div
          className="absolute top-1/2 h-2.5 w-px -translate-y-1/2 bg-slate-400/50"
          style={{ left: `${KPI_WARNING_THRESHOLD}%` }}
          aria-hidden="true"
        />
      </div>
      <span
        className={cn(
          'w-14 shrink-0 text-right font-sukhumvit text-sm font-bold tabular-nums',
          style.text,
        )}
      >
        {value.toFixed(1)}%
      </span>
      {status !== 'neutral' && (
        <HiOutlineExclamationTriangle
          className={cn('h-4 w-4 shrink-0', status === 'critical' ? 'text-rose-600' : 'text-amber-500')}
          aria-label={status === 'critical' ? 'วิกฤต ต้องติดตามด่วน' : 'ต่ำกว่าเกณฑ์'}
        />
      )}
    </div>
  );
}
