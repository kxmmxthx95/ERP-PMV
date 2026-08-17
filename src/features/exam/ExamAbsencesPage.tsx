// src/features/exam/ExamAbsencesPage.tsx
import { useMemo, useState } from 'react';
import { HiArrowPath, HiOutlineFunnel } from 'react-icons/hi2';
import { useAuth } from '@/hooks/useAuth';
import { useMissedExams } from '@/hooks/useMissedExams';
import type { MissedExamRow } from '@/lib/exam/fetchMissedExams';
import StudentAvatar from '@/features/students/components/StudentAvatar';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { HEADER_ICON_BTN, HEADER_ICON_BTN_GROUP } from '@/lib/headerIconBtn';
import { cn } from '@/lib/utils';

function SourceBadge({ source }: { source: MissedExamRow['source'] }) {
  return source === 'online' ? (
    <Badge variant="outline" className="text-primary border-primary/30 bg-primary/5">ออนไลน์</Badge>
  ) : (
    <Badge variant="outline" className="text-muted-foreground">ในห้อง</Badge>
  );
}

function MissedExamRowCard({ row, showStudent }: { row: MissedExamRow; showStudent: boolean }) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-border px-4 py-3 last:border-b-0 hover:bg-muted/40 md:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_minmax(0,1fr)_auto]">
      {showStudent ? (
        <div className="flex min-w-0 items-center gap-3">
          <StudentAvatar
            photoURL={undefined}
            studentId={row.studentId}
            name={row.studentName}
            className="h-9 w-9 shrink-0 rounded-full"
          />
          <div className="min-w-0">
            <p className="truncate text-[13px] font-bold text-foreground font-sukhumvit">{row.studentName}</p>
            <p className="truncate text-[11px] font-semibold text-muted-foreground font-sukhumvit tabular-nums">{row.studentCode || '—'}</p>
          </div>
        </div>
      ) : (
        <div className="min-w-0">
          <p className="truncate text-[13px] font-bold text-foreground font-sukhumvit">{row.title}</p>
          <p className="truncate text-[11px] font-semibold text-muted-foreground font-sukhumvit">{row.subjectName || '—'}</p>
        </div>
      )}
      <p className="hidden truncate text-[12px] font-semibold text-muted-foreground font-sukhumvit md:block">
        {showStudent ? row.subjectName : row.className ?? '—'}
      </p>
      <p className="hidden text-[12px] font-semibold text-muted-foreground font-sukhumvit tabular-nums md:block">
        {row.date ?? '—'}
      </p>
      <div className="flex items-center justify-end gap-1.5">
        <SourceBadge source={row.source} />
        {row.isExempt && (
          <Badge variant="secondary" className="bg-amber-500/10 text-amber-600">ยกเว้นแล้ว</Badge>
        )}
      </div>
    </div>
  );
}

function RowList({ rows, showStudent }: { rows: MissedExamRow[]; showStudent: boolean }) {
  if (rows.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        <p className="text-[13px] font-sarabun">ไม่พบรายการขาดสอบ</p>
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      {rows.map((row) => (
        <MissedExamRowCard key={row.id} row={row} showStudent={showStudent} />
      ))}
    </div>
  );
}

export default function ExamAbsencesPage() {
  const { role } = useAuth();
  const { data: rows = [], isLoading, refetch, isFetching } = useMissedExams();
  const [subjectFilter, setSubjectFilter] = useState<Set<string>>(new Set());

  const subjects = useMemo(
    () => [...new Set(rows.map((r) => r.subjectName).filter(Boolean))].sort(),
    [rows],
  );

  const filteredRows = useMemo(
    () => (subjectFilter.size === 0 ? rows : rows.filter((r) => subjectFilter.has(r.subjectName))),
    [rows, subjectFilter],
  );

  const rowsByRoom = useMemo(() => {
    const groups = new Map<string, MissedExamRow[]>();
    filteredRows.forEach((row) => {
      const key = `${row.source}-${row.title}`;
      groups.set(key, [...(groups.get(key) ?? []), row]);
    });
    return groups;
  }, [filteredRows]);

  const rowsByStudent = useMemo(() => {
    const groups = new Map<string, MissedExamRow[]>();
    filteredRows.forEach((row) => {
      groups.set(row.studentId, [...(groups.get(row.studentId) ?? []), row]);
    });
    return groups;
  }, [filteredRows]);

  const toggleSubject = (subject: string) => {
    setSubjectFilter((prev) => {
      const next = new Set(prev);
      if (next.has(subject)) next.delete(subject);
      else next.add(subject);
      return next;
    });
  };

  const isStudent = role === 'student';

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-black text-foreground font-sukhumvit">ตรวจสอบรายการขาดสอบ</h1>
          <p className="text-[12px] font-semibold text-muted-foreground font-sukhumvit">
            {isStudent ? 'รายวิชา/ห้องสอบที่คุณขาดสอบ' : 'นักเรียนที่ขาดสอบในห้องสอบ/วิชาที่คุณสอน'}
          </p>
        </div>
        <div className={cn('flex', HEADER_ICON_BTN_GROUP)}>
          {subjects.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className={HEADER_ICON_BTN} aria-label="กรองวิชา">
                  <HiOutlineFunnel className="h-4 w-4" />
                  {subjectFilter.size > 0 && (
                    <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-destructive" />
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {subjects.map((subject) => (
                  <DropdownMenuCheckboxItem
                    key={subject}
                    checked={subjectFilter.has(subject)}
                    onCheckedChange={() => toggleSubject(subject)}
                  >
                    {subject}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <button
            type="button"
            className={HEADER_ICON_BTN}
            aria-label="รีเฟรช"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <HiArrowPath className={cn('h-4 w-4', isFetching && 'animate-spin')} />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-slate-500" />
        </div>
      ) : isStudent ? (
        <RowList rows={filteredRows} showStudent={false} />
      ) : (
        <Tabs defaultValue="byRoom" className="flex flex-1 flex-col gap-3">
          <TabsList>
            <TabsTrigger value="byRoom">ดูตามห้อง</TabsTrigger>
            <TabsTrigger value="byStudent">ดูตามนักเรียน</TabsTrigger>
          </TabsList>
          <TabsContent value="byRoom" className="flex flex-col gap-3">
            {[...rowsByRoom.entries()].map(([key, groupRows]) => (
              <div key={key} className="flex flex-col gap-1.5">
                <p className="px-1 text-[12px] font-black text-foreground font-sukhumvit">
                  {groupRows[0].title} · {groupRows[0].subjectName || '—'}
                </p>
                <RowList rows={groupRows} showStudent />
              </div>
            ))}
            {rowsByRoom.size === 0 && <RowList rows={[]} showStudent />}
          </TabsContent>
          <TabsContent value="byStudent" className="flex flex-col gap-3">
            {[...rowsByStudent.entries()].map(([studentId, groupRows]) => (
              <div key={studentId} className="flex flex-col gap-1.5">
                <p className="px-1 text-[12px] font-black text-foreground font-sukhumvit">
                  {groupRows[0].studentName} ({groupRows[0].studentCode || '—'})
                </p>
                <RowList rows={groupRows} showStudent={false} />
              </div>
            ))}
            {rowsByStudent.size === 0 && <RowList rows={[]} showStudent={false} />}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
