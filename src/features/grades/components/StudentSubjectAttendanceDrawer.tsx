import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, CalendarDays, CheckSquare, Clock, FileCheck, UserCheck, UserX, X } from 'lucide-react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { db } from '@/lib/firebase';
import type { StudentSubjectGradeCard } from '@/hooks/useStudentGradeBook';
import type { AttendanceStatus } from '@/types/teaching';
import {
  buildStudentSubjectAttendanceHistory,
  summarizeStudentSubjectAttendance,
  type StudentSubjectAttendanceRow,
} from '@/features/grades/utils/studentSubjectAttendanceHistory';

const DRAWER_CONTENT_CLASS = cn(
  'h-dvh flex flex-col p-0 rounded-none bg-white/95 backdrop-blur-xl',
  'data-[vaul-drawer-direction=right]:w-screen data-[vaul-drawer-direction=right]:max-w-none',
  'data-[vaul-drawer-direction=right]:before:inset-0 data-[vaul-drawer-direction=right]:before:rounded-none',
  'sm:h-full sm:rounded-l-3xl',
  'sm:data-[vaul-drawer-direction=right]:w-full sm:data-[vaul-drawer-direction=right]:max-w-md',
  'sm:data-[vaul-drawer-direction=right]:before:inset-2 sm:data-[vaul-drawer-direction=right]:before:rounded-4xl',
);

const STATUS_CONFIG: Record<AttendanceStatus, { label: string; color: string; bg: string; icon: typeof UserCheck }> = {
  present: { label: 'มาเรียน', color: '#059669', bg: '#d1fae5', icon: UserCheck },
  absent: { label: 'ขาดเรียน', color: '#e11d48', bg: '#ffe4e6', icon: UserX },
  late: { label: 'สาย', color: '#d97706', bg: '#fef3c7', icon: Clock },
  excused: { label: 'ลากิจ/ป่วย', color: '#2563eb', bg: '#dbeafe', icon: FileCheck },
  leave: { label: 'ลา (ทางการ)', color: '#7c3aed', bg: '#f3e8ff', icon: CheckSquare },
};

type HistoryRow = StudentSubjectAttendanceRow;

function formatThaiDate(dateStr: string): string {
  const parsed = new Date(`${dateStr}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return dateStr;
  return parsed.toLocaleDateString('th-TH', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

type Props = {
  open: boolean;
  onClose: () => void;
  subject: StudentSubjectGradeCard | null;
  studentId: string | null;
  academicYearId: string | null;
  yearStartDate?: string;
  yearEndDate?: string;
};

export default function StudentSubjectAttendanceDrawer({
  open,
  onClose,
  subject,
  studentId,
  academicYearId,
  yearStartDate = '',
  yearEndDate = '',
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<HistoryRow[]>([]);

  const loadHistory = useCallback(async () => {
    if (!subject || !studentId || !academicYearId) {
      setRows([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [sessionsSnap, schedulesSnap] = await Promise.all([
        getDocs(query(
          collection(db, 'class_sessions'),
          where('classId', '==', subject.classId),
          where('academicYearId', '==', String(academicYearId)),
          where('subjectId', '==', subject.subjectId),
          where('semester', '==', subject.semester),
        )),
        getDocs(query(
          collection(db, 'schedules'),
          where('year', '==', String(academicYearId)),
          where('semester', '==', subject.semester),
          where('classId', '==', subject.classId),
          where('subjectId', '==', subject.subjectId),
        )),
      ]);

      const sessions = sessionsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const scheduleSlots = schedulesSnap.docs.map((d) => {
        const data = d.data() as { day?: number; dayOfWeek?: number; period?: number };
        return {
          day: data.day ?? data.dayOfWeek ?? 0,
          period: data.period ?? 0,
        };
      });

      const history = buildStudentSubjectAttendanceHistory({
        studentId,
        sessions,
        scheduleSlots,
        rangeStart: yearStartDate,
        rangeEnd: yearEndDate,
        academicYearId: String(academicYearId),
      });

      setRows(history);
    } catch (err) {
      console.error('[StudentSubjectAttendanceDrawer]', err);
      setError('โหลดประวัติการเข้าเรียนไม่สำเร็จ');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [subject, studentId, academicYearId, yearStartDate, yearEndDate]);

  useEffect(() => {
    if (!open) return;
    void loadHistory();
  }, [open, loadHistory]);

  const summary = useMemo(() => summarizeStudentSubjectAttendance(rows), [rows]);

  return (
    <Drawer open={open} onOpenChange={(next) => { if (!next) onClose(); }} direction="right">
      <DrawerContent className={DRAWER_CONTENT_CLASS}>
        <DrawerHeader className="shrink-0 px-4 pb-3 pt-4">
          <div className="relative flex min-h-10 items-center justify-center">
            <div className="min-w-0 px-12 text-center">
              <DrawerTitle className="font-sukhumvit text-[15px] font-black text-slate-800">
                ประวัติการเข้าเรียน
              </DrawerTitle>
              <DrawerDescription className="font-sarabun text-[12px] text-slate-500 truncate">
                {subject?.subjectName ?? '—'} · เทอม {subject?.semester ?? '—'}
              </DrawerDescription>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="absolute right-0 top-1/2 inline-flex size-9 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-100/80 hover:text-slate-700 active:scale-[0.98]"
              aria-label="ปิด"
            >
              <X size={18} />
            </button>
          </div>
        </DrawerHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))] scrollbar-hide">
          {!loading && !error && (
            <div className="mb-4 grid grid-cols-3 gap-2">
              <div className="rounded-2xl bg-emerald-50 border border-emerald-100 px-3 py-2.5 text-center">
                <p className="text-[9px] font-bold text-emerald-600/80 font-sukhumvit">เข้าเรียน</p>
                <p className="text-[18px] font-black text-emerald-700 font-sukhumvit tabular-nums">
                  {summary.pct !== null ? `${summary.pct}%` : '—'}
                </p>
              </div>
              <div className="rounded-2xl bg-slate-50 border border-slate-100 px-3 py-2.5 text-center">
                <p className="text-[9px] font-bold text-slate-500 font-sukhumvit">คาบทั้งหมด</p>
                <p className="text-[18px] font-black text-slate-800 font-sukhumvit tabular-nums">{summary.total}</p>
              </div>
              <div className="rounded-2xl bg-sky-50 border border-sky-100 px-3 py-2.5 text-center">
                <p className="text-[9px] font-bold text-sky-600/80 font-sukhumvit">มา/สาย</p>
                <p className="text-[18px] font-black text-sky-700 font-sukhumvit tabular-nums">{summary.presentLike}</p>
              </div>
            </div>
          )}

          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }, (_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-2xl bg-slate-100" />
              ))}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
              <AlertCircle size={22} className="text-amber-500" />
              <p className="text-[12px] text-slate-600 font-sarabun">{error}</p>
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
              <CalendarDays size={24} className="text-slate-300" />
              <p className="text-[12px] text-slate-400 font-sarabun">ยังไม่มีบันทึกการเข้าเรียนสำหรับวิชานี้</p>
            </div>
          ) : (
            <div className="space-y-2">
              {rows.map((row) => {
                const cfg = STATUS_CONFIG[row.status];
                const Icon = cfg.icon;
                return (
                  <div
                    key={row.key}
                    className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white px-3 py-2.5 shadow-sm"
                  >
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                      style={{
                        background: cfg.bg,
                        color: cfg.color,
                      }}
                    >
                      <Icon size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-black text-slate-800 font-sukhumvit">
                        {formatThaiDate(row.date)}
                      </p>
                      <p className="text-[10px] text-slate-400 font-sarabun mt-0.5">
                        คาบ {row.period}
                        {row.note ? ` · ${row.note}` : ''}
                      </p>
                    </div>
                    <span
                      className="shrink-0 rounded-full px-2 py-0.5 text-[9px] font-black font-sukhumvit"
                      style={{ background: cfg.bg, color: cfg.color }}
                    >
                      {cfg.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
