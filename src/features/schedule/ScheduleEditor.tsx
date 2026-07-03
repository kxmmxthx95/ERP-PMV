import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  HiChevronLeft,
  HiHome,
  HiAcademicCap,
  HiCalendar,
  HiCalendarDays,
} from 'react-icons/hi2';
import { createPortal } from 'react-dom';
import { useScheduleManager } from './hooks/useScheduleManager';
import { buildJointClassInfo } from './utils/jointClass';
import { ClassView } from './views/ClassView';
import { TeacherView } from './views/TeacherView';
import ScheduleSlotModal from './components/ScheduleSlotModal';
import ScheduleSettingsModal from './components/ScheduleSettingsModal';
import ScheduleTeacherSyncButton from './components/ScheduleTeacherSyncButton';
import type { Subject } from '@/types/curriculum';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';

type ScheduleSubjectCard = Pick<Subject, 'id' | 'code' | 'name' | 'credits' | 'hoursPerWeek' | 'subjectGroup' | 'category'> & {
  semester?: number;
  assignedTeacherId?: string;
  classId?: string;
  className?: string;
};

const VIEW_TABS = [
  { id: 'class', label: 'รายห้อง', icon: HiHome },
  { id: 'teacher', label: 'รายครู', icon: HiAcademicCap },
] as const;

const DEPT_OPTIONS = [
  { id: 'all', label: 'ทั้งหมด' },
  { id: 'early', label: 'อนุบาล' },
  { id: 'primary', label: 'ประถม' },
  { id: 'secondary', label: 'มัธยม' },
] as const;

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
    pendingTeacherSync,
    isSyncingTeachers,
    syncTeachersFromClassManagement,
  } = useScheduleManager();
  // Portals
  const [rightTarget, setRightTarget] = useState<HTMLElement | null>(null);
  const [headerFiltersPortalEl, setHeaderFiltersPortalEl] = useState<HTMLElement | null>(null);
  const [headerCenterMobilePortalEl, setHeaderCenterMobilePortalEl] = useState<HTMLElement | null>(null);
  const [mobileActionsPortalEl, setMobileActionsPortalEl] = useState<HTMLElement | null>(null);

  React.useEffect(() => {
    setRightTarget(document.getElementById('header-portal-right-actions'));
    setHeaderFiltersPortalEl(document.getElementById('header-portal-filters'));
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

  const syncDisabled = viewMode !== 'class' || !selectedClassId;
  const syncDisabledReason = viewMode !== 'class'
    ? 'ใช้ได้ในโหมดรายห้อง'
    : !selectedClassId
      ? 'เลือกห้องเรียนก่อน'
      : undefined;
  const selectedClassLabel = roomOptions.find((room) => room.id === selectedClassId)?.label;

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

  const tabLongPressRef = useRef<number | null>(null);
  const tabLongPressFiredRef = useRef(false);

  const clearTabLongPress = () => {
    if (tabLongPressRef.current) {
      window.clearTimeout(tabLongPressRef.current);
      tabLongPressRef.current = null;
    }
  };

  const mobileViewModeSwitcher = (
    <div className="grid grid-cols-2 gap-1 rounded-xl bg-black/[0.04] p-1">
      {VIEW_TABS.map((m) => {
        const Icon = m.icon;
        const active = viewMode === m.id;
        return (
          <button
            key={m.id}
            onTouchStart={() => {
              tabLongPressFiredRef.current = false;
              clearTabLongPress();
              tabLongPressRef.current = window.setTimeout(() => {
                tabLongPressFiredRef.current = true;
                setViewMode(m.id);
                setIsEditMode(true);
                if (navigator.vibrate) navigator.vibrate(40);
                clearTabLongPress();
              }, 500);
            }}
            onTouchEnd={() => {
              clearTabLongPress();
              if (!tabLongPressFiredRef.current) {
                // Normal tap: if already in edit mode → exit, else switch tab
                if (isEditMode) {
                  setIsEditMode(false);
                } else {
                  setViewMode(m.id);
                }
              }
              tabLongPressFiredRef.current = false;
            }}
            onTouchCancel={clearTabLongPress}
            onClick={() => {
              // Desktop fallback (no touch events)
              if (isEditMode) {
                setIsEditMode(false);
              } else {
                setViewMode(m.id);
              }
            }}
            className={`h-9 rounded-lg text-[11px] font-black transition-all flex items-center justify-center gap-1.5 select-none ${
              isEditMode && active
                ? 'bg-rose-600 text-white shadow-sm'
                : active
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-black/55 hover:bg-white/50'
            }`}
          >
            <Icon className="w-4 h-4" />
            <span>{m.label}</span>
          </button>
        );
      })}
    </div>
  );

  return (
    <div ref={exportRef} className="flex flex-col h-full text-black font-sukhumvit">
      {headerFiltersPortalEl && createPortal(
        <div className="hidden md:flex items-center gap-1.5 h-11 p-1 rounded-full bg-white/60 backdrop-blur-xl border border-white shadow-[0_8px_32px_rgba(0,0,0,0.04)] pointer-events-auto">
          <AnimatePresence mode="wait">
            {viewMode === 'class' && filterDept !== 'all' && filterGrade !== 'all' ? (
              <motion.div key="room-mode-desktop" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="flex items-center gap-1">
                <button onClick={() => setFilterGrade('all')} className="w-9 h-9 flex items-center justify-center rounded-full text-slate-500 hover:text-slate-800 hover:bg-black/5 transition-all">
                  <HiChevronLeft size={16} />
                </button>
                <span className="text-[10px] font-black text-slate-400 px-1">{filterGrade}</span>
                <div className="w-px h-4 bg-black/10" />
                {roomOptions.map((room) => (
                  <button key={room.id} onClick={() => setSelectedClassId(room.id)} className={`h-9 px-4 rounded-full text-[11px] font-black transition-all whitespace-nowrap ${selectedClassId === room.id ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-800 hover:bg-black/5'}`}>{room.label || room.className}</button>
                ))}
              </motion.div>
            ) : viewMode === 'class' && filterDept !== 'all' ? (
              <motion.div key="grade-mode-desktop" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="flex items-center gap-1">
                <button onClick={() => { setFilterDept('all'); setFilterGrade('all'); }} className="w-9 h-9 flex items-center justify-center rounded-full text-slate-500 hover:text-slate-800 hover:bg-black/5 transition-all">
                  <HiChevronLeft size={16} />
                </button>
                {filteredGrades.map((grade) => (
                  <button key={grade} onClick={() => setFilterGrade(grade)} className={`h-9 px-4 rounded-full text-[11px] font-black transition-all whitespace-nowrap ${filterGrade === grade ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:text-slate-800 hover:bg-black/5'}`}>{grade}</button>
                ))}
              </motion.div>
            ) : (
              <motion.div key="dept-mode-desktop" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="flex items-center gap-1">
                {DEPT_OPTIONS.filter((opt) => opt.id !== 'all').map((opt) => {
                  const active = filterDept === opt.id;
                  return (
                    <button key={opt.id} onClick={() => { setFilterDept(opt.id as 'all' | 'early' | 'primary' | 'secondary'); if (viewMode === 'class') setFilterGrade('all'); }} className={`h-9 px-6 rounded-full text-[11px] font-black transition-all whitespace-nowrap ${active ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:text-slate-800 hover:bg-black/5'}`}>{opt.label}</button>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>,
        headerFiltersPortalEl!
      )}

      {headerCenterMobilePortalEl && createPortal(
        <div className="md:hidden pointer-events-auto flex items-center gap-1.5">
          <HiCalendarDays className="w-4 h-4 text-slate-500 shrink-0" />
          <span className="text-[13px] font-black text-slate-800 tracking-tight leading-none whitespace-nowrap">
            ตารางเรียน
          </span>
          {viewMode === 'class' && selectedClassId && (
            <>
              <span className="text-slate-300 text-xs">·</span>
              <span className="text-[11px] font-black text-blue-600 whitespace-nowrap">
                {selectedClassLabel ?? ''}
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
        <ScheduleTeacherSyncButton
          pendingUpdates={pendingTeacherSync}
          isSyncing={isSyncingTeachers}
          onSync={syncTeachersFromClassManagement}
          classLabel={selectedClassLabel}
          iconOnly
          disabled={syncDisabled}
          disabledReason={syncDisabledReason}
        />,
        mobileActionsPortalEl,
      )}

      {/* Portal: View Mode Switcher */}
      {rightTarget && createPortal(
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="hidden md:flex items-center h-10 border border-black/[0.07] p-1 rounded-full bg-white/50 backdrop-blur-md gap-0.5"
        >
          {VIEW_TABS.map(m => {
            const Icon = m.icon;
            return (
              <button
                key={m.id}
                onClick={() => setViewMode(m.id)}
                className={`flex items-center justify-center h-8 w-9 rounded-full transition-all ${viewMode === m.id
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-black/35 hover:text-black/60 hover:bg-black/[0.02]'
                  }`}
                title={m.label}
              >
                <Icon className="w-4 h-4" />
              </button>
            );
          })}

          <div className="w-[1px] h-4 bg-black/[0.07] mx-1" />

          <div className="flex items-center gap-0.5">
            {[1, 2].map(s => {
              const Icon = s === 1 ? HiCalendar : HiCalendarDays;
              return (
                <button
                  key={s}
                  onClick={() => setSemester(s as 1 | 2)}
                  className={`h-8 px-2.5 rounded-full text-[10px] font-black transition-all flex items-center gap-1 ${semester === s
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-black/35 hover:bg-slate-200/50'
                    }`}
                  title={`ภาคเรียนที่ ${s}`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{s}</span>
                </button>
              );
            })}
          </div>

          <div className="w-[1px] h-4 bg-black/[0.07] mx-1" />

          <ScheduleTeacherSyncButton
            pendingUpdates={pendingTeacherSync}
            isSyncing={isSyncingTeachers}
            onSync={syncTeachersFromClassManagement}
            classLabel={selectedClassLabel}
            disabled={syncDisabled}
            disabledReason={syncDisabledReason}
          />

          <ScheduleSettingsModal 
            targetId={viewMode === 'teacher' ? selectedTeacherId : selectedClassId} 
          />
        </motion.div>,
        rightTarget!
      )}

      {/* Legacy inline class/room filters removed per new capsule flow */}



      {/* ── Main Layout ── */}
      <div className="flex flex-1 min-h-0">
        <div className="flex-1 min-w-0 overflow-auto px-3 md:px-6 scrollbar-hide">
          {/* Mobile: Class room picker (sticky below header) removed as it is handled by the capsule filter */}

          {viewMode === 'teacher' && headerTeachers.length > 0 && (
            <div className="hidden md:block mb-3 mt-1 overflow-hidden rounded-2xl border border-white/70 bg-white/80 p-2.5 shadow-[0_8px_24px_rgba(15,23,42,0.07)] backdrop-blur-xl">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[10px] font-black uppercase tracking-widest text-black/40">รายชื่อครู</p>
                <span className="rounded-full border border-black/[0.08] bg-black/[0.03] px-2 py-0.5 text-[9px] font-black text-black/45">
                  {headerTeachers.length} คน
                </span>
              </div>

              <Carousel opts={{ align: 'start', dragFree: true }} className="px-8">
                <CarouselContent className="-ml-2">
                  {headerTeachers.map((teacher) => {
                    const active = selectedTeacherId === teacher.id;
                    return (
                      <CarouselItem
                        key={teacher.id}
                        className="basis-auto pl-2"
                      >
                        <button
                          onClick={() => setSelectedTeacherId(teacher.id)}
                          className={`h-8 rounded-full px-3 text-[10px] font-black transition-all whitespace-nowrap ${
                            active
                              ? 'bg-blue-600 text-white shadow-sm'
                              : 'bg-black/[0.04] text-black/55 hover:bg-black/[0.07]'
                          }`}
                        >
                          {teacher.name}
                        </button>
                      </CarouselItem>
                    );
                  })}
                </CarouselContent>
                <CarouselPrevious className="left-1 top-1/2 z-10 h-7 w-7 -translate-y-1/2 border-black/10 bg-white/90 text-black/55 shadow-sm hover:bg-white" />
                <CarouselNext className="right-1 top-1/2 z-10 h-7 w-7 -translate-y-1/2 border-black/10 bg-white/90 text-black/55 shadow-sm hover:bg-white" />
              </Carousel>
            </div>
          )}

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
                  setSelectedClassId={setSelectedClassId}
                  filterDept={filterDept}
                  setFilterDept={setFilterDept}
                  filterGrade={filterGrade}
                  setFilterGrade={setFilterGrade}
                  filteredClasses={filteredClasses}
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
                  mobileHeaderContent={mobileViewModeSwitcher}
                  jointClassEntryIds={jointClassEntryIds}
                  jointClassPartnersByEntryId={jointClassPartnersByEntryId}
                />
              )}
              {viewMode === 'teacher' && (
                <TeacherView
                  selectedTeacherId={selectedTeacherId}
                  setSelectedTeacherId={setSelectedTeacherId}
                  filterDept={filterDept}
                  setFilterDept={setFilterDept}
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
                  mobileHeaderContent={mobileViewModeSwitcher}
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
