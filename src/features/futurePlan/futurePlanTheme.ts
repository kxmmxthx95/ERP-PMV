/** Future Plan brand palette */
export const fpColors = {
  royalBlue: '#0056FF',
  azureBlue: '#2277FF',
  black: '#000000',
  softLavender: '#E3E7FC',
  white: '#FFFFFF',
} as const;

export const fpGradients = {
  futurewave: 'linear-gradient(90deg, #8EC5FF 0%, #2277FF 100%)',
  midnightSurge: 'linear-gradient(90deg, #0B1B3D 0%, #0056FF 100%)',
} as const;

/** Soft status chips — pastel bg + saturated text/icon (reference UI) */
export const fpStatus = {
  pending: {
    bg: 'bg-orange-50',
    text: 'text-orange-700',
    icon: 'text-orange-600',
    border: 'border-orange-200/80',
    ring: 'ring-orange-200/60',
  },
  inProgress: {
    bg: 'bg-sky-50',
    text: 'text-sky-700',
    icon: 'text-sky-600',
    border: 'border-sky-200/80',
    ring: 'ring-sky-200/60',
  },
  submitted: {
    bg: 'bg-violet-50',
    text: 'text-violet-700',
    icon: 'text-violet-600',
    border: 'border-violet-200/80',
    ring: 'ring-violet-200/60',
  },
  inReview: {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    icon: 'text-amber-600',
    border: 'border-amber-200/80',
    ring: 'ring-amber-200/60',
  },
  success: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    icon: 'text-emerald-600',
    border: 'border-emerald-200/80',
    ring: 'ring-emerald-200/60',
  },
  failed: {
    bg: 'bg-rose-50',
    text: 'text-rose-700',
    icon: 'text-rose-600',
    border: 'border-rose-200/80',
    ring: 'ring-rose-200/60',
  },
  expired: {
    bg: 'bg-slate-100',
    text: 'text-slate-600',
    icon: 'text-slate-500',
    border: 'border-slate-200/80',
    ring: 'ring-slate-200/60',
  },
} as const;

export type FpStatusVariant = keyof typeof fpStatus;

export const fpRankStatus: Record<1 | 2 | 3, FpStatusVariant> = {
  1: 'inReview',
  2: 'inProgress',
  3: 'submitted',
};

export const fpSectionAccent = {
  goals: 'inProgress' as FpStatusVariant,
  plan: 'submitted' as FpStatusVariant,
  universities: 'inReview' as FpStatusVariant,
};

/** Shared Tailwind class fragments for Future Plan UI */
export const fp = {
  section: 'rounded-3xl bg-[#E3E7FC]/90',
  sectionSm: 'rounded-2xl bg-[#E3E7FC]/90',
  input:
    'w-full rounded-2xl border border-[#E3E7FC] bg-white/90 text-sm text-[#000000] placeholder:text-black/35 outline-none focus:border-[#2277FF] transition-colors',
  inputSm:
    'w-full rounded-xl border border-[#E3E7FC] bg-white/90 text-sm text-[#000000] placeholder:text-black/35 outline-none focus:border-[#2277FF] transition-colors',
  label: 'text-[11px] font-bold text-[#000000] uppercase tracking-wider',
  labelDark: 'text-[12px] font-black text-[#000000]',
  heading: 'text-sm font-black text-[#000000]',
  headingAccent: 'text-sm font-black text-[#0056FF]',
  btnCircle:
    'flex items-center justify-center rounded-full bg-[#0056FF] text-white hover:bg-[#004AD4] active:scale-95 transition-all disabled:opacity-50 shadow-md shadow-[#0056FF]/30',
  btnPrimary:
    'rounded-xl bg-[#0056FF] text-white font-bold hover:bg-[#004AD4] active:scale-[0.99] transition-all disabled:opacity-40',
  btnPicker:
    'border-2 border-dashed border-[#E3E7FC] bg-white/80 hover:border-[#2277FF] hover:bg-[#E3E7FC]/50',
  cardPick:
    'border-2 border-[#E3E7FC] bg-white/90 hover:border-[#2277FF] hover:bg-[#E3E7FC]/40',
  cardPickActive: 'border-[#0056FF] bg-[#E3E7FC] text-[#0056FF] shadow-sm',
  cardPickIdle: 'border-[#E3E7FC] bg-white/60 text-[#000000]/60 hover:border-[#2277FF]/50',
  success: 'text-[#0056FF]',
  rankBadge: 'text-[11px] font-black uppercase tracking-wide text-[#0056FF]',
  divider: 'divide-[#E3E7FC] border-[#E3E7FC]',
  logoFallback: 'bg-[#E3E7FC] border border-[#2277FF]/20',
  logoFallbackIcon: 'text-[#0056FF]',
  warning: 'text-[#0056FF] font-semibold',
} as const;
