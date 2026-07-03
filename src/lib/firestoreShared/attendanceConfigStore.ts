import { doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { createSharedStore } from './createSharedStore';
import { listenDocWithGetDoc } from './listenDocWithGetDoc';
import { DEFAULT_ATTENDANCE_CONFIG, type AttendanceConfig } from '@/types/attendanceConfig';

export const attendanceConfigStore = createSharedStore<AttendanceConfig>(
  (emit) =>
    listenDocWithGetDoc(
      doc(db, 'system_config', 'staff_attendance'),
      (raw) => {
        if (!raw) return DEFAULT_ATTENDANCE_CONFIG;
        return { ...DEFAULT_ATTENDANCE_CONFIG, ...raw } as AttendanceConfig;
      },
      emit,
      DEFAULT_ATTENDANCE_CONFIG,
      'attendanceConfigStore',
    ),
  DEFAULT_ATTENDANCE_CONFIG,
);
