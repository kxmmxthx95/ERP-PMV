export type SpecialCharCategory = {
  id: string;
  label: string;
  chars: string[];
};

export const SPECIAL_CHAR_CATEGORIES: SpecialCharCategory[] = [
  {
    id: 'currency',
    label: 'สกุลเงิน',
    chars: ['$', '¢', '€', '£', '¥', '₩', '₹', '฿', '₭', '₫', '₽', '₪', '₺', '₦', '₱', '₡', '₵', '₴', '₸', '₼'],
  },
  {
    id: 'math',
    label: 'คณิตศาสตร์',
    chars: ['+', '−', '±', '×', '÷', '=', '≠', '≈', '≡', '<', '>', '≤', '≥', '·', '°', '′', '″', '√', '∞', 'π', '∑', '∫', '∂', '∆', '∠', '⊥', '∥', '∴', '∵', '∝'],
  },
  {
    id: 'greek',
    label: 'กรีก',
    chars: ['α', 'β', 'γ', 'δ', 'ε', 'ζ', 'η', 'θ', 'λ', 'μ', 'ν', 'ξ', 'ρ', 'σ', 'τ', 'φ', 'χ', 'ψ', 'ω', 'Ω', 'Δ', 'Σ', 'Π', 'Φ', 'Ψ'],
  },
  {
    id: 'fraction',
    label: 'เศษส่วน/ยกกำลัง',
    chars: ['²', '³', '¹', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹', '⁰', '½', '⅓', '¼', '¾', '⅔', '⅛', '⅜', '⅝', '⅞', '%', '‰'],
  },
  {
    id: 'arrow',
    label: 'ลูกศร',
    chars: ['→', '←', '↑', '↓', '↔', '⇒', '⇐', '⇔', '↗', '↘', '↙', '↖'],
  },
  {
    id: 'text',
    label: 'ข้อความ',
    chars: ['•', '…', '—', '–', '«', '»', '\u201C', '\u201D', '\u2018', '\u2019', '¡', '¿', '©', '®', '™', '§', '¶', '†', '‡', '№'],
  },
];

export const ALL_SPECIAL_CHARS = Array.from(
  new Set(SPECIAL_CHAR_CATEGORIES.flatMap((cat) => cat.chars)),
);
