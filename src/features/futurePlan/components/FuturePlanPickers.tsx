import { useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HiOutlineChevronDown, HiOutlineChevronUp, HiOutlineMagnifyingGlass } from 'react-icons/hi2';
import { cn } from '@/lib/utils';
import { fp } from '@/features/futurePlan/futurePlanTheme';

export interface SearchablePickerItem {
  key: string;
  label: string;
  sublabel?: string;
}

const pickerSelected = 'bg-[#E3E7FC] text-[#0056FF] font-semibold';
const pickerHover = 'hover:bg-[#E3E7FC]/60 hover:text-[#0056FF]';

export function SimpleDropdown({
  value,
  options,
  placeholder,
  onChange,
  accentClass,
}: {
  value: string;
  options: readonly string[];
  placeholder: string;
  onChange: (v: string) => void;
  accentClass?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className={cn(
          fp.inputSm,
          'flex items-center justify-between px-3 py-2.5',
          open ? 'border-[#2277FF]' : 'hover:border-[#2277FF]/50',
        )}
      >
        <span className={value ? 'text-[#000000]' : 'text-[#0056FF]/40'}>{value || placeholder}</span>
        {open ? <HiOutlineChevronUp size={16} /> : <HiOutlineChevronDown size={16} />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            className="absolute z-30 left-0 right-0 mt-1 rounded-2xl border border-[#E3E7FC] bg-white shadow-xl overflow-hidden max-h-52 overflow-y-auto"
          >
            {options.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => {
                  onChange(opt);
                  setOpen(false);
                }}
                className={cn(
                  'w-full text-left px-4 py-2.5 text-sm transition-colors',
                  pickerHover,
                  value === opt && (accentClass ?? pickerSelected),
                )}
              >
                {opt}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function SearchablePicker({
  value,
  placeholder,
  searchPlaceholder,
  items,
  onSelect,
  leading,
  selectedLeading,
  freeText = true,
  onFreeTextChange,
  invalid = false,
}: {
  value: string;
  placeholder: string;
  searchPlaceholder: string;
  items: SearchablePickerItem[];
  onSelect: (label: string) => void;
  leading?: (item: SearchablePickerItem) => ReactNode;
  selectedLeading?: ReactNode;
  freeText?: boolean;
  onFreeTextChange?: (v: string) => void;
  /** @deprecated accent is ignored — brand palette is used */
  accent?: 'blue' | 'sky';
  invalid?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const q = search.trim().toLowerCase();
  const filtered = items.filter(
    (item) =>
      !q ||
      item.label.toLowerCase().includes(q) ||
      (item.sublabel?.toLowerCase().includes(q) ?? false),
  );

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className={cn(
          fp.inputSm,
          'flex items-center justify-between gap-2 px-3 py-2.5',
          invalid
            ? 'border-[#0056FF] ring-2 ring-[#E3E7FC]'
            : cn('hover:border-[#2277FF]/50', open && 'border-[#2277FF]'),
        )}
      >
        <span className="flex items-center gap-2 min-w-0">
          {selectedLeading}
          <span className={cn('truncate', value ? 'text-[#000000]' : 'text-[#0056FF]/40')}>
            {value || placeholder}
          </span>
        </span>
        {open ? (
          <HiOutlineChevronUp size={16} className="flex-shrink-0" />
        ) : (
          <HiOutlineChevronDown size={16} className="flex-shrink-0" />
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            className="absolute z-30 left-0 right-0 mt-1 rounded-2xl border border-[#E3E7FC] bg-white shadow-xl overflow-hidden"
          >
            <div className="p-2 border-b border-[#E3E7FC]">
              <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-[#E3E7FC]/50">
                <HiOutlineMagnifyingGlass size={14} className="text-[#0056FF]/40" />
                <input
                  autoFocus
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="flex-1 text-sm bg-transparent text-[#000000] placeholder:text-[#0056FF]/40 outline-none"
                />
              </div>
            </div>
            <div className="max-h-48 overflow-y-auto">
              {filtered.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => {
                    onSelect(item.label);
                    setOpen(false);
                    setSearch('');
                  }}
                  className={cn(
                    'w-full flex items-center gap-2.5 text-left px-4 py-2.5 text-sm transition-colors',
                    pickerHover,
                    value === item.label && pickerSelected,
                  )}
                >
                  {leading?.(item)}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{item.label}</span>
                    {item.sublabel && (
                      <span className="block truncate text-[11px] text-[#0056FF]/40 font-normal">
                        {item.sublabel}
                      </span>
                    )}
                  </span>
                </button>
              ))}
              {filtered.length === 0 && (
                <p className="text-center text-[#0056FF]/40 text-sm py-4">ไม่พบผลการค้นหา</p>
              )}
            </div>
            {freeText && onFreeTextChange && (
              <div className="p-2 border-t border-[#E3E7FC]">
                <input
                  value={value}
                  onChange={(e) => onFreeTextChange(e.target.value)}
                  placeholder="หรือพิมพ์เอง..."
                  className={cn(fp.inputSm, 'px-3 py-2 rounded-lg')}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
