import { collection, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { createSharedStore } from './createSharedStore';
import { listenQueryWithGetDocs } from './listenWithGetDocs';

export type StaffUserRow = {
  userId: string;
  displayName: string;
  photoURL?: string;
  department?: string;
  role?: string;
  status?: string;
};

export type PortalUserRow = StaffUserRow & {
  email?: string;
  lineToken?: string;
  lineUid?: string;
};

export type StudentParentUserRow = {
  userId: string;
  role?: string;
  status?: string;
};

type DocRow = { id: string; [key: string]: unknown };

function mapStaffUsers(rows: DocRow[]): StaffUserRow[] {
  return rows.map((d) => {
    const u = d as {
      name?: string;
      displayName?: string;
      email?: string;
      photoURL?: string;
      department?: string;
      departmentId?: string;
      role?: string;
      lineToken?: string;
      lineUid?: string;
      status?: string;
    };
    return {
      userId: d.id,
      displayName: u.name || u.displayName || u.email || 'บุคลากร',
      photoURL: typeof u.photoURL === 'string' ? u.photoURL : undefined,
      department: u.department || u.departmentId,
      role: typeof u.role === 'string' ? u.role : undefined,
      status: typeof u.status === 'string' ? u.status : undefined,
    };
  });
}

function mapPortalUsers(rows: DocRow[]): PortalUserRow[] {
  return rows.map((d) => {
    const u = d as {
      name?: string;
      displayName?: string;
      email?: string;
      photoURL?: string;
      department?: string;
      departmentId?: string;
      role?: string;
      lineToken?: string;
      lineUid?: string;
      status?: string;
    };
    return {
      userId: d.id,
      displayName: u.name || u.displayName || u.email || 'บุคลากร',
      photoURL: typeof u.photoURL === 'string' ? u.photoURL : undefined,
      department: u.department || u.departmentId,
      role: typeof u.role === 'string' ? u.role : undefined,
      email: typeof u.email === 'string' ? u.email : undefined,
      lineToken: typeof u.lineToken === 'string' ? u.lineToken : undefined,
      lineUid: typeof u.lineUid === 'string' ? u.lineUid : undefined,
      status: typeof u.status === 'string' ? u.status : undefined,
    };
  });
}

function mapStudentParentUsers(rows: DocRow[]): StudentParentUserRow[] {
  return rows.map((d) => {
    const u = d as { role?: string; status?: string };
    return {
      userId: d.id,
      role: typeof u.role === 'string' ? u.role : undefined,
      status: typeof u.status === 'string' ? u.status : undefined,
    };
  });
}

let cached: StaffUserRow[] = [];

export const staffUsersStore = createSharedStore<StaffUserRow[]>(
  (emit) => {
    const q = query(collection(db, 'users'), where('role', 'in', ['teacher', 'staff']));
    return listenQueryWithGetDocs(
      q,
      mapStaffUsers,
      (items) => {
        cached = items;
        emit(items);
      },
      cached,
      'staffUsersStore',
    );
  },
  cached,
);

let portalRecipientsCached: PortalUserRow[] = [];

export const portalRecipientUsersStore = createSharedStore<PortalUserRow[]>(
  (emit) => {
    const q = query(
      collection(db, 'users'),
      where('role', 'in', ['admin', 'sysadmin', 'teacher', 'staff']),
    );
    return listenQueryWithGetDocs(
      q,
      mapPortalUsers,
      (items) => {
        portalRecipientsCached = items;
        emit(items);
      },
      portalRecipientsCached,
      'portalRecipientUsersStore',
    );
  },
  portalRecipientsCached,
);

let studentParentCached: StudentParentUserRow[] = [];

export const studentParentUsersStore = createSharedStore<StudentParentUserRow[]>(
  (emit) => {
    const q = query(collection(db, 'users'), where('role', 'in', ['student', 'parent']));
    return listenQueryWithGetDocs(
      q,
      mapStudentParentUsers,
      (items) => {
        studentParentCached = items;
        emit(items);
      },
      studentParentCached,
      'studentParentUsersStore',
    );
  },
  studentParentCached,
);

export function waitStaffUsersStore(): Promise<StaffUserRow[]> {
  if (staffUsersStore.getReady()) {
    return Promise.resolve(staffUsersStore.getSnapshot());
  }

  return new Promise((resolve) => {
    const unsub = staffUsersStore.subscribe(() => {
      if (staffUsersStore.getReady()) {
        unsub();
        resolve(staffUsersStore.getSnapshot());
      }
    });
  });
}
