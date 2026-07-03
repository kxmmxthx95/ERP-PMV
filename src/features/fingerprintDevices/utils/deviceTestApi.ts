import type { DeviceTestAction } from '../types';

const DEFAULT_API_URL = 'https://pmv1-90180.web.app/api/device-fingerprint';

export type DeviceApiTestResult = {
  ok: boolean;
  status: number;
  message: string;
  displayName?: string;
  action?: string;
  raw?: unknown;
};

export async function testDeviceFingerprintApi(params: {
  deviceId: string;
  apiKey: string;
  fingerprintTemplateId: number;
  action?: DeviceTestAction;
  apiUrl?: string;
}): Promise<DeviceApiTestResult> {
  const url = params.apiUrl?.trim() || DEFAULT_API_URL;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${params.apiKey.trim()}`,
    },
    body: JSON.stringify({
      deviceId: params.deviceId.trim(),
      fingerprintTemplateId: params.fingerprintTemplateId,
      action: params.action ?? 'toggle',
    }),
  });

  let payload: Record<string, unknown> = {};
  try {
    payload = (await res.json()) as Record<string, unknown>;
  } catch {
    payload = {};
  }

  const success = Boolean(payload.success);
  const message = String(payload.message ?? (success ? 'OK' : `HTTP ${res.status}`));

  return {
    ok: res.ok && success,
    status: res.status,
    message,
    displayName: payload.displayName ? String(payload.displayName) : undefined,
    action: payload.action ? String(payload.action) : undefined,
    raw: payload,
  };
}
