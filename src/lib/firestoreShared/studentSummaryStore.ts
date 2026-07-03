import { collection, getDocs, query, where } from 'firebase/firestore';
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
