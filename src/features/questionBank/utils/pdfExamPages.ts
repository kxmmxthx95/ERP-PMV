/** 1-based PDF page numbers visible to students (excludes hidden). */
export function getVisiblePdfPages(totalPages: number, hiddenPages: number[] | undefined): number[] {
  if (totalPages <= 0) return [];
  const hidden = new Set(
    (hiddenPages ?? []).filter((p) => Number.isInteger(p) && p >= 1 && p <= totalPages),
  );
  return Array.from({ length: totalPages }, (_, i) => i + 1).filter((p) => !hidden.has(p));
}

export function normalizeHiddenPdfPages(hiddenPages: number[], totalPages: number): number[] {
  if (totalPages <= 0) return [];
  const unique = new Set<number>();
  for (const p of hiddenPages) {
    if (Number.isInteger(p) && p >= 1 && p <= totalPages) unique.add(p);
  }
  return Array.from(unique).sort((a, b) => a - b);
}

export function snapToVisiblePdfPage(pageNum: number, visiblePages: number[]): number {
  if (visiblePages.length === 0) return pageNum;
  if (visiblePages.includes(pageNum)) return pageNum;
  return visiblePages[0];
}

export function validateExamPdfHiddenPages(
  totalPages: number,
  hiddenPages: number[],
): string | null {
  if (totalPages <= 0) return null;
  const visible = getVisiblePdfPages(totalPages, hiddenPages);
  if (visible.length === 0) {
    return 'ต้องเหลืออย่างน้อย 1 หน้าที่นักเรียนเห็นได้ในห้องสอบ';
  }
  return null;
}
