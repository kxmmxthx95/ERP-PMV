import { motion } from 'framer-motion';
import StudentAvatar from '@/features/students/components/StudentAvatar';
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
  scorePercent: number | null;
};

const TABLE_SHELL = 'rounded-2xl border border-border bg-card overflow-hidden';
const TABLE_HEADER_CELL = 'text-[13px] font-black text-foreground font-sukhumvit whitespace-nowrap';
const TABLE_GRID = 'minmax(4.5rem, 0.7fr) minmax(0, 2.2fr) minmax(0, 1fr) minmax(5rem, 0.85fr)';
const LOW_SCORE_ROW = 'bg-destructive/5';

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

function isLowScore(scorePercent: number | null): boolean {
  return scorePercent !== null && scorePercent < 50;
}

interface Props {
  rows: ExamRoomScoreRow[];
}

export default function ExamRoomScoreTable({ rows }: Props) {
  return (
    <div className="flex flex-col gap-3">
      {/* Mobile */}
      <div className="flex flex-col gap-2.5 px-0.5 md:hidden">
        {rows.map((row, i) => (
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
                row.status !== 'absent' && isLowScore(row.scorePercent) && LOW_SCORE_ROW,
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
                <p className="text-[11px] font-bold text-muted-foreground font-sukhumvit">คะแนน (%)</p>
                {row.scorePercent !== null ? (
                  <span
                    className="text-[14px] font-black font-sukhumvit tabular-nums"
                    style={{ color: percentScoreStyle(row.scorePercent).text }}
                  >
                    {row.scorePercent}%
                  </span>
                ) : (
                  <span className="text-[12px] font-bold text-muted-foreground/40">—</span>
                )}
              </div>
            </div>
          </motion.div>
        ))}
        {rows.length === 0 && (
          <div className="py-12 text-center text-muted-foreground">
            <p className="text-[13px] font-sarabun">ยังไม่มีข้อมูลนักเรียน</p>
          </div>
        )}
      </div>

      {/* Desktop */}
      <div className={cn('hidden md:block', TABLE_SHELL)}>
        <div
          className="grid gap-3 border-b border-border bg-background px-4 py-3"
          style={{ gridTemplateColumns: TABLE_GRID }}
        >
          <span className={TABLE_HEADER_CELL}>รหัส</span>
          <span className={TABLE_HEADER_CELL}>นักเรียน</span>
          <span className={cn(TABLE_HEADER_CELL, 'text-center')}>สถานะ</span>
          <span className={cn(TABLE_HEADER_CELL, 'text-center')}>คะแนน (%)</span>
        </div>
        <div className="flex flex-col">
          {rows.map((row, i) => (
            <motion.div
              key={row.studentId}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.015 }}
              className={cn(
                'grid items-center gap-3 border-b border-border px-4 py-3 transition-colors last:border-b-0 hover:bg-muted/40',
                row.status === 'absent' && 'bg-destructive/5',
                row.status !== 'absent' && isLowScore(row.scorePercent) && LOW_SCORE_ROW,
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
                {row.scorePercent !== null ? (
                  <span
                    className="text-[13px] font-black font-sukhumvit tabular-nums"
                    style={{ color: percentScoreStyle(row.scorePercent).text }}
                  >
                    {row.scorePercent}%
                  </span>
                ) : (
                  <span className="text-[13px] text-muted-foreground/40 font-sarabun">—</span>
                )}
              </div>
            </motion.div>
          ))}
          {rows.length === 0 && (
            <div className="py-12 text-center text-muted-foreground">
              <p className="text-[13px] font-sarabun">ยังไม่มีข้อมูลนักเรียน</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
