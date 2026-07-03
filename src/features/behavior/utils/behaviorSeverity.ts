import type { BehaviorSeverity } from '@/types/behavior';

export const BEHAVIOR_SEVERITY_OPTIONS: Array<{ value: BehaviorSeverity; label: string }> = [
  { value: 'light', label: 'เบา' },
  { value: 'medium', label: 'ปานกลาง' },
  { value: 'severe', label: 'ร้ายแรง' },
];

export function getBehaviorSeverityLabel(severity: BehaviorSeverity | undefined): string {
  return BEHAVIOR_SEVERITY_OPTIONS.find((o) => o.value === severity)?.label ?? 'ปานกลาง';
}

export function behaviorSeverityBadgeClass(severity: BehaviorSeverity | undefined): string {
  switch (severity ?? 'medium') {
    case 'light':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'severe':
      return 'bg-red-100 text-red-800 border-red-200';
    default:
      return 'bg-orange-50 text-orange-700 border-orange-200';
  }
}

export function behaviorSeverityButtonClass(severity: BehaviorSeverity | undefined): string {
  switch (severity ?? 'medium') {
    case 'light':
      return 'bg-amber-50 border-amber-200 hover:bg-amber-100/80';
    case 'severe':
      return 'bg-red-50 border-red-200 hover:bg-red-100/80';
    default:
      return 'bg-rose-50 border-rose-100 hover:bg-rose-100/80';
  }
}

const SEVERITY_RANK: Record<BehaviorSeverity, number> = {
  light: 0,
  medium: 1,
  severe: 2,
};

/** เรียงเบา → ปานกลาง → ร้ายแรง */
export function compareBehaviorSeverity(
  a: BehaviorSeverity | undefined,
  b: BehaviorSeverity | undefined,
): number {
  return (SEVERITY_RANK[a ?? 'medium'] ?? 1) - (SEVERITY_RANK[b ?? 'medium'] ?? 1);
}
