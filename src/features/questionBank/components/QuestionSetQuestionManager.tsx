import { useEffect, useState, lazy, Suspense } from 'react';
import { deleteField } from 'firebase/firestore';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { FileSpreadsheet, FileText, Plus } from 'lucide-react';
import { HiChevronLeft, HiChevronRight } from 'react-icons/hi2';
import { useSetQuestions } from '@/hooks/useSetQuestions';
import { useAuth } from '@/hooks/useAuth';
import { useActiveAcademicYear } from '@/hooks/useActiveAcademicYear';
import { findActiveRoomsUsingQuestionSet } from '@/lib/exam/findActiveRoomsUsingQuestionSet';
import type { ExamRoom } from '@/types/exam';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
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
import { HEADER_ICON_BTN, HEADER_ICON_BTN_GROUP } from '@/lib/headerIconBtn';

const QuestionImportModal = lazy(() => import('./QuestionImportModal'));
const QuestionSimulatorModal = lazy(() => import('./QuestionSimulatorModal'));
const GoogleSheetImportModal = lazy(() => import('./GoogleSheetImportModal'));
const PdfExamSetupModal = lazy(() => import('./PdfExamSetupModal'));

interface Props {
  set: QuestionSet;
  onBack: () => void;
  onSetUpdated: (updated: QuestionSet) => void;
  updateQuestionSet: (id: string, patch: Partial<QuestionSet>) => Promise<void>;
  /** Parent already renders browse nav (home/back). */
  hideDesktopBack?: boolean;
  /** Host for + / import actions in parent browse header (desktop). */
  desktopActionsHost?: HTMLElement | null;
  /** Open PDF / Sheets / CSV once after creating a set from browse +. */
  launchAction?: 'pdf' | 'sheets' | 'csv' | null;
  onLaunchActionConsumed?: () => void;
}

export default function QuestionSetQuestionManager({
  set,
  onBack,
  onSetUpdated,
  updateQuestionSet,
  hideDesktopBack = false,
  desktopActionsHost = null,
  launchAction = null,
  onLaunchActionConsumed,
}: Props) {
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
  const [activeRoomWarning, setActiveRoomWarning] = useState<{
    rooms: ExamRoom[];
    resolve: (proceed: boolean) => void;
  } | null>(null);
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

  useEffect(() => {
    if (!launchAction) return;
    if (launchAction === 'pdf') {
      setPdfModalMounted(true);
      setPdfModalOpen(true);
    } else if (launchAction === 'sheets') {
      setGoogleSheetModalMounted(true);
      setGoogleSheetModalOpen(true);
    } else if (launchAction === 'csv') {
      setImportModalMounted(true);
      setImportModalOpen(true);
    }
    onLaunchActionConsumed?.();
  }, [launchAction, onLaunchActionConsumed]);

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
    // บันทึกเฉลยลบคำถามเดิมทั้งหมดแล้วสร้างใหม่ด้วย id ใหม่ (ดู replaceAllQuestions) —
    // ถ้ามีห้องสอบกำลังเปิดใช้ชุดนี้อยู่ นักเรียนที่ทำสอบค้างจะ join คำถามเดิมไม่ได้อีก
    if (year) {
      const activeRooms = await findActiveRoomsUsingQuestionSet(set.id, String(year));
      if (activeRooms.length > 0) {
        const proceed = await new Promise<boolean>((resolve) => {
          setActiveRoomWarning({ rooms: activeRooms, resolve });
        });
        if (!proceed) return false;
      }
    }

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
    return true;
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
        className={HEADER_ICON_BTN}
        title="เพิ่ม / จัดการข้อสอบ"
        aria-label="เพิ่ม / จัดการข้อสอบ"
        aria-expanded={actionsMenuOpen}
      >
        <Plus size={16} strokeWidth={3} />
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
            {!set.examPdfUrl && (
              <button
                type="button"
                onClick={() => {
                  closeActionsMenu();
                  handleAddQuestion();
                }}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[13px] font-bold font-sukhumvit text-slate-900 transition-colors hover:bg-slate-50"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700">
                  <Plus size={14} strokeWidth={3} />
                </span>
                <span>เพิ่มข้อสอบ</span>
              </button>
            )}
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

  const desktopActionButtons = actionsMenu;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {/* Desktop header when parent does not own browse nav */}
      {!hideDesktopBack && (
        <div className="mb-6 hidden shrink-0 items-center justify-between px-2 lg:flex">
          <div className="flex min-w-0 items-center gap-4">
            <div className="inline-flex h-9 shrink-0 items-center overflow-hidden rounded-full border border-border bg-muted/60 shadow-xs">
              <button
                type="button"
                onClick={onBack}
                className="flex h-full w-9 items-center justify-center text-foreground transition-colors hover:bg-muted"
                title="กลับ"
                aria-label="กลับ"
              >
                <HiChevronLeft className="h-4 w-4" />
              </button>
              <span className="h-4 w-px shrink-0 bg-border" aria-hidden />
              <button
                type="button"
                disabled
                className="flex h-full w-9 cursor-not-allowed items-center justify-center text-muted-foreground/35"
                title="ไปข้างหน้า"
                aria-label="ไปข้างหน้า"
              >
                <HiChevronRight className="h-4 w-4" />
              </button>
            </div>
            <div className="flex min-w-0 items-center gap-3">
              {set.coverImage && (
                <div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                  <img src={set.coverImage} alt="" className="h-full w-full object-cover" />
                </div>
              )}
              <div className="min-w-0">
                <h3 className="truncate font-sukhumvit text-lg font-black leading-tight text-slate-800">
                  {set.title}
                </h3>
                {set.createdByName && (
                  <p className="mt-0.5 truncate font-sarabun text-[10px] font-semibold text-slate-400">
                    สร้างโดย {set.createdByName}
                  </p>
                )}
              </div>
            </div>
          </div>

          {isLgUp && (
            <div className={cn('flex', HEADER_ICON_BTN_GROUP)}>
              {desktopActionButtons}
            </div>
          )}
        </div>
      )}

      {hideDesktopBack && isLgUp && desktopActionsHost
        && createPortal(desktopActionButtons, desktopActionsHost)}
      {/* Fallback if parent host not ready yet */}
      {hideDesktopBack && isLgUp && !desktopActionsHost && (
        <div className={cn('mb-2 flex shrink-0 justify-end px-1', HEADER_ICON_BTN_GROUP)}>
          {desktopActionButtons}
        </div>
      )}
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
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-2 pb-2">
        {isLoading ? (
          <SkeletonList />
        ) : questions.length === 0 ? (
          set.examPdfUrl ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-10 text-center">
              <FileText className="h-10 w-10 text-muted-foreground/40" />
              <div>
                <p className="font-sukhumvit text-[13px] font-black text-foreground">
                  ยังไม่มีเฉลยในชุดนี้
                </p>
                <p className="mt-1 font-sarabun text-[11px] text-muted-foreground">
                  กดตั้งค่าข้อที่ถูกเพื่อบันทึกเฉลยจาก PDF
                </p>
              </div>
              <Button
                type="button"
                onClick={handleOpenPdfSetup}
                className="h-9 rounded-xl px-4 text-[12px] font-black font-sukhumvit"
              >
                ตั้งค่าข้อที่ถูก
              </Button>
            </div>
          ) : (
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

      <AlertDialog
        open={activeRoomWarning !== null}
        onOpenChange={(next) => {
          if (!next && activeRoomWarning) {
            activeRoomWarning.resolve(false);
            setActiveRoomWarning(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>มีห้องสอบกำลังเปิดใช้ชุดข้อสอบนี้อยู่</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-left">
                <p>
                  การบันทึกเฉลยจะลบคำถามเดิมทั้งหมดแล้วสร้างใหม่ — นักเรียนที่กำลังทำข้อสอบอยู่ในห้องต่อไปนี้จะดูข้อสอบ/กระดาษคำตอบไม่ได้อีก:
                </p>
                <ul className="list-disc space-y-1 pl-5 font-medium text-foreground">
                  {activeRoomWarning?.rooms.map((room) => (
                    <li key={room.id}>{room.title}{room.className ? ` (${room.className})` : ''}</li>
                  ))}
                </ul>
                <p>แนะนำให้รอห้องสอบปิดก่อน หรือกดยืนยันเฉพาะกรณีที่ยอมรับความเสี่ยงนี้</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => activeRoomWarning?.resolve(false)}>
              ยกเลิก
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => activeRoomWarning?.resolve(true)}
            >
              ยืนยันบันทึกทับ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
    <div className="flex flex-col">
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
      <div className="space-y-1.5 px-1 pb-2">
        {parsed.entries.map((entry, index) => {
          const isParentWithSubs = hasPdfSubQuestions(parsed.entries, index);
          const isText = entry.mode === 'text';
          const isYesNo = entry.mode === 'yesno';
          return (
          <div
            key={`${entry.label}-${index}`}
            className={cn(
              'flex items-center justify-between gap-2 rounded-lg border px-4 py-2.5',
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
