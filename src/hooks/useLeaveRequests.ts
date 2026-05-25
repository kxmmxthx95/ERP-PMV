// src/hooks/useLeaveRequests.ts
import { useState, useEffect, useCallback } from 'react';
import {
  collection, addDoc, updateDoc, doc, query,
  where, orderBy, serverTimestamp, onSnapshot
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { LeaveRequest, CreateLeaveRequest, LeaveStatus, RequesterType } from '@/types/leave';

const COL = 'leave_requests';

// ── Requester hook (student / staff submitting own requests) ──────────────────
export function useMyLeaveRequests(userId: string, requesterType: RequesterType) {
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, COL),
      where('requesterId', '==', userId),
      orderBy('createdAt', 'desc'),
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      setRequests(snap.docs.map(d => ({ id: d.id, ...d.data() } as LeaveRequest)));
      setLoading(false);
    }, (err) => {
      console.error("Error in useMyLeaveRequests:", err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userId]);

  const submit = useCallback(async (
    data: CreateLeaveRequest,
    requesterName: string,
    requesterPhotoUrl: string | null,
    requesterStudentCode: string | null,
    approverId: string,
    approverName: string,
  ) => {
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
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!approverId) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, COL),
      where('approverId', '==', approverId),
      orderBy('createdAt', 'desc'),
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      setRequests(snap.docs.map(d => ({ id: d.id, ...d.data() } as LeaveRequest)));
      setLoading(false);
    }, (err) => {
      console.error("Error in useApproverLeaveRequests:", err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [approverId]);

  const updateStatus = useCallback(async (
    requestId: string,
    status: LeaveStatus,
    approverNote?: string,
  ) => {
    await updateDoc(doc(db, COL, requestId), {
      status,
      approverNote: approverNote ?? null,
      updatedAt: serverTimestamp(),
    });
  }, []);

  return { requests, loading, updateStatus };
}

// ── Teacher hook (student leave requests only) ────────────────────────────────
export function useStudentLeaveRequests() {
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, COL),
      where('requesterType', '==', 'student'),
      orderBy('createdAt', 'desc'),
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      setRequests(snap.docs.map(d => ({ id: d.id, ...d.data() } as LeaveRequest)));
      setLoading(false);
    }, (err) => {
      console.error("Error in useStudentLeaveRequests:", err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const updateStatus = useCallback(async (
    requestId: string,
    status: LeaveStatus,
    approverNote?: string,
  ) => {
    await updateDoc(doc(db, COL, requestId), {
      status,
      approverNote: approverNote ?? null,
      updatedAt: serverTimestamp(),
    });
  }, []);

  return { requests, loading, updateStatus };
}

// ── Admin hook (all requests) ─────────────────────────────────────────────────
export function useAllLeaveRequests() {
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, COL), orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snap) => {
      setRequests(snap.docs.map(d => ({ id: d.id, ...d.data() } as LeaveRequest)));
      setLoading(false);
    }, (err) => {
      console.error("Error in useAllLeaveRequests:", err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const updateStatus = useCallback(async (
    requestId: string,
    status: LeaveStatus,
    approverNote?: string,
  ) => {
    await updateDoc(doc(db, COL, requestId), {
      status,
      approverNote: approverNote ?? null,
      updatedAt: serverTimestamp(),
    });
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
