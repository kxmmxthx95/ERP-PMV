import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  HiArrowTrendingUp,
  HiBell,
  HiCalendarDays,
  HiCheckCircle,
  HiChevronLeft,
  HiChevronRight,
  HiClipboardDocumentCheck,
  HiClock,
  HiUserMinus,
  HiUsers,
  HiXMark,
} from 'react-icons/hi2';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import {
  Carousel,
  type CarouselApi,
  CarouselContent,
  CarouselItem,
} from '@/components/ui/carousel';
import StudentAvatar from '@/features/students/components/StudentAvatar';
import { useActiveAcademicYear } from '@/hooks/useActiveAcademicYear';
import { useStudentSummary } from '@/hooks/useStudentSummary';
import { useMorningRollCallDailyStats } from '@/hooks/useMorningRollCallDailyStats';
import { useTodayRollCallSessions } from '@/hooks/useMorningRollCall';
import { useClassroomManager } from '@/features/classes/hooks/useClassroomManager';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import {
  ExamFilterShowResultsButton,
  ExamMobileFilterDrawer,
  ExamMobileFilterTriggerButton,
} from '@/features/exam/components/ExamMobileFilterMenuButton';
import { DEPARTMENT_CONFIG, type Department } from '@/types/curriculum';
import { cn } from '@/lib/utils';
import type { AcademicYear } from '@/types/settings';
import type { MorningRollCallSession, RollCallStatus } from '@/types/morningRollCall';

const DASHBOARD_KICKER_CLASS = 'text-[10px] font-black uppercase tracking-[0.18em] sm:text-[11px]';
const DASHBOARD_SECTION_TITLE_CLASS = 'mt-1 text-sm font-black text-slate-900 sm:text-lg';
const DASHBOARD_SECTION_META_CLASS = 'text-[11px] font-semibold text-slate-400 sm:text-xs';

function DashboardListCarousel<T>({
  items,
  getKey,
  renderItem,
  itemClassName = 'basis-[88%]',
  dotActiveClassName = 'bg-sky-500',
  getAriaLabel,
  className = 'mt-3 md:mt-4 md:hidden',
  clipBleed = false,
}: {
  items: T[];
  getKey: (item: T) => string;
  renderItem: (item: T, index: number) => React.ReactNode;
  itemClassName?: string;
  dotActiveClassName?: string;
  getAriaLabel?: (item: T, index: number) => string;
  className?: string;
  clipBleed?: boolean;
}) {
  const [carouselApi, setCarouselApi] = useState<CarouselApi | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (!carouselApi) return;
    const onSelect = () => setActiveIndex(carouselApi.selectedScrollSnap());
    onSelect();
    carouselApi.on('select', onSelect);
    carouselApi.on('reInit', onSelect);
    return () => {
      carouselApi.off('select', onSelect);
      carouselApi.off('reInit', onSelect);
    };
  }, [carouselApi]);

  if (items.length === 0) return null;

  return (
    <div className={cn(className, clipBleed && '-mx-1.5 overflow-hidden sm:-mx-2')}>
      <Carousel
        setApi={setCarouselApi}
        opts={{ align: 'start', containScroll: 'trimSnaps' }}
        className={clipBleed ? undefined : 'md:-mx-4'}
      >
        <CarouselContent className={cn('-ml-3', clipBleed ? 'pl-1.5 sm:pl-2' : 'px-0 md:px-4')}>
          {items.map((item, index) => (
            <CarouselItem key={getKey(item)} className={cn('pl-3', itemClassName)}>
              {renderItem(item, index)}
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>

      {items.length > 1 && (
        items.length <= 10 ? (
          <div className="mt-2 flex items-center justify-center gap-1.5 md:mt-3">
            {items.map((item, index) => (
              <button
                key={getKey(item)}
                type="button"
                onClick={() => carouselApi?.scrollTo(index)}
                className={cn(
                  'h-1.5 rounded-full transition-all',
                  index === activeIndex ? cn('w-4', dotActiveClassName) : 'w-1.5 bg-slate-200',
                )}
                aria-label={getAriaLabel?.(item, index) ?? `ไปที่รายการที่ ${index + 1}`}
              />
            ))}
          </div>
        ) : (
          <p className="mt-2 text-center text-[11px] font-semibold text-slate-400 md:mt-3">
            {activeIndex + 1} / {items.length}
          </p>
        )
      )}
    </div>
  );
}

type DepartmentDailySummary = {
  department: Department;
  label: string;
  present: number;
  late: number;
  absent: number;
  leave: number;
  totalStudents: number;
};

function DepartmentChartCard({ dept }: { dept: DepartmentDailySummary }) {
  const chartData = [
    { name: 'มา', value: dept.present, color: STATUS_COLORS.present },
    { name: 'สาย', value: dept.late, color: STATUS_COLORS.late },
    { name: 'ขาด', value: dept.absent, color: STATUS_COLORS.absent },
    { name: 'ลา', value: dept.leave, color: STATUS_COLORS.leave },
  ].filter((item) => item.value > 0);
  const rate = dept.totalStudents > 0
    ? Math.round(((dept.present + dept.late) / dept.totalStudents) * 100)
    : 0;

  return (
    <div className="rounded-3xl border border-white bg-white/55 p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-black text-slate-800">{dept.label}</p>
          <p className="text-[11px] font-semibold text-slate-400">{dept.totalStudents} คน-ครั้ง</p>
        </div>
        <span className="rounded-full bg-teal-50 px-2.5 py-1 text-[11px] font-black text-teal-600">{rate}%</span>
      </div>
      <div className="mt-1.5 h-20 md:mt-2 md:h-24">
        {chartData.length === 0 ? (
          <div className="flex h-full items-center justify-center text-[11px] font-bold text-slate-300">ไม่มีข้อมูล</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={chartData} dataKey="value" innerRadius={30} outerRadius={44} paddingAngle={3}>
                {chartData.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
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

type WatchlistStudent = {
  studentId: string;
  studentName: string;
  studentCode: string;
  late: number;
  absent: number;
  className: string;
  departmentId: Department | null;
};

type RollCallProgressItem = {
  classId: string;
  className: string;
  departmentId: Department | null;
  teacherName: string;
  teacherPhotoURL?: string;
  checked: boolean;
  checkedAt: string;
};

function WatchlistStudentCard({ student, index }: { student: WatchlistStudent; index: number }) {
  return (
    <div className="flex items-center gap-2.5 overflow-hidden rounded-2xl bg-white/60 p-2.5 shadow-sm md:gap-3 md:rounded-3xl md:p-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-sm font-black text-white">
        {index + 1}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-black text-slate-800">{student.studentName}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
          <p className="truncate text-[11px] font-semibold text-slate-400">
            {student.className} · {student.studentCode}
          </p>
          {student.departmentId && (
            <span
              className="shrink-0 rounded-full px-2 py-0.5 text-[9px] font-black"
              style={{
                color: DEPARTMENT_CONFIG[student.departmentId].color,
                background: DEPARTMENT_CONFIG[student.departmentId].bg,
                border: `1px solid ${DEPARTMENT_CONFIG[student.departmentId].border}`,
              }}
            >
              {DEPARTMENT_CONFIG[student.departmentId].label}
            </span>
          )}
        </div>
      </div>
      <div className="flex shrink-0 gap-1.5">
        <span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-black text-amber-600">
          สาย {student.late}
        </span>
        <span className="rounded-full bg-rose-50 px-2 py-1 text-[10px] font-black text-rose-600">
          ขาด {student.absent}
        </span>
      </div>
    </div>
  );
}

function RollCallProgressCard({ item }: { item: RollCallProgressItem }) {
  return (
    <div className="flex items-center gap-2.5 overflow-hidden rounded-2xl bg-white/60 p-2.5 shadow-sm md:gap-3 md:rounded-3xl md:p-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-slate-100 text-xs font-black text-slate-500">
        {item.teacherPhotoURL ? (
          <img src={item.teacherPhotoURL} alt={item.teacherName} className="h-full w-full object-cover" />
        ) : (
          item.teacherName.slice(0, 1)
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-black text-slate-800">{item.teacherName}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
          <p className="text-[11px] font-bold text-slate-400">{item.className}</p>
          {item.departmentId && (
            <span
              className="rounded-full px-2 py-0.5 text-[9px] font-black"
              style={{
                color: DEPARTMENT_CONFIG[item.departmentId].color,
                background: DEPARTMENT_CONFIG[item.departmentId].bg,
                border: `1px solid ${DEPARTMENT_CONFIG[item.departmentId].border}`,
              }}
            >
              {DEPARTMENT_CONFIG[item.departmentId].label}
            </span>
          )}
        </div>
      </div>
      {item.checked ? (
        <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1.5 text-[10px] font-black text-emerald-600">
          ● เช็คชื่อแล้ว {item.checkedAt && `(${item.checkedAt} น.)`}
        </span>
      ) : (
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="rounded-full bg-amber-50 px-2.5 py-1.5 text-[10px] font-black text-amber-600">
            ● รอดำเนินการ
          </span>
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-sky-50 text-sky-600 transition hover:bg-sky-100"
            title="สะกิดเตือน"
            aria-label={`สะกิดเตือน ${item.teacherName}`}
          >
            <HiBell className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

const GLASS: React.CSSProperties = {
  background: 'rgba(255,255,255,0.72)',
  backdropFilter: 'blur(24px) saturate(150%)',
  WebkitBackdropFilter: 'blur(24px) saturate(150%)',
  border: '1px solid rgba(255,255,255,0.90)',
  boxShadow: '0 8px 32px rgba(0,0,0,0.06)',
};

const DASHBOARD_SECTION_CLASS =
  'rounded-none border-0 bg-transparent p-0 shadow-none md:rounded-[28px] md:border md:border-white/90 md:bg-white/[0.72] md:p-4 md:shadow-[0_8px_32px_rgba(0,0,0,0.06)] md:backdrop-blur-2xl md:saturate-150';

const DEPARTMENTS = ['early', 'primary', 'secondary'] as const satisfies readonly Department[];
const STATUS_COLORS: Record<Exclude<RollCallStatus, 'unmarked'>, string> = {
  present: '#14b8a6',
  late: '#f59e0b',
  absent: '#f43f5e',
  leave: '#8b5cf6',
};

function getCurrentMonthKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function getMonthRangeFromKey(monthKey: string): { from: string; to: string; label: string } {
  const [year, month] = monthKey.split('-').map(Number);
  const from = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const to = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  const label = new Date(year, month - 1, 1).toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });
  return { from, to, label };
}

function monthKeyFromDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function parseMonthKey(monthKey: string): Date {
  const [year, month] = monthKey.split('-').map(Number);
  return new Date(year, month - 1, 1);
}

function getAcademicYearBounds(activeYear: AcademicYear | null): { startMonth: Date; endMonth: Date } {
  const beYear = Number.parseInt(activeYear?.year ?? '', 10);
  const adYear = Number.isFinite(beYear) ? beYear - 543 : new Date().getFullYear();
  const startDate = activeYear?.startDate || `${adYear}-05-15`;
  const endDate = activeYear?.endDate || `${adYear + 1}-03-07`;

  return {
    startMonth: parseMonthKey(startDate.slice(0, 7)),
    endMonth: parseMonthKey(endDate.slice(0, 7)),
  };
}

function buildMonthOptionsInAcademicYear(activeYear: AcademicYear | null): { value: string; label: string }[] {
  const { startMonth, endMonth } = getAcademicYearBounds(activeYear);
  const now = new Date();
  const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const latestMonth = currentMonth <= endMonth ? currentMonth : endMonth;

  if (latestMonth < startMonth) return [];

  const options: { value: string; label: string }[] = [];
  let cursor = new Date(latestMonth);

  while (cursor >= startMonth) {
    options.push({
      value: monthKeyFromDate(cursor),
      label: cursor.toLocaleDateString('th-TH', { month: 'short', year: 'numeric' }),
    });
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1);
  }

  return options;
}

const DEPT_FILTER_OPTIONS: { value: Department | 'all'; label: string }[] = [
  { value: 'all', label: 'ทั้งโรงเรียน' },
  ...DEPARTMENTS.map((dept) => ({
    value: dept,
    label: DEPARTMENT_CONFIG[dept].label,
  })),
];

const DASHBOARD_FILTER_SELECT_CLASS =
  'w-auto shrink-0 [&_select]:h-9 [&_select]:rounded-full [&_select]:border [&_select]:border-slate-200 [&_select]:bg-white [&_select]:pl-3 [&_select]:pr-8 [&_select]:text-[10px] [&_select]:font-black [&_select]:text-slate-700 [&_select]:shadow-sm [&_svg]:size-3.5';

type DashboardViewMode = 'day' | 'month';

const PERIOD_TOGGLE_BUTTON_CLASS =
  'flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition-colors hover:bg-slate-50';

function formatThaiDateLabel(dateKey: string): string {
  const date = new Date(`${dateKey}T12:00:00`);
  if (Number.isNaN(date.getTime())) return dateKey;
  return date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
}

function getAcademicYearDateBounds(activeYear: AcademicYear | null): { min: string; max: string } {
  const beYear = Number.parseInt(activeYear?.year ?? '', 10);
  const adYear = Number.isFinite(beYear) ? beYear - 543 : new Date().getFullYear();
  const startDate = activeYear?.startDate || `${adYear}-05-15`;
  const endDate = activeYear?.endDate || `${adYear + 1}-03-07`;
  const today = getLocalDateKey();
  const max = endDate < today ? endDate : today;
  return { min: startDate, max };
}

function DashboardPeriodToggle({
  viewMode,
  selectedDate,
  minDate,
  maxDate,
  onSelectDayView,
  onDateChange,
}: {
  viewMode: DashboardViewMode;
  selectedDate: string;
  minDate: string;
  maxDate: string;
  onSelectDayView: () => void;
  onDateChange: (value: string) => void;
}) {
  const dateInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => {
          onSelectDayView();
          dateInputRef.current?.showPicker?.();
          dateInputRef.current?.click();
        }}
        className={cn(
          PERIOD_TOGGLE_BUTTON_CLASS,
          viewMode === 'day' && 'border-sky-200 bg-sky-50 text-sky-700',
        )}
        title="ดูย้อนหลังรายวัน"
        aria-label="ดูย้อนหลังรายวัน"
      >
        <HiCalendarDays className="h-4 w-4" />
      </button>
      <input
        ref={dateInputRef}
        type="date"
        value={selectedDate}
        min={minDate}
        max={maxDate}
        onChange={(e) => {
          if (!e.target.value) return;
          onSelectDayView();
          onDateChange(e.target.value);
        }}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
      />
    </div>
  );
}

function MorningRollCallDashboardFilters({
  variant,
  selectedMonth,
  filterDept,
  monthOptions,
  onMonthChange,
  onDeptChange,
}: {
  variant: 'mobile' | 'desktop';
  selectedMonth: string;
  filterDept: Department | 'all';
  monthOptions: { value: string; label: string }[];
  onMonthChange: (value: string) => void;
  onDeptChange: (value: Department | 'all') => void;
}) {
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const hasActiveFilters = filterDept !== 'all' || selectedMonth !== getCurrentMonthKey();

  if (variant === 'mobile') {
    return (
      <>
        <ExamMobileFilterTriggerButton
          onClick={() => setMobileFilterOpen(true)}
          title="ตัวกรอง Dashboard เข้าแถว"
          hasActiveFilters={hasActiveFilters}
        />
        <ExamMobileFilterDrawer
          open={mobileFilterOpen}
          onOpenChange={setMobileFilterOpen}
          title="ตัวกรอง Dashboard"
          description="เลือกเดือนและแผนกที่ต้องการดูสถิติ"
          footer={<ExamFilterShowResultsButton onClick={() => setMobileFilterOpen(false)} />}
        >
          <div>
            <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-slate-400">เดือน</p>
            <div className="grid max-h-48 grid-cols-2 gap-2 overflow-y-auto">
              {monthOptions.map((option) => {
                const isActive = selectedMonth === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => onMonthChange(option.value)}
                    className={cn(
                      'rounded-xl border px-3 py-2.5 text-[12px] font-black transition-all',
                      isActive
                        ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
                    )}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-slate-400">แผนก</p>
            <div className="grid grid-cols-2 gap-2">
              {DEPT_FILTER_OPTIONS.map((option) => {
                const isActive = filterDept === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => onDeptChange(option.value)}
                    className={cn(
                      'rounded-xl border px-3 py-2.5 text-[12px] font-black transition-all',
                      isActive
                        ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
                    )}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
        </ExamMobileFilterDrawer>
      </>
    );
  }

  return (
    <div className="pointer-events-auto flex items-center gap-1.5">
      <NativeSelect
        value={selectedMonth}
        onChange={(e) => onMonthChange(e.target.value)}
        aria-label="เลือกเดือน"
        className={cn(DASHBOARD_FILTER_SELECT_CLASS, 'min-w-[96px]')}
      >
        {monthOptions.map((option) => (
          <NativeSelectOption key={option.value} value={option.value}>
            {option.label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      <NativeSelect
        value={filterDept}
        onChange={(e) => onDeptChange(e.target.value as Department | 'all')}
        aria-label="เลือกแผนก"
        className={cn(DASHBOARD_FILTER_SELECT_CLASS, 'min-w-[88px]')}
      >
        {DEPT_FILTER_OPTIONS.map((option) => (
          <NativeSelectOption key={option.value} value={option.value}>
            {option.label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </div>
  );
}

function getLocalDateKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getWeekRange(): { from: string; to: string } {
  const now = new Date();
  const day = now.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { from: getLocalDateKey(monday), to: getLocalDateKey(sunday) };
}

function formatTime(value?: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
}

function getDepartmentFromClassName(className: string): Department | null {
  if (className.startsWith('ม')) return 'secondary';
  if (className.startsWith('ป')) return 'primary';
  if (className.startsWith('อ')) return 'early';
  return null;
}

type TodayStatKey = 'present' | 'late' | 'absent' | 'leave' | 'all';

interface TodayStudentRow {
  studentId: string;
  studentName: string;
  studentCode: string;
  className: string;
  departmentId: Department | null;
  status: RollCallStatus;
  photoURL?: string;
  gender?: 'male' | 'female';
}

const TODAY_STAT_META: Record<TodayStatKey, { label: string; color: string; modalTitle: string }> = {
  present: { label: 'มาเรียน', color: 'text-teal-600', modalTitle: 'รายชื่อมาเรียน' },
  late: { label: 'มาสาย', color: 'text-amber-600', modalTitle: 'รายชื่อมาสาย' },
  absent: { label: 'ขาดเรียน', color: 'text-rose-600', modalTitle: 'รายชื่อขาดเรียน' },
  leave: { label: 'ลา', color: 'text-violet-600', modalTitle: 'รายชื่อลา' },
  all: { label: 'นักเรียนในระบบ', color: 'text-slate-700', modalTitle: 'นักเรียนในระบบ' },
};

const STAT_DRAWER_ITEMS_PER_PAGE = 20;

export default function MorningRollCallDashboardPage() {
  const { activeYear, year, isLoaded } = useActiveAcademicYear();
  const [viewMode, setViewMode] = useState<DashboardViewMode>('day');
  const [selectedDate, setSelectedDate] = useState(getLocalDateKey);
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthKey);
  const [filterDept, setFilterDept] = useState<Department | 'all'>('all');
  const [activeStatModal, setActiveStatModal] = useState<TodayStatKey | null>(null);
  const [statDrawerPage, setStatDrawerPage] = useState(1);
  const [mobileActionsEl, setMobileActionsEl] = useState<HTMLElement | null>(null);
  const [rightActionsEl, setRightActionsEl] = useState<HTMLElement | null>(null);
  const [isLgUp, setIsLgUp] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : true,
  );

  useEffect(() => {
    setMobileActionsEl(document.getElementById('header-portal-mobile-actions'));
    setRightActionsEl(document.getElementById('header-portal-right-actions'));
  }, []);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const onChange = () => setIsLgUp(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const monthOptions = useMemo(() => buildMonthOptionsInAcademicYear(activeYear), [activeYear]);

  useEffect(() => {
    if (monthOptions.length === 0) return;
    if (!monthOptions.some((option) => option.value === selectedMonth)) {
      setSelectedMonth(monthOptions[0].value);
    }
  }, [monthOptions, selectedMonth]);
  const monthRange = useMemo(() => getMonthRangeFromKey(selectedMonth), [selectedMonth]);
  const weekRange = useMemo(() => getWeekRange(), []);
  const academicDateBounds = useMemo(() => getAcademicYearDateBounds(activeYear), [activeYear]);
  const todayKey = getLocalDateKey();
  const isViewingToday = selectedDate === todayKey;

  const handleMonthChange = (value: string) => {
    setSelectedMonth(value);
    setViewMode('month');
  };

  const classMgr = useClassroomManager();
  const { total: schoolTotal, early, primary, secondary, loading: studentsLoading } = useStudentSummary(
    year ?? undefined,
    { includeMasterStudents: false },
  );
  const { sessions: todaySessionsRaw, loading: isLoadingToday } = useTodayRollCallSessions(year);
  const { data: monthData, isLoading: isLoadingMonth, isError, error } = useMorningRollCallDailyStats(
    monthRange.from,
    monthRange.to,
    filterDept,
  );
  const { data: selectedDayData, isLoading: isLoadingSelectedDay } = useMorningRollCallDailyStats(
    selectedDate,
    selectedDate,
    filterDept,
  );
  const { data: weekData, isLoading: isLoadingWeek } = useMorningRollCallDailyStats(
    weekRange.from,
    weekRange.to,
    filterDept,
  );

  const displaySessionsRaw = useMemo(() => {
    if (viewMode !== 'day') return [];
    if (isViewingToday) return todaySessionsRaw;
    return selectedDayData?.sessions ?? [];
  }, [viewMode, isViewingToday, todaySessionsRaw, selectedDayData?.sessions]);

  const displaySessions = useMemo(() => {
    if (filterDept === 'all') return displaySessionsRaw;
    return displaySessionsRaw.filter((session) => session.departmentId === filterDept);
  }, [filterDept, displaySessionsRaw]);

  const overviewStats = useMemo(() => {
    if (viewMode === 'month' && monthData) {
      const period = monthData.periodStats;
      return {
        present: period.present,
        late: period.late,
        absent: period.absent,
        leave: period.leave,
        totalStudents: period.totalStudents,
        sessions: period.sessions,
      };
    }

    return displaySessions.reduce(
      (acc, session) => ({
        present: acc.present + (session.summary?.present ?? 0),
        late: acc.late + (session.summary?.late ?? 0),
        absent: acc.absent + (session.summary?.absent ?? 0),
        leave: acc.leave + (session.summary?.leave ?? 0),
        totalStudents: acc.totalStudents + (session.totalStudents ?? session.attendance?.length ?? 0),
        sessions: acc.sessions + 1,
      }),
      { present: 0, late: 0, absent: 0, leave: 0, totalStudents: 0, sessions: 0 },
    );
  }, [viewMode, monthData, displaySessions]);

  const todaySessions = displaySessions;

  const todayStats = overviewStats;

  const schoolEnrollmentTotal = useMemo(() => {
    if (filterDept === 'all') return schoolTotal;
    if (filterDept === 'early') return early;
    if (filterDept === 'primary') return primary;
    return secondary;
  }, [filterDept, schoolTotal, early, primary, secondary]);

  const checkedStudentTotal = useMemo(
    () => todayStats.present + todayStats.late + todayStats.absent + todayStats.leave,
    [todayStats],
  );

  const todayStudentsByStatus = useMemo(() => {
    const buckets: Record<Exclude<TodayStatKey, 'all'>, TodayStudentRow[]> = {
      present: [],
      late: [],
      absent: [],
      leave: [],
    };

    todaySessions.forEach((session) => {
      const sessionDept = (session.departmentId as Department) || getDepartmentFromClassName(session.className);
      session.attendance?.forEach((student) => {
        if (student.status === 'unmarked') return;
        const row: TodayStudentRow = {
          studentId: student.studentId,
          studentName: student.studentName,
          studentCode: student.studentCode,
          className: session.className,
          departmentId: sessionDept,
          status: student.status,
          photoURL: student.photoURL,
          gender: student.gender,
        };
        if (student.status === 'present' || student.status === 'late' || student.status === 'absent' || student.status === 'leave') {
          buckets[student.status].push(row);
        }
      });
    });

    (Object.keys(buckets) as Array<Exclude<TodayStatKey, 'all'>>).forEach((key) => {
      buckets[key].sort((a, b) => a.studentName.localeCompare(b.studentName, 'th'));
    });

    return buckets;
  }, [todaySessions]);

  const allTodayStudents = useMemo(
    () => [
      ...todayStudentsByStatus.present,
      ...todayStudentsByStatus.late,
      ...todayStudentsByStatus.absent,
      ...todayStudentsByStatus.leave,
    ],
    [todayStudentsByStatus],
  );

  const modalStudents = useMemo(() => {
    if (!activeStatModal) return [];
    if (activeStatModal === 'all') return allTodayStudents;
    return todayStudentsByStatus[activeStatModal];
  }, [activeStatModal, allTodayStudents, todayStudentsByStatus]);

  useEffect(() => {
    setStatDrawerPage(1);
  }, [activeStatModal]);

  const statDrawerTotalPages = Math.max(1, Math.ceil(modalStudents.length / STAT_DRAWER_ITEMS_PER_PAGE));
  const paginatedModalStudents = useMemo(() => {
    const start = (statDrawerPage - 1) * STAT_DRAWER_ITEMS_PER_PAGE;
    return modalStudents.slice(start, start + STAT_DRAWER_ITEMS_PER_PAGE);
  }, [modalStudents, statDrawerPage]);

  useEffect(() => {
    if (statDrawerPage > statDrawerTotalPages) setStatDrawerPage(statDrawerTotalPages);
  }, [statDrawerPage, statDrawerTotalPages]);

  const statDrawerRangeStart = modalStudents.length === 0
    ? 0
    : (statDrawerPage - 1) * STAT_DRAWER_ITEMS_PER_PAGE + 1;
  const statDrawerRangeEnd = Math.min(statDrawerPage * STAT_DRAWER_ITEMS_PER_PAGE, modalStudents.length);

  const departmentDailySummaries = useMemo(() => {
    if (viewMode === 'month' && monthData) {
      const byDept = new Map(monthData.departmentAggregates.map((row) => [row.departmentId, row]));
      return DEPARTMENTS.map((department) => {
        const row = byDept.get(department);
        return {
          department,
          label: DEPARTMENT_CONFIG[department].label,
          present: row?.present ?? 0,
          late: row?.late ?? 0,
          absent: row?.absent ?? 0,
          leave: row?.leave ?? 0,
          totalStudents: row?.totalStudents ?? 0,
        };
      });
    }

    return DEPARTMENTS.map((department) => {
      const sessions = displaySessionsRaw.filter((session) => session.departmentId === department);
      const summary = sessions.reduce(
        (acc, session) => ({
          present: acc.present + (session.summary?.present ?? 0),
          late: acc.late + (session.summary?.late ?? 0),
          absent: acc.absent + (session.summary?.absent ?? 0),
          leave: acc.leave + (session.summary?.leave ?? 0),
          totalStudents: acc.totalStudents + (session.totalStudents ?? session.attendance?.length ?? 0),
        }),
        { present: 0, late: 0, absent: 0, leave: 0, totalStudents: 0 },
      );
      return { department, label: DEPARTMENT_CONFIG[department].label, ...summary };
    });
  }, [viewMode, monthData, displaySessionsRaw]);

  const visibleDepartmentSummaries = useMemo(() => {
    if (filterDept === 'all') return departmentDailySummaries;
    return departmentDailySummaries.filter((dept) => dept.department === filterDept);
  }, [departmentDailySummaries, filterDept]);

  const watchlist = useMemo(() => {
    const byStudent = new Map<string, {
      studentId: string;
      studentName: string;
      studentCode: string;
      late: number;
      absent: number;
      className: string;
      departmentId: Department | null;
    }>();

    (weekData?.sessions ?? []).forEach((session) => {
      const sessionDept = (session.departmentId as Department) || getDepartmentFromClassName(session.className);
      session.attendance?.forEach((student) => {
        if (student.status !== 'late' && student.status !== 'absent') return;
        const key = student.studentId || `${student.studentName}-${student.studentCode}`;
        const existing = byStudent.get(key) ?? {
          studentId: student.studentId,
          studentName: student.studentName,
          studentCode: student.studentCode,
          late: 0,
          absent: 0,
          className: session.className,
          departmentId: sessionDept,
        };
        if (student.status === 'late') existing.late += 1;
        if (student.status === 'absent') existing.absent += 1;
        existing.className = session.className;
        existing.departmentId = sessionDept;
        byStudent.set(key, existing);
      });
    });

    return Array.from(byStudent.values())
      .sort((a, b) => (b.late + b.absent) - (a.late + a.absent) || b.absent - a.absent)
      .slice(0, 5);
  }, [weekData?.sessions]);

  const rollCallProgress = useMemo(() => {
    const sessionsByClass = new Map(displaySessionsRaw.map((session) => [session.classId, session] as const));
    return classMgr.classCards
      .filter((card) => {
        if (filterDept === 'all') return true;
        const classDept = card.classRoom.departmentId ?? getDepartmentFromClassName(card.classRoom.className);
        return classDept === filterDept;
      })
      .map((card) => {
        const session = sessionsByClass.get(card.classRoom.id);
        return {
          classId: card.classRoom.id,
          className: card.classRoom.className,
          departmentId: card.classRoom.departmentId ?? getDepartmentFromClassName(card.classRoom.className),
          teacherName: card.homeroomTeacher?.name ?? 'ยังไม่ระบุครู',
          teacherPhotoURL: card.homeroomTeacher?.photoURL,
          checked: Boolean(session),
          checkedAt: formatTime((session as MorningRollCallSession | undefined)?.createdAt),
        };
      });
  }, [classMgr.classCards, filterDept, displaySessionsRaw]);

  const overviewPeriodLabel = viewMode === 'month'
    ? `สรุปรายเดือน · ${monthRange.label}`
    : `ข้อมูลประจำวัน · ${formatThaiDateLabel(selectedDate)}`;

  const statPeriodLabel = viewMode === 'month'
    ? 'เดือนนี้'
    : isViewingToday
      ? 'วันนี้'
      : 'วันนั้น';

  const isOverviewLoading = viewMode === 'month'
    ? isLoadingMonth
    : isViewingToday
      ? isLoadingToday
      : isLoadingSelectedDay;

  const weeklyTrendData = useMemo(() => {
    const dailyMap = new Map((weekData?.dailyAggregates ?? []).map((row) => [row.date, row]));
    const start = new Date(`${weekRange.from}T12:00:00`);
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      const key = getLocalDateKey(date);
      const row = dailyMap.get(key);
      return {
        day: date.toLocaleDateString('th-TH', { weekday: 'short' }),
        late: row?.late ?? 0,
        absent: row?.absent ?? 0,
      };
    });
  }, [weekData?.dailyAggregates, weekRange.from]);

  const checkedCount = rollCallProgress.filter((item) => item.checked).length;
  const totalProgress = rollCallProgress.length;

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="w-8 h-8 border-3 border-slate-200 border-t-sky-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!year) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3 text-slate-500">
        <p className="font-semibold">กรุณาตั้งค่าปีการศึกษาก่อน</p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'relative flex min-h-0 w-full flex-1 flex-col overflow-hidden font-sukhumvit',
        'h-[calc(100dvh-4.25rem)] max-h-[calc(100dvh-4.25rem)]',
      )}
    >
      {!isLgUp && mobileActionsEl && createPortal(
        <MorningRollCallDashboardFilters
          variant="mobile"
          selectedMonth={selectedMonth}
          filterDept={filterDept}
          monthOptions={monthOptions}
          onMonthChange={handleMonthChange}
          onDeptChange={setFilterDept}
        />,
        mobileActionsEl,
      )}
      {isLgUp && rightActionsEl && createPortal(
        <MorningRollCallDashboardFilters
          variant="desktop"
          selectedMonth={selectedMonth}
          filterDept={filterDept}
          monthOptions={monthOptions}
          onMonthChange={handleMonthChange}
          onDeptChange={setFilterDept}
        />,
        rightActionsEl,
      )}

      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-24 -left-16 w-72 h-72 rounded-full bg-sky-200/45 blur-3xl" />
        <div className="absolute top-24 -right-20 w-80 h-80 rounded-full bg-cyan-200/40 blur-3xl" />
      </div>

      <div className="relative z-0 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-y-contain scrollbar-hide md:gap-5">
      {isError && (
          <div style={GLASS} className="rounded-2xl p-4 border border-red-200/80 bg-red-50/60">
            <p className="text-sm font-bold text-red-700">โหลดข้อมูลไม่สำเร็จ</p>
            <p className="text-xs text-red-600 mt-1">
              {error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการดึงข้อมูลจาก Firestore'}
            </p>
          </div>
        )}

        {isOverviewLoading || isLoadingWeek || studentsLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-3 border-slate-200 border-t-sky-500 rounded-full animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 items-start gap-5 md:gap-3 xl:grid-cols-12 xl:gap-4">
            <section className={cn('xl:col-span-7', DASHBOARD_SECTION_CLASS)}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className={cn(DASHBOARD_KICKER_CLASS, 'text-sky-600')}>Student Overview</p>
                  <h2 className={DASHBOARD_SECTION_TITLE_CLASS}>สรุปภาพรวมนักเรียน</h2>
                  <p className={DASHBOARD_SECTION_META_CLASS}>{overviewPeriodLabel}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <div className="rounded-2xl bg-sky-50 px-2.5 py-1.5 text-right sm:px-3 sm:py-2">
                    <p className="text-[9px] font-black text-sky-500 sm:text-[10px]">
                      {viewMode === 'month' ? 'เช็กรวม' : 'เช็กแล้ว'}
                    </p>
                    <p className="text-sm font-black text-slate-900 sm:text-base">{todayStats.sessions} ห้อง</p>
                    <p className="text-[9px] font-bold text-slate-500 sm:text-[10px]">{checkedStudentTotal.toLocaleString('th-TH')} คน</p>
                  </div>
                  <DashboardPeriodToggle
                    viewMode={viewMode}
                    selectedDate={selectedDate}
                    minDate={academicDateBounds.min}
                    maxDate={academicDateBounds.max}
                    onSelectDayView={() => setViewMode('day')}
                    onDateChange={setSelectedDate}
                  />
                </div>
              </div>

              <div className="mt-3 grid grid-cols-5 gap-1.5 sm:mt-4 sm:gap-3">
                {([
                  { key: 'present' as const, value: todayStats.present, icon: HiCheckCircle },
                  { key: 'late' as const, value: todayStats.late, icon: HiClock },
                  { key: 'absent' as const, value: todayStats.absent, icon: HiUserMinus },
                  { key: 'leave' as const, value: todayStats.leave, icon: HiClipboardDocumentCheck },
                  { key: 'all' as const, value: schoolEnrollmentTotal, icon: HiUsers },
                ]).map((item) => {
                  const meta = TODAY_STAT_META[item.key];
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => viewMode === 'day' && setActiveStatModal(item.key)}
                      disabled={viewMode === 'month' && item.key !== 'all'}
                      className={cn(
                        'min-w-0 rounded-2xl border border-white bg-white/60 p-2 text-left shadow-sm transition hover:bg-white/85 hover:shadow-md active:scale-[0.98] sm:rounded-3xl sm:p-4',
                        viewMode === 'month' && item.key !== 'all' && 'cursor-default opacity-80',
                      )}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <item.icon className={cn('h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4', meta.color)} />
                        <span className="hidden text-[10px] font-black text-slate-400 sm:inline">{statPeriodLabel}</span>
                      </div>
                      <p className={cn('mt-1.5 text-base font-black sm:mt-4 sm:text-3xl', meta.color)}>
                        {item.value.toLocaleString('th-TH')}
                      </p>
                      <p className="mt-0.5 truncate text-[9px] font-bold text-slate-500 sm:mt-1 sm:text-xs">{meta.label}</p>
                    </button>
                  );
                })}
              </div>

              <DashboardListCarousel
                items={visibleDepartmentSummaries}
                getKey={(dept) => dept.department}
                dotActiveClassName="bg-sky-500"
                className="mt-2 md:hidden"
                getAriaLabel={(dept) => `ไปที่ ${dept.label}`}
                renderItem={(dept) => <DepartmentChartCard dept={dept} />}
              />
              <div
                className={cn(
                  'mt-3 hidden gap-2.5 md:grid',
                  filterDept === 'all' ? 'md:grid-cols-3' : 'md:grid-cols-1',
                )}
              >
                {visibleDepartmentSummaries.map((dept) => (
                  <DepartmentChartCard key={dept.department} dept={dept} />
                ))}
              </div>
            </section>

            <section className={cn('xl:col-span-5', DASHBOARD_SECTION_CLASS)}>
              <div className="flex items-start justify-between">
                <div>
                  <p className={cn(DASHBOARD_KICKER_CLASS, 'text-rose-500')}>Watchlist</p>
                  <h2 className={DASHBOARD_SECTION_TITLE_CLASS}>รายชื่อเฝ้าระวัง</h2>
                  <p className={DASHBOARD_SECTION_META_CLASS}>มาสาย / ขาดบ่อยที่สุด 5 อันดับในสัปดาห์นี้</p>
                </div>
                <HiUserMinus className="h-5 w-5 text-rose-400" />
              </div>

              {watchlist.length === 0 ? (
                <div className="mt-4 rounded-3xl border border-dashed border-slate-200 bg-white/45 p-5 text-center text-sm font-bold text-slate-400">
                  ยังไม่มีนักเรียนในรายชื่อเฝ้าระวัง
                </div>
              ) : (
                <>
                  <DashboardListCarousel
                    items={watchlist}
                    getKey={(student) => student.studentId || `${student.studentName}-${student.studentCode}`}
                    dotActiveClassName="bg-rose-500"
                    clipBleed
                    getAriaLabel={(student) => `ไปที่ ${student.studentName}`}
                    renderItem={(student, index) => (
                      <WatchlistStudentCard student={student} index={index} />
                    )}
                  />
                  <div className="mt-4 hidden space-y-2 md:block">
                    {watchlist.map((student, index) => (
                      <WatchlistStudentCard
                        key={student.studentId || `${student.studentName}-${student.studentCode}`}
                        student={student}
                        index={index}
                      />
                    ))}
                  </div>
                </>
              )}
            </section>

            {viewMode === 'day' && (
            <section className={cn('xl:col-span-7', DASHBOARD_SECTION_CLASS)}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className={cn(DASHBOARD_KICKER_CLASS, 'text-teal-600')}>Staff Tracking</p>
                  <h2 className={DASHBOARD_SECTION_TITLE_CLASS}>ความคืบหน้าการเช็คชื่อ</h2>
                  <p className={DASHBOARD_SECTION_META_CLASS}>ครูเช็กชื่อแล้ว {checkedCount}/{totalProgress} ห้อง</p>
                </div>
                <div className="h-2 w-36 overflow-hidden rounded-full bg-slate-100 hidden sm:block">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-sky-500 to-teal-400"
                    style={{ width: `${totalProgress > 0 ? (checkedCount / totalProgress) * 100 : 0}%` }}
                  />
                </div>
              </div>

              <DashboardListCarousel
                items={rollCallProgress}
                getKey={(item) => item.classId}
                dotActiveClassName="bg-teal-500"
                clipBleed
                getAriaLabel={(item) => `ไปที่ ${item.teacherName}`}
                renderItem={(item) => <RollCallProgressCard item={item} />}
              />
              <div className="mt-4 hidden grid-cols-1 gap-2 md:grid md:grid-cols-2">
                {rollCallProgress.map((item) => (
                  <RollCallProgressCard key={item.classId} item={item} />
                ))}
              </div>
            </section>
            )}

            <section className={cn('xl:col-span-5', DASHBOARD_SECTION_CLASS)}>
              <div className="flex items-start justify-between">
                <div>
                  <p className={cn(DASHBOARD_KICKER_CLASS, 'text-indigo-500')}>Trends</p>
                  <h2 className={DASHBOARD_SECTION_TITLE_CLASS}>กราฟเปรียบเทียบรายสัปดาห์</h2>
                  <p className={DASHBOARD_SECTION_META_CLASS}>สถิติขาดและมาสายแต่ละวัน</p>
                </div>
                <HiArrowTrendingUp className="h-5 w-5 text-indigo-400" />
              </div>
              <div className="mt-3 h-40 md:mt-4 md:h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weeklyTrendData} margin={{ top: 8, right: 8, bottom: 0, left: -24 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.16)" vertical={false} />
                    <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#64748b', fontWeight: 700 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={{ fontSize: 11, borderRadius: 12, border: 'none', boxShadow: '0 10px 28px rgba(15,23,42,0.12)' }} />
                    <Bar dataKey="late" name="มาสาย" fill={STATUS_COLORS.late} radius={[8, 8, 0, 0]} />
                    <Bar dataKey="absent" name="ขาด" fill={STATUS_COLORS.absent} radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          </div>
        )}

      <Drawer
        open={activeStatModal !== null}
        onOpenChange={(open) => {
          if (!open) {
            setActiveStatModal(null);
            setStatDrawerPage(1);
          }
        }}
        direction={isLgUp ? 'right' : 'bottom'}
      >
        <DrawerContent
          className={cn(
            'flex max-h-[85vh] flex-col overflow-hidden p-0 font-sukhumvit before:hidden',
            isLgUp &&
              'h-dvh max-h-none data-[vaul-drawer-direction=right]:w-screen data-[vaul-drawer-direction=right]:max-w-none sm:data-[vaul-drawer-direction=right]:max-w-md sm:p-2',
          )}
        >
          <div
            className={cn(
              'flex min-h-0 flex-1 flex-col overflow-hidden bg-white',
              isLgUp && 'sm:rounded-4xl sm:border sm:border-slate-200/70 sm:shadow-xl',
            )}
          >
            <DrawerHeader className="shrink-0 border-b border-slate-100 px-4 py-4 text-left sm:px-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <DrawerTitle className="text-base font-black text-slate-800">
                    {activeStatModal ? TODAY_STAT_META[activeStatModal].modalTitle : ''}
                  </DrawerTitle>
                  <DrawerDescription className="text-xs text-slate-500">
                    {activeStatModal === 'all' ? (
                      <>
                        ลงทะเบียนในระบบ {schoolEnrollmentTotal.toLocaleString('th-TH')} คน · เช็กชื่อแล้ว{' '}
                        {checkedStudentTotal.toLocaleString('th-TH')} คน จาก {todayStats.sessions} ห้อง
                        {viewMode === 'day' ? ` · ${formatThaiDateLabel(selectedDate)}` : ` · ${monthRange.label}`}
                      </>
                    ) : (
                      <>
                        {viewMode === 'day' ? formatThaiDateLabel(selectedDate) : monthRange.label} · {modalStudents.length.toLocaleString('th-TH')} คน
                      </>
                    )}
                  </DrawerDescription>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setActiveStatModal(null);
                    setStatDrawerPage(1);
                  }}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition-all hover:bg-slate-50 active:scale-95"
                  aria-label="ปิด"
                >
                  <HiXMark className="h-4 w-4" />
                </button>
              </div>
            </DrawerHeader>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
              {modalStudents.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm font-bold text-slate-400">
                  {activeStatModal === 'all' ? 'ยังไม่มีห้องเช็กชื่อวันนี้' : 'ไม่มีรายชื่อในหมวดนี้'}
                </div>
              ) : (
                <div className="space-y-2">
                  {activeStatModal === 'all' && checkedStudentTotal < schoolEnrollmentTotal && viewMode === 'day' && (
                    <p className="rounded-xl bg-sky-50 px-3 py-2 text-[11px] font-semibold text-sky-700">
                      แสดงรายชื่อ {modalStudents.length.toLocaleString('th-TH')} คนจากห้องที่เช็กชื่อแล้ววันนี้
                    </p>
                  )}
                  {paginatedModalStudents.map((student) => (
                    <div
                      key={`${student.studentId}-${student.className}-${student.status}`}
                      className="flex items-center gap-3 rounded-2xl border border-white bg-white/70 px-3 py-2.5 shadow-sm"
                    >
                      <StudentAvatar
                        studentId={student.studentId}
                        photoURL={student.photoURL}
                        gender={student.gender}
                        name={student.studentName}
                        className="h-9 w-9 shrink-0 rounded-xl"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-black text-slate-800">{student.studentName}</p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                          <p className="truncate text-[11px] font-semibold text-slate-400">
                            {student.className} · {student.studentCode}
                          </p>
                          {student.departmentId && (
                            <span
                              className="shrink-0 rounded-full px-2 py-0.5 text-[9px] font-black"
                              style={{
                                color: DEPARTMENT_CONFIG[student.departmentId].color,
                                background: DEPARTMENT_CONFIG[student.departmentId].bg,
                                border: `1px solid ${DEPARTMENT_CONFIG[student.departmentId].border}`,
                              }}
                            >
                              {DEPARTMENT_CONFIG[student.departmentId].label}
                            </span>
                          )}
                        </div>
                      </div>
                      {activeStatModal === 'all' && student.status !== 'unmarked' && (
                        <span
                          className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black"
                          style={{
                            color: STATUS_COLORS[student.status as Exclude<RollCallStatus, 'unmarked'>],
                            background: `${STATUS_COLORS[student.status as Exclude<RollCallStatus, 'unmarked'>]}18`,
                          }}
                        >
                          {TODAY_STAT_META[student.status as Exclude<TodayStatKey, 'all'>]?.label ?? student.status}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {modalStudents.length > 0 && (
              <DrawerFooter className="shrink-0 border-t border-slate-100 px-4 py-3">
                <div className="flex w-full flex-wrap items-center justify-between gap-2">
                  <p className="text-[11px] font-bold text-slate-500">
                    แสดง {statDrawerRangeStart}–{statDrawerRangeEnd} จาก {modalStudents.length.toLocaleString('th-TH')} คน
                  </p>
                  {statDrawerTotalPages > 1 && (
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={statDrawerPage === 1}
                        onClick={() => setStatDrawerPage((page) => Math.max(1, page - 1))}
                        className="h-8 w-8 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                        aria-label="หน้าก่อนหน้า"
                      >
                        <HiChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="px-2 text-[11px] font-black text-slate-600">
                        {statDrawerPage}/{statDrawerTotalPages}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={statDrawerPage === statDrawerTotalPages}
                        onClick={() => setStatDrawerPage((page) => Math.min(statDrawerTotalPages, page + 1))}
                        className="h-8 w-8 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                        aria-label="หน้าถัดไป"
                      >
                        <HiChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </DrawerFooter>
            )}
          </div>
        </DrawerContent>
      </Drawer>
      </div>
    </div>
  );
}
