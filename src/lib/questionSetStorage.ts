import { deleteObject, listAll, ref } from 'firebase/storage';
import { storage } from '@/lib/firebase';
import { EXAM_PDF_ALLOWED_PREFIX, getStoragePathFromDownloadUrl } from '@/lib/examPdfStoragePath';

function pdfFolderRef(setId: string) {
  return ref(storage, `${EXAM_PDF_ALLOWED_PREFIX}${setId}`);
}

function isPdfPathForSet(path: string, setId: string): boolean {
  return path.startsWith(`${EXAM_PDF_ALLOWED_PREFIX}${setId}/`);
}

/** Remove all exam PDF files under question_sets/pdfs/{setId}/ */
export async function deleteQuestionSetPdfStorage(
  setId: string,
  examPdfUrl?: string | null,
): Promise<void> {
  const folderRef = pdfFolderRef(setId);
  try {
    const listing = await listAll(folderRef);
    await Promise.all(listing.items.map((itemRef) => deleteObject(itemRef)));
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code !== 'storage/object-not-found') {
      throw err;
    }
  }

  if (examPdfUrl) {
    const path = getStoragePathFromDownloadUrl(examPdfUrl);
    if (path && isPdfPathForSet(path, setId)) {
      try {
        await deleteObject(ref(storage, path));
      } catch (err) {
        const code = (err as { code?: string }).code;
        if (code !== 'storage/object-not-found') {
          throw err;
        }
      }
    }
  }
}
