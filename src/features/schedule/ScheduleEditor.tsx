import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  HiHome,
  HiAcademicCap,
  HiCalendarDays,
  HiOutlineFunnel,
  HiChevronLeft,
} from 'react-icons/hi2';
import { createPortal } from 'react-dom';
import { useScheduleManager } from './hooks/useScheduleManager';
import { buildJointClassInfo } from './utils/jointClass';
import { ClassView } from './views/ClassView';
import { TeacherView } from './views/TeacherView';
import ScheduleSlotModal from './components/ScheduleSlotModal';
import ScheduleSettingsModal from './components/ScheduleSettingsModal';
import {
  ExamFilterShowResultsButton,
  ExamMobileFilterDrawer,
} from '@/features/exam/components/ExamMobileFilterMenuButton';
import { Button } from '@/components/ui/button';
import { HEADER_ICON_BTN, HEADER_ICON_BTN_GROUP } from '@/lib/headerIconBtn';
import { cn } from '@/lib/utils';
import type { Subject } from '@/types/curriculum';

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
    setSemester,
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
  const [rightTarget, setRightTarget] = useState<HTMLElement | null>(null);
  const [headerCenterMobilePortalEl, setHeaderCenterMobilePortalEl] = useState<HTMLElement | null>(null);
  const [mobileActionsPortalEl, setMobileActionsPortalEl] = useState<HTMLElement | null>(null);
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [filterStep, setFilterStep] = useState<FilterStep>(1);
  const [semesterChosenInFilter, setSemesterChosenInFilter] = useState(false);

  React.useEffect(() => {
    setRightTarget(document.getElementById('header-portal-right-actions'));
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

  const hasActiveFilters = filterDept !== 'all' || (viewMode === 'class' && filterGrade !== 'all');

  const filterStepTitle =
    filterStep === 1
      ? 'เลือกภาคเรียน'
      : filterStep === 2
        ? 'เลือกแผนก'
        : viewMode === 'teacher'
          ? 'เลือกตารางสอน'
          : 'เลือกรายชั้น';

  const filterStepDescription =
    filterStep === 1
      ? 'ขั้นตอนที่ 1 จาก 3'
      : filterStep === 2
        ? 'ขั้นตอนที่ 2 จาก 3'
        : 'ขั้นตอนที่ 3 จาก 3';

  const openFilterDrawer = () => {
    setFilterStep(1);
    setSemesterChosenInFilter(false);
    setFilterDrawerOpen(true);
  };

  const handleClearFilters = () => {
    setFilterDept('all');
    setFilterGrade('all');
    setSelectedClassId('');
    setSelectedTeacherId('');
    setSemesterChosenInFilter(false);
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

  return (
    <div ref={exportRef} className="flex flex-col h-full text-black font-sukhumvit">
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
                onClick={() => setFilterStep((s) => (s === 3 ? 2 : 1))}
              >
                <HiChevronLeft className="h-4 w-4" />
                ย้อนกลับ
              </Button>
            )}
            {filterStep === 3 && (
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
          {([1, 2, 3] as const).map((step) => (
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
              key="step-semester"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.15 }}
              className="grid grid-cols-1 gap-2"
              role="group"
              aria-label="เลือกภาคเรียน"
            >
              {[
                { value: 1 as const, title: 'ภาคเรียนที่ 1', description: 'เทอมต้น' },
                { value: 2 as const, title: 'ภาคเรียนที่ 2', description: 'เทอมปลาย' },
              ].map((opt) => {
                const active = semesterChosenInFilter && semester === opt.value;
                return (
                  <Button
                    key={opt.value}
                    type="button"
                    variant={active ? 'default' : 'outline'}
                    className="h-auto flex-col items-start gap-0.5 px-4 py-3.5"
                    onClick={() => {
                      setSemester(opt.value);
                      setSemesterChosenInFilter(true);
                      setFilterStep(2);
                    }}
                  >
                    <span className="text-sm font-semibold">{opt.title}</span>
                    <span className={cn('text-xs font-medium', active ? 'text-primary-foreground/80' : 'text-muted-foreground')}>
                      {opt.description}
                    </span>
                  </Button>
                );
              })}
            </motion.div>
          )}

          {filterStep === 2 && (
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
                      setFilterStep(3);
                    }}
                  >
                    {opt.label}
                  </Button>
                );
              })}
            </motion.div>
          )}

          {filterStep === 3 && viewMode === 'class' && (
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

          {filterStep === 3 && viewMode === 'teacher' && (
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

      {/* Portal: Settings + Filter */}
      {rightTarget && createPortal(
        <div className={cn('hidden md:flex', HEADER_ICON_BTN_GROUP)}>
          <ScheduleSettingsModal
            targetId={viewMode === 'teacher' ? selectedTeacherId : selectedClassId}
          />
          <button
            type="button"
            onClick={openFilterDrawer}
            className={HEADER_ICON_BTN}
            title="ตัวกรองตารางเรียน"
            aria-label="ตัวกรองตารางเรียน"
          >
            <HiOutlineFunnel size={16} />
            {hasActiveFilters && (
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-destructive" aria-hidden />
            )}
          </button>
        </div>,
        rightTarget,
      )}

      {/* Legacy inline class/room filters removed per new capsule flow */}



      {/* ── Main Layout ── */}
      <div className="flex flex-1 min-h-0">
        <div className="flex-1 min-w-0 overflow-auto px-3 md:px-6 scrollbar-hide">
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
