import { useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, BookOpenCheck } from 'lucide-react';
import GradeBookClassSidebar from '@/features/grades/components/GradeBookClassSidebar';
import SidebarCollapseButton from '@/features/grades/components/SidebarCollapseButton';
import { useLessonPlan } from '@/hooks/useLessonPlan';
import { useActiveAcademicYear } from '@/hooks/useActiveAcademicYear';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import LessonPlanCard from './components/LessonPlanCard';
import LessonPlanFormModal from './components/LessonPlanFormModal';
import type { LessonPlan, NewLessonPlan } from '@/types/lessonPlan';

const MOCK_TEACHER_ID = 't03'; // แทนด้วย useAuth().user.uid เมื่อ backend พร้อม
const MOCK_TEACHER_NAME = 'ครูประเสริฐ';
const MOCK_DEPARTMENT_ID = 'secondary';

export default function LessonPlanManager() {
  const { activeYear, activeSemester } = useActiveAcademicYear();
  const { role } = useAuth();
  const isAdmin = role === 'admin' || role === 'sysadmin';
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const {
    plans, loading, createPlan, updatePlan, deletePlan,
    submitPlan, approvePlan, revertToDraft,
  } = useLessonPlan(MOCK_TEACHER_ID, MOCK_DEPARTMENT_ID);

  const [modalOpen, setModalOpen]           = useState(false);
  const [editTarget, setEditTarget]         = useState<LessonPlan | null>(null);

  const handleEdit = (plan: LessonPlan) => {
    setEditTarget(plan);
    setModalOpen(true);
  };

  const handleSave = async (data: NewLessonPlan) => {
    if (editTarget) {
      await updatePlan(editTarget.id, data);
    } else {
      await createPlan(data);
    }
  };

  return (
    <div className={cn(
      'relative flex min-h-0 w-full flex-1 basis-0 flex-col overflow-hidden bg-transparent font-sukhumvit',
      'h-[calc(100dvh-4.25rem)] max-h-[calc(100dvh-4.25rem)]',
    )}>
      <div className="flex min-h-0 flex-1 basis-0 flex-col gap-4 overflow-hidden lg:flex-row lg:items-stretch px-3 md:px-6">
        {/* ── Sidebar (hidden on mobile) ── */}
        <div
          className={cn(
            'hidden lg:flex h-full min-h-0 w-[280px] xl:w-[300px] shrink-0 flex-col self-stretch overflow-hidden',
            sidebarCollapsed && 'lg:w-20 xl:w-20',
          )}
        >
          <GradeBookClassSidebar
            selectedDept=""
            selectedGrade="all"
            selectedClassId=""
            gradeOptions={[]}
            classOptions={[]}
            onSelectDept={() => {}}
            onSelectGrade={() => {}}
            onSelectClass={() => {}}
            collapsed={sidebarCollapsed}
            headerAction={(
              <SidebarCollapseButton
                collapsed={sidebarCollapsed}
                onToggle={() => setSidebarCollapsed((v) => !v)}
              />
            )}
          />
        </div>

        {/* ── Content Panel ── */}
        <div className="relative flex min-h-0 flex-1 basis-0 flex-col self-stretch overflow-hidden rounded-2xl border border-border bg-card px-2 pb-2 sm:px-2.5 sm:pb-2.5">

          {/* ── Header ── */}
          <div className="flex items-center gap-2 min-w-0 shrink-0 border-b border-border pb-3 mb-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.2)' }}
            >
              <BookOpenCheck size={18} style={{ color: '#6366f1' }} />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-black text-foreground font-sukhumvit leading-snug">
                แผนการจัดการเรียนรู้
              </h1>
            </div>
          </div>

          {/* ── Content (scrollable) ── */}
          <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 size={32} className="animate-spin text-indigo-400" />
              </div>
            ) : !activeYear ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center text-muted-foreground">
                  <p className="text-3xl mb-3">📅</p>
                  <p className="font-bold text-foreground font-sukhumvit text-sm">กรุณาตั้งค่าปีการศึกษาก่อน</p>
                  <p className="text-xs mt-1 font-sarabun">ไปที่ ตั้งค่า → ปีการศึกษา</p>
                </div>
              </div>
            ) : plans.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center text-muted-foreground">
                  <p className="text-3xl mb-3">📋</p>
                  <p className="font-bold text-foreground font-sukhumvit text-sm">ยังไม่มีแผนการสอน</p>
                </div>
              </div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
                className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-2"
              >
                {plans.map(plan => (
                  <LessonPlanCard
                    key={plan.id}
                    plan={plan}
                    isAdmin={isAdmin}
                    onEdit={() => handleEdit(plan)}
                    onDelete={() => deletePlan(plan.id)}
                    onSubmit={() => submitPlan(plan.id)}
                    onApprove={() => approvePlan(plan.id)}
                    onRevert={() => revertToDraft(plan.id)}
                  />
                ))}
              </motion.div>
            )}
          </div>
        </div>
      </div>

      {/* ── Modal ── */}
      <LessonPlanFormModal
        open={modalOpen}
        initial={editTarget}
        teacherId={MOCK_TEACHER_ID}
        teacherName={MOCK_TEACHER_NAME}
        departmentId={MOCK_DEPARTMENT_ID}
        academicYearId={activeYear?.year ?? ''}
        semester={(activeSemester as 1 | 2) ?? 1}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
      />
    </div>
  );
}
