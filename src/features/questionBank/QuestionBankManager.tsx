import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, Plus, Search, X } from 'lucide-react';
import { useQuestionSetBank, type QuestionSetFilters } from '@/hooks/useQuestionSetBank';
import type { NewQuestionSet, QuestionSet } from '@/types/questionBank';
import { SUBJECT_GROUP_CONFIG, SUBJECT_SUBGROUP_CONFIG, DEPARTMENT_CONFIG, type Department, type SubjectGroupId } from '@/types/curriculum';
import QuestionSetBuilder from './components/QuestionSetBuilder';
import QuestionSetList from './components/QuestionSetList';
import QuestionSetQuestionManager from './components/QuestionSetQuestionManager';

const DEPT_OPTIONS = [
  { id: 'all', label: 'ทั้งหมด' },
  { id: 'early', label: 'อนุบาล' },
  { id: 'primary', label: 'ประถม' },
  { id: 'secondary', label: 'มัธยม' },
] as const;

export default function QuestionBankManager() {
  const {
    isLoading: isSetLoading,
    addQuestionSet,
    updateQuestionSet,
    deleteQuestionSet,
    filterQuestionSets,
  } = useQuestionSetBank();

  const [setModalOpen, setSetModalOpen] = useState(false);
  const [editingSet, setEditingSet] = useState<QuestionSet | null>(null);
  const [selectedSet, setSelectedSet] = useState<QuestionSet | null>(null);

  const [filters, setFilters] = useState<QuestionSetFilters>({
    search: '',
    subjectGroup: 'all',
    subSubjectGroup: 'all',
    department: 'all',
    gradeLevel: 'all',
  });

  const clearFilters = () => {
    setFilters({
      search: '',
      subjectGroup: 'all',
      subSubjectGroup: 'all',
      department: 'all',
      gradeLevel: 'all',
    });
  };

  const hasActiveFilters = 
    filters.search !== '' || 
    filters.subjectGroup !== 'all' || 
    filters.subSubjectGroup !== 'all' || 
    filters.department !== 'all' || 
    filters.gradeLevel !== 'all';

  const visibleSets = useMemo(
    () => filterQuestionSets(filters),
    [filterQuestionSets, filters],
  );

  const openCreateSet = () => { setEditingSet(null); setSetModalOpen(true); };
  const openEditSet = (set: QuestionSet) => { setEditingSet(set); setSetModalOpen(true); };

  const handleSetSubmit = async (data: NewQuestionSet) => {
    if (editingSet) {
      await updateQuestionSet(editingSet.id, data);
    } else {
      await addQuestionSet(data);
    }
  };

  const handleDeleteSet = async (set: QuestionSet) => {
    if (!confirm(`ลบชุดข้อสอบนี้?\n\n${set.title}`)) return;
    if (selectedSet?.id === set.id) setSelectedSet(null);
    await deleteQuestionSet(set.id);
  };

  const headerPortalEl =
    typeof document !== 'undefined'
      ? document.getElementById('header-portal-right-actions')
      : null;
  const headerFiltersPortalEl =
    typeof document !== 'undefined'
      ? document.getElementById('header-portal-center')
      : null;

  const filterCapsules = !selectedSet ? (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-2 h-10 border border-black/[0.07] p-1 rounded-full bg-white/60 backdrop-blur-md"
    >
      <div className="h-8 px-3 rounded-full flex items-center gap-2 bg-black/[0.03] min-w-[210px]">
        <Search size={12} className="text-black/40 shrink-0" />
        <input
          value={filters.search || ''}
          onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
          placeholder="ค้นหาชุดข้อสอบ..."
          className="w-full bg-transparent border-none outline-none text-[11px] font-bold text-slate-700 placeholder:text-black/35 font-sukhumvit"
        />
      </div>

      <select
        value={filters.subjectGroup}
        onChange={(e) => setFilters(prev => ({ ...prev, subjectGroup: e.target.value as SubjectGroupId | 'all', subSubjectGroup: 'all' }))}
        className="h-8 px-3 rounded-full text-[11px] font-bold text-black/55 bg-transparent hover:bg-black/5 transition-all outline-none font-sukhumvit"
      >
        <option value="all">ทุกกลุ่มสาระ</option>
        {Object.entries(SUBJECT_GROUP_CONFIG)
          .sort(([, a], [, b]) => a.order - b.order)
          .map(([id, cfg]) => (
            <option key={id} value={id}>{cfg.name}</option>
          ))}
      </select>

      {filters.subjectGroup && filters.subjectGroup !== 'all' && SUBJECT_SUBGROUP_CONFIG[filters.subjectGroup] && (
        <select
          value={filters.subSubjectGroup}
          onChange={(e) => setFilters(prev => ({ ...prev, subSubjectGroup: e.target.value }))}
          className="h-8 px-3 rounded-full text-[11px] font-bold text-black/55 bg-transparent hover:bg-black/5 transition-all outline-none font-sukhumvit"
        >
          <option value="all">ทุกวิชา/สาระย่อย</option>
          {SUBJECT_SUBGROUP_CONFIG[filters.subjectGroup]?.map(sub => (
            <option key={sub} value={sub}>{sub}</option>
          ))}
        </select>
      )}

      <div className="w-[1px] h-4 bg-black/[0.09] mx-0.5" />

      <AnimatePresence mode="wait">
        {filters.department === 'all' ? (
          <motion.div
            key="dept"
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 6 }}
            className="flex items-center gap-0.5"
          >
            {DEPT_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                onClick={() => setFilters(prev => ({ ...prev, department: opt.id as Department | 'all', gradeLevel: 'all' }))}
                className={`h-8 px-4 rounded-full text-[11px] font-bold transition-all whitespace-nowrap ${
                  filters.department === opt.id
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-black/45 hover:bg-black/5'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </motion.div>
        ) : (
          <motion.div
            key="grade"
            initial={{ opacity: 0, x: 6 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -6 }}
            className="flex items-center gap-0.5"
          >
            <button
              onClick={() => setFilters(prev => ({ ...prev, department: 'all', gradeLevel: 'all' }))}
              className="h-8 pl-2 pr-3 rounded-full text-black/45 hover:bg-black/5 flex items-center gap-1 transition-all mr-1"
            >
              <ArrowLeft size={12} strokeWidth={3} />
              <span className="text-[10px] font-black uppercase">แผนก</span>
            </button>

            <div className="h-4 w-[1px] bg-black/10 mx-1" />

            <div className="flex items-center gap-0.5 max-w-[300px] overflow-x-auto no-scrollbar ml-1">
              {(DEPARTMENT_CONFIG[filters.department as Department]?.grades || []).map((grade) => (
                <button
                  key={grade}
                  onClick={() => setFilters(prev => ({ ...prev, gradeLevel: grade }))}
                  className={`h-8 px-4 rounded-full text-[11px] font-bold transition-all whitespace-nowrap ${
                    filters.gradeLevel === grade
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-black/45 hover:bg-black/5'
                  }`}
                >
                  {grade}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {hasActiveFilters && (
        <button
          onClick={clearFilters}
          className="h-8 w-8 rounded-full text-rose-500 hover:bg-rose-50 transition-all flex items-center justify-center"
          title="ล้างตัวกรองทั้งหมด"
        >
          <X size={14} />
        </button>
      )}
    </motion.div>
  ) : null;

  return (
    <div className="relative w-full bg-transparent overflow-hidden h-full">
      {headerPortalEl && !selectedSet &&
        createPortal(
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={openCreateSet}
            className="h-9 w-9 rounded-full flex items-center justify-center text-slate-500 hover:text-slate-900 transition-all bg-white/60 backdrop-blur-md border border-slate-300"
            title="เพิ่มชุดข้อสอบ"
          >
            <Plus size={16} strokeWidth={3} />
          </motion.button>,
          headerPortalEl,
        )}
      {headerFiltersPortalEl && filterCapsules && createPortal(filterCapsules, headerFiltersPortalEl)}

      <div className="max-w-[1600px] mx-auto flex flex-col h-full gap-4 pb-10 pt-4 px-6">
        <div className="flex-1 flex gap-4 min-h-0">
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className={`flex-1 flex flex-col min-h-0 ${selectedSet ? 'p-0' : 'p-2'}`}
          >
            {!headerFiltersPortalEl && filterCapsules && (
              <div className="mb-6">
                {filterCapsules}
              </div>
            )}


            {isSetLoading ? (
              <SkeletonList />
            ) : selectedSet ? (
              <QuestionSetQuestionManager
                set={selectedSet}
                onBack={() => setSelectedSet(null)}
                onSetUpdated={setSelectedSet}
              />
            ) : (
              <QuestionSetList
                sets={visibleSets}
                onSelect={setSelectedSet}
                onEdit={openEditSet}
                onDelete={handleDeleteSet}
              />
            )}
          </motion.section>
        </div>
      </div>

      <QuestionSetBuilder
        key={`qsb-${setModalOpen ? (editingSet?.id ?? 'new') : 'closed'}`}
        open={setModalOpen}
        onClose={() => setSetModalOpen(false)}
        initial={editingSet}
        onSubmit={handleSetSubmit}
      />
    </div>
  );
}

function SkeletonList() {
  return (
    <div className="flex-1 space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <motion.div
          key={i}
          animate={{ opacity: [0.4, 0.8, 0.4] }}
          transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.1 }}
          className="h-16 rounded-[1.5rem] bg-white/40"
        />
      ))}
    </div>
  );
}
