#!/usr/bin/env node
/**
 * สร้าง apiKeyHash สำหรับลงทะเบียนอุปกรณ์ใน Firestore
 *
 * Usage:
 *   node scripts/register-fingerprint-device.mjs gate-01 "your-secret-key"
 *
 * สร้างเอกสาร attendance_devices/{deviceId} ใน Firestore
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(resolve(dirname(fileURLToPath(import.meta.url)), '../src/functions/package.json'));
const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const [deviceId, apiKey, deviceName] = process.argv.slice(2);

if (!deviceId || !apiKey) {
  console.error('Usage: node scripts/register-fingerprint-device.mjs <deviceId> <apiKey> [name]');
  process.exit(1);
}

const hash = createHash('sha256').update(apiKey.trim()).digest('hex');

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let projectId = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;
if (!projectId) {
  try {
    const rc = JSON.parse(readFileSync(resolve(rootDir, '.firebaserc'), 'utf8'));
    projectId = rc.projects?.default;
  } catch {
    /* ignore */
  }
}

try {
  initializeApp({
    credential: applicationDefault(),
    ...(projectId ? { projectId } : {}),
  });
} catch {
  initializeApp(projectId ? { projectId } : undefined);
}

const db = getFirestore();

await db.collection('attendance_devices').doc(deviceId.trim()).set(
  {
    name: (deviceName || deviceId).trim(),
    apiKeyHash: hash,
    active: true,
    updatedAt: new Date().toISOString(),
  },
  { merge: true },
);

console.log('Registered attendance_devices/' + deviceId.trim());
console.log('apiKeyHash:', hash);
console.log('');
console.log('ตั้งค่าใน firmware config.h:');
console.log('  PMV_DEVICE_ID="' + deviceId.trim() + '"');
console.log('  PMV_DEVICE_API_KEY="' + apiKey.trim() + '"');
