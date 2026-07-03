import type { BoardMenuItem } from '../types';

/** รายการเมนูบนจอบอร์ด — เพิ่มรายการใหม่ที่นี่ */
export const BOARD_SETTINGS_MENU_ITEMS: BoardMenuItem[] = [
  {
    id: 'wifi',
    label: 'WiFi',
    shortLabel: 'WiFi',
    description: 'เชื่อมต่อเครือข่าย',
  },
  {
    id: 'enroll',
    label: 'ลงทะเบียนลายนิ้ว',
    shortLabel: 'ลงทะเบียน',
    description: 'เลือกนักเรียนแล้วสแกนนิ้วทีละคน',
  },
  {
    id: 'users',
    label: 'รายชื่อผู้ใช้',
    shortLabel: 'ผู้ใช้',
    description: 'ดูผู้ที่ลงทะเบียนลายนิ้วแล้ว',
  },
];

export function getBoardMenuLabel(id: BoardMenuItem['id']): string {
  return BOARD_SETTINGS_MENU_ITEMS.find((m) => m.id === id)?.label ?? id;
}

export function buildConfigWifiSnippet(ssid: string, password: string): string {
  const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return [
    '// --- WiFi (2.4 GHz เท่านั้น) — แก้ก่อน flash ---',
    `#define WIFI_SSID "${esc(ssid)}"`,
    `#define WIFI_PASSWORD "${esc(password)}"`,
  ].join('\n');
}
