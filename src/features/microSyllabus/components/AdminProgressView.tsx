import { useCallback, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { SubjectFolderCard } from '@/components/SubjectFolderCard';
import { cn } from '@/lib/utils';
import type { SubjectCategory } from '@/types/curriculum';
import type { MicroSyllabus } from '@/types/microSyllabus';
import { computeSyllabusPct, type SyllabusProgressContext } from '../utils/teachingPlanCalendar';
import {
  DEFAULT_COLOR_ID,
  loadFolderCardColors,
  saveFolderCardColors,
  type FolderCardColorId,
} from '../utils/folderCardColor';

interface Props {
  syllabi: MicroSyllabus[];
  onSelect?: (syllabus: MicroSyllabus) => void;
  /** subjectId / code / name → ประเภทวิชา (kept for callers; unused in folder UI) */
  subjectCategoryByKey?: ReadonlyMap<string, SubjectCategory>;
  progressCtx: SyllabusProgressContext;
}

function pctMeta(pct: number) {
  return (
    <p
      className={cn(
        'pt-0.5 text-[11px] font-black',
        pct >= 80
          ? 'text-emerald-600'
          : pct >= 50
            ? 'text-amber-500'
            : pct > 0
              ? 'text-sky-600'
              : 'text-rose-500',
      )}
    >
      {pct}%
    </p>
  );
}

export default function AdminProgressView({ syllabi, onSelect, progressCtx }: Props) {
  const [folderColors, setFolderColors] = useState<Record<string, FolderCardColorId>>(() =>
    loadFolderCardColors(),
  );

  const setFolderColor = useCallback((key: string, id: FolderCardColorId) => {
    setFolderColors((prev) => {
      const next = { ...prev, [key]: id };
      saveFolderCardColors(next);
      return next;
    });
  }, []);

  const byGrade = useMemo(() => {
    const groups: Record<string, MicroSyllabus[]> = {};
    for (const s of syllabi) {
      const grade = s.gradeLevel || 'อื่นๆ';
      if (!groups[grade]) groups[grade] = [];
      groups[grade].push(s);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b, 'th'));
  }, [syllabi]);

  if (syllabi.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-3xl">
          📊
        </div>
        <p className="font-sukhumvit font-black text-slate-700">ยังไม่มีข้อมูลแผนการสอน</p>
        <p className="font-sarabun text-sm text-slate-400">ครูผู้สอนกรอกข้อมูลจะแสดงที่นี่</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {byGrade.map(([grade, items], gi) => (
        <motion.section
          key={grade}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: gi * 0.06 }}
        >

          <div className="grid w-full grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 xl:grid-cols-4">
            {[...items]
              .sort((a, b) => computeSyllabusPct(a, progressCtx).pct - computeSyllabusPct(b, progressCtx).pct)
              .map((s) => {
                const { pct, total } = computeSyllabusPct(s, progressCtx);
                const colorKey = `${s.subjectId}|${s.classId}`;

                return (
                  <SubjectFolderCard
                    key={s.id}
                    title={s.subjectName}
                    subtitle={s.className || s.gradeLevel}
                    meta={pctMeta(pct)}
                    colorId={folderColors[colorKey] ?? DEFAULT_COLOR_ID}
                    onColorChange={(id) => setFolderColor(colorKey, id)}
                    onClick={() => onSelect?.(s)}
                    showPaper={total > 0}
                  />
                );
              })}
          </div>
        </motion.section>
      ))}
    </div>
  );
}
