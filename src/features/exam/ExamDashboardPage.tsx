import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  HiArrowRight,
  HiBookOpen,
  HiBuildingLibrary,
  HiChevronLeft,
  HiChevronRight,
  HiClipboardDocumentCheck,
  HiClock,
  HiLockClosed,
  HiPlay,
  HiSquares2X2,
  HiTrophy,
  HiUserGroup,
} from 'react-icons/hi2';
import { useActiveAcademicYear } from '@/hooks/useActiveAcademicYear';
import { useAuth } from '@/hooks/useAuth';
import { useExamRoom } from '@/hooks/useExamRoom';
import { useTeacherPhotosById } from '@/hooks/useTeacherPhotosById';
import { cn } from '@/lib/utils';
import { getInitials } from '@/features/profile/profileLayoutShared';
import { SubjectIcon, subjectIconGradient } from '@/features/curriculum/utils/subjectVisual';
import { DEPARTMENT_CONFIG, type Department } from '@/types/curriculum';
import {
  buildExamDashboardStats,
  buildStudentExamDashboardStats,
  formatExamRoomStatus,
  formatExamRoomStatusColor,
} from '@/features/exam/utils/examDashboardStats';
import GradeLevelExamRoomDrawer from '@/features/exam/components/GradeLevelExamRoomDrawer';
import {
  ExamFilterShowResultsButton,
  ExamMobileFilterDrawer,
  ExamMobileFilterTriggerButton,
  EXAM_DEPT_FILTER_OPTIONS,
} from '@/features/exam/components/ExamMobileFilterMenuButton';
import SubjectGroupExamRoomDrawer from '@/features/exam/components/SubjectGroupExamRoomDrawer';
import TeacherExamRoomHistoryDrawer from '@/features/exam/components/TeacherExamRoomHistoryDrawer';
import type { ExamRoom } from '@/types/exam';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from '@/components/ui/carousel';

/** Top-lit shadows for stat cards: key (crisp) + ambient (soft), always cast downward */
const DASHBOARD_STAT_CARD_SHADOW =
  'shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_20px_-4px_rgba(15,23,42,0.05)]';
const DASHBOARD_STAT_CARD_SHADOW_HOVER =
  'hover:shadow-[0_1px_3px_rgba(15,23,42,0.05),0_10px_24px_-6px_rgba(15,23,42,0.08)]';
const DASHBOARD_STAT_CARD_SHADOW_TRANSITION = 'transition-shadow duration-300';

const TEACHERS_PER_PAGE = 8;
const GRADES_PER_PAGE = 6;

const DASHBOARD_KICKER_CLASS = 'text-[10px] font-black uppercase tracking-[0.18em] sm:text-[11px]';
const DASHBOARD_PAGE_TITLE_CLASS = 'mt-1 text-base font-black text-slate-900 sm:text-xl';
const DASHBOARD_SECTION_TITLE_CLASS = 'mt-1 text-sm font-black text-slate-900 sm:text-lg';
const DASHBOARD_SECTION_META_CLASS = 'text-[11px] font-semibold text-slate-400 sm:text-xs';

const DASHBOARD_SECTION_CLASS =
  'rounded-none border-0 bg-transparent p-0 shadow-none md:rounded-[28px] md:border md:border-white/90 md:bg-white/[0.72] md:p-4 md:shadow-[0_8px_32px_rgba(0,0,0,0.06)] md:backdrop-blur-2xl md:saturate-150 lg:p-5';

const DEPARTMENT_FILTER_SELECT_CLASS =
  'h-9 min-w-[120px] sm:min-w-[148px] rounded-xl border border-slate-200 bg-white/95 px-2 sm:px-3 text-[11px] sm:text-[12px] font-bold text-slate-700 outline-none focus:ring-2 focus:ring-inset focus:ring-violet-500/25';

function ExamDepartmentFilter({
  value,
  onChange,
  options,
}: {
  value: Department | 'all';
  onChange: (value: Department | 'all') => void;
  options: Department[];
}) {
  const [rightActionsEl, setRightActionsEl] = useState<HTMLElement | null>(null);
  const [mobileActionsEl, setMobileActionsEl] = useState<HTMLElement | null>(null);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [isLgUp, setIsLgUp] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 1024px)').matches : true,
  );

  useEffect(() => {
    setRightActionsEl(document.getElementById('header-portal-right-actions'));
    setMobileActionsEl(document.getElementById('header-portal-mobile-actions'));
  }, []);

  useEffect(() => {
    const media = window.matchMedia('(min-width: 1024px)');
    const handleChange = () => {
      setIsLgUp(media.matches);
      setMobileFilterOpen(false);
    };
    handleChange();
    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, []);

  const select = (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as Department | 'all')}
      className={cn(DEPARTMENT_FILTER_SELECT_CLASS, value === 'all' && 'text-slate-400')}
      aria-label="กรองตามแผนก"
    >
      <option value="all">ทุกแผนก</option>
      {options.map((dept) => (
        <option key={dept} value={dept}>
          {DEPARTMENT_CONFIG[dept].label}
        </option>
      ))}
    </select>
  );

  const mobileFilterMenu = (
    <>
      {mobileActionsEl && createPortal(
        <ExamMobileFilterTriggerButton
          onClick={() => setMobileFilterOpen(true)}
          title="กรองตามแผนก"
          hasActiveFilters={value !== 'all'}
        />,
        mobileActionsEl,
      )}
      <ExamMobileFilterDrawer
        open={mobileFilterOpen}
        onOpenChange={setMobileFilterOpen}
        title="ตัวกรองห้องสอบ"
        description="เลือกแผนกที่ต้องการดูสถิติห้องสอบ"
        footer={<ExamFilterShowResultsButton onClick={() => setMobileFilterOpen(false)} />}
      >
        <div>
          <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-slate-400">แผนก</p>
          <div className="grid grid-cols-2 gap-2">
            {EXAM_DEPT_FILTER_OPTIONS.map((dept) => {
              const isActive = value === dept.id;
              const isAvailable = dept.id === 'all' || options.includes(dept.id);
              return (
                <button
                  key={dept.id}
                  type="button"
                  disabled={!isAvailable}
                  onClick={() => onChange(dept.id)}
                  className={cn(
                    'rounded-xl border px-3 py-2.5 text-[12px] font-black transition-all disabled:cursor-not-allowed disabled:opacity-40',
                    isActive
                      ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
                  )}
                >
                  {dept.label}
                </button>
              );
            })}
          </div>
        </div>
      </ExamMobileFilterDrawer>
    </>
  );

  if (isLgUp) {
    if (!rightActionsEl) return null;
    return createPortal(
      <div className="pointer-events-auto flex items-center">{select}</div>,
      rightActionsEl,
    );
  }

  return mobileFilterMenu;
}

const ROOM_STATUS_META = [
  { key: 'all' as const, label: 'ทั้งหมด', color: 'text-indigo-600', icon: HiSquares2X2 },
  { key: 'upcoming' as const, label: 'รอเปิด', color: 'text-amber-600', icon: HiClock },
  { key: 'active' as const, label: 'กำลังสอบ', color: 'text-emerald-600', icon: HiPlay },
  { key: 'closed' as const, label: 'ปิดแล้ว', color: 'text-slate-500', icon: HiLockClosed },
];

function formatDateTime(value?: number): string {
  if (!value) return '-';
  return new Date(value).toLocaleString('th-TH', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

type TeacherRoomStat = ReturnType<typeof buildExamDashboardStats>['teacherRoomBreakdown'][number];
type SubjectGroupRoomStat = ReturnType<typeof buildExamDashboardStats>['subjectGroupBreakdown'][number];
type GradeLevelRoomStat = ReturnType<typeof buildExamDashboardStats>['gradeLevelBreakdown'][number];

function GroupStatusBadges({
  active,
  upcoming,
  closed,
  className,
}: {
  active: number;
  upcoming: number;
  closed: number;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap gap-1', className)}>
      {active > 0 && (
        <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] font-black text-emerald-700">
          เปิด {active}
        </span>
      )}
      {upcoming > 0 && (
        <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[9px] font-black text-amber-700">
          รอ {upcoming}
        </span>
      )}
      {closed > 0 && (
        <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-black text-slate-600">
          ปิด {closed}
        </span>
      )}
    </div>
  );
}

function DashboardStatCarousel<T>({
  items,
  getKey,
  renderItem,
  itemClassName = 'basis-[88%]',
  dotActiveClassName = 'bg-sky-500',
  getAriaLabel,
}: {
  items: T[];
  getKey: (item: T) => string;
  renderItem: (item: T) => React.ReactNode;
  itemClassName?: string;
  dotActiveClassName?: string;
  getAriaLabel?: (item: T, index: number) => string;
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
    <div className="mt-2 md:mt-4 md:hidden">
      <Carousel
        setApi={setCarouselApi}
        opts={{ align: 'start', containScroll: 'trimSnaps' }}
        className="-mx-4"
      >
        <CarouselContent className="-ml-3 px-4">
          {items.map((item) => (
            <CarouselItem key={getKey(item)} className={cn('pl-3', itemClassName)}>
              {renderItem(item)}
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
                aria-label={getAriaLabel?.(item, index) ?? `ไปที่การ์ดที่ ${index + 1}`}
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

function SubjectGroupRoomCard({
  group,
  onClick,
}: {
  group: SubjectGroupRoomStat;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex h-full min-h-[96px] w-full flex-col items-center justify-between rounded-2xl border p-2 text-center active:scale-[0.98] sm:min-h-[118px] sm:p-2.5 md:min-h-[124px] md:p-3',
        DASHBOARD_STAT_CARD_SHADOW,
        DASHBOARD_STAT_CARD_SHADOW_HOVER,
        DASHBOARD_STAT_CARD_SHADOW_TRANSITION,
      )}
      style={{ backgroundColor: group.bg, borderColor: group.border }}
    >
      <div
        className="flex size-9 shrink-0 items-center justify-center rounded-2xl shadow-sm sm:size-10"
        style={{ background: subjectIconGradient(group.groupKey) }}
      >
        <SubjectIcon subjectGroup={group.groupKey} size={18} />
      </div>
      <div className="mt-1.5 min-w-0 w-full">
        <p className="line-clamp-2 text-[9px] font-black leading-tight text-slate-800 sm:text-[11px]">
          {group.name}
        </p>
        <p className="mt-0.5 text-base font-black sm:text-lg md:text-xl" style={{ color: group.color }}>
          {group.count}
        </p>
        <p className="text-[10px] font-semibold text-slate-400">ห้องสอบ</p>
      </div>
      <GroupStatusBadges
        active={group.active}
        upcoming={group.upcoming}
        closed={group.closed}
        className="mt-1.5 justify-center"
      />
    </button>
  );
}

function SubjectGroupStatsSection({
  groups,
  rooms,
  totalRooms,
}: {
  groups: SubjectGroupRoomStat[];
  rooms: ExamRoom[];
  totalRooms: number;
}) {
  const [selectedGroup, setSelectedGroup] = useState<SubjectGroupRoomStat | null>(null);

  return (
    <section className={cn(DASHBOARD_SECTION_CLASS, 'w-full')}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={cn(DASHBOARD_KICKER_CLASS, 'text-indigo-600')}>By Subject Group</p>
          <h3 className={DASHBOARD_SECTION_TITLE_CLASS}>สถิติห้องสอบตามกลุ่มสาระวิชา</h3>
          <p className={DASHBOARD_SECTION_META_CLASS}>
            {groups.length} กลุ่มสาระ · {totalRooms} ห้องทั้งหมด
          </p>
        </div>
        <HiBookOpen className="h-4 w-4 shrink-0 text-indigo-400 sm:h-5 sm:w-5" />
      </div>

      {groups.length === 0 ? (
        <p className="mt-3 rounded-2xl border border-dashed border-slate-200 bg-white/50 px-4 py-6 text-center text-sm font-semibold text-slate-400 md:mt-5 md:py-8">
          ยังไม่มีห้องสอบในภาคเรียนนี้
        </p>
      ) : (
        <>
          <DashboardStatCarousel
            items={groups}
            getKey={(group) => group.groupKey}
            itemClassName="basis-[46%]"
            dotActiveClassName="bg-indigo-500"
            getAriaLabel={(group) => `ไปที่กลุ่มสาระ ${group.name}`}
            renderItem={(group) => (
              <SubjectGroupRoomCard group={group} onClick={() => setSelectedGroup(group)} />
            )}
          />

          <div className="mt-4 hidden gap-2 md:grid md:grid-cols-3 lg:grid-cols-4">
            {groups.map((group) => (
              <SubjectGroupRoomCard
                key={group.groupKey}
                group={group}
                onClick={() => setSelectedGroup(group)}
              />
            ))}
          </div>
        </>
      )}

      <SubjectGroupExamRoomDrawer
        open={selectedGroup !== null}
        onClose={() => setSelectedGroup(null)}
        group={selectedGroup}
        rooms={rooms}
      />
    </section>
  );
}

function GradeLevelRoomCard({
  grade,
  onClick,
}: {
  grade: GradeLevelRoomStat;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex h-full min-h-[96px] w-full flex-col items-center justify-between rounded-2xl border p-2 text-center active:scale-[0.98] sm:min-h-[118px] sm:p-2.5 md:min-h-[124px] md:p-3',
        DASHBOARD_STAT_CARD_SHADOW,
        DASHBOARD_STAT_CARD_SHADOW_HOVER,
        DASHBOARD_STAT_CARD_SHADOW_TRANSITION,
      )}
      style={{ backgroundColor: grade.bg, borderColor: grade.border }}
    >
      <div
        className="flex size-9 shrink-0 items-center justify-center rounded-2xl border text-xs font-black shadow-sm sm:size-10 sm:text-sm"
        style={{ color: grade.color, borderColor: grade.border, backgroundColor: 'rgba(255,255,255,0.72)' }}
      >
        {grade.gradeLevel === 'ไม่ระบุระดับชั้น' ? '?' : grade.gradeLevel}
      </div>
      <div className="mt-1.5 min-w-0 w-full">
        <p className="mt-0.5 text-base font-black sm:text-lg md:text-xl" style={{ color: grade.color }}>
          {grade.count}
        </p>
        <p className="text-[10px] font-semibold text-slate-400">ห้องสอบ</p>
      </div>
      <GroupStatusBadges
        active={grade.active}
        upcoming={grade.upcoming}
        closed={grade.closed}
        className="mt-1.5 justify-center"
      />
    </button>
  );
}

function GradeLevelStatsSection({
  grades,
  rooms,
  totalRooms,
}: {
  grades: GradeLevelRoomStat[];
  rooms: ExamRoom[];
  totalRooms: number;
}) {
  const [page, setPage] = useState(1);
  const [selectedGrade, setSelectedGrade] = useState<GradeLevelRoomStat | null>(null);
  const totalPages = Math.max(1, Math.ceil(grades.length / GRADES_PER_PAGE));

  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [page, totalPages]);

  const paginatedGrades = useMemo(() => {
    const start = (page - 1) * GRADES_PER_PAGE;
    return grades.slice(start, start + GRADES_PER_PAGE);
  }, [grades, page]);

  const rangeStart = grades.length === 0 ? 0 : (page - 1) * GRADES_PER_PAGE + 1;
  const rangeEnd = Math.min(page * GRADES_PER_PAGE, grades.length);

  return (
    <section className={cn(DASHBOARD_SECTION_CLASS, 'w-full')}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={cn(DASHBOARD_KICKER_CLASS, 'text-violet-600')}>By Grade Level</p>
          <h3 className={DASHBOARD_SECTION_TITLE_CLASS}>สถิติห้องสอบตามระดับชั้น</h3>
          <p className={DASHBOARD_SECTION_META_CLASS}>
            {grades.length} ระดับชั้น · {totalRooms} ห้องทั้งหมด
          </p>
        </div>
        <HiBuildingLibrary className="h-4 w-4 shrink-0 text-violet-400 sm:h-5 sm:w-5" />
      </div>

      {grades.length === 0 ? (
        <p className="mt-3 rounded-2xl border border-dashed border-slate-200 bg-white/50 px-4 py-6 text-center text-sm font-semibold text-slate-400 md:mt-5 md:py-8">
          ยังไม่มีห้องสอบในภาคเรียนนี้
        </p>
      ) : (
        <>
          <DashboardStatCarousel
            items={grades}
            getKey={(grade) => grade.gradeLevel}
            itemClassName="basis-[30%]"
            dotActiveClassName="bg-violet-500"
            getAriaLabel={(grade) => `ไปที่ระดับชั้น ${grade.gradeLevel}`}
            renderItem={(grade) => (
              <GradeLevelRoomCard grade={grade} onClick={() => setSelectedGrade(grade)} />
            )}
          />

          <div className="mt-4 hidden grid-cols-6 gap-2 md:grid">
            {paginatedGrades.map((grade, index) => (
              <GradeLevelRoomCard
                key={`${grade.gradeLevel}-${index}`}
                grade={grade}
                onClick={() => setSelectedGrade(grade)}
              />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="mt-4 hidden flex-col items-center gap-2 md:flex md:flex-row md:justify-between">
              <p className="text-[11px] font-semibold text-slate-400">
                แสดง {rangeStart}–{rangeEnd} จาก {grades.length} ระดับชั้น
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page === 1}
                  onClick={() => setPage((p) => Math.max(p - 1, 1))}
                  className="flex items-center gap-1 rounded-full border border-black/[0.08] bg-white px-4 py-1.5 text-[11px] font-bold text-slate-600 transition-all hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <HiChevronLeft className="h-3.5 w-3.5" />
                  ก่อนหน้า
                </button>
                <span className="px-2 text-[11px] font-medium text-slate-400">
                  {page} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={page === totalPages}
                  onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                  className="flex items-center gap-1 rounded-full border border-black/[0.08] bg-white px-4 py-1.5 text-[11px] font-bold text-slate-600 transition-all hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  ถัดไป
                  <HiChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      <GradeLevelExamRoomDrawer
        open={selectedGrade !== null}
        onClose={() => setSelectedGrade(null)}
        grade={selectedGrade}
        rooms={rooms}
      />
    </section>
  );
}

function TeacherRoomCard({
  teacher,
  photoURL,
  onClick,
}: {
  teacher: TeacherRoomStat;
  photoURL?: string;
  onClick: () => void;
}) {
  const resolvedPhotoURL = photoURL?.trim() || teacher.teacherPhotoURL?.trim() || undefined;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group flex h-full min-h-[100px] w-full overflow-hidden rounded-2xl bg-white text-left active:scale-[0.98] sm:min-h-[118px] md:min-h-[148px]',
        DASHBOARD_STAT_CARD_SHADOW,
        DASHBOARD_STAT_CARD_SHADOW_HOVER,
        DASHBOARD_STAT_CARD_SHADOW_TRANSITION,
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col justify-between px-3 py-2.5 sm:px-3.5 sm:py-3 md:px-5 md:py-4">
        <p className="text-[10px] font-semibold text-slate-400 sm:text-[11px] md:text-sm">
          ห้องสอบ/เปิดสอบ
        </p>
        <p className="font-sukhumvit text-3xl font-black leading-none sm:text-4xl md:text-5xl lg:text-6xl">
          <span className="text-[#4169E1]">{teacher.count}</span>
          <span className="text-slate-300">/</span>
          <span className="text-emerald-600">{teacher.openedCount}</span>
        </p>
        <p className="truncate font-sukhumvit text-xs font-bold text-slate-900 sm:text-sm md:text-base">
          {teacher.teacherName}
        </p>
      </div>

      <div className="relative w-[34%] min-w-[88px] max-w-[120px] shrink-0 self-stretch sm:max-w-[132px]">
        {resolvedPhotoURL ? (
          <img
            src={resolvedPhotoURL}
            alt={teacher.teacherName}
            className="absolute inset-0 h-full w-full object-cover object-top"
          />
        ) : (
          <div className="absolute inset-0 flex items-end justify-center bg-gradient-to-b from-sky-50 to-sky-100">
            <span className="pb-3 font-sukhumvit text-2xl font-black text-sky-300 sm:text-4xl">
              {getInitials(teacher.teacherName)}
            </span>
          </div>
        )}
      </div>
    </button>
  );
}

function TeacherRoomStatsSection({
  teachers,
  rooms,
  totalRooms,
}: {
  teachers: TeacherRoomStat[];
  rooms: ExamRoom[];
  totalRooms: number;
}) {
  const [page, setPage] = useState(1);
  const [selectedTeacher, setSelectedTeacher] = useState<TeacherRoomStat | null>(null);
  const teacherIds = useMemo(() => teachers.map((teacher) => teacher.teacherId), [teachers]);
  const teacherPhotosById = useTeacherPhotosById(teacherIds);
  const totalPages = Math.max(1, Math.ceil(teachers.length / TEACHERS_PER_PAGE));

  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [page, totalPages]);

  const paginatedTeachers = useMemo(() => {
    const start = (page - 1) * TEACHERS_PER_PAGE;
    return teachers.slice(start, start + TEACHERS_PER_PAGE);
  }, [teachers, page]);

  const rangeStart = teachers.length === 0 ? 0 : (page - 1) * TEACHERS_PER_PAGE + 1;
  const rangeEnd = Math.min(page * TEACHERS_PER_PAGE, teachers.length);

  return (
    <section className={cn(DASHBOARD_SECTION_CLASS, 'w-full')}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={cn(DASHBOARD_KICKER_CLASS, 'text-sky-600')}>By Teacher</p>
          <h3 className={DASHBOARD_SECTION_TITLE_CLASS}>สถิติจำนวนห้องสอบของครู</h3>
          <p className={DASHBOARD_SECTION_META_CLASS}>
            {teachers.length} ครู · {totalRooms} ห้องทั้งหมด
          </p>
        </div>
        <HiUserGroup className="h-4 w-4 shrink-0 text-sky-400 sm:h-5 sm:w-5" />
      </div>

      {teachers.length === 0 ? (
        <p className="mt-3 rounded-2xl border border-dashed border-slate-200 bg-white/50 px-4 py-6 text-center text-sm font-semibold text-slate-400 md:mt-5 md:py-8">
          ยังไม่มีห้องสอบในภาคเรียนนี้
        </p>
      ) : (
        <>
          <DashboardStatCarousel
            items={teachers}
            getKey={(teacher) => teacher.teacherId}
            dotActiveClassName="bg-sky-500"
            getAriaLabel={(teacher) => `ไปที่การ์ด ${teacher.teacherName}`}
            renderItem={(teacher) => (
              <TeacherRoomCard
                teacher={teacher}
                photoURL={teacherPhotosById[teacher.teacherId]}
                onClick={() => setSelectedTeacher(teacher)}
              />
            )}
          />

          <div className="mt-4 hidden gap-3 md:grid md:grid-cols-2 lg:grid-cols-3">
            {paginatedTeachers.map((teacher) => (
              <TeacherRoomCard
                key={teacher.teacherId}
                teacher={teacher}
                photoURL={teacherPhotosById[teacher.teacherId]}
                onClick={() => setSelectedTeacher(teacher)}
              />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="mt-4 hidden flex-col items-center gap-2 md:flex md:flex-row md:justify-between">
              <p className="text-[11px] font-semibold text-slate-400">
                แสดง {rangeStart}–{rangeEnd} จาก {teachers.length} ครู
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page === 1}
                  onClick={() => setPage((p) => Math.max(p - 1, 1))}
                  className="flex items-center gap-1 rounded-full border border-black/[0.08] bg-white px-4 py-1.5 text-[11px] font-bold text-slate-600 transition-all hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <HiChevronLeft className="h-3.5 w-3.5" />
                  ก่อนหน้า
                </button>
                <span className="px-2 text-[11px] font-medium text-slate-400">
                  {page} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={page === totalPages}
                  onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                  className="flex items-center gap-1 rounded-full border border-black/[0.08] bg-white px-4 py-1.5 text-[11px] font-bold text-slate-600 transition-all hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  ถัดไป
                  <HiChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      <TeacherExamRoomHistoryDrawer
        open={selectedTeacher !== null}
        onClose={() => setSelectedTeacher(null)}
        teacher={
          selectedTeacher
            ? {
                ...selectedTeacher,
                teacherPhotoURL:
                  teacherPhotosById[selectedTeacher.teacherId] ?? selectedTeacher.teacherPhotoURL,
              }
            : null
        }
        rooms={rooms}
      />
    </section>
  );
}

function KpiCard({
  label,
  value,
  hint,
  colorClass = 'text-slate-900',
  icon: Icon,
}: {
  label: string;
  value: string | number;
  hint?: string;
  colorClass?: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className={cn('rounded-2xl border border-white bg-white/60 p-2.5 sm:rounded-3xl sm:p-3 md:p-4', DASHBOARD_STAT_CARD_SHADOW)}>
      <div className="flex items-center justify-between">
        <Icon className={cn('h-3.5 w-3.5 sm:h-4 sm:w-4', colorClass)} />
        {hint && <span className="text-[9px] font-black text-slate-400 sm:text-[10px]">{hint}</span>}
      </div>
      <p className={cn('mt-1.5 text-xl font-black sm:mt-2 sm:text-2xl md:mt-4 md:text-3xl', colorClass)}>{value}</p>
      <p className="mt-1 text-[11px] font-bold text-slate-500 sm:text-xs">{label}</p>
    </div>
  );
}

export default function ExamDashboardPage() {
  const navigate = useNavigate();
  const { role, user } = useAuth();
  const { activeYear, year, isLoaded } = useActiveAcademicYear();
  const { rooms, attempts, isLoading } = useExamRoom();
  const isStudent = role === 'student';
  const [filterDepartment, setFilterDepartment] = useState<Department | 'all'>('all');

  const filteredRooms = useMemo(() => {
    if (filterDepartment === 'all') return rooms;
    return rooms.filter((room) => (room.departmentId || 'secondary') === filterDepartment);
  }, [rooms, filterDepartment]);

  const filteredAttempts = useMemo(() => {
    if (filterDepartment === 'all') return attempts;
    const roomIds = new Set(filteredRooms.map((room) => room.id));
    return attempts.filter((attempt) => roomIds.has(attempt.roomId));
  }, [attempts, filteredRooms, filterDepartment]);

  const departmentOptions = useMemo(() => {
    const available = new Set<Department>();
    rooms.forEach((room) => {
      available.add((room.departmentId || 'secondary') as Department);
    });
    return (Object.keys(DEPARTMENT_CONFIG) as Department[]).filter((dept) => available.has(dept));
  }, [rooms]);

  const staffStats = useMemo(
    () => buildExamDashboardStats(filteredRooms, filteredAttempts),
    [filteredRooms, filteredAttempts],
  );

  const studentStats = useMemo(
    () => buildStudentExamDashboardStats(rooms, attempts, user?.uid ? [user.uid] : []),
    [rooms, attempts, user?.uid],
  );

  if (!isLoaded) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-3 border-slate-200 border-t-violet-500" />
      </div>
    );
  }

  if (!year) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-slate-500">
        <p className="font-semibold">กรุณาตั้งค่าปีการศึกษาก่อน</p>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col min-h-0 gap-2 pb-10 md:flex-1 md:gap-5 md:pb-4">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-24 -left-16 h-72 w-72 rounded-full bg-violet-200/45 blur-3xl" />
        <div className="absolute top-24 -right-20 h-80 w-80 rounded-full bg-indigo-200/40 blur-3xl" />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-slate-200 border-t-violet-500" />
        </div>
      ) : isStudent ? (
        <StudentDashboard
          stats={studentStats}
          onOpenRoom={(roomId) => navigate(`/exam/${roomId}`)}
          onViewRooms={() => navigate('/portal/exams/rooms')}
        />
      ) : (
        <>
          <ExamDepartmentFilter
            value={filterDepartment}
            onChange={setFilterDepartment}
            options={departmentOptions}
          />
          <StaffDashboard
            stats={staffStats}
            rooms={filteredRooms}
            academicYearLabel={activeYear?.year ?? year}
            departmentFilter={filterDepartment}
            onOpenRooms={() => navigate('/portal/exams/rooms')}
          />
        </>
      )}
    </div>
  );
}

function RecentRoomCard({
  room,
  onClick,
}: {
  room: ExamRoom;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full rounded-2xl border border-white bg-white/60 px-3 py-2.5 text-left transition hover:bg-white/85 sm:px-4 sm:py-3',
        DASHBOARD_STAT_CARD_SHADOW,
        DASHBOARD_STAT_CARD_SHADOW_HOVER,
        DASHBOARD_STAT_CARD_SHADOW_TRANSITION,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="line-clamp-2 text-xs font-black text-slate-800 sm:text-sm">{room.title}</p>
        <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black', formatExamRoomStatusColor(room.status))}>
          {formatExamRoomStatus(room.status)}
        </span>
      </div>
      <p className="mt-1 text-[10px] font-semibold text-slate-400 sm:text-[11px]">
        {room.subjectName || 'ไม่ระบุวิชา'} · {room.teacherName}
      </p>
      <p className="mt-1.5 text-[10px] font-bold text-slate-400 sm:mt-2">
        สร้างเมื่อ {formatDateTime(room.createdAt)}
      </p>
    </button>
  );
}

function StaffDashboard({
  stats,
  rooms,
  academicYearLabel,
  departmentFilter,
  onOpenRooms,
}: {
  stats: ReturnType<typeof buildExamDashboardStats>;
  rooms: ExamRoom[];
  academicYearLabel: string;
  departmentFilter: Department | 'all';
  onOpenRooms: () => void;
}) {
  const departmentLabel = departmentFilter === 'all'
    ? null
    : DEPARTMENT_CONFIG[departmentFilter].label;

  return (
    <div className="flex flex-col gap-5">
      <section className={DASHBOARD_SECTION_CLASS}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className={cn(DASHBOARD_KICKER_CLASS, 'text-violet-600')}>Exam Overview</p>
            <h2 className={DASHBOARD_PAGE_TITLE_CLASS}>สรุปภาพรวมห้องสอบ</h2>
            <p className={DASHBOARD_SECTION_META_CLASS}>
              ปีการศึกษา {academicYearLabel}
              {departmentLabel ? ` · ${departmentLabel}` : ''}
            </p>
          </div>
          <div className="rounded-2xl bg-violet-50 px-2.5 py-1.5 text-right sm:px-3 sm:py-2">
            <p className="text-[9px] font-black text-violet-500 sm:text-[10px]">ห้องทั้งหมด</p>
            <p className="text-base font-black text-slate-900 sm:text-lg">{stats.roomCounts.all}</p>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-4 gap-1.5 sm:mt-5 sm:gap-3">
          {ROOM_STATUS_META.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={onOpenRooms}
              className={cn(
                'min-w-0 rounded-2xl border border-white bg-white/60 p-2 text-left active:scale-[0.98] sm:rounded-3xl sm:p-2.5 md:p-4',
                DASHBOARD_STAT_CARD_SHADOW,
                DASHBOARD_STAT_CARD_SHADOW_HOVER,
                DASHBOARD_STAT_CARD_SHADOW_TRANSITION,
                'transition-colors hover:bg-white/85',
              )}
            >
              <div className="flex items-center justify-between">
                <item.icon className={cn('h-3.5 w-3.5 sm:h-4 sm:w-4', item.color)} />
              </div>
              <p className={cn('mt-1.5 text-base font-black sm:mt-2 sm:text-lg md:mt-4 md:text-3xl', item.color)}>
                {stats.roomCounts[item.key]}
              </p>
              <p className="mt-0.5 truncate text-[9px] font-bold text-slate-500 sm:mt-1 sm:text-xs">{item.label}</p>
            </button>
          ))}
        </div>
      </section>

      <TeacherRoomStatsSection
        key={`teachers-${departmentFilter}`}
        teachers={stats.teacherRoomBreakdown}
        rooms={rooms}
        totalRooms={stats.roomCounts.all}
      />

      <SubjectGroupStatsSection
        key={`groups-${departmentFilter}`}
        groups={stats.subjectGroupBreakdown}
        rooms={rooms}
        totalRooms={stats.roomCounts.all}
      />

      <GradeLevelStatsSection
        key={`grades-${departmentFilter}`}
        grades={stats.gradeLevelBreakdown}
        rooms={rooms}
        totalRooms={stats.roomCounts.all}
      />

      <section className={cn(DASHBOARD_SECTION_CLASS, 'w-full')}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className={cn(DASHBOARD_KICKER_CLASS, 'text-slate-500')}>Recent Rooms</p>
            <h3 className={DASHBOARD_SECTION_TITLE_CLASS}>ห้องสอบล่าสุด</h3>
          </div>
        </div>
        {stats.recentRooms.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-dashed border-slate-200 bg-white/50 px-4 py-6 text-center text-sm font-semibold text-slate-400 md:mt-4 md:py-8">
            ยังไม่มีห้องสอบในภาคเรียนนี้
          </p>
        ) : (
          <>
            <DashboardStatCarousel
              items={stats.recentRooms}
              getKey={(room) => room.id}
              dotActiveClassName="bg-slate-500"
              getAriaLabel={(room) => `ไปที่ห้องสอบ ${room.title}`}
              renderItem={(room) => (
                <RecentRoomCard room={room} onClick={onOpenRooms} />
              )}
            />

            <div className="mt-4 hidden gap-2 md:grid md:grid-cols-2 xl:grid-cols-3">
              {stats.recentRooms.map((room) => (
                <RecentRoomCard key={room.id} room={room} onClick={onOpenRooms} />
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function StudentDashboard({
  stats,
  onOpenRoom,
  onViewRooms,
}: {
  stats: ReturnType<typeof buildStudentExamDashboardStats>;
  onOpenRoom: (roomId: string) => void;
  onViewRooms: () => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      <section className={DASHBOARD_SECTION_CLASS}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className={cn(DASHBOARD_KICKER_CLASS, 'text-violet-600')}>My Exams</p>
            <h2 className={DASHBOARD_PAGE_TITLE_CLASS}>สรุปการสอบของฉัน</h2>
          </div>
          <div className="rounded-2xl bg-violet-50 px-2.5 py-1.5 text-right sm:px-3 sm:py-2">
            <p className="text-[9px] font-black text-violet-500 sm:text-[10px]">คะแนนสูงสุด</p>
            <p className="text-base font-black text-slate-900 sm:text-lg">
              {stats.bestPercent !== null ? `${stats.bestPercent.toFixed(1)}%` : '-'}
            </p>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:mt-5 sm:grid-cols-4 sm:gap-3">
          <KpiCard label="ห้องที่เปิดสอบ" value={stats.activeRooms.length} colorClass="text-emerald-600" icon={HiPlay} />
          <KpiCard label="รอเปิดสอบ" value={stats.upcomingRooms.length} colorClass="text-amber-600" icon={HiClock} />
          <KpiCard label="กำลังทำข้อสอบ" value={stats.inProgress} colorClass="text-blue-600" icon={HiClipboardDocumentCheck} />
          <KpiCard
            label="คะแนนเฉลี่ย"
            value={stats.avgPercent !== null ? `${stats.avgPercent.toFixed(1)}%` : '-'}
            colorClass="text-teal-600"
            icon={HiTrophy}
          />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-2 md:gap-4 xl:grid-cols-12">
        <section className={cn(DASHBOARD_SECTION_CLASS, 'xl:col-span-7')}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className={cn(DASHBOARD_KICKER_CLASS, 'text-emerald-600')}>Active Rooms</p>
              <h3 className={DASHBOARD_SECTION_TITLE_CLASS}>ห้องสอบที่เปิดอยู่</h3>
            </div>
          </div>
          <div className="mt-3 space-y-2 md:mt-4">
            {stats.activeRooms.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-slate-200 bg-white/50 px-4 py-6 text-center text-sm font-semibold text-slate-400 md:py-8">
                ยังไม่มีห้องสอบที่เปิดอยู่
              </p>
            ) : (
              stats.activeRooms.map((room) => (
                <button
                  key={room.id}
                  type="button"
                  onClick={() => onOpenRoom(room.id)}
                  className={cn(
                    'flex w-full items-center justify-between gap-3 rounded-2xl border border-white bg-white/60 px-4 py-3 text-left transition hover:bg-white/85',
                    DASHBOARD_STAT_CARD_SHADOW,
                    DASHBOARD_STAT_CARD_SHADOW_HOVER,
                    DASHBOARD_STAT_CARD_SHADOW_TRANSITION,
                  )}
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs font-black text-slate-800 sm:text-sm">{room.title}</p>
                    <p className="truncate text-[10px] font-semibold text-slate-400 sm:text-[11px]">
                      {room.subjectName || room.className || 'ห้องสอบออนไลน์'}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black text-emerald-700">
                    เข้าสอบ
                  </span>
                </button>
              ))
            )}
          </div>
        </section>

        <section className={cn(DASHBOARD_SECTION_CLASS, 'xl:col-span-5')}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className={cn(DASHBOARD_KICKER_CLASS, 'text-indigo-600')}>Best Scores</p>
              <h3 className={DASHBOARD_SECTION_TITLE_CLASS}>คะแนนดีที่สุดตามวิชา</h3>
            </div>
          </div>
          <div className="mt-3 space-y-2 md:mt-4">
            {stats.subjectScores.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-slate-200 bg-white/50 px-4 py-6 text-center text-sm font-semibold text-slate-400 md:py-8">
                ยังไม่มีคะแนนที่ตรวจแล้ว
              </p>
            ) : (
              stats.subjectScores.map((item) => (
                <div
                  key={item.subjectName}
                  className={cn(
                    'flex items-center justify-between gap-3 rounded-2xl border border-white bg-white/60 px-4 py-3',
                    DASHBOARD_STAT_CARD_SHADOW,
                  )}
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs font-black text-slate-800 sm:text-sm">{item.subjectName}</p>
                    <p className="truncate text-[10px] font-semibold text-slate-400 sm:text-[11px]">{item.roomTitle}</p>
                  </div>
                  <p className="text-base font-black text-indigo-600 sm:text-lg">{item.bestPercent.toFixed(1)}%</p>
                </div>
              ))
            )}
          </div>
          <button
            type="button"
            onClick={onViewRooms}
            className="mt-3 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white text-xs font-black text-slate-700 md:mt-4"
          >
            ดูห้องสอบทั้งหมด
            <HiArrowRight className="h-3.5 w-3.5" />
          </button>
        </section>
      </div>
    </div>
  );
}
