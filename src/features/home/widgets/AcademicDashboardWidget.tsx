import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  HiArrowLeft,
  HiArrowPath,
  HiChevronLeft,
  HiChevronRight,
  HiExclamationTriangle,
  HiOutlineChartBar,
  HiOutlineCheckBadge,
  HiOutlineExclamationTriangle,
  HiOutlineTrophy,
  HiXMark,
} from 'react-icons/hi2';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SubSubjectGroupBadge } from '@/components/school/SubSubjectGroupBadge';
import ExamRoomScoreTable, {
  type ExamRoomScoreRow,
} from '@/features/grades/components/ExamRoomScoreTable';
import { ClassSelect } from '@/features/studentAnalytics/components/ClassSelect';
import {
  ClassMidtermAbbrHelp,
  ClassMidtermScoreMatrix,
  type ClassMidtermScoreMode,
} from '@/features/home/widgets/ClassMidtermScoreMatrix';
import { GradeAssessmentMatrixView } from '@/features/home/widgets/GradeAssessmentMatrix';
import { useAcademicStats } from '@/hooks/useAcademicStats';
import { useClassMidtermReport } from '@/hooks/useClassMidtermReport';
import { useGradeAssessmentMatrix } from '@/hooks/useGradeAssessmentMatrix';
import { fetchAtRiskExamScoreRows } from '@/lib/academicStats/fetchAtRiskExamScoreRows';
import { computeMeanSd, mapScoresToTScores, toTScore } from '@/lib/academicStats/tScore';
import { DRAWER_HEADER_ICON_BTN, DRAWER_HEADER_RIGHT_ACTIONS } from '@/lib/drawerHeaderBtn';
import { cn } from '@/lib/utils';
import { SUBJECT_GROUP_CONFIG, type SubjectGroupId } from '@/types/curriculum';
import type {
  AcademicAtRiskClass,
  AcademicStatsDoc,
  AcademicTeacherPassRank,
  AcademicUnlinkedRoom,
} from '@/types/academicStats';

const AT_RISK_PAGE_SIZE = 10;

const ROOM_STATUS_LABEL: Record<string, string> = {
  active: 'กำลังสอบ',
  upcoming: 'รอเปิด',
  closed: 'ปิดแล้ว',
};

const TEACHER_ROOMS_DRAWER_CONTENT_CLASS = cn(
  'flex h-dvh flex-col bg-transparent p-0 before:hidden',
  'data-[vaul-drawer-direction=right]:w-screen data-[vaul-drawer-direction=right]:max-w-none',
  'sm:h-full sm:data-[vaul-drawer-direction=right]:w-full sm:data-[vaul-drawer-direction=right]:max-w-md sm:p-2',
);

const TEACHER_ROOMS_DRAWER_PANEL_CLASS = cn(
  'flex h-full min-h-0 flex-col overflow-hidden bg-card',
  'sm:rounded-2xl sm:border sm:border-border sm:shadow-xl',
);

function resolveSubjectGroupId(row: {
  subjectGroupId?: string;
  subjectGroup?: string;
}): SubjectGroupId | undefined {
  const id = row.subjectGroupId?.trim();
  if (id && id in SUBJECT_GROUP_CONFIG) return id as SubjectGroupId;
  const label = row.subjectGroup?.trim();
  if (!label || label === '—') return undefined;
  const hit = (Object.entries(SUBJECT_GROUP_CONFIG) as [SubjectGroupId, { name: string }][])
    .find(([, cfg]) => cfg.name === label);
  return hit?.[0];
}

function TeacherRoomMeta({
  room,
}: {
  room: {
    className?: string;
    gradeLevel?: string;
    subjectGroup?: string;
    subjectGroupId?: string;
    subSubjectGroup?: string;
  };
}) {
  const groupId = resolveSubjectGroupId(room);
  const className = room.className?.trim();
  const hasClass = !!className && className !== '—';
  const hasGroup = !!room.subjectGroup && room.subjectGroup !== '—';
  const hasSub = !!room.subSubjectGroup && room.subSubjectGroup !== '—';
  if (!hasClass && !hasGroup && !hasSub) return null;
  const classGrade =
    room.gradeLevel?.trim()
    || className?.split('/')[0]?.trim()
    || className
    || '';
  return (
    <div className="mt-1 flex min-w-0 flex-col items-start gap-1">
      {hasClass ? (
        <SubSubjectGroupBadge
          label={className!}
          gradeLevel={classGrade}
          className="text-[10px]"
        />
      ) : null}
      {hasGroup ? (
        <SubSubjectGroupBadge
          label={room.subjectGroup!}
          subjectGroupId={groupId}
          className="text-[10px]"
        />
      ) : null}
      {hasSub ? (
        <SubSubjectGroupBadge
          label={room.subSubjectGroup!}
          subjectGroupId={groupId}
          className="text-[10px]"
        />
      ) : null}
    </div>
  );
}

function TeacherPassRingAvatar({
  pct,
  photoURL,
  name,
}: {
  pct: number | null;
  photoURL?: string;
  name: string;
}) {
  const size = 88;
  const stroke = 5;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = pct == null ? 0 : Math.min(100, Math.max(0, pct));
  const dashOffset = circumference - (clamped / 100) * circumference;
  const progressTone =
    pct == null
      ? 'text-transparent'
      : pct >= 60
        ? 'text-emerald-500'
        : 'text-destructive';

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg
        className="absolute inset-0 -rotate-90"
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        aria-hidden
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          className="text-muted/30"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          className={cn('transition-[stroke-dashoffset] duration-500', progressTone)}
        />
      </svg>
      <Avatar
        className="absolute left-1/2 top-1/2 size-[68px] -translate-x-1/2 -translate-y-1/2"
      >
        {photoURL ? <AvatarImage src={photoURL} alt={name} /> : null}
        <AvatarFallback className="text-[18px] font-black">{name.charAt(0)}</AvatarFallback>
      </Avatar>
    </div>
  );
}

function teacherMatchKey(teacherId: string | undefined, teacherName: string | undefined): string {
  const id = teacherId?.trim();
  if (id) return id;
  return teacherName?.trim() || '';
}

function pendingRoomsForTeacher(
  unlinkedRooms: AcademicUnlinkedRoom[],
  teacher: Pick<AcademicTeacherPassRank, 'teacherId' | 'teacherName'>,
): AcademicUnlinkedRoom[] {
  const key = teacherMatchKey(teacher.teacherId, teacher.teacherName);
  if (!key) return [];
  return unlinkedRooms.filter((room) => {
    const roomKey = teacherMatchKey(room.teacherId, room.teacherName);
    if (roomKey && roomKey === key) return true;
    return !!teacher.teacherName && room.teacherName === teacher.teacherName;
  });
}

function pendingGradingCountForTeacher(
  teacher: Pick<AcademicTeacherPassRank, 'rooms'>,
): number {
  return (teacher.rooms ?? []).filter((r) => r.pendingGrading).length;
}

function teacherPendingAlertCount(
  unlinkedRooms: AcademicUnlinkedRoom[],
  teacher: AcademicTeacherPassRank,
): number {
  return pendingRoomsForTeacher(unlinkedRooms, teacher).length
    + pendingGradingCountForTeacher(teacher);
}

function KpiCard({
  label,
  value,
  pct,
  hint,
  children,
}: {
  label: string;
  value: string;
  /** ใช้ระบายสีตัวเลข: >50% เขียว · ≤50% แดง */
  pct?: number;
  hint?: string;
  children?: React.ReactNode;
}) {
  const valueTone =
    pct == null
      ? 'text-foreground'
      : pct > 50
        ? 'text-emerald-600'
        : 'text-destructive';
  return (
    <div className="flex min-h-[7.5rem] flex-col items-center justify-center rounded-2xl border border-border bg-card p-4 text-center">
      <p className="text-[13px] font-black tracking-tight text-foreground font-sukhumvit">{label}</p>
      <p className={cn('mt-2 text-3xl font-black tabular-nums tracking-tight', valueTone)}>
        {value}
      </p>
      {hint ? <p className="mt-1 text-[11px] font-bold text-muted-foreground">{hint}</p> : null}
      {children ? <div className="mt-3">{children}</div> : null}
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn('flex min-h-0 flex-col rounded-2xl border border-border bg-card p-4', className)}
    >
      <div className="mb-3 shrink-0 border-b border-border pb-3">
        <h3 className="text-[13px] font-black text-foreground font-sukhumvit">{title}</h3>
        {subtitle ? (
          <p className="mt-0.5 text-[11px] font-bold text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
      <div className="h-[220px] w-full shrink-0">{children}</div>
    </section>
  );
}

function DashboardBody({ stats }: { stats: AcademicStatsDoc }) {
  const { kpi, byGradeLevel, atRiskClasses, distribution } = stats;
  const teacherPassRanking = stats.teacherPassRanking ?? [];
  const unlinkedRooms = stats.unlinkedRooms ?? [];
  // school-wide T mean / T≥50 ≈ ค่าคงที่ — KPI ใช้ปลายหางแทน
  const goodRatePct =
    kpi.studentScoreCount > 0
      ? Math.round((distribution.excellent / kpi.studentScoreCount) * 1000) / 10
      : 0;
  const weakRatePct =
    kpi.studentScoreCount > 0
      ? Math.round((distribution.needsImprovement / kpi.studentScoreCount) * 1000) / 10
      : 0;
  const [atRiskPage, setAtRiskPage] = useState(1);
  const [selectedAtRisk, setSelectedAtRisk] = useState<AcademicAtRiskClass | null>(null);
  const [scoreRows, setScoreRows] = useState<ExamRoomScoreRow[]>([]);
  const [scoreLoading, setScoreLoading] = useState(false);
  const [scoreError, setScoreError] = useState<string | null>(null);
  const [showRawPercent, setShowRawPercent] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState<AcademicTeacherPassRank | null>(null);

  const selectedTeacherPendingRooms = selectedTeacher
    ? pendingRoomsForTeacher(unlinkedRooms, selectedTeacher)
    : [];
  const selectedTeacherPendingGradingRooms = (selectedTeacher?.rooms ?? []).filter(
    (r) => r.pendingGrading,
  );
  const selectedTeacherScoredRooms = (selectedTeacher?.rooms ?? []).filter(
    (r) => !r.pendingGrading && r.totalCount > 0,
  );
  const selectedTeacherPendingTotal =
    selectedTeacherPendingRooms.length + selectedTeacherPendingGradingRooms.length;
  const selectedTeacherHasAnyRooms =
    selectedTeacherScoredRooms.length > 0 || selectedTeacherPendingTotal > 0;

  useEffect(() => {
    if (!selectedAtRisk?.examRoomId) {
      setScoreRows([]);
      setScoreError(selectedAtRisk ? 'ไม่พบรหัสห้องสอบ — กดรีเฟรชสรุปแล้วลองใหม่' : null);
      setScoreLoading(false);
      return;
    }

    let cancelled = false;
    setScoreLoading(true);
    setScoreError(null);
    void fetchAtRiskExamScoreRows(selectedAtRisk.examRoomId)
      .then((rows) => {
        if (cancelled) return;
        setScoreRows(rows);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('[AcademicDashboard] load score rows failed', err);
        setScoreError('โหลดตารางคะแนนไม่สำเร็จ');
        setScoreRows([]);
      })
      .finally(() => {
        if (!cancelled) setScoreLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedAtRisk]);

  const gradeBars = useMemo(
    () =>
      byGradeLevel.map((g) => ({
        name: g.gradeLevel,
        avgPct: g.avgPct,
        n: g.n,
      })),
    [byGradeLevel],
  );

  /** อัตราตกตามโหมดตาราง — T ต่อห้อง หรือ % ดิบ */
  const liveFailStats = useMemo(() => {
    const scored = scoreRows.filter(
      (r) => typeof r.scorePercent === 'number' && Number.isFinite(r.scorePercent),
    );
    if (scored.length === 0) return null;
    if (showRawPercent) {
      const fail = scored.filter((r) => (r.scorePercent as number) < 50).length;
      return {
        failCount: fail,
        totalCount: scored.length,
        failRatePct: Math.round((fail / scored.length) * 1000) / 10,
      };
    }
    const stats = computeMeanSd(scored.map((r) => r.scorePercent as number));
    const fail = scored.filter((r) => {
      const t = toTScore(r.scorePercent as number, stats);
      return t != null && t < 50;
    }).length;
    return {
      failCount: fail,
      totalCount: scored.length,
      failRatePct: Math.round((fail / scored.length) * 1000) / 10,
    };
  }, [scoreRows, showRawPercent]);

  const atRiskTotalPages = Math.max(1, Math.ceil(atRiskClasses.length / AT_RISK_PAGE_SIZE));
  const atRiskSafePage = Math.min(atRiskPage, atRiskTotalPages);
  const atRiskPageRows = atRiskClasses.slice(
    (atRiskSafePage - 1) * AT_RISK_PAGE_SIZE,
    atRiskSafePage * AT_RISK_PAGE_SIZE,
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <KpiCard
          label="สัดส่วนผลดี (T≥60)"
          value={`${goodRatePct}%`}
          pct={goodRatePct}
          hint="T-Score เทียบทั้งโรงเรียน · T = 50 + 10×(คะแนน−μ)/σ"
        />
        <KpiCard
          label="ต้องปรับปรุง (T<40)"
          value={`${weakRatePct}%`}
          pct={100 - weakRatePct}
        />
      </div>

      <ChartCard
        title="ผลสัมฤทธิ์ตามระดับชั้น"
        subtitle="ค่าเฉลี่ย T-Score ของนักเรียนในแต่ละระดับชั้น"
      >
        {gradeBars.length === 0 ? (
          <EmptyChart />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={gradeBars}
              margin={{ left: 4, right: 8, top: 20, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 12, fontWeight: 700 }}
                tickLine={false}
                axisLine={{ stroke: 'var(--border)' }}
              />
              <YAxis
                domain={[20, 80]}
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                width={40}
              />
              <Tooltip
                cursor={{ fill: 'var(--muted)', opacity: 0.45 }}
                contentStyle={{
                  borderRadius: 12,
                  border: '1px solid var(--border)',
                  fontSize: 12,
                  fontWeight: 700,
                }}
                formatter={(value, _n, item) => {
                  const n = (item?.payload as { n?: number } | undefined)?.n ?? 0;
                  return [`T ${value} · ${n} คน`, 'ค่าเฉลี่ย'];
                }}
                labelFormatter={(label) => `ระดับชั้น ${label}`}
              />
              <Bar dataKey="avgPct" radius={[8, 8, 0, 0]} maxBarSize={48}>
                {gradeBars.map((g) => (
                  <Cell
                    key={g.name}
                    fill={g.avgPct > 50 ? 'var(--color-emerald-600)' : 'var(--destructive)'}
                  />
                ))}
                <LabelList
                  dataKey="avgPct"
                  position="top"
                  className="fill-foreground text-[11px] font-black"
                  formatter={(v) => `${v}`}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <section className="flex min-h-0 flex-col rounded-2xl border border-border bg-card p-4">
        <div className="mb-3 border-b border-border pb-3">
          <h3 className="text-[13px] font-black text-foreground font-sukhumvit">
            อัตราสูงกว่าค่าเฉลี่ย (T≥50) ของนักเรียนในรายวิชา
          </h3>
        </div>

        {teacherPassRanking.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border py-10 text-center">
            <HiOutlineTrophy className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-[13px] font-black text-muted-foreground">ยังไม่มีรายชื่อครู</p>
            <p className="text-[11px] font-bold text-muted-foreground/70">กดรีเฟรชสรุปเพื่อคำนวณใหม่</p>
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {teacherPassRanking.map((t) => {
              const pendingCount = teacherPendingAlertCount(unlinkedRooms, t);
              const hasScores = t.totalCount > 0;
              const passOk = hasScores && t.passRatePct >= 60;
              const pctTone = !hasScores
                ? 'text-muted-foreground'
                : passOk
                  ? 'text-emerald-600'
                  : 'text-destructive';
              return (
                <li key={t.teacherId}>
                  <button
                    type="button"
                    onClick={() => setSelectedTeacher(t)}
                    className={cn(
                      'flex w-full flex-col items-center gap-2 rounded-2xl px-2 py-3 text-center transition-colors hover:bg-muted/40',
                      pendingCount > 0 && 'ring-1 ring-amber-500/40',
                    )}
                  >
                    <TeacherPassRingAvatar
                      pct={hasScores ? t.passRatePct : null}
                      photoURL={t.teacherPhotoURL || undefined}
                      name={t.teacherName}
                    />
                    <p className="line-clamp-2 w-full text-[13px] font-black leading-snug text-foreground font-sukhumvit">
                      {t.teacherName}
                    </p>
                    <p className={cn('text-xl font-black tabular-nums tracking-tight', pctTone)}>
                      {hasScores ? `${t.passRatePct}%` : '—'}
                    </p>
                    {pendingCount > 0 ? (
                      <p className="flex items-center gap-1 text-[10px] font-bold text-amber-600">
                        <HiExclamationTriangle className="h-3 w-3 shrink-0" aria-hidden />
                        <span>รอตรวจ {pendingCount}</span>
                      </p>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="flex min-h-0 flex-col rounded-2xl border border-border bg-card p-4">
          <div className="mb-3 flex items-start justify-between gap-3 border-b border-border pb-3">
            <div className="flex min-w-0 items-center gap-2">
              {selectedAtRisk ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="shrink-0 rounded-xl"
                  onClick={() => setSelectedAtRisk(null)}
                  aria-label="กลับรายการห้องเสี่ยง"
                  title="กลับ"
                >
                  <HiArrowLeft className="h-4 w-4" />
                </Button>
              ) : null}
              <div className="min-w-0">
                <h3 className="truncate text-[13px] font-black text-foreground font-sukhumvit">
                  {selectedAtRisk
                    ? `${selectedAtRisk.className} · ${selectedAtRisk.subjectName}`
                    : 'ห้องเรียนที่น่าเป็นห่วง'}
                </h3>
              </div>
            </div>
            {selectedAtRisk ? (
              <div className="flex shrink-0 items-center gap-2">
                <label className="flex cursor-pointer items-center gap-2">
                  <span className="whitespace-nowrap text-[11px] font-bold text-muted-foreground font-sukhumvit">
                    คะแนนปกติ
                  </span>
                  <Switch
                    checked={showRawPercent}
                    onCheckedChange={setShowRawPercent}
                    aria-label="สลับดูคะแนนปกติ"
                  />
                </label>
                <span className="inline-flex items-center gap-1">
                  <span className="inline-flex rounded-full bg-destructive/10 px-2.5 py-0.5 text-[11px] font-black text-destructive">
                    {(liveFailStats ?? selectedAtRisk).failRatePct}%
                  </span>
                  <span className="inline-flex rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-black tabular-nums text-muted-foreground">
                    {(liveFailStats ?? selectedAtRisk).failCount}/{(liveFailStats ?? selectedAtRisk).totalCount}
                  </span>
                </span>
              </div>
            ) : null}
          </div>

          {atRiskClasses.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border py-10 text-center">
              <HiOutlineCheckBadge className="h-8 w-8 text-emerald-500/70" />
              <p className="text-[13px] font-black text-muted-foreground">ยังไม่พบห้องเสี่ยงในเกณฑ์นี้</p>
            </div>
          ) : selectedAtRisk ? (
            <div className="min-h-0 flex-1 overflow-y-auto scrollbar-hide">
              {scoreLoading ? (
                <div className="flex flex-col gap-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full rounded-xl" />
                  ))}
                </div>
              ) : scoreError ? (
                <div className="rounded-xl border border-dashed border-border py-10 text-center">
                  <p className="text-[13px] font-bold text-muted-foreground">{scoreError}</p>
                </div>
              ) : (
                <ExamRoomScoreTable
                  rows={scoreRows}
                  className="rounded-none border-0 bg-transparent"
                  scoreMode={showRawPercent ? 'percent' : 'tScore'}
                />
              )}
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col gap-3">
              <div className="min-h-0 flex-1 overflow-x-auto">
                <div className="min-w-[880px]">
                  <div
                    className="grid gap-3 border-b border-border bg-background px-3 py-2.5"
                    style={{
                      gridTemplateColumns:
                        'minmax(4.5rem,0.7fr) minmax(3.5rem,0.55fr) minmax(6rem,1fr) minmax(7rem,1.3fr) minmax(5rem,1fr) minmax(5rem,1fr) minmax(7.5rem,1.3fr) minmax(7rem,0.95fr)',
                    }}
                  >
                    {['สถานะ', 'ระดับชั้น', 'ห้อง', 'วิชา', 'สาระหลัก', 'สาระย่อย', 'ครูผู้สอน', 'อัตราตก (T<50)'].map((h) => (
                      <span key={h} className="text-[12px] font-black text-foreground font-sukhumvit">
                        {h}
                      </span>
                    ))}
                  </div>
                  {atRiskPageRows.map((row) => {
                    const status = row.roomStatus || '—';
                    const statusLabel = ROOM_STATUS_LABEL[status] ?? status;
                    const groupId = resolveSubjectGroupId(row);
                    return (
                      <button
                        type="button"
                        key={`${row.classId}-${row.subjectId}-${row.examRoomId ?? ''}`}
                        onClick={() => setSelectedAtRisk(row)}
                        className="grid w-full gap-3 items-center border-b border-border px-3 py-2.5 text-left last:border-b-0 transition-colors hover:bg-muted/40"
                        style={{
                          gridTemplateColumns:
                            'minmax(4.5rem,0.7fr) minmax(3.5rem,0.55fr) minmax(6rem,1fr) minmax(7rem,1.3fr) minmax(5rem,1fr) minmax(5rem,1fr) minmax(7.5rem,1.3fr) minmax(7rem,0.95fr)',
                        }}
                      >
                        <span
                          className={cn(
                            'inline-flex w-fit rounded-full px-2 py-0.5 text-[10px] font-black',
                            status === 'active'
                              ? 'bg-emerald-500/10 text-emerald-700'
                              : status === 'upcoming'
                                ? 'bg-sky-500/10 text-sky-700'
                                : status === 'closed'
                                  ? 'bg-muted text-muted-foreground'
                                  : 'bg-muted text-muted-foreground',
                          )}
                        >
                          {statusLabel}
                        </span>
                        <span className="text-[13px] font-black tabular-nums text-muted-foreground">
                          {row.gradeLevel}
                        </span>
                        <span className="truncate text-[13px] font-bold text-foreground">{row.className}</span>
                        <span className="line-clamp-2 text-[13px] font-bold leading-snug text-foreground">
                          {row.subjectName}
                        </span>
                        <span className="min-w-0">
                          {row.subjectGroup && row.subjectGroup !== '—' ? (
                            <SubSubjectGroupBadge
                              label={row.subjectGroup}
                              subjectGroupId={groupId}
                              className="max-w-full text-[10px]"
                              maxWidth="100%"
                            />
                          ) : (
                            <span className="text-[12px] font-bold text-muted-foreground/40">—</span>
                          )}
                        </span>
                        <span className="min-w-0">
                          {row.subSubjectGroup && row.subSubjectGroup !== '—' ? (
                            <SubSubjectGroupBadge
                              label={row.subSubjectGroup}
                              subjectGroupId={groupId}
                              className="max-w-full text-[10px]"
                              maxWidth="100%"
                            />
                          ) : (
                            <span className="text-[12px] font-bold text-muted-foreground/40">—</span>
                          )}
                        </span>
                        <span className="flex min-w-0 items-center gap-2">
                          <Avatar className="size-9 shrink-0">
                            {row.teacherPhotoURL ? (
                              <AvatarImage src={row.teacherPhotoURL} alt={row.teacherName || ''} />
                            ) : null}
                            <AvatarFallback className="text-[11px] font-black">
                              {(row.teacherName || '?').charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="truncate text-[12px] font-bold text-foreground">
                            {row.teacherName || '—'}
                          </span>
                        </span>
                        <span className="inline-flex flex-wrap items-center gap-1">
                          <span className="inline-flex w-fit rounded-full bg-destructive/10 px-2.5 py-0.5 text-[11px] font-black text-destructive">
                            {row.failRatePct}%
                          </span>
                          <span className="inline-flex w-fit rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-black tabular-nums text-muted-foreground">
                            {row.failCount}/{row.totalCount}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {atRiskTotalPages > 1 ? (
                <div className="flex shrink-0 items-center justify-between gap-2 border-t border-border pt-3">
                  <p className="text-[11px] font-bold text-muted-foreground">
                    {(atRiskSafePage - 1) * AT_RISK_PAGE_SIZE + 1}
                    –
                    {Math.min(atRiskSafePage * AT_RISK_PAGE_SIZE, atRiskClasses.length)}
                    {' '}จาก {atRiskClasses.length}
                  </p>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="rounded-xl"
                      disabled={atRiskSafePage <= 1}
                      onClick={() => setAtRiskPage((p) => Math.max(1, p - 1))}
                      aria-label="หน้าก่อน"
                    >
                      <HiChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="min-w-[4.5rem] text-center text-[11px] font-black tabular-nums text-foreground">
                      {atRiskSafePage} / {atRiskTotalPages}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="rounded-xl"
                      disabled={atRiskSafePage >= atRiskTotalPages}
                      onClick={() => setAtRiskPage((p) => Math.min(atRiskTotalPages, p + 1))}
                      aria-label="หน้าถัดไป"
                    >
                      <HiChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </section>

      <Drawer
        open={!!selectedTeacher}
        onOpenChange={(open) => {
          if (!open) setSelectedTeacher(null);
        }}
        direction="right"
      >
        <DrawerContent className={TEACHER_ROOMS_DRAWER_CONTENT_CLASS}>
          <div className={TEACHER_ROOMS_DRAWER_PANEL_CLASS}>
            <DrawerHeader className="shrink-0 border-b border-border px-4 pb-3 pt-4">
              <div className="relative flex min-h-10 items-center justify-start gap-3 pr-12">
                {selectedTeacher ? (
                  <Avatar className="size-10 shrink-0">
                    {selectedTeacher.teacherPhotoURL ? (
                      <AvatarImage
                        src={selectedTeacher.teacherPhotoURL}
                        alt={selectedTeacher.teacherName}
                      />
                    ) : null}
                    <AvatarFallback className="text-[12px] font-black">
                      {selectedTeacher.teacherName.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                ) : null}
                <div className="min-w-0">
                  <DrawerTitle className="truncate text-left text-[15px] font-black text-foreground font-sukhumvit">
                    {selectedTeacher?.teacherName ?? 'ห้องสอบ'}
                  </DrawerTitle>
                  <p className="text-[11px] font-bold text-muted-foreground">
                    ห้องสอบที่เก็บคะแนนกลางภาค
                    {selectedTeacher && selectedTeacher.totalCount > 0
                      ? ` · ผ่านรวม ${selectedTeacher.passRatePct}% (${selectedTeacher.passCount}/${selectedTeacher.totalCount})`
                      : null}
                  </p>
                  {selectedTeacherPendingTotal > 0 ? (
                    <p className="mt-0.5 flex items-center gap-1 text-[11px] font-bold text-amber-600">
                      <HiExclamationTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      ยังตรวจคะแนนไม่เสร็จ · {selectedTeacherPendingTotal} ห้อง
                    </p>
                  ) : null}
                </div>
                <div className={DRAWER_HEADER_RIGHT_ACTIONS}>
                  <button
                    type="button"
                    onClick={() => setSelectedTeacher(null)}
                    className={DRAWER_HEADER_ICON_BTN}
                    aria-label="ปิด"
                  >
                    <HiXMark className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </DrawerHeader>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 scrollbar-hide">
              {!selectedTeacherHasAnyRooms ? (
                <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border py-12 text-center">
                  <p className="text-[13px] font-black text-muted-foreground">ยังไม่มีรายการห้องสอบ</p>
                  <p className="text-[11px] font-bold text-muted-foreground/70">
                    กดรีเฟรชสรุปแล้วลองใหม่
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {selectedTeacherPendingTotal > 0 ? (
                    <div className="flex flex-col gap-2">
                      <p className="pl-1 text-[10px] font-black uppercase tracking-wider text-amber-600">
                        รอตรวจข้อสอบ
                      </p>
                      <ul className="flex flex-col gap-2">
                        {selectedTeacherPendingGradingRooms.map((room) => (
                          <li
                            key={room.examRoomId}
                            className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-2.5"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-[13px] font-black text-foreground font-sukhumvit line-clamp-2">
                                {room.subjectName}
                              </p>
                              <TeacherRoomMeta room={room} />
                            </div>
                            <span className="inline-flex shrink-0 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[10px] font-black text-amber-700">
                              รอตรวจ
                            </span>
                          </li>
                        ))}
                        {selectedTeacherPendingRooms.map((room) => (
                          <li
                            key={room.examRoomId}
                            className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-2.5"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-[13px] font-black text-foreground font-sukhumvit line-clamp-2">
                                {room.subjectName}
                              </p>
                              <TeacherRoomMeta room={room} />
                            </div>
                            <span className="inline-flex shrink-0 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[10px] font-black text-amber-700">
                              ยังไม่ตรวจ
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {selectedTeacherScoredRooms.length > 0 ? (
                    <div className="flex flex-col gap-2">
                      {selectedTeacherPendingTotal > 0 ? (
                        <p className="pl-1 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                          มีคะแนนแล้ว
                        </p>
                      ) : null}
                      <ul className="flex flex-col gap-2">
                        {selectedTeacherScoredRooms.map((room) => (
                          <li
                            key={room.examRoomId}
                            className="flex items-start gap-3 rounded-xl border border-border bg-background px-3 py-2.5"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-[13px] font-black text-foreground font-sukhumvit line-clamp-2">
                                {room.subjectName}
                              </p>
                              <TeacherRoomMeta room={room} />
                            </div>
                            <div className="flex shrink-0 flex-col items-end gap-1">
                              <span
                                className={cn(
                                  'inline-flex rounded-full px-2.5 py-0.5 text-[12px] font-black tabular-nums',
                                  room.passRatePct < 75
                                    ? 'bg-destructive/10 text-destructive'
                                    : 'bg-emerald-500/10 text-emerald-700',
                                )}
                              >
                                {room.passRatePct}%
                              </span>
                              <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-[10px] font-black tabular-nums text-muted-foreground">
                                {room.passCount}/{room.totalCount}
                              </span>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="flex h-full min-h-[180px] flex-col items-center justify-center text-center">
      <HiOutlineChartBar className="mb-2 h-8 w-8 text-muted-foreground/40" />
      <p className="text-[12px] font-bold text-muted-foreground">ยังไม่มีข้อมูลกราฟ</p>
    </div>
  );
}

function StudentAnalysisTab({ academicYearId }: { academicYearId: string }) {
  const [classId, setClassId] = useState<string | null>(null);
  const [showRawPercent, setShowRawPercent] = useState(false);
  const { report, loading, error } = useClassMidtermReport(classId, 'midterm');
  const showHelp = Boolean(classId && !loading && report);
  const showMatrix = Boolean(classId && !loading && report);
  const scoreMode: ClassMidtermScoreMode = showRawPercent ? 'percent' : 'tScore';

  /** นับคนที่ค่าเฉลี่ย T-Score ≥ 50 ในห้อง */
  const tAbove50 = useMemo(() => {
    if (!report || report.columns.length === 0) return null;
    const keys = report.columns.map((c) => c.key);
    const { tScoresByStudent } = mapScoresToTScores(report.students, keys);
    let above = 0;
    let total = 0;
    for (const tScores of tScoresByStudent) {
      const vals = keys
        .map((k) => tScores[k])
        .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
      if (vals.length === 0) continue;
      total += 1;
      const avg = vals.reduce((s, n) => s + n, 0) / vals.length;
      if (avg >= 50) above += 1;
    }
    if (total === 0) return null;
    return {
      above,
      total,
      ratePct: Math.round((above / total) * 1000) / 10,
    };
  }, [report]);

  return (
    <section
      className={cn(
        'flex min-h-0 w-full min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-card p-4',
        'min-h-[24rem] md:h-[min(40rem,70dvh)]',
      )}
    >
      <div className="mb-3 flex shrink-0 flex-col gap-2 border-b border-border pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <div className="min-w-0">
              <h3 className="truncate text-[13px] font-black text-foreground font-sukhumvit">
                วิเคราะห์รายคน
              </h3>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {showMatrix ? (
              <label className="flex cursor-pointer items-center gap-2">
                <span className="whitespace-nowrap text-[11px] font-bold text-muted-foreground font-sukhumvit">
                  คะแนนปกติ
                </span>
                <Switch
                  checked={showRawPercent}
                  onCheckedChange={setShowRawPercent}
                  aria-label="สลับดูคะแนนปกติ"
                />
              </label>
            ) : null}
            {showMatrix && tAbove50 ? (
              <span className="inline-flex items-center gap-1" title="จำนวนนักเรียนที่ค่าเฉลี่ย T-Score ≥ 50">
                <span className="inline-flex rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-black text-emerald-600">
                  {tAbove50.ratePct}%
                </span>
                <span className="inline-flex rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-black tabular-nums text-muted-foreground">
                  T≥50 · {tAbove50.above}/{tAbove50.total}
                </span>
              </span>
            ) : null}
            {showHelp && report ? <ClassMidtermAbbrHelp columns={report.columns} /> : null}
          </div>
        </div>
        <div className="min-w-0 w-full max-w-xs sm:w-64">
          <ClassSelect
            value={classId}
            onChange={(id) => setClassId(id)}
            academicYearId={academicYearId}
          />
        </div>
      </div>

      {!classId ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-4 py-16 text-center">
          <HiOutlineExclamationTriangle className="h-8 w-8 text-muted-foreground/50" />
          <p className="text-[13px] font-bold text-muted-foreground">
            เลือกห้องเรียนเพื่อดูคะแนนรายคน
          </p>
        </div>
      ) : null}

      {classId && error ? (
        <p className="mb-2.5 rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2 text-[12px] font-bold text-destructive">
          {error}
        </p>
      ) : null}

      {classId && loading ? (
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-64 w-full flex-1 rounded-2xl" />
        </div>
      ) : null}

      {classId && !loading && !report ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-4 py-16 text-center">
          <HiOutlineChartBar className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-[13px] font-bold text-muted-foreground">
            ยังไม่มีรายงานห้องนี้
          </p>
          <p className="text-[11px] font-bold text-muted-foreground/70">
            กด «รีเฟรชสรุป» เพื่อสร้างรายงานคะแนนรายคน
          </p>
        </div>
      ) : null}

      {showMatrix && report ? (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <ClassMidtermScoreMatrix report={report} scoreMode={scoreMode} />
        </div>
      ) : null}
    </section>
  );
}

export default function AcademicDashboardWidget() {
  const { stats, loading, rebuilding, error, rebuild, academicYearId } = useAcademicStats('midterm');
  const [tab, setTab] = useState('overview');
  const gradeAssessment = useGradeAssessmentMatrix(tab === 'grades');

  const showMidtermRefresh = tab === 'overview';
  const showGradeRefresh = tab === 'grades';

  return (
    <div className="flex w-full min-w-0 flex-col gap-3">
      {error && tab === 'overview' ? (
        <p className="rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2 text-[12px] font-bold text-destructive">
          {error}
        </p>
      ) : null}
      {gradeAssessment.error && tab === 'grades' ? (
        <p className="rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2 text-[12px] font-bold text-destructive">
          {gradeAssessment.error}
        </p>
      ) : null}

      <Tabs value={tab} onValueChange={setTab} className="w-full min-w-0 gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList variant="line" className="w-full sm:w-fit">
            <TabsTrigger value="overview" className="text-xs font-bold font-sukhumvit">
              ภาพรวมสอบกลางภาค
            </TabsTrigger>
            <TabsTrigger value="grades" className="text-xs font-bold font-sukhumvit">
              ประเมินผลเกรด
            </TabsTrigger>
          </TabsList>
          {showMidtermRefresh ? (
            <Button
              type="button"
              variant="secondary"
              className="h-9 shrink-0 gap-1.5 rounded-xl text-xs font-bold"
              onClick={() => void rebuild()}
              disabled={rebuilding || loading}
            >
              <HiArrowPath className={cn('h-3.5 w-3.5', rebuilding && 'animate-spin')} />
              {rebuilding ? 'กำลังคำนวณ…' : stats ? 'รีเฟรชสรุป' : 'สร้างสรุปคะแนน'}
            </Button>
          ) : null}
          {showGradeRefresh ? (
            <Button
              type="button"
              variant="secondary"
              className="h-9 shrink-0 gap-1.5 rounded-xl text-xs font-bold"
              onClick={() => void gradeAssessment.reload()}
              disabled={gradeAssessment.loading}
            >
              <HiArrowPath className={cn('h-3.5 w-3.5', gradeAssessment.loading && 'animate-spin')} />
              {gradeAssessment.loading ? 'กำลังโหลด…' : 'รีเฟรชเกรด'}
            </Button>
          ) : null}
        </div>

        <TabsContent value="overview" className="mt-0 flex flex-col gap-4">
          {loading ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-[7.5rem] w-full rounded-2xl" />
              ))}
            </div>
          ) : !stats ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border py-16 text-center">
              <HiOutlineChartBar className="h-10 w-10 text-muted-foreground/40" />
              <div>
                <p className="text-[14px] font-black text-foreground">ยังไม่มีสรุปคะแนนกลางภาค</p>
                <p className="mt-1 text-[12px] font-bold text-muted-foreground">
                  กด «สร้างสรุปคะแนน» เพื่อรวมจากห้องสอบที่เชื่อมกลางภาค
                </p>
              </div>
            </div>
          ) : (
            <DashboardBody stats={stats} />
          )}

          {academicYearId ? (
            <StudentAnalysisTab academicYearId={academicYearId} />
          ) : null}
        </TabsContent>

        <TabsContent value="grades" className="mt-0 min-w-0 w-full">
          {!academicYearId ? (
            <div className="rounded-2xl border border-amber-100 bg-amber-50 px-5 py-4 text-sm font-bold text-amber-700">
              กรุณาตั้งค่าปีการศึกษาก่อน
            </div>
          ) : gradeAssessment.loading && !gradeAssessment.matrix ? (
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Skeleton className="h-[5.5rem] w-full rounded-2xl" />
                <Skeleton className="h-[5.5rem] w-full rounded-2xl" />
              </div>
              <Skeleton className="h-64 w-full rounded-2xl" />
            </div>
          ) : gradeAssessment.matrix ? (
            <GradeAssessmentMatrixView matrix={gradeAssessment.matrix} />
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border py-16 text-center">
              <HiOutlineChartBar className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-[14px] font-black text-foreground">ยังไม่มีข้อมูลเกรด</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
