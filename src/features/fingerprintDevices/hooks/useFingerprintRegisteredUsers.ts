import { useQuery } from '@tanstack/react-query';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { DeviceLiveUser } from '../types';
import { resolveUserListCategory } from '../utils/userListCategory';

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

export function useFingerprintRegisteredUsers() {
  return useQuery({
    queryKey: ['fingerprint_registered_users'],
    queryFn: async () => {
      const [usersSnap, teachersSnap] = await Promise.all([
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'teachers')),
      ]);

      const positionByUserId = new Map<string, string>();
      teachersSnap.forEach((d) => {
        const data = d.data();
        const position = typeof data.position === 'string' ? data.position.trim() : '';
        if (data.userId) positionByUserId.set(String(data.userId), position);
        positionByUserId.set(d.id, position);
      });

      const users: DeviceLiveUser[] = [];
      usersSnap.forEach((d) => {
        const data = d.data();
        if (data.status === 'inactive') return;
        const templateId = data.fingerprintTemplateId;
        if (typeof templateId !== 'number' || templateId < 1 || templateId > 127) return;

        const role = String(data.role ?? '').trim();
        if (!role) return;

        const position = positionByUserId.get(d.id) ?? positionByUserId.get(String(data.teacherId ?? ''));
        users.push({
          templateId,
          name: buildDisplayName(data),
          role,
          code: data.studentCode ? String(data.studentCode) : undefined,
          category: resolveUserListCategory(role, position),
        });
      });

      return users.sort((a, b) => a.templateId - b.templateId);
    },
  });
}
