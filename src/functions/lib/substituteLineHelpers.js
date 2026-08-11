"use strict";
/** Shared helpers for substitute-teaching LINE notifications. */
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatSubstituteThaiDate = exports.resolveTeacherLineUid = void 0;
/**
 * Resolve a LINE uid from an id that may be either a `teachers/{id}` doc id
 * (with a linked `userId`) or a `users/{id}` doc id directly — schedules /
 * daily_schedules store teacherId in both shapes (see teacherIdentity.ts).
 */
async function resolveTeacherLineUid(db, teacherOrUserId) {
    const teacherSnap = await db.collection("teachers").doc(teacherOrUserId).get();
    const linkedUserId = teacherSnap.exists
        ? teacherSnap.data()?.userId
        : undefined;
    const userSnap = await db.collection("users").doc(linkedUserId || teacherOrUserId).get();
    if (!userSnap.exists)
        return "";
    const userData = userSnap.data();
    return String(userData?.lineUid || userData?.lineToken || "").trim();
}
exports.resolveTeacherLineUid = resolveTeacherLineUid;
function formatSubstituteThaiDate(dateStr) {
    try {
        const d = new Date(`${dateStr}T00:00:00`);
        return d.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
    }
    catch {
        return dateStr;
    }
}
exports.formatSubstituteThaiDate = formatSubstituteThaiDate;
//# sourceMappingURL=substituteLineHelpers.js.map