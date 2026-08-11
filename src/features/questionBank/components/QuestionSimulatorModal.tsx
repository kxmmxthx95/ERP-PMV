import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  HiXMark,
  HiCheckCircle,
  HiExclamationCircle,
  HiArrowPath,
  HiTrophy,
  HiChevronLeft,
  HiChevronRight,
} from 'react-icons/hi2';
import {
  type Question, isMultipleChoice
} from '@/types/questionBank';
import ExamQuestionContent from './ExamQuestionContent';
import { DEFAULT_OPTION_LABELS } from '@/features/questionBank/utils/optionLabels';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useImageLongPressPreview } from '@/features/questionBank/hooks/useImageLongPressPreview';

interface Props {
  open: boolean;
  onClose: () => void;
  question: Question | null;
  /** เช่น "ข้อ 2/15" */
  progressLabel?: string;
  /** นำทางชุดข้อสอบ — ส่งคู่ onPrev/onNext เพื่อโชว์ปุ่มไป/กลับ */
  onPrev?: () => void;
  onNext?: () => void;
  canPrev?: boolean;
  canNext?: boolean;
}

export default function QuestionSimulatorModal({
  open,
  onClose,
  question,
  progressLabel,
  onPrev,
  onNext,
  canPrev = false,
  canNext = false,
}: Props) {
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const openImagePreview = useCallback((url: string) => setLightboxUrl(url), []);
  const showNav = onPrev != null || onNext != null;

  useEffect(() => {
    if (open) {
      setSelectedOptionId(null);
      setIsSubmitted(false);
      setIsCorrect(null);
      setLightboxUrl(null);
    }
  }, [open, question]);

  if (!question) return null;

  const handleOptionSelect = (id: string) => {
    if (isSubmitted) return;
    setSelectedOptionId(id);
  };

  const handleSubmit = () => {
    if (!selectedOptionId || isSubmitted) return;
    if (isMultipleChoice(question)) {
      const selectedOption = question.payload.options.find(o => o.id === selectedOptionId);
      setIsCorrect(selectedOption?.isCorrect ?? false);
    }
    setIsSubmitted(true);
  };

  const handleRetry = () => {
    setSelectedOptionId(null);
    setIsSubmitted(false);
    setIsCorrect(null);
  };

  return (
    <>
      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="absolute inset-0 bg-black/30 supports-backdrop-filter:backdrop-blur-sm"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.18 }}
              className="relative flex max-h-[min(90dvh,820px)] w-full max-w-[540px] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-xl"
            >
              {/* Header */}
              <div className="relative flex shrink-0 items-center gap-3 border-b border-border px-5 pb-3 pt-5 sm:px-6 sm:pt-6">
                <div className="min-w-0 flex-1 pr-10">
                  <h3 className="truncate text-lg font-black tracking-tight text-foreground font-sukhumvit sm:text-xl">
                    จำลองการทำข้อสอบ
                  </h3>
                  {progressLabel ? (
                    <p className="mt-0.5 truncate text-[11px] font-bold text-muted-foreground font-sarabun">
                      {progressLabel}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="ปิด"
                  className="absolute right-4 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition hover:bg-muted hover:text-foreground"
                >
                  <HiXMark className="h-4 w-4" />
                </button>
              </div>

              {/* Content */}
              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 scrollbar-hide sm:px-6">
                <div className="mb-5">
                  <ExamQuestionContent
                    html={question.questionText}
                    variant="question"
                    onImagePreview={openImagePreview}
                  />
                </div>

                {isMultipleChoice(question) && (
                  <div className="space-y-2">
                    {question.payload.options.map((option, idx) => {
                      const isSelected = selectedOptionId === option.id;
                      const isCorrectOption = option.isCorrect;
                      const label = DEFAULT_OPTION_LABELS[idx] ?? String(idx + 1);

                      let variantStyles = 'bg-muted/50 border-border hover:border-foreground/20';
                      if (isSelected) {
                        variantStyles = 'bg-primary/5 border-primary ring-2 ring-primary/15';
                      }

                      if (isSubmitted) {
                        if (isCorrectOption) {
                          variantStyles = 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500/10';
                        } else if (isSelected && !isCorrectOption) {
                          variantStyles = 'bg-destructive/5 border-destructive ring-2 ring-destructive/15';
                        } else {
                          variantStyles = 'bg-muted/40 border-border opacity-60';
                        }
                      }

                      return (
                        <motion.button
                          key={option.id}
                          type="button"
                          whileHover={!isSubmitted ? { x: 2 } : {}}
                          whileTap={!isSubmitted ? { scale: 0.99 } : {}}
                          onClick={() => handleOptionSelect(option.id)}
                          disabled={isSubmitted}
                          className={cn(
                            'flex w-full items-start gap-2 rounded-xl border p-1.5 text-left transition-all',
                            variantStyles,
                          )}
                        >
                          <div
                            className={cn(
                              'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[13px] font-black font-sukhumvit transition-all',
                              isSubmitted && isCorrectOption
                                ? 'bg-emerald-500 text-white'
                                : isSelected
                                  ? 'bg-primary text-primary-foreground'
                                  : 'border border-border bg-card text-muted-foreground',
                            )}
                          >
                            {isSubmitted && isCorrectOption ? (
                              <HiCheckCircle className="h-4 w-4" />
                            ) : (
                              label
                            )}
                          </div>

                          <div className="flex min-w-0 flex-1 items-start gap-2">
                            <ExamQuestionContent
                              html={option.text}
                              variant="option"
                              onImagePreview={openImagePreview}
                            />
                            {isSubmitted && isSelected && !isCorrectOption && (
                              <HiExclamationCircle className="mt-2 h-4 w-4 shrink-0 text-destructive" />
                            )}
                          </div>

                          {option.imageUrl && (
                            <OptionImageThumbnail
                              url={option.imageUrl}
                              onPreview={openImagePreview}
                            />
                          )}
                        </motion.button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex shrink-0 flex-col gap-3 border-t border-border px-5 pt-4 pb-5 sm:px-6 sm:pb-6">
                {isSubmitted && (
                  <div
                    className={cn(
                      'flex items-center gap-1.5 text-[12px] font-black font-sukhumvit',
                      isCorrect ? 'text-emerald-600' : 'text-destructive',
                    )}
                  >
                    {isCorrect ? (
                      <>
                        <HiTrophy className="h-4 w-4" />
                        ถูกต้อง! เก่งมาก
                      </>
                    ) : (
                      <>
                        <HiExclamationCircle className="h-4 w-4" />
                        ยังไม่ถูก ลองดูใหม่นะ
                      </>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-2">
                  {showNav ? (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={onPrev}
                      disabled={!canPrev}
                      className="h-10 shrink-0 rounded-xl px-3 text-xs font-bold"
                      aria-label="ข้อก่อน"
                    >
                      <HiChevronLeft className="h-4 w-4" />
                      <span className="hidden sm:inline">ข้อก่อน</span>
                    </Button>
                  ) : null}

                  {isSubmitted ? (
                    <Button
                      type="button"
                      variant={showNav ? 'secondary' : 'default'}
                      onClick={showNav ? handleRetry : onClose}
                      className="h-10 min-w-0 flex-1 rounded-xl text-xs font-bold"
                    >
                      {showNav ? (
                        <>
                          <HiArrowPath className="h-3.5 w-3.5" />
                          ทำใหม่
                        </>
                      ) : (
                        'ปิด'
                      )}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      onClick={handleSubmit}
                      disabled={!selectedOptionId}
                      className="h-10 min-w-0 flex-1 rounded-xl text-xs font-bold"
                    >
                      ส่งคำตอบ
                    </Button>
                  )}

                  {showNav ? (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={onNext}
                      disabled={!canNext}
                      className="h-10 shrink-0 rounded-xl px-3 text-xs font-bold"
                      aria-label="ข้อถัดไป"
                    >
                      <span className="hidden sm:inline">ข้อถัดไป</span>
                      <HiChevronRight className="h-4 w-4" />
                    </Button>
                  ) : isSubmitted ? (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={handleRetry}
                      className="h-10 shrink-0 rounded-xl px-3 text-xs font-bold"
                    >
                      <HiArrowPath className="h-3.5 w-3.5" />
                      ทำใหม่
                    </Button>
                  ) : null}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {lightboxUrl && (
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center p-6"
            onClick={() => setLightboxUrl(null)}
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={{ type: 'spring', stiffness: 320, damping: 28 }}
              className="relative z-10 max-h-[85vh] max-w-[90vw]"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={lightboxUrl}
                alt=""
                className="max-h-[85vh] max-w-full rounded-2xl object-contain shadow-2xl"
              />
              <button
                type="button"
                onClick={() => setLightboxUrl(null)}
                aria-label="ปิด"
                className="absolute -right-3 -top-3 flex size-9 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-md transition hover:bg-muted"
              >
                <HiXMark className="h-4 w-4" />
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

function OptionImageThumbnail({
  url,
  onPreview,
}: {
  url: string;
  onPreview: (url: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useImageLongPressPreview(ref, onPreview, true);

  return (
    <div
      ref={ref}
      className="mt-1 w-20 shrink-0"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <img
        src={url}
        alt=""
        className="h-16 w-full rounded-lg border border-border object-cover shadow-sm"
      />
    </div>
  );
}
