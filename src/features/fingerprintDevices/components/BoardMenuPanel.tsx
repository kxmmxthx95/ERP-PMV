import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  HiArrowLeft,
  HiArrowPath,
  HiChevronDown,
  HiChevronUp,
  HiClipboardDocument,
  HiBars3BottomLeft,
  HiHome,
  HiWifi,
} from 'react-icons/hi2';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import {
  BOARD_SETTINGS_MENU_ITEMS,
  buildConfigWifiSnippet,
} from '../utils/boardMenus';
import {
  MOCK_WIFI_NETWORKS,
  formatScannedWifiLabel,
  type ScannedWifi,
} from '../utils/mockWifiScan';
import type { BoardMenuId, BoardWifiSettings } from '../types';
import type { ReactNode } from 'react';

type Props = {
  deviceId: string | null;
  menuId: BoardMenuId;
  selectedIndex: number;
  onMenuIdChange: (id: BoardMenuId) => void;
  onSelectedIndexChange: (index: number) => void;
  wifi: BoardWifiSettings;
  onWifiChange: (patch: Partial<BoardWifiSettings>) => void;
  isConnecting: boolean;
  connectionOk: boolean | null;
  onSimulateConnect: () => Promise<boolean>;
  readOnly?: boolean;
  enrollPanel?: ReactNode;
  usersPanel?: ReactNode;
};

export default function BoardMenuPanel({
  deviceId,
  menuId,
  selectedIndex,
  onMenuIdChange,
  onSelectedIndexChange,
  wifi,
  onWifiChange,
  isConnecting,
  connectionOk,
  onSimulateConnect,
  readOnly = false,
  enrollPanel,
  usersPanel,
}: Props) {
  const [showPassword, setShowPassword] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanResults, setScanResults] = useState<ScannedWifi[] | null>(null);

  const runWifiScan = () => {
    setScanning(true);
    setScanResults(null);
    window.setTimeout(() => {
      setScanResults(MOCK_WIFI_NETWORKS);
      setScanning(false);
    }, 900);
  };

  const configSnippet = useMemo(
    () => buildConfigWifiSnippet(wifi.ssid, wifi.password),
    [wifi.ssid, wifi.password],
  );

  const openSettings = () => {
    onMenuIdChange('settings');
    onSelectedIndexChange(0);
  };

  const enterSelectedMenu = () => {
    const item = BOARD_SETTINGS_MENU_ITEMS[selectedIndex];
    if (!item) return;
    if (item.id === 'wifi' || item.id === 'enroll' || item.id === 'users') onMenuIdChange(item.id);
  };

  const goBack = () => {
    if (menuId === 'wifi' || menuId === 'enroll' || menuId === 'users' || menuId === 'users_list') {
      onMenuIdChange('settings');
      return;
    }
    if (menuId === 'settings') {
      onMenuIdChange('home');
    }
  };

  const moveUp = () => {
    if (menuId !== 'settings') return;
    onSelectedIndexChange(
      selectedIndex <= 0 ? BOARD_SETTINGS_MENU_ITEMS.length - 1 : selectedIndex - 1,
    );
  };

  const moveDown = () => {
    if (menuId !== 'settings') return;
    onSelectedIndexChange(
      selectedIndex >= BOARD_SETTINGS_MENU_ITEMS.length - 1 ? 0 : selectedIndex + 1,
    );
  };

  const handleCopyConfig = async () => {
    try {
      await navigator.clipboard.writeText(configSnippet);
      toast.success('คัดลอก snippet สำหรับ config.h แล้ว');
    } catch {
      toast.error('คัดลอกไม่สำเร็จ');
    }
  };

  const handleTestConnect = async () => {
    if (!deviceId) {
      toast.error('เลือกหรือเพิ่มเครื่องก่อน');
      return;
    }
    if (!wifi.ssid.trim()) {
      toast.error('กรอก SSID ก่อน');
      return;
    }
    onMenuIdChange('wifi');
    const ok = await onSimulateConnect();
    toast[ok ? 'success' : 'error'](ok ? 'จำลองเชื่อม WiFi สำเร็จ' : 'จำลองเชื่อม WiFi ล้มเหลว');
  };

  return (
    <div className="flex w-full flex-col gap-4">
      {readOnly ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] leading-relaxed text-emerald-900">
          โหมด Live — จอจำลอง sync จากบอร์ดจริงผ่าน USB serial ควบคุมหน้าจอและเมนูที่บอร์ดโดยตรง
        </div>
      ) : null}

      <section className={cn('rounded-2xl border border-slate-100 bg-white p-4 shadow-sm', readOnly && 'opacity-60')}>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-sm font-black text-slate-900">เมนูบอร์ด</h2>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">
            {menuId === 'home'
              ? 'หน้าหลัก'
              : menuId === 'settings'
                ? 'เมนู'
                : menuId === 'enroll'
                  ? 'ลงทะเบียน'
                  : menuId === 'users_list'
                    ? 'รายชื่อ'
                    : menuId === 'users'
                      ? 'ผู้ใช้งาน'
                      : 'WiFi'}
          </span>
        </div>
        <p className="mb-3 text-[11px] leading-relaxed text-slate-500">
          จำลองเมนูบนจอ ESP32 — ค่า WiFi เก็บในเบราว์เซอร์ต่อเครื่อง (ไม่ส่ง Cloud)
        </p>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={readOnly}
            onClick={() => onMenuIdChange('home')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold',
              menuId === 'home'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
            )}
          >
            <HiHome className="h-4 w-4" />
            หน้าหลัก
          </button>
          <button
            type="button"
            disabled={readOnly}
            onClick={openSettings}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold',
              menuId === 'settings' ||
              menuId === 'wifi' ||
              menuId === 'enroll' ||
              menuId === 'users' ||
              menuId === 'users_list'
                ? 'bg-sky-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
            )}
          >
            <HiBars3BottomLeft className="h-4 w-4" />
            เมนู
          </button>
        </div>

        {menuId === 'settings' && (
          <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
            <button
              type="button"
              onClick={moveUp}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              <HiChevronUp className="h-4 w-4" />
              เลื่อนขึ้น
            </button>
            <button
              type="button"
              onClick={moveDown}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              <HiChevronDown className="h-4 w-4" />
              เลื่อนลง
            </button>
            <button
              type="button"
              onClick={enterSelectedMenu}
              className="inline-flex items-center gap-1 rounded-lg bg-sky-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-sky-700"
            >
              OK · เข้าเมนู
            </button>
            <button
              type="button"
              onClick={goBack}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              <HiArrowLeft className="h-4 w-4" />
              กลับ
            </button>
          </div>
        )}

        {(menuId === 'wifi' || menuId === 'enroll' || menuId === 'users' || menuId === 'users_list') && (
          <button
            type="button"
            onClick={goBack}
            className="mt-3 inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            <HiArrowLeft className="h-4 w-4" />
            กลับไปเมนู
          </button>
        )}
      </section>

      {menuId === 'enroll' && enrollPanel ? (
        enrollPanel
      ) : (menuId === 'users' || menuId === 'users_list') && usersPanel ? (
        usersPanel
      ) : (
      <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <HiWifi className="h-5 w-5 text-sky-600" />
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">
            ตั้งค่าการเชื่อมต่อ WiFi
          </h3>
        </div>

        {!deviceId ? (
          <p className="text-xs text-amber-600">เพิ่มเครื่องก่อนตั้งค่า WiFi</p>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="board-wifi-ssid">SSID (2.4 GHz)</Label>
              <Input
                id="board-wifi-ssid"
                value={wifi.ssid}
                onChange={(e) => onWifiChange({ ssid: e.target.value })}
                placeholder="ชื่อ WiFi"
                autoComplete="off"
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="board-wifi-pass">รหัสผ่าน</Label>
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="text-[10px] font-semibold text-sky-600 hover:underline"
                >
                  {showPassword ? 'ซ่อน' : 'แสดง'}
                </button>
              </div>
              <Input
                id="board-wifi-pass"
                type={showPassword ? 'text' : 'password'}
                value={wifi.password}
                onChange={(e) => onWifiChange({ password: e.target.value })}
                placeholder="รหัสผ่าน WiFi"
                autoComplete="off"
              />
            </div>

            <div className="space-y-2 rounded-xl border border-slate-100 bg-slate-50 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                  WiFi รอบๆ (จำลอง)
                </p>
                <button
                  type="button"
                  disabled={scanning}
                  onClick={runWifiScan}
                  className="inline-flex items-center gap-1 rounded-lg bg-sky-700 px-2 py-1 text-[10px] font-bold text-white hover:bg-sky-800 disabled:opacity-50"
                >
                  <HiArrowPath className={cn('h-3.5 w-3.5', scanning && 'animate-spin')} />
                  {scanning ? 'กำลังค้นหา...' : 'ค้นหา'}
                </button>
              </div>
              {scanResults ? (
                <ul className="max-h-36 space-y-0.5 overflow-y-auto">
                  {scanResults.map((entry) => (
                    <li key={entry.ssid}>
                      <button
                        type="button"
                        onClick={() => onWifiChange({ ssid: entry.ssid })}
                        className={cn(
                          'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs hover:bg-white',
                          wifi.ssid === entry.ssid && 'bg-sky-50 ring-1 ring-sky-200',
                        )}
                      >
                        <HiWifi className="h-4 w-4 shrink-0 text-sky-600" />
                        <span className="truncate font-medium text-slate-700">
                          {formatScannedWifiLabel(entry)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[11px] text-slate-500">กดค้นหาเพื่อดูเครือข่าย WiFi ใกล้เคียง</p>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={isConnecting}
                onClick={handleTestConnect}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                <HiArrowPath className={cn('h-4 w-4', isConnecting && 'animate-spin')} />
                {isConnecting ? 'กำลังเชื่อม...' : 'ทดสอบเชื่อมต่อ (จำลอง)'}
              </button>
            </div>

            {connectionOk !== null && (
              <p
                className={cn(
                  'text-xs font-semibold',
                  connectionOk ? 'text-emerald-600' : 'text-red-500',
                )}
              >
                {connectionOk ? 'สถานะ: WiFi OK (จำลอง)' : 'สถานะ: เชื่อมต่อไม่สำเร็จ'}
              </p>
            )}

            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                  คัดลอกไป config.h
                </p>
                <button
                  type="button"
                  onClick={handleCopyConfig}
                  className="inline-flex items-center gap-1 text-[10px] font-bold text-sky-600 hover:underline"
                >
                  <HiClipboardDocument className="h-3.5 w-3.5" />
                  คัดลอก
                </button>
              </div>
              <pre className="overflow-x-auto whitespace-pre-wrap break-all font-mono text-[10px] text-slate-600">
                {configSnippet}
              </pre>
            </div>
          </div>
        )}
      </section>
      )}
    </div>
  );
}
