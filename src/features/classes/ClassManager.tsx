import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DoorOpen, Plus, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useClassManager } from '@/hooks/useClassManager';
import ClassCard from './components/ClassCard';
import ClassFormModal from './components/ClassFormModal';
import ClassStudentPanel from './components/ClassStudentPanel';
import type { ClassRoom, NewClassRoom } from '@/types/class';
import type { Department } from '@/types/curriculum';
import { DEPARTMENT_CONFIG } from '@/types/curriculum';
import { useSchoolStructure } from '@/hooks/useSchoolStructure';

const containerAnim = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};
const cardAnim = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.25 } },
};

export default function ClassManager() {
  const mgr = useClassManager();
  const { getGradesBySection } = useSchoolStructure();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassRoom | null>(null);
  const [selectedClass, setSelectedClass] = useState<ClassRoom | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const openCreate = () => { setEditingClass(null); setModalOpen(true); };
  const openEdit = (cls: ClassRoom) => { setEditingClass(cls); setModalOpen(true); };
  const closeModal = () => { setModalOpen(false); setEditingClass(null); };

  const normalizedDept = mgr.filterDept === 'early' ? 'early-childhood' : mgr.filterDept;
  const grades = mgr.filterDept !== 'all' ? getGradesBySection(normalizedDept as any) : [];

  const departments: { id: Department; label: string }[] = [
    { id: 'early', label: DEPARTMENT_CONFIG.early.label },
    { id: 'primary', label: DEPARTMENT_CONFIG.primary.label },
    { id: 'secondary', label: DEPARTMENT_CONFIG.secondary.label },
  ];
  const deptIdMap: Record<Department, string> = {
    early: 'early-childhood',
    primary: 'primary',
    secondary: 'secondary',
  };

  const ITEMS_PER_PAGE = 12;
  const totalPages = Math.ceil(mgr.filteredCards.length / ITEMS_PER_PAGE);
  const paginatedCards = mgr.filteredCards.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  useEffect(() => {
    setCurrentPage(1);
  }, [mgr.searchQ, mgr.filterDept, mgr.filterGrade]);

  // If a class is selected, show student management panel
  if (selectedClass) {
    return (
      <ClassStudentPanel
        classRoom={selectedClass}
        onBack={() => setSelectedClass(null)}
        onEditClass={() => openEdit(selectedClass)}
      />
    );
  }

  return (
    <div className="space-y-5 text-black">
      {/* ── Header & Actions ── */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between gap-4"
      >
        <div className="flex items-center gap-2.5">
          <DoorOpen size={22} className="text-black/70" />
          <div>
            <h1 className="text-xl font-bold text-black/85 tracking-tight">จัดการชั้นเรียน</h1>
            <p className="text-xs text-black/40 mt-0.5">
              ปีการศึกษา {mgr.yearId} · ภาคเรียนที่ {mgr.semester}
              {' · '}
              <span className="font-semibold text-black/60">{mgr.filteredCards.length} / {mgr.summary.total} ห้อง</span>
            </p>
          </div>
        </div>

        {/* Filter Bar (Schedule Style) */}
        <div className="flex flex-wrap items-center justify-end gap-2 w-full lg:w-auto">
          {/* Search */}
          <div className="relative w-full sm:w-[180px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-black/30 z-10" />
            <Input
              value={mgr.searchQ}
              onChange={e => mgr.setSearchQ(e.target.value)}
              placeholder="ค้นหาห้อง / ครู..."
              className="w-full pl-9 pr-2 py-1.5 bg-black/5 hover:bg-black/10 border-transparent outline-none text-[11px] placeholder:text-black/40 shadow-none focus-visible:ring-1 focus-visible:ring-slate-300 h-9 rounded-xl transition-all"
            />
          </div>

          <div className="flex items-center h-9 bg-black/5 border border-black/5 rounded-xl p-1 gap-0.5 max-w-full overflow-x-auto scrollbar-hide">
            {/* Dept pills */}
            <button
              onClick={() => { mgr.setFilterDept('all'); mgr.setFilterGrade('all'); }}
              className={`h-7 px-3 rounded-lg text-[10px] font-bold transition-all whitespace-nowrap ${
                mgr.filterDept === 'all'
                  ? 'bg-[#1e1e1e] text-white shadow-md'
                  : 'text-black/40 hover:text-black/70 hover:bg-black/5'
              }`}
            >
              ทั้งหมด
            </button>
            {departments.map(d => {
              const val = deptIdMap[d.id] ?? d.id;
              return (
                <button
                  key={d.id}
                  onClick={() => { mgr.setFilterDept(val as any); mgr.setFilterGrade('all'); }}
                  className={`h-7 px-3 rounded-lg text-[10px] font-bold transition-all whitespace-nowrap ${
                    mgr.filterDept === val
                      ? 'bg-[#1e1e1e] text-white shadow-md'
                      : 'text-black/40 hover:text-black/70 hover:bg-black/5'
                  }`}
                >
                  {d.label}
                </button>
              );
            })}

            {/* Grade pills */}
            <AnimatePresence>
              {mgr.filterDept !== 'all' && (
                <motion.div
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 'auto' }}
                  exit={{ opacity: 0, width: 0 }}
                  className="flex items-center overflow-hidden gap-0.5"
                >
                  <div className="w-px h-4 bg-black/10 mx-0.5 shrink-0" />
                  {grades.map(g => (
                    <button
                      key={g.id}
                      onClick={() => mgr.setFilterGrade(g.id)}
                      className={`h-7 px-2.5 rounded-lg text-[10px] font-bold transition-all whitespace-nowrap ${
                        mgr.filterGrade === g.id
                          ? 'bg-[#1e1e1e] text-white shadow-md'
                          : 'text-black/40 hover:text-black/70 hover:bg-black/5'
                      }`}
                    >
                      {g.shortLabel || g.label}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <Button
            onClick={openCreate}
            className="flex items-center gap-1.5 px-4 h-9 rounded-xl text-xs font-bold text-white transition-all duration-150 hover:scale-[1.02] active:scale-[0.98] border-0 bg-[#1e1e1e] hover:bg-[#2a2a2a] flex-shrink-0"
            style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
          >
            <Plus size={14} />
            สร้างห้องเรียน
          </Button>
        </div>
      </motion.div>

      {/* ── Card Grid ── */}
      {mgr.filteredCards.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center h-52 gap-2 text-black/25 bg-white/40 rounded-2xl border border-black/5 shadow-sm"
        >
          <DoorOpen size={32} className="opacity-40" />
          <p className="text-sm font-medium">ยังไม่มีห้องเรียน</p>
          <p className="text-xs text-black/20">กด "สร้างห้องเรียน" เพื่อเพิ่มห้องใหม่</p>
        </motion.div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key="card-grid"
            variants={containerAnim}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
          >
            {paginatedCards.map((card) => (
              <motion.div key={card.classRoom.id} variants={cardAnim}>
                <div
                  className="cursor-pointer"
                  onClick={() => setSelectedClass(card.classRoom)}
                >
                  <ClassCard
                    card={card}
                    onEdit={() => openEdit(card.classRoom)}
                  />
                </div>
              </motion.div>
            ))}
          </motion.div>
        </AnimatePresence>
      )}

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="flex items-center justify-center gap-2"
        >
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
            className="h-8 rounded-full text-xs font-medium"
          >
            ← ก่อนหน้า
          </Button>
          <div className="text-xs font-medium text-black/40 px-2">
            หน้า {currentPage} / {totalPages}
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
            className="h-8 rounded-full text-xs font-medium"
          >
            ถัดไป →
          </Button>
        </motion.div>
      )}

      {/* ── Modal ── */}
      <ClassFormModal
        open={modalOpen}
        editingClass={editingClass}
        yearId={mgr.yearId}
        semester={mgr.semester}
        teachers={mgr.availableTeachers}
        onClose={closeModal}
        onSubmit={async (data: NewClassRoom) => await mgr.addClass(data)}
        onUpdate={async (id, data) => await mgr.updateClass(id, data)}
        onDelete={async id => await mgr.deleteClass(id)}
      />
    </div>
  );
}
