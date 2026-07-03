import { collection, orderBy, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { createSharedStore } from './createSharedStore';
import { listenQueryWithGetDocs } from './listenWithGetDocs';
import type { Announcement } from '@/types/announcement';

function toAnnouncement(docId: string, raw: Record<string, unknown>): Announcement {
  return {
    id: docId,
    title: typeof raw.title === 'string' ? raw.title : '',
    content: typeof raw.content === 'string' ? raw.content : '',
    targetRoles: Array.isArray(raw.targetRoles)
      ? raw.targetRoles.filter((v): v is string => typeof v === 'string')
      : ['all'],
    priority: raw.priority === 'urgent' || raw.priority === 'important' ? raw.priority : 'normal',
    isPinned: raw.isPinned === true,
    createdBy: typeof raw.createdBy === 'string' ? raw.createdBy : '',
    createdByName: typeof raw.createdByName === 'string' ? raw.createdByName : 'ไม่ระบุ',
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    expiresAt: typeof raw.expiresAt === 'string' ? raw.expiresAt : null,
  };
}

export function sortAnnouncements(items: Announcement[]): Announcement[] {
  return [...items].sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
    const aSec = (a.createdAt as { seconds?: number } | undefined)?.seconds ?? 0;
    const bSec = (b.createdAt as { seconds?: number } | undefined)?.seconds ?? 0;
    return bSec - aSec;
  });
}

let sharedAnnouncements: Announcement[] = [];

export const announcementsCollectionStore = createSharedStore<Announcement[]>(
  (emit) => {
    const q = query(collection(db, 'announcements'), orderBy('createdAt', 'desc'));
    return listenQueryWithGetDocs(
      q,
      (rows) => sortAnnouncements(rows.map((r) => toAnnouncement(r.id, r))),
      (items) => {
        sharedAnnouncements = items;
        emit(items);
      },
      sharedAnnouncements,
      'announcementsStore',
    );
  },
  sharedAnnouncements,
);
