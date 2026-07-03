import { cn } from '@/lib/utils';
import {
  HiArrowPath,
  HiBell,
  HiFingerPrint,
  HiPlay,
  HiPower,
  HiSignal,
  HiTrash,
  HiWifi,
} from 'react-icons/hi2';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SCREEN_STATE_OPTIONS } from '../utils/deviceScreenStates';
import type {
  AttendanceDevice,
  DeviceCommand,
  DeviceTestAction,
  FingerprintStaffUser,
  SimulatorScreenState,
} from '../types';

type Props = {
  device: AttendanceDevice | null;
  screenState: SimulatorScreenState;
  onScreenStateChange: (state: SimulatorScreenState) => void;
  onCommand: (cmd: DeviceCommand) => void;
  apiKey: string;
  onApiKeyChange: (v: string) => void;
  templateId: number;
  onTemplateIdChange: (v: number) => void;
  testAction: DeviceTestAction;
  onTestActionChange: (v: DeviceTestAction) => void;
  onSimulateScan: () => void;
  onTestApi: () => void;
  isTesting: boolean;
  staffUsers: FingerprintStaffUser[];
  statusMessage?: string;
  nameOverride?: string;
  timeOverride?: string;
};

const COMMAND_BUTTONS: { id: DeviceCommand; label: string; icon: typeof HiPower }[] = [
  { id: 'reboot', label: 'Reboot', icon: HiPower },
  { id: 'refresh_wifi', label: 'Refresh WiFi', icon: HiWifi },
  { id: 'test_beep', label: 'Beep', icon: HiBell },
  { id: 'enroll_mode', label: 'Enroll Mode', icon: HiFingerPrint },
  { id: 'sync_time', label: 'Sync Time', icon: HiArrowPath },
  { id: 'clear_screen', label: 'Clear Screen', icon: HiTrash },
];

function ControlSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-400">{title}</h3>
      {children}
    </section>
  );
}

export default function DeviceControlPanel({
  device,
  screenState,
  onScreenStateChange,
  onCommand,
  apiKey,
  onApiKeyChange,
  templateId,
  onTemplateIdChange,
  testAction,
  onTestActionChange,
  onSimulateScan,
  onTestApi,
  isTesting,
  staffUsers,
  statusMessage,
  nameOverride,
  timeOverride,
}: Props) {
  const mappedUsers = staffUsers.filter((u) => u.fingerprintTemplateId != null);

  return (
    <div className="flex flex-col gap-4">
      <ControlSection title="สถานะหน้าจอจำลอง">
        <div className="flex flex-wrap gap-2">
          {SCREEN_STATE_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => onScreenStateChange(opt.id)}
              className={cn(
                'rounded-full px-3 py-1.5 text-xs font-semibold transition-colors',
                screenState === opt.id
                  ? 'bg-sky-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {(statusMessage || nameOverride || timeOverride) && (
          <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
            {statusMessage && <p>ข้อความ: {statusMessage}</p>}
            {nameOverride && <p>ชื่อ: {nameOverride}</p>}
            {timeOverride && <p>เวลา: {timeOverride}</p>}
          </div>
        )}
      </ControlSection>

      <ControlSection title="ควบคุมบอร์ด (จำลอง)">
        <p className="mb-3 text-[11px] text-slate-500">
          คำสั่งด้านล่างอัปเดตหน้าจอจำลอง — การเชื่อมต่อ ESP32 แบบ remote จะเพิ่มในเฟสถัดไป
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {COMMAND_BUTTONS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              disabled={!device}
              onClick={() => onCommand(id)}
              className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-semibold text-slate-700 transition hover:border-sky-200 hover:bg-sky-50 disabled:opacity-40"
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      </ControlSection>

      <ControlSection title="จำลองการสแกน">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Template ID (1–127)</Label>
            <Input
              type="number"
              min={1}
              max={127}
              value={templateId}
              onChange={(e) => onTemplateIdChange(Number(e.target.value) || 1)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>เลือกจากผู้ใช้ที่ผูกแล้ว</Label>
            <Select
              value={mappedUsers.find((u) => u.fingerprintTemplateId === templateId)?.uid ?? ''}
              onValueChange={(uid) => {
                const user = mappedUsers.find((u) => u.uid === uid);
                if (user?.fingerprintTemplateId) onTemplateIdChange(user.fingerprintTemplateId);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="— เลือก —" />
              </SelectTrigger>
              <SelectContent>
                {mappedUsers.map((u) => (
                  <SelectItem key={u.uid} value={u.uid}>
                    #{u.fingerprintTemplateId} · {u.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <button
          type="button"
          disabled={!device}
          onClick={onSimulateScan}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-40"
        >
          <HiFingerPrint className="h-5 w-5" />
          จำลองสแกนนิ้ว
        </button>
      </ControlSection>

      <ControlSection title="ทดสอบ API จริง">
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>API Key (session — ไม่บันทึก)</Label>
            <Input
              type="password"
              value={apiKey}
              onChange={(e) => onApiKeyChange(e.target.value)}
              placeholder="ใส่ PMV_DEVICE_API_KEY"
              className="font-mono text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Action</Label>
            <Select value={testAction} onValueChange={(v) => onTestActionChange(v as DeviceTestAction)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="toggle">toggle</SelectItem>
                <SelectItem value="checkIn">checkIn</SelectItem>
                <SelectItem value="checkOut">checkOut</SelectItem>
                <SelectItem value="status">status</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <button
            type="button"
            disabled={!device || !apiKey.trim() || isTesting}
            onClick={onTestApi}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-sky-700 disabled:opacity-40"
          >
            <HiPlay className="h-5 w-5" />
            {isTesting ? 'กำลังทดสอบ...' : 'เรียก /api/device-fingerprint'}
          </button>
          {!device?.active && (
            <p className="flex items-center gap-1 text-[11px] text-amber-600">
              <HiSignal className="h-3.5 w-3.5" />
              อุปกรณ์นี้ถูกปิดใช้งานใน Firestore
            </p>
          )}
        </div>
      </ControlSection>
    </div>
  );
}
