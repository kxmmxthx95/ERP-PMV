import type { BehaviorRecord, BehaviorTotal } from '@/types/behavior';
import { DEPARTMENT_CONFIG, type Department } from '@/types/curriculum';
import {
  formatThaiDateLabelFromIso,
  formatThaiDateRangeFromIso,
  getLocalDateString,
} from '@/lib/dateUtils';

const BASELINE = 100;

export interface BehaviorDashboardSummary {
  trackedStudents: number;
  avgScore: number;
  belowBaseline: number;
  totalPositive: number;
  totalNegative: number;
  totalRecords: number;
}

export interface BehaviorDeptStat {
  departmentId: Department;
  label: string;
  studentCount: number;
  avgScore: number;
  belowBaseline: number;
}

export interface BehaviorViolationStat {
  label: string;
  count: number;
  points: number;
}

export function computeBehaviorDashboardSummary(
  totals: Map<string, BehaviorTotal>,
  records: BehaviorRecord[],
): BehaviorDashboardSummary {
  const rows = Array.from(totals.values());
  const trackedStudents = rows.length;
  const avgScore = trackedStudents > 0
    ? Math.round(rows.reduce((sum, r) => sum + r.totalPoints, 0) / trackedStudents)
    : BASELINE;
  const belowBaseline = rows.filter((r) => r.totalPoints < BASELINE).length;
  const totalPositive = records.filter((r) => r.type === 'positive').length;
  const totalNegative = records.filter((r) => r.type === 'negative').length;

  return {
    trackedStudents,
    avgScore,
    belowBaseline,
    totalPositive,
    totalNegative,
    totalRecords: records.length,
  };
}

export function computeDepartmentStats(totals: Map<string, BehaviorTotal>): BehaviorDeptStat[] {
  const byDept = new Map<Department, BehaviorTotal[]>();

  totals.forEach((row) => {
    const dept = row.departmentId as Department;
    if (!dept) return;
    const list = byDept.get(dept) ?? [];
    list.push(row);
    byDept.set(dept, list);
  });

  return (['early', 'primary', 'secondary'] as Department[])
    .map((departmentId) => {
      const rows = byDept.get(departmentId) ?? [];
      const studentCount = rows.length;
      const avgScore = studentCount > 0
        ? Math.round(rows.reduce((sum, r) => sum + r.totalPoints, 0) / studentCount)
        : BASELINE;
      const belowBaseline = rows.filter((r) => r.totalPoints < BASELINE).length;
      return {
        departmentId,
        label: DEPARTMENT_CONFIG[departmentId].label,
        studentCount,
        avgScore,
        belowBaseline,
      };
    })
    .filter((row) => row.studentCount > 0);
}

export function computeTopViolations(records: BehaviorRecord[], limit = 5): BehaviorViolationStat[] {
  const map = new Map<string, BehaviorViolationStat>();
  records
    .filter((r) => r.type === 'negative')
    .forEach((r) => {
      const existing = map.get(r.templateLabel);
      if (existing) {
        existing.count += 1;
        existing.points += r.points;
      } else {
        map.set(r.templateLabel, { label: r.templateLabel, count: 1, points: r.points });
      }
    });

  return Array.from(map.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export type BehaviorDashboardPeriod = 'day' | 'week' | 'month';

export function getDateRange(period: BehaviorDashboardPeriod): { from: string; to: string; label: string } {
  const now = new Date();
  const to = getLocalDateString(now);

  if (period === 'day') {
    return { from: to, to, label: formatThaiDateLabelFromIso(to) };
  }

  if (period === 'week') {
    const start = new Date(now);
    const day = start.getDay();
    const diff = day === 0 ? 6 : day - 1;
    start.setDate(start.getDate() - diff);
    const from = getLocalDateString(start);
    return { from, to, label: formatThaiDateRangeFromIso(from, to) };
  }

  const from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const label = now.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });
  return { from, to, label: `เดือน${label}` };
}

export function getPeriodScopeLabel(period: BehaviorDashboardPeriod): string {
  if (period === 'day') return 'วันนี้';
  if (period === 'week') return 'สัปดาห์นี้';
  return 'เดือนนี้';
}
