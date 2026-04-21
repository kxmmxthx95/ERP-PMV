import { useState } from 'react';
import {
  BookOpen, User, Award, Calendar, Edit3, Send, CheckCircle2,
  ChevronRight, BarChart2, AlertTriangle, Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import type { CourseSyllabus, AssessmentSchema } from '@/types/syllabus';
import { SYLLABUS_STATUS_CONFIG } from '@/types/syllabus';
import type { Subject } from '@/types/curriculum';
import { DEPARTMENT_CONFIG } from '@/types/curriculum';
import type { TeacherProfile } from '@/types/teacher';
import type { TeachingWeekInfo } from '@/types/syllabus';
import type { CalendarEvent } from '@/types/calendar';
import type { SchoolDay } from '@/types/schedule';
import SyllabusCalendarView from './SyllabusCalendarView';

interface SyllabusEditorPanelProps {
  syllabus:         CourseSyllabus;
  subject:          Subject | null;
  teacher:          TeacherProfile | null;
  teachingWeekInfo: TeachingWeekInfo;
  semesterDates?:   { start: string; end: string };
  calendarEvents?:  CalendarEvent[];
  teachingDays?:    SchoolDay[];   // วันในสัปดาห์ที่สอนวิชานี้
  onUpdate:         (data: Partial<CourseSyllabus>) => void;
  onUpdateWeek:     (week: number, data: any) => void;
  onUpdateAssessment: (a: AssessmentSchema) => void;
  onSubmit:         () => void | Promise<void>;
  onApprove:        () => void | Promise<void>;
}

const glassCard: React.CSSProperties = {
  background: 'rgba(255,255,255,0.72)',
  backdropFilter: 'blur(24px) saturate(150%)',
  WebkitBackdropFilter: 'blur(24px) saturate(150%)',
  border: '1px solid rgba(255,255,255,0.90)',
  boxShadow: '0 8px 32px rgba(0,0,0,0.06)',
};

export default function SyllabusEditorPanel({
  syllabus,
  subject,
  teacher,
  teachingWeekInfo,
  semesterDates,
  calendarEvents = [],
  teachingDays = [],
  onUpdate,
  onUpdateWeek,
  onUpdateAssessment,
  onSubmit,
  onApprove,
}: SyllabusEditorPanelProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [objectivesText, setObjectivesText] = useState(syllabus.objectives.join('\n'));
  const status   = SYLLABUS_STATUS_CONFIG[syllabus.status];
  const dept     = subject ? DEPARTMENT_CONFIG[subject.department] : null;
  const isLocked = syllabus.status === 'approved';

  const assessmentTotal = syllabus.assessment.classwork + syllabus.assessment.midterm + syllabus.assessment.final;
  const isAssessmentValid = assessmentTotal === 100;

  const handleObjectivesBlur = () => {
    onUpdate({ objectives: objectivesText.split('\n').filter(Boolean) });
  };

  const handleAssessmentChange = (key: keyof AssessmentSchema, val: number) => {
    const updated = { ...syllabus.assessment, [key]: val };
    onUpdateAssessment(updated);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await onSubmit();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApprove = async () => {
    setIsApproving(true);
    try {
      await onApprove();
    } finally {
      setIsApproving(false);
    }
  };

  return (
    <div className="flex flex-col h-full rounded-2xl overflow-hidden" style={glassCard}>
      {/* ── Header ── */}
      <div className="px-5 pt-5 pb-4 border-b border-black/05">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {dept && (
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shrink-0"
                style={{ background: dept.bg, color: dept.color }}
              >
                {syllabus.subjectCode.slice(0, 1)}
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm font-bold text-black/80 truncate">{syllabus.subjectName}</h2>
                <span
                  className="text-[10px] font-semibold px-2 py-0.5 rounded-lg shrink-0"
                  style={{ background: status.bg, color: status.color }}
                >
                  {status.label}
                </span>
              </div>
              <div className="flex items-center gap-3 mt-1 text-[10px] text-black/40">
                <span className="font-mono">{syllabus.subjectCode}</span>
                <span>·</span>
                <span>{syllabus.credits} หน่วยกิต</span>
                <span>·</span>
                <span>{syllabus.hoursPerWeek} คาบ/สัปดาห์</span>
                <span>·</span>
                <span>{syllabus.gradeLevel}</span>
              </div>
              {teacher && (
                <div className="flex items-center gap-1.5 mt-1.5">
                  <User size={11} className="text-black/30" />
                  <span className="text-[11px] text-black/50">{teacher.name}</span>
                  {dept && (
                    <span
                      className="text-[9px] px-1.5 py-0.5 rounded-md font-semibold"
                      style={{ background: dept.bg, color: dept.color }}
                    >
                      {dept.label}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-1.5 shrink-0">
            {syllabus.status === 'draft' && (
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="h-7 px-3 text-xs rounded-lg bg-amber-500 hover:bg-amber-600 text-white disabled:opacity-60"
              >
                {isSubmitting ? (
                  <Loader2 size={11} className="mr-1 animate-spin" />
                ) : (
                  <Send size={11} className="mr-1" />
                )}
                {isSubmitting ? 'กำลังส่ง...' : 'ส่งตรวจ'}
              </Button>
            )}
            {syllabus.status === 'submitted' && (
              <Button
                size="sm"
                onClick={handleApprove}
                disabled={isApproving}
                className="h-7 px-3 text-xs rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white disabled:opacity-60"
              >
                {isApproving ? (
                  <Loader2 size={11} className="mr-1 animate-spin" />
                ) : (
                  <CheckCircle2 size={11} className="mr-1" />
                )}
                {isApproving ? 'กำลังอนุมัติ...' : 'อนุมัติ'}
              </Button>
            )}
          </div>
        </div>

        {/* Teaching week chips */}
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <Calendar size={12} className="text-black/30" />
          <div className="flex gap-1.5 flex-wrap">
            <Chip label={`${teachingWeekInfo.effectiveTeachingWeeks} สัปดาห์สอน`} color="#10b981" />
            <Chip label={`${teachingWeekInfo.totalHours} คาบ/ภาคเรียน`} color="#3b82f6" />
            {teachingWeekInfo.holidayWeeks > 0 && (
              <Chip label={`${teachingWeekInfo.holidayWeeks} สัปดาห์วันหยุด`} color="#ef4444" />
            )}
            {teachingWeekInfo.examWeeks > 0 && (
              <Chip label={`${teachingWeekInfo.examWeeks} สัปดาห์สอบ`} color="#f97316" />
            )}
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <Tabs defaultValue="overview" className="flex-1 flex flex-col overflow-hidden">
        <div className="px-5 pt-3 border-b border-black/04">
          <TabsList className="h-8 bg-black/[0.04] rounded-xl p-0.5 gap-0.5">
            {[
              { value: 'overview', label: 'ภาพรวม', icon: BookOpen },
              { value: 'weekly',   label: 'แผนรายสัปดาห์', icon: Calendar },
              { value: 'assess',   label: 'การวัดผล', icon: BarChart2 },
            ].map(({ value, label, icon: Icon }) => (
              <TabsTrigger
                key={value}
                value={value}
                className="h-7 px-3 text-xs rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm font-medium"
              >
                <Icon size={11} className="mr-1.5" />
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {/* ── Overview Tab ── */}
        <TabsContent value="overview" className="flex-1 overflow-y-auto p-5 space-y-4 mt-0">
          {/* Description */}
          <div className="space-y-2">
            <label className="flex items-center gap-1.5 text-xs font-bold text-black/65">
              <Edit3 size={12} />
              คำอธิบายรายวิชา
            </label>
            <Textarea
              value={syllabus.description}
              onChange={e => onUpdate({ description: e.target.value })}
              disabled={isLocked}
              placeholder="อธิบายเนื้อหาหลักของรายวิชา จุดเน้น และความสำคัญ..."
              rows={4}
              className="text-xs rounded-xl bg-black/[0.03] border-transparent focus-visible:ring-1 focus-visible:ring-slate-300 placeholder:text-black/20 resize-none"
            />
          </div>

          {/* Objectives */}
          <div className="space-y-2">
            <label className="flex items-center gap-1.5 text-xs font-bold text-black/65">
              <ChevronRight size={12} />
              จุดประสงค์การเรียนรู้
              <span className="font-normal text-black/30">(1 บรรทัด = 1 ข้อ)</span>
            </label>
            <Textarea
              value={objectivesText}
              onChange={e => setObjectivesText(e.target.value)}
              onBlur={handleObjectivesBlur}
              disabled={isLocked}
              placeholder={'นักเรียนสามารถ...\nนักเรียนเข้าใจ...\nนักเรียนวิเคราะห์ได้...'}
              rows={5}
              className="text-xs rounded-xl bg-black/[0.03] border-transparent focus-visible:ring-1 focus-visible:ring-slate-300 placeholder:text-black/20 resize-none"
            />
            {syllabus.objectives.length > 0 && (
              <ul className="space-y-1 mt-2">
                {syllabus.objectives.map((obj, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-black/60">
                    <span className="text-black/30 shrink-0 font-mono">{i + 1}.</span>
                    {obj}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Semester dates info */}
          {teachingWeekInfo.semesterStart && (
            <div
              className="rounded-xl px-4 py-3 text-[11px] text-black/50"
              style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.12)' }}
            >
              <p className="font-semibold text-black/60 mb-1 flex items-center gap-1.5">
                <Calendar size={11} />ช่วงภาคเรียน (ดึงจากปฏิทินการศึกษา)
              </p>
              <p>{teachingWeekInfo.semesterStart} ถึง {teachingWeekInfo.semesterEnd}</p>
              <p className="mt-0.5 text-black/40">
                รวม {teachingWeekInfo.totalCalendarWeeks} สัปดาห์ · สอนจริง {teachingWeekInfo.effectiveTeachingWeeks} สัปดาห์
              </p>
            </div>
          )}
        </TabsContent>

        {/* ── Weekly Plan Tab ── */}
        <TabsContent value="weekly" className="flex-1 overflow-y-auto p-5 mt-0">
          <SyllabusCalendarView
            weeklyPlan={syllabus.weeklyPlan}
            teachingWeekInfo={teachingWeekInfo}
            semesterStart={semesterDates?.start ?? teachingWeekInfo.semesterStart ?? '2025-05-12'}
            semesterEnd={semesterDates?.end   ?? teachingWeekInfo.semesterEnd   ?? '2025-09-30'}
            calendarEvents={calendarEvents}
            teachingDays={teachingDays}
            deptColor={dept?.color ?? '#3b82f6'}
            deptBg={dept?.bg     ?? 'rgba(59,130,246,0.10)'}
            readOnly={isLocked}
            onUpdateWeek={onUpdateWeek}
          />
        </TabsContent>

        {/* ── Assessment Tab ── */}
        <TabsContent value="assess" className="flex-1 overflow-y-auto p-5 mt-0 space-y-5">
          {/* Total validator */}
          <div
            className="rounded-xl px-4 py-3 flex items-center gap-3"
            style={{
              background: isAssessmentValid ? 'rgba(16,185,129,0.06)' : 'rgba(239,68,68,0.06)',
              border: `1px solid ${isAssessmentValid ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)'}`,
            }}
          >
            {isAssessmentValid
              ? <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
              : <AlertTriangle size={14} className="text-red-400 shrink-0" />}
            <div>
              <p className="text-xs font-semibold" style={{ color: isAssessmentValid ? '#10b981' : '#ef4444' }}>
                รวม {assessmentTotal} คะแนน {isAssessmentValid ? '✓ ถูกต้อง' : '← ต้องรวมได้ 100'}
              </p>
              <p className="text-[10px] text-black/40 mt-0.5">
                คะแนนเก็บ + กลางภาค + ปลายภาค = 100
              </p>
            </div>
          </div>

          {/* Sliders */}
          {[
            { key: 'classwork' as const, label: 'คะแนนเก็บระหว่างเรียน', color: '#3b82f6' },
            { key: 'midterm'   as const, label: 'สอบกลางภาค',            color: '#f97316' },
            { key: 'final'     as const, label: 'สอบปลายภาค',            color: '#8b5cf6' },
          ].map(({ key, label, color }) => (
            <div key={key} className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-black/65">{label}</label>
                <div
                  className="text-sm font-bold w-12 text-center py-0.5 rounded-lg"
                  style={{ background: `${color}15`, color }}
                >
                  {syllabus.assessment[key]}
                </div>
              </div>
              <Slider
                value={[syllabus.assessment[key]]}
                min={0}
                max={100}
                step={5}
                disabled={isLocked}
                onValueChange={([v]) => handleAssessmentChange(key, v)}
                className="w-full"
              />
              <div className="flex justify-between text-[9px] text-black/25">
                <span>0</span>
                <span>25</span>
                <span>50</span>
                <span>75</span>
                <span>100</span>
              </div>
            </div>
          ))}

          {/* Visual breakdown */}
          <div className="space-y-2">
            <p className="text-[11px] font-semibold text-black/50">สัดส่วนคะแนน (ภาพรวม)</p>
            <div className="flex rounded-xl overflow-hidden h-6">
              {[
                { key: 'classwork', color: '#3b82f6' },
                { key: 'midterm',   color: '#f97316' },
                { key: 'final',     color: '#8b5cf6' },
              ].map(({ key, color }) => (
                <div
                  key={key}
                  style={{
                    width: `${syllabus.assessment[key as keyof AssessmentSchema]}%`,
                    background: color,
                    transition: 'width 0.3s ease',
                  }}
                  title={`${key}: ${syllabus.assessment[key as keyof AssessmentSchema]}%`}
                />
              ))}
            </div>
            <div className="flex items-center gap-4">
              {[
                { label: 'คะแนนเก็บ', key: 'classwork', color: '#3b82f6' },
                { label: 'กลางภาค',   key: 'midterm',   color: '#f97316' },
                { label: 'ปลายภาค',   key: 'final',     color: '#8b5cf6' },
              ].map(({ label, key, color }) => (
                <div key={key} className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-sm" style={{ background: color }} />
                  <span className="text-[10px] text-black/50">{label} {syllabus.assessment[key as keyof AssessmentSchema]}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Grade scale info */}
          <div
            className="rounded-xl px-4 py-3"
            style={{ background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.06)' }}
          >
            <p className="text-[11px] font-semibold text-black/55 mb-2 flex items-center gap-1.5">
              <Award size={11} />
              เกณฑ์การตัดเกรด (มาตรฐานโรงเรียน)
            </p>
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { grade: 'A',  range: '80–100', color: '#10b981' },
                { grade: 'B+', range: '75–79',  color: '#3b82f6' },
                { grade: 'B',  range: '70–74',  color: '#3b82f6' },
                { grade: 'C+', range: '65–69',  color: '#f59e0b' },
                { grade: 'C',  range: '60–64',  color: '#f59e0b' },
                { grade: 'D+', range: '55–59',  color: '#f97316' },
                { grade: 'D',  range: '50–54',  color: '#f97316' },
                { grade: 'F',  range: '0–49',   color: '#ef4444' },
              ].map(g => (
                <div
                  key={g.grade}
                  className="flex items-center justify-between px-2 py-1.5 rounded-lg"
                  style={{ background: `${g.color}10` }}
                >
                  <span className="text-xs font-bold" style={{ color: g.color }}>{g.grade}</span>
                  <span className="text-[9px] text-black/40">{g.range}</span>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Chip({ label, color }: { label: string; color: string }) {
  return (
    <span
      className="text-[10px] font-semibold px-2 py-0.5 rounded-lg"
      style={{ background: `${color}15`, color }}
    >
      {label}
    </span>
  );
}
