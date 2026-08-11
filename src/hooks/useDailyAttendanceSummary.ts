// src/hooks/useDailyAttendanceSummary.ts
import { useCallback, useMemo, useState, useSyncExternalStore } from 'react';
import { getLocalDateString } from '@/lib/dateUtils';
import { getLeaveRequestsSinceStore } from '@/lib/firestoreShared/leaveRequestsStore';
import { getStaffAttendanceDaysStore, refreshStaffAttendanceDaysStore } from '@/lib/firestoreShared/staffAttendanceDayEntriesStore';
import { staffUsersStore, type StaffUserRow } from '@/lib/firestoreShared/staffUsersStore';
import { timestampToLocalDate } from '@/hooks/useStaffAttendance';
import type { LeaveRequest } from '@/types/leave';

function formatCheckInLabel(ts: unknown): string | undefined {
  if (!ts) return undefined;
  const d = timestampToLocalDate(ts);
  if (!d) return undefined;
  return d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
}

export interface DailySummary {
  date: string;        // "YYYY-MM-DD"
  present: number;
  late: number;
  absent: number;
  leave: number;
  pending: number;
  total: number;
  presentPct: number;
}

export type DailyStaffStatus = 'present' | 'late' | 'absent' | 'leave' | 'pending';

export interface DailyStaffRow {
  userId: string;
  displayName: string;
  photoURL?: string;
  department?: string;
  status: DailyStaffStatus;
  /** Formatted check-in time e.g. "08:15" when present/late */
  checkInLabel?: string;
}

type AttendanceFetchResult = {
  staffProfiles: StaffUserRow[];
  staffUserIds: Set<string>;
  totalStaffCount: number;
  attendanceByDate: Record<string, { present: number; late: number; absent: number }>;
  entriesByDate: Record<string, Map<string, { status: string; photoURL?: string; displayName?: string; checkInTime?: unknown }>>;
  skeleton: DailySummary[];
};

function buildEmptyDays(days: number): DailySummary[] {
  return Array.from({ length: days }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (days - 1 - i));
    return { date: getLocalDateString(d), present: 0, late: 0, absent: 0, leave: 0, pending: 0, total: 0, presentPct: 0 };
  });
}

function buildSummariesFromData(
  data: AttendanceFetchResult,
  leaveRecords: LeaveRequest[],
): { summaries: DailySummary[]; todayStaff: DailyStaffRow[]; todayTotal: number } {
  const { staffProfiles, staffUserIds, totalStaffCount, attendanceByDate, entriesByDate, skeleton } = data;
  const todayDate = getLocalDateString();

  const filled = skeleton.map((s) => {
    const g = attendanceByDate[s.date] ?? { present: 0, late: 0, absent: 0 };

    const leaveCount = leaveRecords.filter(
      (r) =>
        (r.requesterType !== 'student' || staffUserIds.has(r.requesterId)) &&
        r.status === 'approved' &&
        s.date >= r.startDate &&
        s.date <= r.endDate &&
        staffUserIds.has(r.requesterId),
    ).length;

    const presentAndLate = g.present + g.late;
    const isToday = s.date === todayDate;

    // วันนี้: นับขาดเฉพาะที่บันทึกชัดเจน — คนที่ยังไม่เช็คอยู่ในสถานะรอเช็ก
    const absentCount = isToday
      ? g.absent
      : Math.max(0, totalStaffCount - presentAndLate - leaveCount);
    const pendingCount = isToday
      ? Math.max(0, totalStaffCount - presentAndLate - leaveCount - g.absent)
      : 0;

    return {
      ...s,
      present: g.present,
      late: g.late,
      absent: absentCount,
      leave: leaveCount,
      pending: pendingCount,
      total: totalStaffCount,
      presentPct: totalStaffCount > 0 ? Math.round((presentAndLate / totalStaffCount) * 100) : 0,
    };
  });

  const todayEntries = entriesByDate[todayDate] ?? new Map();
  const staffRows: DailyStaffRow[] = staffProfiles
    .map((staff) => {
      const entry = todayEntries.get(staff.userId);
      if (entry?.status === 'present' || entry?.status === 'late' || entry?.status === 'absent') {
        return {
          userId: staff.userId,
          displayName: entry.displayName || staff.displayName,
          photoURL: entry.photoURL || staff.photoURL,
          department: staff.department,
          status: entry.status as DailyStaffStatus,
          checkInLabel: formatCheckInLabel(entry.checkInTime),
        };
      }

      const onLeave = leaveRecords.some(
        (r) =>
          r.requesterId === staff.userId &&
          r.status === 'approved' &&
          todayDate >= r.startDate &&
          todayDate <= r.endDate,
      );
      if (onLeave) {
        return { ...staff, status: 'leave' as const };
      }

      return {
        ...staff,
        status: 'pending' as const,
      };
    })
    .sort((a, b) => a.displayName.localeCompare(b.displayName, 'th'));

  return { summaries: filled, todayStaff: staffRows, todayTotal: totalStaffCount };
}

function buildDayAttendanceMaps(
  dates: string[],
  rawEntriesByDate: Record<string, { userId: string; status: string; photoURL?: string; displayName?: string; checkInTime?: unknown }[]>,
  staffUserIds: Set<string>,
) {
  const attendanceByDate: Record<string, { present: number; late: number; absent: number }> = {};
  const entriesByDate: Record<
    string,
    Map<string, { status: string; photoURL?: string; displayName?: string; checkInTime?: unknown }>
  > = {};

  dates.forEach((date) => {
    const counts = { present: 0, late: 0, absent: 0 };
    const byUser = new Map<string, { status: string; photoURL?: string; displayName?: string; checkInTime?: unknown }>();

    (rawEntriesByDate[date] ?? []).forEach((entry) => {
      if (!staffUserIds.has(entry.userId)) return;
      byUser.set(entry.userId, {
        status: entry.status,
        photoURL: entry.photoURL,
        displayName: entry.displayName,
        checkInTime: entry.checkInTime,
      });
      if (entry.status === 'present') counts.present += 1;
      else if (entry.status === 'late') counts.late += 1;
      else if (entry.status === 'absent') counts.absent += 1;
    });

    attendanceByDate[date] = counts;
    entriesByDate[date] = byUser;
  });

  return { attendanceByDate, entriesByDate };
}

export function useDailyAttendanceSummary(days = 7) {
  const [refreshNonce, setRefreshNonce] = useState(0);

  const skeleton = useMemo(() => buildEmptyDays(days), [days]);
  const dates = useMemo(() => skeleton.map((s) => s.date), [skeleton]);
  const datesKey = useMemo(() => dates.join('|'), [dates]);

  const dayEntriesStore = useMemo(
    () => getStaffAttendanceDaysStore(dates, refreshNonce),
    [datesKey, refreshNonce],
  );

  const rawEntriesByDate = useSyncExternalStore(
    dayEntriesStore.subscribe,
    dayEntriesStore.getSnapshot,
    dayEntriesStore.getSnapshot,
  );

  const staffProfiles = useSyncExternalStore(
    staffUsersStore.subscribe,
    staffUsersStore.getSnapshot,
    staffUsersStore.getSnapshot,
  );
  const staffReady = useSyncExternalStore(
    staffUsersStore.subscribe,
    staffUsersStore.getReady,
    staffUsersStore.getReady,
  );

  const minLeaveDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - (days - 1));
    return getLocalDateString(d);
  }, [days]);

  const leaveStore = useMemo(() => getLeaveRequestsSinceStore(minLeaveDate), [minLeaveDate]);
  const leaveRecords = useSyncExternalStore(
    leaveStore.subscribe,
    leaveStore.getSnapshot,
    leaveStore.getSnapshot,
  );

  const attendanceLoaded = dates.every((d) => Object.prototype.hasOwnProperty.call(rawEntriesByDate, d));

  const computed = useMemo(() => {
    if (!staffReady || !attendanceLoaded) {
      return {
        summaries: skeleton,
        todayStaff: [] as DailyStaffRow[],
        todayTotal: 0,
      };
    }

    const activeStaffProfiles = staffProfiles.filter((u) => (u.status || 'active') === 'active');
    const staffUserIds = new Set(activeStaffProfiles.map((u) => u.userId));
    const { attendanceByDate, entriesByDate } = buildDayAttendanceMaps(dates, rawEntriesByDate, staffUserIds);

    return buildSummariesFromData(
      {
        staffProfiles: activeStaffProfiles,
        staffUserIds,
        totalStaffCount: activeStaffProfiles.length,
        attendanceByDate,
        entriesByDate,
        skeleton,
      },
      leaveRecords,
    );
  }, [
    staffReady,
    attendanceLoaded,
    staffProfiles,
    rawEntriesByDate,
    dates,
    skeleton,
    leaveRecords,
  ]);

  const refresh = useCallback(() => {
    refreshStaffAttendanceDaysStore(dates, refreshNonce);
    setRefreshNonce((n) => n + 1);
  }, [dates, refreshNonce]);

  const todayDateKey = getLocalDateString();
  const today = computed.summaries.find((s) => s.date === todayDateKey) ?? computed.summaries[computed.summaries.length - 1] ?? null;

  return {
    summaries: computed.summaries,
    today,
    todayDate: todayDateKey,
    todayTotal: computed.todayTotal,
    todayStaff: computed.todayStaff,
    loading: !staffReady || !attendanceLoaded,
    refresh,
  };
};
