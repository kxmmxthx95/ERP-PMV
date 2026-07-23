// src/features/grades/components/GradeTable.tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import StudentAvatar from '@/features/students/components/StudentAvatar';
import type { StudentScoreSummary, GradeWeightConfig } from '@/types/grades';
import { gradeLetterToGpa, formatGpa, gpaStyle, percentScoreStyle } from '@/types/grades';
import type { AttendanceStatus } from '@/types/teaching';
import {
  buildStudentSubjectAttendanceHistory,
  summarizeStudentSubjectAttendance,
} from '@/features/grades/utils/studentSubjectAttendanceHistory';
import type { AttendanceDateRange } from '@/features/grades/components/AttendanceDateRangeFilter';
import { cn } from '@/lib/utils';

interface Props {
  summaries: StudentScoreSummary[];
  config: GradeWeightConfig;
  editable?: boolean;
  showAsPercentage?: boolean;
  /** 'scores' (default) แสดงตารางคะแนน, 'attendance' แสดงสถิติการเข้าเรียนแทน */
  view?: 'scores' | 'attendance';
  /** Required when view === 'attendance' */
  attendanceDateRange?: AttendanceDateRange;
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

const ATTENDANCE_TABLE_COLUMNS =
  'minmax(4.5rem, 0.7fr) minmax(0, 2.2fr) repeat(4, minmax(0, 1fr)) minmax(0, 1fr) minmax(5rem, 0.85fr)';

const TABLE_SHELL = 'rounded-2xl border border-border bg-card overflow-hidden';
const TABLE_HEADER_CELL = 'text-[13px] font-black text-foreground font-sukhumvit whitespace-nowrap';

function GradePill({ gpa, absent }: { gpa: number | null; absent?: boolean }) {
  if (absent) {
    return (
      <span className="inline-flex rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-bold text-destructive font-sukhumvit">
        ขาดสอบ
      </span>
    );
  }
  if (gpa === null) {
    return (
      <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-700 font-sukhumvit">
        รอคะแนน
      </span>
    );
  }
  const gc = gpaStyle(gpa);
  return (
    <span
      className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold tabular-nums font-sukhumvit"
      style={{ color: gc.text, background: gc.bg }}
    >
      {formatGpa(gpa)}
    </span>
  );
}

function isLowGpa(gpa: number | null): boolean {
  return gpa !== null && gpa < 2;
}

const LOW_GPA_ROW = 'bg-destructive/5';

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
    const scoreColor = categoryPct !== null ? percentScoreStyle(categoryPct).text : undefined;
    return (
      <span
        className="text-[13px] font-semibold tabular-nums font-sukhumvit"
        style={scoreColor ? { color: scoreColor } : undefined}
        title={tooltip}
      >
        {displayValue !== null ? displayValue : <span className="text-muted-foreground/40">—</span>}
      </span>
    );
  }

  return (
    <div className="flex flex-col" title={tooltip}>
      <div className="flex items-center gap-0.5">
        <input
          type="number" min={0} max={100}
          value={value ?? ''}
          onChange={e => onChange?.(e.target.value === '' ? null : Number(e.target.value))}
          placeholder="—"
          className="h-8 w-14 rounded-xl border border-input bg-background px-1 text-center text-xs font-bold text-foreground outline-none transition-all focus-visible:ring-2 focus-visible:ring-ring font-sukhumvit"
        />
        <span className="text-[10px] text-muted-foreground font-sarabun">%</span>
      </div>
      {showAsPercentage && weightPercent !== undefined && weightedPct !== null && (
        <span className="mt-0.5 text-[10px] font-semibold text-muted-foreground font-sarabun">
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
  attendanceDateRange = { from: '', to: '' },
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

  const tableGridColumns = showClasswork
    ? 'minmax(4.5rem, 0.7fr) minmax(0, 2.2fr) repeat(3, minmax(0, 1fr)) minmax(0, 1fr) minmax(5rem, 0.85fr)'
    : 'minmax(4.5rem, 0.7fr) minmax(0, 2.2fr) repeat(2, minmax(0, 1fr)) minmax(0, 1fr) minmax(5rem, 0.85fr)';

  return (
    <div className="flex flex-col gap-3">
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
          const scoreMetrics = [
            ...(showClasswork
              ? [{
                key: 'classwork',
                label: `เก็บ (${config.weights.classwork}%)`,
                value: s.classworkScore,
                field: 'classworkScore' as const,
                weight: config.weights.classwork,
              }]
              : []),
            {
              key: 'midterm',
              label: `กลางภาค (${config.weights.midterm}%)`,
              value: s.midtermScore,
              field: 'midtermScore' as const,
              weight: config.weights.midterm,
            },
            {
              key: 'final',
              label: `ปลายภาค (${config.weights.final}%)`,
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
                  'rounded-2xl border border-border bg-card p-3',
                  s.absent && 'bg-destructive/5',
                  view === 'scores' && !s.absent && isLowGpa(gpa) && cn(LOW_GPA_ROW, 'border-destructive/30'),
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <StudentAvatar
                      photoURL={s.photoURL}
                      studentId={s.studentId}
                      name={s.studentName}
                      gender={s.gender}
                      className="h-9 w-9 rounded-full shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-bold text-foreground font-sukhumvit truncate" title={s.studentName}>
                        {s.studentName}
                      </p>
                      <p className="mt-0.5 text-[12px] font-semibold text-muted-foreground font-sukhumvit tabular-nums">
                        {s.studentCode || '—'}
                      </p>
                    </div>
                  </div>
                  <div className="shrink-0">
                    <GradePill gpa={gpa} absent={s.absent} />
                  </div>
                </div>

                {editable && onUpdateScore && (
                  <div className="mt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => onUpdateScore(s.studentId, 'absent', !s.absent)}
                      className={cn(
                        'text-[10px] font-bold px-2.5 py-1 rounded-full font-sukhumvit transition-all',
                        s.absent
                          ? 'bg-destructive text-destructive-foreground'
                          : 'bg-muted text-muted-foreground',
                      )}
                    >
                      {s.absent ? 'ยกเลิกขาดสอบ' : 'ขาดสอบ'}
                    </button>
                  </div>
                )}

                {view === 'scores' ? (
                  <>
                    <div
                      className={cn(
                        'mt-2.5 pt-2.5 border-t border-border grid gap-2',
                        scoreMetrics.length >= 3 ? 'grid-cols-3' : 'grid-cols-2',
                      )}
                    >
                      {scoreMetrics.map((metric) => (
                        <div key={metric.key} className="min-w-0">
                          <p className="mb-0.5 truncate text-[11px] font-bold text-muted-foreground font-sukhumvit">
                            {metric.label}
                          </p>
                          <ScoreCell
                            value={metric.value}
                            editable={editable && !s.absent}
                            showAsPercentage={showAsPercentage}
                            weightPercent={showAsPercentage ? metric.weight : undefined}
                            onChange={(v) => onUpdateScore?.(s.studentId, metric.field, v)}
                          />
                        </div>
                      ))}
                    </div>

                    <div className="mt-2.5 flex items-center justify-between border-t border-border pt-2">
                      <p className="text-[11px] font-bold text-muted-foreground font-sukhumvit">
                        รวม (%)
                      </p>
                      {s.totalScore !== null ? (
                        <span
                          className="text-[14px] font-black font-sukhumvit tabular-nums"
                          style={{ color: percentScoreStyle(s.totalScore).text }}
                        >
                          {Math.round(s.totalScore)}%
                        </span>
                      ) : (
                        <span className="text-[12px] text-muted-foreground/40 font-bold">—</span>
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
      <div className={cn('hidden md:block', TABLE_SHELL)}>
        {/* Header */}
        <div
          className="grid gap-3 border-b border-border bg-background px-4 py-3 w-full"
          style={{
            gridTemplateColumns: view === 'scores' ? tableGridColumns : ATTENDANCE_TABLE_COLUMNS,
          }}
        >
          <span className={TABLE_HEADER_CELL}>รหัส</span>
          <span className={TABLE_HEADER_CELL}>นักเรียน</span>
          {view === 'scores' ? (
            <>
              {showClasswork && (
                <span className={TABLE_HEADER_CELL}>
                  เก็บ ({config.weights.classwork}%)
                </span>
              )}
              <span className={TABLE_HEADER_CELL}>
                กลางภาค ({config.weights.midterm}%)
              </span>
              <span className={TABLE_HEADER_CELL}>
                ปลายภาค ({config.weights.final}%)
              </span>
              <span className={TABLE_HEADER_CELL}>รวม (%)</span>
              <span className={cn(TABLE_HEADER_CELL, 'text-center')}>เกรด</span>
            </>
          ) : (
            <>
              <span className={TABLE_HEADER_CELL}>มา</span>
              <span className={TABLE_HEADER_CELL}>สาย</span>
              <span className={TABLE_HEADER_CELL}>ขาด</span>
              <span className={TABLE_HEADER_CELL}>ลา</span>
              <span className={TABLE_HEADER_CELL}>คาบทั้งหมด</span>
              <span className={cn(TABLE_HEADER_CELL, 'text-center')}>เข้าเรียน %</span>
            </>
          )}
        </div>

        {/* Rows */}
        <div className="flex flex-col">
          {summaries.map((s, i) => {
            const gpa = s.grade !== null ? gradeLetterToGpa(s.grade) : null;
            const att = attendanceByStudent.get(s.studentId) ?? null;
            return (
              <motion.div
                key={s.studentId}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                transition={{ delay: i * 0.015 }}
                className={cn(
                  'grid gap-3 px-4 py-3 items-center border-b border-border last:border-b-0 hover:bg-muted/40 transition-colors w-full',
                  s.absent && 'bg-destructive/5',
                  view === 'scores' && !s.absent && isLowGpa(gpa) && LOW_GPA_ROW,
                )}
                style={{
                  gridTemplateColumns: view === 'scores' ? tableGridColumns : ATTENDANCE_TABLE_COLUMNS,
                }}
              >
                <span className="text-[13px] font-black text-foreground font-sukhumvit tabular-nums truncate">
                  {s.studentCode || '—'}
                </span>

                {/* Student */}
                <div className="flex items-center gap-3 min-w-0">
                  <StudentAvatar
                    photoURL={s.photoURL}
                    studentId={s.studentId}
                    name={s.studentName}
                    gender={s.gender}
                    className="w-9 h-9 rounded-full shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-bold text-foreground font-sukhumvit truncate">{s.studentName}</p>
                    {editable && onUpdateScore && (
                      <button
                        type="button"
                        onClick={() => onUpdateScore(s.studentId, 'absent', !s.absent)}
                        className={cn(
                          'mt-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full font-sukhumvit transition-all',
                          s.absent
                            ? 'bg-destructive text-destructive-foreground'
                            : 'bg-muted text-muted-foreground hover:bg-muted/80',
                        )}
                      >
                        {s.absent ? 'ยกเลิกขาดสอบ' : 'ขาดสอบ'}
                      </button>
                    )}
                  </div>
                </div>

                {view === 'attendance' ? (
                  <>
                    <div className="text-[13px] font-semibold text-foreground font-sukhumvit tabular-nums">
                      {att?.present ?? 0}
                    </div>
                    <div className="text-[13px] font-semibold text-foreground font-sukhumvit tabular-nums">
                      {att?.late ?? 0}
                    </div>
                    <div className="text-[13px] font-semibold text-foreground font-sukhumvit tabular-nums">
                      {att?.absent ?? 0}
                    </div>
                    <div className="text-[13px] font-semibold text-foreground font-sukhumvit tabular-nums">
                      {att?.leave ?? 0}
                    </div>
                    <div className="text-[13px] font-semibold text-muted-foreground font-sukhumvit tabular-nums">
                      {att?.total ?? 0}
                    </div>
                    <div className="flex justify-center">
                      {att && att.pct !== null ? (
                        <span
                          className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold tabular-nums font-sukhumvit"
                          style={{
                            color: gpaStyle((att.pct / 100) * 4).text,
                            background: gpaStyle((att.pct / 100) * 4).bg,
                          }}
                        >
                          {att.pct}%
                        </span>
                      ) : (
                        <span className="text-[13px] text-muted-foreground/40 font-sarabun">—</span>
                      )}
                    </div>
                  </>
                ) : (
                <>
                {/* Classwork */}
                {showClasswork && (
                  <div>
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
                <div>
                  <ScoreCell
                    value={s.midtermScore}
                    editable={editable && !s.absent}
                    showAsPercentage={showAsPercentage}
                    weightPercent={showAsPercentage ? config.weights.midterm : undefined}
                    onChange={v => onUpdateScore?.(s.studentId, 'midtermScore', v)}
                  />
                </div>

                {/* Final */}
                <div>
                  <ScoreCell
                    value={s.finalScore}
                    editable={editable && !s.absent}
                    showAsPercentage={showAsPercentage}
                    weightPercent={showAsPercentage ? config.weights.final : undefined}
                    onChange={v => onUpdateScore?.(s.studentId, 'finalScore', v)}
                  />
                </div>

                {/* Total */}
                <div>
                  {s.totalScore !== null ? (
                    <span
                      className="text-[13px] font-black font-sukhumvit tabular-nums"
                      style={{ color: percentScoreStyle(s.totalScore).text }}
                    >
                      {Math.round(s.totalScore)}%
                    </span>
                  ) : (
                    <span className="text-[13px] text-muted-foreground/40 font-sarabun">—</span>
                  )}
                </div>

                {/* Grade / GPA pill */}
                <div className="flex justify-center">
                  <GradePill gpa={gpa} absent={s.absent} />
                </div>
                </>
                )}
              </motion.div>
            );
          })}

          {summaries.length === 0 && (
            <div className="py-12 text-center text-muted-foreground">
              <p className="text-[13px] font-sarabun">ยังไม่มีข้อมูลนักเรียน</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
