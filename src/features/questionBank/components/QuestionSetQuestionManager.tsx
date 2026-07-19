import { useEffect, useMemo, useState, lazy, Suspense } from 'react';
import { deleteField } from 'firebase/firestore';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, FileSpreadsheet, FileText, Plus } from 'lucide-react';
import { HiBars3 } from 'react-icons/hi2';
import { useSetQuestions } from '@/hooks/useSetQuestions';
import { useAuth } from '@/hooks/useAuth';
import { useActiveAcademicYear } from '@/hooks/useActiveAcademicYear';
import type { Question, QuestionSet, NewQuestion } from '@/types/questionBank';
import {
  buildPdfExamQuestions,
  formatPdfCorrectLabel,
  hasPdfExplanation,
  hasPdfSubQuestions,
  isPdfSubQuestionLabel,
  parsePdfAnswerKeyFromQuestions,
  type PdfAnswerKeyEntry,
  type PdfOptionCount,
} from '@/features/questionBank/utils/pdfExamQuestions';
import QuestionList from './QuestionList';
import QuestionBuilder from './QuestionBuilder';
import { cn } from '@/lib/utils';

const QuestionImportModal = lazy(() => import('./QuestionImportModal'));
const QuestionSimulatorModal = lazy(() => import('./QuestionSimulatorModal'));
const GoogleSheetImportModal = lazy(() => import('./GoogleSheetImportModal'));
const PdfExamSetupModal = lazy(() => import('./PdfExamSetupModal'));

interface Props {
  set: QuestionSet;
  onBack: () => void;
  onSetUpdated: (updated: QuestionSet) => void;
  updateQuestionSet: (id: string, patch: Partial<QuestionSet>) => Promise<void>;
}

export default function QuestionSetQuestionManager({ set, onBack, onSetUpdated, updateQuestionSet }: Props) {
  const { user } = useAuth();
  const { year } = useActiveAcademicYear();
  const {
    isLoading,
    questions,
    addQuestion,
    updateQuestion,
    deleteQuestion,
    duplicateQuestion,
    bulkAddQuestions,
    replaceAllQuestions,
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
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [googleSheetModalOpen, setGoogleSheetModalOpen] = useState(false);
  const [simulatorOpen, setSimulatorOpen] = useState(false);
  const [pdfModalMounted, setPdfModalMounted] = useState(false);
  const [importModalMounted, setImportModalMounted] = useState(false);
  const [googleSheetModalMounted, setGoogleSheetModalMounted] = useState(false);
  const [simulatorMounted, setSimulatorMounted] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [simulatingQuestion, setSimulatingQuestion] = useState<Question | null>(null);
  const [actionsMenuOpen, setActionsMenuOpen] = useState(false);
  const [headerMobileActionsEl, setHeaderMobileActionsEl] = useState<HTMLElement | null>(null);
  const [isLgUp, setIsLgUp] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : true,
  );

  useEffect(() => {
    setHeaderMobileActionsEl(document.getElementById('header-portal-mobile-actions'));
  }, []);

  useEffect(() => {
    const handleResize = () => setIsLgUp(window.innerWidth >= 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!actionsMenuOpen) return;
    const close = () => setActionsMenuOpen(false);
    window.addEventListener('scroll', close, true);
    return () => window.removeEventListener('scroll', close, true);
  }, [actionsMenuOpen]);

  const closeActionsMenu = () => setActionsMenuOpen(false);

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

  const handleOpenPdfSetup = () => {
    setPdfModalMounted(true);
    setPdfModalOpen(true);
  };

  const handleSavePdfMeta = async (
    patch: Pick<QuestionSet, 'examPdfUrl' | 'examPdfFileName' | 'pdfOptionCount' | 'examPdfHiddenPages'>,
  ) => {
    const clearing = !patch.examPdfUrl?.trim();
    if (clearing) {
      await updateQuestionSet(set.id, {
        examPdfUrl: deleteField(),
        examPdfFileName: deleteField(),
        pdfOptionCount: deleteField(),
        examPdfHiddenPages: deleteField(),
        questionType: 'multiple_choice',
      } as never);
      const { examPdfUrl: _url, examPdfFileName: _name, pdfOptionCount: _count, examPdfHiddenPages: _hidden, ...rest } = set;
      onSetUpdated({ ...rest, questionType: 'multiple_choice' });
      return;
    }

    const hidden = patch.examPdfHiddenPages ?? [];
    const next = { ...set, ...patch, examPdfHiddenPages: hidden, questionType: 'multiple_choice' as const };
    await updateQuestionSet(set.id, {
      examPdfUrl: patch.examPdfUrl,
      examPdfFileName: patch.examPdfFileName,
      pdfOptionCount: patch.pdfOptionCount,
      examPdfHiddenPages: hidden.length > 0 ? hidden : deleteField(),
      questionType: 'multiple_choice',
    } as never);
    onSetUpdated(next);
  };

  const handleSaveAnswerKey = async (
    optionCount: PdfOptionCount,
    entries: PdfAnswerKeyEntry[],
  ) => {
    const dataList = buildPdfExamQuestions(optionCount, entries, {
      curriculumYear: year ?? set.curriculumYear,
      subjectGroup: set.subjectGroup,
      department: set.department,
      gradeLevel: set.gradeLevel,
      createdBy: user?.uid ?? '',
      createdByName: user?.displayName ?? user?.email ?? '',
    });
    await replaceAllQuestions(dataList, async (newCount) => {
      await updateQuestionSet(set.id, { questionCount: newCount });
      onSetUpdated({ ...set, questionCount: newCount });
    });
  };

  const handleEditQuestion = (q: Question) => {
    if (set.examPdfUrl) {
      setPdfModalMounted(true);
      setPdfModalOpen(true);
      return;
    }
    setEditingQuestion(q);
    setBuilderOpen(true);
  };

  const handleAddQuestion = () => {
    if (set.examPdfUrl) {
      handleOpenPdfSetup();
      return;
    }
    setEditingQuestion(null);
    setBuilderOpen(true);
  };

  const handleCloseBuilder = () => {
    setBuilderOpen(false);
    setEditingQuestion(null);
  };

  const handleDuplicate = (q: Question) => {
    void duplicateQuestion(q.id, handleCountChange);
  };

  const handleSimulate = (q: Question) => {
    setSimulatingQuestion(q);
    setSimulatorMounted(true);
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

  const actionsMenu = (
    <div className="pointer-events-auto relative flex shrink-0 items-center">
      <button
        type="button"
        onClick={() => setActionsMenuOpen((open) => !open)}
        className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
        title="เมนูจัดการข้อสอบ"
        aria-label="เมนูจัดการข้อสอบ"
        aria-expanded={actionsMenuOpen}
      >
        <HiBars3 className="h-5 w-5" />
      </button>

      {actionsMenuOpen && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[90] bg-black/20"
            aria-label="ปิดเมนู"
            onClick={closeActionsMenu}
          />
          <div
            className={`z-[100] w-[min(240px,calc(100vw-2rem))] rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl ${
              isLgUp ? 'absolute right-0 top-full mt-2' : 'fixed right-4 top-14'
            }`}
          >
            <button
              type="button"
              onClick={() => {
                closeActionsMenu();
                handleOpenPdfSetup();
              }}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[13px] font-bold font-sukhumvit text-slate-900 transition-colors hover:bg-slate-50"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-600">
                <FileText size={14} strokeWidth={2.5} />
              </span>
              <span>อัปโหลด PDF / ตั้งค่าเฉลย</span>
            </button>
            <button
              type="button"
              onClick={() => {
                closeActionsMenu();
                setGoogleSheetModalMounted(true);
                setGoogleSheetModalOpen(true);
              }}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[13px] font-bold font-sukhumvit text-slate-700 transition-colors hover:bg-slate-50"
            >
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200"
                style={{ background: 'linear-gradient(135deg, #e8f0fe 0%, #e6f4ea 100%)' }}
              >
                <svg width="14" height="14" viewBox="0 0 48 48" aria-hidden>
                  <path d="M10 8h28v32H10z" fill="#34a853" rx="3" />
                  <rect x="14" y="16" width="20" height="2.5" rx="1.25" fill="white" />
                  <rect x="14" y="22" width="20" height="2.5" rx="1.25" fill="white" fillOpacity=".8" />
                </svg>
              </span>
              <span>นำเข้า Google Sheets</span>
            </button>
            <button
              type="button"
              onClick={() => {
                closeActionsMenu();
                setImportModalMounted(true);
                setImportModalOpen(true);
              }}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[13px] font-bold font-sukhumvit text-slate-700 transition-colors hover:bg-slate-50"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600">
                <FileSpreadsheet size={14} strokeWidth={2.5} />
              </span>
              <span>นำเข้า CSV/Excel</span>
            </button>
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header — desktop only; mobile uses portal header in QuestionBankManager */}
      <div className="hidden lg:flex items-center justify-between mb-6 shrink-0 px-2">
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
              {set.setCode && (
                <p className="mt-0.5 font-mono text-[10px] font-black text-indigo-600">
                  {set.setCode}
                </p>
              )}
              {set.createdByName && (
                <p className="mt-0.5 text-[10px] font-semibold text-slate-400 font-sarabun truncate">
                  สร้างโดย {set.createdByName}
                </p>
              )}
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

        {isLgUp && (
          <div className="flex items-center gap-2">
            {!set.examPdfUrl && (
              <motion.button
                type="button"
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                onClick={handleAddQuestion}
                className="flex h-10 items-center gap-2 rounded-full bg-slate-900 px-4 text-white shadow-lg shadow-slate-900/15 transition-colors hover:bg-slate-800"
                title="สร้างข้อสอบทีละข้อ"
              >
                <Plus size={18} strokeWidth={3} />
                <span className="text-[13px] font-black font-sukhumvit">เพิ่มข้อสอบ</span>
              </motion.button>
            )}
            {actionsMenu}
          </div>
        )}
      </div>

      {!isLgUp && headerMobileActionsEl && createPortal(actionsMenu, headerMobileActionsEl)}

      {set.examPdfUrl && (
        <div className="mx-2 mb-2 shrink-0 flex items-center justify-between gap-2 rounded-xl border border-blue-200 bg-blue-50/60 px-3 py-2">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="w-9 h-9 rounded-lg bg-white border border-blue-200 flex items-center justify-center text-blue-600 shrink-0">
              <FileText size={16} />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-black text-blue-900 font-sukhumvit leading-tight">ชุดข้อสอบ PDF</p>
              <p className="text-[10px] text-blue-700 truncate">{set.examPdfFileName || 'exam.pdf'}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleOpenPdfSetup}
            className="h-8 px-3 rounded-lg bg-blue-600 text-white text-[11px] font-black font-sukhumvit shrink-0"
          >
            ตั้งค่าข้อที่ถูก
          </button>
        </div>
      )}

      {/* Question list — PDF preview lives in PdfExamSetupModal only */}
      <div className="flex min-h-0 flex-1 flex-col px-2 pb-2">
        <div className="flex min-h-0 flex-1 flex-col">
        {isLoading ? (
          <SkeletonList />
        ) : questions.length === 0 ? (
          set.examPdfUrl ? null : (
            <QuestionList
              questions={[]}
              onSelect={handleEditQuestion}
              onDelete={handleRemoveFromSet}
              onDuplicate={handleDuplicate}
              onSimulate={handleSimulate}
              onAdd={handleAddQuestion}
              deleteTooltip="ลบออกจากชุด"
            />
          )
        ) : set.examPdfUrl ? (
          <PdfAnswerKeyList
            questions={questions}
            optionCount={set.pdfOptionCount ?? 4}
            onEditAnswers={handleOpenPdfSetup}
          />
        ) : (
          <QuestionList
            questions={questions}
            onSelect={handleEditQuestion}
            onDelete={handleRemoveFromSet}
            onDuplicate={handleDuplicate}
            onSimulate={handleSimulate}
            onAdd={handleAddQuestion}
            deleteTooltip="ลบออกจากชุด"
          />
        )}
        </div>
      </div>

      {!set.examPdfUrl && (
        <motion.button
          type="button"
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.94 }}
          onClick={handleAddQuestion}
          className="fixed bottom-24 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-slate-900 text-white shadow-xl shadow-slate-900/25 lg:bottom-8 lg:right-8"
          title="สร้างข้อสอบใหม่"
          aria-label="สร้างข้อสอบใหม่"
        >
          <Plus size={28} strokeWidth={2.5} />
        </motion.button>
      )}

      {pdfModalMounted && (
        <Suspense fallback={null}>
          <PdfExamSetupModal
            open={pdfModalOpen}
            onClose={() => setPdfModalOpen(false)}
            set={set}
            questions={questions}
            onSavePdfMeta={handleSavePdfMeta}
            onSaveAnswerKey={handleSaveAnswerKey}
          />
        </Suspense>
      )}

      <QuestionBuilder
        key={`qb-${builderOpen ? (editingQuestion?.id ?? 'new') : 'closed'}`}
        open={builderOpen}
        onClose={handleCloseBuilder}
        initial={editingQuestion}
        defaultType={set.questionType}
        onSubmit={handleQuestionSubmit}
      />

      {importModalMounted && (
        <Suspense fallback={null}>
          <QuestionImportModal
            open={importModalOpen}
            onClose={() => setImportModalOpen(false)}
            onImport={handleBulkImport}
          />
        </Suspense>
      )}

      {googleSheetModalMounted && (
        <Suspense fallback={null}>
          <GoogleSheetImportModal
            open={googleSheetModalOpen}
            onClose={() => setGoogleSheetModalOpen(false)}
            onImport={handleBulkImport}
          />
        </Suspense>
      )}

      {simulatorMounted && (
        <Suspense fallback={null}>
          <QuestionSimulatorModal
            open={simulatorOpen}
            onClose={() => setSimulatorOpen(false)}
            question={simulatingQuestion}
          />
        </Suspense>
      )}
    </div>
  );
}

function PdfAnswerKeyList({
  questions,
  optionCount,
  onEditAnswers,
}: {
  questions: Question[];
  optionCount: PdfOptionCount;
  onEditAnswers: () => void;
}) {
  const parsed = parsePdfAnswerKeyFromQuestions(questions);
  const savableCount = parsed.entries.filter(
    (_, index) => !hasPdfSubQuestions(parsed.entries, index),
  ).length;

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between px-2 pb-2 shrink-0">
        <p className="text-[11px] font-black text-slate-500 uppercase tracking-wider">
          เฉลย {savableCount} ข้อ
        </p>
        <button
          type="button"
          onClick={onEditAnswers}
          className="text-[11px] font-black text-blue-600 hover:text-blue-800"
        >
          แก้ไขเฉลย
        </button>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 px-1">
        {parsed.entries.map((entry, index) => {
          const isParentWithSubs = hasPdfSubQuestions(parsed.entries, index);
          const isText = entry.mode === 'text';
          const isYesNo = entry.mode === 'yesno';
          return (
          <div
            key={`${entry.label}-${index}`}
            className={cn(
              'flex items-center justify-between gap-2 rounded-2xl border px-4 py-2.5',
              isParentWithSubs
                ? 'border-slate-100 bg-slate-50/80'
                : 'border-slate-200 bg-white',
            )}
          >
            <span className={cn(
              'text-sm font-black font-sukhumvit shrink-0',
              isParentWithSubs ? 'text-slate-500' : 'text-slate-800',
            )}>
              ข้อ {entry.label}
            </span>
            {isParentWithSubs && (
              <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-500 shrink-0">
                มีข้อย่อย
              </span>
            )}
            {entry && isPdfSubQuestionLabel(entry.label) && (
              <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-500 shrink-0">
                ข้อย่อย
              </span>
            )}
            {!isParentWithSubs && isText && (
              <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-600 shrink-0">
                ข้อความ
              </span>
            )}
            {!isParentWithSubs && isYesNo && (
              <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-violet-50 text-violet-600 shrink-0">
                ใช่/ไม่ใช่
              </span>
            )}
            {!isParentWithSubs && hasPdfExplanation(entry) && (
              <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-700 shrink-0">
                มีอธิบาย
              </span>
            )}
            <span className={cn(
              'text-sm font-black truncate text-right min-w-0 flex-1',
              isParentWithSubs
                ? 'text-slate-400'
                : isText
                  ? 'text-blue-600'
                  : 'text-emerald-600',
            )}>
              {isParentWithSubs ? '—' : formatPdfCorrectLabel(optionCount, entry)}
            </span>
          </div>
          );
        })}
      </div>
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
