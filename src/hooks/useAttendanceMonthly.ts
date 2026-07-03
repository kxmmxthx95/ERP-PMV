import { useState, useCallback } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { loadStaffAttendanceDaysEntries } from '@/lib/firestoreShared/staffAttendanceDayEntriesStore';
import { waitStaffUsersStore } from '@/lib/firestoreShared/staffUsersStore';
import type { StaffAttendanceRecord } from './useStaffAttendance';

export interface StaffMonthlySummary {
  userId: string;
  displayName: string;
  department?: string;
  photoURL?: string;
  present: number;
  late: number;
  absent: number;
  leave: number;
  total: number;          // working days in range
  attendanceRate: number; // (present+late) / total * 100
}

export interface DailyAggregate {
  date: string;
  present: number;
  late: number;
  absent: number;
  leave: number;
  total: number;
}

export interface AttendanceMonthlyData {
  staffSummaries: StaffMonthlySummary[];
  dailyAggregates: DailyAggregate[];
  dateRange: { from: string; to: string };
  loading: boolean;
  fetch: (from: string, to: string, leaveMap?: Map<string, Set<string>>, force?: boolean) => Promise<void>;
}

function getDatesInRange(from: string, to: string): string[] {
  const dates: string[] = [];
  const cur = new Date(`${from}T12:00:00`);
  const end = new Date(`${to}T12:00:00`);
  while (cur <= end) {
    const d = cur.toISOString().slice(0, 10);
    const day = cur.getDay();
    if (day !== 0 && day !== 6) dates.push(d);
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

function entriesToRecords(
  date: string,
  entries: { userId: string; status: string; displayName?: string; photoURL?: string }[],
): StaffAttendanceRecord[] {
  return entries.map((entry) => ({
    id: entry.userId,
    userId: entry.userId,
    date,
    displayName: entry.displayName ?? '',
    status: entry.status as StaffAttendanceRecord['status'],
    checkInTime: null,
    checkOutTime: null,
    photoURL: entry.photoURL,
  }));
}

export function useAttendanceMonthly(): AttendanceMonthlyData {
  const today = new Date();
  const defaultFrom = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
  const defaultTo = today.toISOString().slice(0, 10);

  const [staffSummaries, setStaffSummaries] = useState<StaffMonthlySummary[]>([]);
  const [dailyAggregates, setDailyAggregates] = useState<DailyAggregate[]>([]);
  const [dateRange, setDateRange] = useState({ from: defaultFrom, to: defaultTo });
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async (
    from: string,
    to: string,
    leaveMap: Map<string, Set<string>> = new Map(),
    force = false,
  ) => {
    setLoading(true);
    setDateRange({ from, to });

    try {
      const workingDates = getDatesInRange(from, to);
      const entriesByDate = await loadStaffAttendanceDaysEntries(workingDates, force);
      const allRecords: StaffAttendanceRecord[] = workingDates.flatMap((date) =>
        entriesToRecords(date, entriesByDate[date] ?? []),
      );

      // Fallback: legacy flat collection for the date range (single query)
      try {
        const legacyQ = query(
          collection(db, 'staff_attendance'),
          where('date', '>=', from),
          where('date', '<=', to),
        );
        const legacySnap = await getDocs(legacyQ);
        const legacyIds = new Set(allRecords.map((r) => `${r.userId}_${r.date}`));
        legacySnap.docs.forEach((d) => {
          const rec = { id: d.id, ...(d.data() as Omit<StaffAttendanceRecord, 'id'>) };
          if (!legacyIds.has(`${rec.userId}_${rec.date}`)) allRecords.push(rec);
        });
      } catch { /* ignore */ }

      const staffUsers = await waitStaffUsersStore();
      const profiles: Record<string, { name: string; department?: string; photoURL?: string }> = {};
      staffUsers.forEach((u) => {
        profiles[u.userId] = {
          name: u.displayName,
          department: u.department,
          photoURL: u.photoURL,
        };
      });

      const byUser = new Map<string, { records: StaffAttendanceRecord[]; profile: typeof profiles[string] }>();
      for (const rec of allRecords) {
        if (!byUser.has(rec.userId)) {
          byUser.set(rec.userId, { records: [], profile: profiles[rec.userId] ?? { name: rec.displayName } });
        }
        byUser.get(rec.userId)!.records.push(rec);
      }

      for (const [uid, prof] of Object.entries(profiles)) {
        if (!byUser.has(uid)) byUser.set(uid, { records: [], profile: prof });
      }

      const totalWorkingDays = workingDates.length;

      const summaries: StaffMonthlySummary[] = [];
      for (const [userId, { records, profile }] of byUser) {
        const present = records.filter((r) => r.status === 'present').length;
        const late = records.filter((r) => r.status === 'late').length;
        const absent = records.filter((r) => r.status === 'absent').length;
        const leaveSet = leaveMap.get(userId);
        const leaveCount = leaveSet
          ? workingDates.filter((d) => leaveSet.has(d)).length
          : 0;

        summaries.push({
          userId,
          displayName: profile.name,
          department: profile.department,
          photoURL: profile.photoURL,
          present,
          late,
          absent,
          leave: leaveCount,
          total: totalWorkingDays,
          attendanceRate: totalWorkingDays > 0
            ? Math.round(((present + late) / totalWorkingDays) * 100)
            : 0,
        });
      }

      summaries.sort((a, b) => b.attendanceRate - a.attendanceRate);
      setStaffSummaries(summaries);

      const dailyMap = new Map<string, DailyAggregate>();
      workingDates.forEach((d) => dailyMap.set(d, { date: d, present: 0, late: 0, absent: 0, leave: 0, total: 0 }));
      allRecords.forEach((r) => {
        const agg = dailyMap.get(r.date);
        if (!agg) return;
        if (r.status === 'present') agg.present += 1;
        else if (r.status === 'late') agg.late += 1;
        else agg.absent += 1;
        agg.total += 1;
      });
      setDailyAggregates([...dailyMap.values()].sort((a, b) => a.date.localeCompare(b.date)));
    } catch { /* silently fail */ }

    setLoading(false);
  }, []);

  return { staffSummaries, dailyAggregates, dateRange, loading, fetch };
}
