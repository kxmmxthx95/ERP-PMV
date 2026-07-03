/** สีและขนาดจอจำลอง — ตรงกับ firmware LVGL light theme (แนวนอน 320×240) */
export const DEVICE_SCREEN = {
  width: 320,
  height: 240,
  bezelRadius: 20,
  bg: '#ffffff',
  surface: '#f1f5f9',
  border: '#cbd5e1',
  title: '#2563eb',
  text: '#1e293b',
  wifiOk: '#059669',
  wifiBad: '#dc2626',
  status: '#1e293b',
  name: '#059669',
  time: '#d97706',
  muted: '#64748b',
  accent: '#2563eb',
  btn: '#2563eb',
  btnText: '#ffffff',
  danger: '#dc2626',
} as const;

export const FIRMWARE_DISPLAY = {
  logicalWidth: DEVICE_SCREEN.width,
  logicalHeight: DEVICE_SCREEN.height,
} as const;
