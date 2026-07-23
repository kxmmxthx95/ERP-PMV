import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { RiskLevel } from '../types';

const RISK_CONFIG: Record<RiskLevel, { label: string; className: string }> = {
  high: { label: 'เสี่ยงสูง', className: 'bg-destructive/10 text-destructive' },
  medium: { label: 'เฝ้าระวัง', className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  low: { label: 'ปกติ', className: 'bg-secondary text-secondary-foreground' },
  none: { label: 'ไม่มีข้อมูล', className: 'bg-muted text-muted-foreground' },
};

export function RiskBadge({ level }: { level: RiskLevel }) {
  const cfg = RISK_CONFIG[level];
  return <Badge variant="outline" className={cn('border-transparent', cfg.className)}>{cfg.label}</Badge>;
}
