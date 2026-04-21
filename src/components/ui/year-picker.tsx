import { useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export function YearPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (year: string) => void;
}) {
  const currentThaiYear = new Date().getFullYear() + 543;
  const [page, setPage] = useState(() => {
    const v = parseInt(value);
    return isNaN(v) ? Math.floor(currentThaiYear / 12) * 12 : Math.floor(v / 12) * 12;
  });
  const [open, setOpen] = useState(false);

  const years = Array.from({ length: 12 }, (_, i) => page + i);

  const handleSelect = (year: number) => {
    onChange(String(year));
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-black/[0.03] border border-black/5 text-xs text-black/80 hover:bg-black/[0.06] transition-colors text-left"
        >
          <CalendarDays size={13} className="text-black/40 flex-shrink-0" />
          <span className={value ? 'font-semibold' : 'text-black/35'}>
            {value ? `ปีการศึกษา ${value}` : 'เลือกปีการศึกษา...'}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[260px] p-0 rounded-2xl border-0 overflow-hidden z-[100]"
        style={{
          background: 'rgba(255,255,255,0.98)',
          backdropFilter: 'blur(24px)',
          boxShadow: '0 16px 48px rgba(0,0,0,0.14)',
        }}
        align="start"
      >
        {/* Header with nav */}
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-black/5">
          <button
            onClick={() => setPage(p => p - 12)}
            className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-black/5 transition-colors"
          >
            <ChevronLeft size={14} className="text-black/60" />
          </button>
          <span className="text-xs font-bold text-black/70">
            {page} – {page + 11}
          </span>
          <button
            onClick={() => setPage(p => p + 12)}
            className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-black/5 transition-colors"
          >
            <ChevronRight size={14} className="text-black/60" />
          </button>
        </div>

        {/* Year Grid */}
        <div className="p-2 grid grid-cols-3 gap-1">
          {years.map(y => {
            const isSelected = String(y) === value;
            const isCurrent = y === currentThaiYear;
            return (
              <button
                key={y}
                onClick={() => handleSelect(y)}
                className="px-2 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150 relative"
                style={{
                  background: isSelected ? '#1e1e1e' : isCurrent ? 'rgba(0,0,0,0.05)' : 'transparent',
                  color: isSelected ? '#fff' : isCurrent ? '#1e1e1e' : 'rgba(0,0,0,0.65)',
                  fontWeight: isSelected || isCurrent ? 700 : 500,
                }}
              >
                {y}
                {isCurrent && !isSelected && (
                  <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-black/30" />
                )}
              </button>
            );
          })}
        </div>

        {/* Quick jump to current year */}
        <div className="px-3 pb-3">
          <button
            onClick={() => {
              setPage(Math.floor(currentThaiYear / 12) * 12);
              handleSelect(currentThaiYear);
            }}
            className="w-full text-[11px] font-semibold text-black/50 hover:text-black/80 transition-colors py-1.5 rounded-lg hover:bg-black/5"
          >
            ปีการศึกษาปัจจุบัน ({currentThaiYear})
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
