import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, Check } from 'lucide-react';
import type { MultipleChoiceOption } from '@/types/questionBank';
import RichTextEditor from './RichTextEditor';

interface Props {
  options: MultipleChoiceOption[];
  onChange: (options: MultipleChoiceOption[]) => void;
  disabled?: boolean;
}

const LETTERS = ['ก', 'ข', 'ค', 'ง', 'จ', 'ฉ'];

export default function MultipleChoiceOptions({ options, onChange, disabled }: Props) {

  const setText = (id: string, text: string) => {
    onChange(options.map(o => (o.id === id ? { ...o, text } : o)));
  };

  const setCorrect = (id: string) => {
    onChange(options.map(o => ({ ...o, isCorrect: o.id === id })));
  };

  const addOption = () => {
    if (options.length >= 6) return;
    const nextId = String(Math.max(0, ...options.map(o => Number(o.id) || 0)) + 1);
    onChange([...options, { id: nextId, text: '', isCorrect: false }]);
  };

  const removeOption = (id: string) => {
    if (options.length <= 2) return;
    onChange(options.filter(o => o.id !== id));
  };

  return (
    <div className="space-y-2">
      <AnimatePresence initial={false}>
        {options.map((opt, i) => (
          <motion.div
            key={opt.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.18 }}
            className="flex items-start gap-2"
          >
            {/* Letter badge / Correct toggle */}
            <motion.button
              type="button"
              whileHover={{ scale: disabled ? 1 : 1.05 }}
              whileTap={{ scale: disabled ? 1 : 0.95 }}
              disabled={disabled}
              onClick={() => setCorrect(opt.id)}
              className={`shrink-0 mt-1 w-9 h-9 rounded-full flex items-center justify-center font-black text-[13px] font-sukhumvit transition-all ${
                opt.isCorrect
                  ? 'bg-emerald-500 text-white shadow-[0_0_12px_rgba(16,185,129,0.45)]'
                  : 'bg-white/80 text-slate-500 border border-slate-200/70 hover:bg-emerald-50 hover:text-emerald-600'
              } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
              title={opt.isCorrect ? 'ข้อนี้คือคำตอบที่ถูก' : 'คลิกเพื่อตั้งเป็นคำตอบที่ถูก'}
            >
              {opt.isCorrect ? <Check size={15} /> : LETTERS[i] ?? i + 1}
            </motion.button>

            {/* Editor */}
            <div className="flex-1 min-w-0">
              <RichTextEditor
                value={opt.text}
                onChange={(html) => setText(opt.id, html)}
                disabled={disabled}
                placeholder={`ตัวเลือก ${LETTERS[i] ?? i + 1}`}
                compact
              />
            </div>

            {/* Remove option */}
            <button
              type="button"
              disabled={disabled || options.length <= 2}
              onClick={() => removeOption(opt.id)}
              className="shrink-0 mt-1 w-9 h-9 rounded-full flex items-center justify-center text-rose-400 hover:bg-rose-50 hover:text-rose-500 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              title="ลบตัวเลือก"
            >
              <Trash2 size={14} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Add option */}
      {options.length < 6 && (
        <motion.button
          type="button"
          whileHover={{ scale: disabled ? 1 : 1.005 }}
          whileTap={{ scale: disabled ? 1 : 0.995 }}
          onClick={addOption}
          disabled={disabled}
          className="w-full flex items-center justify-center gap-1.5 px-4 py-2 rounded-3xl text-[12px] font-bold text-slate-500 hover:text-slate-800 hover:bg-white/60 border border-dashed border-slate-300/70 transition-all font-sukhumvit disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus size={13} />
          เพิ่มตัวเลือก
        </motion.button>
      )}
    </div>
  );
}
