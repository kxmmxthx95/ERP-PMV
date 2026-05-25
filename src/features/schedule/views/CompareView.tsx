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
  compareGrid,
}: CompareViewProps) {
  return (
    <div className="space-y-8 pb-8">
      <div className="space-y-2">
        <div className="flex items-center gap-2 pl-1">
          <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
          <span className="text-[10px] font-black text-black/35 uppercase tracking-widest">
            ห้องหลัก{selectedClassId ? ` — ${selectedClassId}` : ''}
          </span>
        </div>
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

      <div className="space-y-2">
        <div className="flex items-center gap-2 pl-1">
          <div className="w-1.5 h-1.5 rounded-full bg-slate-400" />
          <span className="text-[10px] font-black text-black/30 uppercase tracking-widest">
            ห้องเปรียบเทียบ{compareClassId ? ` — ${compareClassId}` : ''}
          </span>
        </div>
        <ScheduleGrid
          grid={compareGrid}
          viewMode="class"
          classId={compareClassId}
          readOnly
          onSlotClick={() => {}}
          onDeleteEntry={() => {}}
        />
      </div>
    </div>
  );
}
