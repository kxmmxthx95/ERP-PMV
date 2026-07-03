import { useEffect, useRef, useState, useCallback, useId, useMemo } from 'react';
import {
  HiChevronLeft,
  HiChevronRight,
  HiMagnifyingGlassMinus,
  HiMagnifyingGlassPlus,
  HiArrowPath,
} from 'react-icons/hi2';
import { Document, Page, PDFJS_DOCUMENT_OPTIONS } from '@/lib/reactPdfSetup';
import { IndeterminateProgress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { fetchPdfBytesForViewer } from '@/lib/storagePdfBytes';
import { parsePdfLabelFromQuestionText } from '@/features/questionBank/utils/pdfExamQuestions';
import {
  getVisiblePdfPages,
  snapToVisiblePdfPage,
} from '@/features/questionBank/utils/pdfExamPages';
import { getPartBadgeTheme } from '@/features/exam/utils/partBadgeTheme';
import EssayAnswerPanel from '@/features/exam/components/EssayAnswerPanel';
import { cn } from '@/lib/utils';

type ExamQuestion = {
  id: string;
  text: string;
  questionType?: string;
  options: { id: string; text: string }[];
};

export type AnswerSheetPartGroup = {
  partLabel: string;
  title: string;
  questions: ExamQuestion[];
};

function AnswerSheetQuestionRow({
  item,
  index,
  rowIndex,
  answers,
  readOnly,
  onAnswer,
  gradeStatus,
  correctAnswerHint,
  correctOptionId,
  roomId,
  attemptId,
  onCameraSessionChange,
}: {
  item: ExamQuestion;
  index: number;
  rowIndex: number;
  answers: Record<string, string>;
  readOnly: boolean;
  onAnswer: (qId: string, value: string) => void;
  gradeStatus?: 'correct' | 'wrong' | 'unanswered';
  correctAnswerHint?: string;
  correctOptionId?: string;
  roomId?: string;
  attemptId?: string;
  onCameraSessionChange?: (active: boolean) => void;
}) {
  const isText = item.questionType === 'essay';
  const questionLabel = parsePdfLabelFromQuestionText(item.text, index + 1);
  const selected = answers[item.id];
  const isAltRow = rowIndex % 2 === 1;
  const isGraded = gradeStatus != null;

  return (
    <div
      className={cn(
        'rounded-xl border px-2.5 py-2 shadow-sm',
        gradeStatus === 'correct' && 'border-emerald-300 bg-emerald-50/80',
        gradeStatus === 'wrong' && 'border-rose-300 bg-rose-50/80',
        gradeStatus === 'unanswered' && isGraded && 'border-amber-300 bg-amber-50/80',
        !isGraded && (isAltRow
          ? 'border-slate-200/80 bg-slate-100/80'
          : 'border-slate-200 bg-white'),
      )}
    >
      {isText ? (
        <>
          <div className="mb-1.5 flex items-center gap-2">
            <span className="font-sukhumvit text-[12px] font-black text-slate-800">
              ข้อ {questionLabel}
            </span>
            <span className="rounded-md bg-blue-50 px-1.5 py-0.5 text-[9px] font-black text-blue-600">
              ข้อความ
            </span>
          </div>
          {roomId && attemptId ? (
            <EssayAnswerPanel
              questionId={item.id}
              value={answers[item.id]}
              readOnly={readOnly}
              roomId={roomId}
              attemptId={attemptId}
              onSave={onAnswer}
              onCameraSessionChange={onCameraSessionChange}
            />
          ) : (
            <Input
              value={answers[item.id] ?? ''}
              onChange={(e) => { if (!readOnly) onAnswer(item.id, e.target.value); }}
              disabled={readOnly}
              placeholder="พิมพ์คำตอบ"
              className={cn(
                'h-8 rounded-lg text-xs font-bold',
                gradeStatus === 'wrong' && 'border-rose-300 bg-white',
                gradeStatus === 'correct' && 'border-emerald-300 bg-white',
              )}
            />
          )}
          {gradeStatus === 'wrong' && correctAnswerHint && correctAnswerHint !== '-' && (
            <p className="mt-1.5 font-sarabun text-[10px] font-bold text-rose-600">
              เฉลย: {correctAnswerHint}
            </p>
          )}
        </>
      ) : (
        <div className="flex items-center gap-2">
          <span className="w-10 shrink-0 font-sukhumvit text-[12px] font-black text-slate-800">
            ข้อ {questionLabel}
          </span>
          <div className="flex min-w-0 flex-1 gap-1">
            {item.options.map((opt) => {
              const isSelected = selected === opt.id;
              const isCorrectChoice = isGraded && correctOptionId === opt.id;
              const isWrongChoice = isGraded && gradeStatus === 'wrong' && isSelected;
              const label = opt.text?.trim() || opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  disabled={readOnly}
                  onClick={() => {
                    if (readOnly) return;
                    onAnswer(item.id, isSelected ? '' : opt.id);
                  }}
                  className={cn(
                    'flex h-9 min-w-0 flex-1 items-center justify-center rounded-full border font-sukhumvit text-[13px] font-black transition-all',
                    isWrongChoice
                      ? 'border-rose-600 bg-rose-600 text-white shadow-sm shadow-rose-600/20'
                      : isCorrectChoice
                        ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm shadow-emerald-600/20'
                        : isSelected
                          ? 'border-blue-600 bg-blue-600 text-white shadow-sm shadow-blue-600/20'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-blue-400 hover:text-blue-700',
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
          {isGraded && (gradeStatus === 'wrong' || gradeStatus === 'unanswered') && correctAnswerHint && correctAnswerHint !== '-' && !correctOptionId && (
            <p className="mt-1.5 font-sarabun text-[10px] font-bold text-rose-600">
              เฉลย: {correctAnswerHint}
            </p>
          )}
          {isGraded && gradeStatus === 'unanswered' && correctOptionId && (
            <p className="mt-1.5 font-sarabun text-[10px] font-bold text-amber-700">
              ไม่ได้ตอบ · เฉลย: {correctAnswerHint}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

const PDF_ZOOM_MIN = 0.5;
const PDF_ZOOM_MAX = 2;
const PDF_ZOOM_STEP = 0.25;

function clampPdfZoom(value: number) {
  return Math.min(PDF_ZOOM_MAX, Math.max(PDF_ZOOM_MIN, value));
}

function getTouchDistance(touches: TouchList): number {
  if (touches.length < 2) return 0;
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.hypot(dx, dy);
}

export function PdfPagePagination({
  pageNum,
  totalPages,
  onPageChange,
  disabled = false,
  className,
  appearance = 'toolbar',
  enableKeyboard = true,
  showPageInput = true,
  visiblePages,
}: {
  pageNum: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
  className?: string;
  /** toolbar = card bar; inline = minimal (e.g. fixed exam footer) */
  appearance?: 'toolbar' | 'inline';
  /** ArrowLeft / ArrowRight when focus is not in a text field */
  enableKeyboard?: boolean;
  /** Editable page number (Enter or blur to jump) */
  showPageInput?: boolean;
  /** When set, navigation skips hidden PDF pages; pageNum is the actual PDF page number */
  visiblePages?: number[];
}) {
  const pageInputId = useId();
  const useVisible = Boolean(visiblePages && visiblePages.length > 0);
  const visiblePageIndex = useVisible ? visiblePages!.indexOf(pageNum) : -1;
  const displayPageNum = useVisible
    ? (visiblePageIndex >= 0 ? visiblePageIndex + 1 : 1)
    : pageNum;
  const displayTotalPages = useVisible ? visiblePages!.length : totalPages;
  const [draftPage, setDraftPage] = useState(String(displayPageNum));

  useEffect(() => {
    setDraftPage(String(displayPageNum));
  }, [displayPageNum]);

  const changePage = useCallback(
    (nextDisplayPage: number) => {
      const clamped = Math.min(displayTotalPages, Math.max(1, nextDisplayPage));
      if (useVisible && visiblePages) {
        onPageChange(visiblePages[clamped - 1] ?? visiblePages[0]);
      } else {
        onPageChange(clamped);
      }
    },
    [displayTotalPages, onPageChange, useVisible, visiblePages],
  );

  const goPrev = useCallback(() => {
    changePage(displayPageNum - 1);
  }, [changePage, displayPageNum]);

  const goNext = useCallback(() => {
    changePage(displayPageNum + 1);
  }, [changePage, displayPageNum]);

  const commitDraftPage = useCallback(() => {
    const parsed = Number.parseInt(draftPage, 10);
    if (Number.isNaN(parsed)) {
      setDraftPage(String(displayPageNum));
      return;
    }
    changePage(parsed);
  }, [draftPage, changePage, displayPageNum]);

  useEffect(() => {
    if (!enableKeyboard || disabled || totalPages <= 0) return;

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        target instanceof HTMLInputElement
        || target instanceof HTMLTextAreaElement
        || (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        goPrev();
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        goNext();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [disabled, enableKeyboard, goNext, goPrev, displayTotalPages]);

  if (displayTotalPages <= 0) return null;

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-2 sm:gap-3',
        appearance === 'toolbar' &&
          'rounded-2xl border border-border bg-card px-3 py-2 shadow-sm',
        appearance === 'inline' && 'px-1',
        className,
      )}
      role="navigation"
      aria-label="เปลี่ยนหน้า PDF"
    >
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        onClick={goPrev}
        disabled={displayPageNum <= 1 || disabled}
        aria-label="หน้าก่อน"
      >
        <HiChevronLeft className="size-4" />
      </Button>

      <div className="flex min-w-0 items-center justify-center">
        {showPageInput ? (
          <div className="flex items-center gap-1 font-sukhumvit">
            <Input
              id={pageInputId}
              type="number"
              min={1}
              max={displayTotalPages}
              inputMode="numeric"
              value={draftPage}
              disabled={disabled}
              onChange={(event) => setDraftPage(event.target.value)}
              onBlur={commitDraftPage}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  commitDraftPage();
                  (event.target as HTMLInputElement).blur();
                }
              }}
              className={cn(
                'h-8 border-border bg-background px-1 text-center text-sm font-black tabular-nums text-primary shadow-none',
                appearance === 'toolbar' ? 'w-14' : 'w-12',
              )}
              aria-label={`หน้าปัจจุบัน จาก ${displayTotalPages} หน้า`}
            />
            <span className="text-sm font-medium text-muted-foreground">/</span>
            <span className="min-w-[1.25rem] text-sm font-semibold tabular-nums text-muted-foreground">
              {displayTotalPages}
            </span>
          </div>
        ) : (
          <p className="text-sm font-black tabular-nums text-foreground font-sukhumvit">
            <span className="text-primary">{displayPageNum}</span>
            <span className="mx-1.5 font-medium text-muted-foreground">/</span>
            <span className="text-muted-foreground">{displayTotalPages}</span>
          </p>
        )}
      </div>

      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        onClick={goNext}
        disabled={displayPageNum >= displayTotalPages || disabled}
        aria-label="หน้าถัดไป"
      >
        <HiChevronRight className="size-4" />
      </Button>
    </div>
  );
}

function PdfZoomControls({
  scale,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  disabled,
  className,
}: {
  scale: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  disabled?: boolean;
  className?: string;
}) {
  const atMin = scale <= PDF_ZOOM_MIN + 0.001;
  const atMax = scale >= PDF_ZOOM_MAX - 0.001;
  const atDefault = Math.abs(scale - 1) < 0.001;

  return (
    <div
      className={cn(
        'flex items-center gap-0.5 rounded-xl border border-border bg-card/95 p-0.5 shadow-sm backdrop-blur-sm',
        className,
      )}
      role="group"
      aria-label="ซูม PDF"
    >
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={onZoomOut}
        disabled={disabled || atMin}
        aria-label="ซูมออก"
      >
        <HiMagnifyingGlassMinus className="size-4" />
      </Button>
      <button
        type="button"
        disabled={disabled || atDefault}
        onClick={onZoomReset}
        className="min-w-[3rem] rounded-lg px-1 py-1 text-[11px] font-black tabular-nums text-foreground transition-colors hover:bg-muted disabled:cursor-default disabled:opacity-60 font-sukhumvit"
        aria-label="รีเซ็ตซูม"
      >
        {Math.round(scale * 100)}%
      </button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={onZoomIn}
        disabled={disabled || atMax}
        aria-label="ซูมเข้า"
      >
        <HiMagnifyingGlassPlus className="size-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={onZoomReset}
        disabled={disabled || atDefault}
        aria-label="ซูม 100%"
        title="ซูม 100%"
      >
        <HiArrowPath className="size-3.5" />
      </Button>
    </div>
  );
}

function PdfViewerLoading({ label }: { label: string }) {
  return (
    <div className="flex min-h-[280px] flex-col items-center justify-center gap-3 p-6">
      <IndeterminateProgress className="w-40" />
      <p className="text-sm font-medium text-muted-foreground font-sarabun">{label}</p>
    </div>
  );
}

export function PdfPageViewer({
  url,
  className,
  pageNum: pageNumProp,
  onPageNumChange,
  onLoadStateChange,
  showPagination = true,
  showZoomControls = true,
  scale: scaleProp,
  onScaleChange,
  hiddenPages,
  applyHiddenPages = false,
}: {
  url: string;
  className?: string;
  pageNum?: number;
  onPageNumChange?: (page: number) => void;
  onLoadStateChange?: (state: {
    pageNum: number;
    totalPages: number;
    visiblePageCount: number;
    loading: boolean;
    error: string | null;
  }) => void;
  showPagination?: boolean;
  showZoomControls?: boolean;
  scale?: number;
  onScaleChange?: (scale: number) => void;
  /** หน้า PDF (1-based) ที่ซ่อน — ใช้เมื่อ applyHiddenPages=true */
  hiddenPages?: number[];
  /** true = ข้ามหน้าที่ซ่อน (ห้องสอบ), false = แสดงทุกหน้า (ตั้งค่า/ preview ครู) */
  applyHiddenPages?: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const pdfContentRef = useRef<HTMLDivElement>(null);
  const pinchRef = useRef<{
    startDistance: number;
    startScale: number;
    currentScale: number;
  } | null>(null);
  const [internalPageNum, setInternalPageNum] = useState(1);
  const pageNum = pageNumProp ?? internalPageNum;
  const setPageNum = onPageNumChange ?? setInternalPageNum;
  const [internalScale, setInternalScale] = useState(1);
  const scale = scaleProp ?? internalScale;
  const setScale = onScaleChange ?? setInternalScale;
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [totalPages, setTotalPages] = useState(0);
  const [loadingBytes, setLoadingBytes] = useState(true);
  const [parsingDoc, setParsingDoc] = useState(false);
  const [renderingPage, setRenderingPage] = useState(false);
  const [pageWidth, setPageWidth] = useState(320);
  const [error, setError] = useState<string | null>(null);

  const loading = loadingBytes || parsingDoc;
  const controlsDisabled = loading || renderingPage || !!error;
  const renderedPageWidth = pageWidth * scale;

  const visiblePages = useMemo(() => {
    if (!applyHiddenPages || totalPages <= 0) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    return getVisiblePdfPages(totalPages, hiddenPages);
  }, [applyHiddenPages, hiddenPages, totalPages]);

  const paginationVisiblePages = applyHiddenPages && hiddenPages?.length ? visiblePages : undefined;
  const renderPageNum = applyHiddenPages
    ? snapToVisiblePdfPage(pageNum, visiblePages)
    : pageNum;

  useEffect(() => {
    if (!applyHiddenPages || visiblePages.length === 0) return;
    if (!visiblePages.includes(pageNum)) {
      setPageNum(snapToVisiblePdfPage(pageNum, visiblePages));
    }
  }, [applyHiddenPages, pageNum, setPageNum, visiblePages]);

  /** Blob URL avoids ArrayBuffer detachment when pdf.js transfers `{ data }` to the worker */
  const pdfBlobUrl = useMemo(() => {
    if (!pdfBytes) return null;
    const copy = new Uint8Array(pdfBytes);
    return URL.createObjectURL(new Blob([copy], { type: 'application/pdf' }));
  }, [pdfBytes]);

  useEffect(() => {
    return () => {
      if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl);
    };
  }, [pdfBlobUrl]);

  const handleZoomIn = useCallback(() => {
    setScale(clampPdfZoom(scale + PDF_ZOOM_STEP));
  }, [scale, setScale]);

  const handleZoomOut = useCallback(() => {
    setScale(clampPdfZoom(scale - PDF_ZOOM_STEP));
  }, [scale, setScale]);

  const handleZoomReset = useCallback(() => {
    setScale(1);
  }, [setScale]);

  useEffect(() => {
    onLoadStateChange?.({
      pageNum: renderPageNum,
      totalPages,
      visiblePageCount: visiblePages.length,
      loading: loading || renderingPage,
      error,
    });
  }, [renderPageNum, totalPages, visiblePages.length, loading, renderingPage, error, onLoadStateChange]);

  useEffect(() => {
    let cancelled = false;
    setLoadingBytes(true);
    setParsingDoc(false);
    setError(null);
    setPdfBytes(null);
    setTotalPages(0);
    setPageNum(1);
    setScale(1);

    void (async () => {
      try {
        const bytes = await fetchPdfBytesForViewer(url);
        if (cancelled) return;
        // Own a copy so pdf.js worker transfer does not detach our state buffer on re-open
        setPdfBytes(new Uint8Array(bytes));
        setParsingDoc(true);
      } catch (err) {
        if (!cancelled) {
          console.error('[PdfPageViewer] load failed', err);
          const message = err instanceof Error ? err.message : '';
          setError(
            message.includes('เข้าสู่ระบบ')
              ? message
              : 'โหลด PDF ไม่สำเร็จ — ลองรีเฟรชหรือเข้าสู่ระบบใหม่',
          );
        }
      } finally {
        if (!cancelled) setLoadingBytes(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [url, setPageNum, setScale]);

  useEffect(() => {
    const el = measureRef.current;
    if (!el || !pdfBlobUrl) return;

    let raf = 0;
    const updateWidth = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        setPageWidth(Math.max(el.clientWidth - 8, 280));
      });
    };
    updateWidth();

    const observer = new ResizeObserver(updateWidth);
    observer.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [pdfBlobUrl]);

  const handleDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setTotalPages(numPages);
    setParsingDoc(false);
  }, []);

  const handleDocumentLoadError = useCallback((err: Error) => {
    console.error('[PdfPageViewer] document parse failed', err);
    setParsingDoc(false);
    setError('ไม่สามารถเปิดไฟล์ PDF ได้');
  }, []);

  const handlePageRenderError = useCallback((err: Error) => {
    console.error('[PdfPageViewer] page render failed', err);
    setRenderingPage(false);
    setError('แสดงหน้า PDF ไม่สำเร็จ — ลองรีเฟรชหรืออัปโหลดไฟล์ใหม่');
  }, []);

  useEffect(() => {
    setRenderingPage(true);
  }, [renderPageNum, pdfBlobUrl]);

  useEffect(() => {
    const root = scrollRef.current;
    if (!root || controlsDisabled) return;

    const clearPinchTransform = () => {
      const content = pdfContentRef.current;
      if (!content) return;
      content.style.transform = '';
      content.style.transformOrigin = '';
    };

    const finishPinch = () => {
      const pinch = pinchRef.current;
      if (!pinch) return;
      pinchRef.current = null;
      clearPinchTransform();
      if (Math.abs(pinch.currentScale - scale) > 0.01) {
        setScale(clampPdfZoom(pinch.currentScale));
      }
    };

    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 2) return;
      event.preventDefault();
      pinchRef.current = {
        startDistance: getTouchDistance(event.touches),
        startScale: scale,
        currentScale: scale,
      };
    };

    const onTouchMove = (event: TouchEvent) => {
      const pinch = pinchRef.current;
      if (!pinch || event.touches.length !== 2) return;
      event.preventDefault();
      if (pinch.startDistance <= 0) return;

      const distance = getTouchDistance(event.touches);
      const nextScale = clampPdfZoom(pinch.startScale * (distance / pinch.startDistance));
      pinch.currentScale = nextScale;

      const content = pdfContentRef.current;
      if (!content) return;
      const visualRatio = nextScale / scale;
      if (Math.abs(visualRatio - 1) < 0.001) {
        clearPinchTransform();
        return;
      }
      content.style.transformOrigin = 'center top';
      content.style.transform = `scale(${visualRatio})`;
    };

    const onTouchEnd = (event: TouchEvent) => {
      if (event.touches.length >= 2) return;
      finishPinch();
    };

    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      const step = event.deltaY > 0 ? -PDF_ZOOM_STEP : PDF_ZOOM_STEP;
      setScale(clampPdfZoom(scale + step));
    };

    root.addEventListener('touchstart', onTouchStart, { passive: false });
    root.addEventListener('touchmove', onTouchMove, { passive: false });
    root.addEventListener('touchend', onTouchEnd);
    root.addEventListener('touchcancel', onTouchEnd);
    root.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      root.removeEventListener('touchstart', onTouchStart);
      root.removeEventListener('touchmove', onTouchMove);
      root.removeEventListener('touchend', onTouchEnd);
      root.removeEventListener('touchcancel', onTouchEnd);
      root.removeEventListener('wheel', onWheel);
      clearPinchTransform();
      pinchRef.current = null;
    };
  }, [controlsDisabled, scale, setScale]);

  return (
    <div className={cn('flex min-h-0 flex-col gap-3', className)}>
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-auto overscroll-contain touch-pan-x touch-pan-y"
      >
        <div
          ref={measureRef}
          className={cn(
            'relative w-full rounded-2xl border border-border bg-muted/30 p-2 shadow-sm',
            (loading || error) && 'min-h-[280px]',
          )}
        >
          {loading && !error && (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-background/80 backdrop-blur-sm">
              <PdfViewerLoading
                label={loadingBytes ? 'กำลังโหลด PDF...' : 'กำลังเตรียมเอกสาร...'}
              />
            </div>
          )}

          {renderingPage && !loading && !error && pdfBlobUrl && (
            <div className="pointer-events-none absolute inset-x-0 top-2 z-10 flex justify-center">
              <span className="rounded-full border border-border bg-card/95 px-3 py-1 text-[11px] font-semibold text-muted-foreground shadow-sm font-sarabun">
                กำลังแสดงหน้า {renderPageNum}...
              </span>
            </div>
          )}

          {showZoomControls && pdfBlobUrl && !error && (
            <PdfZoomControls
              scale={scale}
              onZoomIn={handleZoomIn}
              onZoomOut={handleZoomOut}
              onZoomReset={handleZoomReset}
              disabled={controlsDisabled}
              className="absolute right-3 top-3 z-20"
            />
          )}

          {error ? (
            <div className="flex min-h-[280px] items-center justify-center p-6 text-center">
              <p className="text-sm font-semibold text-destructive font-sarabun">{error}</p>
            </div>
          ) : pdfBlobUrl ? (
            <div ref={pdfContentRef} className="flex w-max min-w-full justify-center">
              <Document
                file={pdfBlobUrl}
                options={PDFJS_DOCUMENT_OPTIONS}
                onLoadSuccess={handleDocumentLoadSuccess}
                onLoadError={handleDocumentLoadError}
                loading={<PdfViewerLoading label="กำลังอ่าน PDF..." />}
                error={
                  <p className="p-6 text-center text-sm font-semibold text-destructive font-sarabun">
                    เปิด PDF ไม่สำเร็จ
                  </p>
                }
              >
                <Page
                  key={`${pdfBlobUrl}-${renderPageNum}-${Math.round(renderedPageWidth)}`}
                  pageNumber={renderPageNum}
                  width={renderedPageWidth}
                  devicePixelRatio={typeof window !== 'undefined' ? window.devicePixelRatio : 1}
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                  canvasBackground="white"
                  onRenderSuccess={() => setRenderingPage(false)}
                  onRenderError={handlePageRenderError}
                  className="overflow-hidden rounded-xl border border-border bg-white shadow-sm"
                  loading={<PdfViewerLoading label={`กำลังแสดงหน้า ${renderPageNum}...`} />}
                />
              </Document>
            </div>
          ) : null}
        </div>
      </div>

      {showPagination && totalPages > 0 && !error && (
        <PdfPagePagination
          pageNum={renderPageNum}
          totalPages={totalPages}
          visiblePages={paginationVisiblePages}
          onPageChange={setPageNum}
          disabled={controlsDisabled}
        />
      )}
    </div>
  );
}

/** Preview panel for Exam Manager — proxy + page-by-page (replaces slow Storage iframe) */
export function PdfPreviewFrame({ url, className }: { url: string; className?: string }) {
  return (
    <div className={cn('flex min-h-0 flex-1 flex-col overflow-hidden bg-muted/20 px-3 pb-3 pt-2', className)}>
      <PdfPageViewer url={url} className="min-h-0 flex-1" />
    </div>
  );
}

export function PdfAnswerSheet({
  questions,
  groups,
  answers,
  readOnly,
  onAnswer,
  className,
  headerText,
  gradeByQuestionId,
  correctAnswerByQuestionId,
  correctOptionIdByQuestionId,
  roomId,
  attemptId,
  onCameraSessionChange,
}: {
  questions: ExamQuestion[];
  /** When set (multi-part exam), renders part headers and grouped questions. */
  groups?: AnswerSheetPartGroup[];
  answers: Record<string, string>;
  readOnly: boolean;
  onAnswer: (qId: string, value: string) => void;
  className?: string;
  headerText?: string;
  gradeByQuestionId?: Record<string, 'correct' | 'wrong' | 'unanswered'>;
  correctAnswerByQuestionId?: Record<string, string>;
  correctOptionIdByQuestionId?: Record<string, string>;
  roomId?: string;
  attemptId?: string;
  onCameraSessionChange?: (active: boolean) => void;
}) {
  const sections: AnswerSheetPartGroup[] = groups?.length
    ? groups
    : [{ partLabel: '', title: '', questions }];
  const showPartHeaders = (groups?.length ?? 0) > 1;

  return (
    <div className={cn('flex min-h-0 min-w-0 flex-col gap-2', className)}>
      <p className="shrink-0 px-0.5 font-sukhumvit text-xs font-black text-slate-700">
        {headerText ?? 'กรอกคำตอบ (ดูโจทย์จาก PDF)'}
      </p>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-y-auto overflow-x-hidden overscroll-contain px-0.5 pb-1 scrollbar-hide">
        {sections.map((section, sectionIndex) => {
          const rowOffset = sections
            .slice(0, sectionIndex)
            .reduce((sum, s) => sum + s.questions.length, 0);

          return (
          <div key={`${section.partLabel}-${sectionIndex}`} className="flex min-w-0 flex-col gap-1.5">
            {showPartHeaders && (() => {
              const theme = getPartBadgeTheme(sectionIndex);
              return (
              <div
                className={cn(
                  'sticky top-0 z-[1] rounded-lg border px-2.5 py-1.5 backdrop-blur-sm',
                  theme.headerBorder,
                  theme.headerBg,
                )}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className={cn(
                      'shrink-0 rounded-md px-1.5 py-0.5 font-sukhumvit text-[9px] font-black uppercase tracking-wide text-white',
                      theme.badge,
                    )}
                  >
                    {section.partLabel}
                  </span>
                  <p className="min-w-0 truncate font-sarabun text-[11px] font-bold text-slate-800">
                    {section.title}
                  </p>
                </div>
              </div>
              );
            })()}
            {section.questions.map((item, index) => (
              <AnswerSheetQuestionRow
                key={item.id}
                item={item}
                index={index}
                rowIndex={rowOffset + index}
                answers={answers}
                readOnly={readOnly}
                onAnswer={onAnswer}
                gradeStatus={gradeByQuestionId?.[item.id]}
                correctAnswerHint={correctAnswerByQuestionId?.[item.id]}
                correctOptionId={correctOptionIdByQuestionId?.[item.id]}
                roomId={roomId}
                attemptId={attemptId}
                onCameraSessionChange={onCameraSessionChange}
              />
            ))}
          </div>
          );
        })}
      </div>
    </div>
  );
}
