import { useState } from 'react';
import { motion } from 'framer-motion';
import { Users } from 'lucide-react';
import { useTeacherManager } from '@/hooks/useTeacherManager';
import { useSchedule } from '@/hooks/useSchedule';
import { useActiveAcademicYear } from '@/hooks/useActiveAcademicYear';
import TeacherListPanel from './components/TeacherListPanel';
import TeacherSubjectPanel from './components/TeacherSubjectPanel';
import AddTeacherModal from './components/AddTeacherModal';
import type { TeacherProfile } from '@/types/teacher';

const containerAnim = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};
const cardAnim = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

export default function TeacherManager() {
  const { year: academicYear } = useActiveAcademicYear();
  const {
    teachers,
    addTeacher,
    updateTeacher,
    deleteTeacher,
    toggleTeacherStatus,
    toggleSubjectAssignment,
    allSubjects,
  } = useTeacherManager();

  const schedule = useSchedule();

  // ── Local State ───────────────────────────────────────────────────────────────
  const [selectedId, setSelectedId] = useState<string | null>(teachers[0]?.id ?? null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<TeacherProfile | null>(null);

  // ── Derived ───────────────────────────────────────────────────────────────────
  const selectedTeacher = teachers.find(t => t.id === selectedId) ?? null;

  const openAddModal = () => {
    setEditingTeacher(null);
    setModalOpen(true);
  };

  const openEditModal = () => {
    setEditingTeacher(selectedTeacher);
    setModalOpen(true);
  };

  const handleAddTeacher = (data: Parameters<typeof addTeacher>[0]) => {
    const newTeacher = addTeacher(data);
    setSelectedId(newTeacher.id);
  };

  const handleDelete = (id: string) => {
    deleteTeacher(id);
    if (selectedId === id) {
      setSelectedId(teachers.find(t => t.id !== id)?.id ?? null);
    }
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
            <Users size={22} className="text-black/70" />
            <h1 className="text-xl font-bold text-black/85 tracking-tight">จัดการครู</h1>
          </div>
          <p className="text-xs text-black/40 mt-0.5">
            ปีการศึกษา {academicYear ?? '—'} · {teachers.filter(t => t.status === 'active').length} คน (active)
            · {teachers.reduce((acc, t) => acc + t.teachingSubjectIds.length, 0)} วิชาที่มอบหมายแล้ว
          </p>
        </div>
      </motion.div>

      {/* ── Main Grid ── */}
      <motion.div
        variants={containerAnim}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 xl:grid-cols-5 gap-4"
        style={{ minHeight: '65vh' }}
      >
        {/* Left: Teacher list */}
        <motion.div variants={cardAnim} className="xl:col-span-2 flex flex-col">
          <TeacherListPanel
            teachers={teachers}
            selectedId={selectedId}
            teacherLoadSummary={schedule.teacherLoadSummary}
            onSelect={setSelectedId}
            onAdd={openAddModal}
          />
        </motion.div>

        {/* Right: Subject assignment */}
        <motion.div variants={cardAnim} className="xl:col-span-3 flex flex-col">
          {selectedTeacher ? (
            <TeacherSubjectPanel
              teacher={selectedTeacher}
              allSubjects={allSubjects}
              currentHours={schedule.teacherLoadSummary[selectedTeacher.id] ?? 0}
              onEdit={openEditModal}
              onToggleStatus={() => toggleTeacherStatus(selectedTeacher.id)}
              onToggleSubject={(subjectId) => toggleSubjectAssignment(selectedTeacher.id, subjectId)}
            />
          ) : (
            <div
              className="flex-1 rounded-2xl flex items-center justify-center"
              style={{
                background: 'rgba(255,255,255,0.72)',
                backdropFilter: 'blur(24px)',
                border: '1px solid rgba(255,255,255,0.90)',
              }}
            >
              <div className="text-center">
                <Users size={32} className="text-black/15 mx-auto mb-3" />
                <p className="text-sm text-black/30">เลือกครูจากรายการทางซ้าย</p>
                <p className="text-xs text-black/20 mt-1">เพื่อดูและกำหนดวิชาที่รับผิดชอบ</p>
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>

      {/* ── Add/Edit Modal ── */}
      <AddTeacherModal
        open={modalOpen}
        editingTeacher={editingTeacher}
        onClose={() => setModalOpen(false)}
        onSubmit={handleAddTeacher}
        onUpdate={(id, data) => updateTeacher(id, data)}
        onDelete={handleDelete}
      />
    </div>
  );
}
