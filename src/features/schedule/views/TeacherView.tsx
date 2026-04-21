import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, GripVertical } from 'lucide-react';
import ScheduleGrid from '../components/ScheduleGrid';
import type { SchoolDay } from '@/types/schedule';
import type { TeacherProfile } from '@/types/teacher';
import type { Department, Subject } from '@/types/curriculum';
import { subjectColor } from '@/features/schedule/constants/colors';

interface TeacherViewProps {
  teachers: TeacherProfile[];
  filterDept: Department | 'all';
  setFilterDept: (dept: Department | 'all') => void;
  selectedTeacherId: string;
  setSelectedTeacherId: (id: string) => void;
  teacherLoadSummary: Record<string, number>;
  teacherSubjects: Subject[];
  isEditMode: boolean;
  grid: any;
  openSlotModal: (day: SchoolDay, period: number, entry?: any) => void;
  deleteEntry: (id: string) => Promise<void>;
  moveEntry: (id: string, day: SchoolDay, period: number) => Promise<any>;
  handleSubjectDrop: (day: SchoolDay, period: number, subjectId: string, teacherId: string) => void;
  getTeacherSubjects: (id: string) => Subject[];
}

export function TeacherView({
  teachers,
  filterDept,
  setFilterDept,
  selectedTeacherId,
  setSelectedTeacherId,
  teacherLoadSummary,
  teacherSubjects,
  isEditMode,
  grid,
  openSlotModal,
  deleteEntry,
  moveEntry,
  handleSubjectDrop,
  getTeacherSubjects,
}: TeacherViewProps) {
  const [showTeacherDetailsId, setShowTeacherDetailsId] = useState<string | null>(null);
  const detailedTeacher = teachers.find(t => t.id === showTeacherDetailsId);
  const detailedTeacherSubjects = detailedTeacher ? getTeacherSubjects(detailedTeacher.id) : [];

  return (
    <div className="flex gap-4 items-start">
      <TeacherSidebar
        teachers={teachers}
        filterDept={filterDept}
        setFilterDept={setFilterDept}
        selectedTeacherId={selectedTeacherId}
        setSelectedTeacherId={setSelectedTeacherId}
        teacherLoadSummary={teacherLoadSummary}
        subjects={showTeacherDetailsId ? detailedTeacherSubjects : teacherSubjects}
        onTeacherDoubleClick={(id) => setShowTeacherDetailsId(id)}
        detailedTeacher={detailedTeacher}
        onBack={() => setShowTeacherDetailsId(null)}
      />
      <div className="flex-1 min-w-0">
        <ScheduleGrid
          grid={grid}
          viewMode="teacher"
          readOnly={!isEditMode}
          onSlotClick={(day, period, entry) => isEditMode && openSlotModal(day, period, entry)}
          onDeleteEntry={async (id) => await deleteEntry(id)}
          onMoveEntry={async (id, day, period) => {
            const res = await moveEntry(id, day, period);
            if (res.hasConflict) alert('ไม่สามารถย้ายได้: ' + res.conflicts[0].message);
          }}
          onDropSubject={handleSubjectDrop}
        />
      </div>
    </div>
  );
}

// ── Teacher Side Panel ──────────────────────────────────────────────────────────

function getPosStyle(pos: string) {
  if (!pos) return { bg: 'bg-black/5', text: 'text-black/40' };
  const p = pos.toLowerCase();
  if (p.includes('ผู้ช่วย')) return { bg: 'bg-emerald-100', text: 'text-emerald-700' };
  if (p.includes('ชำนาญการ')) return { bg: 'bg-violet-100', text: 'text-violet-700' };
  if (p.includes('หัวหน้า')) return { bg: 'bg-amber-100', text: 'text-amber-700' };
  if (p.includes('อัตราจ้าง')) return { bg: 'bg-slate-100', text: 'text-slate-600' };
  return { bg: 'bg-blue-100', text: 'text-blue-700' };
}

const DEPT_TABS = [
  { id: 'all', label: 'ทั้งหมด' },
  { id: 'early', label: 'อนุบาล' },
  { id: 'primary', label: 'ประถม' },
  { id: 'secondary', label: 'มัธยม' },
] as const;

function TeacherSidebar({
  teachers,
  filterDept,
  setFilterDept,
  selectedTeacherId,
  setSelectedTeacherId,
  teacherLoadSummary,
  subjects,
  onTeacherDoubleClick,
  detailedTeacher,
  onBack,
}: {
  teachers: TeacherProfile[];
  filterDept: Department | 'all';
  setFilterDept: (dept: Department | 'all') => void;
  selectedTeacherId: string;
  setSelectedTeacherId: (id: string) => void;
  teacherLoadSummary: Record<string, number>;
  subjects: Subject[];
  onTeacherDoubleClick: (id: string) => void;
  detailedTeacher: TeacherProfile | undefined;
  onBack: () => void;
}) {
  const filteredTeachers = teachers.filter(t => filterDept === 'all' || t.department === filterDept);

  return (
    <div
      className="w-64 lg:w-72 shrink-0 h-[calc(100vh-160px)] lg:h-[calc(100vh-140px)] sticky top-24 rounded-2xl overflow-hidden"
      style={{
        background: 'rgba(255,255,255,0.72)',
        backdropFilter: 'blur(24px) saturate(150%)',
        border: '1px solid rgba(255,255,255,0.90)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.06)',
      }}
    >
      <AnimatePresence mode="wait">
        {!detailedTeacher ? (
          /* ── View 1: Teacher List ── */
          <motion.div
            key="list-view"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            className="p-4 space-y-3 flex flex-col h-full"
          >
            {/* Dept filter tabs */}
            <div className="flex gap-0.5 bg-black/5 p-0.5 rounded-xl border border-black/5">
              {DEPT_TABS.map(d => (
                <button
                  key={d.id}
                  onClick={() => setFilterDept(d.id as any)}
                  className={`flex-1 h-7 rounded-lg text-[9px] font-bold transition-all ${
                    filterDept === d.id
                      ? 'bg-[#1e1e1e] text-white shadow-md'
                      : 'text-black/40 hover:text-black/65'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>

            {/* Teacher list */}
            <div className="flex-1 overflow-y-auto scrollbar-hide -mx-1 px-1">
              <div className="space-y-1 pb-4">
                {filteredTeachers.map(t => {
                  const active = selectedTeacherId === t.id;
                  const load = teacherLoadSummary[t.id] ?? 0;
                  const posStyle = getPosStyle(t.position || '');

                  return (
                    <button
                      key={t.id}
                      onClick={() => setSelectedTeacherId(t.id)}
                      onDoubleClick={() => onTeacherDoubleClick(t.id)}
                      title="คลิกเพื่อดูตาราง · ดับเบิลคลิกเพื่อดูวิชา"
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl border transition-all text-left ${
                        active
                          ? 'bg-blue-500 border-blue-500 text-white shadow-md shadow-blue-500/20'
                          : 'bg-white/60 border-black/8 text-black/70 hover:bg-white hover:border-black/12'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-bold truncate leading-tight">{t.name}</p>
                        {load > 0 && (
                          <p className={`text-[9px] mt-0.5 ${active ? 'text-white/60' : 'text-black/35'}`}>
                            {load} คาบ/สัปดาห์
                          </p>
                        )}
                      </div>
                      {t.position && (
                        <span className={`shrink-0 ml-2 px-1.5 py-0.5 rounded-md text-[7px] font-bold uppercase tracking-tighter transition-colors ${
                          active ? 'bg-white/20 text-white' : `${posStyle.bg} ${posStyle.text}`
                        }`}>
                          {t.position}
                        </span>
                      )}
                    </button>
                  );
                })}
                {filteredTeachers.length === 0 && (
                  <div className="py-16 text-center">
                    <p className="text-[10px] text-black/25 italic">ไม่พบรายชื่อคุณครู</p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        ) : (
          /* ── View 2: Teacher Detail (Subject drag list) ── */
          <motion.div
            key="detail-view"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            className="p-4 space-y-3 flex flex-col h-full"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-black/[0.06] pb-3">
              <button
                onClick={onBack}
                className="flex items-center gap-1.5 text-[10px] font-bold text-black/40 hover:text-black/65 transition-colors"
              >
                <ChevronLeft size={13} /> กลับ
              </button>

              <div className="flex items-center gap-2">
                <div className="text-right">
                  <p className="text-[10px] font-bold text-black/70 leading-none">{detailedTeacher.name}</p>
                  {detailedTeacher.position && (() => {
                    const posStyle = getPosStyle(detailedTeacher.position);
                    return (
                      <span className={`inline-block mt-0.5 px-1.5 py-0.5 rounded-md text-[7px] font-bold uppercase tracking-tighter ${posStyle.bg} ${posStyle.text}`}>
                        {detailedTeacher.position}
                      </span>
                    );
                  })()}
                </div>
                <div className="w-8 h-8 rounded-xl bg-blue-500 flex items-center justify-center text-white text-[12px] font-black shadow-sm">
                  {detailedTeacher.name.charAt(0)}
                </div>
              </div>
            </div>

            {/* Draggable subject cards */}
            <p className="text-[9px] font-bold text-black/30 uppercase tracking-widest px-0.5">
              ลากวิชาไปวางในตาราง
            </p>
            <div className="flex-1 overflow-y-auto scrollbar-hide space-y-1.5">
              {subjects.map(s => {
                const color = subjectColor(s.id);
                return (
                  <div
                    key={s.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData(
                        'application/subject-card',
                        JSON.stringify({ subjectId: s.id, teacherId: detailedTeacher.id }),
                      );
                      e.dataTransfer.effectAllowed = 'copy';
                    }}
                    className="group relative flex items-center gap-2 rounded-xl p-2.5 cursor-grab active:cursor-grabbing transition-all hover:shadow-sm hover:scale-[1.01] border"
                    style={{ background: color.bg, borderColor: color.border }}
                  >
                    <GripVertical size={12} className="text-black/20 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <span className="text-[9px] font-black px-1 py-0.5 rounded bg-white/60" style={{ color: color.text }}>
                          {s.code}
                        </span>
                        <span className="text-[9px] font-semibold text-black/35">
                          {s.hoursPerWeek} คาบ
                        </span>
                      </div>
                      <p className="text-[10px] font-semibold text-black/75 leading-tight truncate">{s.name}</p>
                    </div>
                  </div>
                );
              })}
              {subjects.length === 0 && (
                <div className="py-10 text-center border border-dashed border-black/10 rounded-2xl">
                  <p className="text-[10px] text-black/30">ไม่มีวิชาที่รับผิดชอบ</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
