/** ชื่อไฟล์ปลอด URL/Storage — ตัดช่องว่างและอักขระพิเศษ */
export function safeStorageFilename(originalName: string): string {
  const trimmed = originalName.trim() || 'file';
  const dot = trimmed.lastIndexOf('.');
  const ext = dot > 0 ? trimmed.slice(dot).replace(/[^\w.]+/g, '') : '';
  const base = (dot > 0 ? trimmed.slice(0, dot) : trimmed)
    .replace(/[^\w.-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 80);
  return `${Date.now()}_${base || 'file'}${ext.toLowerCase()}`;
}

const MIME_BY_EXT: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
};

/** MIME type สำหรับ upload — fallback จากนามสกุลเมื่อ browser ไม่ส่ง file.type */
export function imageUploadContentType(file: File): string {
  if (file.type.startsWith('image/')) return file.type;
  const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
  return MIME_BY_EXT[ext] ?? 'image/png';
}
