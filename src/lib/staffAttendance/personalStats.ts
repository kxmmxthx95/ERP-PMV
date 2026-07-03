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
  const resolved = entries.map((entry) =>
    resolveStaffAttendanceDisplay(entry, {
      selectedDate: entry.date,
      isWorkingDay: true,
      isSpecialTeacher,
    }),
  );
  const counted = resolved.filter((row) => !row.isPending);
  const present = counted.filter((row) => row.status === 'present').length;
  const late = counted.filter((row) => row.status === 'late').length;
  const absent = counted.filter((row) => row.status === 'absent').length;
  const leave = countApprovedLeaveDays(userId, leaveRequests);

  return {
    present,
    late,
    absent,
    leave,
    total: present + late + absent + leave,
  };
}
