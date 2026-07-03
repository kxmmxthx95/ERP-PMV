import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, GripVertical } from 'lucide-react';
import ScheduleGrid from '../components/ScheduleGrid';
import { subjectColorByName as subjectColor } from '../constants/colors';
import type { ConflictResult, ScheduleEntry, SchoolDay, SchoolClass, Teacher } from '@/types/schedule';
import type { TeacherProfile } from '@/types/teacher';
import type { Department, Subject } from '@/types/curriculum';

interface TeacherViewProps {
  selectedTeacherId: string;
  setSelectedTeacherId: (id: string) => void;
  filterDept: 'all' | 'early' | 'primary' | 'secondary';
  setFilterDept: (v: 'all' | 'early' | 'primary' | 'secondary') => void;
  isEditMode: boolean;
  grid: Record<number, Record<number, ScheduleEntry[]>>;
  openSlotModal: (day: SchoolDay, period: number, entry?: ScheduleEntry | null) => void;
  deleteEntry: (id: string) => Promise<void>;
  moveEntry: (id: string, day: SchoolDay, period: number) => Promise<ConflictResult>;
  handleSubjectDrop: (day: SchoolDay, period: number, subjectId: string, teacherId: string, classId?: string) => void;
  setIsEditMode: (val: boolean) => void;
  teachers: Teacher[];
  allClasses?: SchoolClass[];
  draggableSubjects?: {
    id: string;
    code: string;
    name: string;
    hoursPerWeek?: number;
    subjectGroup?: string;
    assignedTeacherId?: string;
    className?: string;
    classId?: string;
  }[];
  mobileHeaderContent?: React.ReactNode;
  jointClassEntryIds?: Set<string>;
  jointClassPartnersByEntryId?: Map<string, string[]>;
}


const AVATAR_COLORS: React.CSSProperties[] = [
  { background: 'rgba(99,102,241,0.15)', color: '#4338ca' },
  { background: 'rgba(236,72,153,0.15)', color: '#be185d' },
  { background: 'rgba(16,185,129,0.15)', color: '#047857' },
  { background: 'rgba(249,115,22,0.15)', color: '#c2410c' },
  { background: 'rgba(20,184,166,0.15)', color: '#0f766e' },
  { background: 'rgba(168,85,247,0.15)', color: '#7c3aed' },
];

function avatarColor(name: string): React.CSSProperties {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xff;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

export function TeacherView({
  selectedTeacherId,
  setSelectedTeacherId,
  filterDept,
  setFilterDept,
  isEditMode,
  grid,
  openSlotModal,
  deleteEntry,
  moveEntry,
  handleSubjectDrop,
  setIsEditMode,
  teachers,
  allClasses,
  draggableSubjects,
  mobileHeaderContent,
  jointClassEntryIds,
  jointClassPartnersByEntryId,
}: TeacherViewProps) {
  return (
    <ScheduleGrid
      grid={grid}
      viewMode="teacher"
      settingsId={selectedTeacherId}
      readOnly={!isEditMode}
      isEditMode={isEditMode}
      setIsEditMode={setIsEditMode}
      onSlotClick={(day, period, entry) => isEditMode && openSlotModal(day, period, entry)}
      onDeleteEntry={async (id) => await deleteEntry(id)}
      onMoveEntry={async (id, day, period) => {
        const res = await moveEntry(id, day, period);
        if (res.hasConflict) alert('ไม่สามารถย้ายได้: ' + res.conflicts[0].message);
      }}
      onDropSubject={handleSubjectDrop}
      filterDept={filterDept}
      setFilterDept={setFilterDept}
      teachers={teachers}
      allClasses={allClasses}
      draggableSubjects={draggableSubjects}
      dragTeacherId={selectedTeacherId}
      mobileHeaderContent={mobileHeaderContent}
      selectedTeacherId={selectedTeacherId}
      setSelectedTeacherId={setSelectedTeacherId}
      jointClassEntryIds={jointClassEntryIds}
      jointClassPartnersByEntryId={jointClassPartnersByEntryId}
    />
  );
}

export function TeacherSidebar({
  teachers,
  filterDept,
  selectedTeacherId,
  setSelectedTeacherId,
  teacherLoadSummary,
  getTeacherSubjects,
}: {
  teachers: TeacherProfile[];
  filterDept: Department | 'all';
  selectedTeacherId: string;
  setSelectedTeacherId: (id: string) => void;
  teacherLoadSummary: Record<string, number>;
  getTeacherSubjects: (id: string) => Subject[];
}) {
  const [detailTeacherId, setDetailTeacherId] = useState<string | null>(null);
  const detailedTeacher = teachers.find(t => t.id === detailTeacherId);
  const detailedSubjects = detailedTeacher ? getTeacherSubjects(detailedTeacher.id) : [];
  const filteredTeachers = teachers.filter(t => filterDept === 'all' || t.department === filterDept);
  const maxLoad = Math.max(...Object.values(teacherLoadSummary), 1);

  return (
    <div className="flex flex-col h-full min-h-0">
      <AnimatePresence mode="wait">
        {!detailedTeacher ? (
          <motion.div
            key="list"
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.18 }}
            className="flex flex-col h-full min-h-0"
          >
            <div className="p-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">รายชื่อครู</p>
              </div>
              <span className="text-[10px] font-bold bg-black/5 px-2 py-0.5 rounded-full text-slate-500">
                {filteredTeachers.length}
              </span>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto space-y-0 scrollbar-hide">
              {filteredTeachers.map((t, idx) => {
                const active = selectedTeacherId === t.id;
                const load = teacherLoadSummary[t.id] ?? 0;
                const loadPct = Math.min(load / maxLoad, 1);
                const av = avatarColor(t.name);
                const isLast = idx === filteredTeachers.length - 1;

                return (
                  <div key={t.id} className="px-2">
                    <button
                      onClick={() => setSelectedTeacherId(t.id)}
                      onDoubleClick={() => setDetailTeacherId(t.id)}
                      className={`w-full flex items-center gap-3 p-2.5 transition-all text-left group relative ${active
                        ? 'bg-blue-600 rounded-xl z-10'
                        : 'bg-transparent hover:bg-black/[0.02] rounded-xl'
                        }`}
                    >
                      <div
                        className="w-16 h-16 rounded-xl flex items-center justify-center text-[18px] font-black shrink-0 transition-colors shadow-sm overflow-hidden"
                        style={active ? { background: 'rgba(255,255,255,0.20)', color: 'white' } : av}
                      >
                        {t.photoURL ? (
                          <img src={t.photoURL} alt={t.name} className="w-full h-full object-cover" />
                        ) : (
                          t.name.charAt(0)
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className={`text-[13px] font-black tracking-tight leading-none mb-1.5 ${active ? 'text-white' : 'text-slate-800'}`}>
                          {t.name}
                        </p>

                        <div className="flex items-center gap-1.5">
                          {t.position && (
                            <span className={`shrink-0 text-[8px] font-black uppercase tracking-widest ${active ? 'text-blue-100/80' : 'text-slate-400'}`}>
                              {t.position.split(' ')[0]}
                            </span>
                          )}
                          {load > 0 && (
                            <div className={`flex items-center gap-1.5 flex-1 ${active ? 'opacity-100' : 'opacity-60'}`}>
                              <div className={`flex-1 h-1 rounded-full overflow-hidden ${active ? 'bg-white/20' : 'bg-black/[0.07]'}`}>
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${loadPct * 100}%` }}
                                  className="h-full rounded-full transition-all"
                                  style={{ background: active ? 'white' : 'rgba(59,130,246,0.6)' }}
                                />
                              </div>
                              <span className={`text-[9px] font-black shrink-0 ${active ? 'text-white' : 'text-slate-500'}`}>
                                {load}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                    {!active && !isLast && (
                      <div className="mx-4 h-[1px] bg-black/[0.05]" />
                    )}
                  </div>
                );
              })}
              {filteredTeachers.length === 0 && (
                <div className="py-16 text-center">
                  <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest italic">ไม่พบรายชื่อครู</p>
                </div>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="detail"
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 12 }}
            transition={{ duration: 0.18 }}
            className="flex flex-col h-full min-h-0"
          >
            <div className="border-b px-1 mb-2" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
              <button
                onClick={() => setDetailTeacherId(null)}
                className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 hover:text-blue-500 transition-colors mb-4 group"
              >
                <ArrowLeft size={12} strokeWidth={3} className="transition-transform group-hover:-translate-x-0.5" />
                <span className="uppercase tracking-widest">กลับรายชื่อ</span>
              </button>
              <div className="flex items-center gap-3.5">
                <div
                  className="w-14 h-14 rounded-xl flex items-center justify-center text-[18px] font-black shrink-0 shadow-sm overflow-hidden"
                  style={avatarColor(detailedTeacher.name)}
                >
                  {detailedTeacher.photoURL ? (
                    <img src={detailedTeacher.photoURL} alt={detailedTeacher.name} className="w-full h-full object-cover" />
                  ) : (
                    detailedTeacher.name.charAt(0)
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-black text-slate-800 leading-tight truncate">{detailedTeacher.name}</p>
                  {detailedTeacher.position && (
                    <span className="inline-block mt-1.5 px-2 py-0.5 rounded-lg bg-blue-50 text-blue-500 text-[8px] font-black uppercase tracking-widest border border-blue-100">
                      {detailedTeacher.position}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="border-b px-1 py-2" style={{ borderColor: 'rgba(0,0,0,0.05)' }}>
              <p className="text-[9px] font-black text-black/25 uppercase tracking-widest">
                ลากวิชาไปวางในตาราง
              </p>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto space-y-2 scrollbar-hide">
              {detailedSubjects.map(s => {
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
                    className="mx-1 flex items-center gap-2.5 rounded-2xl p-3 cursor-grab active:cursor-grabbing transition-all hover:shadow-sm hover:scale-[1.01] border select-none"
                    style={{ background: color.bg, borderColor: color.border }}
                  >
                    <GripVertical size={12} className="text-black/18 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span
                          className="text-[9px] font-black px-1.5 py-0.5 rounded-lg"
                          style={{ background: 'rgba(255,255,255,0.70)', color: color.text }}
                        >
                          {s.code}
                        </span>
                        <span className="text-[9px] font-semibold text-black/30 ml-auto">
                          {s.hoursPerWeek} คาบ
                        </span>
                      </div>
                      <p className="text-[10px] font-bold text-black/70 leading-snug truncate">{s.name}</p>
                    </div>
                  </div>
                );
              })}
              {detailedSubjects.length === 0 && (
                <div className="py-10 text-center rounded-2xl border border-dashed" style={{ borderColor: 'rgba(0,0,0,0.08)' }}>
                  <p className="text-[10px] text-black/28 font-bold">ไม่มีวิชาที่รับผิดชอบ</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
