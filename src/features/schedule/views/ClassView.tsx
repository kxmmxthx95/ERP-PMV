import { LayoutGrid } from 'lucide-react';
import ScheduleGrid from '../components/ScheduleGrid';
import type { ConflictResult, ScheduleEntry, SchoolClass, SchoolDay } from '@/types/schedule';
import type { Teacher } from '@/types/schedule';

interface ClassViewProps {
  grid: Record<number, Record<number, ScheduleEntry[]>>;
  selectedClassId: string;
  isEditMode: boolean;
  openSlotModal: (day: SchoolDay, period: number, entry?: ScheduleEntry | null) => void;
  deleteEntry: (id: string) => Promise<void>;
  moveEntry: (id: string, day: SchoolDay, period: number) => Promise<ConflictResult>;
  onDropSubject?: (day: SchoolDay, period: number, subjectId: string, teacherId: string) => void;
  setIsEditMode: (val: boolean) => void;
  allClasses?: SchoolClass[];
  teachers?: Teacher[];
  excessEntryIds?: Set<string>;
  draggableSubjects?: {
    id: string;
    code: string;
    name: string;
    hoursPerWeek?: number;
    subjectGroup?: string;
    assignedTeacherId?: string;
    className?: string;
  }[];
}

export function ClassView({
  grid,
  selectedClassId,
  isEditMode,
  openSlotModal,
  deleteEntry,
  moveEntry,
  onDropSubject,
  setIsEditMode,
  allClasses,
  teachers,
  excessEntryIds,
  draggableSubjects,
}: ClassViewProps) {
  if (!selectedClassId) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center px-4 animate-in fade-in zoom-in duration-500">
        <div className="w-16 h-16 rounded-3xl bg-blue-50 flex items-center justify-center mb-4 border border-blue-100 shadow-sm">
          <LayoutGrid size={32} className="text-blue-400" />
        </div>
        <h3 className="text-[13px] font-black text-slate-800 mb-1">ยังไม่ได้เลือกห้องเรียน</h3>
        <p className="text-[11px] text-slate-500 max-w-[200px] leading-relaxed font-medium">
          กรุณาเลือกห้องเรียนจากฟิลเตอร์ด้านบนเพื่อเรียกดูตารางสอน
        </p>
      </div>
    );
  }

  return (
    <ScheduleGrid
      grid={grid}
      viewMode="class"
      classId={selectedClassId}
      readOnly={!isEditMode}
      isEditMode={isEditMode}
      setIsEditMode={setIsEditMode}
      onSlotClick={(day, period, entry) => isEditMode && openSlotModal(day, period, entry)}
      onDeleteEntry={async (id) => await deleteEntry(id)}
      onMoveEntry={async (id, day, period) => {
        const res = await moveEntry(id, day, period);
        if (res.hasConflict) alert('ไม่สามารถย้ายได้: ' + res.conflicts[0].message);
      }}
      onDropSubject={onDropSubject}
      allClasses={allClasses}
      teachers={teachers}
      excessEntryIds={excessEntryIds}
      draggableSubjects={draggableSubjects}
    />
  );
}
