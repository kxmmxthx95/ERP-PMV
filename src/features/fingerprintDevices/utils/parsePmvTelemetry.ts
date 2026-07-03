import type { ScannedWifi } from './mockWifiScan';
import type { DeviceLiveSnapshot, PmvTelemetryEvent, SimulatorScreenState } from '../types';

const PMV_PREFIX = '@PMV';

export function extractPmvJsonLines(buffer: string): { events: PmvTelemetryEvent[]; rest: string } {
  const events: PmvTelemetryEvent[] = [];
  let rest = buffer;

  for (;;) {
    const idx = rest.indexOf(PMV_PREFIX);
    if (idx < 0) {
      rest = rest.slice(-256);
      break;
    }

    const lineStart = idx;
    const nl = rest.indexOf('\n', lineStart);
    if (nl < 0) {
      rest = rest.slice(lineStart);
      break;
    }

    const line = rest.slice(lineStart + PMV_PREFIX.length, nl).trim();
    rest = rest.slice(nl + 1);

    if (!line) continue;

    try {
      const parsed = JSON.parse(line) as PmvTelemetryEvent;
      if (parsed && typeof parsed === 'object' && parsed.v === 1 && parsed.ev) {
        events.push(parsed);
      }
    } catch {
      // ignore malformed telemetry
    }
  }

  return { events, rest };
}

export function mapHomeStatusToScreenState(
  status: string,
  wifi: boolean,
  fp: boolean,
): SimulatorScreenState {
  if (!fp) {
    if (status.includes('AS608') || status.includes('เซ็นเซอร์')) {
      return 'as608_missing';
    }
  }
  if (status.includes('เริ่มต้น')) return 'boot';
  if (status.includes('กำลังเชื่อม WiFi')) return 'wifi_connecting';
  if (status.includes('WiFi ล้มเหลว')) return 'wifi_fail';
  if (status.includes('กำลังส่งข้อมูล')) return 'sending';
  if (status.includes('เช็คอินสำเร็จ')) return 'check_in_ok';
  if (status.includes('เช็คเอาต์สำเร็จ')) return 'check_out_ok';
  if (status.includes('ไม่พบลายนิ้ว')) return 'not_found';
  if (
    status.includes('อ่านลายนิ้วไม่ได้') ||
    status.includes('ประมวลผลลายนิ้วไม่ได้')
  ) {
    return 'processing';
  }
  if (status.includes('API') || status.includes('JSON error')) return 'error';
  if (!wifi && status.includes('WiFi')) return 'wifi_fail';
  if (status.includes('วางนิ้ว') || status.includes('รอเซ็นเซอร์')) return 'ready';
  return 'ready';
}

function parseWifiScanNetworks(
  networks: Array<{ ssid?: string; rssi?: number }> | undefined,
): ScannedWifi[] | null {
  if (!networks?.length) return [];
  return networks
    .filter((n) => n.ssid)
    .map((n) => ({
      ssid: n.ssid!,
      rssi: typeof n.rssi === 'number' ? n.rssi : -70,
      open: false,
    }));
}

export function applyPmvEvent(
  prev: DeviceLiveSnapshot,
  event: PmvTelemetryEvent,
): DeviceLiveSnapshot {
  const next: DeviceLiveSnapshot = {
    ...prev,
    lastEventAt: Date.now(),
  };

  switch (event.ev) {
    case 'screen':
      next.boardMenuId = event.screen;
      if (event.screen !== 'wifi') {
        next.wifiScanning = false;
      }
      if (event.screen !== 'users' && event.screen !== 'users_list') {
        next.usersLoading = false;
        next.usersCategory = null;
      }
      return next;

    case 'home': {
      next.boardMenuId = 'home';
      next.status = event.status;
      next.name = event.name;
      next.time = event.time;
      next.wifiOk = event.wifi;
      next.fpReady = event.fp;
      next.wifiConnecting = event.status.includes('กำลังเชื่อม WiFi');
      next.screenState = mapHomeStatusToScreenState(event.status, event.wifi, event.fp);
      return next;
    }

    case 'enroll':
      next.boardMenuId = 'enroll';
      next.enroll = {
        phase: event.phase,
        status: event.status,
        detail: event.detail,
        slot: event.slot,
      };
      return next;

    case 'wifi':
      next.wifiScanning = event.scanning;
      next.wifiOk = event.connected;
      if (event.ssid) next.wifiSsid = event.ssid;
      if (event.status) next.wifiStatusLabel = event.status;
      return next;

    case 'wifi_scan':
      next.wifiScanning = false;
      next.wifiScan = parseWifiScanNetworks(event.networks);
      return next;

    case 'users_list':
      next.boardMenuId = 'users_list';
      next.usersLoading = event.loading;
      if (event.status) next.usersStatus = event.status;
      if (event.category) next.usersCategory = event.category;
      else if (!event.loading) next.usersCategory = null;
      next.users = (event.users ?? [])
        .filter((u) => typeof u.templateId === 'number' && u.name)
        .map((u) => ({
          templateId: u.templateId!,
          name: u.name!,
          role: u.role,
          code: u.code,
          category: u.category,
        }));
      return next;

    default:
      return next;
  }
}

export function createInitialLiveSnapshot(): DeviceLiveSnapshot {
  return {
    boardMenuId: 'home',
    screenState: 'boot',
    status: 'เริ่มต้นระบบ...',
    name: '',
    time: '',
    wifiOk: null,
    wifiConnecting: false,
    fpReady: false,
    lastEventAt: Date.now(),
  };
}
