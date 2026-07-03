// Widget การเช็กชื่อนักเรียน — Context-Aware, เสิร์ฟให้ครูถึงหน้าจอ
// แสดงตารางสอนวันนี้ + ไฮไลต์คาบที่กำลังสอน + เปิด Bottom Sheet เช็กชื่อได้เลย

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ClipboardCheck, ChevronRight, X, Save, CheckCircle2,
  Clock, Users, BookOpen, Loader2,
} from 'lucide-react';
import {
  collection, query, where, getDocs,
  addDoc, updateDoc, doc, serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { useActiveAcademicYear } from '@/hooks/useActiveAcademicYear';
import { useScheduleSettings } from '@/hooks/useScheduleSettings';
import { WIDGET_GLASS } from '../widgetStyles';
import type { AttendanceStatus } from '@/types/teaching';
import type { LeaveRequest } from '@/types/leave';

// ── Constants ─────────────────────────────────────────────────────────────────



// วนรอบ: present → late → absent → leave → present
const STATUS_CYCLE: AttendanceStatus[] = ['present', 'late', 'absent', 'leave'];

const STATUS_CONFIG: Record<AttendanceStatus, { label: string; emoji: string; color: string; bg: string; border: string }> = {
  present:  { label: 'มาเรียน', emoji: '🟢', color: '#059669', bg: '#d1fae5', border: '#6ee7b7' },
  late:     { label: 'สาย',     emoji: '🟡', color: '#d97706', bg: '#fef3c7', border: '#fcd34d' },
  absent:   { label: 'ขาด',     emoji: '🔴', color: '#e11d48', bg: '#ffe4e6', border: '#fca5a5' },
  leave:    { label: 'ลา',      emoji: '🔵', color: '#2563eb', bg: '#dbeafe', border: '#93c5fd' },
  excused:  { label: 'ลา',      emoji: '🔵', color: '#2563eb', bg: '#dbeafe', border: '#93c5fd' },
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface ScheduleSlot {
  scheduleId: string;
  period: number;
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  classId: string;
  className: string;
  room?: string;
}

interface StudentRow {
  studentId: string;
  studentCode: string;
  studentName: string;
  photoURL?: string;
  status: AttendanceStatus;
  note: string;
  hasApprovedLeave: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function nowHHMM(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function getActivePeriod(periodTimes: Record<number, string>, lunchPeriods: number[]): number | null {
  const now = nowHHMM();
  for (const [p, range] of Object.entries(periodTimes)) {
    const period = Number(p);
    if (lunchPeriods.includes(period)) continue;
    
    // Parse "08:00 - 08:50"
    const parts = range.split('-').map(s => s.trim());
    if (parts.length === 2) {
      const [start, end] = parts;
      if (now >= start && now < end) return period;
    }
  }
  return null;
}

function todayDayOfWeek(): number {
  const d = new Date().getDay(); // 0=อาทิตย์ ... 6=เสาร์
  return d === 0 ? 7 : d; // แปลงเป็น 1=จันทร์ ... 7=อาทิตย์
}

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

function getIdentityCandidates(student: { id?: string; userId?: string; uid?: string; authUid?: string }): string[] {
  return [...new Set([student.id, student.userId, student.uid, student.authUid]
    .map(v => (typeof v === 'string' ? v.trim() : ''))
    .filter(Boolean))];
}

function normalizeThaiName(value: string): string {
  return value.replace(/\s+/g, '').trim();
}

// ── Hook: โหลดตารางสอนของครูวันนี้ ────────────────────────────────────────────

function useTodaySchedule(teacherId: string | null, academicYearId: string | null, semester: 1 | 2 | null) {
  const [slots, setSlots] = useState<ScheduleSlot[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!teacherId || !academicYearId || !semester) return;
    setLoading(true);

    const dayOfWeek = todayDayOfWeek();

    const q = query(
      collection(db, 'schedules'),
      where('teacherId', '==', teacherId),
      where('academicYearId', '==', academicYearId),
      where('semester', '==', semester),
      where('dayOfWeek', '==', dayOfWeek),
    );

    getDocs(q)
      .then(snap => {
        const result: ScheduleSlot[] = snap.docs
          .map(d => {
            const data = d.data();
            return {
              scheduleId: d.id,
              period: data.period,
              subjectId: data.subjectId,
              subjectName: data.subjectName ?? '',
              subjectCode: data.subjectCode ?? '',
              classId: data.classId,
              className: data.className ?? data.classId,
              room: data.room,
            } as ScheduleSlot;
          })
          .sort((a, b) => a.period - b.period);
        setSlots(result);
      })
      .catch(err => console.error('useTodaySchedule:', err))
      .finally(() => setLoading(false));
  }, [teacherId, academicYearId, semester]);

  return { slots, loading };
}

// ── Hook: โหลดรายชื่อนักเรียนในห้อง + เช็คใบลาที่อนุมัติแล้ว ──────────────────

function useStudentRows(classId: string | null, date: string) {
  const [rows, setRows] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!classId) {
      setRows([]);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const enrollQ = query(
          collection(db, 'enrollments'),
          where('classId', '==', classId),
          where('status', '==', 'studying'),
        );

        const leaveQ = query(
          collection(db, 'leave_requests'),
          where('status', '==', 'approved'),
          where('startDate', '<=', date),
          where('endDate', '>=', date),
        );

        const [enrollSnap, leaveSnap] = await Promise.all([getDocs(enrollQ), getDocs(leaveQ)]);
        const studentIds = enrollSnap.docs.map(d => d.data().studentId as string);

        if (studentIds.length === 0) {
          if (!cancelled) setRows([]);
          return;
        }

        const approvedLeaves = leaveSnap.docs.map(d => d.data() as LeaveRequest);
        const userMap: Record<string, Record<string, unknown>> = {};

        for (let i = 0; i < studentIds.length; i += 30) {
          const chunk = studentIds.slice(i, i + 30);
          const userQ = query(collection(db, 'users'), where('__name__', 'in', chunk));
          const userSnap = await getDocs(userQ);
          userSnap.docs.forEach(d => {
            userMap[d.id] = d.data() as Record<string, unknown>;
          });
        }

        const result: StudentRow[] = studentIds.map(sid => {
          const u = userMap[sid] ?? {};
          const candidateIds = getIdentityCandidates({
            id: sid,
            userId: typeof u.userId === 'string' ? u.userId : undefined,
            uid: typeof u.uid === 'string' ? u.uid : undefined,
            authUid: typeof u.authUid === 'string' ? u.authUid : undefined,
          });
          const candidateCode = typeof u.studentCode === 'string' ? u.studentCode.trim() : '';
          const compactName = normalizeThaiName(
            `${typeof u.prefix === 'string' ? u.prefix : ''}${typeof u.firstName === 'string' ? u.firstName : ''}${typeof u.lastName === 'string' ? u.lastName : ''}`,
          );
          const displayName = normalizeThaiName(typeof u.displayName === 'string' ? u.displayName : '');

          const matchedLeave = approvedLeaves.find(leave => {
            if (leave.requesterType !== 'student' || leave.status !== 'approved') return false;

            const leaveRequesterId = typeof leave.requesterId === 'string' ? leave.requesterId.trim() : '';
            const leaveStudentCode = typeof leave.requesterStudentCode === 'string' ? leave.requesterStudentCode.trim() : '';
            const leaveName = normalizeThaiName(typeof leave.requesterName === 'string' ? leave.requesterName : '');

            return (
              (leaveRequesterId.length > 0 && candidateIds.includes(leaveRequesterId))
              || (leaveStudentCode.length > 0 && candidateCode.length > 0 && leaveStudentCode === candidateCode)
              || (leaveName.length > 0 && (leaveName === compactName || leaveName === displayName))
            );
          });

          const hasLeave = !!matchedLeave;
          return {
            studentId: sid,
            studentCode: candidateCode || (typeof u.employeeCode === 'string' ? u.employeeCode : sid.slice(0, 8)),
            studentName: typeof u.displayName === 'string'
              ? u.displayName
              : `${typeof u.prefix === 'string' ? u.prefix : ''}${typeof u.firstName === 'string' ? u.firstName : ''} ${typeof u.lastName === 'string' ? u.lastName : ''}`.trim() || sid,
            photoURL: typeof u.photoURL === 'string' ? u.photoURL : undefined,
            status: (hasLeave ? 'leave' : 'present') as AttendanceStatus,
            note: hasLeave ? `ลาอัตโนมัติ: ${matchedLeave?.leaveType ?? 'leave'} (${matchedLeave?.reason ?? '-'})` : '',
            hasApprovedLeave: hasLeave,
          };
        }).sort((a, b) => a.studentCode.localeCompare(b.studentCode, undefined, { numeric: true }));

        if (!cancelled) setRows(result);
      } catch (err) {
        console.error('useStudentRows:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [classId, date]);

  return { rows, setRows, loading };
}

// ── Sub-component: Session Card บนรายการตาราง ─────────────────────────────────

function SessionCard({
  slot,
  isActive,
  isDone,
  onPress,
  periodTimes,
}: {
  slot: ScheduleSlot;
  isActive: boolean;
  isDone: boolean;
  onPress: () => void;
  periodTimes: Record<number, string>;
}) {
  const timeLabel = periodTimes[slot.period] || '';

  return (
    <motion.div
      layout
      animate={isActive ? { scale: 1.02 } : { scale: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 26 }}
      className="relative rounded-2xl overflow-hidden"
      style={{
        background: isActive
          ? 'rgba(255,255,255,0.95)'
          : isDone
            ? 'rgba(248,250,252,0.6)'
            : 'rgba(255,255,255,0.75)',
        border: isActive
          ? '1.5px solid rgba(16,185,129,0.5)'
          : '1px solid rgba(226,232,240,0.8)',
        boxShadow: isActive
          ? '0 0 0 3px rgba(16,185,129,0.12), 0 8px 24px rgba(16,185,129,0.1)'
          : 'none',
        opacity: isDone && !isActive ? 0.55 : 1,
      }}
    >
      {/* Glow pulse สำหรับ active session */}
      {isActive && (
        <motion.div
          className="absolute inset-0 rounded-2xl pointer-events-none"
          animate={{ opacity: [0.4, 0.8, 0.4] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
          style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.08) 0%, rgba(52,211,153,0.04) 100%)' }}
        />
      )}

      <div className="flex items-center gap-3 px-3 py-2.5">
        {/* Period Badge */}
        <div className="shrink-0 w-9 h-9 rounded-xl flex flex-col items-center justify-center"
          style={{
            background: isActive ? '#ecfdf5' : '#f1f5f9',
          }}>
          <span className="text-[9px] font-bold uppercase tracking-wide"
            style={{ color: isActive ? '#059669' : '#94a3b8' }}>ค</span>
          <span className="text-[13px] font-black leading-none"
            style={{ color: isActive ? '#059669' : '#475569' }}>{slot.period}</span>
        </div>

        {/* Subject & Class info */}
        <div className="flex flex-col flex-1 min-w-0">
          <span className="text-[12px] font-bold text-slate-800 truncate leading-tight">
            {slot.subjectName}
          </span>
          <span className="text-[10px] text-slate-400 truncate">
            {slot.className}{slot.room ? ` · ${slot.room}` : ''}
          </span>
          <span className="text-[9px] text-slate-300 mt-0.5">{timeLabel}</span>
        </div>

        {/* Action */}
        {isDone ? (
          <CheckCircle2 size={16} className="shrink-0 text-emerald-400" />
        ) : (
          <motion.button
            whileTap={{ scale: 0.94 }}
            onClick={onPress}
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold"
            style={{
              background: isActive ? '#059669' : 'rgba(241,245,249,0.9)',
              color: isActive ? '#fff' : '#64748b',
              boxShadow: isActive ? '0 4px 12px rgba(5,150,105,0.3)' : 'none',
            }}
          >
            {isActive ? (
              <>
                <ClipboardCheck size={11} />
                เช็กชื่อ
              </>
            ) : (
              <ChevronRight size={12} />
            )}
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}

// ── Sub-component: Bottom Sheet เช็กชื่อ ──────────────────────────────────────

function AttendanceSheet({
  slot,
  date,
  teacherId,
  academicYearId,
  semester,
  onClose,
  onSaved,
  periodTimes,
}: {
  slot: ScheduleSlot;
  date: string;
  teacherId: string;
  academicYearId: string;
  semester: 1 | 2;
  onClose: () => void;
  onSaved: (scheduleId: string) => void;
  periodTimes: Record<number, string>;
}) {
  const { rows, setRows, loading } = useStudentRows(slot.classId, date);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const cycleStatus = useCallback((studentId: string) => {
    setRows(prev => prev.map(r => {
      if (r.studentId !== studentId) return r;
      // ถ้ามีใบลาอนุมัติ ให้วนจาก leave เท่านั้นถ้าครูต้องการ override
      const idx = STATUS_CYCLE.indexOf(r.status as typeof STATUS_CYCLE[number]);
      const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
      return { ...r, status: next };
    }));
  }, [setRows]);

  const summary = useMemo(() => {
    const counts = { present: 0, late: 0, absent: 0, leave: 0 };
    rows.forEach(r => {
      if (r.status === 'excused') counts.leave++;
      else if (r.status in counts) counts[r.status as keyof typeof counts]++;
    });
    return counts;
  }, [rows]);

  const handleSave = async () => {
    if (rows.length === 0) return;
    setSaving(true);
    try {
      const today = date;

      // เช็คว่ามี session เดิมอยู่แล้วไหม
      const existingQ = query(
        collection(db, 'class_sessions'),
        where('scheduleId', '==', slot.scheduleId),
        where('date', '==', today),
      );
      const existingSnap = await getDocs(existingQ);

      const payload = {
        scheduleId: slot.scheduleId,
        subjectId: slot.subjectId,
        subjectName: slot.subjectName,
        subjectCode: slot.subjectCode,
        classId: slot.classId,
        className: slot.className,
        teacherId,
        academicYearId,
        semester,
        date: today,
        period: slot.period,
        topic: '',
        summary: {
          present: summary.present,
          late: summary.late,
          absent: summary.absent,
          leave: summary.leave,
        },
        attendance: rows.map(r => ({
          studentId: r.studentId,
          status: r.status,
          note: r.note,
        })),
        updatedAt: serverTimestamp(),
      };

      if (!existingSnap.empty) {
        await updateDoc(doc(db, 'class_sessions', existingSnap.docs[0].id), payload);
      } else {
        await addDoc(collection(db, 'class_sessions'), {
          ...payload,
          createdAt: serverTimestamp(),
        });
      }

      setSaved(true);
      onSaved(slot.scheduleId);
      setTimeout(onClose, 1200);
    } catch (err) {
      console.error('save attendance:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    // Backdrop
    <motion.div
      key="backdrop"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: 'rgba(15,23,42,0.4)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Sheet */}
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 340, damping: 34 }}
        className="w-full max-w-lg rounded-t-3xl flex flex-col"
        style={{
          background: 'rgba(248,250,252,0.97)',
          backdropFilter: 'blur(32px)',
          maxHeight: '88dvh',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-slate-300" />
        </div>

        {/* Header */}
        <div className="flex items-start justify-between px-5 pb-3 shrink-0">
          <div>
            <p className="text-[15px] font-black text-slate-800 leading-tight">เช็กชื่อ {slot.subjectName}</p>
            <p className="text-[12px] text-slate-400 mt-0.5">
              {slot.className} · คาบที่ {slot.period} · {periodTimes[slot.period]}
            </p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center bg-slate-100 text-slate-500 hover:bg-slate-200">
            <X size={14} />
          </button>
        </div>

        {/* Summary Pills */}
        {rows.length > 0 && (
          <div className="flex gap-2 px-5 pb-3 shrink-0 flex-wrap">
            {(Object.entries(summary) as [string, number][]).map(([key, count]) => {
              const cfg = STATUS_CONFIG[key as AttendanceStatus];
              return (
                <div key={key} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold"
                  style={{ background: cfg.bg, color: cfg.color }}>
                  {cfg.emoji} {cfg.label}: {count}
                </div>
              );
            })}
          </div>
        )}

        {/* Student List */}
        <div className="flex-1 overflow-y-auto px-4 pb-3 min-h-0">
          {loading ? (
            <div className="flex items-center justify-center py-12 gap-2 text-slate-400">
              <Loader2 size={18} className="animate-spin" />
              <span className="text-sm">กำลังโหลดรายชื่อ...</span>
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <Users size={36} className="mb-2 opacity-30" />
              <p className="text-sm">ไม่พบรายชื่อนักเรียนในห้องนี้</p>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {rows.map((row, i) => {
                const cfg = STATUS_CONFIG[row.status];
                return (
                  <motion.button
                    key={row.studentId}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.018 }}
                    onClick={() => cycleStatus(row.studentId)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-left transition-all active:scale-[0.98]"
                    style={{
                      background: row.status === 'present' ? 'rgba(255,255,255,0.9)' : cfg.bg,
                      border: `1px solid ${row.status === 'present' ? 'rgba(226,232,240,0.8)' : cfg.border}`,
                    }}
                  >
                    {/* Number */}
                    <span className="text-[10px] font-bold text-slate-300 w-5 text-center shrink-0">{i + 1}</span>

                    {/* Avatar */}
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 overflow-hidden border border-white bg-slate-100">
                      {row.photoURL ? (
                        <img src={row.photoURL} alt={row.studentName} className="w-full h-full object-cover" />
                      ) : (
                        <img 
                          src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${row.studentId}&backgroundColor=f8fafc`} 
                          alt={row.studentName} 
                          className="w-full h-full object-cover opacity-80" 
                        />
                      )}
                    </div>

                    {/* Name */}
                    <div className="flex flex-col flex-1 min-w-0">
                      <span className="text-[12px] font-bold text-slate-800 truncate">{row.studentName}</span>
                      <span className="text-[9px] text-slate-400">{row.studentCode}</span>
                    </div>

                    {/* Leave badge */}
                    {row.hasApprovedLeave && row.status === 'leave' && (
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-600 shrink-0">
                        ใบลา ✓
                      </span>
                    )}

                    {/* Status */}
                    <span className="text-[11px] font-bold shrink-0" style={{ color: cfg.color }}>
                      {cfg.label}
                    </span>
                  </motion.button>
                );
              })}
            </div>
          )}
        </div>

        {/* Save Button */}
        <div className="px-4 pt-2 pb-6 shrink-0">
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={handleSave}
            disabled={saving || rows.length === 0}
            className="w-full h-13 rounded-2xl flex items-center justify-center gap-2 text-[14px] font-black text-white"
            style={{
              background: saved
                ? 'linear-gradient(135deg, #059669, #10b981)'
                : 'linear-gradient(135deg, #3b82f6, #6366f1)',
              boxShadow: saved
                ? '0 8px 24px rgba(5,150,105,0.35)'
                : '0 8px 24px rgba(59,130,246,0.35)',
              height: 52,
              transition: 'background 0.4s, box-shadow 0.4s',
              opacity: rows.length === 0 ? 0.5 : 1,
            }}
          >
            {saving ? (
              <Loader2 size={16} className="animate-spin" />
            ) : saved ? (
              <><CheckCircle2 size={16} /> บันทึกแล้ว!</>
            ) : (
              <><Save size={15} /> บันทึกการเช็กชื่อ ({rows.length} คน)</>
            )}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Main Widget ────────────────────────────────────────────────────────────────

export default function ClassAttendanceWidget() {
  const { user } = useAuth();
  const { activeYear, activeSemester } = useActiveAcademicYear();

  const [now, setNow] = useState(new Date());
  const [openSheet, setOpenSheet] = useState<ScheduleSlot | null>(null);
  const [doneSessions, setDoneSessions] = useState<Set<string>>(new Set());

  const { periodTimes, lunchPeriods } = useScheduleSettings();

  // อัพเดทเวลาทุก 30 วินาที เพื่อ refresh active period
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const activePeriod = useMemo(() => getActivePeriod(periodTimes, lunchPeriods), [now, periodTimes, lunchPeriods]);
  const today = todayDateString();

  const { slots, loading } = useTodaySchedule(
    user?.uid ?? null,
    activeYear?.year ?? null,
    activeSemester as 1 | 2 | null,
  );

  const dayTH = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
  const todayLabel = dayTH[new Date().getDay()];
  const timeLabel = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });

  const handleSaved = useCallback((scheduleId: string) => {
    setDoneSessions(prev => new Set([...prev, scheduleId]));
  }, []);

  return (
    <>
      <div style={WIDGET_GLASS} className="rounded-2xl p-3 flex flex-col gap-2 w-full">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <span className="font-bold text-sm text-slate-700">เช็กชื่อนักเรียน</span>
            <p className="text-[10px] text-slate-400">วัน{todayLabel}</p>
          </div>

          <div className="flex items-center gap-1 text-[11px] font-bold text-slate-400">
            <Clock size={11} />
            {timeLabel}
            {activePeriod && (
              <span className="ml-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-700">
                คาบ {activePeriod}
              </span>
            )}
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-6 gap-2 text-slate-400">
            <Loader2 size={16} className="animate-spin" />
            <span className="text-xs">กำลังโหลดตารางสอน...</span>
          </div>
        ) : slots.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-slate-400">
            <BookOpen size={32} className="mb-2 opacity-25" />
            <p className="text-xs">ไม่มีคาบสอนวันนี้</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {slots.map(slot => {
              const isActive = slot.period === activePeriod;
              const isDone = doneSessions.has(slot.scheduleId);
              return (
                <SessionCard
                  key={slot.scheduleId}
                  slot={slot}
                  isActive={isActive}
                  isDone={isDone}
                  onPress={() => setOpenSheet(slot)}
                  periodTimes={periodTimes}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Bottom Sheet Portal */}
      <AnimatePresence>
        {openSheet && activeSemester && activeYear && (
          <AttendanceSheet
            key={openSheet.scheduleId}
            slot={openSheet}
            date={today}
            teacherId={user?.uid ?? ''}
            academicYearId={activeYear.year}
            semester={activeSemester as 1 | 2}
            onClose={() => setOpenSheet(null)}
            onSaved={handleSaved}
            periodTimes={periodTimes}
          />
        )}
      </AnimatePresence>
    </>
  );
}
