import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { HiFingerPrint, HiOutlinePlus } from 'react-icons/hi2';
import { useAttendanceDevices } from './hooks/useAttendanceDevices';
import { useBoardWifiSettings } from './hooks/useBoardWifiSettings';
import { useDeviceSerialBridge } from './hooks/useDeviceSerialBridge';
import DeviceScreenSimulator from './components/DeviceScreenSimulator';
import BoardMenuPanel from './components/BoardMenuPanel';
import DeviceFormModal from './components/DeviceFormModal';
import SerialLiveControls from './components/SerialLiveControls';
import StudentFingerEnrollPanel from './components/StudentFingerEnrollPanel';
import RegisteredUsersPanel from './components/RegisteredUsersPanel';
import { useFingerprintRegisteredUsers } from './hooks/useFingerprintRegisteredUsers';
import { useFingerprintStudents } from './hooks/useFingerprintStudents';
import type { AttendanceDevice, BoardMenuId, UserListCategory } from './types';

export default function FingerprintDeviceManagerPage() {
  const { devices, upsertDevice, isSaving, generateApiKey } = useAttendanceDevices();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState<AttendanceDevice | null>(null);
  const [lastApiKeyCreated, setLastApiKeyCreated] = useState<string | null>(null);
  const [boardMenuId, setBoardMenuId] = useState<BoardMenuId>('home');
  const [usersListCategory, setUsersListCategory] = useState<UserListCategory | null>(null);
  const [boardSelectedIndex, setBoardSelectedIndex] = useState(0);
  const [headerRightEl, setHeaderRightEl] = useState<HTMLElement | null>(null);
  const [headerMobileActionsEl, setHeaderMobileActionsEl] = useState<HTMLElement | null>(null);
  const [headerCenterMobileEl, setHeaderCenterMobileEl] = useState<HTMLElement | null>(null);

  const selected = useMemo(
    () => devices.find((d) => d.id === selectedId) ?? devices[0] ?? null,
    [devices, selectedId],
  );

  const boardWifi = useBoardWifiSettings(selected?.id ?? null);
  const serial = useDeviceSerialBridge();
  const fingerprintStudents = useFingerprintStudents();
  const registeredUsersQuery = useFingerprintRegisteredUsers();

  const isLive = serial.isLive && serial.liveState;

  useEffect(() => {
    if (devices.length && !selectedId) {
      setSelectedId(devices[0].id);
    }
  }, [devices, selectedId]);

  useEffect(() => {
    setHeaderRightEl(document.getElementById('header-portal-right-actions'));
    setHeaderMobileActionsEl(document.getElementById('header-portal-mobile-actions'));
    setHeaderCenterMobileEl(document.getElementById('header-portal-center-mobile'));
  }, []);

  useEffect(() => {
    setBoardMenuId('home');
    setBoardSelectedIndex(0);
    setUsersListCategory(null);
  }, [selected?.id]);

  const simulatorState = isLive
    ? serial.liveState!.screenState
    : boardWifi.isConnecting
      ? 'wifi_connecting'
      : boardWifi.connectionOk === false
        ? 'wifi_fail'
        : 'ready';

  const simulatorMenuId: BoardMenuId = isLive ? serial.liveState!.boardMenuId : boardMenuId;

  const simulatorWifiOk = isLive ? serial.liveState!.wifiOk : boardWifi.connectionOk;
  const simulatorWifiConnecting = isLive ? serial.liveState!.wifiConnecting : boardWifi.isConnecting;

  const mockRegisteredUsers = registeredUsersQuery.data ?? [];

  const liveRegisteredUsers = isLive ? serial.liveState!.users : undefined;

  const openDeviceModal = () => {
    setEditingDevice(selected);
    setModalOpen(true);
  };

  const renderAddDeviceButton = () => (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      type="button"
      onClick={openDeviceModal}
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-900 bg-slate-900 text-white shadow-sm transition-colors hover:bg-slate-800 pointer-events-auto"
      title={selected ? 'จัดการเครื่อง' : 'เพิ่มเครื่อง'}
      aria-label={selected ? 'จัดการเครื่อง' : 'เพิ่มเครื่อง'}
    >
      <HiOutlinePlus className="h-4 w-4" />
    </motion.button>
  );

  const headerActionsPortal = (
    <>
      {headerRightEl && createPortal(renderAddDeviceButton(), headerRightEl)}
      {headerMobileActionsEl && createPortal(renderAddDeviceButton(), headerMobileActionsEl)}
      {headerCenterMobileEl && createPortal(
        <div className="pointer-events-none flex items-center gap-1.5 lg:hidden">
          <HiFingerPrint className="h-4 w-4 shrink-0 text-sky-600" />
          <span className="text-[13px] font-black leading-none tracking-tight text-slate-800 whitespace-nowrap">
            จัดการเครื่องสแกน
          </span>
        </div>,
        headerCenterMobileEl,
      )}
    </>
  );

  const handleSaveDevice = async (
    input: Parameters<typeof upsertDevice>[0]['input'],
    key?: string,
  ) => {
    await upsertDevice({ input, apiKey: key });
    if (key) {
      setLastApiKeyCreated(key);
      toast.success('บันทึกอุปกรณ์แล้ว — คัดลอก API Key ไปใส่ config.h', {
        description: key.slice(0, 8) + '…',
        duration: 8000,
      });
    } else {
      toast.success('อัปเดตอุปกรณ์แล้ว');
    }
    setSelectedId(input.id);
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#f5f5f7] text-slate-900">
      {headerActionsPortal}

      <div className="flex flex-1 overflow-y-auto p-4 lg:p-6">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 lg:flex-row lg:items-start lg:justify-center">
          <div className="flex w-full shrink-0 flex-col items-center gap-4 lg:max-w-[360px]">
            <SerialLiveControls
              status={serial.status}
              serialSupported={serial.serialSupported}
              error={serial.error}
              onConnect={serial.connect}
              onDisconnect={serial.disconnect}
            />

            <DeviceScreenSimulator
              state={simulatorState}
              statusOverride={isLive ? serial.liveState!.status : undefined}
              nameOverride={isLive ? serial.liveState!.name : undefined}
              timeOverride={isLive ? serial.liveState!.time : undefined}
              wifiOkOverride={isLive ? (serial.liveState!.wifiOk ?? undefined) : undefined}
              boardMenuId={simulatorMenuId}
              boardSelectedIndex={boardSelectedIndex}
              boardWifi={
                isLive && serial.liveState!.wifiSsid
                  ? { ...boardWifi.wifi, ssid: serial.liveState!.wifiSsid }
                  : boardWifi.wifi
              }
              boardWifiConnecting={simulatorWifiConnecting}
              boardWifiOk={simulatorWifiOk}
              onBoardMenuChange={(menuId) => {
                if (isLive) return;
                if (menuId === 'users') setUsersListCategory(null);
                setBoardMenuId(menuId);
                if (menuId === 'settings') setBoardSelectedIndex(0);
              }}
              onOpenUsersList={(category) => {
                if (isLive) return;
                setUsersListCategory(category);
                setBoardMenuId('users_list');
              }}
              usersListCategory={usersListCategory}
              onBoardWifiChange={isLive ? undefined : boardWifi.updateWifi}
              liveMode={!!isLive}
              liveEnroll={isLive ? serial.liveState!.enroll : undefined}
              liveWifiScan={isLive ? serial.liveState!.wifiScan : undefined}
              liveWifiScanning={isLive ? serial.liveState!.wifiScanning : undefined}
              liveUsers={liveRegisteredUsers}
              liveUsersLoading={isLive ? serial.liveState!.usersLoading : undefined}
              liveUsersStatus={isLive ? serial.liveState!.usersStatus : undefined}
              liveUsersCategory={isLive ? serial.liveState!.usersCategory : undefined}
              mockUsers={mockRegisteredUsers}
              readOnly={!!isLive}
            />
            {selected ? (
              <div className="w-full max-w-[340px] text-center text-[11px] text-slate-500">
                {isLive ? (
                  <>
                    <span className="font-bold text-emerald-700">Live</span>
                    {' — mirror จากบอร์ดจริง'}
                  </>
                ) : (
                  <>
                    กำลังจำลอง: <span className="font-bold text-slate-800">{selected.name}</span>
                  </>
                )}
                <span className="mt-0.5 block font-mono text-[10px] text-slate-400">{selected.id}</span>
                {!selected.active && (
                  <span className="mt-1 block text-amber-600">อุปกรณ์นี้ถูกปิดใช้งานใน Firestore</span>
                )}
              </div>
            ) : null}

            {lastApiKeyCreated && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-[340px] rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900"
              >
                <p className="font-bold">API Key ล่าสุด (คัดลอกไป config.h)</p>
                <code className="mt-1 block break-all font-mono text-[10px]">{lastApiKeyCreated}</code>
              </motion.div>
            )}
          </div>

          <div className="min-w-0 flex-1 lg:max-w-md">
            <BoardMenuPanel
              deviceId={selected?.id ?? null}
              menuId={isLive ? simulatorMenuId : boardMenuId}
              selectedIndex={boardSelectedIndex}
              onMenuIdChange={setBoardMenuId}
              onSelectedIndexChange={setBoardSelectedIndex}
              wifi={boardWifi.wifi}
              onWifiChange={boardWifi.updateWifi}
              isConnecting={simulatorWifiConnecting}
              connectionOk={simulatorWifiOk}
              onSimulateConnect={boardWifi.simulateConnect}
              readOnly={!!isLive}
              enrollPanel={
                <StudentFingerEnrollPanel
                  students={fingerprintStudents.students}
                  isLoading={fingerprintStudents.isLoading}
                  isUpdating={fingerprintStudents.isUpdating}
                  onSaveTemplate={(uid, templateId) =>
                    fingerprintStudents.updateTemplateId({ uid, fingerprintTemplateId: templateId })
                  }
                  liveEnroll={isLive ? serial.liveState!.enroll : undefined}
                  isLive={!!isLive}
                />
              }
              usersPanel={
                <RegisteredUsersPanel
                  users={isLive ? liveRegisteredUsers ?? mockRegisteredUsers : mockRegisteredUsers}
                  isLoading={
                    isLive
                      ? !!serial.liveState!.usersLoading
                      : registeredUsersQuery.isLoading
                  }
                  statusLabel={
                    isLive
                      ? serial.liveState!.usersStatus
                      : mockRegisteredUsers.length > 0
                        ? `ทั้งหมด ${mockRegisteredUsers.length} คน`
                        : undefined
                  }
                  selectedCategory={isLive ? serial.liveState!.usersCategory : undefined}
                  isLive={!!isLive}
                />
              }
            />
          </div>
        </div>
      </div>

      <DeviceFormModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingDevice(null);
        }}
        initial={editingDevice}
        onSubmit={handleSaveDevice}
        generateApiKey={generateApiKey}
        isSaving={isSaving}
      />
    </div>
  );
}
