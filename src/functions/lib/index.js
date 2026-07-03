"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.migrateStaffAttendanceByDate = exports.updateAuthUserEmail = exports.setUserClaims = exports.deleteAuthUser = exports.setAnonymousUserRole = exports.finalizeExamRoundOnClose = exports.requestExamAttemptGrading = exports.gradeSubmittedExamAttempt = exports.wordGameLeaveRoom = exports.wordGameSubmitGuess = exports.wordGameStart = exports.wordGameJoinRoom = exports.wordGameCreateRoom = exports.examPdfBytes = exports.horoscopeDaily = exports.deviceFingerprintAttendance = exports.qbAnalystChat = exports.resetPasswordByNationalId = exports.forceLogoutAllUsers = exports.hardResetUser = exports.forceLogoutUser = exports.lineStaffAttendance = exports.completeLineLinkWithToken = exports.lineWebhookV2 = exports.lineWebhook = exports.processLineLinkRequest = exports.reportDailyScheduled = exports.sendLineReport = void 0;
const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");
const firestore_1 = require("firebase-functions/v2/firestore");
const https_1 = require("firebase-functions/v2/https");
const getAdminFirestore_1 = require("./getAdminFirestore");
const callableOptions_1 = require("./callableOptions");
admin.initializeApp();
const db = (0, getAdminFirestore_1.getAdminFirestore)();
var sendLineReport_1 = require("./sendLineReport");
Object.defineProperty(exports, "sendLineReport", { enumerable: true, get: function () { return sendLineReport_1.sendLineReport; } });
var reportDailyScheduled_1 = require("./reportDailyScheduled");
Object.defineProperty(exports, "reportDailyScheduled", { enumerable: true, get: function () { return reportDailyScheduled_1.reportDailyScheduled; } });
var processLineLinkRequest_1 = require("./processLineLinkRequest");
Object.defineProperty(exports, "processLineLinkRequest", { enumerable: true, get: function () { return processLineLinkRequest_1.processLineLinkRequest; } });
var lineWebhook_1 = require("./lineWebhook");
Object.defineProperty(exports, "lineWebhook", { enumerable: true, get: function () { return lineWebhook_1.lineWebhook; } });
var lineWebhookV2_1 = require("./lineWebhookV2");
Object.defineProperty(exports, "lineWebhookV2", { enumerable: true, get: function () { return lineWebhookV2_1.lineWebhookV2; } });
var completeLineLinkWithToken_1 = require("./completeLineLinkWithToken");
Object.defineProperty(exports, "completeLineLinkWithToken", { enumerable: true, get: function () { return completeLineLinkWithToken_1.completeLineLinkWithToken; } });
var lineStaffAttendance_1 = require("./lineStaffAttendance");
Object.defineProperty(exports, "lineStaffAttendance", { enumerable: true, get: function () { return lineStaffAttendance_1.lineStaffAttendance; } });
var userAdminCallables_1 = require("./userAdminCallables");
Object.defineProperty(exports, "forceLogoutUser", { enumerable: true, get: function () { return userAdminCallables_1.forceLogoutUser; } });
Object.defineProperty(exports, "hardResetUser", { enumerable: true, get: function () { return userAdminCallables_1.hardResetUser; } });
Object.defineProperty(exports, "forceLogoutAllUsers", { enumerable: true, get: function () { return userAdminCallables_1.forceLogoutAllUsers; } });
var authCallables_1 = require("./authCallables");
Object.defineProperty(exports, "resetPasswordByNationalId", { enumerable: true, get: function () { return authCallables_1.resetPasswordByNationalId; } });
var qbAnalystChat_1 = require("./qbAnalystChat");
Object.defineProperty(exports, "qbAnalystChat", { enumerable: true, get: function () { return qbAnalystChat_1.qbAnalystChat; } });
var deviceFingerprintAttendance_1 = require("./deviceFingerprintAttendance");
Object.defineProperty(exports, "deviceFingerprintAttendance", { enumerable: true, get: function () { return deviceFingerprintAttendance_1.deviceFingerprintAttendance; } });
var horoscopeDaily_1 = require("./horoscopeDaily");
Object.defineProperty(exports, "horoscopeDaily", { enumerable: true, get: function () { return horoscopeDaily_1.horoscopeDaily; } });
var examPdfBytes_1 = require("./examPdfBytes");
Object.defineProperty(exports, "examPdfBytes", { enumerable: true, get: function () { return examPdfBytes_1.examPdfBytes; } });
var wordGame_1 = require("./wordGame");
Object.defineProperty(exports, "wordGameCreateRoom", { enumerable: true, get: function () { return wordGame_1.wordGameCreateRoom; } });
Object.defineProperty(exports, "wordGameJoinRoom", { enumerable: true, get: function () { return wordGame_1.wordGameJoinRoom; } });
Object.defineProperty(exports, "wordGameStart", { enumerable: true, get: function () { return wordGame_1.wordGameStart; } });
Object.defineProperty(exports, "wordGameSubmitGuess", { enumerable: true, get: function () { return wordGame_1.wordGameSubmitGuess; } });
Object.defineProperty(exports, "wordGameLeaveRoom", { enumerable: true, get: function () { return wordGame_1.wordGameLeaveRoom; } });
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
function orderQuestionIdsFromMap(questionMap) {
    return Array.from(questionMap.entries())
        .sort(([, a], [, b]) => (Number(a.orderIndex) || 0) - (Number(b.orderIndex) || 0))
        .map(([id]) => id);
}
function resolveEffectiveQuestionIds(selectedQuestionIds, questionMap) {
    if (selectedQuestionIds.length > 0) {
        const resolved = selectedQuestionIds.filter((qid) => questionMap.has(qid));
        if (resolved.length > 0)
            return resolved;
        if (questionMap.size > 0)
            return orderQuestionIdsFromMap(questionMap);
        return [];
    }
    return orderQuestionIdsFromMap(questionMap);
}
function normalizeTextAnswer(value) {
    return value.trim().toLowerCase().replace(/\s+/g, " ");
}
function getExpectedTextAnswer(questionData) {
    const expected = questionData.payload?.expectedAnswer;
    if (typeof expected === "string" && expected.trim()) {
        return expected.trim();
    }
    return null;
}
function resolveQuestionPoints(questionId, questionData, questionPoints) {
    const overridePts = questionPoints[questionId];
    const docPts = Number(questionData.points || 0);
    if (typeof overridePts === "number" && overridePts >= 0)
        return overridePts;
    if (docPts > 0)
        return docPts;
    return 1;
}
function addQuestionScore(totalScore, questionId, questionData, questionPoints) {
    const overridePts = questionPoints[questionId];
    const docPts = Number(questionData.points || 0);
    if (typeof overridePts === "number" && overridePts >= 0) {
        return totalScore + overridePts;
    }
    if (docPts > 0) {
        return totalScore + docPts;
    }
    return totalScore + 1;
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
        questionPoints: cfg?.questionPoints || {},
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
    const correctIndex = options.findIndex((opt) => opt?.isCorrect === true);
    if (correctIndex < 0)
        return null;
    const correct = options[correctIndex];
    if (typeof correct?.id === "string" && correct.id.trim())
        return correct.id.trim();
    return String(correctIndex + 1);
}
function legacyOptionKey(id) {
    const trimmed = id.trim();
    const legacy = /^opt-(\d+)$/.exec(trimmed);
    return legacy ? legacy[1] : trimmed;
}
function isSelectedOptionCorrect(selectedOptionId, correctOptionId, options) {
    if (!selectedOptionId.trim())
        return false;
    const sel = legacyOptionKey(selectedOptionId);
    const cor = legacyOptionKey(correctOptionId);
    if (sel === cor)
        return true;
    const correctIndex = options.findIndex((opt) => opt?.isCorrect === true);
    if (correctIndex < 0)
        return false;
    const selectedIndex = options.findIndex((opt, index) => {
        const oid = typeof opt.id === "string" && opt.id.trim()
            ? opt.id.trim()
            : String(index + 1);
        return legacyOptionKey(oid) === sel || oid === selectedOptionId.trim();
    });
    return selectedIndex >= 0 && selectedIndex === correctIndex;
}
function resolveStudentAnswer(questionId, questionIndex, effectiveIds, answers) {
    const direct = answers[questionId];
    if (typeof direct === "string" && direct.trim())
        return direct;
    const ordinalKey = String(questionIndex + 1);
    const ordinalAnswer = answers[ordinalKey];
    if (typeof ordinalAnswer === "string" && ordinalAnswer.trim())
        return ordinalAnswer;
    const answerKeys = Object.keys(answers).filter((k) => (answers[k] ?? "").trim());
    const overlap = answerKeys.some((k) => effectiveIds.includes(k));
    if (!overlap && answerKeys.length === effectiveIds.length) {
        const sortedKeys = [...answerKeys].sort((a, b) => {
            const na = Number(a);
            const nb = Number(b);
            if (Number.isFinite(na) && Number.isFinite(nb))
                return na - nb;
            return a.localeCompare(b);
        });
        const mapped = answers[sortedKeys[questionIndex]];
        if (typeof mapped === "string")
            return mapped;
    }
    return "";
}
async function autoGradeAttempt(db, attemptRef, attemptData, roomData, attemptId) {
    const roomId = typeof attemptData.roomId === "string" ? attemptData.roomId.trim() : "";
    const round = normalizeRound(attemptData.round);
    const { selectedQuestionIds, questionSetByQuestionId, questionPoints, fallbackQuestionSetId } = resolveRoundConfig(roomData, round);
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
    const effectiveQuestionIds = resolveEffectiveQuestionIds(selectedQuestionIds, questionMap);
    if (effectiveQuestionIds.length === 0) {
        console.warn("[autoGradeAttempt] no questions found for grading", { attemptId, roomId, round });
        return "skipped_no_questions";
    }
    const answers = (attemptData.answers && typeof attemptData.answers === "object") ? attemptData.answers : {};
    let totalScore = 0;
    let autoGradableMaxPoints = 0;
    let manualEssayCount = 0;
    effectiveQuestionIds.forEach((questionId, questionIndex) => {
        const q = questionMap.get(questionId);
        if (!q)
            return;
        const questionPointsValue = resolveQuestionPoints(questionId, q, questionPoints);
        if (q.type === "essay") {
            const expected = getExpectedTextAnswer(q);
            if (expected) {
                autoGradableMaxPoints += questionPointsValue;
                const studentAnswer = resolveStudentAnswer(questionId, questionIndex, effectiveQuestionIds, answers);
                if (normalizeTextAnswer(studentAnswer) === normalizeTextAnswer(expected)) {
                    totalScore = addQuestionScore(totalScore, questionId, q, questionPoints);
                }
                return;
            }
            manualEssayCount += 1;
            return;
        }
        autoGradableMaxPoints += questionPointsValue;
        const correctOptionId = getCorrectOptionId(q);
        if (!correctOptionId)
            return;
        const selectedOptionId = resolveStudentAnswer(questionId, questionIndex, effectiveQuestionIds, answers);
        const mcOptions = q.payload?.options ?? [];
        if (isSelectedOptionCorrect(selectedOptionId, correctOptionId, mcOptions)) {
            totalScore = addQuestionScore(totalScore, questionId, q, questionPoints);
        }
    });
    if (manualEssayCount > 0) {
        console.info("[autoGradeAttempt] partial grading — manual essay pending", {
            attemptId,
            roomId,
            round,
            manualEssayCount,
            totalScore,
            autoGradableMaxPoints,
        });
        await attemptRef.update({
            score: totalScore,
            status: "submitted",
            objectiveScore: totalScore,
            objectiveMaxPoints: autoGradableMaxPoints,
            pendingManualGrading: true,
            manualEssayCount,
        });
        return "partial_graded";
    }
    await attemptRef.update({
        score: totalScore,
        status: "graded",
        objectiveMaxPoints: autoGradableMaxPoints,
        pendingManualGrading: false,
        manualEssayCount: 0,
        gradedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return "graded";
}
/**
 * Trigger: auto-grade attempt when student submits.
 * Gen2 + database pmv1 — Gen1 triggers only listen to (default) DB.
 */
exports.gradeSubmittedExamAttempt = (0, firestore_1.onDocumentUpdated)({
    document: "exam_rooms/{roomId}/attempts/{attemptId}",
    region: callableOptions_1.CALLABLE_REGION,
    database: (0, getAdminFirestore_1.getFirestoreDatabaseId)(),
    timeoutSeconds: 120,
    memory: "512MiB",
}, async (event) => {
    const change = event.data;
    if (!change)
        return;
    const before = change.before.data();
    const after = change.after.data();
    const beforeStatus = String(before?.status || "");
    const afterStatus = String(after?.status || "");
    const justSubmitted = beforeStatus !== "submitted"
        && beforeStatus !== "graded"
        && afterStatus === "submitted";
    if (!justSubmitted || typeof after?.score === "number") {
        return;
    }
    const roomId = String(event.params.roomId);
    const attemptId = String(event.params.attemptId);
    const roomSnap = await db.collection("exam_rooms").doc(roomId).get();
    if (!roomSnap.exists) {
        console.warn("[gradeSubmittedExamAttempt] room not found", { attemptId, roomId });
        return;
    }
    const roomData = roomSnap.data();
    await autoGradeAttempt(db, change.after.ref, after, roomData, attemptId);
});
/**
 * Callable fallback — client invokes after submit (also recovers stuck attempts).
 */
exports.requestExamAttemptGrading = (0, https_1.onCall)({
    region: callableOptions_1.CALLABLE_REGION,
    cors: callableOptions_1.CALLABLE_CORS,
    invoker: "public",
    timeoutSeconds: 120,
    memory: "512MiB",
}, async (request) => {
    if (!request.auth?.uid) {
        throw new https_1.HttpsError("unauthenticated", "Must be signed in");
    }
    const roomId = typeof request.data?.roomId === "string" ? request.data.roomId.trim() : "";
    const attemptId = typeof request.data?.attemptId === "string" ? request.data.attemptId.trim() : "";
    if (!roomId || !attemptId) {
        throw new https_1.HttpsError("invalid-argument", "roomId and attemptId are required");
    }
    const attemptRef = db.collection("exam_rooms").doc(roomId).collection("attempts").doc(attemptId);
    const attemptSnap = await attemptRef.get();
    if (!attemptSnap.exists) {
        throw new https_1.HttpsError("not-found", "Attempt not found");
    }
    const attemptData = attemptSnap.data();
    if (attemptData.studentId !== request.auth.uid) {
        throw new https_1.HttpsError("permission-denied", "Not your attempt");
    }
    const status = String(attemptData.status || "");
    if (status !== "submitted" && status !== "graded") {
        throw new https_1.HttpsError("failed-precondition", "Attempt is not submitted yet");
    }
    if (typeof attemptData.score === "number" && attemptData.pendingManualGrading !== true) {
        return { status: "already_graded", score: attemptData.score };
    }
    const roomSnap = await db.collection("exam_rooms").doc(roomId).get();
    if (!roomSnap.exists) {
        throw new https_1.HttpsError("not-found", "Exam room not found");
    }
    const result = await autoGradeAttempt(db, attemptRef, attemptData, roomSnap.data(), attemptId);
    const refreshed = await attemptRef.get();
    const score = refreshed.data()?.score;
    return {
        status: result,
        score: typeof score === "number" ? score : undefined,
    };
});
/**
 * Trigger: when a round is closed, finalize in-progress attempts and auto-grade.
 * Gen2 + database pmv1.
 */
exports.finalizeExamRoundOnClose = (0, firestore_1.onDocumentUpdated)({
    document: "exam_rooms/{roomId}",
    region: callableOptions_1.CALLABLE_REGION,
    database: (0, getAdminFirestore_1.getFirestoreDatabaseId)(),
    timeoutSeconds: 180,
    memory: "512MiB",
}, async (event) => {
    const change = event.data;
    if (!change)
        return;
    const before = change.before.data();
    const after = change.after.data();
    const wasActive = before?.status === "active";
    const isActive = after?.status === "active";
    if (!wasActive || isActive)
        return;
    const closedRound = normalizeRound(before?.currentRound);
    const roomId = String(event.params.roomId);
    const attemptsSnap = await db
        .collection("exam_rooms").doc(roomId)
        .collection("attempts")
        .where("round", "==", closedRound)
        .get();
    if (attemptsSnap.empty)
        return;
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
        if (typeof data.score === "number")
            continue;
        await autoGradeAttempt(db, attemptDoc.ref, data, after, attemptDoc.id);
    }
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
exports.updateAuthUserEmail = functions
    .region("asia-southeast1")
    .https.onCall(async (data, context) => {
    await assertAdminCaller(context, db);
    const userId = typeof data?.userId === "string" ? data.userId.trim() : "";
    const authUid = typeof data?.authUid === "string" && data.authUid.trim() ? data.authUid.trim() : userId;
    const email = typeof data?.email === "string" ? data.email.trim().toLowerCase() : "";
    if (!userId || !authUid || !email) {
        throw new functions.https.HttpsError("invalid-argument", "userId, authUid, and email are required");
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        throw new functions.https.HttpsError("invalid-argument", "รูปแบบอีเมลไม่ถูกต้อง");
    }
    try {
        await admin.auth().updateUser(authUid, {
            email,
            emailVerified: false,
        });
    }
    catch (error) {
        if (error?.code === "auth/email-already-exists") {
            throw new functions.https.HttpsError("already-exists", "อีเมลนี้มีในระบบแล้ว");
        }
        if (error?.code === "auth/user-not-found") {
            throw new functions.https.HttpsError("not-found", "ไม่พบบัญชี Firebase Auth ของผู้ใช้นี้");
        }
        throw new functions.https.HttpsError("internal", error?.message || "อัปเดตอีเมลใน Firebase Auth ไม่สำเร็จ");
    }
    return { success: true, userId, authUid, email };
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