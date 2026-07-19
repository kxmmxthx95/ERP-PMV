import type { CSSProperties } from 'react';
import { HiSun } from 'react-icons/hi2';
import { cn } from '@/lib/utils';

export function getWidgetHolidayCardStyle(isWeekend: boolean): CSSProperties {
  return isWeekend
    ? {
        background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 55%, #6d28d9 100%)',
        border: '1.5px solid rgba(255,255,255,0.28)',
      }
    : {
        background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 55%, #b91c1c 100%)',
        border: '1.5px solid rgba(255,255,255,0.28)',
      };
}

export function getWidgetHolidayLabel(isWeekend: boolean, holidayTitle?: string | null): string {
  if (isWeekend) return 'วันหยุดสุดสัปดาห์';
  return holidayTitle ? `วันหยุด · ${holidayTitle}` : 'วันหยุด';
}

export function WidgetHolidayBadge() {
  return (
    <span className="text-[10px] font-black px-2 py-0.5 rounded-lg border bg-white/20 text-white border-white/30 shrink-0">
      วันหยุด
    </span>
  );
}

export function WidgetHolidayBody({
  isWeekend,
  holidayTitle,
}: {
  isWeekend: boolean;
  holidayTitle?: string | null;
}) {
  return (
    <div className="flex-1 min-h-0 flex items-center justify-center rounded-xl border border-white/25 bg-white/10 px-3">
      <div className="flex items-center gap-2 min-w-0 justify-center text-center">
        {isWeekend ? (
          <HiSun className="w-5 h-5 text-white shrink-0" aria-hidden />
        ) : null}
        <p className="text-[11px] font-black text-white leading-tight">
          {getWidgetHolidayLabel(isWeekend, holidayTitle)}
        </p>
      </div>
    </div>
  );
}

export function widgetHolidayHeaderClass(isHoliday: boolean): string {
  return cn(
    'font-bold text-sm truncate leading-tight',
    isHoliday ? 'text-white' : 'text-slate-700',
  );
}

export function widgetHolidayDateClass(isHoliday: boolean): string {
  return cn(
    'text-[10px] truncate',
    isHoliday ? 'text-white/75' : 'text-slate-400',
  );
}

export function widgetHolidayIconButtonClass(isHoliday: boolean): string {
  return cn(
    'p-1.5 rounded-lg transition shrink-0',
    isHoliday ? 'hover:bg-white/15 text-white' : 'hover:bg-slate-200/50 text-slate-600',
  );
}
