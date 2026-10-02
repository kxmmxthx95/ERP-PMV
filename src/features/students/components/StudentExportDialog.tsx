import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogTitle } from '@/components/ui/dialog';
import { logActivity } from '@/lib/activityLogger';
import type { StudentCard } from '@/types/student';
import { compareGradeLevel, exportStudentsByGrade } from '../utils/studentExport';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** ทุกคนในปีที่เลือก (จำกัดตามแผนกของผู้ใช้แล้ว) */
  cards: StudentCard[];
  year: string;
}

export default function StudentExportDialog({ open, onOpenChange, cards, year }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const countByGrade = useMemo(() => {
    const m = new Map<string, number>();
    cards.forEach((c) => c.currentGrade && m.set(c.currentGrade, (m.get(c.currentGrade) ?? 0) + 1));
    return [...m.entries()].sort(([a], [b]) => compareGradeLevel(a, b));
  }, [cards]);

  const allSelected = countByGrade.length > 0 && selected.size === countByGrade.length;
  const toggle = (grade: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (!next.delete(grade)) next.add(grade);
      return next;
    });

  const handleExport = async () => {
    setBusy(true);
    try {
      await exportStudentsByGrade(cards, [...selected], year);
      void logActivity({
        action: 'student_export',
        category: 'data',
        detail: `นำออกรายชื่อนักเรียน ปี ${year}: ${[...selected].sort(compareGradeLevel).join(', ')}`,
      });
      onOpenChange(false);
    } catch (err) {
      console.error('student export failed:', err);
      toast.error('นำออกไฟล์ไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[92vw] rounded-2xl border-none p-6 sm:max-w-sm">
        <DialogTitle className="text-lg font-black tracking-tight text-slate-800">
          นำออกไฟล์รายชื่อนักเรียน
        </DialogTitle>
        <div className="space-y-1">
          <label className="text-[10px] font-black uppercase tracking-wider text-slate-600">
            เลือกระดับชั้น ({year})
          </label>
          <label className="flex cursor-pointer items-center gap-3 rounded-xl bg-slate-50/70 px-4 py-2.5 text-xs font-bold">
            <Checkbox
              checked={allSelected}
              onCheckedChange={() =>
                setSelected(allSelected ? new Set() : new Set(countByGrade.map(([g]) => g)))
              }
            />
            ทั้งหมด
          </label>
          <div className="max-h-64 space-y-1 overflow-y-auto">
            {countByGrade.map(([grade, count]) => (
              <label
                key={grade}
                className="flex cursor-pointer items-center gap-3 rounded-xl bg-slate-50/70 px-4 py-2.5 text-xs font-bold"
              >
                <Checkbox checked={selected.has(grade)} onCheckedChange={() => toggle(grade)} />
                <span className="flex-1">{grade}</span>
                <span className="text-slate-500">{count} คน</span>
              </label>
            ))}
            {countByGrade.length === 0 && (
              <p className="px-1 py-4 text-center text-xs text-slate-500">ไม่พบนักเรียนในปีการศึกษานี้</p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button className="w-full" disabled={selected.size === 0 || busy} onClick={() => void handleExport()}>
            นำออก Excel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
