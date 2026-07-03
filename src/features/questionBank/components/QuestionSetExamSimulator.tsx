import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { ClipboardList, FileText, PlayCircle, X } from 'lucide-react';
import { HiChevronLeft } from 'react-icons/hi2';
import { useSetQuestions } from '@/hooks/useSetQuestions';
import type { QuestionSet } from '@/types/questionBank';
import { PdfAnswerSheet, PdfPagePagination, PdfPageViewer } from '@/features/exam/components/PdfExamViewer';
import { mapQuestionsToExamSheet } from '@/features/questionBank/utils/mapQuestionsToExamSheet';
import { getVisiblePdfPages, snapToVisiblePdfPage } from '@/features/questionBank/utils/pdfExamPages';
import {
  gradeSimulationAnswers,
  type SimulationGradeSummary,
} from '@/features/questionBank/utils/gradeSimulationAnswers';
import { colors } from '@/lib/designTokens';
import { cn } from '@/lib/utils';

interface Props {
  set: QuestionSet;
  open: boolean;
  onClose: () => void;
}

function SimulationScoreSummary({ summary }: { summary: SimulationGradeSummary }) {
  return (
    <div className="mb-3 shrink-0 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="font-sukhumvit text-[13px] font-black text-slate-800">สรุปผลการจำลองสอบ</p>
          <p className="font-sarabun text-[11px] font-bold text-slate-500">
            ถูก {summary.correct} · ผิด {summary.wrong} · ไม่ได้ตอบ {summary.unanswered}
          </p>
        </div>
        <div className="text-right">
          <p className="font-sukhumvit text-2xl font-black text-indigo-600">
            {summary.correct}/{summary.total}
          </p>
          <p className="font-sarabun text-[11px] font-bold text-slate-500">{summary.scorePercent}%</p>
        </div>
      </div>
    </div>
  );
}

export default function QuestionSetExamSimulator({ set, open, onClose }: Props) {
  const { questions, isLoading } = useSetQuestions(open ? set.id : null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [gradeSummary, setGradeSummary] = useState<SimulationGradeSummary | null>(null);
  const [panelMode, setPanelMode] = useState<'pdf' | 'answers'>('pdf');
  const [pdfPageNum, setPdfPageNum] = useState(1);
  const [pdfTotalPages, setPdfTotalPages] = useState(0);

  const hiddenPages = set.examPdfHiddenPages ?? [];
  const visiblePages = useMemo(
    () => getVisiblePdfPages(pdfTotalPages, hiddenPages),
    [pdfTotalPages, hiddenPages],
  );

  const sheetQuestions = useMemo(() => mapQuestionsToExamSheet(questions), [questions]);

  const answeredCount = useMemo(
    () => sheetQuestions.filter((q) => (answers[q.id] ?? '').trim().length > 0).length,
    [answers, sheetQuestions],
  );

  useEffect(() => {
    if (!open) return;
    setAnswers({});
    setSubmitted(false);
    setGradeSummary(null);
    setPanelMode('pdf');
    setPdfPageNum(1);
    setPdfTotalPages(0);
  }, [open, set.id]);

  useEffect(() => {
    if (pdfTotalPages <= 0 || visiblePages.length === 0) return;
    setPdfPageNum((prev) => snapToVisiblePdfPage(prev, visiblePages));
  }, [pdfTotalPages, visiblePages]);

  const handlePdfLoadState = useCallback((state: { totalPages: number; loading: boolean; error: string | null }) => {
    setPdfTotalPages(state.totalPages);
  }, []);

  const handleAnswer = useCallback((qId: string, value: string) => {
    if (submitted) return;
    setAnswers((prev) => ({ ...prev, [qId]: value }));
  }, [submitted]);

  const handleSubmit = useCallback(() => {
    const summary = gradeSimulationAnswers(questions, answers);
    setGradeSummary(summary);
    setSubmitted(true);
    setPanelMode('answers');
  }, [answers, questions]);

  const handleRetry = useCallback(() => {
    setAnswers({});
    setSubmitted(false);
    setGradeSummary(null);
  }, []);

  if (!open) return null;

  const canSimulate = Boolean(set.examPdfUrl?.trim()) && sheetQuestions.length > 0;

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[110] flex flex-col font-sarabun" style={{ background: colors.palette.shell }}>
          <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                <PlayCircle size={20} strokeWidth={2.5} />
              </div>
              <div className="min-w-0">
                <p className="truncate font-sukhumvit text-[15px] font-black text-slate-800">{set.title}</p>
                <p className="font-sarabun text-[11px] font-bold text-slate-400">
                  {submitted && gradeSummary
                    ? `ส่งคำตอบแล้ว · ได้ ${gradeSummary.correct}/${gradeSummary.total} ข้อ (${gradeSummary.scorePercent}%)`
                    : 'โหมดจำลองการสอบ — ไม่แสดงเฉลยจนกว่าจะส่งคำตอบ'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              aria-label="ปิดโหมดจำลอง"
            >
              <X size={20} />
            </button>
          </header>

          {!canSimulate && !isLoading ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
              <p className="font-sukhumvit text-[15px] font-black text-slate-700">ยังจำลองชุดนี้ไม่ได้</p>
              <p className="max-w-sm font-sarabun text-[13px] text-slate-500">
                {!set.examPdfUrl?.trim()
                  ? 'ชุดข้อสอบนี้ยังไม่มีไฟล์ PDF'
                  : 'ชุดข้อสอบนี้ยังไม่ได้ตั้งค่าเฉลย'}
              </p>
              <button
                type="button"
                onClick={onClose}
                className="mt-2 rounded-2xl border border-slate-200 bg-white px-6 py-2.5 font-sukhumvit text-[13px] font-black text-slate-600"
              >
                กลับ
              </button>
            </div>
          ) : (
            <>
              <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 bg-white/80 px-4 py-2 lg:hidden">
                <button
                  type="button"
                  onClick={() => setPanelMode('pdf')}
                  className={cn(
                    'flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 font-sukhumvit text-[12px] font-black transition-colors',
                    panelMode === 'pdf' ? 'bg-slate-900 text-white' : 'text-slate-500',
                  )}
                >
                  <FileText size={14} />
                  ข้อสอบ PDF
                </button>
                <button
                  type="button"
                  onClick={() => setPanelMode('answers')}
                  className={cn(
                    'flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 font-sukhumvit text-[12px] font-black transition-colors',
                    panelMode === 'answers' ? 'bg-slate-900 text-white' : 'text-slate-500',
                  )}
                >
                  <ClipboardList size={14} />
                  กระดาษคำตอบ
                </button>
              </div>

              <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
                <div
                  className={cn(
                    'flex min-h-0 min-w-0 flex-col overflow-hidden border-slate-200 px-3 py-3 lg:w-[58%] lg:border-r lg:px-5',
                    panelMode !== 'pdf' ? 'hidden lg:flex' : 'flex flex-1',
                  )}
                >
                  <p className="mb-2 hidden shrink-0 font-sukhumvit text-[11px] font-black uppercase tracking-[0.15em] text-slate-500 lg:block">
                    ข้อสอบ PDF
                  </p>
                  {set.examPdfUrl ? (
                    <PdfPageViewer
                      url={set.examPdfUrl}
                      className="min-h-0 flex-1"
                      pageNum={pdfPageNum}
                      onPageNumChange={setPdfPageNum}
                      onLoadStateChange={handlePdfLoadState}
                      showPagination={false}
                      hiddenPages={hiddenPages}
                      applyHiddenPages
                    />
                  ) : null}
                </div>

                <div
                  className={cn(
                    'flex min-h-0 min-w-0 flex-col overflow-hidden px-3 py-3 lg:flex-1 lg:px-5',
                    panelMode !== 'answers' ? 'hidden lg:flex' : 'flex flex-1',
                  )}
                >
                  {isLoading ? (
                    <div className="flex flex-1 items-center justify-center font-sarabun text-sm text-slate-400">
                      กำลังโหลดแบบฟอร์มคำตอบ...
                    </div>
                  ) : (
                    <>
                      {submitted && gradeSummary && (
                        <SimulationScoreSummary summary={gradeSummary} />
                      )}
                      <PdfAnswerSheet
                        questions={sheetQuestions}
                        answers={answers}
                        readOnly={submitted}
                        onAnswer={handleAnswer}
                        className="min-h-0 flex-1"
                        headerText={
                          submitted
                            ? 'ผลการตรวจ — ข้อผิดและข้อที่ไม่ได้ตอบจะถูกไฮไลต์'
                            : 'กรอกคำตอบ (ดูโจทย์จาก PDF)'
                        }
                        gradeByQuestionId={submitted ? gradeSummary?.byQuestionId : undefined}
                        correctAnswerByQuestionId={submitted ? gradeSummary?.correctAnswerByQuestionId : undefined}
                        correctOptionIdByQuestionId={submitted ? gradeSummary?.correctOptionIdByQuestionId : undefined}
                      />
                    </>
                  )}
                </div>
              </div>

              <footer className="flex shrink-0 flex-col gap-2 border-t border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="font-sarabun text-[12px] font-bold text-slate-500">
                  {submitted && gradeSummary
                    ? `คะแนน ${gradeSummary.correct}/${gradeSummary.total} (${gradeSummary.scorePercent}%) · ผิด ${gradeSummary.wrong} ข้อ`
                    : `ตอบแล้ว ${answeredCount}/${sheetQuestions.length} ข้อ`}
                </p>
                {pdfTotalPages > 0 && panelMode === 'pdf' && !submitted && (
                  <PdfPagePagination
                    pageNum={pdfPageNum}
                    totalPages={pdfTotalPages}
                    visiblePages={visiblePages.length > 0 ? visiblePages : undefined}
                    onPageChange={setPdfPageNum}
                    appearance="inline"
                    className="justify-center sm:justify-end"
                  />
                )}
                <div className="flex flex-wrap items-center justify-end gap-2">
                  {!submitted ? (
                    <button
                      type="button"
                      onClick={handleSubmit}
                      disabled={answeredCount === 0 || isLoading}
                      className="inline-flex items-center justify-center rounded-2xl bg-indigo-600 px-5 py-2.5 font-sukhumvit text-[13px] font-black text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      ส่งคำตอบ
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleRetry}
                      className="inline-flex items-center justify-center rounded-2xl border border-indigo-200 bg-indigo-50 px-5 py-2.5 font-sukhumvit text-[13px] font-black text-indigo-700 hover:bg-indigo-100"
                    >
                      ทำใหม่
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={onClose}
                    className="inline-flex items-center justify-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-5 py-2.5 font-sukhumvit text-[13px] font-black text-slate-700 hover:bg-slate-50"
                  >
                    <HiChevronLeft className="h-4 w-4" />
                    ออกจากโหมดจำลอง
                  </button>
                </div>
              </footer>
            </>
          )}
        </div>
      )}
    </AnimatePresence>
  );
}
