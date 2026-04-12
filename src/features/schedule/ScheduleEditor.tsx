import { motion } from 'framer-motion';
import { CalendarDays, LayoutGrid, User } from 'lucide-react';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useScheduleManager } from '@/hooks/useScheduleManager';
import ScheduleGrid from './components/ScheduleGrid';
import ScheduleSlotModal from './components/ScheduleSlotModal';
import ScheduleSettingsModal from './components/ScheduleSettingsModal';

const glassCard: React.CSSProperties = {
  background: 'rgba(255,255,255,0.70)',
  backdropFilter: 'blur(24px) saturate(150%)',
  WebkitBackdropFilter: 'blur(24px) saturate(150%)',
  border: '1px solid rgba(255,255,255,0.90)',
  boxShadow: '0 8px 32px rgba(0,0,0,0.06)',
};

export default function ScheduleEditor() {
  const {
    activeYear,
    semester,
    viewMode,
    setViewMode,

    // Filters
    filterDept,
    setFilterDept,
    filterGrade,
    setFilterGrade,
    filteredClasses,
    availableGrades,
    deptSummary,

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
  } = useScheduleManager();

  return (
    <div className="space-y-4 text-black">
      {/* ── Header & Actions ── */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        {/* Header Info */}
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-2.5">
            <CalendarDays size={22} className="text-black/70" />
            <h1 className="text-xl font-bold text-black/85 tracking-tight">ตารางสอน</h1>
          </div>
          <p className="text-xs text-black/40 mt-0.5">
            ปีการศึกษา {activeYear} · ภาคเรียนที่ {semester}
          </p>
        </motion.div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex flex-col sm:flex-row items-center gap-1 w-full md:w-auto rounded-xl shadow-sm"
          style={{
            background: 'rgba(255, 255, 255, 0.4)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid rgba(255, 255, 255, 0.6)',
            padding: '0.25rem',
          }}
        >
          {/* View mode toggle */}
          <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-black/5 shrink-0 w-full sm:w-auto">
            {([
              { mode: 'class',   icon: LayoutGrid, label: 'รายห้อง' },
              { mode: 'teacher', icon: User,       label: 'รายครู' },
            ] as const).map(({ mode, icon: Icon, label }) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className="flex items-center justify-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all duration-150 flex-1 sm:flex-none"
                style={{
                  background: viewMode === mode ? '#1e1e1e' : 'transparent',
                  color: viewMode === mode ? '#fff' : 'rgba(0,0,0,0.50)',
                  boxShadow: viewMode === mode ? '0 2px 8px rgba(0,0,0,0.20)' : 'none',
                }}
              >
                <Icon size={12} />
                {label}
              </button>
            ))}
          </div>

          <div className="hidden sm:block w-px h-5 bg-black/10 mx-0.5" />

          {viewMode === 'class' ? (
            <div className="flex flex-col sm:flex-row items-center gap-1 w-full sm:w-auto">
              <Select value={filterDept} onValueChange={(val) => { setFilterDept(val as any); setFilterGrade('all'); }}>
                <SelectTrigger className="w-full sm:w-28 px-2 py-1 bg-transparent hover:bg-black/5 border-none outline-none text-[11px] text-black/70 shadow-none focus:ring-0 h-auto rounded-md transition-colors flex-shrink-0">
                  <SelectValue placeholder="เลือกแผนก" />
                </SelectTrigger>
                <SelectContent className="bg-white/90 backdrop-blur-xl border-white/50 rounded-xl">
                  <SelectItem value="all" className="text-[11px] rounded-lg">เลือกแผนก</SelectItem>
                  {deptSummary.filter(d => d.classCount > 0).map(({ dept, cfg }) => (
                    <SelectItem key={dept} value={dept} className="text-[11px] rounded-lg">{cfg.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterGrade} onValueChange={setFilterGrade} disabled={filterDept === 'all' || availableGrades.length <= 1}>
                <SelectTrigger className="w-full sm:w-28 px-2 py-1 bg-transparent hover:bg-black/5 border-none outline-none text-[11px] text-black/70 shadow-none focus:ring-0 h-auto rounded-md transition-colors disabled:opacity-50 flex-shrink-0">
                  <SelectValue placeholder="เลือกระดับชั้น" />
                </SelectTrigger>
                <SelectContent className="bg-white/90 backdrop-blur-xl border-white/50 rounded-xl">
                  <SelectItem value="all" className="text-[11px] rounded-lg">เลือกระดับชั้น</SelectItem>
                  {availableGrades.map(g => (
                    <SelectItem key={g} value={g} className="text-[11px] rounded-lg">{g}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                <SelectTrigger className="w-full sm:w-32 px-2 py-1 bg-transparent hover:bg-black/5 border-none outline-none text-[11px] font-bold text-black/80 shadow-none focus:ring-0 h-auto rounded-md transition-colors flex-shrink-0">
                  <SelectValue placeholder="เลือกห้องเรียน" />
                </SelectTrigger>
                <SelectContent className="bg-white/90 backdrop-blur-xl border-white/50 rounded-xl">
                  {filteredClasses.map(c => (
                    <SelectItem key={c.id} value={c.id} className="text-[11px] rounded-lg font-bold">
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="flex items-center gap-1 w-full sm:w-auto">
              <Select value={selectedTeacherId} onValueChange={setSelectedTeacherId}>
                <SelectTrigger className="w-full sm:w-52 px-3 py-1 bg-transparent hover:bg-black/5 border-none outline-none text-[11px] font-bold text-black/80 shadow-none focus:ring-0 h-auto rounded-md transition-colors">
                  <SelectValue placeholder="เลือกครูผู้สอน..." />
                </SelectTrigger>
                <SelectContent className="bg-white/90 backdrop-blur-xl border-white/50 rounded-xl">
                  {teachers.map(t => (
                    <SelectItem key={t.id} value={t.id} className="text-[11px] rounded-lg font-bold">
                      {t.name}
                      {teacherLoadSummary[t.id] != null && (
                        <span className="ml-1.5 text-black/40 font-normal">({teacherLoadSummary[t.id]} คาบ)</span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="hidden sm:block w-px h-5 bg-black/10 mx-0.5" />
          
          <ScheduleSettingsModal />
        </motion.div>
      </div>

      {/* ── Schedule Grid ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
      >
        <ScheduleGrid
          grid={grid}
          viewMode={viewMode}
          onSlotClick={(day, period, entry) => openSlotModal(day, period, entry)}
          onDeleteEntry={deleteEntry}
        />
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
          <span className="text-[10px] text-black/35">ว่าง (คลิกเพื่อเพิ่ม)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm" style={{ background: 'rgba(59,130,246,0.20)', border: '1px solid rgba(59,130,246,0.40)' }} />
          <span className="text-[10px] text-black/35">มีวิชา (คลิกเพื่อแก้ไข)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-black/[0.03] border border-dashed border-black/15" />
          <span className="text-[10px] text-black/35">คาบพัก</span>
        </div>
      </motion.div>

      {/* ── Stat summary ── */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.10 }}
        className="grid grid-cols-2 sm:grid-cols-4 gap-3"
      >
        <StatCard
          label={viewMode === 'class' ? 'คาบที่จัดแล้ว' : 'จำนวนคาบสอน'}
          value={Object.values(grid).flatMap(d => Object.values(d)).filter(Boolean).length}
          unit="คาบ"
        />
        <StatCard
          label="จำนวนครูในตาราง"
          value={new Set(Object.values(grid).flatMap(d => Object.values(d)).filter(Boolean).map((e: any) => e.teacherId)).size}
          unit="คน"
        />
        <StatCard
          label="วิชาที่ใช้"
          value={new Set(Object.values(grid).flatMap(d => Object.values(d)).filter(Boolean).map((e: any) => e.subjectId)).size}
          unit="วิชา"
        />
        <StatCard
          label="คาบว่าง"
          value={Object.values(grid).flatMap(d => Object.values(d)).filter(v => !v).length - 5}
          unit="คาบ"
        />
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
    </div>
  );
}

// ── Stat Card ──────────────────────────────────────────────────────────────────
function StatCard({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <div className="rounded-2xl px-4 py-3 flex items-center gap-3" style={glassCard}>
      <div className="min-w-0">
        <p className="text-xs text-black/40 truncate">{label}</p>
        <p className="text-lg font-bold text-black/75 leading-tight">
          {value} <span className="text-[11px] font-normal text-black/30">{unit}</span>
        </p>
      </div>
    </div>
  );
}
