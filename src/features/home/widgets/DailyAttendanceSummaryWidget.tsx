// src/features/home/widgets/DailyAttendanceSummaryWidget.tsx
import { useMemo, useState } from 'react';
import { ChevronRight, RefreshCw } from 'lucide-react';
import { HiXMark } from 'react-icons/hi2';
import {
  useDailyAttendanceSummary,
  type DailyStaffRow,
  type DailyStaffStatus,
} from '@/hooks/useDailyAttendanceSummary';
import { useIsSchoolDayToday } from '@/hooks/useIsSchoolDayToday';
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
import {
  getWidgetHolidayCardStyle,
  WidgetHolidayBadge,
  WidgetHolidayBody,
  widgetHolidayDateClass,
  widgetHolidayHeaderClass,
} from '../components/WidgetHolidayContent';
import {
  DRAWER_HEADER_ICON_BTN,
  DRAWER_HEADER_RIGHT_ACTIONS,
} from '@/lib/drawerHeaderBtn';
import { cn } from '@/lib/utils';

const DRAWER_CONTENT_CLASS = cn(
  'flex h-dvh max-h-dvh flex-col overflow-hidden bg-transparent p-0 before:hidden',
  'data-[vaul-drawer-direction=right]:w-screen data-[vaul-drawer-direction=right]:max-w-none',
  'sm:h-full sm:max-h-full sm:p-2.5',
  'sm:data-[vaul-drawer-direction=right]:w-full sm:data-[vaul-drawer-direction=right]:max-w-md',
);

const DRAWER_PANEL_CLASS = cn(
  'flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-white',
  'sm:rounded-4xl sm:border sm:border-slate-200/80 sm:shadow-2xl',
);

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

function getDepartmentConfig(department?: string) {
  if (!department) return null;
  if (!(department in DEPARTMENT_CONFIG)) return null;
  return DEPARTMENT_CONFIG[department as Department];
}

function StaffRow({ staff }: { staff: DailyStaffRow }) {
  const meta = STATUS_META[staff.status];
  const deptCfg = getDepartmentConfig(staff.department);

  return (
    <div className={`rounded-2xl border p-3.5 ${meta.cardClassName}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-3.5">
          <div className="size-[4.25rem] shrink-0 overflow-hidden rounded-full border-2 border-white bg-slate-100 shadow-sm">
            {staff.photoURL ? (
              <img src={staff.photoURL} alt={staff.displayName} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-lg font-black text-slate-500">
                {staff.displayName.charAt(0)}
              </div>
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-black text-slate-800">{staff.displayName}</p>
            {deptCfg ? (
              <span
                className="mt-1 inline-flex max-w-full truncate rounded-md border px-1.5 py-0.5 text-[10px] font-black"
                style={{ color: deptCfg.color, background: deptCfg.bg, borderColor: deptCfg.border }}
              >
                {deptCfg.label}
              </span>
            ) : staff.department ? (
              <span className="mt-1 inline-flex max-w-full truncate rounded-md border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[10px] font-black text-slate-600">
                {staff.department}
              </span>
            ) : null}
            {staff.checkInLabel ? (
              <p className="mt-1 text-[10px] font-bold tabular-nums text-slate-500">
                เข้า {staff.checkInLabel}
              </p>
            ) : null}
          </div>
        </div>
        <span className={`shrink-0 rounded-lg px-2 py-1 text-[10px] font-black ${meta.badgeClassName}`}>
          {meta.label}
        </span>
      </div>
    </div>
  );
}

export default function DailyAttendanceSummaryWidget() {
  const { today, todayStaff, loading, refresh } = useDailyAttendanceSummary(7);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { isHoliday, isWeekend, holidayTitle } = useIsSchoolDayToday();

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
      <div style={isHoliday ? getWidgetHolidayCardStyle(isWeekend) : WIDGET_GLASS} className={WIDGET_CARD}>
        <div className="flex items-center justify-between shrink-0">
          <div className="min-w-0">
            <p className={widgetHolidayHeaderClass(isHoliday)}>สรุปการเข้างานรายวัน</p>
            <p className={widgetHolidayDateClass(isHoliday)}>{todayLabel}</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {isHoliday ? <WidgetHolidayBadge /> : null}
            {!isHoliday ? (
              <button
                onClick={refresh}
                disabled={loading}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-40 shrink-0"
                title="รีเฟรช"
              >
                <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              </button>
            ) : null}
          </div>
        </div>

        {isHoliday ? (
          <WidgetHolidayBody isWeekend={isWeekend} holidayTitle={holidayTitle} />
        ) : today ? (
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
          <div className={DRAWER_PANEL_CLASS}>
            <DrawerHeader className="px-5 pb-3 pt-5 border-b border-slate-100 shrink-0">
              <div className="relative flex items-center justify-center min-h-10">
                <div className="min-w-0 text-center px-12">
                  <DrawerTitle className="text-[15px] font-black text-slate-800 font-sukhumvit">
                    สรุปการเข้างานรายวัน
                  </DrawerTitle>
                  <DrawerDescription className="text-xs text-slate-500 font-sarabun">{todayLabel}</DrawerDescription>
                </div>
                <div className={DRAWER_HEADER_RIGHT_ACTIONS}>
                  <button
                    type="button"
                    onClick={() => setDrawerOpen(false)}
                    className={DRAWER_HEADER_ICON_BTN}
                    aria-label="ปิด"
                  >
                    <HiXMark size={16} />
                  </button>
                </div>
              </div>
            </DrawerHeader>

            <div className="px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 overflow-y-auto flex-1 min-h-0 scrollbar-hide">
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
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
