// src/features/teacherDashboard/components/GradeDistributionTable.tsx
// สรุปจำนวนนักเรียนตามเกรดแต่ละรายวิชา/ห้อง — อ่านอย่างเดียว
import { HiArrowPath } from 'react-icons/hi2';
import { Button } from '@/components/ui/button';
import {
  GRADE_COLUMNS,
  type ClassGradeDistribution,
  type TeacherGradeDistribution,
} from '@/hooks/useTeacherGradeDistribution';
import { cn } from '@/lib/utils';

interface Props {
  subjects: { subjectId: string; subjectName: string; subjectCode?: string }[];
  data: TeacherGradeDistribution;
  loading: boolean;
  refreshing: boolean;
  onReload: () => void;
}

const GRID = 'md:grid-cols-[minmax(0,1.8fr)_repeat(8,minmax(0,0.7fr))_minmax(0,0.9fr)_5.5rem]';

function Count({ n }: { n: number }) {
  return <span className={cn('tabular-nums', n === 0 ? 'text-muted-foreground/40' : 'font-black')}>{n}</span>;
}

export function GradeDistributionTable({ subjects, data, loading, refreshing, onReload }: Props) {
  const rows: { key: string; subjectName: string; subjectCode?: string; dist: ClassGradeDistribution }[] =
    subjects.flatMap((s) =>
      (data[s.subjectId] ?? [])
        .slice()
        .sort((a, b) => a.className.localeCompare(b.className, 'th', { numeric: true }))
        .map((dist) => ({ key: `${s.subjectId}_${dist.classId}`, subjectName: s.subjectName, subjectCode: s.subjectCode, dist })),
    );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <Button size="xs" variant="outline" onClick={onReload} disabled={refreshing} aria-label="รีเฟรชเกรด">
          <HiArrowPath className={cn('size-3.5', refreshing && 'animate-spin')} />
          รีเฟรช
        </Button>
      </div>

      {loading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">กำลังโหลด…</p>
      ) : rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">ยังไม่พบห้อง/วิชาที่ครูสอนสำหรับสรุปเกรด</p>
      ) : (
        <>
          {/* มือถือ: การ์ดรายแถว */}
          <div className="flex flex-col gap-3 md:hidden">
            {rows.map(({ key, subjectName, subjectCode, dist }) => {
              const none = dist.total - dist.graded;
              return (
                <div key={key} className="rounded-2xl border border-border bg-card p-4">
                  <p className="truncate text-sm font-black">{subjectName}</p>
                  <p className="mb-3 truncate text-xs text-muted-foreground">
                    {dist.className}{subjectCode ? ` · ${subjectCode}` : ''} · มีเกรด {dist.graded}/{dist.total} คน
                  </p>
                  <div className="grid grid-cols-5 gap-2 text-center text-xs">
                    {GRADE_COLUMNS.map((g) => (
                      <div key={g} className="rounded-xl bg-muted/40 py-1.5">
                        <p className="text-[10px] font-black text-muted-foreground">{g}</p>
                        <Count n={dist.counts[g] ?? 0} />
                      </div>
                    ))}
                    <div className="rounded-xl bg-muted/40 py-1.5">
                      <p className="text-[10px] font-black text-muted-foreground">ไม่มีเกรด</p>
                      <Count n={none} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* เดสก์ท็อป: ตารางกริด (GradeTable pattern) */}
          <div className="hidden overflow-hidden rounded-2xl border border-border bg-card md:block">
            <div className={cn('grid items-center gap-3 border-b border-border bg-muted/30 px-4 py-3 text-[10px] font-black uppercase tracking-wider text-muted-foreground', GRID)}>
              <span>วิชา / ห้อง</span>
              {GRADE_COLUMNS.map((g) => <span key={g} className="text-center">{g}</span>)}
              <span className="text-center">ไม่มีเกรด</span>
              <span className="text-center">มีเกรด/ห้อง</span>
            </div>
            {rows.map(({ key, subjectName, subjectCode, dist }) => (
              <div key={key} className={cn('grid items-center gap-3 border-b border-border px-4 py-3 last:border-b-0 hover:bg-muted/40', GRID)}>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{subjectName}</p>
                  <p className="truncate text-xs text-muted-foreground">{dist.className}{subjectCode ? ` · ${subjectCode}` : ''}</p>
                </div>
                {GRADE_COLUMNS.map((g) => (
                  <span key={g} className="text-center text-sm"><Count n={dist.counts[g] ?? 0} /></span>
                ))}
                <span className="text-center text-sm"><Count n={dist.total - dist.graded} /></span>
                <span className="text-center text-sm font-bold tabular-nums">{dist.graded}/{dist.total}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
