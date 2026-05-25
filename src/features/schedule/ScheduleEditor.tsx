import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  Layout,
  RotateCcw,
} from 'lucide-react';
import { createPortal } from 'react-dom';
import { useScheduleManager } from './hooks/useScheduleManager';
import { ClassView } from './views/ClassView';
import { TeacherView } from './views/TeacherView';
import ScheduleSlotModal from './components/ScheduleSlotModal';
import ScheduleSettingsModal from './components/ScheduleSettingsModal';
import type { Subject } from '@/types/curriculum';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type ScheduleSubjectCard = Pick<Subject, 'id' | 'code' | 'name' | 'credits' | 'hoursPerWeek' | 'subjectGroup' | 'category'> & {
  semester?: number;
  assignedTeacherId?: string;
  classId?: string;
  className?: string;
};

const VIEW_TABS = [
  { id: 'class', label: 'รายห้อง', icon: Layout },
  { id: 'teacher', label: 'รายครู', icon: Users },
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
    exportRef
  } = useScheduleManager();
  // Portals
  const [filtersTarget, setFiltersTarget] = useState<HTMLElement | null>(null);
  const [rightTarget, setRightTarget] = useState<HTMLElement | null>(null);

  React.useEffect(() => {
    setFiltersTarget(
      document.getElementById('header-portal-center')
      || document.getElementById('header-portal-filters')
    );
    setRightTarget(document.getElementById('header-portal-right-actions'));
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
  
  const handleDeleteEntry = async (id: string) => {
    const entry = allEntries.find(e => e.id === id);
    if (!entry) return;

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
          classId: undefined // delete all classes in this slot for this teacher
        });
        return;
      }
    }

    // Regular single deletion
    if (window.confirm('ต้องการลบคาบเรียนนี้ใช่หรือไม่?')) {
      await deleteEntry(id);
    }
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

  const classSearchReady = filterDept !== 'all' && filterGrade !== 'all' && Boolean(selectedClassId);
  const teacherSearchReady = Boolean(selectedTeacherId);

  return (
    <div ref={exportRef} className="flex flex-col h-full text-black font-sukhumvit">

      {/* Portal: Mobile View Mode Switcher (Icons only) */}
      {rightTarget && createPortal(
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex md:hidden items-center h-9 border border-black/[0.07] p-0.5 rounded-full bg-white shadow-sm"
        >
          {VIEW_TABS.map(m => {
            const Icon = m.icon;
            const active = viewMode === m.id;
            return (
              <button
                key={m.id}
                onClick={() => setViewMode(m.id)}
                className={`h-8 w-8 flex items-center justify-center rounded-full transition-all ${
                  active
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-black/35 hover:text-black/60'
                }`}
                title={m.label}
              >
                <Icon size={14} />
              </button>
            );
          })}
        </motion.div>,
        rightTarget!
      )}

      {/* Portal: View Mode Switcher */}
      {rightTarget && createPortal(
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="hidden md:flex items-center h-9 border border-black/[0.07] p-1 rounded-full bg-white/50 backdrop-blur-md"
        >
          {VIEW_TABS.map(m => (
            <button
              key={m.id}
              onClick={() => setViewMode(m.id)}
              className={`flex items-center justify-center h-full px-5 rounded-full text-[10.5px] font-black transition-all whitespace-nowrap ${viewMode === m.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-black/35 hover:text-black/60 hover:bg-black/[0.02]'
                }`}
            >
              <span>{m.label}</span>
            </button>
          ))}

          <div className="w-[1px] h-4 bg-black/[0.07] mx-1" />

          <div className="flex items-center gap-0.5">
            {[1, 2].map(s => (
              <button
                key={s}
                onClick={() => setSemester(s as 1 | 2)}
                className={`h-7 px-3 rounded-full text-[10px] font-black transition-all ${semester === s
                    ? 'bg-blue-600 text-white'
                    : 'text-black/35 hover:bg-black/5'
                  }`}
              >
                ภาค {s}
              </button>
            ))}
          </div>

          <div className="w-[1px] h-4 bg-black/[0.07] mx-1" />

          <ScheduleSettingsModal 
            targetId={viewMode === 'teacher' ? selectedTeacherId : selectedClassId} 
          />
        </motion.div>,
        rightTarget!
      )}

      {/* Portal: Filters (same style as Attendance) */}
      {filtersTarget && (viewMode === 'class' || viewMode === 'teacher') && createPortal(
        <div className="hidden md:flex w-full items-center justify-center gap-2.5">
            <Select
              value={filterDept}
              onValueChange={(val) => {
                setFilterDept(val as 'all' | 'early' | 'primary' | 'secondary');
                if (viewMode === 'class') setFilterGrade('all');
              }}
            >
              <SelectTrigger className="h-9 min-w-[110px] rounded-full border border-black/[0.05] bg-white/40 px-3 text-[10px] font-black backdrop-blur-md shadow-sm transition-all hover:bg-white/60">
                <div className="flex items-center gap-1.5">
                  <span className="text-black/30 uppercase tracking-tighter">แผนก</span>
                  <SelectValue placeholder="แผนก" />
                </div>
              </SelectTrigger>
              <SelectContent>
                {DEPT_OPTIONS.map((opt) => (
                  <SelectItem key={opt.id} value={opt.id}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {viewMode === 'class' && filterDept !== 'all' && (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
                <Select value={filterGrade === 'all' ? undefined : filterGrade} onValueChange={setFilterGrade}>
                  <SelectTrigger className="h-9 min-w-[90px] rounded-full border border-black/[0.05] bg-white/40 px-3 text-[10px] font-black backdrop-blur-md shadow-sm transition-all hover:bg-white/60">
                    <div className="flex items-center gap-1.5">
                      <span className="text-black/30 uppercase tracking-tighter">ชั้น</span>
                      <SelectValue placeholder="ชั้น" />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    {filteredGrades.map((grade) => (
                      <SelectItem key={grade} value={grade}>{grade}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </motion.div>
            )}

            {viewMode === 'class' && filterDept !== 'all' && filterGrade !== 'all' && (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
                <Select value={selectedClassId || undefined} onValueChange={setSelectedClassId}>
                  <SelectTrigger className="h-9 min-w-[110px] rounded-full border border-black/[0.05] bg-white/40 px-3 text-[10px] font-black backdrop-blur-md shadow-sm transition-all hover:bg-white/60">
                    <div className="flex items-center gap-1.5">
                      <span className="text-black/30 uppercase tracking-tighter">ห้อง</span>
                      <SelectValue placeholder="ห้อง" />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    {roomOptions.map((room) => (
                      <SelectItem key={room.id} value={room.id}>
                        {room.className || room.roomNumber}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </motion.div>
            )}


        </div>,
        filtersTarget,
      )}



      {/* ── Main Layout ── */}
      <div className="flex flex-1 min-h-0">
        <div className="flex-1 min-w-0 overflow-auto px-3 md:px-6 scrollbar-hide">
          <div className="md:hidden sticky top-0 z-20 -mx-3 px-3 py-2 bg-white/75 backdrop-blur-md">
            <div className="rounded-2xl border border-black/[0.06] bg-white/85 p-2.5 shadow-sm">
              <div className="mb-2 flex w-full gap-1">
                {DEPT_OPTIONS.map((opt) => {
                  const active = filterDept === opt.id;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => {
                        setFilterDept(opt.id as 'all' | 'early' | 'primary' | 'secondary');
                        if (viewMode === 'class') setFilterGrade('all');
                      }}
                      className={`h-8 flex-1 rounded-lg px-3 text-[10px] font-black transition-all ${
                        active
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'bg-black/[0.04] text-black/55'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>

              {viewMode === 'class' && (
                <div className="flex gap-2 w-full">
                  {filterDept !== 'all' && (
                    <div className="flex-1 min-w-0">
                      <Select value={filterGrade === 'all' ? undefined : filterGrade} onValueChange={setFilterGrade}>
                        <SelectTrigger className="h-10 w-full rounded-xl border-black/[0.07] bg-white text-xs font-bold text-black/70">
                          <SelectValue placeholder="เลือกระดับชั้น" />
                        </SelectTrigger>
                        <SelectContent>
                          {filteredGrades.map((grade) => (
                            <SelectItem key={grade} value={grade}>{grade}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {filterDept !== 'all' && filterGrade !== 'all' && (
                    <div className="flex-1 min-w-0">
                      <Select value={selectedClassId || undefined} onValueChange={setSelectedClassId}>
                        <SelectTrigger className="h-10 w-full rounded-xl border-black/[0.07] bg-white text-xs font-bold text-black/70">
                          <SelectValue placeholder="เลือกห้องเรียน" />
                        </SelectTrigger>
                        <SelectContent>
                          {roomOptions.map((room) => (
                            <SelectItem key={room.id} value={room.id}>
                              {room.className || room.roomNumber}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {filterDept !== 'all' && (
                    <button
                      onClick={() => {
                        setFilterDept('all');
                        setFilterGrade('all');
                        setSelectedClassId('');
                      }}
                      className="h-10 w-10 flex items-center justify-center rounded-xl border border-red-100 bg-red-50 text-red-600 transition-all hover:bg-red-100 active:scale-95 shrink-0"
                    >
                      <RotateCcw size={16} />
                    </button>
                  )}
                </div>
              )}

              {viewMode === 'teacher' && (
                <div className="flex gap-2 w-full">
                  <div className="flex-1 min-w-0">
                    <Select value={selectedTeacherId || undefined} onValueChange={setSelectedTeacherId}>
                      <SelectTrigger className="h-10 w-full rounded-xl border-black/[0.07] bg-white text-xs font-bold text-black/70">
                        <SelectValue placeholder="เลือกครูผู้สอน" />
                      </SelectTrigger>
                      <SelectContent>
                        {headerTeachers.map((teacher) => (
                          <SelectItem key={teacher.id} value={teacher.id}>
                            {teacher.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {selectedTeacherId && (
                    <button
                      onClick={() => {
                        setSelectedTeacherId('');
                      }}
                      className="h-10 w-10 flex items-center justify-center rounded-xl border border-red-100 bg-red-50 text-red-600 transition-all hover:bg-red-100 active:scale-95 shrink-0"
                    >
                      <RotateCcw size={16} />
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {viewMode === 'teacher' && filterDept !== 'all' && headerTeachers.length > 0 && (
            <div className="hidden md:block mb-3 mt-1 rounded-2xl border border-black/[0.06] bg-white/80 p-2.5 shadow-sm backdrop-blur-md">
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
                <CarouselPrevious className="-left-0.5 top-1/2 h-7 w-7 -translate-y-1/2 border-black/10 bg-white/90 text-black/55 hover:bg-white" />
                <CarouselNext className="-right-0.5 top-1/2 h-7 w-7 -translate-y-1/2 border-black/10 bg-white/90 text-black/55 hover:bg-white" />
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
                classSearchReady ? (
                  <ClassView
                    grid={grid}
                    selectedClassId={selectedClassId}
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
                  />
                ) : (
                  <div className="flex h-[55vh] items-center justify-center rounded-2xl border border-dashed border-black/10 bg-white/40 text-center">
                    <div className="px-6">
                      <p className="text-[13px] font-black text-black/70">ยังไม่แสดงตาราง</p>
                      <p className="mt-1 text-[11px] font-medium text-black/45">
                        กรุณาเลือกแผนก ชั้น และห้องเรียนเพื่อค้นหา
                      </p>
                    </div>
                  </div>
                )
              )}
              {viewMode === 'teacher' && (
                teacherSearchReady ? (
                  <TeacherView
                    selectedTeacherId={selectedTeacherId}
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
                  />
                ) : (
                  <div className="flex h-[55vh] items-center justify-center rounded-2xl border border-dashed border-black/10 bg-white/40 text-center">
                    <div className="px-6">
                      <p className="text-[13px] font-black text-black/70">ยังไม่แสดงตาราง</p>
                      <p className="mt-1 text-[11px] font-medium text-black/45">
                        {filterDept === 'all'
                          ? 'กรุณาเลือกแผนกเพื่อค้นหาครู'
                          : 'กรุณาเลือกครูเพื่อค้นหาตารางสอน'}
                      </p>
                    </div>
                  </div>
                )
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
