import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  HiArrowPath,
  HiArrowUp,
  HiArrowUpTray,
  HiAcademicCap,
  HiBriefcase,
  HiCheckCircle,
  HiSparkles,
  HiUser,
  HiUserGroup,
  HiWifi,
} from 'react-icons/hi2';
import BoardOnScreenKeyboard from './BoardOnScreenKeyboard';
import { DeviceIconButton } from './DeviceScreenChrome';
import { DEVICE_SCREEN } from '../deviceScreenTheme';
import { FW, fwCenterX, fwMenuTileRect, fwRect, fwUsersCategoryRect } from '../deviceScreenLayout';
import { BOARD_SETTINGS_MENU_ITEMS } from '../utils/boardMenus';
import {
  USER_LIST_CATEGORIES,
  filterUsersByCategory,
  type UserListCategory,
} from '../utils/userListCategory';
import {
  MOCK_WIFI_NETWORKS,
  formatScannedWifiLabel,
  type ScannedWifi,
} from '../utils/mockWifiScan';
import type { BoardMenuId, BoardWifiSettings, DeviceLiveEnroll, DeviceLiveUser } from '../types';

export type BoardWifiField = 'password' | null;

type Props = {
  menuId: BoardMenuId;
  selectedIndex: number;
  wifi: BoardWifiSettings;
  wifiConnecting?: boolean;
  wifiOk?: boolean | null;
  onWifiChange?: (patch: Partial<BoardWifiSettings>) => void;
  keyboardField?: BoardWifiField;
  onKeyboardFieldChange?: (field: BoardWifiField) => void;
  onNavigate?: (menuId: BoardMenuId) => void;
  /** Live serial — ใช้แทน mock scan / enroll text */
  liveMode?: boolean;
  liveEnroll?: DeviceLiveEnroll;
  liveWifiScan?: ScannedWifi[] | null;
  liveWifiScanning?: boolean;
  liveUsers?: DeviceLiveUser[] | null;
  liveUsersLoading?: boolean;
  liveUsersStatus?: string;
  liveUsersCategory?: UserListCategory | null;
  mockUsers?: DeviceLiveUser[];
  usersListCategory?: UserListCategory | null;
  onOpenUsersList?: (category: UserListCategory) => void;
};

const USERS_CATEGORY_ICONS: Record<UserListCategory, typeof HiUser> = {
  student: HiAcademicCap,
  teacher: HiUser,
  special_teacher: HiSparkles,
  staff: HiBriefcase,
};

export default function BoardMenuScreen({
  menuId,
  wifi,
  wifiConnecting,
  wifiOk,
  onWifiChange,
  keyboardField: keyboardFieldProp,
  onKeyboardFieldChange,
  onNavigate,
  liveMode = false,
  liveEnroll,
  liveWifiScan,
  liveWifiScanning,
  liveUsers,
  liveUsersLoading,
  liveUsersStatus,
  liveUsersCategory,
  mockUsers = [],
  usersListCategory,
  onOpenUsersList,
}: Props) {
  const [localKeyboardField, setLocalKeyboardField] = useState<BoardWifiField>(null);
  const [scanning, setScanning] = useState(false);
  const [scanResults, setScanResults] = useState<ScannedWifi[] | null>(null);
  const [connectTarget, setConnectTarget] = useState<ScannedWifi | null>(null);
  const keyboardField = keyboardFieldProp ?? localKeyboardField;
  const setKeyboardField = onKeyboardFieldChange ?? setLocalKeyboardField;

  const runWifiScan = () => {
    setScanning(true);
    setScanResults(null);
    setConnectTarget(null);
    setKeyboardField(null);
    window.setTimeout(() => {
      setScanResults(MOCK_WIFI_NETWORKS);
      setScanning(false);
    }, 1200);
  };

  useEffect(() => {
    if (menuId !== 'wifi' || liveMode) {
      if (!liveMode) {
        setScanResults(null);
        setScanning(false);
      }
      setConnectTarget(null);
      return;
    }
    runWifiScan();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- scan once per WiFi screen entry
  }, [menuId, liveMode]);

  const menuIcon = (id: (typeof BOARD_SETTINGS_MENU_ITEMS)[number]['id']) => {
    switch (id) {
      case 'wifi':
        return HiWifi;
      case 'enroll':
        return HiArrowUpTray;
      case 'users':
        return HiUserGroup;
      default:
        return HiWifi;
    }
  };

  const handleSelectNetwork = (entry: ScannedWifi) => {
    onWifiChange?.({ ssid: entry.ssid });
    setKeyboardField(null);

    if (entry.open) {
      onWifiChange?.({ ssid: entry.ssid, password: '' });
      setConnectTarget(null);
      return;
    }

    setConnectTarget(entry);
    if (wifi.ssid === entry.ssid && wifi.password) {
      onWifiChange?.({ ssid: entry.ssid, password: wifi.password });
    } else {
      onWifiChange?.({ ssid: entry.ssid, password: '' });
    }
  };

  const handleCancelConnect = () => {
    setConnectTarget(null);
    setKeyboardField(null);
  };

  const handleKey = (key: string) => {
    if (!keyboardField || !onWifiChange || !connectTarget) return;
    if (key === 'OK') {
      setKeyboardField(null);
      return;
    }
    const current = wifi.password;
    if (key === '⌫') {
      onWifiChange({ password: current.slice(0, -1) });
      return;
    }
    onWifiChange({ password: current + key });
  };

  if (menuId === 'settings') {
    return (
      <>
        {BOARD_SETTINGS_MENU_ITEMS.map((item, i) => {
          const Icon = menuIcon(item.id);
          const rect = fwMenuTileRect(i);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate?.(item.id)}
              aria-label={item.label}
              className="absolute z-[1] flex items-center justify-center border transition hover:opacity-90"
              style={{
                ...rect,
                borderRadius: 10,
                backgroundColor: DEVICE_SCREEN.surface,
                borderColor: DEVICE_SCREEN.border,
              }}
            >
              <Icon className="h-5 w-5 shrink-0" style={{ color: DEVICE_SCREEN.title }} />
            </button>
          );
        })}
      </>
    );
  }

  if (menuId === 'enroll') {
    const enrollStatus = liveEnroll?.status ?? 'วางนิ้วบนเซ็นเซอร์';
    const enrollDetail = liveEnroll?.detail ?? '';
    const phase = liveEnroll?.phase ?? 'wait_finger1';
    const step1Active = phase === 'wait_finger1';
    const step1Done =
      phase === 'wait_release' || phase === 'wait_finger2' || phase === 'done';
    const liftActive = phase === 'wait_release';
    const liftDone = phase === 'wait_finger2' || phase === 'done';
    const step2Active = phase === 'wait_finger2';
    const step2Done = phase === 'done';
    const isDone = phase === 'done';
    const isFail = phase === 'fail';

    return (
      <>
        <div
          className="pointer-events-none absolute inset-x-0 z-[1] flex items-center justify-center gap-6 text-[13px] font-bold"
          style={{ top: `${(FW.enroll.stepsY / FW.H) * 100}%` }}
        >
          <span
            className="rounded-md px-1.5 py-0.5"
            style={{
              color: step1Active || step1Done ? DEVICE_SCREEN.title : DEVICE_SCREEN.muted,
              backgroundColor: step1Active ? `${DEVICE_SCREEN.surface}80` : 'transparent',
            }}
          >
            1
          </span>
          <HiArrowUp
            className="h-4 w-4"
            style={{ color: liftActive || liftDone ? DEVICE_SCREEN.title : DEVICE_SCREEN.muted }}
          />
          <span
            className="rounded-md px-1.5 py-0.5"
            style={{
              color: step2Active || step2Done ? DEVICE_SCREEN.title : DEVICE_SCREEN.muted,
              backgroundColor: step2Active ? `${DEVICE_SCREEN.surface}80` : 'transparent',
            }}
          >
            2
          </span>
        </div>

        <p
          className="pointer-events-none absolute inset-x-0 z-[1] px-4 text-center text-[11px] font-medium leading-snug"
          style={{
            top: `${(FW.enroll.statusY / FW.H) * 100}%`,
            color: isDone ? DEVICE_SCREEN.wifiOk : isFail ? DEVICE_SCREEN.wifiBad : DEVICE_SCREEN.status,
          }}
        >
          {enrollStatus}
        </p>
        {enrollDetail ? (
          <p
            className="pointer-events-none absolute inset-x-0 z-[1] px-4 text-center text-[11px] leading-snug"
            style={{
              top: `${(FW.enroll.detailY / FW.H) * 100}%`,
              color: isDone ? DEVICE_SCREEN.wifiOk : isFail ? DEVICE_SCREEN.wifiBad : DEVICE_SCREEN.muted,
            }}
          >
            {enrollDetail}
          </p>
        ) : null}
        <button
          type="button"
          className="absolute z-[1] flex items-center justify-center text-[11px] font-bold text-white"
          style={{
            ...fwRect(fwCenterX(FW.enroll.retryW), FW.H - FW.enroll.retryBottom - FW.enroll.retryH, FW.enroll.retryW, FW.enroll.retryH),
            borderRadius: 8,
            backgroundColor: DEVICE_SCREEN.btn,
          }}
        >
          เริ่มใหม่
        </button>
      </>
    );
  }

  if (menuId === 'users') {
    return (
      <>
        <DeviceIconButton
          x={FW.users.refresh.x}
          y={FW.users.refresh.y}
          title="โหลดใหม่"
          disabled={liveMode}
        >
          <HiArrowPath className="h-4 w-4" />
        </DeviceIconButton>

        {USER_LIST_CATEGORIES.map((cat, i) => {
          const Icon = USERS_CATEGORY_ICONS[cat.id];
          return (
            <button
              key={cat.id}
              type="button"
              disabled={liveMode}
              onClick={() => onOpenUsersList?.(cat.id)}
              aria-label={cat.label}
              className="absolute z-[1] flex items-center justify-center border transition hover:opacity-90 disabled:cursor-default"
              style={{
                ...fwUsersCategoryRect(i),
                borderRadius: 10,
                backgroundColor: DEVICE_SCREEN.surface,
                borderColor: DEVICE_SCREEN.border,
              }}
            >
              <Icon className="h-8 w-8 shrink-0" style={{ color: DEVICE_SCREEN.title }} />
            </button>
          );
        })}
      </>
    );
  }

  if (menuId === 'users_list') {
    const loading = liveMode ? !!liveUsersLoading : false;
    const category = liveMode ? liveUsersCategory : usersListCategory;
    const allUsers = liveMode ? liveUsers ?? [] : mockUsers;
    const users = liveMode ? allUsers : filterUsersByCategory(allUsers, category ?? null);
    const categoryLabel = USER_LIST_CATEGORIES.find((c) => c.id === category)?.label ?? '';
    const statusLabel = liveMode
      ? liveUsersStatus ?? (loading ? 'กำลังโหลด...' : '')
      : category
        ? `${categoryLabel}: ${users.length} คน`
        : '';

    return (
      <>
        <DeviceIconButton
          x={FW.usersList.refresh.x}
          y={FW.usersList.refresh.y}
          title="โหลดใหม่"
          disabled={liveMode || loading}
        >
          <HiArrowPath className={cn('h-4 w-4', loading && 'animate-spin')} />
        </DeviceIconButton>

        {statusLabel ? (
          <p
            className="pointer-events-none absolute inset-x-0 z-[1] text-center text-[10px] font-medium"
            style={{
              top: `${(FW.usersList.statusY / FW.H) * 100}%`,
              color: DEVICE_SCREEN.muted,
            }}
          >
            {statusLabel}
          </p>
        ) : null}

        <ul
          className="absolute z-[1] overflow-y-auto border"
          style={{
            ...fwRect(
              fwCenterX(FW.usersList.listW),
              FW.usersList.listTop,
              FW.usersList.listW,
              FW.usersList.listH,
            ),
            borderRadius: 8,
            backgroundColor: DEVICE_SCREEN.surface,
            borderColor: DEVICE_SCREEN.border,
          }}
        >
          {loading ? null : users.length === 0 ? (
            <li className="px-2 py-2 text-[10px]" style={{ color: DEVICE_SCREEN.muted }}>
              ไม่มีรายชื่อในหมวดนี้
            </li>
          ) : (
            users.map((user) => (
              <li
                key={user.templateId}
                className="border-b px-2 py-1 text-[10px] last:border-b-0"
                style={{ borderColor: `${DEVICE_SCREEN.border}80`, color: DEVICE_SCREEN.text }}
              >
                <span className="font-mono font-bold" style={{ color: DEVICE_SCREEN.title }}>
                  #{String(user.templateId).padStart(3, '0')}
                </span>{' '}
                <span className="font-semibold">{user.name}</span>
              </li>
            ))
          )}
        </ul>
      </>
    );
  }

  if (menuId === 'wifi') {
    const isConnected = wifiOk === true;
    const showKeyboard = !liveMode && keyboardField === 'password' && !!onWifiChange && !!connectTarget;
    const showConnectPanel = !liveMode && !!connectTarget && !showKeyboard;
    const listHeight = showConnectPanel ? FW.wifi.listH - FW.wifi.panelH - 8 : FW.wifi.listH;
    const effectiveScanning = liveMode ? !!liveWifiScanning : scanning;
    const effectiveScanResults = liveMode ? liveWifiScan : scanResults;

    return (
      <>
        <DeviceIconButton
          x={FW.wifi.refresh.x}
          y={FW.wifi.refresh.y}
          title="ค้นหา WiFi ใหม่"
          disabled={effectiveScanning || liveMode}
          onClick={runWifiScan}
        >
          <HiArrowPath className={cn('h-4 w-4', effectiveScanning && 'animate-spin')} />
        </DeviceIconButton>

        <ul
          className="absolute z-[1] overflow-y-auto border"
          style={{
            ...fwRect(fwCenterX(FW.wifi.listW), FW.wifi.listTop, FW.wifi.listW, listHeight),
            borderRadius: 8,
            backgroundColor: DEVICE_SCREEN.surface,
            borderColor: DEVICE_SCREEN.border,
          }}
        >
          {effectiveScanning
            ? null
            : effectiveScanResults?.map((entry) => {
                const connected = isConnected && wifi.ssid === entry.ssid;
                return (
                  <li key={entry.ssid}>
                    <button
                      type="button"
                      onClick={() => handleSelectNetwork(entry)}
                      className="flex w-full items-center gap-1.5 px-2 py-1 text-left text-[10px] hover:bg-white/60"
                    >
                      {connected ? (
                        <HiCheckCircle
                          className="h-3 w-3 shrink-0"
                          style={{ color: DEVICE_SCREEN.wifiOk }}
                        />
                      ) : (
                        <HiWifi className="h-3 w-3 shrink-0" style={{ color: DEVICE_SCREEN.title }} />
                      )}
                      <span
                        className="truncate font-semibold"
                        style={{ color: connected ? DEVICE_SCREEN.wifiOk : DEVICE_SCREEN.text }}
                      >
                        {formatScannedWifiLabel(entry)}
                      </span>
                    </button>
                  </li>
                );
              })}
        </ul>

        {showConnectPanel && connectTarget && (
          <div
            className="absolute z-[1] border p-2"
            style={{
              ...fwRect(fwCenterX(FW.wifi.listW), FW.wifi.panelTop, FW.wifi.listW, FW.wifi.panelH),
              borderRadius: 8,
              backgroundColor: DEVICE_SCREEN.surface,
              borderColor: DEVICE_SCREEN.border,
            }}
          >
            <p className="truncate text-[10px] font-bold" style={{ color: DEVICE_SCREEN.text }}>
              {connectTarget.ssid}
            </p>
            <button
              type="button"
              onClick={() => setKeyboardField('password')}
              className="mt-1 w-full rounded-lg px-2 py-1 text-left"
              style={{ backgroundColor: DEVICE_SCREEN.bg, border: `1px solid ${DEVICE_SCREEN.border}` }}
            >
              <p className="text-[8px] font-medium uppercase tracking-wide" style={{ color: DEVICE_SCREEN.muted }}>
                รหัสผ่าน WiFi
              </p>
              <p className="font-mono text-[10px] font-semibold tracking-widest" style={{ color: DEVICE_SCREEN.text }}>
                {wifi.password ? '•'.repeat(Math.min(wifi.password.length, 10)) : '...'}
              </p>
            </button>
            <div className="mt-1 flex gap-1">
              <button
                type="button"
                className="flex-1 rounded-lg py-1 text-[9px] font-bold text-white"
                style={{ backgroundColor: DEVICE_SCREEN.btn }}
              >
                เชื่อมต่อ
              </button>
              <button
                type="button"
                onClick={handleCancelConnect}
                className="flex-1 rounded-lg border py-1 text-[9px] font-bold"
                style={{ borderColor: DEVICE_SCREEN.border, color: DEVICE_SCREEN.text }}
              >
                ยกเลิก
              </button>
            </div>
          </div>
        )}

        {showKeyboard && (
          <BoardOnScreenKeyboard
            onKey={handleKey}
            className="z-20"
            style={{ height: `${(FW.wifi.kbH / FW.H) * 100}%` }}
          />
        )}

        {(scanning || wifiConnecting) && (
          <p
            className="pointer-events-none absolute inset-x-0 z-[1] text-center text-[10px]"
            style={{
              top: `${((FW.wifi.listTop - 14) / FW.H) * 100}%`,
              color: DEVICE_SCREEN.muted,
            }}
          >
            {scanning ? 'กำลังค้นหา WiFi...' : 'กำลังเชื่อม WiFi...'}
          </p>
        )}
      </>
    );
  }

  return null;
}
