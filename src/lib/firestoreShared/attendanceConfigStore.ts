import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { createSharedStore } from './createSharedStore';
import { DEFAULT_ATTENDANCE_CONFIG, type AttendanceConfig } from '@/types/attendanceConfig';

export const attendanceConfigStore = createSharedStore<AttendanceConfig>(
  (emit) => {
    let cancelled = false;
    void getDoc(doc(db, 'system_config', 'staff_attendance'))
      .then((snap) => {
        if (cancelled) return;
        const raw = snap.data();
        const config = raw ? { ...DEFAULT_ATTENDANCE_CONFIG, ...raw } as AttendanceConfig : DEFAULT_ATTENDANCE_CONFIG;
        emit(config);
      })
      .catch((err) => {
        console.warn('[attendanceConfigStore] getDoc failed:', err);
        if (!cancelled) emit(DEFAULT_ATTENDANCE_CONFIG);
      });
    return () => {
      cancelled = true;
    };
  },
  DEFAULT_ATTENDANCE_CONFIG,
);
