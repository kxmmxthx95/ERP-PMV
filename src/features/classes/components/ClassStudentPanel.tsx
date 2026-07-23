import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
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
import StudentAvatar from '@/features/students/components/StudentAvatar';
import { cn } from '@/lib/utils';

const LONG_PRESS_MS = 500;

const TABLE_SHELL = 'rounded-2xl border border-border bg-card overflow-hidden';
const TABLE_HEADER_CELL = 'text-[13px] font-black text-foreground font-sukhumvit whitespace-nowrap';
const TABLE_GRID =
  'minmax(4.5rem, 0.7fr) minmax(0, 2.2fr) minmax(0, 1fr) minmax(5rem, 0.85fr) minmax(3rem, 0.5fr)';

type ClassStudentRow = {
  id: string;
  prefix?: string;
  firstName?: string;
  lastName?: string;
  nickname?: string;
  studentCode?: string;
  photoURL?: string;
  gender?: string;
  isPresident?: boolean;
};

function resolveStudentGender(student: ClassStudentRow): 'male' | 'female' | undefined {
  if (student.gender === 'male' || student.gender === 'female') return student.gender;
  if (['เด็กชาย', 'นาย', 'ด.ช.'].includes(student.prefix ?? '')) return 'male';
  if (['เด็กหญิง', 'นางสาว', 'นาง', 'ด.ญ.'].includes(student.prefix ?? '')) return 'female';
  return undefined;
}

function studentDisplayName(student: ClassStudentRow) {
  return `${student.prefix ?? ''}${student.firstName ?? ''} ${student.lastName ?? ''}`.trim();
}

function GenderBadge({ gender }: { gender: 'male' | 'female' | undefined }) {
  if (gender === 'male') {
    return (
      <span className="inline-flex rounded-full bg-sky-500/10 px-2.5 py-0.5 text-[10px] font-bold text-sky-600 font-sukhumvit">
        ชาย
      </span>
    );
  }
  if (gender === 'female') {
    return (
      <span className="inline-flex rounded-full bg-pink-500/10 px-2.5 py-0.5 text-[10px] font-bold text-pink-600 font-sukhumvit">
        หญิง
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-bold text-muted-foreground font-sukhumvit">
      —
    </span>
  );
}

interface ClassStudentPanelProps {
  classRoom: ClassRoom;
  /** Desktop right-pane header host — info bar portals here on lg+ */
  desktopHeaderHost?: HTMLElement | null;
}

export default function ClassStudentPanel({
  classRoom,
  desktopHeaderHost = null,
}: ClassStudentPanelProps) {
  const [activeTab, setActiveTab] = useState<'roster' | 'courses'>('roster');
  const [mobileTitlePortalTarget, setMobileTitlePortalTarget] = useState<HTMLElement | null>(null);
  const [isMdOrBelow, setIsMdOrBelow] = useState(() => window.innerWidth < 1024);
  useEffect(() => {
    setMobileTitlePortalTarget(
      isMdOrBelow ? document.getElementById('header-portal-center-mobile') : null,
    );
  }, [isMdOrBelow]);
  useEffect(() => {
    const handleResize = () => setIsMdOrBelow(window.innerWidth < 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const [classStudents, setClassStudents] = useState<ClassStudentRow[]>([]);

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
    s => s.gender === 'male' || ['เด็กชาย', 'นาย', 'ด.ช.'].includes(s.prefix ?? '')
  ).length;
  const femaleCount = classStudents.filter(
    s => s.gender === 'female' || ['เด็กหญิง', 'นางสาว', 'นาง', 'ด.ญ.'].includes(s.prefix ?? '')
  ).length;

  const tabs = [
    { id: 'roster', label: 'รายชื่อ', icon: HiUserGroup },
    { id: 'courses', label: 'วิชาเรียน', icon: HiBookOpen },
  ] as const;

  const switcherElement = (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex h-10 w-full items-center justify-center rounded-xl bg-slate-50 p-1 pointer-events-auto md:w-fit"
    >
      {tabs.map(tab => {
        const active = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`flex h-full min-w-0 flex-1 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-6 text-[11px] font-black transition-all md:flex-initial ${
              active
                ? 'bg-slate-900 text-white'
                : 'text-slate-500 hover:bg-black/5 hover:text-slate-800'
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

      {/* ── Class info bar (desktop → right header; mobile → inline) ── */}
      {(() => {
        const infoBar = (
      <div className="relative flex h-10 w-full shrink-0 items-center justify-between gap-3">
          {/* Left: tabs + teachers */}
          <div className="flex min-w-0 items-center gap-3 md:gap-4">
            {switcherElement}

            <div className="relative z-30 flex shrink-0 items-center gap-2" ref={teacherPickerRef}>
              <div className="flex items-center gap-1.5 rounded-xl bg-slate-50 p-1.5 transition-all">
                {selectedTeachers.length === 0 ? (
                  <span className="px-2 py-0.5 text-[10px] font-black text-slate-400">ยังไม่มีครูประจำชั้น</span>
                ) : (
                  <div className="flex items-center gap-2 px-1">
                    <div className="flex -space-x-1.5 overflow-hidden">
                      {selectedTeachers.map(t => (
                        <div
                          key={t.id}
                          {...bindTeacherLongPress(t)}
                          className="flex h-6 w-6 shrink-0 cursor-pointer touch-none select-none items-center justify-center overflow-hidden rounded-full bg-slate-200"
                          title={`${t.name} — กดค้างเพื่อถอดครูประจำชั้น`}
                        >
                          {t.photoURL ? (
                            <img src={t.photoURL} alt={t.name} className="h-full w-full object-cover" />
                          ) : (
                            <span className="text-[8px] font-black text-slate-600">{t.name.charAt(0)}</span>
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="flex flex-col">
                      <span className="max-w-[120px] truncate text-[9.5px] font-black leading-none text-slate-700">
                        {selectedTeachers.map(t => t.name.replace(/^(นาย|นางสาว|นาง|ครู|ครูประจำชั้น)/, '').trim().split(' ')[0]).join(', ')}
                      </span>
                      <span className="mt-0.5 text-[7.5px] font-bold leading-none text-slate-400">ครูประจำชั้น</span>
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setShowTeacherPicker(!showTeacherPicker)}
                  className="flex h-6.5 w-6.5 shrink-0 cursor-pointer items-center justify-center rounded-lg bg-slate-900 text-white transition-all hover:bg-slate-800 active:scale-95"
                  title="จัดการครูประจำชั้น"
                >
                  <HiPlus className="h-3.5 w-3.5" />
                </button>
              </div>

              <AnimatePresence>
                {showTeacherPicker && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute left-0 top-full z-50 mt-2 flex max-h-[300px] w-72 flex-col gap-2 overflow-hidden rounded-2xl border border-slate-200/60 bg-white/95 p-3 shadow-xl backdrop-blur-md"
                  >
                    <div className="flex shrink-0 items-center justify-between px-1 pt-0.5">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">เลือกครูประจำชั้น (สูงสุด 2 คน)</span>
                      <button
                        type="button"
                        onClick={() => { setShowTeacherPicker(false); setTeacherQuery(''); }}
                        className="cursor-pointer text-slate-400 hover:text-slate-600"
                      >
                        <HiXMark className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <div className="relative shrink-0">
                      <input
                        type="text"
                        value={teacherQuery}
                        onChange={e => setTeacherQuery(e.target.value)}
                        placeholder="ค้นหาชื่อครู..."
                        className="w-full rounded-xl border border-black/5 bg-slate-50 py-1.5 pl-3 pr-8 text-[11px] font-bold text-slate-800 placeholder-slate-400 transition-all focus:border-transparent focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>

                    <div className="flex-1 space-y-1 overflow-y-auto pr-0.5 scrollbar-thin scrollbar-thumb-slate-200">
                      {filteredTeachers.length === 0 ? (
                        <div className="py-6 text-center text-[10px] font-bold text-slate-400">
                          ไม่พบรายชื่อครู
                        </div>
                      ) : (
                        filteredTeachers.map(t => {
                          const isSelected = isHomeroomTeacherSelected(t, currentClassRoom, activeTeachers);
                          return (
                            <div
                              key={t.id}
                              onClick={() => toggleHomeroomTeacher(t.id)}
                              className={`flex cursor-pointer items-center justify-between rounded-xl p-1.5 transition-all ${
                                isSelected
                                  ? 'bg-blue-50 font-black text-blue-600'
                                  : 'font-bold text-slate-700 hover:bg-slate-50'
                              }`}
                            >
                              <div className="flex min-w-0 items-center gap-2">
                                <div
                                  {...(isSelected ? bindTeacherLongPress(t) : {})}
                                  onClick={isSelected ? (e) => e.stopPropagation() : undefined}
                                  className={`flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-black/[0.04] bg-slate-100 ${
                                    isSelected ? 'cursor-pointer touch-none select-none' : ''
                                  }`}
                                  title={isSelected ? `${t.name} — กดค้างเพื่อถอดครูประจำชั้น` : t.name}
                                >
                                  {t.photoURL ? (
                                    <img src={t.photoURL} alt={t.name} className="h-full w-full object-cover" />
                                  ) : (
                                    <span className="text-[9px] font-black text-slate-500">{t.name.charAt(0)}</span>
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <p className="truncate text-[11px] leading-tight">{t.name}</p>
                                  <p className="mt-0.5 truncate text-[8.5px] text-slate-400">
                                    {t.position || 'ครูผู้สอน'}
                                  </p>
                                </div>
                              </div>

                              {isSelected ? (
                                <HiCheck className="mr-1 h-3.5 w-3.5 shrink-0 text-blue-600" />
                              ) : (
                                <div className="mr-1 h-3.5 w-3.5 shrink-0 rounded-full border border-slate-200" />
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

          {/* Right: roster stats (courses controls portal stays mounted) */}
          <div className="relative flex h-10 shrink-0 items-center justify-end">
            <div
              className={cn(
                'flex items-center gap-3',
                activeTab !== 'roster' && 'invisible pointer-events-none absolute',
              )}
            >
              <div className="flex items-center justify-center gap-1.5 rounded-xl bg-white px-3 py-2">
                <span className="text-[11px] font-black text-slate-700">{totalCount} นักเรียน</span>
              </div>
              <div className="flex items-center justify-center gap-1.5 rounded-xl bg-sky-50 px-3 py-2">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-sky-400" />
                <span className="text-[11px] font-black text-sky-600">{maleCount} ชาย</span>
              </div>
              <div className="flex items-center justify-center gap-1.5 rounded-xl bg-pink-50 px-3 py-2">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-pink-400" />
                <span className="text-[11px] font-black text-pink-500">{femaleCount} หญิง</span>
              </div>
            </div>
            <div
              id="course-header-portal"
              className={cn(
                'flex min-w-0 flex-wrap items-center justify-end gap-2 md:gap-3',
                activeTab !== 'courses' && 'hidden',
              )}
            />
          </div>
      </div>
        );
        if (!isMdOrBelow) {
          return desktopHeaderHost
            ? createPortal(infoBar, desktopHeaderHost)
            : null;
        }
        return infoBar;
      })()}

      {/* ── Main content ── */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">

        {/* ── Tab content ── */}
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={activeTab}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="flex min-h-0 flex-1 flex-col"
          >
            {activeTab === 'roster' && (
              <div className="flex flex-col flex-1 min-h-0 bg-transparent border-0 overflow-hidden">



                {classStudents.length === 0 ? (
                  <div className="flex flex-col items-center justify-center flex-1 gap-3 text-slate-400">
                    <HiUsers className="w-10 h-10 opacity-30" />
                    <p className="text-sm font-medium">ไม่พบรายชื่อนักเรียนในห้องนี้</p>
                  </div>
                ) : (
                  <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide">
                    <div className="flex flex-col gap-3">
                    {/* Mobile */}
                    <div className="flex flex-col gap-2.5 px-0.5 md:hidden">
                      {classStudents.map((student, i) => {
                        const gender = resolveStudentGender(student);
                        const fullName = studentDisplayName(student);
                        const isPresident = !!student.isPresident;

                        return (
                          <motion.div
                            key={student.id}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.02 }}
                            className="px-0.5 py-0.5"
                          >
                            <div className="rounded-2xl border border-border bg-card p-3">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex min-w-0 flex-1 items-start gap-3">
                                  <StudentAvatar
                                    photoURL={student.photoURL}
                                    studentId={student.id}
                                    name={fullName}
                                    gender={gender}
                                    className="h-9 w-9 shrink-0 rounded-full"
                                  />
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-[13px] font-bold text-foreground font-sukhumvit" title={fullName}>
                                      {fullName}
                                    </p>
                                    <p className="mt-0.5 text-[12px] font-semibold text-muted-foreground font-sukhumvit tabular-nums">
                                      {student.studentCode || '—'}
                                    </p>
                                  </div>
                                </div>
                                <GenderBadge gender={gender} />
                              </div>
                              <div className="mt-2.5 flex items-center justify-between border-t border-border pt-2">
                                <div>
                                  <p className="text-[11px] font-bold text-muted-foreground font-sukhumvit">ชื่อเล่น</p>
                                  <p className="text-[13px] font-semibold text-foreground font-sukhumvit">
                                    {student.nickname || '—'}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => togglePresident(student.id, isPresident)}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-amber-50"
                                  title={isPresident ? 'ยกเลิกหัวหน้าห้อง' : 'ตั้งเป็นหัวหน้าห้อง'}
                                >
                                  <HiStar
                                    className={cn(
                                      'h-4 w-4 transition-colors',
                                      isPresident
                                        ? 'fill-yellow-400 text-yellow-400'
                                        : 'text-muted-foreground/40 hover:text-yellow-400',
                                    )}
                                  />
                                </button>
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>

                    {/* Desktop */}
                    <div className={cn('hidden w-full md:block', TABLE_SHELL)}>
                      <div
                        className="grid w-full gap-3 border-b border-border bg-background px-4 py-3"
                        style={{ gridTemplateColumns: TABLE_GRID }}
                      >
                        <span className={TABLE_HEADER_CELL}>รหัส</span>
                        <span className={TABLE_HEADER_CELL}>นักเรียน</span>
                        <span className={TABLE_HEADER_CELL}>ช.เล่น</span>
                        <span className={cn(TABLE_HEADER_CELL, 'text-center')}>เพศ</span>
                        <span className={cn(TABLE_HEADER_CELL, 'text-center')}>★</span>
                      </div>
                      <div className="flex flex-col">
                        {classStudents.map((student, i) => {
                          const gender = resolveStudentGender(student);
                          const fullName = studentDisplayName(student);
                          const isPresident = !!student.isPresident;

                          return (
                            <motion.div
                              key={student.id}
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ delay: i * 0.015 }}
                              className="grid w-full items-center gap-3 border-b border-border px-4 py-3 transition-colors last:border-b-0 hover:bg-muted/40"
                              style={{ gridTemplateColumns: TABLE_GRID }}
                            >
                              <span className="truncate text-[13px] font-black text-foreground font-sukhumvit tabular-nums">
                                {student.studentCode || '—'}
                              </span>
                              <div className="flex min-w-0 items-center gap-3">
                                <StudentAvatar
                                  photoURL={student.photoURL}
                                  studentId={student.id}
                                  name={fullName}
                                  gender={gender}
                                  className="h-9 w-9 shrink-0 rounded-full"
                                />
                                <div className="min-w-0">
                                  <p className="truncate text-[13px] font-bold text-foreground font-sukhumvit">
                                    {fullName}
                                  </p>
                                  {isPresident && (
                                    <p className="mt-0.5 text-[10px] font-bold text-amber-600 font-sukhumvit">
                                      หัวหน้าห้อง
                                    </p>
                                  )}
                                </div>
                              </div>
                              <span className="truncate text-[13px] font-semibold text-foreground font-sukhumvit">
                                {student.nickname || '—'}
                              </span>
                              <div className="flex justify-center">
                                <GenderBadge gender={gender} />
                              </div>
                              <div className="flex justify-center">
                                <button
                                  type="button"
                                  onClick={() => togglePresident(student.id, isPresident)}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-amber-50"
                                  title={isPresident ? 'ยกเลิกหัวหน้าห้อง' : 'ตั้งเป็นหัวหน้าห้อง'}
                                >
                                  <HiStar
                                    className={cn(
                                      'h-4 w-4 transition-colors',
                                      isPresident
                                        ? 'fill-yellow-400 text-yellow-400'
                                        : 'text-muted-foreground/40 hover:text-yellow-400',
                                    )}
                                  />
                                </button>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'courses' && (
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <ClassCourseTab classRoom={currentClassRoom} />
              </div>
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
