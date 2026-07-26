import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  HiHome,
  HiAcademicCap,
  HiCalendarDays,
  HiOutlineFunnel,
  HiChevronLeft,
  HiHomeModern,
} from 'react-icons/hi2';
import { createPortal } from 'react-dom';
import { useScheduleManager } from './hooks/useScheduleManager';
import { buildJointClassInfo } from './utils/jointClass';
import { ClassView } from './views/ClassView';
import { TeacherView } from './views/TeacherView';
import ScheduleSlotModal from './components/ScheduleSlotModal';
import ScheduleSettingsModal from './components/ScheduleSettingsModal';
import { subjectColorByName, subjectGradient } from './constants/colors';
import {
  ExamFilterShowResultsButton,
  ExamMobileFilterDrawer,
} from '@/features/exam/components/ExamMobileFilterMenuButton';
import GradeBookClassSidebar from '@/features/grades/components/GradeBookClassSidebar';
import SidebarCollapseButton from '@/features/grades/components/SidebarCollapseButton';
import { Button } from '@/components/ui/button';
import { HEADER_ICON_BTN, HEADER_ICON_BTN_GROUP } from '@/lib/headerIconBtn';
import { cn } from '@/lib/utils';
import type { Subject } from '@/types/curriculum';
import type { ClassRoom } from '@/types/class';
import type { Department } from '@/types/curriculum';

function normalizeCategoryKey(raw?: string) {
  const c = String(raw || '').trim().toLowerCase();
  if (!c) return '';
  if (c === 'core' || c === 'basic' || c.includes('พื้นฐาน')) return 'basic';
  if (c === 'added' || c === 'additional' || c.includes('เพิ่มเติม')) return 'additional';
  if (c === 'activity' || c.includes('กิจกรรม')) return 'activity';
  return c;
}

function categoryBadgeStyle(raw?: string) {
  const key = normalizeCategoryKey(raw);
  if (key === 'additional') {
    return {
      label: 'เพิ่มเติม',
      className: 'bg-white text-amber-700 border-amber-200/60 shadow-2xs',
      dotClassName: 'bg-amber-500',
    };
  }
  if (key === 'activity') {
    return {
      label: 'กิจกรรม',
      className: 'bg-white text-violet-700 border-violet-200/60 shadow-2xs',
      dotClassName: 'bg-violet-500',
    };
  }
  return {
    label: 'พื้นฐาน',
    className: 'bg-white text-sky-700 border-sky-200/60 shadow-2xs',
    dotClassName: 'bg-sky-500',
  };
}

type ScheduleSubjectCard = Pick<Subject, 'id' | 'code' | 'name' | 'credits' | 'hoursPerWeek' | 'subjectGroup' | 'category'> & {
  semester?: number;
  assignedTeacherId?: string;
  classId?: string;
  className?: string;
};

const VIEW_TABS = [
  { id: 'class', label: 'ตารางเรียน', icon: HiHome },
  { id: 'teacher', label: 'ตารางสอน', icon: HiAcademicCap },
] as const;

const DEPT_OPTIONS = [
  { id: 'all', label: 'ทั้งหมด' },
  { id: 'early', label: 'อนุบาล' },
  { id: 'primary', label: 'ประถม' },
  { id: 'secondary', label: 'มัธยม' },
] as const;

const DEPT_STEP_OPTIONS = DEPT_OPTIONS.filter((opt) => opt.id !== 'all');

type FilterStep = 1 | 2 | 3;

export default function ScheduleEditor() {
  const {
    grid,
    year,
    viewMode,
    setViewMode,
    selectedClassId,
    setSelectedClassId,
    selectedTeacherId,
    setSelectedTeacherId,
    filterDept,
    setFilterDept,
    filterGrade,
    setFilterGrade,
    semester,
    isEditMode,
    setIsEditMode,
    openSlotModal,
    closeSlotModal,
    slotModal,
    addEntry,
    updateEntry,
    deleteEntry,
    deleteEntriesInSlot,
    allEntries,
    moveEntry,
    handleSubjectDrop,
    availableSubjects,
    classes,
    teachers,
    filteredClasses,
    availableGrades,
    exportRef,
  } = useScheduleManager();
  // Portals
  const [headerCenterMobilePortalEl, setHeaderCenterMobilePortalEl] = useState<HTMLElement | null>(null);
  const [mobileActionsPortalEl, setMobileActionsPortalEl] = useState<HTMLElement | null>(null);
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [filterStep, setFilterStep] = useState<FilterStep>(1);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  React.useEffect(() => {
    setHeaderCenterMobilePortalEl(document.getElementById('header-portal-center-mobile'));
    setMobileActionsPortalEl(document.getElementById('header-portal-mobile-actions'));
  }, []);

  const filteredGrades = useMemo(() => {
    if (filterDept === 'all') return availableGrades;
    return availableGrades.filter(g => {
      if (filterDept === 'early') return g.startsWith('อ');
      if (filterDept === 'primary') return g.startsWith('ป');
      if (filterDept === 'secondary') return g.startsWith('ม');
      return true;
    });
  }, [availableGrades, filterDept]);

  const excessEntryIds = useMemo(() => {
    if (viewMode !== 'class' || !selectedClassId) return new Set<string>();

    const subjectStats: Record<string, { scheduled: number; target: number; excess: number }> = {};
    availableSubjects.forEach((subject: ScheduleSubjectCard) => {
      subjectStats[subject.id] = {
        scheduled: 0,
        target: Math.max(Number(subject.hoursPerWeek || 0), 0),
        excess: 0,
      };
    });

    const excessIds = new Set<string>();
    const classEntries = allEntries
      .filter(entry =>
        entry.classId === selectedClassId &&
        entry.year === year &&
        entry.semester === semester,
      )
      .sort((a, b) => a.day - b.day || a.period - b.period || a.id.localeCompare(b.id));

    classEntries.forEach(entry => {
      const matchedSubject = availableSubjects.find((subject: ScheduleSubjectCard) =>
        subject.id === entry.subjectId || subject.code === entry.subjectCode,
      );
      if (!matchedSubject) return;

      const stat = subjectStats[matchedSubject.id] ?? {
        scheduled: 0,
        target: Math.max(Number(matchedSubject.hoursPerWeek || 0), 0),
        excess: 0,
      };

      stat.scheduled += 1;
      if (stat.target > 0 && stat.scheduled > stat.target) {
        stat.excess += 1;
        excessIds.add(entry.id);
      }
      subjectStats[matchedSubject.id] = stat;
    });

    return excessIds;
  }, [allEntries, availableSubjects, selectedClassId, semester, viewMode, year]);

  const { entryIds: jointClassEntryIds, partnersByEntryId: jointClassPartnersByEntryId } = useMemo(
    () => buildJointClassInfo(allEntries),
    [allEntries],
  );
  
  const handleDeleteEntry = async (id: string) => {
    // In edit mode: delete immediately (handles both temp and Firebase IDs)
    if (isEditMode) {
      await deleteEntry(id);
      return;
    }

    // In view mode: look up entry for confirmation and joint-class checks
    const entry = allEntries.find(e => e.id === id);
    if (!entry) return;

    if (!window.confirm('ต้องการลบคาบเรียนนี้ใช่หรือไม่?')) {
      return;
    }

    // Check for joint classes: same teacher, day, period but different class
    const jointEntries = allEntries.filter(e =>
      e.id !== id &&
      e.day === entry.day &&
      e.period === entry.period &&
      e.teacherId === entry.teacherId
    );

    if (jointEntries.length > 0) {
      const choice = window.confirm(
        `คาบนี้เป็นวิชาเรียนรวมกับห้องอื่น (${jointEntries.map(e => e.classId).join(', ')})\n\n` +
        `กด "ตกลง" เพื่อลบออกทั้งหมด (ลบวิชาเรียนรวม)\n` +
        `กด "ยกเลิก" เพื่อลบเฉพาะห้องนี้`
      );
      if (choice) {
        await deleteEntriesInSlot(entry.day, entry.period, {
          teacherId: entry.teacherId,
          classId: undefined
        });
        return;
      }
    }

    await deleteEntry(id);
  };

  const headerTeachers = useMemo(
    () => teachers
      .filter((t) => filterDept === 'all' || t.department === filterDept)
      .sort((a, b) => a.name.localeCompare(b.name, 'th')),
    [teachers, filterDept],
  );

  const roomOptions = useMemo(
    () => filteredClasses,
    [filteredClasses],
  );

  // GradeBookClassSidebar ต้องการ ClassRoom[] — schedule ใช้ SchoolClass[] ที่ field ใกล้เคียงกัน
  const sidebarClassOptions = useMemo<ClassRoom[]>(
    () => roomOptions.map((room) => ({
      ...room,
      studentCount: room.studentIds?.length ?? 0,
    } as unknown as ClassRoom)),
    [roomOptions],
  );

  const hasActiveFilters = filterDept !== 'all' || (viewMode === 'class' && filterGrade !== 'all');

  const filterStepTitle =
    filterStep === 1
      ? 'เลือกแผนก'
      : viewMode === 'teacher'
        ? 'เลือกตารางสอน'
        : 'เลือกรายชั้น';

  const filterStepDescription =
    filterStep === 1
      ? 'ขั้นตอนที่ 1 จาก 2'
      : 'ขั้นตอนที่ 2 จาก 2';

  const openFilterDrawer = () => {
    setFilterStep(1);
    setFilterDrawerOpen(true);
  };

  const handleClearFilters = () => {
    setFilterDept('all');
    setFilterGrade('all');
    setSelectedClassId('');
    setSelectedTeacherId('');
    setFilterStep(1);
  };

  useEffect(() => {
    if (viewMode !== 'class') return;
    if (filterDept === 'all' || filterGrade === 'all') return;
    if (roomOptions.length === 0) {
      if (selectedClassId) setSelectedClassId('');
      return;
    }
    const stillValid = roomOptions.some((room) => room.id === selectedClassId);
    if (!stillValid) setSelectedClassId(roomOptions[0].id);
  }, [viewMode, filterDept, filterGrade, roomOptions, selectedClassId, setSelectedClassId]);

  const handleSidebarSelectDept = (dept: Department) => {
    setFilterDept(dept);
    setFilterGrade('all');
    setSelectedClassId('');
    setSelectedTeacherId('');
  };

  const handleSidebarModeChange = (mode: typeof viewMode) => {
    if (viewMode === mode) return;
    setViewMode(mode);
    setFilterGrade('all');
    if (mode === 'class') setSelectedTeacherId('');
    if (mode === 'teacher') setSelectedClassId('');
  };

  const sidebarModeToggle = filterDept !== 'all' ? (
    <div className="grid grid-cols-2 gap-1.5 rounded-2xl border border-border bg-muted/40 p-1">
      {VIEW_TABS.map((tab) => {
        const active = viewMode === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => handleSidebarModeChange(tab.id)}
            className={cn(
              'rounded-xl px-2 py-2 text-[11px] font-black font-sukhumvit transition-all',
              active
                ? 'bg-foreground text-background shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  ) : null;

  const sidebarTeacherList = viewMode === 'teacher' && filterDept !== 'all' ? (
    <div className="flex flex-col gap-2 pb-1">
      {headerTeachers.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border px-3 py-6 text-center text-[12px] font-bold text-muted-foreground">
          ไม่พบครูในแผนกนี้
        </div>
      ) : (
        headerTeachers.map((teacher) => {
          const active = selectedTeacherId === teacher.id;
          return (
            <button
              key={teacher.id}
              type="button"
              onClick={() => setSelectedTeacherId(teacher.id)}
              className={cn(
                'flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all',
                active
                  ? 'border-foreground bg-foreground text-background shadow-sm'
                  : 'border-border bg-card text-foreground hover:bg-muted/50',
              )}
            >
              <span
                className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg text-[13px] font-black',
                  active ? 'bg-background/15 text-background' : 'bg-muted text-foreground',
                )}
              >
                {teacher.photoURL ? (
                  <img src={teacher.photoURL} alt={teacher.name} className="h-full w-full object-cover" />
                ) : (
                  teacher.name.charAt(0)
                )}
              </span>
              <span className="min-w-0 flex-1 truncate text-[13px] font-black font-sukhumvit">
                {teacher.name}
              </span>
            </button>
          );
        })
      )}
    </div>
  ) : null;

  const sidebarCollapsedExtra = useMemo(() => {
    const activeTab = VIEW_TABS.find(t => t.id === viewMode);
    const ModeIcon = activeTab?.icon || HiHome;
    return (
      <div className="flex flex-col items-center gap-3 pt-3 border-t border-border w-full">
        {/* Mode icon (เรียน / ครู) */}
        <button
          type="button"
          onClick={() => handleSidebarModeChange(viewMode === 'class' ? 'teacher' : 'class')}
          className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-slate-50 text-slate-500 hover:text-slate-800 transition-colors shadow-2xs cursor-pointer"
          title={viewMode === 'class' ? 'สลับเป็นตารางสอน' : 'สลับเป็นตารางเรียน'}
        >
          <ModeIcon className="h-5 w-5" />
        </button>

        {/* Classroom list when collapsed */}
        {viewMode === 'class' && filterGrade !== 'all' && roomOptions.length > 0 && (
          <div className="flex flex-col items-center gap-2 w-full pt-3 border-t border-border/60">
            {roomOptions.map((room) => {
              const active = selectedClassId === room.id;
              const displayLabel = (room.label || room.className).replace(/^[^\d]*/, '');
              return (
                <button
                  key={room.id}
                  type="button"
                  onClick={() => setSelectedClassId(room.id)}
                  className={cn(
                    "flex h-9 w-9 shrink-0 flex-col items-center justify-center rounded-xl border transition-all duration-200 cursor-pointer font-sukhumvit font-black",
                    active
                      ? "border-blue-600 bg-blue-600/10 text-blue-600 scale-105 shadow-sm"
                      : "border-border bg-card text-slate-500 hover:bg-muted/50"
                  )}
                  title={room.label || room.className}
                >
                  <HiHomeModern className="h-3.5 w-3.5 mb-0.5" />
                  <span className="text-[9px] leading-none scale-[0.85] truncate max-w-full px-0.5">
                    {displayLabel}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Teacher avatar list */}
        {viewMode === 'teacher' && filterDept !== 'all' && (
          <div className="flex flex-col items-center gap-2 w-full pt-3 border-t border-border/60">
            {headerTeachers.map((teacher) => {
              const active = selectedTeacherId === teacher.id;
              return (
                <button
                  key={teacher.id}
                  type="button"
                  onClick={() => setSelectedTeacherId(teacher.id)}
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl border transition-all duration-200 cursor-pointer",
                    active
                      ? "border-violet-600 bg-violet-600/10 scale-105 shadow-sm"
                      : "border-border bg-card hover:bg-muted/50"
                  )}
                  title={teacher.name}
                >
                  {teacher.photoURL ? (
                    <img src={teacher.photoURL} alt={teacher.name} className="h-full w-full object-cover" />
                  ) : (
                    <span className={cn(
                      "text-[12px] font-black font-sukhumvit",
                      active ? "text-violet-700" : "text-slate-500"
                    )}>
                      {teacher.name.charAt(0)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }, [viewMode, selectedClassId, selectedTeacherId, filterGrade, roomOptions, teachers, filterDept, headerTeachers]);

  return (
    <div
      ref={exportRef}
      className="flex flex-col h-[calc(100dvh-4.25rem)] max-h-[calc(100dvh-4.25rem)] min-h-0 text-black font-sukhumvit"
    >
      <ExamMobileFilterDrawer
        open={filterDrawerOpen}
        onOpenChange={setFilterDrawerOpen}
        title={filterStepTitle}
        description={filterStepDescription}
        direction="right"
        footer={(
          <>
            {filterStep > 1 && (
              <Button
                type="button"
                variant="outline"
                className="h-11 flex-1"
                onClick={() => setFilterStep(1)}
              >
                <HiChevronLeft className="h-4 w-4" />
                ย้อนกลับ
              </Button>
            )}
            {filterStep === 2 && (
              <ExamFilterShowResultsButton onClick={() => setFilterDrawerOpen(false)} />
            )}
            {hasActiveFilters && filterStep === 1 && (
              <Button
                type="button"
                variant="destructive"
                className="h-11 flex-1"
                onClick={handleClearFilters}
              >
                ล้างตัวกรอง
              </Button>
            )}
          </>
        )}
      >
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
          {VIEW_TABS.map((m) => {
            const Icon = m.icon;
            const active = viewMode === m.id;
            return (
              <Button
                key={m.id}
                type="button"
                variant={active ? 'default' : 'ghost'}
                className="h-10 gap-1.5"
                onClick={() => {
                  if (viewMode === m.id) return;
                  setViewMode(m.id);
                  setFilterGrade('all');
                  if (m.id === 'class') setSelectedTeacherId('');
                  if (m.id === 'teacher') setSelectedClassId('');
                }}
                aria-pressed={active}
              >
                <Icon className="h-4 w-4" />
                {m.label}
              </Button>
            );
          })}
        </div>

        <div className="flex items-center gap-1.5">
          {([1, 2] as const).map((step) => (
            <div
              key={step}
              className={cn(
                'h-1.5 flex-1 rounded-full transition-colors',
                step <= filterStep ? 'bg-primary' : 'bg-muted',
              )}
            />
          ))}
        </div>

        <div className="min-w-0">
        <AnimatePresence mode="wait">
          {filterStep === 1 && (
            <motion.div
              key="step-dept"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.15 }}
              className="grid grid-cols-1 gap-2"
            >
              {DEPT_STEP_OPTIONS.map((opt) => {
                const active = filterDept === opt.id;
                return (
                  <Button
                    key={opt.id}
                    type="button"
                    variant={active ? 'default' : 'outline'}
                    className="h-12 justify-start px-4"
                    onClick={() => {
                      setFilterDept(opt.id);
                      setFilterGrade('all');
                      setSelectedClassId('');
                      setFilterStep(2);
                    }}
                  >
                    {opt.label}
                  </Button>
                );
              })}
            </motion.div>
          )}

          {filterStep === 2 && viewMode === 'class' && filterDept !== 'all' && (
            <motion.div
              key="step-class"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.15 }}
              className="space-y-5"
            >
              <div>
                <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                  ระดับชั้น
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {filteredGrades.map((grade) => (
                    <Button
                      key={grade}
                      type="button"
                      size="sm"
                      variant={filterGrade === grade ? 'default' : 'secondary'}
                      className="w-full"
                      onClick={() => {
                        setFilterGrade(grade);
                        setSelectedClassId('');
                      }}
                    >
                      {grade}
                    </Button>
                  ))}
                </div>
              </div>

              {filterGrade !== 'all' && (
                <div>
                  <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                    ห้องเรียน
                  </p>
                  {roomOptions.length === 0 ? (
                    <p className="text-[12px] font-bold text-muted-foreground">ไม่พบห้องในระดับนี้</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {roomOptions.map((room) => (
                        <Button
                          key={room.id}
                          type="button"
                          size="sm"
                          variant={selectedClassId === room.id ? 'default' : 'secondary'}
                          onClick={() => {
                            setSelectedClassId(room.id);
                            setFilterDrawerOpen(false);
                          }}
                        >
                          {room.label || room.className}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}

          {filterStep === 2 && viewMode === 'teacher' && filterDept !== 'all' && (
            <motion.div
              key="step-teacher"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.15 }}
              className="space-y-2"
            >
              {headerTeachers.length === 0 ? (
                <p className="text-[12px] font-bold text-muted-foreground">ไม่พบครูในแผนกนี้</p>
              ) : (
                headerTeachers.map((teacher) => (
                  <Button
                    key={teacher.id}
                    type="button"
                    variant={selectedTeacherId === teacher.id ? 'default' : 'outline'}
                    className="h-11 w-full justify-start px-4"
                    onClick={() => {
                      setSelectedTeacherId(teacher.id);
                      setFilterDrawerOpen(false);
                    }}
                  >
                    {teacher.name}
                  </Button>
                ))
              )}
            </motion.div>
          )}
        </AnimatePresence>
        </div>
      </ExamMobileFilterDrawer>

      {headerCenterMobilePortalEl && createPortal(
        <div className="md:hidden pointer-events-auto flex items-center gap-1.5 min-w-0">
          <HiCalendarDays className="w-4 h-4 text-slate-500 shrink-0" />
          <span className="text-[13px] font-black text-slate-800 tracking-tight leading-none whitespace-nowrap">
            {VIEW_TABS.find((t) => t.id === viewMode)?.label ?? 'ตารางเรียน'}
          </span>
          {viewMode === 'class' && selectedClassId && (
            <>
              <span className="text-slate-300 text-xs shrink-0">·</span>
              <span className="text-[11px] font-black text-blue-600 whitespace-nowrap truncate max-w-[100px]">
                {roomOptions.find((r) => r.id === selectedClassId)?.label
                  || roomOptions.find((r) => r.id === selectedClassId)?.className
                  || ''}
              </span>
            </>
          )}
          {viewMode === 'teacher' && selectedTeacherId && (
            <>
              <span className="text-slate-300 text-xs">·</span>
              <span className="text-[11px] font-black text-blue-600 whitespace-nowrap truncate max-w-[100px]">
                {teachers.find(t => t.id === selectedTeacherId)?.name ?? ''}
              </span>
            </>
          )}
        </div>,
        headerCenterMobilePortalEl!
      )}

      {mobileActionsPortalEl && createPortal(
        <div className={cn('flex', HEADER_ICON_BTN_GROUP)}>
          <ScheduleSettingsModal
            targetId={viewMode === 'teacher' ? selectedTeacherId : selectedClassId}
          />
          <button
            type="button"
            onClick={openFilterDrawer}
            className={HEADER_ICON_BTN}
            title="ตัวกรอง"
            aria-label="ตัวกรอง"
          >
            <HiOutlineFunnel size={16} />
            {hasActiveFilters && (
              <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-destructive" aria-hidden />
            )}
          </button>
        </div>,
        mobileActionsPortalEl,
      )}



      {/* Legacy inline class/room filters removed per new capsule flow */}



      {/* ── Main Layout ── */}
      <div className="flex flex-1 min-h-0 gap-4 px-3 md:px-6">
        <div
          className={cn(
            'hidden min-h-0 shrink-0 lg:flex lg:flex-col lg:h-full lg:max-h-full self-stretch overflow-hidden',
            sidebarCollapsed ? 'lg:w-20 xl:w-20' : 'lg:w-[280px] xl:w-[300px]',
          )}
        >
          {isEditMode ? (
            <div className={cn(
              "relative flex h-full max-h-full min-h-0 w-full flex-col overflow-hidden rounded-2xl border border-border bg-card transition-all",
              sidebarCollapsed ? "p-2 items-center" : "p-4"
            )}>
              {/* Sidebar Edit Mode Header */}
              <div className={cn(
                "flex items-center justify-between pb-3 border-b border-border mb-3 w-full shrink-0",
                sidebarCollapsed ? "justify-center" : ""
              )}>
                {!sidebarCollapsed ? (
                  <>
                    <h2 className="text-sm font-black font-sukhumvit text-slate-800">
                      รายวิชา ({availableSubjects.length})
                    </h2>
                    <SidebarCollapseButton
                      collapsed={sidebarCollapsed}
                      onToggle={() => setSidebarCollapsed((v) => !v)}
                    />
                  </>
                ) : (
                  <SidebarCollapseButton
                    collapsed={sidebarCollapsed}
                    onToggle={() => setSidebarCollapsed((v) => !v)}
                  />
                )}
              </div>

              {/* Draggable Subjects List */}
              <div className={cn(
                "flex-1 min-h-0 overflow-y-auto w-full scrollbar-hide",
                sidebarCollapsed ? "flex flex-col items-center gap-2 pt-1" : "space-y-2.5 pr-0.5"
              )}>
                {availableSubjects.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-rose-200 bg-rose-50/20 px-3 py-6 text-center text-xs font-bold text-rose-500/80">
                    ไม่มีรายวิชาที่พร้อมลากวาง
                  </div>
                ) : (
                  availableSubjects.map((subject) => {
                    const color = subjectColorByName(subject.name || subject.id, subject.subjectGroup);
                    const teacherId = subject.assignedTeacherId || '';
                    const badge = categoryBadgeStyle(subject.category);

                    if (sidebarCollapsed) {
                      return (
                        <div
                          key={`${subject.id}-${subject.className ?? ''}`}
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData(
                              'application/subject-card',
                              JSON.stringify({ subjectId: subject.id, teacherId, classId: subject.classId ?? '' }),
                            );
                            e.dataTransfer.effectAllowed = 'copy';
                          }}
                          className="cursor-grab select-none rounded-xl h-11 w-11 shrink-0 flex flex-col items-center justify-center border font-sukhumvit font-black text-white transition-all active:cursor-grabbing hover:scale-105"
                          style={{
                            background: subjectGradient(color),
                            borderColor: color.border,
                          }}
                          title={`${subject.code}: ${subject.name}`}
                        >
                          <span className="text-[9px] leading-none scale-[0.8] truncate max-w-full px-0.5">
                            {subject.code}
                          </span>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={`${subject.id}-${subject.className ?? ''}`}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData(
                            'application/subject-card',
                            JSON.stringify({ subjectId: subject.id, teacherId, classId: subject.classId ?? '' }),
                          );
                          e.dataTransfer.effectAllowed = 'copy';
                        }}
                        className="cursor-grab select-none rounded-xl p-3 border transition-all active:cursor-grabbing hover:scale-[1.01] hover:shadow-xs"
                        style={{
                          background: subjectGradient(color),
                          borderColor: color.border,
                        }}
                      >
                        <div className="mb-2 flex flex-wrap items-center gap-1.5">
                          <span
                            className="rounded-md border px-1.5 py-0.5 text-[9px] font-black shrink-0"
                            style={{
                              borderColor: 'rgba(255,255,255,0.26)',
                              background: 'rgba(0,0,0,0.14)',
                              color: 'rgba(255,255,255,0.96)',
                            }}
                          >
                            {subject.code}
                          </span>
                          {viewMode === 'teacher' && subject.className && (
                            <span
                              className="rounded-md border px-1 py-0.5 text-[8px] font-black bg-white/20 text-white shrink-0"
                              style={{ borderColor: 'rgba(255,255,255,0.2)' }}
                            >
                              {subject.className}
                            </span>
                          )}
                          <span
                            className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[8px] font-black shrink-0 ${badge.className}`}
                          >
                            <span className={`h-1 w-1 rounded-full ${badge.dotClassName}`} />
                            {badge.label}
                          </span>
                          <span
                            className="ml-auto text-[9px] font-bold text-white shrink-0"
                            style={{ textShadow: '0 1px 2px rgba(0,0,0,0.4)' }}
                          >
                            {subject.hoursPerWeek ?? 0} คาบ
                          </span>
                        </div>
                        <p
                          className="line-clamp-2 text-xs font-black leading-snug text-white"
                          style={{ textShadow: '0 1px 2.5px rgba(0,0,0,0.45)' }}
                        >
                          {subject.name}
                        </p>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ) : (
            <GradeBookClassSidebar
              selectedDept={filterDept === 'all' ? '' : filterDept}
              selectedGrade={filterGrade}
              selectedClassId={selectedClassId}
              gradeOptions={filteredGrades}
              classOptions={sidebarClassOptions}
              onSelectDept={handleSidebarSelectDept}
              onSelectGrade={(grade) => { setFilterGrade(grade); setSelectedClassId(''); }}
              onSelectClass={setSelectedClassId}
              afterDept={sidebarModeToggle}
              showGradeRoomNav={viewMode === 'class'}
              showRooms={viewMode === 'class'}
              collapsed={sidebarCollapsed}
              collapsedExtra={sidebarCollapsedExtra}
              disableAnimations
              headerAction={
                <div className="flex items-center gap-1">
                  {!sidebarCollapsed && (
                    <ScheduleSettingsModal
                      targetId={viewMode === 'teacher' ? selectedTeacherId : selectedClassId}
                    />
                  )}
                  <SidebarCollapseButton
                    collapsed={sidebarCollapsed}
                    onToggle={() => setSidebarCollapsed((v) => !v)}
                  />
                </div>
              }
            >
              {sidebarTeacherList}
            </GradeBookClassSidebar>
          )}
        </div>

        <div className="flex-1 min-w-0 min-h-0 overflow-auto scrollbar-hide">
          <AnimatePresence mode="wait">
            <motion.div
              key={viewMode}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
            >
              {viewMode === 'class' && (
                <ClassView
                  grid={grid}
                  selectedClassId={selectedClassId}
                  filterDept={filterDept}
                  isEditMode={isEditMode}
                  setIsEditMode={setIsEditMode}
                  openSlotModal={openSlotModal}
                  deleteEntry={handleDeleteEntry}
                  moveEntry={moveEntry}
                  onDropSubject={handleSubjectDrop}
                  allClasses={classes}
                  teachers={teachers}
                  excessEntryIds={excessEntryIds}
                  draggableSubjects={availableSubjects}
                  jointClassEntryIds={jointClassEntryIds}
                  jointClassPartnersByEntryId={jointClassPartnersByEntryId}
                />
              )}
              {viewMode === 'teacher' && (
                <TeacherView
                  selectedTeacherId={selectedTeacherId}
                  filterDept={filterDept}
                  isEditMode={isEditMode}
                  setIsEditMode={setIsEditMode}
                  grid={grid}
                  openSlotModal={openSlotModal}
                  deleteEntry={handleDeleteEntry}
                  moveEntry={moveEntry}
                  handleSubjectDrop={handleSubjectDrop}
                  teachers={teachers}
                  allClasses={classes}
                  draggableSubjects={availableSubjects}
                  jointClassEntryIds={jointClassEntryIds}
                  jointClassPartnersByEntryId={jointClassPartnersByEntryId}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <ScheduleSlotModal
        open={slotModal.open}
        day={slotModal.day}
        period={slotModal.period}
        editingEntry={slotModal.editingEntry}
        classId={selectedClassId}
        year={year}
        semester={semester}
        subjects={availableSubjects}
        teachers={teachers}
        classes={classes}
        onClose={closeSlotModal}
        onSave={addEntry}
        onUpdate={updateEntry}
        onDelete={deleteEntry}
      />
    </div>
  );
}
