import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle2, AlertCircle, PlayCircle, Trophy, RefreshCcw } from 'lucide-react';
import {
  type Question, isMultipleChoice
} from '@/types/questionBank';
import ExamQuestionContent from './ExamQuestionContent';
import { DEFAULT_OPTION_LABELS } from '@/features/questionBank/utils/optionLabels';
import { cn } from '@/lib/utils';
import { useImageLongPressPreview } from '@/features/questionBank/hooks/useImageLongPressPreview';

interface Props {
  open: boolean;
  onClose: () => void;
  question: Question | null;
}

export default function QuestionSimulatorModal({ open, onClose, question }: Props) {
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const openImagePreview = useCallback((url: string) => setLightboxUrl(url), []);

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
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-[540px] bg-white rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden border border-white max-h-[90vh]"
            >
              {/* Header */}
              <div className="p-5 flex items-center justify-between border-b border-slate-100 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                    <PlayCircle size={20} strokeWidth={2.5} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-800 font-sukhumvit leading-none">จำลองการทำข้อสอบ</h3>
                    <p className="text-[11px] font-bold text-slate-400 font-sarabun mt-1 tracking-wide uppercase">Exam Simulator Mode</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="ปิด"
                  className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors shrink-0"
                >
                  <X size={16} strokeWidth={2.5} />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto px-6 py-7 custom-scrollbar">
                <div className="mb-8">
                  <ExamQuestionContent
                    html={question.questionText}
                    variant="question"
                    onImagePreview={openImagePreview}
                  />
                </div>

                {/* Options — layout เหมือนตอนสร้างข้อสอบ */}
                {isMultipleChoice(question) && (
                  <div className="space-y-2">
                    {question.payload.options.map((option, idx) => {
                      const isSelected = selectedOptionId === option.id;
                      const isCorrectOption = option.isCorrect;
                      const label = DEFAULT_OPTION_LABELS[idx] ?? String(idx + 1);

                      let variantStyles = 'bg-slate-50 border-slate-200 hover:border-slate-300';
                      if (isSelected) variantStyles = 'bg-indigo-50 border-indigo-500 ring-2 ring-indigo-500/10';

                      if (isSubmitted) {
                        if (isCorrectOption) {
                          variantStyles = 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500/10 shadow-lg shadow-emerald-500/10';
                        } else if (isSelected && !isCorrectOption) {
                          variantStyles = 'bg-rose-50 border-rose-500 ring-2 ring-rose-500/10';
                        } else {
                          variantStyles = 'bg-slate-50 border-slate-100 opacity-60';
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
                            'w-full rounded-xl border text-left transition-all flex items-start gap-2 p-1',
                            variantStyles,
                          )}
                        >
                          <div className={cn(
                            'mt-1 shrink-0 w-9 h-9 rounded-full flex items-center justify-center font-black text-[13px] font-sukhumvit transition-all',
                            isSubmitted && isCorrectOption
                              ? 'bg-emerald-500 text-white'
                              : isSelected
                                ? 'bg-indigo-600 text-white'
                                : 'bg-white/80 text-slate-500 border border-slate-200/70',
                          )}>
                            {isSubmitted && isCorrectOption ? (
                              <CheckCircle2 size={15} />
                            ) : (
                              label
                            )}
                          </div>

                          <div className="flex-1 min-w-0 flex items-start gap-2">
                            <ExamQuestionContent
                              html={option.text}
                              variant="option"
                              onImagePreview={openImagePreview}
                            />
                            {isSubmitted && isSelected && !isCorrectOption && (
                              <AlertCircle size={18} className="text-rose-500 shrink-0 mt-2" />
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
              <div className="px-4 py-3 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between gap-2 shrink-0">
                <div className="min-w-0">
                  <AnimatePresence mode="wait">
                    {isSubmitted && (
                      <motion.div
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-center gap-1.5"
                      >
                        {isCorrect ? (
                          <div className="flex items-center gap-1.5 text-emerald-600 font-black font-sukhumvit text-[12px]">
                            <Trophy size={15} />
                            ถูกต้อง! เก่งมาก
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-rose-600 font-black font-sukhumvit text-[12px]">
                            <AlertCircle size={15} />
                            ยังไม่ถูก ลองดูใหม่นะ
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {isSubmitted ? (
                    <Button
                      onClick={handleRetry}
                      className="h-9 px-3.5 rounded-xl bg-white border border-slate-200 text-slate-600 text-[12px] font-black font-sukhumvit flex items-center gap-1.5 hover:bg-slate-50 transition-all"
                    >
                      <RefreshCcw size={14} />
                      ทำใหม่
                    </Button>
                  ) : null}
                  <Button
                    onClick={isSubmitted ? onClose : handleSubmit}
                    disabled={!selectedOptionId && !isSubmitted}
                    className={`h-9 px-4 rounded-xl text-[12px] font-black font-sukhumvit transition-all ${
                      isSubmitted
                        ? 'bg-slate-900 text-white hover:bg-slate-800'
                        : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md shadow-indigo-600/20 disabled:opacity-50 disabled:shadow-none'
                    }`}
                  >
                    {isSubmitted ? 'ปิดหน้าต่าง' : 'ส่งคำตอบ'}
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Image lightbox */}
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
              className="relative z-10 max-w-[90vw] max-h-[85vh]"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={lightboxUrl}
                alt=""
                className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl"
              />
              <button
                onClick={() => setLightboxUrl(null)}
                className="absolute -top-3 -right-3 w-9 h-9 rounded-full bg-white text-slate-700 flex items-center justify-center shadow-lg hover:bg-slate-100 transition-colors"
              >
                <X size={16} strokeWidth={2.5} />
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
      className="shrink-0 mt-1 w-20"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <img
        src={url}
        alt=""
        className="w-full h-16 object-cover rounded-lg border border-white/60 shadow-sm"
      />
    </div>
  );
}

function Button({
  children,
  onClick,
  disabled,
  className
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={className}
    >
      {children}
    </button>
  );
}
