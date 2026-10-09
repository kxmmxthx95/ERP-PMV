// Shared presentational cells for the classroom-behavior overview (used by the rating page and the teacher summary dashboard).
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
