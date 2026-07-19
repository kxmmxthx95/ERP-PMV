import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HiOutlineEye, HiXMark } from 'react-icons/hi2';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { cn } from '@/lib/utils';
import { useActiveAcademicYear } from '@/hooks/useActiveAcademicYear';
import { useTuitionCampaigns, findCurrentCampaign } from '@/features/tuition/hooks/useTuitionCampaigns';
import { useStudentFeesByCampaign } from '@/features/tuition/hooks/useStudentFees';
import { formatTHB } from '@/features/tuition/tuitionCalc';
import { DEPARTMENT_CONFIG, type Department } from '@/types/curriculum';
import { PAYMENT_STATUS_LABEL, tuitionTermLabel, type PaymentStatus, type StudentFee } from '@/types/tuition';
import { WIDGET_CARD, WIDGET_GLASS, WIDGET_STAT_CELL, WIDGET_STAT_LABEL, WIDGET_STAT_VALUE } from '../widgetStyles';

const DRAWER_CONTENT_CLASS = [
  'h-dvh max-h-dvh flex flex-col overflow-hidden p-0 rounded-none',
  'data-[vaul-drawer-direction=right]:w-screen data-[vaul-drawer-direction=right]:max-w-none',
  'data-[vaul-drawer-direction=right]:before:inset-0 data-[vaul-drawer-direction=right]:before:rounded-none',
  'sm:h-full sm:max-h-full sm:rounded-l-3xl sm:overflow-hidden',
  'sm:data-[vaul-drawer-direction=right]:w-full sm:data-[vaul-drawer-direction=right]:max-w-md',
  'sm:data-[vaul-drawer-direction=right]:before:inset-2 sm:data-[vaul-drawer-direction=right]:before:rounded-4xl',
].join(' ');

const STATUS_TONE: Record<PaymentStatus, string> = {
  unpaid: 'bg-rose-50 text-rose-600',
  partial: 'bg-amber-50 text-amber-600',
  pending_verification: 'bg-sky-50 text-sky-600',
  paid: 'bg-emerald-50 text-emerald-600',
};

/** เรียงลำดับเพื่อดันรายการที่ต้องรีบดำเนินการ (รอตรวจสอบ/ค้างชำระ) ขึ้นก่อน */
const ACTIONABLE_ORDER: Record<PaymentStatus, number> = {
  pending_verification: 0,
  unpaid: 1,
  partial: 2,
  paid: 3,
};

function FeeRow({ fee }: { fee: StudentFee }) {
  const remaining = Math.max(fee.netPayable - fee.totalPaid, 0);
  const departmentLabel = DEPARTMENT_CONFIG[fee.departmentId as Department]?.label ?? fee.departmentId;
  return (
    <div className="flex items-center justify-between rounded-2xl border border-slate-100 bg-white px-3.5 py-3">
      <div className="min-w-0">
        <p className="truncate text-[13px] font-black text-slate-800">{fee.studentName}</p>
        <p className="truncate text-[11px] font-bold text-slate-400">{fee.className} · {departmentLabel}</p>
      </div>
      <div className="shrink-0 text-right">
        <p className="tabular-nums text-[13px] font-black text-slate-700">{formatTHB(remaining)}</p>
        <span className={cn('rounded-lg px-2 py-0.5 text-[10px] font-black', STATUS_TONE[fee.status])}>
          {PAYMENT_STATUS_LABEL[fee.status]}
        </span>
      </div>
    </div>
  );
}

export default function TuitionStatusSummaryWidget() {
  const navigate = useNavigate();
  const { year, activeSemester } = useActiveAcademicYear();
  const { campaigns, isLoading: isLoadingCampaigns } = useTuitionCampaigns();
  const currentCampaign = useMemo(
    () => findCurrentCampaign(campaigns, year, activeSemester),
    [campaigns, year, activeSemester],
  );
  const { studentFees, isLoading: isLoadingFees } = useStudentFeesByCampaign(currentCampaign?.id ?? null);
  const isLoading = isLoadingCampaigns || isLoadingFees;
  const [drawerOpen, setDrawerOpen] = useState(false);

  const summary = useMemo(() => {
    const paid = studentFees.filter((f) => f.status === 'paid').length;
    const pending = studentFees.filter((f) => f.status === 'pending_verification').length;
    const outstanding = studentFees.filter((f) => f.status === 'unpaid' || f.status === 'partial').length;
    const totalNet = studentFees.reduce((sum, f) => sum + f.netPayable, 0);
    const totalPaid = studentFees.reduce((sum, f) => sum + f.totalPaid, 0);
    const collectionRate = totalNet > 0 ? Math.round((totalPaid / totalNet) * 100) : 0;
    return { paid, pending, outstanding, totalNet, totalPaid, collectionRate };
  }, [studentFees]);

  const actionableFees = useMemo(
    () =>
      [...studentFees]
        .filter((f) => f.status !== 'paid')
        .sort((a, b) => ACTIONABLE_ORDER[a.status] - ACTIONABLE_ORDER[b.status] || a.studentName.localeCompare(b.studentName, 'th')),
    [studentFees],
  );

  return (
    <>
      <div style={WIDGET_GLASS} className={WIDGET_CARD}>
        <div className="flex items-start justify-between gap-2 shrink-0">
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-black text-slate-800 truncate">สถานะค่าเทอม</p>
            <p className="text-[11px] font-bold text-slate-400 truncate">
              {currentCampaign ? `ปีการศึกษา ${currentCampaign.academicYearId} · ${tuitionTermLabel(currentCampaign.term)}` : `ปีการศึกษา ${year}`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="ดูรายละเอียด"
          >
            <HiOutlineEye size={16} />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-1.5 flex-1 min-h-0 content-center">
          <div className={cn(WIDGET_STAT_CELL, 'bg-emerald-50/70 border border-emerald-100/80')}>
            <span className={cn(WIDGET_STAT_VALUE, 'text-emerald-600')}>{isLoading ? '—' : summary.paid}</span>
            <span className={WIDGET_STAT_LABEL}>ชำระครบแล้ว</span>
          </div>
          <div className={cn(WIDGET_STAT_CELL, 'bg-sky-50/70 border border-sky-100/80')}>
            <span className={cn(WIDGET_STAT_VALUE, 'text-sky-600')}>{isLoading ? '—' : summary.pending}</span>
            <span className={WIDGET_STAT_LABEL}>รอตรวจสอบ</span>
          </div>
          <div className={cn(WIDGET_STAT_CELL, 'bg-rose-50/70 border border-rose-100/80')}>
            <span className={cn(WIDGET_STAT_VALUE, 'text-rose-600')}>{isLoading ? '—' : summary.outstanding}</span>
            <span className={WIDGET_STAT_LABEL}>ค้างชำระ</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="mt-auto w-full shrink-0 truncate rounded-full bg-indigo-600 px-3 py-1.5 text-[11px] font-black text-white transition-all hover:bg-indigo-700 active:scale-[0.98]"
        >
          {isLoading ? 'กำลังโหลด...' : `เก็บได้แล้ว ${summary.collectionRate}% · ${formatTHB(summary.totalPaid)}`}
        </button>
      </div>

      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen} direction="right">
        <DrawerContent className={DRAWER_CONTENT_CLASS}>
          <DrawerHeader className="shrink-0 px-4 pt-4 pb-2">
            <div className="relative flex items-center justify-center min-h-10">
              <div className="min-w-0 px-12 text-center">
                <DrawerTitle className="text-base font-black text-slate-800">สรุปสถานะค่าเทอม</DrawerTitle>
                <DrawerDescription className="text-xs text-slate-500">
                  {currentCampaign ? `ปีการศึกษา ${currentCampaign.academicYearId} · ${tuitionTermLabel(currentCampaign.term)}` : `ปีการศึกษา ${year}`}
                </DrawerDescription>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="absolute right-0 top-1/2 -translate-y-1/2 inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 active:scale-[0.98] transition"
                aria-label="ปิด"
              >
                <HiXMark className="w-4 h-4" />
              </button>
            </div>
          </DrawerHeader>

          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 pb-6">
            <div className="mb-4 rounded-2xl bg-indigo-50/60 px-4 py-3 text-center">
              <p className="text-[11px] font-semibold text-black/40">เก็บได้แล้ว {summary.collectionRate}%</p>
              <p className="text-xl font-black text-indigo-700">
                {formatTHB(summary.totalPaid)} <span className="text-sm font-bold text-indigo-400">/ {formatTHB(summary.totalNet)}</span>
              </p>
            </div>

            {!isLoadingCampaigns && !currentCampaign ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
                <p className="text-sm font-bold text-slate-600">ยังไม่มีรอบเก็บค่าเทอมของภาคเรียนนี้</p>
              </div>
            ) : actionableFees.length === 0 && !isLoading ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
                <p className="text-sm font-bold text-slate-600">นักเรียนชำระค่าเทอมครบทุกคนแล้ว</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {actionableFees.map((fee) => (
                  <FeeRow key={fee.id} fee={fee} />
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                setDrawerOpen(false);
                navigate(currentCampaign ? `/portal/tuition/campaigns/${currentCampaign.id}` : '/portal/tuition/campaigns');
              }}
              className="mt-4 w-full rounded-full bg-indigo-600 px-4 py-2 text-xs font-black text-white hover:bg-indigo-700"
            >
              ไปที่หน้าจัดการค่าเทอม
            </button>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
