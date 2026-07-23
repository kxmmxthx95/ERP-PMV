import { useMemo, useSyncExternalStore } from 'react';
import {
  getClassesByYearStore,
  getHomeroomClassesStore,
  type ClassLike,
} from '@/lib/firestoreShared/studentSummaryStore';
import { teachersCollectionStore } from '@/lib/firestoreShared/teachersStore';
import { buildTeacherIdentityKeys } from '@/lib/teachers/teacherIdentity';
import type { ClassRoom } from '@/types/class';

const noopSubscribe = () => () => {};
// ค่าอ้างอิงเดียวคงที่ ห้ามสร้าง [] ใหม่ทุกครั้ง ไม่งั้น useSyncExternalStore วน re-render ไม่จบ
const EMPTY_CLASSES: readonly ClassLike[] = [];
const emptyClasses = () => EMPTY_CLASSES;

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

const noopSubscribeHomeroom = () => () => {};
const emptyHomeroomClasses = () => EMPTY_CLASSES;

/**
 * Classes where the signed-in user is homeroom teacher — scoped query (own classes only),
 * not the whole-school classes listener. ครูส่วนใหญ่มี homeroom แค่ 0-1 ห้อง แต่ถ้าใช้
 * useYearClassesHomeroom (ทั้งโรงเรียน) จะเปิด listener เต็ม collection ต่อครูทุกคนที่เข้าหน้านี้
 */
export function useHomeroomClassesForUser(yearId: string | undefined, userId: string | undefined) {
  const teachers = useSyncExternalStore(
    teachersCollectionStore.subscribe,
    teachersCollectionStore.getSnapshot,
    teachersCollectionStore.getSnapshot,
  );
  const teachersLoading = !teachersCollectionStore.getReady();

  const myProfile = useMemo(
    () => teachers.find((t) => t.userId === userId || t.id === userId) ?? null,
    [teachers, userId],
  );
  const identityKeys = useMemo(
    () => [...buildTeacherIdentityKeys(userId ?? '', myProfile)],
    [userId, myProfile],
  );

  const homeroomStore = yearId && identityKeys.length > 0
    ? getHomeroomClassesStore(yearId, identityKeys)
    : null;

  const rawClasses = useSyncExternalStore(
    homeroomStore?.subscribe ?? noopSubscribeHomeroom,
    homeroomStore ? homeroomStore.getSnapshot : emptyHomeroomClasses,
    homeroomStore ? homeroomStore.getSnapshot : emptyHomeroomClasses,
  );
  const classesReady = homeroomStore ? homeroomStore.getReady() : true;

  const homeRoomClasses = useMemo(
    () => rawClasses.map((d) => ({ id: d.id, ...(d as Record<string, unknown>) } as ClassRoom)),
    [rawClasses],
  );

  return { homeRoomClasses, loading: teachersLoading || !classesReady };
}
