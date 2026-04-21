export const SLOT_COLORS = [
  { bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.30)', text: '#1d4ed8' },
  { bg: 'rgba(168,85,247,0.12)', border: 'rgba(168,85,247,0.30)', text: '#7c3aed' },
  { bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.30)', text: '#047857' },
  { bg: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.30)', text: '#c2410c' },
  { bg: 'rgba(236,72,153,0.12)', border: 'rgba(236,72,153,0.30)', text: '#be185d' },
  { bg: 'rgba(234,179,8,0.12)', border: 'rgba(234,179,8,0.30)', text: '#a16207' },
  { bg: 'rgba(20,184,166,0.12)', border: 'rgba(20,184,166,0.30)', text: '#0f766e' },
];

export function subjectColor(subjectId: string) {
  let hash = 0;
  for (const ch of subjectId) hash = (hash * 31 + ch.charCodeAt(0)) & 0xffff;
  return SLOT_COLORS[hash % SLOT_COLORS.length];
}
