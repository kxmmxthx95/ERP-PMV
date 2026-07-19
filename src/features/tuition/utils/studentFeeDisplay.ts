import { collection, getDocs, query, where } from 'firebase/firestore';
import { fetchStudentsByIds } from '@/lib/firestoreShared/fetchStudentsByIds';
import { db } from '@/lib/firebase';
import type { StudentFee } from '@/types/tuition';

type StudentRecord = Record<string, unknown> & { id: string };

export function formatStudentSnapshot(data: StudentRecord): { studentName: string; studentCode: string } {
  const displayName = String(data.displayName ?? data.name ?? '').trim();
  const prefix = String(data.prefix ?? '').trim();
  const firstName = String(data.firstName ?? data.first_name ?? '').trim();
  const lastName = String(data.lastName ?? data.last_name ?? '').trim();
  const fromParts = `${prefix}${firstName} ${lastName}`.replace(/\s+/g, ' ').trim();
  const studentName = fromParts || displayName || String(data.studentName ?? '').trim();
  const studentCode = String(data.studentCode ?? data.code ?? '').trim();
  return { studentName, studentCode };
}

export function buildStudentLookup(students: StudentRecord[]): Map<string, StudentRecord> {
  const map = new Map<string, StudentRecord>();
  for (const student of students) {
    map.set(student.id, student);
    const code = String(student.studentCode ?? '').trim();
    if (code) map.set(code, student);
    const authUid = String(student.authUid ?? student.userId ?? '').trim();
    if (authUid) map.set(authUid, student);
  }
  return map;
}

async function queryStudentsByField(field: string, values: string[]): Promise<StudentRecord[]> {
  const found: StudentRecord[] = [];
  const unique = [...new Set(values.map((v) => v.trim()).filter(Boolean))];
  for (let i = 0; i < unique.length; i += 30) {
    const chunk = unique.slice(i, i + 30);
    const snap = await getDocs(query(collection(db, 'students'), where(field, 'in', chunk)));
    snap.docs.forEach((docSnap) => {
      found.push({ id: docSnap.id, ...docSnap.data() } as StudentRecord);
    });
  }
  return found;
}

/** ค้นหา students/{id} จาก studentId ที่อาจเป็น doc id, auth uid, หรือ studentCode */
export async function resolveStudentsByFeeIds(studentIds: string[]): Promise<Map<string, StudentRecord>> {
  const unique = [...new Set(studentIds.map((id) => id.trim()).filter(Boolean))];
  if (unique.length === 0) return new Map();

  const loaded: StudentRecord[] = [];
  const seen = new Set<string>();

  const addStudents = (rows: StudentRecord[]) => {
    for (const row of rows) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      loaded.push(row);
    }
  };

  addStudents(await fetchStudentsByIds<StudentRecord>(unique));

  let lookup = buildStudentLookup(loaded);
  let unresolved = unique.filter((id) => !lookup.has(id));
  if (unresolved.length === 0) return lookup;

  addStudents(await queryStudentsByField('authUid', unresolved));
  lookup = buildStudentLookup(loaded);
  unresolved = unique.filter((id) => !lookup.has(id));
  if (unresolved.length === 0) return lookup;

  addStudents(await queryStudentsByField('userId', unresolved));
  lookup = buildStudentLookup(loaded);
  unresolved = unique.filter((id) => !lookup.has(id));
  if (unresolved.length === 0) return lookup;

  addStudents(await queryStudentsByField('studentCode', unresolved));
  return buildStudentLookup(loaded);
}

export function enrichFeeWithStudent(
  fee: StudentFee,
  lookup: Map<string, StudentRecord>,
): StudentFee {
  if (fee.studentName?.trim() && fee.studentCode?.trim()) return fee;

  const student = lookup.get(fee.studentId);
  if (!student) return fee;

  const snapshot = formatStudentSnapshot(student);
  return {
    ...fee,
    studentName: snapshot.studentName || fee.studentName,
    studentCode: snapshot.studentCode || fee.studentCode,
  };
}

export async function enrichStudentFeesWithProfiles(fees: StudentFee[]): Promise<StudentFee[]> {
  const needsLookup = fees.some((fee) => !fee.studentName?.trim() || !fee.studentCode?.trim());
  if (!needsLookup) return fees;

  const lookup = await resolveStudentsByFeeIds(fees.map((fee) => fee.studentId));
  return fees.map((fee) => enrichFeeWithStudent(fee, lookup));
}

export function needsFeeSnapshotBackfill(before: StudentFee, after: StudentFee): boolean {
  const nameAdded = !before.studentName?.trim() && !!after.studentName?.trim();
  const codeAdded = !before.studentCode?.trim() && !!after.studentCode?.trim();
  return nameAdded || codeAdded;
}
