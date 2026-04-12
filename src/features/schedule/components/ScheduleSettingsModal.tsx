import { useState, useEffect } from 'react';
import { Clock, Save, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { useScheduleSettings } from '@/hooks/useScheduleSettings';

export default function ScheduleSettingsModal() {
  const { periodCount, lunchPeriod, periodTimes, updateSettings } = useScheduleSettings();
  
  const [open, setOpen] = useState(false);
  const [localCount, setLocalCount] = useState(periodCount);
  const [localLunch, setLocalLunch] = useState(String(lunchPeriod));
  const [localTimes, setLocalTimes] = useState(periodTimes);

  // ดึงค่าล่าสุดมาแสดงเมื่อเปิด Modal
  useEffect(() => {
    if (open) {
      setLocalCount(periodCount);
      setLocalLunch(String(lunchPeriod));
      setLocalTimes(periodTimes);
    }
  }, [open, periodCount, lunchPeriod, periodTimes]);

  const handleSave = () => {
    let finalLunch = Number(localLunch);
    if (finalLunch > localCount) finalLunch = 0;

    updateSettings({
      periodCount: localCount,
      lunchPeriod: finalLunch,
      periodTimes: localTimes
    });
    toast.success('บันทึกการตั้งค่าคาบเรียนเรียบร้อยแล้ว');
    setOpen(false);
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
            <p className="text-xs text-black/40 mt-0.5">กำหนดจำนวนคาบเรียนต่อวันและเวลาในแต่ละคาบ</p>
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
          <div className="space-y-2">
            <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">คาบพักกลางวัน (Lunch Break)</Label>
            <Select value={localLunch} onValueChange={setLocalLunch}>
              <SelectTrigger className="w-full sm:w-56 text-xs bg-black/5 border-transparent shadow-none h-8 rounded-lg focus:ring-1 focus:ring-slate-300">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl bg-white/95 backdrop-blur-md border-white/50 shadow-lg">
                <SelectItem value="0" className="text-xs rounded-lg cursor-pointer">ไม่มีพักกลางวัน</SelectItem>
                {Array.from({ length: localCount }, (_, i) => i + 1).map(p => (
                  <SelectItem key={p} value={String(p)} className="text-xs rounded-lg cursor-pointer">คาบที่ {p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-3">
          <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-2 block border-b border-black/5 pb-2">กำหนดเวลาแต่ละคาบ</Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-[30vh] overflow-y-auto pr-2">
            {Array.from({ length: localCount }, (_, i) => i + 1).map(period => (
              <div key={period} className={`p-3 rounded-xl border ${Number(localLunch) === period ? 'bg-amber-50/50 border-amber-200' : 'bg-black/[0.02] border-black/5'}`}>
                <Label className={`text-[11px] font-bold mb-1.5 block ${Number(localLunch) === period ? 'text-amber-700' : 'text-black/60'}`}>
                  คาบที่ {period} {Number(localLunch) === period && '(พัก)'}
                </Label>
                <Input
                  value={localTimes[period] || ''}
                  onChange={e => updateTime(period, e.target.value)}
                  placeholder="08:30 - 09:20"
                  className="h-8 text-[11px] bg-white/60 border-black/10 focus-visible:ring-1 focus-visible:ring-slate-300 shadow-none rounded-lg"
                />
              </div>
            ))}
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