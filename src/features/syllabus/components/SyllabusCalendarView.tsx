import { useState, useMemo, useCallback } from 'react';
import {
  format, addMonths, subMonths, startOfMonth, endOfMonth,
  startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth,
  isToday, parseISO,
} from 'date-fns';
import { th } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Sun, AlertTriangle, BookOpen, PenLine } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import type { WeeklyPlan, TeachingWeekInfo } from '@/types/syllabus';
import type { CalendarEvent } from '@/types/calendar';
import type { SchoolDay } from '@/types/schedule';

// ── Types ─────────────────────────────────────────────────────────────────────

interface SyllabusCalendarViewProps {
  weeklyPlan:       WeeklyPlan[];
  teachingWeekInfo: TeachingWeekInfo;
  semesterStart:    string;          // YYYY-MM-DD
  semesterEnd:      string;          // YYYY-MM-DD
  calendarEvents:   CalendarEvent[]; // วันหยุด + สอบ
  teachingDays:     SchoolDay[];     // วันในสัปดาห์ที่สอนวิชานี้ (1=จ. … 5=ศ.)
  deptColor:        string;          // สีตาม department ของวิชา
  deptBg:           string;
  readOnly?:        boolean;
  onUpdateWeek:     (week: number, data: Partial<WeeklyPlan>) => void;
}

const DAY_HEADERS = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'] as const;

// ── Utils ─────────────────────────────────────────────────────────────────────

/** วันจันทร์ของสัปดาห์ที่ date อยู่ (ISO week start) */
function getMondayOfWeek(date: Date): Date {
  const d = new Date(date);
  const dow = d.getDay(); // 0=อา 1=จ...
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + diff);
  return d;
}

/** YYYY-MM-DD → Date */
function parseDate(str: string) { return parseISO(str); }

/** Date → YYYY-MM-DD */
function toStr(d: Date) { return format(d, 'yyyy-MM-dd'); }

// ── Hook: build week map ──────────────────────────────────────────────────────
// weekKey (YYYY-MM-DD ของจันทร์) → { weekNum, plan, isHoliday, isExam }

function useWeekMap(
  semesterStart: string,
  semesterEnd: string,
  weeklyPlan: WeeklyPlan[],
  calendarEvents: CalendarEvent[],
) {
  return useMemo(() => {
    const holidays = calendarEvents.filter(e => e.type === 'holiday');
    const exams    = calendarEvents.filter(e => e.type === 'exam');
    const start    = parseDate(semesterStart);
    const end      = parseDate(semesterEnd);

    // สร้าง array ของสัปดาห์ทั้งหมดใน semester
    const weekKeys: string[] = [];
    const cursor = getMondayOfWeek(start);
    while (cursor <= end) {
      weekKeys.push(toStr(cursor));
      cursor.setDate(cursor.getDate() + 7);
    }

    const map: Record<string, {
      weekNum:   number;
      plan:      WeeklyPlan | null;
      isHoliday: boolean;
      isExam:    boolean;
      weekEnd:   string; // ศุกร์ของสัปดาห์นั้น
    }> = {};

    weekKeys.forEach((mondayStr, idx) => {
      const monday  = parseDate(mondayStr);
      const friday  = new Date(monday);
      friday.setDate(friday.getDate() + 4);
      const fridayStr = toStr(friday);

      const isHoliday = holidays.some(h => h.startDate <= fridayStr && h.endDate >= mondayStr);
      const isExam    = exams.some(e => e.startDate <= fridayStr && e.endDate >= mondayStr);

      map[mondayStr] = {
        weekNum:   idx + 1,
        plan:      weeklyPlan[idx] ?? null,
        isHoliday,
        isExam,
        weekEnd:   fridayStr,
      };
    });

    return map;
  }, [semesterStart, semesterEnd, weeklyPlan, calendarEvents]);
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function SyllabusCalendarView({
  weeklyPlan,
  teachingWeekInfo,
  semesterStart,
  semesterEnd,
  calendarEvents,
  teachingDays,
  deptColor,
  deptBg,
  readOnly,
  onUpdateWeek,
}: SyllabusCalendarViewProps) {
  // เริ่มแสดงเดือนแรกของ semester
  const [currentMonth, setCurrentMonth] = useState(() => parseDate(semesterStart));
  const [selectedMondayStr, setSelectedMondayStr] = useState<string | null>(null);

  const weekMap = useWeekMap(semesterStart, semesterEnd, weeklyPlan, calendarEvents);

  // วันทั้งหมดในปฏิทินเดือนนี้ (รวม padding ต้น-ท้าย)
  const calendarDays = useMemo(() => {
    const first = startOfMonth(currentMonth);
    const last  = endOfMonth(currentMonth);
    return eachDayOfInterval({
      start: startOfWeek(first, { weekStartsOn: 0 }),
      end:   endOfWeek(last,   { weekStartsOn: 0 }),
    });
  }, [currentMonth]);

  // ข้อมูลของสัปดาห์ที่เลือก
  const selectedWeekData = selectedMondayStr ? weekMap[selectedMondayStr] ?? null : null;

  // ช่วง semester
  const semStart = parseDate(semesterStart);
  const semEnd   = parseDate(semesterEnd);

  // SchoolDay (1-5) → day.getDay() (0=อา 1=จ...6=ส)
  // SchoolDay 1=จ → getDay() 1
  const teachingDowSet = useMemo(
    () => new Set(teachingDays.map(sd => sd)), // sd 1-5 === Date.getDay() 1-5
    [teachingDays],
  );

  const isTaughtDay = useCallback((date: Date) => {
    const dow = date.getDay(); // 0=อา 1=จ...
    return dow >= 1 && dow <= 5 && teachingDowSet.has(dow as SchoolDay);
  }, [teachingDowSet]);

  const handleDayClick = (date: Date) => {
    const dow = date.getDay();
    if (dow === 0 || dow === 6) return; // weekend — ignore
    const monday = getMondayOfWeek(date);
    const mondayStr = toStr(monday);
    if (!weekMap[mondayStr]) return; // ไม่ใช่สัปดาห์ใน semester
    setSelectedMondayStr(prev => prev === mondayStr ? null : mondayStr);
  };

  // ย้ายเดือน (จำกัดภายใน semester)
  const canGoPrev = currentMonth > semStart;
  const canGoNext = endOfMonth(currentMonth) < semEnd;

  const prevMonth = () => {
    if (canGoPrev) setCurrentMonth(m => subMonths(m, 1));
  };
  const nextMonth = () => {
    if (canGoNext) setCurrentMonth(m => addMonths(m, 1));
  };

  // สรุปสัปดาห์สอน
  const { effectiveTeachingWeeks, holidayWeeks, examWeeks } = teachingWeekInfo;

  return (
    <div className="space-y-3">
      {/* ── Summary chips ── */}
      <div className="flex flex-wrap gap-2 px-1">
        <SummaryChip color="#10b981" label={`${effectiveTeachingWeeks} สัปดาห์สอน`} />
        {holidayWeeks > 0 && <SummaryChip color="#ef4444" label={`${holidayWeeks} สัปดาห์วันหยุด`} />}
        {examWeeks > 0 && <SummaryChip color="#f97316" label={`${examWeeks} สัปดาห์สอบ`} />}
        {teachingDays.length > 0 && (
          <SummaryChip
            color={deptColor}
            label={`สอนวัน${teachingDays.map(d => ['', 'จ', 'อ', 'พ', 'พฤ', 'ศ'][d]).join('/')} `}
          />
        )}
        {teachingDays.length === 0 && (
          <SummaryChip color="#6b7280" label="ยังไม่มีตารางสอนในระบบ" />
        )}
      </div>

      {/* ── Calendar card ── */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: 'rgba(255,255,255,0.80)',
          backdropFilter: 'blur(24px)',
          border: '1px solid rgba(255,255,255,0.90)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
        }}
      >
        {/* Month nav */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-black/[0.05]">
          <button
            onClick={prevMonth}
            disabled={!canGoPrev}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-black/40 hover:bg-black/05 disabled:opacity-20 transition-colors"
          >
            <ChevronLeft size={16} />
          </button>

          <div className="text-center">
            <p className="text-sm font-bold text-black/75">
              {format(currentMonth, 'MMMM', { locale: th })}{' '}
              {currentMonth.getFullYear() + 543}
            </p>
            <p className="text-[10px] text-black/35 mt-0.5">
              ภาคเรียน {format(parseDate(semesterStart), 'd MMM', { locale: th })} – {format(parseDate(semesterEnd), 'd MMM', { locale: th })}
            </p>
          </div>

          <button
            onClick={nextMonth}
            disabled={!canGoNext}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-black/40 hover:bg-black/05 disabled:opacity-20 transition-colors"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Day-of-week headers */}
        <div className="grid grid-cols-7 px-3 pt-3 pb-1">
          {DAY_HEADERS.map((d, i) => (
            <div
              key={d}
              className="text-center text-[10px] font-bold pb-1"
              style={{ color: i === 0 ? '#ef4444' : i === 6 ? '#3b82f6' : 'rgba(0,0,0,0.30)' }}
            >
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7 gap-0.5 px-3 pb-4">
          {calendarDays.map(day => {
            const dateStr   = toStr(day);
            const inMonth   = isSameMonth(day, currentMonth);
            const inSem     = day >= semStart && day <= semEnd;
            const dow       = day.getDay(); // 0=อา
            const isWeekend = dow === 0 || dow === 6;
            const todayDay  = isToday(day);

            const mondayStr = inSem && !isWeekend ? toStr(getMondayOfWeek(day)) : null;
            const weekData  = mondayStr ? weekMap[mondayStr] ?? null : null;
            const isSelected = selectedMondayStr === mondayStr && mondayStr !== null;
            const isTaught  = inSem && !isWeekend && isTaughtDay(day) && weekData && !weekData.isHoliday && !weekData.isExam;

            // topic preview (max 12 chars)
            const topicPreview = weekData?.plan?.topic?.trim()
              ? weekData.plan.topic.length > 12
                ? weekData.plan.topic.slice(0, 12) + '…'
                : weekData.plan.topic
              : null;

            return (
              <button
                key={dateStr}
                onClick={() => inSem && !isWeekend && handleDayClick(day)}
                disabled={isWeekend || !inSem}
                className="relative flex flex-col items-center py-1 rounded-xl transition-all min-h-[56px] group"
                style={{
                  background: isSelected
                    ? deptBg
                    : weekData?.isExam && inSem
                    ? 'rgba(249,115,22,0.07)'
                    : weekData?.isHoliday && inSem
                    ? 'rgba(239,68,68,0.07)'
                    : 'transparent',
                  cursor: isWeekend || !inSem ? 'default' : 'pointer',
                  border: isSelected ? `1.5px solid ${deptColor}40` : '1.5px solid transparent',
                }}
                onMouseEnter={e => {
                  if (!isSelected && inSem && !isWeekend)
                    (e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.04)';
                }}
                onMouseLeave={e => {
                  if (!isSelected)
                    (e.currentTarget as HTMLElement).style.background = isSelected ? deptBg
                      : weekData?.isExam && inSem ? 'rgba(249,115,22,0.07)'
                      : weekData?.isHoliday && inSem ? 'rgba(239,68,68,0.07)'
                      : 'transparent';
                }}
              >
                {/* Date number */}
                <span
                  className="w-6 h-6 flex items-center justify-center rounded-full text-[11px] font-semibold transition-all mt-0.5"
                  style={{
                    background: todayDay
                      ? 'linear-gradient(135deg,#7c3aed,#4f46e5)'
                      : isTaught && !isSelected
                      ? deptBg
                      : 'transparent',
                    boxShadow: todayDay ? '0 0 10px #7c3aed50' : 'none',
                    color: todayDay
                      ? '#fff'
                      : !inMonth || !inSem
                      ? 'rgba(0,0,0,0.15)'
                      : weekData?.isHoliday
                      ? '#ef4444'
                      : weekData?.isExam
                      ? '#f97316'
                      : dow === 0 ? '#ef444480'
                      : dow === 6 ? '#3b82f680'
                      : isTaught
                      ? deptColor
                      : 'rgba(0,0,0,0.60)',
                    fontWeight: isTaught ? 700 : 600,
                  }}
                >
                  {day.getDate()}
                </span>

                {/* Teaching dot */}
                {isTaught && (
                  <span
                    className="w-1.5 h-1.5 rounded-full mt-0.5"
                    style={{ background: deptColor }}
                  />
                )}

                {/* Holiday / exam icon */}
                {weekData?.isHoliday && inSem && !isWeekend && dow === 1 && (
                  <Sun size={9} className="text-red-400 mt-0.5" />
                )}
                {weekData?.isExam && inSem && !isWeekend && dow === 1 && (
                  <AlertTriangle size={9} className="text-orange-400 mt-0.5" />
                )}

                {/* Topic preview — only on Monday, only if has topic */}
                {dow === 1 && topicPreview && inSem && !weekData?.isHoliday && !weekData?.isExam && (
                  <span
                    className="text-[8px] leading-tight mt-0.5 text-center px-0.5 max-w-[44px] truncate"
                    style={{ color: deptColor + 'cc' }}
                  >
                    {topicPreview}
                  </span>
                )}

                {/* Week number badge — only on Monday */}
                {dow === 1 && weekData && inSem && (
                  <span
                    className="absolute top-0.5 right-0.5 text-[8px] font-bold rounded px-0.5"
                    style={{ color: 'rgba(0,0,0,0.20)' }}
                  >
                    ส{weekData.weekNum}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-3 px-5 pb-4 border-t border-black/[0.04] pt-3">
          <LegendItem color={deptColor} bg={deptBg} label="วันที่สอนวิชานี้" />
          <LegendItem color="#ef4444" bg="rgba(239,68,68,0.08)" label="สัปดาห์วันหยุด" />
          <LegendItem color="#f97316" bg="rgba(249,115,22,0.08)" label="สัปดาห์สอบ" />
          <LegendItem color="#7c3aed" bg="rgba(124,58,237,0.10)" label="วันนี้" dot />
        </div>
      </div>

      {/* ── Week Editor Panel ── */}
      {selectedWeekData && (
        <WeekEditorPanel
          weekNum={selectedWeekData.weekNum}
          plan={selectedWeekData.plan}
          isHoliday={selectedWeekData.isHoliday}
          isExam={selectedWeekData.isExam}
          deptColor={deptColor}
          deptBg={deptBg}
          readOnly={readOnly}
          onClose={() => setSelectedMondayStr(null)}
          onUpdate={data => onUpdateWeek(selectedWeekData.weekNum, data)}
        />
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function SummaryChip({ color, label }: { color: string; label: string }) {
  return (
    <span
      className="text-[10px] font-semibold px-2.5 py-1 rounded-lg"
      style={{ background: `${color}15`, color }}
    >
      {label}
    </span>
  );
}

function LegendItem({ color, bg, label, dot }: {
  color: string; bg: string; label: string; dot?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <div
        className="w-4 h-4 rounded-md flex items-center justify-center"
        style={{ background: bg, border: `1px solid ${color}40` }}
      >
        {dot && <div className="w-2 h-2 rounded-full" style={{ background: color }} />}
      </div>
      <span className="text-[10px] text-black/45">{label}</span>
    </div>
  );
}

// ── Week Editor Panel ──────────────────────────────────────────────────────────

function WeekEditorPanel({
  weekNum, plan, isHoliday, isExam,
  deptColor, deptBg, readOnly, onClose, onUpdate,
}: {
  weekNum:   number;
  plan:      WeeklyPlan | null;
  isHoliday: boolean;
  isExam:    boolean;
  deptColor: string;
  deptBg:    string;
  readOnly?: boolean;
  onClose:   () => void;
  onUpdate:  (data: Partial<WeeklyPlan>) => void;
}) {
  const [localTopic,    setLocalTopic]    = useState(plan?.topic ?? '');
  const [localOutcomes, setLocalOutcomes] = useState((plan?.learningOutcomes ?? []).join('\n'));
  const [localActivities, setLocalActivities] = useState((plan?.activities ?? []).join('\n'));

  const isBlocked = isHoliday || isExam;

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: 'rgba(255,255,255,0.88)',
        backdropFilter: 'blur(24px)',
        border: `1.5px solid ${isBlocked ? '#00000012' : deptColor + '40'}`,
        boxShadow: '0 4px 24px rgba(0,0,0,0.07)',
      }}
    >
      {/* Header */}
      <div
        className="px-5 py-3 flex items-center justify-between border-b border-black/[0.05]"
        style={{ background: isBlocked ? 'rgba(0,0,0,0.02)' : deptBg }}
      >
        <div className="flex items-center gap-2.5">
          {isHoliday
            ? <Sun size={15} className="text-red-400" />
            : isExam
            ? <AlertTriangle size={15} className="text-orange-400" />
            : <PenLine size={15} style={{ color: deptColor }} />}
          <div>
            <p className="text-xs font-bold" style={{ color: isBlocked ? 'rgba(0,0,0,0.50)' : deptColor }}>
              สัปดาห์ที่ {weekNum}
            </p>
            {isHoliday && <p className="text-[10px] text-red-400">{plan?.note ?? 'สัปดาห์วันหยุด — ไม่มีการสอน'}</p>}
            {isExam    && <p className="text-[10px] text-orange-400">{plan?.note ?? 'สัปดาห์สอบ'}</p>}
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-[10px] font-semibold text-black/35 hover:text-black/60 transition-colors px-2 py-1 rounded-lg hover:bg-black/05"
        >
          ปิด
        </button>
      </div>

      {isBlocked ? (
        <div className="px-5 py-4 text-xs text-black/35 italic">
          สัปดาห์นี้ไม่มีการเรียนการสอน
        </div>
      ) : (
        <div className="px-5 py-4 space-y-3">
          {/* Topic */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-[11px] font-bold text-black/55">
              <BookOpen size={11} /> หัวข้อการเรียนรู้
            </label>
            <Textarea
              value={localTopic}
              onChange={e => setLocalTopic(e.target.value)}
              onBlur={() => onUpdate({ topic: localTopic })}
              disabled={readOnly}
              placeholder="ระบุหัวข้อหลักของสัปดาห์นี้..."
              rows={2}
              className="text-xs rounded-xl bg-black/[0.03] border-transparent focus-visible:ring-1 focus-visible:ring-slate-300 placeholder:text-black/20 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Learning outcomes */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-black/55">
                ผลการเรียนรู้ที่คาดหวัง
                <span className="font-normal text-black/30 ml-1">(1 บรรทัด/ข้อ)</span>
              </label>
              <Textarea
                value={localOutcomes}
                onChange={e => setLocalOutcomes(e.target.value)}
                onBlur={() => onUpdate({ learningOutcomes: localOutcomes.split('\n').filter(Boolean) })}
                disabled={readOnly}
                placeholder={'นักเรียนสามารถ...\nนักเรียนเข้าใจ...'}
                rows={4}
                className="text-xs rounded-xl bg-black/[0.03] border-transparent focus-visible:ring-1 focus-visible:ring-slate-300 placeholder:text-black/20 resize-none"
              />
            </div>

            {/* Activities */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-black/55">
                กิจกรรมการเรียนรู้
              </label>
              <Textarea
                value={localActivities}
                onChange={e => setLocalActivities(e.target.value)}
                onBlur={() => onUpdate({ activities: localActivities.split('\n').filter(Boolean) })}
                disabled={readOnly}
                placeholder={'บรรยาย\nอภิปรายกลุ่ม\n...'}
                rows={4}
                className="text-xs rounded-xl bg-black/[0.03] border-transparent focus-visible:ring-1 focus-visible:ring-slate-300 placeholder:text-black/20 resize-none"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
