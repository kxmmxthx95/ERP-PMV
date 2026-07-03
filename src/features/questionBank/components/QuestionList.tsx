import { motion } from 'framer-motion';
import { FileQuestion, Edit3, Trash2, Copy, PlayCircle, Plus } from 'lucide-react';
import {
  DIFFICULTY_CONFIG, TYPE_CONFIG, type Question,
} from '@/types/questionBank';
import { SUBJECT_GROUP_CONFIG } from '@/types/curriculum';

interface Props {
  questions: Question[];
  selectedId?: string | null;
  onSelect: (q: Question) => void;
  onDelete: (q: Question) => void;
  onDuplicate: (q: Question) => void;
  onSimulate: (q: Question) => void;
  onAdd?: () => void;
  deleteTooltip?: string;
}

export default function QuestionList({
  questions, selectedId, onSelect, onDelete, onDuplicate, onSimulate, onAdd, deleteTooltip,
}: Props) {
  if (questions.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-10 text-center text-slate-400">
        <FileQuestion size={42} className="mb-3 opacity-50" />
        <p className="text-[13px] font-bold font-sukhumvit text-slate-500">ยังไม่มีข้อสอบในชุดนี้</p>
        <p className="mt-1 font-sarabun text-[11px]">สร้างข้อสอบทีละข้อ พิมพ์โจทย์แบบ Word ได้เลย</p>
        {onAdd && (
          <motion.button
            type="button"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={onAdd}
            className="mt-5 flex items-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-[13px] font-black text-white shadow-lg shadow-slate-900/15 font-sukhumvit"
          >
            <Plus size={16} strokeWidth={3} />
            สร้างข้อสอบข้อแรก
          </motion.button>
        )}
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto min-h-0 scrollbar-hide space-y-2 px-1 py-2">
      {questions.map((q, i) => {
        const isActive = q.id === selectedId;
        const diff = DIFFICULTY_CONFIG[q.difficulty];
        const typ = TYPE_CONFIG[q.type];
        const grp = SUBJECT_GROUP_CONFIG[q.subjectGroup ?? 'other'];
        const plain = q.questionText
          .replace(/<[^>]*>/g, '')
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .trim();

        return (
          <motion.div
            key={q.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.025 }}
            onClick={() => onSimulate(q)}
            className={`group relative rounded-[1.5rem] p-3 px-4 flex items-start gap-3 cursor-pointer shadow-[0_2px_8px_rgba(15,23,42,0.035)] ${
              isActive ? 'ring-2 ring-indigo-500/25' : ''
            }`}
            style={{
              background: isActive ? '#f8fafc' : 'white',
            }}
          >
            {/* Left: index */}
            <div className="shrink-0 pt-0.5">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black font-sukhumvit ${
                  isActive ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-500'
                }`}
              >
                {i + 1}
              </div>
            </div>

            {/* Middle: content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                <span
                  className="text-[9px] font-black uppercase px-2 py-0.5 rounded-lg font-sukhumvit"
                  style={{ color: typ.color, background: typ.bg }}
                >
                  {typ.shortLabel}
                </span>
                <span
                  className="text-[9px] font-black px-2 py-0.5 rounded-lg font-sukhumvit"
                  style={{ color: grp.color, background: grp.bg }}
                >
                  {grp.name}
                </span>
                <span
                  className="text-[9px] font-black uppercase px-2 py-0.5 rounded-lg font-sukhumvit"
                  style={{ color: diff.color, background: diff.bg }}
                >
                  {diff.label}
                </span>
                <span
                  className={`text-[9px] font-bold font-sarabun ${
                    isActive ? 'text-white/70' : 'text-slate-400'
                  }`}
                >
                  {q.indicator && `· ${q.indicator}`}
                </span>
              </div>
              <p
                className={`text-[12px] font-sarabun line-clamp-2 leading-snug ${
                  isActive ? 'text-white/95' : 'text-slate-700'
                }`}
              >
                {plain || <span className="italic opacity-60">(ไม่มีข้อความโจทย์)</span>}
              </p>
            </div>

            {/* Right: actions */}
            <div className="shrink-0 flex items-center gap-1 transition-opacity">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onSimulate(q); }}
                className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                  isActive
                    ? 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100'
                    : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'
                }`}
                title="ทดลองทำข้อสอบ"
              >
                <PlayCircle size={14} strokeWidth={2.5} />
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onSelect(q); }}
                className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                  isActive
                    ? 'text-slate-600 hover:bg-slate-100'
                    : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'
                }`}
                title="แก้ไข"
              >
                <Edit3 size={12} />
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onDuplicate(q); }}
                className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                  isActive
                    ? 'text-slate-600 hover:bg-slate-100'
                    : 'text-slate-400 hover:bg-indigo-50 hover:text-indigo-500'
                }`}
                title="คัดลอก"
              >
                <Copy size={12} />
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onDelete(q); }}
                className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                  isActive
                    ? 'text-rose-500 hover:bg-rose-50'
                    : 'text-rose-400 hover:bg-rose-50 hover:text-rose-500'
                }`}
                title={deleteTooltip || 'ลบ'}
              >
                <Trash2 size={12} />
              </button>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
