// src/types/leave.ts
import type { Timestamp } from 'firebase/firestore';

export type LeaveType = 'sick' | 'personal';
export type LeaveStatus = 'pending' | 'approved' | 'rejected';
export type RequesterType = 'student' | 'staff';

export interface LeaveRequest {
  id: string;
  requesterId: string;
  requesterName: string;
  requesterStudentCode?: string;
  requesterPhotoUrl?: string | null;
  requesterType: RequesterType;
  leaveType: LeaveType;
  startDate: string;       // "YYYY-MM-DD"
  endDate: string;         // "YYYY-MM-DD"
  reason: string;
  attachmentUrl?: string | null;
  status: LeaveStatus;
  approverId: string;
  approverName?: string;
  approverNote?: string;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

export interface CreateLeaveRequest {
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  reason: string;
  attachmentUrl?: string | null;
}
