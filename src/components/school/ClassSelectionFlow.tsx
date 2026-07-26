import {
  DepartmentPickerCoverflow,
  DEPT_CARD_GRADIENT,
  PickerCoverflow,
} from '@/components/school/DepartmentPickerCoverflow';
import type { Department } from '@/types/curriculum';

export type DepartmentFilter = 'all' | Department;

export const DEPARTMENT_GRADES: Record<DepartmentFilter, string[]> = {
  all: [],
  early: ['อ.1', 'อ.2', 'อ.3'],
  primary: ['ป.1', 'ป.2', 'ป.3', 'ป.4', 'ป.5', 'ป.6'],
  secondary: ['ม.1', 'ม.2', 'ม.3', 'ม.4', 'ม.5', 'ม.6'],
};

export function gradeLevelSubtitle(level: string): string {
  return level
    .replace(/^ม\./, 'M.')
    .replace(/^ป\./, 'P.')
    .replace(/^อ\./, 'K.');
}

export function ClassSelectionFlow({
  selectedDept,
  selectedLevel,
  gradeOptions,
  roomOptions,
  onSelectDept,
  onSelectLevel,
  onSelectRoom,
}: {
  selectedDept: DepartmentFilter;
  selectedLevel: string | null;
  gradeOptions: string[];
  roomOptions: string[];
  onSelectDept: (dept: Department) => void;
  onSelectLevel: (level: string) => void;
  onSelectRoom: (room: string) => void;
}) {
  const step = selectedDept === 'all' ? 'dept' : !selectedLevel ? 'grade' : 'room';
  const dept = selectedDept === 'all' ? null : selectedDept;
  const cardGradient = dept ? DEPT_CARD_GRADIENT[dept] : DEPT_CARD_GRADIENT.secondary;

  return (
    <div className="flex min-h-[calc(100dvh-8.5rem)] flex-1 flex-col items-center justify-center px-3 py-2 md:px-6">
      {step === 'dept' && (
        <div className="flex w-full flex-col items-center justify-center">
          <DepartmentPickerCoverflow onSelect={onSelectDept} />
        </div>
      )}

      {step === 'grade' && (
        <div className="flex min-h-0 flex-1 w-full flex-col items-center justify-center">
          {gradeOptions.length === 0 ? (
            <p className="py-12 text-center text-sm font-bold text-slate-400">
              ไม่พบระดับชั้นในแผนกนี้
            </p>
          ) : (
            <PickerCoverflow
              ariaLabel="ระดับชั้น"
              onSelect={onSelectLevel}
              items={gradeOptions.map((level) => ({
                id: level,
                label: level,
                subtitle: gradeLevelSubtitle(level),
                gradient: cardGradient,
              }))}
            />
          )}
        </div>
      )}

      {step === 'room' && (
        <div className="flex min-h-0 flex-1 w-full flex-col items-center justify-center">
          {roomOptions.length === 0 ? (
            <p className="py-12 text-center text-sm font-bold text-slate-400">
              ไม่พบห้องเรียนในระดับชั้นนี้
            </p>
          ) : (
            <PickerCoverflow
              ariaLabel="ห้องเรียน"
              onSelect={onSelectRoom}
              items={roomOptions.map((room) => ({
                id: room,
                label: selectedLevel ? `${selectedLevel}/${room}` : room,
                subtitle: 'Classroom',
                gradient: cardGradient,
              }))}
            />
          )}
        </div>
      )}
    </div>
  );
}
