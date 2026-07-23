/** @deprecated Import from `@/lib/subjectFolderCardColors` instead. */
export {
  FOLDER_CARD_COLORS,
  DEFAULT_COLOR_ID,
  getFolderCardColor,
  type FolderCardColorId,
  MICRO_SYLLABUS_FOLDER_COLOR_KEY,
} from '@/lib/subjectFolderCardColors';

import {
  loadFolderCardColors as load,
  saveFolderCardColors as save,
  MICRO_SYLLABUS_FOLDER_COLOR_KEY,
  type FolderCardColorId,
} from '@/lib/subjectFolderCardColors';

export function loadFolderCardColors(): Record<string, FolderCardColorId> {
  return load(MICRO_SYLLABUS_FOLDER_COLOR_KEY);
}

export function saveFolderCardColors(map: Record<string, FolderCardColorId>): void {
  save(map, MICRO_SYLLABUS_FOLDER_COLOR_KEY);
}
