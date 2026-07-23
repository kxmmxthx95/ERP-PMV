import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { createSharedStore } from './createSharedStore';
import { listenQueryWithGetDocs } from './listenWithGetDocs';

type DocRow = { id: string; [key: string]: unknown };

export type EnrollmentLike = {
  id?: string;
  studentId?: string;
  departmentId?: string;
  gradeLevel?: string;
  semester?: number;
  status?: string;
  academicYearId?: string;
  academicYear?: string;
  enrolledAt?: string;
  classId?: string;
  classroomId?: string;
  roomId?: string;
  className?: string;
  roomNumber?: string;
  roomNo?: string;
};

export type StudentLike = {
  id: string;
  gradeLevel?: string;
  classroomId?: string;
  classId?: string;
  academicYearId?: string;
  academicYear?: string;
  status?: string;
  currentStatus?: string;
};

export type ClassLike = {
  id: string;
  academicYearId?: string;
  academicYear?: string;
  semester?: number;
  studentIds?: string[];
  departmentId?: string;
  department?: string;
  gradeLevel?: string;
  grade?: string;
  [key: string]: unknown;
};

const enrollmentStores = new Map<string, ReturnType<typeof createSharedStore<EnrollmentLike[]>>>();
const classStores = new Map<string, ReturnType<typeof createSharedStore<ClassLike[]>>>();
const studentsByYearStores = new Map<string, ReturnType<typeof createSharedStore<StudentLike[]>>>();
const classEnrollmentsScopedStores = new Map<string, ReturnType<typeof createSharedStore<EnrollmentLike[]>>>();
const classDocStores = new Map<string, ReturnType<typeof createSharedStore<ClassLike | null>>>();
const homeroomClassesScopedStores = new Map<string, ReturnType<typeof createSharedStore<ClassLike[]>>>();
const teachingClassesScopedStores = new Map<string, ReturnType<typeof createSharedStore<ClassLike[]>>>();

function mapEnrollmentRows(rows: DocRow[]): EnrollmentLike[] {
  return rows.map(({ id, ...rest }) => ({ id, ...rest } as EnrollmentLike));
}

function mapStudentRows(rows: DocRow[]): StudentLike[] {
  return rows.map((row) => {
    const { id, ...rest } = row;
    return { id, ...rest } as StudentLike;
  });
}

function mapClassRows(rows: DocRow[]): ClassLike[] {
  return rows.map(({ id, ...rest }) => ({ id, ...rest } as ClassLike));
}

/** Merge two year-partition queries (academicYearId + legacy academicYear). */
function listenYearPartitionedCollection<T>(
  collectionName: string,
  academicYearId: string,
  mapRows: (rows: DocRow[]) => T[],
  emit: (value: T[]) => void,
  logPrefix: string,
): () => void {
  let byYearId: T[] = [];
  let byLegacyYear: T[] = [];

  const mergeAndEmit = () => {
    const map = new Map<string, T>();
    [...byYearId, ...byLegacyYear].forEach((row) => {
      const key = String((row as { id?: string }).id ?? '').trim();
      if (key) map.set(key, row);
    });
    emit([...map.values()]);
  };

  const unsubYearId = listenQueryWithGetDocs(
    query(collection(db, collectionName), where('academicYearId', '==', academicYearId)),
    mapRows,
    (items) => {
      byYearId = items;
      mergeAndEmit();
    },
    byYearId,
    `${logPrefix}:yearId`,
  );

  const unsubLegacy = listenQueryWithGetDocs(
    query(collection(db, collectionName), where('academicYear', '==', academicYearId)),
    mapRows,
    (items) => {
      byLegacyYear = items;
      mergeAndEmit();
    },
    byLegacyYear,
    `${logPrefix}:yearLegacy`,
  );

  return () => {
    unsubYearId();
    unsubLegacy();
  };
}

let studentsCached: StudentLike[] = [];

/** Master students list — shared across all academic years (fallback matching). */
export const studentsMasterStore = createSharedStore<StudentLike[]>(
  (emit) => listenQueryWithGetDocs(
    collection(db, 'students'),
    mapStudentRows,
    (items) => {
      studentsCached = items;
      emit(items);
    },
    studentsCached,
    'studentSummary:students',
  ),
  [],
);

export function getStudentsByYearStore(academicYearId: string) {
  let store = studentsByYearStores.get(academicYearId);
  if (!store) {
    store = createSharedStore<StudentLike[]>(
      (emit) => listenYearPartitionedCollection(
        'students',
        academicYearId,
        mapStudentRows,
        emit,
        `studentSummary:students:${academicYearId}`,
      ),
      [],
    );
    studentsByYearStores.set(academicYearId, store);
  }
  return store;
}

export function getEnrollmentsByYearStore(academicYearId: string) {
  let store = enrollmentStores.get(academicYearId);
  if (!store) {
    store = createSharedStore<EnrollmentLike[]>(
      (emit) => listenYearPartitionedCollection(
        'enrollments',
        academicYearId,
        mapEnrollmentRows,
        emit,
        `studentSummary:enrollments:${academicYearId}`,
      ),
      [],
    );
    enrollmentStores.set(academicYearId, store);
  }
  return store;
}

export function getClassesByYearStore(academicYearId: string) {
  let store = classStores.get(academicYearId);
  if (!store) {
    store = createSharedStore<ClassLike[]>(
      (emit) => listenYearPartitionedCollection(
        'classes',
        academicYearId,
        mapClassRows,
        emit,
        `studentSummary:classes:${academicYearId}`,
      ),
      [],
    );
    classStores.set(academicYearId, store);
  }
  return store;
}

/**
 * หนึ่งห้อง หนึ่งครั้ง (ไม่ realtime, ไม่สแกนทั้งโรงเรียน) — ใช้กับหน้าที่ต้องการ roster
 * ของห้องเดียวตอนนั้น เช่น เช็คชื่อเข้าแถวตอนเช้า ที่ครูหลายสิบคนเปิดพร้อมกันได้
 * (getEnrollmentsByYearStore/getClassesByYearStore ด้านบนเปิด onSnapshot ทั้ง collection
 * ทั้งโรงเรียนต่อครูหนึ่งคน แพงเกินจำเป็นสำหรับ use case นี้)
 */
export function getClassEnrollmentsScopedStore(academicYearId: string, classId: string) {
  const key = `${academicYearId}|${classId}`;
  let store = classEnrollmentsScopedStores.get(key);
  if (!store) {
    let cached: EnrollmentLike[] = [];
    store = createSharedStore<EnrollmentLike[]>(
      (emit) => {
        let cancelled = false;
        void getDocs(query(
          collection(db, 'enrollments'),
          where('academicYearId', '==', academicYearId),
          where('classId', '==', classId),
        ))
          .then((snap) => {
            if (cancelled) return;
            cached = mapEnrollmentRows(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
            emit(cached);
          })
          .catch((err) => {
            console.warn(`[studentSummary:classEnrollmentsScoped:${key}] getDocs failed:`, err);
            if (!cancelled) emit(cached);
          });
        return () => {
          cancelled = true;
        };
      },
      [],
    );
    classEnrollmentsScopedStores.set(key, store);
  }
  return store;
}

/** ดึง class doc เดียว ครั้งเดียว (ไม่ realtime) — คู่กับ getClassEnrollmentsScopedStore */
export function getClassDocStore(classId: string) {
  let store = classDocStores.get(classId);
  if (!store) {
    let cached: ClassLike | null = null;
    store = createSharedStore<ClassLike | null>(
      (emit) => {
        let cancelled = false;
        void getDoc(doc(db, 'classes', classId))
          .then((snap) => {
            if (cancelled) return;
            cached = snap.exists() ? ({ id: snap.id, ...snap.data() } as ClassLike) : null;
            emit(cached);
          })
          .catch((err) => {
            console.warn(`[studentSummary:classDoc:${classId}] getDoc failed:`, err);
            if (!cancelled) emit(cached);
          });
        return () => {
          cancelled = true;
        };
      },
      null,
    );
    classDocStores.set(classId, store);
  }
  return store;
}

/**
 * ห้องที่ครูคนนี้เป็นครูประจำชั้น เท่านั้น (ไม่ realtime, ไม่สแกนทั้งโรงเรียน) — แทน
 * getClassesByYearStore ทั้ง collection ที่ widget เช็คชื่อเข้าแถวฝั่งครูเคยใช้ (เปิดต่อครู
 * แต่ละคน คูณครูออนไลน์พร้อมกันเข้าไปมหาศาล) ปกติครูมี homeroom แค่ 0-1 ห้อง
 *
 * teacherIds รับได้หลายค่า (authUid + teacher doc id) เพราะฟิลด์ homeroomTeacherId(s)
 * ในเอกสารห้องเก่าบางส่วนเก็บ authUid บางส่วนเก็บ teacher doc id ไม่ตรงกันเสมอไป
 */
export function getHomeroomClassesStore(academicYearId: string, teacherIds: string[]) {
  const ids = [...new Set(teacherIds.filter(Boolean))].sort();
  const key = `${academicYearId}|${ids.join(',')}`;
  let store = homeroomClassesScopedStores.get(key);
  if (!store) {
    let cached: ClassLike[] = [];
    store = createSharedStore<ClassLike[]>(
      (emit) => {
        if (ids.length === 0) {
          emit([]);
          return () => {};
        }
        let cancelled = false;
        // Firestore array-contains-any/in รองรับสูงสุด 10 ค่า — identity key ของครูคนเดียว
        // ไม่มีทางเกินนี้ในทางปฏิบัติ (authUid + teacher doc id = 2 ค่า)
        void Promise.all([
          getDocs(query(
            collection(db, 'classes'),
            where('academicYearId', '==', academicYearId),
            where('homeroomTeacherIds', 'array-contains-any', ids.slice(0, 10)),
          )),
          // legacy single-value field — เอกสารเก่าอาจไม่มี homeroomTeacherIds array
          getDocs(query(
            collection(db, 'classes'),
            where('academicYearId', '==', academicYearId),
            where('homeroomTeacherId', 'in', ids.slice(0, 10)),
          )),
        ])
          .then(([byArray, byLegacy]) => {
            if (cancelled) return;
            const map = new Map<string, ClassLike>();
            mapClassRows([...byArray.docs, ...byLegacy.docs].map((d) => ({ id: d.id, ...d.data() })))
              .forEach((row) => map.set(row.id, row));
            cached = [...map.values()];
            emit(cached);
          })
          .catch((err) => {
            console.warn(`[studentSummary:homeroomClasses:${key}] getDocs failed:`, err);
            if (!cancelled) emit(cached);
          });
        return () => {
          cancelled = true;
        };
      },
      [],
    );
    homeroomClassesScopedStores.set(key, store);
  }
  return store;
}

/**
 * ห้องที่ครูคนนี้มีวิชาสอนอยู่ (enrolledCourses) — query ตรงด้วย teacherIds (field ที่ sync
 * มาจาก enrolledCourses ใน useClassroomManager.updateClass/addClass) แทนโหลดทั้ง `classes`
 * collection มาสแกนทีละห้องแบบที่ useTeachingManager/MicroSyllabusPage เคยทำ
 *
 * ต้องรัน `npm run backfill:class-teacher-ids` ก่อน ห้องเก่าที่ยังไม่มี field teacherIds
 * จะ query ไม่เจอ — ยังไม่ได้เอาไปต่อกับ consumer ไหนจนกว่าจะ backfill เสร็จและ verify แล้ว
 */
export function getTeachingClassesStore(academicYearId: string, teacherIds: string[]) {
  const ids = [...new Set(teacherIds.filter(Boolean))].sort();
  const key = `${academicYearId}|${ids.join(',')}`;
  let store = teachingClassesScopedStores.get(key);
  if (!store) {
    let cached: ClassLike[] = [];
    store = createSharedStore<ClassLike[]>(
      (emit) => {
        if (ids.length === 0) {
          emit([]);
          return () => {};
        }
        let cancelled = false;
        void getDocs(query(
          collection(db, 'classes'),
          where('academicYearId', '==', academicYearId),
          where('teacherIds', 'array-contains-any', ids.slice(0, 10)),
        ))
          .then((snap) => {
            if (cancelled) return;
            cached = mapClassRows(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
            emit(cached);
          })
          .catch((err) => {
            console.warn(`[studentSummary:teachingClasses:${key}] getDocs failed:`, err);
            if (!cancelled) emit(cached);
          });
        return () => {
          cancelled = true;
        };
      },
      [],
    );
    teachingClassesScopedStores.set(key, store);
  }
  return store;
}

async function refetchYearPartitionedCollection<T>(
  collectionName: string,
  academicYearId: string,
  mapRows: (rows: DocRow[]) => T[],
): Promise<T[]> {
  const [byYearIdSnap, byLegacySnap] = await Promise.all([
    getDocs(query(collection(db, collectionName), where('academicYearId', '==', academicYearId))),
    getDocs(query(collection(db, collectionName), where('academicYear', '==', academicYearId))),
  ]);

  const map = new Map<string, T>();
  [...mapRows(byYearIdSnap.docs.map((d) => ({ id: d.id, ...d.data() }))), ...mapRows(byLegacySnap.docs.map((d) => ({ id: d.id, ...d.data() })))].forEach((row) => {
    const key = String((row as { id?: string }).id ?? '').trim();
    if (key) map.set(key, row);
  });
  return [...map.values()];
}

/** Force-refresh shared student summary stores after local writes (delete/move). */
export async function refreshStudentSummaryForYear(academicYearId: string): Promise<void> {
  const [students, enrollments, classes] = await Promise.all([
    refetchYearPartitionedCollection('students', academicYearId, mapStudentRows),
    refetchYearPartitionedCollection('enrollments', academicYearId, mapEnrollmentRows),
    refetchYearPartitionedCollection('classes', academicYearId, mapClassRows),
  ]);

  getStudentsByYearStore(academicYearId).publish(students);
  getEnrollmentsByYearStore(academicYearId).publish(enrollments);
  getClassesByYearStore(academicYearId).publish(classes);
}

export async function refreshStudentsMasterStore(): Promise<void> {
  const snap = await getDocs(collection(db, 'students'));
  const items = mapStudentRows(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  studentsCached = items;
  studentsMasterStore.publish(items);
}

export async function invalidateStudentSummaryCache(academicYearId?: string): Promise<void> {
  await refreshStudentsMasterStore();
  if (academicYearId) {
    await refreshStudentSummaryForYear(academicYearId);
  }
}
