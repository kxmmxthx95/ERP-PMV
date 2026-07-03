import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  HiArrowLeft,
  HiStar,
  HiUserGroup,
  HiBookOpen,
  HiUsers,
  HiPlus,
  HiCheck,
  HiXMark,
  HiExclamationTriangle,
} from 'react-icons/hi2';
import { collection, query, where, onSnapshot, getDocs, doc, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { fetchStudentsByIds } from '@/lib/firestoreShared/fetchStudentsByIds';
import type { ClassRoom } from '@/types/class';
import type { Department } from '@/types/curriculum';
import { useTeacherManager } from '@/features/teachers/hooks/useTeacherManager';
import { useClassroomManager } from '@/features/classes/hooks/useClassroomManager';
import {
  buildHomeroomTeacherUpdate,
  isHomeroomTeacherSelected,
  needsHomeroomTeacherRepair,
  resolveHomeroomTeacherIds,
  resolveHomeroomTeachers,
  toggleHomeroomTeacherIds,
} from '@/features/classes/utils/homeroomTeachers';

import ClassCourseTab from './ClassCourseTab';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

const LONG_PRESS_MS = 500;

interface ClassStudentPanelProps {
  classRoom: ClassRoom;
  onBack: () => void;
}

const DEPT_THEMES: Record<Department, { gradient: string; label: string; accent: string; avatarBg: string }> = {
  early: {
    gradient: 'from-rose-400 to-pink-500',
    label: 'ปฐมวัย',
    accent: 'text-rose-600',
    avatarBg: 'bg-rose-100 text-rose-600',
  },
  primary: {
    gradient: 'from-sky-400 to-blue-500',
    label: 'ประถมศึกษา',
    accent: 'text-sky-600',
    avatarBg: 'bg-sky-100 text-sky-600',
  },
  secondary: {
    gradient: 'from-violet-500 to-indigo-600',
    label: 'มัธยมศึกษา',
    accent: 'text-violet-600',
    avatarBg: 'bg-violet-100 text-violet-600',
  },
};

export default function ClassStudentPanel({ classRoom, onBack }: ClassStudentPanelProps) {
  const [activeTab, setActiveTab] = useState<'roster' | 'courses'>('roster');
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const [mobileTitlePortalTarget, setMobileTitlePortalTarget] = useState<HTMLElement | null>(null);
  const [isMdOrBelow, setIsMdOrBelow] = useState(() => window.innerWidth < 1024);
  useEffect(() => {
    if (isMdOrBelow) {
      setPortalTarget(null);
      setMobileTitlePortalTarget(document.getElementById('header-portal-center-mobile'));
      return;
    }
    setPortalTarget(document.getElementById('header-portal-center'));
    setMobileTitlePortalTarget(null);
  }, [isMdOrBelow]);
  useEffect(() => {
    const handleResize = () => setIsMdOrBelow(window.innerWidth < 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [classStudents, setClassStudents] = useState<any[]>([]);

  // Real-time Class Details and Teachers
  const { classes, updateClass } = useClassroomManager();
  const currentClassRoom = classes.find(c => c.id === classRoom.id) || classRoom;

  const { teachers } = useTeacherManager();

  const [showTeacherPicker, setShowTeacherPicker] = useState(false);
  const [teacherQuery, setTeacherQuery] = useState('');
  const [removeTeacherTarget, setRemoveTeacherTarget] = useState<{ id: string; name: string } | null>(null);
  const [isRemovingTeacher, setIsRemovingTeacher] = useState(false);
  const teacherPickerRef = useRef<HTMLDivElement>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const theme = DEPT_THEMES[currentClassRoom.departmentId as Department] ?? DEPT_THEMES.secondary;

  const activeTeachers = useMemo(
    () => teachers.filter((t) => t.status === 'active'),
    [teachers],
  );
  const filteredTeachers = activeTeachers.filter(t =>
    !teacherQuery || t.name.toLowerCase().includes(teacherQuery.toLowerCase())
  );
  const selectedTeachers = resolveHomeroomTeachers(currentClassRoom, activeTeachers);
  const repairAttemptedRef = useRef<string | null>(null);

  // Auto-repair stale/duplicate homeroom teacher refs in Firestore (once per class load)
  useEffect(() => {
    if (activeTeachers.length === 0) return;
    const repairKey = `${currentClassRoom.id}:${JSON.stringify(currentClassRoom.homeroomTeacherIds ?? [])}:${currentClassRoom.homeroomTeacherId ?? ''}`;
    if (repairAttemptedRef.current === repairKey) return;
    if (!needsHomeroomTeacherRepair(currentClassRoom, activeTeachers)) return;

    repairAttemptedRef.current = repairKey;
    const normalized = resolveHomeroomTeacherIds(currentClassRoom, activeTeachers);
    void updateClass(currentClassRoom.id, buildHomeroomTeacherUpdate(normalized));
  }, [
    currentClassRoom,
    activeTeachers,
    updateClass,
  ]);

  useEffect(() => {
    if (!showTeacherPicker) return;
    const handler = (e: MouseEvent) => {
      if (teacherPickerRef.current && !teacherPickerRef.current.contains(e.target as Node)) {
        setShowTeacherPicker(false);
        setTeacherQuery('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showTeacherPicker]);

  const toggleHomeroomTeacher = async (teacherId: string) => {
    const teacher = activeTeachers.find((t) => t.id === teacherId);
    if (!teacher) return;

    const wasSelected = isHomeroomTeacherSelected(teacher, currentClassRoom, activeTeachers);
    const { nextIds, changed, atLimit } = toggleHomeroomTeacherIds(teacher, currentClassRoom, activeTeachers);

    if (atLimit) {
      toast.error('กำหนดครูประจำชั้นได้สูงสุด 2 คน');
      return;
    }
    if (!changed) return;

    try {
      await updateClass(currentClassRoom.id, buildHomeroomTeacherUpdate(nextIds));
      if (!wasSelected) {
        toast.success(`เพิ่ม ${teacher.name} เป็นครูประจำชั้นแล้ว`);
      } else {
        toast.success(`ลบ ${teacher.name} ออกจากครูประจำชั้นแล้ว`);
      }
    } catch {
      toast.error('ไม่สามารถบันทึกข้อมูลได้');
    }
  };

  const clearLongPressTimer = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const bindTeacherLongPress = (teacher: { id: string; name: string }) => ({
    onPointerDown: (e: React.PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      clearLongPressTimer();
      longPressTimerRef.current = setTimeout(() => {
        setRemoveTeacherTarget({ id: teacher.id, name: teacher.name });
      }, LONG_PRESS_MS);
    },
    onPointerUp: clearLongPressTimer,
    onPointerLeave: clearLongPressTimer,
    onPointerCancel: clearLongPressTimer,
    onContextMenu: (e: React.MouseEvent) => {
      e.preventDefault();
      setRemoveTeacherTarget({ id: teacher.id, name: teacher.name });
    },
  });

  const confirmRemoveHomeroomTeacher = async () => {
    if (!removeTeacherTarget) return;
    setIsRemovingTeacher(true);
    try {
      await toggleHomeroomTeacher(removeTeacherTarget.id);
      setRemoveTeacherTarget(null);
    } finally {
      setIsRemovingTeacher(false);
    }
  };

  React.useEffect(() => {
    let cancelled = false;
    const q = query(
      collection(db, 'students'),
      where('classroomId', '==', currentClassRoom.id)
    );

    const unsub = onSnapshot(q, async (snap) => {
      let students = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      if (students.length === 0) {
        const enq = query(collection(db, 'enrollments'), where('classId', '==', currentClassRoom.id));
        const enSnap = await getDocs(enq);
        if (cancelled) return;

        const studentIds = enSnap.docs
          .map(d => d.data().studentId)
          .filter((id): id is string => typeof id === 'string' && id.trim() !== '');

        if (studentIds.length > 0) {
          students = await fetchStudentsByIds(studentIds);
        }
      }

      if (cancelled) return;

      setClassStudents(
        students.sort((a: any, b: any) =>
          (a.studentCode || '').localeCompare(b.studentCode || '', undefined, { numeric: true })
        )
      );
    });

    return () => {
      cancelled = true;
      unsub();
    };
  }, [currentClassRoom.id]);

  const togglePresident = async (studentId: string, currentStatus: boolean) => {
    try {
      const batch = writeBatch(db);

      classStudents.forEach(s => {
        if (s.isPresident) {
          batch.update(doc(db, 'students', s.id), { isPresident: false });
        }
      });

      if (!currentStatus) {
        batch.update(doc(db, 'students', studentId), { isPresident: true });
        const st = classStudents.find(s => s.id === studentId);
        toast.success(`ตั้ง ${st?.firstName} ${st?.lastName} เป็นหัวหน้าห้องแล้ว`);
      } else {
        toast.success(`ยกเลิกตำแหน่งหัวหน้าห้องแล้ว`);
      }

      await batch.commit();
    } catch (err) {
      console.error('Error toggling president:', err);
      toast.error('ไม่สามารถบันทึกข้อมูลได้');
    }
  };

  const totalCount = classStudents.length;
  const maleCount = classStudents.filter(
    s => s.gender === 'male' || ['เด็กชาย', 'นาย', 'ด.ช.'].includes(s.prefix)
  ).length;
  const femaleCount = classStudents.filter(
    s => s.gender === 'female' || ['เด็กหญิง', 'นางสาว', 'นาง', 'ด.ญ.'].includes(s.prefix)
  ).length;

  const tabs = [
    { id: 'roster', label: 'รายชื่อ', icon: HiUserGroup },
    { id: 'courses', label: 'วิชาเรียน', icon: HiBookOpen },
  ] as const;

  const switcherElement = (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex items-center h-10 bg-slate-50 p-1 rounded-full pointer-events-auto w-full md:w-fit justify-center"
    >
      {tabs.map(tab => {
        const active = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`flex-1 md:flex-initial min-w-0 flex items-center justify-center h-full px-6 rounded-full text-[11px] font-black transition-all whitespace-nowrap gap-1.5 cursor-pointer ${
              active
                ? 'bg-slate-900 text-white'
                : 'text-slate-500 hover:text-slate-800 hover:bg-black/5'
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </motion.div>
  );

  return (
    <div className="flex flex-col h-full w-full overflow-hidden pb-4 font-sukhumvit gap-4 md:gap-5 md:p-2">
      {/* ── Mobile Header Title Portal ── */}
      {isMdOrBelow && mobileTitlePortalTarget && createPortal(
        <div className="pointer-events-auto flex items-center justify-center w-full">
          <div className="flex items-center gap-1.5">
            <HiUserGroup className="w-4 h-4 text-slate-500" />
            <span className="text-[14px] font-black text-slate-800 tracking-tight">ห้องเรียน</span>
          </div>
        </div>,
        mobileTitlePortalTarget
      )}

      {/* ── Header Portal: Tab Switcher ── */}
      {!isMdOrBelow && portalTarget && createPortal(
        switcherElement,
        portalTarget
      )}

      {/* ── Class info panel (separated top panel) ── */}
      <div className="rounded-[1.25rem] bg-white px-5 md:px-6 py-4 md:py-5 shrink-0">

        {/* ── Class info bar ── */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 w-full relative">
          
          {/* Top section: Title, badge, back button AND Homeroom teachers */}
          <div className="flex items-center justify-between w-full md:w-auto md:justify-start gap-4 md:gap-8">
            
            {/* Title, badge, back button */}
            <div className="flex items-center gap-3">
              {/* Back button */}
              <button
                onClick={onBack}
                className="w-9 h-9 rounded-full flex items-center justify-center text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 transition-all shrink-0 active:scale-95 cursor-pointer"
                title="ย้อนกลับ"
              >
                <HiArrowLeft className="w-4 h-4" />
              </button>

              {/* Class Name & Dept */}
              <div className="min-w-0">
                <h2 className="text-base font-black text-slate-900 leading-tight">
                  ห้อง {currentClassRoom.className}
                </h2>
                <p className="text-[11px] text-slate-400 font-bold mt-0.5">{theme.label}</p>
              </div>
            </div>

            {/* Homeroom teachers */}
            <div className="flex items-center gap-2 relative z-30" ref={teacherPickerRef}>
              <div className="flex items-center gap-1.5 bg-slate-50 p-1.5 rounded-2xl transition-all">
                {selectedTeachers.length === 0 ? (
                  <span className="text-[10px] font-black text-slate-400 px-2 py-0.5">ยังไม่มีครูประจำชั้น</span>
                ) : (
                  <div className="flex items-center gap-2 px-1">
                    <div className="flex -space-x-1.5 overflow-hidden">
                      {selectedTeachers.map(t => (
                        <div
                          key={t.id}
                          {...bindTeacherLongPress(t)}
                          className="w-6 h-6 rounded-full bg-slate-200 overflow-hidden flex items-center justify-center shrink-0 touch-none select-none cursor-pointer"
                          title={`${t.name} — กดค้างเพื่อถอดครูประจำชั้น`}
                        >
                          {t.photoURL ? (
                            <img src={t.photoURL} alt={t.name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-[8px] font-black text-slate-600">{t.name.charAt(0)}</span>
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[9.5px] font-black text-slate-700 max-w-[120px] truncate leading-none">
                        {selectedTeachers.map(t => t.name.replace(/^(นาย|นางสาว|นาง|ครู|ครูประจำชั้น)/, '').trim().split(' ')[0]).join(', ')}
                      </span>
                      <span className="text-[7.5px] font-bold text-slate-400 mt-0.5 leading-none">ครูประจำชั้น</span>
                    </div>
                  </div>
                )}

                {/* The + Button */}
                <button
                  onClick={() => setShowTeacherPicker(!showTeacherPicker)}
                  className="w-6.5 h-6.5 rounded-full flex items-center justify-center bg-slate-900 hover:bg-slate-800 text-white transition-all active:scale-95 cursor-pointer shrink-0"
                  title="จัดการครูประจำชั้น"
                >
                  <HiPlus className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Premium dropdown list */}
              <AnimatePresence>
                {showTeacherPicker && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-full mt-2 w-72 max-h-[300px] overflow-hidden flex flex-col bg-white/95 backdrop-blur-md border border-slate-200/60 rounded-2xl shadow-xl z-50 p-3 gap-2"
                  >
                    <div className="flex items-center justify-between shrink-0 px-1 pt-0.5">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">เลือกครูประจำชั้น (สูงสุด 2 คน)</span>
                      <button
                        onClick={() => { setShowTeacherPicker(false); setTeacherQuery(''); }}
                        className="text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        <HiXMark className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Search Bar */}
                    <div className="relative shrink-0">
                      <input
                        type="text"
                        value={teacherQuery}
                        onChange={e => setTeacherQuery(e.target.value)}
                        placeholder="ค้นหาชื่อครู..."
                        className="w-full pl-3 pr-8 py-1.5 text-[11px] rounded-xl bg-slate-50 border border-black/5 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all font-bold placeholder-slate-400 text-slate-800"
                      />
                    </div>

                    {/* Scrollable list */}
                    <div className="flex-1 overflow-y-auto pr-0.5 space-y-1 scrollbar-thin scrollbar-thumb-slate-200">
                      {filteredTeachers.length === 0 ? (
                        <div className="py-6 text-center text-slate-400 text-[10px] font-bold">
                          ไม่พบรายชื่อครู
                        </div>
                      ) : (
                        filteredTeachers.map(t => {
                          const isSelected = isHomeroomTeacherSelected(t, currentClassRoom, activeTeachers);
                          return (
                            <div
                              key={t.id}
                              onClick={() => toggleHomeroomTeacher(t.id)}
                              className={`flex items-center justify-between p-1.5 rounded-xl transition-all cursor-pointer ${
                                isSelected
                                  ? 'bg-blue-50 text-blue-600 font-black'
                                  : 'hover:bg-slate-50 text-slate-700 font-bold'
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <div
                                  {...(isSelected ? bindTeacherLongPress(t) : {})}
                                  onClick={isSelected ? (e) => e.stopPropagation() : undefined}
                                  className={`w-7 h-7 rounded-lg bg-slate-100 overflow-hidden flex items-center justify-center shrink-0 border border-black/[0.04] ${
                                    isSelected ? 'touch-none select-none cursor-pointer' : ''
                                  }`}
                                  title={isSelected ? `${t.name} — กดค้างเพื่อถอดครูประจำชั้น` : t.name}
                                >
                                  {t.photoURL ? (
                                    <img src={t.photoURL} alt={t.name} className="w-full h-full object-cover" />
                                  ) : (
                                    <span className="text-[9px] font-black text-slate-500">{t.name.charAt(0)}</span>
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-[11px] truncate leading-tight">{t.name}</p>
                                  <p className="text-[8.5px] text-slate-400 truncate mt-0.5">
                                    {t.position || 'ครูผู้สอน'}
                                  </p>
                                </div>
                              </div>

                              {isSelected ? (
                                <HiCheck className="w-3.5 h-3.5 text-blue-600 shrink-0 mr-1" />
                              ) : (
                                <div className="w-3.5 h-3.5 rounded-full border border-slate-200 shrink-0 mr-1" />
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

          </div>

          {/* Right section: Stat pills */}
          <div className="flex flex-col gap-3 w-full md:w-auto md:flex md:items-center shrink-0">
            {isMdOrBelow && (
              <div className="md:hidden flex justify-end w-full">
                {switcherElement}
              </div>
            )}
            {activeTab === 'roster' ? (
              <div className="grid grid-cols-3 gap-3 w-full md:w-auto md:flex md:items-center shrink-0">
                <div className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-2xl bg-white">
                  <HiUsers className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-[11px] font-black text-slate-700">{totalCount} นักเรียน</span>
                </div>
                <div className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-2xl bg-sky-50">
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-400 shrink-0" />
                  <span className="text-[11px] font-black text-sky-600">{maleCount} ชาย</span>
                </div>
                <div className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-2xl bg-pink-50">
                  <span className="w-1.5 h-1.5 rounded-full bg-pink-400 shrink-0" />
                  <span className="text-[11px] font-black text-pink-500">{femaleCount} หญิง</span>
                </div>
              </div>
            ) : (
              <div id="course-header-portal" className="flex flex-wrap items-center gap-2 md:gap-3 justify-start md:justify-end flex-1 min-w-0" />
            )}
          </div>
        </div>

      </div>

      {/* ── Main content glass panel (separated bottom panel) ── */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden md:p-5 bg-transparent border-0 p-0 shadow-none">

        {/* ── Tab content ── */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="flex-1 min-h-0 flex flex-col"
          >
            {activeTab === 'roster' && (
              <div className="flex flex-col flex-1 min-h-0 bg-transparent border-0 overflow-hidden">



                {classStudents.length === 0 ? (
                  <div className="flex flex-col items-center justify-center flex-1 gap-3 text-slate-400">
                    <HiUsers className="w-10 h-10 opacity-30" />
                    <p className="text-sm font-medium">ไม่พบรายชื่อนักเรียนในห้องนี้</p>
                  </div>
                ) : (
                  <div className="flex-1 overflow-y-auto scrollbar-hide px-0 py-3 md:p-0">
                    {/* Responsive Student Cards Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-2 md:p-4">
                      {classStudents.map((student, index) => {
                        const isSelected = selectedStudentId === student.id;
                        const initial = (student.firstName ?? '?').charAt(0);
                        const isMale = student.gender === 'male' || ['เด็กชาย', 'นาย', 'ด.ช.'].includes(student.prefix);
                        const genderLabel = isMale ? 'ชาย' : 'หญิง';

                        return (
                          <motion.div
                            key={student.id}
                            layout
                            onClick={() => setSelectedStudentId(isSelected ? null : student.id)}
                            whileTap={{ scale: 0.98 }}
                            className={`relative overflow-hidden py-3 px-4 rounded-2xl transition-all cursor-pointer flex items-center justify-between gap-4 ${
                              isSelected
                                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
                                : 'bg-white shadow-[0_4px_14px_rgba(15,23,42,0.08)] hover:shadow-[0_6px_18px_rgba(15,23,42,0.12)] text-slate-800'
                            }`}
                          >
                            {/* Left: Avatar & Rank */}
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="relative shrink-0">
                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-[12px] font-black shrink-0 overflow-hidden ${
                                  isSelected ? 'bg-white/20 text-white' : theme.avatarBg
                                }`}>
                                  {student.photoURL ? (
                                    <img src={student.photoURL} alt={student.firstName} className="w-full h-full object-cover" />
                                  ) : (
                                    initial
                                  )}
                                </div>
                                <span className={`absolute -top-1.5 -left-1.5 text-[8.5px] font-mono font-black w-4.5 h-4.5 rounded-full flex items-center justify-center border ${
                                  isSelected
                                    ? 'bg-white text-blue-600 border-blue-500'
                                    : 'bg-slate-900 text-white border-white shadow-sm'
                                }`}>
                                  {index + 1}
                                </span>
                              </div>

                              {/* Center: Info */}
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <h3 className={`text-[12.5px] font-black truncate ${isSelected ? 'text-white' : 'text-slate-800'}`}>
                                    {student.prefix}{student.firstName} {student.lastName}
                                  </h3>
                                  {(student as any).isPresident && (
                                    <HiStar className={`w-3.5 h-3.5 ${
                                      isSelected ? 'text-yellow-300 fill-yellow-300' : 'text-yellow-400 fill-yellow-400'
                                    }`} />
                                  )}
                                </div>

                                <div className="flex items-center gap-2 mt-0.5 text-[10px] font-bold">
                                  <span className={isSelected ? 'text-white/80' : 'text-slate-500'}>
                                    ช.เล่น: <span className={isSelected ? 'text-white' : 'text-slate-700'}>{student.nickname || '—'}</span>
                                  </span>
                                  <span className={isSelected ? 'text-white/40' : 'text-slate-300'}>|</span>
                                  <span className={`font-mono ${isSelected ? 'text-white/80' : 'text-slate-500'}`}>
                                    รหัส: {student.studentCode || '—'}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Right: Gender badge & Star */}
                            <div className="flex items-center gap-2 shrink-0">
                              <span className={`text-[9.5px] font-black px-2 py-0.5 rounded-md ${
                                isSelected
                                  ? 'bg-white/20 text-white'
                                  : isMale
                                    ? 'bg-sky-50 text-sky-600 border border-sky-100/50'
                                    : 'bg-pink-50 text-pink-600 border border-pink-100/50'
                              }`}>
                                {genderLabel}
                              </span>

                              <button
                                onClick={e => {
                                  e.stopPropagation();
                                  togglePresident(student.id, !!(student as any).isPresident);
                                }}
                                className={`flex items-center justify-center w-7 h-7 rounded-full transition-all ${
                                  isSelected ? 'hover:bg-white/20' : 'hover:bg-yellow-50'
                                }`}
                                title={(student as any).isPresident ? 'ยกเลิกหัวหน้าห้อง' : 'ตั้งเป็นหัวหน้าห้อง'}
                              >
                                <HiStar
                                  className={`w-4 h-4 transition-colors ${(student as any).isPresident
                                      ? 'text-yellow-400 fill-yellow-400'
                                      : isSelected
                                        ? 'text-white/30'
                                        : 'text-slate-300 hover:text-yellow-400'
                                    }`}
                                />
                              </button>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'courses' && (
              <ClassCourseTab
                classRoom={currentClassRoom}
                cfg={{
                  bg: 'rgba(59,130,246,0.08)',
                  color: '#3b82f6',
                  label: 'วิชาเรียน',
                }}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <Dialog open={!!removeTeacherTarget} onOpenChange={(open) => { if (!open) setRemoveTeacherTarget(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader className="items-center text-center">
            <div className="w-14 h-14 rounded-full flex items-center justify-center bg-amber-100 text-amber-600">
              <HiExclamationTriangle className="w-7 h-7" />
            </div>
            <DialogTitle className="text-lg font-black text-slate-800">ถอดครูประจำชั้น?</DialogTitle>
            <DialogDescription className="text-sm text-slate-600 leading-relaxed">
              {removeTeacherTarget && (
                <>
                  ครู <span className="font-bold text-slate-800">{removeTeacherTarget.name}</span> จะ
                  <span className="font-bold text-amber-700"> เสียสิทธิ์เช็คชื่อเข้าแถว</span>
                  {' '}ของห้อง {currentClassRoom.className} ทันทีเมื่อถูกถอดออก
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              className="w-full font-black bg-red-600 hover:bg-red-500 text-white"
              onClick={() => void confirmRemoveHomeroomTeacher()}
              disabled={isRemovingTeacher}
            >
              {isRemovingTeacher ? 'กำลังถอน...' : 'ถอนออก'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
