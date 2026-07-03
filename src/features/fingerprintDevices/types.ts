import type { ScannedWifi } from './utils/mockWifiScan';
import type { UserListCategory } from './utils/userListCategory';

export type { UserListCategory };

export type AttendanceDevice = {
  id: string;
  name: string;
  apiKeyHash: string;
  active: boolean;
  location?: string;
  firmwareVersion?: string;
  macAddress?: string;
  lastSeenAt?: string;
  notes?: string;
  updatedAt?: string;
  createdAt?: string;
};

export type AttendanceDeviceInput = {
  id: string;
  name: string;
  active: boolean;
  location?: string;
  notes?: string;
};

export type SimulatorScreenState =
  | 'boot'
  | 'wifi_connecting'
  | 'wifi_fail'
  | 'ready'
  | 'processing'
  | 'not_found'
  | 'sending'
  | 'check_in_ok'
  | 'check_out_ok'
  | 'error'
  | 'as608_missing';

export type DeviceCommand =
  | 'reboot'
  | 'refresh_wifi'
  | 'test_beep'
  | 'enroll_mode'
  | 'clear_screen'
  | 'sync_time';

export type FingerprintStaffUser = {
  uid: string;
  displayName: string;
  role: string;
  fingerprintTemplateId?: number;
  status?: string;
};

export type FingerprintStudentUser = {
  uid: string;
  displayName: string;
  studentCode?: string;
  gradeLevel?: string;
  department?: string;
  fingerprintTemplateId?: number;
};

export type DeviceTestAction = 'toggle' | 'checkIn' | 'checkOut' | 'status';

/** หน้าจอเมนูบอร์ด (จำลอง LVGL settings) */
export type BoardMenuId = 'home' | 'settings' | 'wifi' | 'enroll' | 'users' | 'users_list';

export type BoardWifiSettings = {
  ssid: string;
  password: string;
};

export type BoardMenuItem = {
  id: Exclude<BoardMenuId, 'home' | 'settings'>;
  label: string;
  shortLabel: string;
  description: string;
};

export type SerialBridgeStatus = 'disconnected' | 'connecting' | 'live';

export type DeviceEnrollPhase =
  | 'idle'
  | 'wait_finger1'
  | 'wait_release'
  | 'wait_finger2'
  | 'done'
  | 'fail';

export type DeviceLiveEnroll = {
  phase: DeviceEnrollPhase;
  status: string;
  detail: string;
  slot?: number;
};

export type DeviceLiveUser = {
  templateId: number;
  name: string;
  role?: string;
  code?: string;
  category?: UserListCategory;
};

export type DeviceLiveSnapshot = {
  boardMenuId: BoardMenuId;
  screenState: SimulatorScreenState;
  status: string;
  name: string;
  time: string;
  wifiOk: boolean | null;
  wifiConnecting: boolean;
  fpReady: boolean;
  wifiSsid?: string;
  wifiStatusLabel?: string;
  wifiScanning?: boolean;
  wifiScan?: ScannedWifi[] | null;
  enroll?: DeviceLiveEnroll;
  users?: DeviceLiveUser[];
  usersLoading?: boolean;
  usersStatus?: string;
  usersCategory?: UserListCategory | null;
  lastEventAt: number;
};

export type PmvTelemetryEvent =
  | { v: 1; ev: 'screen'; screen: BoardMenuId }
  | {
      v: 1;
      ev: 'home';
      status: string;
      name: string;
      time: string;
      wifi: boolean;
      fp: boolean;
    }
  | {
      v: 1;
      ev: 'enroll';
      phase: DeviceEnrollPhase;
      status: string;
      detail: string;
      slot?: number;
    }
  | {
      v: 1;
      ev: 'wifi';
      scanning: boolean;
      connected: boolean;
      ssid?: string;
      status?: string;
    }
  | {
      v: 1;
      ev: 'wifi_scan';
      networks: Array<{ ssid: string; rssi: number }>;
    }
  | {
      v: 1;
      ev: 'users_list';
      loading: boolean;
      status?: string;
      category?: UserListCategory;
      users: Array<{
        templateId?: number;
        name?: string;
        role?: string;
        code?: string;
        category?: UserListCategory;
      }>;
    };
