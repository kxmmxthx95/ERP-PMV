import { useMemo, useState, type ReactNode } from 'react';
import {
  HiOutlineAcademicCap,
  HiOutlineMagnifyingGlass,
  HiOutlineUsers,
  HiOutlineXCircle,
} from 'react-icons/hi2';
import type { StudentFuturePlan } from '@/types/futurePlan';
import { FuturePlanAdminDetailDrawer } from '@/features/futurePlan/components/FuturePlanAdminDetailDrawer';
import { FuturePlanAdminStudentCard } from '@/features/futurePlan/components/FuturePlanAdminStudentCard';
import { TopUniversitiesRankCarousel } from '@/features/futurePlan/components/TopUniversitiesRankCarousel';
import {
  computeFuturePlanSummary,
  computeTopUniversities,
  filterFuturePlans,
  normalizePlanDepartmentId,
  uniqueFilterOptions,
  type PlanTypeFilter,
} from '@/features/futurePlan/utils/futurePlanAdminStats';
import { DEPARTMENT_CONFIG, type Department } from '@/types/curriculum';
import { glassStyles } from '@/lib/designTokens';
import { cn } from '@/lib/utils';

function DashboardCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={cn('rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm', className)}
      style={glassStyles.card}
    >
      {children}
    </section>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
}) {
  return (
    <div className="min-w-0 flex-1">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        aria-label={label}
        className={cn(
          'h-8 w-full truncate rounded-lg border border-[#E3E7FC] bg-white px-2 text-xs font-medium outline-none focus:border-[#0056FF]/40 disabled:cursor-not-allowed disabled:opacity-50',
          value === 'all' ? 'text-slate-400' : 'text-slate-800',
        )}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.value === 'all' ? label : opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function FuturePlanAdminDashboard({ plans }: { plans: StudentFuturePlan[] }) {
  const [search, setSearch] = useState('');
  const [planType, setPlanType] = useState<PlanTypeFilter>('all');
  const [departmentId, setDepartmentId] = useState('all');
  const [gradeLevel, setGradeLevel] = useState('all');
  const [selectedClassName, setSelectedClassName] = useState('all');
  const [selectedPlan, setSelectedPlan] = useState<StudentFuturePlan | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const summary = useMemo(() => computeFuturePlanSummary(plans), [plans]);
  const { departmentIds } = useMemo(() => uniqueFilterOptions(plans), [plans]);

  const departmentOptions = useMemo(() => {
    const ids = departmentIds.length > 0
      ? departmentIds
      : (['early', 'primary', 'secondary'] as Department[]);
    return ids.map((id) => ({ value: id, label: DEPARTMENT_CONFIG[id].label }));
  }, [departmentIds]);

  const scopedPlans = useMemo(() => {
    let subset = plans;
    if (departmentId !== 'all') {
      subset = subset.filter((p) => normalizePlanDepartmentId(p.departmentId) === departmentId);
    }
    if (gradeLevel !== 'all') {
      subset = subset.filter((p) => p.gradeLevel === gradeLevel);
    }
    return subset;
  }, [plans, departmentId, gradeLevel]);

  const gradeOptions = useMemo(() => {
    const source = departmentId !== 'all'
      ? plans.filter((p) => normalizePlanDepartmentId(p.departmentId) === departmentId)
      : plans;
    return [...new Set(source.map((p) => p.gradeLevel).filter(Boolean))].sort() as string[];
  }, [plans, departmentId]);

  const classOptions = useMemo(
    () => [...new Set(scopedPlans.map((p) => p.className).filter(Boolean))].sort() as string[],
    [scopedPlans],
  );

  const filtered = useMemo(
    () => filterFuturePlans(plans, { search, planType, departmentId, gradeLevel, className: selectedClassName }),
    [plans, search, planType, departmentId, gradeLevel, selectedClassName],
  );

  const hasListFilter = useMemo(
    () =>
      search.trim().length > 0
      || planType !== 'all'
      || departmentId !== 'all'
      || gradeLevel !== 'all'
      || selectedClassName !== 'all',
    [search, planType, departmentId, gradeLevel, selectedClassName],
  );

  const continuePlansForRanking = useMemo(
    () => filtered.filter((p) => p.planType === 'continue'),
    [filtered],
  );

  const topByRank = useMemo(
    () => ({
      1: computeTopUniversities(continuePlansForRanking, 5, 1),
      2: computeTopUniversities(continuePlansForRanking, 5, 2),
      3: computeTopUniversities(continuePlansForRanking, 5, 3),
    }),
    [continuePlansForRanking],
  );

  function openPlanDrawer(plan: StudentFuturePlan) {
    setSelectedPlan(plan);
    setDrawerOpen(true);
  }

  function handleDrawerOpenChange(open: boolean) {
    setDrawerOpen(open);
    if (!open) setSelectedPlan(null);
  }

  return (
    <div className="space-y-4 pb-10">
      <section
        className="rounded-xl border border-slate-200/70 bg-white px-3 py-2.5 shadow-sm sm:px-4"
        style={glassStyles.card}
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
          <div className="grid min-w-0 flex-1 grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setPlanType('all')}
              className={cn(
                'rounded-lg bg-slate-50 px-2.5 py-2 text-center transition-all sm:text-left',
                'hover:ring-2 hover:ring-[#0056FF]/25',
                planType === 'all' && 'ring-2 ring-[#0056FF] shadow-sm',
              )}
            >
              <p className="text-xl font-black leading-none text-[#0056FF] tabular-nums sm:text-2xl">
                {summary.total}
              </p>
              <p className="mt-0.5 text-[10px] font-semibold text-slate-500 sm:text-[11px]">ทำแบบสอบถามแล้ว</p>
            </button>
            <button
              type="button"
              onClick={() => setPlanType((p) => (p === 'continue' ? 'all' : 'continue'))}
              className={cn(
                'rounded-lg bg-emerald-50/80 px-2.5 py-2 text-center transition-all sm:text-left',
                'hover:ring-2 hover:ring-emerald-400/40',
                planType === 'continue' && 'ring-2 ring-emerald-500 shadow-sm',
              )}
            >
              <p className="text-xl font-black leading-none text-emerald-700 tabular-nums sm:text-2xl">
                {summary.continueCount}
              </p>
              <p className="mt-0.5 flex items-center justify-center gap-0.5 text-[10px] font-semibold text-emerald-600 sm:justify-start sm:text-[11px]">
                <HiOutlineAcademicCap className="size-3 shrink-0" />
                ต้องการศึกษาต่อ
              </p>
            </button>
            <button
              type="button"
              onClick={() => setPlanType((p) => (p === 'not_continue' ? 'all' : 'not_continue'))}
              className={cn(
                'rounded-lg bg-slate-100 px-2.5 py-2 text-center transition-all sm:text-left',
                'hover:ring-2 hover:ring-slate-400/40',
                planType === 'not_continue' && 'ring-2 ring-slate-500 shadow-sm',
              )}
            >
              <p className="text-xl font-black leading-none text-slate-700 tabular-nums sm:text-2xl">
                {summary.notContinueCount}
              </p>
              <p className="mt-0.5 flex items-center justify-center gap-0.5 text-[10px] font-semibold text-slate-500 sm:justify-start sm:text-[11px]">
                <HiOutlineXCircle className="size-3 shrink-0" />
                ไม่ศึกษาต่อ
              </p>
            </button>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <DashboardCard className="lg:sticky lg:top-4">
          <TopUniversitiesRankCarousel topByRank={topByRank} />
        </DashboardCard>

        <div className="space-y-3">
          <DashboardCard className="p-3">
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 rounded-lg border border-[#E3E7FC] bg-white px-2.5 py-1.5">
                <HiOutlineMagnifyingGlass size={14} className="shrink-0 text-[#0056FF]/40" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="ค้นหาชื่อ, รหัส, ห้อง, อาชีพ..."
                  className="min-w-0 flex-1 bg-transparent text-xs text-slate-800 placeholder:text-slate-400 outline-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-1.5">
                <FilterSelect
                  label="แผนก"
                  value={departmentId}
                  onChange={(v) => {
                    setDepartmentId(v);
                    setGradeLevel('all');
                    setSelectedClassName('all');
                  }}
                  options={[{ value: 'all', label: 'ทุกแผนก' }, ...departmentOptions]}
                />
                <FilterSelect
                  label="ระดับชั้น"
                  value={gradeLevel}
                  disabled={gradeOptions.length === 0}
                  onChange={(v) => {
                    setGradeLevel(v);
                    setSelectedClassName('all');
                  }}
                  options={[
                    { value: 'all', label: 'ทุกชั้น' },
                    ...gradeOptions.map((g) => ({ value: g, label: g })),
                  ]}
                />
                <FilterSelect
                  label="ห้องเรียน"
                  value={selectedClassName}
                  disabled={classOptions.length === 0}
                  onChange={setSelectedClassName}
                  options={[
                    { value: 'all', label: 'ทุกห้อง' },
                    ...classOptions.map((c) => ({ value: c, label: c })),
                  ]}
                />
              </div>
            </div>
          </DashboardCard>

          {!hasListFilter ? (
            <div className="py-10 text-center text-slate-400">
              <HiOutlineMagnifyingGlass size={32} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm">ค้นหาหรือเลือกตัวกรองเพื่อดูรายชื่อนักเรียน</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-10 text-center text-slate-400">
              <HiOutlineUsers size={32} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm">ไม่พบข้อมูลตามเงื่อนไข</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2">
              {filtered.map((plan) => (
                <FuturePlanAdminStudentCard
                  key={plan.id}
                  plan={plan}
                  onClick={() => openPlanDrawer(plan)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <FuturePlanAdminDetailDrawer
        plan={selectedPlan}
        open={drawerOpen}
        onOpenChange={handleDrawerOpenChange}
      />
    </div>
  );
}
