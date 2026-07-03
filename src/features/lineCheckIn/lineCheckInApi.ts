import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';

export type LineStaffAction = 'status' | 'checkIn' | 'checkOut';

export type LineStaffRecord = {
  status: 'present' | 'late' | 'absent';
  checkInTime: string | null;
  checkOutTime: string | null;
};

export type LineStaffStatusResponse =
  | {
      linked: false;
      lineDisplayName?: string;
      message: string;
    }
  | {
      linked: true;
      success?: boolean;
      alreadyDone?: boolean;
      date: string;
      displayName: string;
      isHoliday: boolean;
      holidayTitle: string | null;
      record: LineStaffRecord | null;
      canCheckIn: boolean;
      canCheckOut: boolean;
    };

function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('อุปกรณ์ไม่รองรับ GPS'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 12_000,
      maximumAge: 10_000,
    });
  });
}

function mapGeoError(err: GeolocationPositionError): string {
  if (err.code === 1) return 'กรุณาอนุญาตการเข้าถึงพิกัด (Location Permission)';
  if (err.code === 2) return 'สัญญาณพิกัดขัดข้อง ไม่สามารถระบุตำแหน่งได้';
  if (err.code === 3) return 'ค้นหาตำแหน่งนานเกินไป กรุณาลองใหม่อีกครั้ง';
  return err.message || 'ไม่สามารถอ่านพิกัดได้';
}

export async function callLineStaffAttendance(
  accessToken: string,
  action: LineStaffAction,
): Promise<LineStaffStatusResponse> {
  const callable = httpsCallable<
    {
      accessToken: string;
      action: LineStaffAction;
      latitude?: number;
      longitude?: number;
    },
    LineStaffStatusResponse
  >(functions, 'lineStaffAttendance');

  let latitude: number | undefined;
  let longitude: number | undefined;

  if (action === 'checkIn') {
    try {
      const pos = await getCurrentPosition();
      latitude = pos.coords.latitude;
      longitude = pos.coords.longitude;
    } catch (err) {
      if (err instanceof GeolocationPositionError) {
        throw new Error(mapGeoError(err));
      }
      throw err instanceof Error ? err : new Error('ไม่สามารถอ่านพิกัดได้');
    }
  }

  const res = await callable({
    accessToken,
    action,
    latitude,
    longitude,
  });
  return res.data;
}
