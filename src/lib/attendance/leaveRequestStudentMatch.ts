import type { LeaveRequest } from '@/types/leave';
import { studentIdentityKeys, type StudentIdentityFields } from '@/lib/students/studentIdentity';

function normalizeThaiName(value: string): string {
  return value.replace(/\s+/g, '').trim();
}

export function isDateInLeaveRange(date: string, leave: LeaveRequest): boolean {
  return date >= leave.startDate && date <= leave.endDate;
}

export function buildLeaveNote(leave: LeaveRequest): string {
  const label = leave.leaveType === 'sick' ? 'ลาป่วย' : 'ลากิจ';
  return `${label}: ${leave.reason}`;
}

export function findApprovedLeaveForStudentOnDate(
  leaveRequests: LeaveRequest[],
  student: StudentIdentityFields & { prefix?: string; firstName?: string; lastName?: string },
  date: string,
  displayName?: string,
): LeaveRequest | null {
  return leaveRequests.find(
    (leave) =>
      leave.requesterType === 'student' &&
      leave.status === 'approved' &&
      isDateInLeaveRange(date, leave) &&
      leaveRequestMatchesStudent(leave, student, displayName),
  ) ?? null;
}

export function leaveRequestMatchesStudent(
  leave: LeaveRequest,
  student: StudentIdentityFields & { prefix?: string; firstName?: string; lastName?: string },
  displayName?: string,
): boolean {
  if (leave.requesterType !== 'student') return false;

  const requesterId = leave.requesterId.trim();
  if (requesterId && studentIdentityKeys(student).has(requesterId)) return true;

  const leaveCode = leave.requesterStudentCode?.trim();
  const studentCode = student.studentCode?.trim();
  if (leaveCode && studentCode && leaveCode === studentCode) return true;

  const leaveName = normalizeThaiName(leave.requesterName ?? '');
  if (!leaveName) return false;

  const fullName = normalizeThaiName(
    `${student.prefix ?? ''}${student.firstName ?? ''}${student.lastName ?? ''}`,
  );
  if (leaveName === fullName) return true;
  if (displayName && leaveName === normalizeThaiName(displayName)) return true;
  return false;
}
