import { useEffect, useMemo, useState } from 'react';
import { HiArrowLeft, HiOutlineChartBar, HiOutlineQuestionMarkCircle } from 'react-icons/hi2';
import { cn } from '@/lib/utils';
import { HEADER_ICON_BTN, HEADER_ICON_BTN_GROUP } from '@/lib/headerIconBtn';
import { subjectNameToEnAbbr } from '@/lib/subjectHeaderAbbr';
import { formatGpa, gpaStyle } from '@/types/grades';
import type {
  GradeAssessmentCell,
  GradeAssessmentMatrix,
  GradeAssessmentStudentCell,
  GradeAssessmentStudentRow,
  GradeAssessmentSubjectCol,
} from '@/types/academicGradeAssessment';
import {
  SUBJECT_GROUP_CONFIG,
  type SubjectGroupId,
} from '@/types/curriculum';
import StudentAvatar from '@/features/students/components/StudentAvatar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const TABLE_HEADER_CELL = 'text-[13px] font-black text-foreground font-sukhumvit whitespace-nowrap';
/** freeze คอลัมน์ห้องตอน scroll แนวนอน */
const STICKY_LEFT =
  'sticky left-0 z-10 bg-card pl-3 pr-2 shadow-[2px_0_6px_-2px_rgba(0,0,0,0.08)]';
const STICKY_LEFT_HEADER =
  'sticky left-0 z-30 bg-muted/40 pl-3 pr-2 shadow-[2px_0_6px_-2px_rgba(0,0,0,0.08)]';

/** หัวตารางรวมกลุ่มสาระ + รหัสวิชา เป็นบล็อกเดียว */
function GradeMatrixDesktopHeader({
  leftLabel,
  subjects,
  subjectGroups,
  gridTemplate,
  stickyLeftClass = STICKY_LEFT_HEADER,
}: {
  leftLabel: string;
  subjects: MergedSubjectCol[];
  subjectGroups: SubjectGroupChunk[];
  gridTemplate: string;
  stickyLeftClass?: string;
}) {
  return (
    <div className="sticky top-0 z-20 border-b border-border bg-muted/40">
      <div
        className="grid pr-3"
        style={{
          gridTemplateColumns: gridTemplate,
          gridTemplateRows: 'auto auto',
        }}
      >
        <div
          className={cn(
            TABLE_HEADER_CELL,
            stickyLeftClass,
            'row-span-2 flex items-center border-r border-border/60 py-2',
          )}
          style={{ gridRow: '1 / span 2' }}
        >
          {leftLabel}
        </div>

        {subjectGroups.map((group, gi) => (
          <div
            key={`g-${group.groupId}`}
            className={cn(
              'flex items-center justify-center border-b border-border/50 px-1 py-1.5 text-center text-[11px] font-black text-foreground font-sukhumvit',
              gi < subjectGroups.length - 1 && 'border-r border-border/60',
            )}
            style={{ gridColumn: `span ${group.subjects.length}`, gridRow: 1 }}
            title={SUBJECT_GROUP_CONFIG[group.groupId].name}
          >
            {group.label}
          </div>
        ))}

        <div
          className={cn(
            TABLE_HEADER_CELL,
            'row-span-2 flex items-center justify-center border-l border-border/60 py-2 text-center',
          )}
          style={{ gridRow: '1 / span 2' }}
        >
          AVG
        </div>

        {subjects.map((col, i) => {
          const isGroupEnd = subjectGroups.some((g) => {
            const last = g.subjects[g.subjects.length - 1];
            return last?.key === col.key;
          });
          const isLast = i === subjects.length - 1;
          return (
            <div
              key={col.key}
              className={cn(
                TABLE_HEADER_CELL,
                'px-1 py-1.5 text-center text-[11px] leading-tight',
                isGroupEnd && !isLast && 'border-r border-border/60',
              )}
              style={{ gridRow: 2 }}
              title={col.subjectCode ? `${col.subjectName} (${col.subjectCode})` : col.subjectName}
            >
              {col.abbr}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** ชื่อสั้นหัวกลุ่มตามที่ขอ */
const GROUP_HEADER_LABEL: Partial<Record<SubjectGroupId, string>> = {
  math: 'คณิต',
  science: 'วิทยาศาสตร์',
  foreign: 'ภาษาต่างประเทศ',
  thai: 'ภาษาไทย',
  social: 'สังคม',
};

/** คอลัมน์หลังรวมรหัส/ตัวย่อซ้ำ */
type MergedSubjectCol = {
  key: string;
  abbr: string;
  subjectIds: string[];
  subjectName: string;
  subjectCode: string;
  subjectGroupId?: SubjectGroupId;
};

type SubjectGroupChunk = {
  groupId: SubjectGroupId;
  label: string;
  subjects: MergedSubjectCol[];
};

/** คีย์รวมคอลัมน์: ตัวย่อหัวตารางเดียวกันในกลุ่มสาระเดียวกัน */
function subjectMergeKey(col: GradeAssessmentSubjectCol): string {
  const abbr = subjectNameToEnAbbr(col.subjectName, col.subjectCode);
  const group = col.subjectGroupId && col.subjectGroupId in SUBJECT_GROUP_CONFIG
    ? col.subjectGroupId
    : 'other';
  return `${group}:${abbr}`;
}

/** รวมคอลัมน์ subjectId คนละอันแต่ตัวย่อหัวตารางเดียวกัน (เช่น MBAS ซ้ำ) */
function mergeSubjectsByAbbr(subjects: GradeAssessmentSubjectCol[]): MergedSubjectCol[] {
  const out: MergedSubjectCol[] = [];
  const byKey = new Map<string, MergedSubjectCol>();
  for (const col of subjects) {
    const abbr = subjectNameToEnAbbr(col.subjectName, col.subjectCode);
    const key = subjectMergeKey(col);
    const existing = byKey.get(key);
    if (existing) {
      existing.subjectIds.push(col.subjectId);
      continue;
    }
    const merged: MergedSubjectCol = {
      key,
      abbr,
      subjectIds: [col.subjectId],
      subjectName: col.subjectName,
      subjectCode: col.subjectCode,
      subjectGroupId: col.subjectGroupId,
    };
    byKey.set(key, merged);
    out.push(merged);
  }
  return out;
}

function cellForMerged(
  bySubject: Record<string, GradeAssessmentCell>,
  col: MergedSubjectCol,
): GradeAssessmentCell | null {
  let sum = 0;
  let n = 0;
  for (const id of col.subjectIds) {
    const cell = bySubject[id];
    if (!cell || cell.n <= 0) continue;
    sum += cell.avgGpa * cell.n;
    n += cell.n;
  }
  if (n <= 0) return null;
  return { avgGpa: Math.round((sum / n) * 100) / 100, n };
}

/** เกรดนักเรียน — ตัวย่อซ้ำใช้ค่าแรกที่มี (ห้องมักมีแค่ชุดเดียว) */
function studentCellForMerged(
  bySubject: Record<string, GradeAssessmentStudentCell>,
  col: MergedSubjectCol,
): GradeAssessmentStudentCell | null {
  let sum = 0;
  let n = 0;
  let first: GradeAssessmentStudentCell | null = null;
  for (const id of col.subjectIds) {
    const cell = bySubject[id];
    if (!cell) continue;
    if (!first) first = cell;
    sum += cell.gpa;
    n += 1;
  }
  if (!first || n <= 0) return null;
  if (n === 1) return first;
  return { grade: first.grade, gpa: Math.round((sum / n) * 100) / 100 };
}

function groupSubjects(subjects: MergedSubjectCol[]): SubjectGroupChunk[] {
  const chunks: SubjectGroupChunk[] = [];
  for (const col of subjects) {
    const groupId = (col.subjectGroupId && col.subjectGroupId in SUBJECT_GROUP_CONFIG
      ? col.subjectGroupId
      : 'other') as SubjectGroupId;
    const last = chunks[chunks.length - 1];
    if (last && last.groupId === groupId) {
      last.subjects.push(col);
      continue;
    }
    chunks.push({
      groupId,
      label: GROUP_HEADER_LABEL[groupId] ?? SUBJECT_GROUP_CONFIG[groupId].name,
      subjects: [col],
    });
  }
  return chunks;
}

type DisplayRow = {
  key: string;
  label: string;
  bySubject: Record<string, GradeAssessmentCell>;
  rowAvgGpa: number | null;
  rowN: number;
};

function GpaCell({ avgGpa }: { avgGpa: number; n?: number }) {
  const tone = gpaStyle(avgGpa);
  return (
    <div className="flex flex-col items-center justify-center gap-0.5 py-1">
      <span
        className="inline-flex min-w-[2.75rem] items-center justify-center rounded-full px-2 py-0.5 text-[13px] font-black tabular-nums font-sukhumvit"
        style={{ color: tone.text, background: tone.bg }}
      >
        {formatGpa(avgGpa)}
      </span>
    </div>
  );
}

function GradeLetterCell({ grade, gpa }: { grade: string; gpa: number }) {
  const tone = gpaStyle(gpa);
  return (
    <span
      className="inline-flex min-w-[2.5rem] items-center justify-center rounded-full px-2 py-0.5 text-[13px] font-black font-sukhumvit"
      style={{ color: tone.text, background: tone.bg }}
    >
      {grade}
    </span>
  );
}

function StudentNameCell({
  fullName,
}: {
  fullName: string;
}) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  const given = parts.length <= 1 ? fullName : parts.slice(0, -1).join(' ');
  const family = parts.length > 1 ? parts[parts.length - 1] : '';
  return (
    <div className="min-w-0 leading-snug">
      <p className="truncate text-[13px] font-bold text-foreground font-sukhumvit">{given}</p>
      {family ? (
        <p className="truncate text-[13px] font-bold text-foreground font-sukhumvit">{family}</p>
      ) : null}
    </div>
  );
}

function buildAbbrLegend(
  subjects: MergedSubjectCol[],
): { abbr: string; full: string }[] {
  const seen = new Set<string>();
  const rows: { abbr: string; full: string }[] = [];
  for (const col of subjects) {
    const full = col.subjectCode
      ? `${col.subjectName} (${col.subjectCode})`
      : col.subjectName;
    const key = `${col.abbr}\0${full}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({ abbr: col.abbr, full });
  }
  rows.push({ abbr: 'AVG', full: 'GPA เฉลี่ยของแถว' });
  return rows;
}

/** ปุ่ม ? คู่มืออ่านตัวย่อวิชา */
function GradeAbbrHelp({ subjects }: { subjects: MergedSubjectCol[] }) {
  const legend = useMemo(() => buildAbbrLegend(subjects), [subjects]);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={HEADER_ICON_BTN}
          title="คู่มืออ่านตัวย่อ"
          aria-label="คู่มืออ่านตัวย่อ"
        >
          <HiOutlineQuestionMarkCircle size={16} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 gap-3 rounded-2xl p-4 font-sukhumvit">
        <p className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">
          คู่มืออ่านตัวย่อ
        </p>
        <ul className="flex max-h-64 flex-col gap-2 overflow-y-auto scrollbar-hide">
          {legend.map((row) => (
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

/** ตารางรายชื่อ + เกรดต่อวิชา ของห้องที่เลือก */
function ClassStudentGradeTable({
  className,
  students,
  subjects,
  subjectGroups,
  onBack,
}: {
  className: string;
  students: GradeAssessmentStudentRow[];
  subjects: MergedSubjectCol[];
  subjectGroups: SubjectGroupChunk[];
  onBack: () => void;
}) {
  const colCount = subjects.length + 2;
  const gridTemplate = useMemo(() => {
    const subjectCols = subjects.map(() => 'minmax(4.75rem, 1fr)').join(' ');
    return `minmax(11rem, 1.4fr) ${subjectCols} minmax(4.5rem, 0.85fr)`;
  }, [subjects]);

  const stickyStudent =
    'sticky left-0 z-10 flex min-h-0 min-w-0 items-center gap-3 self-stretch bg-card pl-3 pr-2 shadow-[2px_0_6px_-2px_rgba(0,0,0,0.08)]';

  /** โชว์เฉพาะคนที่มีเกรดอย่างน้อย 1 วิชา — ซ่อนแถวว่าง/ไม่ระบุชื่อ */
  const visibleStudents = useMemo(
    () => students.filter((s) => s.rowN > 0),
    [students],
  );

  return (
    <div className="flex w-full min-w-0 max-w-full flex-col overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-2.5 py-2.5">
        <div className={cn('flex min-w-0 flex-1', HEADER_ICON_BTN_GROUP)}>
          <button
            type="button"
            onClick={onBack}
            className={HEADER_ICON_BTN}
            title="กลับ"
            aria-label="กลับ"
          >
            <HiArrowLeft size={16} />
          </button>
          <div className="min-w-0 flex-1 sm:max-w-xs">
            <p className="truncate text-[13px] font-bold text-foreground font-sukhumvit">
              {className}
            </p>
            <p className="text-[11px] font-bold text-muted-foreground font-sarabun">
              {visibleStudents.length} คน · เกรดรายวิชา
            </p>
          </div>
        </div>
        <GradeAbbrHelp subjects={subjects} />
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      {visibleStudents.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center px-4 py-12 text-center">
          <p className="text-[13px] font-sarabun text-muted-foreground">ยังไม่มีรายชื่อนักเรียนในห้องนี้</p>
        </div>
      ) : subjects.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center px-4 py-12 text-center">
          <p className="text-[13px] font-sarabun text-muted-foreground">ยังไม่มีเกรดในห้องนี้</p>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-2.5 overflow-y-auto p-2.5 scrollbar-hide md:hidden">
            {visibleStudents.map((row) => (
              <div key={row.studentId} className="rounded-2xl border border-border bg-background p-3">
                <div className="mb-2 flex items-center gap-3">
                  <StudentAvatar
                    studentId={row.studentId}
                    name={row.fullName}
                    photoURL={row.photoURL}
                    className="h-9 w-9 shrink-0 rounded-full"
                  />
                  <div className="min-w-0 flex-1">
                    <StudentNameCell fullName={row.fullName} />
                  </div>
                  <span className="text-[12px] font-black tabular-nums text-muted-foreground font-sukhumvit">
                    AVG {row.rowAvgGpa != null ? formatGpa(row.rowAvgGpa) : '—'}
                  </span>
                </div>
                <div className="flex flex-col gap-3">
                  {subjectGroups.map((group) => (
                    <div key={group.groupId}>
                      <p className="mb-1.5 text-[10px] font-black uppercase tracking-wider text-muted-foreground font-sukhumvit">
                        {group.label}
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        {group.subjects.map((col) => {
                          const cell = studentCellForMerged(row.bySubject, col);
                          return (
                            <div
                              key={col.key}
                              className="rounded-xl border border-border/60 bg-muted/30 px-2.5 py-2"
                            >
                              <p className="truncate text-[10px] font-bold text-muted-foreground font-sukhumvit">
                                {col.abbr}
                              </p>
                              <div className="flex justify-center py-1">
                                {cell ? (
                                  <GradeLetterCell grade={cell.grade} gpa={cell.gpa} />
                                ) : (
                                  <span className="text-[13px] text-muted-foreground/40">—</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div
            className="hidden min-h-0 min-w-0 max-w-full flex-1 overflow-x-auto overscroll-x-contain touch-pan-x md:block"
            style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-x' }}
          >
            <div style={{ minWidth: `${Math.max(48, colCount * 5.5)}rem` }}>
              <GradeMatrixDesktopHeader
                leftLabel="นักเรียน"
                subjects={subjects}
                subjectGroups={subjectGroups}
                gridTemplate={gridTemplate}
                stickyLeftClass="sticky left-0 z-30 flex min-h-0 items-center self-stretch bg-muted/40 pl-3 pr-2 shadow-[2px_0_6px_-2px_rgba(0,0,0,0.08)]"
              />

              {visibleStudents.map((row) => (
                <div
                  key={row.studentId}
                  className="group grid items-stretch gap-2 border-b border-border py-2.5 pr-3 last:border-b-0 hover:bg-muted/40"
                  style={{ gridTemplateColumns: gridTemplate }}
                >
                  <div className={cn(stickyStudent, 'group-hover:bg-muted/40')}>
                    <StudentAvatar
                      studentId={row.studentId}
                      name={row.fullName}
                      photoURL={row.photoURL}
                      className="h-9 w-9 shrink-0 rounded-full"
                    />
                    <StudentNameCell fullName={row.fullName} />
                  </div>
                  {subjects.map((col) => {
                    const cell = studentCellForMerged(row.bySubject, col);
                    return (
                      <div key={col.key} className="flex items-center justify-center">
                        {cell ? (
                          <GradeLetterCell grade={cell.grade} gpa={cell.gpa} />
                        ) : (
                          <span className="text-[13px] text-muted-foreground/40">—</span>
                        )}
                      </div>
                    );
                  })}
                  <div className="flex items-center justify-center">
                    {row.rowAvgGpa != null ? (
                      <GpaCell avgGpa={row.rowAvgGpa} />
                    ) : (
                      <span className="text-[13px] text-muted-foreground/40">—</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
      </div>
    </div>
  );
}

export function GradeAssessmentMatrixView({ matrix }: { matrix: GradeAssessmentMatrix }) {
  const gradeLevels = matrix.gradeLevels ?? [];
  const [gradeLevel, setGradeLevel] = useState(() => gradeLevels[0] ?? '');
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);

  // ข้อมูลโหลดมาทีหลัง — sync ชั้นแรกถ้ายังไม่ได้เลือก / ชั้นเดิมหาย
  useEffect(() => {
    if (gradeLevels.length === 0) {
      setGradeLevel('');
      return;
    }
    if (!gradeLevel || !gradeLevels.includes(gradeLevel)) {
      setGradeLevel(gradeLevels[0]);
    }
  }, [gradeLevels, gradeLevel]);

  /** แถว = ห้องในระดับชั้นที่เลือกเท่านั้น */
  const displayRows = useMemo((): DisplayRow[] => {
    if (!gradeLevel) return [];
    return matrix.classRows
      .filter((r) => r.gradeLevel === gradeLevel)
      .map((r) => ({
        key: r.classId,
        label: r.className,
        bySubject: r.bySubject,
        rowAvgGpa: r.rowAvgGpa,
        rowN: r.rowN,
      }));
  }, [matrix.classRows, gradeLevel]);

  /** คอลัมน์ = วิชาที่มีข้อมูลในชั้นนี้ — รวมตัวย่อซ้ำเป็นคอลัมน์เดียว */
  const subjects = useMemo(
    () => mergeSubjectsByAbbr(
      matrix.subjects.filter((col) =>
        displayRows.some((row) => row.bySubject[col.subjectId]),
      ),
    ),
    [matrix.subjects, displayRows],
  );

  const subjectGroups = useMemo(() => groupSubjects(subjects), [subjects]);

  const selectedClass = useMemo(
    () => matrix.classRows.find((r) => r.classId === selectedClassId) ?? null,
    [matrix.classRows, selectedClassId],
  );

  const classStudents = useMemo(
    () => (selectedClassId ? (matrix.studentsByClass?.[selectedClassId] ?? []) : []),
    [matrix.studentsByClass, selectedClassId],
  );

  const classSubjects = useMemo(() => {
    if (!selectedClass) return [];
    return mergeSubjectsByAbbr(
      matrix.subjects.filter((col) =>
        selectedClass.bySubject[col.subjectId]
        || classStudents.some((s) => s.bySubject[col.subjectId]),
      ),
    );
  }, [matrix.subjects, selectedClass, classStudents]);

  const classSubjectGroups = useMemo(() => groupSubjects(classSubjects), [classSubjects]);

  const colCount = subjects.length + 2;
  const gridTemplate = useMemo(() => {
    const subjectCols = subjects.map(() => 'minmax(5.5rem, 1fr)').join(' ');
    return `minmax(5.5rem, 0.9fr) ${subjectCols} minmax(4.5rem, 0.85fr)`;
  }, [subjects]);

  if (matrix.classRows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border py-16 text-center">
        <HiOutlineChartBar className="h-10 w-10 text-muted-foreground/40" />
        <div>
          <p className="text-[14px] font-black text-foreground font-sukhumvit">ยังไม่มีห้องเรียน</p>
          <p className="mt-1 text-[12px] font-bold text-muted-foreground font-sarabun">
            คำนวณแบบเดียวกับสมุดคะแนน เพื่อแสดงบน Dashboard เท่านั้น ไม่เขียนทับสมุดครู
          </p>
        </div>
      </div>
    );
  }

  if (selectedClass) {
    return (
      <ClassStudentGradeTable
        className={selectedClass.className}
        students={classStudents}
        subjects={classSubjects}
        subjectGroups={classSubjectGroups}
        onBack={() => setSelectedClassId(null)}
      />
    );
  }

  return (
    <div className="flex w-full min-w-0 max-w-full flex-col overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-2.5 py-2.5">
        <div className="min-w-0 w-full max-w-xs sm:w-64">
          <Select
            value={gradeLevel || undefined}
            onValueChange={(v) => {
              if (v) {
                setGradeLevel(v);
                setSelectedClassId(null);
              }
            }}
          >
            <SelectTrigger className="w-full sm:w-56">
              <SelectValue placeholder="เลือกระดับชั้น" />
            </SelectTrigger>
            <SelectContent>
              {gradeLevels.map((lv) => (
                <SelectItem key={lv} value={lv}>
                  {lv}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <GradeAbbrHelp subjects={subjects} />
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      {displayRows.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center px-4 py-12 text-center">
          <p className="text-[13px] font-sarabun text-muted-foreground">ไม่มีห้องเรียนในระดับชั้นนี้</p>
        </div>
      ) : subjects.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center px-4 py-12 text-center">
          <p className="text-[13px] font-bold text-foreground font-sukhumvit">
            {displayRows.length} ห้อง · ยังไม่มีเกรดในระดับชั้น {gradeLevel}
          </p>
          <p className="mt-1 text-[12px] font-sarabun text-muted-foreground">
            คำนวณแบบเดียวกับสมุดคะแนน (สอบออฟไลน์ + ห้องออนไลน์ที่เชื่อม) — ไม่แก้ข้อมูลครู
          </p>
          <ul className="mx-auto mt-4 flex max-w-sm flex-col gap-1 text-left">
            {displayRows.map((row) => (
              <li key={row.key}>
                <button
                  type="button"
                  onClick={() => setSelectedClassId(row.key)}
                  className="text-[13px] font-bold text-foreground font-sukhumvit underline-offset-2 hover:underline"
                >
                  {row.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-2.5 overflow-y-auto p-2.5 scrollbar-hide md:hidden">
            {displayRows.map((row) => (
              <button
                key={row.key}
                type="button"
                onClick={() => setSelectedClassId(row.key)}
                className="rounded-2xl border border-border bg-background p-3 text-left transition-colors hover:bg-muted/40"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-[14px] font-black text-foreground font-sukhumvit">{row.label}</p>
                  <span className="text-[12px] font-black tabular-nums text-muted-foreground font-sukhumvit">
                    AVG {row.rowAvgGpa != null ? formatGpa(row.rowAvgGpa) : '—'}
                  </span>
                </div>
                <div className="flex flex-col gap-3">
                  {subjectGroups.map((group) => (
                    <div key={group.groupId}>
                      <p className="mb-1.5 text-[10px] font-black uppercase tracking-wider text-muted-foreground font-sukhumvit">
                        {group.label}
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        {group.subjects.map((col) => {
                          const cell = cellForMerged(row.bySubject, col);
                          return (
                            <div
                              key={col.key}
                              className="rounded-xl border border-border/60 bg-muted/30 px-2.5 py-2"
                            >
                              <p
                                className="truncate text-[10px] font-bold text-muted-foreground font-sukhumvit"
                                title={col.subjectName}
                              >
                                {col.abbr}
                              </p>
                              {cell ? (
                                <GpaCell avgGpa={cell.avgGpa} n={cell.n} />
                              ) : (
                                <p className="py-2 text-center text-[13px] text-muted-foreground/40">—</p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </button>
            ))}
          </div>

          <div
            className="hidden min-h-0 min-w-0 max-w-full flex-1 overflow-x-auto overscroll-x-contain touch-pan-x md:block"
            style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-x' }}
          >
            <div style={{ minWidth: `${Math.max(40, colCount * 6)}rem` }}>
              <GradeMatrixDesktopHeader
                leftLabel="ห้องเรียน"
                subjects={subjects}
                subjectGroups={subjectGroups}
                gridTemplate={gridTemplate}
              />

              {displayRows.map((row) => (
                <button
                  key={row.key}
                  type="button"
                  onClick={() => setSelectedClassId(row.key)}
                  className="grid w-full items-center gap-2 border-b border-border py-2 pr-3 text-left last:border-b-0 hover:bg-muted/40"
                  style={{ gridTemplateColumns: gridTemplate }}
                >
                  <span
                    className={cn(
                      STICKY_LEFT,
                      'text-[13px] font-black text-primary font-sukhumvit underline-offset-2 hover:underline',
                    )}
                  >
                    {row.label}
                  </span>
                  {subjects.map((col) => {
                    const cell = cellForMerged(row.bySubject, col);
                    return (
                      <div key={col.key} className="flex justify-center">
                        {cell ? (
                          <GpaCell avgGpa={cell.avgGpa} n={cell.n} />
                        ) : (
                          <span className="text-[13px] text-muted-foreground/40">—</span>
                        )}
                      </div>
                    );
                  })}
                  <div className="flex justify-center">
                    {row.rowAvgGpa != null ? (
                      <GpaCell avgGpa={row.rowAvgGpa} n={row.rowN} />
                    ) : (
                      <span className="text-[13px] text-muted-foreground/40">—</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
      </div>
    </div>
  );
}
