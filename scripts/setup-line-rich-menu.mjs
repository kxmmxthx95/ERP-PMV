#!/usr/bin/env node
/**
 * สร้างและตั้ง Rich Menu เริ่มต้นสำหรับ LINE OA (PMV-ONE)
 *
 * Usage:
 *   node scripts/setup-line-rich-menu.mjs
 *   node scripts/setup-line-rich-menu.mjs --dry-run
 *   node scripts/setup-line-rich-menu.mjs --remove
 *   node scripts/setup-line-rich-menu.mjs --image public/line/rich-menu-staff.png
 *
 * Env (.env):
 *   LINE_CHANNEL_TOKEN
 *   VITE_LIFF_CHECKIN_ID  (หรือ LIFF_CHECKIN_ID)
 */

import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

function loadEnvFile(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

function parseArgs(argv) {
  const args = { dryRun: false, image: '', unlink: false, list: false, deleteOrphans: false, remove: false };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--dry-run') args.dryRun = true;
    else if (a === '--unlink') args.unlink = true;
    else if (a === '--list') args.list = true;
    else if (a === '--delete-all') args.deleteOrphans = true;
    else if (a === '--remove') args.remove = true;
    else if (a === '--image') {
      args.image = argv[i + 1] || '';
      i += 1;
    }
  }
  return args;
}

async function lineFetch(token, path, { method = 'GET', body, contentType = 'application/json', dataApi = false } = {}) {
  const host = dataApi ? 'https://api-data.line.me' : 'https://api.line.me';
  const headers = { Authorization: `Bearer ${token}` };
  let payload;
  if (body instanceof Buffer) {
    headers['Content-Type'] = contentType;
    payload = body;
  } else if (body !== undefined) {
    headers['Content-Type'] = contentType;
    payload = JSON.stringify(body);
  }
  const res = await fetch(`${host}${path}`, {
    method,
    headers,
    body: payload,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    throw new Error(`LINE API ${method} ${path} → HTTP ${res.status}: ${text}`);
  }
  return json;
}

async function ensureMenuImage(imagePath) {
  if (imagePath && existsSync(imagePath)) {
    return readFileSync(imagePath);
  }

  const defaultPath = resolve(ROOT, 'public/line/rich-menu-staff.png');
  if (existsSync(defaultPath)) {
    return readFileSync(defaultPath);
  }

  let sharp;
  try {
    sharp = (await import('sharp')).default;
  } catch {
    throw new Error(
      'ไม่พบไฟล์รูป Rich Menu — รัน npm install -D sharp หรือส่ง --image path/to.png (2500×843)',
    );
  }

  const width = 2500;
  const height = 843;
  const svg = `
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0f766e"/>
      <stop offset="100%" style="stop-color:#134e4a"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#bg)"/>
  <rect x="0" y="0" width="1666" height="843" fill="#059669" fill-opacity="0.35"/>
  <rect x="1666" y="0" width="834" height="843" fill="#047857" fill-opacity="0.35"/>
  <line x1="1666" y1="0" x2="1666" y2="843" stroke="white" stroke-opacity="0.25" stroke-width="4"/>
  <text x="833" y="380" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="96" font-weight="700">ลงเวลา</text>
  <text x="833" y="480" text-anchor="middle" fill="white" fill-opacity="0.85" font-family="Arial, sans-serif" font-size="48">เช็คอิน / เช็คเอาท์</text>
  <text x="2083" y="400" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="72" font-weight="700">เชื่อม</text>
  <text x="2083" y="490" text-anchor="middle" fill="white" fill-opacity="0.85" font-family="Arial, sans-serif" font-size="48">บัญชี PMV</text>
  <text x="1250" y="760" text-anchor="middle" fill="white" fill-opacity="0.5" font-family="Arial, sans-serif" font-size="36">PMV-ONE</text>
</svg>`;

  mkdirSync(dirname(defaultPath), { recursive: true });
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  writeFileSync(defaultPath, png);
  console.log(`[rich-menu] generated ${defaultPath}`);
  return png;
}

function buildRichMenu(liffId, portalUrl) {
  const liffUrl = `https://liff.line.me/${liffId}`;
  return {
    size: { width: 2500, height: 843 },
    selected: true,
    name: 'PMV-ONE Staff',
    chatBarText: 'เมนู PMV',
    areas: [
      {
        bounds: { x: 0, y: 0, width: 1666, height: 843 },
        action: {
          type: 'uri',
          label: 'ลงเวลา',
          uri: liffUrl,
        },
      },
      {
        bounds: { x: 1666, y: 0, width: 834, height: 843 },
        action: {
          type: 'message',
          label: 'เชื่อมบัญชี',
          text: 'PMV',
        },
      },
    ],
  };
}

async function main() {
  const args = parseArgs(process.argv);
  const env = {
    ...loadEnvFile(resolve(ROOT, '.env')),
    ...loadEnvFile(resolve(ROOT, 'src/functions/.env')),
    ...process.env,
  };

  const token = (env.LINE_CHANNEL_TOKEN || '').trim();
  if (!token) {
    console.error('Missing LINE_CHANNEL_TOKEN in .env');
    process.exit(1);
  }

  if (args.list) {
    const list = await lineFetch(token, '/v2/bot/richmenu/list');
    console.log(JSON.stringify(list, null, 2));
    return;
  }

  if (args.unlink || args.remove) {
    await lineFetch(token, '/v2/bot/user/all/richmenu', { method: 'DELETE' });
    console.log('[rich-menu] removed default rich menu for all users');
    if (args.unlink) return;
  }

  if (args.deleteOrphans || args.remove) {
    const list = await lineFetch(token, '/v2/bot/richmenu/list');
    for (const menu of list?.richmenus ?? []) {
      await lineFetch(token, `/v2/bot/richmenu/${menu.richMenuId}`, { method: 'DELETE' });
      console.log(`[rich-menu] deleted ${menu.richMenuId} (${menu.name})`);
    }
    if (args.remove) {
      console.log('[rich-menu] all rich menus removed from LINE OA');
    }
    return;
  }

  const liffId = (env.LIFF_CHECKIN_ID || env.VITE_LIFF_CHECKIN_ID || '').trim();
  if (!liffId) {
    console.error('Missing VITE_LIFF_CHECKIN_ID (or LIFF_CHECKIN_ID) in .env');
    process.exit(1);
  }

  const projectId = (env.VITE_FIREBASE_PROJECT_ID || 'pmv1-90180').trim();
  const portalUrl = `https://${projectId}.web.app/portal`;
  const richMenu = buildRichMenu(liffId, portalUrl);

  if (args.dryRun) {
    console.log(JSON.stringify({ liffId, richMenu }, null, 2));
    return;
  }

  const imagePath = args.image ? resolve(ROOT, args.image) : resolve(ROOT, 'public/line/rich-menu-staff.png');
  const imageBuffer = await ensureMenuImage(imagePath);

  const created = await lineFetch(token, '/v2/bot/richmenu', {
    method: 'POST',
    body: richMenu,
  });
  const richMenuId = created?.richMenuId;
  if (!richMenuId) {
    throw new Error(`Unexpected create response: ${JSON.stringify(created)}`);
  }
  console.log(`[rich-menu] created richMenuId=${richMenuId}`);

  await lineFetch(token, `/v2/bot/richmenu/${richMenuId}/content`, {
    method: 'POST',
    body: imageBuffer,
    contentType: 'image/png',
    dataApi: true,
  });
  console.log('[rich-menu] uploaded menu image');

  await lineFetch(token, `/v2/bot/user/all/richmenu/${richMenuId}`, { method: 'POST' });
  console.log('[rich-menu] set as default for all users');
  console.log('');
  console.log('Done. เปิดแชท OA แล้วกดแถบเมนูด้านล่าง:');
  console.log('  • ซ้าย: ลงเวลา (LIFF)');
  console.log('  • ขวา: เชื่อมบัญชี (ส่งข้อความ PMV)');
}

main().catch((err) => {
  console.error('[rich-menu] failed:', err.message || err);
  process.exit(1);
});
