import { useState } from 'react';
import { Zap } from 'lucide-react';
import { HiCog6Tooth } from 'react-icons/hi2';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogTrigger, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { HEADER_ICON_BTN } from '@/lib/headerIconBtn';
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
          className={HEADER_ICON_BTN}
          title="ตั้งค่าคาบเรียนและเวลา"
        >
          <HiCog6Tooth size={16} />
        </button>
      </DialogTrigger>
      <DialogContent
        className="w-[92vw] sm:max-w-lg rounded-2xl border-none p-0 shadow-2xl overflow-hidden"
        style={{
          background: 'rgba(255,255,255,0.7)',
          backdropFilter: 'blur(24px) saturate(180%)',
          WebkitBackdropFilter: 'blur(24px) saturate(180%)'
        }}
      >
        <div className="flex max-h-[90vh] flex-col">
          <div className="px-6 sm:px-8 pt-6 sm:pt-8 pb-2 sm:pb-3 flex flex-col bg-transparent">
            <DialogTitle className="text-lg sm:text-xl font-black text-slate-800 tracking-tight">
              ตั้งค่าคาบเรียนและเวลา
            </DialogTitle>
          </div>

          <div className="flex-1 space-y-6 overflow-y-auto px-6 sm:px-8 py-4 custom-scrollbar">
            {/* Automatic Generation Section */}
            <div className="space-y-4">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider pl-1">เริ่มเรียน <span className="text-rose-500">*</span></label>
                    <Input
                      type="time"
                      value={genStartTime}
                      onChange={e => setGenStartTime(e.target.value)}
                      className="h-10 rounded-xl bg-slate-50/70 border-none text-xs font-bold px-4 focus-visible:ring-2 focus-visible:ring-slate-900/20 focus-visible:bg-slate-50/90 transition-all"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider pl-1">นาทีต่อคาบ <span className="text-rose-500">*</span></label>
                    <Input
                      type="number"
                      value={genPeriodDur}
                      onChange={e => setGenPeriodDur(Number(e.target.value))}
                      className="h-10 rounded-xl bg-slate-50/70 border-none text-xs font-bold px-4 focus-visible:ring-2 focus-visible:ring-slate-900/20 focus-visible:bg-slate-50/90 transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider pl-1">พักเบรกระหว่างคาบ (นาที)</label>
                  <Input
                    type="number"
                    value={genBreakDur}
                    onChange={e => setGenBreakDur(Number(e.target.value))}
                    className="h-10 rounded-xl bg-slate-50/70 border-none text-xs font-bold px-4 focus-visible:ring-2 focus-visible:ring-slate-900/20 focus-visible:bg-slate-50/90 transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider pl-1">คาบที่พักเที่ยง</label>
                    <Input
                      type="number"
                      value={genLunchPeriod}
                      onChange={e => setGenLunchPeriod(Number(e.target.value))}
                      className="h-10 rounded-xl bg-slate-50/70 border-none text-xs font-bold px-4 focus-visible:ring-2 focus-visible:ring-slate-900/20 focus-visible:bg-slate-50/90 transition-all"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider pl-1">พักเที่ยง (นาที)</label>
                    <Input
                      type="number"
                      value={genLunchDur}
                      onChange={e => setGenLunchDur(Number(e.target.value))}
                      className="h-10 rounded-xl bg-slate-50/70 border-none text-xs font-bold px-4 focus-visible:ring-2 focus-visible:ring-slate-900/20 focus-visible:bg-slate-50/90 transition-all"
                    />
                  </div>
                </div>

                <Button
                  onClick={handleGenerate}
                  className="h-10 w-full rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-800 font-bold text-xs transition-all active:scale-[0.98] border border-slate-200/50 flex items-center justify-center gap-2 shadow-none"
                >
                  <Zap size={14} />
                  สร้างเวลาอัตโนมัติ
                </Button>
              </div>
            </div>

            {/* Manual Setting Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-lg font-black text-slate-800">{localCount} คาบ</p>
                  <p className="text-[11px] font-bold text-slate-400 mt-0.5">จำนวนคาบเรียนในหนึ่งวัน</p>
                </div>
                <div className="flex items-center gap-3 bg-slate-100/80 p-1 rounded-xl shadow-inner">
                  <button
                    type="button"
                    onClick={() => setLocalCount(Math.max(1, localCount - 1))}
                    className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-slate-800 text-base font-bold shadow-sm transition-all hover:bg-slate-50 active:scale-90"
                  >
                    -
                  </button>
                  <span className="w-6 text-center text-xs font-black text-slate-700">{localCount}</span>
                  <button
                    type="button"
                    onClick={() => setLocalCount(localCount + 1)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-slate-800 text-base font-bold shadow-sm transition-all hover:bg-slate-50 active:scale-90"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="px-6 sm:px-8 pt-4 pb-6 sm:pb-8 bg-transparent border-t border-white/20 flex items-center justify-end gap-3">
            <Button
              type="button"
              onClick={handleSave}
              className="w-full rounded-xl font-bold h-10"
            >
              บันทึกการตั้งค่า
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
