import { useCallback, useMemo, useSyncExternalStore } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  announcementsCollectionStore,
  sortAnnouncements,
} from '@/lib/firestoreShared/announcementsStore';
import type { CreateAnnouncementInput, Announcement } from '@/types/announcement';

export function filterAnnouncementsForRole(allItems: Announcement[], role?: string): Announcement[] {
  const today = new Date().toISOString().slice(0, 10);
  const filtered = allItems.filter((a) => {
    const audienceMatch = a.targetRoles.includes('all') || (!!role && a.targetRoles.includes(role));
    if (!audienceMatch) return false;
    if (!a.expiresAt) return true;
    return a.expiresAt >= today;
  });
  return sortAnnouncements(filtered);
}

export function useAnnouncements(role?: string) {
  const allItems = useSyncExternalStore(
    announcementsCollectionStore.subscribe,
    announcementsCollectionStore.getSnapshot,
    announcementsCollectionStore.getSnapshot,
  );

  const announcements = useMemo(
    () => filterAnnouncementsForRole(allItems, role),
    [allItems, role],
  );

  return { announcements, loading: false };
}

export function useManageAnnouncements(enabled = true) {
  const allItems = useSyncExternalStore(
    (onStoreChange) => (enabled ? announcementsCollectionStore.subscribe(onStoreChange) : () => {}),
    announcementsCollectionStore.getSnapshot,
    announcementsCollectionStore.getSnapshot,
  );

  const createAnnouncement = useCallback(async (input: CreateAnnouncementInput, createdBy: string, createdByName: string) => {
    await addDoc(collection(db, 'announcements'), {
      title: input.title.trim(),
      content: input.content.trim(),
      targetRoles: input.targetRoles.length > 0 ? input.targetRoles : ['all'],
      priority: input.priority,
      isPinned: input.isPinned,
      expiresAt: input.expiresAt ?? null,
      createdBy,
      createdByName,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }, []);

  const updateAnnouncement = useCallback(async (id: string, input: CreateAnnouncementInput) => {
    await updateDoc(doc(db, 'announcements', id), {
      title: input.title.trim(),
      content: input.content.trim(),
      targetRoles: input.targetRoles.length > 0 ? input.targetRoles : ['all'],
      priority: input.priority,
      isPinned: input.isPinned,
      expiresAt: input.expiresAt ?? null,
      updatedAt: serverTimestamp(),
    });
  }, []);

  const deleteAnnouncement = useCallback(async (id: string) => {
    await deleteDoc(doc(db, 'announcements', id));
  }, []);

  return {
    announcements: enabled ? allItems : [],
    loading: false,
    createAnnouncement,
    updateAnnouncement,
    deleteAnnouncement,
  };
}
