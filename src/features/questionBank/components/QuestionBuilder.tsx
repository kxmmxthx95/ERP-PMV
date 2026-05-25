import { useEffect, useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DIFFICULTY_CONFIG,
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
  rubric: string;
  maxScore: number;
};

const getInitialState = (initial?: Question | null, defaultType?: QuestionType): BuilderState => {
  if (!initial) {
    return {
      difficulty: 'medium',
      type: defaultType ?? 'multiple_choice',
      questionText: '',
      options: cloneDefaultOptions(),
      rubric: '',
      maxScore: 10,
    };
  }

  if (initial.type === 'multiple_choice') {
    const payload = initial.payload as { options?: MultipleChoiceOption[] };
    return {
      difficulty: initial.difficulty,
      type: initial.type,
      questionText: initial.questionText,
      options: payload.options?.length ? payload.options : cloneDefaultOptions(),
      rubric: '',
      maxScore: 10,
    };
  }

  const payload = initial.payload as { rubric?: string; maxScore?: number };
  return {
    difficulty: initial.difficulty,
    type: initial.type,
    questionText: initial.questionText,
    options: cloneDefaultOptions(),
    rubric: payload.rubric ?? '',
    maxScore: payload.maxScore ?? 10,
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
  const [rubric, setRubric] = useState(initialState.rubric);
  const [maxScore, setMaxScore] = useState<number>(initialState.maxScore);

  // Sync state when initial changes (though key in parent handles most cases)
  useEffect(() => {
    if (!open) return;
    const s = getInitialState(initial, defaultType);
    setDifficulty(s.difficulty);
    setType(s.type);
    setQuestionText(s.questionText);
    setOptions(s.options);
    setRubric(s.rubric);
    setMaxScore(s.maxScore);
  }, [open, initial, defaultType]);


  const canSubmit = useMemo(() => {
    const plain = questionText
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .trim();
    if (!plain) return false;
    if (type === 'multiple_choice') {
      if (options.length < 2) return false;
      if (!options.some((o) => o.isCorrect)) return false;
      if (options.some((o) => !o.text.trim())) return false;
    } else {
      if (!rubric.trim()) return false;
      if (!Number.isFinite(maxScore) || maxScore <= 0) return false;
    }
    return true;
  }, [questionText, type, options, rubric, maxScore]);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    const payload =
      type === 'multiple_choice'
        ? { options }
        : { rubric: rubric.trim(), maxScore };

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
        className="w-[92vw] sm:max-w-2xl rounded-[2rem] sm:rounded-[2.5rem] border-none p-0 shadow-2xl overflow-hidden"
        style={{
          background: 'rgba(255,255,255,0.7)',
          backdropFilter: 'blur(24px) saturate(180%)',
          WebkitBackdropFilter: 'blur(24px) saturate(180%)',
        }}
      >
        <div className="px-5 sm:px-6 pt-6 sm:pt-7 pb-2 sm:pb-3 flex justify-between items-center">
          <DialogTitle className="text-lg sm:text-xl font-black text-slate-800 tracking-tight">
            {isEdit ? 'แก้ไขข้อสอบ' : 'สร้างข้อสอบใหม่'}
          </DialogTitle>
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); void handleSubmit(); }}
          className="px-5 sm:px-6 pb-6 sm:pb-7 space-y-3 max-h-[80vh] overflow-y-auto custom-scrollbar"
        >
          <Field label="ระดับความยาก">
            <div className="flex items-center gap-2">
              {DIFF_OPTIONS.map((d) => {
                const cfg = DIFFICULTY_CONFIG[d];
                const active = difficulty === d;
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDifficulty(d)}
                    className="flex-1 h-11 rounded-full text-[13px] font-black transition-all"
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

          <Field label="โจทย์" required>
            <RichTextEditor
              value={questionText}
              onChange={setQuestionText}
              placeholder="พิมพ์คำถาม / โจทย์ที่นี่ — ใช้แถบเครื่องมือเพื่อจัดรูปแบบหรือแทรกสมการ"
              minHeight={140}
            />
          </Field>

          {type === 'multiple_choice' ? (
            <Field label="ตัวเลือก & เฉลย" required hint="กดที่หมายเลข ก/ข/ค/ง เพื่อเลือกข้อที่ถูก">
              <MultipleChoiceOptions options={options} onChange={setOptions} />
            </Field>
          ) : (
            <div className="space-y-3">
              <Field label="เกณฑ์การให้คะแนน (Rubric)" required>
                <textarea
                  value={rubric}
                  onChange={(e) => setRubric(e.target.value)}
                  rows={4}
                  placeholder="ระบุเกณฑ์การให้คะแนน เช่น 4 = ตอบครบทุกประเด็น, 2 = ตอบบางส่วน, 0 = ไม่ตอบ"
                  className="w-full rounded-xl bg-slate-50 border-none px-4 py-3 text-xs font-bold text-slate-700 placeholder:text-slate-400 resize-none outline-none"
                />
              </Field>
              <Field label="คะแนนเต็ม" required>
                <Input
                  type="number"
                  min={1}
                  value={maxScore}
                  onChange={(e) => setMaxScore(Number(e.target.value))}
                  className="h-9 rounded-xl bg-slate-50 border-none text-xs font-bold px-4"
                />
              </Field>
            </div>
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
