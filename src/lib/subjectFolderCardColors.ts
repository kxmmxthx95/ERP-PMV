/** Folder tint presets for FD-PNG.png (base hue ≈ 328° pink). */
export const FOLDER_CARD_COLORS = [
  { id: 'pink', label: 'ชมพู', swatchClass: 'bg-pink-400', filter: 'none' },
  { id: 'rose', label: 'กุหลาบ', swatchClass: 'bg-rose-400', filter: 'hue-rotate(22deg) saturate(1.2)' },
  { id: 'orange', label: 'ส้ม', swatchClass: 'bg-orange-400', filter: 'hue-rotate(57deg) saturate(1.45)' },
  { id: 'amber', label: 'เหลือง', swatchClass: 'bg-amber-400', filter: 'hue-rotate(77deg) saturate(1.5)' },
  { id: 'lime', label: 'เขียวอ่อน', swatchClass: 'bg-lime-400', filter: 'hue-rotate(117deg) saturate(1.35)' },
  { id: 'emerald', label: 'เขียว', swatchClass: 'bg-emerald-400', filter: 'hue-rotate(-178deg) saturate(1.3)' },
  { id: 'sky', label: 'ฟ้า', swatchClass: 'bg-sky-400', filter: 'hue-rotate(-128deg) saturate(1.35)' },
  { id: 'blue', label: 'น้ำเงิน', swatchClass: 'bg-blue-400', filter: 'hue-rotate(-108deg) saturate(1.3)' },
  { id: 'violet', label: 'ม่วง', swatchClass: 'bg-violet-400', filter: 'hue-rotate(-58deg) saturate(1.2)' },
  { id: 'slate', label: 'เทา', swatchClass: 'bg-slate-400', filter: 'grayscale(0.9) brightness(1.08)' },
] as const;

export type FolderCardColorId = (typeof FOLDER_CARD_COLORS)[number]['id'];

export const MICRO_SYLLABUS_FOLDER_COLOR_KEY = 'micro-syllabus:folder-color:v1';
export const GRADE_BOOK_FOLDER_COLOR_KEY = 'grade-book:folder-color:v1';

const DEFAULT_COLOR_ID: FolderCardColorId = 'pink';

function isFolderCardColorId(value: unknown): value is FolderCardColorId {
  return typeof value === 'string' && FOLDER_CARD_COLORS.some((c) => c.id === value);
}

export function loadFolderCardColors(storageKey: string): Record<string, FolderCardColorId> {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, FolderCardColorId> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (isFolderCardColorId(value)) out[key] = value;
    }
    return out;
  } catch {
    return {};
  }
}

export function saveFolderCardColors(
  map: Record<string, FolderCardColorId>,
  storageKey: string,
): void {
  try {
    localStorage.setItem(storageKey, JSON.stringify(map));
  } catch {
    // quota / private mode
  }
}

export function getFolderCardColor(id?: FolderCardColorId | null) {
  return FOLDER_CARD_COLORS.find((c) => c.id === id) ?? FOLDER_CARD_COLORS.find((c) => c.id === DEFAULT_COLOR_ID)!;
}

export { DEFAULT_COLOR_ID };
