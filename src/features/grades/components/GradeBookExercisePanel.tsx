import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { HiMagnifyingGlass, HiOutlinePencilSquare, HiPlus, HiXMark } from 'react-icons/hi2';
import { FileSpreadsheet } from 'lucide-react';
import { useQuestionSetBank } from '@/hooks/useQuestionSetBank';
import type { NewQuestionSet, QuestionSet } from '@/types/questionBank';
import QuestionSetList from '@/features/questionBank/components/QuestionSetList';
import QuestionSetQuestionManager from '@/features/questionBank/components/QuestionSetQuestionManager';
import QuestionSetImportModal from '@/features/questionBank/components/QuestionSetImportModal';
import QuestionSetExamSimulator from '@/features/questionBank/components/QuestionSetExamSimulator';
import ExerciseSetBuilder from './ExerciseSetBuilder';
import { GLASS } from '@/components/layouts/PortalLayout';
import {
  filterExerciseSets,
  mergeImportedExerciseSets,
  type GradeBookExerciseContext,
} from '@/features/grades/utils/exerciseSets';

interface Props {
  context: GradeBookExerciseContext;
}

export default function GradeBookExercisePanel({ context }: Props) {
  const {
    isLoading,
    questionSets,
    addQuestionSet,
    addQuestionSetsBulk,
    updateQuestionSet,
    setQuestionSetPublished,
    deleteQuestionSet,
  } = useQuestionSetBank();

  const [selectedSet, setSelectedSet] = useState<QuestionSet | null>(null);
  const [search, setSearch] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editingSet, setEditingSet] = useState<QuestionSet | null>(null);
  const [simulatingSet, setSimulatingSet] = useState<QuestionSet | null>(null);

  const contextKey = `${context.classId}_${context.subjectId}_${context.academicYearId}_${context.semester}`;

  useEffect(() => {
    setSelectedSet(null);
    setSearch('');
    setIsSearchOpen(false);
  }, [contextKey]);

  const scopedSets = useMemo(
    () => filterExerciseSets(questionSets, context),
    [questionSets, context],
  );

  const visibleSets = useMemo(() => {
    if (!search.trim()) return scopedSets;
    const q = search.trim().toLowerCase();
    return scopedSets.filter((set) => {
      const inTitle = set.title.toLowerCase().includes(q);
      const inDesc = (set.description ?? '').toLowerCase().includes(q);
      const inCode = (set.setCode ?? '').toLowerCase().includes(q);
      return inTitle || inDesc || inCode;
    });
  }, [scopedSets, search]);

  const openCreate = () => {
    setEditingSet(null);
    setBuilderOpen(true);
  };

  const openEdit = (set: QuestionSet) => {
    setEditingSet(set);
    setBuilderOpen(true);
  };

  const handleSetSubmit = async (data: NewQuestionSet) => {
    if (editingSet) {
      await updateQuestionSet(editingSet.id, data);
    } else {
      await addQuestionSet(data);
    }
  };

  const handleImport = async (items: NewQuestionSet[]) => {
    await addQuestionSetsBulk(mergeImportedExerciseSets(items, context));
  };

  const handleDelete = async (set: QuestionSet) => {
    if (!confirm(`ลบแบบฝึกหัดนี้?\n\n${set.title}`)) return;
    if (selectedSet?.id === set.id) setSelectedSet(null);
    await deleteQuestionSet(set);
  };

  const handleTogglePublished = async (set: QuestionSet, isPublished: boolean) => {
    await setQuestionSetPublished(set.id, isPublished);
  };

  if (selectedSet) {
    return (
      <QuestionSetQuestionManager
        set={selectedSet}
        onBack={() => setSelectedSet(null)}
        onSetUpdated={(updated) => {
          setSelectedSet(updated);
        }}
        updateQuestionSet={updateQuestionSet}
      />
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col gap-3 min-h-[320px]"
    >
      <div className="rounded-[1.5rem] p-4 flex flex-col gap-3" style={GLASS}>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <HiOutlinePencilSquare className="text-violet-500 shrink-0" size={18} />
            <div className="min-w-0">
              <p className="text-[13px] font-black text-slate-800 font-sukhumvit truncate">
                แบบฝึกหัด — {context.subjectName}
              </p>
              <p className="text-[10px] text-slate-400 font-sarabun truncate">
                {context.className} · {scopedSets.length} ชุด
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 ml-auto shrink-0">
            {isSearchOpen ? (
              <div className="flex items-center gap-1 rounded-2xl bg-white/80 border border-slate-200 pl-2 pr-1 h-9">
                <HiMagnifyingGlass size={14} className="text-slate-400 shrink-0" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="ค้นหา..."
                  className="w-28 sm:w-40 bg-transparent text-[11px] font-sarabun outline-none"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => { setIsSearchOpen(false); setSearch(''); }}
                  className="w-7 h-7 rounded-xl flex items-center justify-center text-slate-400 hover:bg-slate-100"
                >
                  <HiXMark size={14} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsSearchOpen(true)}
                className="w-9 h-9 rounded-xl bg-white/70 border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-white transition-colors"
                title="ค้นหา"
              >
                <HiMagnifyingGlass size={16} />
              </button>
            )}

            <button
              type="button"
              onClick={() => setImportOpen(true)}
              className="hidden sm:flex items-center gap-1.5 h-9 px-3 rounded-xl bg-white/70 border border-slate-200 text-[11px] font-bold text-slate-600 font-sukhumvit hover:bg-white transition-colors"
            >
              <FileSpreadsheet size={14} />
              นำเข้า
            </button>

            <button
              type="button"
              onClick={openCreate}
              className="flex items-center gap-1.5 h-9 px-3 rounded-xl text-[11px] font-bold font-sukhumvit text-white transition-colors"
              style={{ background: '#0f172a' }}
            >
              <HiPlus size={14} />
              สร้างแบบฝึกหัด
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-[12px] text-slate-400 font-sarabun">กำลังโหลดแบบฝึกหัด...</div>
        ) : (
          <QuestionSetList
            sets={visibleSets}
            emptyTitle="ยังไม่มีแบบฝึกหัด"
            emptyHint="กดปุ่มสร้างแบบฝึกหัดเพื่อเริ่มต้น หรือนำเข้าจากไฟล์ Excel"
            onSelect={setSelectedSet}
            onEdit={openEdit}
            onDelete={handleDelete}
            onSimulate={setSimulatingSet}
            onTogglePublished={handleTogglePublished}
          />
        )}
      </div>

      <ExerciseSetBuilder
        open={builderOpen}
        onClose={() => setBuilderOpen(false)}
        context={context}
        initial={editingSet}
        existingSets={scopedSets}
        onSubmit={handleSetSubmit}
      />

      <QuestionSetImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImport={handleImport}
      />

      {simulatingSet && (
        <QuestionSetExamSimulator
          set={simulatingSet}
          open={Boolean(simulatingSet)}
          onClose={() => setSimulatingSet(null)}
        />
      )}
    </motion.div>
  );
}
