export type ScannedWifi = {
  ssid: string;
  rssi: number;
  open: boolean;
};

/** รายการจำลองสำหรับ web simulator — บอร์ดจริงใช้ WiFi.scanNetworks() */
export const MOCK_WIFI_NETWORKS: ScannedWifi[] = [
  { ssid: 'Paan95_2.4G', rssi: -42, open: false },
  { ssid: 'PMV-School', rssi: -55, open: false },
  { ssid: 'Guest_WiFi', rssi: -61, open: true },
  { ssid: 'AIS-Fibre-2G', rssi: -68, open: false },
  { ssid: 'TrueMove H', rssi: -72, open: false },
  { ssid: 'IoT-Lab', rssi: -78, open: true },
];

export function formatScannedWifiLabel(entry: ScannedWifi): string {
  const lock = entry.open ? ' ·open' : '';
  return `${entry.ssid}  ${entry.rssi}dBm${lock}`;
}
