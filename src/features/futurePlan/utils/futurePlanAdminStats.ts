import type { StudentFuturePlan } from '@/types/futurePlan';
import type { Department } from '@/types/curriculum';

export interface FuturePlanSummaryStats {
  total: number;
  continueCount: number;
  notContinueCount: number;
}

export interface UniversityRankEntry {
  key: string;
  name: string;
  domain?: string;
  count: number;
}

export function computeFuturePlanSummary(plans: StudentFuturePlan[]): FuturePlanSummaryStats {
  const continueCount = plans.filter((p) => p.planType === 'continue').length;
  return {
    total: plans.length,
    continueCount,
    notContinueCount: plans.length - continueCount,
  };
}

/** นับจากอันดับที่ระบุ (1–3) ของนักเรียนที่ต้องการศึกษาต่อ */
export function computeTopUniversities(
  plans: StudentFuturePlan[],
  limit = 5,
  rank: 1 | 2 | 3 = 1,
): UniversityRankEntry[] {
  const counts = new Map<string, UniversityRankEntry>();

  for (const plan of plans) {
    if (plan.planType !== 'continue') continue;
    const choice = plan.universityChoices?.find(
      (c) => c.rank === rank && c.universityName.trim(),
    );
    if (!choice) continue;

    const name = choice.universityName.trim();
    const key = choice.universityDomain?.trim() || name;
    const existing = counts.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      counts.set(key, {
        key,
        name,
        domain: choice.universityDomain,
        count: 1,
      });
    }
  }

  return [...counts.values()].sort((a, b) => b.count - a.count).slice(0, limit);
}

export function normalizePlanDepartmentId(id?: string): Department | null {
  if (!id) return null;
  const v = id.trim().toLowerCase();
  if (v === 'early' || v === 'early-childhood' || v.includes('ปฐม')) return 'early';
  if (v === 'primary' || v.includes('ประถม')) return 'primary';
  if (v === 'secondary' || v.includes('มัธยม')) return 'secondary';
  return null;
}

export function uniqueFilterOptions(plans: StudentFuturePlan[]) {
  const gradeLevels = [...new Set(plans.map((p) => p.gradeLevel).filter(Boolean))].sort() as string[];
  const classNames = [...new Set(plans.map((p) => p.className).filter(Boolean))].sort() as string[];
  const departmentIds = (['early', 'primary', 'secondary'] as Department[]).filter((dept) =>
    plans.some((p) => normalizePlanDepartmentId(p.departmentId) === dept),
  );
  return { departmentIds, gradeLevels, classNames };
}

export type PlanTypeFilter = 'all' | 'continue' | 'not_continue';

export interface FuturePlanListFilters {
  search: string;
  planType: PlanTypeFilter;
  departmentId: string;
  gradeLevel: string;
  className: string;
}

export function filterFuturePlans(
  plans: StudentFuturePlan[],
  filters: FuturePlanListFilters,
): StudentFuturePlan[] {
  const q = filters.search.trim().toLowerCase();

  return plans.filter((p) => {
    if (filters.planType !== 'all' && p.planType !== filters.planType) return false;
    if (filters.departmentId !== 'all') {
      const dept = normalizePlanDepartmentId(p.departmentId);
      if (dept !== filters.departmentId) return false;
    }
    if (filters.gradeLevel !== 'all' && p.gradeLevel !== filters.gradeLevel) return false;
    if (filters.className !== 'all' && p.className !== filters.className) return false;

    if (!q) return true;

    return (
      p.studentName.toLowerCase().includes(q)
      || p.studentCode.toLowerCase().includes(q)
      || p.desiredCareer.toLowerCase().includes(q)
      || (p.className?.toLowerCase().includes(q) ?? false)
      || (p.lifeGoal?.toLowerCase().includes(q) ?? false)
    );
  });
}
