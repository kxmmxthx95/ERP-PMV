/**
 * Design Tokens — ใช้ทั่วระบบเพื่อให้ UI สอดคล้องกัน
 */

// ── Glass/Panel Styles ──────────────────────────────────
export const glassStyles = {
  card: {
    background: '#ffffff',
    border: '1px solid rgba(0,0,0,0.08)',
    boxShadow: '0 8px 24px rgba(0,0,0,0.04)',
  },
  panel: {
    background: '#f8f8ff',
    border: '1px solid rgba(0,0,0,0.05)',
    boxShadow: '0 6px 18px rgba(0,0,0,0.04)',
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
  palette: {
    royalBlue: '#0056FF',
    azureBlue: '#2277FF',
    black: '#000000',
    softLavender: '#E3E7FC',
    white: '#FFFFFF',
    shell: '#f5f5f5',
  },
  gradient: {
    futurewave: 'linear-gradient(135deg, #0056FF 0%, #2277FF 100%)',
    midnightSurge: 'linear-gradient(135deg, #02163F 0%, #03122B 100%)',
  },
  neutral: {
    text: 'text-black/85',
    textSubtle: 'text-black/55',
    textMuted: 'text-black/45',
    border: 'border-black/10',
    hover: 'hover:bg-slate-100/60',
  },
} as const;

// ── Height/Size Standards ──────────────────────────────
export const sizes = {
  inputHeight: 'h-9',
  inputSmall: 'h-8',
  buttonHeight: 'h-9',
  iconSize: 'size-4',
} as const;
