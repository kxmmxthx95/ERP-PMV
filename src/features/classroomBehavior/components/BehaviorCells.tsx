// Shared presentational cells for the classroom-behavior overview (used by the rating page and the teacher summary dashboard).
import { HiChevronDown, HiChevronUp, HiChevronUpDown } from 'react-icons/hi2';
import {
  CLASSROOM_BEHAVIOR_LEVEL,
  classroomBehaviorLevelFromAvg,
  type ClassroomBehaviorScore,
} from '@/types/classroomBehavior';

export const DOT_COLOR = { 3: 'bg-success', 2: 'bg-warning', 1: 'bg-destructive' } as const;

/** Traffic-light status dot; grey = not rated yet. */
export function StatusDot({ score }: { score?: ClassroomBehaviorScore }) {
  const label = score ? CLASSROOM_BEHAVIOR_LEVEL[score] : 'ยังไม่ประเมิน';
  return (
    <span title={label} className="inline-flex">
      <span className={`size-4 rounded-full ${score ? DOT_COLOR[score] : 'bg-muted-foreground/30'}`} />
      <span className="sr-only">{label}</span>
    </span>
  );
}

/** Status dot + average number (1–3) with a "n/total" coverage hint. */
export function AvgCell({ values, total, unit }: { values: number[]; total: number; unit: string }) {
  if (!values.length) return <StatusDot />;
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="inline-flex items-center gap-1.5">
        <StatusDot score={classroomBehaviorLevelFromAvg(avg)} />
        <span className="text-sm font-black tabular-nums">{avg.toFixed(2)}</span>
      </span>
      <span className="text-[10px] text-muted-foreground">{values.length}/{total} {unit}</span>
    </div>
  );
}

export type SortKey = 'name' | 'avg' | `s:${string}`;
export type SortState = { key: SortKey; dir: 'asc' | 'desc' } | null;

/** Header sort: asc → desc → back to roster order. */
export function nextSort(cur: SortState, key: SortKey): SortState {
  return cur?.key !== key ? { key, dir: 'asc' } : cur.dir === 'asc' ? { key, dir: 'desc' } : null;
}

export function SortHead({ label, k, sort, onSort, className }: {
  label: string;
  k: SortKey;
  sort: SortState;
  onSort: (k: SortKey) => void;
  className?: string;
}) {
  const active = sort?.key === k;
  const Icon = !active ? HiChevronUpDown : sort.dir === 'asc' ? HiChevronUp : HiChevronDown;
  return (
    <button
      type="button"
      title={label}
      onClick={() => onSort(k)}
      className={`inline-flex items-center gap-1 uppercase tracking-wider hover:text-foreground ${active ? 'text-foreground' : ''} ${className ?? ''}`}
    >
      <span className="truncate">{label}</span>
      <Icon className="size-3 shrink-0" />
    </button>
  );
}

/** Sort students by name / overall average / one subject's average. Unrated always last. */
export function sortStudentsByBehavior<T extends { id: string; firstName: string; lastName: string }>(
  students: T[],
  sort: SortState,
  cell: Map<string, number>, // `${studentId}|${subjectId}` → avg
  perStudent: Map<string, number[]>,
): T[] {
  if (!sort) return students;
  const dir = sort.dir === 'asc' ? 1 : -1;
  const valueOf = (id: string): number | null => {
    if (sort.key === 'avg') {
      const v = perStudent.get(id);
      return v?.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
    }
    return cell.get(`${id}|${sort.key.slice(2)}`) ?? null;
  };
  return [...students].sort((a, b) => {
    if (sort.key === 'name') {
      return dir * `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`, 'th');
    }
    const va = valueOf(a.id);
    const vb = valueOf(b.id);
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    return dir * (va - vb);
  });
}
