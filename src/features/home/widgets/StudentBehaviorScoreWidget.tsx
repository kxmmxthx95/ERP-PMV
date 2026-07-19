import { useEffect, useMemo, useState } from 'react';
import {
  HiOutlineChevronRight,
  HiOutlineSparkles,
  HiOutlineStar,
  HiXMark,
} from 'react-icons/hi2';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { useActiveAcademicYear } from '@/hooks/useActiveAcademicYear';
import { useAuth } from '@/hooks/useAuth';
import { useStudentBehaviorRecords, useStudentBehaviorTotal } from '@/hooks/useBehaviorScore';
import { resolveStudentByAuthUser } from '@/lib/resolveStudentProfile';
import { formatThaiDateLabelFromIso } from '@/lib/dateUtils';
import { cn } from '@/lib/utils';
import { behaviorSeverityBadgeClass, getBehaviorSeverityLabel } from '@/features/behavior/utils/behaviorSeverity';
import { WidgetSkeleton } from '../components/WidgetSkeleton';
import { WIDGET_CARD, WIDGET_GLASS } from '../widgetStyles';
import type { Student } from '@/types/student';
import type { BehaviorRecord } from '@/types/behavior';

const DRAWER_CONTENT_CLASS = [
  'h-dvh flex flex-col p-0 rounded-none',
  'data-[vaul-drawer-direction=right]:w-screen data-[vaul-drawer-direction=right]:max-w-none',
  'data-[vaul-drawer-direction=right]:before:inset-0 data-[vaul-drawer-direction=right]:before:rounded-none',
  'sm:h-full sm:rounded-l-3xl',
  'sm:data-[vaul-drawer-direction=right]:w-full sm:data-[vaul-drawer-direction=right]:max-w-md',
  'sm:data-[vaul-drawer-direction=right]:before:inset-2 sm:data-[vaul-drawer-direction=right]:before:rounded-4xl',
].join(' ');

const BASELINE_POINTS = 100;

function scoreTone(score: number): { text: string; bg: string; label: string } {
  if (score >= 90) return { text: 'text-emerald-600', bg: 'bg-emerald-50', label: 'ดีเยี่ยม' };
  if (score >= 75) return { text: 'text-blue-600', bg: 'bg-blue-50', label: 'ปกติ' };
  if (score >= 60) return { text: 'text-amber-600', bg: 'bg-amber-50', label: 'ควรระวัง' };
  return { text: 'text-rose-600', bg: 'bg-rose-50', label: 'ต้องดูแล' };
}

function formatSignedPoints(points: number): string {
  return points > 0 ? `+${points}` : String(points);
}

function BehaviorRecordRow({ record }: { record: BehaviorRecord }) {
  const isPositive = record.type === 'positive';

  return (
    <div className="rounded-2xl border border-slate-200 bg-white/80 px-3 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-slate-800">{record.templateLabel}</p>
          <p className="mt-0.5 text-[11px] font-semibold text-slate-400">
            {formatThaiDateLabelFromIso(record.date)}
            {record.recordedByName ? ` · โดย ${record.recordedByName}` : ''}
          </p>
        </div>
        <span
          className={cn(
            'shrink-0 rounded-xl px-2 py-1 text-xs font-black tabular-nums',
            isPositive ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700',
          )}
        >
          {formatSignedPoints(record.points)}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span
          className={cn(
            'rounded-lg border px-2 py-0.5 text-[10px] font-black',
            isPositive
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : behaviorSeverityBadgeClass(record.severity),
          )}
        >
          {isPositive ? 'พฤติกรรมดี' : `ผิดระเบียบ · ${getBehaviorSeverityLabel(record.severity)}`}
        </span>
        {record.note ? (
          <span className="rounded-lg bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
            {record.note}
          </span>
        ) : null}
      </div>
    </div>
  );
}

export default function StudentBehaviorScoreWidget() {
  const { user, userData } = useAuth();
  const { year, isLoaded } = useActiveAcademicYear();
  const [student, setStudent] = useState<Student | null>(null);
  const [studentLoading, setStudentLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadStudent() {
      if (!user?.uid) {
        setStudent(null);
        setStudentLoading(false);
        return;
      }

      setStudentLoading(true);
      try {
        const resolved = await resolveStudentByAuthUser(user.uid, {
          studentCode: typeof userData?.studentCode === 'string' ? userData.studentCode : undefined,
          email: user.email ?? undefined,
        });
        if (!cancelled) setStudent(resolved);
      } catch {
        if (!cancelled) setStudent(null);
      } finally {
        if (!cancelled) setStudentLoading(false);
      }
    }

    void loadStudent();
    return () => {
      cancelled = true;
    };
  }, [user?.uid, user?.email, userData?.studentCode]);

  const studentId = student?.id ?? null;
  const { total, loading: totalLoading } = useStudentBehaviorTotal(year, studentId);
  const { records, loading: recordsLoading } = useStudentBehaviorRecords(
    drawerOpen ? year : null,
    drawerOpen ? studentId : null,
  );

  const score = total?.totalPoints ?? BASELINE_POINTS;
  const baseline = total?.baselinePoints ?? BASELINE_POINTS;
  const delta = score - baseline;
  const tone = scoreTone(score);
  const latestRecord = records[0] ?? null;
  const studentMeta = student
    ? (
        (student as Student & { className?: string; gradeLevel?: string }).className
        || (student as Student & { className?: string; gradeLevel?: string }).gradeLevel
        || `รหัส ${student.studentCode}`
      )
    : 'ประวัติพฤติกรรมของฉัน';

  const recentRecords = useMemo(() => records.slice(0, 20), [records]);

  if (!isLoaded || studentLoading || totalLoading) return <WidgetSkeleton variant="list" />;
  if (!year || !student) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setDrawerOpen(true)}
        style={WIDGET_GLASS}
        className={cn(WIDGET_CARD, 'group cursor-pointer text-left transition-transform active:scale-[0.98]')}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-black leading-tight text-slate-800">คะแนนพฤติกรรม</p>
            <p className="mt-0.5 truncate text-[10px] font-bold text-slate-400">
              {studentMeta}
            </p>
          </div>
          <HiOutlineChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-400 group-hover:text-slate-600" />
        </div>

        <div className="flex flex-1 items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-baseline gap-2">
              <p className={cn('font-sukhumvit text-4xl font-black leading-none tabular-nums', tone.text)}>
                {score}
              </p>
              <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-black', tone.bg, tone.text)}>
                {tone.label}
              </span>
            </div>
            <p className="mt-1 text-[10px] font-semibold text-slate-400">
              {delta === 0 ? 'ยังไม่มีการเปลี่ยนแปลงคะแนน' : `เปลี่ยนแปลง ${formatSignedPoints(delta)} จากคะแนนตั้งต้น`}
            </p>
          </div>

          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-500">
            <HiOutlineStar className="h-7 w-7" />
          </div>
        </div>
      </button>

      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen} direction="right">
        <DrawerContent className={DRAWER_CONTENT_CLASS}>
          <DrawerHeader className="px-4 pb-2">
            <div className="relative flex min-h-10 items-center justify-center">
              <div className="min-w-0 px-12 text-center">
                <DrawerTitle className="text-base font-black text-slate-800">คะแนนพฤติกรรม</DrawerTitle>
                <DrawerDescription className="text-xs text-slate-500">
                  {student.prefix}{student.firstName} {student.lastName}
                </DrawerDescription>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="absolute right-0 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 active:scale-[0.98]"
                aria-label="ปิด"
              >
                <HiXMark className="h-4 w-4" />
              </button>
            </div>
          </DrawerHeader>

          <div className="flex-1 space-y-4 overflow-y-auto px-4 pb-6">
            <div className={cn('rounded-3xl px-4 py-4 text-center', tone.bg)}>
              <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">คะแนนปัจจุบัน</p>
              <p className={cn('mt-1 font-sukhumvit text-5xl font-black leading-none tabular-nums', tone.text)}>
                {score}
              </p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <div className="rounded-2xl bg-white/70 px-2 py-2">
                  <p className="text-sm font-black text-emerald-600">{total?.positiveCount ?? 0}</p>
                  <p className="text-[10px] font-semibold text-slate-400">เพิ่มคะแนน</p>
                </div>
                <div className="rounded-2xl bg-white/70 px-2 py-2">
                  <p className="text-sm font-black text-rose-600">{total?.negativeCount ?? 0}</p>
                  <p className="text-[10px] font-semibold text-slate-400">หักคะแนน</p>
                </div>
                <div className="rounded-2xl bg-white/70 px-2 py-2">
                  <p className="text-sm font-black text-slate-700">{formatSignedPoints(delta)}</p>
                  <p className="text-[10px] font-semibold text-slate-400">สุทธิ</p>
                </div>
              </div>
            </div>

            <section>
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="text-xs font-black uppercase tracking-wide text-slate-500">ประวัติล่าสุด</h3>
                {latestRecord ? (
                  <span className="text-[10px] font-semibold text-slate-400">
                    ล่าสุด {formatThaiDateLabelFromIso(latestRecord.date)}
                  </span>
                ) : null}
              </div>

              {recordsLoading ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center text-xs font-semibold text-slate-500">
                  กำลังโหลดประวัติ...
                </div>
              ) : recentRecords.length === 0 ? (
                <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
                  <HiOutlineSparkles className="h-6 w-6 text-slate-300" />
                  <p className="text-sm font-bold text-slate-600">ยังไม่มีประวัติคะแนนพฤติกรรม</p>
                  <p className="text-xs text-slate-400">คะแนนตั้งต้นของนักเรียนคือ {BASELINE_POINTS} คะแนน</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {recentRecords.map((record) => (
                    <BehaviorRecordRow key={record.id} record={record} />
                  ))}
                </div>
              )}
            </section>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
