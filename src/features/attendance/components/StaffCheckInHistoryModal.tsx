import { useEffect, useMemo, useState } from 'react';
import { HiArrowRightOnRectangle, HiClock } from 'react-icons/hi2';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
    <Dialog open={!!staff} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[85vh] max-w-md flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-slate-100 px-5 py-4 text-left">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100 text-sm font-black text-slate-500">
              {staff?.photoURL ? (
                <img src={staff.photoURL} alt={staff.displayName} className="h-full w-full object-cover" />
              ) : (
                staff?.displayName.charAt(0)
              )}
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="truncate text-base font-black text-slate-800">
                {staff?.displayName}
              </DialogTitle>
              <DialogDescription className="mt-0.5 text-xs text-slate-500">
                {deptLabel(staff?.department)} · {from} – {to}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-4 gap-2 border-b border-slate-100 px-5 py-3">
          {([
            ['มา', summary.present, 'text-emerald-700'],
            ['สาย', summary.late, 'text-amber-700'],
            ['ขาด', summary.absent, 'text-rose-700'],
            ['ลา', summary.leave, 'text-blue-700'],
          ] as const).map(([label, value, tone]) => (
            <div key={label} className="rounded-xl bg-slate-50 px-2 py-1.5 text-center">
              <p className="text-[10px] font-bold text-slate-500">{label}</p>
              <p className={cn('text-sm font-black', tone)}>{loading ? '…' : value}</p>
            </div>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-7 w-7 animate-spin rounded-full border-2 border-slate-200 border-t-blue-500" />
            </div>
          ) : error ? (
            <p className="py-8 text-center text-sm font-semibold text-rose-600">{error}</p>
          ) : rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">ไม่มีประวัติในช่วงวันที่ที่เลือก</p>
          ) : (
            <div className="space-y-2">
              {rows.map((row) => {
                const meta = STATUS_META[row.status];
                return (
                  <div
                    key={row.date}
                    className="rounded-2xl border border-slate-100 bg-white px-3 py-2.5 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[12px] font-black text-slate-800">{formatThaiDate(row.date)}</p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[11px] font-bold text-slate-600">
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
                          <p className="mt-1 text-[10px] font-semibold text-slate-400">{row.note}</p>
                        ) : null}
                      </div>
                      <span
                        className={cn(
                          'shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-black',
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
      </DialogContent>
    </Dialog>
  );
}
