import { useState } from 'react';
import { ChevronDown, ChevronRight, Sun, BookOpen, AlertTriangle } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import type { WeeklyPlan } from '@/types/syllabus';
import type { TeachingWeekInfo } from '@/types/syllabus';

interface WeeklyPlanTableProps {
  weeklyPlan:       WeeklyPlan[];
  teachingWeekInfo: TeachingWeekInfo;
  readOnly?:        boolean;
  onUpdateWeek:     (week: number, data: Partial<WeeklyPlan>) => void;
}

const glassCard: React.CSSProperties = {
  background: 'rgba(255,255,255,0.72)',
  backdropFilter: 'blur(24px)',
  border: '1px solid rgba(255,255,255,0.90)',
  boxShadow: '0 4px 16px rgba(0,0,0,0.05)',
};

export default function WeeklyPlanTable({
  weeklyPlan,
  teachingWeekInfo,
  readOnly,
  onUpdateWeek,
}: WeeklyPlanTableProps) {
  const [expandedWeek, setExpandedWeek] = useState<number | null>(null);

  const toggleWeek = (week: number) =>
    setExpandedWeek(prev => prev === week ? null : week);

  return (
    <div className="space-y-3">
      {/* Summary bar */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: 'สัปดาห์ทั้งหมด', value: teachingWeekInfo.totalCalendarWeeks, color: '#6b7280' },
          { label: 'สัปดาห์วันหยุด', value: teachingWeekInfo.holidayWeeks, color: '#ef4444' },
          { label: 'สัปดาห์สอบ',     value: teachingWeekInfo.examWeeks,    color: '#f97316' },
          { label: 'สัปดาห์สอนจริง', value: teachingWeekInfo.effectiveTeachingWeeks, color: '#10b981' },
        ].map(stat => (
          <div
            key={stat.label}
            className="px-3 py-2.5 rounded-xl text-center"
            style={glassCard}
          >
            <p className="text-lg font-bold" style={{ color: stat.color }}>{stat.value}</p>
            <p className="text-[9px] text-black/40 mt-0.5 leading-tight">{stat.label}</p>
          </div>
        ))}
      </div>

      <p className="text-[11px] text-black/40 px-1">
        รวมคาบสอนตลอดภาคเรียน:{' '}
        <span className="font-bold text-black/60">{teachingWeekInfo.totalHours} คาบ</span>
      </p>

      {/* Week rows */}
      <div className="space-y-1.5">
        {weeklyPlan.map(w => {
          const isExpanded = expandedWeek === w.week;
          const isEmpty    = !w.topic.trim();
          const isSpecial  = w.isHoliday || w.isExamWeek;

          return (
            <div
              key={w.week}
              className="rounded-2xl overflow-hidden transition-all"
              style={{
                ...glassCard,
                opacity: isSpecial ? 0.75 : 1,
              }}
            >
              {/* Row header */}
              <button
                onClick={() => !isSpecial && toggleWeek(w.week)}
                disabled={isSpecial}
                className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-black/[0.02]"
              >
                {/* Week number */}
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold shrink-0"
                  style={{
                    background: w.isExamWeek
                      ? 'rgba(249,115,22,0.12)'
                      : w.isHoliday
                      ? 'rgba(239,68,68,0.10)'
                      : isEmpty
                      ? 'rgba(0,0,0,0.05)'
                      : 'rgba(59,130,246,0.12)',
                    color: w.isExamWeek
                      ? '#f97316'
                      : w.isHoliday
                      ? '#ef4444'
                      : isEmpty
                      ? 'rgba(0,0,0,0.30)'
                      : '#3b82f6',
                  }}
                >
                  {w.week}
                </div>

                {/* Topic / note */}
                <div className="flex-1 min-w-0">
                  {isSpecial ? (
                    <div className="flex items-center gap-1.5">
                      {w.isExamWeek
                        ? <AlertTriangle size={11} className="text-orange-400 shrink-0" />
                        : <Sun size={11} className="text-red-400 shrink-0" />}
                      <span className="text-xs text-black/50 italic">{w.note ?? (w.isHoliday ? 'วันหยุดนักขัตฤกษ์' : 'สัปดาห์สอบ')}</span>
                    </div>
                  ) : isEmpty ? (
                    <span className="text-xs text-black/30 italic">ยังไม่ได้กรอกหัวข้อ...</span>
                  ) : (
                    <span className="text-xs font-semibold text-black/75 truncate">{w.topic}</span>
                  )}
                </div>

                {/* Outcome count */}
                {!isSpecial && w.learningOutcomes.length > 0 && (
                  <Badge variant="outline" className="text-[9px] rounded-md border-black/10 text-black/35 shrink-0">
                    <BookOpen size={9} className="mr-1" />
                    {w.learningOutcomes.length} ผลลัพธ์
                  </Badge>
                )}

                {/* Expand chevron */}
                {!isSpecial && (
                  isExpanded
                    ? <ChevronDown size={14} className="text-black/30 shrink-0" />
                    : <ChevronRight size={14} className="text-black/20 shrink-0" />
                )}
              </button>

              {/* Expanded editor */}
              {isExpanded && !isSpecial && (
                <div className="px-4 pb-4 space-y-3 border-t border-black/04">
                  <div className="space-y-1.5 pt-3">
                    <label className="text-[11px] font-semibold text-black/55">หัวข้อการเรียนรู้</label>
                    <Textarea
                      value={w.topic}
                      onChange={e => onUpdateWeek(w.week, { topic: e.target.value })}
                      disabled={readOnly}
                      placeholder="ระบุหัวข้อหลักของสัปดาห์นี้..."
                      rows={2}
                      className="text-xs rounded-xl bg-black/[0.03] border-transparent focus-visible:ring-1 focus-visible:ring-slate-300 placeholder:text-black/20 resize-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-black/55">
                      ผลการเรียนรู้ที่คาดหวัง
                      <span className="font-normal text-black/30 ml-1">(1 บรรทัด = 1 ข้อ)</span>
                    </label>
                    <Textarea
                      value={w.learningOutcomes.join('\n')}
                      onChange={e => onUpdateWeek(w.week, {
                        learningOutcomes: e.target.value.split('\n').filter(Boolean),
                      })}
                      disabled={readOnly}
                      placeholder={'นักเรียนสามารถ...\nนักเรียนเข้าใจ...'}
                      rows={3}
                      className="text-xs rounded-xl bg-black/[0.03] border-transparent focus-visible:ring-1 focus-visible:ring-slate-300 placeholder:text-black/20 resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-black/55">กิจกรรมการเรียนรู้</label>
                      <Textarea
                        value={w.activities.join('\n')}
                        onChange={e => onUpdateWeek(w.week, {
                          activities: e.target.value.split('\n').filter(Boolean),
                        })}
                        disabled={readOnly}
                        placeholder={'บรรยาย\nอภิปรายกลุ่ม\n...'}
                        rows={3}
                        className="text-xs rounded-xl bg-black/[0.03] border-transparent focus-visible:ring-1 focus-visible:ring-slate-300 placeholder:text-black/20 resize-none"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-black/55">สื่อ/แหล่งเรียนรู้</label>
                      <Textarea
                        value={(w.materials ?? []).join('\n')}
                        onChange={e => onUpdateWeek(w.week, {
                          materials: e.target.value.split('\n').filter(Boolean),
                        })}
                        disabled={readOnly}
                        placeholder={'หนังสือเรียน\nสไลด์ PowerPoint\n...'}
                        rows={3}
                        className="text-xs rounded-xl bg-black/[0.03] border-transparent focus-visible:ring-1 focus-visible:ring-slate-300 placeholder:text-black/20 resize-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-black/55">การวัดและประเมินผลสัปดาห์นี้</label>
                    <Textarea
                      value={w.assessment ?? ''}
                      onChange={e => onUpdateWeek(w.week, { assessment: e.target.value })}
                      disabled={readOnly}
                      placeholder="เช่น สังเกตพฤติกรรม, แบบฝึกหัด, ทดสอบย่อย..."
                      rows={2}
                      className="text-xs rounded-xl bg-black/[0.03] border-transparent focus-visible:ring-1 focus-visible:ring-slate-300 placeholder:text-black/20 resize-none"
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
