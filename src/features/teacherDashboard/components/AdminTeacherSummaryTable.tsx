// src/features/teacherDashboard/components/AdminTeacherSummaryTable.tsx
// ตารางสรุปผลงานครูทุกคนสำหรับแอดมิน — ตัวเลขชุดเดียวกับหน้าสรุปผลงานของครูแต่ละคน
import { Fragment, useMemo, useState } from 'react';
import { HiArrowPath, HiChevronDown, HiChevronUp, HiChevronUpDown, HiMagnifyingGlass } from 'react-icons/hi2';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { IndeterminateProgress } from '@/components/ui/progress';
import { KpiBulletBar } from '@/features/teacherKpi/components/KpiBulletBar';
import type { AdminTeacherRow } from '@/hooks/useAllTeachersDashboard';
import { DEPARTMENT_CONFIG, type Department } from '@/types/curriculum';
import { cn } from '@/lib/utils';

type SortKey = 'name' | 'attendance' | 'rollcall' | 'subjects';
type SortState = { key: SortKey; dir: 'asc' | 'desc' } | null;

const GRID = 'md:grid-cols-[minmax(0,1.6fr)_minmax(0,1.3fr)_minmax(0,1.3fr)_5rem]';

function SortHead({ label, k, sort, onSort, className }: {
  label: string; k: SortKey; sort: SortState; onSort: (k: SortKey) => void; className?: string;
}) {
  const active = sort?.key === k;
  const Icon = !active ? HiChevronUpDown : sort.dir === 'asc' ? HiChevronUp : HiChevronDown;
  return (
    <button
      type="button"
      onClick={() => onSort(k)}
      className={cn('inline-flex items-center gap-1 uppercase tracking-wider hover:text-foreground', active && 'text-foreground', className)}
    >
      <span className="truncate">{label}</span>
      <Icon className="size-3 shrink-0" />
    </button>
  );
}

interface Props {
  rows: AdminTeacherRow[];
  loading: boolean;
  refreshing: boolean;
  onReload: () => void;
  range: { from: string; to: string; rollCallEnd: string };
}

function thaiDate(ymd: string) {
  return new Date(`${ymd}T00:00:00`).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
}

export function AdminTeacherSummaryTable({ rows, loading, refreshing, onReload, range }: Props) {
  const [search, setSearch] = useState('');
  const [dept, setDept] = useState<'all' | Department>('all');
  const [sort, setSort] = useState<SortState>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const onSort = (key: SortKey) =>
    setSort((cur) => (cur?.key !== key ? { key, dir: 'asc' } : cur.dir === 'asc' ? { key, dir: 'desc' } : null));

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = rows.filter(({ row }) =>
      (dept === 'all' || row.department === dept) && (!q || row.name.toLowerCase().includes(q)));
    if (!sort) return [...filtered].sort((a, b) => a.row.name.localeCompare(b.row.name, 'th'));
    const dir = sort.dir === 'asc' ? 1 : -1;
    const value = (r: AdminTeacherRow): number | null => {
      if (sort.key === 'attendance') return r.row.attendanceRate;
      if (sort.key === 'rollcall') return r.row.rollCallRate;
      if (sort.key === 'subjects') return r.row.subjectBreakdown.filter((s) => !s.excluded).length;
      return null;
    };
    return [...filtered].sort((a, b) => {
      if (sort.key === 'name') return dir * a.row.name.localeCompare(b.row.name, 'th');
      const va = value(a); const vb = value(b);
      if (va == null && vb == null) return 0;
      if (va == null) return 1; // ไม่มีข้อมูลอยู่ท้ายเสมอ
      if (vb == null) return -1;
      return dir * (va - vb);
    });
  }, [rows, search, dept, sort]);

  const subjectsOf = (r: AdminTeacherRow) => r.row.subjectBreakdown.filter((s) => !s.excluded);

  const expandedPanel = (r: AdminTeacherRow) => (
    <div className="flex flex-col gap-3 bg-muted/20 px-4 py-4">
      {subjectsOf(r).length === 0 ? (
        <p className="text-xs text-muted-foreground">ไม่มีรายวิชา</p>
      ) : subjectsOf(r).map((s) => (
        <div key={s.subjectId}>
          <div className="mb-1 flex justify-between gap-2 text-xs">
            <span className="truncate font-bold">{s.subjectCode ? `${s.subjectCode} ` : ''}{s.subjectName}</span>
            <span className="shrink-0 tabular-nums text-muted-foreground">{s.completedSessions}/{s.expectedSessions} คาบ</span>
          </div>
          <KpiBulletBar value={s.rate} />
        </div>
      ))}
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-52 flex-1">
          <HiMagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ค้นหาชื่อครู"
            className="h-10 rounded-xl border-none bg-slate-50/70 pl-9 text-xs font-bold"
          />
        </div>
        <NativeSelect value={dept} onChange={(e) => setDept(e.target.value as 'all' | Department)} className="w-40">
          <option value="all">ทุกแผนก</option>
          {(Object.keys(DEPARTMENT_CONFIG) as Department[]).map((d) => (
            <option key={d} value={d}>{DEPARTMENT_CONFIG[d].label}</option>
          ))}
        </NativeSelect>
        <Button size="sm" variant="outline" onClick={onReload} disabled={refreshing} aria-label="รีเฟรชข้อมูล">
          <HiArrowPath className={cn('size-4', refreshing && 'animate-spin')} />
          รีเฟรช
        </Button>
      </div>

      <p className="text-xs font-bold text-destructive">
        เวลาปฏิบัติงาน {thaiDate(range.from)} – {thaiDate(range.to)}
        {' · '}เช็คชื่อรายวิชา {thaiDate(range.from)} – {thaiDate(range.rollCallEnd)}
        {' · '}แสดง {visible.length}/{rows.length} คน
      </p>

      {loading ? (
        <IndeterminateProgress />
      ) : visible.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">ไม่พบครูตามเงื่อนไข</p>
      ) : (
        <>
          {/* มือถือ: การ์ดรายคน */}
          <div className="flex flex-col gap-3 md:hidden">
            {visible.map((r) => (
              <div key={r.row.teacherId} className="rounded-2xl border border-border bg-card">
                <button
                  type="button"
                  className="flex w-full flex-col gap-3 p-4 text-left"
                  onClick={() => setExpanded((cur) => (cur === r.row.teacherId ? null : r.row.teacherId))}
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="size-10">
                      <AvatarImage src={r.row.photoURL} alt={r.row.name} className="object-cover" />
                      <AvatarFallback>{r.row.name.slice(0, 1)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black">{r.row.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{DEPARTMENT_CONFIG[r.row.department]?.label}</p>
                    </div>
                  </div>
                  <div>
                    <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                      เวลาปฏิบัติงาน · มา {r.row.attendedDays}/{r.row.workingDays} สาย {r.late} ขาด {r.absent}
                    </p>
                    <KpiBulletBar value={r.row.attendanceRate} />
                  </div>
                  <div>
                    <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                      เช็คชื่อรายวิชา · {r.row.completedSessions}/{r.row.expectedSessions} คาบ
                    </p>
                    <KpiBulletBar value={r.row.rollCallRate} />
                  </div>
                </button>
                {expanded === r.row.teacherId && expandedPanel(r)}
              </div>
            ))}
          </div>

          {/* เดสก์ท็อป: ตารางกริด (GradeTable pattern) */}
          <div className="hidden overflow-hidden rounded-2xl border border-border bg-card md:block">
            <div className={cn('grid items-center gap-3 border-b border-border bg-muted/30 px-4 py-3 text-[10px] font-black uppercase tracking-wider text-muted-foreground', GRID)}>
              <SortHead label="ครู" k="name" sort={sort} onSort={onSort} />
              <SortHead label="เวลาปฏิบัติงาน" k="attendance" sort={sort} onSort={onSort} />
              <SortHead label="เช็คชื่อรายวิชา" k="rollcall" sort={sort} onSort={onSort} />
              <SortHead label="วิชา" k="subjects" sort={sort} onSort={onSort} className="justify-center" />
            </div>
            {visible.map((r) => (
              <Fragment key={r.row.teacherId}>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setExpanded((cur) => (cur === r.row.teacherId ? null : r.row.teacherId))}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setExpanded((cur) => (cur === r.row.teacherId ? null : r.row.teacherId)); }}
                  className={cn('grid cursor-pointer items-center gap-3 border-b border-border px-4 py-3 last:border-b-0 hover:bg-muted/40', GRID)}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar className="size-9">
                      <AvatarImage src={r.row.photoURL} alt={r.row.name} className="object-cover" />
                      <AvatarFallback>{r.row.name.slice(0, 1)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">{r.row.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{DEPARTMENT_CONFIG[r.row.department]?.label}</p>
                    </div>
                  </div>
                  <div>
                    <KpiBulletBar value={r.row.attendanceRate} />
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      มา {r.row.attendedDays}/{r.row.workingDays} วัน · สาย {r.late} · ขาด {r.absent}
                    </p>
                  </div>
                  <div>
                    <KpiBulletBar value={r.row.rollCallRate} />
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      {r.row.completedSessions}/{r.row.expectedSessions} คาบ
                    </p>
                  </div>
                  <span className="text-center text-sm font-black tabular-nums">{subjectsOf(r).length}</span>
                </div>
                {expanded === r.row.teacherId && <div className="border-b border-border last:border-b-0">{expandedPanel(r)}</div>}
              </Fragment>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
