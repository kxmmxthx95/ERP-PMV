import { useEffect, useMemo, useState } from 'react';
import { BookOpen, Clock3, MapPin, UserRound, Maximize2, Minimize2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { doc, getDoc, collection, query, where, limit, getDocs } from 'firebase/firestore';
import { useAuth } from '@/hooks/useAuth';
import { useSchedule } from '@/hooks/useSchedule';
import { useActiveAcademicYear } from '@/hooks/useActiveAcademicYear';
import { db } from '@/lib/firebase';
import { useScheduleSettings } from '@/hooks/useScheduleSettings';
import { useTeacherManager } from '@/features/teachers/hooks/useTeacherManager';
import { WIDGET_GLASS } from '../widgetStyles';
import type { Student } from '@/types/student';
import type { ScheduleEntry, SchoolDay } from '@/types/schedule';

const DAY_LABELS: Record<number, string> = {
  0: 'อาทิตย์',
  1: 'จันทร์',
  2: 'อังคาร',
  3: 'พุธ',
  4: 'พฤหัสบดี',
  5: 'ศุกร์',
  6: 'เสาร์',
};

function parseTimeRange(period: number, periodTimes: Record<number, string>): { start: string; end: string; startMin: number; endMin: number } | null {
  const raw = periodTimes[period];
  if (!raw) return null;

  const parts = raw.split(/–|-/).map((part) => part.trim());
  if (parts.length < 2) return null;

  const [startHour, startMinute] = parts[0].split(':').map(Number);
  const [endHour, endMinute] = parts[1].split(':').map(Number);

  if ([startHour, startMinute, endHour, endMinute].some((v) => Number.isNaN(v))) return null;

  return {
    start: parts[0],
    end: parts[1],
    startMin: startHour * 60 + startMinute,
    endMin: endHour * 60 + endMinute,
  };
}

export default function StudentScheduleWidget() {
  const { user } = useAuth();
  const { entries, classes } = useSchedule();
  const { teachers } = useTeacherManager();
  const { year: activeYear, activeSemester } = useActiveAcademicYear();
  const [studentClassId, setStudentClassId] = useState<string>('');
  const { periodTimes } = useScheduleSettings(studentClassId);
  const [isExpanded, setIsExpanded] = useState(false);

  const [student, setStudent] = useState<Student | null>(null);
  const [studentLoading, setStudentLoading] = useState(true);

  const todayNum = new Date().getDay();
  const schoolDay = todayNum >= 1 && todayNum <= 5 ? (todayNum as SchoolDay) : null;

  // View State for Day Swiping
  const [viewDay, setViewDay] = useState<SchoolDay>(() => {
    if (schoolDay) return schoolDay;
    return 1; // Default to Monday
  });

  const nextDay = () => setViewDay((prev) => (prev < 5 ? (prev + 1) as SchoolDay : 1 as SchoolDay));
  const prevDay = () => setViewDay((prev) => (prev > 1 ? (prev - 1) as SchoolDay : 5 as SchoolDay));

  useEffect(() => {
    let isCancelled = false;

    async function fetchStudent() {
      if (!user?.uid) {
        if (!isCancelled) {
          setStudent(null);
          setStudentClassId('');
          setStudentLoading(false);
        }
        return;
      }

      setStudentLoading(true);

      try {
        let resolvedStudent: Student | null = null;

        const directSnap = await getDoc(doc(db, 'students', user.uid));
        if (directSnap.exists()) {
          resolvedStudent = { id: directSnap.id, ...directSnap.data() } as Student;
        } else {
          const fallbackQuery = query(collection(db, 'students'), where('userId', '==', user.uid), limit(1));
          const fallbackSnap = await getDocs(fallbackQuery);
          if (!fallbackSnap.empty) {
            const first = fallbackSnap.docs[0];
            resolvedStudent = { id: first.id, ...first.data() } as Student;
          }
        }

        if (!resolvedStudent) {
          if (!isCancelled) {
            setStudent(null);
            setStudentClassId('');
          }
          return;
        }

        const enrollmentQuery = query(collection(db, 'enrollments'), where('studentId', '==', resolvedStudent.id));
        const enrollmentSnap = await getDocs(enrollmentQuery);

        const matchedEnrollment = enrollmentSnap.docs
          .map((docSnap) => docSnap.data() as {
            classId?: string;
            academicYearId?: string;
            semester?: 1 | 2;
            enrolledAt?: string;
          })
          .filter((item) => item.classId)
          .sort((a, b) => {
            const yearA = Number(a.academicYearId ?? 0);
            const yearB = Number(b.academicYearId ?? 0);
            if (yearA !== yearB) return yearB - yearA;

            const semA = Number(a.semester ?? 0);
            const semB = Number(b.semester ?? 0);
            if (semA !== semB) return semB - semA;

            return (b.enrolledAt ?? '').localeCompare(a.enrolledAt ?? '');
          })
          .find((item) => String(item.academicYearId) === String(activeYear) && Number(item.semester ?? 0) === Number(activeSemester));

        const studentWithClass = resolvedStudent as Student & { classroomId?: string; classId?: string };
        const fallbackClassId = studentWithClass.classroomId || studentWithClass.classId || '';
        const resolvedClassId = matchedEnrollment?.classId || fallbackClassId;

        if (!isCancelled) {
          setStudent(resolvedStudent);
          setStudentClassId(resolvedClassId);
        }
      } catch {
        if (!isCancelled) {
          setStudent(null);
          setStudentClassId('');
        }
      } finally {
        if (!isCancelled) setStudentLoading(false);
      }
    }

    fetchStudent();

    return () => {
      isCancelled = true;
    };
  }, [user?.uid, activeYear, activeSemester]);

  const displayedEntries = useMemo(() => {
    if (!viewDay || !studentClassId) return [];

    return entries
      .filter(
        (entry) =>
          entry.classId === studentClassId
          && entry.day === viewDay
          && String(entry.year) === String(activeYear)
          && Number(entry.semester) === Number(activeSemester),
      )
      .sort((a, b) => a.period - b.period);
  }, [entries, studentClassId, viewDay, activeYear, activeSemester]);

  const activeOrNextId = useMemo(() => {
    if (viewDay !== schoolDay || displayedEntries.length === 0) return null;

    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();

    const active = displayedEntries.find((entry) => {
      const range = parseTimeRange(entry.period, periodTimes);
      if (!range) return false;
      return nowMin >= range.startMin && nowMin < range.endMin;
    });
    if (active) return active.id;

    const next = displayedEntries.find((entry) => {
      const range = parseTimeRange(entry.period, periodTimes);
      if (!range) return false;
      return range.startMin > nowMin;
    });

    return next?.id ?? null;
  }, [displayedEntries, viewDay, schoolDay, periodTimes]);

  const classLabel = useMemo(() => {
    if (!studentClassId) return '';
    return classes.find((item) => item.id === studentClassId)?.label || studentClassId;
  }, [classes, studentClassId]);

  const renderPeriodRow = (entry: ScheduleEntry) => {
    const timeRange = parseTimeRange(entry.period, periodTimes);
    const isFocus = activeOrNextId === entry.id;
    const teacher = teachers.find((t) => t.id === entry.teacherId);

    return (
      <div
        key={entry.id}
        className={`rounded-2xl border p-3 transition-all ${
          isFocus
            ? 'bg-blue-50 border-blue-200 shadow-sm shadow-blue-500/5'
            : 'bg-white/70 border-slate-100'
        }`}
      >
        <div className="flex items-center gap-3.5">
          {/* Teacher Avatar (Left Aligned & Large) */}
          <div className="relative shrink-0">
            {teacher?.photoURL ? (
              <img
                src={teacher.photoURL}
                alt=""
                className={`w-11 h-11 rounded-full object-cover border-2 transition-all ${
                  isFocus ? 'border-blue-200 shadow-md' : 'border-white shadow-sm'
                }`}
              />
            ) : (
              <div className="w-11 h-11 rounded-full bg-slate-100 flex items-center justify-center border-2 border-white shadow-sm">
                <UserRound size={20} className="text-slate-300" />
              </div>
            )}
            {/* Period Badge on Avatar */}
            <div className={`absolute -bottom-1 -right-1 px-1.5 py-0.5 rounded-lg text-[9px] font-black shadow-sm ${
              isFocus ? 'bg-blue-600 text-white' : 'bg-slate-800 text-white'
            }`}>
              {entry.period}
            </div>
          </div>

          {/* Subject & Teacher Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <p className={`text-[13.5px] font-black truncate ${isFocus ? 'text-blue-900' : 'text-slate-800'}`}>
                {entry.subjectName}
              </p>
              {isFocus && (
                 <span className="flex h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
              )}
            </div>
            
            <div className="flex flex-col gap-0.5">
              <p className="text-[10.5px] font-bold text-slate-500 truncate">
                {entry.teacherName}
              </p>
              {entry.room && (
                <div className="flex items-center gap-1 text-[9px] font-bold text-slate-400 uppercase tracking-tight">
                  <MapPin size={9} />
                  {entry.room}
                </div>
              )}
            </div>
          </div>

          {/* Time (Right Aligned) */}
          <div className="shrink-0 text-right">
            <p className="text-[9px] font-black text-slate-300 uppercase tracking-wider mb-1">เวลาเรียน</p>
            <div className={`inline-flex items-center px-2.5 py-1 rounded-full font-black text-[11px] transition-all ${
              isFocus 
                ? 'bg-blue-600 text-white shadow-md shadow-blue-200' 
                : 'bg-slate-100 text-slate-600'
            }`}>
              {timeRange ? `${timeRange.start} - ${timeRange.end}` : '--:--'}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={WIDGET_GLASS} className="rounded-3xl p-5 flex flex-col gap-4 h-full w-full overflow-hidden">
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-black text-slate-800 leading-none">ตารางเรียนของฉัน</p>
          <div className="flex items-center gap-1.5 mt-1">
            <p className="text-[10px] font-bold text-slate-400 truncate">วัน{DAY_LABELS[viewDay]} {classLabel ? `· ${classLabel}` : ''}</p>
            {viewDay === schoolDay && (
               <span className="px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-500 text-[8px] font-black uppercase tracking-wider border border-blue-100">วันนี้</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {displayedEntries.length > 0 && (
            <span className="text-[10px] font-black bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-lg border border-emerald-100 shrink-0">
              {displayedEntries.length} คาบ
            </span>
          )}
          <button 
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-7 h-7 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            {isExpanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        </div>
      </div>

      <motion.div 
        className="flex-1 min-h-0 relative cursor-grab active:cursor-grabbing"
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.2}
        onDragEnd={(_, info) => {
          if (info.offset.x > 80) prevDay();
          else if (info.offset.x < -80) nextDay();
        }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={viewDay}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="h-full"
          >
            {studentLoading ? (
              <div className="h-full min-h-[120px] flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
              </div>
            ) : !student ? (
              <div className="h-full min-h-[120px] flex flex-col items-center justify-center text-center gap-2">
                <BookOpen size={18} className="text-slate-300" />
                <p className="text-[11px] font-bold text-slate-400">ไม่พบข้อมูลนักเรียนที่ผูกกับบัญชีนี้</p>
              </div>
            ) : displayedEntries.length === 0 ? (
              <div className="h-full min-h-[160px] flex flex-col items-center justify-center text-center gap-2 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                <Clock3 size={18} className="text-slate-300" />
                <p className="text-[11px] font-bold text-slate-400">ไม่มีตารางเรียนในวัน{DAY_LABELS[viewDay]}</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <AnimatePresence mode="popLayout" initial={false}>
                  {isExpanded
                    ? displayedEntries.map((entry) => (
                        <motion.div
                          key={entry.id}
                          layout
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          className="mb-2 last:mb-0"
                        >
                          {renderPeriodRow(entry)}
                        </motion.div>
                      ))
                    : displayedEntries
                        .filter((e) => e.id === activeOrNextId || displayedEntries.indexOf(e) === 0)
                        .slice(0, 1)
                        .map((entry) => (
                          <motion.div
                            key={entry.id}
                            layout
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                          >
                            {renderPeriodRow(entry)}
                          </motion.div>
                        ))}
                </AnimatePresence>
                
                {!isExpanded && displayedEntries.length > 1 && (
                  <button 
                    onClick={() => setIsExpanded(true)}
                    className="py-2 text-[10px] font-black text-slate-400 hover:text-blue-500 transition-colors uppercase tracking-widest text-center w-full"
                  >
                    ดูอีก {displayedEntries.length - 1} คาบเรียน
                  </button>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
