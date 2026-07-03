// src/features/home/widgets/DailyAttendanceSummaryWidget.tsx
import { useMemo, useState } from 'react';
import { ChevronRight, RefreshCw } from 'lucide-react';
import { HiXMark } from 'react-icons/hi2';
import {
  useDailyAttendanceSummary,
  type DailyStaffRow,
  type DailyStaffStatus,
} from '@/hooks/useDailyAttendanceSummary';
import {
  WIDGET_CARD,
  WIDGET_GLASS,
  WIDGET_STAT_CELL,
  WIDGET_STAT_LABEL,
  WIDGET_STAT_VALUE,
} from '../widgetStyles';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { DEPARTMENT_CONFIG, type Department } from '@/types/curriculum';
import { formatThaiDateLabelFromIso, getLocalDateString } from '@/lib/dateUtils';

const DRAWER_CONTENT_CLASS = [
  'h-dvh flex flex-col p-0 rounded-none',
  'data-[vaul-drawer-direction=right]:w-screen data-[vaul-drawer-direction=right]:max-w-none',
  'data-[vaul-drawer-direction=right]:before:inset-0 data-[vaul-drawer-direction=right]:before:rounded-none',
  'sm:h-full sm:rounded-l-3xl',
  'sm:data-[vaul-drawer-direction=right]:w-full sm:data-[vaul-drawer-direction=right]:max-w-md',
  'sm:data-[vaul-drawer-direction=right]:before:inset-2 sm:data-[vaul-drawer-direction=right]:before:rounded-4xl',
].join(' ');

const STATUS_META: Record<
  DailyStaffStatus,
  { label: string; badgeClassName: string; cardClassName: string }
> = {
  present: {
    label: 'มา',
    badgeClassName: 'bg-emerald-100 text-emerald-700',
    cardClassName: 'bg-emerald-50/90 border-emerald-200',
  },
  late: {
    label: 'สาย',
    badgeClassName: 'bg-amber-100 text-amber-700',
    cardClassName: 'bg-amber-50/90 border-amber-200',
  },
  absent: {
    label: 'ขาด',
    badgeClassName: 'bg-rose-100 text-rose-700',
    cardClassName: 'bg-rose-50/90 border-rose-200',
  },
  leave: {
    label: 'ลา',
    badgeClassName: 'bg-blue-100 text-blue-700',
    cardClassName: 'bg-blue-50/90 border-blue-200',
  },
  pending: {
    label: 'รอเช็ก',
    badgeClassName: 'bg-slate-100 text-slate-500',
    cardClassName: 'bg-white border-slate-200',
  },
};

const SECTION_ORDER: DailyStaffStatus[] = ['present', 'late', 'leave', 'absent', 'pending'];
const SECTION_LABELS: Record<DailyStaffStatus, string> = {
  present: 'มา',
  late: 'สาย',
  leave: 'ลา',
  absent: 'ขาด',
  pending: 'รอเช็ก',
};

function getDepartmentLabel(department?: string): string | null {
  if (!department) return null;
  const config = DEPARTMENT_CONFIG[department as Department];
  return config?.label ?? department;
}

function StaffRow({ staff }: { staff: DailyStaffRow }) {
  const meta = STATUS_META[staff.status];
  const departmentLabel = getDepartmentLabel(staff.department);

  return (
    <div className={`rounded-2xl border p-3 ${meta.cardClassName}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="w-10 h-10 rounded-xl shrink-0 overflow-hidden bg-slate-100 border border-slate-200/50">
            {staff.photoURL ? (
              <img src={staff.photoURL} alt={staff.displayName} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-sm font-black text-slate-500">
                {staff.displayName.charAt(0)}
              </div>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-black text-slate-800 truncate">{staff.displayName}</p>
            {departmentLabel ? (
              <p className="text-[11px] font-bold text-slate-400 truncate">{departmentLabel}</p>
            ) : null}
          </div>
        </div>
        <span className={`text-[10px] font-black px-2 py-1 rounded-lg shrink-0 ${meta.badgeClassName}`}>
          {meta.label}
        </span>
      </div>
    </div>
  );
}

export default function DailyAttendanceSummaryWidget() {
  const { today, todayStaff, loading, refresh } = useDailyAttendanceSummary(7);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const todayLabel = today?.date ? formatThaiDateLabelFromIso(today.date) : formatThaiDateLabelFromIso(getLocalDateString());

  const groupedStaff = useMemo(() => {
    const groups = new Map<DailyStaffStatus, DailyStaffRow[]>();
    SECTION_ORDER.forEach(status => groups.set(status, []));
    todayStaff.forEach(staff => {
      groups.get(staff.status)?.push(staff);
    });
    return SECTION_ORDER
      .map(status => ({ status, items: groups.get(status) ?? [] }))
      .filter(group => group.items.length > 0);
  }, [todayStaff]);

  return (
    <>
      <div style={WIDGET_GLASS} className={WIDGET_CARD}>
        <div className="flex items-center justify-between shrink-0">
          <div className="min-w-0">
            <p className="font-bold text-sm text-slate-700 truncate">สรุปการเข้างานรายวัน</p>
            <p className="text-[10px] text-slate-400 truncate">{todayLabel}</p>
          </div>
          <button
            onClick={refresh}
            disabled={loading}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-40 shrink-0"
            title="รีเฟรช"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        {today ? (
          <>
            <div className="grid grid-cols-3 gap-2 flex-1 min-h-0">
              <div className={WIDGET_STAT_CELL}>
                <span className={`${WIDGET_STAT_VALUE} text-emerald-600`}>{today.present}</span>
                <span className={WIDGET_STAT_LABEL}>มา</span>
              </div>
              <div className={WIDGET_STAT_CELL}>
                <span className={`${WIDGET_STAT_VALUE} text-amber-500`}>{today.late}</span>
                <span className={WIDGET_STAT_LABEL}>สาย</span>
              </div>
              <div className={WIDGET_STAT_CELL}>
                <span className={`${WIDGET_STAT_VALUE} text-red-500`}>{today.absent}</span>
                <span className={WIDGET_STAT_LABEL}>ขาด</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="mt-auto w-full py-2 rounded-full bg-blue-500 text-white text-xs font-black flex items-center justify-center gap-1.5 hover:bg-blue-600 transition-all active:scale-[0.98] shrink-0"
            >
              {today.present + today.late}/{today.total} คน · ดูรายละเอียด <ChevronRight size={12} />
            </button>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-[10px] text-slate-400">
            ยังไม่มีข้อมูลวันนี้
          </div>
        )}
      </div>

      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen} direction="right">
        <DrawerContent className={DRAWER_CONTENT_CLASS}>
          <DrawerHeader className="px-4 pb-2">
            <div className="relative flex items-center justify-center min-h-10">
              <div className="min-w-0 text-center px-12">
                <DrawerTitle className="text-base font-black text-slate-800">
                  สรุปการเข้างานรายวัน
                </DrawerTitle>
                <DrawerDescription className="text-xs text-slate-500">{todayLabel}</DrawerDescription>
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

          <div className="px-4 pb-4 overflow-y-auto flex-1 min-h-0">
            {loading ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center text-xs font-semibold text-slate-500">
                กำลังโหลด...
              </div>
            ) : todayStaff.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
                <p className="text-sm font-bold text-slate-600">ยังไม่มีข้อมูลบุคลากรวันนี้</p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {groupedStaff.map(({ status, items }) => (
                  <section key={status} className="flex flex-col gap-2.5">
                    <p className="text-[11px] font-black text-slate-500 uppercase tracking-wide px-0.5">
                      {SECTION_LABELS[status]} ({items.length})
                    </p>
                    {items.map(staff => (
                      <StaffRow key={staff.userId} staff={staff} />
                    ))}
                  </section>
                ))}
              </div>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
