import { useState } from 'react';
import { motion } from 'framer-motion';
import { GraduationCap } from 'lucide-react';
import { useStudentManager } from '@/hooks/useStudentManager';
import { useActiveAcademicYear } from '@/hooks/useActiveAcademicYear';
import StudentListPanel from './components/StudentListPanel';
import StudentDetailPanel from './components/StudentDetailPanel';
import StudentFormModal from './components/StudentFormModal';
import type { Student } from '@/types/student';

// Available academic years for filter (in production → fetch from Firestore)
const AVAILABLE_YEARS = ['2568', '2567', '2566'];

export default function StudentManager() {
  const { year: academicYear } = useActiveAcademicYear();

  const {
    filteredStudentCards, stats, filter, setFilter,
    availableGradeLevels, availableClasses,
    addStudent, updateStudent, deleteStudent, toggleStudentStatus,
    getStudentById, getStudentEnrollments,
  } = useStudentManager(academicYear ?? '2568');

  const [selectedId, setSelectedId] = useState<string | null>(filteredStudentCards[0]?.student.id ?? null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);

  const selectedStudent = selectedId ? getStudentById(selectedId) : null;
  const selectedEnrollments = selectedId ? getStudentEnrollments(selectedId) : [];

  const handleAdd = () => {
    setEditingStudent(null);
    setModalOpen(true);
  };

  const handleEdit = () => {
    setEditingStudent(selectedStudent);
    setModalOpen(true);
  };

  const handleFormSubmit = (data: Parameters<typeof addStudent>[0]) => {
    if (editingStudent) {
      updateStudent(editingStudent.id, data);
    } else {
      const newStudent = addStudent(data);
      setSelectedId(newStudent.id);
    }
  };

  const handleDelete = (id: string) => {
    deleteStudent(id);
    if (selectedId === id) {
      const next = filteredStudentCards.find(c => c.student.id !== id);
      setSelectedId(next?.student.id ?? null);
    }
  };

  return (
    <div className="flex flex-col h-full gap-0 text-black">
      {/* ── Page Header ── */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4"
      >
        <div>
          <div className="flex items-center gap-2.5">
            <GraduationCap size={22} className="text-black/70" />
            <h1 className="text-xl font-bold text-black/85 tracking-tight">จัดการนักเรียน</h1>
          </div>
          <p className="text-xs text-black/40 mt-0.5">
            ปีการศึกษา {filter.academicYearId} · {stats.active} คน (กำลังศึกษา)
            · {stats.male} ชาย {stats.female} หญิง
          </p>
        </div>
      </motion.div>

      {/* ── Two-column layout ── */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-4 min-h-0 overflow-hidden">

        {/* Left: List + Filters */}
        <motion.div
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.05 }}
          className="flex flex-col min-h-0 overflow-hidden"
        >
          <StudentListPanel
            cards={filteredStudentCards}
            filter={filter}
            onFilterChange={patch => setFilter(prev => ({ ...prev, ...patch }))}
            availableYears={AVAILABLE_YEARS}
            availableGrades={availableGradeLevels}
            availableClasses={availableClasses}
            selectedId={selectedId}
            onSelect={id => setSelectedId(id)}
            onAdd={handleAdd}
            stats={stats}
          />
        </motion.div>

        {/* Right: Detail */}
        <motion.div
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="min-h-0 overflow-y-auto"
        >
          {selectedStudent ? (
            <StudentDetailPanel
              student={selectedStudent}
              enrollments={selectedEnrollments}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onToggleStatus={toggleStudentStatus}
            />
          ) : (
            <div
              className="h-full flex flex-col items-center justify-center gap-3 text-black/25 rounded-2xl"
              style={{
                background: 'rgba(255,255,255,0.50)',
                border: '1px dashed rgba(0,0,0,0.10)',
              }}
            >
              <GraduationCap size={40} className="opacity-25" />
              <p className="text-sm">เลือกนักเรียนเพื่อดูข้อมูล</p>
            </div>
          )}
        </motion.div>
      </div>

      {/* ── Modal ── */}
      <StudentFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleFormSubmit}
        editingStudent={editingStudent}
      />
    </div>
  );
}
