// src/features/grades/components/GradeTable.tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { HiCalendarDays, HiChevronDown } from 'react-icons/hi2';
import { db } from '@/lib/firebase';
import StudentAvatar from '@/features/students/components/StudentAvatar';
import type { StudentScoreSummary, GradeWeightConfig } from '@/types/grades';
import { gradeLetterToGpa, formatGpa, gpaStyle, isPassingGpa } from '@/types/grades';
import type { AttendanceStatus } from '@/types/teaching';
import {
  buildStudentSubjectAttendanceHistory,
  summarizeStudentSubjectAttendance,
} from '@/features/grades/utils/studentSubjectAttendanceHistory';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { formatThaiDateRangeFromIso, getLocalDateString } from '@/lib/dateUtils';
import { cn } from '@/lib/utils';

interface Props {
  summaries: StudentScoreSummary[];
  config: GradeWeightConfig;
  editable?: boolean;
  showAsPercentage?: boolean;
  /** 'scores' (default) แสดงตารางคะแนน, 'attendance' แสดงสถิติการเข้าเรียนแทน */
  view?: 'scores' | 'attendance';
  yearStartDate?: string;
  yearEndDate?: string;
  onUpdateScore?: (
    studentId: string,
    field: 'classworkScore' | 'midtermScore' | 'finalScore' | 'note' | 'absent',
    value: number | string | boolean | null,
  ) => void;
}

type ClassSessionDoc = {
  id: string;
  date?: string;
  period?: number;
  attendance?: Array<{ studentId: string; status: AttendanceStatus; note?: string }>;
};

type ScheduleSlot = { day: number; period: number };

type AttendanceBreakdown = {
  pct: number | null;
  total: number;
  present: number;
  late: number;
  absent: number;
  leave: number;
};

type AttendanceDatePreset = 'semester' | 'month' | 'custom';

const ATTENDANCE_TABLE_COLUMNS = '2rem minmax(0, 2fr) repeat(4, minmax(0, 1fr)) minmax(0, 1fr) minmax(3.5rem, 0.9fr)';

function monthRange(today = new Date()): { from: string; to: string } {
  const from = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
  return { from, to: getLocalDateString(today) };
}

function clampRange(from: string, to: string, min?: string, max?: string): { from: string; to: string } {
  let nextFrom = from;
  let nextTo = to;
  if (min && nextFrom && nextFrom < min) nextFrom = min;
  if (max && nextTo && nextTo > max) nextTo = max;
  if (nextFrom && nextTo && nextFrom > nextTo) {
    return { from: nextTo, to: nextFrom };
  }
  return { from: nextFrom, to: nextTo };
}

function ScoreCell({
  value, editable, onChange, showAsPercentage, weightPercent,
}: {
  value: number | null;
  editable?: boolean;
  onChange?: (v: number | null) => void;
  showAsPercentage?: boolean;
  /** สัดส่วนหมวด (เช่น 80) — แสดงคะแนนถ่วงน้ำหนักสูงสุดตามสัดส่วนนี้ */
  weightPercent?: number;
}) {
  const categoryPct = value !== null ? Math.min(100, Math.max(0, value)) : null;
  const weightedPct = categoryPct !== null && weightPercent !== undefined
    ? Math.round((categoryPct * weightPercent) / 100)
    : null;

  const displayValue = showAsPercentage && weightPercent !== undefined && weightedPct !== null
    ? `${weightedPct}%`
    : showAsPercentage && categoryPct !== null
      ? `${Math.round(categoryPct)}%`
      : value !== null
        ? `${value}`
        : null;

  const tooltip = showAsPercentage && weightPercent !== undefined && categoryPct !== null
    ? `คะแนนในหมวด ${Math.round(categoryPct)}% → นับได้ ${weightedPct}% จาก ${weightPercent}%`
    : undefined;

  if (!editable) {
    return (
      <span
        className="text-[12px] font-bold text-slate-700 font-sukhumvit"
        title={tooltip}
      >
        {displayValue !== null ? displayValue : <span className="text-slate-300">—</span>}
      </span>
    );
  }

  return (
    <div className="flex flex-col items-end" title={tooltip}>
      <div className="flex items-center gap-0.5">
        <input
          type="number" min={0} max={100}
          value={value ?? ''}
          onChange={e => onChange?.(e.target.value === '' ? null : Number(e.target.value))}
          placeholder="—"
          className="w-14 h-7 rounded-xl text-center text-xs font-bold outline-none border font-sukhumvit transition-all focus:ring-2 focus:ring-indigo-400"
          style={{ background: 'rgba(255,255,255,0.8)', borderColor: 'rgba(200,180,255,0.4)' }}
        />
        <span className="text-[9px] text-slate-400 font-sarabun">%</span>
      </div>
      {showAsPercentage && weightPercent !== undefined && weightedPct !== null && (
        <span className="text-[8px] font-bold text-indigo-500 font-sarabun mt-0.5">
          นับได้ {weightedPct}/{weightPercent}%
        </span>
      )}
    </div>
  );
}

export default function GradeTable({
  summaries,
  config,
  editable = false,
  onUpdateScore,
  showAsPercentage = false,
  view = 'scores',
  yearStartDate = '',
  yearEndDate = '',
}: Props) {
  const showClasswork = config.weights.classwork > 0;

  // ── Attendance view ──────────────────────────────────────────────────────
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceError, setAttendanceError] = useState<string | null>(null);
  const [attendanceRaw, setAttendanceRaw] = useState<{
    sessions: ClassSessionDoc[];
    scheduleSlots: ScheduleSlot[];
  } | null>(null);
  const loadedAttendanceKeyRef = useRef('');
  const [dateFilterOpen, setDateFilterOpen] = useState(false);
  const [datePreset, setDatePreset] = useState<AttendanceDatePreset>('semester');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  useEffect(() => {
    if (view !== 'attendance') return;
    if (!config.classId || !config.subjectId || !config.academicYearId) return;

    const key = `${config.classId}|${config.subjectId}|${config.academicYearId}|${config.semester}`;
    if (loadedAttendanceKeyRef.current === key) return;

    let cancelled = false;
    setAttendanceLoading(true);
    setAttendanceError(null);

    (async () => {
      try {
        const [sessionsSnap, schedulesSnap] = await Promise.all([
          getDocs(query(
            collection(db, 'class_sessions'),
            where('classId', '==', config.classId),
            where('academicYearId', '==', config.academicYearId),
            where('subjectId', '==', config.subjectId),
            where('semester', '==', config.semester),
          )),
          getDocs(query(
            collection(db, 'schedules'),
            where('year', '==', config.academicYearId),
            where('semester', '==', config.semester),
            where('classId', '==', config.classId),
            where('subjectId', '==', config.subjectId),
          )),
        ]);
        if (cancelled) return;

        const sessions = sessionsSnap.docs.map(d => ({ id: d.id, ...d.data() }) as ClassSessionDoc);
        const scheduleSlots = schedulesSnap.docs.map((d) => {
          const data = d.data() as { day?: number; dayOfWeek?: number; period?: number };
          return { day: data.day ?? data.dayOfWeek ?? 0, period: data.period ?? 0 };
        });

        setAttendanceRaw({ sessions, scheduleSlots });
        loadedAttendanceKeyRef.current = key;
      } catch (err) {
        if (cancelled) return;
        console.error('[GradeTable attendance]', err);
        setAttendanceError('โหลดข้อมูลการเข้าเรียนไม่สำเร็จ');
      } finally {
        if (!cancelled) setAttendanceLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [view, config.classId, config.subjectId, config.academicYearId, config.semester]);

  const attendanceDateRange = useMemo(() => {
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

  const attendanceDateLabel = useMemo(() => {
    if (datePreset === 'semester') return 'ทั้งภาคเรียน';
    if (datePreset === 'month') return 'เดือนนี้';
    if (attendanceDateRange.from && attendanceDateRange.to) {
      return formatThaiDateRangeFromIso(attendanceDateRange.from, attendanceDateRange.to);
    }
    return 'เลือกช่วงวันที่';
  }, [datePreset, attendanceDateRange.from, attendanceDateRange.to]);

  const attendanceByStudent = useMemo(() => {
    const map = new Map<string, AttendanceBreakdown>();
    if (!attendanceRaw) return map;

    summaries.forEach((s) => {
      const rows = buildStudentSubjectAttendanceHistory({
        studentId: s.studentId,
        sessions: attendanceRaw.sessions,
        scheduleSlots: attendanceRaw.scheduleSlots,
        rangeStart: attendanceDateRange.from,
        rangeEnd: attendanceDateRange.to,
        academicYearId: config.academicYearId,
      });
      const summary = summarizeStudentSubjectAttendance(rows);
      map.set(s.studentId, {
        pct: summary.pct,
        total: summary.total,
        present: summary.counts.present ?? 0,
        late: summary.counts.late ?? 0,
        absent: summary.counts.absent ?? 0,
        leave: (summary.counts.excused ?? 0) + (summary.counts.leave ?? 0),
      });
    });

    return map;
  }, [attendanceRaw, summaries, attendanceDateRange.from, attendanceDateRange.to, config.academicYearId]);

  const attendanceStatItems = useMemo(() => {
    const rows = summaries
      .map(s => attendanceByStudent.get(s.studentId))
      .filter((r): r is AttendanceBreakdown => !!r && r.total > 0);
    const avgPct = rows.length > 0
      ? Math.round(rows.reduce((acc, r) => acc + (r.pct ?? 0), 0) / rows.length)
      : null;
    const lowAttendance = rows.filter(r => (r.pct ?? 100) < 80).length;

    return [
      { label: 'นักเรียนทั้งหมด', value: summaries.length, color: '#0f172a' },
      { label: 'มีข้อมูล', value: rows.length, color: '#2563eb' },
      { label: 'เข้าเรียนเฉลี่ย', value: avgPct !== null ? `${avgPct}%` : '—', color: '#059669' },
      { label: 'เข้าเรียนต่ำ (<80%)', value: lowAttendance, color: '#dc2626' },
    ];
  }, [summaries, attendanceByStudent]);

  // Stats summary
  const graded = summaries.filter(s => s.grade !== null).length;
  const passed = summaries.filter(s => {
    if (s.grade === null) return false;
    return isPassingGpa(gradeLetterToGpa(s.grade));
  }).length;
  const gpaSum = summaries.reduce((acc, s) => {
    if (s.grade === null) return acc;
    return acc + gradeLetterToGpa(s.grade);
  }, 0);
  const avgGpa = graded > 0 ? Math.round((gpaSum / graded) * 100) / 100 : null;
  const avgScore = graded > 0
    ? Math.round(summaries.reduce((a, s) => a + (s.totalScore ?? 0), 0) / graded * 10) / 10
    : null;

  const statItems = [
    { label: 'นักเรียนทั้งหมด', value: summaries.length, color: '#0f172a' },
    { label: 'ให้คะแนนแล้ว', value: graded, color: '#2563eb' },
    { label: 'ผ่าน', value: passed, color: '#059669' },
    { label: 'ไม่ผ่าน', value: graded - passed, color: '#dc2626' },
    ...(avgScore !== null ? [{ label: 'เฉลี่ย', value: `${avgScore}%`, color: '#7c3aed' }] : []),
    ...(avgGpa !== null ? [{ label: 'GPA เฉลี่ย', value: formatGpa(avgGpa), color: '#0891b2' }] : []),
  ];

  const tableGridColumns = showClasswork
    ? '2rem minmax(0, 2fr) repeat(3, minmax(0, 1fr)) minmax(0, 1fr) minmax(3.5rem, 0.75fr)'
    : '2rem minmax(0, 2fr) repeat(2, minmax(0, 1fr)) minmax(0, 1fr) minmax(3.5rem, 0.75fr)';

  const displayedStatItems = view === 'scores' ? statItems : attendanceStatItems;

  return (
    <div className="flex flex-col gap-3">
      {view === 'attendance' && (
        <div className="flex items-center justify-between gap-2 px-1">
          <p className="text-[11px] font-bold text-slate-400 font-sarabun">สถิติการเข้าเรียน</p>
          <Popover open={dateFilterOpen} onOpenChange={setDateFilterOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="inline-flex h-8 max-w-full items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                <HiCalendarDays className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                <span className="truncate">{attendanceDateLabel}</span>
                <HiChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
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
                      if (opt.key !== 'custom') setDateFilterOpen(false);
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

              {attendanceDateRange.from && attendanceDateRange.to && (
                <p className="text-[10px] font-semibold text-slate-400 font-sarabun">
                  {formatThaiDateRangeFromIso(attendanceDateRange.from, attendanceDateRange.to)}
                </p>
              )}
            </PopoverContent>
          </Popover>
        </div>
      )}

      {/* Summary bar */}
      <div className="p-3 overflow-x-auto scrollbar-hide">
        <div
          className="grid gap-2 w-full min-w-[520px] md:min-w-0"
          style={{ gridTemplateColumns: `repeat(${displayedStatItems.length}, minmax(0, 1fr))` }}
        >
          {displayedStatItems.map(item => (
            <div
              key={item.label}
              className="flex flex-col items-center justify-center px-2 py-2 rounded-lg min-w-0 w-full shadow-sm"
              style={{ background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.9)' }}
            >
              <span className="text-[15px] font-black font-sukhumvit tabular-nums" style={{ color: item.color }}>{item.value}</span>
              <span className="text-[9px] text-slate-400 font-sarabun text-center leading-tight">{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {view === 'attendance' && attendanceError && (
        <div className="flex items-center gap-2 text-rose-500 bg-rose-50 px-4 py-3 rounded-2xl border border-rose-200">
          <p className="text-[12px] font-sarabun">{attendanceError}</p>
        </div>
      )}

      {view === 'attendance' && attendanceLoading && (
        <div className="flex items-center justify-center h-24">
          <div className="w-6 h-6 border-3 border-violet-200 border-t-violet-500 rounded-full animate-spin" />
        </div>
      )}

      {/* Mobile: card list */}
      <div className="md:hidden flex flex-col gap-2.5 px-0.5">
        {summaries.map((s, i) => {
          const gpa = s.grade !== null ? gradeLetterToGpa(s.grade) : null;
          const gc = gpa !== null ? gpaStyle(gpa) : null;
          const scoreMetrics = [
            ...(showClasswork
              ? [{
                key: 'classwork',
                label: `เก็บ (${config.weights.classwork}%)`,
                color: '#7c3aed',
                value: s.classworkScore,
                field: 'classworkScore' as const,
                weight: config.weights.classwork,
              }]
              : []),
            {
              key: 'midterm',
              label: `กลางภาค (${config.weights.midterm}%)`,
              color: '#0891b2',
              value: s.midtermScore,
              field: 'midtermScore' as const,
              weight: config.weights.midterm,
            },
            {
              key: 'final',
              label: `ปลายภาค (${config.weights.final}%)`,
              color: '#059669',
              value: s.finalScore,
              field: 'finalScore' as const,
              weight: config.weights.final,
            },
          ];

          return (
            <motion.div
              key={s.studentId}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.02 }}
              whileTap={{ scale: 0.99 }}
              className="px-0.5 py-0.5"
            >
              <div
                className={cn(
                  'rounded-2xl bg-white/90 p-3 shadow-sm border border-white/90',
                  s.absent && 'bg-rose-50/40',
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 flex-1 items-start gap-2.5">
                    <div className="relative shrink-0">
                      <StudentAvatar
                        photoURL={s.photoURL}
                        studentId={s.studentId}
                        name={s.studentName}
                        gender={s.gender}
                        className="h-10 w-10 rounded-xl"
                      />
                      <span className="absolute -bottom-1 -left-1 flex h-4 min-w-4 items-center justify-center rounded-md bg-slate-900 px-1 text-[9px] font-black text-white font-sukhumvit tabular-nums shadow-sm">
                        {i + 1}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-bold text-slate-800 font-sukhumvit truncate" title={s.studentName}>
                        {s.studentName}
                      </p>
                      <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                        <p className="text-[11px] text-blue-600 font-sarabun tabular-nums">{s.studentCode}</p>
                        {s.absent && (
                          <span className="text-[8px] font-bold text-rose-500 bg-rose-50 px-1.5 py-0.5 rounded-full font-sukhumvit">
                            ขาดสอบ
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="shrink-0 text-center">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-wide font-sukhumvit mb-0.5">
                      GPA
                    </p>
                    {gpa !== null && gc ? (
                      <span
                        className="inline-flex items-center justify-center min-w-8 px-2 py-0.5 rounded-lg text-[12px] font-black font-sukhumvit tabular-nums"
                        style={{ color: gc.text, background: gc.bg }}
                      >
                        {formatGpa(gpa)}
                      </span>
                    ) : (
                      <span className="text-[12px] text-slate-300 font-bold">—</span>
                    )}
                  </div>
                </div>

                {editable && onUpdateScore && (
                  <div className="mt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => onUpdateScore(s.studentId, 'absent', !s.absent)}
                      className="text-[8px] font-bold px-2 py-1 rounded-lg font-sukhumvit transition-all"
                      style={{
                        background: s.absent ? '#e11d48' : 'rgba(241,245,249,0.8)',
                        color: s.absent ? '#fff' : '#94a3b8',
                      }}
                    >
                      {s.absent ? 'ยกเลิกขาดสอบ' : 'ขาดสอบ'}
                    </button>
                  </div>
                )}

                {view === 'scores' ? (
                  <>
                    <div
                      className={cn(
                        'mt-2.5 pt-2.5 border-t border-slate-100 grid gap-2',
                        scoreMetrics.length >= 3 ? 'grid-cols-3' : 'grid-cols-2',
                      )}
                    >
                      {scoreMetrics.map((metric) => (
                        <div key={metric.key} className="text-center min-w-0">
                          <p
                            className="text-[9px] font-black uppercase tracking-wide font-sukhumvit mb-0.5 truncate"
                            style={{ color: metric.color }}
                          >
                            {metric.label}
                          </p>
                          <div className="flex justify-center">
                            <ScoreCell
                              value={metric.value}
                              editable={editable && !s.absent}
                              showAsPercentage={showAsPercentage}
                              weightPercent={showAsPercentage ? metric.weight : undefined}
                              onChange={(v) => onUpdateScore?.(s.studentId, metric.field, v)}
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-wide font-sukhumvit">
                        รวม (%)
                      </p>
                      {s.totalScore !== null ? (
                        <span className="text-[14px] font-black font-sukhumvit tabular-nums" style={{ color: gc?.text ?? '#0f172a' }}>
                          {Math.round(s.totalScore)}%
                        </span>
                      ) : (
                        <span className="text-[12px] text-slate-300 font-bold">—</span>
                      )}
                    </div>
                  </>
                ) : (() => {
                  const att = attendanceByStudent.get(s.studentId) ?? null;
                  return (
                    <>
                      <div className="mt-2.5 pt-2.5 border-t border-slate-100 grid grid-cols-4 gap-2">
                        {([
                          { key: 'present', label: 'มา', color: '#059669', value: att?.present ?? 0 },
                          { key: 'late', label: 'สาย', color: '#d97706', value: att?.late ?? 0 },
                          { key: 'absent', label: 'ขาด', color: '#e11d48', value: att?.absent ?? 0 },
                          { key: 'leave', label: 'ลา', color: '#7c3aed', value: att?.leave ?? 0 },
                        ] as const).map((m) => (
                          <div key={m.key} className="text-center min-w-0">
                            <p className="text-[9px] font-black uppercase tracking-wide font-sukhumvit mb-0.5" style={{ color: m.color }}>
                              {m.label}
                            </p>
                            <p className="text-[13px] font-black font-sukhumvit tabular-nums" style={{ color: m.color }}>
                              {m.value}
                            </p>
                          </div>
                        ))}
                      </div>

                      <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-wide font-sukhumvit">
                          คาบทั้งหมด {att ? `(${att.total})` : ''}
                        </p>
                        {att && att.pct !== null ? (
                          <span className="text-[14px] font-black font-sukhumvit tabular-nums" style={{ color: gpaStyle((att.pct / 100) * 4).text }}>
                            {att.pct}%
                          </span>
                        ) : (
                          <span className="text-[12px] text-slate-300 font-bold">—</span>
                        )}
                      </div>
                    </>
                  );
                })()}
              </div>
            </motion.div>
          );
        })}

        {summaries.length === 0 && (
          <div className="py-12 text-center text-slate-400">
            <p className="text-[13px] font-sarabun">ยังไม่มีข้อมูลนักเรียน</p>
          </div>
        )}
      </div>

      {/* Desktop: table */}
      <div className="hidden md:block rounded-[1.5rem] overflow-hidden"
        style={{ background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.9)' }}>
        {/* Header */}
        <div className="grid gap-2 px-4 py-2.5 w-full"
          style={{
            gridTemplateColumns: view === 'scores' ? tableGridColumns : ATTENDANCE_TABLE_COLUMNS,
            background: 'rgba(248,250,252,0.8)',
          }}>
          <span className="text-[9px] font-black text-slate-400 uppercase font-sukhumvit">#</span>
          <span className="text-[9px] font-black text-slate-400 uppercase font-sukhumvit">นักเรียน</span>
          {view === 'scores' ? (
            <>
              {showClasswork && (
                <span className="text-[9px] font-black uppercase font-sukhumvit text-right" style={{ color: '#7c3aed' }}>
                  เก็บ ({config.weights.classwork}%)
                </span>
              )}
              <span className="text-[9px] font-black uppercase font-sukhumvit text-right" style={{ color: '#0891b2' }}>
                กลางภาค ({config.weights.midterm}%)
              </span>
              <span className="text-[9px] font-black uppercase font-sukhumvit text-right" style={{ color: '#059669' }}>
                ปลายภาค ({config.weights.final}%)
              </span>
              <span className="text-[9px] font-black text-slate-500 uppercase font-sukhumvit text-right">รวม (%)</span>
              <span className="text-[9px] font-black text-slate-500 uppercase font-sukhumvit text-center">GPA</span>
            </>
          ) : (
            <>
              <span className="text-[9px] font-black uppercase font-sukhumvit text-right" style={{ color: '#059669' }}>มา</span>
              <span className="text-[9px] font-black uppercase font-sukhumvit text-right" style={{ color: '#d97706' }}>สาย</span>
              <span className="text-[9px] font-black uppercase font-sukhumvit text-right" style={{ color: '#e11d48' }}>ขาด</span>
              <span className="text-[9px] font-black uppercase font-sukhumvit text-right" style={{ color: '#7c3aed' }}>ลา</span>
              <span className="text-[9px] font-black text-slate-500 uppercase font-sukhumvit text-right">คาบทั้งหมด</span>
              <span className="text-[9px] font-black text-slate-500 uppercase font-sukhumvit text-center">เข้าเรียน %</span>
            </>
          )}
        </div>

        {/* Rows */}
        <div className="flex flex-col divide-y divide-slate-100/50">
          {summaries.map((s, i) => {
            const gpa = s.grade !== null ? gradeLetterToGpa(s.grade) : null;
            const gc = gpa !== null ? gpaStyle(gpa) : null;
            const att = attendanceByStudent.get(s.studentId) ?? null;
            return (
              <motion.div
                key={s.studentId}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                transition={{ delay: i * 0.015 }}
                className="grid gap-2 px-4 py-2.5 items-center hover:bg-slate-50/40 transition-colors w-full"
                style={{
                  gridTemplateColumns: view === 'scores' ? tableGridColumns : ATTENDANCE_TABLE_COLUMNS,
                  background: s.absent ? 'rgba(255,228,230,0.3)' : undefined,
                }}
              >
                <span className="text-[10px] font-bold text-slate-400 font-sukhumvit">{i + 1}</span>

                {/* Student */}
                <div className="flex items-center gap-2 min-w-0">
                  <StudentAvatar
                    photoURL={s.photoURL}
                    studentId={s.studentId}
                    name={s.studentName}
                    gender={s.gender}
                    className="w-7 h-7 rounded-xl shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold text-slate-800 font-sukhumvit truncate">{s.studentName}</p>
                    <div className="flex items-center gap-2">
                      <p className="text-[9px] text-slate-400 font-sarabun">{s.studentCode}</p>
                      {s.absent && (
                        <span className="text-[8px] font-bold text-rose-500 bg-rose-50 px-1.5 py-0.5 rounded-full font-sukhumvit">ขาดสอบ</span>
                      )}
                    </div>
                  </div>
                  {editable && onUpdateScore && (
                    <button
                      onClick={() => onUpdateScore(s.studentId, 'absent', !s.absent)}
                      className="ml-auto shrink-0 text-[8px] font-bold px-1.5 py-0.5 rounded-lg font-sukhumvit transition-all"
                      style={{
                        background: s.absent ? '#e11d48' : 'rgba(241,245,249,0.8)',
                        color: s.absent ? '#fff' : '#94a3b8',
                      }}
                    >ขาด</button>
                  )}
                </div>

                {view === 'attendance' ? (
                  <>
                    <div className="text-right text-[12px] font-black font-sukhumvit tabular-nums" style={{ color: '#059669' }}>
                      {att?.present ?? 0}
                    </div>
                    <div className="text-right text-[12px] font-black font-sukhumvit tabular-nums" style={{ color: '#d97706' }}>
                      {att?.late ?? 0}
                    </div>
                    <div className="text-right text-[12px] font-black font-sukhumvit tabular-nums" style={{ color: '#e11d48' }}>
                      {att?.absent ?? 0}
                    </div>
                    <div className="text-right text-[12px] font-black font-sukhumvit tabular-nums" style={{ color: '#7c3aed' }}>
                      {att?.leave ?? 0}
                    </div>
                    <div className="text-right text-[12px] font-bold text-slate-600 font-sukhumvit tabular-nums">
                      {att?.total ?? 0}
                    </div>
                    <div className="flex justify-center">
                      {att && att.pct !== null ? (
                        <span
                          className="text-[11px] font-black px-2.5 py-1 rounded-xl font-sukhumvit tabular-nums"
                          style={{ color: gpaStyle((att.pct / 100) * 4).text, background: gpaStyle((att.pct / 100) * 4).bg }}
                        >
                          {att.pct}%
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-300 font-sarabun">—</span>
                      )}
                    </div>
                  </>
                ) : (
                <>
                {/* Classwork */}
                {showClasswork && (
                  <div className="flex justify-end">
                    <ScoreCell
                      value={s.classworkScore}
                      editable={editable && !s.absent}
                      showAsPercentage={showAsPercentage}
                      weightPercent={showAsPercentage ? config.weights.classwork : undefined}
                      onChange={v => onUpdateScore?.(s.studentId, 'classworkScore', v)}
                    />
                  </div>
                )}

                {/* Midterm */}
                <div className="flex justify-end">
                  <ScoreCell
                    value={s.midtermScore}
                    editable={editable && !s.absent}
                    showAsPercentage={showAsPercentage}
                    weightPercent={showAsPercentage ? config.weights.midterm : undefined}
                    onChange={v => onUpdateScore?.(s.studentId, 'midtermScore', v)}
                  />
                </div>

                {/* Final */}
                <div className="flex justify-end">
                  <ScoreCell
                    value={s.finalScore}
                    editable={editable && !s.absent}
                    showAsPercentage={showAsPercentage}
                    weightPercent={showAsPercentage ? config.weights.final : undefined}
                    onChange={v => onUpdateScore?.(s.studentId, 'finalScore', v)}
                  />
                </div>

                {/* Total — weighted sum 0–100% */}
                <div className="text-right">
                  {s.totalScore !== null ? (
                    <span className="text-[13px] font-black font-sukhumvit" style={{ color: gc?.text ?? '#0f172a' }}>
                      {Math.round(s.totalScore)}%
                    </span>
                  ) : (
                    <span className="text-[12px] text-slate-300 font-sarabun">—</span>
                  )}
                </div>

                {/* GPA (0–4) */}
                <div className="flex justify-center">
                  {gpa !== null && gc ? (
                    <span className="text-[11px] font-black px-2.5 py-1 rounded-xl font-sukhumvit tabular-nums"
                      style={{ color: gc.text, background: gc.bg }}>
                      {formatGpa(gpa)}
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-300 font-sarabun">—</span>
                  )}
                </div>
                </>
                )}
              </motion.div>
            );
          })}

          {summaries.length === 0 && (
            <div className="py-12 text-center text-slate-400">
              <p className="text-[13px] font-sarabun">ยังไม่มีข้อมูลนักเรียน</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
