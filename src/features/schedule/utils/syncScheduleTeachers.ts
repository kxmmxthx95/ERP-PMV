import type { EnrolledCourse } from '@/types/class';
import type { ScheduleEntry, SchoolClass, SchoolDay } from '@/types/schedule';

export interface TeacherProfileLike {
  id: string;
  userId?: string;
  name?: string;
}

export interface SubjectCatalogItem {
  id: string;
  code: string;
  name?: string;
}

export interface TeacherSyncUpdate {
  entryId: string;
  subjectName: string;
  subjectCode: string;
  oldTeacherId: string;
  oldTeacherName: string;
  newTeacherId: string;
  newTeacherName: string;
}

/** All raw ids that should match one teacher in schedule/enrollment lookups. */
export function buildTeacherIdAliasSet(
  teacherId: string,
  profiles: TeacherProfileLike[],
  scheduleTeachers: TeacherProfileLike[],
): Set<string> {
  const aliases = new Set<string>();
  const add = (value?: string) => {
    const text = String(value || '').trim();
    if (text) aliases.add(text);
  };

  add(teacherId);

  const canonical = resolveScheduleTeacherId(profiles, scheduleTeachers, teacherId) ?? teacherId;
  add(canonical);

  const profile = profiles.find((t) => t.id === canonical);
  if (profile?.userId) add(String(profile.userId));

  const byUserId = profiles.find((t) => t.userId && String(t.userId).trim() === teacherId);
  if (byUserId) {
    add(byUserId.id);
    add(String(byUserId.userId));
  }

  return aliases;
}

export function scheduleEntryMatchesTeacher(
  entry: Pick<ScheduleEntry, 'teacherId' | 'teacherName' | 'year' | 'semester'>,
  teacherId: string,
  year: string,
  sem: 1 | 2,
  profiles: TeacherProfileLike[],
  scheduleTeachers: TeacherProfileLike[],
): boolean {
  if (String(entry.year) !== String(year) || Number(entry.semester) !== Number(sem)) {
    return false;
  }

  const raw = String(entry.teacherId || '').trim();
  if (raw && buildTeacherIdAliasSet(teacherId, profiles, scheduleTeachers).has(raw)) {
    return true;
  }

  const entryCanonical = resolveScheduleTeacherId(
    profiles,
    scheduleTeachers,
    entry.teacherId,
    entry.teacherName,
  );
  const selectedCanonical = resolveScheduleTeacherId(profiles, scheduleTeachers, teacherId);
  return !!entryCanonical && !!selectedCanonical && entryCanonical === selectedCanonical;
}

/** Today's schedule slots for one teacher — same rules as ตารางสอน (teacher view). */
export function filterTeacherEntriesForSchoolDay(
  entries: ScheduleEntry[],
  teacherId: string,
  year: string,
  semester: 1 | 2,
  schoolDay: SchoolDay,
  profiles: TeacherProfileLike[],
  scheduleTeachers: TeacherProfileLike[] = profiles,
): ScheduleEntry[] {
  if (!teacherId.trim()) return [];
  return entries
    .filter(
      (entry) =>
        entry.day === schoolDay
        && scheduleEntryMatchesTeacher(entry, teacherId, year, semester, profiles, scheduleTeachers),
    )
    .sort((a, b) => a.period - b.period || a.classId.localeCompare(b.classId, 'th'));
}

export function enrolledCourseMatchesTeacher(
  enrolledTeacherId: string | undefined,
  teacherId: string,
  profiles: TeacherProfileLike[],
  scheduleTeachers: TeacherProfileLike[],
): boolean {
  const raw = String(enrolledTeacherId || '').trim();
  if (!raw) return false;

  if (buildTeacherIdAliasSet(teacherId, profiles, scheduleTeachers).has(raw)) {
    return true;
  }

  const enrolledCanonical = resolveScheduleTeacherId(profiles, scheduleTeachers, enrolledTeacherId);
  const selectedCanonical = resolveScheduleTeacherId(profiles, scheduleTeachers, teacherId);
  return !!enrolledCanonical && !!selectedCanonical && enrolledCanonical === selectedCanonical;
}

export function resolveScheduleTeacherId(
  profiles: TeacherProfileLike[],
  scheduleTeachers: TeacherProfileLike[],
  rawTeacherId?: string,
  fallbackName?: string,
): string | null {
  const target = String(rawTeacherId || '').trim();
  const fallback = String(fallbackName || '').trim().toLowerCase();
  if (!target && !fallback) return null;

  if (scheduleTeachers.some((t) => t.id === target)) return target;

  const fromUserId = profiles.find((t) => t.userId && String(t.userId).trim() === target);
  if (fromUserId) return fromUserId.id;

  const fromProfileId = profiles.find((t) => t.id === target);
  if (fromProfileId) return fromProfileId.id;

  if (fallback) {
    const byName = profiles.find((t) => String(t.name || '').trim().toLowerCase() === fallback);
    if (byName) return byName.id;
  }

  return target || null;
}

function teacherNameById(
  id: string,
  profiles: TeacherProfileLike[],
  scheduleTeachers: TeacherProfileLike[],
): string {
  return (
    scheduleTeachers.find((t) => t.id === id)?.name
    ?? profiles.find((t) => t.id === id)?.name
    ?? profiles.find((t) => t.userId === id)?.name
    ?? ''
  );
}

function normalizeText(value: unknown) {
  return String(value ?? '').trim();
}

function normalizeName(value: unknown) {
  return normalizeText(value).toLowerCase();
}

function buildSubjectKeySet(
  subjectId: string,
  subjectCode: string,
  subjectName: string,
  catalog: SubjectCatalogItem[],
): Set<string> {
  const keys = new Set<string>();
  const add = (value: unknown) => {
    const text = normalizeText(value);
    if (text) keys.add(text);
  };

  add(subjectId);
  add(subjectCode);
  add(subjectName);

  const seedKeys = new Set(keys);
  for (const item of catalog) {
    const itemKeys = [item.id, item.code, item.name].map(normalizeText).filter(Boolean);
    const overlaps = itemKeys.some((key) => seedKeys.has(key));
    if (overlaps) {
      itemKeys.forEach(add);
    }
  }

  return keys;
}

function enrolledMatchesSubjectKeys(ec: EnrolledCourse, subjectKeys: Set<string>, catalog: SubjectCatalogItem[]): boolean {
  const enrolledKey = normalizeText(ec.subjectId);
  if (!enrolledKey) return false;
  if (subjectKeys.has(enrolledKey)) return true;

  for (const item of catalog) {
    const itemKeys = [item.id, item.code, item.name].map(normalizeText).filter(Boolean);
    const enrolledInItem = itemKeys.includes(enrolledKey);
    if (!enrolledInItem) continue;
    if (itemKeys.some((key) => subjectKeys.has(key))) return true;
  }

  return false;
}

function pickReplacementTeacher(
  enrolledTeacherIds: string[],
  entryTeacherId: string | null,
): string | null {
  if (enrolledTeacherIds.length === 0) return null;
  if (enrolledTeacherIds.length === 1) return enrolledTeacherIds[0];
  const alternatives = enrolledTeacherIds.filter((id) => id !== entryTeacherId);
  return alternatives[0] ?? enrolledTeacherIds[0];
}

export function getTeacherSyncUpdates(params: {
  classId: string;
  year: string;
  semester: 1 | 2;
  entries: ScheduleEntry[];
  classRoom?: SchoolClass | null;
  profiles: TeacherProfileLike[];
  scheduleTeachers: TeacherProfileLike[];
  subjectCatalog?: SubjectCatalogItem[];
}): TeacherSyncUpdate[] {
  const {
    classId,
    year,
    semester,
    entries,
    classRoom,
    profiles,
    scheduleTeachers,
    subjectCatalog = [],
  } = params;

  if (!classRoom?.enrolledCourses?.length) return [];

  const classEntries = entries.filter(
    (e) =>
      e.classId === classId
      && String(e.year) === String(year)
      && Number(e.semester) === Number(semester),
  );

  const semesterEnrolled = classRoom.enrolledCourses.filter(
    (ec) => !ec.semester || Number(ec.semester) === Number(semester),
  );

  const updates: TeacherSyncUpdate[] = [];

  for (const entry of classEntries) {
    const subjectKeys = buildSubjectKeySet(
      entry.subjectId,
      entry.subjectCode,
      entry.subjectName,
      subjectCatalog,
    );

    const enrolledForSubject = semesterEnrolled.filter(
      (ec) => normalizeText(ec.teacherId) && enrolledMatchesSubjectKeys(ec, subjectKeys, subjectCatalog),
    );

    const enrolledTeacherIds = Array.from(new Set(
      enrolledForSubject
        .map((ec) => resolveScheduleTeacherId(profiles, scheduleTeachers, ec.teacherId))
        .filter((id): id is string => !!id),
    ));

    if (enrolledTeacherIds.length === 0) continue;

    const entryTeacherId = resolveScheduleTeacherId(
      profiles,
      scheduleTeachers,
      entry.teacherId,
      entry.teacherName,
    );

    const expectedTeacherId = pickReplacementTeacher(enrolledTeacherIds, entryTeacherId);
    if (!expectedTeacherId) continue;

    const expectedTeacherName = teacherNameById(expectedTeacherId, profiles, scheduleTeachers)
      || teacherNameById(expectedTeacherId, profiles, profiles);

    const sameTeacherId = !!entryTeacherId && entryTeacherId === expectedTeacherId;
    const sameTeacherName = normalizeName(entry.teacherName) === normalizeName(expectedTeacherName);

    if (sameTeacherId && sameTeacherName) continue;

    if (sameTeacherId && !sameTeacherName && expectedTeacherName) {
      updates.push({
        entryId: entry.id,
        subjectName: entry.subjectName,
        subjectCode: entry.subjectCode,
        oldTeacherId: entry.teacherId,
        oldTeacherName: entry.teacherName,
        newTeacherId: expectedTeacherId,
        newTeacherName: expectedTeacherName,
      });
      continue;
    }

    if (entryTeacherId && enrolledTeacherIds.includes(entryTeacherId) && sameTeacherName) continue;

    if (expectedTeacherId === entryTeacherId && sameTeacherName) continue;

    updates.push({
      entryId: entry.id,
      subjectName: entry.subjectName,
      subjectCode: entry.subjectCode,
      oldTeacherId: entry.teacherId,
      oldTeacherName: entry.teacherName,
      newTeacherId: expectedTeacherId,
      newTeacherName: expectedTeacherName || entry.teacherName,
    });
  }

  return updates;
}

export function buildSubjectCatalogForClass(
  classRoom: SchoolClass | null | undefined,
  coursesByVersion: Record<string, Array<{ id?: string; courseCode?: string; courseName?: string }>>,
): SubjectCatalogItem[] {
  if (!classRoom) return [];

  const classPackageId = (classRoom as SchoolClass & { curriculumId?: string }).curriculumPackageId
    || (classRoom as SchoolClass & { curriculumId?: string }).curriculumId;

  const source = classPackageId && coursesByVersion[classPackageId]?.length
    ? coursesByVersion[classPackageId]
    : Object.values(coursesByVersion).flat();

  return source.map((course) => ({
    id: normalizeText(course.id),
    code: normalizeText(course.courseCode),
    name: normalizeText(course.courseName),
  })).filter((item) => item.id || item.code);
}
