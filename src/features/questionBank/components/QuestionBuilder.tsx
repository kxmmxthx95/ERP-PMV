import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DIFFICULTY_CONFIG,
  TYPE_CONFIG,
  type Question, type NewQuestion,
  type QuestionDifficulty, type QuestionType,
  type MultipleChoiceOption,
} from '@/types/questionBank';
import RichTextEditor from './RichTextEditor';
import MultipleChoiceOptions from './MultipleChoiceOptions';
import { useActiveAcademicYear } from '@/hooks/useActiveAcademicYear';

interface Props {
  open: boolean;
  onClose: () => void;
  initial?: Question | null;
  onSubmit: (data: NewQuestion) => Promise<void> | void;
  defaultType?: QuestionType;
}

const DIFF_OPTIONS: QuestionDifficulty[] = ['easy', 'medium', 'hard'];
const TYPE_OPTIONS: QuestionType[] = ['multiple_choice', 'essay'];

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

/** ตัวเลือกถือว่ามีเนื้อหาเมื่อมีข้อความหรือมีรูปภาพใน editor */
function hasOptionContent(html: string): boolean {
  if (stripHtml(html)) return true;
  return /<img\b[^>]*\bsrc\s*=\s*["'][^"']+["']/i.test(html);
}

const DEFAULT_OPTIONS: MultipleChoiceOption[] = [
  { id: '1', text: '', isCorrect: true  },
  { id: '2', text: '', isCorrect: false },
  { id: '3', text: '', isCorrect: false },
  { id: '4', text: '', isCorrect: false },
];

const cloneDefaultOptions = () => DEFAULT_OPTIONS.map((o) => ({ ...o }));

type BuilderState = {
  difficulty: QuestionDifficulty;
  type: QuestionType;
  questionText: string;
  options: MultipleChoiceOption[];
};

const getInitialState = (initial?: Question | null, defaultType?: QuestionType): BuilderState => {
  if (!initial) {
    return {
      difficulty: 'medium',
      type: defaultType ?? 'multiple_choice',
      questionText: '',
      options: cloneDefaultOptions(),
    };
  }

  if (initial.type === 'multiple_choice') {
    const payload = initial.payload as { options?: MultipleChoiceOption[] };
    return {
      difficulty: initial.difficulty,
      type: initial.type,
      questionText: initial.questionText,
      options: payload.options?.length ? payload.options : cloneDefaultOptions(),
    };
  }

  return {
    difficulty: initial.difficulty,
    type: initial.type,
    questionText: initial.questionText,
    options: cloneDefaultOptions(),
  };
};

export default function QuestionBuilder({
  open, onClose, initial, onSubmit, defaultType,
}: Props) {
  const { year } = useActiveAcademicYear();
  const isEdit = Boolean(initial);
  const initialState = getInitialState(initial, defaultType);

  const [difficulty, setDifficulty] = useState<QuestionDifficulty>(initialState.difficulty);
  const [type, setType] = useState<QuestionType>(initialState.type);
  const [questionText, setQuestionText] = useState(initialState.questionText);
  const [options, setOptions] = useState<MultipleChoiceOption[]>(initialState.options);

  // Sync state when initial changes (though key in parent handles most cases)
  useEffect(() => {
    if (!open) return;
    const s = getInitialState(initial, defaultType);
    setDifficulty(s.difficulty);
    setType(s.type);
    setQuestionText(s.questionText);
    setOptions(s.options);
  }, [open, initial, defaultType]);


  const canSubmit = useMemo(() => {
    if (!stripHtml(questionText)) return false;
    if (type === 'multiple_choice') {
      if (options.length < 2) return false;
      if (!options.some((o) => o.isCorrect)) return false;
      if (options.some((o) => !hasOptionContent(o.text))) return false;
    }
    return true;
  }, [questionText, type, options]);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    const essayPayload = initial?.type === 'essay'
      ? {
          rubric: (initial.payload as { rubric?: string }).rubric ?? '',
          maxScore: (initial.payload as { maxScore?: number }).maxScore ?? 1,
        }
      : { rubric: '', maxScore: 1 };
    const payload =
      type === 'multiple_choice'
        ? { options }
        : essayPayload;

    await onSubmit({
      curriculumYear: year ?? '',
      questionText,
      images: [],
      difficulty,
      type,
      payload,
      createdBy: initial?.createdBy ?? '',
      createdByName: initial?.createdByName ?? '',
    } as NewQuestion);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        className="w-[96vw] max-h-[92vh] overflow-hidden rounded-[2rem] border-none p-0 shadow-2xl sm:max-w-3xl sm:rounded-[2.5rem]"
        style={{
          background: 'rgba(255,255,255,0.98)',
          backdropFilter: 'blur(24px) saturate(180%)',
          WebkitBackdropFilter: 'blur(24px) saturate(180%)',
        }}
      >
        <div className="flex items-center justify-between px-5 pb-2 pt-6 sm:px-6 sm:pt-7 sm:pb-3">
          <DialogTitle className="text-lg font-black tracking-tight text-slate-800 sm:text-xl">
            {isEdit ? 'แก้ไขข้อสอบ' : 'สร้างข้อสอบใหม่'}
          </DialogTitle>
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); void handleSubmit(); }}
          className="custom-scrollbar max-h-[calc(92vh-5.5rem)] space-y-4 overflow-y-auto px-5 pb-6 sm:px-6 sm:pb-7"
        >
          <div className="grid grid-cols-2 gap-3">
            <Field label="ระดับความยาก">
              <div className="flex items-center gap-1.5">
                {DIFF_OPTIONS.map((d) => {
                  const cfg = DIFFICULTY_CONFIG[d];
                  const active = difficulty === d;
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDifficulty(d)}
                      className="h-8 flex-1 rounded-full px-1.5 text-[10px] font-black transition-all sm:h-9 sm:px-2 sm:text-[11px]"
                      style={{
                        background: active ? cfg.color : cfg.bg,
                        color: active ? '#fff' : cfg.color,
                        border: `1px solid ${active ? cfg.color : cfg.border}`,
                      }}
                    >
                      {cfg.label}
                    </button>
                  );
                })}
              </div>
            </Field>

            <Field label="ประเภทคำตอบ" required>
              <div className="flex items-center gap-1.5">
                {TYPE_OPTIONS.map((t) => {
                  const cfg = TYPE_CONFIG[t];
                  const active = type === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setType(t)}
                      className="h-8 flex-1 rounded-full px-1.5 text-[10px] font-black transition-all sm:h-9 sm:px-2 sm:text-[11px]"
                      style={{
                        background: active ? cfg.color : cfg.bg,
                        color: active ? '#fff' : cfg.color,
                        border: `1px solid ${active ? cfg.color : `${cfg.color}40`}`,
                      }}
                    >
                      {cfg.shortLabel}
                    </button>
                  );
                })}
              </div>
            </Field>
          </div>

          <Field label="โจทย์" required>
            <RichTextEditor
              value={questionText}
              onChange={setQuestionText}
              placeholder="พิมพ์คำถาม / โจทย์ที่นี่..."
              minHeight={200}
            />
          </Field>

          {type === 'multiple_choice' && (
            <Field label="ตัวเลือก & เฉลย" required>
              <MultipleChoiceOptions options={options} onChange={setOptions} />
            </Field>
          )}

          <DialogFooter className="pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              className="rounded-xl font-bold text-slate-500 h-10"
            >
              ยกเลิก
            </Button>
            <Button
              type="submit"
              disabled={!canSubmit}
              className="rounded-xl bg-slate-900 text-white font-bold px-10 h-10 border border-slate-900"
            >
              {isEdit ? 'บันทึกการแก้ไข' : 'สร้างข้อสอบ'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label, required, hint, children,
}: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
          {label} {required && <span className="text-rose-400">*</span>}
        </label>
        {hint && <span className="text-[10px] text-slate-400 font-bold">{hint}</span>}
      </div>
      {children}
    </div>
  );
}
