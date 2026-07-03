import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { logActivity } from '@/lib/activityLogger';
import type { FingerprintStaffUser } from '../types';

const STAFF_ROLES = new Set(['teacher', 'staff', 'admin', 'sysadmin']);

export function useFingerprintStaffUsers() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['fingerprint_staff_users'],
    queryFn: async () => {
      const snap = await getDocs(collection(db, 'users'));
      const users: FingerprintStaffUser[] = [];
      snap.forEach((d) => {
        const data = d.data();
        const role = String(data.role ?? '');
        if (!STAFF_ROLES.has(role)) return;
        if (data.status === 'inactive') return;
        users.push({
          uid: d.id,
          displayName: String(data.displayName ?? data.name ?? d.id),
          role,
          fingerprintTemplateId:
            typeof data.fingerprintTemplateId === 'number'
              ? data.fingerprintTemplateId
              : undefined,
          status: data.status ? String(data.status) : undefined,
        });
      });
      return users.sort((a, b) => a.displayName.localeCompare(b.displayName, 'th'));
    },
  });

  const updateTemplateMutation = useMutation({
    mutationFn: async ({
      uid,
      fingerprintTemplateId,
    }: {
      uid: string;
      fingerprintTemplateId: number | null;
    }) => {
      await updateDoc(doc(db, 'users', uid), {
        fingerprintTemplateId: fingerprintTemplateId ?? null,
      });
      await logActivity({
        action: 'update',
        category: 'user',
        status: 'success',
        targetId: uid,
        detail: `fingerprintTemplateId=${fingerprintTemplateId ?? 'cleared'}`,
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fingerprint_staff_users'] }),
  });

  return {
    staffUsers: query.data ?? [],
    isLoading: query.isLoading,
    updateTemplateId: updateTemplateMutation.mutateAsync,
    isUpdating: updateTemplateMutation.isPending,
  };
}
