import { useState } from 'react';
import { Settings, Zap, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { useScheduleSettings } from '@/hooks/useScheduleSettings';

interface ScheduleSettingsModalProps {
  targetId?: string;
}

export default function ScheduleSettingsModal({ targetId }: ScheduleSettingsModalProps) {
  const { periodCount, lunchPeriods, periodTimes, updateSettings } = useScheduleSettings(targetId);

  const [open, setOpen] = useState(false);
  const [localCount, setLocalCount] = useState(periodCount);
  const [localLunches, setLocalLunches] = useState<number[]>(lunchPeriods);
  const [localTimes, setLocalTimes] = useState(periodTimes);

  // Generator States
  const [genStartTime, setGenStartTime] = useState("08:30");
  const [genPeriodDur, setGenPeriodDur] = useState(50);
  const [genBreakDur, setGenBreakDur] = useState(0);
  const [genLunchDur, setGenLunchDur] = useState(50);
  const [genLunchPeriod, setGenLunchPeriod] = useState(6);

  const syncFromSource = () => {
    setLocalCount(periodCount);
    setLocalLunches(lunchPeriods);
    setLocalTimes(periodTimes);
  };

  const handleSave = async () => {
    await updateSettings({
      periodCount: localCount,
      lunchPeriods: localLunches.filter(p => p <= localCount),
      periodTimes: localTimes
    });
    toast.success('บันทึกการตั้งค่าคาบเรียนเรียบร้อยแล้ว');
    setOpen(false);
  };

  const handleGenerate = () => {
    // Helper: "08:30" -> 510 mins
    const parse = (s: string) => {
      const [h, m] = s.split(':').map(Number);
      return (h || 0) * 60 + (m || 0);
    };
    // Helper: 510 -> "08:30"
    const format = (m: number) => {
      const hh = Math.floor(m / 60) % 24;
      const mm = m % 60;
      return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    };

    let current = parse(genStartTime);
    const nextTimes: Record<number, string> = {};
    const nextLunches: number[] = [];

    for (let p = 1; p <= localCount; p++) {
      const isLunch = p === genLunchPeriod;
      const dur = isLunch ? genLunchDur : genPeriodDur;
      
      const startStr = format(current);
      current += dur;
      const endStr = format(current);
      
      nextTimes[p] = `${startStr} - ${endStr}`;
      if (isLunch) nextLunches.push(p);

      // Add break if not lunch and not last
      if (!isLunch && p < localCount && (p + 1) !== genLunchPeriod) {
        current += genBreakDur;
      }
    }

    setLocalTimes(nextTimes);
    setLocalLunches(nextLunches);
    toast.success('สร้างโครงสร้างเวลาเรียบร้อยแล้ว');
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) syncFromSource();
        setOpen(nextOpen);
      }}
    >
      <DialogTrigger asChild>
        <button
          type="button"
          className="w-full sm:w-auto h-auto py-1 px-2.5 rounded-md flex items-center justify-center gap-1.5 text-[11px] font-semibold transition-colors hover:bg-black/5 border-none shadow-none text-black/70 flex-shrink-0"
        >
          <Settings size={13} />
          ตั้งค่า
        </button>
      </DialogTrigger>
      <DialogContent className="w-[min(94vw,560px)] max-w-none max-h-[90vh] overflow-hidden bg-white rounded-[40px] shadow-2xl border-none p-0">
        <div className="flex max-h-[90vh] flex-col">
          <div className="relative px-8 pt-8 pb-4">
            <button
              onClick={() => setOpen(false)}
              className="absolute right-6 top-6 flex h-8 w-8 items-center justify-center rounded-full bg-black/5 text-black/40 transition-colors hover:bg-black/10"
            >
              <X size={16} />
            </button>
            <h2 className="text-2xl font-black text-black/80">ตั้งค่าคาบเรียนและเวลา</h2>
            <p className="mt-1 text-[13px] font-medium text-black/30">
              จัดการจำนวนคาบและเวลาในแต่ละช่วง ({targetId || 'ค่าเริ่มต้น'})
            </p>
          </div>

          <div className="flex-1 space-y-8 overflow-y-auto px-8 py-4 custom-scrollbar">
            {/* Automatic Generation Section */}
            <div className="space-y-6">
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                <h4 className="text-[12px] font-black uppercase tracking-widest text-black/20">
                  สร้างโครงสร้างเวลาอัตโนมัติ
                </h4>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="pl-1 text-[12px] font-bold text-black/60">เริ่มเรียน <span className="text-rose-500">*</span></Label>
                    <Input
                      type="time"
                      value={genStartTime}
                      onChange={e => setGenStartTime(e.target.value)}
                      className="h-12 rounded-2xl border-none bg-black/[0.03] px-4 text-[14px] font-medium focus-visible:ring-0 focus-visible:bg-black/[0.05] transition-all"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="pl-1 text-[12px] font-bold text-black/60">นาทีต่อคาบ <span className="text-rose-500">*</span></Label>
                    <Input
                      type="number"
                      value={genPeriodDur}
                      onChange={e => setGenPeriodDur(Number(e.target.value))}
                      className="h-12 rounded-2xl border-none bg-black/[0.03] px-4 text-[14px] font-medium focus-visible:ring-0 focus-visible:bg-black/[0.05] transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="pl-1 text-[12px] font-bold text-black/60">พักเบรกระหว่างคาบ (นาที)</Label>
                  <Input
                    type="number"
                    value={genBreakDur}
                    onChange={e => setGenBreakDur(Number(e.target.value))}
                    className="h-12 rounded-2xl border-none bg-black/[0.03] px-4 text-[14px] font-medium focus-visible:ring-0 focus-visible:bg-black/[0.05] transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="pl-1 text-[12px] font-bold text-black/60">คาบที่พักเที่ยง</Label>
                    <Input
                      type="number"
                      value={genLunchPeriod}
                      onChange={e => setGenLunchPeriod(Number(e.target.value))}
                      className="h-12 rounded-2xl border-none bg-black/[0.03] px-4 text-[14px] font-medium focus-visible:ring-0 focus-visible:bg-black/[0.05] transition-all"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="pl-1 text-[12px] font-bold text-black/60">พักเที่ยง (นาที)</Label>
                    <Input
                      type="number"
                      value={genLunchDur}
                      onChange={e => setGenLunchDur(Number(e.target.value))}
                      className="h-12 rounded-2xl border-none bg-black/[0.03] px-4 text-[14px] font-medium focus-visible:ring-0 focus-visible:bg-black/[0.05] transition-all"
                    />
                  </div>
                </div>

                <Button
                  onClick={handleGenerate}
                  className="h-12 w-full rounded-2xl bg-blue-50 text-blue-600 shadow-none hover:bg-blue-100 font-black text-[13px] transition-all active:scale-[0.98]"
                >
                  <Zap size={16} className="mr-2" />
                  สร้างเวลาอัตโนมัติ
                </Button>
              </div>
            </div>

            {/* Manual Setting Section */}
            <div className="space-y-6 pb-8">
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                <h4 className="text-[12px] font-black uppercase tracking-widest text-black/20">
                  จำนวนคาบต่อวัน
                </h4>
              </div>

              <div className="flex items-center justify-between rounded-[32px] bg-black/[0.03] p-6">
                <div>
                  <p className="text-xl font-black text-black/80">{localCount} คาบ</p>
                  <p className="text-[12px] font-medium text-black/30">จำนวนคาบเรียนในหนึ่งวัน</p>
                </div>
                <div className="flex items-center gap-3 bg-white/50 p-1.5 rounded-[20px] shadow-sm">
                  <button
                    onClick={() => setLocalCount(Math.max(1, localCount - 1))}
                    className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-white text-lg font-bold shadow-sm transition-all hover:bg-slate-50 active:scale-90"
                  >
                    -
                  </button>
                  <span className="w-8 text-center text-sm font-black text-black/60">{localCount}</span>
                  <button
                    onClick={() => setLocalCount(localCount + 1)}
                    className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-white text-lg font-bold shadow-sm transition-all hover:bg-slate-50 active:scale-90"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="px-8 py-6">
            <Button
              onClick={handleSave}
              className="h-14 w-full rounded-[24px] bg-[#007AFF] text-white text-[15px] font-black shadow-xl shadow-blue-500/20 hover:bg-[#0063CC] hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              บันทึกการตั้งค่า
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
