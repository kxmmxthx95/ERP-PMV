import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import {
  HiBanknotes,
  HiCheckCircle,
  HiChevronLeft,
  HiChevronRight,
  HiClipboardDocumentCheck,
  HiClock,
  HiOutlineExclamationTriangle,
  HiUsers,
  HiXMark,
} from 'react-icons/hi2';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { DEPARTMENT_CONFIG } from '@/types/curriculum';
import type { Department } from '@/types/curriculum';
import { DEPARTMENT_GRADES, GRADE_LEVEL_ORDER } from '@/types/class';
import { cn } from '@/lib/utils';
import { useTuitionCampaignSelection } from './context/TuitionCampaignContext';
import { useStudentFeesByCampaign } from './hooks/useStudentFees';
import { formatTHB } from './tuitionCalc';
import { PAYMENT_STATUS_LABEL, type PaymentStatus, type StudentFee } from '@/types/tuition';

const DASHBOARD_KICKER_CLASS = 'text-[10px] font-black uppercase tracking-[0.18em] sm:text-[11px]';
const DASHBOARD_SECTION_TITLE_CLASS = 'mt-1 text-sm font-black text-slate-900 sm:text-lg';
const DASHBOARD_SECTION_META_CLASS = 'text-[11px] font-semibold text-slate-400 sm:text-xs';

const DASHBOARD_SECTION_CLASS =
  'rounded-none border-0 bg-transparent p-0 shadow-none md:rounded-[28px] md:border md:border-white/90 md:bg-white/[0.72] md:p-4 md:shadow-[0_8px_32px_rgba(0,0,0,0.06)] md:backdrop-blur-2xl md:saturate-150';

const DRAWER_CONTENT_CLASS = [
  'flex h-dvh max-h-dvh flex-col overflow-hidden p-0 before:hidden',
  'data-[vaul-drawer-direction=right]:w-screen data-[vaul-drawer-direction=right]:max-w-none',
  'sm:h-full sm:max-h-full sm:p-2',
  'sm:data-[vaul-drawer-direction=right]:w-full sm:data-[vaul-drawer-direction=right]:max-w-md',
].join(' ');

const DEPARTMENTS = ['early', 'primary', 'secondary'] as const satisfies readonly Department[];

const STATUS_COLORS: Record<PaymentStatus, string> = {
  paid: '#10b981',
  partial: '#f59e0b',
  pending_verification: '#0ea5e9',
  unpaid: '#f43f5e',
};

type StatKey = PaymentStatus | 'all';

const DRAWER_PAGE_SIZE = 20;

function parseGradeLevel(className: string): string {
  const [grade] = className.split(/[/／]/);
  return grade?.trim() || '';
}

function resolveFeeGradeLevel(fee: Pick<StudentFee, 'gradeLevel' | 'className'>): string {
  return fee.gradeLevel?.trim() || parseGradeLevel(fee.className);
}

const STAT_META: Record<StatKey, { label: string; color: string; icon: typeof HiCheckCircle }> = {
  paid: { label: 'ชำระครบแล้ว', color: 'text-emerald-600', icon: HiCheckCircle },
  partial: { label: 'ชำระบางส่วน', color: 'text-amber-600', icon: HiClock },
  pending_verification: { label: 'รอตรวจสอบ', color: 'text-sky-600', icon: HiClipboardDocumentCheck },
  unpaid: { label: 'ยังไม่ชำระ', color: 'text-rose-600', icon: HiOutlineExclamationTriangle },
  all: { label: 'นักเรียนทั้งหมด', color: 'text-slate-700', icon: HiUsers },
};

function DepartmentPieCard({
  department,
  label,
  fees,
}: {
  department: Department;
  label: string;
  fees: StudentFee[];
}) {
  const deptConfig = DEPARTMENT_CONFIG[department];
  const chartData = (['paid', 'partial', 'pending_verification', 'unpaid'] as PaymentStatus[])
    .map((status) => ({
      status,
      name: PAYMENT_STATUS_LABEL[status],
      value: fees.filter((f) => f.status === status).length,
      color: STATUS_COLORS[status],
    }))
    .filter((item) => item.value > 0);
  const paidCount = fees.filter((f) => f.status === 'paid').length;
  const rate = fees.length > 0 ? Math.round((paidCount / fees.length) * 100) : 0;

  return (
    <div
      className="rounded-3xl border bg-white/55 p-3"
      style={{ borderColor: deptConfig.border }}
    >
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-black text-slate-800">{label}</p>
          <p className="text-[11px] font-semibold text-slate-400">{fees.length} คน</p>
        </div>
        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-black text-emerald-600">{rate}%</span>
      </div>
      <div className="mt-1.5 h-20 md:mt-2 md:h-24">
        {chartData.length === 0 ? (
          <div className="flex h-full items-center justify-center text-[11px] font-bold text-slate-300">ไม่มีข้อมูล</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={chartData} dataKey="value" innerRadius={30} outerRadius={44} paddingAngle={3}>
                {chartData.map((entry) => (
                  <Cell key={entry.status} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 12, border: 'none' }} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

function OutstandingStudentCard({ fee, index }: { fee: StudentFee; index: number }) {
  const remaining = Math.max(fee.netPayable - fee.totalPaid, 0);
  const dept = fee.departmentId ? DEPARTMENT_CONFIG[fee.departmentId] : null;

  return (
    <div className="flex items-center gap-2.5 overflow-hidden rounded-2xl bg-white/60 p-2.5 shadow-sm md:gap-3 md:rounded-3xl md:p-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-sm font-black text-white">
        {index + 1}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-black text-slate-800">{fee.studentName}</p>
        <p className="truncate text-[11px] font-semibold text-slate-400">{fee.studentCode}</p>
        <div className="mt-1 flex flex-wrap items-center gap-1">
          <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-black text-slate-600">
            {fee.className}
          </span>
          {dept && (
            <span
              className="shrink-0 rounded-full px-2 py-0.5 text-[9px] font-black"
              style={{
                color: dept.color,
                background: dept.bg,
                border: `1px solid ${dept.border}`,
              }}
            >
              {dept.label}
            </span>
          )}
        </div>
      </div>
      <span className="shrink-0 rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-black text-rose-600">
        {formatTHB(remaining)}
      </span>
    </div>
  );
}

export default function TuitionDashboardPage() {
  const navigate = useNavigate();
  const { activeCampaignId, activeCampaign, isLoadingCampaigns } = useTuitionCampaignSelection();
  const [activeStat, setActiveStat] = useState<StatKey | null>(null);
  const [drawerPage, setDrawerPage] = useState(1);
  const [drawerDepartmentFilter, setDrawerDepartmentFilter] = useState<Department | 'all'>('all');
  const [drawerGradeFilter, setDrawerGradeFilter] = useState<string>('all');
  const [drawerClassFilter, setDrawerClassFilter] = useState<string>('all');

  const { studentFees, isLoading: isLoadingFees } = useStudentFeesByCampaign(activeCampaignId);

  const stats = useMemo(() => {
    const paidFees = studentFees.filter((f) => f.status === 'paid');
    const partialFees = studentFees.filter((f) => f.status === 'partial');
    const pendingFees = studentFees.filter((f) => f.status === 'pending_verification');
    const unpaidFees = studentFees.filter((f) => f.status === 'unpaid');
    const sumOutstanding = (fees: StudentFee[]) =>
      fees.reduce((sum, f) => sum + Math.max(f.netPayable - f.totalPaid, 0), 0);

    const totalNet = studentFees.reduce((sum, f) => sum + f.netPayable, 0);
    const totalPaid = studentFees.reduce((sum, f) => sum + f.totalPaid, 0);

    return {
      paid: paidFees.length,
      partial: partialFees.length,
      pending: pendingFees.length,
      unpaid: unpaidFees.length,
      all: studentFees.length,
      totalNet,
      totalPaid,
      paidAmount: paidFees.reduce((sum, f) => sum + f.netPayable, 0),
      partialAmount: partialFees.reduce((sum, f) => sum + f.totalPaid, 0),
      pendingAmount: sumOutstanding(pendingFees),
      unpaidAmount: unpaidFees.reduce((sum, f) => sum + f.netPayable, 0),
      allAmount: totalNet,
    };
  }, [studentFees]);

  const feesByStatus = useMemo(() => {
    const buckets: Record<PaymentStatus, StudentFee[]> = { paid: [], partial: [], pending_verification: [], unpaid: [] };
    studentFees.forEach((f) => buckets[f.status].push(f));
    return buckets;
  }, [studentFees]);

  const baseModalFees = useMemo(() => {
    if (!activeStat) return [];
    if (activeStat === 'all') return studentFees;
    return feesByStatus[activeStat];
  }, [activeStat, feesByStatus, studentFees]);

  const feesForDrawerDepartment = useMemo(
    () => (drawerDepartmentFilter === 'all'
      ? baseModalFees
      : baseModalFees.filter((f) => f.departmentId === drawerDepartmentFilter)),
    [baseModalFees, drawerDepartmentFilter],
  );

  const drawerGradeOptions = useMemo(() => {
    if (drawerDepartmentFilter !== 'all') {
      return [...DEPARTMENT_GRADES[drawerDepartmentFilter]];
    }
    const grades = new Set<string>();
    for (const fee of baseModalFees) {
      grades.add(resolveFeeGradeLevel(fee));
    }
    return [...grades].sort((a, b) => (GRADE_LEVEL_ORDER[a] ?? 99) - (GRADE_LEVEL_ORDER[b] ?? 99));
  }, [baseModalFees, drawerDepartmentFilter]);

  const drawerClassOptions = useMemo(() => {
    const base = drawerGradeFilter === 'all'
      ? feesForDrawerDepartment
      : feesForDrawerDepartment.filter((f) => resolveFeeGradeLevel(f) === drawerGradeFilter);
    const map = new Map<string, string>();
    for (const fee of base) {
      if (fee.classId) map.set(fee.classId, fee.className);
    }
    return [...map.entries()]
      .sort(([, a], [, b]) => a.localeCompare(b, 'th'))
      .map(([id, name]) => ({ id, name }));
  }, [feesForDrawerDepartment, drawerGradeFilter]);

  const filteredModalFees = useMemo(() => {
    return baseModalFees
      .filter((f) => drawerDepartmentFilter === 'all' || f.departmentId === drawerDepartmentFilter)
      .filter((f) => drawerGradeFilter === 'all' || resolveFeeGradeLevel(f) === drawerGradeFilter)
      .filter((f) => drawerClassFilter === 'all' || f.classId === drawerClassFilter);
  }, [baseModalFees, drawerDepartmentFilter, drawerGradeFilter, drawerClassFilter]);

  const hasDrawerFilters =
    drawerDepartmentFilter !== 'all' || drawerGradeFilter !== 'all' || drawerClassFilter !== 'all';

  const drawerTotalPages = Math.max(1, Math.ceil(filteredModalFees.length / DRAWER_PAGE_SIZE));
  const safeDrawerPage = Math.min(drawerPage, drawerTotalPages);

  useEffect(() => {
    setDrawerPage(1);
    setDrawerDepartmentFilter('all');
    setDrawerGradeFilter('all');
    setDrawerClassFilter('all');
  }, [activeStat]);

  useEffect(() => {
    setDrawerPage(1);
  }, [drawerDepartmentFilter, drawerGradeFilter, drawerClassFilter]);

  useEffect(() => {
    if (drawerPage > drawerTotalPages) setDrawerPage(drawerTotalPages);
  }, [drawerPage, drawerTotalPages]);

  const paginatedModalFees = useMemo(() => {
    const start = (safeDrawerPage - 1) * DRAWER_PAGE_SIZE;
    return filteredModalFees.slice(start, start + DRAWER_PAGE_SIZE);
  }, [filteredModalFees, safeDrawerPage]);

  const drawerRangeStart = filteredModalFees.length === 0 ? 0 : (safeDrawerPage - 1) * DRAWER_PAGE_SIZE + 1;
  const drawerRangeEnd = Math.min(safeDrawerPage * DRAWER_PAGE_SIZE, filteredModalFees.length);

  function clearDrawerFilters() {
    setDrawerDepartmentFilter('all');
    setDrawerGradeFilter('all');
    setDrawerClassFilter('all');
  }

  const outstandingWatchlist = useMemo(
    () =>
      [...studentFees]
        .filter((f) => f.status !== 'paid')
        .sort((a, b) => (b.netPayable - b.totalPaid) - (a.netPayable - a.totalPaid))
        .slice(0, 5),
    [studentFees],
  );

  const collectionRate = stats.totalNet > 0 ? Math.round((stats.totalPaid / stats.totalNet) * 100) : 0;
  const isLoading = isLoadingCampaigns || isLoadingFees;

  return (
    <div className="relative flex flex-col min-h-0 gap-2 pb-10 md:flex-1 md:gap-5 md:pb-4">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-24 -left-16 h-72 w-72 rounded-full bg-indigo-200/45 blur-3xl" />
        <div className="absolute top-24 -right-20 h-80 w-80 rounded-full bg-sky-200/40 blur-3xl" />
      </div>

      {!isLoadingCampaigns && !activeCampaign ? (
        <div className="flex flex-col items-center gap-2 rounded-3xl border border-dashed border-black/10 py-16 text-center">
          <HiBanknotes size={28} className="text-black/25" />
          <p className="text-sm font-bold text-black/40">ยังไม่มีรอบเก็บค่าเทอมในระบบ</p>
          <button
            type="button"
            onClick={() => navigate('/portal/tuition/campaigns')}
            className="mt-1 rounded-full bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700"
          >
            ไปตั้งค่าปีการศึกษา
          </button>
        </div>
      ) : isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-slate-200 border-t-indigo-500" />
        </div>
      ) : (
        <div className="grid grid-cols-1 items-start gap-5 md:gap-3 xl:grid-cols-12 xl:gap-4">
          <section className={cn('xl:col-span-7', DASHBOARD_SECTION_CLASS)}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className={cn(DASHBOARD_KICKER_CLASS, 'text-indigo-600')}>Student Overview</p>
                <h2 className={DASHBOARD_SECTION_TITLE_CLASS}>สถานะการชำระค่าเทอม</h2>
                <p className={DASHBOARD_SECTION_META_CLASS}>{activeCampaign?.name}</p>
              </div>
              <div className="rounded-2xl bg-indigo-50 px-2.5 py-1.5 text-right sm:px-3 sm:py-2">
                <p className="text-[9px] font-black text-indigo-500 sm:text-[10px]">เก็บได้แล้ว</p>
                <p className="text-sm font-black text-slate-900 sm:text-base">{collectionRate}%</p>
                <p className="text-[9px] font-bold text-slate-500 sm:text-[10px]">{formatTHB(stats.totalPaid)}</p>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-5 gap-1.5 sm:mt-4 sm:gap-3">
              {([
                { key: 'paid' as const, value: stats.paid, amount: stats.paidAmount },
                { key: 'partial' as const, value: stats.partial, amount: stats.partialAmount },
                { key: 'unpaid' as const, value: stats.unpaid, amount: stats.unpaidAmount },
                { key: 'pending_verification' as const, value: stats.pending, amount: stats.pendingAmount },
                { key: 'all' as const, value: stats.all, amount: stats.allAmount },
              ]).map((item) => {
                const meta = STAT_META[item.key];
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setActiveStat(item.key)}
                    className="min-w-0 rounded-2xl border border-white bg-white/60 p-2 text-left shadow-sm transition hover:bg-white/85 hover:shadow-md active:scale-[0.98] sm:rounded-3xl sm:p-4"
                  >
                    <meta.icon className={cn('h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4', meta.color)} />
                    <p className={cn('mt-1.5 text-base font-black sm:mt-4 sm:text-3xl', meta.color)}>{item.value}</p>
                    <p className="mt-0.5 truncate text-[9px] font-black tabular-nums text-slate-700 sm:mt-1 sm:text-[11px]">
                      {formatTHB(item.amount)}
                    </p>
                    <p className="mt-0.5 truncate text-[9px] font-bold text-slate-500 sm:text-xs">{meta.label}</p>
                  </button>
                );
              })}
            </div>

            <div className="mt-3 grid grid-cols-1 gap-2.5 md:grid-cols-3">
              {DEPARTMENTS.map((dept) => (
                <DepartmentPieCard
                  key={dept}
                  department={dept}
                  label={DEPARTMENT_CONFIG[dept].label}
                  fees={studentFees.filter((f) => f.departmentId === dept)}
                />
              ))}
            </div>
          </section>

          <section className={cn('xl:col-span-5', DASHBOARD_SECTION_CLASS)}>
            <div className="flex items-start justify-between">
              <div>
                <p className={cn(DASHBOARD_KICKER_CLASS, 'text-rose-500')}>Watchlist</p>
                <h2 className={DASHBOARD_SECTION_TITLE_CLASS}>ค้างชำระสูงสุด</h2>
                <p className={DASHBOARD_SECTION_META_CLASS}>5 อันดับยอดคงเหลือสูงสุด</p>
              </div>
              <HiOutlineExclamationTriangle className="h-5 w-5 text-rose-400" />
            </div>

            {outstandingWatchlist.length === 0 ? (
              <div className="mt-4 rounded-3xl border border-dashed border-slate-200 bg-white/45 p-5 text-center text-sm font-bold text-slate-400">
                ไม่มีนักเรียนค้างชำระ
              </div>
            ) : (
              <div className="mt-4 space-y-2">
                {outstandingWatchlist.map((fee, index) => (
                  <OutstandingStudentCard key={fee.id} fee={fee} index={index} />
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      <Drawer open={activeStat !== null} onOpenChange={(open) => !open && setActiveStat(null)} direction="right">
        <DrawerContent className={DRAWER_CONTENT_CLASS}>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white sm:rounded-4xl sm:border sm:border-slate-200/70 sm:shadow-xl">
          <DrawerHeader className="shrink-0 border-b border-slate-100 px-4 pt-4 pb-2">
            <div className="relative flex items-center justify-center min-h-10">
              <div className="min-w-0 px-12 text-center">
                <DrawerTitle className="text-base font-black text-slate-800">
                  {activeStat ? STAT_META[activeStat].label : ''}
                </DrawerTitle>
                <DrawerDescription className="text-xs text-slate-500">
                  {hasDrawerFilters
                    ? `${filteredModalFees.length} จาก ${baseModalFees.length} คน`
                    : `${baseModalFees.length} คน`}
                </DrawerDescription>
              </div>
              <button
                type="button"
                onClick={() => setActiveStat(null)}
                className="absolute right-0 top-1/2 -translate-y-1/2 inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 active:scale-[0.98] transition"
                aria-label="ปิด"
              >
                <HiXMark className="w-4 h-4" />
              </button>
            </div>
          </DrawerHeader>

          {activeStat && baseModalFees.length > 0 && (
            <div className="shrink-0 space-y-2 border-b border-slate-100 px-4 pb-3">
              <div className="grid grid-cols-1 gap-2">
                <select
                  value={drawerDepartmentFilter}
                  onChange={(e) => {
                    setDrawerDepartmentFilter(e.target.value as Department | 'all');
                    setDrawerGradeFilter('all');
                    setDrawerClassFilter('all');
                  }}
                  className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600"
                  aria-label="กรองแผนก"
                >
                  <option value="all">ทุกแผนก</option>
                  {Object.entries(DEPARTMENT_CONFIG).map(([key, cfg]) => (
                    <option key={key} value={key}>{cfg.label}</option>
                  ))}
                </select>
                <select
                  value={drawerGradeFilter}
                  onChange={(e) => {
                    setDrawerGradeFilter(e.target.value);
                    setDrawerClassFilter('all');
                  }}
                  className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600"
                  aria-label="กรองระดับชั้น"
                >
                  <option value="all">ทุกระดับชั้น</option>
                  {drawerGradeOptions.map((grade) => (
                    <option key={grade} value={grade}>{grade}</option>
                  ))}
                </select>
                <select
                  value={drawerClassFilter}
                  onChange={(e) => setDrawerClassFilter(e.target.value)}
                  disabled={drawerClassOptions.length === 0}
                  className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 disabled:opacity-40"
                  aria-label="กรองห้องเรียน"
                >
                  <option value="all">ทุกห้อง</option>
                  {drawerClassOptions.map((cls) => (
                    <option key={cls.id} value={cls.id}>{cls.name}</option>
                  ))}
                </select>
              </div>
              {hasDrawerFilters && (
                <button
                  type="button"
                  onClick={clearDrawerFilters}
                  className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700"
                >
                  ล้างฟิลเตอร์
                </button>
              )}
            </div>
          )}

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-4 py-3">
              {baseModalFees.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm font-bold text-slate-400">
                  ไม่มีรายชื่อในหมวดนี้
                </div>
              ) : filteredModalFees.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm font-bold text-slate-400">
                  ไม่พบนักเรียนตามตัวกรอง
                </div>
              ) : (
                <div className="space-y-2">
                  {paginatedModalFees.map((fee) => (
                    <div key={fee.id} className="flex min-w-0 items-center justify-between gap-3 overflow-hidden rounded-2xl border border-white bg-white/70 px-3 py-2.5 shadow-sm">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-black text-slate-800">{fee.studentName}</p>
                        <p className="truncate text-[11px] font-bold text-slate-400">
                          {fee.className} · {DEPARTMENT_CONFIG[fee.departmentId].label}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black tabular-nums" style={{ color: STATUS_COLORS[fee.status], background: `${STATUS_COLORS[fee.status]}18` }}>
                        {formatTHB(Math.max(fee.netPayable - fee.totalPaid, 0))}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {filteredModalFees.length > 0 && (
              <div className="shrink-0 border-t border-slate-100 px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-[11px] font-bold text-slate-500">
                    แสดง {drawerRangeStart}–{drawerRangeEnd} จาก {filteredModalFees.length} รายการ
                  </p>

                  {drawerTotalPages > 1 && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={safeDrawerPage === 1}
                        onClick={() => setDrawerPage((p) => Math.max(1, p - 1))}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                        aria-label="หน้าก่อนหน้า"
                      >
                        <HiChevronLeft size={16} />
                      </button>

                      <div className="flex items-center gap-1">
                        {Array.from({ length: drawerTotalPages }, (_, idx) => idx + 1).map((page) => {
                          if (drawerTotalPages > 5) {
                            if (page !== 1 && page !== drawerTotalPages && Math.abs(page - safeDrawerPage) > 1) {
                              if (page === 2 || page === drawerTotalPages - 1) {
                                return (
                                  <span key={`ellipsis-${page}`} className="px-0.5 text-[10px] text-slate-300">
                                    …
                                  </span>
                                );
                              }
                              return null;
                            }
                          }

                          const isActive = safeDrawerPage === page;
                          return (
                            <button
                              key={page}
                              type="button"
                              onClick={() => setDrawerPage(page)}
                              className={cn(
                                'h-8 min-w-[32px] rounded-lg px-2 text-[11px] font-black transition-all',
                                isActive
                                  ? 'bg-slate-900 text-white shadow-sm'
                                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800',
                              )}
                            >
                              {page}
                            </button>
                          );
                        })}
                      </div>

                      <button
                        type="button"
                        disabled={safeDrawerPage === drawerTotalPages}
                        onClick={() => setDrawerPage((p) => Math.min(drawerTotalPages, p + 1))}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                        aria-label="หน้าถัดไป"
                      >
                        <HiChevronRight size={16} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="shrink-0 px-4 pb-6 pt-2">
              <button
                type="button"
                onClick={() => { setActiveStat(null); if (activeCampaignId) navigate(`/portal/tuition/campaigns/${activeCampaignId}`); }}
                className="w-full rounded-full bg-indigo-600 px-4 py-2 text-xs font-black text-white hover:bg-indigo-700"
              >
                ไปที่รายชื่อนักเรียนทั้งหมด
              </button>
            </div>
          </div>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
