import ScheduleGrid from '../components/ScheduleGrid';
import type { ReactNode } from 'react';
import type { ConflictResult, ScheduleEntry, SchoolClass, SchoolDay } from '@/types/schedule';
import type { Teacher } from '@/types/schedule';

interface ClassViewProps {
  grid: Record<number, Record<number, ScheduleEntry[]>>;
  selectedClassId: string;
  setSelectedClassId: (id: string) => void;
  filterDept: 'all' | 'early' | 'primary' | 'secondary';
  setFilterDept: (v: 'all' | 'early' | 'primary' | 'secondary') => void;
  filterGrade: string;
  setFilterGrade: (v: string) => void;
  filteredClasses?: SchoolClass[];
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
  mobileHeaderContent?: ReactNode;
  jointClassEntryIds?: Set<string>;
  jointClassPartnersByEntryId?: Map<string, string[]>;
}

export function ClassView({
  grid,
  selectedClassId,
  setSelectedClassId,
  filterDept,
  setFilterDept,
  filterGrade,
  setFilterGrade,
  filteredClasses,
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
  mobileHeaderContent,
  jointClassEntryIds,
  jointClassPartnersByEntryId,
}: ClassViewProps) {
  return (
    <ScheduleGrid
      grid={grid}
      viewMode="class"
      classId={selectedClassId}
      filterDept={filterDept}
      setFilterDept={setFilterDept}
      filterGrade={filterGrade}
      setFilterGrade={setFilterGrade}
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
      filteredClasses={filteredClasses}
      onClassSelect={setSelectedClassId}
      teachers={teachers}
      excessEntryIds={excessEntryIds}
      draggableSubjects={draggableSubjects}
      mobileHeaderContent={mobileHeaderContent}
      jointClassEntryIds={jointClassEntryIds}
      jointClassPartnersByEntryId={jointClassPartnersByEntryId}
    />
  );
}
