import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  addMonths,
  format,
  isSameMonth,
  isToday,
  parseISO,
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
  HiOutlinePlus,
  HiOutlineTrash,
  HiOutlineXMark,
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
import { CreateRoomModal, type CreateRoomPrefill } from '@/features/exam/components/CreateRoomModal';
import QuestionSetBuilder from '@/features/questionBank/components/QuestionSetBuilder';
import TeachingReflectionModal from './TeachingReflectionModal';
import { useAuth } from '@/hooks/useAuth';
import { useExamRoom } from '@/hooks/useExamRoom';
import { useActiveAcademicYear } from '@/hooks/useActiveAcademicYear';
import { useAcademicCalendar } from '@/hooks/useAcademicCalendar';
import { useSchedule } from '@/hooks/useSchedule';
import { useQuestionSetBank } from '@/hooks/useQuestionSetBank';
import { useThaiHolidays } from '@/features/calendar/hooks/useThaiHolidays';
import { EVENT_TYPE_CONFIG } from '@/types/calendar';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import type { TeachingReflection, WeeklyTopic } from '@/types/microSyllabus';
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

const DAY_NAMES = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'] as const;

const CELL_BODY_TEXT = 'hidden lg:block';

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
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [draftLesson, setDraftLesson] = useState('');
  const [draftTitle, setDraftTitle] = useState('');
  const [draftDetails, setDraftDetails] = useState('');
  const [draftIsQuizDay, setDraftIsQuizDay] = useState(false);
  const [draftIsTeachingClosed, setDraftIsTeachingClosed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showCreateExamModal, setShowCreateExamModal] = useState(false);
  const [showQuestionSetModal, setShowQuestionSetModal] = useState(false);
  const [showReflectionModal, setShowReflectionModal] = useState(false);
  const [examPrefill, setExamPrefill] = useState<CreateRoomPrefill | null>(null);

  const { role } = useAuth();
  const { year: academicYear, activeSemester } = useActiveAcademicYear();
  const { entries: scheduleEntries } = useSchedule();
  const { createRoom, updateRoom } = useExamRoom();
  const { questionSets, addQuestionSet } = useQuestionSetBank();
  const { holidays } = useThaiHolidays(currentMonth.getFullYear());
  const { getEventsForDate } = useAcademicCalendar(role ?? undefined, holidays);

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
    );
  }, [scheduleEntries, planContext?.classId, planContext?.subjectId, academicYear, activeSemester]);

  const teachingSlotsBySchoolDay = useMemo(
    () => buildTeachingSlotsBySchoolDay(classSubjectSchedule),
    [classSubjectSchedule],
  );

  const hasScheduleData = classSubjectSchedule.length > 0;

  useEffect(() => {
    setTopics(normalizeTopicsForCalendar(initialTopics, semesterStart));
  }, [initialTopics, semesterStart]);

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
        const planLesson = topic?.lesson?.trim() ?? '';
        const planContent = topic?.title?.trim() || topic?.details?.trim() || '';
        const isTeachingClosed = Boolean(topic?.isTeachingClosed);
        const isDone = Boolean(topic?.completedAt);
        const isQuizDay = Boolean(topic?.isQuizDay);
        const isTodayDay = isToday(day);
        const schoolDay = dateToSchoolDay(day);
        const scheduledPeriods = schoolDay ? teachingSlotsBySchoolDay.get(schoolDay)?.periods ?? [] : [];
        const hasScheduledClass = hasScheduleData
          ? scheduledPeriods.length > 0 && inSemester && !isHolidayDay
          : inSemester && !isHolidayDay && schoolDay !== null;
        const missingPlan = hasScheduledClass && !hasPlan && !isTeachingClosed;
        const canOpenDrawer = hasScheduledClass && (!readOnly || hasSavedTopicState(topic));
        const periodLabel = formatTeachingPeriods(scheduledPeriods);

        return {
          dateIso,
          day,
          inSemester,
          hasScheduledClass,
          isHolidayDay,
          hasPlan,
          planLesson,
          planContent,
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
      .filter((entry) => entry.inSemester && entry.hasScheduledClass && !entry.isHolidayDay);
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

  const openDate = (dateIso: string, day: Date) => {
    if (!isWithinSemester(dateIso, semesterStart, semesterEnd)) return;
    if (getEventsForDate(dateIso).some((event) => event.type === 'holiday')) return;
    const existing = topicMap.get(dateIso);
    if (readOnly && !hasSavedTopicState(existing)) return;

    const schoolDay = dateToSchoolDay(day);
    const scheduledPeriods = schoolDay ? teachingSlotsBySchoolDay.get(schoolDay)?.periods ?? [] : [];
    const hasScheduledClass = hasScheduleData
      ? scheduledPeriods.length > 0
      : schoolDay !== null;
    if (hasScheduleData && !hasScheduledClass && !hasTopicContent(existing)) return;

    setSelectedDate(dateIso);
    setDraftLesson(existing?.lesson ?? '');
    setDraftTitle(existing?.title ?? '');
    setDraftDetails(existing?.details ?? '');
    setDraftIsQuizDay(Boolean(existing?.isQuizDay));
    setDraftIsTeachingClosed(Boolean(existing?.isTeachingClosed));
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

  const handleQuestionSetSubmit = async (data: NewQuestionSet) => {
    await addQuestionSet(data);
    setShowQuestionSetModal(false);
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

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col">
        <div className="flex items-center justify-between gap-2 px-1 py-3">
          <button
            type="button"
            onClick={() => setCurrentMonth((m) => subMonths(m, 1))}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-500 hover:bg-white hover:text-slate-800 transition-colors"
            aria-label="เดือนก่อนหน้า"
          >
            <HiChevronLeft size={18} />
          </button>

          <div className="text-center min-w-0">
            <p className="text-sm font-black text-slate-800 font-sukhumvit">
              {format(currentMonth, 'MMMM', { locale: th })}{' '}
              {currentMonth.getFullYear() + 543}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-500 hover:bg-white hover:text-slate-800 transition-colors"
            aria-label="เดือนถัดไป"
          >
            <HiChevronRight size={18} />
          </button>
        </div>

        <div className="grid grid-cols-7 px-1 pt-1 pb-1">
          {DAY_NAMES.map((label, index) => (
            <div
              key={label}
              className={cn(
                'text-center text-[10px] font-black pb-2 font-sukhumvit uppercase tracking-wide',
                index === 0 ? 'text-rose-400' : index === 6 ? 'text-blue-400' : 'text-slate-400',
              )}
            >
              {label}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1 px-1 pb-2">
          {days.map((day) => {
            const dateIso = toIsoDate(day);
            const inMonth = isSameMonth(day, currentMonth);
            const inSemester = isWithinSemester(dateIso, semesterStart, semesterEnd);
            const dayEvents = inMonth ? getEventsForDate(dateIso) : [];
            const holidayEvents = dayEvents.filter((event) => event.type === 'holiday');
            const schoolEvents = dayEvents.filter((event) => event.type !== 'holiday');
            const isHolidayDay = holidayEvents.length > 0;
            const topic = topicMap.get(dateIso);
            const hasPlan = hasTopicContent(topic);
            const planLesson = topic?.lesson?.trim() ?? '';
            const planContent = topic?.title?.trim() || topic?.details?.trim() || '';
            const isTeachingClosed = Boolean(topic?.isTeachingClosed);
            const isDone = Boolean(topic?.completedAt);
            const isTodayDay = isToday(day);
            const dow = day.getDay();
            const isSelected = selectedDate === dateIso;
            const holidayLabel = holidayEvents.map((event) => event.title).join(', ');
            const schoolDay = dateToSchoolDay(day);
            const scheduledPeriods = schoolDay ? teachingSlotsBySchoolDay.get(schoolDay)?.periods ?? [] : [];
            const hasScheduledClass = hasScheduleData
              ? scheduledPeriods.length > 0 && inSemester && !isHolidayDay
              : inSemester && !isHolidayDay && schoolDay !== null;
            const missingPlan = hasScheduledClass && !hasPlan && !isTeachingClosed;
            const needsPlan = missingPlan && !readOnly;
            const canOpenDrawer = hasScheduledClass && (!readOnly || hasSavedTopicState(topic));
            const periodLabel = formatTeachingPeriods(scheduledPeriods);

            return (
              <button
                key={dateIso}
                type="button"
                disabled={!canOpenDrawer && !isHolidayDay}
                onClick={() => (canOpenDrawer ? openDate(dateIso, day) : undefined)}
                title={
                  isHolidayDay
                    ? holidayLabel
                    : hasScheduledClass
                      ? periodLabel || schoolEvents.map((event) => event.title).join(', ')
                      : hasScheduleData
                        ? 'ไม่มีคาบสอนตามตาราง'
                        : schoolEvents.map((event) => event.title).join(', ')
                }
                className={cn(
                  'relative flex min-h-[52px] flex-col rounded-xl border border-slate-300 p-1.5 text-left transition-all lg:min-h-[80px]',
                  !inMonth && 'opacity-35',
                  isHolidayDay && 'cursor-not-allowed bg-slate-50/60 border-slate-200',
                  hasScheduleData && !isHolidayDay && inSemester && !hasScheduledClass && 'cursor-not-allowed bg-slate-50/40 border-slate-200 opacity-55',
                  !isHolidayDay && missingPlan && cn(
                    'border-dashed border-rose-300 bg-rose-50/80',
                    canOpenDrawer && 'hover:border-rose-400 hover:bg-rose-50 cursor-pointer',
                  ),
                  !isHolidayDay && canOpenDrawer && hasPlan && !isTeachingClosed && 'border-emerald-300 bg-emerald-50/80 hover:border-emerald-400 hover:bg-emerald-50 cursor-pointer',
                  !isHolidayDay && canOpenDrawer && !hasPlan && !missingPlan && 'hover:border-blue-300 hover:bg-blue-50/40 cursor-pointer',
                  !isHolidayDay && !canOpenDrawer && !hasScheduleData && 'cursor-not-allowed bg-slate-50/60 border-slate-200',
                  isSelected && 'border-blue-300 bg-blue-50 ring-1 ring-blue-200',
                  !isHolidayDay && hasPlan && hasScheduledClass && !isSelected && !isTeachingClosed && 'border-emerald-300 bg-emerald-50/80',
                  !isHolidayDay && isTeachingClosed && hasScheduledClass && 'border-slate-300 bg-slate-100/90',
                  !isHolidayDay && schoolEvents.length > 0 && !hasPlan && !hasScheduledClass && 'border-slate-200 bg-slate-50/40',
                )}
              >
                <div className="flex items-start justify-between gap-1">
                  <span
                    className={cn(
                      'inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-[11px] font-black tabular-nums',
                      isTodayDay && !isHolidayDay && 'bg-blue-600 text-white shadow-sm',
                      isTodayDay && isHolidayDay && 'bg-rose-500 text-white shadow-sm',
                      !isTodayDay && (isHolidayDay || dow === 0) && 'text-rose-500',
                      !isTodayDay && !isHolidayDay && dow === 6 && 'text-blue-500',
                      !isTodayDay && !isHolidayDay && dow > 0 && dow < 6 && 'text-slate-700',
                    )}
                  >
                    {day.getDate()}
                  </span>
                  {isHolidayDay ? null : isTeachingClosed ? (
                    <span className="h-2 w-2 rounded-full bg-slate-400 shrink-0 mt-1" />
                  ) : hasPlan ? (
                    isDone ? (
                      <HiCheckCircle size={14} className="shrink-0 text-emerald-500" />
                    ) : (
                      <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0 mt-1" />
                    )
                  ) : canOpenDrawer && !readOnly ? (
                    <HiOutlinePlus
                      size={12}
                      className={cn(
                        'shrink-0 mt-0.5',
                        needsPlan ? 'text-rose-500' : 'text-slate-300',
                      )}
                    />
                  ) : null}
                </div>

                {hasScheduledClass && periodLabel && !hasPlan && !isTeachingClosed && (
                  <p className={cn(CELL_BODY_TEXT, 'mt-1 text-[9px] font-black leading-tight font-sukhumvit text-blue-600')}>
                    {periodLabel}
                  </p>
                )}

                {needsPlan && (
                  <p className={cn(CELL_BODY_TEXT, 'mt-auto text-[9px] font-black leading-tight font-sarabun text-rose-600')}>
                    ยังไม่มีแผน
                  </p>
                )}

                {isTeachingClosed && (
                  <p className={cn(CELL_BODY_TEXT, 'mt-auto text-[9px] font-black leading-tight font-sarabun text-slate-500')}>
                    ปิดการสอน
                  </p>
                )}

                {isHolidayDay && (
                  <div className={cn(CELL_BODY_TEXT, 'mt-1 space-y-0.5')}>
                    {holidayEvents.slice(0, 2).map((event) => (
                      <p
                        key={event.id}
                        className="line-clamp-2 text-[9px] font-bold leading-tight font-sarabun"
                        style={{ color: EVENT_TYPE_CONFIG.holiday.color }}
                      >
                        {event.title}
                      </p>
                    ))}
                  </div>
                )}

                {!isHolidayDay && schoolEvents.length > 0 && (
                  <div className={cn(CELL_BODY_TEXT, 'mt-1 space-y-0.5')}>
                    {schoolEvents.slice(0, hasPlan ? 1 : 2).map((event) => (
                      <p
                        key={event.id}
                        className="line-clamp-1 text-[9px] font-bold leading-tight font-sarabun"
                        style={{ color: EVENT_TYPE_CONFIG[event.type].color }}
                      >
                        {event.title}
                      </p>
                    ))}
                  </div>
                )}

                {hasPlan && !isTeachingClosed && (
                  <div
                    className={cn(
                      CELL_BODY_TEXT,
                      'flex min-h-0 flex-col gap-0.5',
                      hasScheduledClass && !needsPlan ? 'mt-1' : 'mt-auto',
                    )}
                  >
                    {planLesson && (
                      <p
                        className={cn(
                          'line-clamp-1 text-[10px] font-black leading-tight font-sukhumvit',
                          isDone ? 'text-emerald-700 line-through' : 'text-slate-800',
                        )}
                      >
                        {planLesson}
                      </p>
                    )}
                    {planContent && (
                      <p
                        className={cn(
                          'line-clamp-2 text-[8px] font-bold leading-tight font-sarabun',
                          isDone ? 'text-emerald-600 line-through' : 'text-slate-600',
                        )}
                      >
                        {planContent}
                      </p>
                    )}
                  </div>
                )}

                {hasPlan && schoolEvents.length > 0 && (
                  <div className="mt-1 flex gap-0.5">
                    {schoolEvents.slice(0, 3).map((event) => (
                      <span
                        key={event.id}
                        className="h-1.5 w-1.5 rounded-full shrink-0"
                        style={{ background: EVENT_TYPE_CONFIG[event.type].color }}
                        title={event.title}
                      />
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="lg:hidden px-1 pt-1 pb-2 space-y-2">
        <p className="px-1 text-[11px] font-black uppercase tracking-wide text-slate-400 font-sukhumvit">
          แผนการสอนเดือนนี้
        </p>
        {mobilePlanDays.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm font-bold text-slate-400 font-sarabun">
            ไม่มีคาบสอนในเดือนนี้
          </div>
        ) : (
          <div className="space-y-2">
            {mobilePlanDays.map((entry) => {
              const isSelected = selectedDate === entry.dateIso;
              const dateLabel = format(entry.day, 'EEE d MMM', { locale: th });

              return (
                <button
                  key={entry.dateIso}
                  type="button"
                  disabled={!entry.canOpenDrawer}
                  onClick={() => (entry.canOpenDrawer ? openDate(entry.dateIso, entry.day) : undefined)}
                  className={cn(
                    'w-full rounded-2xl border p-3.5 text-left transition-all active:scale-[0.99]',
                    entry.canOpenDrawer && 'hover:bg-slate-50',
                    entry.missingPlan && 'border-dashed border-rose-300 bg-rose-50/80',
                    entry.hasPlan && !entry.isTeachingClosed && 'border-emerald-300 bg-emerald-50/80',
                    entry.isTeachingClosed && 'border-slate-300 bg-slate-100/90',
                    !entry.missingPlan && !entry.hasPlan && !entry.isTeachingClosed && 'border-slate-200 bg-white',
                    isSelected && 'ring-1 ring-blue-200 border-blue-300 bg-blue-50/70',
                    !entry.canOpenDrawer && 'opacity-60 cursor-not-allowed',
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p
                        className={cn(
                          'text-[13px] font-black font-sukhumvit leading-tight',
                          entry.isTodayDay ? 'text-blue-600' : 'text-slate-800',
                        )}
                      >
                        {dateLabel}
                      </p>
                      {entry.periodLabel && (
                        <p className="mt-0.5 text-[11px] font-black text-blue-600 font-sukhumvit">
                          {entry.periodLabel}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      {entry.isTeachingClosed ? (
                        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-black text-slate-600">
                          ปิดการสอน
                        </span>
                      ) : entry.missingPlan ? (
                        <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-black text-rose-600">
                          ยังไม่มีแผน
                        </span>
                      ) : entry.isDone ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black text-emerald-700">
                          <HiCheckCircle size={12} />
                          สอนแล้ว
                        </span>
                      ) : entry.hasPlan ? (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black text-emerald-700">
                          มีแผนแล้ว
                        </span>
                      ) : null}
                      {entry.isQuizDay && !entry.isTeachingClosed && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-700">
                          สอบย่อย
                        </span>
                      )}
                    </div>
                  </div>

                  {entry.schoolEvents.length > 0 && (
                    <p className="mt-2 text-[11px] font-bold leading-tight text-slate-500 font-sarabun line-clamp-1">
                      {entry.schoolEvents.map((event) => event.title).join(' · ')}
                    </p>
                  )}

                  {entry.hasPlan && !entry.isTeachingClosed && (
                    <div className="mt-2 space-y-0.5">
                      {entry.planLesson && (
                        <p
                          className={cn(
                            'line-clamp-1 text-[12px] font-black leading-tight font-sukhumvit',
                            entry.isDone ? 'text-emerald-700 line-through' : 'text-slate-800',
                          )}
                        >
                          {entry.planLesson}
                        </p>
                      )}
                      {entry.planContent && (
                        <p
                          className={cn(
                            'line-clamp-2 text-[11px] font-bold leading-tight font-sarabun',
                            entry.isDone ? 'text-emerald-600 line-through' : 'text-slate-600',
                          )}
                        >
                          {entry.planContent}
                        </p>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
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

          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-2 space-y-3">
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

            {!readOnly && selectedTopic && hasTopicContent(selectedTopic) && (
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
          </div>

          <DrawerFooter className="mt-0 shrink-0 border-t border-slate-100 bg-white px-4 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] flex-row gap-2">
            {!readOnly && hasSavedTopicState(selectedTopic) && (
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
              onClick={() => setDrawerOpen(false)}
              className={cn(
                'h-11 rounded-2xl border border-slate-200 bg-white text-sm font-black text-slate-600 hover:bg-slate-50',
                readOnly ? 'flex-1' : 'flex-1',
              )}
            >
              {readOnly ? 'ปิด' : 'ยกเลิก'}
            </button>
            {!readOnly && (
              <button
                type="button"
                disabled={!hasDraftContent || saving}
                onClick={() => void handleSavePlan()}
                className="flex-1 h-11 rounded-2xl bg-blue-600 text-sm font-black text-white hover:bg-blue-700 disabled:opacity-50"
              >
                บันทึก
              </button>
            )}
          </DrawerFooter>
          </div>
        </DrawerContent>
      </Drawer>

      {showCreateExamModal && (
        <CreateRoomModal
          key={examPrefill?.title ?? 'new-exam-room'}
          prefill={examPrefill}
          onClose={() => {
            setShowCreateExamModal(false);
            setExamPrefill(null);
          }}
          onCreate={createRoom}
          onUpdate={updateRoom}
        />
      )}

      <QuestionSetBuilder
        key={`qsb-plan-${showQuestionSetModal ? buildShortcutTitle() : 'closed'}`}
        open={showQuestionSetModal}
        onClose={() => setShowQuestionSetModal(false)}
        prefill={showQuestionSetModal ? buildQuestionSetPrefill() : null}
        existingSets={questionSets}
        onSubmit={handleQuestionSetSubmit}
      />

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
