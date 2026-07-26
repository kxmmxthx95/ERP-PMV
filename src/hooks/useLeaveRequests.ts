// src/hooks/useLeaveRequests.ts
import { useCallback, useMemo, useSyncExternalStore } from 'react';
import {
  collection, addDoc, updateDoc, doc, serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { syncStudentLeaveAttendanceById } from '@/lib/attendance/syncStudentLeaveAttendance';
import {
  getApproverLeaveRequestsStore,
  getLeaveRequestsSinceStore,
  getMyLeaveRequestsStore,
  getStudentLeaveRequestsSinceStore,
} from '@/lib/firestoreShared/leaveRequestsStore';
import { createSharedStore } from '@/lib/firestoreShared/createSharedStore';
import type { LeaveRequest, CreateLeaveRequest, LeaveStatus, RequesterType } from '@/types/leave';
import { validateLeaveSubmissionDates } from '@/lib/leave/leaveSubmissionRules';

const COL = 'leave_requests';

type LeaveStore = ReturnType<typeof createSharedStore<LeaveRequest[]>>;

const noopSubscribe = () => () => {};
const EMPTY_LEAVE_REQUESTS: LeaveRequest[] = [];
const emptySnapshot = (): LeaveRequest[] => EMPTY_LEAVE_REQUESTS;
const readySnapshot = () => true;

function useLeaveRequestStore(store: LeaveStore | null) {
  const subscribe = store?.subscribe ?? noopSubscribe;
  const getSnapshot = store ? store.getSnapshot : emptySnapshot;
  const getReady = store ? store.getReady : readySnapshot;

  const requests = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const loading = !useSyncExternalStore(subscribe, getReady, getReady);

  return { requests, loading };
}

// ── Requester hook (student / staff submitting own requests) ──────────────────
export function useMyLeaveRequests(userId: string, requesterType: RequesterType) {
  const store = userId ? getMyLeaveRequestsStore(userId) : null;
  const { requests, loading } = useLeaveRequestStore(store);

  const submit = useCallback(async (
    data: CreateLeaveRequest,
    requesterName: string,
    requesterPhotoUrl: string | null,
    requesterStudentCode: string | null,
    approverId: string,
    approverName: string,
  ) => {
    const validationError = validateLeaveSubmissionDates(data.startDate, data.endDate);
    if (validationError) throw new Error(validationError);

    await addDoc(collection(db, COL), {
      requesterId: userId,
      requesterName,
      requesterStudentCode: requesterStudentCode ?? null,
      requesterPhotoUrl,
      requesterType,
      leaveType: data.leaveType,
      startDate: data.startDate,
      endDate: data.endDate,
      reason: data.reason,
      attachmentUrl: data.attachmentUrl ?? null,
      status: 'pending',
      approverId,
      approverName,
      approverNote: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }, [userId, requesterType]);

  return { requests, loading, submit };
}

// ── Approver hook (teacher / admin reviewing requests) ───────────────────────
export function useApproverLeaveRequests(approverId: string) {
  const store = approverId ? getApproverLeaveRequestsStore(approverId) : null;
  const { requests, loading } = useLeaveRequestStore(store);

  const updateStatus = useCallback(async (
    requestId: string,
    status: LeaveStatus,
    approverNote?: string,
    approverId?: string,
    approverName?: string,
  ) => {
    await updateDoc(doc(db, COL, requestId), {
      status,
      approverNote: approverNote ?? null,
      approverId: approverId ?? null,
      approverName: approverName ?? null,
      updatedAt: serverTimestamp(),
    });
    if (status === 'approved') {
      void syncStudentLeaveAttendanceById(requestId).catch((err) => {
        console.error('[useApproverLeaveRequests] syncStudentLeaveAttendance failed', err);
      });
    }
  }, []);

  return { requests, loading, updateStatus };
}

// ── Teacher hook (student leave requests only) ────────────────────────────────
export function useStudentLeaveRequests(sinceDate: string) {
  const store = useMemo(() => getStudentLeaveRequestsSinceStore(sinceDate), [sinceDate]);
  const { requests, loading } = useLeaveRequestStore(store);

  const updateStatus = useCallback(async (
    requestId: string,
    status: LeaveStatus,
    approverNote?: string,
    approverId?: string,
    approverName?: string,
  ) => {
    await updateDoc(doc(db, COL, requestId), {
      status,
      approverNote: approverNote ?? null,
      approverId: approverId ?? null,
      approverName: approverName ?? null,
      updatedAt: serverTimestamp(),
    });
    if (status === 'approved') {
      void syncStudentLeaveAttendanceById(requestId).catch((err) => {
        console.error('[useStudentLeaveRequests] syncStudentLeaveAttendance failed', err);
      });
    }
  }, []);

  return { requests, loading, updateStatus };
}

/** Recent leave requests only — lighter for Home widgets (endDate >= sinceDate). */
export function useLeaveRequestsSince(sinceDate: string) {
  const store = useMemo(() => getLeaveRequestsSinceStore(sinceDate), [sinceDate]);
  const { requests, loading } = useLeaveRequestStore(store);

  const updateStatus = useCallback(async (
    requestId: string,
    status: LeaveStatus,
    approverNote?: string,
    approverId?: string,
    approverName?: string,
  ) => {
    await updateDoc(doc(db, COL, requestId), {
      status,
      approverNote: approverNote ?? null,
      approverId: approverId ?? null,
      approverName: approverName ?? null,
      updatedAt: serverTimestamp(),
    });
    if (status === 'approved') {
      void syncStudentLeaveAttendanceById(requestId).catch((err) => {
        console.error('[useLeaveRequestsSince] syncStudentLeaveAttendance failed', err);
      });
    }
  }, []);

  return { requests, loading, updateStatus };
}

// ── Helpers ───────────────────────────────────────────────────────────────────
export function countDays(startDate: string, endDate: string): number {
  const ms = new Date(endDate).getTime() - new Date(startDate).getTime();
  return Math.max(1, Math.floor(ms / 86400000) + 1);
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('th-TH', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

export {
  getEarliestLeaveStartDate,
  isSameDayLeaveCutoffPassed,
  LEAVE_SAME_DAY_CUTOFF_MESSAGE,
  validateLeaveSubmissionDates,
} from '@/lib/leave/leaveSubmissionRules';
