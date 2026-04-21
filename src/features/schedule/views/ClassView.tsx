import ScheduleGrid from '../components/ScheduleGrid';
import type { SchoolDay } from '@/types/schedule';

interface ClassViewProps {
  grid: any;
  selectedClassId: string;
  isEditMode: boolean;
  openSlotModal: (day: SchoolDay, period: number, entry?: any) => void;
  deleteEntry: (id: string) => Promise<void>;
  moveEntry: (id: string, day: SchoolDay, period: number) => Promise<any>;
}

export function ClassView({
  grid,
  selectedClassId,
  isEditMode,
  openSlotModal,
  deleteEntry,
  moveEntry
}: ClassViewProps) {
  return (
    <ScheduleGrid
      grid={grid}
      viewMode="class"
      classId={selectedClassId}
      readOnly={!isEditMode}
      onSlotClick={(day, period, entry) => isEditMode && openSlotModal(day, period, entry)}
      onDeleteEntry={async (id) => await deleteEntry(id)}
      onMoveEntry={async (id, day, period) => {
        const res = await moveEntry(id, day, period);
        if (res.hasConflict) alert('ไม่สามารถย้ายได้: ' + res.conflicts[0].message);
      }}
    />
  );
}
