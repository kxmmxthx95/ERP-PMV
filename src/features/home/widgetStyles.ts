import type React from 'react';

export const WIDGET_GLASS: React.CSSProperties = {
  background:
    'linear-gradient(to right, rgba(248,250,252,0.92) 0%, rgba(255,255,255,0.96) 100%)',
  backdropFilter: 'blur(24px) saturate(160%)',
  WebkitBackdropFilter: 'blur(24px) saturate(160%)',
  border: '1px solid rgba(255,255,255,0.88)',
  boxShadow: '0 2px 10px rgba(15, 23, 42, 0.06)',
};

/** Fixed height aligned to the Leave widget (header + 3 stats + footer button) */
export const WIDGET_CARD =
  'rounded-2xl p-3 flex flex-col gap-2 w-full h-[142px] overflow-hidden';

export const WIDGET_STAT_CELL = 'flex flex-col items-center justify-center py-1 rounded-lg bg-white/40 min-w-0';

export const WIDGET_STAT_VALUE = 'text-base font-black tabular-nums leading-none';

export const WIDGET_STAT_LABEL = 'text-[10px] text-slate-400 text-center leading-tight mt-0.5';

export type DayCandyStyle = { background: string; border: string; glow: string };

/** Vibrant candy gradients by JS day (0=Sun … 6=Sat) — dark → light, left → right */
export const DAY_CANDY_COLOR_MAP: Record<number, DayCandyStyle> = {
  0: {
    background: 'linear-gradient(to right, #FF3D7A 0%, #FF9BB5 100%)',
    border: '1.5px solid rgba(255,255,255,0.55)',
    glow: 'rgba(255, 61, 122, 0.38)',
  },
  1: {
    background: 'linear-gradient(to right, #F5A000 0%, #FFE08A 100%)',
    border: '1.5px solid rgba(255,255,255,0.55)',
    glow: 'rgba(245, 158, 0, 0.38)',
  },
  2: {
    background: 'linear-gradient(to right, #FF3D9E 0%, #FFB0DC 100%)',
    border: '1.5px solid rgba(255,255,255,0.55)',
    glow: 'rgba(255, 61, 158, 0.35)',
  },
  3: {
    background: 'linear-gradient(to right, #14C37A 0%, #6FE8B8 100%)',
    border: '1.5px solid rgba(255,255,255,0.55)',
    glow: 'rgba(20, 195, 122, 0.35)',
  },
  4: {
    background: 'linear-gradient(to right, #FF7A18 0%, #FFC56E 100%)',
    border: '1.5px solid rgba(255,255,255,0.55)',
    glow: 'rgba(255, 122, 24, 0.4)',
  },
  5: {
    background: 'linear-gradient(to right, #2B7FFF 0%, #9DCEFF 100%)',
    border: '1.5px solid rgba(255,255,255,0.55)',
    glow: 'rgba(43, 127, 255, 0.38)',
  },
  6: {
    background: 'linear-gradient(to right, #8B4DFF 0%, #D4B8FF 100%)',
    border: '1.5px solid rgba(255,255,255,0.55)',
    glow: 'rgba(139, 77, 255, 0.38)',
  },
};

export const DAY_CANDY_SURFACE_CLASS =
  'relative overflow-hidden before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-[45%] before:bg-gradient-to-b before:from-white/30 before:to-transparent';

export function getDayCandyStyle(day: number): DayCandyStyle {
  return DAY_CANDY_COLOR_MAP[day] ?? DAY_CANDY_COLOR_MAP[5];
}

export function getDayCandyBoxShadow(glow: string): string {
  return `0 10px 28px -8px ${glow}, 0 4px 12px -4px rgba(15, 23, 42, 0.12)`;
}
