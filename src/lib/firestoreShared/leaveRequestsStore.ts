import { collection, orderBy, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { createSharedStore } from './createSharedStore';
import { listenQueryWithGetDocs } from './listenWithGetDocs';
import type { LeaveRequest } from '@/types/leave';

const COL = 'leave_requests';

type DocRow = { id: string; [key: string]: unknown };

function mapLeaveRows(rows: DocRow[]): LeaveRequest[] {
  return rows as unknown as LeaveRequest[];
}

const myStores = new Map<string, ReturnType<typeof createSharedStore<LeaveRequest[]>>>();
const approverStores = new Map<string, ReturnType<typeof createSharedStore<LeaveRequest[]>>>();

export function getMyLeaveRequestsStore(userId: string) {
  let store = myStores.get(userId);
  if (!store) {
    let cached: LeaveRequest[] = [];
    store = createSharedStore<LeaveRequest[]>(
      (emit) => {
        const q = query(
          collection(db, COL),
          where('requesterId', '==', userId),
          orderBy('createdAt', 'desc'),
        );
        return listenQueryWithGetDocs(
          q,
          mapLeaveRows,
          (items) => {
            cached = items;
            emit(items);
          },
          cached,
          `leaveRequests:my:${userId}`,
        );
      },
      cached,
    );
    myStores.set(userId, store);
  }
  return store;
}

export function getApproverLeaveRequestsStore(approverId: string) {
  let store = approverStores.get(approverId);
  if (!store) {
    let cached: LeaveRequest[] = [];
    store = createSharedStore<LeaveRequest[]>(
      (emit) => {
        const q = query(
          collection(db, COL),
          where('approverId', '==', approverId),
          orderBy('createdAt', 'desc'),
        );
        return listenQueryWithGetDocs(
          q,
          mapLeaveRows,
          (items) => {
            cached = items;
            emit(items);
          },
          cached,
          `leaveRequests:approver:${approverId}`,
        );
      },
      cached,
    );
    approverStores.set(approverId, store);
  }
  return store;
}

const sinceStores = new Map<string, ReturnType<typeof createSharedStore<LeaveRequest[]>>>();
const studentSinceStores = new Map<string, ReturnType<typeof createSharedStore<LeaveRequest[]>>>();

/** Student leave with endDate on/after sinceDate — replaces full student collection listener. */
export function getStudentLeaveRequestsSinceStore(sinceDate: string) {
  let store = studentSinceStores.get(sinceDate);
  if (!store) {
    let cached: LeaveRequest[] = [];
    store = createSharedStore<LeaveRequest[]>(
      (emit) => {
        const q = query(
          collection(db, COL),
          where('requesterType', '==', 'student'),
          where('endDate', '>=', sinceDate),
        );
        return listenQueryWithGetDocs(
          q,
          mapLeaveRows,
          (items) => {
            cached = items;
            emit(items);
          },
          cached,
          `leaveRequests:student:since:${sinceDate}`,
        );
      },
      cached,
    );
    studentSinceStores.set(sinceDate, store);
  }
  return store;
}

/** Leave requests with endDate on/after sinceDate — lighter than full collection for Home widgets. */
export function getLeaveRequestsSinceStore(sinceDate: string) {
  let store = sinceStores.get(sinceDate);
  if (!store) {
    let cached: LeaveRequest[] = [];
    store = createSharedStore<LeaveRequest[]>(
      (emit) => {
        const q = query(collection(db, COL), where('endDate', '>=', sinceDate));
        return listenQueryWithGetDocs(
          q,
          mapLeaveRows,
          (items) => {
            cached = items;
            emit(items);
          },
          cached,
          `leaveRequests:since:${sinceDate}`,
        );
      },
      cached,
    );
    sinceStores.set(sinceDate, store);
  }
  return store;
}
