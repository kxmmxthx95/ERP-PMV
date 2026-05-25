// src/features/duty/DutySchedulePage.tsx
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck, Plus, Pencil, Trash2, ChevronLeft, ChevronRight,
  Clock, MapPin, User, Calendar,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

// ── Types ─────────────────────────────────────────────────────────────────────
interface DutyAssignment {
  id: string;
  date: string;          // "YYYY-MM-DD"
  teacherId: string;
  teacherName: string;
  location: string;
  startTime: string;     // "HH:MM"
  endTime: string;
  note?: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const DEFAULT_COLOR = { bg: '#f0fdfa', text: '#0d9488', border: '#5eead4' };

// ── Mock data — will be replaced with Firestore ───────────────────────────────
const today = new Date();
function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}
function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

const MOCK_DUTIES: DutyAssignment[] = [
  { id: '1', date: isoDate(today),          teacherId: 't01', teacherName: 'ครูสมชาย ใจดี',   location: 'ประตูหน้า',      startTime: '07:00', endTime: '08:00' },
  { id: '2', date: isoDate(today),          teacherId: 't02', teacherName: 'ครูสมหญิง รักดี', location: 'ประตูหลัง',      startTime: '07:00', endTime: '08:00' },
  { id: '3', date: isoDate(today),          teacherId: 't03', teacherName: 'ครูประเสริฐ ดีมาก',location: 'โรงอาหาร',       startTime: '11:30', endTime: '12:30' },
  { id: '4', date: isoDate(addDays(today,1)),teacherId: 't04', teacherName: 'ครูวิมล สุขใจ',  location: 'ประตูหน้า',      startTime: '07:00', endTime: '08:00' },
  { id: '5', date: isoDate(addDays(today,1)),teacherId: 't01', teacherName: 'ครูสมชาย ใจดี',  location: 'อาคารหลัก',      startTime: '15:30', endTime: '16:30' },
  { id: '6', date: isoDate(addDays(today,2)),teacherId: 't02', teacherName: 'ครูสมหญิง รักดี',location: 'ประตูหน้า',       startTime: '07:00', endTime: '08:00' },
];

// ── Glass style ───────────────────────────────────────────────────────────────
const GLASS: React.CSSProperties = {
  background: 'rgba(255,255,255,0.72)',
  backdropFilter: 'blur(24px) saturate(150%)',
  WebkitBackdropFilter: 'blur(24px) saturate(150%)',
  border: '1px solid rgba(255,255,255,0.90)',
  boxShadow: '0 8px 32px rgba(0,0,0,0.06)',
};

// ── Modal ─────────────────────────────────────────────────────────────────────
interface DutyFormModalProps {
  initial?: Partial<DutyAssignment>;
  onSave: (d: Omit<DutyAssignment, 'id'>) => void;
  onClose: () => void;
}

function DutyFormModal({ initial, onSave, onClose }: DutyFormModalProps) {
  const [form, setForm] = useState({
    date:        initial?.date        ?? isoDate(today),
    teacherName: initial?.teacherName ?? '',
    location:    initial?.location    ?? 'ประตูหน้า',
    startTime:   initial?.startTime   ?? '07:00',
    endTime:     initial?.endTime     ?? '08:00',
    note:        initial?.note        ?? '',
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.teacherName.trim()) return;
    onSave({ ...form, teacherId: '' });
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.25)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 16 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 16 }}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl p-6"
        style={GLASS}
      >
        <h3 className="text-base font-black text-slate-800 mb-4">
          {initial?.id ? 'แก้ไขครูเวร' : 'เพิ่มครูเวร'}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Date */}
          <div>
            <label className="text-xs font-bold text-slate-500 mb-1 block">วันที่</label>
            <input
              type="date"
              value={form.date}
              onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 bg-white/70 outline-none focus:ring-2 focus:ring-teal-400"
            />
          </div>
          {/* Teacher name */}
          <div>
            <label className="text-xs font-bold text-slate-500 mb-1 block">ชื่อครู</label>
            <input
              type="text"
              placeholder="ชื่อ-นามสกุลครู"
              value={form.teacherName}
              onChange={e => setForm(f => ({ ...f, teacherName: e.target.value }))}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 bg-white/70 outline-none focus:ring-2 focus:ring-teal-400"
              required
            />
          </div>
          
          {/* Location + times */}
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-3 sm:col-span-1">
              <label className="text-xs font-bold text-slate-500 mb-1 block">สถานที่</label>
              <input
                type="text"
                value={form.location}
                onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 bg-white/70 outline-none focus:ring-2 focus:ring-teal-400"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1 block">เริ่ม</label>
              <input
                type="time"
                value={form.startTime}
                onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 bg-white/70 outline-none focus:ring-2 focus:ring-teal-400"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1 block">สิ้นสุด</label>
              <input
                type="time"
                value={form.endTime}
                onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 bg-white/70 outline-none focus:ring-2 focus:ring-teal-400"
              />
            </div>
          </div>
          {/* Note */}
          <div>
            <label className="text-xs font-bold text-slate-500 mb-1 block">หมายเหตุ (ถ้ามี)</label>
            <input
              type="text"
              value={form.note}
              onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 bg-white/70 outline-none focus:ring-2 focus:ring-teal-400"
            />
          </div>
          {/* Buttons */}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 rounded-xl text-sm font-bold text-slate-600 border border-slate-200 bg-white/60 hover:bg-slate-50 transition-colors">
              ยกเลิก
            </button>
            <button type="submit"
              className="flex-1 py-2 rounded-xl text-sm font-bold text-white transition-colors"
              style={{ background: 'linear-gradient(135deg,#0d9488,#0891b2)' }}>
              บันทึก
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

// ── Duty card ─────────────────────────────────────────────────────────────────
interface DutyCardProps {
  duty: DutyAssignment;
  canEdit: boolean;
  onEdit: () => void;
  onDelete: () => void;
}
function DutyCard({ duty, canEdit, onEdit, onDelete }: DutyCardProps) {
  return (
    <motion.div
      layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="flex items-start gap-3 p-3 rounded-xl border"
      style={{ background: DEFAULT_COLOR.bg, borderColor: DEFAULT_COLOR.border }}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className="text-xs font-bold text-slate-600 flex items-center gap-1">
            <Clock size={11} /> {duty.startTime}–{duty.endTime}
          </span>
        </div>
        <p className="mt-1 text-sm font-black text-slate-800 flex items-center gap-1.5">
          <User size={13} className="flex-shrink-0 text-teal-600" />
          {duty.teacherName}
        </p>
        <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
          <MapPin size={11} /> {duty.location}
        </p>
        {duty.note && <p className="text-xs text-slate-400 mt-0.5 italic">{duty.note}</p>}
      </div>
      {canEdit && (
        <div className="flex gap-1 flex-shrink-0">
          <button onClick={onEdit}
            className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/60 transition-colors text-slate-500">
            <Pencil size={13} />
          </button>
          <button onClick={onDelete}
            className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/60 transition-colors text-rose-400">
            <Trash2 size={13} />
          </button>
        </div>
      )}
    </motion.div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function DutySchedulePage() {
  const { role } = useAuth();
  const canEdit = role === 'admin' || role === 'sysadmin';

  const [duties, setDuties] = useState<DutyAssignment[]>(MOCK_DUTIES);
  const [weekOffset, setWeekOffset] = useState(0);
  const [modalState, setModalState] = useState<
    | { mode: 'add'; prefillDate?: string }
    | { mode: 'edit'; duty: DutyAssignment }
    | null
  >(null);

  // ── Week range ──
  const weekStart = (() => {
    const d = new Date(today);
    const day = d.getDay(); // 0=Sun
    const diff = day === 0 ? -6 : 1 - day; // Monday
    d.setDate(d.getDate() + diff + weekOffset * 7);
    return d;
  })();

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const thaiDay = (d: Date) =>
    new Intl.DateTimeFormat('th-TH', { weekday: 'short', day: 'numeric', month: 'short' }).format(d);

  // ── Grouped by date ──
  const grouped = weekDays.reduce<Record<string, DutyAssignment[]>>((acc, d) => {
    const key = isoDate(d);
    acc[key] = duties.filter(du => du.date === key);
    return acc;
  }, {});

  // ── Handlers ──
  function handleSave(data: Omit<DutyAssignment, 'id'>) {
    if (modalState?.mode === 'edit') {
      setDuties(ds => ds.map(d => d.id === modalState.duty.id ? { ...d, ...data } : d));
    } else {
      setDuties(ds => [...ds, { ...data, id: String(Date.now()) }]);
    }
    setModalState(null);
  }

  function handleDelete(id: string) {
    setDuties(ds => ds.filter(d => d.id !== id));
  }

  const weekLabel = (() => {
    const s = new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short' }).format(weekStart);
    const e = new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }).format(addDays(weekStart, 6));
    return `${s} – ${e}`;
  })();

  const totalThisWeek = weekDays.reduce((s, d) => s + (grouped[isoDate(d)]?.length ?? 0), 0);

  return (
    <div className="min-h-full">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg,#0d9488,#0891b2)' }}>
              <ShieldCheck size={16} className="text-white" />
            </div>
            <h1 className="text-xl font-black text-slate-800">ตารางครูเวร</h1>
          </div>
          <p className="text-xs text-slate-500 ml-10">Duty Teacher Schedule — มาก่อนเวลาเพื่อดูแลนักเรียน</p>
        </div>
        {canEdit && (
          <button
            onClick={() => setModalState({ mode: 'add' })}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-white shadow-md flex-shrink-0"
            style={{ background: 'linear-gradient(135deg,#0d9488,#0891b2)' }}
          >
            <Plus size={15} /> เพิ่มครูเวร
          </button>
        )}
      </div>

      {/* ── Stats row ── */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        {/* Week navigator */}
        <div className="flex items-center gap-2 rounded-xl px-3 py-2" style={GLASS}>
          <button onClick={() => setWeekOffset(w => w - 1)}
            className="w-6 h-6 rounded-lg flex items-center justify-center hover:bg-slate-100 transition-colors text-slate-600">
            <ChevronLeft size={14} />
          </button>
          <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5 px-1">
            <Calendar size={12} /> {weekLabel}
          </span>
          <button onClick={() => setWeekOffset(w => w + 1)}
            className="w-6 h-6 rounded-lg flex items-center justify-center hover:bg-slate-100 transition-colors text-slate-600">
            <ChevronRight size={14} />
          </button>
          {weekOffset !== 0 && (
            <button onClick={() => setWeekOffset(0)}
              className="text-[10px] font-bold text-teal-600 hover:text-teal-800 px-1">
              ปัจจุบัน
            </button>
          )}
        </div>

        {/* Summary badge */}
        <div className="px-3 py-2 rounded-xl text-xs font-bold text-teal-700"
          style={{ background: '#ccfbf1', border: '1px solid #5eead4' }}>
          สัปดาห์นี้ {totalThisWeek} เวร
        </div>
      </div>

      {/* ── Week grid ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7 gap-3">
        {weekDays.map(d => {
          const key = isoDate(d);
          const isToday = key === isoDate(today);
          const dayDuties = grouped[key] ?? [];
          return (
            <div key={key} className="rounded-2xl overflow-hidden" style={GLASS}>
              {/* Day header */}
              <div className="px-3 py-2 flex items-center justify-between"
                style={{
                  background: isToday
                    ? 'linear-gradient(135deg,#0d9488,#0891b2)'
                    : 'rgba(248,250,252,0.6)',
                  borderBottom: '1px solid rgba(255,255,255,0.7)',
                }}>
                <span className={`text-xs font-black ${isToday ? 'text-white' : 'text-slate-700'}`}>
                  {thaiDay(d)}
                </span>
                {isToday && (
                  <span className="text-[9px] font-bold bg-white/20 text-white px-1.5 py-0.5 rounded-full">
                    วันนี้
                  </span>
                )}
                {canEdit && (
                  <button
                    onClick={() => setModalState({ mode: 'add', prefillDate: key })}
                    className={`w-5 h-5 rounded-full flex items-center justify-center transition-colors ml-1 ${isToday ? 'text-white hover:bg-white/20' : 'text-slate-400 hover:bg-slate-200'}`}
                  >
                    <Plus size={11} />
                  </button>
                )}
              </div>
              {/* Duties */}
              <div className="p-2 space-y-2 min-h-[80px]">
                <AnimatePresence>
                  {dayDuties.length === 0 ? (
                    <p className="text-[11px] text-slate-300 text-center py-4">ไม่มีเวร</p>
                  ) : (
                    dayDuties.map(duty => (
                      <DutyCard
                        key={duty.id}
                        duty={duty}
                        canEdit={canEdit}
                        onEdit={() => setModalState({ mode: 'edit', duty })}
                        onDelete={() => handleDelete(duty.id)}
                      />
                    ))
                  )}
                </AnimatePresence>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Modal ── */}
      <AnimatePresence>
        {modalState && (
          <DutyFormModal
            initial={
              modalState.mode === 'edit'
                ? modalState.duty
                : modalState.prefillDate
                  ? { date: modalState.prefillDate }
                  : undefined
            }
            onSave={handleSave}
            onClose={() => setModalState(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
