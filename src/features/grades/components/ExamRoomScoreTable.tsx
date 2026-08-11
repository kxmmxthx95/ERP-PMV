import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { HiChevronLeft, HiChevronRight } from 'react-icons/hi2';
import { Button } from '@/components/ui/button';
import StudentAvatar from '@/features/students/components/StudentAvatar';
import { computeMeanSd, toTScore } from '@/lib/academicStats/tScore';
import { percentScoreStyle } from '@/types/grades';
import { cn } from '@/lib/utils';

export type ExamRoomScoreStatus = 'graded' | 'submitted' | 'none' | 'absent' | 'present';

export type ExamRoomScoreRow = {
  studentId: string;
  studentName: string;
  studentCode: string;
  photoURL?: string;
  gender?: 'male' | 'female';
  status: ExamRoomScoreStatus;
  /** คะแนนดิบ % จากห้องสอบ */
  scorePercent: number | null;
};

/** percent = คะแนนดิบ · tScore = T ในห้องนี้ */
export type ExamRoomScoreMode = 'percent' | 'tScore';

const TABLE_SHELL = 'rounded-2xl border border-border bg-card overflow-hidden';
const TABLE_HEADER_CELL = 'text-[13px] font-black text-foreground font-sukhumvit whitespace-nowrap';
const TABLE_GRID = 'minmax(4.5rem, 0.7fr) minmax(0, 2.2fr) minmax(0, 1fr) minmax(5rem, 0.85fr)';
const LOW_SCORE_ROW = 'bg-destructive/5';
const DEFAULT_PAGE_SIZE = 10;

function ExamStatusBadge({ status }: { status: ExamRoomScoreStatus }) {
  if (status === 'graded') {
    return (
      <span className="inline-flex rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-bold text-primary font-sukhumvit">
        ตรวจแล้ว
      </span>
    );
  }
  if (status === 'submitted') {
    return (
      <span className="inline-flex rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold text-emerald-600 font-sukhumvit">
        ส่งแล้ว
      </span>
    );
  }
  if (status === 'absent') {
    return (
      <span className="inline-flex rounded-full bg-destructive/10 px-2.5 py-0.5 text-[10px] font-bold text-destructive font-sukhumvit">
        ขาดสอบ
      </span>
    );
  }
  if (status === 'present') {
    return (
      <span className="inline-flex rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold text-emerald-600 font-sukhumvit">
        เข้าสอบ
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-bold text-muted-foreground font-sukhumvit">
      ไม่มีข้อมูล
    </span>
  );
}

function isLowScore(value: number | null): boolean {
  return value !== null && value < 50;
}

function formatDisplay(value: number, showPercent: boolean): string {
  if (showPercent) return `${Math.round(value * 10) / 10}%`;
  return `${Math.round(value * 10) / 10}`;
}

function ScoreCell({
  display,
  rawPct,
  showPercent,
  size,
}: {
  display: number | null;
  rawPct: number | null;
  showPercent: boolean;
  size: 'sm' | 'md';
}) {
  if (display == null) {
    return (
      <span
        className={cn(
          'font-bold text-muted-foreground/40',
          size === 'md' ? 'text-[12px]' : 'text-[13px] font-sarabun',
        )}
      >
        —
      </span>
    );
  }

  const title = showPercent
    ? undefined
    : (rawPct != null ? `คะแนนดิบ ${Math.round(rawPct * 10) / 10}%` : undefined);

  if (showPercent) {
    return (
      <span
        className={cn(
          'font-black font-sukhumvit tabular-nums',
          size === 'md' ? 'text-[14px]' : 'text-[13px]',
        )}
        style={{ color: percentScoreStyle(display).text }}
      >
        {formatDisplay(display, true)}
      </span>
    );
  }

  return (
    <span
      className={cn(
        'font-black font-sukhumvit tabular-nums',
        size === 'md' ? 'text-[14px]' : 'text-[13px]',
        display >= 50 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive',
      )}
      title={title}
    >
      {formatDisplay(display, false)}
    </span>
  );
}

interface Props {
  rows: ExamRoomScoreRow[];
  /** แถวต่อหน้า — default 10; ใส่ 0 = แสดงทั้งหมดไม่แบ่งหน้า */
  pageSize?: number;
  /** override desktop table shell (เช่น border-x-0 เมื่อซ้อนใน card) */
  className?: string;
  /** default percent · tScore = แปลง T เทียบในตารางนี้ */
  scoreMode?: ExamRoomScoreMode;
}

export default function ExamRoomScoreTable({
  rows,
  pageSize = DEFAULT_PAGE_SIZE,
  className,
  scoreMode = 'percent',
}: Props) {
  const [page, setPage] = useState(1);
  const showPercent = scoreMode === 'percent';
  const paginate = pageSize > 0;
  const totalPages = paginate ? Math.max(1, Math.ceil(rows.length / pageSize)) : 1;
  const safePage = Math.min(page, totalPages);
  const pageRows = paginate
    ? rows.slice((safePage - 1) * pageSize, safePage * pageSize)
    : rows;

  const displayById = useMemo(() => {
    const map = new Map<string, number | null>();
    if (showPercent) {
      rows.forEach((r) => map.set(r.studentId, r.scorePercent));
      return map;
    }
    const vals = rows
      .map((r) => r.scorePercent)
      .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
    const stats = computeMeanSd(vals);
    rows.forEach((r) => {
      map.set(
        r.studentId,
        r.scorePercent != null ? toTScore(r.scorePercent, stats) : null,
      );
    });
    return map;
  }, [rows, showPercent]);

  const scoreHeader = showPercent ? 'คะแนน (%)' : 'T-Score';

  useEffect(() => {
    setPage(1);
  }, [rows.length, rows[0]?.studentId, rows[rows.length - 1]?.studentId, scoreMode]);

  return (
    <div className="flex flex-col gap-3">
      {/* Mobile */}
      <div className="flex flex-col gap-2.5 px-0.5 md:hidden">
        {pageRows.map((row, i) => {
          const display = displayById.get(row.studentId) ?? null;
          return (
            <motion.div
              key={row.studentId}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.02 }}
              className="px-0.5 py-0.5"
            >
              <div
                className={cn(
                  'rounded-2xl border border-border bg-card p-3',
                  row.status === 'absent' && 'bg-destructive/5',
                  row.status !== 'absent' && isLowScore(display) && LOW_SCORE_ROW,
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <StudentAvatar
                      photoURL={row.photoURL}
                      studentId={row.studentId}
                      name={row.studentName}
                      gender={row.gender}
                      className="h-9 w-9 shrink-0 rounded-full"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-bold text-foreground font-sukhumvit" title={row.studentName}>
                        {row.studentName}
                      </p>
                      <p className="mt-0.5 text-[12px] font-semibold text-muted-foreground font-sukhumvit tabular-nums">
                        {row.studentCode || '—'}
                      </p>
                    </div>
                  </div>
                  <ExamStatusBadge status={row.status} />
                </div>
                <div className="mt-2.5 flex items-center justify-between border-t border-border pt-2">
                  <p className="text-[11px] font-bold text-muted-foreground font-sukhumvit">{scoreHeader}</p>
                  <ScoreCell
                    display={display}
                    rawPct={row.scorePercent}
                    showPercent={showPercent}
                    size="md"
                  />
                </div>
              </div>
            </motion.div>
          );
        })}
        {rows.length === 0 && (
          <div className="py-12 text-center text-muted-foreground">
            <p className="text-[13px] font-sarabun">ยังไม่มีข้อมูลนักเรียน</p>
          </div>
        )}
      </div>

      {/* Desktop */}
      <div className={cn('hidden md:block', TABLE_SHELL, className)}>
        <div
          className="grid gap-3 border-b border-border bg-background px-4 py-3"
          style={{ gridTemplateColumns: TABLE_GRID }}
        >
          <span className={TABLE_HEADER_CELL}>รหัส</span>
          <span className={TABLE_HEADER_CELL}>นักเรียน</span>
          <span className={cn(TABLE_HEADER_CELL, 'text-center')}>สถานะ</span>
          <span className={cn(TABLE_HEADER_CELL, 'text-center')}>{scoreHeader}</span>
        </div>
        <div className="flex flex-col">
          {pageRows.map((row, i) => {
            const display = displayById.get(row.studentId) ?? null;
            return (
              <motion.div
                key={row.studentId}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.015 }}
                className={cn(
                  'grid items-center gap-3 border-b border-border px-4 py-3 transition-colors last:border-b-0 hover:bg-muted/40',
                  row.status === 'absent' && 'bg-destructive/5',
                  row.status !== 'absent' && isLowScore(display) && LOW_SCORE_ROW,
                )}
                style={{ gridTemplateColumns: TABLE_GRID }}
              >
                <span className="truncate text-[13px] font-black text-foreground font-sukhumvit tabular-nums">
                  {row.studentCode || '—'}
                </span>
                <div className="flex min-w-0 items-center gap-3">
                  <StudentAvatar
                    photoURL={row.photoURL}
                    studentId={row.studentId}
                    name={row.studentName}
                    gender={row.gender}
                    className="h-9 w-9 shrink-0 rounded-full"
                  />
                  <p className="truncate text-[13px] font-bold text-foreground font-sukhumvit">{row.studentName}</p>
                </div>
                <div className="flex justify-center">
                  <ExamStatusBadge status={row.status} />
                </div>
                <div className="text-center">
                  <ScoreCell
                    display={display}
                    rawPct={row.scorePercent}
                    showPercent={showPercent}
                    size="sm"
                  />
                </div>
              </motion.div>
            );
          })}
          {rows.length === 0 && (
            <div className="py-12 text-center text-muted-foreground">
              <p className="text-[13px] font-sarabun">ยังไม่มีข้อมูลนักเรียน</p>
            </div>
          )}
        </div>
      </div>

      {paginate && rows.length > pageSize ? (
        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-border pt-3">
          <p className="text-[11px] font-bold text-muted-foreground">
            {(safePage - 1) * pageSize + 1}
            –
            {Math.min(safePage * pageSize, rows.length)}
            {' '}จาก {rows.length}
          </p>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="rounded-xl"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              aria-label="หน้าก่อน"
            >
              <HiChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[4.5rem] text-center text-[11px] font-black tabular-nums text-foreground">
              {safePage} / {totalPages}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="rounded-xl"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              aria-label="หน้าถัดไป"
            >
              <HiChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
