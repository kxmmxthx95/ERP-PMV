import { useState, useEffect } from 'react';
import { Clock, Save, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { useScheduleSettings } from '@/hooks/useScheduleSettings';

interface ScheduleSettingsModalProps {
  classId?: string;
}

export default function ScheduleSettingsModal({ classId }: ScheduleSettingsModalProps) {
  const { periodCount, lunchPeriods, periodTimes, updateSettings } = useScheduleSettings(classId);

  const [open, setOpen] = useState(false);
  const [localCount, setLocalCount] = useState(periodCount);
  const [localLunches, setLocalLunches] = useState<number[]>(lunchPeriods);
  const [localTimes, setLocalTimes] = useState(periodTimes);

  // ดึงค่าล่าสุดมาแสดงเมื่อเปิด Modal
  useEffect(() => {
    if (open) {
      setLocalCount(periodCount);
      setLocalLunches(lunchPeriods);
      setLocalTimes(periodTimes);
    }
  }, [open, periodCount, lunchPeriods, periodTimes]);

  const handleSave = async () => {
    await updateSettings({
      periodCount: localCount,
      lunchPeriods: localLunches.filter(p => p <= localCount),
      periodTimes: localTimes
    });
    toast.success('บันทึกการตั้งค่าคาบเรียนเรียบร้อยแล้ว');
    setOpen(false);
  };

  const toggleLunch = (period: number) => {
    setLocalLunches(prev =>
      prev.includes(period)
        ? prev.filter(p => p !== period)
        : [...prev, period].sort((a, b) => a - b)
    );
  };

  const updateTime = (period: number, value: string) => {
    setLocalTimes(prev => ({ ...prev, [period]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="w-full sm:w-auto h-auto py-1 px-2.5 rounded-md flex items-center justify-center gap-1.5 text-[11px] font-semibold transition-colors hover:bg-black/5 border-none shadow-none text-black/70 flex-shrink-0">
          <Settings size={13} />
          ตั้งค่า
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl bg-white/95 backdrop-blur-xl border-white/50 rounded-3xl shadow-2xl p-6">
        <DialogHeader className="flex flex-row items-center gap-3 border-b border-black/5 pb-4 mb-4">
          <div className="w-9 h-9 rounded-xl bg-[#1e1e1e] flex items-center justify-center shadow-md flex-shrink-0">
            <Clock className="text-white" size={18} />
          </div>
          <div className="flex flex-col items-start">
            <DialogTitle className="text-sm font-bold text-black/80">ตั้งค่าคาบเรียนและเวลา</DialogTitle>
            <p className="text-xs text-black/40 mt-0.5">กำหนดจำนวนคาบเรียนต่อวันและเวลาในแต่ละคาบ ({classId || 'ค่าเริ่มต้น'})</p>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="space-y-2">
            <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">จำนวนคาบเรียนต่อวัน</Label>
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={() => setLocalCount(Math.max(1, localCount - 1))} className="h-8 rounded-lg">-</Button>
              <span className="text-sm font-bold w-6 text-center">{localCount}</span>
              <Button variant="outline" size="sm" onClick={() => setLocalCount(localCount + 1)} className="h-8 rounded-lg">+</Button>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-2 block border-b border-black/5 pb-2">กำหนดเวลาและประเภทคาบ</Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[40vh] overflow-y-auto pr-2">
            {Array.from({ length: localCount }, (_, i) => i + 1).map(period => {
              const isLunch = localLunches.includes(period);
              return (
                <div key={period} className={`p-3 rounded-xl border transition-all ${isLunch ? 'bg-amber-50/50 border-amber-200 shadow-sm ring-1 ring-amber-100' : 'bg-black/[0.02] border-black/5'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <Label className={`text-[11px] font-bold ${isLunch ? 'text-amber-700' : 'text-black/60'}`}>
                      คาบที่ {period}
                    </Label>
                    <button
                      onClick={() => toggleLunch(period)}
                      className={`text-[9px] px-1.5 py-0.5 rounded-md font-bold transition-colors ${isLunch ? 'bg-amber-500 text-white' : 'bg-black/10 text-black/40 hover:bg-black/20'}`}
                    >
                      {isLunch ? 'พักกลางวัน' : 'ปกติ | พัก'}
                    </button>
                  </div>
                  <Input
                    value={localTimes[period] || ''}
                    onChange={e => updateTime(period, e.target.value)}
                    placeholder="08:30 - 09:20"
                    className="h-8 text-[11px] bg-white/60 border-black/10 focus-visible:ring-1 focus-visible:ring-slate-300 shadow-none rounded-lg"
                  />
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)} className="h-8 text-[11px] rounded-lg hover:bg-slate-100 font-medium">
            ยกเลิก
          </Button>
          <Button onClick={handleSave} className="bg-[#1e1e1e] hover:bg-[#2a2a2a] text-white text-[11px] h-8 rounded-lg px-5 shadow-sm font-medium">
            <Save size={14} className="mr-2" />
            บันทึกการตั้งค่า
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}