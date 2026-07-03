import { pdfjs } from 'react-pdf';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { PDFJS_GET_DOCUMENT_OPTIONS } from '@/lib/pdfjsLoader';

/**
 * Worker must come from the same pdfjs-dist version as `react-pdf` (see package.json).
 * Mismatch causes: API version does not match the Worker version.
 */
pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export const PDFJS_DOCUMENT_OPTIONS = PDFJS_GET_DOCUMENT_OPTIONS;

export { Document, Page, pdfjs } from 'react-pdf';
export type { PDFDocumentProxy } from 'pdfjs-dist';
