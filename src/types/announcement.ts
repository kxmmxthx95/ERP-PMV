export type AnnouncementPriority = 'normal' | 'important' | 'urgent';

export interface Announcement {
  id: string;
  title: string;
  content: string;
  targetRoles: string[]; // ['all'] or specific roles
  priority: AnnouncementPriority;
  isPinned: boolean;
  createdBy: string;
  createdByName: string;
  createdAt?: unknown;
  updatedAt?: unknown;
  expiresAt?: string | null; // YYYY-MM-DD
}

export interface CreateAnnouncementInput {
  title: string;
  content: string;
  targetRoles: string[];
  priority: AnnouncementPriority;
  isPinned: boolean;
  expiresAt?: string | null;
}
