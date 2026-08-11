import { HiMagnifyingGlass, HiXMark } from 'react-icons/hi2';
import { Button } from '@/components/ui/button';
import {
  ExamFilterShowResultsButton,
  ExamMobileFilterDrawer,
  EXAM_DEPT_FILTER_OPTIONS,
} from '@/features/exam/components/ExamMobileFilterMenuButton';
import {
  SCORE_COLLECTION_FILTER_OPTIONS,
  type ScoreCollectionFilterKey,
} from '@/lib/exam/scoreCollection';
import { SUBJECT_GROUP_CONFIG, type Department, type SubjectGroupId } from '@/types/curriculum';
import type { ExamRoomStatus } from '@/types/exam';
import { SubjectIcon } from '@/features/curriculum/utils/subjectVisual';
import { cn } from '@/lib/utils';

function gradeShortLabel(grade: string): string {
  const dot = grade.indexOf('.');
  return dot >= 0 ? grade.slice(dot + 1) : grade;
}

type StatusFilterKey = 'all' | ExamRoomStatus;

const STATUS_FILTER_OPTIONS: ReadonlyArray<{ key: StatusFilterKey; label: string }> = [
  { key: 'all', label: 'ทั้งหมด' },
  { key: 'upcoming', label: 'รอเปิด' },
  { key: 'active', label: 'กำลังสอบ' },
  { key: 'closed', label: 'ปิดแล้ว' },
];

const STATUS_FILTER_COLORS: Record<StatusFilterKey, string> = {
  all: '#6366f1',
  upcoming: '#f59e0b',
  active: '#059669',
  closed: '#94a3b8',
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filterStatus: StatusFilterKey;
  filterScoreCollection?: ScoreCollectionFilterKey;
  filterDepartment: Department | 'all';
  filterGradeLevel: string;
  filterRoomNumber: string;
  filterSubjectGroup: SubjectGroupId | 'all';
  filterSubSubjectGroup: string;
  searchText: string;
  availableGradeLevels: string[];
  availableRoomNumbers: string[];
  availableSubSubjectGroups: string[];
  /** กลุ่มสาระที่จะให้เลือก — กรองมาจาก parent แล้ว (เช่น นักเรียนเห็นเฉพาะกลุ่มสาระที่ตัวเองมีห้องสอบ) */
  subjectGroupOptions: Array<[string, typeof SUBJECT_GROUP_CONFIG[SubjectGroupId]]>;
  hasActiveFilters: boolean;
  onStatusChange: (status: StatusFilterKey) => void;
  onScoreCollectionChange?: (key: ScoreCollectionFilterKey) => void;
  onDepartmentChange: (dept: Department | 'all') => void;
  onGradeChange: (grade: string) => void;
  onRoomChange: (roomNumber: string) => void;
  onSubjectGroupChange: (group: SubjectGroupId | 'all') => void;
  onSubSubjectGroupChange: (sub: string) => void;
  onSearchChange: (value: string) => void;
  onClearFilters: () => void;
};

export default function ExamRoomsMobileFilterDrawer({
  open,
  onOpenChange,
  filterStatus,
  filterScoreCollection = 'all',
  filterDepartment,
  filterGradeLevel,
  filterRoomNumber,
  filterSubjectGroup,
  filterSubSubjectGroup,
  searchText,
  availableGradeLevels,
  availableRoomNumbers,
  availableSubSubjectGroups,
  subjectGroupOptions,
  hasActiveFilters,
  onStatusChange,
  onScoreCollectionChange,
  onDepartmentChange,
  onGradeChange,
  onRoomChange,
  onSubjectGroupChange,
  onSubSubjectGroupChange,
  onSearchChange,
  onClearFilters,
}: Props) {
  const closeDrawer = () => onOpenChange(false);

  return (
    <ExamMobileFilterDrawer
      open={open}
      onOpenChange={onOpenChange}
      direction="right"
      title="ตัวกรองห้องสอบ"
      description="เลือกแผนก ระดับชั้น หรือค้นหาห้องสอบ"
      footer={(
        <>
          {hasActiveFilters && (
            <Button
              type="button"
              variant="link"
              onClick={() => {
                onClearFilters();
                closeDrawer();
              }}
              className="h-11 shrink-0 px-2 text-[13px] font-black text-rose-600 hover:text-rose-700"
            >
              ล้างตัวกรอง
            </Button>
          )}
          <ExamFilterShowResultsButton onClick={closeDrawer} />
        </>
      )}
    >
      <div>
        <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-slate-400">สถานะ</p>
        <div className="flex h-9 w-full items-center gap-0.5 rounded-lg border border-slate-200/20 bg-slate-100/80 p-0.5">
          {STATUS_FILTER_OPTIONS.map((option) => {
            const active = filterStatus === option.key;
            return (
              <button
                key={option.key}
                type="button"
                onClick={() => onStatusChange(option.key)}
                className={cn(
                  'flex h-8 min-w-0 flex-1 items-center justify-center gap-1 rounded-md px-1.5 text-[10px] font-bold transition-all sm:gap-1.5 sm:text-[11px]',
                  active ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-800',
                )}
              >
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: STATUS_FILTER_COLORS[option.key] }}
                  aria-hidden
                />
                <span className="truncate">{option.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {onScoreCollectionChange && (
        <div>
          <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-slate-400">ประเภทเก็บคะแนน</p>
          <div className="flex flex-wrap gap-1.5">
            {SCORE_COLLECTION_FILTER_OPTIONS.map((option) => {
              const active = filterScoreCollection === option.key;
              return (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => onScoreCollectionChange(option.key)}
                  className={cn(
                    'inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[11px] font-bold transition-all',
                    active
                      ? 'border-slate-800 bg-slate-900 text-white'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
                  )}
                >
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: option.color }}
                    aria-hidden
                  />
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div>
        <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-slate-400">ค้นหา</p>
        <div className="relative">
          <HiMagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={searchText}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="ชื่อห้องสอบ / ชั้นเรียน"
            className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-9 text-[13px] font-bold text-slate-800 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none"
          />
          {searchText.trim().length > 0 && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              aria-label="ล้างคำค้นหา"
            >
              <HiXMark className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div>
        <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-slate-400">แผนก</p>
        <div className="flex flex-wrap gap-1.5">
          {EXAM_DEPT_FILTER_OPTIONS.map((opt) => {
            const active = filterDepartment === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => onDepartmentChange(opt.id)}
                className={cn(
                  'inline-flex h-8 items-center rounded-lg border px-2.5 text-[11px] font-bold transition-all',
                  active
                    ? 'border-slate-800 bg-slate-900 text-white'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
                )}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {availableGradeLevels.length > 0 && (
        <div>
          <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-slate-400">ระดับชั้น</p>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => onGradeChange('all')}
              className={cn(
                'inline-flex h-8 items-center rounded-lg border px-2.5 text-[11px] font-bold transition-all',
                filterGradeLevel === 'all'
                  ? 'border-slate-800 bg-slate-900 text-white'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
              )}
            >
              ทั้งหมด
            </button>
            {availableGradeLevels.map((grade) => {
              const active = filterGradeLevel === grade;
              return (
                <button
                  key={grade}
                  type="button"
                  onClick={() => onGradeChange(grade)}
                  className={cn(
                    'inline-flex h-8 items-center rounded-lg border px-2.5 text-[11px] font-bold transition-all',
                    active
                      ? 'border-slate-800 bg-slate-900 text-white'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
                  )}
                >
                  {gradeShortLabel(grade)}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {availableRoomNumbers.length > 0 && (
        <div>
          <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-slate-400">ห้อง</p>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => onRoomChange('all')}
              className={cn(
                'inline-flex h-8 items-center rounded-lg border px-2.5 text-[11px] font-bold transition-all',
                filterRoomNumber === 'all'
                  ? 'border-slate-800 bg-slate-900 text-white'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
              )}
            >
              ทั้งหมด
            </button>
            {availableRoomNumbers.map((roomNumber) => {
              const active = filterRoomNumber === roomNumber;
              return (
                <button
                  key={roomNumber}
                  type="button"
                  onClick={() => onRoomChange(roomNumber)}
                  className={cn(
                    'inline-flex h-8 items-center rounded-lg border px-2.5 text-[11px] font-bold transition-all',
                    active
                      ? 'border-slate-800 bg-slate-900 text-white'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
                  )}
                >
                  {roomNumber}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {subjectGroupOptions.length > 0 && (
        <div>
          <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-slate-400">กลุ่มสาระ</p>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => onSubjectGroupChange('all')}
              className={cn(
                'inline-flex h-8 items-center rounded-lg border px-2.5 text-[11px] font-bold transition-all',
                filterSubjectGroup === 'all'
                  ? 'border-slate-800 bg-slate-900 text-white'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
              )}
            >
              ทั้งหมด
            </button>
            {subjectGroupOptions.map(([id, cfg]) => {
              const active = filterSubjectGroup === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onSubjectGroupChange(id as SubjectGroupId)}
                  className={cn(
                    'inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[11px] font-bold transition-all',
                    active
                      ? 'border-slate-800 bg-slate-900 text-white'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
                  )}
                >
                  <SubjectIcon
                    subjectGroup={id}
                    className={cn('h-3.5 w-3.5', active ? 'text-white' : 'text-slate-500')}
                  />
                  {cfg.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {availableSubSubjectGroups.length > 0 && (
        <div>
          <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-slate-400">สาระย่อย</p>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => onSubSubjectGroupChange('all')}
              className={cn(
                'inline-flex h-8 items-center rounded-lg border px-2.5 text-[11px] font-bold transition-all',
                filterSubSubjectGroup === 'all'
                  ? 'border-slate-800 bg-slate-900 text-white'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
              )}
            >
              ทั้งหมด
            </button>
            {availableSubSubjectGroups.map((sub) => {
              const active = filterSubSubjectGroup === sub;
              return (
                <button
                  key={sub}
                  type="button"
                  onClick={() => onSubSubjectGroupChange(sub)}
                  className={cn(
                    'inline-flex h-8 items-center rounded-lg border px-2.5 text-[11px] font-bold transition-all',
                    active
                      ? 'border-slate-800 bg-slate-900 text-white'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
                  )}
                >
                  {sub}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </ExamMobileFilterDrawer>
  );
}
