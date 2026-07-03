import { auth } from '@/lib/firebase';
import { getStoragePathFromDownloadUrl } from '@/lib/examPdfStoragePath';

/**
 * Load PDF bytes for pdf.js via same-origin `/api/exam-pdf` proxy.
 * Direct Storage SDK / XHR to Firebase Storage fails CORS in the browser.
 */
export async function fetchPdfBytesForViewer(sourceUrl: string): Promise<Uint8Array> {
  const storagePath = getStoragePathFromDownloadUrl(sourceUrl);
  if (storagePath) {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('ต้องเข้าสู่ระบบก่อนโหลด PDF');
    }

    const token = await user.getIdToken();
    const params = new URLSearchParams({ path: storagePath });
    const response = await fetch(`/api/exam-pdf?${params.toString()}`, {
      headers: { Authorization: `Firebase ${token}` },
    });

    if (!response.ok) {
      const detail = (await response.text()).trim();
      throw new Error(
        detail
          ? `Failed to fetch PDF (${response.status}): ${detail}`
          : `Failed to fetch PDF (${response.status})`,
      );
    }

    return new Uint8Array(await response.arrayBuffer());
  }

  const response = await fetch(sourceUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch PDF (${response.status})`);
  }
  return new Uint8Array(await response.arrayBuffer());
}
