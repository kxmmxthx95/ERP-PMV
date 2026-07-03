import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { normalizeUniversityDomain } from '@/data/thaiUniversities';
import { logActivity } from '@/lib/activityLogger';
import { auth, db, storage } from '@/lib/firebase';
import {
  UNIVERSITY_LOGOS_COLLECTION,
  type UniversityLogoRecord,
} from '@/types/universityLogo';
import { compressImage } from '@/features/students/components/studentDetailFormShared';

const QUERY_KEY = ['universityLogos'] as const;

async function fetchUniversityLogoMap(): Promise<Map<string, UniversityLogoRecord>> {
  const snap = await getDocs(collection(db, UNIVERSITY_LOGOS_COLLECTION));
  const map = new Map<string, UniversityLogoRecord>();
  snap.docs.forEach((d) => {
    const data = d.data() as UniversityLogoRecord;
    const key = normalizeUniversityDomain(data.domain || d.id);
    map.set(key, { ...data, domain: key });
  });
  return map;
}

export function useUniversityLogoMap() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchUniversityLogoMap,
    staleTime: 60 * 60 * 1000,
  });
}

export function useUniversityLogoMutations() {
  const queryClient = useQueryClient();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: QUERY_KEY });

  const upload = useMutation({
    mutationFn: async ({
      domain,
      name,
      file,
    }: {
      domain: string;
      name: string;
      file: File;
    }) => {
      const normalized = normalizeUniversityDomain(domain);
      const blob = await compressImage(file, 256, 256, 0.85);
      const storagePath = `university_logos/${normalized}/logo.jpg`;
      const storageRef = ref(storage, storagePath);
      await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' });
      const logoURL = await getDownloadURL(storageRef);

      const uid = auth.currentUser?.uid ?? '';
      await setDoc(
        doc(db, UNIVERSITY_LOGOS_COLLECTION, normalized),
        {
          domain: normalized,
          name,
          logoURL,
          updatedAt: serverTimestamp(),
          updatedBy: uid,
        },
        { merge: true },
      );

      await logActivity({
        action: 'upload_university_logo',
        category: 'data',
        status: 'success',
        targetId: normalized,
        detail: `อัปโหลด Logo มหาวิทยาลัย: ${name}`,
        metadata: { domain: normalized, name },
      });

      return { domain: normalized, logoURL };
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async ({ domain, name }: { domain: string; name: string }) => {
      const normalized = normalizeUniversityDomain(domain);
      await deleteDoc(doc(db, UNIVERSITY_LOGOS_COLLECTION, normalized));

      await logActivity({
        action: 'remove_university_logo',
        category: 'data',
        status: 'success',
        targetId: normalized,
        detail: `ลบ Logo ที่อัปโหลด: ${name}`,
        metadata: { domain: normalized, name },
      });
    },
    onSuccess: invalidate,
  });

  return { upload, remove };
}
