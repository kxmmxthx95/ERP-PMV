import { doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { createSharedStore } from './createSharedStore';
import { listenDocWithGetDoc } from './listenDocWithGetDoc';

export type DeptSemesterKey = 'kindergarten' | 'primary' | 'secondary';

export type SemesterDateConfig = {
  startDate: string;
  endDate: string;
};

export type DeptSemesters = {
  semester1: SemesterDateConfig;
  semester2: SemesterDateConfig;
  summerEnabled?: boolean;
  summerSemester?: SemesterDateConfig;
};

export type DeptSemesterSettings = Record<DeptSemesterKey, DeptSemesters>;

const EMPTY: DeptSemesterSettings | null = null;

function mapDeptSemesters(raw: Record<string, unknown> | undefined): DeptSemesterSettings | null {
  if (!raw) return null;
  return raw as unknown as DeptSemesterSettings;
}

/** Live settings/dept_semesters — วันเปิด–ปิดเทอมต่อแผนก */
export const deptSemestersStore = createSharedStore<DeptSemesterSettings | null>(
  (emit) =>
    listenDocWithGetDoc(
      doc(db, 'settings', 'dept_semesters'),
      (data) => mapDeptSemesters(data as Record<string, unknown> | undefined),
      emit,
      EMPTY,
      'deptSemestersStore',
    ),
  EMPTY,
);
