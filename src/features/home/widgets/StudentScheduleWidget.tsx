import { useEffect, useMemo, useState } from 'react';
import { BookOpen, ChevronRight, ChevronLeft, X, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { resolveStudentByAuthUser } from '@/lib/resolveStudentProfile';
import { whenFirestoreGatewayOpen } from '@/lib/firestoreShared/bootstrap';
import { useAuth } from '@/hooks/useAuth';
import { useSchedule } from '@/hooks/useSchedule';
import { useActiveAcademicYear } from '@/hooks/useActiveAcademicYear';
import { db } from '@/lib/firebase';
import { useScheduleSettings } from '@/hooks/useScheduleSettings';
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { subjectCardShadow, subjectColorByName, subjectGradient } from '@/features/schedule/constants/colors';
import { WIDGET_CARD, WIDGET_GLASS } from '../widgetStyles';
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
  const { user, userData, isLoading: authLoading } = useAuth();
  const { entries, classes } = useSchedule();
  const { year: activeYear, activeSemester } = useActiveAcademicYear();
  const [studentClassId, setStudentClassId] = useState<string>('');
  const { periodTimes } = useScheduleSettings(studentClassId);

  const [student, setStudent] = useState<Student | null>(null);
  const [studentLoading, setStudentLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);

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
      if (!user?.uid || authLoading) {
        return;
      }

      setStudentLoading(true);

      try {
        await whenFirestoreGatewayOpen();

        const resolvedStudent = await resolveStudentByAuthUser(user.uid, {
          studentCode: typeof userData?.studentCode === 'string' ? userData.studentCode : undefined,
          email: user.email ?? undefined,
        });

        if (!resolvedStudent) {
          if (!isCancelled) {
            setStudent(null);
            setStudentClassId('');
          }
          return;
        }

        const enrollmentQuery = query(collection(db, 'enrollments'), where('studentId', '==', resolvedStudent.id));
        const enrollmentSnap = await getDocs(enrollmentQuery);

        const enrollmentRows = enrollmentSnap.docs.map((docSnap) => docSnap.data() as {
          classId?: string;
          academicYearId?: string;
          academicYear?: string;
          semester?: 1 | 2;
          enrolledAt?: string;
        }).filter((item) => item.classId);

        const sortEnrollments = (rows: typeof enrollmentRows) =>
          [...rows].sort((a, b) => {
            const yearA = Number(a.academicYearId ?? a.academicYear ?? 0);
            const yearB = Number(b.academicYearId ?? b.academicYear ?? 0);
            if (yearA !== yearB) return yearB - yearA;
            const semA = Number(a.semester ?? 0);
            const semB = Number(b.semester ?? 0);
            if (semA !== semB) return semB - semA;
            return (b.enrolledAt ?? '').localeCompare(a.enrolledAt ?? '');
          });

        const matchedEnrollment =
          sortEnrollments(enrollmentRows).find(
            (item) =>
              String(item.academicYearId ?? item.academicYear) === String(activeYear)
              && Number(item.semester ?? 0) === Number(activeSemester),
          )
          ?? sortEnrollments(enrollmentRows)[0];

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
  }, [user?.uid, user?.email, userData?.studentCode, activeYear, activeSemester, authLoading]);

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

  const highlightEntry = useMemo(() => {
    if (displayedEntries.length === 0) return null;
    if (activeOrNextId) {
      return displayedEntries.find((entry) => entry.id === activeOrNextId) ?? displayedEntries[0];
    }
    return displayedEntries[0];
  }, [activeOrNextId, displayedEntries]);

  const renderPeriodRow = (entry: ScheduleEntry, compact = false) => {
    const timeRange = parseTimeRange(entry.period, periodTimes);
    const isFocus = activeOrNextId === entry.id;
    const color = subjectColorByName(entry.subjectName || entry.subjectId, entry.subjectGroup);
    const cardStyle = {
      background: subjectGradient(color, isFocus),
      boxShadow: subjectCardShadow(color, isFocus),
    };

    const focusBadge = isFocus && viewDay === schoolDay ? (() => {
      const now = new Date();
      const nowMin = now.getHours() * 60 + now.getMinutes();
      const range = parseTimeRange(entry.period, periodTimes);
      if (range && nowMin >= range.startMin && nowMin < range.endMin) return 'กำลังเรียน';
      return 'ถัดไป';
    })() : null;

    if (compact) {
      return (
        <div
          className="rounded-xl px-2.5 py-1.5 overflow-hidden"
          style={cardStyle}
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[10px] font-black text-white/90 shrink-0" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.35)' }}>
              คาบ {entry.period}
            </span>
            <p className="text-[11px] font-black truncate flex-1 text-white" style={{ textShadow: '0 1px 2.5px rgba(0,0,0,0.4)' }}>
              {entry.subjectName}
            </p>
            <span className="text-[10px] font-bold text-white/90 shrink-0 tabular-nums" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.35)' }}>
              {timeRange ? timeRange.start : '--:--'}
            </span>
          </div>
          <p className="text-[10px] font-bold text-white/85 truncate mt-0.5" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.35)' }}>
            {entry.teacherName}
          </p>
        </div>
      );
    }

    return (
      <div
        key={entry.id}
        className="relative overflow-hidden rounded-2xl p-3.5 transition-all"
        style={cardStyle}
      >
        <div className="flex items-start gap-3">
          <div
            className="w-14 h-14 rounded-2xl shrink-0 border flex flex-col items-center justify-center bg-white/20 border-white/30 backdrop-blur-sm"
          >
            <span className="text-[9px] font-black leading-none mb-0.5 uppercase text-white/85">
              คาบ
            </span>
            <span className="text-sm font-black leading-none text-white">
              {entry.period}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            {entry.subjectCode && (
              <p className="text-[9px] font-black leading-none mb-1 text-white/90" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.35)' }}>
                {entry.subjectCode}
              </p>
            )}
            <div className="flex items-center gap-2">
              <p className="text-[13px] font-black text-white truncate leading-tight" style={{ textShadow: '0 1px 2.5px rgba(0,0,0,0.45)' }}>
                {entry.subjectName}
              </p>
              {focusBadge && (
                <span className="text-[8px] font-black text-white bg-white/22 px-2 py-0.5 rounded-full uppercase shrink-0 backdrop-blur-sm">
                  {focusBadge}
                </span>
              )}
            </div>
            <p className="text-[11px] font-bold text-white/90 truncate mt-1" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.35)' }}>
              {entry.teacherName}
            </p>
            {entry.room && (
              <p className="text-[10px] font-bold text-white/75 mt-0.5">ห้อง {entry.room}</p>
            )}
          </div>
          <div className="text-right shrink-0">
            <div className="text-[11px] font-black text-white tabular-nums" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.35)' }}>
              {timeRange ? timeRange.start : '--:--'}
            </div>
            {timeRange && (
              <div className="text-[9px] font-bold text-white/75 tabular-nums">{timeRange.end}</div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderCompactPeriodRow = (entry: ScheduleEntry) => renderPeriodRow(entry, true);

  return (
    <>
    <div
      style={WIDGET_GLASS}
      className={`${WIDGET_CARD} cursor-pointer group`}
      onClick={() => setDrawerOpen(true)}
    >
      <div className="flex items-center justify-between gap-2 shrink-0">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-black text-slate-800 truncate leading-none">ตารางเรียนของฉัน</p>
          <div className="flex items-center gap-1.5 mt-1 min-w-0">
            <p className="text-[10px] font-bold text-slate-400 truncate">
              วัน{DAY_LABELS[viewDay]}{classLabel ? ` · ${classLabel}` : ''}
            </p>
            {viewDay === schoolDay && (
              <span className="px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-500 text-[8px] font-black border border-blue-100 shrink-0">
                วันนี้
              </span>
            )}
          </div>
        </div>
        <ChevronRight size={14} className="text-slate-400 group-hover:text-slate-600 shrink-0" />
      </div>

      <motion.div
        className="flex-1 min-h-0 relative"
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.2}
        onDragEnd={(_, info) => {
          if (info.offset.x > 80) prevDay();
          else if (info.offset.x < -80) nextDay();
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={viewDay}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.15 }}
            className="h-full flex flex-col justify-center"
          >
            {studentLoading || authLoading ? (
              <div className="flex items-center justify-center">
                <div className="w-5 h-5 border-2 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
              </div>
            ) : !student ? (
              <div className="flex items-center justify-center gap-2 text-center">
                <BookOpen size={14} className="text-slate-300 shrink-0" />
                <p className="text-[10px] font-bold text-slate-400">ไม่พบข้อมูลนักเรียนที่ผูกกับบัญชีนี้</p>
              </div>
            ) : !highlightEntry ? (
              <div className="flex items-center justify-center gap-2 text-center">
                <BookOpen size={14} className="text-slate-300 shrink-0" />
                <p className="text-[10px] font-bold text-slate-400">ไม่มีตารางเรียนในวัน{DAY_LABELS[viewDay]}</p>
              </div>
            ) : (
              renderCompactPeriodRow(highlightEntry)
            )}
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </div>

    <Drawer open={drawerOpen} onOpenChange={setDrawerOpen} direction="right">
      <DrawerContent
        className={[
          'h-dvh flex flex-col p-0 rounded-none',
          'data-[vaul-drawer-direction=right]:w-screen data-[vaul-drawer-direction=right]:max-w-none',
          'data-[vaul-drawer-direction=right]:before:inset-0 data-[vaul-drawer-direction=right]:before:rounded-none',
          'sm:h-full sm:rounded-l-3xl',
          'sm:data-[vaul-drawer-direction=right]:w-full sm:data-[vaul-drawer-direction=right]:max-w-md',
          'sm:data-[vaul-drawer-direction=right]:before:inset-2 sm:data-[vaul-drawer-direction=right]:before:rounded-4xl',
        ].join(' ')}
      >
        <DrawerHeader className="px-4 pb-2 shrink-0">
          <div className="relative flex items-center justify-center min-h-10">
            <button
              type="button"
              onClick={prevDay}
              className="absolute left-0 top-1/2 -translate-y-1/2 inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 active:scale-[0.98] transition"
              aria-label="วันก่อนหน้า"
            >
              <ChevronLeft size={16} />
            </button>
            <div className="min-w-0 text-center px-12">
              <DrawerTitle className="text-base font-black text-slate-800">ตารางเรียนของฉัน</DrawerTitle>
              <DrawerDescription className="text-xs text-slate-500">
                วัน{DAY_LABELS[viewDay]}{classLabel ? ` · ${classLabel}` : ''}
                {viewDay === schoolDay ? ' · วันนี้' : ''}
              </DrawerDescription>
            </div>
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              className="absolute right-0 top-1/2 -translate-y-1/2 inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 active:scale-[0.98] transition"
              aria-label="ปิดตารางเรียน"
            >
              <X size={16} />
            </button>
          </div>

          <div className="flex gap-1 mt-3 p-1 rounded-2xl bg-slate-100/80">
            {([1, 2, 3, 4, 5] as SchoolDay[]).map(day => (
              <button
                key={day}
                type="button"
                onClick={() => setViewDay(day)}
                className={`flex-1 py-1.5 rounded-xl text-[11px] font-black transition-all ${
                  viewDay === day
                    ? 'bg-white text-slate-800 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {DAY_LABELS[day].slice(0, 3)}
              </button>
            ))}
          </div>
        </DrawerHeader>

        <div className="px-4 pb-4 overflow-y-auto flex-1 min-h-0">
          {studentLoading || authLoading ? (
            <div className="h-full flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
            </div>
          ) : !student ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center">
              <BookOpen size={20} className="text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-500">ไม่พบข้อมูลนักเรียนที่ผูกกับบัญชีนี้</p>
            </div>
          ) : displayedEntries.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center">
              <Clock size={20} className="text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-500">ไม่มีตารางเรียนในวัน{DAY_LABELS[viewDay]}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {displayedEntries.map(entry => renderPeriodRow(entry))}
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
    </>
  );
}
