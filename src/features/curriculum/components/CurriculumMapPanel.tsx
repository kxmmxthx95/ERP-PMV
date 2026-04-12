import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Layers, Minus, BookOpen, AlertCircle, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useSchoolStructure } from '@/hooks/useSchoolStructure';
import { CATEGORY_CONFIG, type SubjectCategory } from '@/types/curriculum';

// ── Styles ─────────────────────────────────────────────────────────────────
const glassCard: React.CSSProperties = {
  background: 'rgba(255, 255, 255, 0.65)',
  backdropFilter: 'blur(24px) saturate(150%)',
  WebkitBackdropFilter: 'blur(24px) saturate(150%)',
  border: '1px solid rgba(255, 255, 255, 0.8)',
  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.04)',
};

// ── Types ──────────────────────────────────────────────────────────────────
interface CurriculumMapPanelProps {
  activeDepartment: string;
  activeGrade: string;
  activeSemester: number;
  academicYear: string;
  subjects: any[];
  assignedSubjectIds: string[];
  creditSummary: { total: number; core?: number; elective?: number };
  onToggleSubject: (subjectId: string) => void;
  onChangeGrade: (gradeId: string) => void;
  onChangeSemester: (semester: number) => void;
}

// ── Component ──────────────────────────────────────────────────────────────
export default function CurriculumMapPanel({
  activeDepartment,
  activeGrade,
  activeSemester,
  academicYear,
  subjects = [],
  assignedSubjectIds = [],
  creditSummary,
  onToggleSubject,
  onChangeGrade,
  onChangeSemester,
}: CurriculumMapPanelProps) {
  const { getGradesBySection, semesters } = useSchoolStructure();
  const [isDragOver, setIsDragOver] = useState(false);
  
  // ดึงระดับชั้นตามแผนกที่เลือก
  const grades = useMemo(() => {
    return getGradesBySection(activeDepartment as any) || [];
  }, [activeDepartment, getGradesBySection]);

  // แยกรายวิชาที่อยู่ในแผน และยังไม่อยู่ในแผน
  const assignedSubjects = subjects.filter(s => assignedSubjectIds.includes(s.id));

  // จัดกลุ่มวิชาตามหมวดหมู่
  const groupedSubjects = useMemo(() => {
    const groups: Record<string, typeof assignedSubjects> = {
      core: [],
      added: [],
      elective: [],
      activity: [],
    };
    assignedSubjects.forEach(s => {
      if (groups[s.category]) groups[s.category].push(s);
    });
    return groups;
  }, [assignedSubjects]);

  return (
    <div
      className={`h-full flex flex-col rounded-3xl overflow-hidden transition-all duration-200 relative ${isDragOver ? 'ring-2 ring-emerald-400 bg-emerald-50/40 shadow-[0_0_30px_rgba(16,185,129,0.15)]' : ''}`}
      style={glassCard}
      onDragEnter={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setIsDragOver(false);
        }
      }}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragOver(false);
        const subjectId = e.dataTransfer.getData('text/plain');
        if (subjectId && !assignedSubjectIds.includes(subjectId)) {
          onToggleSubject(subjectId);
        }
      }}
    >
      {/* ── Drop Overlay ── */}
      {isDragOver && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/50 backdrop-blur-[2px] pointer-events-none">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="px-6 py-3 rounded-2xl bg-emerald-500 text-white font-bold shadow-xl flex items-center gap-2"
          >
            <Plus size={18} />
            วางวิชาที่นี่เพื่อเพิ่มเข้าแผน
          </motion.div>
        </div>
      )}
      
      {/* ── Header & Filters ── */}
      <div className="p-4 sm:p-5 border-b border-black/5 flex flex-col xl:flex-row gap-4 justify-between items-start xl:items-center bg-white/30">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#1e1e1e] flex items-center justify-center text-white shadow-sm">
            <Layers size={16} />
          </div>
          <div>
            <h2 className="font-bold text-black/80 text-sm leading-none mb-1.5">แผนผังการเรียน</h2>
            
          </div>
        </div>

        <div className="flex items-center gap-2 w-full xl:w-auto">
          {academicYear && (
            <div className="w-full xl:w-auto px-3 py-1.5 bg-black/5 border-transparent text-xs text-black/70 shadow-none h-auto rounded-lg text-center flex-shrink-0">
              {academicYear}
            </div>
          )}

          <Select value={activeGrade || 'none'} onValueChange={(v) => onChangeGrade(v === 'none' ? '' : v)}>
            <SelectTrigger className="w-full xl:w-[130px] px-3 py-1.5 bg-black/5 hover:bg-black/10 border-transparent text-xs text-black/70 shadow-none focus:ring-1 focus:ring-slate-300 h-auto rounded-lg transition-colors flex-shrink-0">
              <SelectValue placeholder="เลือกระดับชั้น" />
            </SelectTrigger>
            <SelectContent className="bg-white/95 backdrop-blur-xl border-white/50 rounded-xl">
              <SelectItem value="none" className="text-xs rounded-lg">เลือกระดับชั้น</SelectItem>
              {grades.map(g => (
                <SelectItem key={g.id} value={g.id} className="text-xs rounded-lg">{g.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={String(activeSemester)} onValueChange={(v) => onChangeSemester(Number(v))}>
            <SelectTrigger className="w-full xl:w-[120px] px-3 py-1.5 bg-black/5 hover:bg-black/10 border-transparent text-xs text-black/70 shadow-none focus:ring-1 focus:ring-slate-300 h-auto rounded-lg transition-colors flex-shrink-0">
              <SelectValue placeholder="เลือกภาคเรียน" />
            </SelectTrigger>
            <SelectContent className="bg-white/95 backdrop-blur-xl border-white/50 rounded-xl">
              {semesters.map(s => (
                <SelectItem key={s.id} value={String(s.id)} className="text-xs rounded-lg">{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ── Body (Subjects List) ── */}
      <div className="flex-1 p-4 sm:p-5 overflow-y-auto space-y-6">
        
        {/* Assigned Subjects */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-black/60 uppercase tracking-wide">วิชาในแผนการเรียน ({assignedSubjects.length})</h3>
          </div>
          
          <div className="space-y-4">
            <AnimatePresence mode="popLayout">
              {assignedSubjects.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="py-6 flex flex-col items-center justify-center text-black/30 border border-dashed border-black/10 rounded-2xl bg-black/[0.02]"
                >
                  <AlertCircle size={24} className="mb-2 opacity-50" />
                  <p className="text-xs font-medium">ยังไม่มีรายวิชาในแผนการเรียนนี้</p>
                  <p className="text-[10px]">ลากรายวิชาจากคลังด้านซ้ายมาวางที่นี่ หรือกดปุ่ม (+)</p>
                </motion.div>
              ) : (
                (['core', 'added', 'elective', 'activity'] as SubjectCategory[]).map(cat => {
                  const catSubjects = groupedSubjects[cat] || [];
                  if (catSubjects.length === 0) return null;
                  const cfg = CATEGORY_CONFIG[cat];

                  return (
                    <motion.div
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      key={cat}
                      className="mb-4 last:mb-0"
                    >
                      <div className="flex items-center gap-2 mb-2.5 px-1 pt-1">
                        <div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ background: cfg.color }} />
                        <h4 className="text-xs font-bold text-black/75">{cfg.label}</h4>
                        <span className="text-[10px] font-semibold text-black/40 ml-auto bg-white/50 px-2 py-0.5 rounded-md border border-black/5">
                          {catSubjects.length} วิชา · {catSubjects.reduce((sum, s) => sum + (s.credits || 0), 0)} นก.
                        </span>
                      </div>
                      <div className="space-y-2">
                        {catSubjects.map(s => (
                          <motion.div
                            layout
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            key={s.id}
                            className="flex items-center justify-between p-3 rounded-xl border border-black/5 bg-white/60 hover:bg-white transition-colors shadow-sm min-w-0"
                          >
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                                style={{ background: cfg.bg, color: cfg.color }}
                              >
                                <BookOpen size={14} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-bold text-black/80 leading-tight truncate">
                                  {s.code} <span className="font-semibold text-black/70">{s.name}</span>
                                </p>
                                <p className="text-[9px] text-black/40 mt-0.5 whitespace-nowrap">
                                  {s.credits || 0} นก. / {s.hoursPerWeek || 0} ชม.
                                </p>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => onToggleSubject(s.id)}
                              title="นำวิชาออกจากแผน (คืนสู่คลัง)"
                              className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-md flex-shrink-0"
                            >
                              <Minus size={14} />
                            </Button>
                          </motion.div>
                        ))}
                      </div>
                    </motion.div>
                  );
                })
              )}
            </AnimatePresence>
          </div>
        </div>

      </div>

      {/* ── Footer Summary ── */}
      <div className="p-3 sm:p-4 border-t border-black/5 bg-white/40 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 backdrop-blur-md">
        <div className="flex flex-wrap items-center gap-1.5">
          {(['core', 'added', 'elective', 'activity'] as SubjectCategory[]).map(cat => {
            const credits = (groupedSubjects[cat] || []).reduce((sum, s) => sum + (s.credits || 0), 0);
            if (credits === 0) return null;
            const cfg = CATEGORY_CONFIG[cat];
            return (
              <span
                key={cat}
                className="px-2 py-0.5 rounded-md text-[10px] font-bold"
                style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}
              >
                {cfg.label} {credits} นก.
              </span>
            );
          })}
        </div>
        <div className="flex items-center gap-2 ml-auto sm:ml-0">
          <span className="text-[11px] font-semibold text-black/60">รวมภาคเรียนนี้</span>
          <span className="text-[13px] font-bold text-[#1e1e1e] bg-black/5 border border-black/10 px-3 py-1.5 rounded-lg shadow-sm">
            {creditSummary?.total?.toFixed(1) || '0.0'} นก.
          </span>
        </div>
      </div>
    </div>
  );
}