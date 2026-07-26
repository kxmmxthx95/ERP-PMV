import { useState, useEffect, useMemo, useRef, type DragEvent, type MouseEvent, type PointerEvent, type TouchEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Coffee, Timer, X, Check, PlusCircle, Clock, Pencil, Trash2, BookOpen, User, MapPin, ArrowRight, Users, Layout, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import {
  SCHOOL_DAYS, DAY_LABELS, DAY_SHORT,
  type SchoolDay, type ScheduleEntry,
} from '@/types/schedule';
import { useScheduleSettings, DEFAULT_SETTINGS } from '@/hooks/useScheduleSettings';
import { subjectColorByName, subjectGradient, withAlpha } from '../constants/colors';
import { isJointClassGroup, formatClassLabels } from '../utils/jointClass';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ExamMobileFilterDrawer } from '@/features/exam/components/ExamMobileFilterMenuButton';
import { cn } from '@/lib/utils';
import { db } from '@/lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';




function parseTimeRange(timeStr: string): { startMin: number; endMin: number } | null {
  const parts = timeStr.split(' - ');
  if (parts.length < 2) return null;
  const [sh, sm] = parts[0].split(':').map(Number);
  const [eh, em] = parts[1].split(':').map(Number);
  if ([sh, sm, eh, em].some(isNaN)) return null;
  return { startMin: sh * 60 + sm, endMin: eh * 60 + em };
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface ScheduleGridProps {
  grid: Record<number, Record<number, ScheduleEntry[]>>;
  viewMode: 'class' | 'teacher';
  classId?: string;
  filterDept?: 'all' | 'early' | 'primary' | 'secondary';
  settingsId?: string;
  readOnly?: boolean;
  onSlotClick: (day: SchoolDay, period: number, entry: ScheduleEntry | null) => void;
  onDeleteEntry: (id: string) => void;
  onMoveEntry?: (id: string, day: SchoolDay, period: number) => void;
  onDropSubject?: (day: SchoolDay, period: number, subjectId: string, teacherId: string, classId?: string) => void;
  isEditMode?: boolean;
  setIsEditMode?: (val: boolean) => void;
  allClasses?: { id: string; gradeLevel: string; department: string; label: string }[];
  teachers?: { id: string; department: string; name: string; photoURL?: string }[];
  excessEntryIds?: Set<string>;
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
  dragTeacherId?: string;
  selectedTeacherId?: string;
  jointClassEntryIds?: Set<string>;
  jointClassPartnersByEntryId?: Map<string, string[]>;
}

interface ClassScheduleSettings {
  periodCount?: number;
  periodTimes?: Record<number, string>;
  breakPeriods?: number[];
  lunchPeriods?: number[];
}

function normalizeCategoryKey(raw?: string) {
  const c = String(raw || '').trim().toLowerCase();
  if (!c) return '';
  if (c === 'core' || c === 'basic' || c.includes('พื้นฐาน')) return 'basic';
  if (c === 'added' || c === 'additional' || c.includes('เพิ่มเติม')) return 'additional';
  if (c === 'activity' || c.includes('กิจกรรม')) return 'activity';
  return c;
}

function categoryBadgeStyle(raw?: string) {
  const key = normalizeCategoryKey(raw);
  if (key === 'additional') {
    return {
      label: 'เพิ่มเติม',
      className: 'bg-white text-amber-700 border-amber-200/60 shadow-2xs',
      dotClassName: 'bg-amber-400',
    };
  }
  if (key === 'activity') {
    return {
      label: 'กิจกรรม',
      className: 'bg-white text-violet-700 border-violet-200/60 shadow-2xs',
      dotClassName: 'bg-violet-400',
    };
  }
  return {
    label: 'พื้นฐาน',
    className: 'bg-white text-sky-700 border-sky-200/60 shadow-2xs',
    dotClassName: 'bg-sky-400',
  };
}

function restGradient(isEditing: boolean): string {
  if (isEditing) {
    return [
      'radial-gradient(120% 120% at 0% 0%, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0) 50%)',
      'linear-gradient(160deg, rgba(244,63,94,0.92) 0%, rgba(251,113,133,0.88) 100%)',
    ].join(', ');
  }
  return [
    'radial-gradient(125% 120% at 100% 0%, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0) 56%)',
    'linear-gradient(160deg, rgba(16,185,129,0.95) 0%, rgba(45,212,191,0.9) 100%)',
  ].join(', ');
}

function teacherAvatarUrl(
  teachers: { id: string; name: string; photoURL?: string }[] | undefined,
  entry: Pick<ScheduleEntry, 'teacherId' | 'teacherName'>,
) {
  const teacherObj = teachers?.find((t) => t.id === entry.teacherId || t.name === entry.teacherName);
  return (
    teacherObj?.photoURL ||
    `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(entry.teacherId || entry.teacherName || 'teacher')}`
  );
}

// ── Main Grid ─────────────────────────────────────────────────────────────────
export default function ScheduleGrid({
  grid: gridProp,
  viewMode,
  classId,
  filterDept = 'all',
  settingsId,
  readOnly = false,
  onSlotClick,
  onDeleteEntry,
  onMoveEntry,
  onDropSubject,
  isEditMode = false,
  setIsEditMode,
  allClasses,
  teachers,
  excessEntryIds,
  draggableSubjects = [],
  dragTeacherId = '',
  selectedTeacherId = '',
  jointClassEntryIds,
  jointClassPartnersByEntryId,
}: ScheduleGridProps) {
  const settingsTargetId = settingsId ?? classId;
  const {
    periodCount: settingsPeriodCount,
    periodTimes: settingsPeriodTimes,
    breakPeriods: settingsBreakPeriods,
    lunchPeriods: settingsLunchPeriods,
    addPeriod,
    removePeriod,
    updatePeriodTime,
    cycleBreakType,
    copyToClasses,
  } = useScheduleSettings(settingsTargetId);

  // For teacher view: fetch settings for all involved classes
  const [multiClassSettings, setMultiClassSettings] = useState<Record<string, ClassScheduleSettings>>({});
  
  useEffect(() => {
    if (viewMode !== 'teacher' || !gridProp) return;
    
    const involvedClassIds = new Set<string>();
    Object.values(gridProp).forEach(dayGrid => {
      Object.values(dayGrid).forEach(slotEntries => {
        if (!slotEntries) return;
        slotEntries.forEach(entry => {
          if (entry?.classId) involvedClassIds.add(entry.classId);
        });
      });
    });

    const ids = Array.from(involvedClassIds);
    if (ids.length === 0) return;

    const unsubs = ids.map(id => {
      return onSnapshot(doc(db, 'class_settings', id), (snap) => {
        if (snap.exists()) {
          setMultiClassSettings(prev => ({ ...prev, [id]: snap.data() }));
        }
      });
    });

    return () => unsubs.forEach(u => u());
  }, [gridProp, viewMode]);

  // Merge settings for teacher view or use class settings
  const mergedSettings = useMemo(() => {
    if (viewMode === 'class' || settingsTargetId) {
      return { 
        count: settingsPeriodCount, 
        times: settingsPeriodTimes, 
        breaks: settingsBreakPeriods, 
        lunches: settingsLunchPeriods 
      };
    }

    // Teacher view merging logic
    let maxP = settingsPeriodCount;
    const allTimes = { ...settingsPeriodTimes };
    const allBreaks = new Set(settingsBreakPeriods);
    const allLunches = new Set(settingsLunchPeriods);

    Object.values(multiClassSettings).forEach((s) => {
      if (typeof s.periodCount === 'number' && s.periodCount > maxP) maxP = s.periodCount;
      if (s.periodTimes) {
        Object.entries(s.periodTimes).forEach(([p, t]) => {
          // If we don't have a time for this period yet, or it was default, use the class one
          if (!allTimes[Number(p)] || allTimes[Number(p)] === DEFAULT_SETTINGS.periodTimes[p]) {
            allTimes[Number(p)] = t as string;
          }
        });
      }
      if (s.breakPeriods) s.breakPeriods.forEach((p: number) => allBreaks.add(p));
      if (s.lunchPeriods) s.lunchPeriods.forEach((p: number) => allLunches.add(p));
    });

    return { 
      count: maxP, 
      times: allTimes, 
      breaks: Array.from(allBreaks), 
      lunches: Array.from(allLunches) 
    };
  }, [viewMode, settingsTargetId, settingsPeriodCount, settingsPeriodTimes, settingsBreakPeriods, settingsLunchPeriods, multiClassSettings]);

  const effectivePeriodCount = useMemo(() => {
    let maxGridPeriod = 0;
    Object.values(gridProp).forEach(dayGrid => {
      Object.keys(dayGrid).forEach(p => {
        const periodNum = Number(p);
        if (dayGrid[periodNum]?.length > 0 && periodNum > maxGridPeriod) {
          maxGridPeriod = periodNum;
        }
      });
    });
    return Math.max(mergedSettings.count, maxGridPeriod);
  }, [gridProp, mergedSettings.count]);

  const grid = useMemo(() => {
    const g: Record<number, Record<number, ScheduleEntry[]>> = {};
    for (const day of SCHOOL_DAYS) {
      g[day] = {};
      for (let p = 1; p <= effectivePeriodCount; p++) {
        g[day][p] = [];
      }
    }
    
    Object.values(gridProp || {}).forEach(dayGrid => {
      Object.values(dayGrid).forEach(slotEntries => {
        if (!slotEntries) return;
        // Handle both single entries (legacy) and arrays
        const entriesArray = Array.isArray(slotEntries) ? slotEntries : [slotEntries];
        entriesArray.forEach(entry => {
          if (!entry) return;
          const e = entry as ScheduleEntry;
          if (g[e.day] && g[e.day][e.period]) {
            g[e.day][e.period].push(e);
          }
        });
      });
    });

    return g;
  }, [gridProp, effectivePeriodCount]);

  const displayPeriodTimes = useMemo(() => {
    const times = { ...mergedSettings.times };
    let lastEndMin = 480; // 08:00 default
    
    for (let p = 1; p <= effectivePeriodCount; p++) {
      if (times[p]) {
        const range = parseTimeRange(times[p]);
        if (range) {
          lastEndMin = range.endMin;
          continue;
        }
      }
      // Calculate fallback
      const startMin = lastEndMin;
      const endMin = startMin + 50;
      times[p] = `${String(Math.floor(startMin / 60)).padStart(2, '0')}:${String(startMin % 60).padStart(2, '0')} - ${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`;
      lastEndMin = endMin;
    }
    return times;
  }, [mergedSettings.times, effectivePeriodCount]);

  const breakPeriods = mergedSettings.breaks;
  const lunchPeriods = mergedSettings.lunches;

  const [isCopying, setIsCopying] = useState(false);

  const [dragOverSlot, setDragOverSlot] = useState<{ day: SchoolDay; period: number } | null>(null);
  const [touchDragData, setTouchDragData] = useState<{ subjectId: string; teacherId: string; classId?: string } | null>(null);

  const [detailEntry, setDetailEntry] = useState<ScheduleEntry | null>(null);
  const [mobileDay, setMobileDay] = useState<SchoolDay>(1);
  const [mobileSubjectPickerSlot, setMobileSubjectPickerSlot] = useState<{ day: SchoolDay; period: number } | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const longPressOriginRef = useRef<{ x: number; y: number } | null>(null);
  const longPressFiredRef = useRef(false);

  const periods = Array.from({ length: effectivePeriodCount }, (_, i) => i + 1);
  const canEdit = !readOnly && (!!classId || viewMode === 'teacher');
  const isEditing = isEditMode && canEdit;
  const showSubjectCarousel = false;
  const shouldHideGrid =
    (viewMode === 'class' && !classId) ||
    (viewMode === 'teacher' && (filterDept === 'all' || !selectedTeacherId));
  const hideGridTitle = viewMode === 'teacher' ? 'กรุณาเลือกครูก่อน' : 'กรุณาเลือกห้องเรียนก่อน';
  const hideGridHint = viewMode === 'teacher'
    ? 'ตารางสอนจะแสดงเมื่อเลือกแผนกและครูผู้สอน'
    : 'ตารางสอนจะแสดงเมื่อเลือกแผนก ระดับชั้น และห้องเรียนครบ';

  let regularCount = 0;
  const displayNumbers: Record<number, number> = {};
  for (const p of periods) {
    if (!breakPeriods.includes(p) && !lunchPeriods.includes(p)) {
      regularCount++;
      displayNumbers[p] = regularCount;
    }
  }

  const handleSlotClick = (day: SchoolDay, period: number, entry?: ScheduleEntry | null) => {
    if (readOnly && entry) {
      return;
    }
    if (!readOnly) onSlotClick(day, period, entry ?? null);
  };

  const clearLongPressTimer = () => {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const openMobileSubjectDrawer = (day: SchoolDay, period: number) => {
    if (!isEditMode) setIsEditMode?.(true);
    setMobileSubjectPickerSlot({ day, period });
  };

  // Long-press card → toggle edit mode. Enter opens subject drawer; exit closes it.
  const startMobileLongPress = (day: SchoolDay, period: number, e: PointerEvent) => {
    if (!setIsEditMode) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    longPressFiredRef.current = false;
    longPressOriginRef.current = { x: e.clientX, y: e.clientY };
    clearLongPressTimer();
    const wasEditing = isEditMode;
    longPressTimerRef.current = window.setTimeout(() => {
      longPressFiredRef.current = true;
      if (wasEditing) {
        setIsEditMode(false);
        setMobileSubjectPickerSlot(null);
      } else {
        setIsEditMode(true);
        setMobileSubjectPickerSlot({ day, period });
      }
      try {
        navigator.vibrate?.(12);
      } catch {
        /* ignore */
      }
      clearLongPressTimer();
    }, 480);
  };

  const onMobileLongPressMove = (e: PointerEvent) => {
    const origin = longPressOriginRef.current;
    if (!origin || !longPressTimerRef.current) return;
    const dx = e.clientX - origin.x;
    const dy = e.clientY - origin.y;
    // cancel only if finger moved > ~12px (scroll), not micro-jitter
    if (dx * dx + dy * dy > 144) {
      clearLongPressTimer();
      longPressOriginRef.current = null;
    }
  };

  const endMobileLongPress = () => {
    clearLongPressTimer();
    longPressOriginRef.current = null;
  };

  const mobileCardLongPressProps = (day: SchoolDay, period: number) =>
    setIsEditMode
      ? {
          onPointerDown: (e: PointerEvent<HTMLButtonElement>) => startMobileLongPress(day, period, e),
          onPointerMove: onMobileLongPressMove,
          onPointerUp: endMobileLongPress,
          onPointerCancel: endMobileLongPress,
          onContextMenu: (e: MouseEvent) => {
            e.preventDefault();
          },
        }
      : {};

  return (
    <>
      {showSubjectCarousel && (
        <div className="hidden md:block sticky top-0 z-30 mb-3 w-full overflow-hidden py-1">

          {draggableSubjects.length > 0 ? (
            <Carousel opts={{ align: 'start', dragFree: true, watchDrag: false }} className="px-9">
              <CarouselContent className="-ml-2">
                {draggableSubjects.map((subject) => {
                  const color = subjectColorByName(subject.name || subject.id, subject.subjectGroup);
                  const teacherId = subject.assignedTeacherId || dragTeacherId;
                  const badge = categoryBadgeStyle((subject as any).category);

                  return (
                    <CarouselItem
                      key={`${subject.id}-${subject.className ?? ''}`}
                      className="basis-[48%] pl-2 sm:basis-[35%] md:basis-[25%] lg:basis-[18%] xl:basis-[15%]"
                    >
                      <div
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData(
                            'application/subject-card',
                            JSON.stringify({ subjectId: subject.id, teacherId, classId: subject.classId ?? '' }),
                          );
                          e.dataTransfer.effectAllowed = 'copy';
                        }}
                        onTouchStart={() => {
                          setTouchDragData({ subjectId: subject.id, teacherId, classId: subject.classId });
                        }}
                        className="h-full cursor-grab select-none rounded-xl p-2.5 transition-transform active:cursor-grabbing active:scale-[0.99]"
                        style={{
                          background: subjectGradient(color),
                          boxShadow: `inset 0 1px 0 rgba(255,255,255,0.82), 0 12px 18px -18px ${withAlpha(color.accent, 0.58)}`,
                        }}
                      >
                        <div className="mb-1.5 flex items-center gap-1">
                          <span
                            className="rounded-md border px-1.5 py-0.5 text-[9px] font-black shrink-0"
                            style={{
                              borderColor: 'rgba(255,255,255,0.26)',
                              background: 'rgba(0,0,0,0.14)',
                              color: 'rgba(255,255,255,0.96)',
                            }}
                          >
                            {subject.code}
                          </span>
                          {viewMode === 'teacher' && subject.className && (
                            <span
                              className="rounded-md border px-1 py-0.5 text-[8px] font-black bg-white/20 text-white shrink-0"
                              style={{ borderColor: 'rgba(255,255,255,0.2)' }}
                            >
                              {subject.className}
                            </span>
                          )}
                          <span
                            className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[8px] font-black shrink-0 ${badge.className}`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${badge.dotClassName}`} />
                            {badge.label}
                          </span>
                          <span
                            className="ml-auto text-[9px] font-bold text-white shrink-0"
                            style={{ textShadow: '0 1px 2px rgba(0,0,0,0.4)' }}
                          >
                            {subject.hoursPerWeek ?? 0} คาบ
                          </span>
                        </div>
                        <p
                          className="line-clamp-2 text-[10px] font-extrabold leading-snug text-white"
                          style={{ textShadow: '0 1px 2.5px rgba(0,0,0,0.45)' }}
                        >
                          {subject.name}
                        </p>
                      </div>
                    </CarouselItem>
                  );
                })}
              </CarouselContent>
              <CarouselPrevious className="left-1 top-1/2 z-10 h-7 w-7 -translate-y-1/2 border-black/10 bg-white/85 text-black/55 shadow-sm hover:bg-white" />
              <CarouselNext className="right-1 top-1/2 z-10 h-7 w-7 -translate-y-1/2 border-black/10 bg-white/85 text-black/55 shadow-sm hover:bg-white" />
            </Carousel>
          ) : (
            <div className="rounded-xl border border-dashed border-rose-200 bg-white/70 px-3 py-3 text-[10px] font-bold text-rose-500/80">
              ยังไม่มีรายวิชาที่พร้อมลากวางในมุมมองนี้
            </div>
          )}
        </div>
      )}

      {/* Mobile: Schedule List / Subject Picker */}
      <div
        className={cn(
          'md:hidden mb-4',
          shouldHideGrid && 'flex min-h-[calc(100dvh-12rem)] items-center justify-center',
        )}
        id="schedule-grid-export-mobile"
      >
        {shouldHideGrid ? (
          <div className="w-full rounded-2xl border border-black/[0.08] bg-white/85 px-4 py-6 text-center">
            <p className="text-[12px] font-black text-red-600">{hideGridTitle}</p>
            <p className="mt-1 text-[10px] font-medium text-red-500">{hideGridHint}</p>
          </div>
        ) : (
          <>
        <Tabs
          value={String(mobileDay)}
          onValueChange={(v) => {
            setMobileDay(Number(v) as SchoolDay);
            setMobileSubjectPickerSlot(null);
          }}
          className="mb-2.5 gap-0"
        >
          <TabsList className="grid h-9 w-full grid-cols-5 rounded-xl p-1">
            {SCHOOL_DAYS.map((day) => (
              <TabsTrigger
                key={day}
                value={String(day)}
                className="rounded-lg px-1 text-xs font-black data-active:bg-blue-600 data-active:text-white dark:data-active:bg-blue-600 dark:data-active:text-white"
              >
                {DAY_SHORT[day]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

          <div className="flex flex-col gap-3">
            {periods.map((period) => {
          const isLunch = lunchPeriods.includes(period);
          const isBreak = breakPeriods.includes(period);
          const entries = grid[mobileDay]?.[period] ?? [];
          const isOver = dragOverSlot?.day === mobileDay && dragOverSlot?.period === period;
          const periodNum = displayNumbers[period] ?? period;
          const timeLabel = displayPeriodTimes[period];

          const cardShell = cn(
            'relative flex overflow-hidden rounded-2xl bg-white transition-all duration-200',
            'border border-black/[0.08]',
            isOver && 'ring-2 ring-blue-600',
            isEditing && !isOver && 'border-rose-200/70',
          );

          if (isLunch || isBreak) {
            return (
              <motion.div
                key={`mobile-${mobileDay}-${period}`}
                layoutId={`card-${mobileDay}-${period}`}
                className={cn(cardShell, 'min-h-[96px]')}
              >
                <div className="relative flex flex-1 flex-col items-center justify-center gap-1.5 px-4 py-5 text-center">
                  <p
                    className={cn(
                      'text-[28px] font-black leading-none tracking-tight',
                      isLunch ? 'text-emerald-500' : 'text-amber-500',
                    )}
                  >
                    {isLunch ? 'พักเที่ยง' : 'พัก'}
                  </p>
                  <p className="text-[13px] font-bold text-muted-foreground">{timeLabel}</p>
                  <div className="pointer-events-none absolute bottom-3 right-3 opacity-70">
                    {isLunch ? (
                      <Coffee size={28} className="text-emerald-400/70" />
                    ) : (
                      <Timer size={26} className="text-amber-400/70" />
                    )}
                  </div>
                </div>
              </motion.div>
            );
          }

          const bindDrop = {
            onDragOver: (e: DragEvent) => {
              e.preventDefault();
              if (dragOverSlot?.day !== mobileDay || dragOverSlot?.period !== period) {
                setDragOverSlot({ day: mobileDay, period });
              }
            },
            onDragLeave: () => setDragOverSlot(null),
            onTouchMove: (touchE: TouchEvent) => {
              if (!touchDragData) return;
              const rect = touchE.currentTarget.getBoundingClientRect();
              const touch = touchE.touches[0];
              const isInside =
                touch.clientX >= rect.left &&
                touch.clientX <= rect.right &&
                touch.clientY >= rect.top &&
                touch.clientY <= rect.bottom;
              if (isInside && (dragOverSlot?.day !== mobileDay || dragOverSlot?.period !== period)) {
                setDragOverSlot({ day: mobileDay, period });
              } else if (!isInside) {
                setDragOverSlot(null);
              }
            },
            onDrop: (dropE: DragEvent) => {
              setDragOverSlot(null);
              setTouchDragData(null);
              if (!isEditMode) {
                toast.error('กรุณาเปิดโหมดแก้ไขก่อนแล้วจึงลากวิชา', {
                  description: 'คลิกปุ่มแก้ไข (Edit) ที่หัวตารางเพื่อเปิดโหมด',
                });
                return;
              }
              const subjectJson = dropE.dataTransfer.getData('application/subject-card');
              if (subjectJson && onDropSubject) {
                try {
                  const { subjectId, teacherId, classId: droppedClassId } = JSON.parse(subjectJson);
                  onDropSubject(mobileDay, period, subjectId, teacherId, droppedClassId || undefined);
                } catch {
                  toast.error('ไม่สามารถอ่านข้อมูลรายวิชาเพื่อวางในตารางได้');
                }
                return;
              }
              if (!onMoveEntry) return;
              const entryId = dropE.dataTransfer.getData('text/plain');
              if (entryId) onMoveEntry(entryId, mobileDay, period);
            },
            onTouchEnd: () => {
              if (touchDragData && dragOverSlot?.day === mobileDay && dragOverSlot?.period === period) {
                if (!isEditMode) {
                  toast.error('กรุณาเปิดโหมดแก้ไขก่อนแล้วจึงลากวิชา', {
                    description: 'คลิกปุ่มแก้ไข (Edit) ที่หัวตารางเพื่อเปิดโหมด',
                  });
                  setTouchDragData(null);
                  setDragOverSlot(null);
                  return;
                }
                onDropSubject?.(
                  mobileDay,
                  period,
                  touchDragData.subjectId,
                  touchDragData.teacherId,
                  touchDragData.classId || undefined,
                );
              }
              setTouchDragData(null);
              setDragOverSlot(null);
            },
          };

          if (entries.length === 0) {
            return (
              <motion.div
                key={`mobile-${mobileDay}-${period}`}
                layoutId={`card-${mobileDay}-${period}`}
                className={cardShell}
                onDragOver={bindDrop.onDragOver}
                onDragLeave={bindDrop.onDragLeave}
                onDrop={bindDrop.onDrop}
                onTouchMove={bindDrop.onTouchMove}
                onTouchEnd={bindDrop.onTouchEnd}
              >
                <button
                  type="button"
                  {...mobileCardLongPressProps(mobileDay, period)}
                  onClick={() => {
                    if (longPressFiredRef.current) {
                      longPressFiredRef.current = false;
                      return;
                    }
                    if (isEditing) openMobileSubjectDrawer(mobileDay, period);
                  }}
                  disabled={!canEdit && !setIsEditMode}
                  className="relative flex min-h-[96px] flex-1 touch-manipulation select-none items-stretch text-left disabled:cursor-default [-webkit-touch-callout:none]"
                >
                  <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 px-4 py-4">
                    <p className="flex items-baseline gap-2 font-black leading-none tracking-tight">
                      <span className="text-[36px] text-destructive">{periodNum}</span>
                      <span className="text-[13px] font-bold text-muted-foreground">{timeLabel}</span>
                    </p>
                    <p className="text-[14px] font-bold text-muted-foreground">
                      {canEdit ? 'แตะเพื่อเพิ่มวิชา · กดค้างเพื่อปิด' : 'กดค้างเพื่อแก้ไข'}
                    </p>
                  </div>
                  {canEdit && (
                    <div className="absolute bottom-2 right-3 z-20 flex gap-1">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/50 bg-white/45 text-foreground/70 shadow-sm backdrop-blur-md">
                        <Pencil size={12} />
                      </span>
                    </div>
                  )}
                </button>
              </motion.div>
            );
          }

          return (
            <div key={`mobile-${mobileDay}-${period}`} className="flex flex-col gap-3">
              {entries.map((entry) => {
                const classLabel =
                  allClasses?.find((c) => c.id === entry.classId)?.label || entry.classId;
                const topLabel = entry.subjectName || entry.subjectCode || timeLabel;
                const bottomLabel =
                  viewMode === 'teacher' ? `ห้อง ${classLabel}` : entry.teacherName || '–';
                const avatarUrl = teacherAvatarUrl(teachers, entry);
                const isExcess = excessEntryIds?.has(entry.id) ?? false;
                const isJoint = jointClassEntryIds?.has(entry.id) ?? false;
                const subjectColor = subjectColorByName(
                  entry.subjectName || entry.subjectId,
                  entry.subjectGroup,
                );

                return (
                  <motion.div
                    key={entry.id}
                    layoutId={`card-${mobileDay}-${period}-${entry.id}`}
                    className={cardShell}
                    onDragOver={bindDrop.onDragOver}
                    onDragLeave={bindDrop.onDragLeave}
                    onDrop={bindDrop.onDrop}
                    onTouchMove={bindDrop.onTouchMove}
                    onTouchEnd={bindDrop.onTouchEnd}
                  >
                    <button
                      type="button"
                      {...mobileCardLongPressProps(mobileDay, period)}
                      onClick={() => {
                        if (longPressFiredRef.current) {
                          longPressFiredRef.current = false;
                          return;
                        }
                        if (isEditing) openMobileSubjectDrawer(mobileDay, period);
                        else handleSlotClick(mobileDay, period, entry);
                      }}
                      className="relative flex min-h-[104px] flex-1 touch-manipulation select-none items-stretch overflow-hidden text-left [-webkit-touch-callout:none]"
                      draggable={canEdit}
                      onDragStartCapture={(e) => {
                        if (!canEdit) return;
                        e.dataTransfer.setData('text/plain', entry.id);
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                    >
                      <div className="flex flex-1 flex-col justify-center gap-1 py-4 pl-4 pr-2 min-w-0 z-10">
                        <p
                          className="line-clamp-2 min-h-[2.5em] text-[12px] font-bold leading-tight"
                          style={{ color: subjectColor.text }}
                        >
                          {topLabel}
                        </p>
                        <p className="flex items-baseline gap-2 font-black leading-none tracking-tight">
                          <span className="text-[36px] text-destructive">{periodNum}</span>
                          <span className="text-[13px] font-bold text-muted-foreground">{timeLabel}</span>
                        </p>
                        <p className="text-[15px] font-bold text-foreground truncate">{bottomLabel}</p>
                      </div>

                      <div className="relative w-[108px] shrink-0 self-stretch overflow-hidden">
                        <img
                          src={avatarUrl}
                          alt={entry.teacherName || 'ครู'}
                          className="absolute top-2 bottom-0 right-0 h-[calc(100%-0.5rem)] w-auto max-w-none object-cover object-top pointer-events-none select-none"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(entry.teacherId || entry.teacherName || 'teacher')}`;
                          }}
                        />
                      </div>

                      {(isExcess || isJoint) && (
                        <div className="absolute right-2 top-2 z-20 flex gap-1">
                          {isExcess && (
                            <span className="inline-flex items-center gap-0.5 rounded-md bg-amber-500 px-1.5 py-0.5 text-[9px] font-black text-white">
                              <AlertTriangle size={9} /> เกิน
                            </span>
                          )}
                          {isJoint && (
                            <span className="inline-flex items-center gap-0.5 rounded-md bg-blue-600/90 px-1.5 py-0.5 text-[9px] font-black text-white">
                              <Users size={9} /> รวม
                            </span>
                          )}
                        </div>
                      )}
                    </button>

                    {canEdit && (
                      <div className="absolute bottom-2 right-3 z-20 flex gap-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openMobileSubjectDrawer(mobileDay, period);
                          }}
                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/50 bg-white/45 text-foreground/70 shadow-sm backdrop-blur-md hover:bg-white/60"
                          title="แก้ไข"
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteEntry(entry.id);
                          }}
                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/50 bg-white/45 text-foreground/70 shadow-sm backdrop-blur-md hover:bg-white/60"
                          title="ลบ"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          );
          })}
          </div>

        <ExamMobileFilterDrawer
          open={!!mobileSubjectPickerSlot}
          onOpenChange={(open) => {
            if (!open) setMobileSubjectPickerSlot(null);
          }}
          direction="right"
          title="เลือกรายวิชา"
          description={
            mobileSubjectPickerSlot
              ? `${DAY_LABELS[mobileSubjectPickerSlot.day]} • คาบ ${displayNumbers[mobileSubjectPickerSlot.period] ?? mobileSubjectPickerSlot.period}`
              : undefined
          }
        >
          {draggableSubjects.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-rose-200 bg-white px-3 py-6 text-center text-[11px] font-bold text-rose-500/80">
              ยังไม่มีรายวิชาที่พร้อมเลือกในมุมมองนี้
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2.5 pb-4">
              {draggableSubjects.map((subject) => {
                const color = subjectColorByName(subject.name || subject.id, subject.subjectGroup);
                const teacherId = subject.assignedTeacherId || dragTeacherId;
                const badge = categoryBadgeStyle((subject as any).category);
                const handleAdd = () => {
                  if (!mobileSubjectPickerSlot) return;
                  if (!teacherId) {
                    toast.error('ยังไม่สามารถใส่วิชาได้ เพราะไม่พบครูผู้สอนของวิชานี้');
                    return;
                  }
                  onDropSubject?.(
                    mobileSubjectPickerSlot.day,
                    mobileSubjectPickerSlot.period,
                    subject.id,
                    teacherId,
                    subject.classId ?? undefined,
                  );
                  setMobileSubjectPickerSlot(null);
                };
                return (
                  <div
                    key={`picker-${subject.id}-${subject.className ?? ''}`}
                    className="flex w-full items-center gap-3 rounded-xl p-3"
                    style={{
                      background: subjectGradient(color),
                      boxShadow: `inset 0 1px 0 rgba(255,255,255,0.82), 0 12px 18px -18px ${withAlpha(color.accent, 0.58)}`,
                    }}
                  >
                    <button type="button" onClick={handleAdd} className="min-w-0 flex-1 text-left">
                      <div className="mb-1.5 flex flex-wrap items-center gap-1">
                        <span
                          className="shrink-0 rounded-md border px-1.5 py-0.5 text-[9px] font-black"
                          style={{
                            borderColor: 'rgba(255,255,255,0.26)',
                            background: 'rgba(0,0,0,0.14)',
                            color: 'rgba(255,255,255,0.96)',
                          }}
                        >
                          {subject.code}
                        </span>
                        {viewMode === 'teacher' && subject.className && (
                          <span
                            className="shrink-0 rounded-md border bg-white/20 px-1 py-0.5 text-[8px] font-black text-white"
                            style={{ borderColor: 'rgba(255,255,255,0.2)' }}
                          >
                            {subject.className}
                          </span>
                        )}
                        <span
                          className={`inline-flex shrink-0 items-center gap-1 rounded-md border px-1.5 py-0.5 text-[8px] font-black ${badge.className}`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${badge.dotClassName}`} />
                          {badge.label}
                        </span>
                        <span
                          className="ml-auto shrink-0 text-[9px] font-bold text-white"
                          style={{ textShadow: '0 1px 2px rgba(0,0,0,0.4)' }}
                        >
                          {subject.hoursPerWeek ?? 0} คาบ
                        </span>
                      </div>
                      <p
                        className="line-clamp-2 text-[11px] font-extrabold leading-snug text-white"
                        style={{ textShadow: '0 1px 2.5px rgba(0,0,0,0.45)' }}
                      >
                        {subject.name}
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={handleAdd}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                      style={{
                        background: 'rgba(255,255,255,0.22)',
                        border: '1.5px solid rgba(255,255,255,0.5)',
                      }}
                      title="เพิ่มรายวิชานี้"
                    >
                      <Plus size={16} className="text-white drop-shadow" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </ExamMobileFilterDrawer>

          </>
        )}
      </div>

      <div
        className={cn(
          'hidden overflow-x-auto pb-1',
          shouldHideGrid
            ? 'md:flex min-h-[calc(100dvh-12rem)] items-center justify-center'
            : 'md:block',
        )}
        id="schedule-grid-export"
      >
        {shouldHideGrid ? (
          <div className="w-full px-5 py-8 text-center">
            <p className="text-[13px] font-black text-red-600">{hideGridTitle}</p>
            <p className="mt-1 text-[11px] font-medium text-red-500">{hideGridHint}</p>
          </div>
        ) : (
        <div
          className="rounded-2xl overflow-hidden h-full min-h-0 flex flex-col"
          style={{
            background: 'rgba(255,255,255,0.78)',
            backdropFilter: 'blur(28px) saturate(160%)',
            WebkitBackdropFilter: 'blur(28px) saturate(160%)',
            border: `1px solid ${isEditing ? 'rgba(225,29,72,0.3)' : 'rgba(0,0,0,0.08)'}`,
            boxShadow: 'none',
            minWidth: 700,
          }}
        >
          {/* ── Header row ── */}
          <div
            className="grid"
            style={{
              gridTemplateColumns: `${canEdit ? 90 : 76}px repeat(5, minmax(0, 1fr))`,
              background: isEditing ? 'rgba(225,29,72,0.04)' : 'rgba(0,0,0,0.025)',
              borderBottom: `1px solid ${isEditing ? 'rgba(225,29,72,0.2)' : 'rgba(0,0,0,0.08)'}`,
            }}
          >
            <div className="p-3 flex items-center justify-center">
              {setIsEditMode ? (
                <button
                  onClick={() => setIsEditMode(!isEditMode)}
                  className={`w-8 h-4.5 rounded-full p-0.5 transition-all duration-300 ${isEditMode ? 'bg-rose-500 shadow-inner' : 'bg-black/10'}`}
                  title={isEditMode ? 'สลับเป็นโหมดดูอย่างเดียว' : 'สลับเป็นโหมดแก้ไข'}
                >
                  <motion.div
                    animate={{ x: isEditMode ? 14 : 0 }}
                    className="w-3.5 h-3.5 rounded-full bg-white shadow-md"
                  />
                </button>
              ) : (
                <span className={`text-[9px] font-black uppercase tracking-widest ${isEditing ? 'text-rose-500' : 'text-black/65'}`}>คาบ</span>
              )}
            </div>
            {SCHOOL_DAYS.map(day => (
              <div
                key={day}
                className="py-3 px-2 text-center"
                style={{ borderLeft: `1px solid ${isEditing ? 'rgba(225,29,72,0.2)' : 'rgba(0,0,0,0.06)'}` }}
              >
                <p className={`text-[12px] font-black hidden md:block ${isEditing ? 'text-rose-600' : 'text-foreground'}`}>{DAY_LABELS[day]}</p>
                <p className={`text-[12px] font-black md:hidden ${isEditing ? 'text-rose-600' : 'text-foreground'}`}>{DAY_SHORT[day]}</p>
              </div>
            ))}
          </div>

          {/* ── Period rows (scrollable) ── */}
          <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide">
          {periods.map((period) => {
            const isLunch = lunchPeriods.includes(period);
            const isBreak = breakPeriods.includes(period);
            const isAnyBreak = isLunch || isBreak;

            return (
              <div
                key={period}
                className="grid group/row transition-all duration-300 overflow-hidden"
                style={{
                  gridTemplateColumns: `${canEdit ? 90 : 76}px repeat(5, minmax(0, 1fr))`,
                  minHeight: canEdit ? 80 : (isAnyBreak ? 36 : 70),
                  borderTop: `1px solid ${isEditing ? 'rgba(225,29,72,0.2)' : 'rgba(0,0,0,0.06)'}`,
                  background: isLunch
                    ? 'rgba(16,185,129,0.04)'
                    : isBreak
                      ? 'rgba(234,179,8,0.04)'
                      : undefined,
                }}
              >
                <PeriodLabel
                  period={period}
                  displayNum={displayNumbers[period]}
                  isLunch={isLunch}
                  isBreak={isBreak}
                  time={displayPeriodTimes[period] ?? ''}
                  canEdit={canEdit}
                  isEditMode={isEditMode}
                  onRemove={() => removePeriod(period)}
                  onTimeChange={(t) => updatePeriodTime(period, t)}
                  onCycleBreak={() => cycleBreakType(period)}
                />

                {isLunch ? (
                  <div className="col-span-5 p-[3px]">
                    <div
                      className="relative w-full h-full min-h-[50px] overflow-hidden rounded-xl flex items-center justify-center gap-2"
                      style={
                        isEditing
                          ? {
                              background: restGradient(true),
                              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.34)',
                            }
                          : {
                              backgroundImage: 'url(/schedule/lunch-sky.png)',
                              backgroundSize: 'cover',
                              backgroundPosition: 'center',
                            }
                      }
                    >
                      {!isEditing && (
                        <div className="pointer-events-none absolute inset-0 bg-sky-900/15" aria-hidden />
                      )}
                      <Coffee size={14} className="relative z-10 text-white drop-shadow" />
                      <span className="relative z-10 text-[10px] font-black uppercase tracking-widest text-white drop-shadow">
                        พักกลางวัน — Lunch Break
                      </span>
                    </div>
                  </div>
                ) : isBreak ? (
                  <div className="col-span-5 p-[3px]">
                    <div
                      className="w-full h-full rounded-xl flex items-center justify-center gap-2"
                      style={{ 
                        background: restGradient(isEditing),
                        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.34)',
                      }}
                    >
                      <Timer size={12} className="text-white" />
                      <span className="text-[9.5px] font-black uppercase tracking-widest text-white">พักเบรก — Break</span>
                    </div>
                  </div>
                ) : (
                  SCHOOL_DAYS.map(day => {
                    const entries = grid[day]?.[period] ?? [];
                    const isOver = dragOverSlot?.day === day && dragOverSlot?.period === period;
                    
                    return (
                      <div
                        key={day}
                        style={{
                          borderLeft: `1px solid ${isEditing ? 'rgba(225,29,72,0.2)' : 'rgba(0,0,0,0.06)'}`,
                          padding: '3px',
                          background: isOver ? 'rgba(37,99,235,0.08)' : undefined,
                          transition: 'background 0.2s ease',
                        }}
                        onDragOver={(dragE) => {
                          dragE.preventDefault();
                          if (dragOverSlot?.day !== day || dragOverSlot?.period !== period) {
                            setDragOverSlot({ day, period });
                          }
                        }}
                        onDragLeave={() => setDragOverSlot(null)}
                        onTouchMove={(touchE) => {
                          if (touchDragData) {
                            const rect = touchE.currentTarget.getBoundingClientRect();
                            const touch = touchE.touches[0];
                            const isInside = touch.clientX >= rect.left && touch.clientX <= rect.right &&
                                            touch.clientY >= rect.top && touch.clientY <= rect.bottom;
                            if (isInside && (dragOverSlot?.day !== day || dragOverSlot?.period !== period)) {
                              setDragOverSlot({ day, period });
                            } else if (!isInside) {
                              setDragOverSlot(null);
                            }
                          }
                        }}
                        onDrop={(dropE) => {
                          setDragOverSlot(null);
                          setTouchDragData(null);

                          // Check if trying to drop without edit mode enabled
                          if (!isEditMode) {
                            toast.error('กรุณาเปิดโหมดแก้ไขก่อนแล้วจึงลากวิชา', {
                              description: 'คลิกปุ่มแก้ไข (Edit) ที่หัวตารางเพื่อเปิดโหมด',
                            });
                            return;
                          }

                          const subjectJson = dropE.dataTransfer.getData('application/subject-card');
                          if (subjectJson && onDropSubject) {
                            try {
                              const { subjectId, teacherId, classId: droppedClassId } = JSON.parse(subjectJson);
                              onDropSubject(day, period, subjectId, teacherId, droppedClassId || undefined);
                            } catch {
                              toast.error('ไม่สามารถอ่านข้อมูลรายวิชาเพื่อวางในตารางได้');
                            }
                            return;
                          }
                          if (!onMoveEntry) return;
                          const entryId = dropE.dataTransfer.getData('text/plain');
                          if (entryId) onMoveEntry(entryId, day, period);
                        }}
                        onTouchEnd={() => {
                          if (touchDragData && dragOverSlot?.day === day && dragOverSlot?.period === period) {
                            if (!isEditMode) {
                              toast.error('กรุณาเปิดโหมดแก้ไขก่อนแล้วจึงลากวิชา', {
                                description: 'คลิกปุ่มแก้ไข (Edit) ที่หัวตารางเพื่อเปิดโหมด',
                              });
                              setTouchDragData(null);
                              setDragOverSlot(null);
                              return;
                            }
                            onDropSubject?.(day, period, touchDragData.subjectId, touchDragData.teacherId, touchDragData.classId || undefined);
                          }
                          setTouchDragData(null);
                          setDragOverSlot(null);
                        }}
                      >
                        <SlotCell
                          entries={entries}
                          viewMode={viewMode}
                          readOnly={!canEdit}
                          allClasses={allClasses}
                          excessEntryIds={excessEntryIds}
                          teachers={teachers}
                          jointClassEntryIds={jointClassEntryIds}
                          jointClassPartnersByEntryId={jointClassPartnersByEntryId}
                          onClick={(e) => handleSlotClick(day, period, e)}
                          onDelete={(id) => onDeleteEntry(id)}
                        />
                      </div>
                    );
                  })
                )}
              </div>
            );
          })}
          </div>

          {/* ── Add period ── */}
          {canEdit && (
            <div
              className="flex items-center justify-center py-2 border-t"
              style={{ borderColor: 'rgba(225,29,72,0.15)', background: 'rgba(0,0,0,0.01)' }}
            >
              <button
                onClick={addPeriod}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-[10px] font-bold text-rose-500/60 hover:text-rose-600/90 hover:bg-rose-50 transition-all"
              >
                <PlusCircle size={12} />
                เพิ่มคาบ
              </button>

              <div className="w-px h-3 bg-rose-500/10 mx-1" />

              <Popover>
                <PopoverTrigger asChild>
                  <button
                    disabled={isCopying}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-[10px] font-bold text-blue-500/60 hover:text-blue-600/90 hover:bg-blue-50 transition-all disabled:opacity-50"
                  >
                    <Check size={12} />
                    คัดลอกโครงสร้างคาบไปยัง...
                  </button>
                </PopoverTrigger>
                <PopoverContent side="top" align="center" className="w-[240px] p-2 bg-white/95 backdrop-blur-md border-black/[0.08] shadow-2xl rounded-2xl">
                  <div className="flex flex-col gap-1">
                    <p className="text-[9px] font-black uppercase tracking-widest text-black/30 px-2 py-1.5">ตัวเลือกการคัดลอก</p>
                    {viewMode === 'class' && (
                    <button
                      onClick={async () => {
                        if (!classId || !allClasses) return;
                        setIsCopying(true);
                        const currentClass = allClasses.find(c => c.id === classId);
                        const targetIds = allClasses
                          .filter(c => c.id !== classId && c.gradeLevel === currentClass?.gradeLevel)
                          .map(c => c.id);
                        
                        if (targetIds.length === 0) {
                          toast.error("ไม่พบห้องเรียนอื่นในระดับชั้นนี้");
                        } else {
                          await copyToClasses(targetIds);
                          toast.success(`คัดลอกโครงสร้างไปยัง ${targetIds.length} ห้องในระดับชั้น ${currentClass?.gradeLevel} แล้ว`);
                        }
                        setIsCopying(false);
                      }}
                      className="flex items-center gap-2.5 w-full p-2.5 rounded-xl hover:bg-blue-50 text-left transition-colors group"
                    >
                      <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600 group-hover:bg-blue-200 transition-colors">
                        <Users size={13} />
                      </div>
                      <div>
                        <p className="text-[11px] font-bold text-slate-700">ทุกห้องในระดับชั้นนี้</p>
                        <p className="text-[9px] text-slate-400 font-medium">คัดลอกเวลาไปยัง ม.1/2, ม.1/3, ...</p>
                      </div>
                    </button>
                    )}

                    {viewMode === 'class' && (
                    <button
                      onClick={async () => {
                        if (!classId || !allClasses) return;
                        setIsCopying(true);
                        const currentClass = allClasses.find(c => c.id === classId);
                        const targetIds = allClasses
                          .filter(c => c.id !== classId && c.department === currentClass?.department)
                          .map(c => c.id);
                        
                        if (targetIds.length === 0) {
                          toast.error("ไม่พบห้องเรียนอื่นในแผนกนี้");
                        } else {
                          await copyToClasses(targetIds);
                          toast.success(`คัดลอกโครงสร้างไปยัง ${targetIds.length} ห้องในแผนก ${currentClass?.department} แล้ว`);
                        }
                        setIsCopying(false);
                      }}
                      className="flex items-center gap-2.5 w-full p-2.5 rounded-xl hover:bg-slate-50 text-left transition-colors group"
                    >
                      <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 group-hover:bg-slate-200 transition-colors">
                        <Layout size={13} />
                      </div>
                      <div>
                        <p className="text-[11px] font-bold text-slate-700">ทุกห้องในแผนกนี้</p>
                        <p className="text-[9px] text-slate-400 font-medium">คัดลอกไปยังทั้งประถม หรือ มัธยม</p>
                      </div>
                    </button>
                    )}

                    {/* Copy current class structure → teachers (class view) */}
                    {viewMode === 'class' && teachers && teachers.length > 0 && (
                      <div className="h-px bg-black/[0.04] mx-2 my-1" />
                    )}
                    {viewMode === 'class' && teachers && teachers.length > 0 && (
                    <button
                      onClick={async () => {
                        if (!classId || !allClasses || !teachers) return;
                        setIsCopying(true);
                        const currentClass = allClasses.find(c => c.id === classId);
                        const currentDept = currentClass?.department;
                        const targetIds = currentDept
                          ? teachers.filter(t => t.department === currentDept).map(t => t.id)
                          : teachers.map(t => t.id);

                        if (targetIds.length === 0) {
                          toast.error('ไม่พบรายชื่อครูในแผนกนี้');
                        } else {
                          await copyToClasses(targetIds);
                          toast.success(`คัดลอกโครงสร้างไปยังครู ${targetIds.length} ท่านในแผนก ${currentDept ?? 'นี้'} แล้ว`);
                        }
                        setIsCopying(false);
                      }}
                      className="flex items-center gap-2.5 w-full p-2.5 rounded-xl hover:bg-orange-50 text-left transition-colors group"
                    >
                      <div className="w-7 h-7 rounded-lg bg-orange-100 flex items-center justify-center text-orange-600 group-hover:bg-orange-200 transition-colors">
                        <User size={13} />
                      </div>
                      <div>
                        <p className="text-[11px] font-bold text-slate-700">ครูในแผนกนี้</p>
                        <p className="text-[9px] text-slate-400 font-medium">คัดลอกโครงสร้างเวลาไปยังตารางรายครู</p>
                      </div>
                    </button>
                    )}
                    {viewMode === 'class' && teachers && teachers.length > 0 && (
                    <button
                      onClick={async () => {
                        if (!teachers) return;
                        setIsCopying(true);
                        const targetIds = teachers.map(t => t.id);

                        if (targetIds.length === 0) {
                          toast.error('ไม่พบรายชื่อครู');
                        } else {
                          await copyToClasses(targetIds);
                          toast.success(`คัดลอกโครงสร้างไปยังครูทั้งหมด ${targetIds.length} ท่านแล้ว`);
                        }
                        setIsCopying(false);
                      }}
                      className="flex items-center gap-2.5 w-full p-2.5 rounded-xl hover:bg-indigo-50 text-left transition-colors group"
                    >
                      <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600 group-hover:bg-indigo-200 transition-colors">
                        <Users size={13} />
                      </div>
                      <div>
                        <p className="text-[11px] font-bold text-slate-700">คุณครูทั้งหมด</p>
                        <p className="text-[9px] text-slate-400 font-medium">คัดลอกโครงสร้างไปยังตารางรายครูทุกท่าน</p>
                      </div>
                    </button>
                    )}

                    {/* Copy to Teachers (teacher view) */}
                    {viewMode === 'teacher' && <div className="h-px bg-black/[0.04] mx-2 my-1" />}
                    
                    {viewMode === 'teacher' && (
                    <button
                      onClick={async () => {
                        if (!settingsTargetId || !teachers) return;
                        setIsCopying(true);
                        const currentActor = teachers.find(t => t.id === settingsTargetId);
                        if (!currentActor) {
                          toast.error("ไม่สามารถระบุแผนกต้นทางได้");
                        } else {
                          const currentDept = currentActor.department;
                          const targetIds = teachers
                            .filter(t => t.id !== settingsTargetId && t.department === currentDept)
                            .map(t => t.id);
                          
                          if (targetIds.length === 0) {
                            toast.error("ไม่พบครูอื่นในแผนกนี้");
                          } else {
                            await copyToClasses(targetIds);
                            toast.success(`คัดลอกโครงสร้างไปยังครู ${targetIds.length} ท่านในแผนก ${currentDept} แล้ว`);
                          }
                        }
                        setIsCopying(false);
                      }}
                      className="flex items-center gap-2.5 w-full p-2.5 rounded-xl hover:bg-orange-50 text-left transition-colors group"
                    >
                      <div className="w-7 h-7 rounded-lg bg-orange-100 flex items-center justify-center text-orange-600 group-hover:bg-orange-200 transition-colors">
                        <User size={13} />
                      </div>
                      <div>
                        <p className="text-[11px] font-bold text-slate-700">ทุกครูในแผนกนี้</p>
                        <p className="text-[9px] text-slate-400 font-medium">คัดลอกเวลาไปยังครูในสังกัดเดียวกัน</p>
                      </div>
                    </button>
                    )}

                    {viewMode === 'teacher' && (
                    <button
                      onClick={async () => {
                        if (!settingsTargetId || !teachers) return;
                        setIsCopying(true);
                        const targetIds = teachers
                          .filter(t => t.id !== settingsTargetId)
                          .map(t => t.id);
                        
                        if (targetIds.length === 0) {
                          toast.error("ไม่พบครูท่านอื่น");
                        } else {
                          await copyToClasses(targetIds);
                          toast.success(`คัดลอกโครงสร้างไปยังครูทั้งหมด ${targetIds.length} ท่านแล้ว`);
                        }
                        setIsCopying(false);
                      }}
                      className="flex items-center gap-2.5 w-full p-2.5 rounded-xl hover:bg-indigo-50 text-left transition-colors group"
                    >
                      <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600 group-hover:bg-indigo-200 transition-colors">
                        <Users size={13} />
                      </div>
                      <div>
                        <p className="text-[11px] font-bold text-slate-700">คุณครูทั้งหมด</p>
                        <p className="text-[9px] text-slate-400 font-medium">คัดลอกไปยังครูทุกคนในโรงเรียน</p>
                      </div>
                    </button>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          )}
        </div>
        )}
      </div>

      {/* ── Slot Detail Modal (read-only) ── */}
      <AnimatePresence>
        {detailEntry && (
          <SlotDetailModal
            entry={detailEntry}
            viewMode={viewMode}
            onClose={() => setDetailEntry(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

// ── Period Label ──────────────────────────────────────────────────────────────
function PeriodLabel({
  period,
  displayNum,
  isLunch,
  isBreak,
  time,
  canEdit,
  isEditMode,
  onRemove,
  onTimeChange,
  onCycleBreak,
}: {
  period: number;
  displayNum?: number;
  isLunch: boolean;
  isBreak: boolean;
  time: string;
  isEditMode: boolean;
  canEdit: boolean;
  onRemove: () => void;
  onTimeChange: (t: string) => void;
  onCycleBreak: () => void;
}) {
  const isEditing = isEditMode && canEdit;
  const [draftStart, setDraftStart] = useState(time.split('-')[0]?.trim() || '');
  const [draftEnd, setDraftEnd] = useState(time.split('-')[1]?.trim() || '');
  const [isOpen, setIsOpen] = useState(false);

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      const parts = time.split('-');
      setDraftStart(parts[0]?.trim() || '');
      setDraftEnd(parts[1]?.trim() || '');
    }
    setIsOpen(nextOpen);
  };

  const commit = () => {
    const t = draftStart && draftEnd ? `${draftStart} - ${draftEnd}` : draftStart || draftEnd || '';
    onTimeChange(t);
    setIsOpen(false);
  };

  const cancel = () => {
    const parts = time.split('-');
    setDraftStart(parts[0]?.trim() || '');
    setDraftEnd(parts[1]?.trim() || '');
    setIsOpen(false);
  };

  const isAnyBreak = isLunch || isBreak;

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <div
          className="relative flex flex-col items-center justify-center py-1 px-1 group/label select-none w-full"
          style={{
            borderRight: `1px solid ${isEditing ? 'rgba(225,29,72,0.15)' : 'rgba(0,0,0,0.06)'}`,
            borderTop: isAnyBreak ? `1px solid ${isEditing ? 'rgba(225,29,72,0.15)' : 'rgba(0,0,0,0.06)'}` : undefined,
            borderBottom: isAnyBreak ? `1px solid ${isEditing ? 'rgba(225,29,72,0.15)' : 'rgba(0,0,0,0.06)'}` : undefined,
            minHeight: isLunch ? 56 : isBreak ? 28 : 76,
            cursor: isEditing ? 'pointer' : 'default',
            background: isLunch
                ? (isEditing ? 'rgba(225,29,72,0.08)' : 'rgba(37,99,235,0.08)')
                : isBreak
                  ? (isEditing ? 'rgba(225,29,72,0.06)' : 'rgba(59,130,246,0.06)')
                  : 'rgba(0,0,0,0.02)',
          }}
          onDoubleClick={(e) => {
            if (!canEdit) return;
            e.stopPropagation();
            onCycleBreak();
          }}
          title={canEdit ? 'ดับเบิลคลิก: เปลี่ยนประเภท | คลิก: แก้ไขเวลา' : undefined}
        >
          {canEdit && (
            <button
              onClick={(e) => { e.stopPropagation(); onRemove(); }}
              title="ลบคาบ"
              className="absolute top-1.5 right-1.5 w-6 h-6 rounded-xl flex items-center justify-center bg-rose-500/10 hover:bg-rose-500/20 text-rose-500/60 hover:text-rose-600 transition-all z-10"
            >
              <X size={11} strokeWidth={2.5} />
            </button>
          )}

          {isLunch ? (
            <Coffee size={13} className={isEditing ? 'text-rose-600' : 'text-blue-600'} />
          ) : isBreak ? (
            <Timer size={11} className={isEditing ? 'text-rose-500' : 'text-blue-500'} />
          ) : (
            <>
              <span className={`text-[11px] font-black leading-none ${isEditing ? 'text-rose-700' : 'text-black/85'}`}>
                {displayNum ?? period}
              </span>
              <span className={`text-[9px] text-center font-bold leading-none mt-1 ${
                isEditing ? 'text-rose-600' : 'text-black/60'
              } transition-colors`}>
                {time || '—'}
              </span>
            </>
          )}
        </div>
      </PopoverTrigger>
      
      {canEdit && (
        <PopoverContent 
          side="right" 
          align="center" 
          sideOffset={8}
          className="w-[216px] p-0 border-0 bg-transparent shadow-none"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.90, x: -4 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.90, x: -4 }}
            transition={{ duration: 0.15 }}
          >
            <div
              className="rounded-2xl p-3.5"
              style={{
                background: 'rgba(255,255,255,0.97)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(0,0,0,0.09)',
                boxShadow: '0 12px 40px rgba(0,0,0,0.12)',
              }}
            >
              <div className="flex items-center gap-1.5 mb-2.5">
                <Clock size={11} className="text-rose-500" />
                <span className="text-[11px] font-bold text-black/65">
                  เวลา — คาบ {displayNum ?? period}
                </span>
              </div>
              <div className="flex items-center gap-2 mb-2.5">
                <input
                  autoFocus
                  type="time"
                  value={draftStart}
                  onChange={e => setDraftStart(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') cancel(); }}
                  className="flex-1 text-[11px] text-center border border-rose-200 rounded-xl px-2 py-1.5 outline-none focus:border-rose-400 bg-white"
                />
                <span className="text-black/25 font-bold text-xs">–</span>
                <input
                  type="time"
                  value={draftEnd}
                  onChange={e => setDraftEnd(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') cancel(); }}
                  className="flex-1 text-[11px] text-center border border-rose-200 rounded-xl px-2 py-1.5 outline-none focus:border-rose-400 bg-white"
                />
              </div>
              <div className="flex gap-1.5">
                <button
                  onClick={commit}
                  className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-xl text-[10px] font-bold text-white bg-rose-500 hover:bg-rose-600 transition-colors"
                >
                  <Check size={10} /> บันทึก
                </button>
                <button
                  onClick={cancel}
                  className="flex items-center justify-center w-8 rounded-xl text-black/35 hover:text-black/55 hover:bg-black/[0.04] transition-colors"
                >
                  <X size={11} />
                </button>
              </div>
            </div>
          </motion.div>
        </PopoverContent>
      )}
    </Popover>
  );
}

// ── Slot Cell ─────────────────────────────────────────────────────────────────
/** Desktop grid card — same layout language as mobile schedule cards */
function DesktopScheduleCard({
  entry,
  viewMode,
  readOnly,
  isExcess,
  isJoint,
  subtitle,
  teachers,
  allClasses,
  onClick,
  onDelete,
  compact,
}: {
  entry: ScheduleEntry;
  viewMode: 'class' | 'teacher';
  readOnly?: boolean;
  isExcess?: boolean;
  isJoint?: boolean;
  subtitle?: string;
  teachers?: { id: string; department: string; name: string; photoURL?: string }[];
  allClasses?: { id: string; gradeLevel: string; department: string; label: string }[];
  onClick: (entry?: ScheduleEntry) => void;
  onDelete?: (id: string) => void;
  compact?: boolean;
}) {
  const subjectColor = subjectColorByName(entry.subjectName || entry.subjectId, entry.subjectGroup);
  const avatarUrl = teacherAvatarUrl(teachers, entry);
  const classLabel = allClasses?.find((c) => c.id === entry.classId)?.label || entry.classId;
  const topLabel = entry.subjectName || entry.subjectCode;
  const bottomLabel =
    viewMode === 'teacher' ? `ห้อง ${classLabel}` : entry.teacherName || '–';

  return (
    <motion.div
      key={entry.id}
      initial={{ opacity: 0, scale: 0.93 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.93 }}
      transition={{ duration: 0.13 }}
      className={cn(
        'group relative w-full h-full overflow-hidden rounded-xl cursor-pointer transition-all duration-150',
        'bg-white',
        isExcess && 'ring-2 ring-amber-400/40',
      )}
      style={{ minHeight: compact ? 44 : 70 }}
      onClick={() => onClick(entry)}
      draggable={!readOnly}
      onDragStartCapture={(e) => {
        if (readOnly) return;
        e.dataTransfer.setData('text/plain', entry.id);
        e.dataTransfer.effectAllowed = 'move';
      }}
    >
      <div className={cn('relative flex h-full items-stretch', compact ? 'min-h-[44px]' : 'min-h-[70px]')}>
        <div className={cn('flex flex-1 flex-col justify-center min-w-0 z-10', compact ? 'gap-0 py-1.5 pl-2 pr-1' : 'gap-0.5 py-2 pl-2.5 pr-1')}>
          <p
            className={cn(
              'font-bold leading-tight line-clamp-2 min-h-[2.5em]',
              compact ? 'text-[9px]' : 'text-[10px]',
            )}
            style={{ color: subjectColor.text }}
          >
            {topLabel}
          </p>
          {subtitle && (
            <p className="text-[8px] font-bold text-muted-foreground line-clamp-1">{subtitle}</p>
          )}
          <p className={cn('font-bold text-foreground truncate', compact ? 'text-[8px]' : 'text-[9px]')}>
            {bottomLabel}
          </p>
        </div>

        <div className={cn('relative shrink-0 self-stretch overflow-hidden', compact ? 'w-10' : 'w-14')}>
          <img
            src={avatarUrl}
            alt={entry.teacherName || 'ครู'}
            className="absolute top-1 bottom-0 right-0 h-[calc(100%-0.25rem)] w-auto max-w-none object-cover object-top pointer-events-none select-none"
            onError={(e) => {
              (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(entry.teacherId || entry.teacherName || 'teacher')}`;
            }}
          />
        </div>

        {(isExcess || isJoint) && (
          <div className="absolute right-1 bottom-1 z-20 flex gap-0.5">
            {isExcess && (
              <span className="inline-flex items-center gap-0.5 rounded-md bg-amber-500 px-1 py-0.5 text-[8px] font-black text-white">
                <AlertTriangle size={8} /> เกิน
              </span>
            )}
            {isJoint && (
              <span className="inline-flex items-center gap-0.5 rounded-md bg-blue-600/90 px-1 py-0.5 text-[8px] font-black text-white">
                <Users size={8} /> รวม
              </span>
            )}
          </div>
        )}
      </div>

      {!readOnly && !compact && (
        <div className="absolute left-1.5 bottom-1.5 z-20 flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onClick(entry); }}
            className="flex h-6 w-6 items-center justify-center rounded-md bg-black/10 text-foreground/70 hover:bg-black/15"
            title="แก้ไข"
          >
            <Pencil size={11} />
          </button>
          {onDelete && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onDelete(entry.id); }}
              className="flex h-6 w-6 items-center justify-center rounded-md bg-black/10 text-foreground/70 hover:bg-black/15"
              title="ลบ"
            >
              <Trash2 size={11} />
            </button>
          )}
        </div>
      )}
    </motion.div>
  );
}

function SlotCell({
  entries,
  viewMode,
  readOnly,
  onClick,
  onDelete,
  allClasses,
  excessEntryIds,
  teachers,
  jointClassEntryIds,
  jointClassPartnersByEntryId,
}: {
  entries: ScheduleEntry[];
  viewMode: 'class' | 'teacher';
  readOnly?: boolean;
  onClick: (entry?: ScheduleEntry) => void;
  onDelete?: (id: string) => void;
  allClasses?: { id: string; gradeLevel: string; department: string; label: string }[];
  excessEntryIds?: Set<string>;
  teachers?: { id: string; department: string; name: string; photoURL?: string }[];
  jointClassEntryIds?: Set<string>;
  jointClassPartnersByEntryId?: Map<string, string[]>;
}) {
  if (entries.length === 0) {
    return (
      <button
        onClick={() => onClick()}
        disabled={readOnly}
        className="group w-full h-full rounded-xl flex items-center justify-center transition-all duration-150 hover:bg-black/[0.04] disabled:cursor-default"
        style={{ minHeight: 70 }}
      >
        {!readOnly && (
          <Plus
            size={16}
            className="text-rose-400/40 group-hover:text-rose-500 transition-colors"
          />
        )}
      </button>
    );
  }

  // Joint class: same teacher + same subject + same slot across multiple rooms
  if (isJointClassGroup(entries)) {
    const entry = entries[0];
    const roomLabels = formatClassLabels(
      entries.map((e) => e.classId),
      allClasses,
    );
    const partnerLabels = formatClassLabels(
      jointClassPartnersByEntryId?.get(entry.id) ?? entries.slice(1).map((e) => e.classId),
      allClasses,
    );
    const subtitle =
      viewMode === 'teacher'
        ? `ห้อง ${roomLabels}`
        : partnerLabels
          ? `กับ ${partnerLabels}`
          : undefined;

    return (
      <AnimatePresence mode="wait">
        <DesktopScheduleCard
          entry={entry}
          viewMode={viewMode}
          readOnly={readOnly}
          isExcess={entries.some((e) => excessEntryIds?.has(e.id))}
          isJoint
          subtitle={viewMode === 'class' ? subtitle : undefined}
          teachers={teachers}
          allClasses={allClasses}
          onClick={onClick}
          onDelete={onDelete}
        />
      </AnimatePresence>
    );
  }

  if (entries.length === 1) {
    const entry = entries[0];
    const isJoint = jointClassEntryIds?.has(entry.id) ?? false;
    const partnerLabels = isJoint
      ? formatClassLabels(jointClassPartnersByEntryId?.get(entry.id) ?? [], allClasses)
      : '';

    return (
      <AnimatePresence mode="wait">
        <DesktopScheduleCard
          entry={entry}
          viewMode={viewMode}
          readOnly={readOnly}
          isExcess={excessEntryIds?.has(entry.id) ?? false}
          isJoint={isJoint}
          subtitle={isJoint && partnerLabels ? `กับ ${partnerLabels}` : undefined}
          teachers={teachers}
          allClasses={allClasses}
          onClick={onClick}
          onDelete={onDelete}
        />
      </AnimatePresence>
    );
  }

  // Multiple non-joint entries — stacked compact cards
  return (
    <div className="flex h-full min-h-[70px] w-full flex-col gap-1">
      {entries.map((entry) => (
        <DesktopScheduleCard
          key={entry.id}
          entry={entry}
          viewMode={viewMode}
          readOnly={readOnly}
          isExcess={excessEntryIds?.has(entry.id) ?? false}
          isJoint={jointClassEntryIds?.has(entry.id) ?? false}
          teachers={teachers}
          allClasses={allClasses}
          onClick={onClick}
          onDelete={onDelete}
          compact
        />
      ))}
      {!readOnly && (
        <button
          type="button"
          onClick={() => onClick()}
          className="flex w-full items-center justify-center rounded-lg border border-dashed border-black/10 py-1 text-black/20 transition-all hover:bg-black/5 hover:text-black/40"
        >
          <Plus size={12} />
        </button>
      )}
    </div>
  );
}

// ── Slot Detail Modal ─────────────────────────────────────────────────────────
function SlotDetailModal({
  entry,
  viewMode,
  onClose,
}: {
  entry: ScheduleEntry;
  viewMode: 'class' | 'teacher';
  onClose: () => void;
}) {
  const color = subjectColorByName(entry.subjectName || entry.subjectId, entry.subjectGroup);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.25)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 12 }}
        transition={{ duration: 0.18 }}
        className="w-full max-w-sm rounded-3xl overflow-hidden"
        style={{
          background: 'rgba(255,255,255,0.97)',
          backdropFilter: 'blur(32px)',
          border: '1px solid rgba(255,255,255,0.90)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.18)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Color header band */}
        <div
          className="px-5 pt-5 pb-4"
          style={{ background: color.bg, borderBottom: `2px solid ${color.border}` }}
        >
          <div className="flex items-start justify-between">
            <div>
              <span
                className="inline-block px-2.5 py-1 rounded-xl text-[10px] font-black mb-2"
                style={{ background: 'rgba(255,255,255,0.70)', color: color.text }}
              >
                {entry.subjectCode}
              </span>
              <h2 className="text-[15px] font-black text-black/80 leading-snug">{entry.subjectName}</h2>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-black/30 hover:text-black/60 hover:bg-black/[0.06] transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Details */}
        <div className="px-5 py-4 space-y-3">
          <DetailRow icon={<User size={13} />} label="ครูผู้สอน" value={entry.teacherName} />
          {entry.room && <DetailRow icon={<MapPin size={13} />} label="ห้องเรียน" value={entry.room} />}
          {viewMode === 'teacher' && (
            <DetailRow icon={<BookOpen size={13} />} label="ห้องเรียน" value={entry.classId} />
          )}
        </div>

        {/* Attendance shortcut */}
        <div className="px-5 pb-5">
          <a
            href="/portal/attendance"
            onClick={onClose}
            className="flex items-center justify-between w-full px-4 py-3 rounded-2xl text-[11px] font-bold transition-all"
            style={{
              background: color.bg,
              border: `1px solid ${color.border}`,
              color: color.text,
            }}
          >
            <span>ไปยังระบบเช็กชื่อ</span>
            <ArrowRight size={13} />
          </a>
        </div>
      </motion.div>
    </motion.div>
  );
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="flex items-center gap-3">
      <div className="w-7 h-7 rounded-xl flex items-center justify-center text-black/30 bg-black/[0.04] shrink-0">
        {icon}
      </div>
      <div>
        <p className="text-[9px] text-black/30 font-bold uppercase tracking-wide leading-none">{label}</p>
        <p className="text-[12px] font-bold text-black/70 leading-tight mt-0.5">{value}</p>
      </div>
    </div>
  );
}
