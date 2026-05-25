import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  CheckCircle,
  CheckSquare,
  RotateCcw,
  Clock,
  Coffee,
  FileCheck,
  History,
  MapPin,
  Search,
  Save,
  Trash2,
  UserCheck,
  UserX,
  Users, CalendarDays, BarChart3,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from 'sonner';
import type { AttendanceRecord, AttendanceStatus, NewAttendanceRecord } from '@/types/teaching';
import type { LeaveRequest } from '@/types/leave';
import type { ClassRoom } from '@/types/class';
import type { Subject } from '@/types/curriculum';
import type { TeacherProfile } from '@/types/teacher';
import { useSchedule } from '@/hooks/useSchedule';
import { useSoundEffects } from '@/hooks/useSoundEffects';
import {
  DAY_LABELS,
  SCHOOL_DAYS,
  type ScheduleEntry
} from '@/types/schedule';
import { useScheduleSettings } from '@/hooks/useScheduleSettings';
import { subjectColorByName } from '../../schedule/constants/colors';
import StudentAvatar from '@/features/students/components/StudentAvatar';


interface StudentRosterItem {
  student: {
    id: string;
    userId?: string;
    uid?: string;
    authUid?: string;
    studentCode: string;
    prefix: string;
    firstName: string;
    lastName: string;
    photoURL?: string;
    gender?: 'male' | 'female';
  };
}

interface StudentRow {
  studentId: string;
  studentCode: string;
  studentName: string;
  imageUrl?: string;
  gender?: 'male' | 'female';
  status: AttendanceStatus | null;
  note: string;
  autoFilledLeave?: boolean;
}

interface AttendanceSheetProps {
  teacherId: string;
  academicYearId: string;
  semester: 1 | 2;
  mySubjects: Subject[];
  classes: ClassRoom[];
  teachers?: TeacherProfile[];
  getStudentsForClass: (classId: string) => StudentRosterItem[];
  getAttendanceForSession: (subjectId: string, classId: string, date: string, period: number) => AttendanceRecord[];
  onSave: (records: NewAttendanceRecord[]) => Promise<void>;
  attendance?: AttendanceRecord[];
  leaveRequests?: LeaveRequest[];
}

type DepartmentFilter = 'all' | 'early' | 'primary' | 'secondary';
type AttendanceSubview = 'today' | 'history' | 'summary';

interface ScheduleGridProps {
  classEntries: ScheduleEntry[];
  onSlotClick: (entry: ScheduleEntry) => void;
  selectedSlotId: string | null;
  classId: string | null;
  attendance: AttendanceRecord[];
  teachersById: Record<string, TeacherProfile>;
  getStudentsForClass: (classId: string) => StudentRosterItem[];
}

const DEPARTMENT_OPTIONS: Array<{ id: DepartmentFilter; label: string }> = [
  { id: 'all', label: 'ทั้งหมด' },
  { id: 'early', label: 'อนุบาล' },
  { id: 'primary', label: 'ประถม' },
  { id: 'secondary', label: 'มัธยม' },
];

const DEPARTMENT_GRADES: Record<DepartmentFilter, string[]> = {
  all: [],
  early: ['อ.1', 'อ.2', 'อ.3'],
  primary: ['ป.1', 'ป.2', 'ป.3', 'ป.4', 'ป.5', 'ป.6'],
  secondary: ['ม.1', 'ม.2', 'ม.3', 'ม.4', 'ม.5', 'ม.6'],
};

const SUBVIEW_OPTIONS: Array<{ id: AttendanceSubview; label: string; icon: any }> = [
  { id: 'today', label: 'วันนี้', icon: CalendarDays },
  { id: 'history', label: 'ย้อนหลัง', icon: History },
  { id: 'summary', label: 'สรุปผล', icon: BarChart3 },
];

const STATUS_CONFIG: Record<AttendanceStatus, {
  label: string;
  shortLabel: string;
  color: string;
  bg: string;
  gradient: string;
  border: string;
  icon: typeof UserCheck;
}> = {
  present: { label: 'มาเรียน', shortLabel: 'ม', color: '#059669', bg: '#d1fae5', gradient: 'bg-gradient-to-br from-emerald-500/10 to-emerald-600/25', border: 'border-emerald-500/60', icon: UserCheck },
  late: { label: 'สาย', shortLabel: 'ส', color: '#d97706', bg: '#fef3c7', gradient: 'bg-gradient-to-br from-amber-400/15 to-amber-600/25', border: 'border-amber-500/60', icon: Clock },
  absent: { label: 'ขาดเรียน', shortLabel: 'ข', color: '#e11d48', bg: '#ffe4e6', gradient: 'bg-gradient-to-br from-rose-500/10 to-rose-600/25', border: 'border-rose-500/60', icon: UserX },
  excused: { label: 'ลากิจ/ป่วย', shortLabel: 'ล', color: '#2563eb', bg: '#dbeafe', gradient: 'bg-gradient-to-br from-blue-500/10 to-blue-600/25', border: 'border-blue-500/60', icon: FileCheck },
  leave: { label: 'ลา (ทางการ)', shortLabel: 'ลว', color: '#7c3aed', bg: '#f3e8ff', gradient: 'bg-gradient-to-br from-violet-500/10 to-violet-600/25', border: 'border-violet-500/60', icon: CheckSquare },
};

const STATUS_BUTTONS: AttendanceStatus[] = ['present', 'late', 'absent', 'leave'];

function formatSessionDate(date: string) {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function toLocalDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function resolveNearestClassDate(day: number) {
  const now = new Date();
  const currentDay = now.getDay() || 7; // 1=จันทร์ ... 7=อาทิตย์
  const diff = day - currentDay;
  const targetDate = new Date(now);
  targetDate.setDate(now.getDate() + diff);
  return toLocalDateString(targetDate);
}

function toIdentityList(student: StudentRosterItem['student']): string[] {
  const raw = [student.id, student.userId, student.uid, student.authUid];
  return [...new Set(raw.map(v => (typeof v === 'string' ? v.trim() : '')).filter(Boolean))];
}

function normalizeThaiName(value: string): string {
  return value.replace(/\s+/g, '').trim();
}

function withAlpha(color: string, alpha: number): string {
  const m = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*[\d.]+)?\s*\)/i);
  if (!m) return color;
  const [, r, g, b] = m;
  return `rgba(${r},${g},${b},${alpha})`;
}

function subjectGradient(
  color: { bg: string; border: string; text: string; accent: string },
  isCurrent = false,
): string {
  const strong = withAlpha(color.accent, isCurrent ? 0.94 : 0.9);
  const mid = withAlpha(color.accent, isCurrent ? 0.82 : 0.76);
  const soft = withAlpha(color.bg, isCurrent ? 0.88 : 0.82);
  const sheen = withAlpha(color.accent, isCurrent ? 0.38 : 0.28);
  return [
    `radial-gradient(120% 130% at 100% 100%, ${sheen} 0%, transparent 56%)`,
    'radial-gradient(140% 120% at 0% 0%, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0) 52%)',
    `linear-gradient(160deg, ${strong} 0%, ${mid} 46%, ${soft} 100%)`,
  ].join(', ');
}

const REST_GRADIENT = [
  'radial-gradient(125% 120% at 100% 0%, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0) 56%)',
  'linear-gradient(160deg, rgba(16,185,129,0.95) 0%, rgba(45,212,191,0.9) 100%)',
].join(', ');

function ScheduleGrid({
  classEntries,
  onSlotClick,
  selectedSlotId,
  classId,
  attendance,
  teachersById,
  getStudentsForClass,
}: ScheduleGridProps) {
  const { periodCount, lunchPeriods, breakPeriods, periodTimes } = useScheduleSettings(classId || undefined);
  const periods = Array.from({ length: periodCount }, (_, i) => i + 1);
  const todayDay = new Date().getDay() || 7;
  const [mobileDay, setMobileDay] = useState<number>(
    SCHOOL_DAYS.includes(todayDay as (typeof SCHOOL_DAYS)[number]) ? todayDay : SCHOOL_DAYS[0]
  );

  const mobileDayLabels: Record<number, string> = {
    1: 'Mon',
    2: 'Tue',
    3: 'Wed',
    4: 'Thu',
    5: 'Fri',
  };

  const currentPeriod = useMemo(() => {
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    let found = -1;

    Object.entries(periodTimes).forEach(([p, timeRange]) => {
      const [start, end] = timeRange.split(' - ');
      if (!start) return;

      const [hS, mS] = start.split(':').map(Number);
      const startTime = hS * 60 + mS;

      let endTime = startTime + 50;
      if (end) {
        const [hE, mE] = end.split(':').map(Number);
        endTime = hE * 60 + mE;
      }

      if (currentTime >= startTime && currentTime <= endTime + 10) {
        found = Number(p);
      }
    });

    return found;
  }, [periodTimes]);

  const renderEntryButton = (entry: ScheduleEntry, compact = false) => {
    const isSelected = selectedSlotId === entry.id;
    const color = subjectColorByName(entry.subjectName || entry.subjectCode);
    const isCurrent = entry.day === todayDay && entry.period === currentPeriod;

    const todayStr = resolveNearestClassDate(entry.day);
    const slotAttendance = attendance.filter(a =>
      a.subjectId === entry.subjectId &&
      a.classId === entry.classId &&
      a.date === todayStr &&
      a.period === entry.period
    );

    const totalStudents = getStudentsForClass(entry.classId).length;
    const checkedCount = slotAttendance.length;

    let statusColor = 'bg-rose-500';
    if (checkedCount > 0) {
      if (checkedCount < totalStudents) {
        statusColor = 'bg-amber-400';
      } else {
        statusColor = 'bg-emerald-500';
      }
    }

    const isToday = entry.day === todayDay;
    const teacherParts = entry.teacherName ? entry.teacherName.trim().split(/\s+/) : [];
    const teacherFirst = teacherParts.length >= 2 ? teacherParts.slice(0, -1).join(' ') : (entry.teacherName || '-');
    const teacherLast = teacherParts.length >= 2 ? teacherParts[teacherParts.length - 1] : '';
    const teacherPhotoURL = teachersById[entry.teacherId]?.photoURL;
    const teacherInitials = teacherParts
      .slice(0, 2)
      .map((part) => part[0] ?? '')
      .join('')
      .toUpperCase() || 'T';

    return (
      <motion.button
        key={entry.id}
        whileHover={isToday ? { opacity: 0.95 } : {}}
        whileTap={isToday ? { scale: 0.98 } : {}}
        onClick={() => isToday && onSlotClick(entry)}
        disabled={!isToday}
        className={`group relative w-full overflow-hidden rounded-xl cursor-pointer transition-all duration-150 flex flex-col justify-between text-left ${
          compact ? 'p-2' : 'p-2.5'
        } ${!isToday ? 'opacity-40 grayscale-[0.4] scale-[0.98] cursor-not-allowed' : ''}`}
        style={{
          background: subjectGradient(color, isCurrent),
          minHeight: compact ? 62 : 70,
          boxShadow: isSelected
            ? `0 0 0 2px ${withAlpha(color.accent, 0.26)}, inset 0 1px 0 rgba(255,255,255,0.42), 0 12px 20px -18px ${withAlpha(color.accent, 0.68)}`
            : `inset 0 1px 0 rgba(255,255,255,0.34), 0 12px 20px -18px ${withAlpha(color.accent, 0.52)}`,
        }}
      >
        <div
          className="pointer-events-none absolute -right-7 -top-7 h-16 w-16 rounded-full"
          style={{
            background: `radial-gradient(circle, ${withAlpha(color.accent, 0.24)} 0%, ${withAlpha(color.accent, 0.04)} 68%, transparent 100%)`,
          }}
        />
        <div
          className="pointer-events-none absolute -bottom-8 right-5 h-14 w-14 rounded-full"
          style={{
            background: `radial-gradient(circle, ${withAlpha(color.accent, 0.16)} 0%, ${withAlpha(color.accent, 0.03)} 62%, transparent 100%)`,
          }}
        />

        <div className="select-none flex items-start justify-between gap-1.5 w-full flex-1">
          <div className="min-w-0 flex-1">
            <p
              className="text-[9px] font-black leading-none mb-1 text-white"
              style={{ textShadow: '0 1px 2px rgba(0,0,0,0.4)' }}
            >
              {entry.subjectCode}
            </p>
            <p
              className={`${compact ? 'text-[10px]' : 'text-[10.5px]'} font-extrabold text-white leading-tight line-clamp-2`}
              style={{ textShadow: '0 1px 2.5px rgba(0,0,0,0.45)' }}
            >
              {entry.subjectName}
            </p>
          </div>

          <div className="shrink-0 text-right flex items-center gap-1.5 self-end mb-0.5 pl-1.5">
            <div className="flex flex-col items-end leading-tight">
              <span
                className="text-[8.5px] font-bold text-white leading-tight whitespace-nowrap block"
                style={{ textShadow: '0 1px 2px rgba(0,0,0,0.4)' }}
              >
                {teacherFirst}
              </span>
              {teacherLast && (
                <span
                  className="text-[8.5px] font-bold text-white/90 leading-tight whitespace-nowrap block"
                  style={{ textShadow: '0 1px 2px rgba(0,0,0,0.4)' }}
                >
                  {teacherLast}
                </span>
              )}
            </div>
            <Avatar
              className={`${compact ? 'w-6 h-6' : 'w-7 h-7'} rounded-full shrink-0 border border-white/40 shadow-sm`}
            >
              <AvatarImage src={teacherPhotoURL} alt={entry.teacherName} />
              <AvatarFallback className="bg-white/85 text-[9px] font-black text-slate-700">
                {teacherInitials}
              </AvatarFallback>
            </Avatar>
          </div>
        </div>

        <div className="absolute right-2 top-2 flex items-center gap-1">
          <div className={`h-1.5 w-1.5 rounded-full ${statusColor}`} />
          {checkedCount === totalStudents && totalStudents > 0 && (
            <div className="inline-flex items-center justify-center rounded-full bg-emerald-500 p-0.5 text-white shadow-sm">
              <CheckSquare size={8} strokeWidth={4} />
            </div>
          )}
        </div>
      </motion.button>
    );
  };

  return (
    <div className="space-y-2">
      <div className="md:hidden mb-2" id="schedule-grid-export-mobile">
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: 'rgba(255,255,255,0.92)',
            backdropFilter: 'blur(18px) saturate(150%)',
            WebkitBackdropFilter: 'blur(18px) saturate(150%)',
            border: '1px solid rgba(0,0,0,0.08)',
            boxShadow: 'none',
          }}
        >
          <div className="px-2.5 pt-2.5 pb-2 border-b border-black/5">
            <div className="grid grid-cols-5 gap-1 rounded-xl bg-black/[0.04] p-1">
              {SCHOOL_DAYS.map(day => {
                const active = mobileDay === day;
                return (
                  <button
                    key={day}
                    onClick={() => setMobileDay(day)}
                    className={`h-8 rounded-lg text-[11px] font-black transition-all ${
                      active ? 'bg-blue-600 text-white shadow-sm' : 'text-black/55 hover:bg-white/70'
                    }`}
                  >
                    {mobileDayLabels[day]}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="divide-y divide-black/[0.05]">
            {periods.map(period => {
              const isLunch = lunchPeriods.includes(period);
              const isBreak = breakPeriods.includes(period);
              const isRest = isLunch || isBreak;
              const isCurrent = currentPeriod === period && !isRest;
              const timeStr = periodTimes[period] || '';
              const mobileSlots = classEntries.filter(entry => entry.day === mobileDay && entry.period === period);

              return (
                <div
                  key={`mobile-${mobileDay}-${period}`}
                  className="grid grid-cols-[70px_1fr] gap-2 px-2 py-2"
                  style={{ background: isCurrent ? 'rgba(251,191,36,0.08)' : undefined }}
                >
                  <div className="flex flex-col justify-center items-center text-center px-1">
                    <span className="text-[9px] font-black text-black/75">{isRest ? 'พัก' : `คาบ ${period}`}</span>
                    <span className="text-[9px] font-semibold text-black/60 leading-tight mt-0.5 whitespace-pre-line">
                      {timeStr.replace(' - ', '\n')}
                    </span>
                  </div>

                  {isLunch ? (
                    <div
                      className="min-h-[52px] rounded-xl flex items-center justify-center gap-1.5 text-[10px] font-black text-white uppercase tracking-wide"
                      style={{ background: REST_GRADIENT, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.35)' }}
                    >
                      <Coffee size={12} className="text-white" />
                      LUNCH BREAK
                    </div>
                  ) : isBreak ? (
                    <div
                      className="min-h-[52px] rounded-xl flex items-center justify-center gap-1.5 text-[10px] font-black text-white uppercase tracking-wide"
                      style={{ background: REST_GRADIENT, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.35)' }}
                    >
                      <Clock size={11} className="text-white" />
                      BREAK
                    </div>
                  ) : (
                    <div className="rounded-xl">
                      <div className="flex h-full min-h-[70px] flex-col gap-1">
                        {mobileSlots.length === 0 ? (
                          <div className="h-full w-full rounded-xl" />
                        ) : (
                          mobileSlots.map(entry => renderEntryButton(entry, true))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="hidden md:block overflow-x-auto pb-1" id="schedule-grid-export">
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: 'rgba(255,255,255,0.78)',
          backdropFilter: 'blur(28px) saturate(160%)',
          WebkitBackdropFilter: 'blur(28px) saturate(160%)',
          border: '1px solid rgba(0,0,0,0.08)',
          boxShadow: 'none',
          minWidth: 700,
        }}
      >
        <div className="grid grid-cols-[76px_repeat(5,1fr)] bg-black/[0.025] border-b border-black/[0.08]">
          <div className="p-3 flex items-center justify-center border-r border-black/[0.06]">
            <span className="text-[9px] font-black uppercase tracking-widest text-blue-600/60">คาบ</span>
          </div>
          {SCHOOL_DAYS.map(day => (
            <div key={day} className="py-3 px-2 text-center border-l border-black/[0.06]">
              <p className="text-[12px] font-black text-blue-700/90">{DAY_LABELS[day]}</p>
            </div>
          ))}
        </div>

        {periods.map(period => {
          const isLunch = lunchPeriods.includes(period);
          const isBreak = breakPeriods.includes(period);
          const isRest = isLunch || isBreak;
          const isCurrent = currentPeriod === period && !isRest;
          const timeStr = periodTimes[period] || '';

          return (
            <div
              key={period}
              className="grid grid-cols-[76px_repeat(5,1fr)] border-t border-black/[0.06]"
              style={{
                minHeight: isLunch ? 40 : 85,
                background: isCurrent ? 'rgba(251,191,36,0.06)' : undefined,
                outline: isCurrent ? '2px solid rgba(251,191,36,0.30)' : undefined,
                outlineOffset: '-1px',
              }}
            >
              <div className="flex flex-col items-center justify-center bg-black/[0.02] border-r border-black/[0.06] py-2 relative overflow-hidden">
                {isRest ? (
                  <div className={`flex flex-col items-center justify-center ${isLunch ? 'text-orange-600' : 'text-blue-600'}`}>
                    {isLunch ? <Coffee size={13} /> : <Clock size={11} />}
                    <span className="text-[8px] font-black uppercase mt-0.5">{isLunch ? 'L' : 'B'}</span>
                  </div>
                ) : (
                  <>
                    <span className="text-[11px] font-black text-blue-700/85">{period}</span>
                    <span className="mt-1 text-[9px] font-bold text-blue-600/60">{timeStr}</span>
                  </>
                )}
              </div>

              {isRest ? (
                <div
                  className="col-span-5 flex items-center justify-center gap-2 border-l border-black/[0.06]"
                  style={{
                    background: REST_GRADIENT,
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.34)',
                  }}
                >
                  {isLunch ? (
                    <>
                      <Coffee size={14} className="text-white" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-white">
                        พักกลางวัน — Lunch Break
                      </span>
                    </>
                  ) : (
                    <>
                      <Clock size={13} className="text-white" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-white">
                        พักเบรก — Short Break
                      </span>
                    </>
                  )}
                </div>
              ) : (
                SCHOOL_DAYS.map(day => {
                  const slots = classEntries.filter(entry => entry.day === day && entry.period === period);

                  return (
                    <div key={`${day}-${period}`} className="min-h-[85px] border-l border-black/[0.06] p-[3px]">
                      <div className="flex h-full flex-col gap-1">
                        {slots.length === 0 ? (
                          <div className="h-full w-full rounded-xl" />
                        ) : (
                          slots.map(entry => renderEntryButton(entry))
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          );
        })}
      </div>
      </div>
    </div>
  );
}

export default function AttendanceSheet({
  teacherId,
  academicYearId,
  semester,
  mySubjects,
  classes,
  teachers = [],
  getStudentsForClass,
  getAttendanceForSession,
  onSave,
  attendance = [],
  leaveRequests = [],
}: AttendanceSheetProps) {
  const [searchParams] = useSearchParams();
  const { entries: scheduleEntries } = useSchedule();
  const todayDate = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();

  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedDate, setSelectedDate] = useState(todayDate);
  const [selectedPeriod, setSelectedPeriod] = useState(1);
  const [viewMode, setViewMode] = useState<'schedule' | 'attendance'>('schedule');
  const [rows, setRows] = useState<StudentRow[]>([]);
  // keep a ref in sync so the auto-sync effect can read current rows without
  // adding `rows` to its dependency array (which would cause an infinite loop)
  useEffect(() => { rowsRef.current = rows; }, [rows]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState<DepartmentFilter>('all');
  const [selectedLevel, setSelectedLevel] = useState<string | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);

  const [subView, setSubView] = useState<AttendanceSubview>('today');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<ScheduleEntry | null>(null);
  const [filtersTarget, setFiltersTarget] = useState<HTMLElement | null>(null);

  const rowsRef = useRef<StudentRow[]>([]);
  const teachersById = useMemo(
    () => Object.fromEntries(teachers.map((teacher) => [teacher.id, teacher])),
    [teachers],
  );

  useEffect(() => {
    setFiltersTarget(
      document.getElementById('header-portal-center')
      || document.getElementById('header-portal-filters')
    );
  }, []);

  const buildRowsForSession = useCallback(
    (subjectId: string, classId: string, date: string, period: number) => {
      const students = getStudentsForClass(classId);
      const existing = getAttendanceForSession(subjectId, classId, date, period);
      const existingMap = new Map(existing.map(record => [record.studentId, record]));

      return students.map(({ student }) => {
        const existingRecord = existingMap.get(student.id);
        
        // Auto-detect leave — ทำงานทั้งกรณีที่มีและไม่มี existingRecord
        // ครูยังไม่กรอก (status null) → ให้ระบบเติม leave อัตโนมัติ
        // ครูกรอกไปแล้ว (status ไม่ใช่ null) → ไม่ override
        let autoStatus: AttendanceStatus | null = null;
        let autoNote = '';
        const teacherHasSet = existingRecord && existingRecord.status != null;

        if (!teacherHasSet) {
          const studentFullName = `${student.prefix}${student.firstName}${student.lastName}`;
          const approvedInRange = leaveRequests.filter(r =>
            r.requesterType === 'student' && r.status === 'approved' &&
            date >= r.startDate && date <= r.endDate
          );
          const approvedLeave = approvedInRange.find(r =>
            toIdentityList(student).includes(r.requesterId)
            || (typeof r.requesterStudentCode === 'string' && r.requesterStudentCode !== '' && r.requesterStudentCode === student.studentCode)
            || normalizeThaiName(r.requesterName) === normalizeThaiName(studentFullName)
          );
          if (approvedLeave) {
            autoStatus = 'leave';
            const leaveTypeLabel = approvedLeave.leaveType === 'sick' ? 'ลาป่วย' : 'ลากิจ';
            autoNote = `${leaveTypeLabel}: ${approvedLeave.reason}`;
          }
        }

        return {
          studentId: student.id,
          studentCode: student.studentCode,
          studentName: `${student.prefix}${student.firstName} ${student.lastName}`,
          imageUrl: student.photoURL,
          gender: student.gender,
          status: existingRecord?.status ?? autoStatus,
          note: (existingRecord?.status != null ? existingRecord.note : null) ?? autoNote,
          autoFilledLeave: autoStatus === 'leave' && existingRecord?.status == null,
        };
      }).sort((a, b) => a.studentCode.localeCompare(b.studentCode, undefined, { numeric: true }));
    },
    [getAttendanceForSession, getStudentsForClass, leaveRequests],
  );

  // Handle URL parameters for deep linking
  useEffect(() => {
    const pSubjectId = searchParams.get('subjectId');
    const pClassId = searchParams.get('classId');
    const pPeriod = searchParams.get('period');
    const pDate = searchParams.get('date');

    // Sync filter state if classId is present
    if (pClassId && classes.length > 0) {
      const targetClass = classes.find(c => c.id === pClassId);
      if (targetClass) {
        setSelectedDept(targetClass.departmentId as DepartmentFilter || 'secondary');
        setSelectedLevel(targetClass.gradeLevel);
        setSelectedRoom(targetClass.roomNumber);
      }
    }

    if (pSubjectId && pClassId && pPeriod) {
      const periodNum = parseInt(pPeriod);
      const finalDate = pDate || todayDate;

      // Find the entry to set it as selectedEntry (stops auto-select from overriding)
      const entry = scheduleEntries.find(e => 
        e.subjectId === pSubjectId && 
        e.classId === pClassId && 
        e.period === periodNum
      );

      if (entry) {
        setSelectedEntry(entry);
        setSelectedSubjectId(pSubjectId);
        setSelectedClassId(pClassId);
        setSelectedPeriod(periodNum);
        if (pDate) setSelectedDate(pDate);
        
        // Build and set rows for the linked session
        const nextRows = buildRowsForSession(pSubjectId, pClassId, finalDate, periodNum);
        setRows(nextRows);
        
        setViewMode('attendance');
      }
    }
  }, [searchParams, buildRowsForSession, todayDate, scheduleEntries, classes]);

  const filteredClasses = useMemo(() => {
    let list = classes;
    if (selectedDept !== 'all') {
      list = list.filter(cls => cls.departmentId === selectedDept);
    }
    if (selectedLevel) {
      list = list.filter(cls => cls.gradeLevel === selectedLevel);
    }
    if (selectedRoom) {
      list = list.filter(cls => cls.roomNumber === selectedRoom);
    }
    return list;
  }, [classes, selectedDept, selectedLevel, selectedRoom]);
  
  const roomOptions = useMemo(() => {
    if (!selectedLevel || selectedDept === 'all') return [];
    return Array.from(new Set(
      classes
        .filter(c => c.departmentId === selectedDept && c.gradeLevel === selectedLevel)
        .map(c => c.roomNumber)
    )).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [classes, selectedDept, selectedLevel]);

  const effectiveSelectedClassId = useMemo(() => {
    if (!selectedRoom) return '';
    if (selectedClassId && filteredClasses.some(cls => cls.id === selectedClassId)) {
      return selectedClassId;
    }
    return filteredClasses[0]?.id ?? '';
  }, [filteredClasses, selectedClassId, selectedRoom]);

  const { periodTimes } = useScheduleSettings(effectiveSelectedClassId);

  const effectiveSelectedSubjectId = selectedEntry?.subjectId
    ?? selectedSubjectId
    ?? mySubjects[0]?.id
    ?? '';

  const selectedClass = useMemo(
    () => classes.find(cls => cls.id === effectiveSelectedClassId) ?? null,
    [classes, effectiveSelectedClassId],
  );

  const selectedSubject = useMemo(
    () => mySubjects.find(subject => subject.id === effectiveSelectedSubjectId) ?? null,
    [effectiveSelectedSubjectId, mySubjects],
  );

  const classEntries = useMemo(
    () =>
      scheduleEntries.filter(
        entry =>
          entry.classId === effectiveSelectedClassId &&
          entry.year === academicYearId &&
          entry.semester === semester,
      ),
    [academicYearId, effectiveSelectedClassId, scheduleEntries, semester],
  );

  const relevantAttendance = useMemo(
    () =>
      attendance.filter(
        record =>
          record.teacherId === teacherId &&
          record.academicYearId === academicYearId &&
          record.semester === semester,
      ),
    [academicYearId, attendance, semester, teacherId],
  );

  const sessionStats = useMemo(() => {
    return rows.reduce<Record<AttendanceStatus, number>>((acc, row) => {
      if (row.status) {
        acc[row.status] += 1;
      }
      return acc;
    }, {
      present: 0,
      late: 0,
      absent: 0,
      excused: 0,
      leave: 0,
    });
  }, [rows]);

  const overallStats = useMemo(() => {
    return relevantAttendance.reduce<Record<AttendanceStatus, number>>((acc, row) => {
      if (row.status) {
        acc[row.status] += 1;
      }
      return acc;
    }, {
      present: 0,
      late: 0,
      absent: 0,
      excused: 0,
      leave: 0,
    });
  }, [relevantAttendance]);

  const recentAttendance = useMemo(
    () =>
      [...relevantAttendance]
        .sort((a, b) =>
          b.date.localeCompare(a.date)
          || b.period - a.period
          || a.studentName.localeCompare(b.studentName, 'th'),
        )
        .slice(0, 24),
    [relevantAttendance],
  );

  const { playPop, playSuccess } = useSoundEffects();


  // Auto-sync rows when students data becomes available (เช่น Firestore โหลดเสร็จหลัง slot ถูกเลือก)
  useEffect(() => {
    if (viewMode !== 'attendance' || !effectiveSelectedClassId) return;
    const targetSubjectId = selectedEntry?.subjectId || selectedSubjectId;
    const targetPeriod = selectedEntry?.period || selectedPeriod;
    if (!targetSubjectId || !targetPeriod) return;

    const freshRows = buildRowsForSession(
      targetSubjectId,
      effectiveSelectedClassId,
      selectedDate,
      targetPeriod
    );
    if (freshRows.length === 0) return;

    const currentRows = rowsRef.current;
    const hasCountChanged = freshRows.length !== currentRows.length;

    // ตรวจสอบว่ามีการลาที่เพิ่งได้รับอนุมัติ แต่ยังไม่ถูก reflect ใน rows ปัจจุบัน
    const newlyApprovedLeaveStudents = freshRows.filter(fr => {
      if (fr.status !== 'leave') return false;
      const existing = currentRows.find(r => r.studentId === fr.studentId);
      return !existing || existing.status !== 'leave';
    });

    if (hasCountChanged) {
      // นักเรียนเพิ่ม/ลด → rebuild ทั้งหมด
      setRows(freshRows);
      return;
    }

    if (newlyApprovedLeaveStudents.length > 0) {
      // มีการลาใหม่อนุมัติ → merge เฉพาะนักเรียนที่ยังไม่ถูกครูแก้ไข (status === null หรือยังเป็น leave เดิม)
      // ไม่ overwrite สถานะที่ครูกรอกไปแล้ว
      setRows(prev =>
        prev.map(row => {
          const freshRow = newlyApprovedLeaveStudents.find(fr => fr.studentId === row.studentId);
          if (!freshRow) return row;
          // แก้เฉพาะนักเรียนที่ยังไม่มีสถานะ หรือมีสถานะ leave อยู่แล้ว (ไม่ overwrite งาน manual ของครู)
          if (row.status === null || row.status === 'leave') {
            return { ...row, status: 'leave', note: freshRow.note, autoFilledLeave: true };
          }
          return row;
        })
      );
    }
  }, [
    buildRowsForSession,
    effectiveSelectedClassId,
    selectedDate,
    selectedEntry?.period,
    selectedEntry?.subjectId,
    selectedPeriod,
    selectedSubjectId,
    viewMode,
  ]);

  const setStatus = (studentId: string, status: AttendanceStatus) => {
    playPop();
    setRows(prev =>
      prev.map(row => {
        if (row.studentId === studentId) {
          // If clicking the same status, toggle it back to null
          const newStatus = row.status === status ? null : status;
          return { ...row, status: newStatus, autoFilledLeave: false };
        }
        return row;
      }),
    );
    setSaved(false);
  };


  const handleSlotClick = (entry: ScheduleEntry) => {
    const nextDate = resolveNearestClassDate(entry.day);
    const nextRows = buildRowsForSession(entry.subjectId, entry.classId, nextDate, entry.period);

    setSelectedEntry(entry);
    setSelectedClassId(entry.classId);
    setSelectedSubjectId(entry.subjectId);
    setSelectedPeriod(entry.period);
    setSelectedDate(nextDate);
    setRows(nextRows);
    setSearchQuery('');
    setSaved(false);
    setSubView('today');
    setViewMode('attendance');
  };

  // ── Auto-select current session ──────────────────────────────────────────
  useEffect(() => {
    if (selectedEntry || classEntries.length === 0 || Object.keys(periodTimes).length === 0) return;

    const now = new Date();
    const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay();
    if (dayOfWeek > 5) return;

    const currentTime = now.getHours() * 60 + now.getMinutes();

    let currentPeriod = -1;
    Object.entries(periodTimes).forEach(([p, timeRange]) => {
      const [start, end] = timeRange.split(' - ');
      if (!start) return;

      const [hS, mS] = start.split(':').map(Number);
      const startTime = hS * 60 + mS;

      let endTime = startTime + 50;
      if (end) {
        const [hE, mE] = end.split(':').map(Number);
        endTime = hE * 60 + mE;
      }

      if (currentTime >= startTime && currentTime <= endTime + 10) {
        currentPeriod = Number(p);
      }
    });

    if (currentPeriod === -1) return;

    const entry = classEntries.find(e => e.day === dayOfWeek && e.period === currentPeriod);
    if (!entry) return;

    const nextDate = resolveNearestClassDate(entry.day);
    const nextRows = buildRowsForSession(entry.subjectId, entry.classId, nextDate, entry.period);

    setSelectedEntry(entry);
    setSelectedClassId(entry.classId);
    setSelectedSubjectId(entry.subjectId);
    setSelectedPeriod(entry.period);
    setSelectedDate(nextDate);
    setRows(nextRows);
    setSearchQuery('');
    setSaved(false);
    setSubView('today');
    setViewMode('attendance');
  }, [
    buildRowsForSession,
    classEntries,
    periodTimes,
    selectedEntry,
  ]);

  const handleSave = useCallback(async (silent = false) => {
    if (!selectedEntry || !selectedClass) return;

    const validRows = rows.filter(row => row.status !== null);

    if (!silent) setSaving(true);

    try {
      const subjectName = selectedEntry.subjectName || selectedSubject?.name || '';
      const records: NewAttendanceRecord[] = validRows.map(row => ({
        studentId: row.studentId,
        studentName: row.studentName,
        studentCode: row.studentCode,
        subjectId: selectedEntry.subjectId,
        subjectName,
        classId: selectedClass.id,
        className: selectedClass.className,
        teacherId,
        departmentId: selectedClass.departmentId,
        academicYearId,
        semester,
        date: selectedDate,
        period: selectedPeriod,
        status: row.status as AttendanceStatus,
        note: row.note.trim(),
      }));

      await onSave(records);
      if (!silent) playSuccess();
      setSaved(true);
      if (!silent) toast.success(`บันทึกเช็คชื่อ ${records.length} คนเรียบร้อยแล้ว`);
    } catch (error) {
      console.error(error);
      if (!silent) toast.error('บันทึกเช็คชื่อไม่สำเร็จ');
    } finally {
      if (!silent) setSaving(false);
    }
  }, [
    academicYearId,
    onSave,
    playSuccess,
    rows,
    selectedClass,
    selectedDate,
    selectedEntry,
    selectedPeriod,
    selectedSubject?.name,
    semester,
    teacherId,
  ]);

  // Auto-save logic removed per user request
  // Auto-persist for approved leave that was auto-filled by system.
  const handleSelectAll = () => {
    playPop();
    setRows(prev => prev.map(row => ({ ...row, status: 'present', autoFilledLeave: false })));
    setSaved(false);
  };

  const handleCancelAll = () => {
    playPop();
    setRows(prev => prev.map(row => ({ ...row, status: null, autoFilledLeave: false })));
    setSaved(false);
  };

  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) return rows;
    const query = searchQuery.toLowerCase();
    return rows.filter(
      row =>
        row.studentName.toLowerCase().includes(query)
        || row.studentCode.toLowerCase().includes(query),
    );
  }, [rows, searchQuery]);

  const handleDeptSelect = (val: DepartmentFilter) => {
    setSelectedDept(val);
    setSelectedLevel(null);
    setSelectedRoom(null);
    if (viewMode === 'attendance') {
      setViewMode('schedule');
      setSelectedEntry(null);
    }
  };

  const handleLevelSelect = (val: string) => {
    setSelectedLevel(val);
    setSelectedRoom(null);
  };

  const handleRoomSelect = (val: string) => {
    setSelectedRoom(val);
    const matched = classes.find(c =>
      c.departmentId === selectedDept &&
      c.gradeLevel === selectedLevel &&
      c.roomNumber === val
    );
    if (matched) {
      setSelectedClassId(matched.id);
      if (viewMode === 'attendance') {
        setViewMode('schedule');
        setSelectedEntry(null);
      }
    }
  };

  const handleClearFilters = () => {
    setSelectedDept('all');
    setSelectedLevel(null);
    setSelectedRoom(null);
    setSelectedClassId('');
    setSelectedEntry(null);
    setViewMode('schedule');
  };

  return (
    <>
      {filtersTarget && createPortal(
        <div className="hidden md:flex items-center gap-2.5">
          {/* Select แผนก */}
          <Select value={selectedDept} onValueChange={(val) => handleDeptSelect(val as DepartmentFilter)}>
            <SelectTrigger className="h-9 min-w-[110px] rounded-full border border-black/[0.05] bg-white/40 px-3 text-[10px] font-black backdrop-blur-md shadow-sm transition-all hover:bg-white/60">
              <div className="flex items-center gap-1.5">
                <span className="text-black/30 uppercase tracking-tighter">แผนก</span>
                <SelectValue placeholder="แผนก" />
              </div>
            </SelectTrigger>
            <SelectContent>
              {DEPARTMENT_OPTIONS.map(opt => (
                <SelectItem key={opt.id} value={opt.id}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selectedDept !== 'all' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <Select value={selectedLevel || ''} onValueChange={handleLevelSelect}>
                <SelectTrigger className="h-9 min-w-[90px] rounded-full border border-black/[0.05] bg-white/40 px-3 text-[10px] font-black backdrop-blur-md shadow-sm transition-all hover:bg-white/60">
                  <div className="flex items-center gap-1.5">
                    <span className="text-black/30 uppercase tracking-tighter">ชั้น</span>
                    <SelectValue placeholder="ชั้น" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {DEPARTMENT_GRADES[selectedDept].map(level => (
                    <SelectItem key={level} value={level}>{level}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </motion.div>
          )}

          {selectedLevel && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <Select value={selectedRoom || ''} onValueChange={handleRoomSelect}>
                <SelectTrigger className="h-9 min-w-[80px] rounded-full border border-black/[0.05] bg-white/40 px-3 text-[10px] font-black backdrop-blur-md shadow-sm transition-all hover:bg-white/60">
                  <div className="flex items-center gap-1.5">
                    <span className="text-black/30 uppercase tracking-tighter">ห้อง</span>
                    <SelectValue placeholder="ห้อง" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {roomOptions.map(room => (
                    <SelectItem key={room} value={room}>{room}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </motion.div>
          )}

          {(selectedDept !== 'all' || selectedLevel || selectedRoom) && (
            <button
              onClick={handleClearFilters}
              className="h-9 w-9 flex items-center justify-center rounded-full border border-red-100 bg-red-50 text-red-600 transition-all hover:bg-red-100 active:scale-95 shrink-0"
              title="ล้างฟิลเตอร์"
            >
              <RotateCcw size={14} />
            </button>
          )}
        </div>,
        filtersTarget
      )}

      {typeof window !== 'undefined' && selectedRoom && createPortal(
        <div className="flex h-9 items-center rounded-full border border-black/[0.05] bg-white/40 p-1 backdrop-blur-md shadow-sm">
          {SUBVIEW_OPTIONS.map(option => {
            const isActive = subView === option.id;
            return (
              <button
                key={option.id}
                onClick={() => setSubView(option.id)}
                title={option.label}
                className={`flex h-full aspect-square items-center justify-center rounded-full transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-black/35 hover:bg-black/[0.02] hover:text-black/60'
                }`}
              >
                <option.icon size={13} />
              </button>
            );
          })}
        </div>,
        document.getElementById('header-portal-right-actions') || document.body
      )}

      <div className="flex flex-col h-full min-h-0 overflow-hidden font-sukhumvit">



      <div className="flex flex-1 min-h-0 overflow-hidden">
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="md:hidden sticky top-0 z-20 -mx-3 px-3 py-2 bg-white/75 backdrop-blur-md">
          <div className="rounded-2xl border border-black/[0.06] bg-white/85 p-2.5 shadow-sm">
            <div className="mb-2 flex w-full gap-1">
              {DEPARTMENT_OPTIONS.map((opt) => {
                const active = selectedDept === opt.id;
                return (
                  <button
                    key={opt.id}
                    onClick={() => handleDeptSelect(opt.id)}
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

            <div className="flex gap-2 w-full">
              {selectedDept !== 'all' && (
                <div className="flex-1 min-w-0">
                  <Select value={selectedLevel || ''} onValueChange={handleLevelSelect}>
                    <SelectTrigger className="h-10 w-full rounded-xl border-black/[0.07] bg-white text-xs font-bold text-black/70">
                      <SelectValue placeholder="เลือกระดับชั้น" />
                    </SelectTrigger>
                    <SelectContent>
                      {DEPARTMENT_GRADES[selectedDept].map((level) => (
                        <SelectItem key={level} value={level}>{level}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {selectedLevel && (
                <div className="flex-1 min-w-0">
                  <Select value={selectedRoom || ''} onValueChange={handleRoomSelect}>
                    <SelectTrigger className="h-10 w-full rounded-xl border-black/[0.07] bg-white text-xs font-bold text-black/70">
                      <SelectValue placeholder="เลือกห้องเรียน" />
                    </SelectTrigger>
                    <SelectContent>
                      {roomOptions.map((room) => (
                        <SelectItem key={room} value={room}>{room}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {(selectedDept !== 'all' || selectedLevel || selectedRoom) && (
                <button
                  onClick={handleClearFilters}
                  className="h-10 w-10 flex items-center justify-center rounded-xl border border-red-100 bg-red-50 text-red-600 transition-all hover:bg-red-100 active:scale-95 shrink-0"
                  title="ล้างฟิลเตอร์"
                >
                  <RotateCcw size={16} />
                </button>
              )}
            </div>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {subView === 'today' ? (
            <motion.div
              key={viewMode}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-1 flex-col overflow-hidden"
            >
              {viewMode === 'schedule' ? (
                !selectedRoom ? (
                  <div className="flex flex-1 flex-col items-center justify-center py-20 text-slate-400 opacity-60">
                    <Search size={48} strokeWidth={1} className="mb-4" />
                    <p className="text-[13px] font-black uppercase tracking-widest">กรุณาเลือกห้องเรียนเพื่อแสดงตารางสอน</p>
                  </div>
                ) : (
                  <div className="min-w-0 flex-1 overflow-auto px-3 md:px-6 pb-6 pt-2 scrollbar-hide">
                    <ScheduleGrid
                      classEntries={classEntries}
                      onSlotClick={handleSlotClick}
                      selectedSlotId={selectedEntry?.id ?? null}
                      classId={effectiveSelectedClassId}
                      attendance={relevantAttendance}
                      teachersById={teachersById}
                      getStudentsForClass={getStudentsForClass}
                    />
                  </div>
                )
              ) : (
                <div className="flex min-h-0 flex-1 flex-col px-3 md:px-6 pt-0">
                  <div className="mb-6 rounded-2xl border border-white bg-white/60 p-4 backdrop-blur-xl">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                      <div className="flex items-center gap-4">
                        <button
                          onClick={() => setViewMode('schedule')}
                          className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-100 bg-white text-slate-400 transition-all hover:border-blue-100 hover:text-blue-600"
                        >
                          <ArrowLeft size={18} strokeWidth={2.5} />
                        </button>
                        <div className="flex flex-col justify-center">
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            <h2 className="text-[16px] font-black leading-tight text-slate-800">
                              {selectedEntry?.subjectCode} {selectedEntry?.subjectName}
                            </h2>
                            <span className="hidden text-slate-200 xl:inline">|</span>
                            <div className="flex flex-wrap items-center gap-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
                              <span className="flex items-center gap-1.5">
                                <MapPin size={10} className="text-blue-500" />
                                ห้อง {selectedClass?.className || selectedEntry?.classId}
                              </span>
                              <span className="text-slate-200">|</span>
                              <span className="flex items-center gap-1.5">
                                <Clock size={10} className="text-amber-500" />
                                คาบที่ {selectedPeriod} {periodTimes[selectedPeriod] ? `(${periodTimes[selectedPeriod]})` : ''}
                              </span>
                              <span className="text-slate-200">|</span>
                              <span className="flex items-center gap-1.5">
                                <CheckSquare size={10} className="text-emerald-500" />
                                {formatSessionDate(selectedDate)}
                              </span>
                              {saved && (
                                <>
                                  <span className="text-slate-200">|</span>
                                  <span className="flex items-center justify-center text-emerald-600">
                                    <UserCheck size={10} />
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                    </div>


                    {/* Attendance Summary Single Stacked Bar */}
                    <div className="mt-4 w-full bg-white/50 backdrop-blur-md rounded-2xl p-5 border border-slate-200/60">
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-5 px-1">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-6">
                          <div className="flex flex-col justify-center">
                            <div className="flex items-baseline gap-2">
                              <span className="text-3xl font-black text-slate-800 tabular-nums">
                                {sessionStats.present + sessionStats.late + sessionStats.absent + sessionStats.leave}
                              </span>
                              <span className="text-sm font-bold text-slate-400">/ {rows.length}</span>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-x-5 gap-y-2 py-1 lg:border-l lg:border-slate-200 lg:pl-6">
                            {[
                              { label: 'มาเรียน', count: sessionStats.present, color: 'text-emerald-600', dot: 'bg-emerald-500' },
                              { label: 'สาย', count: sessionStats.late, color: 'text-amber-600', dot: 'bg-amber-500' },
                              { label: 'ขาดเรียน', count: sessionStats.absent, color: 'text-rose-600', dot: 'bg-rose-500' },
                              { label: 'ลา', count: sessionStats.leave, color: 'text-indigo-600', dot: 'bg-indigo-500' },
                            ].map((item) => (
                              <div key={item.label} className="flex items-center gap-2">
                                <div className={`w-1.5 h-1.5 rounded-full ${item.dot}`} />
                                <div className="flex flex-col leading-none">
                                  <span className={`text-xs font-black ${item.color} tabular-nums`}>{item.count}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row items-center gap-3">
                          {/* Search Input Integrated */}
                          <div className="relative w-full sm:w-[220px]">
                            <Search
                              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                              size={12}
                            />
                            <input
                              type="text"
                              placeholder="ค้นหาชื่อนักเรียน..."
                              value={searchQuery}
                              onChange={event => setSearchQuery(event.target.value)}
                              className="w-full rounded-xl border border-slate-200/60 bg-slate-50/50 py-2 pl-10 pr-3 text-[11px] font-bold outline-none transition-all focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100/50"
                            />
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleSave()}
                              disabled={saving}
                              title={saved ? 'บันทึกแล้ว' : 'บันทึกเช็คชื่อ'}
                              className={`flex h-9 w-9 items-center justify-center rounded-xl transition-all ${
                                saved
                                  ? 'bg-emerald-500 text-white'
                                  : 'bg-blue-600 text-white hover:scale-105 active:scale-95'
                              } disabled:opacity-50`}
                            >
                              {saving ? (
                                <div className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                              ) : saved ? (
                                <CheckCircle size={14} />
                              ) : (
                                <Save size={14} />
                              )}
                            </button>

                            <div className="h-6 w-px bg-slate-200 mx-1" />

                            <button
                              onClick={handleSelectAll}
                              title="มาทุกคน"
                              className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 transition-all hover:bg-emerald-500 hover:text-white"
                            >
                              <CheckSquare size={16} />
                            </button>
                            <button
                              onClick={handleCancelAll}
                              title="ล้างทั้งหมด"
                              className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-50 text-slate-400 border border-slate-100 transition-all hover:bg-rose-50 hover:text-rose-500 hover:border-rose-100"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="h-3 w-full bg-slate-100/50 rounded-full overflow-hidden flex gap-0.5 p-0.5 border border-slate-200/50 shadow-inner">
                        {rows.length > 0 ? (
                          <>
                            <motion.div 
                              initial={{ width: 0 }} 
                              animate={{ width: `${(sessionStats.present / rows.length) * 100}%` }} 
                              className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-l-full shadow-[0_0_10px_rgba(16,185,129,0.2)]" 
                            />
                            <motion.div 
                              initial={{ width: 0 }} 
                              animate={{ width: `${(sessionStats.late / rows.length) * 100}%` }} 
                              className="h-full bg-gradient-to-r from-amber-400 to-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.2)]" 
                            />
                            <motion.div 
                              initial={{ width: 0 }} 
                              animate={{ width: `${(sessionStats.absent / rows.length) * 100}%` }} 
                              className="h-full bg-gradient-to-r from-rose-400 to-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.2)]" 
                            />
                            <motion.div 
                              initial={{ width: 0 }} 
                              animate={{ width: `${(sessionStats.leave / rows.length) * 100}%` }} 
                              className="h-full bg-gradient-to-r from-indigo-400 to-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.2)]" 
                            />
                            <motion.div 
                              initial={{ width: 0 }} 
                              animate={{ 
                                width: `${((rows.length - (sessionStats.present + sessionStats.late + sessionStats.absent + sessionStats.leave)) / rows.length) * 100}%` 
                              }} 
                              className="h-full bg-slate-200/50 rounded-r-full" 
                            />
                          </>
                        ) : (
                          <div className="w-full h-full bg-slate-100 rounded-full" />
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto pb-8 pr-2 scrollbar-hide">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                      {filteredRows.length === 0 ? (
                        <div className="col-span-full flex flex-col items-center justify-center py-20 text-slate-400">
                          <Users size={48} className="mb-4 opacity-20" />
                          <p className="text-sm font-black">ไม่พบรายชื่อนักเรียนในห้องนี้</p>
                          <p className="mt-1 text-xs font-bold opacity-60">
                            กรุณาตรวจสอบการลงทะเบียนเรียนในปีการศึกษา {academicYearId} ภาคเรียนที่ {semester}
                          </p>
                        </div>
                      ) : (
                        filteredRows.map(student => {
                          const statusConfig = student.status ? STATUS_CONFIG[student.status] : null;

                          return (
                            <motion.div
                              key={student.studentId}
                              layout
                              className={cn(
                                "rounded-2xl border p-4 backdrop-blur-sm transition-all",
                                statusConfig 
                                  ? `${statusConfig.gradient} ${statusConfig.border}` 
                                  : "border-slate-200 bg-white/60 hover:border-blue-300"
                              )}
                            >
                            <div className="mb-5 flex items-center gap-3">
                                <StudentAvatar 
                                  photoURL={student.imageUrl}
                                  studentId={student.studentId}
                                  name={student.studentName}
                                  gender={student.gender}
                                  className="h-12 w-12 rounded-xl"
                                />
                              <div className="min-w-0 flex-1">
                                <h4 className="truncate text-[14px] font-black leading-tight text-slate-800">
                                  {student.studentName}
                                </h4>
                                <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                  {student.studentCode}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center justify-between px-2 pt-1 pb-2">
                              {STATUS_BUTTONS.map(status => {
                                const config = STATUS_CONFIG[status];
                                const active = student.status === status;

                                return (
                                  <div key={status} className="flex flex-col items-center gap-1.5">
                                    {/* Indicator Dot */}
                                    <div 
                                      className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                                        active ? 'scale-110' : 'bg-slate-200 opacity-50'
                                      }`}
                                      style={{ 
                                        backgroundColor: active ? config.color : undefined
                                      }}
                                    />
                                    
                                    {/* Main Knob Button */}
                                    <button
                                      onClick={() => setStatus(student.studentId, status)}
                                      className={`w-11 h-11 rounded-full transition-all duration-300 flex items-center justify-center border-2 ${
                                        active 
                                          ? 'scale-105' 
                                          : 'bg-slate-50 border-slate-100 hover:border-slate-200 hover:bg-white'
                                      }`}
                                      style={{
                                        borderColor: active ? config.color : undefined,
                                        background: active ? `linear-gradient(145deg, #ffffff, ${config.color}08)` : undefined
                                      }}
                                    >
                                      <span 
                                        className={`text-[13px] font-black transition-colors duration-300 ${
                                          active ? '' : 'text-slate-400'
                                        }`}
                                        style={{ color: active ? config.color : undefined }}
                                      >
                                        {config.shortLabel}
                                      </span>
                                    </button>

                                    {/* Bottom Status Text */}
                                    <span 
                                      className={`text-[9px] font-black tracking-tighter uppercase transition-all duration-300 ${
                                        active ? 'opacity-100 translate-y-0' : 'text-slate-300 opacity-50'
                                      }`}
                                      style={{ color: active ? config.color : undefined }}
                                    >
                                      {active ? 'ON' : 'OFF'}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </motion.div>
                        );
                      })
                      )}
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          ) : subView === 'history' ? (
            <motion.div
              key="history-view"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex min-h-0 flex-1 flex-col overflow-hidden px-6 pb-6"
            >
              <div className="mb-4 flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                <h3 className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
                  ประวัติการเช็คชื่อล่าสุด
                </h3>
              </div>
              <div className="overflow-hidden rounded-2xl border border-black/[0.06] bg-white/70 backdrop-blur-md">
                <div className="grid grid-cols-[120px_1fr_120px_90px] border-b border-black/[0.06] bg-black/[0.02] px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
                  <span>วันที่</span>
                  <span>วิชา / นักเรียน</span>
                  <span>ห้อง / คาบ</span>
                  <span>สถานะ</span>
                </div>
                <div className="max-h-full overflow-y-auto scrollbar-hide">
                  {recentAttendance.length === 0 ? (
                    <div className="flex min-h-[220px] flex-col items-center justify-center gap-3 text-slate-400">
                      <History size={28} className="opacity-40" />
                      <p className="text-[12px] font-bold">ยังไม่มีประวัติการเช็คชื่อ</p>
                    </div>
                  ) : (
                    recentAttendance.map(record => {
                      const config = STATUS_CONFIG[record.status];
                      return (
                        <div
                          key={record.id}
                          className="grid grid-cols-[120px_1fr_120px_90px] items-center border-b border-black/[0.04] px-4 py-3 text-[12px] last:border-b-0"
                        >
                          <div className="font-bold text-slate-500">{formatSessionDate(record.date)}</div>
                          <div className="min-w-0">
                            <p className="truncate font-black text-slate-800">{record.subjectName}</p>
                            <p className="truncate text-[11px] font-medium text-slate-400">
                              {record.studentName}
                            </p>
                          </div>
                          <div className="text-[11px] font-bold text-slate-500">
                            <p>ห้อง {record.className}</p>
                            <p>คาบ {record.period}</p>
                          </div>
                          <div>
                            <span
                              className="inline-flex rounded-full px-2.5 py-1 text-[10px] font-black"
                              style={{ background: config.bg, color: config.color }}
                            >
                              {config.label}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="summary-view"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex min-h-0 flex-1 flex-col px-6 pb-6"
            >
              <div className="mb-5 flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                <h3 className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
                  สรุปผลการเช็คชื่อภาคเรียนนี้
                </h3>
              </div>

              <div className="w-full max-w-3xl bg-white/40 backdrop-blur-md rounded-2xl p-5 border border-white/60 shadow-sm">
                <div className="flex justify-between items-end mb-4 px-1">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">ภาพรวมทั้งภาคเรียน</span>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-black text-slate-800 tabular-nums">
                        {overallStats.present + overallStats.late + overallStats.absent + overallStats.leave}
                      </span>
                      <span className="text-sm font-bold text-slate-400 uppercase">ครั้ง (Total Records)</span>
                    </div>
                  </div>

                  <div className="flex gap-6 mb-1">
                    {[
                      { label: 'มาเรียน', count: overallStats.present, color: 'text-emerald-600', dot: 'bg-emerald-500' },
                      { label: 'สาย', count: overallStats.late, color: 'text-amber-600', dot: 'bg-amber-500' },
                      { label: 'ขาดเรียน', count: overallStats.absent, color: 'text-rose-600', dot: 'bg-rose-500' },
                      { label: 'ลา', count: overallStats.leave, color: 'text-indigo-600', dot: 'bg-indigo-500' },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center gap-2.5">
                        <div className={`w-2 h-2 rounded-full ${item.dot} shadow-sm`} />
                        <div className="flex flex-col leading-none">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{item.label}</span>
                          <span className={`text-sm font-black ${item.color} tabular-nums`}>{item.count.toLocaleString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="h-4 w-full bg-slate-100/50 rounded-full overflow-hidden flex gap-0.5 p-0.5 border border-slate-200/50 shadow-inner">
                  {(() => {
                    const total = overallStats.present + overallStats.late + overallStats.absent + overallStats.leave;
                    if (total === 0) return <div className="w-full h-full bg-slate-100 rounded-full" />;
                    return (
                      <>
                        <motion.div 
                          initial={{ width: 0 }} 
                          animate={{ width: `${(overallStats.present / total) * 100}%` }} 
                          className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-l-full shadow-[0_0_15px_rgba(16,185,129,0.2)]" 
                        />
                        <motion.div 
                          initial={{ width: 0 }} 
                          animate={{ width: `${(overallStats.late / total) * 100}%` }} 
                          className="h-full bg-gradient-to-r from-amber-400 to-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.2)]" 
                        />
                        <motion.div 
                          initial={{ width: 0 }} 
                          animate={{ width: `${(overallStats.absent / total) * 100}%` }} 
                          className="h-full bg-gradient-to-r from-rose-400 to-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.2)]" 
                        />
                        <motion.div 
                          initial={{ width: 0 }} 
                          animate={{ width: `${(overallStats.leave / total) * 100}%` }} 
                          className="h-full bg-gradient-to-r from-indigo-400 to-indigo-500 rounded-r-full shadow-[0_0_15px_rgba(99,102,241,0.2)]" 
                        />
                      </>
                    );
                  })()}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>


    </div>
    </div>
    </>
  );
}
