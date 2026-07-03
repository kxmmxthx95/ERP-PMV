/** Light theme tokens aligned with portal design system */
export const aiAgentTheme = {
  shell: 'rounded-3xl border border-black/10 bg-white shadow-[0_8px_24px_rgba(0,0,0,0.04)]',
  panel: 'rounded-3xl border border-black/10 bg-[#f8f8ff] shadow-[0_6px_18px_rgba(0,0,0,0.04)]',
  panelInset: 'rounded-2xl border border-black/[0.06] bg-white',
  label: 'text-[9px] font-black tracking-[0.2em] text-black/40 uppercase',
  title: 'text-sm font-black text-slate-800',
  subtitle: 'text-[10px] font-bold text-slate-500',
  body: 'text-[11px] text-slate-600',
  accent: 'text-[#0056FF]',
  accentBg: 'bg-[#0056FF] text-white',
  success: 'text-emerald-600',
  menuActive: 'bg-[#0056FF] border-[#0056FF] text-white shadow-[0_4px_16px_rgba(0,86,255,0.25)]',
  menuIdle:
    'bg-white border-black/10 text-slate-700 hover:bg-slate-50 hover:border-black/15 shadow-sm',
  progressTrack: 'h-2 rounded-full bg-slate-100 overflow-hidden border border-black/[0.06]',
  tabActive: 'bg-[#0056FF] text-white',
  tabIdle: 'text-slate-500 hover:bg-slate-100',
} as const;

export const aiOfficeFloorBg = `
  linear-gradient(135deg, #f8f8ff 0%, #eef2ff 45%, #f5f7ff 100%),
  repeating-linear-gradient(
    90deg,
    transparent,
    transparent 48px,
    rgba(0, 86, 255, 0.04) 48px,
    rgba(0, 86, 255, 0.04) 49px
  ),
  repeating-linear-gradient(
    0deg,
    transparent,
    transparent 48px,
    rgba(0, 86, 255, 0.04) 48px,
    rgba(0, 86, 255, 0.04) 49px
  )
`;
