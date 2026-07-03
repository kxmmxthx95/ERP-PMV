/** Sanitize id segments for class_sessions document ids. */
export function toClassSessionDocSegment(input: string): string {
  return input.replace(/[^\w.-]/g, '_');
}

export function buildClassSessionDocId(
  date: string,
  classId: string,
  subjectId: string,
  period: number,
): string {
  return `${date}_${toClassSessionDocSegment(classId)}_${toClassSessionDocSegment(subjectId)}_${period}`;
}

export function classSessionEntryKey(classId: string, subjectId: string, period: number): string {
  return `${classId}|${subjectId}|${period}`;
}
