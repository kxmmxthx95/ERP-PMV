import { useState, useEffect, useCallback } from 'react';
import {
  collection, doc, getDoc, getDocs, query,
  where, Timestamp, serverTimestamp, writeBatch,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { AttendanceConfig } from './useAttendanceConfig';
import { DEFAULT_CONFIG } from './useAttendanceConfig';
import type { CalendarEvent } from '@/types/calendar';

// ── Haversine distance (meters) ──────────────────────────────────────────────
export function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function isInsideSchool(lat: number, lng: number, cfg: AttendanceConfig = DEFAULT_CONFIG): boolean {
  return haversineDistance(lat, lng, cfg.lat, cfg.lng) <= cfg.radiusMeters;
}

// ── Types ─────────────────────────────────────────────────────────────────────
export type AttendanceStatus = 'present' | 'late' | 'absent';

export interface StaffAttendanceRecord {
  id: string;
  userId: string;
  displayName: string;
  date: string;          // "YYYY-MM-DD"
  checkInTime: Timestamp | null;
  checkOutTime: Timestamp | null;
  status: AttendanceStatus;
  lat?: number;
  lng?: number;
  photoURL?: string;
  department?: string;
  note?: string;
  overrideBy?: string;   // admin uid
}

function makeStaffAttendanceDocId(userId: string, date: string): string {
  return `${userId}_${date}`;
}

function getStaffAttendanceDayDocRef(date: string) {
  return doc(db, 'staff_attendance_by_date', date);
}

function getStaffAttendanceEntryRef(date: string, userId: string) {
  return doc(db, 'staff_attendance_by_date', date, 'entries', userId);
}

function toMillis(ts: Timestamp | null | undefined): number {
  if (!ts) return 0;
  return ts.toMillis();
}

function scoreRecord(record: StaffAttendanceRecord): number {
  let score = 0;
  if (record.checkInTime) score += 1;
  if (record.checkOutTime) score += 2;
  if (typeof record.status === 'string' && record.status.length > 0) score += 1;
  if (typeof record.note === 'string' && record.note.length > 0) score += 1;
  return score;
}

function pickPrimaryRecord(
  left: StaffAttendanceRecord,
  right: StaffAttendanceRecord,
): StaffAttendanceRecord {
  const leftScore = scoreRecord(left);
  const rightScore = scoreRecord(right);
  if (leftScore !== rightScore) return leftScore > rightScore ? left : right;

  const leftLastTs = Math.max(toMillis(left.checkOutTime), toMillis(left.checkInTime));
  const rightLastTs = Math.max(toMillis(right.checkOutTime), toMillis(right.checkInTime));
  return leftLastTs >= rightLastTs ? left : right;
}

function mergeAttendanceRecords(
  records: StaffAttendanceRecord[],
  forcedId?: string,
): StaffAttendanceRecord {
  const primary = records.reduce((acc, cur) => pickPrimaryRecord(acc, cur));
  const checkInCandidates = records
    .map((r) => r.checkInTime)
    .filter((ts): ts is Timestamp => Boolean(ts));
  const checkOutCandidates = records
    .map((r) => r.checkOutTime)
    .filter((ts): ts is Timestamp => Boolean(ts));

  const earliestCheckIn = checkInCandidates.length > 0
    ? checkInCandidates.reduce((acc, cur) => (toMillis(cur) < toMillis(acc) ? cur : acc))
    : null;
  const latestCheckOut = checkOutCandidates.length > 0
    ? checkOutCandidates.reduce((acc, cur) => (toMillis(cur) > toMillis(acc) ? cur : acc))
    : null;

  return {
    ...primary,
    id: forcedId ?? primary.id,
    checkInTime: earliestCheckIn,
    checkOutTime: latestCheckOut,
  };
}

function getErrorMessage(error: unknown, fallback = 'เกิดข้อผิดพลาด'): string {
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return fallback;
}

function getErrorCode(error: unknown): number | null {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === 'number' ? code : null;
  }
  return null;
}

function toWritableRecord(
  record: StaffAttendanceRecord,
): Omit<StaffAttendanceRecord, 'id'> {
  const payload: Omit<StaffAttendanceRecord, 'id'> = {
    userId: record.userId,
    displayName: record.displayName,
    date: record.date,
    checkInTime: record.checkInTime ?? null,
    checkOutTime: record.checkOutTime ?? null,
    status: record.status,
  };

  if (typeof record.lat === 'number') payload.lat = record.lat;
  if (typeof record.lng === 'number') payload.lng = record.lng;
  if (typeof record.photoURL === 'string') payload.photoURL = record.photoURL;
  if (typeof record.department === 'string') payload.department = record.department;
  if (typeof record.note === 'string') payload.note = record.note;
  if (typeof record.overrideBy === 'string') payload.overrideBy = record.overrideBy;

  return payload;
}

async function getLegacyRecordsForUserDate(
  userId: string,
  date: string,
): Promise<StaffAttendanceRecord[]> {
  const byId = new Map<string, StaffAttendanceRecord>();

  const deterministicId = makeStaffAttendanceDocId(userId, date);
  const deterministicRef = doc(db, 'staff_attendance', deterministicId);
  const deterministicSnap = await getDoc(deterministicRef);
  if (deterministicSnap.exists()) {
    byId.set(deterministicSnap.id, {
      id: deterministicSnap.id,
      ...(deterministicSnap.data() as Omit<StaffAttendanceRecord, 'id'>),
    });
  }

  const q = query(
    collection(db, 'staff_attendance'),
    where('userId', '==', userId),
    where('date', '==', date),
  );
  const snap = await getDocs(q);
  snap.docs.forEach((d) => {
    byId.set(d.id, {
      id: d.id,
      ...(d.data() as Omit<StaffAttendanceRecord, 'id'>),
    });
  });

  return Array.from(byId.values());
}

async function migrateLegacyUserDateToNewSchema(
  bestRecord: StaffAttendanceRecord,
  legacyRecordIds: string[],
) {
  const dayRef = getStaffAttendanceDayDocRef(bestRecord.date);
  const entryRef = getStaffAttendanceEntryRef(bestRecord.date, bestRecord.userId);
  const batch = writeBatch(db);

  batch.set(dayRef, {
    date: bestRecord.date,
    updatedAt: serverTimestamp(),
  }, { merge: true });

  batch.set(entryRef, {
    ...toWritableRecord(bestRecord),
    migratedFromLegacyAt: serverTimestamp(),
    migratedFromLegacyDocIds: legacyRecordIds,
  }, { merge: true });

  legacyRecordIds.forEach((id) => {
    batch.delete(doc(db, 'staff_attendance', id));
  });

  await batch.commit();
}

async function migrateLegacyDateRecordsToNewSchema(
  date: string,
  legacyRecords: StaffAttendanceRecord[],
) {
  if (legacyRecords.length === 0) return;

  const grouped = new Map<string, StaffAttendanceRecord[]>();
  legacyRecords.forEach((record) => {
    const arr = grouped.get(record.userId) ?? [];
    arr.push(record);
    grouped.set(record.userId, arr);
  });

  const batch = writeBatch(db);
  const dayRef = getStaffAttendanceDayDocRef(date);
  batch.set(dayRef, {
    date,
    updatedAt: serverTimestamp(),
  }, { merge: true });

  grouped.forEach((recordsByUser, targetUserId) => {
    const bestRecord = mergeAttendanceRecords(recordsByUser, targetUserId);
    const entryRef = getStaffAttendanceEntryRef(date, targetUserId);
    batch.set(entryRef, {
      ...toWritableRecord(bestRecord),
      migratedFromLegacyAt: serverTimestamp(),
      migratedFromLegacyDocIds: recordsByUser.map((r) => r.id),
    }, { merge: true });
  });

  legacyRecords.forEach((record) => {
    batch.delete(doc(db, 'staff_attendance', record.id));
  });

  await batch.commit();
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useStaffAttendance(
  userId: string,
  displayName: string,
  config: AttendanceConfig = DEFAULT_CONFIG,
  extraHolidays: CalendarEvent[] = [],
) {
  const [todayRecord, setTodayRecord] = useState<StaffAttendanceRecord | null>(null);
  const [history, setHistory] = useState<StaffAttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isHoliday, setIsHoliday] = useState(false);
  const [holidayTitle, setHolidayTitle] = useState<string | null>(null);

  const todayStr = new Date().toISOString().slice(0, 10);

  const checkHoliday = useCallback(async () => {
    const now = new Date();
    const day = now.getDay();
    if (day === 0 || day === 6) {
      setIsHoliday(true);
      setHolidayTitle(day === 0 ? 'วันอาทิตย์' : 'วันเสาร์');
      return;
    }

    try {
      // Check extra holidays (from Google Calendar API, etc.)
      const extraMatch = extraHolidays.find(h =>
        h.type === 'holiday' && todayStr >= h.startDate && todayStr <= h.endDate
      );
      if (extraMatch) {
        setIsHoliday(true);
        setHolidayTitle(extraMatch.title);
        return;
      }

      // Check Firestore calendar_events
      const holidayQuery = query(
        collection(db, 'calendar_events'),
        where('type', '==', 'holiday'),
      );
      const holidaySnap = await getDocs(holidayQuery);
      const holidayDoc = holidaySnap.docs.find((d) => {
        const data = d.data() as { startDate?: string; endDate?: string };
        return typeof data.startDate === 'string'
          && typeof data.endDate === 'string'
          && todayStr >= data.startDate
          && todayStr <= data.endDate;
      });

      if (holidayDoc) {
        const data = holidayDoc.data() as { title?: string };
        setIsHoliday(true);
        setHolidayTitle(data.title || 'วันหยุด');
      } else {
        setIsHoliday(false);
        setHolidayTitle(null);
      }
    } catch {
      setIsHoliday(false);
      setHolidayTitle(null);
    }
  }, [todayStr, extraHolidays]);

  const fetchToday = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const entryRef = getStaffAttendanceEntryRef(todayStr, userId);
      const entrySnap = await getDoc(entryRef);
      if (entrySnap.exists()) {
        setTodayRecord({
          id: entrySnap.id,
          ...(entrySnap.data() as Omit<StaffAttendanceRecord, 'id'>),
        });
        return;
      }

      const legacyRecords = await getLegacyRecordsForUserDate(userId, todayStr);
      if (legacyRecords.length === 0) {
        setTodayRecord(null);
        return;
      }

      const bestLegacy = mergeAttendanceRecords(legacyRecords, userId);
      await migrateLegacyUserDateToNewSchema(bestLegacy, legacyRecords.map((r) => r.id));
      setTodayRecord({
        ...bestLegacy,
        id: userId,
      });
    } catch (e: unknown) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [userId, todayStr]);

  const fetchHistory = useCallback(async () => {
    if (!userId) return;
    try {
      const dates: string[] = [];
      for (let i = 0; i < 7; i += 1) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        dates.push(d.toISOString().slice(0, 10));
      }

      const historyRecords: StaffAttendanceRecord[] = [];
      for (const date of dates) {
        const entryRef = getStaffAttendanceEntryRef(date, userId);
        const entrySnap = await getDoc(entryRef);
        if (entrySnap.exists()) {
          historyRecords.push({
            id: entrySnap.id,
            ...(entrySnap.data() as Omit<StaffAttendanceRecord, 'id'>),
          });
          continue;
        }

        const legacyRecords = await getLegacyRecordsForUserDate(userId, date);
        if (legacyRecords.length > 0) {
          const bestLegacy = mergeAttendanceRecords(legacyRecords, userId);
          await migrateLegacyUserDateToNewSchema(bestLegacy, legacyRecords.map((r) => r.id));
          historyRecords.push({
            ...bestLegacy,
            id: userId,
          });
        }
      }

      historyRecords.sort((a, b) => b.date.localeCompare(a.date));
      setHistory(historyRecords);
    } catch { /* ignore */ }
  }, [userId]);

  useEffect(() => {
    fetchToday();
    fetchHistory();
    checkHoliday();
  }, [fetchToday, fetchHistory, checkHoliday]);

  const getCurrentPosition = (highAccuracy = true): Promise<GeolocationPosition> =>
    new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, (err) => {
        // Fallback to low accuracy if high accuracy fails
        if (highAccuracy && (err.code === 2 || err.code === 3)) {
          console.warn("Retrying with low accuracy...");
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: false,
            timeout: 10000,
            maximumAge: 30000,
          });
        } else {
          reject(err);
        }
      }, {
        enableHighAccuracy: highAccuracy,
        timeout: 10000,
        maximumAge: 10000,
      });
    });

  const checkIn = useCallback(async () => {
    if (!userId) return;
    setActionLoading(true);
    setError(null);
    try {
      if (todayRecord?.checkInTime) return;

      // Verify holiday status is current before checking in
      if (isHoliday) {
        setError(`วันนี้เป็นวันหยุด (${holidayTitle}) ไม่สามารถลงเวลาทำงานได้`);
        return;
      }

      const pos = await getCurrentPosition();
      const { latitude: lat, longitude: lng } = pos.coords;
      if (!isInsideSchool(lat, lng, config)) {
        const dist = Math.round(haversineDistance(lat, lng, config.lat, config.lng));
        setError(`คุณอยู่นอกพื้นที่โรงเรียน (ห่าง ${dist} เมตร / รัศมี ${config.radiusMeters} เมตร)`);
        return;
      }
      const now = new Date();
      const afterShift =
        now.getHours() > config.shiftStartHour ||
        (now.getHours() === config.shiftStartHour && now.getMinutes() > config.shiftStartMinute);
      const status: AttendanceStatus = afterShift ? 'late' : 'present';

      const dayRef = getStaffAttendanceDayDocRef(todayStr);
      const entryRef = getStaffAttendanceEntryRef(todayStr, userId);
      const existing = await getDoc(entryRef);
      if (existing.exists()) {
        const existingData = existing.data() as Omit<StaffAttendanceRecord, 'id'>;
        if (existingData.checkInTime) {
          setTodayRecord({ id: userId, ...existingData });
          return;
        }
      }

      const batch = writeBatch(db);
      batch.set(dayRef, {
        date: todayStr,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      batch.set(entryRef, {
        userId,
        displayName,
        date: todayStr,
        checkInTime: serverTimestamp(),
        checkOutTime: null,
        status,
        lat,
        lng,
      }, { merge: true });
      await batch.commit();

      setTodayRecord({
        id: userId,
        userId,
        displayName,
        date: todayStr,
        checkInTime: Timestamp.now(),
        checkOutTime: null,
        status,
        lat,
        lng,
      });
    } catch (e: unknown) {
      const code = getErrorCode(e);
      if (code === 1) setError('กรุณาอนุญาตการเข้าถึงพิกัด (Location Permission)');
      else if (code === 2) setError('สัญญาณพิกัดขัดข้อง ไม่สามารถระบุตำแหน่งได้');
      else if (code === 3) setError('ค้นหาตำแหน่งนานเกินไป กรุณาลองใหม่อีกครั้ง');
      else setError(getErrorMessage(e));
    } finally {
      setActionLoading(false);
    }
  }, [userId, displayName, todayStr, config, isHoliday, holidayTitle, todayRecord, extraHolidays]);

  const checkOut = useCallback(async () => {
    if (!todayRecord || !userId) return;
    setActionLoading(true);
    setError(null);
    try {
      if (isHoliday) {
        setError(`วันนี้เป็นวันหยุด (${holidayTitle}) ไม่สามารถลงเวลาทำงานได้`);
        return;
      }

      const dayRef = getStaffAttendanceDayDocRef(todayStr);
      const entryRef = getStaffAttendanceEntryRef(todayStr, userId);
      const entrySnap = await getDoc(entryRef);
      const entryData = entrySnap.exists()
        ? (entrySnap.data() as Partial<Omit<StaffAttendanceRecord, 'id'>>)
        : null;

      if (!entryData?.checkInTime && !entryData?.overrideBy) {
        setError('ไม่พบเวลาเข้าในระบบ กรุณาเช็กอินก่อนเช็กเอาต์');
        return;
      }
      if (entryData.checkOutTime) {
        setTodayRecord(prev => prev ? { ...prev, checkOutTime: entryData.checkOutTime as Timestamp } : prev);
        return;
      }

      const batch = writeBatch(db);
      batch.set(dayRef, {
        date: todayStr,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      batch.set(entryRef, {
        checkOutTime: serverTimestamp(),
      }, { merge: true });
      await batch.commit();
      setTodayRecord(prev => prev ? { ...prev, checkOutTime: Timestamp.now() } : prev);
    } catch (e: unknown) {
      setError(getErrorMessage(e));
    } finally {
      setActionLoading(false);
    }
  }, [todayRecord, userId, todayStr, isHoliday, holidayTitle, extraHolidays]);

  return { todayRecord, history, loading, actionLoading, error, checkIn, checkOut, refresh: fetchToday, isHoliday, holidayTitle };
}

// ── Admin hook: fetch all staff records for a date range ─────────────────────
export function useAdminStaffAttendance(date: string) {
  const [records, setRecords] = useState<StaffAttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch attendance records (new shape: day -> entries)
      const dayEntriesSnap = await getDocs(collection(db, 'staff_attendance_by_date', date, 'entries'));
      let dedupedAttendanceData = dayEntriesSnap.docs.map(d => ({
        id: d.id,
        ...(d.data() as Omit<StaffAttendanceRecord, 'id'>),
      }));

      // 1.1 Also scan legacy flat collection and auto-migrate leftovers
      const legacyQ = query(
        collection(db, 'staff_attendance'),
        where('date', '==', date),
      );
      const legacySnap = await getDocs(legacyQ);
      const legacyData = legacySnap.docs.map(d => ({
        id: d.id,
        ...(d.data() as Omit<StaffAttendanceRecord, 'id'>),
      }));

      if (legacyData.length > 0) {
        await migrateLegacyDateRecordsToNewSchema(date, legacyData);

        const legacyByUser = new Map<string, StaffAttendanceRecord[]>();
        legacyData.forEach((record) => {
          const arr = legacyByUser.get(record.userId) ?? [];
          arr.push(record);
          legacyByUser.set(record.userId, arr);
        });

        const legacyBestByUser = new Map<string, StaffAttendanceRecord>();
        legacyByUser.forEach((recordsByUser, legacyUserId) => {
          legacyBestByUser.set(legacyUserId, mergeAttendanceRecords(recordsByUser, legacyUserId));
        });

        const mergedByUser = new Map<string, StaffAttendanceRecord>();
        dedupedAttendanceData.forEach((record) => mergedByUser.set(record.userId, record));
        legacyBestByUser.forEach((legacyBest, legacyUserId) => {
          const existing = mergedByUser.get(legacyUserId);
          mergedByUser.set(
            legacyUserId,
            existing ? mergeAttendanceRecords([existing, legacyBest], legacyUserId) : {
              ...legacyBest,
              id: legacyUserId,
            },
          );
        });
        dedupedAttendanceData = Array.from(mergedByUser.values());
      }

      // 2. Fetch all user profiles for these records to get real names and photos
      const userIds = [...new Set(dedupedAttendanceData.map(r => r.userId))];
      const profiles: Record<string, { name: string, photoURL?: string, department?: string }> = {};
      
      if (userIds.length > 0) {
        // Fetch users in chunks if many, but for daily view usually one fetch is fine
        // Using getDocs for simplicity here
        const userSnap = await getDocs(collection(db, 'users'));
        userSnap.forEach(d => {
          const u = d.data() as {
            name?: string;
            displayName?: string;
            email?: string;
            photoURL?: string;
            department?: string;
            departmentId?: string;
          };
          profiles[d.id] = { 
            name: u.name || u.displayName || u.email || 'บุคลากร',
            photoURL: u.photoURL,
            department: u.department || u.departmentId
          };
        });
      }

      // 3. Merge profile data into attendance records
      const recs = dedupedAttendanceData.map(r => ({
        ...r,
        displayName: profiles[r.userId]?.name || r.displayName,
        photoURL: profiles[r.userId]?.photoURL,
        department: profiles[r.userId]?.department
      }));

      // sort by checkInTime in JS
      recs.sort((a, b) => {
        const ta = a.checkInTime ? a.checkInTime.toMillis() : 0;
        const tb = b.checkInTime ? b.checkInTime.toMillis() : 0;
        return ta - tb;
      });
      setRecords(recs);
    } catch { /* silently fail */ }
    setLoading(false);
  }, [date]);

  useEffect(() => {
    const id = setTimeout(() => { void fetch(); }, 0);
    return () => clearTimeout(id);
  }, [fetch]);

  const cleanupDuplicates = useCallback(async () => {
    // Consolidate duplicated legacy rows into new schema, then delete all legacy duplicates.
    const q = query(
      collection(db, 'staff_attendance'),
      where('date', '==', date),
    );
    const snap = await getDocs(q);
    const docs = snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<StaffAttendanceRecord, 'id'>) }));

    const grouped = new Map<string, StaffAttendanceRecord[]>();
    docs.forEach((record) => {
      const key = `${record.userId}_${record.date}`;
      const arr = grouped.get(key) ?? [];
      arr.push(record);
      grouped.set(key, arr);
    });

    const BATCH_LIMIT = 450;
    let batch = writeBatch(db);
    let opCount = 0;
    let duplicateGroups = 0;
    let deletedDocs = 0;
    let migratedEntries = 0;

    for (const recordsByUserDate of grouped.values()) {
      if (recordsByUserDate.length <= 1) continue;
      duplicateGroups += 1;

      const userId = recordsByUserDate[0].userId;
      const recordDate = recordsByUserDate[0].date;
      const bestRecord = mergeAttendanceRecords(recordsByUserDate, userId);

      const dayRef = getStaffAttendanceDayDocRef(recordDate);
      const entryRef = getStaffAttendanceEntryRef(recordDate, userId);
      batch.set(dayRef, {
        date: recordDate,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      batch.set(entryRef, {
        ...toWritableRecord(bestRecord),
        migratedFromLegacyAt: serverTimestamp(),
        migratedFromLegacyDocIds: recordsByUserDate.map((r) => r.id),
      }, { merge: true });
      opCount += 2;
      migratedEntries += 1;

      for (const record of recordsByUserDate) {
        batch.delete(doc(db, 'staff_attendance', record.id));
        opCount += 1;
        deletedDocs += 1;
      }

      if (opCount >= BATCH_LIMIT) {
        await batch.commit();
        batch = writeBatch(db);
        opCount = 0;
      }
    }

    if (opCount > 0) {
      await batch.commit();
    }

    await fetch();
    return { duplicateGroups, deletedDocs, migratedEntries, upsertedDeterministicDocs: 0 };
  }, [date, fetch]);

  const override = useCallback(async (
    recordId: string | null,
    targetUserId: string,
    targetName: string,
    status: AttendanceStatus,
    note: string,
    adminUid: string,
  ) => {
    const dayRef = getStaffAttendanceDayDocRef(date);
    const entryRef = getStaffAttendanceEntryRef(date, targetUserId);
    const batch = writeBatch(db);

    batch.set(dayRef, {
      date,
      updatedAt: serverTimestamp(),
    }, { merge: true });

    batch.set(entryRef, {
      userId: targetUserId,
      displayName: targetName,
      date,
      status,
      note,
      overrideBy: adminUid,
      // Keep existing check-in/check-out if exists; otherwise initialize.
      ...(recordId ? {} : { checkInTime: null, checkOutTime: null }),
    }, { merge: true });

    await batch.commit();
    await fetch();
  }, [date, fetch]);

  return { records, loading, refresh: fetch, override, cleanupDuplicates };
}
