import type { ScheduleEntry } from '@/types/schedule';

function teacherKey(entry: ScheduleEntry): string {
  return String(entry.teacherId || entry.teacherName || '').trim();
}

function subjectKey(entry: ScheduleEntry): string {
  return String(entry.subjectId || entry.subjectCode || entry.subjectName || '').trim();
}

function slotKey(entry: ScheduleEntry): string {
  return `${entry.day}|${entry.period}|${teacherKey(entry)}|${subjectKey(entry)}`;
}

/** Same teacher + same subject + same slot across 2+ classes */
export function isJointClassGroup(entries: ScheduleEntry[]): boolean {
  if (entries.length < 2) return false;
  const first = entries[0];
  const sameTeacherSubject = entries.every(
    (e) => teacherKey(e) === teacherKey(first) && subjectKey(e) === subjectKey(first),
  );
  if (!sameTeacherSubject) return false;
  return new Set(entries.map((e) => e.classId)).size >= 2;
}

export interface JointClassInfo {
  entryIds: Set<string>;
  /** Partner class IDs for each entry in a joint group (excludes self) */
  partnersByEntryId: Map<string, string[]>;
}

export function buildJointClassInfo(allEntries: ScheduleEntry[]): JointClassInfo {
  const groups = new Map<string, ScheduleEntry[]>();
  for (const entry of allEntries) {
    const key = slotKey(entry);
    const list = groups.get(key) ?? [];
    list.push(entry);
    groups.set(key, list);
  }

  const entryIds = new Set<string>();
  const partnersByEntryId = new Map<string, string[]>();

  for (const group of groups.values()) {
    if (!isJointClassGroup(group)) continue;
    for (const entry of group) {
      entryIds.add(entry.id);
      partnersByEntryId.set(
        entry.id,
        group.filter((e) => e.classId !== entry.classId).map((e) => e.classId),
      );
    }
  }

  return { entryIds, partnersByEntryId };
}

export function formatClassLabels(
  classIds: string[],
  allClasses?: { id: string; label: string }[],
): string {
  return classIds
    .map((id) => allClasses?.find((c) => c.id === id)?.label || id)
    .join(', ');
}
