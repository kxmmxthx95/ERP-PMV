import { useState } from 'react';
import { motion } from 'framer-motion';
import { FileText, Users } from 'lucide-react';
import { useSyllabusManager } from '@/hooks/useSyllabusManager';
import SyllabusListPanel    from './components/SyllabusListPanel';
import SyllabusEditorPanel  from './components/SyllabusEditorPanel';
import NewSyllabusModal     from './components/NewSyllabusModal';
import type { Subject } from '@/types/curriculum';
import type { TeacherProfile } from '@/types/teacher';

// Grade levels สำหรับ dropdown (รวม 3 ระดับ)
const ALL_GRADE_LEVELS = [
  'อ.1', 'อ.2', 'อ.3',
  'ป.1', 'ป.2', 'ป.3', 'ป.4', 'ป.5', 'ป.6',
  'ม.1', 'ม.2', 'ม.3', 'ม.4', 'ม.5', 'ม.6',
];

const containerAnim = {
  hidden: { opacity: 0 },
  show:   { opacity: 1, transition: { staggerChildren: 0.06 } },
};
const cardAnim = {
  hidden: { opacity: 0, y: 12 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

export default function SyllabusManager() {
  const mgr = useSyllabusManager();
  const [newModalOpen, setNewModalOpen] = useState(false);

  const handleCreate = async (subject: Subject, teacher: TeacherProfile, gradeLevel: string) => {
    await mgr.createSyllabusForSubject(subject, teacher, gradeLevel);
  };

  return (
    <div className="space-y-5 text-black">
      {/* ── Page Header ── */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"
      >
        <div>
          <div className="flex items-center gap-2.5">
            <FileText size={22} className="text-black/70" />
            <h1 className="text-xl font-bold text-black/85 tracking-tight">แผนการสอน (Course Syllabus)</h1>
          </div>
          <p className="text-xs text-black/40 mt-0.5">
            ปีการศึกษา {mgr.activeYearStr} · ภาคเรียนที่ {mgr.semester}
            {' · '}
            <span className="text-emerald-600 font-semibold">{mgr.stats.approved} อนุมัติ</span>
            {' / '}
            <span className="text-amber-500 font-semibold">{mgr.stats.submitted} รอตรวจ</span>
            {' / '}
            <span className="text-black/40">{mgr.stats.draft} ร่าง</span>
            {' · '}
            <span className="font-semibold text-blue-600">{mgr.teachingWeekInfo.effectiveTeachingWeeks} สัปดาห์สอน</span>
          </p>
        </div>
      </motion.div>

      {/* ── Main Grid ── */}
      <motion.div
        variants={containerAnim}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 xl:grid-cols-5 gap-4"
        style={{ minHeight: '68vh' }}
      >
        {/* Left: Syllabus list */}
        <motion.div variants={cardAnim} className="xl:col-span-2 flex flex-col">
          <SyllabusListPanel
            items={mgr.filteredItems}
            selectedId={mgr.selectedSyllabusId}
            stats={mgr.stats}
            filterDept={mgr.filterDept}
            filterStatus={mgr.filterStatus}
            onSelectId={mgr.setSelectedSyllabusId}
            onFilterDept={mgr.setFilterDept}
            onFilterStatus={mgr.setFilterStatus}
            onNewSyllabus={() => setNewModalOpen(true)}
          />
        </motion.div>

        {/* Right: Editor */}
        <motion.div variants={cardAnim} className="xl:col-span-3 flex flex-col">
          {mgr.selectedSyllabus ? (
            <SyllabusEditorPanel
              syllabus={mgr.selectedSyllabus}
              subject={mgr.selectedSubject}
              teacher={mgr.selectedTeacher}
              teachingWeekInfo={mgr.getTeachingWeeksForSubject(mgr.selectedSyllabus.subjectId)}
              onUpdate={async data => await mgr.updateSyllabus(mgr.selectedSyllabus!.id, data)}
              onUpdateWeek={async (week, data) => await mgr.updateWeeklyPlan(mgr.selectedSyllabus!.id, week, data)}
              onUpdateAssessment={async a => await mgr.updateAssessment(mgr.selectedSyllabus!.id, a)}
              onSubmit={async () => await mgr.submitSyllabus(mgr.selectedSyllabus!.id)}
              onApprove={async () => await mgr.approveSyllabus(mgr.selectedSyllabus!.id)}
            />
          ) : (
            <EmptyState onNew={() => setNewModalOpen(true)} />
          )}
        </motion.div>
      </motion.div>

      {/* ── Modal ── */}
      <NewSyllabusModal
        open={newModalOpen}
        subjects={mgr.allSubjects}
        getTeachersForSubject={mgr.getEligibleTeachers}
        gradeLevels={ALL_GRADE_LEVELS}
        onClose={() => setNewModalOpen(false)}
        onCreate={handleCreate}
      />
    </div>
  );
}

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div
      className="flex-1 rounded-2xl flex flex-col items-center justify-center gap-4"
      style={{
        background: 'rgba(255,255,255,0.72)',
        backdropFilter: 'blur(24px)',
        border: '1px solid rgba(255,255,255,0.90)',
      }}
    >
      <Users size={32} className="text-black/15" />
      <div className="text-center">
        <p className="text-sm text-black/30">เลือกแผนการสอนจากรายการ</p>
        <p className="text-xs text-black/20 mt-1">หรือสร้างใหม่สำหรับภาคเรียนนี้</p>
      </div>
      <button
        onClick={onNew}
        className="text-xs font-semibold px-4 py-2 rounded-xl text-white"
        style={{ background: '#1e1e1e' }}
      >
        + สร้างแผนการสอนใหม่
      </button>
    </div>
  );
}
