import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Pencil, Trash2, Coffee } from 'lucide-react';
import {
  SCHOOL_DAYS, DAY_LABELS, DAY_SHORT,
  type SchoolDay, type ScheduleEntry,
} from '@/types/schedule';
import { useScheduleSettings } from '@/hooks/useScheduleSettings';

// ── Palette ───────────────────────────────────────────────────────────────────

const SLOT_COLORS = [
  { bg: 'rgba(59,130,246,0.12)',  border: 'rgba(59,130,246,0.30)',  text: '#1d4ed8' },
  { bg: 'rgba(168,85,247,0.12)', border: 'rgba(168,85,247,0.30)', text: '#7c3aed' },
  { bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.30)', text: '#047857' },
  { bg: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.30)', text: '#c2410c' },
  { bg: 'rgba(236,72,153,0.12)', border: 'rgba(236,72,153,0.30)', text: '#be185d' },
  { bg: 'rgba(234,179,8,0.12)',  border: 'rgba(234,179,8,0.30)',  text: '#a16207' },
  { bg: 'rgba(20,184,166,0.12)', border: 'rgba(20,184,166,0.30)', text: '#0f766e' },
];

function subjectColor(subjectId: string) {
  let hash = 0;
  for (const ch of subjectId) hash = (hash * 31 + ch.charCodeAt(0)) & 0xffff;
  return SLOT_COLORS[hash % SLOT_COLORS.length];
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface ScheduleGridProps {
  grid: Record<number, Record<number, ScheduleEntry | null>>;
  viewMode: 'class' | 'teacher';
  onSlotClick: (day: SchoolDay, period: number, entry: ScheduleEntry | null) => void;
  onDeleteEntry: (id: string) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ScheduleGrid({
  grid,
  viewMode,
  onSlotClick,
  onDeleteEntry,
}: ScheduleGridProps) {
  const { periodCount, periodTimes, lunchPeriod } = useScheduleSettings();
  const periods = Array.from({ length: periodCount }, (_, i) => i + 1);

  return (
    <div className="overflow-x-auto">
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: 'rgba(255,255,255,0.70)',
          backdropFilter: 'blur(24px) saturate(150%)',
          WebkitBackdropFilter: 'blur(24px) saturate(150%)',
          border: '1px solid rgba(255,255,255,0.85)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.06)',
          minWidth: 680,
        }}
      >
        {/* ── Header row (Days) ── */}
        <div
          className="grid"
          style={{ gridTemplateColumns: '72px repeat(5, 1fr)' }}
        >
          <div className="p-2" />
          {SCHOOL_DAYS.map(day => (
            <div
              key={day}
              className="p-2 text-center"
              style={{ borderLeft: '1px solid rgba(0,0,0,0.05)' }}
            >
              <p className="text-[11px] font-bold text-black/50 hidden sm:block">{DAY_LABELS[day]}</p>
              <p className="text-[11px] font-bold text-black/50 sm:hidden">{DAY_SHORT[day]}</p>
            </div>
          ))}
        </div>

        {/* ── Period rows ── */}
        {periods.map((period, periodIdx) => {
          const isLunch = period === lunchPeriod;
          const isLast = periodIdx === periods.length - 1;

          return (
            <div
              key={period}
              className="grid"
              style={{
                gridTemplateColumns: '72px repeat(5, 1fr)',
                borderTop: '1px solid rgba(0,0,0,0.05)',
                background: isLunch ? 'rgba(0,0,0,0.02)' : undefined,
              }}
            >
              {/* Period label */}
              <div
                className="flex flex-col items-center justify-center py-1 px-1"
                style={{ borderRight: '1px solid rgba(0,0,0,0.05)' }}
              >
                {isLunch ? (
                  <Coffee size={14} className="text-black/25 mb-0.5" />
                ) : (
                  <span className="text-[11px] font-bold text-black/40">คาบ {period}</span>
                )}
                <span className="text-[9px] text-black/25 text-center leading-tight">
                  {periodTimes[period]}
                </span>
              </div>

              {/* Day cells */}
              {SCHOOL_DAYS.map(day => {
                const entry = grid[day]?.[period] ?? null;

                return (
                  <div
                    key={day}
                    style={{
                      borderLeft: '1px solid rgba(0,0,0,0.05)',
                      borderBottom: isLast ? 'none' : undefined,
                      minHeight: isLunch ? 36 : 72,
                      padding: '4px',
                    }}
                  >
                    {isLunch ? (
                      <div className="h-full flex items-center justify-center">
                        <span className="text-[9px] text-black/25">พักกลางวัน</span>
                      </div>
                    ) : (
                      <SlotCell
                        entry={entry}
                        viewMode={viewMode}
                        onClick={() => onSlotClick(day, period, entry)}
                        onDelete={entry ? () => onDeleteEntry(entry.id) : undefined}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Slot Cell ─────────────────────────────────────────────────────────────────

function SlotCell({
  entry,
  viewMode,
  onClick,
  onDelete,
}: {
  entry: ScheduleEntry | null;
  viewMode: 'class' | 'teacher';
  onClick: () => void;
  onDelete?: () => void;
}) {
  if (!entry) {
    return (
      <button
        onClick={onClick}
        className="group w-full h-full rounded-xl flex items-center justify-center transition-all duration-150 hover:bg-black/[0.04]"
        style={{ minHeight: 64 }}
      >
        <Plus size={14} className="text-black/15 group-hover:text-black/35 transition-colors" />
      </button>
    );
  }

  const color = subjectColor(entry.subjectId);

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={entry.id}
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.92 }}
        transition={{ duration: 0.15 }}
        className="group relative w-full h-full rounded-xl p-2 cursor-pointer transition-all duration-150 hover:shadow-md"
        style={{
          background: color.bg,
          border: `1px solid ${color.border}`,
          minHeight: 64,
        }}
        onClick={onClick}
      >
        {/* Subject code */}
        <p
          className="text-[9px] font-bold leading-none mb-1"
          style={{ color: color.text }}
        >
          {entry.subjectCode}
        </p>

        {/* Subject name */}
        <p className="text-[10px] font-semibold text-black/75 leading-tight line-clamp-2">
          {entry.subjectName}
        </p>

        {/* Teacher / Class (ขึ้นอยู่กับ view mode) */}
        <p className="text-[9px] text-black/40 mt-1 leading-tight truncate">
          {viewMode === 'class' ? entry.teacherName : `ห้อง ${entry.classId}`}
        </p>

        {/* Actions overlay */}
        <div className="absolute top-1 right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={e => { e.stopPropagation(); }}
            className="w-5 h-5 rounded-md flex items-center justify-center bg-white/80 hover:bg-white text-black/40 hover:text-blue-600 transition-colors"
            title="แก้ไข"
          >
            <Pencil size={10} />
          </button>
          {onDelete && (
            <button
              onClick={e => { e.stopPropagation(); onDelete(); }}
              className="w-5 h-5 rounded-md flex items-center justify-center bg-white/80 hover:bg-red-50 text-black/40 hover:text-red-600 transition-colors"
              title="ลบ"
            >
              <Trash2 size={10} />
            </button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
