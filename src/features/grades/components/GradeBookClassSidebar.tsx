import { AnimatePresence, motion } from 'framer-motion';
import type { ReactNode } from 'react';
import type { IconType } from 'react-icons';
import {
  HiAcademicCap,
  HiBuildingLibrary,
  HiFaceSmile,
  HiHomeModern,
} from 'react-icons/hi2';
import { cn } from '@/lib/utils';
import { DEPARTMENT_CONFIG, type Department } from '@/types/curriculum';
import type { ClassRoom } from '@/types/class';

const DEPARTMENTS: Department[] = ['early', 'primary', 'secondary'];

const DEPT_ICON: Record<Department, IconType> = {
  early: HiFaceSmile,
  primary: HiAcademicCap,
  secondary: HiBuildingLibrary,
};

const DEPT_ACCENT: Record<Department, string> = {
  early: 'bg-pink-500/15 text-pink-700 border-pink-200',
  primary: 'bg-blue-500/15 text-blue-700 border-blue-200',
  secondary: 'bg-violet-500/15 text-violet-700 border-violet-200',
};

const DEPT_ACTIVE: Record<Department, string> = {
  early: 'bg-pink-600 border-pink-600 text-white shadow-md shadow-pink-500/20',
  primary: 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-500/20',
  secondary: 'bg-violet-600 border-violet-600 text-white shadow-md shadow-violet-500/20',
};

type Props = {
  selectedDept: string;
  selectedGrade: string;
  selectedClassId: string;
  gradeOptions: string[];
  classOptions: ClassRoom[];
  onSelectDept: (dept: Department) => void;
  onSelectGrade: (grade: string) => void;
  onSelectClass: (classId: string) => void;
  loading?: boolean;
  /** Rendered under dept cards when a department is selected (e.g. mode toggle). */
  afterDept?: ReactNode;
  /** When false, hide grade + room nav (e.g. teacher browse mode). Default true. */
  showGradeRoomNav?: boolean;
  /** When false, hide class-room list after grade (e.g. question bank → subject groups). Default true. */
  showRooms?: boolean;
  /** Extra content in the scroll area (e.g. teacher list / subject groups). */
  children?: ReactNode;
  /** Control row above dept cards (e.g. search, settings, sidebar collapse). Desktop-only unless headerActionMobile. */
  headerAction?: ReactNode;
  /** Show headerAction on mobile too (default: desktop-only). */
  headerActionMobile?: boolean;
  /** Hide the card frame (border/background/rounding) on mobile — full-bleed. Default false. */
  hideFrameOnMobile?: boolean;
  /** Desktop: narrow rail — dept icons only; content stays mounted. */
  collapsed?: boolean;
  /** Desktop collapsed rail content under dept icons (e.g. mode + teacher avatars). */
  collapsedExtra?: ReactNode;
  /** Disable enter/exit animations on grade/room sections. Default false. */
  disableAnimations?: boolean;
  /** Hide the department card grid entirely (e.g. student view — dept/grade is fixed, skip straight to children). Default false. */
  hideDeptCards?: boolean;
};

export default function GradeBookClassSidebar({
  selectedDept,
  selectedGrade,
  selectedClassId,
  gradeOptions,
  classOptions,
  onSelectDept,
  onSelectGrade,
  onSelectClass,
  loading = false,
  afterDept,
  showGradeRoomNav = true,
  showRooms = true,
  children,
  headerAction,
  headerActionMobile = false,
  hideFrameOnMobile = false,
  collapsed = false,
  collapsedExtra,
  disableAnimations = false,
  hideDeptCards = false,
}: Props) {
  return (
    <aside
      className={cn(
        'relative flex h-full max-h-full min-h-0 w-full flex-col overflow-hidden',
        hideFrameOnMobile ? 'lg:rounded-2xl lg:border lg:border-border lg:bg-card' : 'rounded-2xl border border-border bg-card',
        headerAction
          ? 'px-2 pb-2 sm:px-2.5 sm:pb-2.5'
          : 'p-2 sm:p-2.5',
        collapsed && 'lg:items-center lg:gap-0 lg:px-2 lg:pb-2',
      )}
    >
      {headerAction ? (
        <div
          className={cn(
            'mb-2 min-h-[3.25rem] w-full shrink-0 items-center gap-2 border-b border-border px-0 pb-2 pt-2 sm:pt-2.5',
            headerActionMobile ? 'flex' : 'hidden lg:flex',
            collapsed ? 'justify-center' : 'justify-end',
          )}
        >
          {headerAction}
        </div>
      ) : null}
      <div
        className={cn(
          'flex min-h-0 flex-1 basis-0 flex-col gap-3 overflow-y-auto overscroll-y-contain scrollbar-hide',
          collapsed && 'lg:items-center lg:gap-2',
        )}
        onWheel={(e) => e.stopPropagation()}
      >
        <section className={cn(collapsed && 'lg:w-full', hideDeptCards && 'hidden')}>
          <div
            className={cn(
              'grid grid-cols-1 gap-2',
              collapsed && 'lg:place-items-center lg:gap-2',
            )}
          >
            {DEPARTMENTS.map((dept) => {
              const cfg = DEPARTMENT_CONFIG[dept];
              const active = selectedDept === dept;
              const DeptIcon = DEPT_ICON[dept];
              return (
                <button
                  key={dept}
                  type="button"
                  onClick={() => onSelectDept(dept)}
                  title={cfg.label}
                  aria-label={cfg.label}
                  aria-pressed={active}
                  className={cn(
                    'flex items-center rounded-xl border text-left transition-all',
                    collapsed
                      ? 'w-full gap-3 px-3 py-2.5 lg:size-11 lg:w-11 lg:justify-center lg:gap-0 lg:p-0'
                      : 'w-full gap-3 px-3 py-2.5',
                    active ? DEPT_ACTIVE[dept] : cn(DEPT_ACCENT[dept], 'hover:opacity-90'),
                  )}
                >
                  <span
                    className={cn(
                      'flex shrink-0 items-center justify-center',
                      collapsed
                        ? 'h-9 w-9 rounded-lg lg:size-full lg:rounded-xl lg:bg-transparent'
                        : cn('h-9 w-9 rounded-lg', active ? 'bg-white/20' : 'bg-white/70'),
                    )}
                  >
                    <DeptIcon
                      className={cn(
                        collapsed ? 'h-4 w-4 lg:h-5 lg:w-5' : 'h-4 w-4',
                        !active && !collapsed && 'opacity-90',
                      )}
                    />
                  </span>
                  <span className={cn('min-w-0', collapsed && 'lg:hidden')}>
                    <span className="block truncate text-[13px] font-black font-sukhumvit">
                      {cfg.label}
                    </span>
                    <span
                      className={cn(
                        'block text-[10px] font-bold',
                        active ? 'text-white/80' : 'text-muted-foreground',
                      )}
                    >
                      {cfg.grades.length} ระดับชั้น
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {collapsedExtra ? (
          <div
            className={cn(
              'hidden w-full flex-col items-center gap-2',
              collapsed && 'lg:flex',
            )}
          >
            {collapsedExtra}
          </div>
        ) : null}

        {selectedDept ? (
          <div className={cn(collapsed && 'lg:hidden')}>{afterDept}</div>
        ) : null}

        {disableAnimations ? (
          selectedDept && showGradeRoomNav && (
            <section className={cn(collapsed && 'lg:hidden')}>
              {loading ? (
                <div className="grid grid-cols-3 gap-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-16 animate-pulse rounded-2xl bg-muted" />
                  ))}
                </div>
              ) : gradeOptions.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border px-3 py-6 text-center text-[12px] font-bold text-muted-foreground">
                  ไม่พบระดับชั้นในแผนกนี้
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {gradeOptions.map((grade) => {
                    const active = selectedGrade === grade;
                    return (
                      <button
                        key={grade}
                        type="button"
                        onClick={() => onSelectGrade(grade)}
                        className={cn(
                          'flex flex-col items-center justify-center gap-1 rounded-xl border px-2 py-3 transition-all',
                          active
                            ? 'border-foreground bg-foreground text-background shadow-sm'
                            : 'border-border bg-muted/40 text-foreground hover:bg-muted',
                        )}
                      >
                        <HiAcademicCap className={cn('h-4 w-4', active ? 'text-background' : 'text-muted-foreground')} />
                        <span className="text-[12px] font-black font-sukhumvit">{grade}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
          )
        ) : (
          <AnimatePresence initial={false}>
            {selectedDept && showGradeRoomNav && (
              <motion.section
                key={`grades-${selectedDept}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className={cn(collapsed && 'lg:hidden')}
              >
                {loading ? (
                  <div className="grid grid-cols-3 gap-2">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="h-16 animate-pulse rounded-2xl bg-muted" />
                    ))}
                  </div>
                ) : gradeOptions.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border px-3 py-6 text-center text-[12px] font-bold text-muted-foreground">
                    ไม่พบระดับชั้นในแผนกนี้
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {gradeOptions.map((grade) => {
                      const active = selectedGrade === grade;
                      return (
                        <button
                          key={grade}
                          type="button"
                          onClick={() => onSelectGrade(grade)}
                          className={cn(
                            'flex flex-col items-center justify-center gap-1 rounded-xl border px-2 py-3 transition-all',
                            active
                              ? 'border-foreground bg-foreground text-background shadow-sm'
                              : 'border-border bg-muted/40 text-foreground hover:bg-muted',
                          )}
                        >
                          <HiAcademicCap className={cn('h-4 w-4', active ? 'text-background' : 'text-muted-foreground')} />
                          <span className="text-[12px] font-black font-sukhumvit">{grade}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </motion.section>
            )}
          </AnimatePresence>
        )}

        {disableAnimations ? (
          selectedDept && showGradeRoomNav && selectedGrade && selectedGrade !== 'all' && showRooms && (
            <section className={cn('pb-1', collapsed && 'lg:hidden')}>
              {loading ? (
                <div className="flex flex-col gap-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-14 animate-pulse rounded-2xl bg-muted" />
                  ))}
                </div>
              ) : classOptions.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border px-3 py-6 text-center text-[12px] font-bold text-muted-foreground">
                  ไม่พบห้องเรียนในระดับชั้นนี้
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {classOptions.map((room) => {
                    const active = selectedClassId === room.id;
                    return (
                      <button
                        key={room.id}
                        type="button"
                        onClick={() => onSelectClass(room.id)}
                        className={cn(
                          'flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all',
                          active
                            ? 'border-foreground bg-foreground text-background shadow-sm'
                            : 'border-border bg-card text-foreground hover:bg-muted/50',
                        )}
                      >
                        <span
                          className={cn(
                            'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                            active ? 'bg-background/15' : 'bg-muted',
                          )}
                        >
                          <HiHomeModern className={cn('h-4 w-4', active ? 'text-background' : 'text-muted-foreground')} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-black font-sukhumvit">
                            {room.className}
                          </span>
                          <span
                            className={cn(
                              'block text-[10px] font-bold',
                              active ? 'text-background/75' : 'text-muted-foreground',
                            )}
                          >
                            {room.studentCount} นักเรียน
                            {room.track ? ` · ${room.track}` : ''}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
          )
        ) : (
          <AnimatePresence initial={false}>
            {selectedDept && showGradeRoomNav && selectedGrade && selectedGrade !== 'all' && showRooms && (
              <motion.section
                key={`rooms-${selectedDept}-${selectedGrade}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className={cn('pb-1', collapsed && 'lg:hidden')}
              >
                {loading ? (
                  <div className="flex flex-col gap-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="h-14 animate-pulse rounded-2xl bg-muted" />
                    ))}
                  </div>
                ) : classOptions.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border px-3 py-6 text-center text-[12px] font-bold text-muted-foreground">
                    ไม่พบห้องเรียนในระดับชั้นนี้
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {classOptions.map((room) => {
                      const active = selectedClassId === room.id;
                      return (
                        <button
                          key={room.id}
                          type="button"
                          onClick={() => onSelectClass(room.id)}
                          className={cn(
                            'flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all',
                            active
                              ? 'border-foreground bg-foreground text-background shadow-sm'
                              : 'border-border bg-card text-foreground hover:bg-muted/50',
                          )}
                        >
                          <span
                            className={cn(
                              'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                              active ? 'bg-background/15' : 'bg-muted',
                            )}
                          >
                            <HiHomeModern className={cn('h-4 w-4', active ? 'text-background' : 'text-muted-foreground')} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] font-black font-sukhumvit">
                              {room.className}
                            </span>
                            <span
                              className={cn(
                                'block text-[10px] font-bold',
                                active ? 'text-background/75' : 'text-muted-foreground',
                              )}
                            >
                              {room.studentCount} นักเรียน
                              {room.track ? ` · ${room.track}` : ''}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </motion.section>
            )}
          </AnimatePresence>
        )}

        {children ? (
          <div className={cn('w-full flex-1 min-h-0 flex flex-col', collapsed && 'lg:hidden')}>{children}</div>
        ) : null}
      </div>
    </aside>
  );
}
