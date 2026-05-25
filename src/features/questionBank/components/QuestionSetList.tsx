import { motion } from 'framer-motion';
import { Layers3, Pencil, Trash2, BookOpenCheck } from 'lucide-react';
import { SUBJECT_GROUP_CONFIG } from '@/types/curriculum';
import type { QuestionSet } from '@/types/questionBank';

interface Props {
  sets: QuestionSet[];
  onSelect: (set: QuestionSet) => void;
  onEdit: (set: QuestionSet) => void;
  onDelete: (set: QuestionSet) => void;
}

export default function QuestionSetList({ sets, onSelect, onEdit, onDelete }: Props) {
  if (sets.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white/50 py-10 text-center text-slate-400">
        <Layers3 size={40} className="mb-3 opacity-50" />
        <p className="text-[13px] font-bold text-slate-500 font-sukhumvit">ยังไม่มีชุดข้อสอบ</p>
        <p className="mt-1 text-[11px] font-sarabun">กดปุ่ม “เพิ่มชุดข้อสอบ” เพื่อเริ่มสร้างชุดใหม่</p>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-2 overflow-y-auto pr-1">
      {sets.map((set, i) => {
        const groupCfg = SUBJECT_GROUP_CONFIG[set.subjectGroup] ?? SUBJECT_GROUP_CONFIG.other;
        return (
          <motion.div
            key={set.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.025 }}
            onClick={() => onSelect(set)}
            className="rounded-2xl border border-slate-300 bg-white px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors group"
          >
            <div className="flex items-start gap-4">
              {set.coverImage && (
                <div className="shrink-0 w-20 aspect-square rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
                  <img src={set.coverImage} alt="" className="w-full h-full object-cover" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-1.5">
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-black uppercase" style={{ color: groupCfg.color, background: groupCfg.bg }}>
                    {groupCfg.name}
                  </span>
                  {set.subSubjectGroup && (
                    <span className="rounded-full bg-slate-100 border border-slate-200 px-2 py-0.5 text-[10px] font-black text-slate-600">
                      {set.subSubjectGroup}
                    </span>
                  )}
                  <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-black text-indigo-600">
                    {set.questionCount ?? 0} ข้อ
                  </span>
                </div>
                <p className="truncate text-[13px] font-black text-slate-800 font-sukhumvit">{set.title}</p>
                {set.description && (
                  <p className="mt-0.5 line-clamp-2 text-[11px] text-slate-500 font-sarabun">{set.description}</p>
                )}
                <p className="mt-1 flex items-center gap-1 text-[10px] text-slate-400">
                  <BookOpenCheck size={12} />
                  ปีการศึกษา {set.curriculumYear || '-'}
                </p>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onEdit(set); }}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                  title="แก้ไขชุดข้อสอบ"
                >
                  <Pencil size={14} />
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onDelete(set); }}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-rose-400 transition-colors hover:bg-rose-50 hover:text-rose-500"
                  title="ลบชุดข้อสอบ"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

