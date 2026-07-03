import { useState, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Coffee, Timer, X, Check, PlusCircle, Clock, Pencil, Trash2, BookOpen, User, MapPin, ArrowRight, Users, Layout, AlertTriangle, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import {
  SCHOOL_DAYS, DAY_LABELS, DAY_SHORT,
  type SchoolDay, type ScheduleEntry,
} from '@/types/schedule';
import { useScheduleSettings, DEFAULT_SETTINGS } from '@/hooks/useScheduleSettings';
import { DEPARTMENT_CONFIG, type Department } from '@/types/curriculum';
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
import { db } from '@/lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';


// ── Current period detection ─────────────────────────────────────────────────
function parseTimeRange(timeStr: string): { startMin: number; endMin: number } | null {
  const parts = timeStr.split(' - ');
  if (parts.length < 2) return null;
  const [sh, sm] = parts[0].split(':').map(Number);
  const [eh, em] = parts[1].split(':').map(Number);
  if ([sh, sm, eh, em].some(isNaN)) return null;
  return { startMin: sh * 60 + sm, endMin: eh * 60 + em };
}

function useCurrentPeriod(periodTimes: Record<number, string>) {
  const [currentPeriod, setCurrentPeriod] = useState<number | null>(null);

  useEffect(() => {
    const check = () => {
      const now = new Date();
      const nowMin = now.getHours() * 60 + now.getMinutes();
      let found: number | null = null;
      for (const [k, v] of Object.entries(periodTimes)) {
        const range = parseTimeRange(v);
        if (range && nowMin >= range.startMin && nowMin < range.endMin) {
          found = Number(k);
          break;
        }
      }
      setCurrentPeriod(found);
    };
    check();
    const id = setInterval(check, 30_000);
    return () => clearInterval(id);
  }, [periodTimes]);

  return currentPeriod;
}

const MOBILE_DAY_LABELS: Record<SchoolDay, string> = {
  1: 'Mon',
  2: 'Tue',
  3: 'Wed',
  4: 'Thu',
  5: 'Fri',
};

// ── Types ─────────────────────────────────────────────────────────────────────
interface ScheduleGridProps {
  grid: Record<number, Record<number, ScheduleEntry[]>>;
  viewMode: 'class' | 'teacher';
  classId?: string;
  filterDept?: 'all' | 'early' | 'primary' | 'secondary';
  setFilterDept?: (v: 'all' | 'early' | 'primary' | 'secondary') => void;
  filterGrade?: string;
  setFilterGrade?: (v: string) => void;
  filteredClasses?: { id: string; gradeLevel: string; department: string; label: string }[];
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
  onClassSelect?: (classId: string) => void;
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
  mobileHeaderContent?: ReactNode;
  selectedTeacherId?: string;
  setSelectedTeacherId?: (id: string) => void;
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
      className: 'bg-amber-50 text-amber-700 border-amber-100',
      dotClassName: 'bg-amber-400',
    };
  }
  if (key === 'activity') {
    return {
      label: 'กิจกรรม',
      className: 'bg-violet-50 text-violet-700 border-violet-100',
      dotClassName: 'bg-violet-400',
    };
  }
  return {
    label: 'พื้นฐาน',
    className: 'bg-sky-50 text-sky-700 border-sky-100',
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

// ── Main Grid ─────────────────────────────────────────────────────────────────
export default function ScheduleGrid({
  grid: gridProp,
  viewMode,
  classId,
  filterDept = 'all',
  setFilterDept,
  filterGrade = 'all',
  setFilterGrade,
  filteredClasses,
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
  onClassSelect,
  mobileHeaderContent,
  selectedTeacherId = '',
  setSelectedTeacherId,
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

  const currentPeriod = useCurrentPeriod(displayPeriodTimes);
  const [detailEntry, setDetailEntry] = useState<ScheduleEntry | null>(null);
  const [mobileDay, setMobileDay] = useState<SchoolDay>(1);
  const [mobileSubjectPickerSlot, setMobileSubjectPickerSlot] = useState<{ day: SchoolDay; period: number } | null>(null);
  const longPressTimerRef = useRef<number | null>(null);

  const filterDepts = useMemo(() => {
    if (!allClasses) return [];
    return Array.from(new Set(allClasses.map(c => c.department))).sort();
  }, [allClasses]);

  const filterGrades = useMemo(() => {
    if (!allClasses) return [];
    const base = filterDept !== 'all' ? allClasses.filter(c => c.department === filterDept) : allClasses;
    return Array.from(new Set(base.map(c => c.gradeLevel))).sort();
  }, [allClasses, filterDept]);

  const filterClasses = useMemo(() => {
    const baseSource = filteredClasses && filteredClasses.length > 0 ? filteredClasses : (allClasses || []);
    let base = baseSource;
    if (filterDept !== 'all') base = base.filter(c => c.department === filterDept);
    if (filterGrade !== 'all') base = base.filter(c => c.gradeLevel === filterGrade);
    const seen = new Set<string>();
    return base.filter(c => { if (seen.has(c.id)) return false; seen.add(c.id); return true; });
  }, [allClasses, filteredClasses, filterDept, filterGrade]);

  const filterTeacherDepts = useMemo(() => {
    if (!teachers) return [];
    return Array.from(new Set(teachers.map(t => t.department).filter(Boolean))).sort();
  }, [teachers]);

  const filterTeachers = useMemo(() => {
    if (!teachers) return [];
    const base = filterDept !== 'all'
      ? teachers.filter(t => t.department === filterDept)
      : teachers;
    return [...base].sort((a, b) => a.name.localeCompare(b.name, 'th'));
  }, [teachers, filterDept]);

  const showClassFilter = viewMode === 'class' && !!allClasses && allClasses.length > 1;
  const showTeacherFilter = viewMode === 'teacher';

  const periods = Array.from({ length: effectivePeriodCount }, (_, i) => i + 1);
  const canEdit = !readOnly && (!!classId || viewMode === 'teacher');
  const isEditing = isEditMode && canEdit;
  const showSubjectCarousel = isEditing;
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
      setDetailEntry(entry);
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

  const startMobileLongPress = (day: SchoolDay, period: number, disabled: boolean) => {
    if (disabled) return;
    clearLongPressTimer();
    longPressTimerRef.current = window.setTimeout(() => {
      setMobileSubjectPickerSlot({ day, period });
      clearLongPressTimer();
    }, 450);
  };

  return (
    <>
      {showSubjectCarousel && (
        <div className="hidden md:block sticky top-0 z-30 mb-3 w-full overflow-hidden py-1 bg-white/80 backdrop-blur-sm rounded-xl shadow-sm">

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

      {/* Mobile: Sticky filter + day selector panels */}
      <div className="md:hidden sticky top-0 z-40 -mx-3 px-3 mb-2.5 pt-1 pb-2 bg-background">
        <div className="rounded-2xl border border-black/[0.06] bg-white/60 p-2.5 animate-in fade-in slide-in-from-top-2 duration-300">
          {mobileHeaderContent && (
            <div className="pb-2.5">
              {mobileHeaderContent}
            </div>
          )}

          {showClassFilter && (
            <div className={`px-0.5 pb-2.5 ${mobileHeaderContent ? 'border-t border-black/[0.06] pt-2.5' : ''}`}>
              <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2">
                {/* แผนก */}
                <div className="flex flex-col gap-1">
                  <div className="relative">
                    <select
                      value={filterDept}
                      onChange={e => {
                        const next = (e.target.value || 'all') as 'all' | 'early' | 'primary' | 'secondary';
                        setFilterDept?.(next);
                        setFilterGrade?.('all');
                      }}
                      className="w-full appearance-none rounded-xl border border-black/[0.08] bg-black/[0.03] px-2.5 py-2 pr-6 text-[11px] font-bold text-black/70 outline-none focus:border-blue-400 focus:bg-white transition-all cursor-pointer"
                    >
                      <option value="all">แผนก</option>
                      {filterDepts.map(dept => (
                        <option key={dept} value={dept}>
                          {DEPARTMENT_CONFIG[dept as Department]?.label ?? dept}
                        </option>
                      ))}
                    </select>
                    <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-black/30 text-[9px]">▾</span>
                  </div>
                </div>

                {/* ระดับชั้น */}
                <div className="flex flex-col gap-1">
                  <div className="relative">
                    <select
                      value={filterGrade}
                      onChange={e => setFilterGrade?.(e.target.value || 'all')}
                      disabled={filterGrades.length === 0}
                      className="w-full appearance-none rounded-xl border border-black/[0.08] bg-black/[0.03] px-2.5 py-2 pr-6 text-[11px] font-bold text-black/70 outline-none focus:border-indigo-400 focus:bg-white transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <option value="all">ระดับชั้น</option>
                      {filterGrades.map(grade => (
                        <option key={grade} value={grade}>{grade}</option>
                      ))}
                    </select>
                    <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-black/30 text-[9px]">▾</span>
                  </div>
                </div>

                {/* ห้อง */}
                <div className="flex flex-col gap-1">
                  <div className="relative">
                    <select
                      value={classId ?? ''}
                      onChange={e => { if (e.target.value) onClassSelect?.(e.target.value); }}
                      disabled={filterClasses.length === 0}
                      className="w-full appearance-none rounded-xl border border-black/[0.08] bg-black/[0.03] px-2.5 py-2 pr-6 text-[11px] font-bold text-black/70 outline-none focus:border-emerald-400 focus:bg-white transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <option value="">ห้อง</option>
                      {filterClasses.map(cls => (
                        <option key={cls.id} value={cls.id}>{cls.label}</option>
                      ))}
                    </select>
                    <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-black/30 text-[9px]">▾</span>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setFilterDept?.('all');
                    setFilterGrade?.('all');
                    onClassSelect?.('');
                  }}
                  className="h-full min-h-[38px] w-10 rounded-xl border border-black/[0.08] bg-black/[0.03] text-black/45 flex items-center justify-center hover:bg-black/[0.06] hover:text-black/65 transition-all"
                  title="ล้างฟิลเตอร์"
                >
                  <RotateCcw size={13} />
                </button>
              </div>
            </div>
          )}

          {showTeacherFilter && (
            <div className={`px-0.5 pb-2.5 ${mobileHeaderContent ? 'border-t border-black/[0.06] pt-2.5' : ''}`}>
              <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
                <div className="relative min-w-0">
                  <select
                    value={filterDept}
                    onChange={(e) => {
                      const next = (e.target.value || 'all') as 'all' | 'early' | 'primary' | 'secondary';
                      setFilterDept?.(next);
                      setSelectedTeacherId?.('');
                    }}
                    className="w-full appearance-none rounded-xl border border-black/[0.08] bg-black/[0.03] px-2.5 py-2 pr-6 text-[11px] font-bold text-black/70 outline-none focus:border-blue-400 focus:bg-white transition-all cursor-pointer"
                  >
                    <option value="all">แผนก</option>
                    {filterTeacherDepts.map((dept) => (
                      <option key={dept} value={dept}>
                        {DEPARTMENT_CONFIG[dept as Department]?.label ?? dept}
                      </option>
                    ))}
                  </select>
                  <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-black/30 text-[9px]">▾</span>
                </div>

                <div className="relative min-w-0">
                  <select
                    value={selectedTeacherId}
                    onChange={(e) => setSelectedTeacherId?.(e.target.value || '')}
                    disabled={filterDept === 'all'}
                    className="w-full appearance-none rounded-xl border border-black/[0.08] bg-black/[0.03] px-2.5 py-2 pr-6 text-[11px] font-bold text-black/70 outline-none focus:border-indigo-400 focus:bg-white transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <option value="">ครู</option>
                    {filterTeachers.map((teacher) => (
                      <option key={teacher.id} value={teacher.id}>
                        {teacher.name}
                      </option>
                    ))}
                  </select>
                  <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-black/30 text-[9px]">▾</span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setFilterDept?.('all');
                    setSelectedTeacherId?.('');
                  }}
                  className="h-full min-h-[38px] w-10 rounded-xl border border-black/[0.08] bg-black/[0.03] text-black/45 flex items-center justify-center hover:bg-black/[0.06] hover:text-black/65 transition-all shrink-0"
                  title="ล้างฟิลเตอร์"
                >
                  <RotateCcw size={13} />
                </button>
              </div>
            </div>
          )}

          {!shouldHideGrid && (
          <div id="schedule-day-selector-mobile" className={showClassFilter || showTeacherFilter ? 'border-t border-black/[0.06] pt-2.5' : ''}>
            <div className="grid grid-cols-5 gap-1 rounded-xl bg-black/[0.04] p-1">
              {SCHOOL_DAYS.map((day) => {
                const active = mobileDay === day;
                return (
                  <button
                    key={day}
                    onClick={() => setMobileDay(day)}
                    className={`h-9 rounded-lg text-xs font-black transition-all duration-200 ${
                      active
                        ? 'bg-blue-600 text-white shadow-md scale-[1.02]'
                        : 'text-black/55 hover:bg-white/50 active:scale-95'
                    }`}
                  >
                    {MOBILE_DAY_LABELS[day]}
                  </button>
                );
              })}
            </div>
          </div>
          )}
        </div>
      </div>

      {/* Mobile: Schedule List / Subject Picker */}
      <div className="md:hidden mb-4" id="schedule-grid-export-mobile">
        {shouldHideGrid ? (
          <div className="rounded-2xl border border-black/[0.08] bg-white/85 px-4 py-6 text-center">
            <p className="text-[12px] font-black text-red-600">{hideGridTitle}</p>
            <p className="mt-1 text-[10px] font-medium text-red-500">{hideGridHint}</p>
          </div>
        ) : mobileSubjectPickerSlot ? (
          <div className="space-y-2.5">
            <div className="rounded-2xl border border-black/[0.06] bg-white p-3 shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[12px] font-black text-black/80">เลือกรายวิชาที่ต้องการใส่</p>
                  <p className="mt-0.5 text-[10px] font-medium text-black/45">
                    {MOBILE_DAY_LABELS[mobileSubjectPickerSlot.day]} • คาบ {displayNumbers[mobileSubjectPickerSlot.period] ?? mobileSubjectPickerSlot.period}
                  </p>
                </div>
                <button
                  onClick={() => setMobileSubjectPickerSlot(null)}
                  className="h-8 px-3 rounded-lg text-[10px] font-black text-black/55 bg-black/[0.04] hover:bg-black/[0.07]"
                >
                  ยกเลิก
                </button>
              </div>
            </div>

            {draggableSubjects.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-rose-200 bg-white px-3 py-6 text-center text-[11px] font-bold text-rose-500/80">
                ยังไม่มีรายวิชาที่พร้อมเลือกในมุมมองนี้
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2.5">
                {draggableSubjects.map((subject) => {
                  const color = subjectColorByName(subject.name || subject.id, subject.subjectGroup);
                  const teacherId = subject.assignedTeacherId || dragTeacherId;
                  const badge = categoryBadgeStyle((subject as any).category);
                  const handleAdd = () => {
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
                      className="w-full rounded-xl p-3 flex items-center gap-3"
                      style={{
                        background: subjectGradient(color),
                        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.82), 0 12px 18px -18px ${withAlpha(color.accent, 0.58)}`,
                      }}
                    >
                      {/* Subject info (tappable) */}
                      <button onClick={handleAdd} className="flex-1 min-w-0 text-left">
                        <div className="mb-1.5 flex items-center gap-1 flex-wrap">
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
                          className="line-clamp-2 text-[11px] font-extrabold leading-snug text-white"
                          style={{ textShadow: '0 1px 2.5px rgba(0,0,0,0.45)' }}
                        >
                          {subject.name}
                        </p>
                      </button>

                      {/* + Add button */}
                      <button
                        onClick={handleAdd}
                        className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-transform active:scale-90"
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
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {periods.map((period) => {
          const isLunch = lunchPeriods.includes(period);
          const isBreak = breakPeriods.includes(period);
          const isAnyBreak = isLunch || isBreak;
          const isCurrent = currentPeriod === period && !isAnyBreak;
          const entries = grid[mobileDay]?.[period] ?? [];
          const isOver = dragOverSlot?.day === mobileDay && dragOverSlot?.period === period;

          return (
            <motion.div
              key={`mobile-${mobileDay}-${period}`}
              layoutId={`card-${mobileDay}-${period}`}
              className="rounded-2xl border overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.06)] transition-all duration-200"
              onTouchStart={() => startMobileLongPress(mobileDay, period, isAnyBreak)}
              onTouchEnd={clearLongPressTimer}
              onTouchCancel={clearLongPressTimer}
              onTouchMove={clearLongPressTimer}
              style={{
                background: isCurrent
                  ? 'rgba(251,191,36,0.07)'
                  : '#ffffff',
                borderColor: isCurrent
                  ? 'rgba(251,191,36,0.38)'
                  : isOver
                    ? '#2563eb'
                    : isEditing
                      ? 'rgba(225,29,72,0.18)'
                      : 'rgba(0,0,0,0.07)',
                outline: isOver ? '2px solid #2563eb' : undefined,
              }}
            >
              <div className="flex" style={{ minHeight: isAnyBreak ? 56 : 86 }}>
                {/* Left period column */}
                <div className={`w-14 shrink-0 flex flex-col items-center justify-center py-3 gap-0.5 border-r ${
                  isCurrent
                    ? 'bg-amber-50 border-amber-100'
                    : isLunch
                      ? 'bg-emerald-50 border-emerald-100'
                      : isBreak
                        ? 'bg-yellow-50 border-yellow-100'
                        : isEditing
                          ? 'bg-rose-50/40 border-rose-100/60'
                          : 'bg-black/[0.02] border-black/[0.04]'
                }`}>
                  {isLunch ? (
                    <Coffee size={15} className={isEditing ? 'text-rose-500' : 'text-emerald-600'} />
                  ) : isBreak ? (
                    <Timer size={13} className={isEditing ? 'text-rose-400' : 'text-yellow-600'} />
                  ) : (
                    <>
                      <span className={`text-lg font-black leading-none ${
                        isCurrent ? 'text-amber-700' : isEditing ? 'text-rose-600' : 'text-black/70'
                      }`}>
                        {displayNumbers[period]}
                      </span>
                      <span className={`text-[8px] font-bold leading-none mt-0.5 ${
                        isCurrent ? 'text-amber-500' : isEditing ? 'text-rose-400' : 'text-black/25'
                      }`}>
                        คาบ
                      </span>
                      {isCurrent && (
                        <span className="flex h-1.5 w-1.5 mt-1 relative">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500" />
                        </span>
                      )}
                    </>
                  )}
                </div>

                {/* Right content */}
                <div className="flex-1 flex flex-col p-3">
                  {/* Time row */}
                  <div className="flex items-center gap-1 text-[9px] font-bold text-black/38 mb-2">
                    <Clock size={9} />
                    <span>{displayPeriodTimes[period]}</span>
                  </div>

                  {/* Content */}
                  {isLunch ? (
                    <div
                      className="flex-1 rounded-xl flex items-center justify-center gap-2 text-[10px] font-black text-white uppercase tracking-wider py-2"
                      style={{
                        background: restGradient(isEditing),
                        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3)',
                      }}
                    >
                      <Coffee size={13} className="text-white animate-bounce" />
                      <span>LUNCH BREAK</span>
                    </div>
                  ) : isBreak ? (
                    <div
                      className="flex-1 rounded-xl flex items-center justify-center gap-2 text-[10px] font-black text-white uppercase tracking-wider py-2"
                      style={{
                        background: restGradient(isEditing),
                        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3)',
                      }}
                    >
                      <Timer size={12} className="text-white animate-pulse" />
                      <span>BREAK</span>
                    </div>
                  ) : (
                    <div
                      className="flex-1 rounded-xl overflow-hidden"
                      style={{ minHeight: 56 }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        if (dragOverSlot?.day !== mobileDay || dragOverSlot?.period !== period) {
                          setDragOverSlot({ day: mobileDay, period });
                        }
                      }}
                      onDragLeave={() => setDragOverSlot(null)}
                      onTouchMove={(touchE) => {
                        if (touchDragData) {
                          const rect = touchE.currentTarget.getBoundingClientRect();
                          const touch = touchE.touches[0];
                          const isInside = touch.clientX >= rect.left && touch.clientX <= rect.right &&
                                          touch.clientY >= rect.top && touch.clientY <= rect.bottom;
                          if (isInside && (dragOverSlot?.day !== mobileDay || dragOverSlot?.period !== period)) {
                            setDragOverSlot({ day: mobileDay, period });
                          } else if (!isInside) {
                            setDragOverSlot(null);
                          }
                        }
                      }}
                      onDrop={(dropE) => {
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
                      }}
                      onTouchEnd={() => {
                        if (touchDragData && dragOverSlot?.day === mobileDay && dragOverSlot?.period === period) {
                          if (!isEditMode) {
                            toast.error('กรุณาเปิดโหมดแก้ไขก่อนแล้วจึงลากวิชา', {
                              description: 'คลิกปุ่มแก้ไข (Edit) ที่หัวตารางเพื่อเปิดโหมด',
                            });
                            setTouchDragData(null);
                            setDragOverSlot(null);
                            return;
                          }
                          onDropSubject?.(mobileDay, period, touchDragData.subjectId, touchDragData.teacherId, touchDragData.classId || undefined);
                        }
                        setTouchDragData(null);
                        setDragOverSlot(null);
                      }}
                    >
                      <SlotCell
                        entries={entries}
                        viewMode={viewMode}
                        readOnly={!canEdit}
                        isCurrent={isCurrent}
                        allClasses={allClasses}
                        excessEntryIds={excessEntryIds}
                        teachers={teachers}
                        jointClassEntryIds={jointClassEntryIds}
                        jointClassPartnersByEntryId={jointClassPartnersByEntryId}
                        onClick={(e) => handleSlotClick(mobileDay, period, e)}
                        onDelete={(id) => onDeleteEntry(id)}
                      />
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
            );
          })}
          </div>
        )}
      </div>

      <div className="hidden md:block overflow-x-auto pb-1" id="schedule-grid-export">
        {shouldHideGrid ? (
          <div className="rounded-2xl border border-black/[0.08] bg-white/85 px-5 py-8 text-center">
            <p className="text-[13px] font-black text-red-600">{hideGridTitle}</p>
            <p className="mt-1 text-[11px] font-medium text-red-500">{hideGridHint}</p>
          </div>
        ) : (
        <div
          className="rounded-2xl overflow-hidden"
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
                <p className={`text-[12px] font-black hidden md:block ${isEditing ? 'text-rose-600' : 'text-blue-700/90'}`}>{DAY_LABELS[day]}</p>
                <p className={`text-[12px] font-black md:hidden ${isEditing ? 'text-rose-600' : 'text-blue-700/90'}`}>{DAY_SHORT[day]}</p>
              </div>
            ))}
          </div>

          {/* ── Period rows ── */}
          {periods.map((period) => {
            const isLunch = lunchPeriods.includes(period);
            const isBreak = breakPeriods.includes(period);
            const isAnyBreak = isLunch || isBreak;
            const isCurrent = currentPeriod === period && !isAnyBreak;

            return (
              <div
                key={period}
                className="grid group/row transition-all duration-300 overflow-hidden"
                style={{
                  gridTemplateColumns: `${canEdit ? 90 : 76}px repeat(5, minmax(0, 1fr))`,
                  minHeight: canEdit ? 80 : (isAnyBreak ? 36 : 70),
                  borderTop: `1px solid ${isEditing ? 'rgba(225,29,72,0.2)' : 'rgba(0,0,0,0.06)'}`,
                  background: isCurrent
                    ? 'rgba(251,191,36,0.06)'
                    : isLunch
                      ? 'rgba(16,185,129,0.04)'
                      : isBreak
                        ? 'rgba(234,179,8,0.04)'
                        : undefined,
                  outline: isCurrent ? '2px solid rgba(251,191,36,0.30)' : undefined,
                  outlineOffset: '-1px',
                }}
              >
                <PeriodLabel
                  period={period}
                  displayNum={displayNumbers[period]}
                  isLunch={isLunch}
                  isBreak={isBreak}
                  isCurrent={isCurrent}
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
                      className="w-full h-full rounded-xl flex items-center justify-center gap-2"
                      style={{ 
                        background: restGradient(isEditing),
                        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.34)',
                      }}
                    >
                      <Coffee size={14} className="text-white" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-white">พักกลางวัน — Lunch Break</span>
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
                          isCurrent={isCurrent}
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
  isCurrent,
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
  isCurrent: boolean;
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
            background: isCurrent
              ? 'rgba(251,191,36,0.15)'
              : isLunch
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
              <span className={`text-[11px] font-black leading-none ${isCurrent ? 'text-amber-700' : isEditing ? 'text-rose-700' : 'text-black/85'}`}>
                {displayNum ?? period}
              </span>
              {isCurrent && (
                <span className="text-[7px] font-black text-amber-600 uppercase tracking-tight leading-none mt-0.5">
                  ●NOW
                </span>
              )}
              <span className={`text-[9px] text-center font-bold leading-none mt-1 ${
                isCurrent ? 'text-amber-600' : isEditing ? 'text-rose-600' : 'text-black/60'
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
function SlotCell({
  entries,
  viewMode,
  readOnly,
  isCurrent,
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
  isCurrent?: boolean;
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
    const color = subjectColorByName(entry.subjectName || entry.subjectId, entry.subjectGroup);
    const isExcess = entries.some((e) => excessEntryIds?.has(e.id));
    const roomLabels = formatClassLabels(
      entries.map((e) => e.classId),
      allClasses,
    );

    return (
      <AnimatePresence mode="wait">
        <motion.div
          key={`joint-${entry.id}`}
          initial={{ opacity: 0, scale: 0.93 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.93 }}
          transition={{ duration: 0.13 }}
          className="group relative w-full h-full overflow-hidden rounded-xl p-2.5 cursor-pointer transition-all duration-150 flex flex-col justify-between"
          style={{
            background: subjectGradient(color, isCurrent),
            minHeight: 70,
            boxShadow: isExcess
              ? '0 0 0 2px rgba(245,158,11,0.18)'
              : isCurrent
              ? `0 0 0 2px ${withAlpha(color.accent, 0.26)}, inset 0 1px 0 rgba(255,255,255,0.42), 0 12px 20px -18px ${withAlpha(color.accent, 0.68)}`
              : `inset 0 1px 0 rgba(255,255,255,0.34), 0 12px 20px -18px ${withAlpha(color.accent, 0.52)}`,
          }}
          onClick={() => onClick(entry)}
          draggable={!readOnly}
          onDragStartCapture={(e) => {
            if (readOnly) return;
            e.dataTransfer.setData('text/plain', entry.id);
            e.dataTransfer.effectAllowed = 'move';
          }}
        >
          <div className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-white/22 px-1.5 py-0.5 text-[8px] font-black text-white shadow-sm backdrop-blur-sm">
            <Users size={9} />
            เรียนรวม
          </div>
          {isExcess && (
            <div className="absolute right-2 top-8 inline-flex items-center gap-1 rounded-full bg-amber-500 px-1.5 py-0.5 text-[8px] font-black text-white shadow-sm">
              <AlertTriangle size={9} />
              เกิน
            </div>
          )}
          <div className="select-none flex items-start justify-between gap-1.5 w-full flex-1 pt-4">
            <div className="min-w-0 flex-1">
              <p
                className="text-[9px] font-black leading-none mb-1 text-white"
                style={{ textShadow: '0 1px 2px rgba(0,0,0,0.4)' }}
              >
                {entry.subjectCode}
              </p>
              <p
                className="text-[10.5px] font-extrabold text-white leading-tight line-clamp-2"
                style={{ textShadow: '0 1px 2.5px rgba(0,0,0,0.45)' }}
              >
                {entry.subjectName}
              </p>
              <p
                className="text-[8.5px] font-bold text-white/90 mt-1 leading-tight line-clamp-2"
                style={{ textShadow: '0 1px 2px rgba(0,0,0,0.4)' }}
              >
                {viewMode === 'teacher' ? `ห้อง ${roomLabels}` : `กับ ${formatClassLabels(
                  jointClassPartnersByEntryId?.get(entry.id) ?? entries.slice(1).map((e) => e.classId),
                  allClasses,
                )}`}
              </p>
            </div>
            {viewMode === 'class' && (
              <div className="shrink-0 text-right flex items-center gap-2 self-end mb-0.5 pl-1.5">
                <span
                  className="text-[8.5px] font-bold text-white leading-tight whitespace-nowrap block"
                  style={{ textShadow: '0 1px 2px rgba(0,0,0,0.4)' }}
                >
                  {entry.teacherName || '-'}
                </span>
              </div>
            )}
          </div>
          <div className="absolute left-2 bottom-2 flex items-center gap-1 z-10">
            {!readOnly && (
              <button
                onClick={(e) => { e.stopPropagation(); onClick(entry); }}
                className="w-6 h-6 rounded-lg flex items-center justify-center text-white/90 hover:text-white transition-colors bg-black/25 hover:bg-black/40 active:bg-black/50 backdrop-blur-md shadow-sm"
                title="แก้ไข"
              >
                <Pencil size={11} />
              </button>
            )}
            {!readOnly && onDelete && (
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(entry.id); }}
                className="w-6 h-6 rounded-lg flex items-center justify-center text-white/90 hover:text-white transition-colors bg-black/25 hover:bg-black/40 active:bg-black/50 backdrop-blur-md shadow-sm"
                title="ลบ"
              >
                <Trash2 size={11} />
              </button>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    );
  }

  // If there's only one entry, keep the original look
  if (entries.length === 1) {
    const entry = entries[0];
    const color = subjectColorByName(entry.subjectName || entry.subjectId, entry.subjectGroup);
    const isExcess = excessEntryIds?.has(entry.id) ?? false;
    const isJoint = jointClassEntryIds?.has(entry.id) ?? false;
    const partnerLabels = isJoint
      ? formatClassLabels(jointClassPartnersByEntryId?.get(entry.id) ?? [], allClasses)
      : '';

    return (
      <AnimatePresence mode="wait">
        <motion.div
          key={entry.id}
          initial={{ opacity: 0, scale: 0.93 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.93 }}
          transition={{ duration: 0.13 }}
          className="group relative w-full h-full overflow-hidden rounded-xl p-2.5 cursor-pointer transition-all duration-150 flex flex-col justify-between"
          style={{
            background: subjectGradient(color, isCurrent),
            minHeight: 70,
            boxShadow: isExcess
              ? '0 0 0 2px rgba(245,158,11,0.18)'
              : isCurrent
              ? `0 0 0 2px ${withAlpha(color.accent, 0.26)}, inset 0 1px 0 rgba(255,255,255,0.42), 0 12px 20px -18px ${withAlpha(color.accent, 0.68)}`
              : `inset 0 1px 0 rgba(255,255,255,0.34), 0 12px 20px -18px ${withAlpha(color.accent, 0.52)}`,
          }}
          onClick={() => onClick(entry)}
          draggable={!readOnly}
          onDragStartCapture={(e) => {
            if (readOnly) return;
            e.dataTransfer.setData('text/plain', entry.id);
            e.dataTransfer.effectAllowed = 'move';
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
          {isExcess && (
            <div className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-amber-500 px-1.5 py-0.5 text-[8px] font-black text-white shadow-sm">
              <AlertTriangle size={9} />
              เกิน
            </div>
          )}
          {isJoint && !isExcess && (
            <div className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-white/22 px-1.5 py-0.5 text-[8px] font-black text-white shadow-sm backdrop-blur-sm">
              <Users size={9} />
              เรียนรวม
            </div>
          )}
          {isJoint && isExcess && (
            <div className="absolute right-2 top-8 inline-flex items-center gap-1 rounded-full bg-white/22 px-1.5 py-0.5 text-[8px] font-black text-white shadow-sm backdrop-blur-sm">
              <Users size={9} />
              เรียนรวม
            </div>
          )}
          <div className="select-none flex items-start justify-between gap-1.5 w-full flex-1">
            <div className="min-w-0 flex-1">
              <p
                className="text-[9px] font-black leading-none mb-1 text-white"
                style={{ textShadow: '0 1px 2px rgba(0,0,0,0.4)' }}
              >
                {entry.subjectCode}
              </p>
              <p
                className="text-[10.5px] font-extrabold text-white leading-tight line-clamp-2"
                style={{ textShadow: '0 1px 2.5px rgba(0,0,0,0.45)' }}
              >
                {entry.subjectName}
              </p>
              {isJoint && partnerLabels && (
                <p
                  className="text-[8px] font-bold text-white/85 mt-0.5 leading-tight line-clamp-1"
                  style={{ textShadow: '0 1px 2px rgba(0,0,0,0.4)' }}
                >
                  กับ {partnerLabels}
                </p>
              )}
            </div>
            
            <div className="shrink-0 text-right flex items-center gap-2 self-end mb-0.5 pl-1.5">
              {viewMode === 'class' ? (
                (() => {
                  const parts = entry.teacherName ? entry.teacherName.trim().split(/\s+/) : [];
                  const teacherObj = teachers?.find(t => t.id === entry.teacherId || t.name === entry.teacherName);
                  const avatarUrl = teacherObj?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${entry.teacherId || entry.teacherName || 'teacher'}`;

                  if (parts.length >= 2) {
                    const firstName = parts.slice(0, -1).join(' ');
                    const lastName = parts[parts.length - 1];
                    return (
                      <>
                        <div className="flex flex-col items-end leading-tight">
                          <span 
                            className="text-[8.5px] font-bold text-white leading-tight whitespace-nowrap block"
                            style={{ textShadow: '0 1px 2px rgba(0,0,0,0.4)' }}
                          >
                            {firstName}
                          </span>
                          <span 
                            className="text-[8.5px] font-bold text-white/90 leading-tight whitespace-nowrap block"
                            style={{ textShadow: '0 1px 2px rgba(0,0,0,0.4)' }}
                          >
                            {lastName}
                          </span>
                        </div>
                        <img 
                          src={avatarUrl} 
                          alt={entry.teacherName}
                          className="w-7 h-7 rounded-full object-cover border border-white/40 shadow-sm shrink-0" 
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${entry.teacherId || entry.teacherName || 'teacher'}`;
                          }}
                        />
                      </>
                    );
                  }
                  return (
                    <>
                      <span 
                        className="text-[8.5px] font-bold text-white leading-tight whitespace-nowrap block"
                        style={{ textShadow: '0 1px 2px rgba(0,0,0,0.4)' }}
                      >
                        {entry.teacherName || '-'}
                      </span>
                      <img 
                        src={avatarUrl} 
                        alt={entry.teacherName}
                        className="w-7 h-7 rounded-full object-cover border border-white/40 shadow-sm shrink-0" 
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${entry.teacherId || entry.teacherName || 'teacher'}`;
                        }}
                      />
                    </>
                  );
                })()
              ) : (
                <span 
                  className="text-[8.5px] font-bold text-white leading-tight whitespace-nowrap block"
                  style={{ textShadow: '0 1px 2px rgba(0,0,0,0.4)' }}
                >
                  {`ห้อง ${allClasses?.find(c => c.id === entry.classId)?.label || entry.classId}`}
                </span>
              )}
            </div>
          </div>

          <div className="absolute left-2 bottom-2 flex items-center gap-1 z-10">
            {!readOnly && (
              <button
                onClick={(e) => { e.stopPropagation(); onClick(entry); }}
                className="w-6 h-6 rounded-lg flex items-center justify-center text-white/90 hover:text-white transition-colors bg-black/25 hover:bg-black/40 active:bg-black/50 backdrop-blur-md shadow-sm"
                title="แก้ไข"
              >
                <Pencil size={11} />
              </button>
            )}
            {!readOnly && onDelete && (
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(entry.id); }}
                className="w-6 h-6 rounded-lg flex items-center justify-center text-white/90 hover:text-white transition-colors bg-black/25 hover:bg-black/40 active:bg-black/50 backdrop-blur-md shadow-sm"
                title="ลบ"
              >
                <Trash2 size={11} />
              </button>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    );
  }

  // For multiple entries (Joint Classes), show a special stacked view
  return (
    <div className="w-full h-full min-h-[70px] flex flex-col gap-1">
      {entries.map(entry => {
        const color = subjectColorByName(entry.subjectName || entry.subjectId, entry.subjectGroup);
        const isExcess = excessEntryIds?.has(entry.id) ?? false;
        return (
          <div
            key={entry.id}
            className="group relative flex-1 rounded-lg p-1.5 cursor-pointer transition-all"
            style={{
              background: subjectGradient(color),
              boxShadow: isExcess
                ? 'inset 0 0 0 1px rgba(245,158,11,0.14), inset 0 1px 0 rgba(255,255,255,0.78)'
                : `inset 0 1px 0 rgba(255,255,255,0.76), 0 8px 16px -16px ${withAlpha(color.accent, 0.52)}`,
            }}
            onClick={() => onClick(entry)}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p
                  className="text-[8px] font-black leading-none mb-0.5 text-white"
                  style={{ textShadow: '0 1px 2px rgba(0,0,0,0.4)' }}
                >
                  {entry.subjectCode}
                </p>
                <p
                  className="text-[9px] font-extrabold text-white leading-tight line-clamp-1"
                  style={{ textShadow: '0 1px 2px rgba(0,0,0,0.45)' }}
                >
                  {entry.subjectName}
                </p>
                <p
                  className="text-[8px] font-bold text-white mt-0.5 leading-none truncate"
                  style={{ textShadow: '0 1px 2px rgba(0,0,0,0.4)' }}
                >
                  {viewMode === 'class'
                    ? entry.teacherName
                    : `ห้อง ${allClasses?.find(c => c.id === entry.classId)?.label || entry.classId}`}
                </p>
              </div>
              {isExcess && (
                <div className="shrink-0 inline-flex items-center justify-center rounded-full bg-amber-500 p-1 text-white shadow-sm">
                  <AlertTriangle size={9} />
                </div>
              )}
              <div className="flex items-center gap-0.5">
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete?.(entry.id); }}
                  className="p-1.5 rounded-md text-white/90 hover:text-white bg-black/20 hover:bg-black/30 transition-all backdrop-blur-md shadow-sm"
                  title="ลบ"
                >
                  <X size={10} strokeWidth={3} />
                </button>
              </div>
            </div>
          </div>
        );
      })}
      {!readOnly && (
        <button
          onClick={() => onClick()}
          className="w-full py-1 rounded-lg border border-dashed border-black/10 flex items-center justify-center text-black/20 hover:text-black/40 hover:bg-black/5 transition-all"
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
