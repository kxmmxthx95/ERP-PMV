import { useState } from 'react';
import { motion } from 'framer-motion';
import { BookOpenCheck, Plus, Filter, Loader2 } from 'lucide-react';
import { useLessonPlan } from '@/hooks/useLessonPlan';
import { useActiveAcademicYear } from '@/hooks/useActiveAcademicYear';
import { useAuth } from '@/hooks/useAuth';
import LessonPlanCard from './components/LessonPlanCard';
import LessonPlanFormModal from './components/LessonPlanFormModal';
import type { LessonPlan, LessonPlanStatus, NewLessonPlan } from '@/types/lessonPlan';

const MOCK_TEACHER_ID = 't03'; // แทนด้วย useAuth().user.uid เมื่อ backend พร้อม
const MOCK_TEACHER_NAME = 'ครูประเสริฐ';
const MOCK_DEPARTMENT_ID = 'secondary';

const STATUS_FILTERS: { value: LessonPlanStatus | 'all'; label: string }[] = [
  { value: 'all',       label: 'ทั้งหมด' },
  { value: 'draft',     label: 'ร่าง' },
  { value: 'submitted', label: 'รอตรวจสอบ' },
  { value: 'approved',  label: 'อนุมัติแล้ว' },
];

const GLASS: React.CSSProperties = {
  background: 'rgba(255,255,255,0.40)',
  backdropFilter: 'blur(30px) saturate(180%)',
  WebkitBackdropFilter: 'blur(30px) saturate(180%)',
  border: '1px solid rgba(255,255,255,0.3)',
  boxShadow: '0 8px 32px 0 rgba(31,38,135,0.07)',
};

export default function LessonPlanManager() {
  const { activeYear, activeSemester } = useActiveAcademicYear();
  const { role } = useAuth();
  const isAdmin = role === 'admin' || role === 'sysadmin';

  const {
    plans, loading, createPlan, updatePlan, deletePlan,
    submitPlan, approvePlan, revertToDraft,
  } = useLessonPlan(MOCK_TEACHER_ID, MOCK_DEPARTMENT_ID);

  const [modalOpen, setModalOpen]           = useState(false);
  const [editTarget, setEditTarget]         = useState<LessonPlan | null>(null);
  const [statusFilter, setStatusFilter]     = useState<LessonPlanStatus | 'all'>('all');

  const filtered = statusFilter === 'all'
    ? plans
    : plans.filter(p => p.status === statusFilter);

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

  const openNew = () => {
    setEditTarget(null);
    setModalOpen(true);
  };

  return (
    <div className="relative w-full bg-transparent overflow-hidden h-full">
      <div className="max-w-[1400px] mx-auto flex flex-col h-full gap-4 pb-10 pt-4 px-6">

        {/* ── Header ── */}
        <motion.div
          initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="flex items-start justify-between gap-4"
        >
          <div className="flex-1 rounded-[2rem] px-6 py-4 flex items-center justify-between gap-4" style={GLASS}>
            <div className="flex items-center gap-4">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
                style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.2)' }}
              >
                <BookOpenCheck size={22} style={{ color: '#6366f1' }} />
              </div>
              <div>
                <h1 className="text-xl font-black text-slate-800 font-sukhumvit"
                  style={{ textShadow: '0 1px 2px rgba(0,0,0,0.08)' }}>
                  แผนการจัดการเรียนรู้
                </h1>
                <p className="text-[11px] text-slate-500 font-sarabun mt-0.5">
                  {MOCK_TEACHER_NAME} · ปีการศึกษา {activeYear?.year ?? '—'} ภาคเรียนที่ {activeSemester ?? '—'}
                </p>
              </div>
            </div>

            {/* Stats */}
            <div className="hidden sm:flex items-center gap-3">
              <div className="px-4 py-2 rounded-2xl text-xs font-bold text-slate-700 font-sukhumvit"
                style={{ background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.9)' }}>
                ทั้งหมด {plans.length} แผน
              </div>
              <div className="px-4 py-2 rounded-2xl text-xs font-bold text-emerald-700 font-sukhumvit"
                style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)' }}>
                อนุมัติแล้ว {plans.filter(p => p.status === 'approved').length}
              </div>
            </div>

            <button
              onClick={openNew}
              className="flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-bold text-white shadow-md hover:shadow-lg hover:scale-105 transition-all shrink-0 font-sukhumvit"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
            >
              <Plus size={16} />
              สร้างแผน
            </button>
          </div>
        </motion.div>

        {/* ── Filter Bar ── */}
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
          className="flex items-center gap-2 flex-wrap"
        >
          <Filter size={14} className="text-slate-400" />
          {STATUS_FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className="px-4 py-1.5 rounded-full text-xs font-bold transition-all font-sarabun"
              style={statusFilter === f.value ? {
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                color: '#fff',
              } : {
                background: 'rgba(255,255,255,0.6)',
                color: '#64748b',
                border: '1px solid rgba(255,255,255,0.8)',
              }}
            >
              {f.label}
            </button>
          ))}
        </motion.div>

        {/* ── Content ── */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={32} className="animate-spin text-indigo-400" />
          </div>
        ) : !activeYear ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center text-slate-500">
              <p className="text-3xl mb-3">📅</p>
              <p className="font-bold text-slate-700 font-sukhumvit">กรุณาตั้งค่าปีการศึกษาก่อน</p>
              <p className="text-sm mt-1 font-sarabun">ไปที่ ตั้งค่า → ปีการศึกษา</p>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center text-slate-500">
              <p className="text-3xl mb-3">📋</p>
              <p className="font-bold text-slate-700 font-sukhumvit">ยังไม่มีแผนการสอน</p>
              <p className="text-sm mt-1 font-sarabun">กดปุ่ม "สร้างแผน" เพื่อเริ่มต้น</p>
            </div>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
            className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
          >
            {filtered.map(plan => (
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
