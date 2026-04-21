import ScheduleGrid from '../components/ScheduleGrid';
import type { SchoolDay } from '@/types/schedule';

interface CompareViewProps {
  grid: any;
  selectedClassId: string;
  isEditMode: boolean;
  openSlotModal: (day: SchoolDay, period: number, entry?: any) => void;
  deleteEntry: (id: string) => Promise<void>;
  moveEntry: (id: string, day: SchoolDay, period: number) => Promise<any>;
  compareClassId: string;
  compareGrid: any;
}

export function CompareView({
  grid,
  selectedClassId,
  isEditMode,
  openSlotModal,
  deleteEntry,
  moveEntry,
  compareClassId,
  compareGrid
}: CompareViewProps) {
  return (
    <div className="space-y-8 pb-10">
      <div className="space-y-2">
        <h3 className="text-xs font-black text-black/30 uppercase tracking-widest pl-2">Main Schedule</h3>
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
      </div>

      <div className="space-y-2 pt-4 border-t border-black/5">
        <h3 className="text-xs font-black text-black/30 uppercase tracking-widest pl-2">Comparison View</h3>
        <ScheduleGrid
          grid={compareGrid}
          viewMode="class"
          classId={compareClassId}
          readOnly
          onSlotClick={() => { }}
          onDeleteEntry={() => { }}
        />
      </div>
    </div>
  );
}
