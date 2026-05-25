import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Announcement, CreateAnnouncementInput } from '@/types/announcement';

const COL = 'announcements';

function toAnnouncement(docId: string, raw: Record<string, unknown>): Announcement {
  return {
    id: docId,
    title: typeof raw.title === 'string' ? raw.title : '',
    content: typeof raw.content === 'string' ? raw.content : '',
    targetRoles: Array.isArray(raw.targetRoles) ? raw.targetRoles.filter((v): v is string => typeof v === 'string') : ['all'],
    priority: raw.priority === 'urgent' || raw.priority === 'important' ? raw.priority : 'normal',
    isPinned: raw.isPinned === true,
    createdBy: typeof raw.createdBy === 'string' ? raw.createdBy : '',
    createdByName: typeof raw.createdByName === 'string' ? raw.createdByName : 'ไม่ระบุ',
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    expiresAt: typeof raw.expiresAt === 'string' ? raw.expiresAt : null,
  };
}

function sortAnnouncements(items: Announcement[]): Announcement[] {
  return [...items].sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
    const aSec = (a.createdAt as { seconds?: number } | undefined)?.seconds ?? 0;
    const bSec = (b.createdAt as { seconds?: number } | undefined)?.seconds ?? 0;
    return bSec - aSec;
  });
}

export function useAnnouncements(role?: string) {
  const [allItems, setAllItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, COL), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const mapped = snap.docs.map((d) => toAnnouncement(d.id, d.data() as Record<string, unknown>));
      setAllItems(mapped);
      setLoading(false);
    }, () => {
      setAllItems([]);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const announcements = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const filtered = allItems.filter((a) => {
      const audienceMatch = a.targetRoles.includes('all') || (!!role && a.targetRoles.includes(role));
      if (!audienceMatch) return false;
      if (!a.expiresAt) return true;
      return a.expiresAt >= today;
    });
    return sortAnnouncements(filtered);
  }, [allItems, role]);

  return { announcements, loading };
}

export function useManageAnnouncements(enabled = true) {
  const [allItems, setAllItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!enabled) return;

    const q = query(collection(db, COL), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const mapped = snap.docs.map((d) => toAnnouncement(d.id, d.data() as Record<string, unknown>));
      setAllItems(sortAnnouncements(mapped));
      setLoading(false);
    }, () => {
      setAllItems([]);
      setLoading(false);
    });

    return () => unsub();
  }, [enabled]);

  const createAnnouncement = useCallback(async (input: CreateAnnouncementInput, createdBy: string, createdByName: string) => {
    await addDoc(collection(db, COL), {
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
    await updateDoc(doc(db, COL, id), {
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
    await deleteDoc(doc(db, COL, id));
  }, []);

  return {
    announcements: enabled ? allItems : [],
    loading: enabled ? loading : false,
    createAnnouncement,
    updateAnnouncement,
    deleteAnnouncement,
  };
}
