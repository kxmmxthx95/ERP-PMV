import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'node_modules/pdfjs-dist/wasm');
const dest = join(root, 'public/pdfjs-wasm');

if (!existsSync(src)) {
  console.warn('[copy-pdfjs-wasm] pdfjs-dist/wasm not found — run npm install first');
  process.exit(0);
}

mkdirSync(dest, { recursive: true });
cpSync(src, dest, { recursive: true, force: true });
console.log('[copy-pdfjs-wasm] synced to public/pdfjs-wasm');
