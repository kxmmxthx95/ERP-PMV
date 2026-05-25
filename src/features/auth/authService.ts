import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import {
  doc,
  getDocFromServer,
  onSnapshot,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { useAuthStore } from "@/store/authStore";
import { FEATURE_LIST } from "@/types/rolePermission";
import type { FeaturePermission, RolePermissionConfig } from "@/types/rolePermission";
import type { DocumentData, DocumentSnapshot, QueryDocumentSnapshot } from "firebase/firestore";

const SESSION_EXPIRES_AT_KEY = "auth_session_expires_at";
const SESSION_STARTED_AT_KEY = "auth_session_started_at";
const SESSION_DURATION_MS = 6 * 60 * 60 * 1000; // 6 hours

function setSessionExpiryNow(): number {
  const expiresAt = Date.now() + SESSION_DURATION_MS;
  localStorage.setItem(SESSION_EXPIRES_AT_KEY, String(expiresAt));
  return expiresAt;
}

function getSessionExpiry(): number | null {
  const raw = localStorage.getItem(SESSION_EXPIRES_AT_KEY);
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function clearSessionExpiry(): void {
  localStorage.removeItem(SESSION_EXPIRES_AT_KEY);
}

function setSessionStartedNow(): number {
  const startedAt = Date.now();
  localStorage.setItem(SESSION_STARTED_AT_KEY, String(startedAt));
  return startedAt;
}

function getSessionStartedAt(): number | null {
  const raw = localStorage.getItem(SESSION_STARTED_AT_KEY);
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function clearSessionStartedAt(): void {
  localStorage.removeItem(SESSION_STARTED_AT_KEY);
}

function isSessionExpired(): boolean {
  const expiresAt = getSessionExpiry();
  if (!expiresAt) return false;
  return Date.now() >= expiresAt;
}

// ── Default permission configs per role ──────────────────────────────────────
function buildPermMap(permissions: FeaturePermission[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const p of permissions) {
    if (p.enabled) map[p.featureKey] = p.accessLevel;
  }
  return map;
}

function makeDefaultPermissions(roleId: string): FeaturePermission[] {
  switch (roleId) {
    case 'sysadmin':
      return FEATURE_LIST.map(f => ({ ...f, enabled: true, accessLevel: 'full' as const }));
    case 'admin':
      return FEATURE_LIST.map(f => {
        if (['users', 'roles', 'logs', 'settings'].includes(f.featureKey))
          return { ...f, enabled: false, accessLevel: 'view-only' as const };
        return { ...f, enabled: true, accessLevel: 'edit' as const };
      });
    case 'teacher':
      return FEATURE_LIST.map(f => {
        if (['syllabus', 'teaching', 'schedule', 'students', 'grades', 'attendance', 'calendar', 'exams', 'questionBank', 'feedback_manage'].includes(f.featureKey))
          return { ...f, enabled: true, accessLevel: 'edit' as const };
        if (['classes', 'reports', 'announcements', 'widget_announcements', 'feedback', 'feedback_view_identity', 'widget_feedbackStatus', 'widget_studentProfile'].includes(f.featureKey))
          return { ...f, enabled: true, accessLevel: 'view-only' as const };
        return { ...f, enabled: false, accessLevel: 'view-only' as const };
      });
    case 'staff':
      return FEATURE_LIST.map(f => {
        if (['staffAttendance'].includes(f.featureKey))
          return { ...f, enabled: true, accessLevel: 'edit' as const };
        if (['students', 'attendance', 'announcements', 'widget_announcements', 'feedback', 'widget_feedbackStatus', 'calendar', 'reports', 'schedule', 'widget_studentProfile'].includes(f.featureKey))
          return { ...f, enabled: true, accessLevel: 'view-only' as const };
        return { ...f, enabled: false, accessLevel: 'view-only' as const };
      });
    case 'parent':
      return FEATURE_LIST.map(f => {
        if (['calendar', 'announcements', 'widget_announcements', 'widget_feedbackStatus', 'grades', 'attendance', 'schedule', 'widget_studentProfile'].includes(f.featureKey))
          return { ...f, enabled: true, accessLevel: 'view-only' as const };
        return { ...f, enabled: false, accessLevel: 'view-only' as const };
      });
    case 'student':
    default:
      return FEATURE_LIST.map(f => {
        if (['calendar', 'announcements', 'widget_announcements', 'feedback', 'widget_feedbackStatus', 'grades', 'attendance', 'schedule', 'exams'].includes(f.featureKey))
          return { ...f, enabled: true, accessLevel: 'view-only' as const };
        return { ...f, enabled: false, accessLevel: 'view-only' as const };
      });
  }
}

// สร้าง role_permissions document ถ้ายังไม่มี (ทำครั้งเดียวต่อ role)
async function ensureRolePermissions(role: string): Promise<void> {
  if (role === 'sysadmin') return; // sysadmin bypass rules ทั้งหมดอยู่แล้ว
  try {
    const ref = doc(db, 'role_permissions', role);
    const snap = await getDocFromServer(ref);
    if (!snap.exists()) {
      const permissions = makeDefaultPermissions(role);
      const config: RolePermissionConfig = {
        roleId: role,
        permissions,
        permMap: buildPermMap(permissions),
        updatedAt: serverTimestamp(),
      };
      await setDoc(ref, config);
      console.info(`[authService] Auto-initialized role_permissions for role: ${role}`);
    }
  } catch (err) {
    // ไม่ block login ถ้า init ล้มเหลว (เช่น network timeout)
    console.warn('[authService] ensureRolePermissions failed (non-fatal):', err);
  }
}

export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// ดึงปีการศึกษาที่ active จาก Firestore แล้ว sync ลง localStorage
// เรียกหลัง login ทุกครั้งเพื่อให้ทุก user ได้ค่าเดียวกับที่ SysAdmin ตั้งไว้
// Settings เก็บที่ settings/academic_year (doc เดียว) → map → AcademicYear format
async function syncActiveAcademicYear(): Promise<void> {
  try {
    const { getDoc, doc: firestoreDoc } = await import('firebase/firestore');
    const snap = await getDoc(firestoreDoc(db, 'settings', 'academic_year'));
    if (snap.exists()) {
      const data = snap.data() as { currentYear?: string; startDate?: string; endDate?: string; activeSemester?: number };
      const yearData = {
        id: data.currentYear ?? '',
        year: data.currentYear ?? '',
        activeSemester: data.activeSemester ?? 1,
        startDate: data.startDate ?? '',
        endDate: data.endDate ?? '',
        status: 'active' as const,
      };
      localStorage.setItem('activeAcademicYear', JSON.stringify(yearData));
    }
  } catch (err) {
    console.warn('[authService] syncActiveAcademicYear failed (non-fatal):', err);
  }
}

let activeUnsubscribe: (() => void) | null = null;
let activeSessionTimer: ReturnType<typeof setTimeout> | null = null;
let activeUserGuardUnsubscribe: (() => void) | null = null;
let activeGlobalGuardUnsubscribe: (() => void) | null = null;

function clearSessionTimer() {
  if (activeSessionTimer) {
    clearTimeout(activeSessionTimer);
    activeSessionTimer = null;
  }
}

function clearUserGuard() {
  if (activeUserGuardUnsubscribe) {
    try {
      activeUserGuardUnsubscribe();
    } catch {
      // noop
    }
    activeUserGuardUnsubscribe = null;
  }
}

function clearGlobalGuard() {
  if (activeGlobalGuardUnsubscribe) {
    try {
      activeGlobalGuardUnsubscribe();
    } catch {
      // noop
    }
    activeGlobalGuardUnsubscribe = null;
  }
}

function clearSessionLocalState() {
  clearSessionTimer();
  clearSessionExpiry();
  clearSessionStartedAt();
}

function toMillis(value: unknown): number {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const t = Date.parse(value);
    return Number.isFinite(t) ? t : 0;
  }
  if (typeof value === 'object' && value !== null) {
    // Handle Firestore Timestamp objects
    if ('toMillis' in value && typeof (value as any).toMillis === 'function') {
      return (value as any).toMillis();
    }
    // Handle plain objects with seconds/nanoseconds (e.g. from JSON or cache)
    if ('seconds' in value && typeof (value as any).seconds === 'number') {
      return (value as any).seconds * 1000 + Math.floor(((value as any).nanoseconds || 0) / 1000000);
    }
  }
  return 0;
}

function startUserGuard(userUid: string) {
  clearUserGuard();
  const userRef = doc(db, 'users', userUid);
  activeUserGuardUnsubscribe = onSnapshot(userRef, async (snap) => {
    const currentUser = auth.currentUser;
    if (!currentUser || currentUser.uid !== userUid) return;
    if (!snap.exists()) return;

    const data = snap.data() as {
      status?: string;
      forceLogoutAt?: unknown;
      sessionInvalidatedAt?: unknown;
      hardResetAt?: unknown;
    };

    const isInactive = data.status === 'inactive';
    const startedAt = Math.max(
      getSessionStartedAt() ?? 0,
      Date.parse(currentUser.metadata.lastSignInTime || "") || 0
    );
    const invalidatedAt = Math.max(
      toMillis(data.forceLogoutAt),
      toMillis(data.sessionInvalidatedAt),
      toMillis(data.hardResetAt),
    );
    
    // Use a small buffer (5s) to avoid edge cases with local clock skew
    const invalidatedCurrentSession = startedAt > 0 && invalidatedAt > (startedAt + 5000);

    if (!isInactive && !invalidatedCurrentSession) return;

    clearSessionLocalState();
    clearUserGuard();
    await signOut(auth).catch(() => {});
  }, () => {
    // Do not break auth flow if guard listener fails.
  });
}

function startGlobalGuard(userUid: string) {
  clearGlobalGuard();
  const configRef = doc(db, 'system_config', 'auth_controls');
  activeGlobalGuardUnsubscribe = onSnapshot(configRef, async (snap) => {
    const currentUser = auth.currentUser;
    if (!currentUser || currentUser.uid !== userUid) return;
    if (!snap.exists()) return;

    const data = snap.data() as {
      forceLogoutAllAt?: unknown;
      hardResetAllAt?: unknown;
    };

    const startedAt = Math.max(
      getSessionStartedAt() ?? 0,
      Date.parse(currentUser.metadata.lastSignInTime || "") || 0
    );
    const invalidatedAt = Math.max(
      toMillis(data.forceLogoutAllAt),
      toMillis(data.hardResetAllAt),
    );
    
    // Buffer 5s to ensure we don't logout a user who just signed in while the logout was processing
    const invalidatedCurrentSession = startedAt > 0 && invalidatedAt > (startedAt + 5000);
    if (!invalidatedCurrentSession) return;

    clearSessionLocalState();
    clearUserGuard();
    clearGlobalGuard();
    await signOut(auth).catch(() => {});
  }, () => {
    // ignore global guard listener failure
  });
}

function scheduleSessionAutoLogout() {
  clearSessionTimer();
  const expiresAt = getSessionExpiry();
  if (!expiresAt) return;
  const msLeft = expiresAt - Date.now();
  if (msLeft <= 0) return;
  activeSessionTimer = setTimeout(() => {
    void signOut(auth).finally(() => {
      clearSessionExpiry();
      clearSessionTimer();
    });
  }, msLeft);
}

export const authService = {
  // Login ด้วย Email + Password ผ่าน Firebase Auth มาตรฐาน
  login: async (email: string, password: string) => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) throw new Error('กรุณาระบุอีเมล');
    const cred = await signInWithEmailAndPassword(auth, cleanEmail, password.trim());
    setSessionExpiryNow();
    setSessionStartedNow();
    scheduleSessionAutoLogout();
    return cred;
  },

  logout: () => {
    if (import.meta.env.DEV) {
      localStorage.removeItem('dev_role');
    }
    clearUserGuard();
    clearGlobalGuard();
    clearSessionLocalState();
    return signOut(auth);
  },

  getFirestoreUid: (fallbackUid: string): string => {
    return fallbackUid;
  },

  listenToAuthChanges: () => {
    const { setUser, setLoading, logout } = useAuthStore.getState();

    if (activeUnsubscribe) {
      try {
        activeUnsubscribe();
      } catch (unsubscribeError) {
        if (import.meta.env.DEV) {
          console.warn('[authService] unsubscribe failed:', unsubscribeError);
        }
      }
      activeUnsubscribe = null;
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setLoading(true);
      
      if (user) {
        // Enforce fixed login session lifetime (6 hours)
        if (isSessionExpired()) {
          clearSessionTimer();
          clearSessionExpiry();
          await signOut(auth);
          setLoading(false);
          return;
        }

        // Backward compatibility: users logged in before this rule get 6h from first load.
        if (!getSessionExpiry()) {
          setSessionExpiryNow();
        }
        if (!getSessionStartedAt()) {
          setSessionStartedNow();
        }
        scheduleSessionAutoLogout();

        // หน่วงเวลาเล็กน้อยเพื่อให้ Auth Stream นิ่งก่อนเริ่มดึงข้อมูล Firestore
        setTimeout(async () => {
          type UserProfileData = {
            role?: string;
            authUid?: string;
            [key: string]: unknown;
          };

          let role: string | null = null;
          let userData: UserProfileData | null = null;

          try {
            // 1. God Mode bypass
            if (user.email === 'sysadmin@pmv.com') {
              role = 'sysadmin';
            } else {
              const idTokenResult = await user.getIdTokenResult();
              const claimedRole = idTokenResult.claims.role;
              role = typeof claimedRole === 'string' ? claimedRole : null;
            }

            // 2. ดึงข้อมูล Profile (Ultra Resilient Strategy)
            const { getDocFromCache, getDocFromServer } = await import('firebase/firestore');
            const userDocRef = doc(db, 'users', user.uid);
            
            let userSnap: DocumentSnapshot<DocumentData> | QueryDocumentSnapshot<DocumentData> | null = null;
            
            // ลองจาก Cache ก่อน (เร็วและมักจะไม่พัง)
            try {
              userSnap = await getDocFromCache(userDocRef);
            } catch {
              // ถ้าไม่มีใน Cache หรือพัง ให้ลองจาก Server โดยตรง (ข้าม Stream)
              try {
                userSnap = await getDocFromServer(userDocRef);
              } catch {
                console.warn('Firestore Server fetch failed, user might be new or offline.');
              }
            }

            // 3. Fallback search by email
            if (!userSnap || !userSnap.exists()) {
              const { query, collection, where, getDocsFromServer, limit } = await import('firebase/firestore');
              const q = query(collection(db, 'users'), where('email', '==', user.email), limit(1));
              const querySnapshot = await getDocsFromServer(q).catch(() => null);
              if (querySnapshot && !querySnapshot.empty) {
                userSnap = querySnapshot.docs[0];
              }
            }

            if (userSnap && userSnap.exists()) {
              userData = userSnap.data() as UserProfileData;
              if (!role && typeof userData.role === 'string') role = userData.role;

              if (!userData.authUid) {
                const { updateDoc } = await import('firebase/firestore');
                updateDoc(userSnap.ref, { authUid: user.uid }).catch(() => {});
              }
            }

            // Auto-initialize role_permissions ถ้ายังไม่มี
            if (role) await ensureRolePermissions(role);

            // Sync active academic year จาก Firestore → localStorage
            // ทำให้ user ทุกคน (ทุกเครื่อง) ได้ค่าปีการศึกษาที่ SysAdmin ตั้งไว้
            await syncActiveAcademicYear();
          } catch (err) {
            console.error('Auth Profile Fetch Error (Handled):', err);
          } finally {
            // อัปเดตสถานะสุดท้ายเสมอ แม้จะดึงข้อมูลไม่สำเร็จ
            if (!role) role = 'student';
            setUser(user, role, userData);
            startUserGuard(user.uid);
            startGlobalGuard(user.uid);
            setLoading(false);
          }
        }, 100);
      } else {
        clearUserGuard();
        clearGlobalGuard();
        clearSessionLocalState();
        logout();
        setLoading(false);
      }
    });

    activeUnsubscribe = unsubscribe;
    return () => {
      if (activeUnsubscribe) {
        activeUnsubscribe();
        activeUnsubscribe = null;
      }
      clearUserGuard();
      clearGlobalGuard();
    };
  }
};
