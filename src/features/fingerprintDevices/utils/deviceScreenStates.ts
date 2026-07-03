import type { SimulatorScreenState } from '../types';

export type ScreenContent = {
  title: string;
  wifiLabel: string;
  wifiOk: boolean;
  status: string;
  name: string;
  time: string;
};

export function getScreenContent(
  state: SimulatorScreenState,
  overrides?: Partial<Pick<ScreenContent, 'status' | 'name' | 'time' | 'wifiOk'>>,
): ScreenContent {
  const base: ScreenContent = {
    title: 'PMV Check-In',
    wifiLabel: 'WiFi: ...',
    wifiOk: false,
    status: '',
    name: '',
    time: '',
  };

  switch (state) {
    case 'boot':
      return {
        ...base,
        status: 'เริ่มต้นระบบ...',
      };
    case 'wifi_connecting':
      return {
        ...base,
        wifiLabel: 'WiFi --',
        status: 'กำลังเชื่อม WiFi...',
      };
    case 'wifi_fail':
      return {
        ...base,
        wifiLabel: 'WiFi --',
        wifiOk: false,
        status: 'WiFi ล้มเหลว',
      };
    case 'ready':
      return {
        ...base,
        wifiLabel: 'WiFi OK',
        wifiOk: true,
        status: 'วางนิ้วบนเซ็นเซอร์',
      };
    case 'processing':
      return {
        ...base,
        wifiLabel: 'WiFi OK',
        wifiOk: true,
        status: 'กำลังอ่านลายนิ้ว...',
      };
    case 'not_found':
      return {
        ...base,
        wifiLabel: 'WiFi OK',
        wifiOk: true,
        status: 'ไม่พบลายนิ้วในระบบ',
      };
    case 'sending':
      return {
        ...base,
        wifiLabel: 'WiFi OK',
        wifiOk: true,
        status: 'กำลังส่งข้อมูล...',
      };
    case 'check_in_ok':
      return {
        ...base,
        wifiLabel: 'WiFi OK',
        wifiOk: true,
        status: 'เช็คอินสำเร็จ',
        name: overrides?.name ?? 'ครูตัวอย่าง',
        time: overrides?.time ?? 'เข้า 08:02',
      };
    case 'check_out_ok':
      return {
        ...base,
        wifiLabel: 'WiFi OK',
        wifiOk: true,
        status: 'เช็คเอาต์สำเร็จ',
        name: overrides?.name ?? 'ครูตัวอย่าง',
        time: overrides?.time ?? 'ออก 16:30',
      };
    case 'error':
      return {
        ...base,
        wifiLabel: overrides?.wifiOk ? 'WiFi OK' : 'WiFi --',
        wifiOk: overrides?.wifiOk ?? true,
        status: overrides?.status ?? 'API ไม่ตอบสนอง',
        name: overrides?.name ?? '',
      };
    case 'as608_missing':
      return {
        ...base,
        status: 'AS608 ไม่พบ / รหัสผ่านผิด',
      };
    default:
      return base;
  }
}

export const SCREEN_STATE_OPTIONS: { id: SimulatorScreenState; label: string }[] = [
  { id: 'ready', label: 'พร้อมสแกน' },
  { id: 'wifi_connecting', label: 'เชื่อม WiFi' },
  { id: 'processing', label: 'กำลังอ่าน' },
  { id: 'sending', label: 'ส่ง API' },
  { id: 'check_in_ok', label: 'เช็คอินสำเร็จ' },
  { id: 'check_out_ok', label: 'เช็คเอาต์สำเร็จ' },
  { id: 'not_found', label: 'ไม่พบลายนิ้ว' },
  { id: 'error', label: 'ข้อผิดพลาด' },
  { id: 'as608_missing', label: 'AS608 ไม่พบ' },
];
