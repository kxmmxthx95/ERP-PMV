import { useCallback, useEffect, useState, type MouseEvent } from 'react';
import { motion } from 'framer-motion';
import {
  HiXMark,
} from 'react-icons/hi2';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { WIDGET_CARD } from '../widgetStyles';
import {
  getDailyHoroscope,
  getStoredHoroscopeSign,
  setStoredHoroscopeSign,
  ZODIAC_SIGNS,
  type HoroscopeReading,
  type ZodiacSignId,
} from '../services/horoscopeApi';
import { formatThaiDateLabel } from '@/lib/dateUtils';
import { cn } from '@/lib/utils';
import { ZodiacIcon } from '../components/ZodiacIcon';

function HoroscopeScene({ idPrefix = 'horo' }: { idPrefix?: string }) {
  const cx = 232;
  const cy = 71;

  const starDots: [number, number, number][] = [
    [18, 22, 1.2], [42, 12, 0.9], [68, 38, 1.4], [95, 18, 1], [124, 42, 0.8],
    [28, 58, 1.1], [54, 72, 0.7], [88, 96, 1.3], [142, 14, 1.2], [168, 52, 0.9],
    [286, 24, 1.1], [302, 48, 0.8], [12, 108, 1], [148, 118, 0.9], [260, 108, 1.2],
    [298, 88, 0.7], [190, 8, 1], [210, 124, 0.8],
  ];

  const radialCount = 18;
  const radials = Array.from({ length: radialCount }, (_, i) => {
    const angle = (i * 360) / radialCount;
    const rad = (angle * Math.PI) / 180;
    const x2 = cx + Math.cos(rad) * 92;
    const y2 = cy + Math.sin(rad) * 58;
    return { x2, y2 };
  });

  const ringRx = [22, 36, 50, 64, 78, 92];
  const ringRy = [16, 26, 36, 46, 54, 64];

  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      viewBox="0 0 320 142"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
    >
      <defs>
        <linearGradient id={`${idPrefix}-bg`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1e1033" />
          <stop offset="45%" stopColor="#2e1065" />
          <stop offset="100%" stopColor="#4c1d95" />
        </linearGradient>
        <radialGradient id={`${idPrefix}-nebula`} cx="72%" cy="42%" r="55%">
          <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.45" />
          <stop offset="55%" stopColor="#5b21b6" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#1e1033" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${idPrefix}-sun`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fde68a" />
          <stop offset="55%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${idPrefix}-vignette`} x1="0%" y1="0%" x2="65%" y2="0%">
          <stop offset="0%" stopColor="#1e1033" stopOpacity="0.75" />
          <stop offset="100%" stopColor="#1e1033" stopOpacity="0" />
        </linearGradient>
      </defs>

      <rect width="320" height="142" fill={`url(#${idPrefix}-bg)`} />
      <rect width="320" height="142" fill={`url(#${idPrefix}-nebula)`} />

      {/* concentric ellipses — horizontal chart */}
      {ringRx.map((rx, i) => (
        <ellipse
          key={`ring-${i}`}
          cx={cx}
          cy={cy}
          rx={rx}
          ry={ringRy[i]}
          fill="none"
          stroke="#fcd34d"
          strokeOpacity={0.22 + i * 0.04}
          strokeWidth={i === 0 ? 1.2 : 0.75}
        />
      ))}

      {/* radial spokes */}
      {radials.map((line, i) => (
        <line
          key={`rad-${i}`}
          x1={cx}
          y1={cy}
          x2={line.x2}
          y2={line.y2}
          stroke="#e9d5ff"
          strokeOpacity={0.18}
          strokeWidth="0.6"
        />
      ))}

      {/* inner grid */}
      {[-24, -12, 0, 12, 24].map((offset) => (
        <g key={`grid-${offset}`} opacity="0.22">
          <line
            x1={cx - 38}
            y1={cy + offset}
            x2={cx + 38}
            y2={cy + offset}
            stroke="#fcd34d"
            strokeWidth="0.5"
          />
          <line
            x1={cx + offset * 0.55}
            y1={cy - 28}
            x2={cx + offset * 0.55}
            y2={cy + 28}
            stroke="#fcd34d"
            strokeWidth="0.5"
          />
        </g>
      ))}

      {/* constellation lines */}
      <g stroke="#c4b5fd" strokeOpacity="0.35" strokeWidth="0.7" fill="none">
        <path d="M24 28 L38 42 L52 34 L68 48" />
        <path d="M252 18 L268 32 L284 22" />
        <path d="M48 104 L62 92 L78 100" />
      </g>

      {/* planets */}
      <circle cx="48" cy="52" r="4.5" fill="#fbbf24" opacity="0.85" />
      <circle cx="278" cy="38" r="3.5" fill="#fb923c" opacity="0.8" />
      <circle cx="292" cy="96" r="5" fill="#60a5fa" opacity="0.75" />
      <circle cx="118" cy="108" r="2.8" fill="#f472b6" opacity="0.7" />
      <ellipse cx="292" cy="96" rx="8" ry="2" fill="none" stroke="#93c5fd" strokeOpacity="0.5" strokeWidth="0.6" />

      {/* central sun */}
      <circle cx={cx} cy={cy} r="14" fill={`url(#${idPrefix}-sun)`} opacity="0.95" />
      {Array.from({ length: 12 }, (_, i) => {
        const angle = (i * 30 * Math.PI) / 180;
        const x1 = cx + Math.cos(angle) * 16;
        const y1 = cy + Math.sin(angle) * 12;
        const x2 = cx + Math.cos(angle) * 24;
        const y2 = cy + Math.sin(angle) * 18;
        return (
          <line
            key={`ray-${i}`}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="#fde68a"
            strokeOpacity="0.75"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
        );
      })}

      {/* stars */}
      {starDots.map(([x, y, r], i) => (
        <circle key={`star-${i}`} cx={x} cy={y} r={r} fill="#faf5ff" opacity={0.45 + (i % 4) * 0.12} />
      ))}

      {/* bright stars with rays */}
      {[
        [24, 28], [142, 14], [286, 24],
      ].map(([x, y], i) => (
        <g key={`bright-${i}`} stroke="#fef3c7" strokeOpacity="0.6" strokeWidth="0.6">
          <line x1={x - 4} y1={y} x2={x + 4} y2={y} />
          <line x1={x} y1={y - 4} x2={x} y2={y + 4} />
          <circle cx={x} cy={y} r="1.6" fill="#fef9c3" />
        </g>
      ))}

      {/* left vignette for text legibility */}
      <rect width="320" height="142" fill={`url(#${idPrefix}-vignette)`} opacity="0.55" />
    </svg>
  );
}

function HoroIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn('w-5 h-5', className)}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="6.5" y="3" width="11" height="18" rx="2.25" />
      <path d="M12 8.5 13.1 11.4 16.2 11.4 13.55 13.3 14.65 16.2 12 14.3 9.35 16.2 10.45 13.3 7.8 11.4 10.9 11.4Z" fill="currentColor" stroke="none" />
    </svg>
  );
}

export default function HoroscopeWidget() {
  const [sign, setSign] = useState<ZodiacSignId>(() => getStoredHoroscopeSign());
  const [reading, setReading] = useState<HoroscopeReading | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const signMeta = ZODIAC_SIGNS.find((s) => s.id === sign) ?? ZODIAC_SIGNS[0];

  const loadHoroscope = useCallback(async (targetSign: ZodiacSignId) => {
    setLoading(true);
    setError(null);
    try {
      const data = await getDailyHoroscope(targetSign, 'today');
      setReading(data);
    } catch (err) {
      setReading(null);
      setError(err instanceof Error ? err.message : 'โหลดดวงไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!sheetOpen) return;
    void loadHoroscope(sign);
  }, [sheetOpen, sign, loadHoroscope]);

  const openSheet = (e?: MouseEvent) => {
    e?.stopPropagation();
    setSheetOpen(true);
  };

  const handleSelectSign = (next: ZodiacSignId) => {
    setSign(next);
    setStoredHoroscopeSign(next);
  };

  return (
    <>
      <div className="w-full h-[142px] max-h-[142px] shrink-0 self-start">
        <div
          className={cn(
            WIDGET_CARD,
            'relative overflow-hidden border border-violet-500/30 !h-full min-h-0 p-0 shadow-md group',
          )}
        >
          <HoroscopeScene idPrefix="horo-card" />

          <div className="relative z-10 flex flex-col h-full min-h-0 p-3 gap-2">
            <div className="min-w-0 shrink-0 text-white drop-shadow-sm">
              <p className="text-sm font-bold leading-tight truncate">ดวงรายวัน</p>
            </div>

            <div className="flex-1 min-h-0 flex items-end justify-between gap-2">
              <p className="text-[10px] font-semibold text-white/80 leading-tight line-clamp-3 min-w-0">
                {reading?.moodTh ? `วันนี้อารมณ์${reading.moodTh}` : signMeta.dateRangeTh}
              </p>

              <motion.button
                type="button"
                aria-label="ดูดวง"
                whileTap={{ scale: 0.92 }}
                onClick={openSheet}
                className="w-9 h-9 rounded-full bg-white text-violet-700 shadow-md shadow-violet-900/25 flex items-center justify-center hover:scale-105 transition-transform shrink-0"
              >
                <HoroIcon className="w-4 h-4" />
              </motion.button>
            </div>
          </div>
        </div>
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent
          side="right"
          showCloseButton={false}
          className={cn(
            '!inset-0 !left-0 !right-0 !top-0 !bottom-0',
            '!h-dvh !w-screen !max-w-none sm:!max-w-none',
            '!rounded-none border-0 p-0 overflow-hidden',
            'bg-gradient-to-br from-violet-50 via-purple-50/60 to-fuchsia-50/40',
          )}
        >
          <div className="relative h-full min-h-dvh flex flex-col overflow-hidden">
            <SheetHeader className="relative z-10 px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-3 text-left space-y-1 border-b border-violet-100/80 bg-white/70 backdrop-blur-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <SheetTitle className="text-xl font-black text-violet-900">
                    ดวงรายวัน
                  </SheetTitle>
                  <SheetDescription className="text-xs text-slate-500 font-medium">
                    {formatThaiDateLabel()} · เลือกราศีของคุณ
                  </SheetDescription>
                </div>
                <button
                  type="button"
                  aria-label="ปิด"
                  onClick={() => setSheetOpen(false)}
                  className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 text-slate-600 flex items-center justify-center hover:bg-slate-200 transition-colors shrink-0"
                >
                  <HiXMark className="w-5 h-5" />
                </button>
              </div>
            </SheetHeader>

            <div className="relative z-10 flex-1 overflow-y-auto px-4 pt-4 pb-[max(2rem,env(safe-area-inset-bottom))] space-y-4">
              <div className="grid grid-cols-4 gap-2">
                {ZODIAC_SIGNS.map((item) => {
                  const active = item.id === sign;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelectSign(item.id)}
                      className={cn(
                        'rounded-2xl border px-2 py-2.5 text-center transition-all active:scale-[0.98]',
                        active
                          ? 'border-violet-300 bg-white shadow-md ring-2 ring-violet-300/60'
                          : 'border-violet-100 bg-white hover:border-violet-200 hover:shadow-sm',
                      )}
                    >
                      <ZodiacIcon
                        sign={item.id}
                        className={cn(
                          'w-7 h-7 mx-auto',
                          active ? 'text-violet-600' : 'text-slate-500',
                        )}
                      />
                      <span
                        className={cn(
                          'text-[10px] font-bold mt-1 block leading-tight',
                          active ? 'text-violet-700' : 'text-slate-600',
                        )}
                      >
                        {item.nameTh.replace('ราศี', '')}
                      </span>
                    </button>
                  );
                })}
              </div>

              {loading && (
                <div className="rounded-3xl border border-white/80 bg-white/90 p-5 space-y-3 animate-pulse shadow-sm">
                  <div className="h-4 bg-slate-100 rounded-full w-1/2" />
                  <div className="h-3 bg-slate-100 rounded-full w-full" />
                  <div className="h-3 bg-slate-100 rounded-full w-5/6" />
                  <div className="h-3 bg-slate-100 rounded-full w-4/6" />
                </div>
              )}

              {!loading && error && (
                <div className="rounded-3xl border border-rose-100 bg-white/95 p-5 shadow-sm">
                  <p className="text-sm font-bold text-rose-600">{error}</p>
                  <button
                    type="button"
                    onClick={() => void loadHoroscope(sign)}
                    className="mt-3 text-xs font-black text-violet-600 hover:text-violet-700"
                  >
                    ลองใหม่อีกครั้ง
                  </button>
                </div>
              )}

              {!loading && reading && (
                <div className="rounded-3xl border border-violet-100/80 bg-white/95 backdrop-blur p-5 space-y-4 shadow-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-violet-100 border border-violet-200 flex items-center justify-center shrink-0">
                      <ZodiacIcon sign={reading.signId} className="w-8 h-8 text-violet-700" />
                    </div>
                    <div>
                      <p className="text-lg font-black text-slate-800">{reading.signNameTh}</p>
                      <p className="text-xs text-slate-500">{reading.dateRangeTh}</p>
                    </div>
                  </div>

                  <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                    {reading.descriptionTh}
                  </p>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-2xl bg-violet-50 border border-violet-100 px-3 py-2.5">
                      <p className="text-[10px] text-violet-500 font-bold">เข้ากัน</p>
                      <p className="text-sm font-black text-slate-800">{reading.compatibilityTh}</p>
                    </div>
                    <div className="rounded-2xl bg-purple-50 border border-purple-100 px-3 py-2.5">
                      <p className="text-[10px] text-purple-500 font-bold">เวลามงคล</p>
                      <p className="text-sm font-black text-slate-800">{reading.luckyTimeTh}</p>
                    </div>
                    <div className="rounded-2xl bg-fuchsia-50 border border-fuchsia-100 px-3 py-2.5">
                      <p className="text-[10px] text-fuchsia-500 font-bold">อารมณ์</p>
                      <p className="text-sm font-black text-slate-800">{reading.moodTh}</p>
                    </div>
                    <div className="rounded-2xl bg-violet-100/80 border border-violet-200 px-3 py-2.5">
                      <p className="text-[10px] text-violet-600 font-bold">สี · เลขมงคล</p>
                      <p className="text-sm font-black text-slate-800">
                        {reading.colorTh} · {reading.lucky_number}
                      </p>
                    </div>
                  </div>

                  <p className="text-[10px] text-slate-400 text-center">
                    แปลเป็นภาษาไทยอัตโนมัติ · ไม่บันทึกในฐานข้อมูล
                  </p>
                </div>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
