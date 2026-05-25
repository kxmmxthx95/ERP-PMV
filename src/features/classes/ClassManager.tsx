import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DoorOpen, Search } from 'lucide-react';
import { useClassroomManager } from './hooks/useClassroomManager';
import ClassCard from './components/ClassCard';
import ClassFormModal from './components/ClassFormModal';
import ClassStudentPanel from './components/ClassStudentPanel';
import { Button } from '@/components/ui/button';
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
  const mgr = useClassroomManager();
  const { getGradesBySection } = useSchoolStructure();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassRoom | null>(null);
  const [selectedClass, setSelectedClass] = useState<ClassRoom | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const closeModal = () => { setModalOpen(false); setEditingClass(null); };

  const normalizedDept = mgr.filterDept === 'early' ? 'early-childhood' : mgr.filterDept;
  const grades = mgr.filterDept !== 'all' ? getGradesBySection(normalizedDept as any) : [];

  const departments: { id: Department; label: string }[] = [
    { id: 'early', label: DEPARTMENT_CONFIG.early.label },
    { id: 'primary', label: DEPARTMENT_CONFIG.primary.label },
    { id: 'secondary', label: DEPARTMENT_CONFIG.secondary.label },
  ];


  const ITEMS_PER_PAGE = 12;
  const totalPages = Math.ceil(mgr.filteredCards.length / ITEMS_PER_PAGE);
  const paginatedCards = mgr.filteredCards.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  useEffect(() => {
    setCurrentPage(1);
  }, [mgr.searchQ, mgr.filterDept, mgr.filterGrade]);

  // Safety check: if current page is beyond total pages (due to filtering), reset to 1
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [mgr.filteredCards.length, totalPages, currentPage]);

  // If a class is selected, show student management panel
  if (selectedClass) {
    return (
      <ClassStudentPanel
        classRoom={selectedClass}
        onBack={() => setSelectedClass(null)}
      />
    );
  }

  return (
    <div className="space-y-8 text-black pb-40 font-sukhumvit">
      {/* Unified Filter Capsule - Floating at Bottom Center (Minimalist Version) */}
      <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-3 w-full px-4 max-w-4xl pointer-events-none">
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="flex items-center bg-white/80 backdrop-blur-2xl border border-white/80 p-1.5 rounded-full shadow-[0_8px_32px_rgba(0,0,0,0.12)] max-w-full overflow-hidden pointer-events-auto"
        >
          {/* Search */}
          <div className="relative flex items-center px-4 group border-r border-slate-200/60 mr-1">
            <Search size={14} className="text-slate-400 mr-2 group-focus-within:text-blue-500 transition-colors" />
            <input
              value={mgr.searchQ}
              onChange={e => mgr.setSearchQ(e.target.value)}
              placeholder="ค้นหา..."
              className="w-24 md:w-36 bg-transparent border-none outline-none text-[12px] font-bold text-slate-700 placeholder:text-slate-300"
            />
          </div>

          {/* Dept Filters */}
          <div className="flex items-center gap-1 px-1">
            <button
              onClick={() => { mgr.setFilterDept('all'); mgr.setFilterGrade('all'); }}
              className={`px-4 py-1.5 rounded-full text-[11px] font-bold transition-all ${
                mgr.filterDept === 'all' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              ทั้งหมด
            </button>
            {departments.map(d => (
              <button
                key={d.id}
                onClick={() => { mgr.setFilterDept(d.id as any); mgr.setFilterGrade('all'); }}
                className={`px-4 py-1.5 rounded-full text-[11px] font-bold transition-all whitespace-nowrap ${
                  mgr.filterDept === d.id ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>

          {mgr.filterDept !== 'all' && (
            <>
              <div className="h-6 w-[1px] bg-slate-200 mx-1" />
              <div className="flex items-center gap-1 px-1">
                <button
                  onClick={() => mgr.setFilterGrade('all')}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition-all ${
                    mgr.filterGrade === 'all' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  ทุกระดับ
                </button>
                {grades.map(g => (
                  <button
                    key={g.id}
                    onClick={() => mgr.setFilterGrade(g.shortLabel)}
                    className={`w-7 h-7 rounded-full text-[11px] font-bold flex items-center justify-center transition-all ${
                      mgr.filterGrade === g.shortLabel ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    {(g.shortLabel || g.label).replace(/[^0-9]/g, '')}
                  </button>
                ))}
              </div>
            </>
          )}

        </motion.div>
      </div>

      {/* ── Card Grid ── */}
      {mgr.filteredCards.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center h-64 gap-3 text-slate-300 bg-white/40 rounded-3xl border border-white shadow-sm"
        >
          <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center">
            <DoorOpen size={32} className="opacity-20" />
          </div>
          <p className="text-sm font-bold text-slate-400">ไม่พบข้อมูลที่ตรงตามเงื่อนไข</p>

          <button
            onClick={() => { mgr.setFilterDept('all'); mgr.setFilterGrade('all'); mgr.setSearchQ(''); }}
            className="mt-2 px-6 py-2.5 bg-slate-900 text-white text-[11px] font-black rounded-full shadow-xl hover:bg-slate-800 transition-all active:scale-95"
          >
            ล้างการกรองทั้งหมด
          </button>
        </motion.div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key="card-grid"
            variants={containerAnim}
            initial="hidden"
            animate="show"
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3"
          >
            {paginatedCards.map((card) => (
              <motion.div key={card.classRoom.id} variants={cardAnim}>
                <div
                  className="cursor-pointer"
                  onClick={() => setSelectedClass(card.classRoom)}
                >
                  <ClassCard
                    card={card}
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
