import { useEffect, useMemo, useState } from 'react';
import { HiArrowRightOnRectangle, HiClock, HiXMark } from 'react-icons/hi2';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { DRAWER_HEADER_ICON_BTN, DRAWER_HEADER_RIGHT_ACTIONS } from '@/lib/drawerHeaderBtn';
import type { StaffMonthlySummary } from '@/hooks/useAttendanceMonthly';
import {
  loadStaffCheckInHistory,
  summarizeCheckInHistory,
  type CheckInHistoryRow,
  type CheckInHistoryStatus,
} from '@/lib/staffAttendance/checkInHistory';
import { DEPARTMENT_CONFIG, type Department } from '@/types/curriculum';
import { cn } from '@/lib/utils';

const STATUS_META: Record<
  CheckInHistoryStatus,
  { label: string; className: string }
> = {
  present: { label: 'มา', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  late: { label: 'สาย', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  absent: { label: 'ขาด', className: 'bg-rose-50 text-rose-700 border-rose-200' },
  leave: { label: 'ลา', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  pending: { label: 'รอตัดสถานะ', className: 'bg-slate-50 text-slate-500 border-slate-200' },
};

const DRAWER_CONTENT_CLASS = cn(
  'flex h-dvh max-h-dvh flex-col overflow-hidden bg-transparent p-0 before:hidden z-50',
  'data-[vaul-drawer-direction=right]:w-screen data-[vaul-drawer-direction=right]:max-w-none',
  'sm:h-full sm:max-h-full sm:p-2',
  'sm:data-[vaul-drawer-direction=right]:w-full sm:data-[vaul-drawer-direction=right]:max-w-md',
);

const DRAWER_PANEL_CLASS = cn(
  'flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-white',
  'sm:rounded-4xl sm:border sm:border-border sm:shadow-xl',
);

function formatThaiDate(date: string): string {
  const d = new Date(`${date}T12:00:00`);
  return d.toLocaleDateString('th-TH', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function deptLabel(department?: string) {
  if (!department) return '-';
  return DEPARTMENT_CONFIG[department as Department]?.label || department;
}

interface Props {
  staff: StaffMonthlySummary | null;
  from: string;
  to: string;
  leaveDates: Set<string>;
  isSpecialTeacher?: boolean;
  onClose: () => void;
}

export function StaffCheckInHistoryModal({
  staff,
  from,
  to,
  leaveDates,
  isSpecialTeacher = false,
  onClose,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rows, setRows] = useState<CheckInHistoryRow[]>([]);

  useEffect(() => {
    if (!staff) {
      setRows([]);
      setError('');
      return;
    }

    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError('');
      try {
        const history = await loadStaffCheckInHistory(staff.userId, from, to, leaveDates, isSpecialTeacher);
        if (!cancelled) setRows(history);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'โหลดประวัติไม่สำเร็จ');
          setRows([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [staff, from, to, leaveDates, isSpecialTeacher]);

  const summary = useMemo(() => summarizeCheckInHistory(rows), [rows]);

  return (
    <Drawer open={!!staff} onOpenChange={(open) => !open && onClose()} direction="right">
      <DrawerContent className={DRAWER_CONTENT_CLASS}>
        <div className={DRAWER_PANEL_CLASS}>
          <DrawerHeader className="shrink-0 py-4 border-b border-border bg-slate-50/50 backdrop-blur-xs px-6 sm:px-8">
            <div className="relative flex min-h-12 items-center justify-between">
              <div className="flex items-center gap-3 pr-8">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100 text-sm font-black text-slate-500">
                  {staff?.photoURL ? (
                    <img src={staff.photoURL} alt={staff.displayName} className="h-full w-full object-cover" />
                  ) : (
                    staff?.displayName.charAt(0)
                  )}
                </div>
                <div className="min-w-0 flex-1 text-left">
                  <DrawerTitle className="truncate text-base font-black font-sukhumvit text-slate-800">
                    {staff?.displayName}
                  </DrawerTitle>
                  <p className="mt-0.5 text-xs font-bold text-slate-500 font-sukhumvit">
                    {deptLabel(staff?.department)} · {from} – {to}
                  </p>
                </div>
              </div>
              <div className={DRAWER_HEADER_RIGHT_ACTIONS}>
                <button
                  type="button"
                  onClick={onClose}
                  className={DRAWER_HEADER_ICON_BTN}
                  aria-label="ปิด"
                >
                  <HiXMark className="h-4 w-4" />
                </button>
              </div>
            </div>
          </DrawerHeader>

          <div className="grid grid-cols-4 gap-2 border-b border-slate-100 px-6 py-3 bg-slate-50/20 sm:px-8">
            {([
              ['มา', summary.present, 'text-emerald-700'],
              ['สาย', summary.late, 'text-amber-700'],
              ['ขาด', summary.absent, 'text-rose-700'],
              ['ลา', summary.leave, 'text-blue-700'],
            ] as const).map(([label, value, tone]) => (
              <div key={label} className="rounded-xl bg-slate-100/50 px-2 py-1.5 text-center">
                <p className="text-[10px] font-bold text-slate-500 font-sukhumvit">{label}</p>
                <p className={cn('text-sm font-black font-sukhumvit', tone)}>{loading ? '…' : value}</p>
              </div>
            ))}
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-7 w-7 animate-spin rounded-full border-2 border-slate-200 border-t-blue-500" />
              </div>
            ) : error ? (
              <p className="py-8 px-6 text-center text-sm font-semibold text-rose-600 font-sukhumvit sm:px-8">{error}</p>
            ) : rows.length === 0 ? (
              <p className="py-8 px-6 text-center text-sm text-slate-400 font-sukhumvit sm:px-8">ไม่มีประวัติในช่วงวันที่ที่เลือก</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {rows.map((row) => {
                  const meta = STATUS_META[row.status];
                  return (
                    <div
                      key={row.date}
                      className="bg-white px-6 py-3.5 sm:px-8 hover:bg-slate-50/50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-[12px] font-black text-slate-800 font-sukhumvit">{formatThaiDate(row.date)}</p>
                          <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[11px] font-bold text-slate-600 font-sukhumvit">
                            <span className="inline-flex items-center gap-1">
                              <HiClock className="h-3.5 w-3.5 text-emerald-500" />
                              เข้า {row.checkInLabel}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <HiArrowRightOnRectangle className="h-3.5 w-3.5 text-slate-400" />
                              ออก {row.checkOutLabel}
                            </span>
                          </div>
                          {row.note ? (
                            <p className="mt-1 text-[10px] font-semibold text-slate-400 font-sukhumvit">{row.note}</p>
                          ) : null}
                        </div>
                        <span
                          className={cn(
                            'shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-black font-sukhumvit',
                            meta.className,
                          )}
                        >
                          {meta.label}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
