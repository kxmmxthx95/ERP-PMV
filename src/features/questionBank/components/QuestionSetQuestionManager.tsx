import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Plus, FileQuestion, FileSpreadsheet } from 'lucide-react';
import { useSetQuestions } from '@/hooks/useSetQuestions';
import { useQuestionSetBank } from '@/hooks/useQuestionSetBank';
import type { Question, QuestionSet, NewQuestion } from '@/types/questionBank';
import QuestionList from './QuestionList';
import QuestionBuilder from './QuestionBuilder';
import QuestionImportModal from './QuestionImportModal';
import QuestionSimulatorModal from './QuestionSimulatorModal';
import GoogleSheetImportModal from './GoogleSheetImportModal';

interface Props {
  set: QuestionSet;
  onBack: () => void;
  onSetUpdated: (updated: QuestionSet) => void;
}

export default function QuestionSetQuestionManager({ set, onBack, onSetUpdated }: Props) {
  const { updateQuestionSet } = useQuestionSetBank();
  const {
    isLoading,
    questions,
    addQuestion,
    updateQuestion,
    deleteQuestion,
    duplicateQuestion,
    bulkAddQuestions,
  } = useSetQuestions(set.id);

  const stats = useMemo(() => {
    return questions.reduce(
      (acc, q) => {
        acc[q.difficulty] = (acc[q.difficulty] || 0) + 1;
        return acc;
      },
      { easy: 0, medium: 0, hard: 0 } as Record<string, number>,
    );
  }, [questions]);

  const [builderOpen, setBuilderOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [googleSheetModalOpen, setGoogleSheetModalOpen] = useState(false);
  const [simulatorOpen, setSimulatorOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [simulatingQuestion, setSimulatingQuestion] = useState<Question | null>(null);

  // Auto-sync questionCount if it gets out of sync
  useEffect(() => {
    if (!isLoading && questions.length !== (set.questionCount ?? 0)) {
      console.log(`[QuestionSetQuestionManager] Syncing count: ${set.questionCount} -> ${questions.length}`);
      void updateQuestionSet(set.id, { questionCount: questions.length });
      onSetUpdated({ ...set, questionCount: questions.length });
    }
  }, [isLoading, questions.length, set.id, set.questionCount, updateQuestionSet, onSetUpdated, set]);

  // Callback passed to add/delete to keep questionCount in sync
  const handleCountChange = async (delta: number) => {
    const next = { ...set, questionCount: Math.max(0, (set.questionCount ?? 0) + delta) };
    await updateQuestionSet(set.id, { questionCount: next.questionCount });
    onSetUpdated(next);
  };

  const handleAddQuestion = () => {
    setEditingQuestion(null);
    setBuilderOpen(true);
  };

  const handleEditQuestion = (q: Question) => {
    setEditingQuestion(q);
    setBuilderOpen(true);
  };

  const handleDuplicate = (q: Question) => {
    void duplicateQuestion(q.id, handleCountChange);
  };

  const handleSimulate = (q: Question) => {
    setSimulatingQuestion(q);
    setSimulatorOpen(true);
  };

  const handleQuestionSubmit = async (data: NewQuestion) => {
    if (editingQuestion) {
      await updateQuestion(editingQuestion.id, data);
    } else {
      // Inherit metadata from set so questions are self-descriptive
      const enriched: NewQuestion = {
        ...data,
        subjectGroup: set.subjectGroup,
        curriculumYear: set.curriculumYear,
        department: set.department,
        gradeLevel: set.gradeLevel,
        orderIndex: questions.length,
      };
      await addQuestion(enriched, handleCountChange);
    }
  };

  const handleBulkImport = async (newQuestions: NewQuestion[]) => {
    const enriched = newQuestions.map(q => ({
      ...q,
      subjectGroup: set.subjectGroup,
      curriculumYear: set.curriculumYear,
      department: set.department,
      gradeLevel: set.gradeLevel,
    }));
    await bulkAddQuestions(enriched, handleCountChange);
  };

  const handleRemoveFromSet = async (q: Question) => {
    if (!confirm(`ลบข้อสอบข้อนี้ออกจากชุด?`)) return;
    await deleteQuestion(q.id, handleCountChange);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 shrink-0 px-2">
        <div className="flex items-center gap-4">
          <motion.button
            whileHover={{ scale: 1.1, x: -2 }}
            whileTap={{ scale: 0.9 }}
            onClick={onBack}
            className="w-10 h-10 rounded-full bg-white border border-slate-300 text-slate-500 flex items-center justify-center transition-all hover:text-slate-900"
          >
            <ArrowLeft size={20} strokeWidth={3} />
          </motion.button>
          <div className="flex items-center gap-3">
            {set.coverImage && (
              <div className="w-10 h-10 rounded-xl overflow-hidden border border-slate-200 bg-slate-50 shrink-0">
                <img src={set.coverImage} alt="" className="w-full h-full object-cover" />
              </div>
            )}
            <div className="min-w-0">
              <h3 className="text-lg font-black text-slate-800 font-sukhumvit leading-tight truncate">
                {set.title}
              </h3>
              <div className="flex items-center gap-3 mt-1">
                <p className="text-[11px] font-black text-slate-400 font-sarabun uppercase tracking-widest">
                  {questions.length} ข้อสอบ
                </p>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span className="text-[10px] font-black text-emerald-600 font-sukhumvit">ง่าย: {stats.easy}</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 ml-1" />
                  <span className="text-[10px] font-black text-amber-600 font-sukhumvit">กลาง: {stats.medium}</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400 ml-1" />
                  <span className="text-[10px] font-black text-rose-600 font-sukhumvit">ยาก: {stats.hard}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Google Sheets */}
          <motion.button
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setGoogleSheetModalOpen(true)}
            className="w-10 h-10 rounded-full border border-slate-200 flex items-center justify-center transition-all hover:border-slate-300 overflow-hidden"
            title="นำเข้าจาก Google Sheets"
            style={{ background: 'linear-gradient(135deg, #e8f0fe 0%, #e6f4ea 100%)' }}
          >
            <svg width="18" height="18" viewBox="0 0 48 48">
              <path d="M10 8h28v32H10z" fill="#34a853" rx="3"/>
              <rect x="14" y="16" width="20" height="2.5" rx="1.25" fill="white"/>
              <rect x="14" y="22" width="20" height="2.5" rx="1.25" fill="white" fillOpacity=".8"/>
              <rect x="14" y="28" width="13" height="2.5" rx="1.25" fill="white" fillOpacity=".6"/>
            </svg>
          </motion.button>

          {/* CSV Import */}
          <motion.button
            whileHover={{ opacity: 0.8 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setImportModalOpen(true)}
            className="w-10 h-10 rounded-full bg-white border border-slate-300 text-slate-600 flex items-center justify-center transition-all hover:bg-slate-50"
            title="นำเข้า CSV/Excel"
          >
            <FileSpreadsheet size={18} strokeWidth={3} />
          </motion.button>

          {/* Add question */}
          <motion.button
            whileHover={{ opacity: 0.8 }}
            whileTap={{ scale: 0.9 }}
            onClick={handleAddQuestion}
            className="w-10 h-10 rounded-full bg-slate-900 text-white flex items-center justify-center border border-slate-900 transition-all hover:bg-slate-800"
            title="เพิ่มข้อสอบ"
          >
            <Plus size={18} strokeWidth={3} />
          </motion.button>
        </div>
      </div>

      {/* Question List */}
      <div className="flex-1 min-h-0 bg-white/40 rounded-[2rem] p-4 overflow-hidden flex flex-col">
        {isLoading ? (
          <SkeletonList />
        ) : questions.length === 0 ? (
          <EmptyState onAdd={handleAddQuestion} />
        ) : (
          <QuestionList
            questions={questions}
            onSelect={handleEditQuestion}
            onDelete={handleRemoveFromSet}
            onDuplicate={handleDuplicate}
            onSimulate={handleSimulate}
            deleteTooltip="ลบออกจากชุด"
          />
        )}
      </div>

      <QuestionBuilder
        key={`qb-${builderOpen ? (editingQuestion?.id ?? 'new') : 'closed'}`}
        open={builderOpen}
        onClose={() => setBuilderOpen(false)}
        initial={editingQuestion}
        defaultType={set.questionType}
        onSubmit={handleQuestionSubmit}
      />

      <QuestionImportModal
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onImport={handleBulkImport}
      />

      <GoogleSheetImportModal
        open={googleSheetModalOpen}
        onClose={() => setGoogleSheetModalOpen(false)}
        onImport={handleBulkImport}
      />

      <QuestionSimulatorModal
        open={simulatorOpen}
        onClose={() => setSimulatorOpen(false)}
        question={simulatingQuestion}
      />
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center text-slate-400">
      <div className="w-16 h-16 rounded-3xl bg-white border border-slate-300 flex items-center justify-center mb-4 text-slate-300">
        <FileQuestion size={32} />
      </div>
      <p className="text-[14px] font-black text-slate-500 font-sukhumvit">ยังไม่มีข้อสอบในชุดนี้</p>
      <p className="text-[12px] font-medium text-slate-400 font-sarabun mt-1 mb-4">
        กดปุ่มด้านบนเพื่อเพิ่มข้อสอบทีละข้อ
      </p>
      <motion.button
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        onClick={onAdd}
        className="h-9 px-6 rounded-full bg-slate-900 text-white text-[12px] font-black font-sukhumvit flex items-center gap-2"
      >
        <Plus size={14} strokeWidth={3} />
        เพิ่มข้อสอบแรก
      </motion.button>
    </div>
  );
}

function SkeletonList() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <motion.div
          key={i}
          animate={{ opacity: [0.4, 0.8, 0.4] }}
          transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.1 }}
          className="h-16 rounded-[1.5rem] bg-white/60"
        />
      ))}
    </div>
  );
}
