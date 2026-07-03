import type { Firestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

export const SYSADMIN_EMAIL = "sysadmin@pmv.com";

export type ResolvedLineUser = {
  uid: string;
  displayName: string;
  role: string;
};

function normalizeEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function resolveUserRole(data: Record<string, unknown>, fallbackEmail = ""): string {
  if (typeof data.role === "string" && data.role.trim()) return data.role.trim();
  const email = normalizeEmail(data.email) || normalizeEmail(fallbackEmail);
  if (email === SYSADMIN_EMAIL) return "sysadmin";
  return "";
}

function resolveDisplayName(data: Record<string, unknown>, fallback = "Staff"): string {
  if (typeof data.displayName === "string" && data.displayName.trim()) return data.displayName.trim();
  if (typeof data.name === "string" && data.name.trim()) return data.name.trim();
  if (typeof data.firstName === "string" && data.firstName.trim()) {
    const last = typeof data.lastName === "string" ? data.lastName.trim() : "";
    return `${data.firstName.trim()} ${last}`.trim();
  }
  const email = normalizeEmail(data.email);
  if (email) return email;
  return fallback;
}

function mapUserDoc(
  docSnap: FirebaseFirestore.DocumentSnapshot,
  fallbackEmail = "",
): ResolvedLineUser | null {
  if (!docSnap.exists) return null;
  const data = docSnap.data() as Record<string, unknown>;
  return {
    uid: docSnap.id,
    displayName: resolveDisplayName(data),
    role: resolveUserRole(data, fallbackEmail),
  };
}

async function enrichRoleFromAuth(user: ResolvedLineUser): Promise<ResolvedLineUser> {
  if (user.role) return user;
  const fromAuth = await resolveFromAuthUid(user.uid);
  if (!fromAuth?.role) return user;
  return {
    ...user,
    role: fromAuth.role,
    displayName: user.displayName !== "Staff" ? user.displayName : fromAuth.displayName,
  };
}

async function resolveFromAuthUid(uid: string): Promise<ResolvedLineUser | null> {
  try {
    const authUser = await getAuth().getUser(uid);
    const email = normalizeEmail(authUser.email);
    const role = email === SYSADMIN_EMAIL ? "sysadmin" : "";
    return {
      uid,
      displayName: authUser.displayName?.trim() || email || "Staff",
      role,
    };
  } catch {
    return null;
  }
}

export async function findUserByLineId(
  db: Firestore,
  lineUserId: string,
): Promise<ResolvedLineUser | null> {
  const lineId = lineUserId.trim();
  if (!lineId) return null;

  const byToken = await db.collection("users").where("lineToken", "==", lineId).limit(1).get();
  if (!byToken.empty) {
    const mapped = mapUserDoc(byToken.docs[0]);
    if (mapped) return enrichRoleFromAuth(mapped);
  }

  const byUid = await db.collection("users").where("lineUid", "==", lineId).limit(1).get();
  if (!byUid.empty) {
    const mapped = mapUserDoc(byUid.docs[0]);
    if (mapped) return enrichRoleFromAuth(mapped);
  }

  const linkSnap = await db.collection("line_link_requests").doc(lineId).get();
  if (linkSnap.exists) {
    const link = linkSnap.data() ?? {};
    const status = typeof link.status === "string" ? link.status : "";
    const linkedUserId = typeof link.userId === "string" ? link.userId.trim() : "";
    if (status === "linked" && linkedUserId) {
      const userSnap = await db.collection("users").doc(linkedUserId).get();
      const mapped = mapUserDoc(userSnap);
      if (mapped) return enrichRoleFromAuth(mapped);
      return resolveFromAuthUid(linkedUserId);
    }
  }

  return null;
}
