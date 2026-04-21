/**
 * Design Tokens — ใช้ทั่วระบบเพื่อให้ UI สอดคล้องกัน
 */

// ── Glass/Panel Styles ──────────────────────────────────
export const glassStyles = {
  card: {
    background: 'rgba(255,255,255,0.96)',
    backdropFilter: 'blur(24px)',
    border: '1px solid rgba(0,0,0,0.08)',
    boxShadow: '0 24px 64px rgba(0,0,0,0.14)',
  },
  panel: {
    background: 'rgba(255,255,255,0.72)',
    backdropFilter: 'blur(24px) saturate(150%)',
    border: '1px solid rgba(255,255,255,0.90)',
    boxShadow: '0 8px 32px rgba(0,0,0,0.06)',
  },
} as const;

// ── Typography Tokens ──────────────────────────────────
export const typography = {
  label: 'block text-[11px] font-semibold text-black/40 uppercase tracking-wider mb-1',
  sectionTitle: 'text-xs font-bold text-black/50 uppercase tracking-widest mb-4',
  modalTitle: 'text-sm font-bold text-black/80',
  modalSubtitle: 'text-[11px] text-black/40',
  fieldHint: 'text-xs text-black/50',
} as const;

// ── Border/Spacing ─────────────────────────────────────
export const spacing = {
  borderRadius: {
    xs: 'rounded-lg',
    sm: 'rounded-xl',
    md: 'rounded-2xl',
    lg: 'rounded-3xl',
  },
  padding: {
    compact: 'px-3 py-2',
    default: 'px-4 py-2.5',
    relaxed: 'px-6 py-3',
  },
} as const;

// ── Color Tokens (emerald + teal theme) ────────────────
export const colors = {
  primary: {
    light: '#10b981', // emerald-500
    default: '#0d9488', // teal-600
    dark: '#0f766e',   // teal-800
  },
  neutral: {
    text: 'text-black/80',
    textSubtle: 'text-black/50',
    textMuted: 'text-black/40',
    border: 'border-black/08',
    hover: 'hover:bg-black/05',
  },
} as const;

// ── Height/Size Standards ──────────────────────────────
export const sizes = {
  inputHeight: 'h-9',
  inputSmall: 'h-8',
  buttonHeight: 'h-9',
  iconSize: 'size-4',
} as const;
