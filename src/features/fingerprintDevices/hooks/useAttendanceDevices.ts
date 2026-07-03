import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { logActivity } from '@/lib/activityLogger';
import type { AttendanceDevice, AttendanceDeviceInput } from '../types';

const COLLECTION = 'attendance_devices';

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text.trim()));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function mapDevice(id: string, data: Record<string, unknown>): AttendanceDevice {
  return {
    id,
    name: String(data.name ?? id),
    apiKeyHash: String(data.apiKeyHash ?? ''),
    active: data.active !== false,
    location: data.location ? String(data.location) : undefined,
    firmwareVersion: data.firmwareVersion ? String(data.firmwareVersion) : undefined,
    macAddress: data.macAddress ? String(data.macAddress) : undefined,
    lastSeenAt: data.lastSeenAt ? String(data.lastSeenAt) : undefined,
    notes: data.notes ? String(data.notes) : undefined,
    updatedAt: data.updatedAt ? String(data.updatedAt) : undefined,
    createdAt: data.createdAt ? String(data.createdAt) : undefined,
  };
}

export function useAttendanceDevices() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['attendance_devices'],
    queryFn: async () => {
      const snap = await getDocs(collection(db, COLLECTION));
      return snap.docs
        .map((d) => mapDevice(d.id, d.data() as Record<string, unknown>))
        .sort((a, b) => a.id.localeCompare(b.id, 'th'));
    },
  });

  const upsertMutation = useMutation({
    mutationFn: async ({
      input,
      apiKey,
    }: {
      input: AttendanceDeviceInput;
      apiKey?: string;
    }) => {
      const ref = doc(db, COLLECTION, input.id.trim());
      const payload: Record<string, unknown> = {
        name: input.name.trim(),
        active: input.active,
        location: input.location?.trim() || null,
        notes: input.notes?.trim() || null,
        updatedAt: new Date().toISOString(),
      };
      if (apiKey?.trim()) {
        payload.apiKeyHash = await sha256Hex(apiKey);
      }
      const existing = query.data?.find((d) => d.id === input.id.trim());
      if (!existing) {
        payload.createdAt = new Date().toISOString();
        if (!payload.apiKeyHash) {
          throw new Error('ต้องระบุ API Key สำหรับอุปกรณ์ใหม่');
        }
      }
      await setDoc(ref, payload, { merge: true });
      await logActivity({
        action: existing ? 'update' : 'create',
        category: 'data',
        status: 'success',
        targetId: input.id,
        detail: `attendance device ${input.name}`,
      });
      return { apiKey: apiKey?.trim() };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['attendance_devices'] }),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      await updateDoc(doc(db, COLLECTION, id), {
        active,
        updatedAt: new Date().toISOString(),
      });
      await logActivity({
        action: 'update',
        category: 'data',
        status: 'success',
        targetId: id,
        detail: active ? 'device activated' : 'device deactivated',
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['attendance_devices'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await deleteDoc(doc(db, COLLECTION, id));
      await logActivity({
        action: 'delete',
        category: 'data',
        status: 'success',
        targetId: id,
        detail: 'attendance device removed',
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['attendance_devices'] }),
  });

  const touchLastSeenMutation = useMutation({
    mutationFn: async (id: string) => {
      await updateDoc(doc(db, COLLECTION, id), {
        lastSeenAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['attendance_devices'] }),
  });

  return {
    devices: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    upsertDevice: upsertMutation.mutateAsync,
    isSaving: upsertMutation.isPending,
    toggleActive: toggleActiveMutation.mutateAsync,
    deleteDevice: deleteMutation.mutateAsync,
    touchLastSeen: touchLastSeenMutation.mutateAsync,
    generateApiKey: () => crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '').slice(0, 8),
  };
}