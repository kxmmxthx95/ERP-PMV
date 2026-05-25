// src/hooks/useDailyAttendanceSummary.ts
import { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface DailySummary {
  date: string;        // "YYYY-MM-DD"
  present: number;
  late: number;
  absent: number;
  leave: number;
  total: number;
  presentPct: number;
}

function toDateStr(d: Date) {
  return d.toISOString().slice(0, 10);
}

function buildEmptyDays(days: number): DailySummary[] {
  return Array.from({ length: days }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (days - 1 - i));
    return { date: toDateStr(d), present: 0, late: 0, absent: 0, leave: 0, total: 0, presentPct: 0 };
  });
}

export function useDailyAttendanceSummary(days = 7) {
  const [summaries, setSummaries] = useState<DailySummary[]>([]);
  const [loading, setLoading]   = useState(true);
  const [todayTotal, setTodayTotal] = useState(0);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Get all staff users to determine the "Total" denominator
      const usersSnap = await getDocs(collection(db, 'users'));
      const staffUsers = usersSnap.docs.filter(d => {
        const role = d.data().role;
        return role && !['student', 'parent', 'admin', 'sysadmin'].includes(role);
      });
      const totalStaffCount = staffUsers.length;
      const staffUserIds = new Set(staffUsers.map(u => u.id));

      // 2. Prepare date range
      const skeleton = buildEmptyDays(days);
      const dates = skeleton.map(s => s.date);
      const minDate = dates[0];

      // 3. Fetch Leave Requests (for the date range)
      // Only fetch records that haven't ended before our range starts
      const leaveQ = query(
        collection(db, 'leave_requests'),
        where('endDate', '>=', minDate)
      );
      const leaveSnap = await getDocs(leaveQ);
      const leaveRecords = leaveSnap.docs.map(d => d.data());

      // 4. Fetch Attendance for each day (New Schema)
      const attendanceByDate: Record<string, { present: number; late: number; absent: number }> = {};
      
      await Promise.all(dates.map(async (date) => {
        const entriesSnap = await getDocs(collection(db, 'staff_attendance_by_date', date, 'entries'));
        const counts = { present: 0, late: 0, absent: 0 };
        entriesSnap.forEach(d => {
          const data = d.data();
          if (!staffUserIds.has(data.userId)) return; // Only count staff
          if (data.status === 'present') counts.present++;
          else if (data.status === 'late') counts.late++;
          else if (data.status === 'absent') counts.absent++;
        });
        attendanceByDate[date] = counts;
      }));

      // 5. Build final summaries
      const filled = skeleton.map(s => {
        const g = attendanceByDate[s.date] ?? { present: 0, late: 0, absent: 0 };
        
        // Calculate Leave for this date
        const leaveCount = leaveRecords.filter(r => 
          (r.requesterType !== 'student' || staffUserIds.has(r.requesterId)) &&
          r.status === 'approved' &&
          s.date >= r.startDate &&
          s.date <= r.endDate &&
          staffUserIds.has(r.requesterId)
        ).length;

        const presentAndLate = g.present + g.late;
        const absentCount = Math.max(0, totalStaffCount - presentAndLate - leaveCount);

        return {
          ...s,
          present: g.present,
          late: g.late,
          absent: absentCount,
          leave: leaveCount,
          total: totalStaffCount,
          presentPct: totalStaffCount > 0 ? Math.round((presentAndLate / totalStaffCount) * 100) : 0,
        };
      });

      setSummaries(filled);
      setTodayTotal(totalStaffCount);
    } catch (error) {
      console.error('[useDailyAttendanceSummary] error:', error);
      setSummaries(buildEmptyDays(days));
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { fetch(); }, [fetch]);

  const today = summaries[summaries.length - 1] ?? null;

  return { summaries, today, todayTotal, loading, refresh: fetch };
}
