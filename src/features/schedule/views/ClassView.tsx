import ScheduleGrid from '../components/ScheduleGrid';
import type { ConflictResult, ScheduleEntry, SchoolClass, SchoolDay, Teacher } from '@/types/schedule';

interface ClassViewProps {
  grid: Record<number, Record<number, ScheduleEntry[]>>;
  selectedClassId: string;
  filterDept: 'all' | 'early' | 'primary' | 'secondary';
  isEditMode: boolean;
  openSlotModal: (day: SchoolDay, period: number, entry?: ScheduleEntry | null) => void;
  deleteEntry: (id: string) => Promise<void>;
  moveEntry: (id: string, day: SchoolDay, period: number) => Promise<ConflictResult>;
  onDropSubject?: (day: SchoolDay, period: number, subjectId: string, teacherId: string, classId?: string) => void;
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
    classId?: string;
  }[];
  jointClassEntryIds?: Set<string>;
  jointClassPartnersByEntryId?: Map<string, string[]>;
}

export function ClassView({
  grid,
  selectedClassId,
  filterDept,
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
  jointClassEntryIds,
  jointClassPartnersByEntryId,
}: ClassViewProps) {
  return (
    <ScheduleGrid
      grid={grid}
      viewMode="class"
      classId={selectedClassId}
      filterDept={filterDept}
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
      jointClassEntryIds={jointClassEntryIds}
      jointClassPartnersByEntryId={jointClassPartnersByEntryId}
    />
  );
}
