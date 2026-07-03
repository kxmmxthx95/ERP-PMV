import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { getAdminFirestore } from "./getAdminFirestore";
import { CALLABLE_CORS, CALLABLE_REGION } from "./callableOptions";
import { SYSADMIN_EMAIL, resolveUserRole } from "./lineUserLookup";

const db = getAdminFirestore();

function normalizeEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

/** สอดคล้องกับ authService — token, uid doc, หรือค้นจาก email */
async function resolveCallerRole(
  auth: { uid: string; token: Record<string, unknown> },
): Promise<string> {
  const email = normalizeEmail(auth.token.email);

  if (email === SYSADMIN_EMAIL) return "sysadmin";

  const claimedRole = auth.token.role;
  if (claimedRole === "sysadmin") return "sysadmin";
  if (claimedRole === "admin") return "admin";

  const uidSnap = await db.collection("users").doc(auth.uid).get();
  if (uidSnap.exists) {
    const role = resolveUserRole(uidSnap.data() ?? {}, email);
    if (role) return role;
  }

  if (email) {
    const rawEmail = typeof auth.token.email === "string" ? auth.token.email.trim() : "";
    const emailCandidates = rawEmail && rawEmail !== email ? [rawEmail, email] : [rawEmail || email];
    for (const candidate of emailCandidates) {
      if (!candidate) continue;
      const byEmail = await db.collection("users").where("email", "==", candidate).limit(1).get();
      if (!byEmail.empty) {
        const role = resolveUserRole(byEmail.docs[0].data(), email);
        if (role) return role;
      }
    }
  }

  return typeof claimedRole === "string" ? claimedRole.trim() : "";
}

async function assertUsersManager(
  auth: { uid: string; token: Record<string, unknown> } | undefined,
): Promise<void> {
  if (!auth) {
    throw new HttpsError("unauthenticated", "Must be authenticated");
  }

  const role = await resolveCallerRole(auth);
  if (role === "admin" || role === "sysadmin") return;

  if (role) {
    const permSnap = await db.collection("role_permissions").doc(role).get();
    const permMap = permSnap.data()?.permMap as Record<string, string> | undefined;
    if (permMap?.users === "full") return;
  }

  throw new HttpsError(
    "permission-denied",
    "ไม่มีสิทธิ์รีเซ็ตรหัสผ่าน — ต้องเป็น admin/sysadmin หรือมีสิทธิ์จัดการผู้ใช้ระดับเต็ม",
  );
}

const TEMP_RESET_PASSWORD = "123456";

const gen2Callable = {
  region: CALLABLE_REGION,
  cors: CALLABLE_CORS,
  invoker: "public" as const,
};

export const forceLogoutUser = onCall(gen2Callable, async (request) => {
  await assertUsersManager(request.auth);

  const userId = typeof request.data?.userId === "string" ? request.data.userId.trim() : "";
  const authUid =
    typeof request.data?.authUid === "string" && request.data.authUid.trim()
      ? request.data.authUid.trim()
      : userId;
  if (!userId || !authUid) {
    throw new HttpsError("invalid-argument", "userId and authUid are required");
  }

  await admin.auth().revokeRefreshTokens(authUid);
  await db.collection("users").doc(userId).set(
    {
      forceLogoutAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  return { success: true, userId, authUid };
});

export const hardResetUser = onCall(gen2Callable, async (request) => {
  await assertUsersManager(request.auth);

  const userId = typeof request.data?.userId === "string" ? request.data.userId.trim() : "";
  const authUid =
    typeof request.data?.authUid === "string" && request.data.authUid.trim()
      ? request.data.authUid.trim()
      : userId;
  if (!userId || !authUid) {
    throw new HttpsError("invalid-argument", "userId and authUid are required");
  }

  const tempPassword = TEMP_RESET_PASSWORD;

  await admin.auth().updateUser(authUid, {
    password: tempPassword,
    disabled: false,
  });
  await admin.auth().revokeRefreshTokens(authUid);

  await db.collection("users").doc(userId).set(
    {
      mustChangePassword: true,
      status: "active",
      hardResetAt: admin.firestore.FieldValue.serverTimestamp(),
      sessionInvalidatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  return {
    success: true,
    userId,
    authUid,
    tempPassword,
  };
});

export const forceLogoutAllUsers = onCall(gen2Callable, async (request) => {
  await assertUsersManager(request.auth);

  await db.collection("system_config").doc("auth_controls").set(
    {
      forceLogoutAllAt: admin.firestore.FieldValue.serverTimestamp(),
      forcedByUid: request.auth?.uid ?? null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  return { success: true };
});
