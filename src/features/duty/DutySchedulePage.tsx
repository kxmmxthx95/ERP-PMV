// src/features/duty/DutySchedulePage.tsx
import { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { HiMagnifyingGlass, HiXMark } from 'react-icons/hi2';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import { useTeacherManager } from '@/features/teachers/hooks/useTeacherManager';
import { db } from '@/lib/firebase';
import {
  addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query,
} from 'firebase/firestore';
import { toast } from 'sonner';
import { DEPARTMENT_CONFIG } from '@/types/curriculum';

// ── Types ─────────────────────────────────────────────────────────────────────
interface DutyAssignment {
  id: string;
  date: string;
  teacherId: string;
  teacherName: string;
  location: string;
  startTime: string;
  endTime: string;
  note?: string;
}

interface TeacherRecord {
  id: string;
  name: string;
  department: string;
  status: string;
  photoURL?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const today = new Date();
function isoDate(d: Date) { return d.toISOString().slice(0, 10); }
function addDays(d: Date, n: number) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }

const WEEKDAY_LABELS = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
const WEEKDAY_COLORS = [
  { bg: 'bg-red-400', light: 'bg-red-100/40', badge: 'bg-red-100 text-red-700' },                 // อา
  { bg: 'bg-orange-400', light: 'bg-orange-100/40', badge: 'bg-orange-100 text-orange-700' },     // จ
  { bg: 'bg-yellow-400', light: 'bg-yellow-100/40', badge: 'bg-yellow-100 text-yellow-700' },     // อ
  { bg: 'bg-green-400', light: 'bg-green-100/40', badge: 'bg-green-100 text-green-700' },         // พ
  { bg: 'bg-blue-400', light: 'bg-blue-100/40', badge: 'bg-blue-100 text-blue-700' },             // พฤ
  { bg: 'bg-purple-400', light: 'bg-purple-100/40', badge: 'bg-purple-100 text-purple-700' },     // ศ
  { bg: 'bg-pink-400', light: 'bg-pink-100/40', badge: 'bg-pink-100 text-pink-700' },             // ส
];


// ── Hooks ─────────────────────────────────────────────────────────────────────
function usePrefersFineHover() {
  const [prefersHover, setPrefersHover] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(hover: hover) and (pointer: fine)').matches
      : false,
  );

  useEffect(() => {
    const mq = window.matchMedia('(hover: hover) and (pointer: fine)');
    const onChange = () => setPrefersHover(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return prefersHover;
}

// ── Teacher Card (UsersPage style) ────────────────────────────────────────────
interface TeacherCardProps {
  teacher: TeacherRecord;
  index: number;
  isActive: boolean;
  weekDays: Date[];
  duties: DutyAssignment[];
  canEdit: boolean;
  enableHoverActivate: boolean;
  onActivate: () => void;
  onDeactivate: () => void;
  onAssignDay: (date: string) => Promise<void>;
  onUnassignDay: (id: string) => Promise<void>;
}

function TeacherCard({
  teacher, index, isActive, weekDays, duties, canEdit, enableHoverActivate,
  onActivate, onDeactivate, onAssignDay, onUnassignDay,
}: TeacherCardProps) {
  const deptConf = DEPARTMENT_CONFIG[teacher.department as keyof typeof DEPARTMENT_CONFIG];
  const deptColor = deptConf?.color ?? '#64748b';

  const weekDuties = weekDays.map(d => {
    const key = isoDate(d);
    return duties.find(du => du.date === key && (du.teacherId === teacher.id || du.teacherName === teacher.name)) ?? null;
  });

  const nameForInitial = teacher.name
    .replace(/^(นาย|นาง(?:สาว)?|เด็กชาย|เด็กหญิง|ด\.ช\.|ด\.ญ\.|ครู|อาจารย์)\s*/u, '')
    .trim();
  const initial = nameForInitial.charAt(0) || '?';

  async function handleDayClick(d: Date, i: number) {
    const existing = weekDuties[i];
    if (existing) {
      await onUnassignDay(existing.id);
    } else {
      await onAssignDay(isoDate(d));
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: index * 0.01 }}
      className="flex flex-col gap-1.5 group cursor-pointer select-none"
      onMouseEnter={() => enableHoverActivate && canEdit && onActivate()}
      onMouseLeave={() => enableHoverActivate && canEdit && onDeactivate()}
      onClick={() => {
        if (!canEdit) return;
        if (enableHoverActivate) {
          if (isActive) onDeactivate();
          else onActivate();
          return;
        }
        if (!isActive) onActivate();
      }}
    >
      {/* Card image area */}
      <div
        className="relative aspect-square rounded-2xl overflow-hidden bg-slate-100 border border-slate-200/60 transition-all duration-300 hover:shadow-lg"
        role={canEdit ? 'button' : undefined}
        aria-label={canEdit ? `เลือกวันเวร ${teacher.name}` : undefined}
      >
        {teacher.photoURL ? (
          <>
            <img
              src={teacher.photoURL}
              alt={teacher.name}
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900/20 via-transparent to-transparent z-0" />
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-50">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center text-white font-black shadow-inner"
              style={{ fontSize: '24px', background: deptColor }}
            >
              {initial}
            </div>
          </div>
        )}

        {/* Day-selector overlay */}
        <AnimatePresence>
          {isActive && canEdit && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] flex flex-col items-center justify-center z-20 p-4"
              onClick={e => {
                e.stopPropagation();
                onDeactivate();
              }}
            >
              {/* Day buttons grid */}
              <div className="grid grid-cols-3 gap-4">
                  {weekDays.map((d, i) => {
                    const assigned = !!weekDuties[i];
                    const isToday = isoDate(d) === isoDate(today);
                    const color = WEEKDAY_COLORS[i];
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={e => { e.stopPropagation(); handleDayClick(d, i); }}
                        className={`flex items-center justify-center rounded-md w-10 h-10 transition-all font-black text-[11px] text-white ${
                          assigned
                            ? `${color.bg} shadow-lg`
                            : isToday
                            ? `${color.light} border border-white/50`
                            : `${color.light} hover:opacity-80`
                        }`}
                      >
                        {WEEKDAY_LABELS[i]}
                      </button>
                    );
                  })}
                </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Name + duty days below */}
      <div className="px-0.5 mt-0.5 space-y-0">
        <p className="text-[10px] sm:text-[14px] font-bold text-slate-800 leading-tight truncate">
          {teacher.name}
        </p>
        <div className="flex flex-col sm:flex-row sm:items-center gap-0.5">
          {weekDuties.some(d => d) ? (
            <div className="flex flex-wrap gap-1">
              {weekDuties.map((duty, i) => duty && (
                <span
                  key={i}
                  className={`text-[8px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded tracking-wider ${WEEKDAY_COLORS[i].badge}`}
                >
                  {WEEKDAY_LABELS[i]}
                </span>
              ))}
            </div>
          ) : (
            <span className="text-[8px] sm:text-[10px] text-slate-400 italic">
              ยังไม่มีเวร
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function DutySchedulePage() {
  const { canEdit: checkCanEdit } = useMyPermissions();
  const { teachers } = useTeacherManager();
  const canEdit = checkCanEdit('dutySchedule');
  const enableHoverActivate = usePrefersFineHover();

  const [duties, setDuties] = useState<DutyAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [teacherQuery, setTeacherQuery] = useState('');
  const [filterDept, setFilterDept] = useState<string>('all');
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [isSearchMode, setIsSearchMode] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'duty_assignments'), orderBy('date', 'asc'));
    const unsub = onSnapshot(q, snap => {
      setDuties(snap.docs.map(d => {
        const data = d.data() as Partial<DutyAssignment>;
        return {
          id: d.id,
          date: data.date ?? '',
          teacherId: data.teacherId ?? '',
          teacherName: data.teacherName ?? '',
          location: data.location ?? '',
          startTime: data.startTime ?? '',
          endTime: data.endTime ?? '',
          note: data.note ?? '',
        };
      }));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // ── Week range (current week: Sun-Sat) ──
  const weekStart = useMemo(() => {
    const d = new Date(today);
    const day = d.getDay();
    const diff = -day; // Sunday = 0, so go back to start of week
    d.setDate(d.getDate() + diff);
    return d;
  }, []);

  const weekDays = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  // ── Teacher list ──
  const deptOptions = useMemo(() => {
    return (Object.keys(DEPARTMENT_CONFIG) as Array<keyof typeof DEPARTMENT_CONFIG>).map(d => ({
      id: d,
      label: DEPARTMENT_CONFIG[d].label,
    }));
  }, []);

  const filteredTeachers = useMemo(() =>
    teachers
      .filter(t => t.status === 'active')
      .filter(t => filterDept === 'all' || t.department === filterDept)
      .filter(t => !teacherQuery.trim() || t.name.toLowerCase().includes(teacherQuery.toLowerCase()))
      .sort((a, b) => {
        const dA = DEPARTMENT_CONFIG[a.department as keyof typeof DEPARTMENT_CONFIG]?.label ?? a.department;
        const dB = DEPARTMENT_CONFIG[b.department as keyof typeof DEPARTMENT_CONFIG]?.label ?? b.department;
        if (dA !== dB) return dA.localeCompare(dB, 'th');
        return a.name.localeCompare(b.name, 'th');
      }),
    [teachers, teacherQuery, filterDept],
  );

  // ── Handlers ──
  async function handleAssignDay(teacher: TeacherRecord, date: string) {
    const hasDup = duties.some(d => d.date === date && (d.teacherId === teacher.id || d.teacherName === teacher.name));
    if (hasDup) { toast.error('ครูคนนี้มีเวรในวันนี้แล้ว'); return; }
    await addDoc(collection(db, 'duty_assignments'), {
      date,
      teacherId: teacher.id,
      teacherName: teacher.name,
      location: 'จุดเวรหลัก',
      startTime: '07:00',
      endTime: '08:00',
      note: '',
    });
    toast.success(`เพิ่มเวรให้ ${teacher.name} แล้ว`);
  }

  async function handleUnassignDay(dutyId: string) {
    await deleteDoc(doc(db, 'duty_assignments', dutyId));
    toast.success('ลบเวรแล้ว');
  }

  return (
    <>
      {/* ── Render filter in header via portal ── */}
      {createPortal(
        <motion.div
          layout
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className={`flex items-center gap-1.5 h-10 p-1 rounded-full pointer-events-auto transition-all duration-300 ${
            isSearchMode
              ? 'bg-blue-50/90 shadow-md border border-blue-100'
              : 'bg-white/60 backdrop-blur-xl border border-white shadow-[0_8px_32px_rgba(0,0,0,0.04)]'
          }`}
        >
          {isSearchMode ? (
            <motion.div
              key="search-active"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex items-center gap-2 px-2.5 w-full sm:w-[320px] h-full"
            >
              <HiMagnifyingGlass className="text-slate-400 flex-shrink-0 w-3.5 h-3.5" />
              <input
                type="text"
                value={teacherQuery}
                onChange={e => setTeacherQuery(e.target.value)}
                placeholder="ค้นหาชื่อครู..."
                autoFocus
                className="bg-transparent text-xs font-bold text-slate-800 placeholder:text-slate-400 outline-none w-full"
              />
              <button
                onClick={() => {
                  setTeacherQuery('');
                  setIsSearchMode(false);
                }}
                className="flex items-center justify-center w-6 h-6 rounded-full text-slate-400 hover:text-slate-600 hover:bg-black/5 transition-all flex-shrink-0"
              >
                <HiXMark className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          ) : (
            <div className="flex items-center gap-1.5 w-full px-1">
              {/* Department Filter Buttons */}
              <div className="flex items-center gap-1">
                <motion.button
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0 }}
                  onClick={() => setFilterDept('all')}
                  className={`h-8 px-6 rounded-full text-[11px] font-black transition-all whitespace-nowrap flex-shrink-0 flex items-center justify-center ${
                    filterDept === 'all'
                      ? 'bg-slate-900 text-white shadow-md'
                      : 'text-slate-500 hover:text-slate-800 hover:bg-black/5'
                  }`}
                >
                  ทั้งหมด
                </motion.button>
                {deptOptions.map((d, idx) => (
                  <motion.button
                    key={d.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: (idx + 1) * 0.05 }}
                    onClick={() => setFilterDept(filterDept === d.id ? 'all' : d.id)}
                    className={`h-8 px-6 rounded-full text-[11px] font-black transition-all whitespace-nowrap flex-shrink-0 flex items-center justify-center ${
                      filterDept === d.id
                        ? 'bg-slate-900 text-white shadow-md'
                        : 'text-slate-500 hover:text-slate-800 hover:bg-black/5'
                    }`}
                  >
                    {d.label}
                  </motion.button>
                ))}
              </div>

              <div className="w-px h-5 bg-black/10 mx-1 shrink-0" />

              {/* Search Toggle Button */}
              <button
                onClick={() => setIsSearchMode(true)}
                className="flex items-center justify-center w-8 h-8 rounded-full text-slate-600 hover:bg-black/5 transition-all active:scale-90 flex-shrink-0"
              >
                <HiMagnifyingGlass className="w-4 h-4" />
              </button>
            </div>
          )}
        </motion.div>,
        document.getElementById('header-portal-filters') || document.body,
      )}

      {/* ── Main content ── */}
      <div className="min-h-full flex flex-col gap-4">

        {/* ── Teacher card grid ── */}
        {loading ? (
          <p className="text-xs text-slate-400 py-6">กำลังโหลด...</p>
        ) : filteredTeachers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-3">
            <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center">
              <span className="text-2xl text-slate-300">👤</span>
            </div>
            <p className="text-sm font-bold text-slate-500">ไม่พบรายชื่อครู</p>
          </div>
        ) : (
          <div
            className="grid gap-4 sm:gap-6 pb-4"
            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}
          >
            {filteredTeachers.map((t, i) => (
              <TeacherCard
                key={t.id}
                teacher={t}
                index={i}
                isActive={activeCardId === t.id}
                weekDays={weekDays}
                duties={duties}
                canEdit={canEdit}
                enableHoverActivate={enableHoverActivate}
                onActivate={() => setActiveCardId(t.id)}
                onDeactivate={() => setActiveCardId(null)}
                onAssignDay={date => handleAssignDay(t, date)}
                onUnassignDay={handleUnassignDay}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
