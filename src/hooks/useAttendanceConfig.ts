import { useState, useEffect, useCallback } from 'react';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface AttendanceConfig {
  lat: number;
  lng: number;
  radiusMeters: number;
  shiftStartHour: number;    // 0–23
  shiftStartMinute: number;  // 0–59
  shiftEndHour: number;      // 0–23
  shiftEndMinute: number;    // 0–59
  updatedAt?: any;
}

export const DEFAULT_CONFIG: AttendanceConfig = {
  lat: 13.7563,
  lng: 100.5018,
  radiusMeters: 200,
  shiftStartHour: 8,
  shiftStartMinute: 0,
  shiftEndHour: 16,
  shiftEndMinute: 30,
};

export function useAttendanceConfig() {
  const [config, setConfig] = useState<AttendanceConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ref = doc(db, 'system_config', 'staff_attendance');
    const unsub = onSnapshot(ref, snap => {
      if (snap.exists()) {
        setConfig({ ...DEFAULT_CONFIG, ...snap.data() } as AttendanceConfig);
      } else {
        setConfig(DEFAULT_CONFIG);
      }
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, []);

  const saveConfig = useCallback(async (next: AttendanceConfig) => {
    const ref = doc(db, 'system_config', 'staff_attendance');
    await setDoc(ref, { ...next, updatedAt: new Date().toISOString() });
  }, []);

  return { config, loading, saveConfig };
}
