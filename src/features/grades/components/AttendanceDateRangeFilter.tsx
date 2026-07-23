import { useEffect, useMemo, useState } from 'react';
import { HiCalendarDays } from 'react-icons/hi2';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { formatThaiDateRangeFromIso, getLocalDateString } from '@/lib/dateUtils';
import { cn } from '@/lib/utils';

export type AttendanceDatePreset = 'semester' | 'month' | 'custom';

export type AttendanceDateRange = {
  from: string;
  to: string;
};

function monthRange(today = new Date()): { from: string; to: string } {
  const from = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
  return { from, to: getLocalDateString(today) };
}

function clampRange(from: string, to: string, min?: string, max?: string): AttendanceDateRange {
  let nextFrom = from;
  let nextTo = to;
  if (min && nextFrom && nextFrom < min) nextFrom = min;
  if (max && nextTo && nextTo > max) nextTo = max;
  if (nextFrom && nextTo && nextFrom > nextTo) {
    return { from: nextTo, to: nextFrom };
  }
  return { from: nextFrom, to: nextTo };
}

interface Props {
  yearStartDate: string;
  yearEndDate: string;
  onRangeChange: (range: AttendanceDateRange) => void;
  className?: string;
}

export default function AttendanceDateRangeFilter({
  yearStartDate,
  yearEndDate,
  onRangeChange,
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [datePreset, setDatePreset] = useState<AttendanceDatePreset>('semester');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const range = useMemo(() => {
    if (datePreset === 'month') {
      const month = monthRange();
      return clampRange(month.from, month.to, yearStartDate || undefined, yearEndDate || undefined);
    }
    if (datePreset === 'custom') {
      const from = customFrom || yearStartDate;
      const to = customTo || yearEndDate || getLocalDateString();
      return clampRange(from, to, yearStartDate || undefined, yearEndDate || undefined);
    }
    return {
      from: yearStartDate,
      to: yearEndDate || getLocalDateString(),
    };
  }, [datePreset, customFrom, customTo, yearStartDate, yearEndDate]);

  const label = useMemo(() => {
    if (datePreset === 'semester') return 'ทั้งภาคเรียน';
    if (datePreset === 'month') return 'เดือนนี้';
    if (range.from && range.to) {
      return formatThaiDateRangeFromIso(range.from, range.to);
    }
    return 'เลือกช่วงวันที่';
  }, [datePreset, range.from, range.to]);

  useEffect(() => {
    onRangeChange(range);
  }, [range, onRangeChange]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-foreground transition-colors hover:bg-slate-100',
            className,
          )}
          title={label}
          aria-label={`ช่วงวันที่: ${label}`}
        >
          <HiCalendarDays size={16} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 gap-3 rounded-xl p-3">
        <p className="text-[11px] font-black text-slate-500 font-sukhumvit uppercase tracking-wide">
          เลือกช่วงวันที่
        </p>
        <div className="grid grid-cols-1 gap-1.5">
          {([
            { key: 'semester' as const, label: 'ทั้งภาคเรียน' },
            { key: 'month' as const, label: 'เดือนนี้' },
            { key: 'custom' as const, label: 'กำหนดเอง' },
          ]).map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => {
                setDatePreset(opt.key);
                if (opt.key !== 'custom') setOpen(false);
                if (opt.key === 'custom' && !customFrom && !customTo) {
                  setCustomFrom(yearStartDate || monthRange().from);
                  setCustomTo(yearEndDate || getLocalDateString());
                }
              }}
              className={cn(
                'h-8 rounded-lg px-2.5 text-left text-[12px] font-bold font-sarabun transition',
                datePreset === opt.key
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {datePreset === 'custom' && (
          <div className="grid grid-cols-2 gap-2 border-t border-slate-100 pt-3">
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-slate-400 font-sarabun">เริ่ม</span>
              <input
                type="date"
                value={customFrom}
                min={yearStartDate || undefined}
                max={customTo || yearEndDate || undefined}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-sarabun text-slate-700 outline-none focus:ring-2 focus:ring-emerald-400/40"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-slate-400 font-sarabun">สิ้นสุด</span>
              <input
                type="date"
                value={customTo}
                min={customFrom || yearStartDate || undefined}
                max={yearEndDate || undefined}
                onChange={(e) => setCustomTo(e.target.value)}
                className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-sarabun text-slate-700 outline-none focus:ring-2 focus:ring-emerald-400/40"
              />
            </label>
          </div>
        )}

        {range.from && range.to && (
          <p className="text-[10px] font-semibold text-slate-400 font-sarabun">
            {formatThaiDateRangeFromIso(range.from, range.to)}
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}
