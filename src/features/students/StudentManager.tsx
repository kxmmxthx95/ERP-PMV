import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { GraduationCap, Plus, Upload } from 'lucide-react';
import { useStudentManager } from '@/hooks/useStudentManager';
import { useActiveAcademicYear } from '@/hooks/useActiveAcademicYear';
import StudentListPanel from './components/StudentListPanel';
import StudentDetailPanel from './components/StudentDetailPanel';
import StudentFormModal from './components/StudentFormModal';
import StudentCsvImportModal from './components/StudentCsvImportModal';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Student } from '@/types/student';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';

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
  const [csvModalOpen, setCsvModalOpen] = useState(false);
  const [availableYears, setAvailableYears] = useState<string[]>(['2568', '2567', '2566']);

  // ── ดึงข้อมูลปีการศึกษาจาก Firebase ──
  useEffect(() => {
    const q = query(collection(db, 'academic_years'), orderBy('year', 'desc'));
    const unsubscribe = onSnapshot(q, (snap) => {
      const years = snap.docs.map(doc => doc.data().year).filter(Boolean);
      if (years.length > 0) {
        setAvailableYears(Array.from(new Set(years)));
      }
    });
    return () => unsubscribe();
  }, []);

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

  const handleFormSubmit = async (data: Parameters<typeof addStudent>[0]) => {
    if (editingStudent) {
      await updateStudent(editingStudent.id, data);
    } else {
      const newStudent = await addStudent(data);
      setSelectedId(newStudent.id);
    }
  };

  const handleDelete = async (id: string) => {
    await deleteStudent(id);
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
        className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pb-5"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-sm border border-indigo-100 flex-shrink-0">
            <GraduationCap size={22} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-black/85 tracking-tight">จัดการนักเรียน</h1>
            <p className="text-[11px] text-black/40 mt-0.5">
              ปีการศึกษา {filter.academicYearId} · {stats.active} คน (กำลังศึกษา)
              · {stats.male} ชาย {stats.female} หญิง
            </p>
          </div>
        </div>

        {/* Unified Filter & Action Bar — Calendar Style */}
        <div
          className="flex flex-col sm:flex-row items-center gap-0.5 w-full md:w-auto rounded-xl shadow-sm"
          style={{
            background: 'rgba(255, 255, 255, 0.4)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid rgba(255, 255, 255, 0.6)',
            padding: '0.15rem',
          }}
        >
          {/* Year Filter */}
          <div className="w-full sm:w-32 flex-shrink-0">
            <Select value={filter.academicYearId} onValueChange={val => setFilter(prev => ({ ...prev, academicYearId: val, gradeLevel: '', classId: '' }))}>
              <SelectTrigger className="w-full px-2.5 py-0.5 bg-transparent hover:bg-black/5 border-none outline-none text-[11px] text-black/70 shadow-none focus:ring-0 h-auto rounded-md transition-colors">
                <SelectValue placeholder="ปีการศึกษา" />
              </SelectTrigger>
              <SelectContent className="bg-white/90 backdrop-blur-xl border-white/50 rounded-xl">
                {availableYears.map(y => <SelectItem key={y} value={y} className="text-[11px] rounded-lg">ปี {y}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Department Filter */}
          <div className="w-full sm:w-36 flex-shrink-0">
            <Select value={filter.departmentId || "all"} onValueChange={val => setFilter(prev => ({ ...prev, departmentId: val === 'all' ? '' : val as any, gradeLevel: '', classId: '' }))}>
              <SelectTrigger className="w-full px-2.5 py-0.5 bg-transparent hover:bg-black/5 border-none outline-none text-[11px] text-black/70 shadow-none focus:ring-0 h-auto rounded-md transition-colors">
                <SelectValue placeholder="แผนก" />
              </SelectTrigger>
              <SelectContent className="bg-white/90 backdrop-blur-xl border-white/50 rounded-xl">
                <SelectItem value="all" className="text-[11px] rounded-lg">ทุกแผนก</SelectItem>
                <SelectItem value="secondary" className="text-[11px] rounded-lg">มัธยมศึกษา</SelectItem>
                <SelectItem value="primary" className="text-[11px] rounded-lg">ประถมศึกษา</SelectItem>
                <SelectItem value="early" className="text-[11px] rounded-lg">ปฐมวัย</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Grade Filter */}
          <div className="w-full sm:w-32 flex-shrink-0">
            <Select value={filter.gradeLevel || "all"} onValueChange={val => setFilter(prev => ({ ...prev, gradeLevel: val === 'all' ? '' : val, classId: '' }))}>
              <SelectTrigger className="w-full px-2.5 py-0.5 bg-transparent hover:bg-black/5 border-none outline-none text-[11px] text-black/70 shadow-none focus:ring-0 h-auto rounded-md transition-colors disabled:opacity-40" disabled={!filter.departmentId}>
                <SelectValue placeholder="ชั้น" />
              </SelectTrigger>
              <SelectContent className="bg-white/90 backdrop-blur-xl border-white/50 rounded-xl">
                <SelectItem value="all" className="text-[11px] rounded-lg">ทุกชั้น</SelectItem>
                {availableGradeLevels.map(g => <SelectItem key={g} value={g} className="text-[11px] rounded-lg">{g}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Class Filter */}
          <div className="w-full sm:w-40 flex-shrink-0">
            <Select value={filter.classId || "all"} onValueChange={val => setFilter(prev => ({ ...prev, classId: val === 'all' ? '' : val }))}>
              <SelectTrigger className="w-full px-2.5 py-0.5 bg-transparent hover:bg-black/5 border-none outline-none text-[11px] text-black/70 shadow-none focus:ring-0 h-auto rounded-md transition-colors disabled:opacity-40" disabled={!filter.gradeLevel}>
                <SelectValue placeholder="ห้อง" />
              </SelectTrigger>
              <SelectContent className="bg-white/90 backdrop-blur-xl border-white/50 rounded-xl">
                <SelectItem value="all" className="text-[11px] rounded-lg">ทุกห้อง</SelectItem>
                {availableClasses.map(c => <SelectItem key={c.classId} value={c.classId} className="text-[11px] rounded-lg">{c.className}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* CSV Import Button */}
          <button
            onClick={() => setCsvModalOpen(true)}
            className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold text-black/70 transition-all duration-150 border border-black/10 bg-transparent hover:bg-black/5 flex-shrink-0 ml-0.5 h-auto"
          >
            <Upload size={14} />
            นำเข้า
          </button>

          {/* Add Button */}
          <button
            onClick={handleAdd}
            className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold text-white transition-all duration-150 hover:scale-[1.02] active:scale-[0.98] h-auto border-0 bg-[#1e1e1e] hover:bg-[#2a2a2a] flex-shrink-0 ml-0.5"
            style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
          >
            <Plus size={14} />
            เพิ่มนักเรียน
          </button>
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
            availableYears={availableYears}
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

      {/* ── Modals ── */}
      <StudentFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleFormSubmit}
        editingStudent={editingStudent}
      />
      <StudentCsvImportModal
        open={csvModalOpen}
        onClose={() => setCsvModalOpen(false)}
        onImport={addStudent}
      />
    </div>
  );
}
