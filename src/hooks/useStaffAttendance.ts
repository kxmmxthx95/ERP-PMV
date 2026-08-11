import { useState, useEffect, useCallback, useMemo, useRef, useSyncExternalStore } from 'react';
import {
  collection, collectionGroup, doc, getDoc, getDocs, query,
  where, Timestamp, serverTimestamp, writeBatch,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { AttendanceConfig } from './useAttendanceConfig';
import { DEFAULT_CONFIG } from './useAttendanceConfig';
import type { CalendarEvent } from '@/types/calendar';
import {
  getStaffTodayEntryStore,
  getStaffWeekHistory,
  invalidateStaffWeekHistory,
} from '@/lib/firestoreShared/staffAttendanceStore';
import { loadStaffAttendanceDayDocs } from '@/lib/firestoreShared/staffAttendanceDayEntriesStore';
import { waitStaffUsersStore } from '@/lib/firestoreShared/staffUsersStore';
import { getCalendarEventsStore } from '@/lib/firestoreShared/calendarEventsStore';
import { resolveTodayHoliday } from '@/lib/calendar/schoolDay';

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

function getLocalDateString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** 12:00 น. ขึ้นไป (รวมเที่ยงตรง) */
export function isAtOrAfterNoon(date: Date): boolean {
  return date.getHours() >= 12;
}

/** ถึงเวลาเลิกงาน (shiftEnd) ขึ้นไป — เปิดให้เช็คเอาต์ด้วยมือ */
export function isAtOrAfterShiftEnd(
  date: Date,
  cfg: Pick<AttendanceConfig, 'shiftEndHour' | 'shiftEndMinute'> = DEFAULT_CONFIG,
): boolean {
  const nowMins = date.getHours() * 60 + date.getMinutes();
  return nowMins >= cfg.shiftEndHour * 60 + cfg.shiftEndMinute;
}

export function formatShiftEndLabel(
  cfg: Pick<AttendanceConfig, 'shiftEndHour' | 'shiftEndMinute'> = DEFAULT_CONFIG,
): string {
  return `${String(cfg.shiftEndHour).padStart(2, '0')}:${String(cfg.shiftEndMinute).padStart(2, '0')}`;
}

export function timestampToLocalDate(ts: unknown): Date | null {
  if (ts == null) return null;
  if (ts instanceof Date) return Number.isNaN(ts.getTime()) ? null : ts;
  if (ts instanceof Timestamp) return ts.toDate();
  if (typeof ts === 'object') {
    const obj = ts as { toDate?: () => Date; seconds?: number; nanoseconds?: number };
    if (typeof obj.toDate === 'function') return obj.toDate();
    if (typeof obj.seconds === 'number') {
      return new Date(obj.seconds * 1000 + (obj.nanoseconds ?? 0) / 1_000_000);
    }
  }
  if (typeof ts === 'number' || typeof ts === 'string') {
    const d = new Date(ts);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

export function isTimestampAtOrAfterNoon(ts: unknown): boolean {
  const d = timestampToLocalDate(ts);
  if (!d) return false;
  return isAtOrAfterNoon(d);
}

export interface ResolveStaffAttendanceOptions {
  selectedDate: string;
  isWorkingDay: boolean;
  now?: Date;
  /** ครูพิเศษ — ไม่บังคับเวลาเช็คอิน */
  isSpecialTeacher?: boolean;
}

export interface ResolvedStaffAttendanceDisplay {
  status: AttendanceStatus;
  isAutoAbsent: boolean;
  isPending: boolean;
  note: string;
}

export function resolveStaffAttendanceDisplay(
  record: Pick<StaffAttendanceRecord, 'checkInTime' | 'status' | 'note' | 'overrideBy' | 'date'>,
  opts: ResolveStaffAttendanceOptions,
): ResolvedStaffAttendanceDisplay {
  const todayStr = getLocalDateString();
  const isFutureDate = opts.selectedDate > todayStr;
  const note = record.note ?? '';

  if (isFutureDate) {
    return { status: record.status, isAutoAbsent: false, isPending: true, note };
  }

  if (opts.isSpecialTeacher) {
    if (record.overrideBy) {
      return { status: record.status, isAutoAbsent: false, isPending: false, note };
    }
    if (record.checkInTime) {
      return { status: 'present', isAutoAbsent: false, isPending: false, note };
    }
  }

  // เช็คอินหลัง 12:00 = ขาดงานเสมอ (แม้แอดมิน override สถานะอื่นไว้)
  if (record.checkInTime && isTimestampAtOrAfterNoon(record.checkInTime)) {
    return {
      status: 'absent',
      isAutoAbsent: true,
      isPending: false,
      note: note || 'เช็กอินหลัง 12:00 น.',
    };
  }

  if (record.overrideBy) {
    return { status: record.status, isAutoAbsent: false, isPending: false, note };
  }

  if (record.checkInTime) {
    return { status: record.status, isAutoAbsent: false, isPending: false, note };
  }

  // วันหยุด (เสาร์-อาทิตย์ หรือวันหยุดนักขัตฤกษ์) ในอดีต/ปัจจุบัน
  if (!opts.isWorkingDay) {
    return { status: record.status, isAutoAbsent: false, isPending: false, note };
  }

  // ถ้าไม่มีการเช็กอินเข้างานในวันทำงาน (อดีต หรือ วันปัจจุบัน)
  return {
    status: 'absent',
    isAutoAbsent: true,
    isPending: false,
    note: note || 'ไม่มีการเช็กอินเข้างาน',
  };
}

function getStaffAttendanceDayDocRef(date: string) {
  return doc(db, 'staff_attendance_by_date', date);
}

function getStaffAttendanceEntryRef(date: string, userId: string) {
  return doc(db, 'staff_attendance_by_date', date, 'entries', userId);
}

function getCutoffDateTime(date: string, hour = 18, minute = 0): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1, hour, minute, 0, 0);
}

function shouldAutoCheckout(record: Pick<StaffAttendanceRecord, 'checkInTime' | 'checkOutTime' | 'date'>, now = new Date()): boolean {
  if (!record.checkInTime || record.checkOutTime) return false;
  const cutoff = getCutoffDateTime(record.date, 18, 0);
  return now.getTime() >= cutoff.getTime();
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

/** ดึงประวัติเข้างานทั้งหมดของบุคลากร (new schema + legacy) */
export async function fetchStaffAttendanceRecordsForUser(userId: string): Promise<StaffAttendanceRecord[]> {
  const byDate = new Map<string, StaffAttendanceRecord>();

  const addRecord = (record: StaffAttendanceRecord) => {
    if (!record.date) return;
    byDate.set(record.date, record);
  };

  const groupQ = query(collectionGroup(db, 'entries'), where('userId', '==', userId));
  const legacyQ = query(collection(db, 'staff_attendance'), where('userId', '==', userId));
  // 1.5 Promise.all — new schema + legacy in parallel
  const [groupResult, legacyResult] = await Promise.allSettled([
    getDocs(groupQ),
    getDocs(legacyQ),
  ]);

  if (groupResult.status === 'fulfilled') {
    groupResult.value.docs.forEach((d) => {
      if (d.ref.parent.parent?.parent?.id !== 'staff_attendance_by_date') return;
      const parentDate = d.ref.parent.parent?.id ?? '';
      const data = d.data() as Omit<StaffAttendanceRecord, 'id'>;
      addRecord({
        ...data,
        id: d.id,
        userId: data.userId || d.id,
        date: data.date || parentDate,
      });
    });
  } else {
    console.warn('[fetchStaffAttendanceRecordsForUser] collectionGroup failed, falling back to legacy only', groupResult.reason);
  }

  if (legacyResult.status === 'fulfilled') {
    legacyResult.value.docs.forEach((d) => {
      const data = d.data() as Omit<StaffAttendanceRecord, 'id'>;
      if (!byDate.has(data.date)) {
        addRecord({ id: d.id, ...data });
      }
    });
  }

  return Array.from(byDate.values());
}

async function getLegacyRecordsForUserDate(
  userId: string,
  date: string,
): Promise<StaffAttendanceRecord[]> {
  const byId = new Map<string, StaffAttendanceRecord>();

  const deterministicId = makeStaffAttendanceDocId(userId, date);
  const deterministicRef = doc(db, 'staff_attendance', deterministicId);
  const q = query(
    collection(db, 'staff_attendance'),
    where('userId', '==', userId),
    where('date', '==', date),
  );
  // 1.5 Promise.all — deterministic doc + query together
  const [deterministicSnap, snap] = await Promise.all([
    getDoc(deterministicRef),
    getDocs(q),
  ]);

  if (deterministicSnap.exists()) {
    byId.set(deterministicSnap.id, {
      id: deterministicSnap.id,
      ...(deterministicSnap.data() as Omit<StaffAttendanceRecord, 'id'>),
    });
  }
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

const noopSubscribe = () => () => {};
const nullTodaySnapshot = (): StaffAttendanceRecord | null => null;
const readySnapshot = () => true;
// ค่าอ้างอิงเดียวคงที่ ห้ามสร้าง [] ใหม่ทุกครั้ง ไม่งั้น useSyncExternalStore วน re-render ไม่จบ
const EMPTY_CALENDAR_EVENTS: CalendarEvent[] = [];
const emptyCalendarEvents = () => EMPTY_CALENDAR_EVENTS;


async function applyAutoCheckoutInternal(
  date: string,
  targetUserId: string,
  base: Pick<StaffAttendanceRecord, 'checkInTime' | 'checkOutTime' | 'status' | 'note'>,
): Promise<Timestamp | null> {
  if (!shouldAutoCheckout({ checkInTime: base.checkInTime, checkOutTime: base.checkOutTime, date })) {
    return null;
  }

  const cutoffTs = Timestamp.fromDate(getCutoffDateTime(date, 18, 0));
  const dayRef = getStaffAttendanceDayDocRef(date);
  const entryRef = getStaffAttendanceEntryRef(date, targetUserId);
  const batch = writeBatch(db);
  batch.set(dayRef, {
    date,
    updatedAt: serverTimestamp(),
  }, { merge: true });
  batch.set(entryRef, {
    checkOutTime: cutoffTs,
    autoCheckout: true,
    autoCheckoutAt: serverTimestamp(),
    note: base.note || 'ระบบเช็คเอาท์อัตโนมัติเวลา 18:00',
  }, { merge: true });
  await batch.commit();
  return cutoffTs;
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useStaffAttendance(
  userId: string,
  displayName: string,
  config: AttendanceConfig = DEFAULT_CONFIG,
  extraHolidays: CalendarEvent[] = [],
  academicYearId?: string,
  isSpecialTeacher = false,
  /** 1.2 Defer — week history costs ~7 reads; only load when a consumer needs it */
  options?: { loadHistory?: boolean },
) {
  const loadHistory = options?.loadHistory === true;
  const [legacyRecord, setLegacyRecord] = useState<StaffAttendanceRecord | null | undefined>(undefined);
  const [history, setHistory] = useState<StaffAttendanceRecord[]>([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoCheckoutApplied, setAutoCheckoutApplied] = useState(false);
  const legacyCheckedRef = useRef(false);

  const todayStr = getLocalDateString();
  const todayStore = userId ? getStaffTodayEntryStore(userId, todayStr) : null;
  const storeRecord = useSyncExternalStore(
    todayStore?.subscribe ?? noopSubscribe,
    todayStore?.getSnapshot ?? nullTodaySnapshot,
    todayStore?.getSnapshot ?? nullTodaySnapshot,
  );
  const storeReady = useSyncExternalStore(
    todayStore?.subscribe ?? noopSubscribe,
    todayStore?.getReady ?? readySnapshot,
    todayStore?.getReady ?? readySnapshot,
  );

  const calendarStore = academicYearId ? getCalendarEventsStore(academicYearId) : null;
  const calendarEvents = useSyncExternalStore(
    calendarStore?.subscribe ?? noopSubscribe,
    calendarStore?.getSnapshot ?? emptyCalendarEvents,
    calendarStore?.getSnapshot ?? emptyCalendarEvents,
  );
  const { isHoliday, holidayTitle } = useMemo(
    () => resolveTodayHoliday(todayStr, extraHolidays, calendarEvents),
    [todayStr, extraHolidays, calendarEvents],
  );

  useEffect(() => {
    legacyCheckedRef.current = false;
    setLegacyRecord(undefined);
    setAutoCheckoutApplied(false);
  }, [userId, todayStr]);

  useEffect(() => {
    if (!userId || storeRecord !== null || !storeReady || legacyCheckedRef.current) return;
    legacyCheckedRef.current = true;

    let cancelled = false;
    void (async () => {
      try {
        const legacyRecords = await getLegacyRecordsForUserDate(userId, todayStr);
        if (cancelled) return;
        if (legacyRecords.length === 0) {
          setLegacyRecord(null);
          return;
        }

        const bestLegacy = mergeAttendanceRecords(legacyRecords, userId);
        const autoCheckoutTs = shouldAutoCheckout({
          checkInTime: bestLegacy.checkInTime,
          checkOutTime: bestLegacy.checkOutTime,
          date: bestLegacy.date,
        })
          ? Timestamp.fromDate(getCutoffDateTime(bestLegacy.date, 18, 0))
          : null;
        const mergedLegacy = autoCheckoutTs
          ? {
            ...bestLegacy,
            checkOutTime: autoCheckoutTs,
            note: bestLegacy.note || 'ระบบเช็คเอาท์อัตโนมัติเวลา 18:00',
          }
          : bestLegacy;

        await migrateLegacyUserDateToNewSchema(mergedLegacy, legacyRecords.map((r) => r.id));
        if (!cancelled) {
          setLegacyRecord({ ...mergedLegacy, id: userId });
        }
      } catch {
        if (!cancelled) setLegacyRecord(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, todayStr, storeRecord, storeReady]);

  const reloadHistory = useCallback(async (force = false) => {
    if (!userId) {
      setHistory([]);
      return;
    }
    if (force) invalidateStaffWeekHistory(userId);
    try {
      const records = await getStaffWeekHistory(userId, force);
      setHistory(records);
    } catch {
      setHistory([]);
    }
  }, [userId]);

  useEffect(() => {
    if (!loadHistory) {
      setHistory([]);
      return;
    }
    void reloadHistory(false);
  }, [loadHistory, reloadHistory]);

  const baseTodayRecord = storeRecord ?? (legacyRecord === undefined ? null : legacyRecord);

  useEffect(() => {
    if (!userId || !baseTodayRecord || autoCheckoutApplied) return;
    if (!shouldAutoCheckout({
      checkInTime: baseTodayRecord.checkInTime,
      checkOutTime: baseTodayRecord.checkOutTime,
      date: baseTodayRecord.date,
    })) {
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        await applyAutoCheckoutInternal(todayStr, userId, {
          checkInTime: baseTodayRecord.checkInTime,
          checkOutTime: baseTodayRecord.checkOutTime,
          status: baseTodayRecord.status,
          note: baseTodayRecord.note,
        });
        if (!cancelled) setAutoCheckoutApplied(true);
      } catch {
        // listener will retry on next snapshot
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, todayStr, baseTodayRecord, autoCheckoutApplied]);

  const todayRecord = useMemo(() => {
    if (!baseTodayRecord) return null;
    if (
      autoCheckoutApplied
      && !baseTodayRecord.checkOutTime
      && shouldAutoCheckout({
        checkInTime: baseTodayRecord.checkInTime,
        checkOutTime: baseTodayRecord.checkOutTime,
        date: baseTodayRecord.date,
      })
    ) {
      return {
        ...baseTodayRecord,
        checkOutTime: Timestamp.fromDate(getCutoffDateTime(baseTodayRecord.date, 18, 0)),
        note: baseTodayRecord.note || 'ระบบเช็คเอาท์อัตโนมัติเวลา 18:00',
      };
    }
    return baseTodayRecord;
  }, [baseTodayRecord, autoCheckoutApplied]);

  const loading = !storeReady || (storeRecord === null && legacyRecord === undefined);

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
      const alreadyCheckedIn = !!todayRecord?.checkInTime
        || (!!todayRecord?.overrideBy && (todayRecord.status === 'present' || todayRecord.status === 'late'));
      if (alreadyCheckedIn) return;

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
      const status: AttendanceStatus = isSpecialTeacher
        ? 'present'
        : (() => {
          const afterNoonCutoff = isAtOrAfterNoon(now);
          const afterShift =
            now.getHours() > config.shiftStartHour ||
            (now.getHours() === config.shiftStartHour && now.getMinutes() > config.shiftStartMinute);
          return afterNoonCutoff ? 'absent' : (afterShift ? 'late' : 'present');
        })();

      const dayRef = getStaffAttendanceDayDocRef(todayStr);
      const entryRef = getStaffAttendanceEntryRef(todayStr, userId);
      const existing = await getDoc(entryRef);
      if (existing.exists()) {
        const existingData = existing.data() as Omit<StaffAttendanceRecord, 'id'>;
        if (existingData.checkInTime) return;
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
      if (loadHistory) await reloadHistory(true);
    } catch (e: unknown) {
      const code = getErrorCode(e);
      if (code === 1) setError('กรุณาอนุญาตการเข้าถึงพิกัด (Location Permission)');
      else if (code === 2) setError('สัญญาณพิกัดขัดข้อง ไม่สามารถระบุตำแหน่งได้');
      else if (code === 3) setError('ค้นหาตำแหน่งนานเกินไป กรุณาลองใหม่อีกครั้ง');
      else setError(getErrorMessage(e));
    } finally {
      setActionLoading(false);
    }
  }, [userId, displayName, todayStr, config, isHoliday, holidayTitle, todayRecord, reloadHistory, loadHistory, isSpecialTeacher]);

  const checkOut = useCallback(async () => {
    if (!todayRecord || !userId) return;
    setActionLoading(true);
    setError(null);
    try {
      if (isHoliday) {
        setError(`วันนี้เป็นวันหยุด (${holidayTitle}) ไม่สามารถลงเวลาทำงานได้`);
        return;
      }
      if (!isAtOrAfterShiftEnd(new Date(), config)) {
        setError(`ยังไม่ถึงเวลาเลิกงาน (${formatShiftEndLabel(config)}) ไม่สามารถเช็คเอาต์ได้`);
        return;
      }

      const dayRef = getStaffAttendanceDayDocRef(todayStr);
      const entryRef = getStaffAttendanceEntryRef(todayStr, userId);
      const entrySnap = await getDoc(entryRef);
      const entryData = entrySnap.exists()
        ? (entrySnap.data() as Partial<Omit<StaffAttendanceRecord, 'id'>>)
        : null;

      const canCheckOut = !!entryData?.checkInTime
        || (!!entryData?.overrideBy && (entryData.status === 'present' || entryData.status === 'late'));
      if (!canCheckOut) {
        setError('ไม่พบเวลาเข้าในระบบ กรุณาเช็กอินก่อนเช็กเอาต์');
        return;
      }
      if (entryData?.checkOutTime) return;

      const batch = writeBatch(db);
      batch.set(dayRef, {
        date: todayStr,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      batch.set(entryRef, {
        checkOutTime: serverTimestamp(),
      }, { merge: true });
      await batch.commit();
      if (loadHistory) await reloadHistory(true);
    } catch (e: unknown) {
      setError(getErrorMessage(e));
    } finally {
      setActionLoading(false);
    }
  }, [todayRecord, userId, todayStr, isHoliday, holidayTitle, config, reloadHistory, loadHistory]);

  return {
    todayRecord,
    history,
    loading,
    actionLoading,
    error,
    checkIn,
    checkOut,
    refresh: () => { if (loadHistory) void reloadHistory(true); },
    isHoliday,
    holidayTitle,
  };
}

// ── Admin: override สถานะเข้างานของวันใดวันหนึ่ง (ใช้จากปฏิทินรายบุคคล / รายวัน) ──
export async function overrideStaffAttendanceStatus(params: {
  date: string;
  userId: string;
  displayName: string;
  status: AttendanceStatus;
  note: string;
  adminUid: string;
}): Promise<void> {
  const { date, userId, displayName, status, note, adminUid } = params;
  const dayRef = getStaffAttendanceDayDocRef(date);
  const entryRef = getStaffAttendanceEntryRef(date, userId);
  const existingSnap = await getDoc(entryRef);
  const existing = existingSnap.exists()
    ? (existingSnap.data() as Partial<Omit<StaffAttendanceRecord, 'id'>>)
    : null;

  const batch = writeBatch(db);

  batch.set(dayRef, {
    date,
    updatedAt: serverTimestamp(),
  }, { merge: true });

  const entryPatch: Record<string, unknown> = {
    userId,
    displayName,
    date,
    status,
    note,
    overrideBy: adminUid,
  };

  if (!existing) {
    entryPatch.checkOutTime = null;
  }

  if (!existing?.checkInTime && (status === 'present' || status === 'late')) {
    entryPatch.checkInTime = serverTimestamp();
  } else if (!existing && status === 'absent') {
    entryPatch.checkInTime = null;
  }

  batch.set(entryRef, entryPatch, { merge: true });
  await batch.commit();
  invalidateStaffWeekHistory(userId);
}

// ── Admin hook: fetch all staff records for a date range ─────────────────────
export function useAdminStaffAttendance(date: string) {
  const [records, setRecords] = useState<StaffAttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      // 1.5 Promise.all — day docs + legacy + staff profiles start together
      const legacyQ = query(
        collection(db, 'staff_attendance'),
        where('date', '==', date),
      );
      const [dayDocs, legacySnap, staffUsers] = await Promise.all([
        loadStaffAttendanceDayDocs(date),
        getDocs(legacyQ),
        waitStaffUsersStore(),
      ]);

      let dedupedAttendanceData = dayDocs.map((d) => ({
        id: d.id,
        ...(d as unknown as Omit<StaffAttendanceRecord, 'id'>),
      }));

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

      const profiles: Record<string, { name: string; photoURL?: string; department?: string }> = {};
      staffUsers.forEach((u) => {
        profiles[u.userId] = {
          name: u.displayName,
          photoURL: u.photoURL,
          department: u.department,
        };
      });
      const recs = dedupedAttendanceData.map(r => ({
        ...r,
        displayName: profiles[r.userId]?.name || r.displayName,
        photoURL: profiles[r.userId]?.photoURL,
        department: profiles[r.userId]?.department
      }));

      recs.sort((a, b) => {
        const ta = timestampToLocalDate(a.checkInTime)?.getTime() ?? 0;
        const tb = timestampToLocalDate(b.checkInTime)?.getTime() ?? 0;
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
    _recordId: string | null,
    targetUserId: string,
    targetName: string,
    status: AttendanceStatus,
    note: string,
    adminUid: string,
  ) => {
    await overrideStaffAttendanceStatus({
      date,
      userId: targetUserId,
      displayName: targetName,
      status,
      note,
      adminUid,
    });
    await fetch();
  }, [date, fetch]);

  return { records, loading, refresh: fetch, override, cleanupDuplicates };
}
