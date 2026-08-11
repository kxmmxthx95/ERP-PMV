/** Shared helpers for substitute-teaching LINE notifications. */

/**
 * Resolve a LINE uid from an id that may be either a `teachers/{id}` doc id
 * (with a linked `userId`) or a `users/{id}` doc id directly — schedules /
 * daily_schedules store teacherId in both shapes (see teacherIdentity.ts).
 */
export async function resolveTeacherLineUid(
  db: FirebaseFirestore.Firestore,
  teacherOrUserId: string,
): Promise<string> {
  const teacherSnap = await db.collection("teachers").doc(teacherOrUserId).get();
  const linkedUserId = teacherSnap.exists
    ? (teacherSnap.data()?.userId as string | undefined)
    : undefined;

  const userSnap = await db.collection("users").doc(linkedUserId || teacherOrUserId).get();
  if (!userSnap.exists) return "";

  const userData = userSnap.data();
  return String(userData?.lineUid || userData?.lineToken || "").trim();
}

export function formatSubstituteThaiDate(dateStr: string): string {
  try {
    const d = new Date(`${dateStr}T00:00:00`);
    return d.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return dateStr;
  }
}
