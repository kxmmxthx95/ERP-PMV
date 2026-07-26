import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  addMonths,
  endOfMonth,
  format,
  isAfter,
  isBefore,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  subMonths,
} from 'date-fns';
import { th } from 'date-fns/locale';
import {
  HiCheckCircle,
  HiChevronLeft,
  HiChevronRight,
  HiOutlineCheckCircle,
  HiOutlineComputerDesktop,
  HiOutlineDocumentText,
  HiOutlineExclamationTriangle,
  HiOutlineTrash,
  HiOutlineXMark,
  HiStar,
} from 'react-icons/hi2';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { CreateRoomPrefill } from '@/features/exam/components/CreateRoomModal';
import TeachingReflectionModal from './TeachingReflectionModal';
import { useAuth } from '@/hooks/useAuth';
import { useExamRoom } from '@/hooks/useExamRoom';
import { useActiveAcademicYear } from '@/hooks/useActiveAcademicYear';
import { useAcademicCalendar } from '@/hooks/useAcademicCalendar';
import { useSchedule } from '@/hooks/useSchedule';
import { useScheduleSettings } from '@/hooks/useScheduleSettings';
import { useQuestionSetBank } from '@/hooks/useQuestionSetBank';
import { useThaiHolidays } from '@/features/calendar/hooks/useThaiHolidays';
import { formatEventDateRange } from '@/features/calendar/utils';
import { EVENT_TYPE_CONFIG } from '@/types/calendar';
import type { CalendarEvent } from '@/types/calendar';
import { glassCard } from '@/features/calendar/constants';
import { cn } from '@/lib/utils';
import { getLocalDateString } from '@/lib/dateUtils';
import { Switch } from '@/components/ui/switch';
import type { TeachingReflection, WeeklyTopic } from '@/types/microSyllabus';
import { normalizeTeachingOverview } from '@/types/microSyllabus';
import type { NewQuestionSet } from '@/types/questionBank';
import {
  buildMonthGrid,
  buildTeachingSlotsBySchoolDay,
  dateToSchoolDay,
  filterScheduleForClassSubject,
  formatTeachingPeriods,
  hasTopicContent,
  hasSavedTopicState,
  isWithinSemester,
  normalizeTopicsForCalendar,
  toIsoDate,
  topicsByDate,
  weekNumberFromDate,
} from '../utils/teachingPlanCalendar';

// bundle-conditional: exam/QB hooks + modals only mount when user opens them
const CreateRoomModal = lazy(() =>
  import('@/features/exam/components/CreateRoomModal').then((m) => ({ default: m.CreateRoomModal })),
);
const QuestionSetBuilder = lazy(() => import('@/features/questionBank/components/QuestionSetBuilder'));

function TeachingPlanExamModals({
  showCreateExamModal,
  showQuestionSetModal,
  examPrefill,
  questionSetPrefill,
  questionSetKey,
  onCloseExam,
  onCloseQuestionSet,
}: {
  showCreateExamModal: boolean;
  showQuestionSetModal: boolean;
  examPrefill: CreateRoomPrefill | null;
  questionSetPrefill: {
    title: string;
    description: string;
    gradeLevel: string;
    department: string;
  } | null;
  questionSetKey: string;
  onCloseExam: () => void;
  onCloseQuestionSet: () => void;
}) {
  const { createRoom, updateRoom } = useExamRoom();
  const { questionSets, addQuestionSet } = useQuestionSetBank();

  const handleQuestionSetSubmit = async (data: NewQuestionSet) => {
    await addQuestionSet(data);
    onCloseQuestionSet();
  };

  return (
    <Suspense fallback={null}>
      {showCreateExamModal && (
        <CreateRoomModal
          key={examPrefill?.title ?? 'new-exam-room'}
          prefill={examPrefill}
          onClose={onCloseExam}
          onCreate={createRoom}
          onUpdate={updateRoom}
        />
      )}
      {showQuestionSetModal && (
        <QuestionSetBuilder
          key={questionSetKey}
          open
          onClose={onCloseQuestionSet}
          prefill={questionSetPrefill}
          existingSets={questionSets}
          onSubmit={handleQuestionSetSubmit}
        />
      )}
    </Suspense>
  );
}

const DAY_NAMES = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'] as const;

const CELL_BODY_TEXT = 'hidden lg:block';

/** Align with MorningRollCallMonthCalendar status chrome */
type DayPlanDot = 'upcoming' | 'pending' | 'done' | 'closed';

const MOBILE_STATUS_CELL_CLASS: Record<DayPlanDot, string> = {
  upcoming: 'border-slate-200 bg-slate-100 lg:border-slate-300 lg:bg-white',
  pending: 'border-rose-200 bg-rose-100 lg:border-slate-300 lg:bg-white',
  done: 'border-emerald-200 bg-emerald-100 lg:border-slate-300 lg:bg-white',
  closed: 'border-slate-200 bg-slate-100 lg:border-slate-300 lg:bg-white',
};

const EVENT_LABEL_CLASS: Record<'holiday' | 'exam' | 'activity', string> = {
  holiday: 'text-rose-500',
  exam: 'text-amber-600',
  activity: 'text-blue-600',
};

const EVENT_CARD_CLASS: Record<'holiday' | 'exam' | 'activity', string> = {
  holiday: 'border-rose-200 bg-rose-50',
  exam: 'border-amber-200 bg-amber-50',
  activity: 'border-blue-200 bg-blue-50',
};

const CALENDAR_EVENT_TYPES = new Set(['holiday', 'exam', 'activity']);

const DRAWER_CONTENT_CLASS = cn(
  'flex h-dvh flex-col bg-transparent p-0 before:hidden',
  'data-[vaul-drawer-direction=right]:w-screen data-[vaul-drawer-direction=right]:max-w-none',
  'sm:h-full sm:data-[vaul-drawer-direction=right]:w-full sm:data-[vaul-drawer-direction=right]:max-w-md sm:p-2',
);

const DRAWER_PANEL_CLASS = cn(
  'flex h-full min-h-0 flex-col overflow-hidden bg-white',
  'sm:rounded-4xl sm:border sm:border-slate-200/70 sm:shadow-xl',
);

export interface TeachingPlanContext {
  subjectId?: string;
  subjectName?: string;
  classId?: string;
  className?: string;
  gradeLevel?: string;
}

interface Props {
  topics: WeeklyTopic[];
  semesterStart: string;
  semesterEnd: string;
  onSave: (topics: WeeklyTopic[]) => Promise<void>;
  readOnly?: boolean;
  planContext?: TeachingPlanContext;
  lessonOptions?: string[];
}

function inferDepartmentFromGrade(gradeLevel?: string): string {
  if (!gradeLevel) return '';
  if (gradeLevel.startsWith('อ.')) return 'early';
  if (gradeLevel.startsWith('ป.')) return 'primary';
  if (gradeLevel.startsWith('ม.')) return 'secondary';
  return '';
}

const STAR_HINTS: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: 'ต้องปรับปรุงมาก',
  2: 'ต้องปรับปรุง',
  3: 'ปานกลาง',
  4: 'ดี',
  5: 'ดีมาก',
};

function TeachingLogPanel({
  reflection,
  completedAt,
}: {
  reflection?: TeachingReflection | null;
  completedAt?: string | null;
}) {
  if (!reflection && !completedAt) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 px-4 py-16 text-center">
        <p className="text-sm font-black text-slate-500 font-sukhumvit">ยังไม่มีบันทึกการสอน</p>
        <p className="text-[12px] text-slate-400 font-sarabun">
          เมื่อครูทำเครื่องหมายว่าสอนแล้ว ผลการสอนจะแสดงที่นี่
        </p>
      </div>
    );
  }

  const overview = reflection ? normalizeTeachingOverview(reflection.overview) : null;
  const planLabel = reflection?.planStatus === 'off_plan' ? 'หลุดแผน' : reflection?.planStatus === 'on_plan' ? 'ตามแผน' : null;
  const recordedLabel = reflection?.recordedAt
    ? format(parseISO(reflection.recordedAt), 'd MMMM yyyy HH:mm', { locale: th })
    : completedAt
      ? format(parseISO(completedAt), 'd MMMM yyyy HH:mm', { locale: th })
      : null;

  return (
    <div className="space-y-3">
      {completedAt && (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-700">
          <HiCheckCircle size={18} />
          สอนแล้ว
        </div>
      )}

      {planLabel && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-black uppercase tracking-wide text-slate-500">สถานะแผน</p>
          <div
            className={cn(
              'rounded-2xl border px-3 py-3 text-sm font-black font-sukhumvit',
              reflection?.planStatus === 'on_plan'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-amber-200 bg-amber-50 text-amber-700',
            )}
          >
            {planLabel}
          </div>
        </div>
      )}

      {overview != null && (
        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-[11px] font-black uppercase tracking-wide text-slate-500">ผลการสอน</p>
            <p className="text-[11px] font-bold text-amber-600 font-sarabun">{STAR_HINTS[overview]}</p>
          </div>
          <div className="flex items-center justify-between gap-1 rounded-2xl border border-slate-200 bg-white px-2 py-2">
            {([1, 2, 3, 4, 5] as const).map((star) => (
              <span
                key={star}
                className={cn(
                  'flex h-10 flex-1 items-center justify-center',
                  star <= overview ? 'text-amber-400' : 'text-slate-200',
                )}
              >
                <HiStar className="h-7 w-7" />
              </span>
            ))}
          </div>
        </div>
      )}

      {reflection?.problemStudents && reflection.problemStudents.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-black uppercase tracking-wide text-slate-500">นักเรียนที่มีปัญหา</p>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 space-y-1.5">
            {reflection.problemStudents.map((student) => (
              <p key={student.id} className="text-sm font-bold text-slate-700 font-sarabun">
                {student.name}
                {student.code ? (
                  <span className="ml-1.5 text-[11px] font-medium text-slate-400">{student.code}</span>
                ) : null}
              </p>
            ))}
          </div>
        </div>
      )}

      {reflection?.additionalRequest?.trim() && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-black uppercase tracking-wide text-slate-500">คำร้องขอเพิ่มเติม</p>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-sarabun text-slate-800 whitespace-pre-wrap">
            {reflection.additionalRequest.trim()}
          </div>
        </div>
      )}

      {recordedLabel && (
        <p className="text-[11px] text-slate-400 font-sarabun text-center pt-1">
          บันทึกเมื่อ {recordedLabel}
        </p>
      )}

      {reflection == null && completedAt && (
        <p className="text-center text-[12px] text-slate-400 font-sarabun">
          มีสถานะสอนแล้ว แต่ยังไม่มีรายละเอียดบันทึกผล
        </p>
      )}
    </div>
  );
}

export default function WeeklyTopicGrid({
  topics: initialTopics,
  semesterStart,
  semesterEnd,
  onSave,
  readOnly = false,
  planContext,
  lessonOptions = [],
}: Props) {
  const [topics, setTopics] = useState<WeeklyTopic[]>(() =>
    normalizeTopicsForCalendar(initialTopics, semesterStart),
  );
  const minMonth = useMemo(() => {
    const d = parseISO(semesterStart);
    return Number.isNaN(d.getTime()) ? startOfMonth(new Date()) : startOfMonth(d);
  }, [semesterStart]);
  const maxMonth = useMemo(() => {
    const d = parseISO(semesterEnd);
    return Number.isNaN(d.getTime()) ? startOfMonth(new Date()) : startOfMonth(d);
  }, [semesterEnd]);

  const clampToSemesterMonth = useCallback(
    (month: Date) => {
      const m = startOfMonth(month);
      if (isBefore(m, minMonth)) return minMonth;
      if (isAfter(m, maxMonth)) return maxMonth;
      return m;
    },
    [minMonth, maxMonth],
  );

  const [currentMonth, setCurrentMonth] = useState(() => clampToSemesterMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [draftLesson, setDraftLesson] = useState('');
  const [draftTitle, setDraftTitle] = useState('');
  const [draftDetails, setDraftDetails] = useState('');
  const [draftIsQuizDay, setDraftIsQuizDay] = useState(false);
  const [draftIsTeachingClosed, setDraftIsTeachingClosed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState<'plan' | 'log'>('plan');
  const [showCreateExamModal, setShowCreateExamModal] = useState(false);
  const [showQuestionSetModal, setShowQuestionSetModal] = useState(false);
  const [showReflectionModal, setShowReflectionModal] = useState(false);
  const [examPrefill, setExamPrefill] = useState<CreateRoomPrefill | null>(null);
  const [stampMode, setStampMode] = useState(false);

  const { role } = useAuth();
  const { year: academicYear, activeSemester } = useActiveAcademicYear();
  // includeClasses: false — component นี้ใช้แค่ entries ไม่ต้องเปิด listener classes ทั้งโรงเรียน
  const { entries: scheduleEntries } = useSchedule({ includeClasses: false });
  const { holidays } = useThaiHolidays(currentMonth.getFullYear());
  const { getEventsForDate, events: calendarEvents } = useAcademicCalendar(role ?? undefined, holidays);
  const todayDate = getLocalDateString();
  const todayMonth = useMemo(() => startOfMonth(parseISO(todayDate)), [todayDate]);
  const isViewingTodayMonth = isSameMonth(currentMonth, todayMonth);
  // คาบพัก/คาบพักกลางวันตั้งค่าได้ต่อห้อง (class_settings) — ต้องอ่านจากห้องที่กำลังดูอยู่จริง
  const { lunchPeriods, breakPeriods } = useScheduleSettings(planContext?.classId);
  const nonTeachingPeriods = useMemo(
    () => new Set([...lunchPeriods, ...breakPeriods]),
    [lunchPeriods, breakPeriods],
  );

  const classSubjectSchedule = useMemo(() => {
    if (!planContext?.classId || !planContext?.subjectId || !academicYear || activeSemester == null) {
      return [];
    }
    return filterScheduleForClassSubject(
      scheduleEntries,
      planContext.classId,
      planContext.subjectId,
      academicYear,
      activeSemester as 1 | 2,
      planContext.subjectName,
      nonTeachingPeriods,
    );
  }, [scheduleEntries, planContext?.classId, planContext?.subjectId, planContext?.subjectName, academicYear, activeSemester, nonTeachingPeriods]);

  const teachingSlotsBySchoolDay = useMemo(
    () => buildTeachingSlotsBySchoolDay(classSubjectSchedule),
    [classSubjectSchedule],
  );

  const hasScheduleData = classSubjectSchedule.length > 0;

  useEffect(() => {
    setTopics(normalizeTopicsForCalendar(initialTopics, semesterStart));
  }, [initialTopics, semesterStart]);

  useEffect(() => {
    setCurrentMonth((m) => clampToSemesterMonth(m));
  }, [clampToSemesterMonth]);

  const canGoPrevMonth = isAfter(currentMonth, minMonth);
  const canGoNextMonth = isBefore(currentMonth, maxMonth);

  const topicMap = useMemo(() => topicsByDate(topics), [topics]);
  const days = useMemo(() => buildMonthGrid(currentMonth), [currentMonth]);

  const mobilePlanDays = useMemo(() => {
    return days
      .filter((day) => isSameMonth(day, currentMonth))
      .map((day) => {
        const dateIso = toIsoDate(day);
        const inSemester = isWithinSemester(dateIso, semesterStart, semesterEnd);
        const dayEvents = getEventsForDate(dateIso);
        const holidayEvents = dayEvents.filter((event) => event.type === 'holiday');
        const schoolEvents = dayEvents.filter((event) => event.type !== 'holiday');
        const isHolidayDay = holidayEvents.length > 0;
        const topic = topicMap.get(dateIso);
        const hasPlan = hasTopicContent(topic);
        const isTeachingClosed = Boolean(topic?.isTeachingClosed);
        const isDone = Boolean(topic?.completedAt);
        const isQuizDay = Boolean(topic?.isQuizDay);
        const isTodayDay = isToday(day);
        const schoolDay = dateToSchoolDay(day);
        const scheduledPeriods = schoolDay ? teachingSlotsBySchoolDay.get(schoolDay)?.periods ?? [] : [];
        // ไม่พบตารางสอนของวิชา+ห้องนี้ = ปิดทุกวัน (ไม่เปิดให้กรอกมั่ว) — ดู banner เตือนด้านบนปฏิทิน
        const hasScheduledClass = hasScheduleData
          ? scheduledPeriods.length > 0 && inSemester && !isHolidayDay
          : false;
        const missingPlan = hasScheduledClass && !hasPlan && !isTeachingClosed;
        // แม้วันนี้ไม่ตรงตารางแล้ว (เช่นแผนเก่าที่กรอกไว้ผิดวันตอน fallback ยังเปิดทุกวัน)
        // ยังเปิดดู/ลบของเดิมได้ — ปิดแค่การเพิ่มแผนใหม่บนวันที่ไม่มีคาบจริง
        const canOpenDrawer = (hasScheduledClass && !readOnly) || hasSavedTopicState(topic);
        const periodLabel = formatTeachingPeriods(scheduledPeriods);

        return {
          dateIso,
          day,
          inSemester,
          hasScheduledClass,
          isHolidayDay,
          hasPlan,
          isTeachingClosed,
          isDone,
          isQuizDay,
          isTodayDay,
          missingPlan,
          canOpenDrawer,
          periodLabel,
          schoolEvents,
        };
      })
      .filter((entry) => entry.inSemester && !entry.isHolidayDay && (entry.hasScheduledClass || entry.hasPlan));
  }, [
    days,
    currentMonth,
    semesterStart,
    semesterEnd,
    topicMap,
    getEventsForDate,
    hasScheduleData,
    teachingSlotsBySchoolDay,
    readOnly,
  ]);

  const monthCalendarEvents = useMemo(() => {
    const monthStart = toIsoDate(startOfMonth(currentMonth));
    const monthEnd = toIsoDate(endOfMonth(currentMonth));
    const from = monthStart < semesterStart ? semesterStart : monthStart;
    const to = monthEnd > semesterEnd ? semesterEnd : monthEnd;
    if (from > to) return [] as CalendarEvent[];

    return calendarEvents
      .filter(
        (e) =>
          CALENDAR_EVENT_TYPES.has(e.type) &&
          e.startDate <= to &&
          e.endDate >= from,
      )
      .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.title.localeCompare(b.title));
  }, [calendarEvents, currentMonth, semesterStart, semesterEnd]);

  const selectedTopic = selectedDate ? topicMap.get(selectedDate) ?? null : null;

  const persistTopics = useCallback(async (next: WeeklyTopic[]) => {
    const normalized = normalizeTopicsForCalendar(next, semesterStart);
    setTopics(normalized);
    setSaving(true);
    try {
      await onSave(normalized);
    } finally {
      setSaving(false);
    }
  }, [onSave, semesterStart]);

  const handleStampCell = useCallback(async (dateIso: string) => {
    if (!stampMode) return;
    const existing = topicMap.get(dateIso);
    const nextTopic: WeeklyTopic = {
      date: dateIso,
      weekNumber: existing?.weekNumber ?? weekNumberFromDate(dateIso, semesterStart),
      title: existing?.title ?? '',
      lesson: existing?.lesson ?? '',
      details: existing?.details ?? '',
      isQuizDay: existing?.isQuizDay ?? false,
      isTeachingClosed: existing?.isTeachingClosed ?? false,
      isNoTeaching: !existing?.isNoTeaching,
      completedAt: existing?.completedAt ?? null,
      teachingReflection: existing?.teachingReflection ?? null,
    };
    const next = [...topics.filter((t) => t.date !== dateIso), nextTopic];
    await persistTopics(next);
  }, [stampMode, topicMap, topics, persistTopics, semesterStart]);

  const openDate = (dateIso: string, day: Date) => {
    if (stampMode) {
      handleStampCell(dateIso);
      return;
    }
    if (!isWithinSemester(dateIso, semesterStart, semesterEnd)) return;
    if (getEventsForDate(dateIso).some((event) => event.type === 'holiday')) return;
    const existing = topicMap.get(dateIso);
    if (readOnly && !hasSavedTopicState(existing)) return;

    const schoolDay = dateToSchoolDay(day);
    const scheduledPeriods = schoolDay ? teachingSlotsBySchoolDay.get(schoolDay)?.periods ?? [] : [];
    const hasScheduledClass = hasScheduleData && scheduledPeriods.length > 0;
    if (!hasScheduledClass && !hasTopicContent(existing)) return;

    setSelectedDate(dateIso);
    setDraftLesson(existing?.lesson ?? '');
    setDraftTitle(existing?.title ?? '');
    setDraftDetails(existing?.details ?? '');
    setDraftIsQuizDay(Boolean(existing?.isQuizDay));
    setDraftIsTeachingClosed(Boolean(existing?.isTeachingClosed));
    setDrawerTab('plan');
    setDrawerOpen(true);
  };

  const selectedCalendarEvents = selectedDate ? getEventsForDate(selectedDate) : [];
  const selectedSchoolCalendarEvents = selectedCalendarEvents.filter((event) => event.type !== 'holiday');
  const hasCalendarOverlap = selectedSchoolCalendarEvents.length > 0;
  const lessonSelectOptions = useMemo(() => {
    const options = lessonOptions.map((option) => option.trim()).filter(Boolean);
    const custom = draftLesson.trim();
    if (custom && !options.includes(custom)) {
      return [custom, ...options];
    }
    return options;
  }, [lessonOptions, draftLesson]);
  const hasDraftContent = Boolean(
    draftLesson.trim() || draftTitle.trim() || draftDetails.trim() || draftIsQuizDay || draftIsTeachingClosed,
  );

  const buildShortcutTitle = () => {
    const parts = [
      planContext?.subjectName,
      draftLesson.trim(),
      draftTitle.trim(),
    ].filter(Boolean);
    return parts.join(' · ') || selectedDateLabel;
  };

  const handleCreateExamRoom = () => {
    setExamPrefill({
      title: buildShortcutTitle(),
      subjectId: planContext?.subjectId,
      classId: planContext?.classId,
      gradeLevel: planContext?.gradeLevel || planContext?.className?.split('/')[0]?.trim(),
    });
    setShowCreateExamModal(true);
  };

  const buildQuestionSetPrefill = () => ({
    title: buildShortcutTitle(),
    description: draftDetails.trim(),
    gradeLevel: planContext?.gradeLevel || planContext?.className?.split('/')[0]?.trim() || '',
    department: inferDepartmentFromGrade(
      planContext?.gradeLevel || planContext?.className?.split('/')[0]?.trim(),
    ),
  });

  const handleCreateQuestionSet = () => {
    setShowQuestionSetModal(true);
  };

  const handleSavePlan = async () => {
    if (!selectedDate) return;
    const lesson = draftLesson.trim();
    const title = draftTitle.trim();
    const details = draftDetails.trim();
    if (!lesson && !title && !details && !draftIsQuizDay && !draftIsTeachingClosed) return;

    const existing = topicMap.get(selectedDate);
    const nextTopic: WeeklyTopic = {
      date: selectedDate,
      weekNumber: existing?.weekNumber ?? weekNumberFromDate(selectedDate, semesterStart),
      lesson,
      title,
      details,
      isQuizDay: draftIsQuizDay,
      isTeachingClosed: draftIsTeachingClosed,
      completedAt: existing?.completedAt ?? null,
    };

    const next = [...topics.filter((t) => t.date !== selectedDate), nextTopic];
    await persistTopics(next);
    setDrawerOpen(false);
  };

  const handleToggleComplete = async () => {
    if (!selectedDate) return;
    const existing = topicMap.get(selectedDate);
    if (!existing || !hasTopicContent(existing)) return;

    if (existing.completedAt) {
      const nextTopic: WeeklyTopic = {
        ...existing,
        completedAt: null,
        teachingReflection: null,
      };
      const next = [...topics.filter((t) => t.date !== selectedDate), nextTopic];
      await persistTopics(next);
      setDrawerOpen(false);
      return;
    }

    setShowReflectionModal(true);
  };

  const handleReflectionSubmit = async (reflection: TeachingReflection) => {
    if (!selectedDate) return;
    const existing = topicMap.get(selectedDate);
    if (!existing || !hasTopicContent(existing)) return;

    const nextTopic: WeeklyTopic = {
      ...existing,
      completedAt: new Date().toISOString(),
      teachingReflection: reflection,
    };
    const next = [...topics.filter((t) => t.date !== selectedDate), nextTopic];
    await persistTopics(next);
    setShowReflectionModal(false);
    setDrawerOpen(false);
  };

  const handleDeletePlan = async () => {
    if (!selectedDate) return;
    const next = topics.filter((t) => t.date !== selectedDate);
    await persistTopics(next);
    setDrawerOpen(false);
  };

  const selectedDateLabel = selectedDate
    ? format(parseISO(selectedDate), 'EEEE d MMMM yyyy', { locale: th })
    : '';

  const showNoScheduleWarning = Boolean(planContext?.classId) && Boolean(planContext?.subjectId) && !hasScheduleData;

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-3 max-lg:overflow-y-auto">
      {showNoScheduleWarning && (
        <div className="flex shrink-0 items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs font-bold text-amber-700 font-sarabun">
          <HiOutlineExclamationTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            ยังไม่พบตารางสอนวิชานี้ในระบบ ({planContext?.subjectName} · {planContext?.className}) — กรุณาตั้งค่าตารางสอนที่หน้า "ตารางสอน" ก่อน จึงจะเปิดให้กรอกแผนการสอนตามวันจริงได้
          </span>
        </div>
      )}

      <div
        className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl"
        style={glassCard}
      >
        <div
          className="relative flex shrink-0 items-center justify-center px-6 py-4"
          style={{ borderBottom: '1px solid rgba(0,0,0,0.04)' }}
        >
          <div className="flex items-center gap-2">
            <motion.button
              type="button"
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              disabled={!canGoPrevMonth}
              onClick={() => setCurrentMonth((m) => clampToSemesterMonth(subMonths(m, 1)))}
              className={cn(
                'flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition-colors hover:text-slate-600',
                !canGoPrevMonth && 'pointer-events-none opacity-30',
              )}
              style={{ background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.05)' }}
              aria-label="เดือนก่อนหน้า"
            >
              <HiChevronLeft size={15} />
            </motion.button>

            <div className="flex min-h-[46px] min-w-0 flex-col items-center justify-center">
              <motion.div
                key={currentMonth.toISOString()}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 24 }}
                className="text-center"
              >
                <h2 className="text-base font-black tracking-tight text-slate-800 font-sukhumvit">
                  {format(currentMonth, 'MMMM', { locale: th })} {currentMonth.getFullYear() + 543}
                </h2>
              </motion.div>
              {!isViewingTodayMonth && (
                <motion.button
                  type="button"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setCurrentMonth(clampToSemesterMonth(todayMonth))}
                  className="mt-1 rounded-full border border-blue-100/50 bg-blue-50 px-2.5 py-0.5 text-[9px] font-black text-blue-600 transition-all hover:bg-blue-100 hover:text-blue-700 font-sukhumvit"
                  aria-label="กลับวันปัจจุบัน"
                >
                  กลับสู่วันนี้
                </motion.button>
              )}
            </div>

            <motion.button
              type="button"
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              disabled={!canGoNextMonth}
              onClick={() => setCurrentMonth((m) => clampToSemesterMonth(addMonths(m, 1)))}
              className={cn(
                'flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition-colors hover:text-slate-600',
                !canGoNextMonth && 'pointer-events-none opacity-30',
              )}
              style={{ background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.05)' }}
              aria-label="เดือนถัดไป"
            >
              <HiChevronRight size={15} />
            </motion.button>
          </div>

          {!readOnly && (
            <motion.button
              type="button"
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              onClick={() => setStampMode(!stampMode)}
              title={stampMode ? 'ออกจากโหมด stamp' : 'เลือกวันที่ไม่มีการสอน'}
              className={cn(
                'absolute right-6 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-sm font-black transition-colors',
                stampMode ? 'text-amber-700' : 'text-slate-400 hover:text-slate-600',
              )}
              style={{
                background: stampMode ? 'rgba(217,119,6,0.12)' : 'rgba(0,0,0,0.04)',
                border: stampMode ? '1px solid rgba(217,119,6,0.18)' : '1px solid rgba(0,0,0,0.05)',
              }}
            >
              ⊗
            </motion.button>
          )}
        </div>

        <div className="flex flex-col lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
        <div className="grid shrink-0 grid-cols-7 px-5 pt-4 pb-2">
          {DAY_NAMES.map((label, index) => (
            <div
              key={label}
              className="text-center text-[10px] font-black pb-2 font-sukhumvit uppercase tracking-widest"
              style={{
                color: index === 0 ? 'rgba(239,68,68,0.65)' : index === 6 ? 'rgba(59,130,246,0.65)' : 'rgba(15,23,42,0.22)',
              }}
            >
              {label}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1 px-5 pb-5 max-lg:auto-rows-[minmax(52px,auto)] lg:flex-1 lg:auto-rows-fr">
          {days.map((day) => {
            const dateIso = toIsoDate(day);
            const inMonth = isSameMonth(day, currentMonth);
            const inSemester = isWithinSemester(dateIso, semesterStart, semesterEnd);
            const dayEvents = inMonth ? getEventsForDate(dateIso) : [];
            const holidayEvents = dayEvents.filter((event) => event.type === 'holiday');
            const infoEvent =
              holidayEvents[0]
              ?? dayEvents.find((e) => e.type === 'exam')
              ?? dayEvents.find((e) => e.type === 'activity')
              ?? null;
            const isHolidayDay = holidayEvents.length > 0;
            const topic = topicMap.get(dateIso);
            const hasPlan = hasTopicContent(topic);
            const isTeachingClosed = Boolean(topic?.isTeachingClosed);
            const isNoTeaching = Boolean(topic?.isNoTeaching);
            const isDone = Boolean(topic?.completedAt);
            const isTodayDay = isToday(day);
            const dow = day.getDay();
            const schoolDay = dateToSchoolDay(day);
            const scheduledPeriods = schoolDay ? teachingSlotsBySchoolDay.get(schoolDay)?.periods ?? [] : [];
            const hasScheduledClass = hasScheduleData
              ? scheduledPeriods.length > 0 && inSemester && !isHolidayDay
              : false;
            const canOpenDrawer = (hasScheduledClass && !readOnly) || hasSavedTopicState(topic);
            const periodLabel = formatTeachingPeriods(scheduledPeriods);
            const statusDot: DayPlanDot | null =
              !inMonth || !inSemester || isHolidayDay
                ? null
                : isNoTeaching
                  ? 'closed'
                  : isTeachingClosed && hasScheduledClass
                  ? 'closed'
                  : hasPlan
                    ? 'done'
                    : hasScheduledClass
                      ? dateIso > todayDate
                        ? 'upcoming'
                        : 'pending'
                      : null;

            return (
              <button
                key={dateIso}
                type="button"
                disabled={!canOpenDrawer && !isHolidayDay && !(stampMode && hasScheduledClass)}
                onClick={() => (canOpenDrawer || (stampMode && hasScheduledClass) ? openDate(dateIso, day) : undefined)}
                title={
                  isNoTeaching
                    ? 'ไม่มีการสอน'
                    : isHolidayDay
                    ? holidayEvents.map((e) => e.title).join(', ')
                    : hasScheduledClass
                      ? periodLabel || undefined
                      : hasScheduleData
                        ? 'ไม่มีคาบสอนตามตาราง'
                        : undefined
                }
                className={cn(
                  'relative flex h-full min-h-[100px] flex-col overflow-hidden rounded-[1.25rem] border border-slate-200/40 p-2 text-left transition-all duration-200 lg:min-h-[100px]',
                  !statusDot && 'bg-white',
                  !inMonth && 'opacity-35',
                  inMonth && !inSemester && 'cursor-not-allowed opacity-35',
                  inMonth && inSemester && !hasScheduledClass && !hasPlan && !isHolidayDay && 'cursor-not-allowed opacity-55',
                  isHolidayDay && 'cursor-not-allowed border-slate-200 bg-slate-100 opacity-50',
                  isNoTeaching && 'border-slate-300 bg-slate-100 opacity-70',
                  statusDot && !isNoTeaching && MOBILE_STATUS_CELL_CLASS[statusDot],
                  (canOpenDrawer || (stampMode && hasScheduledClass)) && 'cursor-pointer lg:hover:bg-slate-50',
                )}
              >
                <div className="flex items-start justify-between gap-1 w-full">
                  <span
                    className="w-6 h-6 flex items-center justify-center rounded-full text-[10px] font-black font-sukhumvit flex-shrink-0"
                    style={{
                      background: isTodayDay && inSemester && !isHolidayDay
                        ? 'linear-gradient(135deg, #7c3aed, #4f46e5)'
                        : 'transparent',
                      boxShadow: isTodayDay && inSemester && !isHolidayDay ? '0 2px 8px rgba(124,58,237,0.3)' : 'none',
                      color: isTodayDay && inSemester && !isHolidayDay
                        ? '#fff'
                        : isHolidayDay
                          ? '#ef4444'
                          : dow === 0
                            ? '#ef4444'
                            : dow === 6
                              ? '#3b82f6'
                              : 'rgba(15,23,42,0.78)',
                    }}
                  >
                    {day.getDate()}
                  </span>
                  {statusDot === 'upcoming' && (
                    <span className="mt-1 hidden h-2 w-2 shrink-0 rounded-full bg-slate-300 lg:inline-block" aria-label="ยังไม่ถึงวัน" />
                  )}
                  {statusDot === 'pending' && (
                    <span className="mt-1 hidden h-2 w-2 shrink-0 rounded-full bg-rose-500 lg:inline-block" aria-label="ยังไม่มีแผน" />
                  )}
                  {statusDot === 'done' && (
                    isDone ? (
                      <HiCheckCircle size={14} className="hidden shrink-0 text-emerald-500 lg:inline" aria-label="สอนแล้ว" />
                    ) : (
                      <span className="mt-1 hidden h-2 w-2 shrink-0 rounded-full bg-emerald-500 lg:inline-block" aria-label="มีแผนแล้ว" />
                    )
                  )}
                  {statusDot === 'closed' && (
                    <span className="mt-1 hidden h-2 w-2 shrink-0 rounded-full bg-slate-400 lg:inline-block" aria-label="ปิดการสอน" />
                  )}
                </div>

                {isNoTeaching && inSemester ? (
                  <p className="mt-auto hidden text-[8px] font-bold leading-tight text-slate-400 font-sarabun lg:line-clamp-2 lg:block lg:text-[9px] line-through">
                    ไม่มีการสอน
                  </p>
                ) : isHolidayDay && infoEvent ? (
                  <p className={cn('mt-auto hidden text-[8px] font-bold leading-tight font-sukhumvit lg:line-clamp-2 lg:block lg:text-[9px]', EVENT_LABEL_CLASS.holiday)}>
                    {infoEvent.title}
                  </p>
                ) : statusDot === 'closed' ? (
                  <p className="mt-auto hidden text-[8px] font-bold leading-tight text-slate-500 font-sarabun lg:line-clamp-2 lg:block lg:text-[9px]">
                    ปิดการสอน
                  </p>
                ) : statusDot === 'pending' ? (
                  <p className="mt-auto hidden text-[8px] font-bold leading-tight text-rose-600 font-sukhumvit lg:line-clamp-2 lg:block lg:text-[9px]">
                    ยังไม่มีแผน
                  </p>
                ) : hasScheduledClass && periodLabel ? (
                  <p className={cn(CELL_BODY_TEXT, 'mt-auto text-[8px] font-black leading-tight text-blue-600 font-sukhumvit lg:text-[9px]')}>
                    {periodLabel}
                  </p>
                ) : infoEvent && infoEvent.type !== 'holiday' ? (
                  <p
                    className={cn(
                      'mt-auto hidden text-[8px] font-bold leading-tight font-sukhumvit lg:line-clamp-2 lg:block lg:text-[9px]',
                      EVENT_LABEL_CLASS[infoEvent.type as 'exam' | 'activity'],
                    )}
                  >
                    {infoEvent.title}
                  </p>
                ) : null}
              </button>
            );
          })}
        </div>
        </div>
      </div>

      <div className="space-y-2 px-1 pb-2 lg:hidden">
        <p className="px-0.5 text-[10px] font-black uppercase tracking-wider text-slate-500 font-sukhumvit">
          แผนการสอนเดือนนี้
        </p>
        {mobilePlanDays.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-6 text-center text-sm font-bold text-slate-400 font-sarabun">
            ไม่มีคาบสอนในเดือนนี้
          </div>
        ) : (
          mobilePlanDays.map((entry) => {
            const dateLabel = format(entry.day, 'EEE d MMM', { locale: th });
            const topicEntry = topicMap.get(entry.dateIso);
            const isNoTeaching = Boolean(topicEntry?.isNoTeaching);
            const status: DayPlanDot = isNoTeaching
              ? 'closed'
              : entry.isTeachingClosed
              ? 'closed'
              : entry.hasPlan
                ? 'done'
                : entry.dateIso > todayDate
                  ? 'upcoming'
                  : 'pending';

            return (
              <button
                key={entry.dateIso}
                type="button"
                disabled={!entry.canOpenDrawer && !(stampMode && entry.hasScheduledClass)}
                onClick={() => (entry.canOpenDrawer || (stampMode && entry.hasScheduledClass) ? openDate(entry.dateIso, entry.day) : undefined)}
                className={cn(
                  'w-full rounded-xl border px-3 py-2.5 text-left transition-all active:scale-[0.99]',
                  status === 'upcoming' && 'border-slate-200 bg-slate-50',
                  status === 'pending' && 'border-rose-200 bg-rose-50',
                  status === 'done' && !isNoTeaching && 'border-emerald-200 bg-emerald-50',
                  (status === 'closed' || isNoTeaching) && 'border-slate-300 bg-slate-100',
                  (entry.canOpenDrawer || (stampMode && entry.hasScheduledClass)) && 'hover:brightness-[0.98]',
                  !entry.canOpenDrawer && !(stampMode && entry.hasScheduledClass) && 'cursor-not-allowed opacity-60',
                )}
              >
                <div className="flex items-start gap-2">
                  <span
                    className={cn(
                      'mt-0.5 shrink-0 text-[10px] font-black uppercase tracking-wide',
                      status === 'upcoming' && 'text-slate-500',
                      status === 'pending' && 'text-rose-500',
                      status === 'done' && !isNoTeaching && 'text-emerald-600',
                      (status === 'closed' || isNoTeaching) && 'text-slate-500',
                    )}
                  >
                    {isNoTeaching
                      ? 'ไม่มีการสอน'
                      : status === 'closed'
                      ? 'ปิดสอน'
                      : status === 'pending'
                        ? 'ยังไม่มีแผน'
                        : status === 'upcoming'
                          ? 'ยังไม่ถึงวัน'
                          : entry.isDone
                            ? 'สอนแล้ว'
                            : 'มีแผนแล้ว'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        'min-h-5 text-xs font-bold leading-5 text-slate-800 font-sarabun',
                        entry.isTodayDay && 'text-blue-700',
                        isNoTeaching && 'line-through text-slate-400',
                      )}
                    >
                      {dateLabel}
                      {entry.periodLabel && !isNoTeaching ? ` · ${entry.periodLabel}` : ''}
                    </p>
                  </div>
                </div>
              </button>
            );
          })
        )}

        {monthCalendarEvents.length > 0 && (
          <>
            <p className="px-0.5 pt-2 text-[10px] font-black uppercase tracking-wider text-slate-500 font-sukhumvit">
              วันหยุด / สอบ / กิจกรรม
            </p>
            {monthCalendarEvents.map((event) => {
              const type = event.type as 'holiday' | 'exam' | 'activity';
              return (
                <div
                  key={event.id}
                  className={cn('rounded-xl border px-3 py-2.5', EVENT_CARD_CLASS[type])}
                >
                  <div className="flex items-start gap-2">
                    <span className={cn('mt-0.5 shrink-0 text-[10px] font-black uppercase tracking-wide', EVENT_LABEL_CLASS[type])}>
                      {EVENT_TYPE_CONFIG[type].label}
                    </span>
                    <p className="min-h-10 min-w-0 line-clamp-2 text-xs font-bold leading-5 text-slate-800 font-sarabun">
                      {event.title?.trim() || EVENT_TYPE_CONFIG[type].label}
                    </p>
                  </div>
                  <p className="mt-0.5 text-[10px] font-medium text-slate-500 font-sarabun">
                    {formatEventDateRange(event.startDate, event.endDate)}
                  </p>
                </div>
              );
            })}
          </>
        )}
      </div>

      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen} direction="right">
        <DrawerContent className={DRAWER_CONTENT_CLASS}>
          <div className={DRAWER_PANEL_CLASS}>
          <DrawerHeader className="shrink-0 px-4 pb-3 pt-4">
            <div className="relative flex min-h-10 items-center justify-center">
              <div className="min-w-0 px-12 text-center">
                <DrawerTitle className="text-base font-black text-slate-800 font-sukhumvit">
                  {readOnly ? 'แผนการสอน' : selectedTopic ? 'แก้ไขแผนการสอน' : 'เพิ่มแผนการสอน'}
                </DrawerTitle>
                <DrawerDescription className="text-xs text-slate-500 font-sarabun">
                  {selectedDateLabel}
                </DrawerDescription>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="absolute right-0 top-1/2 inline-flex size-9 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 active:scale-[0.98]"
                aria-label="ปิด"
              >
                <HiOutlineXMark className="size-5" />
              </button>
            </div>
          </DrawerHeader>

          <div className="shrink-0 px-4 pb-2">
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setDrawerTab('plan')}
                className={cn(
                  'h-9 rounded-lg text-[12px] font-black font-sukhumvit transition-colors',
                  drawerTab === 'plan'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700',
                )}
              >
                แผนการสอน
              </button>
              <button
                type="button"
                onClick={() => setDrawerTab('log')}
                className={cn(
                  'h-9 rounded-lg text-[12px] font-black font-sukhumvit transition-colors',
                  drawerTab === 'log'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700',
                )}
              >
                บันทึกการสอน
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-2 space-y-3">
            {drawerTab === 'plan' ? (
              <>
            {selectedTopic?.isNoTeaching && (
              <div className="flex items-start gap-2 rounded-2xl border border-slate-300 bg-slate-100 px-3 py-3">
                <span className="mt-1 h-2 w-2 rounded-full shrink-0 bg-slate-500" />
                <div className="min-w-0">
                  <p className="text-sm font-black text-slate-800 font-sukhumvit">ไม่มีการสอนในวันนี้</p>
                  <p className="text-[11px] text-slate-600 font-sarabun">
                    ไม่นับการเช็คชื่อนักเรียน และ ไม่นับใน KPI ของครู
                  </p>
                </div>
              </div>
            )}

            {hasCalendarOverlap && (
              <div className="space-y-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 space-y-1.5">
                  <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                    กิจกรรมจากปฏิทินการศึกษา
                  </p>
                  {selectedSchoolCalendarEvents.map((event) => (
                    <div key={event.id} className="flex items-start gap-2">
                      <span
                        className="mt-1 h-2 w-2 rounded-full shrink-0"
                        style={{ background: EVENT_TYPE_CONFIG[event.type].color }}
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-700 font-sarabun">{event.title}</p>
                        <p className="text-[10px] text-slate-400">{EVENT_TYPE_CONFIG[event.type].label}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                  <div className="min-w-0 pr-3">
                    <p className="text-sm font-black text-slate-800 font-sukhumvit">ปิดการสอน</p>
                    <p className="text-[11px] text-slate-500 font-sarabun">
                      ไม่มีการสอนในวันนี้ เนื่องจากทับกับกำหนดการจากปฏิทินการศึกษา
                    </p>
                  </div>
                  <Switch
                    checked={draftIsTeachingClosed}
                    onCheckedChange={setDraftIsTeachingClosed}
                    disabled={readOnly}
                    aria-label="ปิดการสอน"
                  />
                </div>
              </div>
            )}

            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-wide">
                  บทเรียน
                </label>
                {readOnly ? (
                  <div className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-sarabun text-slate-800 min-h-[2.75rem]">
                    {draftLesson.trim() || <span className="text-slate-400">—</span>}
                  </div>
                ) : (
                  <Select
                    value={draftLesson || undefined}
                    onValueChange={setDraftLesson}
                    disabled={lessonSelectOptions.length === 0}
                  >
                    <SelectTrigger className="w-full min-h-[2.75rem] h-auto rounded-2xl border-slate-200 bg-white px-3 py-3 text-sm font-sarabun text-slate-800 shadow-none focus:ring-2 focus:ring-blue-100 disabled:opacity-60">
                      <SelectValue
                        placeholder={
                          lessonSelectOptions.length > 0
                            ? 'เลือกบทเรียน...'
                            : 'ยังไม่มีบทเรียน — ตั้งค่าที่ปุ่ม ⚙️'
                        }
                      />
                    </SelectTrigger>
                    <SelectContent className="z-[200] rounded-2xl max-h-60 font-sarabun" position="popper">
                      {lessonSelectOptions.map((option) => (
                        <SelectItem
                          key={option}
                          value={option}
                          className="text-sm font-sarabun text-slate-800"
                        >
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-wide">
                  หัวข้อ
                </label>
                {readOnly ? (
                  <div className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-sarabun text-slate-800 min-h-[2.75rem]">
                    {draftTitle.trim() || <span className="text-slate-400">—</span>}
                  </div>
                ) : (
                  <input
                    value={draftTitle}
                    onChange={(e) => setDraftTitle(e.target.value)}
                    placeholder="ระบุหัวข้อที่จะสอนในวันนี้..."
                    className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-sarabun text-slate-800 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                  />
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-wide">
                  รายละเอียดเพิ่มเติม
                </label>
                {readOnly ? (
                  <div className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-sarabun text-slate-800 min-h-[5rem] whitespace-pre-wrap">
                    {draftDetails.trim() || <span className="text-slate-400">—</span>}
                  </div>
                ) : (
                  <textarea
                    value={draftDetails}
                    onChange={(e) => setDraftDetails(e.target.value)}
                    rows={4}
                    placeholder="หมายเหตุ กิจกรรมในชั้นเรียน หรือสิ่งที่ต้องเตรียม..."
                    className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-sarabun text-slate-800 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100 resize-none"
                  />
                )}
              </div>

              <div className="flex items-center justify-between rounded-2xl border border-amber-100 bg-amber-50/70 px-3 py-3">
                <div className="min-w-0 pr-3">
                  <p className="text-sm font-black text-slate-800 font-sukhumvit">วันสอบย่อยเก็บคะแนน</p>
                  <p className="text-[11px] text-slate-500 font-sarabun">กำหนดวันนี้เป็นวันสอบย่อยเพื่อเก็บคะแนน</p>
                </div>
                <Switch
                  checked={draftIsQuizDay}
                  onCheckedChange={setDraftIsQuizDay}
                  disabled={readOnly}
                  aria-label="วันสอบย่อยเก็บคะแนน"
                />
              </div>
            </div>

            {!readOnly && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleCreateExamRoom}
                  className="flex items-center justify-center gap-2 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-black text-sky-700 hover:bg-sky-100 transition-colors"
                >
                  <HiOutlineComputerDesktop size={18} />
                  สร้างห้องสอบออนไลน์
                </button>
                <button
                  type="button"
                  onClick={handleCreateQuestionSet}
                  className="flex items-center justify-center gap-2 rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm font-black text-violet-700 hover:bg-violet-100 transition-colors"
                >
                  <HiOutlineDocumentText size={18} />
                  สร้างข้อสอบ
                </button>
              </div>
            )}

            {!readOnly && selectedTopic && hasTopicContent(selectedTopic) && !selectedTopic.isNoTeaching && (
              <button
                type="button"
                onClick={() => void handleToggleComplete()}
                className={cn(
                  'w-full flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-black transition-colors',
                  selectedTopic.completedAt
                    ? 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                    : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
                )}
              >
                {selectedTopic.completedAt ? (
                  <>
                    <HiOutlineCheckCircle size={18} />
                    ยกเลิกสถานะสอนแล้ว
                  </>
                ) : (
                  <>
                    <HiCheckCircle size={18} />
                    ทำเครื่องหมายว่าสอนแล้ว
                  </>
                )}
              </button>
            )}

            {readOnly && selectedTopic?.completedAt && (
              <div className="flex items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-700">
                <HiCheckCircle size={18} />
                สอนแล้ว
              </div>
            )}
              </>
            ) : (
              <TeachingLogPanel reflection={selectedTopic?.teachingReflection} completedAt={selectedTopic?.completedAt} />
            )}
          </div>

          {(drawerTab === 'plan' && !readOnly) && (
            <DrawerFooter className="mt-0 shrink-0 border-t border-slate-100 bg-white px-4 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] flex-row gap-2">
              {hasSavedTopicState(selectedTopic) && (
                <button
                  type="button"
                  onClick={() => void handleDeletePlan()}
                  className="inline-flex h-11 items-center justify-center gap-1.5 rounded-2xl border border-rose-200 bg-rose-50 px-4 text-sm font-black text-rose-600 hover:bg-rose-100"
                >
                  <HiOutlineTrash size={16} />
                  ลบ
                </button>
              )}
              <button
                type="button"
                disabled={!hasDraftContent || saving}
                onClick={() => void handleSavePlan()}
                className="flex-1 h-11 rounded-2xl bg-blue-600 text-sm font-black text-white hover:bg-blue-700 disabled:opacity-50"
              >
                บันทึก
              </button>
            </DrawerFooter>
          )}
          </div>
        </DrawerContent>
      </Drawer>

      {(showCreateExamModal || showQuestionSetModal) && (
        <TeachingPlanExamModals
          showCreateExamModal={showCreateExamModal}
          showQuestionSetModal={showQuestionSetModal}
          examPrefill={examPrefill}
          questionSetPrefill={showQuestionSetModal ? buildQuestionSetPrefill() : null}
          questionSetKey={`qsb-plan-${showQuestionSetModal ? buildShortcutTitle() : 'closed'}`}
          onCloseExam={() => {
            setShowCreateExamModal(false);
            setExamPrefill(null);
          }}
          onCloseQuestionSet={() => setShowQuestionSetModal(false)}
        />
      )}

      <TeachingReflectionModal
        open={showReflectionModal}
        onClose={() => setShowReflectionModal(false)}
        onSubmit={handleReflectionSubmit}
        classId={planContext?.classId}
        dateLabel={selectedDateLabel}
      />
    </div>
  );
}
