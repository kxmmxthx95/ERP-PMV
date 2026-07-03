import { useCallback, useEffect, useState } from 'react';
import type { BoardWifiSettings } from '../types';

const STORAGE_PREFIX = 'pmv_board_wifi_';

const DEFAULT_WIFI: BoardWifiSettings = {
  ssid: '',
  password: '',
};

function loadWifi(deviceId: string | null): BoardWifiSettings {
  if (!deviceId || typeof window === 'undefined') return DEFAULT_WIFI;
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + deviceId);
    if (!raw) return DEFAULT_WIFI;
    const parsed = JSON.parse(raw) as Partial<BoardWifiSettings>;
    return {
      ssid: parsed.ssid ?? '',
      password: parsed.password ?? '',
    };
  } catch {
    return DEFAULT_WIFI;
  }
}

function saveWifi(deviceId: string, settings: BoardWifiSettings) {
  localStorage.setItem(STORAGE_PREFIX + deviceId, JSON.stringify(settings));
}

export function useBoardWifiSettings(deviceId: string | null) {
  const [wifi, setWifi] = useState<BoardWifiSettings>(() => loadWifi(deviceId));
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionOk, setConnectionOk] = useState<boolean | null>(null);

  useEffect(() => {
    setWifi(loadWifi(deviceId));
    setConnectionOk(null);
    setIsConnecting(false);
  }, [deviceId]);

  const updateWifi = useCallback(
    (patch: Partial<BoardWifiSettings>) => {
      setWifi((prev) => {
        const next = { ...prev, ...patch };
        if (deviceId) saveWifi(deviceId, next);
        return next;
      });
      setConnectionOk(null);
    },
    [deviceId],
  );

  /** จำลองการเชื่อมต่อบนบอร์ด — ตรวจแค่ SSID ไม่ว่าง */
  const simulateConnect = useCallback(async () => {
    if (!wifi.ssid.trim()) {
      setConnectionOk(false);
      return false;
    }
    setIsConnecting(true);
    setConnectionOk(null);
    await new Promise((r) => setTimeout(r, 1800));
    setIsConnecting(false);
    setConnectionOk(true);
    return true;
  }, [wifi.ssid]);

  return {
    wifi,
    updateWifi,
    isConnecting,
    connectionOk,
    simulateConnect,
  };
}
