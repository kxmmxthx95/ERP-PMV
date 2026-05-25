import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  DIFFICULTY_CONFIG, TYPE_CONFIG,
  type QuestionDifficulty, type QuestionType,
} from '@/types/questionBank';
import { SUBJECT_GROUP_CONFIG, type SubjectGroupId } from '@/types/curriculum';

interface Props {
  search: string;
  onSearch: (s: string) => void;
  difficulty: QuestionDifficulty | 'all';
  onDifficulty: (d: QuestionDifficulty | 'all') => void;
  type: QuestionType | 'all';
  onType: (t: QuestionType | 'all') => void;
  subjectGroup: SubjectGroupId | 'all';
  onSubjectGroup: (g: SubjectGroupId | 'all') => void;
  subjectGroups: SubjectGroupId[];
}

const DIFF_OPTIONS: (QuestionDifficulty | 'all')[] = ['all', 'easy', 'medium', 'hard'];
const TYPE_OPTIONS: (QuestionType | 'all')[] = ['all', 'multiple_choice', 'essay'];

export default function QuestionFilters({
  search, onSearch, difficulty, onDifficulty, type, onType,
  subjectGroup, onSubjectGroup, subjectGroups,
}: Props) {
  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="relative">
        <Search size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <Input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="ค้นหาข้อสอบ / ตัวชี้วัด"
          className="h-10 pl-9 rounded-3xl border text-xs font-medium focus-visible:ring-2 focus-visible:ring-blue-500/20 shadow-none font-sarabun"
          style={{ background: 'rgba(255,255,255,0.6)', borderColor: 'rgba(200,180,255,0.4)' }}
        />
      </div>

      {/* Subject group */}
      {subjectGroups.length > 0 && (
        <FilterRow label="กลุ่มสาระ">
          <Pill active={subjectGroup === 'all'} onClick={() => onSubjectGroup('all')} label="ทั้งหมด" />
          {subjectGroups.map((g) => (
            <Pill
              key={g}
              active={subjectGroup === g}
              onClick={() => onSubjectGroup(g)}
              label={SUBJECT_GROUP_CONFIG[g].name}
              color={SUBJECT_GROUP_CONFIG[g].color}
            />
          ))}
        </FilterRow>
      )}

      {/* Difficulty */}
      <FilterRow label="ระดับความยาก">
        {DIFF_OPTIONS.map(d => (
          <Pill
            key={d}
            active={difficulty === d}
            onClick={() => onDifficulty(d)}
            label={d === 'all' ? 'ทั้งหมด' : DIFFICULTY_CONFIG[d].label}
            color={d !== 'all' ? DIFFICULTY_CONFIG[d].color : undefined}
          />
        ))}
      </FilterRow>

      {/* Type */}
      <FilterRow label="ประเภท">
        {TYPE_OPTIONS.map(t => (
          <Pill
            key={t}
            active={type === t}
            onClick={() => onType(t)}
            label={t === 'all' ? 'ทั้งหมด' : TYPE_CONFIG[t].shortLabel}
            color={t !== 'all' ? TYPE_CONFIG[t].color : undefined}
          />
        ))}
      </FilterRow>
    </div>
  );
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-sukhumvit mb-1.5">
        {label}
      </p>
      <div className="flex items-center gap-1.5 flex-wrap">{children}</div>
    </div>
  );
}

function Pill({
  active, onClick, label, color,
}: { active: boolean; onClick: () => void; label: string; color?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition-all font-sukhumvit ${
        active
          ? 'bg-slate-900 text-white shadow-md'
          : 'text-slate-500 hover:bg-black/5'
      }`}
      style={!active && color ? { color } : undefined}
    >
      {label}
    </button>
  );
}
