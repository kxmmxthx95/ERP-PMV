import { useMemo, useState } from 'react';
import { HiOutlineExclamationTriangle } from 'react-icons/hi2';
import { useActiveAcademicYear } from '@/hooks/useActiveAcademicYear';
import { Skeleton } from '@/components/ui/skeleton';
import { GLASS } from '@/components/layouts/PortalLayout';
import { ClassSelect } from './components/ClassSelect';
import { StudentAnalyticsTable } from './components/StudentAnalyticsTable';
import { useStudentAnalytics } from './hooks/useStudentAnalytics';

function StatCard({ label, value, tone }: { label: string; value: number; tone: 'destructive' | 'amber' | 'default' }) {
  const toneClass = tone === 'destructive' ? 'text-destructive' : tone === 'amber' ? 'text-amber-600 dark:text-amber-400' : 'text-foreground';
  return (
    <div style={GLASS} className="flex-1 rounded-xl px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-2xl font-bold tabular-nums ${toneClass}`}>{value}</p>
    </div>
  );
}

export default function StudentAnalyticsPage() {
  const { year, isLoaded } = useActiveAcademicYear();
  const [classId, setClassId] = useState<string | null>(null);
  const [className, setClassName] = useState('');

  const { data: rows = [], isLoading, isFetching } = useStudentAnalytics(classId, className);

  const stats = useMemo(() => ({
    high: rows.filter((r) => r.riskLevel === 'high').length,
    medium: rows.filter((r) => r.riskLevel === 'medium').length,
    total: rows.length,
  }), [rows]);

  if (!isLoaded || !year) {
    return (
      <div className="flex flex-1 flex-col min-h-0 font-sukhumvit">
        <div className="rounded-2xl border border-amber-100 bg-amber-50 px-5 py-4 text-sm font-bold text-amber-700">
          กรุณาตั้งค่าปีการศึกษาก่อน
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col min-h-0 gap-5 pb-24 font-sukhumvit">
      <ClassSelect value={classId} onChange={(id, name) => { setClassId(id); setClassName(name); }} academicYearId={String(year)} />

      {!classId && (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border py-16 text-center">
          <HiOutlineExclamationTriangle className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">เลือกห้องเรียนเพื่อดูข้อมูลวิเคราะห์</p>
        </div>
      )}

      {classId && (isLoading || isFetching) && (
        <div className="flex flex-col gap-3">
          <div className="flex gap-3">
            <Skeleton className="h-16 flex-1 rounded-xl" />
            <Skeleton className="h-16 flex-1 rounded-xl" />
            <Skeleton className="h-16 flex-1 rounded-xl" />
          </div>
          <Skeleton className="h-64 w-full rounded-lg" />
        </div>
      )}

      {classId && !isLoading && !isFetching && (
        <>
          <div className="flex gap-3">
            <StatCard label="นักเรียนทั้งหมด" value={stats.total} tone="default" />
            <StatCard label="เสี่ยงสูง" value={stats.high} tone="destructive" />
            <StatCard label="เฝ้าระวัง" value={stats.medium} tone="amber" />
          </div>
          <StudentAnalyticsTable rows={rows} />
        </>
      )}
    </div>
  );
}
