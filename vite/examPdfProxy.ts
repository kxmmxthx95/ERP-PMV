/** Server-side exam PDF fetch — avoids browser CORS to Firebase Storage */

import {
  EXAM_PDF_ALLOWED_PREFIX,
  parseExamPdfStoragePath,
} from '../src/lib/examPdfStoragePath.ts';

export { EXAM_PDF_ALLOWED_PREFIX, parseExamPdfStoragePath };

/** Extract Firebase ID token from Authorization header (Firebase or Bearer). */
export function extractFirebaseIdToken(authHeader: string | undefined): string | null {
  if (!authHeader) return null;
  if (authHeader.startsWith('Firebase ')) return authHeader.slice('Firebase '.length);
  if (authHeader.startsWith('Bearer ')) return authHeader.slice('Bearer '.length);
  return null;
}

export async function fetchExamPdfBytes(
  storagePath: string,
  idToken: string,
  storageBucket: string,
): Promise<ArrayBuffer> {
  const encoded = encodeURIComponent(storagePath);
  const url = `https://firebasestorage.googleapis.com/v0/b/${storageBucket}/o/${encoded}?alt=media`;
  const res = await fetch(url, {
    headers: { Authorization: `Firebase ${idToken}` },
  });
  if (!res.ok) {
    throw new Error(`Storage fetch failed (${res.status})`);
  }
  return res.arrayBuffer();
}
