import { useCallback, useSyncExternalStore } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { attendanceConfigStore } from '@/lib/firestoreShared/attendanceConfigStore';
import {
  DEFAULT_ATTENDANCE_CONFIG,
  type AttendanceConfig,
} from '@/types/attendanceConfig';

export type { AttendanceConfig };
export const DEFAULT_CONFIG = DEFAULT_ATTENDANCE_CONFIG;

export function useAttendanceConfig() {
  const config = useSyncExternalStore(
    attendanceConfigStore.subscribe,
    attendanceConfigStore.getSnapshot,
    attendanceConfigStore.getSnapshot,
  );

  const saveConfig = useCallback(async (next: AttendanceConfig) => {
    const ref = doc(db, 'system_config', 'staff_attendance');
    await setDoc(ref, { ...next, updatedAt: new Date().toISOString() });
  }, []);

  return { config, loading: false, saveConfig };
}
