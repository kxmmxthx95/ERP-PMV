import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle2, AlertCircle, PlayCircle, Trophy, RefreshCcw, ZoomIn } from 'lucide-react';
import {
  type Question, isMultipleChoice
} from '@/types/questionBank';

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
                  onClick={onClose}
                  className="w-10 h-10 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto px-6 py-7 custom-scrollbar">
                <div className="mb-8">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="px-3 py-1 rounded-full bg-slate-100 text-[10px] font-black text-slate-500 uppercase tracking-wider">
                      Question Preview
                    </span>
                  </div>
                  <div
                    className="text-[18px] font-bold text-slate-800 font-sarabun leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: question.questionText }}
                  />
                </div>

                {/* Options */}
                {isMultipleChoice(question) && (
                  <div className="grid grid-cols-2 gap-3">
                    {question.payload.options.map((option, idx) => {
                      const isSelected = selectedOptionId === option.id;
                      const isCorrectOption = option.isCorrect;

                      let variantStyles = "bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300";
                      if (isSelected) variantStyles = "bg-indigo-50 border-indigo-500 text-indigo-700 ring-2 ring-indigo-500/10";

                      if (isSubmitted) {
                        if (isCorrectOption) {
                          variantStyles = "bg-emerald-50 border-emerald-500 text-emerald-700 ring-2 ring-emerald-500/10 shadow-lg shadow-emerald-500/10";
                        } else if (isSelected && !isCorrectOption) {
                          variantStyles = "bg-rose-50 border-rose-500 text-rose-700 ring-2 ring-rose-500/10";
                        } else {
                          variantStyles = "bg-slate-50 border-slate-100 text-slate-300 opacity-60";
                        }
                      }

                      return (
                        <motion.button
                          key={option.id}
                          whileHover={!isSubmitted ? { x: 4 } : {}}
                          whileTap={!isSubmitted ? { scale: 0.99 } : {}}
                          onClick={() => handleOptionSelect(option.id)}
                          className={`w-full py-2.5 px-4 rounded-xl border text-left transition-all flex flex-col gap-2 ${variantStyles}`}
                        >
                          {/* Top row: letter + text + result icon */}
                          <div className="flex items-start gap-3">
                            <div className={`w-5 h-5 rounded-lg flex items-center justify-center shrink-0 text-[10px] font-black ${
                              isSelected || (isSubmitted && isCorrectOption)
                                ? 'bg-current text-white'
                                : 'bg-white text-slate-400'
                            }`}>
                              {String.fromCharCode(65 + idx)}
                            </div>
                            <div
                              className="flex-1 font-bold font-sarabun text-[14px] break-words"
                              dangerouslySetInnerHTML={{ __html: option.text }}
                            />
                            {isSubmitted && isCorrectOption && (
                              <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
                            )}
                            {isSubmitted && isSelected && !isCorrectOption && (
                              <AlertCircle size={18} className="text-rose-500 shrink-0" />
                            )}
                          </div>

                          {/* Option image thumbnail */}
                          {option.imageUrl && (
                            <div
                              className="relative group w-full"
                              onClick={(e) => {
                                e.stopPropagation();
                                setLightboxUrl(option.imageUrl!);
                              }}
                            >
                              <img
                                src={option.imageUrl}
                                alt=""
                                className="w-full h-24 object-cover rounded-lg border border-white/60 shadow-sm"
                              />
                              <div className="absolute inset-0 rounded-lg bg-black/0 group-hover:bg-black/25 transition-all flex items-center justify-center">
                                <ZoomIn
                                  size={22}
                                  className="text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow"
                                />
                              </div>
                            </div>
                          )}
                        </motion.button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-5 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between shrink-0">
                <div>
                  <AnimatePresence mode="wait">
                    {isSubmitted && (
                      <motion.div
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-center gap-2"
                      >
                        {isCorrect ? (
                          <div className="flex items-center gap-2 text-emerald-600 font-black font-sukhumvit text-sm">
                            <Trophy size={18} />
                            ถูกต้อง! เก่งมาก
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-rose-600 font-black font-sukhumvit text-sm">
                            <AlertCircle size={18} />
                            ยังไม่ถูก ลองดูใหม่นะ
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="flex items-center gap-3">
                  {isSubmitted ? (
                    <Button
                      onClick={handleRetry}
                      className="h-11 px-6 rounded-2xl bg-white border border-slate-200 text-slate-600 font-black font-sukhumvit flex items-center gap-2 hover:bg-slate-50 transition-all"
                    >
                      <RefreshCcw size={16} />
                      ทำใหม่
                    </Button>
                  ) : null}
                  <Button
                    onClick={isSubmitted ? onClose : handleSubmit}
                    disabled={!selectedOptionId && !isSubmitted}
                    className={`h-11 px-10 rounded-2xl font-black font-sukhumvit transition-all ${
                      isSubmitted
                        ? 'bg-slate-900 text-white hover:bg-slate-800'
                        : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-600/20 disabled:opacity-50 disabled:shadow-none'
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
