import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

const base = import.meta.env.BASE_URL.endsWith('/')
  ? import.meta.env.BASE_URL
  : `${import.meta.env.BASE_URL}/`;

/** Required for JPEG2000 (JPXDecode) scanned exam PDFs — without this, page render is blank. */
export const PDFJS_WASM_URL = `${base}pdfjs-wasm/`;

export const PDFJS_GET_DOCUMENT_OPTIONS = {
  wasmUrl: PDFJS_WASM_URL,
} as const;

export async function loadPdfJs() {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  return pdfjs;
}
