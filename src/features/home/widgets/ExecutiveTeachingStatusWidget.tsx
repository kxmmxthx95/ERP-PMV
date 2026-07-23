import { memo, useEffect, useMemo, useState } from 'react';
import { HiOutlineEye, HiXMark } from 'react-icons/hi2';
import { useSchedule } from '@/hooks/useSchedule';
import { useActiveAcademicYear } from '@/hooks/useActiveAcademicYear';
import { useIsSchoolDayToday } from '@/hooks/useIsSchoolDayToday';
import { useTeachersCollection } from '@/hooks/useTeachersCollection';
import { useExecutiveClassSettings } from '@/hooks/useClassSettingsMap';
import { DEFAULT_SETTINGS } from '@/hooks/useScheduleSettings';
import { DEPARTMENT_CONFIG, type Department } from '@/types/curriculum';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import {
  DRAWER_HEADER_ICON_BTN,
  DRAWER_HEADER_RIGHT_ACTIONS,
} from '@/lib/drawerHeaderBtn';
import { subjectColorByName } from '@/features/schedule/constants/colors';
import { formatThaiDateLabel } from '@/lib/dateUtils';
import { cn } from '@/lib/utils';
import { formatCountdown, getRemainingSeconds, useLocalNowSeconds } from '@/lib/localSecondsStore';
import { resolveCanonicalTeacherId, teacherDisplayName } from '@/lib/teachers/teacherIdentity';
import { WIDGET_CARD, WIDGET_GLASS, WIDGET_STAT_CELL, WIDGET_STAT_LABEL, WIDGET_STAT_VALUE } from '../widgetStyles';
import {
  getWidgetHolidayCardStyle,
  getWidgetHolidayLabel,
  WidgetHolidayBadge,
  WidgetHolidayBody,
  widgetHolidayDateClass,
  widgetHolidayHeaderClass,
  widgetHolidayIconButtonClass,
} from '../components/WidgetHolidayContent';

type TeacherLiveKind = 'teaching' | 'resting' | 'outside';

type TeacherStatus = {
  teacherId: string;
  teacherName: string;
  detail: string;
  kind: TeacherLiveKind;
  nextStartMin: number | null;
  currentEndMin: number | null;
  subjectName?: string;
  subjectCode?: string;
  subjectGroup?: string;
};

const DRAWER_CONTENT_CLASS = cn(
  'flex h-dvh max-h-dvh flex-col overflow-hidden bg-transparent p-0 before:hidden',
  'data-[vaul-drawer-direction=right]:w-screen data-[vaul-drawer-direction=right]:max-w-none',
  'sm:h-full sm:max-h-full sm:p-2',
  'sm:data-[vaul-drawer-direction=right]:w-full sm:data-[vaul-drawer-direction=right]:max-w-md',
);

const DRAWER_PANEL_CLASS = cn(
  'flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-white',
  'sm:rounded-4xl sm:border sm:border-border sm:shadow-xl',
);

const KIND_META: Record<
  TeacherLiveKind,
  { sectionLabel: string; badgeClassName: string; cardClassName: string; badgeLabel: string }
> = {
  teaching: {
    sectionLabel: 'กำลังสอน',
    badgeLabel: 'สอน',
    badgeClassName: 'bg-blue-100 text-blue-700',
    cardClassName: 'bg-blue-50/90 border-blue-200',
  },
  resting: {
    sectionLabel: 'พัก/ว่าง',
    badgeLabel: 'ว่าง',
    badgeClassName: 'bg-slate-100 text-slate-600',
    cardClassName: 'bg-white border-slate-200',
  },
  outside: {
    sectionLabel: 'นอกช่วงเวลาเรียน',
    badgeLabel: 'รอ/จบ',
    badgeClassName: 'bg-slate-100 text-slate-500',
    cardClassName: 'bg-white border-slate-200',
  },
};

const SECTION_ORDER: TeacherLiveKind[] = ['teaching', 'resting', 'outside'];

function parseTimeRange(timeStr: string): { startMin: number; endMin: number } | null {
  const normalized = String(timeStr || '')
    .replace('–', '-')
    .replace(/\s*-\s*/g, '-')
    .trim();
  if (!normalized) return null;
  const [start, end] = normalized.split('-');
  if (!start || !end) return null;

  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) return null;

  return {
    startMin: sh * 60 + sm,
    endMin: eh * 60 + em,
  };
}

function formatTimeFromMin(minute: number): string {
  const h = Math.floor(minute / 60);
  const m = minute % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function getLocalNowMinute() {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

/** Status buckets only need minute precision — parent re-renders once per minute. */
function useNowMinute() {
  const [nowMinute, setNowMinute] = useState(getLocalNowMinute);

  useEffect(() => {
    const sync = () => setNowMinute(getLocalNowMinute());
    sync();
    const now = new Date();
    const msToNextMinute = (60 - now.getSeconds()) * 1000 - now.getMilliseconds() + 50;
    let intervalId: ReturnType<typeof setInterval> | undefined;
    const timeoutId = window.setTimeout(() => {
      sync();
      intervalId = setInterval(sync, 60_000);
    }, msToNextMinute);
    return () => {
      window.clearTimeout(timeoutId);
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  return nowMinute;
}

function formatSubjectLabel(entry: { subjectName?: string; subjectCode?: string }): string {
  return entry.subjectName?.trim() || entry.subjectCode || '-';
}

function teacherNeedsCountdown(teacher: TeacherStatus): boolean {
  if (teacher.kind === 'teaching') return teacher.currentEndMin != null;
  return teacher.nextStartMin != null;
}

const TeacherRowCountdown = memo(function TeacherRowCountdown({ teacher }: { teacher: TeacherStatus }) {
  const nowSeconds = useLocalNowSeconds();
  const nextRemaining =
    teacher.nextStartMin != null ? getRemainingSeconds(nowSeconds, teacher.nextStartMin) : null;
  const classRemaining =
    teacher.currentEndMin != null ? getRemainingSeconds(nowSeconds, teacher.currentEndMin) : null;

  if (teacher.kind === 'teaching' && classRemaining != null) {
    return (
      <p className="text-[11px] font-black text-blue-700 mt-1">
        เหลือเวลาสอน {formatCountdown(classRemaining)}
      </p>
    );
  }
  if (teacher.kind !== 'teaching' && nextRemaining != null && nextRemaining > 0) {
    return (
      <p className="text-[11px] font-black text-red-600 mt-1">
        เริ่มคาบใน {formatCountdown(nextRemaining)}
        {teacher.nextStartMin != null ? ` · ${formatTimeFromMin(teacher.nextStartMin)} น.` : ''}
      </p>
    );
  }
  return null;
});

const TeacherRow = memo(function TeacherRow({
  teacher,
  photoURL,
  departmentLabel,
}: {
  teacher: TeacherStatus;
  photoURL?: string;
  departmentLabel?: string;
}) {
  const meta = KIND_META[teacher.kind];
  const subjectLabel = teacher.subjectName || teacher.subjectCode;
  const detailColor = subjectLabel
    ? subjectColorByName(subjectLabel, teacher.subjectGroup).text
    : undefined;

  return (
    <div className={`rounded-2xl border p-3.5 ${meta.cardClassName}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3.5 min-w-0 flex-1">
          <div className="size-[4.25rem] rounded-full shrink-0 overflow-hidden bg-slate-100 border-2 border-white shadow-sm">
            {photoURL ? (
              <img src={photoURL} alt={teacher.teacherName} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-lg font-black text-slate-500">
                {teacher.teacherName.charAt(0)}
              </div>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-black text-slate-800 truncate">{teacher.teacherName}</p>
            {departmentLabel ? (
              <p className="text-[11px] font-bold text-slate-400 truncate">{departmentLabel}</p>
            ) : null}
            <p
              className={`text-[11px] font-semibold mt-0.5 line-clamp-2 ${detailColor ? '' : 'text-slate-500'}`}
              style={detailColor ? { color: detailColor } : undefined}
            >
              {teacher.detail}
            </p>
            {teacherNeedsCountdown(teacher) ? <TeacherRowCountdown teacher={teacher} /> : null}
          </div>
        </div>
        <span className={`text-[10px] font-black px-2 py-1 rounded-lg shrink-0 ${meta.badgeClassName}`}>
          {meta.badgeLabel}
        </span>
      </div>
    </div>
  );
});

type TeacherProfileMap = Map<string, { photoURL?: string; department?: string }>;

const NearestCountdownButton = memo(function NearestCountdownButton({
  nearestStartMin,
  onClick,
}: {
  nearestStartMin: number;
  onClick: () => void;
}) {
  const nowSeconds = useLocalNowSeconds();
  const nearestRemaining = getRemainingSeconds(nowSeconds, nearestStartMin);

  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-auto w-full py-1.5 rounded-full bg-blue-500 text-white text-[11px] font-black flex items-center justify-center gap-1 hover:bg-blue-600 transition-all active:scale-[0.98] shrink-0 truncate px-3"
    >
      {nearestRemaining > 0 ? (
        <>
          <span className="text-blue-100 font-bold tabular-nums shrink-0">
            คาบถัดไป {formatCountdown(nearestRemaining)}
          </span>
          <span className="opacity-60">·</span>
          <span>ดูรายชื่อครู</span>
        </>
      ) : (
        <span>ดูรายชื่อครู</span>
      )}
    </button>
  );
});

const OpenTeacherListButton = memo(function OpenTeacherListButton({
  totalTodayTeachers,
  onClick,
}: {
  totalTodayTeachers: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-auto w-full py-1.5 rounded-full bg-blue-500 text-white text-[11px] font-black flex items-center justify-center gap-1 hover:bg-blue-600 transition-all active:scale-[0.98] shrink-0 truncate px-3"
    >
      <span>{totalTodayTeachers} คน · ดูรายชื่อครู</span>
    </button>
  );
});

function TeacherDrawerList({
  groupedTeachers,
  teacherProfileById,
}: {
  groupedTeachers: Array<{ kind: TeacherLiveKind; items: TeacherStatus[] }>;
  teacherProfileById: TeacherProfileMap;
}) {
  const getDepartmentLabel = (teacherId: string) => {
    const department = teacherProfileById.get(teacherId)?.department;
    if (!department) return undefined;
    return DEPARTMENT_CONFIG[department as Department]?.label ?? department;
  };

  return (
    <div className="flex flex-col gap-4">
      {groupedTeachers.map(({ kind, items }) => (
        <section key={kind} className="flex flex-col gap-2.5">
          <p
            className={`text-[11px] font-black uppercase tracking-wide px-0.5 ${
              kind === 'teaching'
                ? 'text-blue-700'
                : kind === 'resting'
                  ? 'text-slate-600'
                  : 'text-slate-500'
            }`}
          >
            {KIND_META[kind].sectionLabel} ({items.length})
          </p>
          {items.map((teacher) => (
            <TeacherRow
              key={teacher.teacherId}
              teacher={teacher}
              photoURL={teacherProfileById.get(teacher.teacherId)?.photoURL}
              departmentLabel={getDepartmentLabel(teacher.teacherId)}
            />
          ))}
        </section>
      ))}
    </div>
  );
}

export default function ExecutiveTeachingStatusWidget() {
  const { entries, classes } = useSchedule();
  const { teachers } = useTeachersCollection();
  const { year, activeSemester } = useActiveAcademicYear();
  const nowMinute = useNowMinute();
  const todayDay = useMemo(() => {
    const d = new Date().getDay();
    return d === 0 ? 7 : d;
  }, []);

  const classIdsForSettings = useMemo(() => {
    if (todayDay < 1 || todayDay > 5) return [];
    return [...new Set(
      entries
        .filter(
          (entry) =>
            entry.day === todayDay &&
            String(entry.year) === String(year) &&
            entry.semester === activeSemester,
        )
        .map((entry) => entry.classId)
        .filter(Boolean),
    )];
  }, [entries, todayDay, year, activeSemester]);

  const classSettings = useExecutiveClassSettings(classIdsForSettings);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { isHoliday, isWeekend, holidayTitle } = useIsSchoolDayToday();
  const todayLabel = formatThaiDateLabel();

  const classNameMap = useMemo(
    () => Object.fromEntries(classes.map((cls) => [cls.id, cls.className || cls.label || cls.id])),
    [classes],
  );

  const teacherProfileById = useMemo(() => {
    const map = new Map<string, { photoURL?: string; department?: string }>();
    teachers.forEach((teacher) => {
      const profile = {
        photoURL: teacher.photoURL,
        department: teacher.department,
      };
      map.set(teacher.id, profile);
      if (teacher.userId) map.set(teacher.userId, profile);
    });
    return map;
  }, [teachers]);

  const schoolWideSettings = classSettings.school_wide;

  const status = useMemo(() => {
    const getPeriodTime = (classId: string, period: number) => {
      const perClass = classSettings[classId];
      const classValue = perClass?.periodTimes?.[String(period)];
      const schoolValue = schoolWideSettings?.periodTimes?.[String(period)];
      return classValue || schoolValue || DEFAULT_SETTINGS.periodTimes[String(period)] || '';
    };

    if (todayDay < 1 || todayDay > 5) {
      return {
        teachers: [] as TeacherStatus[],
        teaching: [] as TeacherStatus[],
        resting: [] as TeacherStatus[],
        outside: [] as TeacherStatus[],
        totalTodayTeachers: 0,
        isWeekend: true,
      };
    }

    const todaysEntries = entries.filter(
      (entry) =>
        entry.day === todayDay &&
        String(entry.year) === String(year) &&
        entry.semester === activeSemester,
    );

    const byTeacher = new Map<string, typeof todaysEntries>();
    todaysEntries.forEach((entry) => {
      const canonicalId = resolveCanonicalTeacherId(
        entry.teacherId,
        teachers,
        entry.teacherName,
      );
      if (!canonicalId) return;
      const list = byTeacher.get(canonicalId) ?? [];
      list.push(entry);
      byTeacher.set(canonicalId, list);
    });

    const allTeachers: TeacherStatus[] = [];

    byTeacher.forEach((teacherEntries, canonicalTeacherId) => {
      const teacherName = teacherDisplayName(
        canonicalTeacherId,
        teachers,
        teacherEntries[0]?.teacherName,
      );

      const enriched = teacherEntries
        .map((entry) => {
          const range = parseTimeRange(getPeriodTime(entry.classId, entry.period));
          return { entry, range };
        })
        .filter((item): item is { entry: (typeof teacherEntries)[number]; range: { startMin: number; endMin: number } } => Boolean(item.range))
        .sort((a, b) => a.range.startMin - b.range.startMin);

      if (enriched.length === 0) return;

      const current = enriched.find(({ range }) => nowMinute >= range.startMin && nowMinute < range.endMin);
      if (current) {
        allTeachers.push({
          teacherId: canonicalTeacherId,
          teacherName,
          kind: 'teaching',
          detail: `${formatSubjectLabel(current.entry)} · ห้อง ${classNameMap[current.entry.classId] || current.entry.classId}`,
          nextStartMin: null,
          currentEndMin: current.range.endMin,
          subjectName: current.entry.subjectName,
          subjectCode: current.entry.subjectCode,
          subjectGroup: current.entry.subjectGroup,
        });
        return;
      }

      const firstStart = enriched[0].range.startMin;
      const lastEnd = enriched[enriched.length - 1].range.endMin;

      if (nowMinute >= firstStart && nowMinute < lastEnd) {
        const nextClass = enriched.find(({ range }) => range.startMin > nowMinute);
        allTeachers.push({
          teacherId: canonicalTeacherId,
          teacherName,
          kind: 'resting',
          detail: nextClass
            ? `พัก/ว่าง · คาบถัดไป ${formatSubjectLabel(nextClass.entry)} (${classNameMap[nextClass.entry.classId] || nextClass.entry.classId})`
            : 'พัก/ว่าง · ไม่มีคาบถัดไปวันนี้',
          nextStartMin: nextClass?.range.startMin ?? null,
          currentEndMin: null,
          subjectName: nextClass?.entry.subjectName,
          subjectCode: nextClass?.entry.subjectCode,
          subjectGroup: nextClass?.entry.subjectGroup,
        });
        return;
      }

      const firstEntry = enriched[0].entry;
      allTeachers.push({
        teacherId: canonicalTeacherId,
        teacherName,
        kind: 'outside',
        detail: nowMinute < firstStart
          ? `คาบแรก ${formatSubjectLabel(firstEntry)} (${classNameMap[firstEntry.classId] || firstEntry.classId})`
          : 'สิ้นสุดการสอนของวันนี้แล้ว',
        nextStartMin: nowMinute < firstStart ? enriched[0].range.startMin : null,
        currentEndMin: null,
        subjectName: nowMinute < firstStart ? firstEntry.subjectName : undefined,
        subjectCode: nowMinute < firstStart ? firstEntry.subjectCode : undefined,
        subjectGroup: nowMinute < firstStart ? firstEntry.subjectGroup : undefined,
      });
    });

    allTeachers.sort((a, b) => a.teacherName.localeCompare(b.teacherName, 'th'));

    const teaching = allTeachers.filter(t => t.kind === 'teaching');
    const resting = allTeachers.filter(t => t.kind === 'resting');
    const outside = allTeachers.filter(t => t.kind === 'outside');

    return {
      teachers: allTeachers,
      teaching,
      resting,
      outside,
      totalTodayTeachers: byTeacher.size,
      isWeekend: false,
    };
  }, [activeSemester, classNameMap, classSettings, entries, nowMinute, schoolWideSettings, teachers, todayDay, year]);

  const groupedTeachers = useMemo(
    () =>
      SECTION_ORDER
        .map(kind => ({
          kind,
          items: status.teachers.filter(teacher => teacher.kind === kind),
        }))
        .filter(group => group.items.length > 0),
    [status.teachers],
  );

  const nearestUpcomingStartMin = useMemo(() => {
    const candidates = status.teachers
      .filter((teacher) => teacher.nextStartMin != null)
      .map((teacher) => teacher.nextStartMin as number)
      .filter((startMin) => startMin * 60 > nowMinute * 60);
    return candidates.length > 0 ? Math.min(...candidates) : null;
  }, [status.teachers, nowMinute]);

  return (
    <>
      <div style={isHoliday ? getWidgetHolidayCardStyle(isWeekend) : WIDGET_GLASS} className={WIDGET_CARD}>
        <div className="flex items-start justify-between gap-2 shrink-0">
          <div className="min-w-0 flex-1">
            <p className={widgetHolidayHeaderClass(isHoliday)}>สถานะครูตามตารางสอน</p>
            <p className={cn(widgetHolidayDateClass(isHoliday), 'mt-0.5')}>{todayLabel}</p>
          </div>
          <div className="flex items-center gap-1 shrink-0 -mr-0.5 -mt-0.5">
            {isHoliday ? <WidgetHolidayBadge /> : null}
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className={widgetHolidayIconButtonClass(isHoliday)}
              aria-label="ดูรายชื่อครู"
            >
              <HiOutlineEye size={16} />
            </button>
          </div>
        </div>

        {isHoliday ? (
          <WidgetHolidayBody isWeekend={isWeekend} holidayTitle={holidayTitle} />
        ) : (
          <>
            <div className="grid grid-cols-3 gap-1.5 flex-1 min-h-0 content-center">
              <div className={`${WIDGET_STAT_CELL} bg-blue-50/70 border border-blue-100/80`}>
                <span className={`${WIDGET_STAT_VALUE} text-blue-600`}>{status.teaching.length}</span>
                <span className={WIDGET_STAT_LABEL}>กำลังสอน</span>
              </div>
              <div className={`${WIDGET_STAT_CELL} bg-slate-50/80 border border-slate-100`}>
                <span className={`${WIDGET_STAT_VALUE} text-slate-600`}>{status.resting.length}</span>
                <span className={WIDGET_STAT_LABEL}>พัก/ว่าง</span>
              </div>
              <div className={`${WIDGET_STAT_CELL} bg-violet-50/60 border border-violet-100/80`}>
                <span className={`${WIDGET_STAT_VALUE} text-violet-700`}>{status.totalTodayTeachers}</span>
                <span className={WIDGET_STAT_LABEL}>มีคาบวันนี้</span>
              </div>
            </div>

            {nearestUpcomingStartMin != null ? (
              <NearestCountdownButton
                nearestStartMin={nearestUpcomingStartMin}
                onClick={() => setDrawerOpen(true)}
              />
            ) : (
              <OpenTeacherListButton
                totalTodayTeachers={status.totalTodayTeachers}
                onClick={() => setDrawerOpen(true)}
              />
            )}
          </>
        )}
      </div>

      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen} direction="right">
        <DrawerContent className={DRAWER_CONTENT_CLASS}>
          <div className={DRAWER_PANEL_CLASS}>
            <DrawerHeader className="shrink-0 px-4 pt-4 pb-2">
              <div className="relative flex min-h-10 items-center justify-center">
                <div className="min-w-0 px-12 text-center">
                  <DrawerTitle className="text-base font-black text-slate-800">
                    สถานะครูตามตารางสอน
                  </DrawerTitle>
                  <DrawerDescription className="text-xs text-slate-500">{todayLabel}</DrawerDescription>
                </div>
                <div className={DRAWER_HEADER_RIGHT_ACTIONS}>
                  <button
                    type="button"
                    onClick={() => setDrawerOpen(false)}
                    className={DRAWER_HEADER_ICON_BTN}
                    aria-label="ปิด"
                  >
                    <HiXMark className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </DrawerHeader>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6">
              {isHoliday ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
                  <p className="text-sm font-bold text-slate-600">วันนี้เป็นวันหยุด</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {getWidgetHolidayLabel(isWeekend, holidayTitle)}
                  </p>
                </div>
              ) : status.teachers.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
                  <p className="text-sm font-bold text-slate-600">ยังไม่มีครูที่มีคาบสอนวันนี้</p>
                </div>
              ) : drawerOpen ? (
                <TeacherDrawerList
                  groupedTeachers={groupedTeachers}
                  teacherProfileById={teacherProfileById}
                />
              ) : null}
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
