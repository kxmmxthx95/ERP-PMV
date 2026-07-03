import {
  fetchStaffAttendanceRecordsForUser,
  resolveStaffAttendanceDisplay,
  timestampToLocalDate,
  type AttendanceStatus,
} from '@/hooks/useStaffAttendance';

export type CheckInHistoryStatus = AttendanceStatus | 'leave' | 'pending';

export type CheckInHistoryRow = {
  date: string;
  status: CheckInHistoryStatus;
  checkInLabel: string;
  checkOutLabel: string;
  note?: string;
};

function formatTime(ts: unknown): string {
  if (!ts) return '—';
  const d = timestampToLocalDate(ts as Parameters<typeof timestampToLocalDate>[0]);
  if (!d) return '—';
  return d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
}

export async function loadStaffCheckInHistory(
  userId: string,
  from: string,
  to: string,
  leaveDates: Set<string>,
  isSpecialTeacher = false,
): Promise<CheckInHistoryRow[]> {
  if (!userId) return [];

  const entries = await fetchStaffAttendanceRecordsForUser(userId);
  const inRange = entries.filter((entry) => entry.date >= from && entry.date <= to);
  const rows: CheckInHistoryRow[] = [];
  const seenDates = new Set<string>();

  for (const entry of inRange) {
    seenDates.add(entry.date);
    const resolved = resolveStaffAttendanceDisplay(entry, {
      selectedDate: entry.date,
      isWorkingDay: true,
      isSpecialTeacher,
    });

    rows.push({
      date: entry.date,
      status: resolved.isPending ? 'pending' : resolved.status,
      checkInLabel: formatTime(entry.checkInTime),
      checkOutLabel: formatTime(entry.checkOutTime),
      note: resolved.note || entry.note,
    });
  }

  leaveDates.forEach((date) => {
    if (date < from || date > to || seenDates.has(date)) return;
    rows.push({
      date,
      status: 'leave',
      checkInLabel: '—',
      checkOutLabel: '—',
    });
    seenDates.add(date);
  });

  return rows.sort((a, b) => b.date.localeCompare(a.date));
}

export function summarizeCheckInHistory(rows: CheckInHistoryRow[]) {
  const counted = rows.filter((row) => row.status !== 'pending');
  return {
    present: counted.filter((row) => row.status === 'present').length,
    late: counted.filter((row) => row.status === 'late').length,
    absent: counted.filter((row) => row.status === 'absent').length,
    leave: counted.filter((row) => row.status === 'leave').length,
    total: counted.length,
  };
}
