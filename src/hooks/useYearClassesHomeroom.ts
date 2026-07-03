import { useMemo, useSyncExternalStore } from 'react';
import { getClassesByYearStore, type ClassLike } from '@/lib/firestoreShared/studentSummaryStore';
import { teachersCollectionStore } from '@/lib/firestoreShared/teachersStore';
import type { ClassRoom } from '@/types/class';

const noopSubscribe = () => () => {};
const emptyClasses = (): ClassLike[] => [];

export function useYearClassesHomeroom(yearId: string | undefined) {
  const classesStore = yearId ? getClassesByYearStore(yearId) : null;

  const rawClasses = useSyncExternalStore(
    classesStore?.subscribe ?? noopSubscribe,
    classesStore ? classesStore.getSnapshot : emptyClasses,
    classesStore ? classesStore.getSnapshot : emptyClasses,
  );

  const teachers = useSyncExternalStore(
    teachersCollectionStore.subscribe,
    teachersCollectionStore.getSnapshot,
    teachersCollectionStore.getSnapshot,
  );

  const classes = useMemo(
    () =>
      rawClasses
        .map((d) => ({ id: d.id, ...(d as Record<string, unknown>) } as ClassRoom))
        .filter((cls) => cls.isActive !== false),
    [rawClasses],
  );

  const homeroomByClassId = useMemo(() => {
    const map = new Map<string, string>();
    classes.forEach((cls) => {
      const teacherIds = cls.homeroomTeacherIds?.length
        ? cls.homeroomTeacherIds
        : cls.homeroomTeacherId
          ? [cls.homeroomTeacherId]
          : [];
      const names = teacherIds
        .map((id) => teachers.find((t) => t.id === id || t.userId === id)?.name)
        .filter((name): name is string => Boolean(name));
      if (names.length > 0) map.set(cls.id, names.join(', '));
    });
    return map;
  }, [classes, teachers]);

  const getHomeroomForClassId = (classId: string) =>
    homeroomByClassId.get(classId) ?? 'ไม่ระบุครูประจำชั้น';

  const getHomeroomTeacherName = (session: { classId: string; className: string }) => {
    const byId = getHomeroomForClassId(session.classId);
    if (byId !== 'ไม่ระบุครูประจำชั้น') return byId;
    const cls = classes.find((c) => c.className === session.className);
    return cls ? getHomeroomForClassId(cls.id) : 'ไม่ระบุครูประจำชั้น';
  };

  const classesLoading = yearId ? !classesStore?.getReady() : false;

  return { classes, homeroomByClassId, getHomeroomForClassId, getHomeroomTeacherName, classesLoading };
}

/** Classes where the signed-in user is homeroom teacher — no schedule/enrollment listeners. */
export function useHomeroomClassesForUser(yearId: string | undefined, userId: string | undefined) {
  const { classes, classesLoading } = useYearClassesHomeroom(yearId);
  const teachers = useSyncExternalStore(
    teachersCollectionStore.subscribe,
    teachersCollectionStore.getSnapshot,
    teachersCollectionStore.getSnapshot,
  );
  const teachersLoading = !teachersCollectionStore.getReady();

  const homeRoomClasses = useMemo(() => {
    if (!yearId || !userId) return [];
    const myProfile = teachers.find((t) => t.userId === userId || t.id === userId);
    const myTeacherDocId = myProfile?.id;

    return classes.filter((c) => {
      const sameYear = String(c.academicYearId ?? '') === String(yearId);
      const teacherIds = c.homeroomTeacherIds?.length
        ? c.homeroomTeacherIds
        : c.homeroomTeacherId
          ? [c.homeroomTeacherId]
          : [];
      const isOwner =
        (myTeacherDocId != null &&
          (c.homeroomTeacherId === myTeacherDocId || teacherIds.includes(myTeacherDocId))) ||
        c.homeroomTeacherId === userId ||
        teacherIds.includes(userId);
      return sameYear && isOwner;
    });
  }, [classes, teachers, userId, yearId]);

  return { homeRoomClasses, loading: classesLoading || teachersLoading };
}
