import { useState } from 'react';
import { BookOpen, Edit2, ToggleLeft, ToggleRight, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { TeacherProfile } from '@/types/teacher';
import type { Subject } from '@/types/curriculum';
import { DEPARTMENT_CONFIG, CATEGORY_CONFIG } from '@/types/curriculum';

interface TeacherSubjectPanelProps {
  teacher: TeacherProfile;
  allSubjects: Subject[];
  currentHours: number; // จาก teacherLoadSummary (ตารางสอน)
  onEdit: () => void;
  onToggleStatus: () => void;
  onToggleSubject: (subjectId: string) => void;
}

const glassCard: React.CSSProperties = {
  background: 'rgba(255,255,255,0.72)',
  backdropFilter: 'blur(24px) saturate(150%)',
  WebkitBackdropFilter: 'blur(24px) saturate(150%)',
  border: '1px solid rgba(255,255,255,0.90)',
  boxShadow: '0 8px 32px rgba(0,0,0,0.06)',
};

export default function TeacherSubjectPanel({
  teacher,
  allSubjects,
  currentHours,
  onEdit,
  onToggleStatus,
  onToggleSubject,
}: TeacherSubjectPanelProps) {
  const [showAll, setShowAll] = useState(false);

  const cfg = DEPARTMENT_CONFIG[teacher.department];
  const isOverloaded = currentHours > teacher.maxHoursPerWeek;
  const utilizationPct = Math.min(100, Math.round(currentHours / teacher.maxHoursPerWeek * 100));

  // กรองวิชาตาม department ของครู + department อื่นๆ (ครูอาจสอนข้ามระดับได้)
  const subjectsToShow = showAll
    ? allSubjects
    : allSubjects.filter(s => s.department === teacher.department);

  const assignedSubjects = allSubjects.filter(s => teacher.teachingSubjectIds.includes(s.id));

  return (
    <div className="flex flex-col h-full rounded-2xl overflow-hidden" style={glassCard}>
      {/* Teacher Info Header */}
      <div className="px-5 pt-5 pb-4 border-b border-black/05">
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center text-base font-bold shrink-0"
            style={{ background: cfg.bg, color: cfg.color }}
          >
            {teacher.name.replace('ครู', '').trim().charAt(0)}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm font-bold text-black/80">{teacher.name}</h2>
              <span
                className="text-[10px] px-2 py-0.5 rounded-lg font-semibold"
                style={{ background: cfg.bg, color: cfg.color }}
              >
                {cfg.label}
              </span>
              {teacher.status === 'inactive' && (
                <span className="text-[10px] px-2 py-0.5 rounded-lg bg-black/06 text-black/40 font-semibold">
                  ไม่ active
                </span>
              )}
            </div>
            <p className="text-xs text-black/40 mt-0.5">
              <span className="font-mono">{teacher.employeeCode}</span>
              {teacher.position && <span className="ml-2">· {teacher.position}</span>}
            </p>
            {teacher.email && (
              <p className="text-[10px] text-black/30 mt-0.5">{teacher.email}</p>
            )}
          </div>

          <div className="flex gap-1.5 shrink-0">
            <Button variant="outline" size="sm" onClick={onEdit}
              className="h-7 px-2.5 text-xs rounded-lg border-black/10">
              <Edit2 size={11} className="mr-1" />แก้ไข
            </Button>
            <Button variant="ghost" size="sm" onClick={onToggleStatus}
              className="h-7 px-2.5 text-xs rounded-lg text-black/50">
              {teacher.status === 'active'
                ? <ToggleRight size={13} className="mr-1 text-emerald-500" />
                : <ToggleLeft size={13} className="mr-1" />}
              {teacher.status === 'active' ? 'Active' : 'Inactive'}
            </Button>
          </div>
        </div>

        {/* Teaching Load Bar */}
        <div className="mt-4 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-black/50">ภาระงานสอน (ปัจจุบัน)</span>
            <span
              className="text-[11px] font-bold"
              style={{ color: isOverloaded ? '#ef4444' : 'rgba(0,0,0,0.60)' }}
            >
              {currentHours} / {teacher.maxHoursPerWeek} คาบ/สัปดาห์
            </span>
          </div>
          <div className="h-2 rounded-full bg-black/[0.07] overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${utilizationPct}%`,
                background: isOverloaded ? '#ef4444' : cfg.color,
              }}
            />
          </div>
          {isOverloaded && (
            <div className="flex items-center gap-1.5 text-red-500">
              <AlertTriangle size={11} />
              <span className="text-[10px] font-semibold">
                เกินภาระสอน {currentHours - teacher.maxHoursPerWeek} คาบ — ควรปรับตารางสอน
              </span>
            </div>
          )}
        </div>

        {/* Assigned subjects summary */}
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <span className="text-[11px] text-black/40">วิชาที่รับผิดชอบ:</span>
          {assignedSubjects.length === 0 ? (
            <span className="text-[11px] text-black/30 italic">ยังไม่ได้กำหนดวิชา</span>
          ) : (
            assignedSubjects.slice(0, 4).map(s => (
              <Badge key={s.id} variant="outline" className="text-[10px] rounded-lg border-black/10 text-black/50">
                {s.code}
              </Badge>
            ))
          )}
          {assignedSubjects.length > 4 && (
            <span className="text-[10px] text-black/30">+{assignedSubjects.length - 4} อื่นๆ</span>
          )}
        </div>
      </div>

      {/* Subject Assignment Section */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-5 py-3 border-b border-black/04 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen size={13} className="text-black/40" />
            <span className="text-xs font-bold text-black/70">กำหนดวิชาที่รับผิดชอบ</span>
          </div>
          <button
            onClick={() => setShowAll(v => !v)}
            className="text-[10px] text-black/40 hover:text-black/60 underline underline-offset-2 transition-colors"
          >
            {showAll ? 'แสดงเฉพาะระดับ' : 'แสดงทุกระดับ'}
          </button>
        </div>

        {/* Group by category */}
        {(['core', 'added', 'elective', 'activity'] as const).map(cat => {
          const catSubjects = subjectsToShow.filter(s => s.category === cat);
          if (catSubjects.length === 0) return null;
          const catCfg = CATEGORY_CONFIG[cat];

          return (
            <div key={cat}>
              <div className="px-5 py-2 sticky top-0 bg-white/60 backdrop-blur-sm">
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-md"
                  style={{ background: catCfg.bg, color: catCfg.color }}
                >
                  {catCfg.label}
                </span>
              </div>
              <ul className="px-3 pb-1 space-y-1">
                {catSubjects.map(subject => {
                  const isAssigned = teacher.teachingSubjectIds.includes(subject.id);
                  const subjDeptCfg = DEPARTMENT_CONFIG[subject.department];

                  return (
                    <li key={subject.id}>
                      <button
                        onClick={() => onToggleSubject(subject.id)}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all text-left"
                        style={{
                          background: isAssigned ? cfg.bg : 'transparent',
                          border: `1px solid ${isAssigned ? cfg.border : 'transparent'}`,
                        }}
                      >
                        {/* Checkbox-style indicator */}
                        <div
                          className="w-4 h-4 rounded-md shrink-0 flex items-center justify-center"
                          style={{
                            background: isAssigned ? cfg.color : 'rgba(0,0,0,0.06)',
                            border: `1.5px solid ${isAssigned ? cfg.color : 'rgba(0,0,0,0.15)'}`,
                          }}
                        >
                          {isAssigned && (
                            <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
                              <path d="M1.5 4.5L3.5 6.5L7.5 2.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-[10px] text-black/35">{subject.code}</span>
                            <span className="text-xs text-black/70 truncate">{subject.name}</span>
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span
                              className="text-[9px] px-1.5 py-0.5 rounded"
                              style={{ background: subjDeptCfg.bg, color: subjDeptCfg.color }}
                            >
                              {subjDeptCfg.label}
                            </span>
                            <span className="text-[10px] text-black/30">
                              {subject.credits} นก. · {subject.hoursPerWeek} คาบ/สัปดาห์
                            </span>
                          </div>
                        </div>

                        {isAssigned && (
                          <span className="text-[10px] font-semibold shrink-0" style={{ color: cfg.color }}>
                            ✓ รับผิดชอบ
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
