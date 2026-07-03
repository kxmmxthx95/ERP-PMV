import { useEffect, useState } from 'react';
import FormModal from '@/components/ui/FormModal';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import type { AttendanceDevice, AttendanceDeviceInput } from '../types';

type Props = {
  open: boolean;
  onClose: () => void;
  initial?: AttendanceDevice | null;
  onSubmit: (input: AttendanceDeviceInput, apiKey?: string) => Promise<void>;
  generateApiKey: () => string;
  isSaving: boolean;
};

export default function DeviceFormModal({
  open,
  onClose,
  initial,
  onSubmit,
  generateApiKey,
  isSaving,
}: Props) {
  const isEdit = !!initial;
  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [active, setActive] = useState(true);
  const [apiKey, setApiKey] = useState('');
  const [regenerateKey, setRegenerateKey] = useState(false);

  useEffect(() => {
    if (!open) return;
    setId(initial?.id ?? '');
    setName(initial?.name ?? '');
    setLocation(initial?.location ?? '');
    setNotes(initial?.notes ?? '');
    setActive(initial?.active ?? true);
    setApiKey('');
    setRegenerateKey(!initial);
    if (!initial) {
      setApiKey(generateApiKey());
    }
  }, [open, initial, generateApiKey]);

  const handleSubmit = async () => {
    const trimmedId = id.trim();
    if (!trimmedId || !name.trim()) return;
    await onSubmit(
      {
        id: trimmedId,
        name: name.trim(),
        location: location.trim() || undefined,
        notes: notes.trim() || undefined,
        active,
      },
      !isEdit || regenerateKey ? apiKey.trim() : undefined,
    );
    onClose();
  };

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={isEdit ? 'แก้ไขเครื่องสแกน' : 'เพิ่มเครื่องสแกน'}
      subtitle="ลงทะเบียนอุปกรณ์ ESP32 + AS608 ใน Firestore"
      onSubmit={() => void handleSubmit()}
      submitLabel={isSaving ? 'กำลังบันทึก...' : isEdit ? 'บันทึก' : 'สร้างอุปกรณ์'}
      submitDisabled={isSaving || !id.trim() || !name.trim() || ((!isEdit || regenerateKey) && !apiKey.trim())}
      maxWidth="lg"
    >
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="device-id">Device ID</Label>
          <Input
            id="device-id"
            value={id}
            onChange={(e) => setId(e.target.value)}
            placeholder="gate-01"
            disabled={isEdit}
          />
          <p className="text-[11px] text-slate-400">ใช้ใน firmware: PMV_DEVICE_ID</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="device-name">ชื่อที่แสดง</Label>
          <Input
            id="device-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="ประตูหลัก"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="device-location">ตำแหน่งติดตั้ง</Label>
          <Input
            id="device-location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="อาคารเรียน ชั้น 1"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="device-notes">หมายเหตุ</Label>
          <Input
            id="device-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="MAC, ผู้ดูแล, ฯลฯ"
          />
        </div>

        <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
          <div>
            <p className="text-sm font-semibold text-slate-800">เปิดใช้งาน</p>
            <p className="text-[11px] text-slate-500">ปิดเพื่อบล็อกการเช็คอินจากเครื่องนี้</p>
          </div>
          <Switch checked={active} onCheckedChange={setActive} />
        </div>

        {isEdit ? (
          <div className="flex items-center justify-between rounded-xl border border-amber-100 bg-amber-50/60 px-3 py-2">
            <div>
              <p className="text-sm font-semibold text-amber-900">สร้าง API Key ใหม่</p>
              <p className="text-[11px] text-amber-700">ต้องอัปเดตใน config.h และ flash ใหม่</p>
            </div>
            <Switch checked={regenerateKey} onCheckedChange={setRegenerateKey} />
          </div>
        ) : null}

        {(!isEdit || regenerateKey) && (
          <div className="space-y-1.5">
            <Label htmlFor="device-api-key">API Key (แสดงครั้งเดียว)</Label>
            <div className="flex gap-2">
              <Input
                id="device-api-key"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="font-mono text-xs"
              />
              <button
                type="button"
                className="shrink-0 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                onClick={() => setApiKey(generateApiKey())}
              >
                สุ่มใหม่
              </button>
            </div>
            <p className="text-[11px] text-slate-400">ใส่ใน firmware: PMV_DEVICE_API_KEY</p>
          </div>
        )}
      </div>
    </FormModal>
  );
}
