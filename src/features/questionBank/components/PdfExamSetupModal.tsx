import { useEffect, useMemo, useRef, useState } from 'react';
import { ref, uploadBytes, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { FileText, Loader2, Upload } from 'lucide-react';
import {
  HiOutlineChatBubbleLeftEllipsis,
  HiOutlineChevronDown,
  HiOutlineChevronUp,
  HiOutlineEye,
  HiOutlinePhoto,
  HiOutlinePlus,
  HiOutlineXMark,
} from 'react-icons/hi2';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { storage } from '@/lib/firebase';
import { safeStorageFilename, imageUploadContentType } from '@/lib/safeStorageFilename';
import { cn } from '@/lib/utils';
import type { Question, QuestionSet } from '@/types/questionBank';
import {
  PDF_OPTION_LABELS,
  PDF_YESNO_LABELS,
  type PdfAnswerKeyEntry,
  type PdfOptionCount,
  type PdfQuestionMode,
  hasPdfExplanation,
  getPdfParentLabel,
  hasPdfSubQuestions,
  insertPdfSubQuestion,
  isPdfSubQuestionLabel,
  parsePdfAnswerKeyFromQuestions,
  rebuildPdfEntriesForMainCount,
  removePdfSubQuestion,
} from '@/features/questionBank/utils/pdfExamQuestions';
import { compressPdfIfNeeded, PdfCompressError } from '@/features/questionBank/utils/compressPdf';
import {
  normalizeHiddenPdfPages,
  validateExamPdfHiddenPages,
} from '@/features/questionBank/utils/pdfExamPages';
import { PdfPageViewer } from '@/features/exam/components/PdfExamViewer';
import { loadPdfJs, PDFJS_GET_DOCUMENT_OPTIONS } from '@/lib/pdfjsLoader';
import { fetchPdfBytesForViewer } from '@/lib/storagePdfBytes';
import { deleteQuestionSetPdfStorage } from '@/lib/questionSetStorage';

interface Props {
  open: boolean;
  onClose: () => void;
  set: QuestionSet;
  questions: Question[];
  onSavePdfMeta: (patch: Pick<QuestionSet, 'examPdfUrl' | 'examPdfFileName' | 'pdfOptionCount' | 'examPdfHiddenPages'>) => Promise<void>;
  onSaveAnswerKey: (
    optionCount: PdfOptionCount,
    entries: PdfAnswerKeyEntry[],
  ) => Promise<void>;
}

const PDF_OPTION_GRID_COLS: Record<PdfOptionCount, string> = {
  4: 'grid-cols-4',
  5: 'grid-cols-5',
  6: 'grid-cols-6',
};

function defaultEntries(count: number): PdfAnswerKeyEntry[] {
  return rebuildPdfEntriesForMainCount([], count);
}

/** คอลัมน์: ข้อ | รูปแบบ | คำตอบ | อธิบาย (+ ลบข้อย่อย) */
const ANSWER_ROW_GRID =
  'grid grid-cols-[minmax(3.25rem,4.25rem)_minmax(7rem,8.25rem)_minmax(6rem,1fr)_minmax(2.75rem,3.25rem)] sm:grid-cols-[minmax(3.5rem,4.5rem)_8.75rem_minmax(7rem,1fr)_minmax(3rem,3.5rem)] gap-x-1.5 sm:gap-x-2';

const COMPACT_ANSWER_BTN =
  'h-6 min-w-0 rounded-md text-[11px] font-black border transition-all flex items-center justify-center';

const COMPACT_MODE_BTN =
  'flex-1 min-w-0 h-6 px-0 text-[8px] sm:text-[8px] font-black transition-colors whitespace-nowrap leading-none';

export default function PdfExamSetupModal({
  open,
  onClose,
  set,
  questions,
  onSavePdfMeta,
  onSaveAnswerKey,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const explanationImageInputRef = useRef<HTMLInputElement>(null);

  const [expandedExplanation, setExpandedExplanation] = useState<number | null>(null);
  const [explanationUploadIndex, setExplanationUploadIndex] = useState<number | null>(null);
  const [explanationUploading, setExplanationUploading] = useState(false);

  const parsed = useMemo(
    () => (questions.length > 0 ? parsePdfAnswerKeyFromQuestions(questions) : null),
    [questions],
  );

  const [pdfUrl, setPdfUrl] = useState(set.examPdfUrl ?? '');
  const [pdfFileName, setPdfFileName] = useState(set.examPdfFileName ?? '');
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [questionCountInput, setQuestionCountInput] = useState(String(parsed?.questionCount ?? 10));
  const parsedQuestionCount = useMemo(() => {
    const trimmed = questionCountInput.trim();
    if (trimmed === '') return null;
    const n = Number(trimmed);
    if (!Number.isFinite(n)) return null;
    const int = Math.floor(n);
    if (int < 1 || int > 200) return null;
    return int;
  }, [questionCountInput]);
  const [optionCount, setOptionCount] = useState<PdfOptionCount>(set.pdfOptionCount ?? parsed?.optionCount ?? 4);
  const [entries, setEntries] = useState<PdfAnswerKeyEntry[]>(
    parsed?.entries ?? defaultEntries(10),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isDeletingPdf, setIsDeletingPdf] = useState(false);
  const [showMobilePdfPreview, setShowMobilePdfPreview] = useState(false);
  const [pdfTotalPages, setPdfTotalPages] = useState(0);
  const [hiddenPages, setHiddenPages] = useState<number[]>(set.examPdfHiddenPages ?? []);
  const [isHiddenPagesExpanded, setIsHiddenPagesExpanded] = useState(false);
  const [isAnswerKeyExpanded, setIsAnswerKeyExpanded] = useState(true);

  const handlePdfPreviewLoad = useMemo(
    () => (state: { totalPages: number }) => {
      setPdfTotalPages(state.totalPages);
    },
    [],
  );

  useEffect(() => {
    if (!open) return;
    setHiddenPages(set.examPdfHiddenPages ?? []);
    setPdfTotalPages(0);
    setPdfUrl(set.examPdfUrl ?? '');
    setPdfFileName(set.examPdfFileName ?? '');
    setUploadProgress(null);
    setIsCompressing(false);
    setUploadError(null);
    setExpandedExplanation(null);
    setShowMobilePdfPreview(false);
    setIsDeletingPdf(false);
    setIsHiddenPagesExpanded((set.examPdfHiddenPages?.length ?? 0) > 0);
    setIsAnswerKeyExpanded(true);
    const nextParsed = questions.length > 0 ? parsePdfAnswerKeyFromQuestions(questions) : null;
    const count = nextParsed?.questionCount ?? 10;
    setQuestionCountInput(String(count));
    setOptionCount(set.pdfOptionCount ?? nextParsed?.optionCount ?? 4);
    setEntries(nextParsed?.entries.length ? nextParsed.entries : defaultEntries(count));
  }, [open, set.examPdfUrl, set.examPdfFileName, set.examPdfHiddenPages, set.pdfOptionCount, questions]);

  useEffect(() => {
    if (!pdfUrl) {
      setPdfTotalPages(0);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const pdfjs = await loadPdfJs();
        const bytes = await fetchPdfBytesForViewer(pdfUrl);
        const doc = await pdfjs.getDocument({ data: bytes, ...PDFJS_GET_DOCUMENT_OPTIONS }).promise;
        if (!cancelled) setPdfTotalPages(doc.numPages);
      } catch {
        // popup preview can still load later
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pdfUrl]);

  useEffect(() => {
    if (pdfTotalPages <= 0) return;
    setHiddenPages((prev) => normalizeHiddenPdfPages(prev, pdfTotalPages));
  }, [pdfTotalPages]);

  const hiddenPagesError = useMemo(
    () => validateExamPdfHiddenPages(pdfTotalPages, hiddenPages),
    [pdfTotalPages, hiddenPages],
  );

  const toggleHiddenPage = (page: number) => {
    setHiddenPages((prev) =>
      prev.includes(page)
        ? prev.filter((p) => p !== page)
        : [...prev, page].sort((a, b) => a - b),
    );
  };

  const buildPdfMetaPatch = () => ({
    examPdfUrl: pdfUrl,
    examPdfFileName: pdfFileName,
    pdfOptionCount: optionCount,
    examPdfHiddenPages: normalizeHiddenPdfPages(hiddenPages, pdfTotalPages),
  });

  useEffect(() => {
    if (parsedQuestionCount === null) return;
    setEntries((prev) => rebuildPdfEntriesForMainCount(prev, parsedQuestionCount));
  }, [parsedQuestionCount]);

  const mainQuestionCount = useMemo(
    () => entries.filter((entry) => !entry.label.includes('.')).length,
    [entries],
  );

  const canSaveAnswers = pdfUrl.trim().length > 0 && parsedQuestionCount !== null
    && mainQuestionCount === parsedQuestionCount
    && entries.length > 0
    && !hiddenPagesError
    && entries.every((entry, index) => {
      if (hasPdfSubQuestions(entries, index)) return true;
      if (entry.mode === 'text') return entry.correctText.trim().length > 0;
      if (entry.mode === 'yesno') return entry.correctIndex >= 0 && entry.correctIndex <= 1;
      return entry.correctIndex >= 0 && entry.correctIndex < optionCount;
    });

  const updateEntry = (index: number, patch: Partial<PdfAnswerKeyEntry>) => {
    setEntries((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  };

  const setEntryMode = (index: number, mode: PdfQuestionMode) => {
    setEntries((prev) => {
      const current = prev[index];
      if (!current) return prev;
      const next = [...prev];
      next[index] = {
        ...current,
        mode,
        correctIndex:
          mode === 'yesno'
            ? 0
            : mode === 'choice'
              ? current.correctIndex >= 0 && current.correctIndex < optionCount
                ? current.correctIndex
                : -1
              : 0,
        correctText: mode === 'text' ? current.correctText : '',
      };
      return next;
    });
  };

  const toggleExplanationPanel = (index: number) => {
    setExpandedExplanation((prev) => (prev === index ? null : index));
  };

  const handleExplanationImageUpload = async (file: File) => {
    if (explanationUploadIndex === null) return;
    if (!file.type.startsWith('image/')) {
      setUploadError('กรุณาเลือกไฟล์รูปภาพ');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('รูปภาพใหญ่เกิน 5 MB');
      return;
    }

    setExplanationUploading(true);
    setUploadError(null);
    try {
      const storageRef = ref(
        storage,
        `questions/images/${set.id}/explanation-${explanationUploadIndex + 1}-${safeStorageFilename(file.name)}`,
      );
      await uploadBytes(storageRef, file, { contentType: imageUploadContentType(file) });
      const url = await getDownloadURL(storageRef);
      updateEntry(explanationUploadIndex, { explanationImageUrl: url });
      setExpandedExplanation(explanationUploadIndex);
    } catch (err) {
      console.error(err);
      setUploadError('อัปโหลดรูปอธิบายไม่สำเร็จ');
    } finally {
      setExplanationUploading(false);
      setExplanationUploadIndex(null);
    }
  };

  const handlePdfUpload = async (file: File) => {
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setUploadError('กรุณาเลือกไฟล์ PDF เท่านั้น');
      return;
    }

    setUploadError(null);
    setUploadProgress(0);

    let uploadFile = file;
    if (file.size > 25 * 1024 * 1024) {
      setIsCompressing(true);
      try {
        uploadFile = await compressPdfIfNeeded(file, (pct) => setUploadProgress(pct));
      } catch (err) {
        console.error(err);
        setUploadError(
          err instanceof PdfCompressError
            ? err.message
            : 'บีบอัดไฟล์ไม่สำเร็จ — ลองลดขนาดไฟล์ก่อนอัปโหลด',
        );
        setUploadProgress(null);
        setIsCompressing(false);
        return;
      } finally {
        setIsCompressing(false);
      }
    }

    setUploadProgress(0);
    const storageRef = ref(
      storage,
      `question_sets/pdfs/${set.id}/${safeStorageFilename(uploadFile.name)}`,
    );
    const uploadTask = uploadBytesResumable(storageRef, uploadFile, { contentType: 'application/pdf' });

    uploadTask.on(
      'state_changed',
      (snap) => {
        const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
        setUploadProgress(pct);
      },
      (err) => {
        console.error(err);
        setUploadError('อัปโหลดไม่สำเร็จ กรุณาลองใหม่');
        setUploadProgress(null);
      },
      async () => {
        try {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          setPdfUrl(downloadURL);
          setPdfFileName(uploadFile.name);
          setUploadProgress(null);
          await onSavePdfMeta({
            examPdfUrl: downloadURL,
            examPdfFileName: uploadFile.name,
            pdfOptionCount: optionCount,
            examPdfHiddenPages: [],
          });
          setHiddenPages([]);
        } catch (err) {
          console.error(err);
          setUploadError('บันทึกลิงก์ PDF ไม่สำเร็จ');
          setUploadProgress(null);
        }
      },
    );
  };

  const handleDeletePdf = async () => {
    if (!pdfUrl.trim()) return;
    if (!confirm(`ลบไฟล์ PDF ออกจากระบบ?\n\n${pdfFileName || 'exam.pdf'}`)) return;

    setUploadError(null);
    setIsDeletingPdf(true);
    const urlToDelete = pdfUrl;
    try {
      await deleteQuestionSetPdfStorage(set.id, urlToDelete);
      setPdfUrl('');
      setPdfFileName('');
      setShowMobilePdfPreview(false);
      setHiddenPages([]);
      await onSavePdfMeta({ examPdfUrl: '', examPdfFileName: '', pdfOptionCount: optionCount, examPdfHiddenPages: [] });
    } catch (err) {
      console.error(err);
      setUploadError('ลบไฟล์ PDF ไม่สำเร็จ');
    } finally {
      setIsDeletingPdf(false);
    }
  };

  const handleSaveAnswerKey = async () => {
    if (!canSaveAnswers) return;
    setIsSaving(true);
    try {
      await onSavePdfMeta(buildPdfMetaPatch());
      await onSaveAnswerKey(optionCount, entries);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
    <Sheet open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <SheetContent
        side="right"
        showCloseButton={false}
        aria-describedby={undefined}
        className={cn(
          '!inset-0 !left-0 !right-0 !top-0 !bottom-0',
          '!h-dvh !w-screen !max-w-none sm:!max-w-none',
          '!rounded-none border-0 p-0 flex flex-col overflow-hidden bg-white',
        )}
      >
        <SheetHeader className="flex-row items-center justify-between gap-3 px-4 sm:px-5 py-3 border-b border-slate-100 text-left shrink-0 space-y-0">
          <SheetTitle className="text-base font-black text-slate-800 font-sukhumvit flex-1 min-w-0 leading-snug truncate">
            {set.title}
          </SheetTitle>
          <SheetClose asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="shrink-0 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-800"
            >
              <HiOutlineXMark className="w-4 h-4" />
              <span className="sr-only">ปิด</span>
            </Button>
          </SheetClose>
        </SheetHeader>

        <div className="flex-1 min-h-0 overflow-hidden flex flex-col lg:flex-row">
          {pdfUrl ? (
            <aside className="hidden lg:flex lg:w-[min(48%,520px)] xl:w-[42%] shrink-0 flex-col border-r border-slate-100 bg-muted/20 p-3 min-h-0">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-2 shrink-0 font-sukhumvit">
                ตัวอย่าง PDF
              </p>
              <PdfPageViewer
                url={pdfUrl}
                className="min-h-0 flex-1"
                onLoadStateChange={handlePdfPreviewLoad}
              />
            </aside>
          ) : null}

          <div className="flex-1 min-h-0 overflow-y-auto px-3 sm:px-5 py-2 flex flex-col gap-2 w-full sm:max-w-4xl lg:max-w-none lg:mx-0">
          <section className="space-y-1.5 shrink-0">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider">1. ไฟล์ PDF</p>
            <div
              className={cn(
                'rounded-xl border border-dashed px-3 py-2.5 transition-colors',
                pdfUrl ? 'border-emerald-200 bg-emerald-50/50' : 'border-slate-200 bg-slate-50/80',
              )}
            >
              {pdfUrl ? (
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-white border border-emerald-200 flex items-center justify-center shrink-0 text-emerald-600">
                    <FileText size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-black text-slate-800 truncate leading-tight">{pdfFileName || 'exam.pdf'}</p>
                    <p className="text-[10px] font-bold text-emerald-600">
                      <span className="lg:hidden">พร้อมตั้งค่าเฉลย — แตะไอคอนตาเพื่อดู PDF</span>
                      <span className="hidden lg:inline">พร้อมตั้งค่าเฉลย — ดูตัวอย่างด้านซ้าย</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      aria-label="ดูตัวอย่าง PDF"
                      onClick={() => setShowMobilePdfPreview(true)}
                      className="lg:hidden w-8 h-8 rounded-lg border border-emerald-200 bg-white text-emerald-600 hover:bg-emerald-50 flex items-center justify-center transition-colors"
                    >
                      <HiOutlineEye className="w-4 h-4" />
                    </button>
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-lg h-8 px-2.5 text-[11px] font-bold shrink-0 text-rose-600 border-rose-200 hover:bg-rose-50 hover:text-rose-700"
                      onClick={() => void handleDeletePdf()}
                      disabled={uploadProgress !== null || isCompressing || isDeletingPdf}
                    >
                      {isDeletingPdf ? 'กำลังลบ...' : 'ลบไฟล์'}
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadProgress !== null || isCompressing}
                  className="w-full flex items-center justify-center gap-2 py-1.5 text-slate-500 hover:text-slate-700 transition-colors"
                >
                  {isCompressing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
                      <span className="text-xs font-bold text-amber-700">กำลังบีบอัดไฟล์ {uploadProgress ?? 0}%</span>
                    </>
                  ) : uploadProgress !== null ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                      <span className="text-xs font-bold text-blue-600">กำลังอัปโหลด {uploadProgress}%</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-5 h-5 text-slate-400" />
                      <span className="text-xs font-black text-slate-700 font-sukhumvit">เลือกไฟล์ PDF</span>
                      <span className="text-[10px] text-slate-400">· ไฟล์ใหญ่จะบีบอัดอัตโนมัติ (สูงสุด 25 MB)</span>
                    </>
                  )}
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handlePdfUpload(file);
                  e.target.value = '';
                }}
              />
              {uploadError && (
                <p className="mt-2 text-xs font-bold text-rose-600">{uploadError}</p>
              )}
            </div>
          </section>

          {pdfUrl && pdfTotalPages > 0 ? (
            <section className="space-y-1.5 shrink-0">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider font-sukhumvit">
                    2. ซ่อนหน้าในห้องสอบ
                  </p>
                  <p className="text-[10px] font-medium text-slate-500 leading-snug mt-0.5">
                    {isHiddenPagesExpanded
                      ? 'ติ๊กหน้าที่ไม่ต้องการให้นักเรียนเห็น — ตัวอย่างด้านซ้ายยังแสดงครบทุกหน้า'
                      : hiddenPages.length > 0
                        ? `ซ่อน ${hiddenPages.length} หน้า · นักเรียนเห็น ${pdfTotalPages - hiddenPages.length} จาก ${pdfTotalPages} หน้า`
                        : `ทั้งหมด ${pdfTotalPages} หน้า · นักเรียนเห็นครบทุกหน้า`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsHiddenPagesExpanded((prev) => !prev)}
                  className="shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors"
                  aria-expanded={isHiddenPagesExpanded}
                  aria-label={isHiddenPagesExpanded ? 'หุบรายการเลือกหน้า' : 'ขยายรายการเลือกหน้า'}
                >
                  {isHiddenPagesExpanded ? (
                    <HiOutlineChevronUp className="w-4 h-4" />
                  ) : (
                    <HiOutlineChevronDown className="w-4 h-4" />
                  )}
                </button>
              </div>
              {isHiddenPagesExpanded ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-2.5 max-h-36 overflow-y-auto">
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-1.5">
                    {Array.from({ length: pdfTotalPages }, (_, i) => i + 1).map((page) => {
                      const hidden = hiddenPages.includes(page);
                      return (
                        <label
                          key={page}
                          className={cn(
                            'flex items-center gap-1.5 rounded-lg border px-2 py-1.5 cursor-pointer transition-colors',
                            hidden
                              ? 'border-amber-300 bg-amber-50 text-amber-900'
                              : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300',
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={hidden}
                            onChange={() => toggleHiddenPage(page)}
                            className="h-3.5 w-3.5 shrink-0 rounded border-slate-300 text-amber-600 focus:ring-amber-500/30"
                          />
                          <span className="text-[11px] font-bold tabular-nums">หน้า {page}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ) : null}
              {isHiddenPagesExpanded && hiddenPages.length > 0 ? (
                <p className="text-[10px] font-bold text-amber-700">
                  ซ่อน {hiddenPages.length} หน้า · นักเรียนเห็น {pdfTotalPages - hiddenPages.length} หน้า
                </p>
              ) : null}
              {hiddenPagesError ? (
                <p className="text-xs font-bold text-rose-600">{hiddenPagesError}</p>
              ) : null}
            </section>
          ) : null}

          <section className="space-y-1.5 flex flex-col flex-1 min-h-0">
            <div className="flex items-start justify-between gap-2 shrink-0">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider font-sukhumvit">
                  {pdfUrl && pdfTotalPages > 0 ? '3. ตั้งค่าเฉลย' : '2. ตั้งค่าเฉลย'}
                </p>
                {!isAnswerKeyExpanded ? (
                  <p className="text-[10px] font-medium text-slate-500 leading-snug mt-0.5">
                    {mainQuestionCount} ข้อ · {optionCount} ตัวเลือก
                    {entries.length > mainQuestionCount
                      ? ` · รวม ${entries.length} รายการ`
                      : ''}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => setIsAnswerKeyExpanded((prev) => !prev)}
                className="shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors"
                aria-expanded={isAnswerKeyExpanded}
                aria-label={isAnswerKeyExpanded ? 'หุบตั้งค่าเฉลย' : 'ขยายตั้งค่าเฉลย'}
              >
                {isAnswerKeyExpanded ? (
                  <HiOutlineChevronUp className="w-4 h-4" />
                ) : (
                  <HiOutlineChevronDown className="w-4 h-4" />
                )}
              </button>
            </div>
            {isAnswerKeyExpanded ? (
            <>
            <div className="grid grid-cols-2 gap-2 shrink-0">
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase ml-1">จำนวนข้อ (หลัก)</label>
                <Input
                  type="number"
                  min={1}
                  max={200}
                  inputMode="numeric"
                  value={questionCountInput}
                  onChange={(e) => setQuestionCountInput(e.target.value)}
                  onBlur={() => {
                    const trimmed = questionCountInput.trim();
                    if (trimmed === '') return;
                    const n = Math.max(1, Math.min(200, Number(trimmed) || 1));
                    setQuestionCountInput(String(n));
                  }}
                  className="mt-0.5 h-8 rounded-lg text-sm font-bold"
                />
              </div>
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase ml-1">ตัวเลือก (ข้อปรนัย)</label>
                <div className="mt-0.5 flex gap-1.5">
                  {([4, 5, 6] as const).map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setOptionCount(n)}
                      className={cn(
                        'flex-1 h-8 rounded-lg text-[11px] font-black border transition-all',
                        optionCount === n
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50',
                      )}
                    >
                      {n} ตัวเลือก
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {entries.length > mainQuestionCount && (
              <p className="text-[10px] font-bold text-slate-500 shrink-0">
                รวม {entries.length} รายการ (ข้อหลัก {mainQuestionCount} + ข้อย่อย {entries.length - mainQuestionCount})
              </p>
            )}

            <div className="rounded-xl border border-slate-200 overflow-hidden flex flex-col flex-1 min-h-0">
              <div className={cn(ANSWER_ROW_GRID, 'bg-slate-50 border-b border-slate-200 px-2 sm:px-3 py-1 text-[8px] font-black text-slate-500 uppercase shrink-0 leading-none')}>
                <span>ข้อ</span>
                <span>รูปแบบ</span>
                <span>คำตอบที่ถูก</span>
                <span className="text-center">อธิบาย</span>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto">
                {entries.map((entry, i) => {
                  const isParentWithSubs = hasPdfSubQuestions(entries, i);
                  return (
                  <div key={i} className="border-b border-slate-100 last:border-b-0">
                    <div className={cn(ANSWER_ROW_GRID, 'items-center px-2 sm:px-3 py-1')}>
                      <div className="flex items-center gap-0.5 shrink-0">
                        <span
                          className={cn(
                            'text-[11px] font-black tabular-nums leading-none',
                            isPdfSubQuestionLabel(entry.label) ? 'text-slate-500' : 'text-slate-700',
                          )}
                        >
                          {entry.label}
                        </span>
                        <button
                          type="button"
                          title={`เพิ่มข้อย่อย ${getPdfParentLabel(entry.label)}.`}
                          aria-label={`เพิ่มข้อย่อยของข้อ ${entry.label}`}
                          onClick={() => setEntries((prev) => insertPdfSubQuestion(prev, i))}
                          className="w-4 h-4 rounded border border-slate-200 bg-white text-slate-500 hover:border-blue-300 hover:text-blue-600 flex items-center justify-center shrink-0"
                        >
                          <HiOutlinePlus className="w-2.5 h-2.5" />
                        </button>
                      </div>
                      {isParentWithSubs ? (
                        <p className="col-span-3 text-[10px] font-bold text-slate-400 leading-none">
                          ตั้งค่าที่ข้อย่อยด้านล่าง
                        </p>
                      ) : (
                        <>
                      <div className="flex rounded-md border border-slate-200 overflow-hidden bg-white min-w-0">
                        <button
                          type="button"
                          onClick={() => setEntryMode(i, 'choice')}
                          className={cn(
                            COMPACT_MODE_BTN,
                            entry.mode === 'choice'
                              ? 'bg-blue-600 text-white'
                              : 'text-slate-500 hover:bg-slate-50',
                          )}
                        >
                          ตัวเลือก
                        </button>
                        <button
                          type="button"
                          onClick={() => setEntryMode(i, 'yesno')}
                          className={cn(
                            COMPACT_MODE_BTN,
                            'border-l border-slate-200',
                            entry.mode === 'yesno'
                              ? 'bg-blue-600 text-white'
                              : 'text-slate-500 hover:bg-slate-50',
                          )}
                        >
                          ใช่/ไม่
                        </button>
                        <button
                          type="button"
                          onClick={() => setEntryMode(i, 'text')}
                          className={cn(
                            COMPACT_MODE_BTN,
                            'border-l border-slate-200',
                            entry.mode === 'text'
                              ? 'bg-blue-600 text-white'
                              : 'text-slate-500 hover:bg-slate-50',
                          )}
                        >
                          ข้อความ
                        </button>
                      </div>
                      {entry.mode === 'choice' ? (
                        <div
                          className={cn(
                            'grid gap-0.5 min-w-0',
                            PDF_OPTION_GRID_COLS[optionCount],
                          )}
                        >
                          {PDF_OPTION_LABELS.slice(0, optionCount).map((label, oi) => {
                            const active = entry.correctIndex === oi;
                            return (
                              <button
                                key={label}
                                type="button"
                                onClick={() => updateEntry(i, { correctIndex: oi })}
                                className={cn(
                                  COMPACT_ANSWER_BTN,
                                  active
                                    ? 'bg-green-600 text-white border-green-600'
                                    : 'bg-white text-slate-600 border-slate-200 hover:border-green-300',
                                )}
                              >
                                {label}
                              </button>
                            );
                          })}
                        </div>
                      ) : entry.mode === 'yesno' ? (
                        <div className="grid grid-cols-2 gap-0.5 min-w-0">
                          {PDF_YESNO_LABELS.map((label, oi) => {
                            const active = entry.correctIndex === oi;
                            return (
                              <button
                                key={label}
                                type="button"
                                onClick={() => updateEntry(i, { correctIndex: oi })}
                                className={cn(
                                  COMPACT_ANSWER_BTN,
                                  'px-0.5 text-[10px]',
                                  active
                                    ? 'bg-blue-600 text-white border-blue-600'
                                    : 'bg-white text-slate-600 border-slate-200 hover:border-blue-200',
                                )}
                              >
                                {label}
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <Input
                          value={entry.correctText}
                          onChange={(e) => updateEntry(i, { correctText: e.target.value })}
                          placeholder="เฉลย"
                          className="h-6 rounded-md text-[11px] font-bold min-w-0 px-2"
                        />
                      )}
                      <div className="flex items-center justify-end gap-0.5 shrink-0 justify-self-end">
                        {isPdfSubQuestionLabel(entry.label) && (
                          <button
                            type="button"
                            title="ลบข้อย่อย"
                            aria-label={`ลบข้อย่อย ${entry.label}`}
                            onClick={() => setEntries((prev) => removePdfSubQuestion(prev, i))}
                            className="w-6 h-6 rounded-md border border-slate-200 bg-white text-slate-400 hover:border-rose-300 hover:text-rose-600 flex items-center justify-center shrink-0"
                          >
                            <HiOutlineXMark className="w-3 h-3" />
                          </button>
                        )}
                        <button
                          type="button"
                          aria-label={`อธิบายข้อ ${entry.label}`}
                          aria-expanded={expandedExplanation === i}
                          onClick={() => toggleExplanationPanel(i)}
                          className={cn(
                            'w-6 h-6 rounded-md border flex items-center justify-center transition-colors shrink-0',
                            expandedExplanation === i || hasPdfExplanation(entry)
                              ? 'bg-blue-50 border-blue-300 text-blue-600'
                              : 'bg-white border-slate-200 text-slate-400 hover:border-blue-200 hover:text-blue-500',
                          )}
                        >
                          <HiOutlineChatBubbleLeftEllipsis className="w-3.5 h-3.5" />
                        </button>
                      </div>
                        </>
                      )}
                    </div>

                    {!isParentWithSubs && expandedExplanation === i && (
                      <div className="px-2.5 sm:px-3 pb-2.5 pt-0 space-y-2 bg-slate-50/80">
                        <textarea
                          value={entry.explanationText}
                          onChange={(e) => updateEntry(i, { explanationText: e.target.value })}
                          placeholder="ข้อความอธิบาย (ไม่บังคับ)"
                          rows={2}
                          className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 resize-y min-h-[3.5rem]"
                        />
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={explanationUploading}
                            onClick={() => {
                              setExplanationUploadIndex(i);
                              explanationImageInputRef.current?.click();
                            }}
                            className="h-7 rounded-lg text-[11px] font-bold gap-1.5 px-2.5"
                          >
                            {explanationUploading && explanationUploadIndex === i ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <HiOutlinePhoto className="w-3.5 h-3.5" />
                            )}
                            เพิ่มรูป
                          </Button>
                          {entry.explanationImageUrl && (
                            <div className="relative flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-1 pr-2">
                              <img
                                src={entry.explanationImageUrl}
                                alt={`อธิบายข้อ ${i + 1}`}
                                className="h-10 w-10 rounded-md object-cover"
                              />
                              <span className="text-[10px] font-bold text-slate-500 hidden sm:inline">รูปอธิบาย</span>
                              <button
                                type="button"
                                aria-label="ลบรูปอธิบาย"
                                onClick={() => updateEntry(i, { explanationImageUrl: '' })}
                                className="ml-1 w-6 h-6 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-rose-50 hover:text-rose-600"
                              >
                                <HiOutlineXMark className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  );
                })}
              </div>
              <input
                ref={explanationImageInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleExplanationImageUpload(file);
                  e.target.value = '';
                }}
              />
            </div>
            </>
            ) : null}
          </section>
          </div>
        </div>

        <SheetFooter className="px-3 sm:px-5 py-3 border-t border-slate-100 gap-1.5 shrink-0 sm:flex-row sm:justify-end w-full">
          <Button type="button" variant="ghost" onClick={onClose} className="rounded-lg h-8 text-xs font-bold">
            ยกเลิก
          </Button>
          <Button
            type="button"
            disabled={!canSaveAnswers || isSaving || uploadProgress !== null}
            onClick={() => void handleSaveAnswerKey()}
            className="rounded-lg h-8 bg-slate-900 text-white text-xs font-bold px-4"
          >
            {isSaving ? 'กำลังบันทึก...' : 'บันทึกเฉลย'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>

    <Dialog open={showMobilePdfPreview && !!pdfUrl} onOpenChange={(next) => !next && setShowMobilePdfPreview(false)}>
      <DialogContent
        showCloseButton={false}
        className="z-[60] flex h-[min(90dvh,820px)] w-[calc(100%-2rem)] max-w-4xl flex-col gap-0 overflow-hidden rounded-[1.5rem] border border-slate-200/60 p-0"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200/70 px-4 py-3">
          <div className="min-w-0">
            <DialogTitle className="truncate text-[15px] font-black text-slate-800 font-sukhumvit">
              {pdfFileName || set.title}
            </DialogTitle>
            <p className="text-[11px] text-slate-500 font-sarabun">ตัวอย่าง PDF ชุดข้อสอบ</p>
          </div>
          <button
            type="button"
            onClick={() => setShowMobilePdfPreview(false)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
            aria-label="ปิด"
          >
            <HiOutlineXMark className="w-4 h-4" />
          </button>
        </div>
        {pdfUrl ? (
          <PdfPageViewer
            url={pdfUrl}
            className="min-h-0 flex-1"
            onLoadStateChange={handlePdfPreviewLoad}
          />
        ) : null}
      </DialogContent>
    </Dialog>
    </>
  );
}
