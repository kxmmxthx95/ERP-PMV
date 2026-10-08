// src/features/teacherDashboard/components/SubjectAttendanceCalendarDrawer.tsx
import { useMemo, useState, useSyncExternalStore } from 'react';
import { HiChevronLeft, HiChevronRight, HiOutlineCheckCircle, HiOutlineXCircle, HiXMark } from 'react-icons/hi2';
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { DRAWER_HEADER_ICON_BTN, DRAWER_HEADER_RIGHT_ACTIONS } from '@/lib/drawerHeaderBtn';
import { classesCollectionStore } from '@/lib/firestoreShared/classesStore';
import type { SessionLite } from '@/hooks/useTeacherDashboardKpi';
import type { ScheduleEntry } from '@/types/schedule';
import { cn } from '@/lib/utils';

const THAI_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
];
const WEEKDAYS = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

type DayStatus = 'done' | 'partial' | 'missing' | 'upcoming';

interface PeriodInfo {
  period: number;
  classId: string;
  done: boolean;
}

interface DayInfo {
  status: DayStatus;
  periods: PeriodInfo[];
}

const STATUS_CELL: Record<DayStatus, string> = {
  done: 'bg-emerald-100 text-emerald-700',
  partial: 'bg-amber-100 text-amber-700',
  missing: 'bg-destructive/10 text-destructive',
  upcoming: 'bg-muted text-muted-foreground',
};

const STATUS_LEGEND: { status: DayStatus; label: string }[] = [
  { status: 'done', label: 'เช็คครบ' },
  { status: 'partial', label: 'เช็คบางคาบ' },
  { status: 'missing', label: 'ยังไม่เช็ค' },
  { status: 'upcoming', label: 'ยังไม่ถึงวัน' },
];

function toYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subject: { subjectId: string; subjectName: string; subjectCode?: string } | null;
  schedule: ScheduleEntry[];
  sessions: SessionLite[];
  workingDays: string[];
  range: { from: string; to: string };
  today: string;
}

export function SubjectAttendanceCalendarDrawer({
  open, onOpenChange, subject, schedule, sessions, workingDays, range, today,
}: Props) {
  // เดือนที่เปิดดูได้ = เฉพาะเดือนที่อยู่ในช่วงเก็บค่า
  const firstMonth = Number(range.from.slice(5, 7)) - 1;
  const firstYear = Number(range.from.slice(0, 4));
  const lastMonth = Number(range.to.slice(5, 7)) - 1;
  const lastYear = Number(range.to.slice(0, 4));
  const monthIndex = (y: number, m: number) => y * 12 + m;
  const minIdx = monthIndex(firstYear, firstMonth);
  const maxIdx = Math.max(minIdx, monthIndex(lastYear, lastMonth));

  const [viewIdx, setViewIdx] = useState(maxIdx);
  const [selected, setSelected] = useState<string | null>(null);
  const clampedIdx = Math.min(Math.max(viewIdx, minIdx), maxIdx);
  const viewY = Math.floor(clampedIdx / 12);
  const viewM = clampedIdx % 12;

  const dayMap = useMemo(() => {
    const map = new Map<string, DayInfo>();
    if (!subject) return map;
    const byDow = new Map<number, ScheduleEntry[]>();
    schedule
      .filter((e) => e.subjectId === subject.subjectId)
      .forEach((e) => byDow.set(e.day, [...(byDow.get(e.day) ?? []), e]));
    const done = new Set(
      sessions
        .filter((s) => s.subjectId === subject.subjectId && s.period != null)
        .map((s) => `${s.date}|${s.period}`),
    );

    for (const date of workingDays) {
      const entries = byDow.get(new Date(`${date}T00:00:00`).getDay());
      if (!entries?.length) continue;
      const periods = entries
        .map((e) => ({ period: e.period, classId: e.classId, done: done.has(`${date}|${e.period}`) }))
        .sort((a, b) => a.period - b.period);
      const doneCount = periods.filter((p) => p.done).length;
      let status: DayStatus;
      if (doneCount === periods.length) status = 'done';
      else if (doneCount > 0) status = 'partial';
      else status = date >= today ? 'upcoming' : 'missing';
      map.set(date, { status, periods });
    }
    return map;
  }, [subject, schedule, sessions, workingDays, today]);

  const cells = useMemo(() => {
    const first = new Date(viewY, viewM, 1);
    const days = new Date(viewY, viewM + 1, 0).getDate();
    const out: (string | null)[] = Array.from({ length: first.getDay() }, () => null);
    for (let d = 1; d <= days; d++) out.push(toYMD(new Date(viewY, viewM, d)));
    while (out.length % 7 !== 0) out.push(null);
    return out;
  }, [viewY, viewM]);

  // ตารางสอนเก็บ classId เป็นรหัสเอกสาร — แปลงเป็นชื่อห้อง (เช่น ม.4/1) ตอนแสดง
  const classes = useSyncExternalStore(
    classesCollectionStore.subscribe,
    classesCollectionStore.getSnapshot,
    classesCollectionStore.getSnapshot,
  );
  const classLabel = (classId: string) => {
    const cls = classes.find((c) => c.id === classId);
    return (cls?.className as string | undefined) || classId;
  };

  const selectedInfo = selected ? dayMap.get(selected) : undefined;

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="right">
      <DrawerContent
        className={cn(
          'flex h-dvh flex-col bg-transparent p-0 before:hidden',
          'data-[vaul-drawer-direction=right]:w-screen data-[vaul-drawer-direction=right]:max-w-none',
          'sm:h-full sm:data-[vaul-drawer-direction=right]:w-full sm:data-[vaul-drawer-direction=right]:max-w-md sm:p-2',
        )}
      >
        <div className="flex h-full min-h-0 flex-col overflow-hidden bg-card sm:rounded-4xl sm:border sm:border-border sm:shadow-xl">
          <DrawerHeader className="shrink-0 px-4 pb-2 pt-4">
            <div className="relative flex min-h-10 items-center justify-center">
              <div className="min-w-0 px-12 text-center">
                <DrawerTitle className="truncate text-base font-black">{subject?.subjectName}</DrawerTitle>
                <DrawerDescription className="text-xs text-muted-foreground">
                  ปฏิทินการเช็คชื่อรายคาบ{subject?.subjectCode ? ` · ${subject.subjectCode}` : ''}
                </DrawerDescription>
              </div>
              <div className={DRAWER_HEADER_RIGHT_ACTIONS}>
                <button type="button" onClick={() => onOpenChange(false)} className={DRAWER_HEADER_ICON_BTN} aria-label="ปิด">
                  <HiXMark className="h-4 w-4" />
                </button>
              </div>
            </div>
          </DrawerHeader>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-4 scrollbar-hide">
            <div className="flex items-center justify-between">
              <button
                type="button"
                className={DRAWER_HEADER_ICON_BTN}
                disabled={clampedIdx <= minIdx}
                onClick={() => setViewIdx(clampedIdx - 1)}
                aria-label="เดือนก่อนหน้า"
              >
                <HiChevronLeft className="h-4 w-4" />
              </button>
              <p className="text-sm font-black">{THAI_MONTHS[viewM]} {viewY + 543}</p>
              <button
                type="button"
                className={DRAWER_HEADER_ICON_BTN}
                disabled={clampedIdx >= maxIdx}
                onClick={() => setViewIdx(clampedIdx + 1)}
                aria-label="เดือนถัดไป"
              >
                <HiChevronRight className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1.5 text-center">
              {WEEKDAYS.map((w) => (
                <span key={w} className="text-[10px] font-black text-muted-foreground">{w}</span>
              ))}
              {cells.map((date, i) => {
                if (!date) return <span key={`e${i}`} />;
                const info = dayMap.get(date);
                const label = Number(date.slice(8));
                if (!info) {
                  return (
                    <span key={date} className="flex aspect-square items-center justify-center text-xs text-muted-foreground/50">
                      {label}
                    </span>
                  );
                }
                return (
                  <button
                    key={date}
                    type="button"
                    onClick={() => setSelected(date)}
                    className={cn(
                      'flex aspect-square items-center justify-center rounded-2xl text-xs font-black transition',
                      STATUS_CELL[info.status],
                      selected === date && 'ring-2 ring-primary',
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap gap-x-3 gap-y-1">
              {STATUS_LEGEND.map((l) => (
                <span key={l.status} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <span className={cn('h-2.5 w-2.5 rounded-full', STATUS_CELL[l.status])} />
                  {l.label}
                </span>
              ))}
            </div>

            <div className="rounded-2xl bg-muted/40 p-4">
              {selected && selectedInfo ? (
                <>
                  <p className="mb-2 text-xs font-black">
                    {new Date(`${selected}T00:00:00`).toLocaleDateString('th-TH', {
                      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                    })}
                  </p>
                  <div className="flex flex-col gap-2">
                    {selectedInfo.periods.map((p) => (
                      <div key={p.period} className="flex items-center justify-between gap-2 text-sm">
                        <span className="font-bold">คาบ {p.period} · {classLabel(p.classId)}</span>
                        {p.done ? (
                          <span className="flex items-center gap-1 text-xs font-bold text-emerald-700">
                            <HiOutlineCheckCircle className="h-4 w-4" /> เช็คแล้ว
                          </span>
                        ) : (
                          <span
                            className={cn(
                              'flex items-center gap-1 text-xs font-bold',
                              selected < today ? 'text-destructive' : 'text-muted-foreground',
                            )}
                          >
                            <HiOutlineXCircle className="h-4 w-4" />
                            {selected < today ? 'ยังไม่เช็ค' : 'ยังไม่ถึงเวลา'}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">แตะวันที่ที่มีสีเพื่อดูสถานะรายคาบ</p>
              )}
            </div>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
