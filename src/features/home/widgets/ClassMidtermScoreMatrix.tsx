import { useMemo, useState } from 'react';
import {
  HiChevronDown,
  HiChevronUp,
  HiOutlineExclamationTriangle,
  HiOutlineQuestionMarkCircle,
} from 'react-icons/hi2';
import StudentAvatar from '@/features/students/components/StudentAvatar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { HEADER_ICON_BTN } from '@/lib/headerIconBtn';
import { mapScoresToTScores } from '@/lib/academicStats/tScore';
import { cn } from '@/lib/utils';
import type {
  ClassMidtermReportDoc,
  ClassMidtermReportStudent,
} from '@/types/classMidtermReport';

const TABLE_HEADER_CELL = 'text-[13px] font-black text-foreground font-sukhumvit';
const TABLE_HEADER_SUBJECT =
  'text-center text-[12px] font-black uppercase tracking-wide text-foreground font-sukhumvit whitespace-nowrap';

type SortKey = 'name' | 'avg' | string;
type SortDir = 'asc' | 'desc';

/** T-Score: ≥50 = เหนือ/เท่าค่าเฉลี่ยกลุ่ม */
function tScoreTone(t: number | null | undefined): string {
  if (t == null) return 'text-muted-foreground/40';
  if (t >= 50) return 'text-emerald-600 dark:text-emerald-400';
  return 'text-destructive';
}

function formatTScore(t: number | null | undefined): string {
  if (t == null) return '—';
  return `${Math.round(t * 10) / 10}`;
}

/** ค่าเฉลี่ย T-Score เฉพาะวิชาที่มีค่า */
function avgTScore(
  scores: Record<string, number | null>,
  columnKeys: string[],
): number | null {
  const vals = columnKeys
    .map((k) => scores[k])
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  if (vals.length === 0) return null;
  return Math.round((vals.reduce((s, n) => s + n, 0) / vals.length) * 10) / 10;
}

function pctTone(pct: number | null | undefined): string {
  if (pct == null) return 'text-muted-foreground/40';
  if (pct >= 50) return 'text-emerald-600 dark:text-emerald-400';
  return 'text-destructive';
}

function formatPct(pct: number | null | undefined): string {
  if (pct == null) return '—';
  return `${Math.round(pct * 10) / 10}`;
}

export type ClassMidtermScoreMode = 'tScore' | 'percent';

/** ชื่อไทย (สาระย่อย/หลัก/วิชา) → ตัวย่ออังกฤษ 3–4 ตัว สำหรับหัวตาราง */
const SUBJECT_HEADER_ABBR: Record<string, string> = {
  // สาระหลัก
  ภาษาไทย: 'THAI',
  คณิตศาสตร์: 'MATH',
  วิทยาศาสตร์และเทคโนโลยี: 'SCI',
  'สังคมศึกษา ศาสนา และวัฒนธรรม': 'SOC',
  สุขศึกษาและพลศึกษา: 'HPE',
  ศิลปะ: 'ARTS',
  การงานอาชีพ: 'CARE',
  ภาษาต่างประเทศ: 'LANG',
  'สอบเข้า ม.4': 'ADM',
  'O-NET': 'ONET',
  'A-LEVEL': 'ALVL',
  'อื่นๆ / กิจกรรม': 'OTH',
  // สาระย่อย
  วิทยาศาสตร์ทั่วไป: 'GSCI',
  ฟิสิกส์: 'PHYS',
  เคมี: 'CHEM',
  ชีววิทยา: 'BIO',
  'โลก ดาราศาสตร์ และอวกาศ': 'ASTR',
  วิทยาการคำนวณ: 'COMP',
  คณิตศาสตร์พื้นฐาน: 'MBAS',
  คณิตศาสตร์เพิ่มเติม: 'MEXT',
  ภาษาอังกฤษ: 'ENG',
  ภาษาจีน: 'CHIN',
  ภาษาญี่ปุ่น: 'JPN',
  ภาษาฝรั่งเศส: 'FRN',
  'ศาสนา ศีลธรรม จริยธรรม': 'REL',
  หน้าที่พลเมือง: 'CIV',
  เศรษฐศาสตร์: 'ECON',
  ประวัติศาสตร์: 'HIST',
  ภูมิศาสตร์: 'GEOG',
};

const SUBJECT_GROUP_ID_ABBR: Record<string, string> = {
  thai: 'THAI',
  math: 'MATH',
  science: 'SCI',
  social: 'SOC',
  pe: 'HPE',
  arts: 'ARTS',
  careers: 'CARE',
  foreign: 'LANG',
  examM4: 'ADM',
  onet: 'ONET',
  alevel: 'ALVL',
  other: 'OTH',
};

/** ชื่อเต็มไทย — ใช้ tooltip / mobile */
function columnHeaderFullLabel(col: {
  label: string;
  subjectName?: string;
  subjectGroup?: string;
  subSubjectGroup?: string;
}): string {
  const sub = col.subSubjectGroup?.trim();
  if (sub && sub !== '—') return sub;
  const main = col.subjectGroup?.trim();
  if (main && main !== '—') return main;
  const label = col.label?.trim();
  if (label && label !== '—') return label;
  return col.subjectName?.trim() || '—';
}

/** หัวตาราง = ตัวย่อ EN 3–4 ตัว */
function columnHeaderLabel(col: {
  label: string;
  subjectId?: string;
  subjectName?: string;
  subjectGroupId?: string;
  subjectGroup?: string;
  subSubjectGroup?: string;
}): string {
  const candidates = [
    col.subSubjectGroup,
    col.subjectGroup,
    col.label,
    col.subjectName,
  ];
  for (const raw of candidates) {
    const key = raw?.trim();
    if (!key || key === '—') continue;
    const abbr = SUBJECT_HEADER_ABBR[key];
    if (abbr) return abbr;
  }
  const gid = col.subjectGroupId?.trim();
  if (gid && SUBJECT_GROUP_ID_ABBR[gid]) return SUBJECT_GROUP_ID_ABBR[gid];

  // fallback: ตัดอักษรอังกฤษที่มีอยู่แล้ว / ไม่รู้จัก → OTH
  const full = columnHeaderFullLabel(col);
  const latin = full.replace(/[^A-Za-z]/g, '').toUpperCase();
  if (latin.length >= 3) return latin.slice(0, 4);
  return 'OTH';
}

/** แยกคำท้ายเป็นนามสกุล — บรรทัดบน = คำนำหน้า+ชื่อ */
function splitFullName(fullName: string): { given: string; family: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return { given: fullName.trim() || '—', family: '' };
  return {
    given: parts.slice(0, -1).join(' '),
    family: parts[parts.length - 1],
  };
}

function StudentNameCell({
  fullName,
  studentCode,
}: {
  fullName: string;
  studentCode?: string;
}) {
  const { given, family } = splitFullName(fullName);
  return (
    <div className="min-w-0 leading-snug">
      <p className="truncate text-[13px] font-bold text-foreground font-sukhumvit">{given}</p>
      {family ? (
        <p className="truncate text-[13px] font-bold text-foreground font-sukhumvit">{family}</p>
      ) : null}
      <p className="text-[12px] font-black text-muted-foreground font-sukhumvit tabular-nums">
        {studentCode || '—'}
      </p>
    </div>
  );
}

function compareNullable(a: number | null, b: number | null, dir: SortDir): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return dir === 'desc' ? b - a : a - b;
}

function SortHeaderButton({
  label,
  title,
  active,
  dir,
  onClick,
  className,
  align = 'center',
}: {
  label: string;
  title?: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
  className?: string;
  align?: 'left' | 'center';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title ?? `${label} — คลิกเรียงคะแนน`}
      className={cn(
        'inline-flex max-w-full min-w-0 items-center gap-0.5 rounded-md px-0.5 py-0.5 transition-colors hover:bg-muted/60',
        align === 'center' ? 'justify-center' : 'justify-start',
        active && 'text-primary',
        className,
      )}
    >
      <span className="min-w-0 truncate uppercase tracking-wide leading-snug">
        {label}
      </span>
      <span className="inline-flex shrink-0 flex-col leading-none" aria-hidden>
        <HiChevronUp
          className={cn(
            '-mb-0.5 h-3 w-3',
            active && dir === 'asc' ? 'text-primary' : 'text-muted-foreground/35',
          )}
        />
        <HiChevronDown
          className={cn(
            '-mt-0.5 h-3 w-3',
            active && dir === 'desc' ? 'text-primary' : 'text-muted-foreground/35',
          )}
        />
      </span>
    </button>
  );
}

function buildAbbrLegend(
  columns: ClassMidtermReportDoc['columns'],
): { abbr: string; full: string }[] {
  const seen = new Set<string>();
  const rows: { abbr: string; full: string }[] = [];
  for (const col of columns) {
    const abbr = columnHeaderLabel(col);
    const full = columnHeaderFullLabel(col);
    const key = `${abbr}\0${full}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({ abbr, full });
  }
  rows.push({ abbr: 'AVG', full: 'ค่าเฉลี่ย T-Score ของแถว' });
  rows.push({ abbr: 'T', full: 'T-Score = 50 + 10×(คะแนน−ค่าเฉลี่ย)/SD ในห้อง' });
  return rows;
}

/** ปุ่ม ? + popup คำอธิบายตัวย่อสาระ — วางใน toolbar ของกรอบตาราง */
export function ClassMidtermAbbrHelp({
  columns,
}: {
  columns: ClassMidtermReportDoc['columns'];
}) {
  const abbrLegend = useMemo(() => buildAbbrLegend(columns), [columns]);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={HEADER_ICON_BTN}
          title="คำอธิบายตัวย่อสาระ"
          aria-label="คำอธิบายตัวย่อสาระ"
        >
          <HiOutlineQuestionMarkCircle size={16} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 gap-3 rounded-2xl p-4 font-sukhumvit">
        <p className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">
          คำอธิบายตัวย่อ · T-Score
        </p>
        <ul className="flex max-h-64 flex-col gap-2 overflow-y-auto scrollbar-hide">
          {abbrLegend.map((row) => (
            <li
              key={`${row.abbr}-${row.full}`}
              className="flex items-baseline gap-3 text-[13px]"
            >
              <span className="w-12 shrink-0 font-black uppercase tracking-wide text-foreground">
                {row.abbr}
              </span>
              <span className="min-w-0 font-bold text-muted-foreground">{row.full}</span>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

type DisplayStudent = ClassMidtermReportStudent & {
  tScores: Record<string, number | null>;
};

export function ClassMidtermScoreMatrix({
  report,
  scoreMode = 'tScore',
}: {
  report: ClassMidtermReportDoc;
  /** tScore = ค่ามาตรฐาน · percent = คะแนนดิบ % */
  scoreMode?: ClassMidtermScoreMode;
}) {
  const { columns, students } = report;
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const showPercent = scoreMode === 'percent';

  const columnKeys = useMemo(() => columns.map((c) => c.key), [columns]);

  /** คะแนนดิบ % → T-Score เทียบในห้องต่อคอลัมน์ */
  const displayStudents = useMemo((): DisplayStudent[] => {
    const { tScoresByStudent } = mapScoresToTScores(students, columnKeys);
    return students.map((s, i) => ({
      ...s,
      tScores: tScoresByStudent[i] ?? {},
    }));
  }, [students, columnKeys]);

  const scoreOf = (row: DisplayStudent, key: string): number | null =>
    showPercent ? (row.scores[key] ?? null) : (row.tScores[key] ?? null);

  const avgOf = (row: DisplayStudent): number | null =>
    showPercent ? avgTScore(row.scores, columnKeys) : avgTScore(row.tScores, columnKeys);

  const toneOf = (v: number | null | undefined) =>
    showPercent ? pctTone(v) : tScoreTone(v);

  const formatOf = (v: number | null | undefined) =>
    showPercent ? formatPct(v) : formatTScore(v);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
      return;
    }
    setSortKey(key);
    setSortDir(key === 'name' ? 'asc' : 'desc');
  };

  const sortedStudents = useMemo(() => {
    const rows = [...displayStudents];
    const valueAt = (row: DisplayStudent, key: string): number | null =>
      showPercent ? (row.scores[key] ?? null) : (row.tScores[key] ?? null);
    const avgAt = (row: DisplayStudent): number | null =>
      avgTScore(showPercent ? row.scores : row.tScores, columnKeys);

    rows.sort((a, b) => {
      if (sortKey === 'name') {
        const byCode = a.studentCode.localeCompare(b.studentCode, 'th', { numeric: true });
        if (byCode !== 0) return sortDir === 'asc' ? byCode : -byCode;
        const byName = a.fullName.localeCompare(b.fullName, 'th');
        return sortDir === 'asc' ? byName : -byName;
      }
      if (sortKey === 'avg') {
        return compareNullable(avgAt(a), avgAt(b), sortDir);
      }
      return compareNullable(valueAt(a, sortKey), valueAt(b, sortKey), sortDir);
    });
    return rows;
  }, [displayStudents, sortKey, sortDir, columnKeys, showPercent]);

  if (columns.length === 0 && students.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
        <HiOutlineExclamationTriangle className="h-8 w-8 text-muted-foreground/50" />
        <p className="text-[13px] font-bold text-muted-foreground font-sarabun">
          ยังไม่มีคะแนนกลางภาคในห้องนี้
        </p>
        <p className="text-[11px] font-bold text-muted-foreground/70">
          กดรีเฟรชสรุปหลังมีห้องสอบที่เชื่อมกลางภาค
        </p>
      </div>
    );
  }

  const studentColW = '12rem';
  const subjectColW = 'minmax(4.75rem,1fr)';
  const avgColW = '5.5rem';
  const gapRem = 0.75; // gap-3
  const trackCount = columns.length + 2; // student + subjects + avg
  const subjectTracks = columns.map(() => subjectColW).join(' ');
  const gridTemplate = `${studentColW} ${subjectTracks} ${avgColW}`.trim();
  const tableMinWidth = `calc(${studentColW} + ${columns.length} * 4.75rem + ${avgColW} + ${trackCount - 1} * ${gapRem}rem)`;

  const stickyStudent =
    'sticky left-0 z-10 flex min-h-0 min-w-0 items-center gap-3 self-stretch pl-2.5 pr-2';
  const stickyHeader =
    'sticky top-0 left-0 z-30 flex min-h-0 items-center self-stretch bg-background pl-2.5 pr-2';
  const stickyAvg =
    'sticky right-0 z-10 flex min-h-0 items-center justify-center self-stretch px-2';
  const stickyAvgHeader =
    'sticky top-0 right-0 z-30 flex min-h-0 items-center justify-center self-stretch bg-background px-2';

  const renderRow = (row: DisplayStudent) => {
    const avg = avgOf(row);
    const isHot = showPercent
      ? avg != null && avg >= 80
      : avg != null && avg >= 60;
    const stickyBg = isHot
      ? 'bg-emerald-50 group-hover:bg-emerald-100 dark:bg-emerald-950 dark:group-hover:bg-emerald-900'
      : 'bg-card group-hover:bg-muted';
    return (
      <div
        key={row.studentId}
        className={cn(
          'group isolate grid w-full items-stretch gap-3 border-b border-border px-0 py-3 last:border-b-0 transition-colors',
          isHot
            ? 'bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950 dark:hover:bg-emerald-900'
            : 'bg-card hover:bg-muted',
        )}
        style={{ gridTemplateColumns: gridTemplate }}
      >
        <div className={cn(stickyStudent, stickyBg, 'transition-colors')}>
          <StudentAvatar
            studentId={row.studentId}
            name={row.fullName}
            photoURL={row.photoURL}
            className="h-9 w-9 shrink-0 rounded-full"
          />
          <div className="min-w-0">
            <StudentNameCell fullName={row.fullName} studentCode={row.studentCode} />
          </div>
        </div>
        {columns.map((col) => {
          const v = scoreOf(row, col.key);
          const raw = row.scores[col.key];
          const t = row.tScores[col.key];
          return (
            <span
              key={col.key}
              className={cn(
                'flex w-full items-center justify-center text-[13px] font-black tabular-nums font-sukhumvit',
                toneOf(v),
              )}
              title={
                showPercent
                  ? (t != null ? `T-Score ${formatTScore(t)}` : undefined)
                  : (raw != null ? `คะแนนดิบ ${formatPct(raw)}%` : undefined)
              }
            >
              {formatOf(v)}
              {showPercent && v != null ? '%' : ''}
            </span>
          );
        })}
        <span
          className={cn(
            stickyAvg,
            stickyBg,
            'text-[13px] font-black tabular-nums font-sukhumvit transition-colors',
            toneOf(avg),
          )}
        >
          {formatOf(avg)}
          {showPercent && avg != null ? '%' : ''}
        </span>
      </div>
    );
  };

  const avgHeaderLabel = showPercent ? 'AVG' : 'AVG T';
  const avgHeaderTitle = showPercent
    ? 'คะแนนเฉลี่ย % — คลิกเรียงสูง↔ต่ำ'
    : 'ค่าเฉลี่ย T-Score — คลิกเรียงสูง↔ต่ำ';

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col">
      <div className="flex flex-col gap-3 overflow-y-auto p-2.5 scrollbar-hide md:hidden">
        {sortedStudents.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            <p className="text-[13px] font-sarabun">ยังไม่มีข้อมูลนักเรียน</p>
          </div>
        ) : (
          sortedStudents.map((row) => {
            const avg = avgOf(row);
            const isHot = showPercent
              ? avg != null && avg >= 80
              : avg != null && avg >= 60;
            return (
              <div
                key={row.studentId}
                className={cn(
                  'rounded-xl border p-3',
                  isHot
                    ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950'
                    : 'border-border bg-background',
                )}
              >
                <div className="flex items-center gap-3">
                  <StudentAvatar
                    studentId={row.studentId}
                    name={row.fullName}
                    photoURL={row.photoURL}
                    className="h-9 w-9 shrink-0 rounded-full"
                  />
                  <div className="min-w-0 flex-1">
                    <StudentNameCell fullName={row.fullName} studentCode={row.studentCode} />
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                      {avgHeaderLabel}
                    </p>
                    <p className={cn('text-[13px] font-black tabular-nums font-sukhumvit', toneOf(avg))}>
                      {formatOf(avg)}
                      {showPercent && avg != null ? '%' : ''}
                    </p>
                  </div>
                </div>
                {columns.length > 0 ? (
                  <div className="mt-2 grid grid-cols-2 gap-2 border-t border-border pt-2">
                    {columns.map((col) => {
                      const v = scoreOf(row, col.key);
                      const raw = row.scores[col.key];
                      const t = row.tScores[col.key];
                      return (
                        <div key={col.key} className="min-w-0">
                          <p
                            className="truncate text-[10px] font-black uppercase tracking-wider text-muted-foreground"
                            title={columnHeaderFullLabel(col)}
                          >
                            {columnHeaderLabel(col)}
                          </p>
                          <p
                            className={cn('text-[13px] font-black tabular-nums font-sukhumvit', toneOf(v))}
                            title={
                              showPercent
                                ? (t != null ? `T-Score ${formatTScore(t)}` : undefined)
                                : (raw != null ? `คะแนนดิบ ${formatPct(raw)}%` : undefined)
                            }
                          >
                            {formatOf(v)}
                            {showPercent && v != null ? '%' : ''}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>

      <div className="hidden min-h-0 w-full min-w-0 max-w-full flex-1 flex-col md:flex">
        <div
          className="min-h-0 w-full max-w-full flex-1 overflow-x-auto overflow-y-auto overscroll-y-contain scrollbar-hide touch-pan-x touch-pan-y"
          style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-x pan-y' }}
        >
          <div className="relative" style={{ width: '100%', minWidth: tableMinWidth }}>
            <div
              className="sticky top-0 z-20 grid items-stretch gap-3 border-b border-border bg-background px-0 py-2"
              style={{ gridTemplateColumns: gridTemplate }}
            >
              <div className={cn(TABLE_HEADER_CELL, stickyHeader, 'py-0')}>
                <SortHeaderButton
                  label="นักเรียน"
                  align="left"
                  active={sortKey === 'name'}
                  dir={sortDir}
                  onClick={() => toggleSort('name')}
                  className="w-full"
                />
              </div>
              {columns.map((col) => {
                const abbr = columnHeaderLabel(col);
                const full = columnHeaderFullLabel(col);
                return (
                  <div key={col.key} className={cn(TABLE_HEADER_SUBJECT, 'flex max-w-full justify-center')}>
                    <SortHeaderButton
                      label={abbr}
                      title={`${full}${showPercent ? '' : ' (T-Score)'} — คลิกเรียงสูง↔ต่ำ`}
                      active={sortKey === col.key}
                      dir={sortDir}
                      onClick={() => toggleSort(col.key)}
                      align="center"
                      className="w-full"
                    />
                  </div>
                );
              })}
              <div className={cn(TABLE_HEADER_SUBJECT, stickyAvgHeader)}>
                <SortHeaderButton
                  label={avgHeaderLabel}
                  title={avgHeaderTitle}
                  active={sortKey === 'avg'}
                  dir={sortDir}
                  onClick={() => toggleSort('avg')}
                  align="center"
                  className="w-full"
                />
              </div>
            </div>

            {sortedStudents.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                <p className="text-[13px] font-sarabun">ยังไม่มีข้อมูลนักเรียน</p>
              </div>
            ) : (
              sortedStudents.map(renderRow)
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
