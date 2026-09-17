// src/features/classAttendanceReport/ClassAttendanceReportPage.tsx
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { getLocalDateString } from '@/lib/calendar/schoolDay';
import { cn } from '@/lib/utils';
import { useClassAttendanceReport, type ClassAttendanceReportRow } from './useClassAttendanceReport';

function formatCheckedTime(row: ClassAttendanceReportRow): string {
  if (!row.checkedAt) return '—';
  return row.checkedAt.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
}

function StatusBadge({ status }: { status: ClassAttendanceReportRow['status'] }) {
  return (
    <span
      className={cn(
        'inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold font-sukhumvit',
        status === 'checked'
          ? 'bg-emerald-500/10 text-emerald-600'
          : 'bg-amber-500/10 text-amber-600',
      )}
    >
      {status === 'checked' ? 'เช็คแล้ว' : 'ยังไม่เช็ค'}
    </span>
  );
}

function RowCard({ row }: { row: ClassAttendanceReportRow }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[13px] font-bold text-foreground font-sukhumvit">{row.teacherName}</p>
          <p className="truncate text-[12px] font-semibold text-muted-foreground font-sukhumvit">
            {row.subjectName} · {row.classId}
          </p>
        </div>
        <StatusBadge status={row.status} />
      </div>
      <div className="mt-2.5 flex items-center justify-between border-t border-border pt-2">
        <p className="text-[11px] font-bold text-muted-foreground font-sukhumvit">
          คาบ {row.period} {row.periodTime ? `(${row.periodTime})` : ''}
        </p>
        <p className="text-[13px] font-black text-foreground font-sukhumvit tabular-nums">
          {formatCheckedTime(row)}
        </p>
      </div>
    </div>
  );
}

const TABLE_GRID = 'minmax(0,1.6fr) minmax(0,1.4fr) minmax(0,1.2fr) minmax(5.5rem,0.7fr) minmax(5rem,0.6fr)';

export default function ClassAttendanceReportPage() {
  const [date, setDate] = useState(() => getLocalDateString());
  const { rows, isLoading } = useClassAttendanceReport(date);

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-black text-foreground font-sukhumvit">รายงานเช็คชื่อเข้าชั้นเรียน</h1>
          <p className="text-[12px] font-semibold text-muted-foreground font-sukhumvit">
            เวลาที่ครูเช็คชื่อนักเรียนในแต่ละคาบของวันที่เลือก
          </p>
        </div>
        <Input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="h-10 w-auto rounded-xl border-none bg-slate-50/70 text-xs font-bold"
        />
      </div>

      {isLoading ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-slate-500" />
        </div>
      ) : (
        <>
          {/* Mobile: cards */}
          <div className="flex flex-col gap-2.5 md:hidden">
            {rows.map((row) => <RowCard key={row.scheduleId} row={row} />)}
            {rows.length === 0 && (
              <div className="py-12 text-center text-muted-foreground">
                <p className="text-[13px] font-sarabun">ไม่มีคาบสอนในวันนี้</p>
              </div>
            )}
          </div>

          {/* Desktop: grid table */}
          <div className="hidden rounded-2xl border border-border bg-card overflow-hidden md:block">
            <div
              className="grid gap-3 border-b border-border bg-background px-4 py-3"
              style={{ gridTemplateColumns: TABLE_GRID }}
            >
              <span className="text-[13px] font-black text-foreground font-sukhumvit">ครู</span>
              <span className="text-[13px] font-black text-foreground font-sukhumvit">วิชา</span>
              <span className="text-[13px] font-black text-foreground font-sukhumvit">ห้อง/คาบ</span>
              <span className="text-[13px] font-black text-foreground font-sukhumvit">เวลาเช็คชื่อ</span>
              <span className="text-[13px] font-black text-foreground font-sukhumvit">สถานะ</span>
            </div>
            <div className="flex flex-col">
              {rows.map((row) => (
                <div
                  key={row.scheduleId}
                  className="grid items-center gap-3 border-b border-border px-4 py-3 last:border-b-0 hover:bg-muted/40"
                  style={{ gridTemplateColumns: TABLE_GRID }}
                >
                  <span className="truncate text-[13px] font-bold text-foreground font-sukhumvit">{row.teacherName}</span>
                  <span className="truncate text-[13px] font-semibold text-muted-foreground font-sukhumvit">
                    {row.subjectName}
                  </span>
                  <span className="truncate text-[13px] font-semibold text-muted-foreground font-sukhumvit">
                    {row.classId} · คาบ {row.period}
                  </span>
                  <span className="text-[13px] font-black text-foreground font-sukhumvit tabular-nums">
                    {formatCheckedTime(row)}
                  </span>
                  <StatusBadge status={row.status} />
                </div>
              ))}
              {rows.length === 0 && (
                <div className="py-12 text-center text-muted-foreground">
                  <p className="text-[13px] font-sarabun">ไม่มีคาบสอนในวันนี้</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
