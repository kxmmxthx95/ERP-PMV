import type { PDFDocumentProxy } from 'pdfjs-dist';
import { loadPdfJs, PDFJS_GET_DOCUMENT_OPTIONS } from '@/lib/pdfjsLoader';

export const MAX_EXAM_PDF_BYTES = 25 * 1024 * 1024;

const COMPRESSION_PROFILES = [
  { scale: 1.4, jpegQuality: 0.85 },
  { scale: 1.15, jpegQuality: 0.75 },
  { scale: 1.0, jpegQuality: 0.65 },
  { scale: 0.85, jpegQuality: 0.55 },
] as const;

export class PdfCompressError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PdfCompressError';
  }
}

function formatMb(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1);
}

async function renderCompressedBlob(
  pdf: PDFDocumentProxy,
  profile: (typeof COMPRESSION_PROFILES)[number],
  onProgress?: (percent: number) => void,
): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const numPages = pdf.numPages;
  let doc: InstanceType<typeof jsPDF> | null = null;

  for (let pageNum = 1; pageNum <= numPages; pageNum += 1) {
    onProgress?.(Math.round(((pageNum - 1) / numPages) * 100));

    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: profile.scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new PdfCompressError('ไม่สามารถประมวลผล PDF ได้');

    await page.render({ canvas, canvasContext: ctx, viewport }).promise;

    const imgData = canvas.toDataURL('image/jpeg', profile.jpegQuality);
    const w = canvas.width;
    const h = canvas.height;
    const orientation = w > h ? 'landscape' : 'portrait';

    if (!doc) {
      doc = new jsPDF({
        unit: 'pt',
        format: [w, h],
        orientation,
        compress: true,
      });
    } else {
      doc.addPage([w, h], orientation);
    }

    doc.addImage(imgData, 'JPEG', 0, 0, w, h, undefined, 'FAST');
  }

  onProgress?.(100);

  if (!doc) throw new PdfCompressError('PDF ว่างเปล่า');
  return doc.output('blob');
}

/** บีบอัด PDF ให้ไม่เกิน 25 MB (ใช้เมื่อไฟล์ใหญ่เกินขีดจำกัด Storage) */
export async function compressPdfIfNeeded(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<File> {
  if (file.size <= MAX_EXAM_PDF_BYTES) return file;

  const pdfjs = await loadPdfJs();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer, ...PDFJS_GET_DOCUMENT_OPTIONS }).promise;

  if (pdf.numPages > 120) {
    throw new PdfCompressError('PDF มีจำนวนหน้ามากเกินไป (สูงสุด 120 หน้า) — กรุณาแยกไฟล์');
  }

  const originalMb = formatMb(file.size);

  for (const profile of COMPRESSION_PROFILES) {
    onProgress?.(0);
    const blob = await renderCompressedBlob(pdf, profile, onProgress);
    if (blob.size <= MAX_EXAM_PDF_BYTES) {
      const baseName = file.name.replace(/\.pdf$/i, '') || 'exam';
      return new File([blob], `${baseName}.pdf`, { type: 'application/pdf' });
    }
  }

  throw new PdfCompressError(
    `บีบอัดแล้วยังใหญ่เกิน 25 MB (ต้นฉบับ ${originalMb} MB) — ลองลดจำนวนหน้าหรือความละเอียดในไฟล์ต้นฉบับ`,
  );
}
