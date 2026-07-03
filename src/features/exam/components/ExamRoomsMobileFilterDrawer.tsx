import { HiMagnifyingGlass, HiPlus, HiXMark } from 'react-icons/hi2';
import {
  ExamFilterShowResultsButton,
  ExamMobileFilterDrawer,
  EXAM_DEPT_FILTER_OPTIONS,
} from '@/features/exam/components/ExamMobileFilterMenuButton';
import { SUBJECT_GROUP_CONFIG, type Department, type SubjectGroupId } from '@/types/curriculum';
import { cn } from '@/lib/utils';

function gradeShortLabel(grade: string): string {
  const dot = grade.indexOf('.');
  return dot >= 0 ? grade.slice(dot + 1) : grade;
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filterDepartment: Department | 'all';
  filterGradeLevel: string;
  filterRoomNumber: string;
  filterSubjectGroup: SubjectGroupId | 'all';
  searchText: string;
  availableGradeLevels: string[];
  availableRoomNumbers: string[];
  hasActiveFilters: boolean;
  canCreate: boolean;
  onDepartmentChange: (dept: Department | 'all') => void;
  onGradeChange: (grade: string) => void;
  onRoomChange: (roomNumber: string) => void;
  onSubjectGroupChange: (group: SubjectGroupId | 'all') => void;
  onSearchChange: (value: string) => void;
  onClearFilters: () => void;
  onCreateRoom: () => void;
};

export default function ExamRoomsMobileFilterDrawer({
  open,
  onOpenChange,
  filterDepartment,
  filterGradeLevel,
  filterRoomNumber,
  filterSubjectGroup,
  searchText,
  availableGradeLevels,
  availableRoomNumbers,
  hasActiveFilters,
  canCreate,
  onDepartmentChange,
  onGradeChange,
  onRoomChange,
  onSubjectGroupChange,
  onSearchChange,
  onClearFilters,
  onCreateRoom,
}: Props) {
  const subjectGroups = Object.entries(SUBJECT_GROUP_CONFIG).sort(([, a], [, b]) => a.order - b.order);

  const closeDrawer = () => onOpenChange(false);

  return (
    <ExamMobileFilterDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="ตัวกรองห้องสอบ"
      description="เลือกแผนก ระดับชั้น หรือค้นหาห้องสอบ"
      footer={(
        <>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => {
                onClearFilters();
                closeDrawer();
              }}
              className="h-11 flex-1 rounded-xl border border-rose-200 bg-rose-50 text-[13px] font-black text-rose-600 transition-colors hover:bg-rose-100"
            >
              ล้างตัวกรอง
            </button>
          )}
          {canCreate && (
            <button
              type="button"
              onClick={() => {
                onCreateRoom();
                closeDrawer();
              }}
              className="h-11 flex-1 rounded-xl border border-slate-200 bg-white text-[13px] font-black text-slate-700 transition-colors hover:bg-slate-50"
            >
              <span className="inline-flex items-center justify-center gap-1.5">
                <HiPlus className="h-4 w-4" />
                เพิ่มห้อง
              </span>
            </button>
          )}
          <ExamFilterShowResultsButton onClick={closeDrawer} />
        </>
      )}
    >
      <div>
        <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-slate-400">แผนก</p>
        <div className="grid grid-cols-2 gap-2">
          {EXAM_DEPT_FILTER_OPTIONS.map((dept) => {
            const isActive = filterDepartment === dept.id;
            return (
              <button
                key={dept.id}
                type="button"
                onClick={() => onDepartmentChange(dept.id)}
                className={cn(
                  'rounded-xl border px-3 py-2.5 text-[12px] font-black transition-all',
                  isActive
                    ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
                )}
              >
                {dept.label}
              </button>
            );
          })}
        </div>
      </div>

      {filterDepartment !== 'all' && availableGradeLevels.length > 0 && (
        <div>
          <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-slate-400">ระดับชั้น</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onGradeChange('all')}
              className={cn(
                'rounded-full px-3 py-1.5 text-[11px] font-black transition-all',
                filterGradeLevel === 'all'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600',
              )}
            >
              ทุกระดับ
            </button>
            {availableGradeLevels.map((grade) => (
              <button
                key={grade}
                type="button"
                onClick={() => onGradeChange(grade)}
                className={cn(
                  'rounded-full px-3 py-1.5 text-[11px] font-black transition-all',
                  filterGradeLevel === grade
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600',
                )}
              >
                {gradeShortLabel(grade)}
              </button>
            ))}
          </div>
        </div>
      )}

      {filterDepartment !== 'all' && filterGradeLevel !== 'all' && availableRoomNumbers.length > 0 && (
        <div>
          <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-slate-400">ห้อง</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onRoomChange('all')}
              className={cn(
                'rounded-full px-3 py-1.5 text-[11px] font-black transition-all',
                filterRoomNumber === 'all'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600',
              )}
            >
              ทุกห้อง
            </button>
            {availableRoomNumbers.map((roomNumber) => (
              <button
                key={roomNumber}
                type="button"
                onClick={() => onRoomChange(roomNumber)}
                className={cn(
                  'rounded-full px-3 py-1.5 text-[11px] font-black transition-all',
                  filterRoomNumber === roomNumber
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600',
                )}
              >
                {roomNumber}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <label className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-slate-400">
          กลุ่มสาระ
        </label>
        <select
          value={filterSubjectGroup}
          onChange={(e) => onSubjectGroupChange(e.target.value as SubjectGroupId | 'all')}
          className={cn(
            'h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-[13px] font-bold text-slate-800 outline-none transition-all focus:border-blue-200 focus:ring-4 focus:ring-blue-50/50',
            filterSubjectGroup === 'all' && 'text-slate-400',
          )}
        >
          <option value="all">ทุกกลุ่มสาระ</option>
          {subjectGroups.map(([id, group]) => (
            <option key={id} value={id}>
              {group.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-slate-400">
          ค้นหา
        </label>
        <div className="relative">
          <HiMagnifyingGlass className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
          <input
            type="text"
            placeholder="ชื่อห้องสอบ หรือชั้นเรียน..."
            value={searchText}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-9 text-[13px] font-bold text-slate-800 placeholder:text-slate-400 outline-none transition-all focus:border-blue-200 focus:ring-4 focus:ring-blue-50/50"
          />
          {searchText && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              aria-label="ล้างคำค้นหา"
            >
              <HiXMark size={14} />
            </button>
          )}
        </div>
      </div>
    </ExamMobileFilterDrawer>
  );
}
