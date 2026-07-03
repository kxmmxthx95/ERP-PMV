export interface AttendanceConfig {
  lat: number;
  lng: number;
  radiusMeters: number;
  shiftStartHour: number;
  shiftStartMinute: number;
  shiftEndHour: number;
  shiftEndMinute: number;
  dutyStartHour: number;
  dutyStartMinute: number;
  dutyEndHour: number;
  dutyEndMinute: number;
  updatedAt?: unknown;
}

export const DEFAULT_ATTENDANCE_CONFIG: AttendanceConfig = {
  lat: 13.7563,
  lng: 100.5018,
  radiusMeters: 200,
  shiftStartHour: 8,
  shiftStartMinute: 0,
  shiftEndHour: 16,
  shiftEndMinute: 30,
  dutyStartHour: 7,
  dutyStartMinute: 0,
  dutyEndHour: 8,
  dutyEndMinute: 0,
};
