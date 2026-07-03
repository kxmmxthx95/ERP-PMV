import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { collection, doc, getDocs, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { logActivity } from '@/lib/activityLogger';
import type { FingerprintStudentUser } from '../types';

function buildDisplayName(data: Record<string, unknown>): string {
  const displayName = String(data.displayName ?? '').trim();
  if (displayName) return displayName;
  const name = String(data.name ?? '').trim();
  if (name) return name;
  const prefix = String(data.prefix ?? '').trim();
  const firstName = String(data.firstName ?? '').trim();
  const lastName = String(data.lastName ?? '').trim();
  const full = [prefix, firstName, lastName].filter(Boolean).join(' ');
  return full || 'ไม่ระบุชื่อ';
}

export function useFingerprintStudents() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['fingerprint_student_users'],
    queryFn: async () => {
      const snap = await getDocs(collection(db, 'users'));
      const students: FingerprintStudentUser[] = [];
      snap.forEach((d) => {
        const data = d.data();
        if (String(data.role ?? '') !== 'student') return;
        if (data.status === 'inactive') return;
        students.push({
          uid: d.id,
          displayName: buildDisplayName(data),
          studentCode: data.studentCode ? String(data.studentCode) : undefined,
          gradeLevel: data.gradeLevel ? String(data.gradeLevel) : undefined,
          department: data.department ? String(data.department) : undefined,
          fingerprintTemplateId:
            typeof data.fingerprintTemplateId === 'number'
              ? data.fingerprintTemplateId
              : undefined,
        });
      });
      return students.sort((a, b) => {
        const codeA = a.studentCode ?? '';
        const codeB = b.studentCode ?? '';
        if (codeA && codeB && codeA !== codeB) return codeA.localeCompare(codeB, 'th');
        return a.displayName.localeCompare(b.displayName, 'th');
      });
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
        detail: `student fingerprintTemplateId=${fingerprintTemplateId ?? 'cleared'}`,
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fingerprint_student_users'] }),
  });

  return {
    students: query.data ?? [],
    isLoading: query.isLoading,
    updateTemplateId: updateTemplateMutation.mutateAsync,
    isUpdating: updateTemplateMutation.isPending,
  };
}
