import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "firebase/auth";
import { httpsCallable } from "firebase/functions";
import { auth, db, functions } from "@/lib/firebase";
import {
  doc,
  getDoc,
  getDocs,
  query,
  collection,
  where,
  limit,
  updateDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { useAuthStore } from "@/store/authStore";
import { openFirestoreGateway, resetFirestoreGateway, runAfterGateway, whenFirestoreGatewayOpen } from "@/lib/firestoreShared/bootstrap";
import { resetSharedFirestoreStores } from "@/lib/firestoreShared/resetSharedStores";
import {
  authControlsStore,
  getUserGuardStore,
  type AuthControlsSnapshot,
  type UserGuardSnapshot,
} from "@/lib/firestoreShared/authGuardStore";
import { notifyActiveAcademicYearChanged } from "@/hooks/useActiveAcademicYear";
import { FEATURE_LIST, resolveEffectiveRole, SYSADMIN_EMAIL } from "@/types/rolePermission";
import type { FeaturePermission, RolePermissionConfig } from "@/types/rolePermission";

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
        if (['syllabus', 'teaching', 'schedule', 'students', 'grades', 'attendance', 'morningRollCall', 'calendar', 'exams', 'questionBank', 'feedback_manage'].includes(f.featureKey))
          return { ...f, enabled: true, accessLevel: 'edit' as const };
        if (['classes', 'reports', 'announcements', 'widget_announcements', 'feedback', 'feedback_view_identity', 'widget_feedbackStatus', 'widget_studentProfile', 'widget_schedule', 'widget_morningRollCall', 'widget_teacherDailyTasks', 'widget_staffAttendance'].includes(f.featureKey))
          return { ...f, enabled: true, accessLevel: 'view-only' as const };
        return { ...f, enabled: false, accessLevel: 'view-only' as const };
      });
    case 'staff':
      return FEATURE_LIST.map(f => {
        if (['staffAttendance'].includes(f.featureKey))
          return { ...f, enabled: true, accessLevel: 'edit' as const };
        if (['students', 'attendance', 'announcements', 'widget_announcements', 'feedback', 'widget_feedbackStatus', 'calendar', 'reports', 'schedule', 'widget_studentProfile', 'widget_schedule'].includes(f.featureKey))
          return { ...f, enabled: true, accessLevel: 'view-only' as const };
        return { ...f, enabled: false, accessLevel: 'view-only' as const };
      });
    case 'parent':
      return FEATURE_LIST.map(f => {
        if (['calendar', 'announcements', 'widget_announcements', 'widget_feedbackStatus', 'grades', 'attendance', 'schedule', 'widget_studentProfile', 'widget_schedule'].includes(f.featureKey))
          return { ...f, enabled: true, accessLevel: 'view-only' as const };
        return { ...f, enabled: false, accessLevel: 'view-only' as const };
      });
    case 'student':
    default:
      return FEATURE_LIST.map(f => {
        if (['calendar', 'announcements', 'widget_announcements', 'feedback', 'widget_feedbackStatus', 'grades', 'attendance', 'schedule', 'exams', 'widget_schedule'].includes(f.featureKey))
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
    const snap = await getDoc(ref);
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

async function syncActiveAcademicYear(): Promise<void> {
  try {
    const snap = await getDoc(doc(db, 'settings', 'academic_year'));
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
      const nextJson = JSON.stringify(yearData);
      if (localStorage.getItem('activeAcademicYear') === nextJson) return;
      localStorage.setItem('activeAcademicYear', nextJson);
      notifyActiveAcademicYearChanged();
    }
  } catch (err) {
    console.warn('[authService] syncActiveAcademicYear failed (non-fatal):', err);
  }
}

/** dev: ตรวจว่าเชื่อม pmv1 ได้และมีข้อมูลหรือไม่ */
async function probeFirestoreConnection(): Promise<void> {
  if (!import.meta.env.DEV) return;
  try {
    const { collection, doc, getDoc, getDocs, limit, query } = await import('firebase/firestore');
    const [classesSnap, yearSnap] = await Promise.all([
      getDocs(query(collection(db, 'classes'), limit(3))),
      getDoc(doc(db, 'settings', 'academic_year')),
    ]);
    console.info(`[firestore:pmv1] probe OK — classes sample: ${classesSnap.size} doc(s)`);
    if (yearSnap.exists()) {
      const y = yearSnap.data() as { currentYear?: string; activeSemester?: number };
      console.info(`[firestore:pmv1] academic_year: ${y.currentYear ?? '?'} / ภาค ${y.activeSemester ?? '?'}`);
    } else {
      console.warn('[firestore:pmv1] ไม่พบ settings/academic_year — ตัวกรองปีการศึกษาอาจผิด');
    }
    if (classesSnap.size === 0) {
      console.warn('[firestore:pmv1] pmv1 ตอบได้แต่ classes ว่าง — ตรวจว่าข้อมูลอยู่ใน pmv1 ไม่ใช่ (default)');
    }
  } catch (err) {
    console.error('[firestore:pmv1] probe FAILED — ตรวจ rules, login, deploy rules ไป pmv1:', err);
  }
}

let activeUnsubscribe: (() => void) | null = null;
let activeSessionTimer: ReturnType<typeof setTimeout> | null = null;
let activeUserGuardUnsub: (() => void) | null = null;
let activeGlobalGuardUnsub: (() => void) | null = null;
let activeProfileFetchTimer: ReturnType<typeof setTimeout> | null = null;
let profileFetchGeneration = 0;
/** uid ที่เปิด Firestore gateway แล้ว — ไม่ reset ซ้ำตอน token refresh */
let firestoreGatewayUid: string | null = null;
/** uid ที่ bootstrap profile แล้ว — ไม่ setLoading/refetch ซ้ำตอน token refresh */
let lastBootstrappedUid: string | null = null;

const PROFILE_FETCH_TIMEOUT_MS = 12_000;

function clearProfileFetchTimer(): void {
  if (activeProfileFetchTimer) {
    clearTimeout(activeProfileFetchTimer);
    activeProfileFetchTimer = null;
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | undefined> {
  return Promise.race([
    promise,
    new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), ms)),
  ]);
}

function clearSessionTimer() {
  if (activeSessionTimer) {
    clearTimeout(activeSessionTimer);
    activeSessionTimer = null;
  }
}

function clearUserGuard() {
  if (activeUserGuardUnsub) {
    activeUserGuardUnsub();
    activeUserGuardUnsub = null;
  }
}

function clearGlobalGuard() {
  if (activeGlobalGuardUnsub) {
    activeGlobalGuardUnsub();
    activeGlobalGuardUnsub = null;
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

function evaluateUserGuard(userUid: string, data: UserGuardSnapshot) {
  const currentUser = auth.currentUser;
  if (!currentUser || currentUser.uid !== userUid || !data) return;

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

  const invalidatedCurrentSession = startedAt > 0 && invalidatedAt > (startedAt + 5000);
  if (!isInactive && !invalidatedCurrentSession) return;

  clearSessionLocalState();
  clearUserGuard();
  clearGlobalGuard();
  void signOut(auth).catch(() => {});
}

function evaluateGlobalGuard(userUid: string, data: AuthControlsSnapshot) {
  const currentUser = auth.currentUser;
  if (!currentUser || currentUser.uid !== userUid || !data) return;

  const startedAt = Math.max(
    getSessionStartedAt() ?? 0,
    Date.parse(currentUser.metadata.lastSignInTime || "") || 0
  );
  const invalidatedAt = Math.max(
    toMillis(data.forceLogoutAllAt),
    toMillis(data.hardResetAllAt),
  );

  const invalidatedCurrentSession = startedAt > 0 && invalidatedAt > (startedAt + 5000);
  if (!invalidatedCurrentSession) return;

  clearSessionLocalState();
  clearUserGuard();
  clearGlobalGuard();
  void signOut(auth).catch(() => {});
}

function startUserGuard(userUid: string) {
  clearUserGuard();
  const store = getUserGuardStore(userUid);
  const onChange = () => {
    evaluateUserGuard(userUid, store.getSnapshot());
  };
  activeUserGuardUnsub = store.subscribe(onChange);
  onChange();
}

function startGlobalGuard(userUid: string) {
  clearGlobalGuard();
  const onChange = () => {
    evaluateGlobalGuard(userUid, authControlsStore.getSnapshot());
  };
  activeGlobalGuardUnsub = authControlsStore.subscribe(onChange);
  onChange();
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

  resetPasswordByNationalId: async (
    studentCode: string,
    nationalId: string,
    newPassword: string,
    confirmPassword: string,
  ): Promise<void> => {
    const callable = httpsCallable<
      { studentCode: string; nationalId: string; newPassword: string; confirmPassword: string },
      { success: boolean }
    >(functions, 'resetPasswordByNationalId');
    await callable({ studentCode, nationalId, newPassword, confirmPassword });
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
      if (user) {
        const isNewLoginSession = firestoreGatewayUid !== user.uid;
        const isTokenRefresh = lastBootstrappedUid === user.uid;

        if (isNewLoginSession) {
          resetSharedFirestoreStores();
          resetFirestoreGateway();
          firestoreGatewayUid = user.uid;
          lastBootstrappedUid = null;
        }
        void openFirestoreGateway();
        if (isNewLoginSession) {
          void runAfterGateway(() => syncActiveAcademicYear());
          void runAfterGateway(() => probeFirestoreConnection());
        }

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

        // Firebase token refresh re-fires onAuthStateChanged — skip re-bootstrap.
        if (isTokenRefresh) {
          return;
        }

        lastBootstrappedUid = user.uid;
        setLoading(true);

        clearProfileFetchTimer();
        const generation = ++profileFetchGeneration;

        // รอ auth นิ่งสักครู่ แล้วโหลด role + profile จาก Firestore ก่อนปลดล็อก UI
        activeProfileFetchTimer = setTimeout(async () => {
          if (generation !== profileFetchGeneration) return;

          type UserProfileData = {
            role?: string;
            authUid?: string;
            studentCode?: string;
            [key: string]: unknown;
          };

          let role: string | null = null;
          let userData: UserProfileData | null = null;

          try {
            if (user.email === SYSADMIN_EMAIL) {
              role = 'sysadmin';
            } else {
              const idTokenResult = await withTimeout(user.getIdTokenResult(), 5_000);
              if (idTokenResult) {
                const claimedRole = idTokenResult.claims.role;
                role = typeof claimedRole === 'string' ? claimedRole : null;
              }
            }

            await whenFirestoreGatewayOpen();

            let profileRole = role;
            let profileData: UserProfileData | null = null;

            const userDocRef = doc(db, 'users', user.uid);
            const userSnap = await withTimeout(getDoc(userDocRef), PROFILE_FETCH_TIMEOUT_MS);

            if (!userSnap?.exists() && user.email) {
              const q = query(
                collection(db, 'users'),
                where('email', '==', user.email),
                limit(1),
              );
              const querySnapshot = await withTimeout(getDocs(q), PROFILE_FETCH_TIMEOUT_MS);
              if (querySnapshot && !querySnapshot.empty) {
                const emailSnap = querySnapshot.docs[0];
                if (emailSnap.exists()) {
                  profileData = emailSnap.data() as UserProfileData;
                  if (typeof profileData.role === 'string') profileRole = profileData.role;
                  if (!profileData.authUid) {
                    updateDoc(emailSnap.ref, { authUid: user.uid }).catch(() => {});
                  }
                }
              }
            } else if (userSnap?.exists()) {
              profileData = userSnap.data() as UserProfileData;
              if (typeof profileData.role === 'string') profileRole = profileData.role;
              if (!profileData.authUid) {
                updateDoc(userSnap.ref, { authUid: user.uid }).catch(() => {});
              }
            }

            if (generation !== profileFetchGeneration) return;
            if (auth.currentUser?.uid !== user.uid) return;

            profileRole = resolveEffectiveRole(
              user,
              profileRole,
              role,
            );
            userData = profileData;
            role = profileRole;

            setUser(user, role, userData);
            setLoading(false);

            if (profileRole) await ensureRolePermissions(profileRole);
            await syncActiveAcademicYear();

            window.setTimeout(() => {
              if (generation !== profileFetchGeneration) return;
              if (auth.currentUser?.uid !== user.uid) return;
              startUserGuard(user.uid);
              startGlobalGuard(user.uid);
            }, 500);
          } catch (err) {
            console.error('Auth Profile Fetch Error (Handled):', err);
            if (generation !== profileFetchGeneration) return;
            if (auth.currentUser?.uid !== user.uid) return;
            role = resolveEffectiveRole(user, role);
            setUser(user, role, userData);
            setLoading(false);
          }
        }, 100);
      } else {
        clearProfileFetchTimer();
        profileFetchGeneration++;
        clearUserGuard();
        clearGlobalGuard();
        firestoreGatewayUid = null;
        lastBootstrappedUid = null;
        resetFirestoreGateway();
        clearSessionLocalState();
        logout();
        setLoading(false);
      }
    });

    activeUnsubscribe = unsubscribe;
    return () => {
      clearProfileFetchTimer();
      profileFetchGeneration++;
      if (activeUnsubscribe) {
        activeUnsubscribe();
        activeUnsubscribe = null;
      }
      clearUserGuard();
      clearGlobalGuard();
    };
  }
};
