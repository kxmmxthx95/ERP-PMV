import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  HiArrowLeft,
  HiBars3BottomLeft,
  HiWifi,
} from 'react-icons/hi2';
import BoardMenuScreen from './BoardMenuScreen';
import { DeviceIconButton, DeviceScreenTitle } from './DeviceScreenChrome';
import { DEVICE_SCREEN } from '../deviceScreenTheme';
import { FW, fwRect } from '../deviceScreenLayout';
import { getScreenContent } from '../utils/deviceScreenStates';
import type {
  BoardMenuId,
  BoardWifiSettings,
  DeviceLiveEnroll,
  DeviceLiveUser,
  SimulatorScreenState,
  UserListCategory,
} from '../types';
import { USER_LIST_CATEGORIES } from '../utils/userListCategory';
import type { ScannedWifi } from '../utils/mockWifiScan';

type Props = {
  state: SimulatorScreenState;
  statusOverride?: string;
  nameOverride?: string;
  timeOverride?: string;
  wifiOkOverride?: boolean;
  className?: string;
  boardMenuId?: BoardMenuId;
  boardSelectedIndex?: number;
  boardWifi?: BoardWifiSettings;
  boardWifiConnecting?: boolean;
  boardWifiOk?: boolean | null;
  onBoardMenuChange?: (menuId: BoardMenuId) => void;
  onBoardWifiChange?: (patch: Partial<BoardWifiSettings>) => void;
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
  readOnly?: boolean;
};

export default function DeviceScreenSimulator({
  state,
  statusOverride,
  nameOverride,
  timeOverride,
  wifiOkOverride,
  className,
  boardMenuId = 'home',
  boardSelectedIndex = 0,
  boardWifi = { ssid: '', password: '' },
  boardWifiConnecting,
  boardWifiOk,
  onBoardMenuChange,
  onBoardWifiChange,
  liveMode = false,
  liveEnroll,
  liveWifiScan,
  liveWifiScanning,
  liveUsers,
  liveUsersLoading,
  liveUsersStatus,
  liveUsersCategory,
  mockUsers,
  usersListCategory,
  onOpenUsersList,
  readOnly = false,
}: Props) {
  const [keyboardField, setKeyboardField] = useState<null | 'password'>(null);

  useEffect(() => {
    if (boardMenuId !== 'wifi') setKeyboardField(null);
  }, [boardMenuId]);

  const isMenuView =
    boardMenuId === 'settings' ||
    boardMenuId === 'wifi' ||
    boardMenuId === 'enroll' ||
    boardMenuId === 'users' ||
    boardMenuId === 'users_list';

  const openSettings = () => {
    if (readOnly) return;
    onBoardMenuChange?.('settings');
  };
  const goBack = () => {
    if (readOnly) return;
    if (boardMenuId === 'users_list') onBoardMenuChange?.('users');
    else if (boardMenuId === 'wifi' || boardMenuId === 'enroll' || boardMenuId === 'users')
      onBoardMenuChange?.('settings');
    else onBoardMenuChange?.('home');
  };

  const usersListTitle =
    USER_LIST_CATEGORIES.find(
      (c) => c.id === (boardMenuId === 'users_list' ? usersListCategory ?? liveUsersCategory : null),
    )?.label ?? 'รายชื่อ';

  const content = getScreenContent(state, {
    status: statusOverride,
    name: nameOverride,
    time: timeOverride,
    wifiOk: wifiOkOverride ?? (boardWifiOk === true ? true : boardWifiOk === false ? false : undefined),
  });

  const wifiIndicatorOk =
    boardWifiOk === true ||
    (boardWifiOk == null && content.wifiOk);

  const wifiColor = boardWifiConnecting
    ? DEVICE_SCREEN.muted
    : wifiIndicatorOk
      ? DEVICE_SCREEN.wifiOk
      : DEVICE_SCREEN.wifiBad;

  const hasName = Boolean(content.name);
  const hasTime = Boolean(content.time);
  const statusY =
    !hasName && !hasTime ? FW.home.statusMidY : FW.home.statusMidY - 28;
  const nameY = FW.home.statusMidY;
  const timeY = FW.home.statusMidY + (hasName ? 24 : 0);

  return (
    <div className={cn('flex w-full flex-col gap-2', className)}>
      <div className="mx-auto w-full max-w-[340px] rounded-[28px] bg-gradient-to-b from-zinc-700 to-zinc-900 p-2.5 shadow-xl">
        <div
          className="relative w-full overflow-hidden"
          style={{
            aspectRatio: `${FW.W}/${FW.H}`,
            borderRadius: DEVICE_SCREEN.bezelRadius - 4,
            backgroundColor: DEVICE_SCREEN.bg,
          }}
        >
          {isMenuView ? (
            <>
              <DeviceIconButton x={FW.back.x} y={FW.back.y} onClick={goBack} title="กลับ">
                <HiArrowLeft className="h-4 w-4" />
              </DeviceIconButton>

              {boardMenuId === 'settings' && (
                <DeviceScreenTitle y={FW.menu.titleY}>เมนู</DeviceScreenTitle>
              )}

              {boardMenuId === 'wifi' && (
                <DeviceScreenTitle y={FW.wifi.titleY}>ตั้งค่า WiFi</DeviceScreenTitle>
              )}

              {boardMenuId === 'enroll' && (
                <>
                  <DeviceScreenTitle y={FW.enroll.titleY}>ลงทะเบียน</DeviceScreenTitle>
                  <DeviceScreenTitle y={FW.enroll.subtitleY} muted>
                    นักเรียน
                  </DeviceScreenTitle>
                </>
              )}

              {boardMenuId === 'users' && (
                <DeviceScreenTitle y={FW.users.titleY}>ผู้ใช้งาน</DeviceScreenTitle>
              )}

              {boardMenuId === 'users_list' && (
                <DeviceScreenTitle y={FW.usersList.titleY}>{usersListTitle}</DeviceScreenTitle>
              )}

              <BoardMenuScreen
                menuId={boardMenuId}
                selectedIndex={boardSelectedIndex}
                wifi={boardWifi}
                wifiConnecting={boardWifiConnecting}
                wifiOk={boardWifiOk}
                onWifiChange={readOnly ? undefined : onBoardWifiChange}
                keyboardField={keyboardField}
                onKeyboardFieldChange={setKeyboardField}
                onNavigate={readOnly ? undefined : onBoardMenuChange}
                liveMode={liveMode}
                liveEnroll={liveEnroll}
                liveWifiScan={liveWifiScan}
                liveWifiScanning={liveWifiScanning}
                liveUsers={liveUsers}
                liveUsersLoading={liveUsersLoading}
                liveUsersStatus={liveUsersStatus}
                liveUsersCategory={liveUsersCategory}
                mockUsers={mockUsers}
                usersListCategory={usersListCategory}
                onOpenUsersList={readOnly ? undefined : onOpenUsersList}
              />
            </>
          ) : (
            <>
              <DeviceIconButton
                x={FW.back.x}
                y={FW.home.headerY}
                onClick={openSettings}
                title="เมนู"
              >
                <HiBars3BottomLeft className="h-4 w-4" />
              </DeviceIconButton>

              <DeviceScreenTitle y={FW.home.titleY}>{content.title}</DeviceScreenTitle>

              <div
                className="absolute z-[1] flex items-center justify-center"
                style={{
                  ...fwRect(FW.W - FW.home.wifiRight - 14, FW.home.headerY + 11, 14, 14),
                }}
              >
                <HiWifi className="h-3.5 w-3.5" style={{ color: wifiColor }} />
              </div>


              <p
                className="pointer-events-none absolute inset-x-0 z-[1] px-2 text-center text-[13px] font-bold leading-snug"
                style={{
                  top: `${(statusY / FW.H) * 100}%`,
                  color: DEVICE_SCREEN.status,
                }}
              >
                {content.status}
              </p>

              {hasName ? (
                <p
                  className="pointer-events-none absolute inset-x-0 z-[1] px-2 text-center text-[13px] font-bold leading-snug"
                  style={{
                    top: `${(nameY / FW.H) * 100}%`,
                    color: DEVICE_SCREEN.name,
                  }}
                >
                  {content.name}
                </p>
              ) : null}

              {hasTime ? (
                <p
                  className="pointer-events-none absolute inset-x-0 z-[1] px-2 text-center text-[11px] font-medium leading-snug"
                  style={{
                    top: `${(timeY / FW.H) * 100}%`,
                    color: DEVICE_SCREEN.time,
                  }}
                >
                  {content.time}
                </p>
              ) : null}
            </>
          )}
        </div>

        <div className="mx-auto mt-1.5 h-1 w-14 rounded-full bg-zinc-600/80" />
      </div>
    </div>
  );
}
