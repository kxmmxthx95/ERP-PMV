import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Pencil, Trash2, Coffee, Timer, X, Check, PlusCircle, Clock } from 'lucide-react';

// ── Long-press hook ───────────────────────────────────────────────────────────
function useLongPress(callback: () => void, delay = 500) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const start = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    timerRef.current = setTimeout(callback, delay);
  }, [callback, delay]);

  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => () => cancel(), [cancel]);

  return { onMouseDown: start, onMouseUp: cancel, onMouseLeave: cancel, onTouchStart: start, onTouchEnd: cancel };
}
import {
  SCHOOL_DAYS, DAY_LABELS, DAY_SHORT,
  type SchoolDay, type ScheduleEntry,
} from '@/types/schedule';
import { useScheduleSettings } from '@/hooks/useScheduleSettings';

// ── Palette ───────────────────────────────────────────────────────────────────

const SLOT_COLORS = [
  { bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.30)', text: '#1d4ed8' },
  { bg: 'rgba(168,85,247,0.12)', border: 'rgba(168,85,247,0.30)', text: '#7c3aed' },
  { bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.30)', text: '#047857' },
  { bg: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.30)', text: '#c2410c' },
  { bg: 'rgba(236,72,153,0.12)', border: 'rgba(236,72,153,0.30)', text: '#be185d' },
  { bg: 'rgba(234,179,8,0.12)', border: 'rgba(234,179,8,0.30)', text: '#a16207' },
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
  classId?: string;
  readOnly?: boolean;
  onSlotClick: (day: SchoolDay, period: number, entry: ScheduleEntry | null) => void;
  onDeleteEntry: (id: string) => void;
  onMoveEntry?: (id: string, day: SchoolDay, period: number) => void;
  onDropSubject?: (day: SchoolDay, period: number, subjectId: string, teacherId: string) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ScheduleGrid({
  grid,
  viewMode,
  classId,
  readOnly = false,
  onSlotClick,
  onDeleteEntry,
  onMoveEntry,
  onDropSubject,
}: ScheduleGridProps) {
  const {
    periodCount,
    periodTimes,
    breakPeriods,
    lunchPeriods,
    addPeriod,
    removePeriod,
    updatePeriodTime,
    toggleBreakPeriod,
    toggleLunchPeriod,
    cycleBreakType,
  } = useScheduleSettings(classId);

  const periods = Array.from({ length: periodCount }, (_, i) => i + 1);
  const canEdit = !readOnly && !!classId;

  // คำนวณหมายเลขคาบที่แสดง (ข้ามพักไม่นับ)
  let regularCount = 0;
  const displayNumbers: Record<number, number> = {};
  for (const p of periods) {
    if (!breakPeriods.includes(p) && !lunchPeriods.includes(p)) {
      regularCount++;
      displayNumbers[p] = regularCount;
    }
  }

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
          style={{
            gridTemplateColumns: `${canEdit ? 88 : 72}px repeat(5, 1fr)`,
            background: 'rgba(0,0,0,0.03)',
            borderBottom: '1px solid rgba(0,0,0,0.10)',
          }}
        >
          <div className="p-2" />
          {SCHOOL_DAYS.map(day => (
            <div
              key={day}
              className="p-2 text-center"
              style={{ borderLeft: '1px solid rgba(0,0,0,0.08)' }}
            >
              <p className="text-[11px] font-bold text-black/70 hidden sm:block">{DAY_LABELS[day]}</p>
              <p className="text-[11px] font-bold text-black/70 sm:hidden">{DAY_SHORT[day]}</p>
            </div>
          ))}
        </div>

        {/* ── Period rows ── */}
        {periods.map((period, periodIdx) => {
          const isLunch = lunchPeriods.includes(period);
          const isBreak = breakPeriods.includes(period);
          const isAnyBreak = isLunch || isBreak;
          const isLast = periodIdx === periods.length - 1;

          return (
            <div
              key={period}
              className="grid group/row"
              style={{
                gridTemplateColumns: `${canEdit ? 88 : 72}px repeat(5, 1fr)`,
                borderTop: '1px solid rgba(0,0,0,0.08)',
                background: isLunch ? 'rgba(251,191,36,0.06)' : isBreak ? 'rgba(249,115,22,0.04)' : undefined,
              }}
            >
              {/* Period label */}
              <PeriodLabel
                period={period}
                displayNum={displayNumbers[period]}
                isLunch={isLunch}
                isBreak={isBreak}
                isLast={isLast}
                time={periodTimes[period] ?? ''}
                canEdit={canEdit}
                onRemove={() => removePeriod(period)}
                onTimeChange={(t) => updatePeriodTime(period, t)}
                onToggleBreak={() => toggleBreakPeriod(period)}
                onToggleLunch={() => toggleLunchPeriod(period)}
                onCycleBreak={() => cycleBreakType(period)}
              />

              {/* Day cells */}
              {SCHOOL_DAYS.map(day => {
                const entry = grid[day]?.[period] ?? null;

                return (
                  <div
                    key={day}
                    style={{
                      borderLeft: '1px solid rgba(0,0,0,0.08)',
                      borderBottom: isLast ? 'none' : undefined,
                      minHeight: isLunch ? 64 : isBreak ? 24 : 64,
                      padding: '2px',
                      background: isLunch ? 'rgba(16, 185, 129, 0.12)' : isBreak ? 'rgba(234, 179, 8, 0.15)' : undefined,
                    }}
                    onDragOver={(e) => {
                      if (!isAnyBreak) e.preventDefault();
                    }}
                    onDrop={(e) => {
                      if (isAnyBreak) return;
                      const subjectJson = e.dataTransfer.getData('application/subject-card');
                      if (subjectJson && onDropSubject) {
                        try {
                          const { subjectId, teacherId } = JSON.parse(subjectJson);
                          onDropSubject(day, period, subjectId, teacherId);
                        } catch { }
                        return;
                      }
                      if (!onMoveEntry) return;
                      const entryId = e.dataTransfer.getData('text/plain');
                      if (entryId) onMoveEntry(entryId, day, period);
                    }}
                  >
                    {isLunch ? (
                      <div className="h-full flex items-center justify-center gap-1">
                        <Coffee size={11} className="text-emerald-600" />
                        <span className="text-[9.5px] text-emerald-700 font-bold uppercase tracking-tight">พักกลางวัน</span>
                      </div>
                    ) : isBreak ? (
                      <div className="h-full flex items-center justify-center gap-1">
                        <Timer size={11} className="text-yellow-600" />
                        <span className="text-[9.5px] text-yellow-700 font-bold uppercase tracking-tight">พักเบรก</span>
                      </div>
                    ) : (
                      <SlotCell
                        entry={entry}
                        viewMode={viewMode}
                        readOnly={readOnly}
                        onDoubleClick={() => !readOnly && onSlotClick(day, period, entry)}
                        onDelete={(!readOnly && entry) ? () => onDeleteEntry(entry.id) : undefined}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}

        {/* ── Add period row ── */}
        {canEdit && (
          <div
            className="flex items-center justify-center py-1.5 border-t"
            style={{ borderColor: 'rgba(0,0,0,0.08)' }}
          >
            <button
              onClick={addPeriod}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-semibold text-black/40 hover:text-black/70 hover:bg-black/[0.04] transition-all"
            >
              <PlusCircle size={12} />
              เพิ่มคาบ
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Period Label ──────────────────────────────────────────────────────────────

function PeriodLabel({
  period,
  displayNum,
  isLunch,
  isBreak,
  time,
  canEdit,
  onRemove,
  onTimeChange,
  onToggleBreak,
  onToggleLunch,
  onCycleBreak,
}: {
  period: number;
  displayNum?: number;
  isLunch: boolean;
  isBreak: boolean;
  isLast: boolean;
  time: string;
  canEdit: boolean;
  onRemove: () => void;
  onTimeChange: (t: string) => void;
  onToggleBreak: () => void;
  onToggleLunch: () => void;
  onCycleBreak: () => void;
}) {
  const [showTimeForm, setShowTimeForm] = useState(false);
  const [draftStart, setDraftStart] = useState('');
  const [draftEnd, setDraftEnd] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // sync draft เมื่อ time prop เปลี่ยน (หลัง Firestore update)
  useEffect(() => {
    if (!showTimeForm) {
      const parts = time.split('-');
      setDraftStart(parts[0]?.trim() || '');
      setDraftEnd(parts[1]?.trim() || '');
    }
  }, [time, showTimeForm]);

  const openForm = useCallback(() => {
    if (!canEdit) return;
    const parts = time.split('-');
    setDraftStart(parts[0]?.trim() || '');
    setDraftEnd(parts[1]?.trim() || '');
    setShowTimeForm(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [canEdit, time]);

  const commit = () => {
    const t = draftStart && draftEnd ? `${draftStart} - ${draftEnd}` : draftStart || draftEnd || '';
    onTimeChange(t);
    setShowTimeForm(false);
  };

  const cancel = () => {
    const parts = time.split('-');
    setDraftStart(parts[0]?.trim() || '');
    setDraftEnd(parts[1]?.trim() || '');
    setShowTimeForm(false);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (!canEdit) return;
    e.stopPropagation();
    onCycleBreak();
  };

  const longPress = useLongPress(openForm, 500);

  // Close form when clicking outside
  useEffect(() => {
    if (!showTimeForm) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        cancel();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showTimeForm]);

  return (
    <div
      ref={containerRef}
      className="relative flex flex-col items-center justify-center py-0.5 px-0.5 group/label select-none"
      style={{
        borderRight: '1px solid rgba(0,0,0,0.08)',
        minHeight: isLunch ? 64 : isBreak ? 24 : 64,
        cursor: canEdit ? 'pointer' : 'default',
        background: isLunch ? 'rgba(16, 185, 129, 0.2)' : isBreak ? 'rgba(234, 179, 8, 0.2)' : undefined,
      }}
      onDoubleClick={handleDoubleClick}
      title={canEdit ? 'ดับเบิลคลิก: เปลี่ยนประเภท | กดค้าง: แก้ไขเวลา' : undefined}
      {...(canEdit ? longPress : {})}
    >
      {/* Remove button */}
      {canEdit && (
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          title="ลบคาบนี้"
          className="absolute top-0.5 right-0.5 w-4 h-4 rounded flex items-center justify-center opacity-0 group-hover/row:opacity-100 hover:bg-red-50 text-black/25 hover:text-red-500 transition-all z-10"
        >
          <X size={9} />
        </button>
      )}

      {isLunch ? (
        <Coffee size={12} className="text-emerald-500 mb-0" />
      ) : isBreak ? (
        <Timer size={11} className="text-yellow-500 mb-0" />
      ) : (
        <span className="text-[10px] font-bold text-black/60 leading-tight">
          คาบ {displayNum ?? period}
        </span>
      )}

      {/* Time display */}
      <span className={`text-[9px] text-center leading-tight mt-0.5 block ${canEdit ? 'text-black/40 group-hover/label:text-blue-500' : 'text-black/30'} transition-colors`}>
        {time || '—'}
      </span>

      {/* Break type buttons — shown when active */}
      {canEdit && (isBreak || isLunch) && (
        <div className="flex gap-0 mt-0.5">
          <button
            onMouseDown={e => e.stopPropagation()}
            onTouchStart={e => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onToggleBreak(); }}
            title={isBreak ? 'ยกเลิกพักเบรก' : 'ตั้งเป็นพักเบรก'}
            className={`w-4 h-4 rounded flex items-center justify-center transition-all
              ${isBreak ? 'text-yellow-500 hover:text-red-500 hover:bg-red-50' : 'text-black/20 hover:text-yellow-500 hover:bg-yellow-50'}`}
          >
            <Timer size={8} />
          </button>
          <button
            onMouseDown={e => e.stopPropagation()}
            onTouchStart={e => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onToggleLunch(); }}
            title={isLunch ? 'ยกเลิกพักกลางวัน' : 'ตั้งเป็นพักกลางวัน'}
            className={`w-4 h-4 rounded flex items-center justify-center transition-all
              ${isLunch ? 'text-emerald-500 hover:text-red-500 hover:bg-red-50' : 'text-black/20 hover:text-emerald-500 hover:bg-emerald-50'}`}
          >
            <Coffee size={8} />
          </button>
        </div>
      )}

      {/* ── Time edit form (long-press popover) ── */}
      <AnimatePresence>
        {showTimeForm && (
          <motion.div
            initial={{ opacity: 0, scale: 0.90, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.90, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute left-full ml-2 top-1/2 -translate-y-1/2 z-50"
            style={{ minWidth: 220 }}
            onMouseDown={e => e.stopPropagation()}
            onClick={e => e.stopPropagation()}
          >
            <div
              className="rounded-xl p-3 shadow-xl"
              style={{
                background: 'rgba(255,255,255,0.96)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(0,0,0,0.10)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.14)',
              }}
            >
              <div className="flex items-center gap-1.5 mb-2">
                <Clock size={11} className="text-blue-500" />
                <span className="text-[11px] font-semibold text-black/70">
                  แก้ไขเวลา — คาบ {displayNum ?? period}
                </span>
              </div>
              <div className="flex items-center gap-1.5 mb-2">
                <input
                  ref={inputRef}
                  type="time"
                  value={draftStart}
                  onChange={e => setDraftStart(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') cancel(); }}
                  className="w-full text-[11px] text-center border border-blue-200 rounded-lg px-1.5 py-1.5 outline-none focus:border-blue-400 bg-white"
                />
                <span className="text-black/30 font-bold">-</span>
                <input
                  type="time"
                  value={draftEnd}
                  onChange={e => setDraftEnd(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') cancel(); }}
                  className="w-full text-[11px] text-center border border-blue-200 rounded-lg px-1.5 py-1.5 outline-none focus:border-blue-400 bg-white"
                />
              </div>
              <div className="flex gap-1.5">
                <button
                  onClick={commit}
                  className="flex-1 flex items-center justify-center gap-1 py-1 rounded-lg text-[10px] font-semibold text-white transition-colors"
                  style={{ background: 'rgba(59,130,246,0.85)' }}
                >
                  <Check size={10} /> บันทึก
                </button>
                <button
                  onClick={cancel}
                  className="flex items-center justify-center px-2 py-1 rounded-lg text-[10px] text-black/40 hover:text-black/60 hover:bg-black/[0.04] transition-colors"
                >
                  <X size={10} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Slot Cell ─────────────────────────────────────────────────────────────────

function SlotCell({
  entry,
  viewMode,
  readOnly,
  onDoubleClick,
  onDelete,
}: {
  entry: ScheduleEntry | null;
  viewMode: 'class' | 'teacher';
  readOnly?: boolean;
  onDoubleClick: () => void;
  onDelete?: () => void;
}) {
  if (!entry) {
    return (
      <button
        onDoubleClick={onDoubleClick}
        disabled={readOnly}
        className="group w-full h-full rounded-xl flex items-center justify-center transition-all duration-150 hover:bg-black/[0.04] disabled:cursor-default"
        style={{ minHeight: 72 }}
      >
        {!readOnly && <Plus size={14} className="text-black/15 group-hover:text-black/35 transition-colors" />}
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
          minHeight: 72,
        }}
        onDoubleClick={onDoubleClick}
        draggable={!readOnly}
        onDragStart={(e: any) => {
          if (readOnly) return;
          e.dataTransfer.setData('text/plain', entry.id);
          e.dataTransfer.effectAllowed = 'move';
        }}
      >
        <p className="text-[9px] font-bold leading-none mb-1" style={{ color: color.text }}>
          {entry.subjectCode}
        </p>
        <p className="text-[10px] font-semibold text-black/75 leading-tight line-clamp-2">
          {entry.subjectName}
        </p>
        <p className="text-[9px] text-black/40 mt-1 leading-tight truncate">
          {viewMode === 'class' ? entry.teacherName : `ห้อง ${entry.classId}`}
        </p>

        {!readOnly && (
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
        )}
      </motion.div>
    </AnimatePresence>
  );
}
