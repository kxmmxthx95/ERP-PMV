import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  FileText, BookOpen, CheckCircle2, Clock, AlertCircle,
  ChevronRight, TrendingUp, User, Trash2, Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useTeacherSyllabus } from '@/hooks/useTeacherSyllabus';
import { useAuth } from '@/hooks/useAuth';
import MySubjectPanel    from './components/MySubjectPanel';
import SyllabusEditorPanel from '@/features/syllabus/components/SyllabusEditorPanel';
import type { Subject } from '@/types/curriculum';
import { DEPARTMENT_CONFIG } from '@/types/curriculum';
import { useSchoolStructure } from '@/hooks/useSchoolStructure';

const containerAnim = {
  hidden: { opacity: 0 },
  show:   { opacity: 1, transition: { staggerChildren: 0.06 } },
};
const cardAnim = {
  hidden: { opacity: 0, y: 12 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

export default function TeacherSyllabusPage() {
  const { user } = useAuth();
  // ดึง Teacher ID จาก Firebase Auth
  const mgr = useTeacherSyllabus(user?.uid ?? '');
  const { gradeLevels } = useSchoolStructure();

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [gradeLevel, setGradeLevel] = useState('');
  const [createSubject, setCreateSubject] = useState<Subject | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const openCreateModal = (subject: Subject) => {
    setCreateSubject(subject);
    setGradeLevel('');
    setIsCreating(false);
    setCreateModalOpen(true);
  };

  const handleCreate = async () => {
    if (!createSubject || !gradeLevel) return;
    setIsCreating(true);
    try {
      await mgr.createSyllabus(createSubject, gradeLevel);
      setCreateModalOpen(false);
    } finally {
      setIsCreating(false);
    }
  };

  const selectedGrade = gradeLevels.find(g => g.id === gradeLevel);

  return (
    <div className="space-y-5 text-black">
      {/* ── Page Header ── */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-start justify-between gap-3"
      >
        <div>
          <div className="flex items-center gap-2.5">
            <FileText size={22} className="text-black/70" />
            <h1 className="text-xl font-bold text-black/85 tracking-tight">แผนการสอนของฉัน</h1>
          </div>
          <p className="text-xs text-black/40 mt-0.5">
            ปีการศึกษา {mgr.activeYearStr} · ภาคเรียนที่ {mgr.semester}
          </p>
          {mgr.currentTeacher && (
            <div className="flex items-center gap-1.5 mt-1">
              <User size={11} className="text-black/30" />
              <span className="text-[11px] text-black/50">
                {mgr.currentTeacher.name}
                {mgr.currentTeacher.position && ` · ${mgr.currentTeacher.position}`}
              </span>
            </div>
          )}
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-2 flex-wrap">
          <StatChip
            icon={<CheckCircle2 size={11} />}
            label="อนุมัติแล้ว"
            value={mgr.stats.approved}
            color="#10b981"
          />
          <StatChip
            icon={<Clock size={11} />}
            label="รอตรวจ"
            value={mgr.stats.submitted}
            color="#f59e0b"
          />
          <StatChip
            icon={<FileText size={11} />}
            label="ร่าง"
            value={mgr.stats.draft}
            color="#6b7280"
          />
          <StatChip
            icon={<AlertCircle size={11} />}
            label="ยังไม่มีแผน"
            value={mgr.stats.noSyllabus}
            color="#ef4444"
          />
        </div>
      </motion.div>

      {/* ── Completion Bar ── */}
      {mgr.completionSummary.allWeeks > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-2xl px-5 py-3 flex items-center gap-4"
          style={{
            background: 'rgba(255,255,255,0.72)',
            backdropFilter: 'blur(24px)',
            border: '1px solid rgba(255,255,255,0.90)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.05)',
          }}
        >
          <TrendingUp size={16} className="text-black/40 shrink-0" />
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-semibold text-black/60">ความคืบหน้ารวมทุกวิชา</span>
              <span className="text-[11px] font-bold text-black/70">
                {mgr.completionSummary.filledWeeks}/{mgr.completionSummary.allWeeks} สัปดาห์
                <span className="text-black/40 font-normal ml-1">({mgr.completionSummary.pct}%)</span>
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-black/[0.07] overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-emerald-400"
                initial={{ width: 0 }}
                animate={{ width: `${mgr.completionSummary.pct}%` }}
                transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
              />
            </div>
          </div>
        </motion.div>
      )}

      {/* ── Main Grid ── */}
      <motion.div
        variants={containerAnim}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 xl:grid-cols-5 gap-4"
        style={{ minHeight: '65vh' }}
      >
        {/* Left: My subjects */}
        <motion.div variants={cardAnim} className="xl:col-span-2 flex flex-col">
          <MySubjectPanel
            cards={mgr.subjectCards}
            selectedSubjectId={mgr.selectedSubjectId}
            onSelect={mgr.setSelectedSubjectId}
          />
        </motion.div>

        {/* Right: Editor or create prompt */}
        <motion.div variants={cardAnim} className="xl:col-span-3 flex flex-col">
          {mgr.selectedCard ? (
            mgr.selectedCard.syllabus ? (
              // มี syllabus → เปิด editor
              <div className="relative flex-1 min-h-0 h-full">
                <div className="absolute top-5 right-5 z-20">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isDeleting}
                    onClick={async () => {
                      if (window.confirm('คุณแน่ใจหรือไม่ที่จะลบแผนการสอนนี้? ข้อมูลทั้งหมดจะถูกลบอย่างถาวร')) {
                        setIsDeleting(true);
                        try {
                          await (mgr as any).deleteSyllabus?.(mgr.selectedCard!.syllabus!.id);
                        } finally {
                          setIsDeleting(false);
                        }
                      }
                    }}
                    className="h-8 text-[11px] font-semibold text-red-500 hover:text-red-600 hover:bg-red-50 border-red-100 bg-white/90 backdrop-blur-md shadow-sm disabled:opacity-50"
                  >
                    {isDeleting ? <Loader2 size={13} className="mr-1.5 animate-spin" /> : <Trash2 size={13} className="mr-1.5" />}
                    {isDeleting ? 'กำลังลบ...' : 'ลบแผนการสอน'}
                  </Button>
                </div>
                  <SyllabusEditorPanel
                    syllabus={mgr.selectedCard.syllabus}
                    subject={mgr.selectedSubject}
                    teacher={mgr.currentTeacher}
                    teachingWeekInfo={mgr.getTeachingWeeksForSubject(mgr.selectedCard.subject.id)}
                    semesterDates={mgr.semesterDates}
                    calendarEvents={mgr.calendarEvents}
                    teachingDays={mgr.getTeachingDaysForSubject(mgr.selectedCard.subject.id)}
                    onUpdate={async data => await mgr.updateSyllabus(mgr.selectedCard!.syllabus!.id, data as any)}
                    onUpdateWeek={async (week, data) => await mgr.updateWeeklyPlan(mgr.selectedCard!.syllabus!.id, week, data)}
                    onUpdateAssessment={async a => await mgr.updateAssessment(mgr.selectedCard!.syllabus!.id, a)}
                    onSubmit={async () => await mgr.submitSyllabus(mgr.selectedCard!.syllabus!.id)}
                    onApprove={async () => {}}
                  />
              </div>
            ) : (
              // ยังไม่มี syllabus → แสดง create prompt
              <CreatePrompt
                subject={mgr.selectedCard.subject}
                onCreate={() => openCreateModal(mgr.selectedCard!.subject)}
              />
            )
          ) : (
            <EmptyPrompt />
          )}
        </motion.div>
      </motion.div>

      {/* ── Create Syllabus Modal ── */}
      <Dialog open={createModalOpen} onOpenChange={v => !v && setCreateModalOpen(false)}>
        <DialogContent
          className="max-w-sm rounded-3xl border-0 p-0 overflow-hidden"
          style={{
            background: 'rgba(255,255,255,0.97)',
            backdropFilter: 'blur(32px)',
            boxShadow: '0 24px 64px rgba(0,0,0,0.14)',
          }}
        >
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-black/05">
            <DialogTitle className="text-base font-bold text-black/80">
              สร้างแผนการสอน
            </DialogTitle>
            {createSubject && (
              <p className="text-xs text-black/40 mt-1">
                {createSubject.name} ({createSubject.code})
              </p>
            )}
          </DialogHeader>

          <div className="px-6 py-5 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-black/60">
                ระดับชั้นที่สอน <span className="text-red-400">*</span>
              </Label>
              <Select value={gradeLevel} onValueChange={setGradeLevel}>
                <SelectTrigger className="h-9 text-xs rounded-xl bg-black/[0.03] border-transparent focus:ring-1 focus:ring-slate-300">
                  <SelectValue placeholder="เลือกระดับชั้น..." />
                </SelectTrigger>
                <SelectContent className="rounded-xl max-h-52">
                  {gradeLevels.map(g => (
                    <SelectItem key={g.id} value={g.id} className="text-xs">{g.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {gradeLevel && createSubject && (
              <div
                className="rounded-xl px-4 py-3 text-[11px] space-y-1"
                style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)' }}
              >
                <p className="font-semibold text-black/60">จะสร้างแผนการสอน</p>
                <p className="text-black/50">{createSubject.name} · {selectedGrade?.label}</p>
                <p className="text-black/40 mt-0.5">
                  ระบบจะ auto-generate แผนรายสัปดาห์จากปฏิทินการศึกษา
                </p>
              </div>
            )}
          </div>

          <div className="px-6 pb-6 flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCreateModalOpen(false)}
              className="text-xs h-8 rounded-lg border-black/10"
            >
              ยกเลิก
            </Button>
            <Button
              size="sm"
              onClick={handleCreate}
              disabled={!gradeLevel || isCreating}
              className="text-xs h-8 rounded-lg bg-[#1e1e1e] hover:bg-[#2a2a2a] text-white disabled:opacity-40"
            >
              {isCreating ? <Loader2 size={13} className="mr-1.5 animate-spin" /> : null}
              {isCreating ? 'กำลังสร้าง...' : 'สร้างแผนการสอน'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatChip({
  icon, label, value, color,
}: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <div
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold"
      style={{ background: `${color}12`, color }}
    >
      {icon}
      <span className="font-bold">{value}</span>
      <span className="font-normal opacity-70">{label}</span>
    </div>
  );
}

function CreatePrompt({ subject, onCreate }: { subject: Subject; onCreate: () => void }) {
  const dept = DEPARTMENT_CONFIG[subject.department as keyof typeof DEPARTMENT_CONFIG];

  return (
    <div
      className="flex-1 rounded-2xl flex flex-col items-center justify-center gap-5 p-8"
      style={{
        background: 'rgba(255,255,255,0.72)',
        backdropFilter: 'blur(24px)',
        border: '1px solid rgba(255,255,255,0.90)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.06)',
      }}
    >
      {/* Subject card preview */}
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold"
        style={{ background: dept.bg, color: dept.color }}
      >
        {subject.code.slice(0, 1)}
      </div>

      <div className="text-center space-y-1.5">
        <h3 className="text-base font-bold text-black/75">{subject.name}</h3>
        <p className="text-xs text-black/40 font-mono">{subject.code}</p>
        <div className="flex items-center justify-center gap-2 text-[11px] text-black/40 mt-1">
          <span>{subject.credits} หน่วยกิต</span>
          <span>·</span>
          <span>{subject.hoursPerWeek} คาบ/สัปดาห์</span>
          <span>·</span>
          <span
            className="px-1.5 py-0.5 rounded-md font-semibold text-[10px]"
            style={{ background: dept.bg, color: dept.color }}
          >
            {dept.label}
          </span>
        </div>
      </div>

      <div className="text-center space-y-2 max-w-xs">
        <p className="text-sm text-black/50">ยังไม่มีแผนการสอนสำหรับวิชานี้</p>
        <p className="text-xs text-black/30">
          ระบบจะสร้างแผนรายสัปดาห์ให้อัตโนมัติจากปฏิทินการศึกษา
          โดยตัดสัปดาห์วันหยุดและสัปดาห์สอบออกให้
        </p>
      </div>

      <Button
        onClick={onCreate}
        className="px-6 h-9 rounded-xl bg-[#1e1e1e] hover:bg-[#2a2a2a] text-white text-sm font-semibold"
      >
        <BookOpen size={14} className="mr-2" />
        สร้างแผนการสอน
      </Button>

      <div className="flex items-center gap-1.5 text-[10px] text-black/25">
        <ChevronRight size={10} />
        <span>หลังสร้างแล้วสามารถกรอกเนื้อหาและส่งตรวจได้</span>
      </div>
    </div>
  );
}

function EmptyPrompt() {
  return (
    <div
      className="flex-1 rounded-2xl flex flex-col items-center justify-center gap-3"
      style={{
        background: 'rgba(255,255,255,0.72)',
        backdropFilter: 'blur(24px)',
        border: '1px solid rgba(255,255,255,0.90)',
      }}
    >
      <BookOpen size={32} className="text-black/15" />
      <p className="text-sm text-black/30">เลือกวิชาจากรายการทางซ้าย</p>
      <p className="text-xs text-black/20">เพื่อดูหรือสร้างแผนการสอน</p>
    </div>
  );
}
