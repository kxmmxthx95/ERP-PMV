import { useSyncExternalStore } from 'react';
import {
  portalRecipientUsersStore,
  staffUsersStore,
  studentParentUsersStore,
  type PortalUserRow,
  type StaffUserRow,
  type StudentParentUserRow,
} from '@/lib/firestoreShared/staffUsersStore';

export function useStaffUsers() {
  const users = useSyncExternalStore(
    staffUsersStore.subscribe,
    staffUsersStore.getSnapshot,
    staffUsersStore.getSnapshot,
  );
  const loading = !staffUsersStore.getReady();
  return { users, loading };
}

export function usePortalRecipientUsers() {
  const users = useSyncExternalStore(
    portalRecipientUsersStore.subscribe,
    portalRecipientUsersStore.getSnapshot,
    portalRecipientUsersStore.getSnapshot,
  );
  const loading = !portalRecipientUsersStore.getReady();
  return { users, loading };
}

export function useStudentParentUsers() {
  const users = useSyncExternalStore(
    studentParentUsersStore.subscribe,
    studentParentUsersStore.getSnapshot,
    studentParentUsersStore.getSnapshot,
  );
  const loading = !studentParentUsersStore.getReady();
  return { users, loading };
}

export type { PortalUserRow, StaffUserRow, StudentParentUserRow };
