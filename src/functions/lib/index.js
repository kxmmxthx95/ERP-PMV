"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.migrateStaffAttendanceByDate = exports.forceLogoutAllUsers = exports.hardResetUser = exports.forceLogoutUser = exports.setUserClaims = exports.deleteAuthUser = exports.setAnonymousUserRole = exports.finalizeExamRoundOnClose = exports.gradeSubmittedExamAttempt = exports.completeLineLinkWithToken = exports.lineWebhookV2 = exports.lineWebhook = exports.processLineLinkRequest = exports.sendLineReport = void 0;
const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");
const firestore_1 = require("firebase-admin/firestore");
const crypto = require("crypto");
admin.initializeApp();
const DATABASE_ID = (process.env.FIRESTORE_DATABASE_ID ?? "").trim();
const db = DATABASE_ID && DATABASE_ID !== "(default)"
    ? (0, firestore_1.getFirestore)(DATABASE_ID)
    : (0, firestore_1.getFirestore)();
var sendLineReport_1 = require("./sendLineReport");
Object.defineProperty(exports, "sendLineReport", { enumerable: true, get: function () { return sendLineReport_1.sendLineReport; } });
var processLineLinkRequest_1 = require("./processLineLinkRequest");
Object.defineProperty(exports, "processLineLinkRequest", { enumerable: true, get: function () { return processLineLinkRequest_1.processLineLinkRequest; } });
var lineWebhook_1 = require("./lineWebhook");
Object.defineProperty(exports, "lineWebhook", { enumerable: true, get: function () { return lineWebhook_1.lineWebhook; } });
var lineWebhookV2_1 = require("./lineWebhookV2");
Object.defineProperty(exports, "lineWebhookV2", { enumerable: true, get: function () { return lineWebhookV2_1.lineWebhookV2; } });
exports.completeLineLinkWithToken = functions
    .region("asia-southeast1")
    .https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Must be authenticated");
    }
    const token = typeof data?.token === "string" ? data.token.trim() : "";
    if (!/^[a-fA-F0-9]{24,128}$/.test(token)) {
        throw new functions.https.HttpsError("invalid-argument", "Invalid link token");
    }
    const sessionRef = db.collection("line_link_sessions").doc(token);
    const now = Date.now();
    const result = await db.runTransaction(async (tx) => {
        const sessionSnap = await tx.get(sessionRef);
        if (!sessionSnap.exists) {
            throw new functions.https.HttpsError("not-found", "Link session not found");
        }
        const session = sessionSnap.data();
        const status = String(session.status || "pending");
        const lineUid = typeof session.lineUid === "string" ? session.lineUid.trim() : "";
        const usedBy = typeof session.usedBy === "string" ? session.usedBy.trim() : "";
        const expiresAtMs = tsMillis(session.expiresAt);
        if (!lineUid) {
            throw new functions.https.HttpsError("failed-precondition", "Session missing lineUid");
        }
        if (status !== "pending") {
            if (status === "used" && usedBy === context.auth.uid) {
                return { lineUid };
            }
            throw new functions.https.HttpsError("failed-precondition", "Link session already used");
        }
        if (expiresAtMs > 0 && now > expiresAtMs) {
            tx.update(sessionRef, {
                status: "expired",
                expiredAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            throw new functions.https.HttpsError("deadline-exceeded", "Link session expired");
        }
        const userId = context.auth.uid;
        const userRef = db.collection("users").doc(userId);
        const lineReqRef = db.collection("line_link_requests").doc(lineUid);
        tx.set(userRef, {
            lineToken: lineUid,
            lineLinkedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        tx.set(lineReqRef, {
            lineUid,
            userId,
            status: "linked",
            keyword: "PMV",
            linkedAt: admin.firestore.FieldValue.serverTimestamp(),
            linkedVia: "line_connect_token",
        }, { merge: true });
        tx.update(sessionRef, {
            status: "used",
            usedBy: userId,
            usedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return { lineUid };
    });
    return { success: true, lineUid: result.lineUid };
});
const STAFF_MIGRATION_BATCH_LIMIT = 450;
function isValidDateStr(value) {
    return /^\d{4}-\d{2}-\d{2}$/.test(value);
}
function inDateRange(date, from, to) {
    if (from && date < from)
        return false;
    if (to && date > to)
        return false;
    return true;
}
function tsMillis(value) {
    if (!value)
        return 0;
    if (value instanceof admin.firestore.Timestamp)
        return value.toMillis();
    if (value instanceof Date)
        return value.getTime();
    if (typeof value === "object" && value !== null && "toMillis" in value) {
        const maybeToMillis = value.toMillis;
        if (typeof maybeToMillis === "function") {
            try {
                return maybeToMillis();
            }
            catch {
                return 0;
            }
        }
    }
    return 0;
}
function scoreRecord(data) {
    let score = 0;
    if (data.checkInTime)
        score += 1;
    if (data.checkOutTime)
        score += 2;
    if (typeof data.status === "string" && data.status.length > 0)
        score += 1;
    if (typeof data.note === "string" && data.note.length > 0)
        score += 1;
    return score;
}
function pickBestRecord(records) {
    return records.reduce((best, current) => {
        const bestScore = scoreRecord(best.data);
        const currentScore = scoreRecord(current.data);
        if (currentScore > bestScore)
            return current;
        if (currentScore < bestScore)
            return best;
        const bestCheckOut = tsMillis(best.data.checkOutTime);
        const currentCheckOut = tsMillis(current.data.checkOutTime);
        if (currentCheckOut !== bestCheckOut) {
            return currentCheckOut > bestCheckOut ? current : best;
        }
        const bestCheckIn = tsMillis(best.data.checkInTime);
        const currentCheckIn = tsMillis(current.data.checkInTime);
        if (bestCheckIn === 0 && currentCheckIn > 0)
            return current;
        if (currentCheckIn === 0 && bestCheckIn > 0)
            return best;
        if (bestCheckIn !== currentCheckIn) {
            return currentCheckIn < bestCheckIn ? current : best;
        }
        const bestLastTime = Math.max(bestCheckOut, bestCheckIn);
        const currentLastTime = Math.max(currentCheckOut, currentCheckIn);
        return currentLastTime > bestLastTime ? current : best;
    });
}
function normalizeRound(value) {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 1;
}
function resolveRoundConfig(roomData, round) {
    const roundKey = String(round);
    const cfg = roomData.roundQuestions?.[roundKey] ||
        roomData.roundQuestions?.["∞"] ||
        roomData.roundQuestions?.["1"] ||
        (roomData.roundQuestions ? Object.values(roomData.roundQuestions)[0] : undefined);
    return {
        selectedQuestionIds: cfg?.questionIds || roomData.selectedQuestionIds || [],
        questionSetByQuestionId: cfg?.questionSetByQuestionId || {},
        fallbackQuestionSetId: cfg?.questionSetId || roomData.questionSetId,
    };
}
function getCorrectOptionId(questionData) {
    if (typeof questionData.correctOptionId === "string" && questionData.correctOptionId.trim()) {
        return questionData.correctOptionId.trim();
    }
    const options = questionData.payload?.options;
    if (!Array.isArray(options))
        return null;
    const correct = options.find((opt) => opt?.isCorrect === true && typeof opt.id === "string");
    return correct?.id?.trim() || null;
}
async function autoGradeAttempt(db, attemptRef, attemptData, roomData, attemptId) {
    const roomId = typeof attemptData.roomId === "string" ? attemptData.roomId.trim() : "";
    const round = normalizeRound(attemptData.round);
    const { selectedQuestionIds, questionSetByQuestionId, fallbackQuestionSetId } = resolveRoundConfig(roomData, round);
    if (selectedQuestionIds.length === 0) {
        await attemptRef.update({
            score: 0,
            status: "graded",
            gradedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return "graded";
    }
    const candidateSetIds = new Set();
    selectedQuestionIds.forEach((qid) => {
        const mapped = questionSetByQuestionId[qid];
        if (typeof mapped === "string" && mapped.trim()) {
            candidateSetIds.add(mapped.trim());
        }
    });
    if (typeof fallbackQuestionSetId === "string" && fallbackQuestionSetId.trim()) {
        candidateSetIds.add(fallbackQuestionSetId.trim());
    }
    if (candidateSetIds.size === 0) {
        console.warn("[autoGradeAttempt] no candidate question set ids", { attemptId, roomId, round });
        return "skipped_no_set_ids";
    }
    const questionMap = new Map();
    await Promise.all(Array.from(candidateSetIds).map(async (setId) => {
        const snap = await db.collection("question_sets").doc(setId).collection("questions").get();
        snap.forEach((docSnap) => {
            questionMap.set(docSnap.id, docSnap.data());
        });
    }));
    const answers = (attemptData.answers && typeof attemptData.answers === "object") ? attemptData.answers : {};
    let totalScore = 0;
    let hasEssayQuestion = false;
    selectedQuestionIds.forEach((questionId) => {
        const q = questionMap.get(questionId);
        if (!q)
            return;
        if (q.type === "essay") {
            hasEssayQuestion = true;
            return;
        }
        const correctOptionId = getCorrectOptionId(q);
        if (!correctOptionId)
            return;
        const selectedOptionId = typeof answers[questionId] === "string" ? answers[questionId] : "";
        if (selectedOptionId && selectedOptionId === correctOptionId) {
            totalScore += Number(q.points || 0);
        }
    });
    if (hasEssayQuestion) {
        console.info("[autoGradeAttempt] skipped auto-grading due to essay question", {
            attemptId,
            roomId,
            round,
        });
        return "skipped_essay";
    }
    await attemptRef.update({
        score: totalScore,
        status: "graded",
        gradedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return "graded";
}
/**
 * Trigger: auto-grade attempt when student submits.
 * Path: exam_rooms/{roomId}/attempts/{attemptId}
 * Flow:
 * - student submits -> status: submitted, score: null
 * - function calculates score from selected question set/IDs
 * - writes score + status: graded back to the same document
 */
exports.gradeSubmittedExamAttempt = functions
    .region("asia-southeast1")
    .runWith({ timeoutSeconds: 120, memory: "512MB" })
    .firestore.document("exam_rooms/{roomId}/attempts/{attemptId}")
    .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    // Run only when attempt transitions into submitted and has no score yet.
    const beforeStatus = String(before?.status || "");
    const afterStatus = String(after?.status || "");
    const afterScore = after?.score;
    const justSubmitted = beforeStatus !== "submitted" && beforeStatus !== "graded" && afterStatus === "submitted";
    if (!justSubmitted || afterScore !== null) {
        return null;
    }
    const roomId = String(context.params.roomId);
    const roomSnap = await db.collection("exam_rooms").doc(roomId).get();
    if (!roomSnap.exists) {
        console.warn("[gradeSubmittedExamAttempt] room not found", { attemptId: context.params.attemptId, roomId });
        return null;
    }
    const roomData = roomSnap.data();
    await autoGradeAttempt(db, change.after.ref, after, roomData, String(context.params.attemptId));
    return null;
});
/**
 * Trigger: when a round is closed, finalize in-progress attempts and auto-grade.
 * This ensures score summary table updates immediately after teacher closes exam.
 */
exports.finalizeExamRoundOnClose = functions
    .region("asia-southeast1")
    .runWith({ timeoutSeconds: 180, memory: "512MB" })
    .firestore.document("exam_rooms/{roomId}")
    .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    const wasActive = before?.status === "active";
    const isActive = after?.status === "active";
    if (!wasActive || isActive)
        return null;
    const closedRound = normalizeRound(before?.currentRound);
    const roomId = String(context.params.roomId);
    const attemptsSnap = await db
        .collection("exam_rooms").doc(roomId)
        .collection("attempts")
        .where("round", "==", closedRound)
        .get();
    if (attemptsSnap.empty)
        return null;
    for (const attemptDoc of attemptsSnap.docs) {
        const data = attemptDoc.data();
        const status = String(data.status || "");
        const score = data.score;
        if (status === "graded" || typeof score === "number")
            continue;
        if (status === "in_progress") {
            await attemptDoc.ref.update({
                status: "submitted",
                submittedAt: admin.firestore.FieldValue.serverTimestamp(),
                lastSavedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            data.status = "submitted";
        }
        if (String(data.status || "") !== "submitted")
            continue;
        if (data.score !== null)
            continue;
        await autoGradeAttempt(db, attemptDoc.ref, data, after, attemptDoc.id);
    }
    return null;
});
/**
 * Callable Function: ตั้ง custom claim (role) บน anonymous user หลัง login
 */
exports.setAnonymousUserRole = functions
    .region("asia-southeast1")
    .https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Must be authenticated");
    }
    const { firestoreUid } = data;
    if (!firestoreUid) {
        throw new functions.https.HttpsError("invalid-argument", "firestoreUid is required");
    }
    const userDoc = await db.collection("users").doc(firestoreUid).get();
    if (!userDoc.exists) {
        throw new functions.https.HttpsError("not-found", "User not found");
    }
    const role = userDoc.data()?.role;
    if (!role) {
        throw new functions.https.HttpsError("not-found", "User role not found");
    }
    await admin.auth().setCustomUserClaims(context.auth.uid, { role, firestoreUid });
    return { role };
});
/**
 * Callable Function: ลบบัญชีผู้ใช้จาก Auth และทำความสะอาดข้อมูลในทุก Collection
 * เรียกจาก Client เมื่อ Admin ต้องการลบผู้ใช้งาน
 */
exports.deleteAuthUser = functions
    .region("asia-southeast1")
    .https.onCall(async (data, context) => {
    // ตรวจสอบว่าผู้เรียกมีสิทธิ์ (ต้องเป็น Admin หรือ Sysadmin)
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Must be authenticated");
    }
    const callerRole = context.auth.token?.role;
    if (callerRole !== "admin" && callerRole !== "sysadmin") {
        throw new functions.https.HttpsError("permission-denied", "Only admin can delete users");
    }
    const { userId, authUid } = data;
    if (!userId || !authUid) {
        throw new functions.https.HttpsError("invalid-argument", "userId and authUid are required");
    }
    const batch = db.batch();
    try {
        // 1. ลบบัญชีใน Firebase Auth
        await admin.auth().deleteUser(authUid);
        console.log(`Deleted Auth account: ${authUid}`);
    }
    catch (error) {
        if (error.code !== "auth/user-not-found") {
            console.error(`Failed to delete Auth user ${authUid}:`, error);
            throw new functions.https.HttpsError("internal", `Failed to delete auth user: ${error.message}`);
        }
        console.log(`Auth user ${authUid} not found, continuing cleanup...`);
    }
    try {
        // 2. ลบ Document ใน users collection
        const userRef = db.collection("users").doc(userId);
        batch.delete(userRef);
        // 3. ลบจาก teachers (ถ้ามี)
        const teacherDoc = await db.collection("teachers").doc(userId).get();
        if (teacherDoc.exists)
            batch.delete(teacherDoc.ref);
        const teacherQuery = await db.collection("teachers").where("userId", "==", userId).get();
        teacherQuery.forEach(doc => batch.delete(doc.ref));
        // 4. ลบจาก students (ถ้ามี)
        const studentDoc = await db.collection("students").doc(userId).get();
        if (studentDoc.exists)
            batch.delete(studentDoc.ref);
        // 5. ลบ enrollments ของนักเรียน
        const enrollQuery = await db.collection("enrollments").where("studentId", "==", userId).get();
        enrollQuery.forEach(doc => batch.delete(doc.ref));
        // 6. ลบใบสมัคร
        const regSnapshot = await db
            .collection("registration_requests")
            .where("authUid", "==", userId)
            .get();
        regSnapshot.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        console.log(`Successfully cleaned up all data for user ${userId}`);
        return { success: true };
    }
    catch (error) {
        console.error(`Cleanup failed for user ${userId}:`, error);
        throw new functions.https.HttpsError("internal", `Cleanup failed: ${error.message}`);
    }
});
/**
 * Callable Function: ตั้ง Custom Claims ให้ผู้ใช้ที่เพิ่งสร้าง
 */
exports.setUserClaims = functions
    .region("asia-southeast1")
    .https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Must be authenticated");
    }
    const callerRole = context.auth.token?.role;
    if (callerRole !== "admin" && callerRole !== "sysadmin") {
        throw new functions.https.HttpsError("permission-denied", "Only admin can set claims");
    }
    const { uid, role } = data;
    if (!uid || !role) {
        throw new functions.https.HttpsError("invalid-argument", "uid and role are required");
    }
    await admin.auth().setCustomUserClaims(uid, { role });
    console.log(`Set custom claim 'role: ${role}' for user ${uid}`);
    return { success: true };
});
function isAdminRole(role) {
    return role === "admin" || role === "sysadmin";
}
async function assertAdminCaller(context, db) {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Must be authenticated");
    }
    const claimedRole = context.auth.token?.role;
    if (isAdminRole(claimedRole))
        return;
    const callerSnap = await db.collection("users").doc(context.auth.uid).get();
    const callerRole = callerSnap.data()?.role;
    if (!isAdminRole(callerRole)) {
        throw new functions.https.HttpsError("permission-denied", "Only admin can perform this action");
    }
}
function generateTempPassword(length = 12) {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
    const bytes = crypto.randomBytes(length);
    let out = "";
    for (let i = 0; i < length; i += 1) {
        out += alphabet[bytes[i] % alphabet.length];
    }
    return out;
}
exports.forceLogoutUser = functions
    .region("asia-southeast1")
    .https.onCall(async (data, context) => {
    await assertAdminCaller(context, db);
    const userId = typeof data?.userId === "string" ? data.userId.trim() : "";
    const authUid = typeof data?.authUid === "string" && data.authUid.trim() ? data.authUid.trim() : userId;
    if (!userId || !authUid) {
        throw new functions.https.HttpsError("invalid-argument", "userId and authUid are required");
    }
    await admin.auth().revokeRefreshTokens(authUid);
    await db.collection("users").doc(userId).set({
        forceLogoutAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    return { success: true, userId, authUid };
});
exports.hardResetUser = functions
    .region("asia-southeast1")
    .https.onCall(async (data, context) => {
    await assertAdminCaller(context, db);
    const userId = typeof data?.userId === "string" ? data.userId.trim() : "";
    const authUid = typeof data?.authUid === "string" && data.authUid.trim() ? data.authUid.trim() : userId;
    if (!userId || !authUid) {
        throw new functions.https.HttpsError("invalid-argument", "userId and authUid are required");
    }
    const tempPassword = generateTempPassword(12);
    await admin.auth().updateUser(authUid, {
        password: tempPassword,
        disabled: false,
    });
    await admin.auth().revokeRefreshTokens(authUid);
    await db.collection("users").doc(userId).set({
        mustChangePassword: true,
        status: "active",
        hardResetAt: admin.firestore.FieldValue.serverTimestamp(),
        sessionInvalidatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    return {
        success: true,
        userId,
        authUid,
        tempPassword,
    };
});
exports.forceLogoutAllUsers = functions
    .region("asia-southeast1")
    .https.onCall(async (_data, context) => {
    await assertAdminCaller(context, db);
    await db.collection("system_config").doc("auth_controls").set({
        forceLogoutAllAt: admin.firestore.FieldValue.serverTimestamp(),
        forcedByUid: context.auth?.uid ?? null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    return { success: true };
});
/**
 * Callable Function: Migrate legacy staff_attendance -> staff_attendance_by_date/{date}/entries/{userId}
 * Supports dryRun + optional date range filter.
 */
exports.migrateStaffAttendanceByDate = functions
    .region("asia-southeast1")
    .runWith({ timeoutSeconds: 540, memory: "1GB" })
    .https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Must be authenticated");
    }
    const caller = await db.collection("users").doc(context.auth.uid).get();
    const callerRole = caller.data()?.role;
    if (callerRole !== "admin" && callerRole !== "sysadmin") {
        throw new functions.https.HttpsError("permission-denied", "Only admin can run migration");
    }
    const dryRun = Boolean(data?.dryRun);
    const from = typeof data?.from === "string" && data.from.trim() ? data.from.trim() : null;
    const to = typeof data?.to === "string" && data.to.trim() ? data.to.trim() : null;
    if (from && !isValidDateStr(from)) {
        throw new functions.https.HttpsError("invalid-argument", "Invalid from date format (YYYY-MM-DD)");
    }
    if (to && !isValidDateStr(to)) {
        throw new functions.https.HttpsError("invalid-argument", "Invalid to date format (YYYY-MM-DD)");
    }
    if (from && to && from > to) {
        throw new functions.https.HttpsError("invalid-argument", "from must be <= to");
    }
    const legacySnap = await db.collection("staff_attendance").get();
    const grouped = new Map();
    let invalid = 0;
    let outOfRange = 0;
    legacySnap.forEach((docSnap) => {
        const row = docSnap.data();
        const userId = typeof row.userId === "string" ? row.userId.trim() : "";
        const date = typeof row.date === "string" ? row.date.trim() : "";
        if (!userId || !date || !isValidDateStr(date)) {
            invalid += 1;
            return;
        }
        if (!inDateRange(date, from, to)) {
            outOfRange += 1;
            return;
        }
        const key = `${userId}__${date}`;
        const arr = grouped.get(key) ?? [];
        arr.push({ id: docSnap.id, data: row });
        grouped.set(key, arr);
    });
    let batch = db.batch();
    let opCount = 0;
    let migratedEntries = 0;
    let preservedExistingBetter = 0;
    let touchedDays = 0;
    let duplicateGroups = 0;
    const dayTouched = new Set();
    for (const [key, records] of grouped.entries()) {
        if (records.length > 1)
            duplicateGroups += 1;
        const [userId, date] = key.split("__");
        const legacyBest = pickBestRecord(records);
        const targetRef = db.collection("staff_attendance_by_date").doc(date).collection("entries").doc(userId);
        const targetSnap = await targetRef.get();
        const candidates = [legacyBest];
        if (targetSnap.exists) {
            candidates.push({ id: "existing-target", data: targetSnap.data() ?? {} });
        }
        const winner = pickBestRecord(candidates);
        if (winner.id === "existing-target") {
            preservedExistingBetter += 1;
            continue;
        }
        const dayRef = db.collection("staff_attendance_by_date").doc(date);
        if (!dayTouched.has(date)) {
            batch.set(dayRef, {
                date,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
            dayTouched.add(date);
            opCount += 1;
            touchedDays += 1;
        }
        batch.set(targetRef, {
            ...legacyBest.data,
            userId,
            date,
            migratedFromLegacyAt: admin.firestore.FieldValue.serverTimestamp(),
            migratedFromLegacyDocId: legacyBest.id,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        opCount += 1;
        migratedEntries += 1;
        if (opCount >= STAFF_MIGRATION_BATCH_LIMIT) {
            if (!dryRun)
                await batch.commit();
            batch = db.batch();
            opCount = 0;
            dayTouched.clear();
        }
    }
    if (opCount > 0 && !dryRun) {
        await batch.commit();
    }
    return {
        success: true,
        dryRun,
        range: { from, to },
        scannedLegacyDocs: legacySnap.size,
        groupedUserDateRecords: grouped.size,
        duplicateGroups,
        migratedEntries,
        preservedExistingBetter,
        touchedDays,
        skippedInvalidDocs: invalid,
        skippedOutOfRangeDocs: outOfRange,
    };
});
//# sourceMappingURL=index.js.map