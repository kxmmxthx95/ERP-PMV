import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CalendarDays, LayoutGrid, User, Columns2 } from 'lucide-react';
import { useScheduleManager } from '@/hooks/useScheduleManager';
import { useTeacherManager } from '@/hooks/useTeacherManager';
import ScheduleSlotModal from './components/ScheduleSlotModal';
import { ClassView } from './views/ClassView';
import { TeacherView } from './views/TeacherView';
import { CompareView } from './views/CompareView';
import type { Department } from '@/types/curriculum';

const DEPT_OPTIONS: { id: Department | 'all'; label: string }[] = [
  { id: 'all', label: 'ทั้งหมด' },
  { id: 'early', label: 'อนุบาล' },
  { id: 'primary', label: 'ประถม' },
  { id: 'secondary', label: 'มัธยม' },
];

export default function ScheduleEditor() {
  const {
    activeYear,
    semester,
    // Filters
    filterDept,
    setFilterDept,
    filterGrade,
    setFilterGrade,
    filteredClasses,
    availableGrades,

    // Selection
    selectedClassId,
    setSelectedClassId,
    selectedTeacherId,
    setSelectedTeacherId,

    // Data
    grid,
    slotModal,
    openSlotModal,
    closeSlotModal,
    classes,
    teachers,
    availableSubjects,
    teacherLoadSummary,
    addEntry,
    updateEntry,
    deleteEntry,
    moveEntry,

    // Compare mode
    compareClassId,
    compareGrid,
    setSemester,
  } = useScheduleManager();

  // Full teacher profiles
  const teacherManager = useTeacherManager();
  const teacherSubjects = teacherManager.getTeacherSubjects(selectedTeacherId);

  // โหมดแก้ไข
  const [isEditMode, setIsEditMode] = useState(false);
  const [viewMode, setViewMode] = useState<'class' | 'teacher' | 'compare'>('class');

  // State สำหรับ modal ที่เปิดจากการ drag subject card ใน teacher panel
  const [teacherDropModal, setTeacherDropModal] = useState<{
    open: boolean;
    day: any | null;
    period: number | null;
    subjectId: string;
    teacherId: string;
  }>({ open: false, day: null, period: null, subjectId: '', teacherId: '' });

  const handleSubjectDrop = (day: any, period: number, subjectId: string, teacherId: string) => {
    setTeacherDropModal({ open: true, day, period, subjectId, teacherId });
  };

  return (
    <div className="space-y-5 text-black">
      {/* ── Header Area ── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        {/* Title Group */}
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-3"
        >
          <CalendarDays size={22} className="text-black/70" />
          <div className="flex flex-col">
            <h1 className="text-xl font-bold text-black/85 tracking-tight">ตารางสอน</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-xs text-black/40">ปีการศึกษา {activeYear}</p>
              <div className="flex items-center gap-0.5 bg-black/5 p-0.5 rounded-lg border border-black/8">
                {[1, 2].map(s => (
                  <button
                    key={s}
                    onClick={() => setSemester(s as 1 | 2)}
                    className={`h-4 px-2 rounded-md text-[9px] font-black transition-all ${semester === s ? 'bg-amber-400 text-white shadow-sm' : 'text-black/35 hover:bg-black/5'}`}
                  >
                    T{s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Top Right Controls */}
        <motion.div
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex flex-wrap items-center justify-end gap-2 w-full lg:w-auto"
        >

          {/* ── Cascading Filter Bar (Hide in Teacher View) ── */}
          <AnimatePresence>
            {viewMode !== 'teacher' && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="flex items-center h-9 bg-black/5 border border-black/5 rounded-xl p-1 gap-0.5 max-w-full overflow-x-auto scrollbar-hide"
              >
                {/* Dept pills */}
                {DEPT_OPTIONS.map(d => (
                  <button
                    key={d.id}
                    onClick={() => { setFilterDept(d.id as any); setFilterGrade('all'); }}
                    className={`h-7 px-3 rounded-lg text-[10px] font-bold transition-all whitespace-nowrap ${
                      filterDept === d.id
                        ? 'bg-[#1e1e1e] text-white shadow-md'
                        : 'text-black/40 hover:text-black/70 hover:bg-black/5'
                    }`}
                  >
                    {d.label}
                  </button>
                ))}

                {/* Grade pills — แสดงเมื่อเลือก dept แล้ว */}
                <AnimatePresence>
                  {filterDept !== 'all' && (
                    <motion.div
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: 'auto' }}
                      exit={{ opacity: 0, width: 0 }}
                      className="flex items-center overflow-hidden gap-0.5"
                    >
                      <div className="w-px h-4 bg-black/10 mx-0.5 shrink-0" />
                      {availableGrades.map(g => (
                        <button
                          key={g}
                          onClick={() => setFilterGrade(g)}
                          className={`h-7 px-2.5 rounded-lg text-[10px] font-bold transition-all whitespace-nowrap ${
                            filterGrade === g
                              ? 'bg-[#1e1e1e] text-white shadow-md'
                              : 'text-black/40 hover:text-black/70 hover:bg-black/5'
                          }`}
                        >
                          ชั้น {g}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Class pills — แสดงเมื่อเลือก grade แล้ว */}
                <AnimatePresence>
                  {filterGrade !== 'all' && (
                    <motion.div
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: 'auto' }}
                      exit={{ opacity: 0, width: 0 }}
                      className="flex items-center overflow-hidden gap-0.5"
                    >
                      <div className="w-px h-4 bg-black/10 mx-0.5 shrink-0" />
                      {filteredClasses.map(c => (
                        <button
                          key={c.id}
                          onClick={() => setSelectedClassId(c.id)}
                          className={`h-7 px-2.5 rounded-lg text-[10px] font-bold transition-all whitespace-nowrap ${
                            selectedClassId === c.id
                              ? 'bg-[#1e1e1e] text-white shadow-md'
                              : 'text-black/40 hover:text-black/70 hover:bg-black/5'
                          }`}
                        >
                          ห้อง {c.label.split('/')[1] || c.label}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── View mode tabs ── */}
          <div className="flex items-center h-9 bg-black/5 border border-black/5 p-1 rounded-xl gap-0.5 max-w-full overflow-x-auto scrollbar-hide">
            {[
              { id: 'class', icon: LayoutGrid, label: 'รายห้อง' },
              { id: 'teacher', icon: User, label: 'รายครู' },
              { id: 'compare', icon: Columns2, label: 'เปรียบเทียบ' },
            ].map(m => (
              <button
                key={m.id}
                onClick={() => setViewMode(m.id as any)}
                className={`flex items-center gap-1.5 h-7 px-3 rounded-lg text-[10px] font-bold transition-all whitespace-nowrap ${
                  viewMode === m.id
                    ? 'bg-[#1e1e1e] text-white shadow-md'
                    : 'text-black/40 hover:text-black/65 hover:bg-black/5'
                }`}
              >
                <m.icon size={12} />
                <span className="hidden sm:inline">{m.label}</span>
              </button>
            ))}
          </div>

          {/* ── Edit toggle ── */}
          <button
            type="button"
            role="switch"
            aria-checked={isEditMode}
            onClick={() => setIsEditMode(!isEditMode)}
            className={`flex items-center gap-2 h-9 px-3 rounded-xl border font-bold text-[10px] transition-all ${
              isEditMode
                ? 'bg-amber-400 border-amber-400 text-white shadow-sm shadow-amber-200'
                : 'bg-black/[0.04] border-black/[0.07] text-black/40 hover:text-black/55'
            }`}
          >
            <span className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors ${isEditMode ? 'bg-white/30' : 'bg-black/10'}`}>
              <span className={`block h-3 w-3 rounded-full bg-white shadow transition-transform ${isEditMode ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
            </span>
            แก้ไข
          </button>

        </motion.div>
      </div>

      {/* ── Main View Area ── */}
      <motion.div
        key={viewMode}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="min-h-[600px]"
      >
        {viewMode === 'compare' && (
          <CompareView
            grid={grid}
            selectedClassId={selectedClassId}
            isEditMode={isEditMode}
            openSlotModal={openSlotModal}
            deleteEntry={deleteEntry}
            moveEntry={moveEntry}
            compareClassId={compareClassId}
            compareGrid={compareGrid}
          />
        )}
        {viewMode === 'class' && (
          <ClassView
            grid={grid}
            selectedClassId={selectedClassId}
            isEditMode={isEditMode}
            openSlotModal={openSlotModal}
            deleteEntry={deleteEntry}
            moveEntry={moveEntry}
          />
        )}
        {viewMode === 'teacher' && (
          <TeacherView
            teachers={teacherManager.teachers}
            filterDept={filterDept}
            setFilterDept={setFilterDept}
            selectedTeacherId={selectedTeacherId}
            setSelectedTeacherId={setSelectedTeacherId}
            teacherLoadSummary={teacherLoadSummary}
            teacherSubjects={teacherSubjects}
            isEditMode={isEditMode}
            grid={grid}
            openSlotModal={openSlotModal}
            deleteEntry={deleteEntry}
            moveEntry={moveEntry}
            handleSubjectDrop={handleSubjectDrop}
            getTeacherSubjects={teacherManager.getTeacherSubjects}
          />
        )}
      </motion.div>

      {/* ── Legend ── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.12 }}
        className="flex flex-wrap items-center gap-4 px-1"
      >
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-black/[0.04] border border-black/10" />
          <span className="text-[10px] text-black/35">ว่าง (ดับเบิลคลิกเพื่อเพิ่ม)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm" style={{ background: 'rgba(59,130,246,0.20)', border: '1px solid rgba(59,130,246,0.40)' }} />
          <span className="text-[10px] text-black/35">มีวิชา (ดับเบิลคลิก / ลากวาง)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm flex items-center justify-center" style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.30)' }}>
            <span style={{ fontSize: 6, color: '#059669' }}>☕</span>
          </div>
          <span className="text-[10px] text-black/35">พักกลางวัน</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm flex items-center justify-center" style={{ background: 'rgba(234,179,8,0.15)', border: '1px solid rgba(234,179,8,0.30)' }}>
            <span style={{ fontSize: 6, color: '#d97706' }}>⏱</span>
          </div>
          <span className="text-[10px] text-black/35">พักเบรก</span>
        </div>
      </motion.div>

      {/* ── Slot Modal ── */}
      <ScheduleSlotModal
        open={slotModal.open}
        day={slotModal.day}
        period={slotModal.period}
        editingEntry={slotModal.editingEntry}
        classId={selectedClassId}
        year={activeYear}
        semester={semester}
        subjects={availableSubjects}
        teachers={teachers}
        classes={classes}
        onClose={closeSlotModal}
        onSave={addEntry}
        onUpdate={updateEntry}
        onDelete={deleteEntry}
      />

      <ScheduleSlotModal
        open={teacherDropModal.open}
        day={teacherDropModal.day}
        period={teacherDropModal.period}
        editingEntry={null}
        classId={selectedClassId}
        year={activeYear}
        semester={semester}
        subjects={availableSubjects}
        teachers={teachers}
        classes={classes}
        onClose={() => setTeacherDropModal(prev => ({ ...prev, open: false }))}
        onSave={addEntry}
        onUpdate={updateEntry}
        onDelete={deleteEntry}
        prefilledSubjectId={teacherDropModal.subjectId}
        prefilledTeacherId={teacherDropModal.teacherId}
      />
    </div>
  );
}
