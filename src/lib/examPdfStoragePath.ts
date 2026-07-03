export const EXAM_PDF_ALLOWED_PREFIX = 'question_sets/pdfs/';

/** Parse Firebase Storage download URLs (or plain paths) into a Storage object path. */
export function getStoragePathFromDownloadUrl(downloadUrl: string): string | null {
  const trimmed = downloadUrl.trim();
  if (!trimmed) return null;

  if (
    trimmed.startsWith(EXAM_PDF_ALLOWED_PREFIX) &&
    !trimmed.startsWith('http://') &&
    !trimmed.startsWith('https://')
  ) {
    if (trimmed.includes('..') || trimmed.includes('\\')) return null;
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.toLowerCase();
    const isFirebaseStorage =
      host.includes('firebasestorage.googleapis.com') ||
      host.endsWith('.firebasestorage.app');

    if (!isFirebaseStorage) return null;

    const pathMatch = parsed.pathname.match(/\/o\/(.+)$/);
    if (!pathMatch?.[1]) return null;

    const decoded = decodeURIComponent(pathMatch[1]);
    if (!decoded.startsWith(EXAM_PDF_ALLOWED_PREFIX)) return null;
    if (decoded.includes('..') || decoded.includes('\\')) return null;
    return decoded;
  } catch {
    return null;
  }
}

export function parseExamPdfStoragePath(raw: string | null): string | null {
  if (!raw) return null;
  const path = raw.trim();
  if (!path.startsWith(EXAM_PDF_ALLOWED_PREFIX)) return null;
  if (path.includes('..') || path.includes('\\')) return null;
  return path;
}
