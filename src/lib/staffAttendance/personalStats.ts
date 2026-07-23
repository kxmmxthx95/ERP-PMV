import {
  fetchStaffAttendanceRecordsForUser,
  resolveStaffAttendanceDisplay,
} from '@/hooks/useStaffAttendance';
import type { LeaveRequest } from '@/types/leave';

export type PersonalStatsSummary = {
  present: number;
  late: number;
  absent: number;
  leave: number;
  total: number;
};

export const EMPTY_PERSONAL_STATS: PersonalStatsSummary = {
  present: 0,
  late: 0,
  absent: 0,
  leave: 0,
  total: 0,
};

export function countApprovedLeaveDays(userId: string, requests: LeaveRequest[]): number {
  let days = 0;
  requests
    .filter((r) => r.requesterId === userId && r.status === 'approved')
    .forEach((r) => {
      const cur = new Date(`${r.startDate}T12:00:00`);
      const end = new Date(`${r.endDate}T12:00:00`);
      while (cur <= end) {
        days += 1;
        cur.setDate(cur.getDate() + 1);
      }
    });
  return days;
}

export async function loadPersonalAttendanceStats(
  userId: string,
  leaveRequests: LeaveRequest[],
  isSpecialTeacher = false,
): Promise<PersonalStatsSummary> {
  if (!userId) return EMPTY_PERSONAL_STATS;

  const entries = await fetchStaffAttendanceRecordsForUser(userId);
  // 7.6 Combine iterations — one pass for present/late/absent
  let present = 0;
  let late = 0;
  let absent = 0;
  for (const entry of entries) {
    const row = resolveStaffAttendanceDisplay(entry, {
      selectedDate: entry.date,
      isWorkingDay: true,
      isSpecialTeacher,
    });
    if (row.isPending) continue;
    if (row.status === 'present') present += 1;
    else if (row.status === 'late') late += 1;
    else if (row.status === 'absent') absent += 1;
  }
  const leave = countApprovedLeaveDays(userId, leaveRequests);

  return {
    present,
    late,
    absent,
    leave,
    total: present + late + absent + leave,
  };
}
